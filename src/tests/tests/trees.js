(function() {
  QUnit.module('Trees');
  function identity(input) {
    return input;
  }

  function isPuppyOrKitten(item) {
    return item == 'puppy' || item == 'kitten';
  }
  
  let trees = require('trees');

  QUnit.test('Tree test', assert => {
    let data = ['x', 'a.b.c', 'a.c', 'b.c', 'e.f.g.h'],
      splitter = input => {return input.split('.');},
      tree = new trees.Tree(splitter);
    data.forEach(d => {tree.setItem(d, true);});

    assert.ok(tree.getItem('x'));
    assert.ok(tree.getItem('a.b.c'));
    assert.ok(tree.getItem('a.c'));
    assert.ok(tree.getItem('b.c'));
    assert.ok(tree.getItem('e.f.g.h'));

    assert.notOk(tree.getItem('a'));
    assert.notOk(tree.getItem('b'));
    assert.notOk(tree.getItem('b.a'));
    assert.notOk(tree.getItem('a.b'));
    assert.notOk(tree.getItem('e.f.x.h'));
    assert.notOk(tree.getItem('l.m.n.o.p'));
  });
  QUnit.test('Test dynamic nodes', assert => {
    let data1 = ['a', trees.dynamicNode(isPuppyOrKitten)],
      data2 = ['a', 'b', 'c'],
      data3 = ['a'],
      data4 = ['a', 'puppy', 'c'],
      data5 = ['a', 'kitten', 'd'],
      tree = new trees.Tree(identity);

    tree.setItem(data1, 1);
    tree.setItem(data2, 2);
    tree.setItem(data3, 3);
    tree.setItem(data4, 4);
    tree.setItem(data5, 5);

    assert.equal(tree.getItem(['a', 'puppy']), 1);
    assert.equal(tree.getItem(['a', 'kitten']), 1);
    assert.equal(tree.getItem(['a', 'b', 'c']), 2);
    assert.equal(tree.getItem(['a']), 3);
    assert.equal(tree.getItem(['a', 'puppy', 'c']), 4);
    assert.equal(tree.getItem(['a', 'kitten', 'c']), 4);
    assert.equal(tree.getItem(['a', 'puppy', 'd']), 5);
    assert.equal(tree.getItem(['a', 'kitten', 'd']), 5);
  });

  QUnit.test('Test multiple dynamic nodes', assert => {
    let dynNode = trees.dynamicNode(isPuppyOrKitten, 'puppyOrKitten'),
      data1 = [dynNode],
      data2 = ['puppy', 'c'],
      data3 = ['puppy', 'c', dynNode],
      data4 = ['kitten', dynNode, 'x'],
      tree = new trees.Tree(identity);

    tree.setItem(data1, 1);
    tree.setItem(data2, 2);
    tree.setItem(data3, 3);
    tree.setItem(data4, 4);

    assert.equal(tree.getItem(['puppy']), 1);
    assert.equal(tree.getItem(['kitten']), 1);
    assert.equal(tree.getItem(['puppy', 'c']), 2);
    assert.equal(tree.getItem(['kitten', 'c']), 2);
    assert.equal(tree.getItem(['kitten', 'c', 'puppy']), 3);
    assert.equal(tree.getItem(['puppy', 'c', 'kitten']), 3);
    assert.equal(tree.getItem(['puppy', 'kitten', 'x']), 4);
  });
})();
