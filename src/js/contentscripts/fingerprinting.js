/*
 * This file is part of Privacy Badger <https://www.eff.org/privacybadger>
 * Copyright (C) 2015 Electronic Frontier Foundation
 *
 * Derived from Chameleon <https://github.com/ghostwords/chameleon>
 * Copyright (C) 2015 ghostwords
 *
 * Privacy Badger is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Privacy Badger is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Privacy Badger.  If not, see <http://www.gnu.org/licenses/>.
 */

function getFpPageScript() {

  // code below is not a content script: no chrome.* APIs /////////////////////

  // return a string
  return "(" + function (ERROR) {

    const V8_STACK_TRACE_API = !!(ERROR && ERROR.captureStackTrace);

    if (V8_STACK_TRACE_API) {
      ERROR.stackTraceLimit = Infinity; // collect all frames
    } else {
      // from https://github.com/csnover/TraceKit/blob/b76ad786f84ed0c94701c83d8963458a8da54d57/tracekit.js#L641
      var geckoCallSiteRe = /^\s*(.*?)(?:\((.*?)\))?@?((?:file|https?|chrome):.*?):(\d+)(?::(\d+))?\s*$/i;
    }

    var event_id = document.currentScript.getAttribute('data-event-id');

    // from Underscore v1.6.0
    function debounce(func, wait, immediate) {
      var timeout, args, context, timestamp, result;

      var later = function () {
        var last = Date.now() - timestamp;
        if (last < wait) {
          timeout = setTimeout(later, wait - last);
        } else {
          timeout = null;
          if (!immediate) {
            result = func.apply(context, args);
            context = args = null;
          }
        }
      };

      return function () {
        context = this; // eslint-disable-line consistent-this
        args = arguments;
        timestamp = Date.now();
        var callNow = immediate && !timeout;
        if (!timeout) {
          timeout = setTimeout(later, wait);
        }
        if (callNow) {
          result = func.apply(context, args);
          context = args = null;
        }

        return result;
      };
    }

    // messages the injected script
    var send = (function () {
      var messages = [];

      // debounce sending queued messages
      var _send = debounce(function () {
        document.dispatchEvent(new CustomEvent(event_id, {
          detail: messages
        }));

        // clear the queue 
        messages = [];
      }, 100);

      return function (msg) {
        // queue the message
        messages.push(msg);

        _send();
      };
    }());

    /**
     * Gets the stack trace by throwing and catching an exception.
     * @returns {*} Returns the stack trace
     */
    function getStackTraceFirefox() {
      let stack;

      try {
        throw new Error();
      } catch (err) {
        stack = err.stack;
      }

      return stack.split('\n');
    }

    /**
     * Gets the stack trace using the V8 stack trace API:
     * https://github.com/v8/v8/wiki/Stack-Trace-API
     * @returns {*} Returns the stack trace
     */
    function getStackTrace() {
      let err = {},
        origFormatter,
        stack;

      origFormatter = ERROR.prepareStackTrace;
      ERROR.prepareStackTrace = function (_, structuredStackTrace) {
        return structuredStackTrace;
      };

      ERROR.captureStackTrace(err, getStackTrace);
      stack = err.stack;

      ERROR.prepareStackTrace = origFormatter;

      return stack;
    }

    /**
     * Strip away the line and column number (from stack trace urls)
     * @param script_url The stack trace url to strip
     * @returns {String} the pure URL
     */
    function stripLineAndColumnNumbers(script_url) {
      return script_url.replace(/:\d+:\d+$/, '');
    }

    /**
     * Parses the stack trace for the originating script URL
     * without using the V8 stack trace API.
     * @returns {String} The URL of the originating script
     */
    function getOriginatingScriptUrlFirefox() {
      let trace = getStackTraceFirefox();

      if (trace.length < 4) {
        return '';
      }

      // this script is at 0, 1 and 2
      let callSite = trace[3];

      let scriptUrlMatches = callSite.match(geckoCallSiteRe);
      return scriptUrlMatches && scriptUrlMatches[3] || '';
    }

    /**
     * Parses the stack trace for the originating script URL.
     * @returns {String} The URL of the originating script
     */
    function getOriginatingScriptUrl() {
      let trace = getStackTrace();

      if (trace.length < 2) {
        return '';
      }

      // this script is at 0 and 1
      let callSite = trace[2];

      if (callSite.isEval()) {
        // argh, getEvalOrigin returns a string ...
        let eval_origin = callSite.getEvalOrigin(),
          script_url_matches = eval_origin.match(/\((http.*:\d+:\d+)/);

        // TODO do we need stripLineAndColumnNumbers (in both places) here?
        return script_url_matches && stripLineAndColumnNumbers(script_url_matches[1]) || stripLineAndColumnNumbers(eval_origin);
      } else {
        return callSite.getFileName();
      }
    }

    /**
     * Monitor the writes in a canvas instance
     * @param item special item objects
     */
    function trapInstanceMethod(item) {
      var is_canvas_write = (
        item.propName == 'fillText' || item.propName == 'strokeText'
      );

      item.obj[item.propName] = (function (orig) {

        return function () {
          var args = arguments;

          if (is_canvas_write) {
            // to avoid false positives,
            // bail if the text being written is too short
            if (!args[0] || args[0].length < 5) {
              return orig.apply(this, args);
            }
          }

          var script_url = (
              V8_STACK_TRACE_API ?
                getOriginatingScriptUrl() :
                getOriginatingScriptUrlFirefox()
            ),
            msg = {
              obj: item.objName,
              prop: item.propName,
              scriptUrl: script_url
            };

          if (item.hasOwnProperty('extra')) {
            msg.extra = item.extra.apply(this, args);
          }

          send(msg);

          if (is_canvas_write) {
            // optimization: one canvas write is enough,
            // restore original write method
            // to this CanvasRenderingContext2D object instance
            this[item.propName] = orig;
          }

          return orig.apply(this, args);
        };

      }(item.obj[item.propName]));
    }

    var methods = [];

    ['getImageData', 'fillText', 'strokeText'].forEach(function (method) {
      var item = {
        objName: 'CanvasRenderingContext2D.prototype',
        propName: method,
        obj: CanvasRenderingContext2D.prototype,
        extra: function () {
          return {
            canvas: true
          };
        }
      };

      if (method == 'getImageData') {
        item.extra = function () {
          var args = arguments,
            width = args[2],
            height = args[3];

          // "this" is a CanvasRenderingContext2D object
          if (width === undefined) {
            width = this.canvas.width;
          }
          if (height === undefined) {
            height = this.canvas.height;
          }

          return {
            canvas: true,
            width: width,
            height: height
          };
        };
      }

      methods.push(item);
    });

    methods.push({
      objName: 'HTMLCanvasElement.prototype',
      propName: 'toDataURL',
      obj: HTMLCanvasElement.prototype,
      extra: function () {
        // "this" is a canvas element
        return {
          canvas: true,
          width: this.width,
          height: this.height
        };
      }
    });

    methods.forEach(trapInstanceMethod);

  // save locally to keep from getting overwritten by site code
  } + "(Error));";

  // code above is not a content script: no chrome.* APIs /////////////////////

}

/**
 * Executes a script in the page DOM context
 *
 * @param text The content of the script to insert
 * @param data attributes to set in the inserted script tag
 */
function insertFpScript(text, data) {
  var parent = document.documentElement,
    script = document.createElement('script');

  script.text = text;
  script.async = false;

  for (var key in data) {
    script.setAttribute('data-' + key.replace('_', '-'), data[key]);
  }

  parent.insertBefore(script, parent.firstChild);
  parent.removeChild(script);
}


// END FUNCTION DEFINITIONS ///////////////////////////////////////////////////

(function () {

// don't inject into non-HTML documents (such as XML documents)
// but do inject into XHTML documents
if (document instanceof HTMLDocument === false && (
  document instanceof XMLDocument === false ||
  document.createElement('div') instanceof HTMLDivElement === false
)) {
  return;
}

// TODO race condition; fix waiting on https://crbug.com/478183
chrome.runtime.sendMessage({checkEnabled: true},
  function (enabled) {
    if (!enabled) {
      return;
    }
    /**
     * Communicating to webrequest.js
     */
    var event_id = Math.random();

    // listen for messages from the script we are about to insert
    document.addEventListener(event_id, function (e) {
      // pass these on to the background page
      chrome.runtime.sendMessage({
        'fpReport': e.detail
      });
    });

    insertFpScript(getFpPageScript(), {
      event_id: event_id
    });
  }
);

}());
