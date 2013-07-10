const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");

function require(module)
{
  let result = {};
  result.wrappedJSObject = result;
  Services.obs.notifyObservers(result, "adblockplus-require", module);
  return result.exports;
}

function getModuleGlobal(module)
{
  let result = Cu.getGlobalForObject(require(module));
  if (result == window)
  {
    // Work-around for bug 736316 - getGlobalForObject gave us our own window
    let {XPIProvider} = Cu.import("resource://gre/modules/XPIProvider.jsm", null);
    let addonID = "{d10d0bf8-f5b5-c8b4-a8b2-2b9879e08c5d}";
    if (addonID in XPIProvider.bootstrapScopes)
      result = XPIProvider.bootstrapScopes[addonID];
  }

  if ("require" in result)
    result = result.require.scopes[module];
  return result;
}

let {Filter, InvalidFilter, CommentFilter, ActiveFilter, RegExpFilter,
     BlockingFilter, WhitelistFilter, ElemHideBase, ElemHideFilter, ElemHideException} = require("filterClasses");
let {Subscription, SpecialSubscription, RegularSubscription,
     ExternalSubscription, DownloadableSubscription} = require("subscriptionClasses");
let {defaultMatcher, Matcher, CombinedMatcher} = require("matcher");
let {FilterListener} = require("filterListener");
let {FilterNotifier} = require("filterNotifier");
let {FilterStorage} = require("filterStorage");
let {ElemHide} = require("elemHide");
let {Prefs} = require("prefs");
let {RequestNotifier} = require("requestNotifier");
let {UI} = require("ui");
let {Utils} = require("utils");

let geckoVersion = Services.appinfo.platformVersion;
function compareGeckoVersion(version)
{
  return Services.vc.compare(geckoVersion, version);
}

function prepareFilterComponents(keepListeners)
{
  let FilterNotifierGlobal = getModuleGlobal("filterNotifier");

  this._backup = {
    subscriptions: FilterStorage.subscriptions,
    storageKnown: FilterStorage.knownSubscriptions,
    subscriptionsKnown: Subscription.knownSubscriptions,
    filtersKnown: Filter.knownFilters,
    listeners: FilterNotifierGlobal.listeners,
    sourceFile: FilterStorage.__lookupGetter__("sourceFile")
  };

  FilterStorage.subscriptions = [];
  FilterStorage.knownSubscriptions = {__proto__: null};
  Subscription.knownSubscriptions = {__proto__: null};
  Filter.knownFilters = {__proto__: null};
  if (!keepListeners)
  {
    FilterNotifierGlobal.listeners = [];
  }

  defaultMatcher.clear();
  ElemHide.clear();

  try
  {
    // Disable timeline functions, they slow down tests otherwise
    let {TimeLine} = require("timeline");

    this._backup.timelineLog = TimeLine.log;
    this._backup.timelineEnter = TimeLine.enter;
    this._backup.timelineLeave = TimeLine.leave;

    TimeLine.log = function(){};
    TimeLine.enter = function(){};
    TimeLine.leave = function(){};
  }
  catch(e)
  {
    // TimeLine module might not be present, catch exceptions
  }
}

function restoreFilterComponents()
{
  let FilterNotifierGlobal = getModuleGlobal("filterNotifier");

  FilterStorage.subscriptions = this._backup.subscriptions;
  FilterStorage.knownSubscriptions = this._backup.storageKnown;
  Subscription.knownSubscriptions = this._backup.subscriptionsKnown;
  Filter.knownFilters = this._backup.filtersKnown;
  FilterNotifierGlobal.listeners = this._backup.listeners;
  FilterStorage.__defineGetter__("sourceFile", this._backup.sourceFile);

  scheduleReinit();

  if ("timelineLeave" in this._backup)
  {
    let {TimeLine} = require("timeline");

    TimeLine.log = this._backup.timelineLog;
    TimeLine.enter = this._backup.timelineEnter;
    TimeLine.leave = this._backup.timelineLeave;
  }
}

// Only reinit our data structures when all the tests are done to prevent
// slowing down text execution
let reinitScheduled = false;
function scheduleReinit()
{
  if (reinitScheduled)
    return;

  let origDone = QUnit.done;
  QUnit.done = function()
  {
    FilterNotifier.triggerListeners("load");
    return origDone.apply(this, arguments);
  };
  reinitScheduled = true;
}

function preparePrefs()
{
  this._pbackup = {__proto__: null};
  for (let pref in Prefs)
  {
    if (Prefs.__lookupSetter__(pref))
      this._pbackup[pref] = Prefs[pref];
  }
  Prefs.enabled = true;
}

function restorePrefs()
{
  for (let pref in this._pbackup)
    Prefs[pref] = this._pbackup[pref];
}

function showProfilingData(debuggerService)
{
  let scripts = [];
  debuggerService.enumerateScripts({
    enumerateScript: function(script)
    {
      scripts.push(script);
    }
  });
  scripts = scripts.filter(function(script)
  {
    return script.fileName.indexOf("chrome://adblockplus/") == 0 && script.callCount > 0;
  });
  scripts.sort(function(a, b)
  {
    return b.totalOwnExecutionTime - a.totalOwnExecutionTime;
  });

  let table = document.createElement("table");
  table.setAttribute("border", "border");

  let header = table.insertRow(-1);
  header.style.fontWeight = "bold";
  header.insertCell(-1).textContent = "Function name";
  header.insertCell(-1).textContent = "Call count";
  header.insertCell(-1).textContent = "Min execution time (total/own)";
  header.insertCell(-1).textContent = "Max execution time (total/own)";
  header.insertCell(-1).textContent = "Total execution time (total/own)";

  for each (let script in scripts)
    showProfilingDataForScript(script, table);

  document.getElementById("display").appendChild(table);
}

function showProfilingDataForScript(script, table)
{
  let functionName = script.functionName;
  if (functionName == "anonymous")
    functionName = guessFunctionName(script.fileName, script.baseLineNumber);

  let row = table.insertRow(-1);
  row.insertCell(-1).innerHTML = functionName + "<br/>\n" + script.fileName.replace("chrome://adblockplus/", "") + ":" + script.baseLineNumber;
  row.insertCell(-1).textContent = script.callCount;
  row.insertCell(-1).textContent = script.minExecutionTime.toFixed(2) + "/" + script.minOwnExecutionTime.toFixed(2);
  row.insertCell(-1).textContent = script.maxExecutionTime.toFixed(2) + "/" + script.maxOwnExecutionTime.toFixed(2);
  row.insertCell(-1).textContent = script.totalExecutionTime.toFixed(2) + "/" + script.totalOwnExecutionTime.toFixed(2);
}

let fileCache = {};
function guessFunctionName(fileName, lineNumber)
{
  if (!(fileName in fileCache))
  {
    try
    {
      let request = new XMLHttpRequest();
      request.open("GET", fileName, false);
      request.overrideMimeType("text/plain");
      request.send(null);
      fileCache[fileName] = request.responseText.split(/\n/);
    }
    catch (e)
    {
      return "anonymous";
    }
  }

  let data = fileCache[fileName];

  lineNumber--;
  if (lineNumber >= 0 && lineNumber < data.length && /(\w+)\s*[:=]\s*function/.test(data[lineNumber]))
    return RegExp.$1;

  lineNumber--;
  if (lineNumber >= 0 && lineNumber < data.length && /(\w+)\s*[:=]\s*function/.test(data[lineNumber]))
    return RegExp.$1;

  return "anonymous";
}

if (/[?&]profiler/i.test(location.href))
{
  let debuggerService = Cc["@mozilla.org/js/jsd/debugger-service;1"].getService(Ci.jsdIDebuggerService);

  let oldFinish = SimpleTest.finish;
  SimpleTest.finish = function()
  {
    showProfilingData(debuggerService);
    debuggerService.off();
    return oldFinish.apply(this, arguments);
  }
  window.addEventListener("unload", function()
  {
    debuggerService.off();
  }, true);
  debuggerService.on();
  debuggerService.flags |= debuggerService.COLLECT_PROFILE_DATA;
  debuggerService.clearProfileData();
}
