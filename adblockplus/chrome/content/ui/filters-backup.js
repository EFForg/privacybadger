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

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/FileUtils.jsm");

/**
 * Implementation of backup and restore functionality.
 * @class
 */
var Backup =
{
  /**
   * Template for menu items to be displayed in the Restore menu (for automated
   * backups).
   * @type Element
   */
  restoreTemplate: null,

  /**
   * Element after which restore items should be inserted.
   * @type Element
   */
  restoreInsertionPoint: null,

  /**
   * Regular expression to recognize checksum comments.
   */
  CHECKSUM_REGEXP: /^!\s*checksum[\s\-:]+([\w\+\/]+)/i,

  /**
   * Regular expression to recognize group title comments.
   */
  GROUPTITLE_REGEXP: /^!\s*\[(.*)\]((?:\/\w+)*)\s*$/,


  /**
   * Initializes backup UI.
   */
  init: function()
  {
    this.restoreTemplate = E("restoreBackupTemplate");
    this.restoreInsertionPoint = this.restoreTemplate.previousSibling;
    this.restoreTemplate.parentNode.removeChild(this.restoreTemplate);
    this.restoreTemplate.removeAttribute("id");
    this.restoreTemplate.removeAttribute("hidden");
  },

  /**
   * Gets the default download dir, as used by the browser itself.
   */
  getDefaultDir: function() /**nsIFile*/
  {
    try
    {
      return Utils.prefService.getComplexValue("browser.download.lastDir", Ci.nsILocalFile);
    }
    catch (e)
    {
      // No default download location. Default to desktop.
      return FileUtils.getDir("Desk", [], false);
    }
  },

  /**
   * Saves new default download dir after the user chose a different directory to
   * save his files to.
   */
  saveDefaultDir: function(/**nsIFile*/ dir)
  {
    try
    {
      Utils.prefService.setComplexValue("browser.download.lastDir", Ci.nsILocalFile, dir);
    } catch(e) {};
  },

  /**
   * Called when the Restore menu is being opened, fills in "Automated backup"
   * entries.
   */
  fillRestorePopup: function()
  {
    while (this.restoreInsertionPoint.nextSibling && !this.restoreInsertionPoint.nextSibling.id)
      this.restoreInsertionPoint.parentNode.removeChild(this.restoreInsertionPoint.nextSibling);

    let files = FilterStorage.getBackupFiles().reverse();
    for (let i = 0; i < files.length; i++)
    {
      let file = files[i];
      let item = this.restoreTemplate.cloneNode(true);
      let label = item.getAttribute("label");
      label = label.replace(/\?1\?/, Utils.formatTime(file.lastModifiedTime));
      item.setAttribute("label", label);
      item.addEventListener("command", function()
      {
        Backup.restoreAllData(file);
      }, false);
      this.restoreInsertionPoint.parentNode.insertBefore(item, this.restoreInsertionPoint.nextSibling);
    }
  },

  /**
   * Lets the user choose a file to restore filters from.
   */
  restoreFromFile: function()
  {
    let picker = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
    picker.init(window, E("backupButton").getAttribute("_restoreDialogTitle"), picker.modeOpen);
    picker.defaultExtension = ".ini";
    picker.appendFilter(E("backupButton").getAttribute("_fileFilterComplete"), "*.ini");
    picker.appendFilter(E("backupButton").getAttribute("_fileFilterCustom"), "*.txt");

    if (picker.show() != picker.returnCancel)
    {
      this.saveDefaultDir(picker.file.parent);
      if (picker.filterIndex == 0)
        this.restoreAllData(picker.file);
      else
        this.restoreCustomFilters(picker.file);
    }
  },

  /**
   * Restores patterns.ini from a file.
   */
  restoreAllData: function(/**nsIFile*/ file)
  {
    let stream = Cc["@mozilla.org/network/file-input-stream;1"].createInstance(Ci.nsIFileInputStream);
    stream.init(file, FileUtils.MODE_RDONLY, FileUtils.PERMS_FILE, 0);
    stream.QueryInterface(Ci.nsILineInputStream);

    let lines = [];
    let line = {value: null};
    if (stream.readLine(line))
      lines.push(line.value);
    if (stream.readLine(line))
      lines.push(line.value);
    stream.close();

    let match;
    if (lines.length < 2 || lines[0] != "# Adblock Plus preferences" || !(match = /version=(\d+)/.exec(lines[1])))
    {
      Utils.alert(window, E("backupButton").getAttribute("_restoreError"), E("backupButton").getAttribute("_restoreDialogTitle"));
      return;
    }

    let warning = E("backupButton").getAttribute("_restoreCompleteWarning");
    let minVersion = parseInt(match[1], 10);
    if (minVersion > FilterStorage.formatVersion)
      warning += "\n\n" + E("backupButton").getAttribute("_restoreVersionWarning");

    if (!Utils.confirm(window, warning, E("backupButton").getAttribute("_restoreDialogTitle")))
      return;

    FilterStorage.loadFromDisk(file);
  },

  /**
   * Restores custom filters from a file.
   */
  restoreCustomFilters: function(/**nsIFile*/ file)
  {
    IO.readFromFile(file, true, {
      seenHeader: false,
      subscription: null,
      process: function(line)
      {
        if (!this.seenHeader)
        {
          // This should be a header
          this.seenHeader = true;
          let match = /\[Adblock(?:\s*Plus\s*([\d\.]+)?)?\]/i.exec(line);
          if (match)
          {
            let warning = E("backupButton").getAttribute("_restoreCustomWarning");
            let minVersion = match[1];
            if (minVersion && Utils.versionComparator.compare(minVersion, Utils.addonVersion) > 0)
              warning += "\n\n" + E("backupButton").getAttribute("_restoreVersionWarning");

            if (Utils.confirm(window, warning, E("backupButton").getAttribute("_restoreDialogTitle")))
            {
              let subscriptions = FilterStorage.subscriptions.filter(function(s) s instanceof SpecialSubscription);
              for (let i = 0; i < subscriptions.length; i++)
                FilterStorage.removeSubscription(subscriptions[i]);

              return;
            }
            else
              throw Cr.NS_BASE_STREAM_WOULD_BLOCK;
          }
          else
            throw new Error("Invalid file");
        }
        else if (line === null)
        {
          // End of file
          if (this.subscription)
            FilterStorage.addSubscription(this.subscription);
          E("tabs").selectedIndex = 1;
        }
        else if (Backup.CHECKSUM_REGEXP.test(line))
        {
          // Ignore checksums
        }
        else if (Backup.GROUPTITLE_REGEXP.test(line))
        {
          // New group start
          if (this.subscription)
            FilterStorage.addSubscription(this.subscription);

          let [, title, options] = Backup.GROUPTITLE_REGEXP.exec(line);
          this.subscription = SpecialSubscription.create(title);

          let defaults = [];
          if (options)
            options = options.split("/");
          for (let j = 0; j < options.length; j++)
            if (options[j] in SpecialSubscription.defaultsMap)
              defaults.push(options[j]);
          if (defaults.length)
            this.subscription.defaults = defaults;
        }
        else
        {
          // Regular filter
          line = Filter.normalize(line);
          if (line)
          {
            if (!this.subscription)
              this.subscription = SpecialSubscription.create(Utils.getString("newGroup_title"));
            this.subscription.filters.push(Filter.fromText(line));
          }
        }
      }
    }, function(e)
    {
      if (e && e.result != Cr.NS_BASE_STREAM_WOULD_BLOCK)
      {
        Cu.reportError(e);
        Utils.alert(window, E("backupButton").getAttribute("_restoreError"), E("backupButton").getAttribute("_restoreDialogTitle"));
      }
    });
  },

  /**
   * Lets the user choose a file to backup filters to.
   */
  backupToFile: function()
  {
    let picker = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
    picker.init(window, E("backupButton").getAttribute("_backupDialogTitle"), picker.modeSave);
    picker.defaultExtension = ".ini";
    picker.appendFilter(E("backupButton").getAttribute("_fileFilterComplete"), "*.ini");
    picker.appendFilter(E("backupButton").getAttribute("_fileFilterCustom"), "*.txt");

    if (picker.show() != picker.returnCancel)
    {
      this.saveDefaultDir(picker.file.parent);
      if (picker.filterIndex == 0)
        this.backupAllData(picker.file);
      else
        this.backupCustomFilters(picker.file);
    }
  },

  /**
   * Writes all patterns.ini data to a file.
   */
  backupAllData: function(/**nsIFile*/ file)
  {
    FilterStorage.saveToDisk(file);
  },

  /**
   * Writes user's custom filters to a file.
   */
  backupCustomFilters: function(/**nsIFile*/ file)
  {
    let subscriptions = FilterStorage.subscriptions.filter(function(s) s instanceof SpecialSubscription);
    let minVersion = "2.0"
    let list = [];
    for (let i = 0; i < subscriptions.length; i++)
    {
      let subscription = subscriptions[i];
      let typeAddition = "";
      if (subscription.defaults)
        typeAddition = "/" + subscription.defaults.join("/");
      list.push("! [" + subscription.title + "]" + typeAddition);
      for (let j = 0; j < subscription.filters.length; j++)
      {
        let filter = subscription.filters[j];
        // Skip checksums
        if (filter instanceof CommentFilter && this.CHECKSUM_REGEXP.test(filter.text))
          continue;
        // Skip group headers
        if (filter instanceof CommentFilter && this.GROUPTITLE_REGEXP.test(filter.text))
          continue;
        list.push(filter.text);

        if (filter instanceof ElemHideException && Services.vc.compare(minVersion, "2.1") < 0)
          minVersion = "2.1";
      }
    }
    list.unshift("[Adblock Plus " + minVersion + "]");

    // Insert checksum. Have to add an empty line to the end of the list to
    // account for the trailing newline in the file.
    list.push("");
    let checksum = Utils.generateChecksum(list);
    list.pop();
    if (checksum)
      list.splice(1, 0, "! Checksum: " + checksum);

    function generator()
    {
      for (let i = 0; i < list.length; i++)
        yield list[i];
    }

    IO.writeToFile(file, true, generator(), function(e)
    {
      if (e)
      {
        Cu.reportError(e);
        Utils.alert(window, E("backupButton").getAttribute("_backupError"), E("backupButton").getAttribute("_backupDialogTitle"));
      }
    });
  }
};

window.addEventListener("load", function()
{
  Backup.init();
}, false);
