/*
 * This file is part of Privacy Badger <https://www.eff.org/privacybadger>
 * Copyright (C) 2014 Electronic Frontier Foundation
 * Derived from ShareMeNot
 * Copyright (C) 2011-2014 University of Washington
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

/*
 * ShareMeNot is licensed under the MIT license:
 * http://www.opensource.org/licenses/mit-license.php
 *
 * Copyright (c) 2011-2014 University of Washington
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be included
 * in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
 * OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

// widget data
let widgetList;

// cached chrome.i18n.getMessage() results
const TRANSLATIONS = {};

// references to widget page elements
const WIDGET_ELS = {};


/**
 * @param {Object} response response to checkWidgetReplacementEnabled
 */
function initialize(response) {
  for (const key in response.translations) {
    TRANSLATIONS[key] = response.translations[key];
  }

  widgetList = response.widgetList;

  // check for widgets blocked before we got here
  replaceInitialTrackerButtonsHelper(response.widgetsToReplace);

  // set up listener for dynamically created widgets
  chrome.runtime.onMessage.addListener(function (request) {
    if (request.replaceWidget) {
      replaceSubsequentTrackerButtonsHelper(request.trackerDomain);
    }
  });
}

/**
 * Creates a replacement placeholder element for the given widget.
 *
 * @param {Object} widget the SocialWidget object
 * @param {Element} trackerElem the button/widget element we are replacing
 * @param {Function} callback called with the replacement element
 */
function createReplacementElement(widget, trackerElem, callback) {
  let buttonData = widget.replacementButton;

  // already have replacement button image URI cached
  if (buttonData.buttonUrl) {
    return setTimeout(function () {
      _createReplacementElementCallback(widget, trackerElem, callback);
    }, 0);
  }

  if (buttonData.loading) {
    return setTimeout(function () {
      createReplacementElement(widget, trackerElem, callback);
    }, 10);
  }

  // don't have image data cached yet, get it from the background page
  buttonData.loading = true;
  chrome.runtime.sendMessage({
    type: "getReplacementButton",
    widgetName: widget.name
  }, function (response) {
    if (response) {
      buttonData.buttonUrl = response; // cache image data
      _createReplacementElementCallback(widget, trackerElem, callback);
    }
  });
}

function _createReplacementElementCallback(widget, trackerElem, callback) {
  let buttonData = widget.replacementButton,
    button_type = buttonData.type;

  let button = document.createElement("img");
  button.setAttribute("src", buttonData.buttonUrl);

  // apply tooltip to social button replacements only;
  // no need to do this for replacement widgets
  if (button_type < 3) {
    // TODO use custom tooltip to support RTL locales?
    button.setAttribute(
      "title",
      TRANSLATIONS.social_tooltip_pb_has_replaced.replace("XXX", widget.name)
    );
  }

  let styleAttrs = [
    "border: none",
    "cursor: pointer",
    "height: auto",
    "width: auto",
  ];
  button.setAttribute("style", styleAttrs.join(" !important;") + " !important");

  // normal button type; just open a new window when clicked
  if (button_type === 0) {
    let popup_url = buttonData.details + encodeURIComponent(window.location.href);

    button.addEventListener("click", function () {
      window.open(popup_url);
    });

  // in place button type; replace the existing button
  // with an iframe when clicked
  } else if (button_type == 1) {
    let iframe_url = buttonData.details + encodeURIComponent(window.location.href);

    button.addEventListener("click", function () {
      replaceButtonWithIframeAndUnblockTracker(button, widget.name, iframe_url);
    }, { once: true });

  // in place button type; replace the existing button with code
  // specified in the widgets JSON
  } else if (button_type == 2) {
    button.addEventListener("click", function () {
      replaceButtonWithHtmlCodeAndUnblockTracker(button, widget.name, buttonData.details);
    }, { once: true });

  // in-place widget type:
  // reinitialize the widget by reinserting its element's HTML
  } else if (button_type == 3) {
    let replacementEl = createReplacementWidget(
      widget, button, trackerElem, reinitializeWidgetAndUnblockTracker);
    return callback(replacementEl);

  // in-place widget type:
  // reinitialize the widget by reinserting its element's HTML
  // and activating associated scripts
  } else if (button_type == 4) {
    let replacementEl = createReplacementWidget(
      widget, button, trackerElem, replaceWidgetAndReloadScripts);
    return callback(replacementEl);
  }

  callback(button);
}


/**
 * Unblocks the given widget and replaces the given button with an iframe
 * pointing to the given URL.
 *
 * @param {Element} button the DOM element of the button to replace
 * @param {String} widget_name the name of the replacement widget
 * @param {String} iframeUrl the URL of the iframe to replace the button
 */
function replaceButtonWithIframeAndUnblockTracker(button, widget_name, iframeUrl) {
  unblockTracker(widget_name, function () {
    // check is needed as for an unknown reason this callback function is
    // executed for buttons that have already been removed; we are trying
    // to prevent replacing an already removed button
    if (button.parentNode !== null) {
      let iframe = document.createElement("iframe");

      iframe.setAttribute("src", iframeUrl);
      iframe.setAttribute("style", "border: none !important; height: 1.5em !important;");

      button.parentNode.replaceChild(iframe, button);
    }
  });
}

/**
 * Unblocks the given widget and replaces the given button with the
 * HTML code defined in the provided SocialWidget object.
 *
 * @param {Element} button the DOM element of the button to replace
 * @param {String} widget_name the name of the replacement widget
 * @param {String} html the HTML string that should replace the button
 */
function replaceButtonWithHtmlCodeAndUnblockTracker(button, widget_name, html) {
  unblockTracker(widget_name, function () {
    // check is needed as for an unknown reason this callback function is
    // executed for buttons that have already been removed; we are trying
    // to prevent replacing an already removed button
    if (button.parentNode !== null) {
      let codeContainer = document.createElement("div");
      codeContainer.innerHTML = html;

      button.parentNode.replaceChild(codeContainer, button);

      replaceScriptsRecurse(codeContainer);
    }
  });
}

/**
 * Unblocks the given widget and replaces our replacement placeholder
 * with the original third-party widget element.
 *
 * The teardown to the initialization defined in createReplacementWidget().
 *
 * @param {String} name the name/type of this widget (SoundCloud, Vimeo etc.)
 */
function reinitializeWidgetAndUnblockTracker(name) {
  unblockTracker(name, function () {
    // restore all widgets of this type
    WIDGET_ELS[name].forEach(data => {
      data.parent.replaceChild(data.widget, data.replacement);
    });
    WIDGET_ELS[name] = [];
  });
}

/**
 * Similar to reinitializeWidgetAndUnblockTracker() above,
 * but also reruns scripts defined in scriptSelectors.
 *
 * @param {String} name the name/type of this widget (Disqus, Google reCAPTCHA)
 */
function replaceWidgetAndReloadScripts(name) {
  unblockTracker(name, function () {
    // restore all widgets of this type
    WIDGET_ELS[name].forEach(data => {
      data.parent.replaceChild(data.widget, data.replacement);
      reloadScripts(data.scriptSelectors, data.fallbackScriptUrl);
    });
    WIDGET_ELS[name] = [];
  });
}

/**
 * Find and replace script elements with their copies to trigger re-running.
 */
function reloadScripts(selectors, fallback_script_url) {
  let scripts = document.querySelectorAll(selectors.join(','));

  // if there are no matches, try a known script URL
  if (!scripts.length && fallback_script_url) {
    let parent = document.documentElement,
      replacement = document.createElement("script");
    replacement.src = fallback_script_url;
    parent.insertBefore(replacement, parent.firstChild);
    return;
  }

  for (let scriptEl of scripts) {
    // reinsert script elements only
    if (!scriptEl.nodeName || scriptEl.nodeName.toLowerCase() != 'script') {
      continue;
    }

    let replacement = document.createElement("script");
    for (let attr of scriptEl.attributes) {
      replacement.setAttribute(attr.nodeName, attr.value);
    }
    scriptEl.parentNode.replaceChild(replacement, scriptEl);
    // reinsert one script and quit
    break;
  }
}

/**
 * Dumping scripts into innerHTML won't execute them, so replace them
 * with executable scripts.
 */
function replaceScriptsRecurse(node) {
  if (node.nodeName && node.nodeName.toLowerCase() == 'script' &&
      node.getAttribute && node.getAttribute("type") == "text/javascript") {
    let script = document.createElement("script");
    script.text = node.innerHTML;
    script.src = node.src;
    node.parentNode.replaceChild(script, node);
  } else {
    let i = 0,
      children = node.childNodes;
    while (i < children.length) {
      replaceScriptsRecurse(children[i]);
      i++;
    }
  }
  return node;
}


/**
 * Replaces all tracker buttons on the current web page with the internal
 * replacement buttons, respecting the user's blocking settings.
 *
 * @param {Array} widgetsToReplace a list of widget names to replace
 */
function replaceInitialTrackerButtonsHelper(widgetsToReplace) {
  widgetList.forEach(function (widget) {
    if (widgetsToReplace.hasOwnProperty(widget.name)) {
      replaceIndividualButton(widget);
    }
  });
}

/**
 * Individually replaces tracker buttons blocked after initial check.
 */
function replaceSubsequentTrackerButtonsHelper(tracker_domain) {
  if (!widgetList) {
    return;
  }
  widgetList.forEach(function (widget) {
    let replace = widget.domains.some(domain => {
      if (domain == tracker_domain) {
        return true;
      // leading wildcard
      } else if (domain[0] == "*") {
        if (tracker_domain.endsWith(domain.slice(1))) {
          return true;
        }
      }
      return false;
    });
    if (replace) {
      replaceIndividualButton(widget);
    }
  });
}

function createReplacementWidget(widget, icon, elToReplace, activationFn) {
  let name = widget.name;

  let widgetFrame = document.createElement('iframe');

  // widget replacement frame styles
  let border_width = 1;
  let styleAttrs = [
    "background-color: #fff",
    "border: " + border_width + "px solid #ec9329",
    "min-width: 220px",
    "min-height: 210px",
    "max-height: 400px",
    "z-index: 2147483647",
  ];
  if (elToReplace.offsetWidth > 0) {
    styleAttrs.push(`width: ${elToReplace.offsetWidth - 2*border_width}px`);
  }
  if (elToReplace.offsetHeight > 0) {
    styleAttrs.push(`height: ${elToReplace.offsetHeight - 2*border_width}px`);
  }
  widgetFrame.style = styleAttrs.join(" !important;") + " !important";

  let widgetDiv = document.createElement('div');

  // parent div styles
  styleAttrs = [
    "display: flex",
    "flex-direction: column",
    "align-items: center",
    "justify-content: center",
    "width: 100%",
    "height: 100%",
  ];
  if (TRANSLATIONS.rtl) {
    styleAttrs.push("direction: rtl");
  }
  widgetDiv.style = styleAttrs.join(" !important;") + " !important";

  // child div styles
  styleAttrs = [
    "display: flex",
    "align-items: center",
    "justify-content: center",
    "text-align: center",
    "margin: 10px",
    "width: 100%",
  ];

  let textDiv = document.createElement('div');
  textDiv.style = styleAttrs.join(" !important;") + " !important";
  textDiv.appendChild(document.createTextNode(
    TRANSLATIONS.widget_placeholder_pb_has_replaced.replace("XXX", name)));
  widgetDiv.appendChild(textDiv);

  let buttonDiv = document.createElement('div');
  buttonDiv.style = styleAttrs.join(" !important;") + " !important";

  // allow once button
  let button = document.createElement('button'),
    button_id = Math.random();
  button.id = button_id;
  styleAttrs = [
    "color: #333",
    "background-color: #fefefe",
    "border-radius: 3px",
    "cursor: pointer",
    "font-family: 'Lucida Grande', 'Segoe UI', Tahoma, 'DejaVu Sans', Arial, sans-serif",
    "font-size: 12px",
    "font-weight: bold",
    "line-height: 16px",
    "padding: 10px",
    "margin: 4px",
    "text-align: center",
  ];
  button.style = styleAttrs.join(" !important;") + " !important";

  icon.style.setProperty("margin", "0 5px", "important");
  icon.style.setProperty("height", "20px", "important");
  icon.style.setProperty("vertical-align", "middle", "important");
  icon.setAttribute("alt", "");
  button.appendChild(icon);

  button.appendChild(document.createTextNode(TRANSLATIONS.allow_once));

  buttonDiv.appendChild(button);

  widgetDiv.appendChild(buttonDiv);

  // save refs. to elements for use in teardown
  if (!WIDGET_ELS.hasOwnProperty(name)) {
    WIDGET_ELS[name] = [];
  }
  let data = {
    parent: elToReplace.parentNode,
    widget: elToReplace,
    replacement: widgetFrame
  };
  if (widget.scriptSelectors) {
    data.scriptSelectors = widget.scriptSelectors;
    if (widget.fallbackScriptUrl) {
      data.fallbackScriptUrl = widget.fallbackScriptUrl;
    }
  }
  WIDGET_ELS[name].push(data);

  // set up click handler
  widgetFrame.addEventListener('load', function () {
    let el = widgetFrame.contentDocument.getElementById(button_id);
    el.addEventListener("click", function (e) {
      activationFn(name);
      e.preventDefault();
    }, { once: true });
  }, false);

  let head_styles = `
html, body {
  height: 100% !important;
  overflow: hidden !important;
}
button {
  border: 2px solid !important;
}
button:hover {
  border: 2px solid #F06A0A !important;
}
  `.trim();

  widgetFrame.srcdoc = '<html><head><style>' + head_styles + '</style></head><body>' + widgetDiv.outerHTML + '</body></html>';

  return widgetFrame;
}

/**
 * Replaces buttons/widgets in the DOM.
 */
function replaceIndividualButton(widget) {
  let selector = widget.buttonSelectors.join(','),
    elsToReplace = document.querySelectorAll(selector);

  elsToReplace.forEach(function (el) {
    createReplacementElement(widget, el, function (replacementEl) {
      el.parentNode.replaceChild(replacementEl, el);
    });
  });
}

/**
 * Messages the background page to temporarily allow domains associated with a
 * given replacement widget.
 * Calls the provided callback function upon response.
 *
 * @param {String} name the name of the replacement widget
 * @param {Function} callback the callback function
 */
function unblockTracker(name, callback) {
  let request = {
    type: "unblockWidget",
    widgetName: name
  };
  chrome.runtime.sendMessage(request, callback);
}

// END FUNCTION DEFINITIONS ///////////////////////////////////////////////////

(function () {

// don't inject into non-HTML documents (such as XML documents)
// but do inject into XHTML documents
if (document instanceof HTMLDocument === false && (
  document instanceof XMLDocument === false ||
  document.createElement('div') instanceof HTMLDivElement === false
)) {
  return;
}

chrome.runtime.sendMessage({
  type: "checkWidgetReplacementEnabled"
}, function (response) {
  if (!response) {
    return;
  }
  initialize(response);
});

}());
