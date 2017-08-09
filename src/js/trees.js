require.scopes.trees = (function() {

/**
 * Create a Dynamic tree node.
 * takes a function that returns true/false.
 * this becomes part of the array that builds trees
 *
 * returns function
 */
function dynamicNode(func) {
  return function (node) {
    if (typeof node.next != 'undefined') {
      return node.next;
    }

    node.next = new Node();
    node.getBefore = node.get;
    node.get = function (item) {
      let out = node.getBefore(item);
      if (typeof out != 'undefined') {
        return out;
      }
      if (func(item)) {
        return node.next;
      }
      return undefined;
    };
    return node.next;
  };
}

function Node() {
  this._data = {};
}

Node.prototype = {
  // returns value, or undefined
  get: function(item) {
    return this._data[item];
  },
  set: function(item, val) {
    this._data[item] = val;
  },
  has: function(item) {
    return (typeof this.get(item) != 'undefined');
  },
};

function Tree(splitter) {
  this.splitter = splitter;
  this._base = new Node();
}

Tree.prototype = {
  sentinel: '.', // since '.' should not appear in the label of a hostname

  setItem: function(item, val) {
    let parts = this.splitter(item),
      len = parts.length,
      node = this._base;

    for (let i = 0; i < len; i++) {
      let part = parts[i];
      if (typeof part == 'string') {
        if (!node.has(part)) {
          node.set(part, new Node());
        }
        node = node.get(part);
      } else if (typeof part == 'function') { // dynamic nodes
        node = part(node);
      }
    }
    node.set(this.sentinel, val);
  },

  getItem: function(item) {
    let parts = this.splitter(item).concat(this.sentinel),
      len = parts.length,
      node = this._base;

    for (let i = 0; i < len; i++) {
      let part = parts[i];
      if (!node.has(part)) {
        return undefined;
      }
      node = node.get(part);
    }
    return node;
  },

  has: function(item) {
    if (typeof this.getItem(item) == 'undefined') {
      return false;
    }
    return true;
  },
};

return {Tree, dynamicNode};
})();
