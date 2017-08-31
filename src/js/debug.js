require.scopes.debug = (function() {
let cookieFields = [
  'domain',
  'expirationDate',
  'hostOnly',
  'httpOnly',
  'name',
  'path',
  'sameSite',
  'secure',
  'session',
];

function printCookies(domain) {
  getCookies(domain, true, cookies => {
    cookies[domain].forEach(cookie => {
      console.log('----------------');
      console.log(JSON.stringify(cookie, null, 2));
    });
  });
}

function getCookies(domain, showRelated, callback) {
  let out = {[domain]: []};
  if (showRelated) {
    domain = window.getBaseDomain(domain);
  }
  chrome.cookies.getAll({domain}, cookies => {
    cookies.forEach(cookie => {
      let info = {};
      cookieFields.forEach(field => {
        if (field in cookie) {
          info[field] = cookie[field];
        }
      });
      out[domain].push(info);
    });
    callback(out);
  });
}

function debugTab(tab) {
  let action_map = window.badger.storage.getBadgerStorageObject('action_map').getItemClones(),
    snitch_map = window.badger.storage.getBadgerStorageObject('snitch_map').getItemClones(),
    seen = new Set(),
    out = {
      info: {
        origins: [],
        action_maps: {},
        snitch_maps: {},
        browser: window.navigator.userAgent,
        version: chrome.runtime.getManifest().version,
        fqdn: window.extractHostFromURL(tab.url),
      }
    };
  window.badger.getAllOriginsForTab(tab.id).forEach(origin => {
    let base = window.getBaseDomain(origin);
    out.info.origins.push(origin);
    for (let am_fqdn in action_map) {  // look for domains related to this origin in the action_map
      if (base == window.getBaseDomain(am_fqdn) && !seen.has(am_fqdn)) {
        seen.add(am_fqdn);
        out.info.action_maps[am_fqdn] = action_map[am_fqdn];
        if (base in snitch_map) {
          out.info.snitch_maps[base] = snitch_map[base];
        }
      }
    }
  });
  return out;
}

function debugSite() {
  chrome.tabs.query({'active': true}, tabs => {
    tabs.forEach(tab => {
      console.log('------- Debug info for tab with url: %s -------', tab.url);
      console.log(JSON.stringify(debugTab(tab), null, 2));
    });
  });
}
return {cookieFields, printCookies, getCookies, debugTab, debugSite};
})();
