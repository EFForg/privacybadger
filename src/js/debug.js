require.scopes.debug = (function() {
let cookieFields = ['name', 'domain', 'hostOnly', 'path', 'secure', 'httpOnly', 'sameSite', 'session', 'expirationDate'];

function printCookie(cookie, fieldString) {
  if (!fieldString) {
    fieldString = '\t cookie %s: %s';
  }
  cookieFields.forEach(field => {
    if (cookie.hasOwnProperty(field)) {
      console.log(fieldString, field, cookie[field]);
    }
  });
}

function getCookies(domain, showRelated) {
  let msg = 'Cookies for domain: %s',
    out = {};
  if (typeof showRelated == 'undefined') {
    showRelated = true;
  }
  if (showRelated) {
    msg = 'Cookies for domains related to: %s';
    domain = window.getBaseDomain(domain);
  }
  out[domain] = [];
  return new Promise((resolve) => {
    chrome.cookies.getAll({domain}, cookies => {
      cookies.forEach(cookie => {
        let info = {};
        cookieFields.forEach(field => {
          if (cookie.hasOwnProperty(field)) {
            info[field] = cookie[field];
          }
        });
        out[domain].push(info);
      });
      resolve(out);
    });
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
    for (let am_fqdn in action_map) {
      if (base == window.getBaseDomain(am_fqdn) && !seen.has(am_fqdn)) {
        seen.add(am_fqdn);
        out.info.action_maps[am_fqdn] = action_map[am_fqdn];
        if (base in snitch_map) {
          out.info.snitch_maps[base] = snitch_map[base]
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
return {getCookies, debugTab, debugSite};
})();
