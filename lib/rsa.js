/*
 * This file is part of Adblock Plus <http://adblockplus.org/>,
 * Copyright (C) 2006-2013 Eyeo GmbH
 *
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


/**
 * This is a specialized RSA library meant only to verify SHA1-based signatures.
 * It requires jsbn.js and sha1.js to work.
 */

(function(globalObj)
{
  // Define ASN.1 templates for the data structures used
  function seq()
  {
    return {type: 0x30, children: Array.prototype.slice.call(arguments)};
  }
  function obj(id)
  {
    return {type: 0x06, content: id};
  }
  function bitStr(contents)
  {
    return {type: 0x03, encapsulates: contents};
  }
  function intResult(id)
  {
    return {type: 0x02, out: id};
  }
  function octetResult(id)
  {
    return {type: 0x04, out: id};
  }

  // See http://www.cryptopp.com/wiki/Keys_and_Formats#RSA_PublicKey
  // 2A 86 48 86 F7 0D 01 01 01 means 1.2.840.113549.1.1.1
  var publicKeyTemplate = seq(seq(obj("\x2A\x86\x48\x86\xF7\x0D\x01\x01\x01"), {}), bitStr(seq(intResult("n"), intResult("e"))));

  // See http://tools.ietf.org/html/rfc3447#section-9.2 step 2
  // 2B 0E 03 02 1A means 1.3.14.3.2.26
  var signatureTemplate = seq(seq(obj("\x2B\x0E\x03\x02\x1A"), {}), octetResult("sha1"));

  /**
   * Reads ASN.1 data matching the template passed in. This will throw an
   * exception if the data format doesn't match the template. On success an
   * object containing result properties is returned.
   *
   * See http://luca.ntop.org/Teaching/Appunti/asn1.html for info on the format.
   */
  function readASN1(data, templ)
  {
    var pos = 0;
    function next()
    {
      return data.charCodeAt(pos++);
    }

    function readLength()
    {
      var len = next();
      if (len & 0x80)
      {
        var cnt = len & 0x7F;
        if (cnt > 2 || cnt == 0)
          throw "Unsupported length";

        len = 0;
        for (var i = 0; i < cnt; i++)
          len += next() << (cnt - 1 - i) * 8;
        return len;
      }
      else
        return len;
    }

    function readNode(curTempl)
    {
      var type = next();
      var len = readLength();
      if ("type" in curTempl && curTempl.type != type)
        throw "Unexpected type";
      if ("content" in curTempl && curTempl.content != data.substr(pos, len))
        throw "Unexpected content";
      if ("out" in curTempl)
        out[curTempl.out] = new BigInteger(data.substr(pos, len), 256);
      if ("children" in curTempl)
      {
        var i, end;
        for (i = 0, end = pos + len; pos < end; i++)
        {
          if (i >= curTempl.children.length)
            throw "Too many children";
          readNode(curTempl.children[i]);
        }
        if (i < curTempl.children.length)
          throw "Too few children";
        if (pos > end)
          throw "Children too large";
      }
      else if ("encapsulates" in curTempl)
      {
        if (next() != 0)
          throw "Encapsulation expected";
        readNode(curTempl.encapsulates);
      }
      else
        pos += len;
    }

    var out = {};
    readNode(templ);
    if (pos != data.length)
      throw "Too much data";
    return out;
  }

  /**
   * Reads a BER-encoded RSA public key. On success returns an object with the
   * properties n and e (the components of the key), otherwise null.
   */
  function readPublicKey(key)
  {
    try
    {
      return readASN1(atob(key), publicKeyTemplate);
    }
    catch (e)
    {
      console.log("Invalid RSA public key: " + e);
      return null;
    }
  }

  /**
   * Checks whether the signature is valid for the given public key and data.
   */
  function verifySignature(key, signature, data)
  {
    var keyData = readPublicKey(key);
    if (!keyData)
      return false;

    // We need the exponent as regular number
    keyData.e = parseInt(keyData.e.toString(16), 16);

    // Decrypt signature data using RSA algorithm
    var sigInt = new BigInteger(atob(signature), 256);
    var digest = sigInt.modPowInt(keyData.e, keyData.n).toString(256);

    try
    {
      var pos = 0;
      function next()
      {
        return digest.charCodeAt(pos++);
      }

      // Skip padding, see http://tools.ietf.org/html/rfc3447#section-9.2 step 5
      if (next() != 1)
        throw "Wrong padding in signature digest";
      while (next() == 255) {}
      if (digest.charCodeAt(pos - 1) != 0)
        throw "Wrong padding in signature digest";

      // Rest is an ASN.1 structure, get the SHA1 hash from it and compare to
      // the real one
      var sha1 = readASN1(digest.substr(pos), signatureTemplate).sha1;
      var expected = new BigInteger(SHA1(data), 16);
      return (sha1.compareTo(expected) == 0);
    }
    catch (e)
    {
      console.log("Invalid encrypted signature: " + e);
      return false;
    }
  }

  // Export verifySignature function, everything else is private.
  globalObj.verifySignature = verifySignature;
})(this);
