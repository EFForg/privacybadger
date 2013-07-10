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

let nodes = null;
let item = null;
let advancedMode = false;

function init()
{
  [nodes, item] = window.arguments;

  E("filterType").value = (!item.filter || item.filter.disabled || item.filter instanceof WhitelistFilter ? "filterlist" : "whitelist");
  E("customPattern").value = item.location;

  let insertionPoint = E("customPatternBox");
  let addSuggestion = function(address)
  {
    // Always drop protocol and www. from the suggestion
    address = address.replace(/^[\w\-]+:\/+(?:www\.)?/, "");

    let suggestion = document.createElement("radio");
    suggestion.setAttribute("value", address);
    suggestion.setAttribute("label", address);
    suggestion.setAttribute("crop", "center");
    suggestion.setAttribute("class", "suggestion");
    insertionPoint.parentNode.insertBefore(suggestion, insertionPoint);

    return address;
  }

  let ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
  try
  {
    let suggestions = [""];

    let url = ioService.newURI(item.location, null, null)
                       .QueryInterface(Ci.nsIURL);
    let suffix = (url.query ? "?*" : "");
    url.query = "";
    suggestions[1] = addSuggestion(url.spec + suffix);

    let parentURL = ioService.newURI(url.fileName == "" ? ".." : ".", null, url);
    if (!parentURL.equals(url))
      suggestions[2] = addSuggestion(parentURL.spec + "*");
    else
      suggestions[2] = suggestions[1];

    let rootURL = ioService.newURI("/", null, url);
    if (!rootURL.equals(parentURL) && !rootURL.equals(url))
      suggestions[3] = addSuggestion(rootURL.spec + "*");
    else
      suggestions[3] = suggestions[2];

    try
    {
      suggestions[4] = addSuggestion(url.host.replace(/^www\./, "") + "^");

      // Prefer example.com^ to example.com/*
      let undesired = suggestions[4].replace(/\^$/, "/*");
      for (let i = 0; i < suggestions.length - 1; i++)
        if (suggestions[i] == undesired)
          suggestions[i] = suggestions[4];

      for (let child = insertionPoint.parentNode.firstChild; child; child = child.nextSibling)
      {
        if (child.localName == "radio" && child.getAttribute("value") == undesired)
        {
          child.parentNode.removeChild(child);
          break;
        }
      }
    }
    catch (e)
    {
      suggestions[4] = suggestions[3];
    }

    try
    {
      let effectiveTLD = Cc["@mozilla.org/network/effective-tld-service;1"].getService(Ci.nsIEffectiveTLDService);
      let host = url.host;
      let baseDomain = effectiveTLD.getBaseDomainFromHost(host);
      if (baseDomain != host.replace(/^www\./, ""))
        suggestions[5] = addSuggestion(baseDomain + "^");
      else
        suggestions[5] = suggestions[4];
    }
    catch (e)
    {
      suggestions[5] = suggestions[4];
    }

    E("patternGroup").value = (Prefs.composer_default in suggestions ? suggestions[Prefs.composer_default] : suggestions[1]);
  }
  catch (e)
  {
    // IOService returned nsIURI - not much we can do with it
    addSuggestion(item.location);
    E("patternGroup").value = "";
  }
  if (Prefs.composer_default == 0)
    E("customPattern").focus();
  else
    E("patternGroup").focus();

  let types = [];
  for (let type in Policy.localizedDescr)
  {
    types.push(parseInt(type));
  }
  types.sort(function(a, b) {
    if (a < b)
      return -1;
    else if (a > b)
      return 1;
    else
      return 0;
  });

  let docDomain = item.docDomain;
  let thirdParty = item.thirdParty;

  if (docDomain)
    docDomain = docDomain.replace(/^www\./i, "").replace(/\.+$/, "");
  if (docDomain)
    E("domainRestriction").value = docDomain;

  E("thirdParty").hidden = !thirdParty;
  E("firstParty").hidden = thirdParty;

  let typeGroup = E("typeGroup");
  let defaultTypes = RegExpFilter.prototype.contentType & ~RegExpFilter.typeMap.DOCUMENT;
  let isDefaultType = (RegExpFilter.typeMap[item.typeDescr] & defaultTypes) != 0;
  for each (let type in types)
  {
    if (type == Policy.type.ELEMHIDE)
      continue;

    let typeNode = document.createElement("checkbox");
    typeNode.setAttribute("value", Policy.typeDescr[type].toLowerCase().replace(/\_/g, "-"));
    typeNode.setAttribute("label", Policy.localizedDescr[type].toLowerCase());

    let typeMask = RegExpFilter.typeMap[Policy.typeDescr[type]];
    typeNode._defaultType = (typeMask & defaultTypes) != 0;
    if ((isDefaultType && typeNode._defaultType) || (!isDefaultType && item.type == type))
      typeNode.setAttribute("checked", "true");

    if (item.type == type)
      typeNode.setAttribute("disabled", "true");
    typeNode.addEventListener("command", function() checkboxUpdated(this), false);
    typeGroup.appendChild(typeNode);
  }

  let collapseDefault = E("collapseDefault");
  collapseDefault.label = collapseDefault.getAttribute(Prefs.fastcollapse ? "label_no" : "label_yes");
  E("collapse").value = "";
  E("collapse").setAttribute("label", collapseDefault.label);

  let warning = E("disabledWarning");
  generateLinkText(warning);
  warning.hidden = Prefs.enabled;

  updatePatternSelection();
}

function checkboxUpdated(checkbox)
{
  checkbox._lastChange = Date.now();
  updateFilter();
}

function updateFilter()
{
  let filter = "";

  let type = E("filterType").value
  if (type == "whitelist")
    filter += "@@";

  let pattern = E("patternGroup").value;
  if (pattern == "")
    pattern = E("customPattern").value;

  if (E("anchorStart").checked)
    filter += E("anchorStart").flexibleAnchor ? "||" : "|";

  filter += pattern;

  if (E("anchorEnd").checked)
    filter += "|";

  if (advancedMode)
  {
    let options = [];

    if (E("domainRestrictionEnabled").checked)
    {
      let domainRestriction = E("domainRestriction").value.replace(/[,\s]/g, "").replace(/\.+$/, "");
      if (domainRestriction)
        options.push([E("domainRestrictionEnabled")._lastChange || 0, "domain=" + domainRestriction]);
    }

    if (E("firstParty").checked)
      options.push([E("firstParty")._lastChange || 0, "~third-party"]);
    if (E("thirdParty").checked)
      options.push([E("thirdParty")._lastChange || 0, "third-party"]);

    if (E("matchCase").checked)
      options.push([E("matchCase")._lastChange || 0, "match-case"]);

    let collapse = E("collapse");
    disableElement(collapse, type == "whitelist", "value", "");
    if (collapse.value != "")
      options.push([collapse._lastChange, collapse.value]);

    let enabledTypes = [];
    let disabledTypes = [];
    let forceEnabledTypes = [];
    for (let typeNode = E("typeGroup").firstChild; typeNode; typeNode = typeNode.nextSibling)
    {
      let value = typeNode.getAttribute("value");
      if (value == "document")
        disableElement(typeNode, type != "whitelist", "checked", false);

      if (!typeNode._defaultType)
      {
        if (typeNode.getAttribute("checked") == "true")
          forceEnabledTypes.push([typeNode._lastChange || 0, value]);
      }
      else if (typeNode.getAttribute("checked") == "true")
        enabledTypes.push([typeNode._lastChange || 0, value]);
      else
        disabledTypes.push([typeNode._lastChange || 0, "~" + value]);
    }
    if (!forceEnabledTypes.length && disabledTypes.length < enabledTypes.length)
      options.push.apply(options, disabledTypes);
    else
      options.push.apply(options, enabledTypes);
    options.push.apply(options, forceEnabledTypes);

    if (options.length)
    {
      options.sort(function(a, b) a[0] - b[0]);
      filter += "$" + options.map(function(o) o[1]).join(",");
    }
  }
  else
  {
    let defaultTypes = RegExpFilter.prototype.contentType & ~RegExpFilter.typeMap.DOCUMENT;
    let isDefaultType = (RegExpFilter.typeMap[item.typeDescr] & defaultTypes) != 0;
    if (!isDefaultType)
      filter += "$" + item.typeDescr.toLowerCase().replace(/\_/g, "-");
  }

  filter = Filter.normalize(filter);
  E("regexpWarning").hidden = !Filter.regexpRegExp.test(filter);

  let isSlow = false;
  let compiledFilter = Filter.fromText(filter);
  if (E("regexpWarning").hidden)
  {
    if (compiledFilter instanceof RegExpFilter && defaultMatcher.isSlowFilter(compiledFilter))
      isSlow = true;
  }
  E("shortpatternWarning").hidden = !isSlow;

  E("matchWarning").hidden = compiledFilter instanceof RegExpFilter && compiledFilter.matches(item.location, item.typeDescr, item.docDomain, item.thirdParty);

  E("filter").value = filter;
}

function generateLinkText(element, replacement)
{
  let template = element.getAttribute("textTemplate");
  if (typeof replacement != "undefined")
    template = template.replace(/\?1\?/g, replacement)

  let [, beforeLink, linkText, afterLink] = /(.*)\[link\](.*)\[\/link\](.*)/.exec(template) || [null, "", template, ""];
  while (element.firstChild && element.firstChild.nodeType != Node.ELEMENT_NODE)
    element.removeChild(element.firstChild);
  while (element.lastChild && element.lastChild.nodeType != Node.ELEMENT_NODE)
    element.removeChild(element.lastChild);
  if (!element.firstChild)
    return;

  element.firstChild.textContent = linkText;
  element.insertBefore(document.createTextNode(beforeLink), element.firstChild);
  element.appendChild(document.createTextNode(afterLink));
}

function updatePatternSelection()
{
  let pattern = E("patternGroup").value;
  if (pattern == "")
  {
    pattern = E("customPattern").value;
  }
  else
  {
    E("anchorStart").checked = true;
    E("anchorEnd").checked = false;
  }

  function testFilter(/**String*/ filter) /**Boolean*/
  {
    return RegExpFilter.fromText(filter + "$" + item.typeDescr).matches(item.location, item.typeDescr, item.docDomain, item.thirdParty);
  }

  let anchorStartCheckbox = E("anchorStart");
  if (!/^\*/.test(pattern) && testFilter("||" + pattern))
  {
    disableElement(anchorStartCheckbox, false, "checked", false);
    [anchorStartCheckbox.label, anchorStartCheckbox.accessKey] = Utils.splitLabel(anchorStartCheckbox.getAttribute("labelFlexible"));
    anchorStartCheckbox.flexibleAnchor = true;
  }
  else
  {
    disableElement(anchorStartCheckbox, /^\*/.test(pattern) || !testFilter("|" + pattern), "checked", false);
    [anchorStartCheckbox.label, anchorStartCheckbox.accessKey] = Utils.splitLabel(anchorStartCheckbox.getAttribute("labelRegular"));
    anchorStartCheckbox.flexibleAnchor = false;
  }
  disableElement(E("anchorEnd"), /[\*\^]$/.test(pattern) || !testFilter(pattern + "|"), "checked", false);

  updateFilter();
  setAdvancedMode(document.documentElement.getAttribute("advancedMode") == "true");
}

function updateCustomPattern()
{
  E("patternGroup").value = "";
  updatePatternSelection();
}

function addFilter() {
  let filter = Filter.fromText(document.getElementById("filter").value);
  filter.disabled = false;

  FilterStorage.addFilter(filter);

  if (nodes)
    Policy.refilterNodes(nodes, item);

  return true;
}

function setAdvancedMode(mode) {
  advancedMode = mode;

  var dialog = document.documentElement;
  dialog.setAttribute("advancedMode", advancedMode);

  var button = dialog.getButton("disclosure");
  button.setAttribute("label", dialog.getAttribute(advancedMode ? "buttonlabeldisclosure_off" : "buttonlabeldisclosure_on"));

  updateFilter();
}

function disableElement(element, disable, valueProperty, disabledValue) {
  if ((element.getAttribute("disabled") == "true") == disable)
    return;

  if (disable)
  {
    element.setAttribute("disabled", "true");
    element._abpStoredValue = element[valueProperty];
    element[valueProperty] = disabledValue;
  }
  else
  {
    element.removeAttribute("disabled");
    if ("_abpStoredValue" in element)
      element[valueProperty] = element._abpStoredValue;
    delete element._abpStoredValue;
  }
}

function openPreferences()
{
  UI.openFiltersDialog(Filter.fromText(E("filter").value));
}

function doEnable() {
  Prefs.enabled = true;
  E("disabledWarning").hidden = true;
}

/**
 * Selects or unselects all type checkboxes except those
 * that are disabled.
 */
function selectAllTypes(/**Boolean*/ select)
{
  for (let typeNode = E("typeGroup").firstChild; typeNode; typeNode = typeNode.nextSibling)
    if (typeNode.getAttribute("disabled") != "true")
      typeNode.checked = select;
  updateFilter();
}
