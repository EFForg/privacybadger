/* eslint-env node */

import * as fs from 'node:fs';
import { default as utils } from '../src/js/utils.js';

function main() {
  let filename = process.argv[2];

  let cnameDomains = JSON.parse(fs.readFileSync(filename, 'utf8'));

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
  }

  fs.writeFileSync(filename, JSON.stringify(cnameDomains, null, 2), 'utf8');
}

main();
