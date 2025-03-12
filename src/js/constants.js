/*
 * This file is part of Privacy Badger <https://privacybadger.org/>
 * Copyright (C) 2014 Electronic Frontier Foundation
 *
 * Privacy Badger is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Privacy Badger is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Privacy Badger.  If not, see <http://www.gnu.org/licenses/>.
 */

let exports = {
  // Tracking status constants
  NO_TRACKING: "noaction",
  ALLOW: "allow",
  BLOCK: "block",
  COOKIEBLOCK: "cookieblock",
  DNT: "dnt",
  USER_ALLOW: "user_allow",
  USER_BLOCK: "user_block",
  USER_COOKIEBLOCK: "user_cookieblock",

  // URLs
  CNAME_DOMAINS_LOCAL_URL: chrome.runtime.getURL('data/cname_domains.json'),
  PBCONFIG_LOCAL_URL: chrome.runtime.getURL('data/pbconfig.json'),
  PBCONFIG_REMOTE_URL: "https://www.eff.org/files/pbconfig.json",
  SEED_DATA_LOCAL_URL: chrome.runtime.getURL('data/seed.json'),

  // The number of 1st parties a 3rd party can be seen on
  TRACKING_THRESHOLD: 3,
  MAX_COOKIE_ENTROPY: 12,

  DNT_POLICY_CHECK_INTERVAL: 1000, // one second

  PANOPTICLICK_DOMAINS: ["trackersimulator.org", "eviltracker.net"],

  // Browser (modified during the build process)
  BROWSER: "firefox",

  REVIEW_LINKS: {
    chrome: "https://chromewebstore.google.com/detail/privacy-badger/pkehgijcmpdhfbdbbnkijodmdjhbjlgp/reviews",
    firefox: "https://addons.mozilla.org/en-US/firefox/addon/privacy-badger17/",
    edge: "https://microsoftedge.microsoft.com/addons/detail/privacy-badger/mkejgcgkdlddbggjhhflekkondicpnop",
    opera: "https://addons.opera.com/en/extensions/details/privacy-badger/",
  },

  FP_CDN_DOMAINS: new Set([
    'd.alicdn.com',
    's3.us-west-2.amazonaws.com',
    'fp-cdn.azureedge.net',
    'sdtagging.azureedge.net',
    'cdnjs.cloudflare.com',
    'd1af033869koo7.cloudfront.net',
    'd38xvr37kwwhcm.cloudfront.net',
    'dlthst9q2beh8.cloudfront.net',
    'cdn.jsdelivr.net',
    'gadasource.storage.googleapis.com',
  ]),
};

exports.BLOCKED_ACTIONS = new Set([
  exports.BLOCK,
  exports.USER_BLOCK,
  exports.COOKIEBLOCK,
  exports.USER_COOKIEBLOCK,
]);

export default exports;
