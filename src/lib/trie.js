/*
 * This file is part of Privacy Badger <https://privacybadger.org/>
 * Copyright (C) 2025 Electronic Frontier Foundation
 *
 * Privacy Badger is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Privacy Badger is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Privacy Badger.  If not, see <http://www.gnu.org/licenses/>.
 */

import utils from "../js/utils.js";

/**
 * Trie node constructor.
 *
 * @param {String?} key
 */
function TrieNode(key) {
  this.key = key;
  this.parentNode = null;
  this.stringEndsHere = false;
  this.children = {};
}

/**
 * Iterates through parent nodes to reconstruct the dot-separated string.
 */
TrieNode.prototype.getString = function () {
  let output = [],
    node = this; // eslint-disable-line consistent-this

  // stop at the root node
  while (node.key !== null) {
    output.push(node.key);
    node = node.parentNode;
  }

  return output.join('.');
};

/**
 * Recursively populates `arr` with full strings
 * belonging to children of a given TrieNode.
 *
 * @param {TrieNode} node
 * @param {Array} arr
 */
function findAll(node, arr) {
  if (node.stringEndsHere) {
    arr.push(node.getString());
  }

  for (let key of Object.keys(node.children)) {
    findAll(node.children[key], arr);
  }
}

/**
 * Domain trie constructor.
 */
function Trie() {
  this.root = new TrieNode(null);
}

/*
 * Inserts a dot-separated domain string into the trie.
 *
 * @param {String} domain
 */
Trie.prototype.insert = function (domain) {
  let node = this.root,
    parts = domain.split('.');

  for (let i = parts.length-1; i >= 0; i--) {
    let key = parts[i];

    if (!utils.hasOwn(node.children, key)) {
      node.children[key] = new TrieNode(key);
      node.children[key].parentNode = node;
    }

    node = node.children[key];

    if (i == 0) {
      node.stringEndsHere = true;
    }
  }
};

/**
 * Returns any subdomains and the domain itself, if inserted directly.
 *
 * Note that the order of strings is undefined.
 *
 * @param {String} domain
 *
 * @returns {Array}
 */
Trie.prototype.getDomains = function (domain) {
  let domains = [],
    node = this.root,
    parts = domain.split('.');

  // first navigate to the deepest TrieNode for domain
  for (let i = parts.length-1; i >= 0; i--) {
    let key = parts[i];
    if (!utils.hasOwn(node.children, key)) {
      // abort if domain isn't fully in the Trie
      return domains;
    }
    node = node.children[key];
  }

  findAll(node, domains);

  return domains;
};

/**
 * Returns whether the domain string, or any of its
 * parent domain strings were inserted into the trie.
 *
 * @param {String} domain
 *
 * @returns {Boolean}
 */
Trie.prototype.globDomainMatches = function (domain) {
  let parts = domain.split('.'),
    node = this.root;

  for (let i = parts.length-1; i >= 0; i--) {
    let key = parts[i];
    if (!utils.hasOwn(node.children, key)) {
      return false;
    }
    node = node.children[key];
    if (node.stringEndsHere) {
      return true;
    }
  }

  return false;
};

export {
  Trie
};
