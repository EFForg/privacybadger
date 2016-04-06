/*globals test, module, ok, asyncTest, expect, setTimeout, localStorage, start*/
(function() {
  module("Privacy Badger Storage");

  var BadgerStore = require('storage');
  BadgerStore.initialize();

  test("testGetBadgerStorage", function(){
    var action_map = BadgerStore.getBadgerStorageObject('action_map');
    ok(action_map.getSerialized instanceof Function, "action_map is a pbstorage");
    var foo_map = BadgerStore.getBadgerStorageObject('foo_map');
    ok(foo_map.getSerialized instanceof Function, "foo_map is an instance of pbstorage");
  });

  test("test BadgerStorage methods", function(){
    var action_map = BadgerStore.getBadgerStorageObject('action_map');
    action_map.setItem('foo', 'bar');
    ok(action_map.getItem('foo') === 'bar');
    ok(action_map.hasItem('foo'));
    action_map.deleteItem('foo'); 
    ok(!action_map.hasItem('foo'));
  });

  asyncTest("send xhrRequest", function(){
    expect(1); //expect 1 assertion
    var action_map = BadgerStore.getBadgerStorageObject('action_map');
    action_map.setItem('foo', 'bar');
    setTimeout(function(){
      var data = JSON.parse(localStorage.getItem('action_map'));
      ok(data.foo == 'bar', "xhr calls callback");
      start();
    }, 500);
  });
})();
