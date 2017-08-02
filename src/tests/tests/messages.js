(function() {
  let messages = require('messages'),
    methods = new Set([
      'base.method',
      'base.another.thing',
      'base.even.longer.stuff',
    ]),
    beforeSendMessage = chrome.runtime.sendMessage;

  QUnit.module("Messages", {
    before: () => {
      // dummy sendMessage func
      chrome.runtime.sendMessage = function (messageObject, responseCallback) {
        responseCallback(messageObject);
      };
    },
    after: () => {
      chrome.runtime.sendMessage = beforeSendMessage;
    },
  });

  QUnit.test('Client test', (assert) => {
    let done = assert.async(2);
    assert.expect(12);


    let client = new messages.Client(methods);

    // assert methods are added to client
    assert.ok('method' in client);
    assert.ok('another' in client);
    assert.ok('stuff' in client.even.longer);

    client.method('foo', 'bar').then(obj => {
      assert.ok(obj.method === 'base.method');
      assert.ok(obj.args[0] == 'foo');
      assert.ok(obj.args[1] == 'bar');
      assert.ok(obj.args.length == 2);

      done();
    });

    client.another.thing(1, 2, 3).then(obj => {
      assert.ok(obj.method === 'base.another.thing');
      assert.ok(obj.args[0] == 1);
      assert.ok(obj.args[1] == 2);
      assert.ok(obj.args[2] == 3);
      assert.ok(obj.args.length == 3);

      done();
    });

    // test callback
    client.even.longer.stuff(1, 2, res => {
      res.callbackCalled = true;
      return res;
    }).then(obj => {
      assert.ok(obj.method === 'base.even.longer.stuff');
      assert.ok(obj.args[0] == 1);
      assert.ok(obj.args[1] == 2);
      assert.ok(obj.args.length == 2);
      assert.ok(obj.callbackCalled);

      done();
    });
  });
  QUnit.test('Listener test', (assert) => {
    let done = assert.async(3);
    assert.expect(3);
    window.base = {
      method: () => {return 'base.method';},
      another: {thing: () => {return 'base.another.thing';}},
      even: {longer: {stuff: () => {return 'base.even.longer.stuff';}}},
    };
    let onMessage = messages.makeOnMessage(methods);
    onMessage({'method': 'base.method'}, {}, (result) => {
      assert.ok(result == 'base.method');
      done();
    });
    onMessage({'method': 'base.another.thing'}, {}, (result) => {
      assert.ok(result == 'base.another.thing');
      done();
    });
    onMessage({'method': 'base.even.longer.stuff'}, {}, (result) => {
      assert.ok(result == 'base.even.longer.stuff');
      done();
    });
  });
})();
