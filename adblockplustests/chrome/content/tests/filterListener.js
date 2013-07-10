(function()
{
  module("Filter listener", {
    setup: function()
    {
      prepareFilterComponents.call(this, true);
      preparePrefs.call(this);

      FilterStorage.addSubscription(Subscription.fromURL("~fl~"));
      FilterStorage.addSubscription(Subscription.fromURL("~wl~"));
      FilterStorage.addSubscription(Subscription.fromURL("~eh~"));

      Subscription.fromURL("~fl~").defaults = ["blocking"];
      Subscription.fromURL("~wl~").defaults = ["whitelist"];
      Subscription.fromURL("~eh~").defaults = ["elemhide"];
    },
    teardown: function()
    {
      restoreFilterComponents.call(this);
      restorePrefs.call(this);
    }
  });

  function checkKnownFilters(text, expected)
  {
    let result = {};
    for each (let type in ["blacklist", "whitelist"])
    {
      let matcher = defaultMatcher[type]
      let filters = [];
      for (let keyword in matcher.filterByKeyword)
      {
        let list = matcher.filterByKeyword[keyword];
        for (let i = 0; i < list.length; i++)
        {
          let filter = list[i];
          equal(matcher.getKeywordForFilter(filter), keyword, "Keyword of filter " + filter.text);
          filters.push(filter.text);
        }
      }
      result[type] = filters;
    }

    let ElemHideGlobal = getModuleGlobal("elemHide");
    result.elemhide = [];
    for (let key in ElemHideGlobal.filterByKey)
      result.elemhide.push(ElemHideGlobal.filterByKey[key].text);

    result.elemhideexception = [];
    for (let selector in ElemHideGlobal.exceptions)
    {
      let list = ElemHideGlobal.exceptions[selector];
      for (let i = 0; i < list.length; i++)
        result.elemhideexception.push(list[i].text);
    }

    for each (let type in ["blacklist", "whitelist", "elemhide", "elemhideexception"])
      if (!(type in expected))
        expected[type] = [];

    deepEqual(result, expected, text);
  }

  test("Adding and removing filters", function()
  {
    let filter1 = Filter.fromText("filter1");
    let filter2 = Filter.fromText("@@filter2");
    let filter3 = Filter.fromText("#filter3");
    let filter4 = Filter.fromText("!filter4");
    let filter5 = Filter.fromText("#@#filter5");

    FilterStorage.addFilter(filter1);
    checkKnownFilters("add filter1", {blacklist: [filter1.text]});
    FilterStorage.addFilter(filter2);
    checkKnownFilters("add @@filter2", {blacklist: [filter1.text], whitelist: [filter2.text]});
    FilterStorage.addFilter(filter3);
    checkKnownFilters("add #filter3", {blacklist: [filter1.text], whitelist: [filter2.text], elemhide: [filter3.text]});
    FilterStorage.addFilter(filter4);
    checkKnownFilters("add !filter4", {blacklist: [filter1.text], whitelist: [filter2.text], elemhide: [filter3.text]});
    FilterStorage.addFilter(filter5);
    checkKnownFilters("add #@#filter5", {blacklist: [filter1.text], whitelist: [filter2.text], elemhide: [filter3.text], elemhideexception: [filter5.text]});

    FilterStorage.removeFilter(filter1);
    checkKnownFilters("remove filter1", {whitelist: [filter2.text], elemhide: [filter3.text], elemhideexception: [filter5.text]});
    filter2.disabled = true;
    checkKnownFilters("disable filter2", {elemhide: [filter3.text], elemhideexception: [filter5.text]});
    FilterStorage.removeFilter(filter2);
    checkKnownFilters("remove filter2", {elemhide: [filter3.text], elemhideexception: [filter5.text]});
    FilterStorage.removeFilter(filter4);
    checkKnownFilters("remove filter4", {elemhide: [filter3.text], elemhideexception: [filter5.text]});
  });

  test("Disabling/enabling filters not in the list", function()
  {
    let filter1 = Filter.fromText("filter1");
    let filter2 = Filter.fromText("@@filter2");
    let filter3 = Filter.fromText("#filter3");
    let filter4 = Filter.fromText("#@#filter4");

    filter1.disabled = true;
    checkKnownFilters("disable filter1 while not in list", {});
    filter1.disabled = false;
    checkKnownFilters("enable filter1 while not in list", {});

    filter2.disabled = true;
    checkKnownFilters("disable @@filter2 while not in list", {});
    filter2.disabled = false;
    checkKnownFilters("enable @@filter2 while not in list", {});

    filter3.disabled = true;
    checkKnownFilters("disable #filter3 while not in list", {});
    filter3.disabled = false;
    checkKnownFilters("enable #filter3 while not in list", {});

    filter4.disabled = true;
    checkKnownFilters("disable #@#filter4 while not in list", {});
    filter4.disabled = false;
    checkKnownFilters("enable #@#filter4 while not in list", {});
  });

  test("Filter subscription operations", function()
  {
    let filter1 = Filter.fromText("filter1");
    let filter2 = Filter.fromText("@@filter2");
    filter2.disabled = true;
    let filter3 = Filter.fromText("#filter3");
    let filter4 = Filter.fromText("!filter4");
    let filter5 = Filter.fromText("#@#filter5");

    let subscription = Subscription.fromURL("http://test1/");
    subscription.filters = [filter1, filter2, filter3, filter4, filter5];

    FilterStorage.addSubscription(subscription);
    checkKnownFilters("add subscription with filter1, @@filter2, #filter3, !filter4, #@#filter5", {blacklist: [filter1.text], elemhide: [filter3.text], elemhideexception: [filter5.text]});

    filter2.disabled = false;
    checkKnownFilters("enable @@filter2", {blacklist: [filter1.text], whitelist: [filter2.text], elemhide: [filter3.text], elemhideexception: [filter5.text]});

    FilterStorage.addFilter(filter1);
    checkKnownFilters("add filter1", {blacklist: [filter1.text], whitelist: [filter2.text], elemhide: [filter3.text], elemhideexception: [filter5.text]});

    FilterStorage.updateSubscriptionFilters(subscription, [filter4]);
    checkKnownFilters("change subscription filters to filter4", {blacklist: [filter1.text]});

    FilterStorage.removeFilter(filter1);
    checkKnownFilters("remove filter1", {});

    FilterStorage.updateSubscriptionFilters(subscription, [filter1, filter2]);
    checkKnownFilters("change subscription filters to filter1, filter2", {blacklist: [filter1.text], whitelist: [filter2.text]});

    filter1.disabled = true;
    checkKnownFilters("disable filter1", {whitelist: [filter2.text]});
    filter2.disabled = true;
    checkKnownFilters("disable filter2", {});
    filter1.disabled = false;
    filter2.disabled = false;
    checkKnownFilters("enable filter1, filter2", {blacklist: [filter1.text], whitelist: [filter2.text]});

    FilterStorage.addFilter(filter1);
    checkKnownFilters("add filter1", {blacklist: [filter1.text], whitelist: [filter2.text]});

    subscription.disabled = true;
    checkKnownFilters("disable subscription", {blacklist: [filter1.text]});

    FilterStorage.removeSubscription(subscription);
    checkKnownFilters("remove subscription", {blacklist: [filter1.text]});

    FilterStorage.addSubscription(subscription);
    checkKnownFilters("add subscription", {blacklist: [filter1.text]});

    subscription.disabled = false;
    checkKnownFilters("enable subscription", {blacklist: [filter1.text], whitelist: [filter2.text]});

    subscription.disabled = true;
    checkKnownFilters("disable subscription", {blacklist: [filter1.text]});

    FilterStorage.addFilter(filter2);
    checkKnownFilters("add filter2", {blacklist: [filter1.text], whitelist: [filter2.text]});

    FilterStorage.removeFilter(filter2);
    checkKnownFilters("remove filter2", {blacklist: [filter1.text]});

    subscription.disabled = false;
    checkKnownFilters("enable subscription", {blacklist: [filter1.text], whitelist: [filter2.text]});

    FilterStorage.removeSubscription(subscription);
    checkKnownFilters("remove subscription", {blacklist: [filter1.text]});
  });

  test("Filter group operations", function()
  {
    let filter1 = Filter.fromText("filter1");
    let filter2 = Filter.fromText("@@filter2");
    let filter3 = Filter.fromText("filter3");
    let filter4 = Filter.fromText("@@filter4");
    let filter5 = Filter.fromText("!filter5");

    let subscription = Subscription.fromURL("http://test1/");
    subscription.filters = [filter1, filter2];

    FilterStorage.addSubscription(subscription);
    FilterStorage.addFilter(filter1);
    checkKnownFilters("initial setup", {blacklist: [filter1.text], whitelist: [filter2.text]});

    let subscription2 = Subscription.fromURL("~fl~");
    subscription2.disabled = true;
    checkKnownFilters("disable blocking filters", {blacklist: [filter1.text], whitelist: [filter2.text]});

    FilterStorage.removeSubscription(subscription);
    checkKnownFilters("remove subscription", {});

    subscription2.disabled = false;
    checkKnownFilters("enable blocking filters", {blacklist: [filter1.text]});

    let subscription3 = Subscription.fromURL("~wl~");
    subscription3.disabled = true;
    checkKnownFilters("disable exception rules", {blacklist: [filter1.text]});

    FilterStorage.addFilter(filter2);
    checkKnownFilters("add @@filter2", {blacklist: [filter1.text], whitelist: [filter2.text]});
    equal(filter2.subscriptions.length, 1, "@@filter2.subscription.length");
    ok(filter2.subscriptions[0] instanceof SpecialSubscription, "@@filter2 added to a new filter group");
    ok(filter2.subscriptions[0] != subscription3, "@@filter2 filter group is not the disabled exceptions group");

    subscription3.disabled = false;
    checkKnownFilters("enable exception rules", {blacklist: [filter1.text], whitelist: [filter2.text]});

    FilterStorage.removeFilter(filter2);
    FilterStorage.addFilter(filter2);
    checkKnownFilters("re-add @@filter2", {blacklist: [filter1.text], whitelist: [filter2.text]});
    equal(filter2.subscriptions.length, 1, "@@filter2.subscription.length");
    ok(filter2.subscriptions[0] == subscription3, "@@filter2 added to the default exceptions group");

    let subscription4 = Subscription.fromURL("http://test/");
    FilterStorage.updateSubscriptionFilters(subscription4, [filter3, filter4, filter5]);
    checkKnownFilters("update subscription not in the list yet", {blacklist: [filter1.text], whitelist: [filter2.text]});

    FilterStorage.addSubscription(subscription4);
    checkKnownFilters("add subscription to the list", {blacklist: [filter1.text, filter3.text], whitelist: [filter2.text, filter4.text]});

    FilterStorage.updateSubscriptionFilters(subscription4, [filter3, filter2, filter5]);
    checkKnownFilters("update subscription while in the list", {blacklist: [filter1.text, filter3.text], whitelist: [filter2.text]});

    subscription3.disabled = true;
    checkKnownFilters("disable exception rules", {blacklist: [filter1.text, filter3.text], whitelist: [filter2.text]});

    FilterStorage.removeSubscription(subscription4);
    checkKnownFilters("remove subscription from the list", {blacklist: [filter1.text]});

    subscription3.disabled = false;
    checkKnownFilters("enable exception rules", {blacklist: [filter1.text], whitelist: [filter2.text]});
  });
})();
