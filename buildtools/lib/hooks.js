/*
 * This file is part of the Adblock Plus build tools,
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

function hook(obj, name, func, cleanup)
{
  let orig = obj[name];
  let origGet = obj.__lookupGetter__(name);
  let origSet = obj.__lookupSetter__(name);
  let dumbOverrideAttempt = false;

  let newFunc = function()
  {
    let params = arguments;
    try
    {
      let result = func.apply(this, params);
      if (typeof result == "object")
        params = result;
    }
    catch(e)
    {
      Cu.reportError(e);
    }

    try
    {
      return orig.apply(this, params);
    }
    finally
    {
      if (typeof cleanup == "function")
        cleanup();
    }
  };
  newFunc.toString = function()
  {
    dumbOverrideAttempt = true;
    return orig.toString();
  };
  newFunc.toSource = function()
  {
    dumbOverrideAttempt = true;
    return orig.toSource();
  }

  obj.__defineGetter__(name, function()
  {
    dumbOverrideAttempt = false;
    return newFunc;
  });

  obj.__defineSetter__(name, function(value)
  {
    if (dumbOverrideAttempt)
    {
      orig = value;
    }
    else
    {
      delete obj[name];
      obj[name] = value;
    }
  });

  return function()
  {
    delete obj[name];
    obj[name] = orig;
    if (origGet)
    {
      obj.__defineGetter__(name, origGet);
    }
    if (origSet)
    {
      obj.__defineSetter__(name, origSet);
    }
  };
}
exports.hook = hook;
