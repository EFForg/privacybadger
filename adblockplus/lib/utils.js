/*
 * This file is part of Adblock Plus <http://adblockplus.org/>,
 * Copyright (C) 2006-2013 Eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

/**
 * @fileOverview Module containing a bunch of utility functions.
 */

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");
let sidebarParams = null;

/**
 * Provides a bunch of utility functions.
 * @class
 */
let Utils = exports.Utils =
{
  /**
   * Returns the add-on ID used by Adblock Plus
   */
  get addonID()
  {
    let {addonID} = require("info");
    return addonID;
  },

  /**
   * Returns the installed Adblock Plus version
   */
  get addonVersion()
  {
    let {addonVersion} = require("info");
    return addonVersion;
  },

  /**
   * Returns whether we are running in Fennec, for Fennec-specific hacks
   * @type Boolean
   */
  get isFennec()
  {
    let {application} = require("info");
    let result = (application == "fennec" || application == "fennec2");
    Utils.__defineGetter__("isFennec", function() result);
    return result;
  },

  /**
   * Returns the user interface locale selected for adblockplus chrome package.
   */
  get appLocale()
  {
    let locale = "en-US";
    try
    {
      locale = Utils.chromeRegistry.getSelectedLocale("adblockplus");
    }
    catch (e)
    {
      Cu.reportError(e);
    }
    Utils.__defineGetter__("appLocale", function() locale);
    return Utils.appLocale;
  },

  /**
   * Returns version of the Gecko platform
   */
  get platformVersion()
  {
    let platformVersion = Services.appinfo.platformVersion;
    Utils.__defineGetter__("platformVersion", function() platformVersion);
    return Utils.platformVersion;
  },

  /**
   * Retrieves a string from global.properties string bundle, will throw if string isn't found.
   *
   * @param {String} name  string name
   * @return {String}
   */
  getString: function(name)
  {
    // Randomize URI to work around bug 719376
    let stringBundle = Services.strings.createBundle("chrome://adblockplus/locale/global.properties?" + Math.random());
    Utils.getString = function(name)
    {
      return stringBundle.GetStringFromName(name);
    }
    return Utils.getString(name);
  },

  /**
   * Shows an alert message like window.alert() but with a custom title.
   *
   * @param {Window} parentWindow  parent window of the dialog (can be null)
   * @param {String} message  message to be displayed
   * @param {String} [title]  dialog title, default title will be used if omitted
   */
  alert: function(parentWindow, message, title)
  {
    if (!title)
      title = Utils.getString("default_dialog_title");
    Utils.promptService.alert(parentWindow, title, message);
  },

  /**
   * Asks the user for a confirmation like window.confirm() but with a custom title.
   *
   * @param {Window} parentWindow  parent window of the dialog (can be null)
   * @param {String} message  message to be displayed
   * @param {String} [title]  dialog title, default title will be used if omitted
   * @return {Bool}
   */
  confirm: function(parentWindow, message, title)
  {
    if (!title)
      title = Utils.getString("default_dialog_title");
    return Utils.promptService.confirm(parentWindow, title, message);
  },

  /**
   * Retrieves the window for a document node.
   * @return {Window} will be null if the node isn't associated with a window
   */
  getWindow: function(/**Node*/ node)
  {
    if ("ownerDocument" in node && node.ownerDocument)
      node = node.ownerDocument;

    if ("defaultView" in node)
      return node.defaultView;

    return null;
  },

  /**
   * Retrieves the top-level chrome window for a content window.
   */
  getChromeWindow: function(/**Window*/ window) /**Window*/
  {
    return window.QueryInterface(Ci.nsIInterfaceRequestor)
                 .getInterface(Ci.nsIWebNavigation)
                 .QueryInterface(Ci.nsIDocShellTreeItem)
                 .rootTreeItem
                 .QueryInterface(Ci.nsIInterfaceRequestor)
                 .getInterface(Ci.nsIDOMWindow);
  },

  /**
   * If the window doesn't have its own security context (e.g. about:blank or
   * data: URL) walks up the parent chain until a window is found that has a
   * security context.
   */
  getOriginWindow: function(/**Window*/ wnd) /**Window*/
  {
    while (wnd != wnd.parent)
    {
      let uri = Utils.makeURI(wnd.location.href);
      if (uri.spec != "about:blank" && uri.spec != "moz-safe-about:blank" &&
          !Utils.netUtils.URIChainHasFlags(uri, Ci.nsIProtocolHandler.URI_INHERITS_SECURITY_CONTEXT))
      {
        break;
      }
      wnd = wnd.parent;
    }
    return wnd;
  },

  /**
   * If a protocol using nested URIs like jar: is used - retrieves innermost
   * nested URI.
   */
  unwrapURL: function(/**nsIURI or String*/ url) /**nsIURI*/
  {
    if (!(url instanceof Ci.nsIURI))
      url = Utils.makeURI(url);

    if (url instanceof Ci.nsINestedURI)
      return url.innermostURI;
    else
      return url;
  },

  /**
   * Translates a string URI into its nsIURI representation, will return null for
   * invalid URIs.
   */
  makeURI: function(/**String*/ url) /**nsIURI*/
  {
    try
    {
      return Utils.ioService.newURI(url, null, null);
    }
    catch (e) {
      return null;
    }
  },

  /**
   * Posts an action to the event queue of the current thread to run it
   * asynchronously. Any additional parameters to this function are passed
   * as parameters to the callback.
   */
  runAsync: function(/**Function*/ callback, /**Object*/ thisPtr)
  {
    let params = Array.prototype.slice.call(arguments, 2);
    let runnable = {
      run: function()
      {
        callback.apply(thisPtr, params);
      }
    };
    Utils.threadManager.currentThread.dispatch(runnable, Ci.nsIEventTarget.DISPATCH_NORMAL);
  },

  /**
   * Gets the DOM window associated with a particular request (if any).
   */
  getRequestWindow: function(/**nsIChannel*/ channel) /**nsIDOMWindow*/
  {
    try
    {
      if (channel.notificationCallbacks)
        return channel.notificationCallbacks.getInterface(Ci.nsILoadContext).associatedWindow;
    } catch(e) {}

    try
    {
      if (channel.loadGroup && channel.loadGroup.notificationCallbacks)
        return channel.loadGroup.notificationCallbacks.getInterface(Ci.nsILoadContext).associatedWindow;
    } catch(e) {}

    return null;
  },

  /**
   * Generates filter subscription checksum.
   *
   * @param {Array of String} lines filter subscription lines (with checksum line removed)
   * @return {String} checksum or null
   */
  generateChecksum: function(lines)
  {
    let stream = null;
    try
    {
      // Checksum is an MD5 checksum (base64-encoded without the trailing "=") of
      // all lines in UTF-8 without the checksum line, joined with "\n".

      let converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"].createInstance(Ci.nsIScriptableUnicodeConverter);
      converter.charset = "UTF-8";
      stream = converter.convertToInputStream(lines.join("\n"));

      let hashEngine = Cc["@mozilla.org/security/hash;1"].createInstance(Ci.nsICryptoHash);
      hashEngine.init(hashEngine.MD5);
      hashEngine.updateFromStream(stream, stream.available());
      return hashEngine.finish(true).replace(/=+$/, "");
    }
    catch (e)
    {
      return null;
    }
    finally
    {
      if (stream)
        stream.close();
    }
  },

  /**
   * Formats a unix time according to user's locale.
   * @param {Integer} time  unix time in milliseconds
   * @return {String} formatted date and time
   */
  formatTime: function(time)
  {
    try
    {
      let date = new Date(time);
      return Utils.dateFormatter.FormatDateTime("", Ci.nsIScriptableDateFormat.dateFormatShort,
                                                Ci.nsIScriptableDateFormat.timeFormatNoSeconds,
                                                date.getFullYear(), date.getMonth() + 1, date.getDate(),
                                                date.getHours(), date.getMinutes(), date.getSeconds());
    }
    catch(e)
    {
      // Make sure to return even on errors
      Cu.reportError(e);
      return "";
    }
  },

  /**
   * Checks whether any of the prefixes listed match the application locale,
   * returns matching prefix if any.
   */
  checkLocalePrefixMatch: function(/**String*/ prefixes) /**String*/
  {
    if (!prefixes)
      return null;

    let appLocale = Utils.appLocale;
    for each (let prefix in prefixes.split(/,/))
      if (new RegExp("^" + prefix + "\\b").test(appLocale))
        return prefix;

    return null;
  },

  /**
   * Chooses the best filter subscription for user's language.
   */
  chooseFilterSubscription: function(/**NodeList*/ subscriptions) /**Node*/
  {
    let selectedItem = null;
    let selectedPrefix = null;
    let matchCount = 0;
    for (let i = 0; i < subscriptions.length; i++)
    {
      let subscription = subscriptions[i];
      if (!selectedItem)
        selectedItem = subscription;

      let prefix = Utils.checkLocalePrefixMatch(subscription.getAttribute("prefixes"));
      if (prefix)
      {
        if (!selectedPrefix || selectedPrefix.length < prefix.length)
        {
          selectedItem = subscription;
          selectedPrefix = prefix;
          matchCount = 1;
        }
        else if (selectedPrefix && selectedPrefix.length == prefix.length)
        {
          matchCount++;

          // If multiple items have a matching prefix of the same length:
          // Select one of the items randomly, probability should be the same
          // for all items. So we replace the previous match here with
          // probability 1/N (N being the number of matches).
          if (Math.random() * matchCount < 1)
          {
            selectedItem = subscription;
            selectedPrefix = prefix;
          }
        }
      }
    }
    return selectedItem;
  },

  /**
   * Saves sidebar state before detaching/reattaching
   */
  setParams: function(params)
  {
    sidebarParams = params;
  },

  /**
   * Retrieves and removes sidebar state after detaching/reattaching
   */
  getParams: function()
  {
    let ret = sidebarParams;
    sidebarParams = null;
    return ret;
  },

  /**
   * Verifies RSA signature. The public key and signature should be base64-encoded.
   */
  verifySignature: function(/**String*/ key, /**String*/ signature, /**String*/ data) /**Boolean*/
  {
    if (!Utils.crypto)
      return false;

    // Maybe we did the same check recently, look it up in the cache
    if (!("_cache" in Utils.verifySignature))
      Utils.verifySignature._cache = new Cache(5);
    let cache = Utils.verifySignature._cache;
    let cacheKey = key + " " + signature + " " + data;
    if (cacheKey in cache.data)
      return cache.data[cacheKey];
    else
      cache.add(cacheKey, false);

    let keyInfo, pubKey, context;
    try
    {
      let keyItem = Utils.crypto.getSECItem(atob(key));
      keyInfo = Utils.crypto.SECKEY_DecodeDERSubjectPublicKeyInfo(keyItem.address());
      if (keyInfo.isNull())
        throw new Error("SECKEY_DecodeDERSubjectPublicKeyInfo failed");

      pubKey = Utils.crypto.SECKEY_ExtractPublicKey(keyInfo);
      if (pubKey.isNull())
        throw new Error("SECKEY_ExtractPublicKey failed");

      let signatureItem = Utils.crypto.getSECItem(atob(signature));

      context = Utils.crypto.VFY_CreateContext(pubKey, signatureItem.address(), Utils.crypto.SEC_OID_ISO_SHA_WITH_RSA_SIGNATURE, null);
      if (context.isNull())
        return false;   // This could happen if the signature is invalid

      let error = Utils.crypto.VFY_Begin(context);
      if (error < 0)
        throw new Error("VFY_Begin failed");

      error = Utils.crypto.VFY_Update(context, data, data.length);
      if (error < 0)
        throw new Error("VFY_Update failed");

      error = Utils.crypto.VFY_End(context);
      if (error < 0)
        return false;

      cache.data[cacheKey] = true;
      return true;
    }
    catch (e)
    {
      Cu.reportError(e);
      return false;
    }
    finally
    {
      if (keyInfo && !keyInfo.isNull())
        Utils.crypto.SECKEY_DestroySubjectPublicKeyInfo(keyInfo);
      if (pubKey && !pubKey.isNull())
        Utils.crypto.SECKEY_DestroyPublicKey(pubKey);
      if (context && !context.isNull())
        Utils.crypto.VFY_DestroyContext(context, true);
    }
  },

  /**
   * Returns the documentation link from the preferences.
   */
  getDocLink: function(/**String*/ linkID)
  {
    let {Prefs} = require("prefs");
    let docLink = Prefs.documentation_link;
    return docLink.replace(/%LINK%/g, linkID).replace(/%LANG%/g, Utils.appLocale);
  },

  /**
   * Splits up a combined label into the label and access key components.
   *
   * @return {Array} An array with two strings: label and access key
   */
  splitLabel: function(/**String*/ label)
  {
    let match = /^(.*)\s*\(&(.)\)\s*(\u2026?)$/.exec(label);
    if (match)
    {
      // Access key not part of the label
      return [match[1] + match[3], match[2]];
    }
    else
    {
      // Access key part of the label
      let pos = label.indexOf("&");
      if (pos >= 0 && pos < label.length - 1)
        return [label.substr(0, pos) + label.substr(pos + 1), label[pos + 1]];
      else
        return [label, ""];
    }
  },

  /**
   * Split all labels starting from a particular DOM node.
   */
  splitAllLabels: function(/**DOMNode*/ root)
  {
    let attrMap = {
      __proto__: null,
      "label": "value",
      "setting": "title"
    };

    let elements = root.querySelectorAll("*[label], label[value], setting[title]");
    for (let i = 0; i < elements.length; i++)
    {
      let element = elements[i];
      let attr = (element.localName in attrMap ? attrMap[element.localName] : "label");
      let origLabel = element.getAttribute(attr);

      let [label, accesskey] = this.splitLabel(origLabel);
      if (label != origLabel)
        element.setAttribute(attr, label);
      if (accesskey != "")
        element.setAttribute("accesskey", accesskey);

      // Labels forward changes of the accessKey property to their control, only
      // set it for actual controls.
      if (element.localName != "label")
        element.accessKey = accesskey;
    }
  }
};

/**
 * A cache with a fixed capacity, newer entries replace entries that have been
 * stored first.
 * @constructor
 */
function Cache(/**Integer*/ size)
{
  this._ringBuffer = new Array(size);
  this.data = {__proto__: null};
}
exports.Cache = Cache;

Cache.prototype =
{
  /**
   * Ring buffer storing hash keys, allows determining which keys need to be
   * evicted.
   * @type Array
   */
  _ringBuffer: null,

  /**
   * Index in the ring buffer to be written next.
   * @type Integer
   */
  _bufferIndex: 0,

  /**
   * Cache data, maps values to the keys. Read-only access, for writing use
   * add() method.
   * @type Object
   */
  data: null,

  /**
   * Adds a key and the corresponding value to the cache.
   */
  add: function(/**String*/ key, value)
  {
    if (!(key in this.data))
    {
      // This is a new key - we need to add it to the ring buffer and evict
      // another entry instead.
      let oldKey = this._ringBuffer[this._bufferIndex];
      if (typeof oldKey != "undefined")
        delete this.data[oldKey];
      this._ringBuffer[this._bufferIndex] = key;

      this._bufferIndex++;
      if (this._bufferIndex >= this._ringBuffer.length)
        this._bufferIndex = 0;
    }

    this.data[key] = value;
  },

  /**
   * Clears cache contents.
   */
  clear: function()
  {
    this._ringBuffer = new Array(this._ringBuffer.length);
    this.data = {__proto__: null};
  }
}

// Getters for common services, this should be replaced by Services.jsm in future

XPCOMUtils.defineLazyServiceGetter(Utils, "categoryManager", "@mozilla.org/categorymanager;1", "nsICategoryManager");
XPCOMUtils.defineLazyServiceGetter(Utils, "ioService", "@mozilla.org/network/io-service;1", "nsIIOService");
XPCOMUtils.defineLazyServiceGetter(Utils, "threadManager", "@mozilla.org/thread-manager;1", "nsIThreadManager");
XPCOMUtils.defineLazyServiceGetter(Utils, "promptService", "@mozilla.org/embedcomp/prompt-service;1", "nsIPromptService");
XPCOMUtils.defineLazyServiceGetter(Utils, "effectiveTLD", "@mozilla.org/network/effective-tld-service;1", "nsIEffectiveTLDService");
XPCOMUtils.defineLazyServiceGetter(Utils, "netUtils", "@mozilla.org/network/util;1", "nsINetUtil");
XPCOMUtils.defineLazyServiceGetter(Utils, "styleService", "@mozilla.org/content/style-sheet-service;1", "nsIStyleSheetService");
XPCOMUtils.defineLazyServiceGetter(Utils, "prefService", "@mozilla.org/preferences-service;1", "nsIPrefService");
XPCOMUtils.defineLazyServiceGetter(Utils, "versionComparator", "@mozilla.org/xpcom/version-comparator;1", "nsIVersionComparator");
XPCOMUtils.defineLazyServiceGetter(Utils, "windowMediator", "@mozilla.org/appshell/window-mediator;1", "nsIWindowMediator");
XPCOMUtils.defineLazyServiceGetter(Utils, "windowWatcher", "@mozilla.org/embedcomp/window-watcher;1", "nsIWindowWatcher");
XPCOMUtils.defineLazyServiceGetter(Utils, "chromeRegistry", "@mozilla.org/chrome/chrome-registry;1", "nsIXULChromeRegistry");
XPCOMUtils.defineLazyServiceGetter(Utils, "systemPrincipal", "@mozilla.org/systemprincipal;1", "nsIPrincipal");
XPCOMUtils.defineLazyServiceGetter(Utils, "dateFormatter", "@mozilla.org/intl/scriptabledateformat;1", "nsIScriptableDateFormat");
XPCOMUtils.defineLazyServiceGetter(Utils, "childMessageManager", "@mozilla.org/childprocessmessagemanager;1", "nsISyncMessageSender");
XPCOMUtils.defineLazyServiceGetter(Utils, "parentMessageManager", "@mozilla.org/parentprocessmessagemanager;1", "nsIFrameMessageManager");
XPCOMUtils.defineLazyServiceGetter(Utils, "httpProtocol", "@mozilla.org/network/protocol;1?name=http", "nsIHttpProtocolHandler");
XPCOMUtils.defineLazyServiceGetter(Utils, "clipboard", "@mozilla.org/widget/clipboard;1", "nsIClipboard");
XPCOMUtils.defineLazyServiceGetter(Utils, "clipboardHelper", "@mozilla.org/widget/clipboardhelper;1", "nsIClipboardHelper");
XPCOMUtils.defineLazyGetter(Utils, "crypto", function()
{
  try
  {
    let ctypes = Components.utils.import("resource://gre/modules/ctypes.jsm", null).ctypes;

    let nsslib;
    try
    {
      nsslib = ctypes.open(ctypes.libraryName("nss3"));
    }
    catch (e)
    {
      // It seems that on Mac OS X the full path name needs to be specified
      let file = Services.dirsvc.get("GreD", Ci.nsILocalFile);
      file.append(ctypes.libraryName("nss3"));
      nsslib = ctypes.open(file.path);
    }

    let result = {};

    // seccomon.h
    result.siUTF8String = 14;

    // secoidt.h
    result.SEC_OID_ISO_SHA_WITH_RSA_SIGNATURE = 15;

    // The following types are opaque to us
    result.VFYContext = ctypes.void_t;
    result.SECKEYPublicKey = ctypes.void_t;
    result.CERTSubjectPublicKeyInfo = ctypes.void_t;

    /*
     * seccomon.h
     * struct SECItemStr {
     *   SECItemType type;
     *   unsigned char *data;
     *   unsigned int len;
     * };
     */
    result.SECItem = ctypes.StructType("SECItem", [
      {type: ctypes.int},
      {data: ctypes.unsigned_char.ptr},
      {len: ctypes.int}
    ]);

    /*
     * cryptohi.h
     * extern VFYContext *VFY_CreateContext(SECKEYPublicKey *key, SECItem *sig,
     *                                      SECOidTag sigAlg, void *wincx);
     */
    result.VFY_CreateContext = nsslib.declare(
      "VFY_CreateContext",
      ctypes.default_abi, result.VFYContext.ptr,
      result.SECKEYPublicKey.ptr,
      result.SECItem.ptr,
      ctypes.int,
      ctypes.voidptr_t
    );

    /*
     * cryptohi.h
     * extern void VFY_DestroyContext(VFYContext *cx, PRBool freeit);
     */
    result.VFY_DestroyContext = nsslib.declare(
      "VFY_DestroyContext",
      ctypes.default_abi, ctypes.void_t,
      result.VFYContext.ptr,
      ctypes.bool
    );

    /*
     * cryptohi.h
     * extern SECStatus VFY_Begin(VFYContext *cx);
     */
    result.VFY_Begin = nsslib.declare("VFY_Begin",
      ctypes.default_abi, ctypes.int,
      result.VFYContext.ptr
    );

    /*
     * cryptohi.h
     * extern SECStatus VFY_Update(VFYContext *cx, const unsigned char *input,
     *                             unsigned int inputLen);
     */
    result.VFY_Update = nsslib.declare(
      "VFY_Update",
      ctypes.default_abi, ctypes.int,
      result.VFYContext.ptr,
      ctypes.unsigned_char.ptr,
      ctypes.int
    );

    /*
     * cryptohi.h
     * extern SECStatus VFY_End(VFYContext *cx);
     */
    result.VFY_End = nsslib.declare(
      "VFY_End",
      ctypes.default_abi, ctypes.int,
      result.VFYContext.ptr
    );

    /*
     * keyhi.h
     * extern CERTSubjectPublicKeyInfo *
     * SECKEY_DecodeDERSubjectPublicKeyInfo(SECItem *spkider);
     */
    result.SECKEY_DecodeDERSubjectPublicKeyInfo = nsslib.declare(
      "SECKEY_DecodeDERSubjectPublicKeyInfo",
      ctypes.default_abi, result.CERTSubjectPublicKeyInfo.ptr,
      result.SECItem.ptr
    );

    /*
     * keyhi.h
     * extern void SECKEY_DestroySubjectPublicKeyInfo(CERTSubjectPublicKeyInfo *spki);
     */
    result.SECKEY_DestroySubjectPublicKeyInfo = nsslib.declare(
      "SECKEY_DestroySubjectPublicKeyInfo",
      ctypes.default_abi, ctypes.void_t,
      result.CERTSubjectPublicKeyInfo.ptr
    );

    /*
     * keyhi.h
     * extern SECKEYPublicKey *
     * SECKEY_ExtractPublicKey(CERTSubjectPublicKeyInfo *);
     */
    result.SECKEY_ExtractPublicKey = nsslib.declare(
      "SECKEY_ExtractPublicKey",
      ctypes.default_abi, result.SECKEYPublicKey.ptr,
      result.CERTSubjectPublicKeyInfo.ptr
    );

    /*
     * keyhi.h
     * extern void SECKEY_DestroyPublicKey(SECKEYPublicKey *key);
     */
    result.SECKEY_DestroyPublicKey = nsslib.declare(
      "SECKEY_DestroyPublicKey",
      ctypes.default_abi, ctypes.void_t,
      result.SECKEYPublicKey.ptr
    );

    // Convenience method
    result.getSECItem = function(data)
    {
      var dataArray = new ctypes.ArrayType(ctypes.unsigned_char, data.length)();
      for (let i = 0; i < data.length; i++)
        dataArray[i] = data.charCodeAt(i) % 256;
      return new result.SECItem(result.siUTF8String, dataArray, dataArray.length);
    };

    return result;
  }
  catch (e)
  {
    Cu.reportError(e);
    // Expected, ctypes isn't supported in Gecko 1.9.2
    return null;
  }
});

if ("@mozilla.org/messenger/headerparser;1" in Cc)
  XPCOMUtils.defineLazyServiceGetter(Utils, "headerParser", "@mozilla.org/messenger/headerparser;1", "nsIMsgHeaderParser");
else
  Utils.headerParser = null;
