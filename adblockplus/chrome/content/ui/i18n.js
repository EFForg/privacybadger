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

var i18n;
if (typeof chrome != "undefined")
{
  i18n = chrome.i18n;
}
else
{
  // Using Firefox' approach on i18n instead
  
  // Randomize URI to work around bug 719376
  var pageName = location.pathname.replace(/.*\//, '').replace(/\..*?$/, '');
  var stringBundle = Services.strings.createBundle("chrome://adblockplus/locale/" + pageName +
    ".properties?" + Math.random());
  
  function getI18nMessage(key)
  {
    return {
      "message": stringBundle.GetStringFromName(key)
    };
  }
  
  i18n = (function()
  {
    function getText(message, args)
    {
      var text = message.message;
      var placeholders = message.placeholders;

      if (!args || !placeholders)
        return text;

      for (var key in placeholders)
      {
        var content = placeholders[key].content;
        if (!content)
          continue;

        var index = parseInt(content.slice(1), 10);
        if (isNaN(index))
          continue;

        var replacement = args[index - 1];
        if (typeof replacement === "undefined")
          continue;

        text = text.split("$" + key + "$").join(replacement);
      }
      return text;
    }

    return {
      getMessage: function(key, args)
      {
        try{
          var message = getI18nMessage(key);
          return getText(message, args);
        }
        catch(e)
        {
          Cu.reportError(e);
          return "Missing translation: " + key;
        }
      }
    };
  })();
}

// Loads and inserts i18n strings into matching elements. Any inner HTML already in the
// element is parsed as JSON and used as parameters to substitute into placeholders in the
// i18n message.
function loadI18nStrings()
{
  var nodes = document.querySelectorAll("[class^='i18n_']");
  for(var i = 0; i < nodes.length; i++)
  {
    var arguments = JSON.parse("[" + nodes[i].textContent + "]");
    var className = nodes[i].className;
    if (className instanceof SVGAnimatedString)
      className = className.animVal;
    var stringName = className.split(/\s/)[0].substring(5);
    var prop = "innerHTML" in nodes[i] ? "innerHTML" : "textContent";
    if(arguments.length > 0)
      nodes[i][prop] = i18n.getMessage(stringName, arguments);
    else
      nodes[i][prop] = i18n.getMessage(stringName);
  }
}

// Provides a more readable string of the current date and time
function i18n_timeDateStrings(when)
{
  var d = new Date(when);
  var timeString = d.toLocaleTimeString();

  var now = new Date();
  if (d.toDateString() == now.toDateString())
    return [timeString];
  else
    return [timeString, d.toLocaleDateString()];
}

// Fill in the strings as soon as possible
window.addEventListener("DOMContentLoaded", loadI18nStrings, true);
