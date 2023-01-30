/*
 * This file is part of Privacy Badger <https://privacybadger.org/>
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

(function () {

// don't inject into non-HTML documents (such as XML documents)
// but do inject into XHTML documents
if (document instanceof HTMLDocument === false && (
  document instanceof XMLDocument === false ||
  document.createElement('div') instanceof HTMLDivElement === false
)) {
  return;
}

function getPageScript(event_id) {

  // code below is not a content script: no chrome.* APIs /////////////////////

  // return a string
  return "(" + function (EVENT_ID, DOCUMENT, dispatchEvent, CUSTOM_EVENT, ERROR, DATE, setTimeout, OBJECT, FUNCTION, UNDEFINED) {

    const V8_STACK_TRACE_API = !!(ERROR && ERROR.captureStackTrace);

    if (V8_STACK_TRACE_API) {
      ERROR.stackTraceLimit = Infinity; // collect all frames
    }

    function hasOwn(obj, prop) {
      return OBJECT.prototype.hasOwnProperty.call(obj, prop);
    }
    function apply(obj, context, args) {
      return FUNCTION.prototype.apply.call(obj, context, args);
    }

    // adapted from Underscore v1.6.0
    function debounce(func, wait, immediate) {
      let timeout, args, context, timestamp, result;

      let later = function () {
        let last = DATE.now() - timestamp;
        if (last < wait) {
          timeout = setTimeout(later, wait - last);
        } else {
          timeout = null;
          if (!immediate) {
            result = apply(func, context, args);
            context = args = null;
          }
        }
      };

      return function () {
        context = this; // eslint-disable-line consistent-this
        args = arguments;
        timestamp = DATE.now();
        let callNow = immediate && !timeout;
        if (!timeout) {
          timeout = setTimeout(later, wait);
        }
        if (callNow) {
          result = apply(func, context, args);
          context = args = null;
        }

        return result;
      };
    }

    // messages the injected script
    let send = (function () {
      let messages = [];

      // debounce sending queued messages
      let _send = debounce(function () {
        dispatchEvent.call(DOCUMENT, new CUSTOM_EVENT(EVENT_ID, {
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
        throw new ERROR();
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

      // from https://github.com/csnover/TraceKit/blob/b76ad786f84ed0c94701c83d8963458a8da54d57/tracekit.js#L641
      const geckoCallSiteRe = /^\s*(.*?)(?:\((.*?)\))?@?((?:file|https?|chrome):.*?):(\d+)(?::(\d+))?\s*$/i,
        scriptUrlMatches = callSite.match(geckoCallSiteRe);
      return scriptUrlMatches && scriptUrlMatches[3] || '';
    }

    /**
     * Parses the stack trace for the originating script URL.
     * @returns {String} The URL of the originating script
     */
    function getOriginatingScriptUrl() {
      let trace = getStackTrace();

      if (OBJECT.prototype.toString.call(trace) == '[object String]') {
        // we failed to get a structured stack trace
        trace = trace.split('\n');
        // this script is at 0, 1, 2 and 3
        let script_url_matches = trace[4].match(/\((http.*:\d+:\d+)/);
        // TODO do we need stripLineAndColumnNumbers (in both places) here?
        return script_url_matches && stripLineAndColumnNumbers(script_url_matches[1]) || stripLineAndColumnNumbers(trace[4]);
      }

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
      let is_canvas_write = (
        item.propName == 'fillText' || item.propName == 'strokeText'
      );

      item.obj[item.propName] = (function (orig) {
        // set to true after the first write, if the method is not
        // restorable. Happens if another library also overwrites
        // this method.
        let skip_monitoring = false;

        function wrapped() {
          let args = arguments;

          if (is_canvas_write) {
            // to avoid false positives,
            // bail if the text being written is too short,
            // of if we've already sent a monitoring payload
            if (skip_monitoring || !args[0] || args[0].length < 5) {
              return apply(orig, this, args);
            }
          }

          let script_url = (
              V8_STACK_TRACE_API ?
                getOriginatingScriptUrl() :
                getOriginatingScriptUrlFirefox()
            ),
            msg = {
              obj: item.objName,
              prop: item.propName,
              scriptUrl: script_url
            };

          if (hasOwn(item, 'extra')) {
            msg.extra = apply(item.extra, this, args);
          }

          send(msg);

          if (is_canvas_write) {
            // optimization: one canvas write is enough,
            // restore original write method
            // to this CanvasRenderingContext2D object instance
            // Careful! Only restorable if we haven't already been replaced
            // by another lib, such as the hidpi polyfill
            if (this[item.propName] === wrapped) {
              this[item.propName] = orig;
            } else {
              skip_monitoring = true;
            }
          }

          return apply(orig, this, args);
        }

        OBJECT.defineProperty(wrapped, "name", { value: orig.name });
        OBJECT.defineProperty(wrapped, "length", { value: orig.length });
        OBJECT.defineProperty(wrapped, "toString", { value: orig.toString.bind(orig) });

        return wrapped;

      }(item.obj[item.propName]));
    }

    let methods = [];

    for (let method of ['getImageData', 'fillText', 'strokeText']) {
      let item = {
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
          let args = arguments,
            width = args[2],
            height = args[3];

          // "this" is a CanvasRenderingContext2D object
          if (width === UNDEFINED) {
            width = this.canvas.width;
          }
          if (height === UNDEFINED) {
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
    }

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

    for (let method of methods) {
      trapInstanceMethod(method);
    }

  // save locally to keep from getting overwritten by site code
  } + "(" + event_id + ", document, document.dispatchEvent, CustomEvent, Error, Date, setTimeout, Object, Function));";

  // code above is not a content script: no chrome.* APIs /////////////////////

}

// END FUNCTION DEFINITIONS ///////////////////////////////////////////////////

// TODO race condition; fix waiting on https://crbug.com/478183
chrome.runtime.sendMessage({
  type: "detectFingerprinting"
}, function (enabled) {
  if (!enabled) {
    return;
  }

  const event_id = Math.random();

  // listen for messages from the script we are about to insert
  document.addEventListener(event_id, function (e) {
    // pass these on to the background page (handled by webrequest.js)
    chrome.runtime.sendMessage({
      type: "fpReport",
      data: e.detail
    });
  });

  window.injectScript(getPageScript(event_id));
});

}());
