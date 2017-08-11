let event_id = document.currentScript.getAttribute('data');

let messages = [];
// debounce sending queued messages
let _send = debounce(function () {
  document.dispatchEvent(new CustomEvent(event_id, {
    detail: messages
  }));

  // clear the queue
  messages = [];
}, 100);

// from Underscore v1.6.0
function debounce(func, wait, immediate) {
  let timeout, args, context, timestamp, result;

  let later = function () {
    let last = Date.now() - timestamp;
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
    context = this;
    args = arguments;
    timestamp = Date.now();
    let callNow = immediate && !timeout;
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

function send(msg) {
  // queue the message
  messages.push(msg);
  _send();
}

function getScriptURL() {
  let urlRegex = /\bhttps?:\/\/\S+/gi,
    rmLineAndCol = /:\d+:.*$/;
  try {
    yo = dog;  // eslint-disable-line
  } catch (e) {
    return e.stack.split('\n')[3]
      .match(urlRegex)[0]
      .replace(rmLineAndCol, '');
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

    return function () {
      let args = arguments;

      if (is_canvas_write) {
        // to avoid false positives,
        // bail if the text being written is too short
        if (!args[0] || args[0].length < 5) {
          return orig.apply(this, args);
        }
      }

      let msg = {
        obj: item.objName,
        prop: item.propName,
        scriptUrl: getScriptURL(),
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

  })(item.obj[item.propName]);
}

let methods = [];

['getImageData', 'fillText', 'strokeText'].forEach(function (method) {
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
