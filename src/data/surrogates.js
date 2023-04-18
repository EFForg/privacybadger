/*
 * This file is part of Privacy Badger <https://privacybadger.org/>
 * Copyright (C) 2016 Electronic Frontier Foundation
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

const MATCH_SUFFIX = 'suffix',
  MATCH_PREFIX = 'prefix',
  MATCH_PREFIX_WITH_PARAMS = 'prefix_params',
  MATCH_ANY = 'any';

/**
 * `hostnames` maps hostnames to surrogate pattern tokens.
 */
const hostnames = {
  'b.scorecardresearch.com': {
    match: MATCH_SUFFIX,
    tokens: [
      '/beacon.js',
      '/c2/plugins/streamsense_plugin_html5.js',
    ]
  },
  'sb.scorecardresearch.com': {
    match: MATCH_SUFFIX,
    tokens: [
      '/beacon.js',
      '/c2/plugins/streamsense_plugin_html5.js',
    ]
  },
  'ssl.google-analytics.com': {
    match: MATCH_SUFFIX,
    tokens: [
      '/ga.js',
      '/analytics.js',
    ]
  },
  'www.google-analytics.com': {
    match: MATCH_SUFFIX,
    tokens: [
      '/analytics.js',
      '/ga.js',
    ]
  },
  'www.googletagmanager.com': {
    match: MATCH_SUFFIX,
    tokens: [
      '/gtm.js',
    ]
  },
  'www.googletagservices.com': {
    match: MATCH_SUFFIX,
    tokens: [
      '/gpt.js',
    ]
  },
  'securepubads.g.doubleclick.net': {
    match: MATCH_SUFFIX,
    tokens: [
      '/tag/js/gpt.js',
    ]
  },
  'pagead2.googlesyndication.com': {
    match: MATCH_SUFFIX,
    tokens: [
      '/tag/js/gpt.js',
      '/omweb-v1.js',
    ]
  },
  'api.youneeq.ca': {
    match: MATCH_SUFFIX,
    tokens: [
      '/app/yqmin',
    ]
  },
  'cdn.krxd.net': {
    match: MATCH_ANY,
    token: 'noopjs'
  },
  'widgets.outbrain.com': {
    match: MATCH_SUFFIX,
    tokens: [
      '/outbrain.js',
    ]
  },
  'c.amazon-adsystem.com': {
    match: MATCH_SUFFIX,
    tokens: [
      '/apstag.js',
    ]
  },
  'rumble.com': {
    match: MATCH_PREFIX,
    tokens: [
      '/embedJS/',
    ],
    widgetName: "Rumble Video Player"
  },
  'www.google.com': {
    match: MATCH_PREFIX_WITH_PARAMS,
    params: {
      onload: true,
      //render: "explicit",
      render: true,
    },
    tokens: [
      '/recaptcha/api.js',
      '/recaptcha/enterprise.js',
    ],
    widgetName: "Google reCAPTCHA"
  },
  'www.recaptcha.net': {
    match: MATCH_PREFIX_WITH_PARAMS,
    params: {
      onload: true,
      render: true,
    },
    tokens: [
      '/recaptcha/api.js',
      '/recaptcha/enterprise.js',
    ],
    widgetName: "Google reCAPTCHA"
  },
  'www.youtube.com': {
    match: MATCH_PREFIX,
    tokens: [
      '/iframe_api',
      '/player_api',
    ],
    widgetName: "YouTube"
  },
  'cdn.jsdelivr.net': {
    match: MATCH_SUFFIX,
    tokens: [
      '/npm/@fingerprintjs/fingerprintjs@3/dist/fp.js',
      '/npm/@fingerprintjs/fingerprintjs@3/dist/fp.min.js',
      '/npm/@fingerprintjs/fingerprintjs@3.3.2/dist/fp.js',
    ]
  },
};

/**
 * `surrogates` maps pattern tokens to web accessible resource URLs
 * containing the actual surrogate script code.
 */
const surrogates = {
  // Google Analytics (legacy ga.js)
  //
  // test cases:
  // http://checkin.avianca.com/
  // https://www.vmware.com/support/pubs/ws_pubs.html (release notes links)
  //
  // API reference:
  // https://developers.google.com/analytics/devguides/collection/gajs/methods/
  '/ga.js': 'google_ga.js',

  '/beacon.js': 'comscore_beacon.js',

  // http://www.dplay.se/ett-jobb-for-berg/ (videos)
  '/c2/plugins/streamsense_plugin_html5.js': 'noop.js',

  '/gtm.js': 'googletagmanager_gtm.js',

  // https://github.com/EFForg/privacybadger/issues/993
  '/gpt.js': 'googletagservices_gpt.js',
  '/tag/js/gpt.js': 'googletagservices_gpt.js',

  // https://github.com/EFForg/privacybadger/issues/1014
  '/app/yqmin': 'youneeq.js',

  '/analytics.js': 'google_analytics.js',

  '/outbrain.js': 'outbrain.js',

  '/apstag.js': 'amazon_apstag.js',

  '/embedJS/': 'rumble_embedjs.js',

  '/recaptcha/api.js': 'grecaptcha.js',
  '/recaptcha/enterprise.js': 'grecaptcha_enterprise.js',

  '/iframe_api': 'youtube.js',
  '/player_api': 'youtube.js',

  '/npm/@fingerprintjs/fingerprintjs@3/dist/fp.js': 'fingerprintjs3.js',
  '/npm/@fingerprintjs/fingerprintjs@3/dist/fp.min.js': 'fingerprintjs3.js',
  '/npm/@fingerprintjs/fingerprintjs@3.3.2/dist/fp.js': 'fingerprintjs3.js',

  '/omweb-v1.js': 'noop.js',

  'noopjs': 'noop.js'
};

// expand filenames to extension URLs
Object.keys(surrogates).forEach(key => {
  let path = '/data/web_accessible_resources/' + surrogates[key];
  surrogates[key] = chrome.runtime.getURL(path);
});

export default {
  MATCH_ANY,
  MATCH_PREFIX,
  MATCH_PREFIX_WITH_PARAMS,
  MATCH_SUFFIX,
  hostnames,
  surrogates,
};
