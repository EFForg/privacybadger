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

/**
 * @fileOverview Module containing file I/O helpers.
 */

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/FileUtils.jsm");
Cu.import("resource://gre/modules/NetUtil.jsm");

let {TimeLine} = require("timeline");

let IO = exports.IO =
{
  /**
   * Retrieves the platform-dependent line break string.
   */
  get lineBreak()
  {
    let lineBreak = (Services.appinfo.OS == "WINNT" ? "\r\n" : "\n");
    delete IO.lineBreak;
    IO.__defineGetter__("lineBreak", function() lineBreak);
    return IO.lineBreak;
  },

  /**
   * Tries to interpret a file path as an absolute path or a path relative to
   * user's profile. Returns a file or null on failure.
   */
  resolveFilePath: function(/**String*/ path) /**nsIFile*/
  {
    if (!path)
      return null;

    try {
      // Assume an absolute path first
      return new FileUtils.File(path);
    } catch (e) {}

    try {
      // Try relative path now
      return FileUtils.getFile("ProfD", path.split("/"));
    } catch (e) {}

    return null;
  },

  /**
   * Reads strings from a file asynchronously, calls listener.process() with
   * each line read and with a null parameter once the read operation is done.
   * The callback will be called when the operation is done.
   */
  readFromFile: function(/**nsIFile|nsIURI*/ file, /**Boolean*/ decode, /**Object*/ listener, /**Function*/ callback, /**String*/ timeLineID)
  {
    try
    {
      let buffer = "";
      let uri = file instanceof Ci.nsIFile ? Services.io.newFileURI(file) : file;
      let request = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Ci.nsIXMLHttpRequest);
      request.mozBackgroundRequest = true;
      request.open("GET", uri.spec);
      request.responseType = "moz-chunked-text";
      request.overrideMimeType("text/plain" + (decode ? "? charset=utf-8" : ""));

      request.addEventListener("progress", function(event)
      {
        if (timeLineID)
        {
          TimeLine.asyncStart(timeLineID);
        }

        let data = event.target.response;
        let index = Math.max(data.lastIndexOf("\n"), data.lastIndexOf("\r"));
        if (index >= 0)
        {
          let oldBuffer = buffer;
          buffer = data.substr(index + 1);
          data = data.substr(0, index + 1);
          let lines = data.split(/[\r\n]+/);
          lines.pop();
          lines[0] = oldBuffer + lines[0];
          for (let i = 0; i < lines.length; i++)
            listener.process(lines[i]);
        }
        else
          buffer += data;

        if (timeLineID)
        {
          TimeLine.asyncEnd(timeLineID);
        }
      }, false);

      request.addEventListener("load", function(event)
      {
        if (timeLineID)
        {
          TimeLine.asyncStart(timeLineID);
        }

        if (buffer !== "")
          listener.process(buffer);
        listener.process(null);

        if (timeLineID)
        {
          TimeLine.asyncEnd(timeLineID);
          TimeLine.asyncDone(timeLineID);
        }

        callback(null);
      }, false);

      request.addEventListener("error", function()
      {
        let e = Cc["@mozilla.org/js/xpc/Exception;1"].createInstance(Ci.nsIXPCException);
        e.initialize("File read operation failed", result, null, Components.stack, file, null);
        callback(e);

        if (timeLineID)
        {
          TimeLine.asyncDone(timeLineID);
        }
      }, false);

      request.send(null);
    }
    catch (e)
    {
      callback(e);
    }
  },
  /**
   * Writes string data to a file asynchronously, optionally encodes it into
   * UTF-8 first. The callback will be called when the write operation is done.
   */
  writeToFile: function(/**nsIFile*/ file, /**Boolean*/ encode, /**Iterator*/ data, /**Function*/ callback, /**String*/ timeLineID)
  {
    try
    {
      let fileStream = FileUtils.openSafeFileOutputStream(file, FileUtils.MODE_WRONLY | FileUtils.MODE_CREATE | FileUtils.MODE_TRUNCATE);

      let pipe = Cc["@mozilla.org/pipe;1"].createInstance(Ci.nsIPipe);
      pipe.init(true, true, 0, 0x8000, null);

      let outStream = pipe.outputStream;
      if (encode)
      {
        outStream = Cc["@mozilla.org/intl/converter-output-stream;1"].createInstance(Ci.nsIConverterOutputStream);
        outStream.init(pipe.outputStream, "UTF-8", 0, Ci.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);
      }

      let copier = Cc["@mozilla.org/network/async-stream-copier;1"].createInstance(Ci.nsIAsyncStreamCopier);
      copier.init(pipe.inputStream, fileStream, null, true, false, 0x8000, true, true);
      copier.asyncCopy({
        onStartRequest: function(request, context) {},
        onStopRequest: function(request, context, result)
        {
          if (timeLineID)
          {
            TimeLine.asyncDone(timeLineID);
          }

          if (!Components.isSuccessCode(result))
          {
            let e = Cc["@mozilla.org/js/xpc/Exception;1"].createInstance(Ci.nsIXPCException);
            e.initialize("File write operation failed", result, null, Components.stack, file, null);
            callback(e);
          }
          else
            callback(null);
        }
      }, null);

      let lineBreak = this.lineBreak;
      let writeNextChunk = function()
      {
        let buf = [];
        let bufLen = 0;
        while (bufLen < 0x4000)
        {
          try
          {
            let str = data.next();
            buf.push(str);
            bufLen += str.length;
          }
          catch (e)
          {
            if (e instanceof StopIteration)
              break;
            else if (typeof e == "number")
              pipe.outputStream.closeWithStatus(e);
            else if (e instanceof Ci.nsIException)
              pipe.outputStream.closeWithStatus(e.result);
            else
            {
              Cu.reportError(e);
              pipe.outputStream.closeWithStatus(Cr.NS_ERROR_FAILURE);
            }
            return;
          }
        }

        pipe.outputStream.asyncWait({
          onOutputStreamReady: function()
          {
            if (timeLineID)
            {
              TimeLine.asyncStart(timeLineID);
            }

            if (buf.length)
            {
              let str = buf.join(lineBreak) + lineBreak;
              if (encode)
                outStream.writeString(str);
              else
                outStream.write(str, str.length);
              writeNextChunk();
            }
            else
              outStream.close();

            if (timeLineID)
            {
              TimeLine.asyncEnd(timeLineID);
            }
          }
        }, 0, 0, Services.tm.currentThread);
      };
      writeNextChunk();
    }
    catch (e)
    {
      callback(e);
    }
  },

  /**
   * Copies a file asynchronously. The callback will be called when the copy
   * operation is done.
   */
  copyFile: function(/**nsIFile*/ fromFile, /**nsIFile*/ toFile, /**Function*/ callback)
  {
    try
    {
      let inStream = Cc["@mozilla.org/network/file-input-stream;1"].createInstance(Ci.nsIFileInputStream);
      inStream.init(fromFile, FileUtils.MODE_RDONLY, 0, Ci.nsIFileInputStream.DEFER_OPEN);

      let outStream = FileUtils.openFileOutputStream(toFile, FileUtils.MODE_WRONLY | FileUtils.MODE_CREATE | FileUtils.MODE_TRUNCATE);

      NetUtil.asyncCopy(inStream, outStream, function(result)
      {
        if (!Components.isSuccessCode(result))
        {
          let e = Cc["@mozilla.org/js/xpc/Exception;1"].createInstance(Ci.nsIXPCException);
          e.initialize("File write operation failed", result, null, Components.stack, file, null);
          callback(e);
        }
        else
          callback(null);
      });
    }
    catch (e)
    {
      callback(e);
    }
  },

  /**
   * Renames a file within the same directory, will call callback when done.
   */
  renameFile: function(/**nsIFile*/ fromFile, /**String*/ newName, /**Function*/ callback)
  {
    try
    {
      fromFile.moveTo(null, newName);
      callback(null);
    }
    catch(e)
    {
      callback(e);
    }
  },

  /**
   * Removes a file, will call callback when done.
   */
  removeFile: function(/**nsIFile*/ file, /**Function*/ callback)
  {
    try
    {
      file.remove(false);
      callback(null);
    }
    catch(e)
    {
      callback(e);
    }
  },

  /**
   * Gets file information such as whether the file exists.
   */
  statFile: function(/**nsIFile*/ file, /**Function*/ callback)
  {
    try
    {
      let exists = file.exists();
      callback(null, {
        exists: exists,
        isDirectory: exists && file.isDirectory(),
        isFile: exists && file.isFile(),
        lastModified: exists ? file.lastModifiedTime : 0
      });
    }
    catch(e)
    {
      callback(e);
    }
  }
}
