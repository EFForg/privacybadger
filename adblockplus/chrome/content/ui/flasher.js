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
 * Draws a blinking border for a list of matching nodes.
 */

var flasher = {
  nodes: null,
  count: 0,
  timer: null,

  flash: function(nodes)
  {
    this.stop();
    if (nodes)
      nodes = nodes.filter(function(node) node.nodeType == Node.ELEMENT_NODE);
    if (!nodes || !nodes.length)
      return;

    if (Prefs.flash_scrolltoitem && nodes[0].ownerDocument)
    {
      // Ensure that at least one node is visible when flashing
      let wnd = nodes[0].ownerDocument.defaultView;
      try
      {
        let topWnd = Utils.getChromeWindow(wnd);
        let {getBrowser} = require("appSupport");
        let browser = (getBrowser ? getBrowser(topWnd) : null);
        if (browser)
          browser.markupDocumentViewer.scrollToNode(nodes[0]);
      }
      catch(e)
      {
        Cu.reportError(e);
      }
    }

    this.nodes = nodes;
    this.count = 0;

    this.doFlash();
  },

  doFlash: function() {
    if (this.count >= 12) {
      this.stop();
      return;
    }

    if (this.count % 2)
      this.switchOff();
    else
      this.switchOn();

    this.count++;

    this.timer = window.setTimeout(function() {flasher.doFlash()}, 300);
  },

  stop: function() {
    if (this.timer) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.nodes) {
      this.switchOff();
      this.nodes = null;
    }
  },

  setOutline: function(outline, offset)
  {
    for (var i = 0; i < this.nodes.length; i++)
    {
      if ("style" in this.nodes[i])
      {
        this.nodes[i].style.outline = outline;
        this.nodes[i].style.outlineOffset = offset;
      }
    }
  },

  switchOn: function()
  {
    this.setOutline("#CC0000 dotted 2px", "-2px");
  },

  switchOff: function()
  {
    this.setOutline("", "");
  }
};
