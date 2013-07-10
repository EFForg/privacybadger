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

//
// No direct file system access, using LocalStorage API
//

var IO = exports.IO =
{
  _getFilePath: function(file)
  {
    if (file instanceof FakeFile)
      return file.path;
    else if ("spec" in file)
      return file.spec;

    throw new Error("Unexpected file type");
  },

  _setFileContents: function(path, contents, lastModified)
  {
    window.localStorage[path] = contents;
    window.localStorage[path + "/lastModified"] = lastModified || 0;
  },

  lineBreak: "\n",

  resolveFilePath: function(path)
  {
    return new FakeFile(path);
  },

  readFromFile: function(file, decode, listener, callback, timeLineID)
  {
    var Utils = require("utils").Utils;
    Utils.runAsync(function()
    {
      if ("spec" in file && /^defaults\b/.test(file.spec))
      {
        // Code attempts to read the default patterns.ini, we don't have that.
        // Make sure to execute first-run actions instead.
        callback(null);
        if (localStorage.currentVersion)
          seenDataCorruption = true;
        delete localStorage.currentVersion;
        return;
      }

      var path = this._getFilePath(file);
      if (!(path in window.localStorage))
      {
        callback(new Error("File doesn't exist"))
        return;
      }

      var lines = window.localStorage[path].split(/[\r\n]+/);
      for (var i = 0; i < lines.length; i++)
        listener.process(lines[i]);
      listener.process(null);
      callback(null);
    }.bind(this));
  },

  writeToFile: function(file, encode, data, callback, timeLineID)
  {
    var path = this._getFilePath(file);
    this._setFileContents(path, data.join(this.lineBreak) + this.lineBreak, Date.now());

    var Utils = require("utils").Utils;
    Utils.runAsync(callback, null, null);
  },

  copyFile: function(fromFile, toFile, callback)
  {
    // Simply combine read and write operations
    var data = [];
    this.readFromFile(fromFile, false, {
      process: function(line)
      {
        if (line !== null)
          data.push(line);
      }
    }, function(e)
    {
      if (e)
        callback(e);
      else
        this.writeToFile(toFile, false, data, callback);
    }.bind(this));
  },

  renameFile: function(fromFile, newName, callback)
  {
    var path = this._getFilePath(fromFile);
    if (!(path in window.localStorage))
    {
      callback(new Error("File doesn't exist"))
      return;
    }

    this._setFileContents(newName, window.localStorage[path], window.localStorage[path + "/lastModified"]);
    this.removeFile(fromFile, callback);
  },

  removeFile: function(file, callback)
  {
    var path = this._getFilePath(file);
    delete window.localStorage[path];
    delete window.localStorage[path + "/lastModified"];
    callback(null);
  },

  statFile: function(file, callback)
  {
    var path = this._getFilePath(file);
    callback(null, {
      exists: path in window.localStorage,
      isDirectory: false,
      isFile: true,
      lastModified: parseInt(window.localStorage[path + "/lastModified"], 10) || 0
    });
  }
};
