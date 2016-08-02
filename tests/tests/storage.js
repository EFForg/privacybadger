/*globals test, module, ok, asyncTest, expect*/
(function() {
  module("Privacy Badger Storage");

  var BadgerStore = require('storage');
  BadgerStore.BadgerPen(true, function(){
  
    test("testGetBadgerStorage", function(){
      expect(1);
      var action_map = pb.storage.getBadgerStorageObject('action_map');
      ok(action_map.updateObject instanceof Function, "action_map is a pbstorage");
    });

    test("test BadgerStorage methods", function(){
      expect(3);
      var action_map = pb.storage.getBadgerStorageObject('action_map');
      action_map.setItem('foo', 'bar');
      ok(action_map.getItem('foo') === 'bar');
      ok(action_map.hasItem('foo'));
      action_map.deleteItem('foo'); 
      ok(!action_map.hasItem('foo'));
    });

    test("data presists to local storage", function(){
      // TODO: Figure out how to test this. 
      expect(1); //expect 1 assertion
      /*var action_map = BadgerStore.getBadgerStorageObject('action_map');
      action_map.setItem('foo', 'bar');
      setTimeout(function(){
        var data = JSON.parse(localStorage.getItem('action_map'));
        ok(data.foo == 'bar', "data presists to local storage");
        start();
      }, 500);*/
      ok(true);
    });
  });
})();
