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

var SELECTOR_GROUP_SIZE = 20;

var elemhideElt = null;

// Sets the currently used CSS rules for elemhide filters
function setElemhideCSSRules(selectors)
{
  if (elemhideElt && elemhideElt.parentNode)
    elemhideElt.parentNode.removeChild(elemhideElt);

  if (!selectors)
    return;

  elemhideElt = document.createElement("style");
  elemhideElt.setAttribute("type", "text/css");

  // Try to insert the style into the <head> tag, inserting directly under the
  // document root breaks dev tools functionality:
  // http://code.google.com/p/chromium/issues/detail?id=178109
  (document.head || document.documentElement).appendChild(elemhideElt);

  var elt = elemhideElt;  // Use a local variable to avoid racing conditions
  function setRules()
  {
    if (!elt.sheet)
    {
      // Stylesheet didn't initialize yet, wait a little longer
      window.setTimeout(setRules, 0);
      return;
    }

    // WebKit apparently chokes when the selector list in a CSS rule is huge.
    // So we split the elemhide selectors into groups.
    for (var i = 0, j = 0; i < selectors.length; i += SELECTOR_GROUP_SIZE, j++)
    {
      var selector = selectors.slice(i, i + SELECTOR_GROUP_SIZE).join(", ");
      elt.sheet.insertRule(selector + " { display: none !important; }", j);
    }
  }
  setRules();
}

var typeMap = {
  "img": "IMAGE",
  "input": "IMAGE",
  "audio": "MEDIA",
  "video": "MEDIA",
  "frame": "SUBDOCUMENT",
  "iframe": "SUBDOCUMENT"
};

function checkCollapse(event)
{
  var target = event.target;
  var tag = target.localName;
  var expectedEvent = (tag == "iframe" || tag == "frame" ? "load" : "error");
  if (tag in typeMap && event.type == expectedEvent)
  {
    // This element failed loading, did we block it?
    var url = target.src;
    if (!url)
      return;

    var type = typeMap[tag];
    chrome.extension.sendRequest({reqtype: "should-collapse", url: url, documentUrl: document.URL, type: type}, function(response)
    {
      if (response && target.parentNode)
      {
        // <frame> cannot be removed, doing that will mess up the frameset
        if (tag == "frame"){
          target.style.setProperty("visibility", "hidden", "!important");
        } else {
          target.parentNode.removeChild(target);
        } 
      }
    });
  }
}

function init()
{
  
  // Make sure this is really an HTML page, as Chrome runs these scripts on just about everything
  if (!(document.documentElement instanceof HTMLElement))
    return;

  document.addEventListener("error", checkCollapse, true);
  document.addEventListener("load", checkCollapse, true);

  chrome.extension.sendRequest({reqtype: "get-settings", selectors: true, frameUrl: window.location.href}, function(response)
  {
    setElemhideCSSRules(response.selectors);
  });
  
}

// In Chrome 18 the document might not be initialized yet
if (document.documentElement)
  init();
else
  window.setTimeout(init, 0);
