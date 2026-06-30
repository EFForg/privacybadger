import webrequest from "../../js/webrequest.js";

let inlineScriptsAllowedByCsp = webrequest.inlineScriptsAllowedByCsp;

function makeHeaders(cspValue) {
  return [{ name: "Content-Security-Policy", value: cspValue }];
}

QUnit.module("inlineScriptsAllowedByCsp", function () {

  QUnit.test("no CSP headers", (assert) => {
    assert.true(inlineScriptsAllowedByCsp([]), "empty headers → allowed");
    assert.true(inlineScriptsAllowedByCsp([
      { name: "X-Frame-Options", value: "DENY" }
    ]), "unrelated headers → allowed");
  });

  QUnit.test("no script restriction in CSP", (assert) => {
    assert.true(
      inlineScriptsAllowedByCsp(makeHeaders("img-src 'self'")),
      "img-src only → allowed"
    );
    assert.true(
      inlineScriptsAllowedByCsp(makeHeaders("upgrade-insecure-requests")),
      "upgrade-insecure-requests only → allowed"
    );
  });

  QUnit.test("unsafe-inline present, no nonces/hashes/strict-dynamic", (assert) => {
    assert.true(
      inlineScriptsAllowedByCsp(makeHeaders("script-src 'unsafe-inline'")),
      "script-src 'unsafe-inline' → allowed"
    );
    assert.true(
      inlineScriptsAllowedByCsp(makeHeaders("default-src 'unsafe-inline'")),
      "default-src 'unsafe-inline' → allowed"
    );
    assert.true(
      inlineScriptsAllowedByCsp(makeHeaders("script-src 'self' 'unsafe-inline' https://cdn.example.com")),
      "script-src with 'unsafe-inline' among other sources → allowed"
    );
  });

  QUnit.test("script-src without unsafe-inline", (assert) => {
    assert.false(
      inlineScriptsAllowedByCsp(makeHeaders("script-src 'self'")),
      "script-src 'self' → blocked"
    );
    assert.false(
      inlineScriptsAllowedByCsp(makeHeaders("script-src https:")),
      "script-src https: → blocked"
    );
    assert.false(
      inlineScriptsAllowedByCsp(makeHeaders("script-src 'none'")),
      "script-src 'none' → blocked"
    );
  });

  QUnit.test("default-src fallback when no script-src", (assert) => {
    assert.false(
      inlineScriptsAllowedByCsp(makeHeaders("default-src 'self'")),
      "default-src 'self', no script-src → blocked"
    );
    assert.true(
      inlineScriptsAllowedByCsp(makeHeaders("default-src 'self'; script-src 'unsafe-inline'")),
      "script-src overrides restrictive default-src → allowed"
    );
    assert.false(
      inlineScriptsAllowedByCsp(makeHeaders("default-src 'unsafe-inline'; script-src 'self'")),
      "script-src 'self' overrides permissive default-src → blocked"
    );
  });

  QUnit.test("nonce present makes unsafe-inline ineffective", (assert) => {
    assert.false(
      inlineScriptsAllowedByCsp(makeHeaders("script-src 'nonce-abc123' 'unsafe-inline'")),
      "nonce + unsafe-inline → blocked"
    );
    assert.false(
      inlineScriptsAllowedByCsp(makeHeaders("script-src 'nonce-abc123'")),
      "nonce only → blocked"
    );
  });

  QUnit.test("hash present makes unsafe-inline ineffective", (assert) => {
    assert.false(
      inlineScriptsAllowedByCsp(makeHeaders("script-src 'sha256-abc123==' 'unsafe-inline'")),
      "sha256 hash + unsafe-inline → blocked"
    );
    assert.false(
      inlineScriptsAllowedByCsp(makeHeaders("script-src 'sha384-abc123==' 'unsafe-inline'")),
      "sha384 hash + unsafe-inline → blocked"
    );
    assert.false(
      inlineScriptsAllowedByCsp(makeHeaders("script-src 'sha512-abc123==' 'unsafe-inline'")),
      "sha512 hash + unsafe-inline → blocked"
    );
  });

  QUnit.test("strict-dynamic makes unsafe-inline ineffective", (assert) => {
    assert.false(
      inlineScriptsAllowedByCsp(makeHeaders("script-src 'strict-dynamic' 'unsafe-inline'")),
      "strict-dynamic + unsafe-inline → blocked"
    );
    assert.false(
      inlineScriptsAllowedByCsp(makeHeaders("script-src 'nonce-abc' 'strict-dynamic' 'unsafe-inline'")),
      "nonce + strict-dynamic + unsafe-inline → blocked"
    );
    assert.false(
      inlineScriptsAllowedByCsp(makeHeaders("script-src 'strict-dynamic'")),
      "strict-dynamic only → blocked"
    );
  });

  QUnit.test("multiple CSP headers: all must allow inline scripts", (assert) => {
    assert.true(
      inlineScriptsAllowedByCsp([
        { name: "Content-Security-Policy", value: "script-src 'unsafe-inline'" },
        { name: "Content-Security-Policy", value: "img-src 'self'" },
      ]),
      "two headers, only one has script-src (with unsafe-inline) → allowed"
    );
    assert.false(
      inlineScriptsAllowedByCsp([
        { name: "Content-Security-Policy", value: "script-src 'unsafe-inline'" },
        { name: "Content-Security-Policy", value: "script-src 'self'" },
      ]),
      "two headers, second blocks inline scripts → blocked"
    );
  });

  QUnit.test("header name matching is case-insensitive", (assert) => {
    assert.false(
      inlineScriptsAllowedByCsp([
        { name: "content-security-policy", value: "script-src 'self'" }
      ]),
      "lowercase header name → still matched"
    );
    assert.false(
      inlineScriptsAllowedByCsp([
        { name: "CONTENT-SECURITY-POLICY", value: "script-src 'self'" }
      ]),
      "uppercase header name → still matched"
    );
  });

  QUnit.test("Content-Security-Policy-Report-Only is ignored", (assert) => {
    assert.true(
      inlineScriptsAllowedByCsp([
        { name: "Content-Security-Policy-Report-Only", value: "script-src 'self'" }
      ]),
      "report-only header → not enforced, inline scripts allowed"
    );
  });

});
