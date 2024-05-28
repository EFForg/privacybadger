#!/usr/bin/env node

import * as fs from 'fs';

import "./lib/preImportShims.js";

import constants from "../src/js/constants.js";

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

function main() {
  let dntSignalRules = make_dnt_signal_rules();
  fs.writeFileSync("src/data/dnr/dnt_signal.json",
    JSON.stringify(dntSignalRules, null, 2), 'utf8');
  console.log(`Generated ${dntSignalRules.length} DNT signal rules`);

  let dntPolicyRule = make_dnt_policy_rule();
  fs.writeFileSync("src/data/dnr/dnt_policy.json",
    JSON.stringify(dntPolicyRule, null, 2), 'utf8');
  console.log(`Generated 1 EFF's DNT policy rule`);
}

main();
