(function() {
  let messages = require('messages');
  QUnit.module("Messages");
  QUnit.test('Client test', (assert) => {
    let done = assert.async(2);
    assert.expect(9);


    let client = new messages.Client(
      new Set([
        'base.method',
        'base.another.thing',
        'base.even.longer.stuff',
      ])
    );
    assert.ok('method' in client);
    assert.ok('another' in client);
    assert.ok('stuff' in client.even.longer);

    let beforeSendMessage = chrome.runtime.sendMessage;
    chrome.runtime.sendMessage = function (obj, func) {
      func(obj);
    };

    client.method('foo', 6).then(obj => {
      assert.ok(obj.method === 'base.method');
      assert.ok(obj.args[0] == 'foo');
      assert.ok(obj.args[1] == 6);

      done();
    });

    // test callback
    client.even.longer.stuff(res => {
      res['callbackCalled'] = true;
      return res;
    }).then(obj => {
      assert.ok(obj.method === 'base.even.longer.stuff');
      assert.ok(obj.args.length == 0);
      assert.ok(obj.callbackCalled);

      done();
    });
  });
})();
