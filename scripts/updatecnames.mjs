import * as fs from 'fs';
import * as https from 'https';
import * as zlib from 'zlib';

import { default as utils } from '../src/js/utils.js';
import { getBaseDomain } from "../src/lib/basedomain.js";

let crux_url = "https://raw.githubusercontent.com/zakird/crux-top-lists/main/data/global/current.csv.gz";

function fetch_gz(url) {
  return new Promise((resolve, reject) => {
    let buffer = [];

    https.get(url, function (res) {
      let gunzip = zlib.createGunzip();

      res.pipe(gunzip);

      gunzip.on('data', data => {
        buffer.push(data.toString());
      }).on('end', () => {
        resolve(buffer.join(""));
      }).on('error', err => {
        reject(err);
      });

    }).on('error', err => {
      reject(err);
    });

  });
}

async function get_top_bases() {
  let topBases = new Set();

  let crux = await fetch_gz(crux_url);

  for (let line of crux.split("\n").slice(1, -1)) {
    // TODO not a real CSV parser, but probably good enough for parsing CrUX
    let url = line.split(",")[0];
    try {
      let host = (new URL(url)).hostname;
      topBases.add(getBaseDomain(host));
    } catch (err) {
      console.error("Failed to parse out hostname from %s: %s", url, err);
    }
  }

  return topBases;
}

async function main() {
  let filename = process.argv[2];

  let cnameDomains = JSON.parse(fs.readFileSync(filename, 'utf8'));

  let topBases = await get_top_bases();

  for (let alias of Object.keys(cnameDomains)) {
    let tracker = cnameDomains[alias];

    // remove first party aliases
    if (!utils.isThirdPartyDomain(alias, tracker)) {
      delete cnameDomains[alias];
    }

    // remove an outlier to save space/memory:
    // ten thousand entries of various subdomains
    // for the same first party/tracker combo
    if (alias.endsWith(".daraz.com") && tracker.endsWith(".affex.org")) {
      delete cnameDomains[alias];
    }

    // remove domains not found in the top 1M site CrUX list
    // but try to preserve international domains
    if (alias.endsWith(".com") || alias.endsWith(".net") ||
        alias.endsWith(".org") || alias.endsWith(".io") ||
        alias.endsWith(".info") || alias.endsWith(".co") ||
        alias.endsWith(".xyz") || alias.endsWith(".site") ||
        alias.endsWith(".dev") || alias.endsWith(".ai") ||
        alias.endsWith(".shop") || alias.endsWith(".store") ||
        alias.endsWith(".app") || alias.endsWith(".video") ||
        alias.endsWith(".digital") || alias.endsWith(".online") ||
        alias.endsWith(".tech") || alias.endsWith(".technology")) {
      if (!topBases.has(getBaseDomain(alias))) {
        delete cnameDomains[alias];
      }
    }
  }

  fs.writeFileSync(filename, JSON.stringify(cnameDomains, null, 2), 'utf8');
}

main();
