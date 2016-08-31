/* * This file is part of Adblock Plus <http://adblockplus.org/>, * Copyright (C) 2006-2013 Eyeo GmbH *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

/* global
extractHostFromURL:false,
getBaseDomain: false,
ipAddressToNumber: false,
isPrivateDomain:false,
isThirdParty:false,
URI:false,
*/

(function()
{
  module("URL/host tools");

  test("Host name extraction", function()
  {
    var tests = [
      [null, ""],
      ["/foo/bar", ""],
      ["http://example.com/", "example.com"],
      ["http://example.com:8000/", "example.com"],
      ["http://foo:bar@example.com:8000/foo:bar/bas", "example.com"],
      ["ftp://example.com/", "example.com"],
      ["http://1.2.3.4:8000/", "1.2.3.4"],
      ["http://[2001:0db8:85a3:0000:0000:8a2e:0370:7334]/", "2001:0db8:85a3:0000:0000:8a2e:0370:7334"],
      ["http://[2001::7334]:8000/test@foo.example.com/bar", "2001::7334"],
    ];

    for (var i = 0; i < tests.length; i++) {
      equal(extractHostFromURL(tests[i][0]), tests[i][1], tests[i][0]);
    }
  });

  test("Invalid URI recognition", function()
  {
    var tests = [
      null,
      "",
      "http:",
      "http:foo.bar/",
      "http://foo.bar"
    ];
    for (var i = 0; i < tests.length; i++)
    {
      // TODO the no-loop-func eslint error below looks like a bug:
      // "i" is always tests.length-1?
      throws(
        function() {
          return new URI(tests[i]);
        },
        'Invalid URI recognition.'
      );
    }
  });

  test("URI parsing", function()
  {
    var tests = [
      ["http://example.com/", {
        scheme: "http",
        host: "example.com",
        asciiHost: "example.com",
        hostPort: "example.com",
        port: -1,
        path: "/",
        prePath: "http://example.com"
      }],
      ["http://example.com:8000/", {
        scheme: "http",
        host: "example.com",
        asciiHost: "example.com",
        hostPort: "example.com:8000",
        port: 8000,
        path: "/",
        prePath: "http://example.com:8000"
      }],
      ["http://foo:bar@\u0440\u043E\u0441\u0441\u0438\u044F.\u0440\u0444:8000/foo:bar/bas", {
        scheme: "http",
        host: "\u0440\u043E\u0441\u0441\u0438\u044F.\u0440\u0444",
        asciiHost: "xn--h1alffa9f.xn--p1ai",
        hostPort: "\u0440\u043E\u0441\u0441\u0438\u044F.\u0440\u0444:8000",
        port: 8000,
        path: "/foo:bar/bas",
        prePath: "http://foo:bar@\u0440\u043E\u0441\u0441\u0438\u044F.\u0440\u0444:8000"
      }],
      ["ftp://m\xFCller.de/", {
        scheme: "ftp",
        host: "m\xFCller.de",
        asciiHost: "xn--mller-kva.de",
        hostPort: "m\xFCller.de",
        port: -1,
        path: "/",
        prePath: "ftp://m\xFCller.de"
      }],
      ["http://1.2.3.4:8000/", {
        scheme: "http",
        host: "1.2.3.4",
        asciiHost: "1.2.3.4",
        hostPort: "1.2.3.4:8000",
        port: 8000,
        path: "/",
        prePath: "http://1.2.3.4:8000"
      }],
      ["http://[2001:0db8:85a3:0000:0000:8a2e:0370:7334]/", {
        scheme: "http",
        host: "2001:0db8:85a3:0000:0000:8a2e:0370:7334",
        asciiHost: "2001:0db8:85a3:0000:0000:8a2e:0370:7334",
        hostPort: "[2001:0db8:85a3:0000:0000:8a2e:0370:7334]",
        port: -1,
        path: "/",
        prePath: "http://[2001:0db8:85a3:0000:0000:8a2e:0370:7334]"
      }],
      ["http://[2001::7334]:8000/test@foo.example.com/bar", {
        scheme: "http",
        host: "2001::7334",
        asciiHost: "2001::7334",
        hostPort: "[2001::7334]:8000",
        port: 8000,
        path: "/test@foo.example.com/bar",
        prePath: "http://[2001::7334]:8000"
      }],
    ];

    for (var i = 0; i < tests.length; i++)
    {
      var url = tests[i][0];
      var uri = new URI(url);
      equal(uri.spec, url, "URI(" + url + ").spec");
      for (var k in tests[i][1]) {
        equal(uri[k], tests[i][1][k], "URI(" + url + ")." + k);
      }
    }
  });

  test("Determining base domain", function()
  {
    var tests = [
      ["com", "com"],
      ["example.com", "example.com"],
      ["www.example.com", "example.com"],
      ["www.example.com.", "example.com"],
      ["www.example.co.uk", "example.co.uk"],
      ["www.example.co.uk.", "example.co.uk"],
      ["www.example.bl.uk", "bl.uk"],
      ["foo.bar.example.co.uk", "example.co.uk"],
      ["1.2.3.4.com", "4.com"],
      ["1.2.3.4.bg", "3.4.bg"],
      ["1.2.3.4", "1.2.3.4"],
      ["1.2.0x3.0x4", "1.2.0x3.0x4"],
      ["1.2.3", "2.3"],
      ["1.2.0x3g.0x4", "0x3g.0x4"],
      ["2001:0db8:85a3:0000:0000:8a2e:0370:7334", "2001:0db8:85a3:0000:0000:8a2e:0370:7334"],
      ["2001::7334", "2001::7334"],
      ["::ffff:1.2.3.4", "::ffff:1.2.3.4"],
      ["foo.bar.2001::7334", "bar.2001::7334"],
      ["test.xn--e1aybc.xn--p1ai", "тест.рф"],
    ];

    for (var i = 0; i < tests.length; i++) {
      equal(getBaseDomain(tests[i][0]), tests[i][1], tests[i][0]);
    }
  });

  test("Converting IP address to number checks", function()
  {
    var testResults = {
      "127.0.0.1": 2130706433,
      "8.8.8.8": 134744072,
      "192.168.0.1": 3232235521,
      "256.0.0.1": 0,
      "privacybadger.org": 0,
    };

    for (var ip in testResults) {
      // Ignore object properties.
      if (! testResults.hasOwnProperty(ip)) {
        continue;
      }

      equal(ipAddressToNumber(ip), testResults[ip], ip);
    }
  });

  test("Private domain checks", function()
  {
    var testResults = {
      "localhost": true,
      "126.0.0.13": false,
      "127.0.0.1": true,
      "128.0.2.27": false,
      "9.4.201.150": false,
      "10.3.0.99": true,
      "11.240.84.107": false,
      "171.20.103.65": false,
      "172.15.2.0": false,
      "172.16.25.30": true,
      "172.31.16.2": true,
      "172.32.3.4": false,
      "173.28.86.211": false,
      "191.168.33.41": false,
      "192.167.101.111": false,
      "192.168.1.5": true,
      "192.169.204.154": false,
      "193.168.28.139": false,
      "privacybadger.org": false,
    };

    for (var domain in testResults) {
      // Ignore object properties.
      if (! testResults.hasOwnProperty(domain)) {
        continue;
      }

      equal(isPrivateDomain(domain), testResults[domain], domain);
    }
  });

  test("Third party checks", function()
  {
    var tests = [
      ["foo", "foo", false],
      ["foo", "bar", true],
      ["foo.com", "bar.com", true],
      ["foo.com", "foo.com", false],
      ["foo.com", "www.foo.com", false],
      ["foo.example.com", "bar.example.com", false],
      ["foo.uk", "bar.uk", true],
      ["foo.co.uk", "bar.co.uk", true],
      ["foo.example.co.uk", "bar.example.co.uk", false],
      ["1.2.3.4", "2.2.3.4", true],
    ];

    for (var i = 0; i < tests.length; i++) {
      equal(isThirdParty(tests[i][0], tests[i][1]), tests[i][2], tests[i][0] + " and " + tests[i][1]);
    }
  });
})();
