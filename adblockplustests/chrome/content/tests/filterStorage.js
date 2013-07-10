(function()
{
  module("Filter storage", {
    setup: function()
    {
      prepareFilterComponents.call(this);
      preparePrefs.call(this);
      Prefs.savestats = true;
    },
    teardown: function()
    {
      restoreFilterComponents.call(this);
      restorePrefs.call(this);
    }
  });

  function compareSubscriptionList(test, list)
  {
    let result = FilterStorage.subscriptions.map(function(subscription) {return subscription.url});
    let expected = list.map(function(subscription) {return subscription.url});
    deepEqual(result, expected, test);
  }

  function compareFiltersList(test, list)
  {
    let result = FilterStorage.subscriptions.map(function(subscription) {return subscription.filters.map(function(filter) {return filter.text})});
    deepEqual(result, list, test);
  }

  function compareFilterSubscriptions(test, filter, list)
  {
    let result = filter.subscriptions.map(function(subscription) {return subscription.url});
    let expected = list.map(function(subscription) {return subscription.url});
    deepEqual(result, expected, test);
  }

  test("Adding subscriptions", function()
  {
    let subscription1 = Subscription.fromURL("http://test1/");
    let subscription2 = Subscription.fromURL("http://test2/");

    let changes = [];
    function listener(action, subscription)
    {
      changes.push(action + " " + subscription.url);
    }
    FilterNotifier.addListener(listener);

    compareSubscriptionList("Initial state", []);
    deepEqual(changes, [], "Received changes");

    changes = [];
    FilterStorage.addSubscription(subscription1);
    compareSubscriptionList("Regular add", [subscription1]);
    deepEqual(changes, ["subscription.added http://test1/"], "Received changes");

    changes = [];
    FilterStorage.addSubscription(subscription1);
    compareSubscriptionList("Adding already added subscription", [subscription1]);
    deepEqual(changes, [], "Received changes");

    changes = [];
    FilterStorage.addSubscription(subscription2, true);
    compareSubscriptionList("Silent add", [subscription1, subscription2]);
    deepEqual(changes, [], "Received changes");

    FilterStorage.removeSubscription(subscription1);
    compareSubscriptionList("Remove", [subscription2]);

    changes = [];
    FilterStorage.addSubscription(subscription1);
    compareSubscriptionList("Re-adding previously removed subscription", [subscription2, subscription1]);
    deepEqual(changes, ["subscription.added http://test1/"], "Received changes");
  });

  test("Removing subscriptions", function()
  {
    let subscription1 = Subscription.fromURL("http://test1/");
    let subscription2 = Subscription.fromURL("http://test2/");
    FilterStorage.addSubscription(subscription1);
    FilterStorage.addSubscription(subscription2);

    let changes = [];
    function listener(action, subscription)
    {
      changes.push(action + " " + subscription.url);
    }
    FilterNotifier.addListener(listener);

    compareSubscriptionList("Initial state", [subscription1, subscription2]);
    deepEqual(changes, [], "Received changes");

    changes = [];
    FilterStorage.removeSubscription(subscription1);
    compareSubscriptionList("Regular remove", [subscription2]);
    deepEqual(changes, ["subscription.removed http://test1/"], "Received changes");

    changes = [];
    FilterStorage.removeSubscription(subscription1);
    compareSubscriptionList("Removing already removed subscription", [subscription2]);
    deepEqual(changes, [], "Received changes");

    changes = [];
    FilterStorage.removeSubscription(subscription2, true);
    compareSubscriptionList("Silent remove", []);
    deepEqual(changes, [], "Received changes");

    FilterStorage.addSubscription(subscription1);
    compareSubscriptionList("Add", [subscription1]);

    changes = [];
    FilterStorage.removeSubscription(subscription1);
    compareSubscriptionList("Re-removing previously added subscription", []);
    deepEqual(changes, ["subscription.removed http://test1/"], "Received changes");
  });

  test("Moving subscriptions", function()
  {
    let subscription1 = Subscription.fromURL("http://test1/");
    let subscription2 = Subscription.fromURL("http://test2/");
    let subscription3 = Subscription.fromURL("http://test3/");

    FilterStorage.addSubscription(subscription1);
    FilterStorage.addSubscription(subscription2);
    FilterStorage.addSubscription(subscription3);

    let changes = [];
    function listener(action, subscription)
    {
      changes.push(action + " " + subscription.url);
    }
    FilterNotifier.addListener(listener);

    compareSubscriptionList("Initial state", [subscription1, subscription2, subscription3]);
    deepEqual(changes, [], "Received changes");

    changes = [];
    FilterStorage.moveSubscription(subscription1);
    compareSubscriptionList("Move without explicit position", [subscription2, subscription3, subscription1]);
    deepEqual(changes, ["subscription.moved http://test1/"], "Received changes");

    changes = [];
    FilterStorage.moveSubscription(subscription1);
    compareSubscriptionList("Move without explicit position (subscription already last)", [subscription2, subscription3, subscription1]);
    deepEqual(changes, [], "Received changes");

    changes = [];
    FilterStorage.moveSubscription(subscription2, subscription1);
    compareSubscriptionList("Move with explicit position", [subscription3, subscription2, subscription1]);
    deepEqual(changes, ["subscription.moved http://test2/"], "Received changes");

    changes = [];
    FilterStorage.moveSubscription(subscription3, subscription2);
    compareSubscriptionList("Move without explicit position (subscription already at position)", [subscription3, subscription2, subscription1]);
    deepEqual(changes, [], "Received changes");

    FilterStorage.removeSubscription(subscription2);
    compareSubscriptionList("Remove", [subscription3, subscription1]);

    changes = [];
    FilterStorage.moveSubscription(subscription3, subscription2);
    compareSubscriptionList("Move before removed subscription", [subscription1, subscription3]);
    deepEqual(changes, ["subscription.moved http://test3/"], "Received changes");

    changes = [];
    FilterStorage.moveSubscription(subscription2);
    compareSubscriptionList("Move of removed subscription", [subscription1, subscription3]);
    deepEqual(changes, [], "Received changes");
  });

  test("Adding filters", function()
  {
    let subscription1 = Subscription.fromURL("~blocking");
    subscription1.defaults = ["blocking"];

    let subscription2 = Subscription.fromURL("~exceptions");
    subscription2.defaults = ["whitelist", "elemhide"];

    let subscription3 = Subscription.fromURL("~other");

    FilterStorage.addSubscription(subscription1);
    FilterStorage.addSubscription(subscription2);
    FilterStorage.addSubscription(subscription3);

    let changes = [];
    function listener(action, filter)
    {
      changes.push(action + " " + filter.text);
    }
    FilterNotifier.addListener(listener);

    compareFiltersList("Initial state", [[], [], []]);
    deepEqual(changes, [], "Received changes");

    changes = [];
    FilterStorage.addFilter(Filter.fromText("foo"));
    compareFiltersList("Adding blocking filter", [["foo"], [], []]);
    deepEqual(changes, ["filter.added foo"], "Received changes");

    changes = [];
    FilterStorage.addFilter(Filter.fromText("@@bar"));
    compareFiltersList("Adding exception rule", [["foo"], ["@@bar"], []]);
    deepEqual(changes, ["filter.added @@bar"], "Received changes");

    changes = [];
    FilterStorage.addFilter(Filter.fromText("foo#bar"));
    compareFiltersList("Adding hiding rule", [["foo"], ["@@bar", "foo#bar"], []]);
    deepEqual(changes, ["filter.added foo#bar"], "Received changes");

    changes = [];
    FilterStorage.addFilter(Filter.fromText("foo#@#bar"));
    compareFiltersList("Adding hiding exception", [["foo"], ["@@bar", "foo#bar", "foo#@#bar"], []]);
    deepEqual(changes, ["filter.added foo#@#bar"], "Received changes");

    changes = [];
    FilterStorage.addFilter(Filter.fromText("!foobar"), undefined, undefined, true);
    compareFiltersList("Adding comment silent", [["foo"], ["@@bar", "foo#bar", "foo#@#bar"], ["!foobar"]]);
    deepEqual(changes, [], "Received changes");

    changes = [];
    FilterStorage.addFilter(Filter.fromText("foo"));
    compareFiltersList("Adding already added filter", [["foo"], ["@@bar", "foo#bar", "foo#@#bar"], ["!foobar"]]);
    deepEqual(changes, [], "Received changes");

    subscription1.disabled = true;

    changes = [];
    FilterStorage.addFilter(Filter.fromText("foo"));
    compareFiltersList("Adding filter already in a disabled subscription", [["foo"], ["@@bar", "foo#bar", "foo#@#bar"], ["!foobar", "foo"]]);
    deepEqual(changes, ["filter.added foo"], "Received changes");

    changes = [];
    FilterStorage.addFilter(Filter.fromText("foo"), subscription1);
    compareFiltersList("Adding filter to an explicit subscription", [["foo", "foo"], ["@@bar", "foo#bar", "foo#@#bar"], ["!foobar", "foo"]]);
    deepEqual(changes, ["filter.added foo"], "Received changes");

    changes = [];
    FilterStorage.addFilter(Filter.fromText("!foobar"), subscription2, 0);
    compareFiltersList("Adding filter to an explicit subscription with position", [["foo", "foo"], ["!foobar", "@@bar", "foo#bar", "foo#@#bar"], ["!foobar", "foo"]]);
    deepEqual(changes, ["filter.added !foobar"], "Received changes");
  });

  test("Removing filters", function()
  {
    let subscription1 = Subscription.fromURL("~foo");
    subscription1.filters = [Filter.fromText("foo"), Filter.fromText("foo"), Filter.fromText("bar")];

    let subscription2 = Subscription.fromURL("~bar");
    subscription2.filters = [Filter.fromText("foo"), Filter.fromText("bar"), Filter.fromText("foo")];

    let subscription3 = Subscription.fromURL("http://test/");
    subscription3.filters = [Filter.fromText("foo"), Filter.fromText("bar")];

    FilterStorage.addSubscription(subscription1);
    FilterStorage.addSubscription(subscription2);
    FilterStorage.addSubscription(subscription3);

    let changes = [];
    function listener(action, filter)
    {
      changes.push(action + " " + filter.text);
    }
    FilterNotifier.addListener(listener);

    compareFiltersList("Initial state", [["foo", "foo", "bar"], ["foo", "bar", "foo"], ["foo", "bar"]]);
    deepEqual(changes, [], "Received changes");

    changes = [];
    FilterStorage.removeFilter(Filter.fromText("foo"), subscription2, 0);
    compareFiltersList("Remove with explicit subscription and position", [["foo", "foo", "bar"], ["bar", "foo"], ["foo", "bar"]]);
    deepEqual(changes, ["filter.removed foo"], "Received changes");

    changes = [];
    FilterStorage.removeFilter(Filter.fromText("foo"), subscription2, 0);
    compareFiltersList("Remove with explicit subscription and wrong position", [["foo", "foo", "bar"], ["bar", "foo"], ["foo", "bar"]]);
    deepEqual(changes, [], "Received changes");

    changes = [];
    FilterStorage.removeFilter(Filter.fromText("foo"), subscription1);
    compareFiltersList("Remove with explicit subscription", [["bar"], ["bar", "foo"], ["foo", "bar"]]);
    deepEqual(changes, ["filter.removed foo", "filter.removed foo"], "Received changes");

    changes = [];
    FilterStorage.removeFilter(Filter.fromText("foo"), subscription1);
    compareFiltersList("Remove from subscription not having the filter", [["bar"], ["bar", "foo"], ["foo", "bar"]]);
    deepEqual(changes, [], "Received changes");

    changes = [];
    FilterStorage.removeFilter(Filter.fromText("bar"));
    compareFiltersList("Remove everywhere", [[], ["foo"], ["foo", "bar"]]);
    deepEqual(changes, ["filter.removed bar", "filter.removed bar"], "Received changes");

    changes = [];
    FilterStorage.removeFilter(Filter.fromText("bar"));
    compareFiltersList("Remove of unknown filter", [[], ["foo"], ["foo", "bar"]]);
    deepEqual(changes, [], "Received changes");
  });

  test("Moving filters", function()
  {
    let subscription1 = Subscription.fromURL("~foo");
    subscription1.filters = [Filter.fromText("foo"), Filter.fromText("bar"), Filter.fromText("bas"), Filter.fromText("foo")];

    let subscription2 = Subscription.fromURL("http://test/");
    subscription2.filters = [Filter.fromText("foo"), Filter.fromText("bar")];

    FilterStorage.addSubscription(subscription1);
    FilterStorage.addSubscription(subscription2);

    let changes = [];
    function listener(action, filter)
    {
      changes.push(action + " " + filter.text);
    }
    FilterNotifier.addListener(listener);

    compareFiltersList("Initial state", [["foo", "bar", "bas", "foo"], ["foo", "bar"]]);
    deepEqual(changes, [], "Received changes");

    changes = [];
    FilterStorage.moveFilter(Filter.fromText("foo"), subscription1, 0, 1);
    compareFiltersList("Regular move", [["bar", "foo", "bas", "foo"], ["foo", "bar"]]);
    deepEqual(changes, ["filter.moved foo"], "Received changes");

    changes = [];
    FilterStorage.moveFilter(Filter.fromText("foo"), subscription1, 0, 3);
    compareFiltersList("Invalid move", [["bar", "foo", "bas", "foo"], ["foo", "bar"]]);
    deepEqual(changes, [], "Received changes");

    changes = [];
    FilterStorage.moveFilter(Filter.fromText("foo"), subscription2, 0, 1);
    compareFiltersList("Invalid subscription", [["bar", "foo", "bas", "foo"], ["foo", "bar"]]);
    deepEqual(changes, [], "Received changes");

    changes = [];
    FilterStorage.moveFilter(Filter.fromText("foo"), subscription1, 1, 1);
    compareFiltersList("Move to current position", [["bar", "foo", "bas", "foo"], ["foo", "bar"]]);
    deepEqual(changes, [], "Received changes");

    changes = [];
    FilterStorage.moveFilter(Filter.fromText("bar"), subscription1, 0, 1);
    compareFiltersList("Regular move", [["foo", "bar", "bas", "foo"], ["foo", "bar"]]);
    deepEqual(changes, ["filter.moved bar"], "Received changes");
  });

  test("Hit counts", function()
  {
    let changes = [];
    function listener(action, filter)
    {
      changes.push(action + " " + filter.text);
    }
    FilterNotifier.addListener(listener);

    let filter1 = Filter.fromText("filter1");
    let filter2 = Filter.fromText("filter2");

    FilterStorage.addFilter(filter1);

    equal(filter1.hitCount, 0, "filter1 initial hit count");
    equal(filter2.hitCount, 0, "filter2 initial hit count");
    equal(filter1.lastHit, 0, "filter1 initial last hit");
    equal(filter2.lastHit, 0, "filter2 initial last hit");

    let changes = [];
    FilterStorage.increaseHitCount(filter1);
    equal(filter1.hitCount, 1, "Hit count after increase (filter in list)");
    ok(filter1.lastHit > 0, "Last hit changed after increase");
    deepEqual(changes, ["filter.hitCount filter1", "filter.lastHit filter1"], "Received changes");

    let changes = [];
    FilterStorage.increaseHitCount(filter2);
    equal(filter2.hitCount, 1, "Hit count after increase (filter not in list)");
    ok(filter2.lastHit > 0, "Last hit changed after increase");
    deepEqual(changes, ["filter.hitCount filter2", "filter.lastHit filter2"], "Received changes");

    let changes = [];
    FilterStorage.resetHitCounts([filter1]);
    equal(filter1.hitCount, 0, "Hit count after reset");
    equal(filter1.lastHit, 0, "Last hit after reset");
    deepEqual(changes, ["filter.hitCount filter1", "filter.lastHit filter1"], "Received changes");

    let changes = [];
    FilterStorage.resetHitCounts(null);
    equal(filter2.hitCount, 0, "Hit count after complete reset");
    equal(filter2.lastHit, 0, "Last hit after complete reset");
    deepEqual(changes, ["filter.hitCount filter2", "filter.lastHit filter2"], "Received changes");
  });

  test("Filter/subscription relationship", function()
  {
    let filter1 = Filter.fromText("filter1");
    let filter2 = Filter.fromText("filter2");
    let filter3 = Filter.fromText("filter3");

    let subscription1 = Subscription.fromURL("http://test1/");
    subscription1.filters = [filter1, filter2];

    let subscription2 = Subscription.fromURL("http://test2/");
    subscription2.filters = [filter2, filter3];

    let subscription3 = Subscription.fromURL("http://test3/");
    subscription3.filters = [filter1, filter2, filter3];

    compareFilterSubscriptions("Initial filter1 subscriptions", filter1, []);
    compareFilterSubscriptions("Initial filter2 subscriptions", filter2, []);
    compareFilterSubscriptions("Initial filter3 subscriptions", filter3, []);

    FilterStorage.addSubscription(subscription1);

    compareFilterSubscriptions("filter1 subscriptions after adding http://test1/", filter1, [subscription1]);
    compareFilterSubscriptions("filter2 subscriptions after adding http://test1/", filter2, [subscription1]);
    compareFilterSubscriptions("filter3 subscriptions after adding http://test1/", filter3, []);

    FilterStorage.addSubscription(subscription2);

    compareFilterSubscriptions("filter1 subscriptions after adding http://test2/", filter1, [subscription1]);
    compareFilterSubscriptions("filter2 subscriptions after adding http://test2/", filter2, [subscription1, subscription2]);
    compareFilterSubscriptions("filter3 subscriptions after adding http://test2/", filter3, [subscription2]);

    FilterStorage.removeSubscription(subscription1);

    compareFilterSubscriptions("filter1 subscriptions after removing http://test1/", filter1, []);
    compareFilterSubscriptions("filter2 subscriptions after removing http://test1/", filter2, [subscription2]);
    compareFilterSubscriptions("filter3 subscriptions after removing http://test1/", filter3, [subscription2]);

    FilterStorage.updateSubscriptionFilters(subscription3, [filter3]);

    compareFilterSubscriptions("filter1 subscriptions after updating http://test3/ filters", filter1, []);
    compareFilterSubscriptions("filter2 subscriptions after updating http://test3/ filters", filter2, [subscription2]);
    compareFilterSubscriptions("filter3 subscriptions after updating http://test3/ filters", filter3, [subscription2]);

    FilterStorage.addSubscription(subscription3);

    compareFilterSubscriptions("filter1 subscriptions after adding http://test3/", filter1, []);
    compareFilterSubscriptions("filter2 subscriptions after adding http://test3/", filter2, [subscription2]);
    compareFilterSubscriptions("filter3 subscriptions after adding http://test3/", filter3, [subscription2, subscription3]);

    FilterStorage.updateSubscriptionFilters(subscription3, [filter1, filter2]);

    compareFilterSubscriptions("filter1 subscriptions after updating http://test3/ filters", filter1, [subscription3]);
    compareFilterSubscriptions("filter2 subscriptions after updating http://test3/ filters", filter2, [subscription2, subscription3]);
    compareFilterSubscriptions("filter3 subscriptions after updating http://test3/ filters", filter3, [subscription2]);

    FilterStorage.removeSubscription(subscription3);

    compareFilterSubscriptions("filter1 subscriptions after removing http://test3/", filter1, []);
    compareFilterSubscriptions("filter2 subscriptions after removing http://test3/", filter2, [subscription2]);
    compareFilterSubscriptions("filter3 subscriptions after removing http://test3/", filter3, [subscription2]);
  });
})();
