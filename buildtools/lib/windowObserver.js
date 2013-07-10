/*
 * This file is part of the Adblock Plus build tools,
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

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

exports.WindowObserver = WindowObserver;

/**
 * This class will call listener's method applyToWindow() for all new chrome
 * windows being opened. It will also call listener's method removeFromWindow()
 * for all windows still open when the extension is shut down.
 * @param {Object} listener
 * @param {String} [when]   when to execute applyToWindow(). "start" means immediately
 *                          when the window opens, "ready" when its contents are available
 *                          and "end" (default) means to wait until the "load" event.
 * @constructor
 */
function WindowObserver(listener, when)
{
  this._listener  = listener;
  this._when = when;

  let e = Services.wm.getZOrderDOMWindowEnumerator(null, true);
  if (!e.hasMoreElements())
  {
    // On Linux the list returned will be empty, see bug 156333. Fall back to random order.
    e = Services.wm.getEnumerator(null);
  }
  while (e.hasMoreElements())
  {
    let window = e.getNext().QueryInterface(Ci.nsIDOMWindow);
    if (when == "start" || window.document.readyState == "complete")
      this._listener.applyToWindow(window);
    else
      this.observe(window, "chrome-document-global-created", null);
  }

  Services.obs.addObserver(this, "chrome-document-global-created", true);

  this._shutdownHandler = function()
  {
    let e = Services.ww.getWindowEnumerator();
    while (e.hasMoreElements())
      this._listener.removeFromWindow(e.getNext().QueryInterface(Ci.nsIDOMWindow));

    Services.obs.removeObserver(this, "chrome-document-global-created");
  }.bind(this);
  onShutdown.add(this._shutdownHandler);
}
WindowObserver.prototype =
{
  _listener: null,
  _when: null,
  _shutdownHandler: null,

  shutdown: function()
  {
    if (!this._shutdownHandler)
      return;

    onShutdown.remove(this._shutdownHandler);
    this._shutdownHandler();
    this._shutdownHandler = null;
  },

  observe: function(subject, topic, data)
  {
    if (topic == "chrome-document-global-created")
    {
      let window = subject.QueryInterface(Ci.nsIDOMWindow);
      if (this._when == "start")
      {
        this._listener.applyToWindow(window);
        return;
      }

      let event = (this._when == "ready" ? "DOMContentLoaded" : "load");
      let listener = function()
      {
        window.removeEventListener(event, listener, false);
        if (this._shutdownHandler)
          this._listener.applyToWindow(window);
      }.bind(this);
      window.addEventListener(event, listener, false);
    }
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsISupportsWeakReference, Ci.nsIObserver])
};
