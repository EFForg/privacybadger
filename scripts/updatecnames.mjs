/* eslint-env node */

import * as fs from 'node:fs';
import { getBaseDomain } from "../src/lib/basedomain.js";
import { default as utils } from '../src/js/utils.js';

function main() {
  let filename = process.argv[2];

  let cnameDomains = JSON.parse(fs.readFileSync(filename, 'utf8'));

  let cnameCloakedDomains = {};

  for (let alias of Object.keys(cnameDomains)) {
    let tracker = cnameDomains[alias];

    // remove first party aliases
    if (!utils.isThirdPartyDomain(alias, tracker)) {
      continue;
    }

    // remove an outlier to save space/memory:
    // ten thousand entries of various subdomains
    // for the same first party/tracker combo
    if (alias.endsWith(".daraz.com") && tracker.endsWith(".affex.org")) {
      continue;
    }

    // store CNAME alias FQDNs for given tracker FQDN
    // the slice() is there to remove unwanted eTLDs like com/net/org
    // it's OK to have entries for ne.jp, they just won't do anything
    //
    // we do want amazonaws.com so unless we can differentiate
    // between public and private suffixes
    // we shouldn't use getBaseDomain to determine when to stop
    //
    // we want an entry for amazonaws.com because we use this object
    // to quickly look up whether we have CNAMES or not
    // so we do want to store "base" domains even if no CNAMEs
    // directly point to the "base" domain
    let parts = utils.explodeSubdomains(tracker, true).slice(0, -1);
    for (let part of parts) {
      if (!utils.hasOwn(cnameCloakedDomains, part)) {
        cnameCloakedDomains[part] = [];
      }
    }
    // store CNAMEs on the full/exact FQDN that points to them
    if (parts.length) {
      cnameCloakedDomains[parts[0]].push(alias);
    }
  }

  // sort by eTLD+1
  cnameCloakedDomains = Object.keys(cnameCloakedDomains).sort((a, b) => {
    return getBaseDomain(a).localeCompare(getBaseDomain(b)) || a.localeCompare(b);
  }).reduce((memo, key) => {
    memo[key] = cnameCloakedDomains[key].sort((a, b) => {
      return getBaseDomain(a).localeCompare(getBaseDomain(b)) || a.localeCompare(b);
    });
    return memo;
  }, {});

  fs.writeFileSync(filename, JSON.stringify(cnameCloakedDomains, null, 2), 'utf8');
}

main();
