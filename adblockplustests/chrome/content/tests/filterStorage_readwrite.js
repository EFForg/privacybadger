(function()
{
  module("Filter storage read/write", {
    setup: function()
    {
      prepareFilterComponents.call(this);
      preparePrefs.call(this);

      FilterStorage.addSubscription(Subscription.fromURL("~fl~"));
    },
    teardown: function()
    {
      restoreFilterComponents.call(this);
      restorePrefs.call(this);
    }
  });

  let {FileUtils} = Cu.import("resource://gre/modules/FileUtils.jsm", null);
  let {NetUtil} = Cu.import("resource://gre/modules/NetUtil.jsm", null);

  function loadFilters(file, callback)
  {
    let listener = function(action)
    {
      if (action == "load")
      {
        FilterNotifier.removeListener(listener);
        callback();
      }
    };
    FilterNotifier.addListener(listener);

    FilterStorage.loadFromDisk(file);
  }

  function saveFilters(file, callback)
  {
    let listener = function(action)
    {
      if (action == "save")
      {
        FilterNotifier.removeListener(listener);
        callback();
      }
    };
    FilterNotifier.addListener(listener);

    FilterStorage.saveToDisk(file);
  }

  function testReadWrite(withExternal)
  {
    let tempFile = FileUtils.getFile("TmpD", ["temp_patterns.ini"]);
    tempFile.createUnique(tempFile.NORMAL_FILE_TYPE, FileUtils.PERMS_FILE);
    readFile();

    function canonize(data)
    {
      let curSection = null;
      let sections = [];
      for each (let line in (data + "\n[end]").split(/[\r\n]+/))
      {
        if (/^\[.*\]$/.test(line))
        {
          if (curSection)
            sections.push(curSection);

          curSection = {header: line, data: []};
        }
        else if (curSection && /\S/.test(line))
          curSection.data.push(line);
      }
      for each (let section in sections)
      {
        section.key = section.header + " " + section.data[0];
        section.data.sort();
      }
      sections.sort(function(a, b)
      {
        if (a.key < b.key)
          return -1;
        else if (a.key > b.key)
          return 1;
        else
          return 0;
      });
      return sections.map(function(section) {
        return [section.header].concat(section.data).join("\n");
      }).join("\n");
    }

    function readFile()
    {
      let source = Services.io.newURI("data/patterns.ini", null, Services.io.newURI(window.location.href, null, null));
      loadFilters(source, saveFile);
    }

    function saveFile()
    {
      equal(FilterStorage.fileProperties.version, FilterStorage.formatVersion, "File format version");

      if (withExternal)
      {
        let {AdblockPlus} = Cu.import(Cc["@adblockplus.org/abp/public;1"].getService(Ci.nsIURI).spec, null);
        AdblockPlus.updateExternalSubscription("~external~external subscription ID", "External subscription", ["foo", "bar"]);

        let externalSubscriptions = FilterStorage.subscriptions.filter(function (subscription) subscription instanceof ExternalSubscription);
        equal(externalSubscriptions.length, 1, "Number of external subscriptions after updateExternalSubscription");

        if (externalSubscriptions.length == 1)
        {
          equal(externalSubscriptions[0].url, "~external~external subscription ID", "ID of external subscription");
          equal(externalSubscriptions[0].filters.length, 2, "Number of filters in external subscription");
        }
      }

      saveFilters(tempFile, compareFile);
    }

    function compareFile()
    {
      let stream = Cc["@mozilla.org/network/file-input-stream;1"].createInstance(Ci.nsIFileInputStream);
      stream.init(tempFile, FileUtils.MODE_RDONLY, FileUtils.PERMS_FILE, Ci.nsIFileInputStream.DEFER_OPEN);

      NetUtil.asyncFetch(stream, function(inputStream, nsresult)
      {
        let result = NetUtil.readInputStreamToString(inputStream, inputStream.available(), {charset: "utf-8"});

        let request = new XMLHttpRequest();
        request.open("GET", "data/patterns.ini");
        request.overrideMimeType("text/plain");
        request.addEventListener("load", function()
        {
          let expected = request.responseText;
          equal(canonize(result), canonize(expected), "Read/write result");

          tempFile.remove(false);
          start();
        }, false);
        request.send(null);
      });
    }
  }

  asyncTest("Read from URL, write to file", testReadWrite.bind(false));
  asyncTest("Read from URL, add external subscription, write to file", testReadWrite.bind(true));

  let groupTests = [
    ["~wl~", "whitelist"],
    ["~fl~", "blocking"],
    ["~eh~", "elemhide"]
  ];
  for (let i = 0; i < groupTests.length; i++)
  {
    let [url, defaults] = groupTests[i];
    asyncTest("Read empty legacy user-defined group (" + url + ")", function()
    {
      let data = "[Subscription]\nurl=" + url;
      let source = "data:text/plain;charset=utf-8," + encodeURIComponent(data);
      loadFilters(Services.io.newURI(source, null, null), function()
      {
        equal(FilterStorage.subscriptions.length, 0, "Number of filter subscriptions");
        start();
      });
    });
    asyncTest("Read non-empty legacy user-defined group (" + url + ")", function()
    {
      let data = "[Subscription]\nurl=" + url + "\n[Subscription filters]\nfoo";
      let source = "data:text/plain;charset=utf-8," + encodeURIComponent(data);
      loadFilters(Services.io.newURI(source, null, null), function()
      {
        equal(FilterStorage.subscriptions.length, 1, "Number of filter subscriptions");
        if (FilterStorage.subscriptions.length == 1)
        {
          let subscription = FilterStorage.subscriptions[0];
          equal(subscription.url, url, "Subscription ID");
          equal(subscription.title, Utils.getString(defaults + "Group_title"), "Subscription title");
          deepEqual(subscription.defaults, [defaults], "Default types");
          equal(subscription.filters.length, 1, "Number of subscription filters");
          if (subscription.filters.length == 1)
            equal(subscription.filters[0].text, "foo", "First filter");
        }
        start();
      });
    });
  }

  asyncTest("Read legacy user-defined filters", function()
  {
    let data = "[Subscription]\nurl=~user~1234\ntitle=Foo\n[Subscription filters]\n[User patterns]\nfoo\n\\[bar]\nfoo#bar";
    let source = "data:text/plain;charset=utf-8," + encodeURIComponent(data);
    loadFilters(Services.io.newURI(source, null, null), function()
    {
      equal(FilterStorage.subscriptions.length, 1, "Number of filter subscriptions");
      if (FilterStorage.subscriptions.length == 1)
      {
        let subscription = FilterStorage.subscriptions[0];
        equal(subscription.filters.length, 3, "Number of subscription filters");
        if (subscription.filters.length == 3)
        {
          equal(subscription.filters[0].text, "foo", "First filter");
          equal(subscription.filters[1].text, "[bar]", "Second filter");
          equal(subscription.filters[2].text, "foo#bar", "Third filter");
        }
      }
      start();
    });
  });

  asyncTest("Saving without backups", function()
  {
    Prefs.patternsbackups = 0;
    Prefs.patternsbackupinterval = 24;

    let tempFile = FileUtils.getFile("TmpD", ["temp_patterns.ini"]);
    tempFile.createUnique(tempFile.NORMAL_FILE_TYPE, FileUtils.PERMS_FILE);
    FilterStorage.__defineGetter__("sourceFile", function() tempFile.clone());

    saveFilters(null, function()
    {
      saveFilters(null, function()
      {
        let backupFile = tempFile.clone();
        backupFile.leafName = backupFile.leafName.replace(/\.ini$/, "-backup1.ini");
        ok(!backupFile.exists(), "Backup shouldn't be created");
        start();
      });
    });
  });

  asyncTest("Saving with backups", function()
  {
    Prefs.patternsbackups = 2;
    Prefs.patternsbackupinterval = 24;

    let tempFile = FileUtils.getFile("TmpD", ["temp_patterns.ini"]);
    tempFile.createUnique(tempFile.NORMAL_FILE_TYPE, FileUtils.PERMS_FILE);
    FilterStorage.__defineGetter__("sourceFile", function() tempFile.clone());

    let backupFile = tempFile.clone();
    backupFile.leafName = backupFile.leafName.replace(/\.ini$/, "-backup1.ini");

    let backupFile2 = tempFile.clone();
    backupFile2.leafName = backupFile2.leafName.replace(/\.ini$/, "-backup2.ini");

    let backupFile3 = tempFile.clone();
    backupFile3.leafName = backupFile3.leafName.replace(/\.ini$/, "-backup3.ini");

    let oldModifiedTime;

    saveFilters(null, callback1);

    function callback1()
    {
      // Save again immediately
      saveFilters(null, callback2);
    }

    function callback2()
    {
      backupFile = backupFile.clone();  // File parameters are cached, clone to prevent this
      ok(backupFile.exists(), "First backup created");

      backupFile.lastModifiedTime -= 10000;
      oldModifiedTime = backupFile.lastModifiedTime;
      saveFilters(null, callback3);
    }

    function callback3()
    {
      backupFile = backupFile.clone();  // File parameters are cached, clone to prevent this
      equal(backupFile.lastModifiedTime, oldModifiedTime, "Backup not overwritten if it is only 10 seconds old");

      backupFile.lastModifiedTime -= 40*60*60*1000;
      oldModifiedTime = backupFile.lastModifiedTime;
      saveFilters(null, callback4);
    }

    function callback4()
    {
      backupFile = backupFile.clone();  // File parameters are cached, clone to prevent this
      notEqual(backupFile.lastModifiedTime, oldModifiedTime, "Backup overwritten if it is 40 hours old");

      backupFile2 = backupFile2.clone();  // File parameters are cached, clone to prevent this
      ok(backupFile2.exists(), "Second backup created when first backup is overwritten");

      backupFile.lastModifiedTime -= 20000;
      oldModifiedTime = backupFile2.lastModifiedTime;
      saveFilters(null, callback5);
    }

    function callback5()
    {
      backupFile2 = backupFile2.clone();  // File parameters are cached, clone to prevent this
      equal(backupFile2.lastModifiedTime, oldModifiedTime, "Second backup not overwritten if first one is only 20 seconds old");

      backupFile.lastModifiedTime -= 25*60*60*1000;
      oldModifiedTime = backupFile2.lastModifiedTime;
      saveFilters(null, callback6);
    }

    function callback6()
    {
      backupFile2 = backupFile2.clone();  // File parameters are cached, clone to prevent this
      notEqual(backupFile2.lastModifiedTime, oldModifiedTime, "Second backup overwritten if first one is 25 hours old");

      ok(!backupFile3.exists(), "Third backup not created with patternsbackups = 2");

      try
      {
        tempFile.remove(false);
      } catch (e) {}
      try
      {
        backupFile.remove(false);
      } catch (e) {}
      try
      {
        backupFile2.remove(false);
      } catch (e) {}
      try
      {
        backupFile3.remove(false);
      } catch (e) {}

      start();
    }
  });
})();
