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
 * @fileOverview Various application-specific functions.
 */

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");

/**
 * Checks whether an application window is known and should get Adblock Plus
 * user interface elements.
 * @result Boolean
 */
exports.isKnownWindow = function isKnownWindow(/**Window*/ window) false;

/**
 * HACK: In some applications the window finishes initialization during load
 * event processing which makes an additional delay necessary. This flag
 * indicates that.
 * @type Boolean
 */
exports.delayInitialization = false;

/**
 * Retrieves the browser element for an application window.
 * @type function(window)
 */
exports.getBrowser = null;

/**
 * Adds a new browser tab in the given application window.
 * @type function(window, url, event)
 */
exports.addTab = null;

/**
 * Retrieves the current browser location for an application window.
 */
exports.getCurrentLocation = function getCurrentLocation(/**Window*/ window) /**nsIURI|String*/
{
  let browser = (exports.getBrowser ? exports.getBrowser(window) : null);
  return (browser ? browser.currentURI : null);
}


/**
 * The ID (or a list of possible IDs) of the content area context menu.
 * @type String|String[]
 */
exports.contentContextMenu = null;

/**
 * The properties parent, before, after determine the default placement of the
 * toolbar icon, the property isAddonBar indicates that it is an add-on bar
 * (different options text is displayed then).
 * @type Object
 */
exports.defaultToolbarPosition = null;

/**
 * The properties parent, before, after determine the placement of the status
 * bar icon.
 * @type Object
 */
exports.statusbarPosition = null;

/**
 * The properties parent, before, after determine the placement of the Tools
 * submenu.
 * @type Object
 */
exports.toolsMenu = null;

/**
 * Maps windows to their bottom bar info.
 */
let bottomBars = new WeakMap();

/**
 * Adds a bottom bar to the application window.
 * @type function(window, element)
 */
exports.addBottomBar = null;

function _addBottomBar(window, parent, element)
{
  if (bottomBars.has(window) || !parent)
    return null;

  let bar = {elements: []};
  for (let child = element.firstElementChild; child; child = child.nextElementSibling)
  {
    let clone = child.cloneNode(true);
    parent.appendChild(clone);
    bar.elements.push(clone);
  }

  bottomBars.set(window, bar);
  return bar;
};

/**
 * Removes the bottom bar from the application window.
 * @type function(window)
 */
exports.removeBottomBar = null;

function _removeBottomBar(window)
{
  if (!bottomBars.has(window))
    return null;

  let bar = bottomBars.get(window);
  for (let i = 0; i < bar.elements.length; i++)
    if (bar.elements[i].parentNode)
      bar.elements[i].parentNode.removeChild(bar.elements[i]);

  bottomBars.delete(window);
  return bar;
};

/**
 * Maps windows to a list of progress listeners.
 */
let progressListeners = new WeakMap();

/**
 * Makes sure that a function is called whenever the displayed browser location changes.
 */
exports.addBrowserLocationListener = function addBrowserLocationListener(/**Window*/ window, /**Function*/ callback, /**Boolean*/ ignoreSameDoc)
{
  let browser = (exports.getBrowser ? exports.getBrowser(window) : null);
  if (browser)
  {
    let dummy = function() {};
    let progressListener =
    {
      callback: callback,
      onLocationChange: function(progress, request, uri, flags)
      {
        if (!ignoreSameDoc || !flags || !(flags & Ci.nsIWebProgressListener.LOCATION_CHANGE_SAME_DOCUMENT))
          this.callback();
      },
      onProgressChange: dummy,
      onSecurityChange: dummy,
      onStateChange: dummy,
      onStatusChange: dummy,
      QueryInterface: XPCOMUtils.generateQI([Ci.nsIWebProgressListener, Ci.nsISupportsWeakReference])
    };
    browser.addProgressListener(progressListener);

    if (progressListeners.has(window))
      progressListeners.get(window).push(progressListener);
    else
      progressListeners.set(window, [progressListener]);
  }
};

/**
 * Removes a location listener registered for a window.
 */
exports.removeBrowserLocationListener = function removeBrowserLocationListener(/**Window*/ window, /**Function*/ callback)
{
  if (!progressListeners.has(window))
    return;

  let browser = (exports.getBrowser ? exports.getBrowser(window) : null);
  let listeners = progressListeners.get(window);
  for (let i = 0; i < listeners.length; i++)
  {
    if (listeners[i].callback == callback)
    {
      if (browser)
        browser.removeProgressListener(listeners[i]);
      listeners.splice(i--, 1);
    }
  }
};

/**
 * Removes all location listeners registered for a window, to be called on
 * cleanup.
 */
exports.removeBrowserLocationListeners = function removeBrowserLocationListeners(/**Window*/ window)
{
  if (!progressListeners.has(window))
    return;

  let browser = (exports.getBrowser ? exports.getBrowser(window) : null);
  if (browser)
  {
    let listeners = progressListeners.get(window);
    for (let i = 0; i < listeners.length; i++)
      browser.removeProgressListener(listeners[i]);
  }
  progressListeners.delete(window);
};

/**
 * Maps windows to a list of click listeners.
 */
let clickListeners = new WeakMap();

/**
 * Makes sure that a function is called whenever the user clicks inside the
 * browser's content area.
 */
exports.addBrowserClickListener = function addBrowserClickListener(/**Window*/ window, /**Function*/ callback)
{
  let browser = (exports.getBrowser ? exports.getBrowser(window) : null);
  if (browser)
  {
    browser.addEventListener("click", callback, true);

    if (clickListeners.has(window))
      clickListeners.get(window).push(callback);
    else
      clickListeners.set(window, [callback]);
  }
};

/**
 * Removes all click listeners registered for a window, to be called on
 * cleanup.
 */
exports.removeBrowserClickListeners = function removeBrowserClickListeners(/**Window*/ window)
{
  if (!clickListeners.has(window))
    return;

  let browser = (exports.getBrowser ? exports.getBrowser(window) : null);
  if (browser)
  {
    let listeners = clickListeners.get(window);
    for (let i = 0; i < listeners.length; i++)
      browser.removeEventListener("click", listeners[i], true);
  }
  clickListeners.delete(window);
};

let {application} = require("info");
switch (application)
{
  case "firefox":
  {
    exports.isKnownWindow = function ff_isKnownWindow(window)
    {
      return (window.document.documentElement.getAttribute("windowtype") == "navigator:browser");
    };

    exports.getBrowser = function ff_getBrowser(window) window.gBrowser;

    exports.addTab = function ff_addTab(window, url, event)
    {
      if (event)
        window.openNewTabWith(url, exports.getBrowser(window).contentDocument, null, event, false);
      else
        window.gBrowser.loadOneTab(url, {inBackground: false});
    };

    exports.contentContextMenu = "contentAreaContextMenu";

    exports.defaultToolbarPosition = {
      parent: "addon-bar",
      before: "addonbar-closebutton",
      isAddonBar: true
    };

    exports.toolsMenu = {
      parent: "menu_ToolsPopup"
    };

    exports.addBottomBar = function fx_addBottomBar(window, element)
    {
      let bar = _addBottomBar(window, window.document.getElementById("appcontent"), element);
      if (bar)
      {
        let display = window.document.getElementById("statusbar-display");
        bar.changedFixed = display && !display.hasAttribute("fixed");
        if (bar.changedFixed)
          display.setAttribute("fixed", "true");
      }
    };

    exports.removeBottomBar = function fx_removeBottomBar(window)
    {
      let bar = _removeBottomBar(window);
      if (bar && bar.changedFixed)
        window.document.getElementById("statusbar-display").removeAttribute("fixed");
    };

    break;
  }

  case "seamonkey":
  {
    exports.isKnownWindow = function sm_isKnownWindow(window)
    {
      let type = window.document.documentElement.getAttribute("windowtype");
      return (type == "navigator:browser" || type == "mail:3pane" || type == "mail:messageWindow");
    };

    exports.addTab = function sm_addTab(window, url, event)
    {
      if (event || !("gBrowser" in window))
        window.openNewTabWith(url, ("gBrowser" in window ? window.gBrowser.contentDocument : null), null, event, false);
      else
        window.gBrowser.loadOneTab(url, {inBackground: false});
    };

    exports.getBrowser = function sm_getBrowser(window)
    {
      if ("gBrowser" in window)
        return window.gBrowser;
      else if ("getMessageBrowser" in window)
        return window.getMessageBrowser();
      else
        return null;
    };

    exports.getCurrentLocation = function sm_getCurrentLocation(window)
    {
      if ("currentHeaderData" in window && "content-base" in window.currentHeaderData)
      {
        // This is a blog entry
        return window.currentHeaderData["content-base"].headerValue;
      }
      else if ("currentHeaderData" in window && "from" in window.currentHeaderData)
      {
        // This is a mail/newsgroup entry
        try
        {
          let headerParser = Cc["@mozilla.org/messenger/headerparser;1"].getService(Ci.nsIMsgHeaderParser);
          let emailAddress = headerParser.extractHeaderAddressMailboxes(window.currentHeaderData.from.headerValue);
          return "mailto:" + emailAddress.replace(/^[\s"]+/, "").replace(/[\s"]+$/, "").replace(/\s/g, "%20");
        }
        catch(e)
        {
          return null;
        }
      }
      else
      {
        let browser = exports.getBrowser(window);
        return (browser ? browser.currentURI : null);
      }
    };

    exports.contentContextMenu = ["contentAreaContextMenu", "mailContext"];

    exports.defaultToolbarPosition = {
      parent: ["PersonalToolbar", "msgToolbar"],
      before: ["bookmarks-button", "button-junk"]
    };

    exports.statusbarPosition = {
      parent: "status-bar"
    };

    exports.toolsMenu = {
      parent: "taskPopup",
      after: "downloadmgr"
    };

    exports.addBottomBar = function sm_addBottomBar(window, element)
    {
      _addBottomBar(window, window.document.getElementById("appcontent") || window.document.getElementById("messagepanebox"), element);
    };

    exports.removeBottomBar = _removeBottomBar;

    break;
  }

  case "thunderbird":
  {
    exports.isKnownWindow = function tb_isKnownWindow(window)
    {
      let type = window.document.documentElement.getAttribute("windowtype");
      return (type == "mail:3pane" || type == "mail:messageWindow");
    };

    exports.delayInitialization = true;

    exports.getBrowser = function tb_getBrowser(window) window.getBrowser();

    exports.addTab = function tb_addTab(window, url, event)
    {
      let tabmail = window.document.getElementById("tabmail");
      if (!tabmail)
      {
        let wnd = Services.wm.getMostRecentWindow("mail:3pane");
        if (window)
          tabmail = wnd.document.getElementById("tabmail");
      }

      if (tabmail)
        tabmail.openTab("contentTab", {contentPage: url});
      else
      {
        window.openDialog("chrome://messenger/content/", "_blank",
                          "chrome,dialog=no,all", null,
                          {
                            tabType: "contentTab",
                            tabParams: {contentPage: url}
                          });
      }
    };

    exports.contentContextMenu = ["mailContext", "pageContextMenu"];

    exports.defaultToolbarPosition = {
      parent: "header-view-toolbar",
      before: "hdrReplyButton",
      addClass: "msgHeaderView-button"
    };

    exports.statusbarPosition = {
      parent: "status-bar"
    };

    exports.toolsMenu = {
      parent: "taskPopup",
      after: "javaScriptConsole"
    };

    exports.getCurrentLocation = function getCurrentLocation(window)
    {
      let browser = exports.getBrowser(window);
      if (!browser)
        return null;

      if (browser.id == "messagepane" && "currentHeaderData" in window && "content-base" in window.currentHeaderData)
      {
        // This is a blog entry
        return window.currentHeaderData["content-base"].headerValue;
      }
      else if (browser.id == "messagepane" && "currentHeaderData" in window && "from" in window.currentHeaderData)
      {
        // This is a mail/newsgroup entry
        try
        {
          let headerParser = Cc["@mozilla.org/messenger/headerparser;1"].getService(Ci.nsIMsgHeaderParser);
          let emailAddress = headerParser.extractHeaderAddressMailboxes(window.currentHeaderData.from.headerValue);
          return "mailto:" + emailAddress.replace(/^[\s"]+/, "").replace(/[\s"]+$/, "").replace(/\s/g, "%20");
        }
        catch(e)
        {
          return null;
        }
      }
      else
        return browser.currentURI;
    }

    exports.addBottomBar = function tb_addBottomBar(window, element)
    {
      let browser = exports.getBrowser(window);
      if (!browser)
        return;

      let parent = window.document.getElementById("messagepanebox");
      if (!parent || !(parent.compareDocumentPosition(browser) & Ci.nsIDOMNode.DOCUMENT_POSITION_CONTAINED_BY))
        parent = browser.parentNode;

      _addBottomBar(window, parent, element);
    };

    exports.removeBottomBar = _removeBottomBar;

    let BrowserChangeListener = function(window, callback)
    {
      this.window = window;
      this.callback = callback;
      this.onSelect = this.onSelect.bind(this);
      this.attach();
    };
    BrowserChangeListener.prototype = {
      window: null,
      callback: null,
      currentBrowser: null,

      setBrowser: function(browser)
      {
        if (browser != this.currentBrowser)
        {
          let oldBrowser = this.currentBrowser;
          this.currentBrowser = browser;
          this.callback(oldBrowser, browser);
        }
      },

      onSelect: function()
      {
        this.setBrowser(exports.getBrowser(this.window));
      },

      attach: function()
      {
        this.onSelect();

        let tabmail = this.window.document.getElementById("tabmail");
        if (tabmail)
          tabmail.tabContainer.addEventListener("select", this.onSelect, false);
      },
      detach: function()
      {
        let tabmail = this.window.document.getElementById("tabmail");
        if (tabmail)
          tabmail.tabContainer.removeEventListener("select", this.onSelect, false);

        this.setBrowser(null);
      }
    };

    exports.addBrowserLocationListener = function(/**Window*/ window, /**Function*/ callback, /**Boolean*/ ignoreSameDoc)
    {
      if (progressListeners.has(window))
      {
        progressListeners.get(window).locationCallbacks.push(callback);
        return;
      }

      let callbacks = [callback];
      let dummy = function() {};
      let progressListener =
      {
        onLocationChange: function(progress, request, uri, flags)
        {
          if (!ignoreSameDoc || !flags || !(flags & Ci.nsIWebProgressListener.LOCATION_CHANGE_SAME_DOCUMENT))
            for (let i = 0; i < callbacks.length; i++)
              callbacks[i]();
        },
        onProgressChange: dummy,
        onSecurityChange: dummy,
        onStateChange: dummy,
        onStatusChange: dummy,
        QueryInterface: XPCOMUtils.generateQI([Ci.nsIWebProgressListener, Ci.nsISupportsWeakReference])
      };
      let messageListener =
      {
        onStartHeaders: dummy,
        onEndHeaders: function()
        {
          let browser = exports.getBrowser(window);
          if (browser.id == "messagepane")
            for (let i = 0; i < callbacks.length; i++)
              callbacks[i]();
        },
        onEndAttachments: dummy,
        onBeforeShowHeaderPane: dummy
      };

      let listener = new BrowserChangeListener(window, function(oldBrowser, newBrowser)
      {
        if (oldBrowser)
          oldBrowser.removeProgressListener(progressListener);
        if (newBrowser)
          newBrowser.addProgressListener(progressListener);
        progressListener.onLocationChange();
      });
      listener.locationCallbacks = callbacks;

      if ("gMessageListeners" in window)
        window.gMessageListeners.push(messageListener);
      listener.messageListener = messageListener;

      progressListeners.set(window, listener);
    };

    exports.removeBrowserLocationListener = function(/**Window*/ window, /**Function*/ callback)
    {
      if (!progressListeners.has(window))
        return;

      let callbacks = progressListeners.get(window).locationCallbacks;
      for (let i = 0; i < callbacks.length; i++)
        if (callbacks[i] == callback)
          callbacks.splice(i--, 1);
    };

    exports.removeBrowserLocationListeners = function(/**Window*/ window)
    {
      if (!progressListeners.has(window))
        return;

      let listener = progressListeners.get(window);

      let messageListener = listener.messageListener;
      let index = ("gMessageListeners" in window ? window.gMessageListeners.indexOf(messageListener) : -1);
      if (index >= 0)
        window.gMessageListeners.splice(index, 1);

      listener.detach();
      progressListeners.delete(window);
    };

    exports.addBrowserClickListener = function addBrowserClickListener(/**Window*/ window, /**Function*/ callback)
    {
      if (clickListeners.has(window))
      {
        clickListeners.get(window).callbacks.push(callback);
        return;
      }

      let callbacks = [callback];
      let listener = new BrowserChangeListener(window, function(oldBrowser, newBrowser)
      {
        if (oldBrowser)
          for (let i = 0; i < callbacks.length; i++)
            oldBrowser.removeEventListener("click", callbacks[i], true);
        if (newBrowser)
          for (let i = 0; i < callbacks.length; i++)
            newBrowser.addEventListener("click", callbacks[i], true);
      });
      listener.callbacks = callbacks;

      clickListeners.set(window, listener);
    };

    exports.removeBrowserClickListeners = function removeBrowserClickListeners(/**Window*/ window)
    {
      if (!clickListeners.has(window))
        return;

      let listener = clickListeners.get(window);
      listener.detach();

      clickListeners.delete(window);
    };

    // Make sure to close/reopen list of blockable items when the user changes tabs
    let {WindowObserver} = require("windowObserver");
    new WindowObserver({
      listeners: new WeakMap(),
      applyToWindow: function(window)
      {
        if (!exports.isKnownWindow(window) || this.listeners.has(window))
          return;

        let {Utils} = require("utils");
        Utils.runAsync(function()
        {
          let listener = new BrowserChangeListener(window, function(oldBrowser, newBrowser)
          {
            if (bottomBars.has(window))
            {
              let {UI} = require("ui")
              UI.toggleBottombar(window);
              UI.toggleBottombar(window);
            }
          });
          this.listeners.set(window, listener);
        }.bind(this));
      },
      removeFromWindow: function(window)
      {
        if (!this.listeners.has(window))
          return;

        let listener = this.listeners.get(window);
        listener.detach();
        this.listeners.delete(window);
      }
    });

    break;
  }

  case "fennec2":
  {
    exports.isKnownWindow = function fmn_isKnownWindow(/**Window*/ window) window.document.documentElement.id == "main-window";

    exports.getBrowser = function fmn_getBrowser(window) window.BrowserApp.selectedBrowser;

    exports.addTab = function fmn_addTab(window, url, event) window.BrowserApp.addTab(url, {selected: true});

    let BrowserChangeListener = function(window, callback)
    {
      this.window = window;
      this.callback = callback;
      this.onSelect = this.onSelect.bind(this);
      this.attach();
    };
    BrowserChangeListener.prototype = {
      window: null,
      callback: null,
      currentBrowser: null,

      setBrowser: function(browser)
      {
        if (browser != this.currentBrowser)
        {
          let oldBrowser = this.currentBrowser;
          this.currentBrowser = browser;
          this.callback(oldBrowser, browser);
        }
      },

      onSelect: function()
      {
        let {Utils} = require("utils");
        Utils.runAsync(function()
        {
          this.setBrowser(exports.getBrowser(this.window));
        }.bind(this));
      },

      attach: function()
      {
        this.onSelect();

        this.window.BrowserApp.deck.addEventListener("TabSelect", this.onSelect, false);
      },
      detach: function()
      {
        this.window.BrowserApp.deck.removeEventListener("TabSelect", this.onSelect, false);

        this.setBrowser(null);
      }
    };

    exports.addBrowserLocationListener = function ffn_addBrowserLocationListener(/**Window*/ window, /**Function*/ callback, /**Boolean*/ ignoreSameDoc)
    {
      if (progressListeners.has(window))
      {
        progressListeners.get(window).locationCallbacks.push(callback);
        return;
      }

      let callbacks = [callback];
      let dummy = function() {};
      let progressListener =
      {
        onLocationChange: function(progress, request, uri, flags)
        {
          if (!ignoreSameDoc || !flags || !(flags & Ci.nsIWebProgressListener.LOCATION_CHANGE_SAME_DOCUMENT))
            for (let i = 0; i < callbacks.length; i++)
              callbacks[i]();
        },
        onProgressChange: dummy,
        onSecurityChange: dummy,
        onStateChange: dummy,
        onStatusChange: dummy,
        QueryInterface: XPCOMUtils.generateQI([Ci.nsIWebProgressListener, Ci.nsISupportsWeakReference])
      };

      let listener = new BrowserChangeListener(window, function(oldBrowser, newBrowser)
      {
        if (oldBrowser && typeof oldBrowser.removeProgressListener == "function")
          oldBrowser.removeProgressListener(progressListener);
        if (newBrowser && typeof newBrowser.removeProgressListener == "function")
          newBrowser.addProgressListener(progressListener);
        progressListener.onLocationChange();
      });
      listener.locationCallbacks = callbacks;

      progressListeners.set(window, listener);
    };

    exports.removeBrowserLocationListener = function ffn_removeBrowserLocationListener(/**Window*/ window, /**Function*/ callback)
    {
      if (!progressListeners.has(window))
        return;

      let callbacks = progressListeners.get(window).locationCallbacks;
      for (let i = 0; i < callbacks.length; i++)
        if (callbacks[i] == callback)
          callbacks.splice(i--, 1);
    };

    exports.removeBrowserLocationListeners = function ffn_removeBrowserLocationListeners(/**Window*/ window)
    {
      if (!progressListeners.has(window))
        return;

      let listener = progressListeners.get(window);
      listener.detach();
      progressListeners.delete(window);
    };

    exports.addBrowserClickListener = function ffn_addBrowserClickListener(/**Window*/ window, /**Function*/ callback)
    {
      if (clickListeners.has(window))
      {
        clickListeners.get(window).callbacks.push(callback);
        return;
      }

      let callbacks = [callback];
      let listener = new BrowserChangeListener(window, function(oldBrowser, newBrowser)
      {
        if (oldBrowser)
          for (let i = 0; i < callbacks.length; i++)
            oldBrowser.removeEventListener("click", callbacks[i], true);
        if (newBrowser)
          for (let i = 0; i < callbacks.length; i++)
            newBrowser.addEventListener("click", callbacks[i], true);
      });
      listener.callbacks = callbacks;

      clickListeners.set(window, listener);
    };

    exports.removeBrowserClickListeners = function ffn_removeBrowserClickListeners(/**Window*/ window)
    {
      if (!clickListeners.has(window))
        return;

      let listener = clickListeners.get(window);
      listener.detach();

      clickListeners.delete(window);
    };

    let {Filter} = require("filterClasses");
    let {Prefs} = require("prefs");
    let {Policy} = require("contentPolicy");
    let {UI} = require("ui");
    let {Utils} = require("utils");

    let toggleWhitelist = function(window)
    {
      if (!Prefs.enabled)
      {
        Prefs.enabled = true;
        return;
      }

      let location = exports.getCurrentLocation(window);
      let host = null;
      if (location instanceof Ci.nsIURL && Policy.isBlockableScheme(location))
      {
        try
        {
          host = location.host.replace(/^www\./, "");
        } catch (e) {}
      }

      if (!host)
        return;

      if (Policy.isWhitelisted(location.spec))
        UI.removeWhitelist(window);
      else
        UI.toggleFilter(Filter.fromText("@@||" + host + "^$document"));
    };

    let menuItem = null;
    onShutdown.add(function()
    {
      let window = null;
      for (window in UI.applicationWindows)
        break;

      if (window && menuItem)
        window.NativeWindow.menu.remove(menuItem);
    });

    UI.updateIconState = function fmn_updateIconState(window, icon)
    {
      if (menuItem !== null)
      {
        window.NativeWindow.menu.remove(menuItem);
        menuItem = null;
      }

      let action;
      let host = null;
      if (Prefs.enabled)
      {
        let location = exports.getCurrentLocation(window);
        if (location instanceof Ci.nsIURL && Policy.isBlockableScheme(location))
        {
          try
          {
            host = location.host.replace(/^www\./, "");
          } catch (e) {}
        }
        if (!host)
          return;

        if (host && Policy.isWhitelisted(location.spec))
          action = "enable_site";
        else if (host)
          action = "disable_site";
      }
      else
        action = "enable";

      let actionText = Utils.getString("mobile_menu_" + action);
      if (host)
        actionText = actionText.replace(/\?1\?/g, host);

      let iconUrl = require("info").addonRoot + "icon64.png";
      menuItem = window.NativeWindow.menu.add(actionText, iconUrl, toggleWhitelist.bind(null, window));
    };

    UI.openSubscriptionDialog = function(window, url, title, mainURL, mainTitle)
    {
      let dialogTitle = this.overlay.attributes.subscriptionDialogTitle;
      let dialogMessage = this.overlay.attributes.subscriptionDialogMessage.replace(/\?1\?/, title).replace(/\?2\?/, url);
      if (Utils.confirm(window, dialogMessage, dialogTitle))
        this.setSubscription(url, title);
    };

    break;
  }
}
