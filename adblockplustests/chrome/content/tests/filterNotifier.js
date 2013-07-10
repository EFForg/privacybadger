(function()
{
  module("Filter notifier", {setup: prepareFilterComponents, teardown: restoreFilterComponents});

  let triggeredListeners = [];
  let listeners = [
    function(action, item) triggeredListeners.push(["listener1", action, item]),
    function(action, item) triggeredListeners.push(["listener2", action, item]),
    function(action, item) triggeredListeners.push(["listener3", action, item])
  ];

  function compareListeners(test, list)
  {
    let result1 = triggeredListeners = [];
    FilterNotifier.triggerListeners("foo", {bar: true});

    let result2 = triggeredListeners = [];
    for each (let observer in list)
      observer("foo", {bar: true});

    deepEqual(result1, result2, test);
  }

  test("Adding/removing listeners", function()
  {
    let [listener1, listener2, listener3] = listeners;

    compareListeners("No listeners", []);

    FilterNotifier.addListener(listener1);
    compareListeners("addListener(listener1)", [listener1]);

    FilterNotifier.addListener(listener1);
    compareListeners("addListener(listener1) again", [listener1]);

    FilterNotifier.addListener(listener2);
    compareListeners("addListener(listener2)", [listener1, listener2]);

    FilterNotifier.removeListener(listener1);
    compareListeners("removeListener(listener1)", [listener2]);

    FilterNotifier.removeListener(listener1);
    compareListeners("removeListener(listener1) again", [listener2]);

    FilterNotifier.addListener(listener3);
    compareListeners("addListener(listener3)", [listener2, listener3]);

    FilterNotifier.addListener(listener1);
    compareListeners("addListener(listener1)", [listener2, listener3, listener1]);

    FilterNotifier.removeListener(listener3);
    compareListeners("removeListener(listener3)", [listener2, listener1]);

    FilterNotifier.removeListener(listener1);
    compareListeners("removeListener(listener1)", [listener2]);

    FilterNotifier.removeListener(listener2);
    compareListeners("removeListener(listener2)", []);
  });
})();
