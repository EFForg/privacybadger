import { Trie } from "../../lib/trie.js";

QUnit.module("Trie");

QUnit.test("basic functionality", (assert) => {
  let trackers = [
    "example.com.eviltracker.net",
    "track.eviltracker.net",
    "eviltracker.net",
    "example.net"
  ];

  let trie = new Trie();

  for (let tracker of trackers) {
    trie.insert(tracker);
  }

  assert.deepEqual(
    trie.getDomains("track.eviltracker.net"),
    ["track.eviltracker.net"],
    "subdomain matches itself");

  assert.deepEqual(
    trie.getDomains("com.eviltracker.net"),
    ["example.com.eviltracker.net"],
    "subdomain of subdomain matches");

  assert.deepEqual(
    trie.getDomains("eviltracker.net").sort(),
    trackers.filter(d => d != "example.net").sort(),
    "eTLD+1 matches itself and all subdomains");

  assert.deepEqual(
    trie.getDomains("example.com"),
    [],
    "no matches");
});

QUnit.test("subdomains only trie", (assert) => {
  let trackers = [
    "example.com.eviltracker.net",
    "track.eviltracker.net"
  ];

  let trie = new Trie();

  for (let tracker of trackers) {
    trie.insert(tracker);
  }

  assert.deepEqual(
    trie.getDomains("eviltracker.net").sort(),
    trackers.sort(),
    "eTLD+1 does not match itself when not inserted directly");
});

QUnit.test("glob domain matching", (assert) => {
  let domains = [
    "example.com",
    "sub.example.org"
  ];

  let trie = new Trie();

  for (let domain of domains) {
    trie.insert(domain);
  }

  assert.ok(trie.globDomainMatches("example.com"), "direct match");
  assert.ok(trie.globDomainMatches("sub.example.com"),
    "subdomains are included");

  assert.notOk(trie.globDomainMatches("example.net"), "no match");

  assert.ok(trie.globDomainMatches("sub.example.org"),
    "direct subdomain match");
  assert.notOk(trie.globDomainMatches("example.org"),
    "base domain was not inserted");
});
