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


importAll("filterClasses", this);
importAll("subscriptionClasses", this);
importAll("matcher", this);
importAll("filterStorage", this);
importAll("filterNotifier", this);
importAll("elemHide", this);
importAll("prefs", this);
importAll("utils", this);

function prepareFilterComponents(keepListeners)
{
  FilterStorage.subscriptions = [];
  FilterStorage.knownSubscriptions = {__proto__: null};
  Subscription.knownSubscriptions = {__proto__: null};
  Filter.knownFilters = {__proto__: null};

  defaultMatcher.clear();
  ElemHide.clear();
}

function restoreFilterComponents()
{
}

function preparePrefs()
{
  this._pbackup = {__proto__: null};
  for (var pref in Prefs)
    if (Prefs.hasOwnProperty(pref))
      this._pbackup[pref] = Prefs[pref];
  Prefs.enabled = true;
}

function restorePrefs()
{
  for (var pref in this._pbackup)
    Prefs[pref] = this._pbackup[pref];
}

function executeFirstRunActions()
{
}
