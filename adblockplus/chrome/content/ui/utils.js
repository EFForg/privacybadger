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

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");

/**
 * Imports a module from Adblock Plus core.
 */
function require(/**String*/ module)
{
  var result = {};
  result.wrappedJSObject = result;
  Services.obs.notifyObservers(result, "adblockplus-require", module);
  return result.exports;
}

var {Policy} = require("contentPolicy");
var {Filter, InvalidFilter, CommentFilter, ActiveFilter, RegExpFilter,
     BlockingFilter, WhitelistFilter, ElemHideBase, ElemHideFilter, ElemHideException} = require("filterClasses");
var {FilterNotifier} = require("filterNotifier");
var {FilterStorage, PrivateBrowsing} = require("filterStorage");
var {IO} = require("io");
var {defaultMatcher, Matcher, CombinedMatcher} = require("matcher");
var {Prefs} = require("prefs");
var {RequestNotifier} = require("requestNotifier");
var {Subscription, SpecialSubscription, RegularSubscription,
     ExternalSubscription, DownloadableSubscription} = require("subscriptionClasses");
var {Synchronizer} = require("synchronizer");
var {UI} = require("ui");
var {Utils} = require("utils");

/**
 * Shortcut for document.getElementById(id)
 */
function E(id)
{
  return document.getElementById(id);
}

/**
 * Split up all labels into the label and access key portions.
 */
document.addEventListener("DOMContentLoaded", function splitAllLabelsHandler()
{
  document.removeEventListener("DOMContentLoaded", splitAllLabelsHandler, false);
  Utils.splitAllLabels(document);
}, false);
