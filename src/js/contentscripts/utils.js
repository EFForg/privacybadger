/*
 * This file is part of Privacy Badger <https://privacybadger.org/>
 * Copyright (C) 2018 Electronic Frontier Foundation
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

/**
 * Executes a script in the page's JavaScript context.
 *
 * @param {String} text The content of the script to insert.
 * @param {Object} data Data attributes to set on the inserted script tag.
 */
// TODO fix for MV3
window.injectScript = function (text) {
  // TODO temp. workaround just to get going (not great because subject to page CSP):
  // https://bugs.chromium.org/p/chromium/issues/detail?id=1207006#c4
  let parent = document.documentElement, el = document.createElement('div');
  el.setAttribute('onclick', text);
  parent.appendChild(el);
  el.click();
  el.remove();
};

function getFrameUrl() {
  let url = document.location.href,
    parentFrame = (document != window.top) && window.parent;
  while (parentFrame && url && !url.startsWith("http")) {
    try {
      url = parentFrame.document.location.href;
    } catch (ex) {
      // ignore 'Blocked a frame with origin "..."
      // from accessing a cross-origin frame.' exceptions
    }
    parentFrame = (parentFrame != window.top) && parentFrame.parent;
  }
  return url;
}
window.FRAME_URL = getFrameUrl();

// END FUNCTION DEFINITIONS ///////////////////////////////////////////////////

document.addEventListener("pbSurrogateMessage", function (e) {
  if (e.detail && e.detail.type == "widgetFromSurrogate") {
    chrome.runtime.sendMessage({
      type: "widgetFromSurrogate",
      name: e.detail.name,
      data: e.detail.widgetData,
      frameUrl: window.FRAME_URL
    });
  }
});

}());
