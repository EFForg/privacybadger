/*!
 * Parts of original code from ipv6.js <https://github.com/beaugunderson/javascript-ipv6>
 * Copyright 2011 Beau Gunderson
 * Available under MIT license <http://mths.be/mit>
 */

const RE_V4 = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|0x[0-9a-f][0-9a-f]?|0[0-7]{3})\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|0x[0-9a-f][0-9a-f]?|0[0-7]{3})$/i;
const RE_V4_HEX = /^0x([0-9a-f]{8})$/i;
const RE_V4_NUMERIC = /^[0-9]+$/;
const RE_V4inV6 = /(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

const RE_BAD_CHARACTERS = /([^0-9a-f:])/i;
const RE_BAD_ADDRESS = /([0-9a-f]{5,}|:{3,}|[^:]:$|^:[^:]$)/i;

function isIPv4(address)
{
  if (RE_V4.test(address))
    return true;
  if (RE_V4_HEX.test(address))
    return true;
  if (RE_V4_NUMERIC.test(address))
    return true;
  return false;
}

function isIPv6(address)
{
  var a4addon = 0;
  var address4 = address.match(RE_V4inV6);
  if (address4)
  {
    var temp4 = address4[0].split('.');
    for (var i = 0; i < 4; i++)
    {
      if (/^0[0-9]+/.test(temp4[i]))
        return false;
    }
    address = address.replace(RE_V4inV6, '');
    if (/[0-9]$/.test(address))
      return false;

    address = address + temp4.join(':');
    a4addon = 2;
  }

  if (RE_BAD_CHARACTERS.test(address))
    return false;

  if (RE_BAD_ADDRESS.test(address))
    return false;

  function count(string, substring)
  {
    return (string.length - string.replace(new RegExp(substring,"g"), '').length) / substring.length;
  }

  var halves = count(address, '::');
  if (halves == 1 && count(address, ':') <= 6 + 2 + a4addon)
    return true;
  if (halves == 0 && count(address, ':') == 7 + a4addon)
    return true;
  return false;
}

/**
 * Returns base domain for specified host based on Public Suffix List.
 * @param {String} hostname The name of the host to get the base domain for
 */
function getBaseDomain(/**String*/ hostname) /**String*/
{
  // remove trailing dot(s)
  hostname = hostname.replace(/\.+$/, '');

  // return IP address untouched
  if (isIPv6(hostname) || isIPv4(hostname))
    return hostname;

  // decode punycode if exists
  if (hostname.indexOf('xn--') >= 0)
  {
    hostname = punycode.toUnicode(hostname);
  }

  // search through PSL
  var prevDomains = [];
  var curDomain = hostname;
  var nextDot = curDomain.indexOf('.');
  var tld = 0;

  while (true)
  {
    var suffix = publicSuffixes[curDomain];
    if (typeof(suffix) != 'undefined')
    {
      tld = suffix;
        break;
    }

    if (nextDot < 0)
    {
      tld = 1;
      break;
    }

    prevDomains.push(curDomain.substring(0,nextDot));
    curDomain = curDomain.substring(nextDot+1);
    nextDot = curDomain.indexOf('.');
  }

  while (tld > 0 && prevDomains.length > 0)
  {
    curDomain = prevDomains.pop() + '.' + curDomain;
    tld--;
  }

  return curDomain;
}

/**
 * Converts an IP address to a number. If given input is not a valid IP address
 * then 0 is returned.
 * @param {String} ip The IP address to convert
 * @returns {Integer}
 */
function ipAddressToNumber(ip) {
  // Separate IP address into octets, make sure there are four.
  var octets = ip.split(".");
  if (octets.length !== 4) {
    return 0;
  }

  var result = 0;
  var maxOctetIndex = 3;
  for (var i = maxOctetIndex; i >= 0; i--) {
    var octet = parseInt(octets[maxOctetIndex - i], 10);

    // If octet is invalid return early, no need to continue.
    if (Number.isNaN(octet) || octet < 0 || octet > 255) {
      return 0;
    }

    // Use bit shifting to store each octet for result.
    result |= octet << (i * 8);
  }

  // Results of bitwise operations in JS are interpreted as signed
  // so use zero-fill right shift to return unsigned number.
  return result >>> 0;
}

/**
 * Determines if domain is private, that is localhost or the IP address spaces
 * specified by RFC 1918.
 * @param {String} domain The domain to check
 * @returns {Boolean}
 */
function isPrivateDomain(domain) {
  // Check for localhost match.
  if (domain === "localhost") {
    return true;
  }

  // Check for private IP match.
  var ipNumber = ipAddressToNumber(domain);
  var privateIpMasks = {
    "127.0.0.0": "255.0.0.0",
    "10.0.0.0": "255.0.0.0",
    "172.16.0.0": "255.240.0.0",
    "192.168.0.0": "255.255.0.0",
  };
  for (var ip in privateIpMasks) {
    // Ignore object properties.
    if (! privateIpMasks.hasOwnProperty(ip)) {
      continue;
    }

    // Compare given IP value to private IP value using bitwise AND.
    // Make sure result of AND is unsigned by using zero-fill right shift.
    var privateIpNumber = ipAddressToNumber(ip);
    var privateMaskNumber = ipAddressToNumber(privateIpMasks[ip]);
    if (((ipNumber & privateMaskNumber) >>> 0) === privateIpNumber) {
      return true;
    }
  }

  // Getting here means given host didn't match localhost
  // or other private addresses so return false.
  return false;
}

/**
 * Checks whether a request is third party for the given document, uses
 * information from the public suffix list to determine the effective domain
 * name for the document.
 * @param {String} requestHost The host of the 3rd party request
 * @param {String} documentHost The host of the document
 */
function isThirdParty(/**String*/ requestHost, /**String*/ documentHost)
{
  // Remove trailing dots
  requestHost = requestHost.replace(/\.+$/, "");
  documentHost = documentHost.replace(/\.+$/, "");

  // Extract domain name - leave IP addresses unchanged, otherwise leave only base domain
  var documentDomain = getBaseDomain(documentHost);
  if (requestHost.length > documentDomain.length)
    return (requestHost.substr(requestHost.length - documentDomain.length - 1) != "." + documentDomain);
  else
    return (requestHost != documentDomain);
}

/**
 * Extracts host name from a URL.
 */
function extractHostFromURL(/**String*/ url)
{
  if (url && extractHostFromURL._lastURL == url)
    return extractHostFromURL._lastDomain;

  var host = "";
  try
  {
    host = new URI(url).host;
  }
  catch (e)
  {
    // Keep the empty string for invalid URIs.
  }

  extractHostFromURL._lastURL = url;
  extractHostFromURL._lastDomain = host;
  return host;
}

/**
 * Parses URLs and provides an interface similar to nsIURI in Gecko, see
 * https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsIURI.
 * TODO: Make sure the parsing actually works the same as nsStandardURL.
 * @constructor
 */
function URI(/**String*/ spec)
{
  this.spec = spec;
  this._schemeEnd = spec.indexOf(":");
  if (this._schemeEnd < 0)
    throw new Error("Invalid URI scheme");

  if (spec.substr(this._schemeEnd + 1, 2) != "//")
    throw new Error("Unexpected URI structure");

  this._hostPortStart = this._schemeEnd + 3;
  this._hostPortEnd = spec.indexOf("/", this._hostPortStart);
  if (this._hostPortEnd < 0)
    throw new Error("Invalid URI host");

  var authEnd = spec.indexOf("@", this._hostPortStart);
  if (authEnd >= 0 && authEnd < this._hostPortEnd)
    this._hostPortStart = authEnd + 1;

  this._portStart = -1;
  this._hostEnd = spec.indexOf("]", this._hostPortStart + 1);
  if (spec[this._hostPortStart] == "[" && this._hostEnd >= 0 && this._hostEnd < this._hostPortEnd)
  {
    // The host is an IPv6 literal
    this._hostStart = this._hostPortStart + 1;
    if (spec[this._hostEnd + 1] == ":")
      this._portStart = this._hostEnd + 2;
  }
  else
  {
    this._hostStart = this._hostPortStart;
    this._hostEnd = spec.indexOf(":", this._hostStart);
    if (this._hostEnd >= 0 && this._hostEnd < this._hostPortEnd)
      this._portStart = this._hostEnd + 1;
    else
      this._hostEnd = this._hostPortEnd;
  }
}
URI.prototype =
{
  spec: null,
  get scheme()
  {
    return this.spec.substring(0, this._schemeEnd).toLowerCase();
  },
  get host()
  {
    return this.spec.substring(this._hostStart, this._hostEnd);
  },
  get asciiHost()
  {
    var host = this.host;
    if (/^[\x00-\x7F]+$/.test(host))
      return host;
    else
      return punycode.toASCII(host);
  },
  get hostPort()
  {
    return this.spec.substring(this._hostPortStart, this._hostPortEnd);
  },
  get port()
  {
    if (this._portStart < 0)
      return -1;
    else
      return parseInt(this.spec.substring(this._portStart, this._hostPortEnd), 10);
  },
  get path()
  {
    return this.spec.substring(this._hostPortEnd);
  },
  get prePath()
  {
    return this.spec.substring(0, this._hostPortEnd);
  }
};
