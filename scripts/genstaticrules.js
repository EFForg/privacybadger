#!/usr/bin/env node

/* globals badger:false */

import * as fs from 'fs';

import "./lib/preImportShims.js";

import { getBaseDomain } from "../src/lib/basedomain.js";

import constants from "../src/js/constants.js";
import HeuristicBlocking from "../src/js/heuristicblocking.js";
import BadgerPen from "../src/js/storage.js";
import sdb from "../src/data/surrogates.js";
import utils from "../src/lib/dnr/utils.js";

import "./lib/postImportOverrides.js";

/**
 * A rule for ensuring EFF's DNT policy check requests/responses are allowed.
 */
function make_dnt_policy_rule() {
  let rules = [
    // allow DNT policy check requests even when their domains would be blocked otherwise
    {
      id: 1,
      priority: constants.DNR_DNT_CHECK_ALLOW,
      action: {
        type: 'allow'
      },
      condition: {
        resourceTypes: ['xmlhttprequest'],
        urlFilter: "|https://*/.well-known/dnt-policy.txt|"
      }
    },
  ];

  return rules;
}

/**
 * Rules for sending DNT/GPC headers.
 */
function make_dnt_signal_rules() {
  return [
    // set DNT and Sec-GPC on top-level documents
    {
      id: 1,
      priority: constants.DNR_DNT_HEADER,
      action: {
        type: 'modifyHeaders',
        requestHeaders: [{
          header: 'DNT',
          operation: 'set',
          value: '1'
        }, {
          header: 'Sec-GPC',
          operation: 'set',
          value: '1'
        }]
      },
      // all URLs
      condition: {
        resourceTypes: ['main_frame']
      }
    },
    // set DNT and Sec-GPC on all other resource types
    {
      id: 2,
      priority: constants.DNR_DNT_HEADER,
      action: {
        type: 'modifyHeaders',
        requestHeaders: [{
          header: 'DNT',
          operation: 'set',
          value: '1'
        }, {
          header: 'Sec-GPC',
          operation: 'set',
          value: '1'
        }]
      },
      // all URLs excluding main_frame resources
      condition: {}
    }
  ];
}

function make_surrogates_rules() {
  let id = 0,
    rules = [];

  function getId() {
    id++;
    return id;
  }

  for (let host in sdb.hostnames) {
    rules.push(...utils.getDnrSurrogateRules(getId, host));
  }

  return rules;
}

function make_seed_rules(badgerStorage) {
  let id = 1,
    rules = [];

  for (let domain of badgerStorage.getStore('action_map').keys()) {
    let base = getBaseDomain(domain);
    if (base != domain) {
      continue;
    }

    // note: DNT is ignored as isCheckingDNTPolicyEnabled() is false
    let action = badgerStorage.getBestAction(domain);
    if (action == constants.BLOCK || action == constants.COOKIEBLOCK) {
      rules.push(utils.makeDnrBlockRule(id, domain));
      id++;
    }
  }

  // block known CDN-hosted fingerprinters
  // https://github.com/EFForg/privacybadger/pull/2891
  let fpStore = badgerStorage.getStore('fp_scripts');
  for (let domain of constants.FP_CDN_DOMAINS) {
    if (badgerStorage.getBestAction(domain) != constants.COOKIEBLOCK) {
      continue;
    }

    if (!fpStore.getItem(domain)) {
      continue;
    }

    if (sdb.hostnames[domain]) {
      if (sdb.hostnames[domain].match == sdb.MATCH_SUFFIX) {
        for (let token of sdb.hostnames[domain].tokens) {
          rules.push(
            utils.makeDnrFpScriptSurrogateRule(
              id, domain, token, sdb.surrogates[token]));
          id++;
        }
      } else {
        console.error(`Failed to create script surrogate rule for ${domain}:
Time to add support for ${sdb.hostnames[domain].match} matching`);
      }
    }
    for (let path of Object.keys(fpStore.getItem(domain))) {
      rules.push(utils.makeDnrFpScriptBlockRule(id, domain, path));
      id++;
    }
  }

  return rules;
}

function main() {
  let badgerStorage = new BadgerPen(async function () {
    badger.heuristicBlocking = new HeuristicBlocking.HeuristicBlocker(badgerStorage);
    badger.storage = badgerStorage;
    badger.getPrivateSettings = () => badger.storage.getStore('private_storage');

    badgerStorage.updateYellowlist(
      fs.readFileSync("src/data/yellowlist.txt", 'utf8').trim().split("\n"));

    badgerStorage.mergeUserData(
      JSON.parse(fs.readFileSync("src/data/seed.json", 'utf8')));

    let seedRules = make_seed_rules(badgerStorage);
    // TODO print summary of rule counts and analyze viz-a-viz the various rule limits, for example:
    // TODO All types of rules can use regular expressions; however, the total number of regular expression rules of each type cannot exceed 1000. This is called the MAX_NUMBER_OF_REGEX_RULES.
    // TODO compare rule counts to verify.py
    fs.writeFileSync("src/data/dnr/seed.json",
      JSON.stringify(seedRules, null, 2), 'utf8');
    console.log(`Generated ${seedRules.length} seed block rules`);

    let surrogatesRules = make_surrogates_rules();
    fs.writeFileSync("src/data/dnr/surrogates.json",
      JSON.stringify(surrogatesRules, null, 2), 'utf8');
    console.log(`Generated ${surrogatesRules.length} surrogates rules`);

    let dntSignalRules = make_dnt_signal_rules();
    fs.writeFileSync("src/data/dnr/dnt_signal.json",
      JSON.stringify(dntSignalRules, null, 2), 'utf8');
    console.log(`Generated ${dntSignalRules.length} DNT signal rules`);

    let dntPolicyRule = make_dnt_policy_rule();
    fs.writeFileSync("src/data/dnr/dnt_policy.json",
      JSON.stringify(dntPolicyRule, null, 2), 'utf8');
    console.log(`Generated 1 EFF's DNT policy rule`);
  });
}

main();
