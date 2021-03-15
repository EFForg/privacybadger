/*
 * This file is part of Privacy Badger <https://privacybadger.org/>
 * Copyright (C) 2020 Electronic Frontier Foundation
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

function hideFrame(url) {
  let sel = "iframe[src='" + CSS.escape(url) + "']";
  let el = document.querySelector(sel);
  if (el) { // el could have gotten replaced since the lookup
    el.style.setProperty("display", "none", "important");
  }
}

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.hideFrame) {
    hideFrame(request.url);
    sendResponse(true);
  }
});

// check the page for any frames that were blocked before we got here
chrome.runtime.sendMessage({
  type: "getBlockedFrameUrls"
}, function (frameUrls) {
  if (!frameUrls) {
    return;
  }
  for (let url of frameUrls) {
    hideFrame(url);
  }
});

}());
