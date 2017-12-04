(function() {
/**
 * This sets up a counter on methods that are commonly used for fingerprinting.
 *
 * # thoughts for a metric over the counts:
 * We can think about each finger printing method a dimension in N dimensional
 * space. Then we can think about this as a metric on an N dimensional vector.
 * where each fingerprinting method maps to an element of this vector.
 *
 * A first naive metric can be the count of all elements of the vector that are
 * non-zero. The higher the metric, the more likely the fingerprinting.
 *
 * Later to improve the metric, we can add weights to each dimension, and
 * consider the number of times each function is called.
 *
 * Hopefully this will work okay, it kinda assumes the dimensions are linearly
 * independent. This certainly isn't true. Once we have more data, we can
 * empirically determine a transformation function that would account for
 * non-independence.
 *
 * test sites found with: https://publicwww.com/websites/%22fingerprint2.min.js%22/
 *
 * ryanair.com  # interesting 0.8 result
 * biggo.com.tw
 * https://www.sitejabber.com/
 * http://www.gettvstreamnow.com/ 0.95
 * https://adsbackend.com/  # is this broken? lol
 *
 * it seems like 0.8 is the minimum for sites using fpjs2,
 * 0.45 is the max I've seen (from github). So I set the threshold
 * at 0.75 for now.
 *
 * this site is loading from augur.io (I think?) and scoring 0.85.
 * http://www.dixipay.com/
 */

let threshold = 0.75;

/**
 * fingerprintjs2 defines the following "keys"
 *
 * then some jsFontsKeys and flashFontsKeys
 *
 * I'll try to catch each of these
 */
let objects = [
  //    keys = this.userAgentKey(keys);
  'navigator.userAgent',
  //    keys = this.languageKey(keys);
  'navigator.language',
  //    keys = this.pixelRatioKey(keys);
  'window.devicePixelRatio',
  //    keys = this.hasLiedLanguagesKey(keys);
  'navigator.languages',
  //    keys = this.colorDepthKey(keys);
  'screen.colorDepth',
  //    keys = this.hardwareConcurrencyKey(keys);
  'navigator.hardwareConcurrency',
  //    keys = this.cpuClassKey(keys);
  'navigator.cpuClass',
  //    keys = this.platformKey(keys);
  'navigator.platform',
  //    keys = this.doNotTrackKey(keys);
  'navigator.doNotTrack',
  //    keys = this.touchSupportKey(keys);
  'navigator.maxTouchPoints',

  //    keys = this.screenResolutionKey(keys);
  'screen.width',
  //    keys = this.availableScreenResolutionKey(keys);
  'screen.availWidth',
  // these also are counted with:
  //    keys = this.hasLiedResolutionKey(keys);

  //    keys = this.timezoneOffsetKey(keys);
  'Date.prototype.getTimezoneOffset',
  //    keys = this.sessionStorageKey(keys);
  'window.sessionStorage',
  //    keys = this.localStorageKey(keys);
  'window.localStorage',
  //    keys = this.indexedDbKey(keys);
  'window.indexedDB',
  //    keys = this.openDatabaseKey(keys);
  'window.openDatabase',
  //    keys = this.pluginsKey(keys);
  'navigator.plugins',
  //    keys = this.canvasKey(keys);
  'window.CanvasRenderingContext2D.prototype.rect',
  //    keys = this.webglKey(keys);
  'window.WebGLRenderingContext.prototype.createBuffer',
  //    keys = this.adBlockKey(keys);
  //    keys = this.addBehaviorKey(keys);
  //    keys = this.hasLiedOsKey(keys);
  //    keys = this.hasLiedBrowserKey(keys);
  //    keys = this.customEntropyFunction(keys);
];

// todo: what is a better data structure here?
let _objectsHelper = (dottedString) => {
  let arr = dottedString.split('.'),
    last = arr.pop(),
    base = window[arr.shift()];
  if (arr) {
    base = arr.reduce((o, i) => o[i], base);
  }
  return {
    'name': dottedString,
    'baseObj': base,
    'propName': last
  };
};

// get the origin of arguments.callee.caller
function scriptOrigin() {
  try {
    yo = dog;  // eslint-disable-line
  } catch (e) {
    return e.stack.split('\n')[3].split('/')[2];
  }
}

function Counter(methods, onFingerPrinting) {
  this.methods = methods;
  this.origins = {};
  this.nMethods = methods.length;
  this.isFingerprinting = false;
  this.onFingerPrinting = onFingerPrinting;
  for (let m of methods) {
    this.wrapMethod(m);
  }
}

Counter.prototype = {
  // triggered when an origin crosses the fingerprinting threshold
  onFingerPrinting: function () {
    console.log('onFingerPrinting dummy function fired. You should overwrite me to do something useful.');
  },

  // wrap a dotted method name with a counter
  wrapMethod: function(dottedPropName) {
    let self = this,
      propInfo = _objectsHelper(dottedPropName),
      name = propInfo.name,
      baseObj = propInfo.baseObj,
      propName = propInfo.propName,
      before = baseObj[propName];

    Object.defineProperty(baseObj, propName, {
      get: function() {
        self.addCall(name, scriptOrigin());
        return before;
      }
    });
  },

  addOrigin: function() {
    let out = {counts: {}, nnzCounts: 0};
    for (let m of this.methods) {
      out.counts[m] = 0;
    }
    return out;
  },

  /*
   * Keep a running score/nnzCounts. This lets us avoid polling
   * counter.isFingerPrinting.
   */
  addCall: function(name, origin) {
    // register origin if we haven't seen it
    if (!this.origins.hasOwnProperty(origin)) {
      this.origins[origin] = this.addOrigin();
    }

    if (this.origins[origin].counts[name] === 0) {
      this.origins[origin].nnzCounts += 1;
      if ((this.origins[origin].nnzCounts/this.nMethods) > threshold &&
          (!this.isFingerprinting)) {
        this.isFingerprinting = true;
        this.onFingerPrinting(origin);
      }
    }
    this.origins[origin].counts[name] += 1;
  },
};

function send(origin) {
  console.log(origin);
  document.dispatchEvent(new CustomEvent(event_id, {
    detail: {countedFingers: true, origin: origin},
  }));
}

// get this asap before the script tag is removed
let event_id = document.currentScript.getAttribute('data');
/* start 'em up */
let counter = new Counter(objects, send); // eslint-disable-line
})();
