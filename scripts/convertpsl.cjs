#!/usr/bin/env node

// script based on
// https://github.com/adblockplus/adblockpluscore/blob/d7efa99b47e6cefa9286d34ce80e2242d789a08b/build/updatepsl.js

const fs = require('fs');

function convert(data) {
  let psl = {};

  for (let line of data.split(/\r?\n/)) {
    if (line.startsWith("//") || !line.includes(".")) {
      continue;
    }

    let value = 1;
    line = line.replace(/\s+$/, "");

    if (line.startsWith("*.")) {
      line = line.slice(2);
      value = 2;
    } else if (line.startsWith("!")) {
      line = line.slice(1);
      value = 0;
    }

    // save host and type of entry, converting Unicode hostnames to Punycode
    psl[new URL("http://" + line).hostname] = value;
  }

  return psl;
}

if (require.main == module) {
  let filename = process.argv[2];

  let psl = convert(fs.readFileSync(filename, 'utf8'));

  let keys = Object.keys(psl).sort();
  fs.writeFileSync(
    filename,
    `export default ${JSON.stringify(psl, keys, 2)};\n`,
    'utf8');
}
