require.scopes.tabdata = (function() {

function newFrame(url, id, parentId) {
  let out = {
    url,
    id,
    parentId,
    frames: new Map(),
    origins: new Set(),
  };
  out.frames.set(id, out); // this.id refers to self
  return out;
}

function TabData() {
  this._data = new Map();
  let self = this;
  chrome.tabs.query({}, tabs => {
    tabs.forEach(tab => {
      self.recordMainFrame({url: tab.url, tabId: tab.id, frameId: 0});
    });
  });
}

TabData.prototype = {
  hasTab: function(tabId) {
    return this._data.has(tabId);
  },

  getTab: function(tabId) {
    return this._data.get(tabId);
  },

  setTab: function(tabId, obj) {
    return this._data.set(tabId, obj);
  },

  forgetTab: function(tabId) {
    return this._data.delete(tabId);
  },

  logRequest: function(details) {
    if (details.type.endsWith('_frame')) {
      this.recordFrame(details);
    } else {
      if (!this.hasTab(details.tabId)) {
        return;
      }
      this.recordOrigin(details);
    }
  },

  recordMainFrame: function(details) {
    if (details.frameId != 0 && details.type == 'main_frame') {
      details.frameId = 0;
    }
    let frame = newFrame(details.url, details.tabId, -1);
    this.setTab(details.tabId, frame);
    return frame;
  },

  recordSubFrame: function(details) {
    let tab = this.getTab(details.tabId),
      frame = newFrame(details.url, details.frameId, details.parentFrameId);
    // add new frame
    tab.frames.set(details.frameId, frame);
    // link parent to new frame
    tab.frames.get(details.parentFrameId).frames.set(details.frameId, frame);
    // record the frame origin
    this.recordOrigin(details);
  },

  recordFrame: function(details) {
    if (details.type.startsWith('main')) {
      this.recordMainFrame(details);
    } else {
      this.recordSubFrame(details);
    }
  },

  recordOrigin: function(details) {
    let og = window.extractHostFromURL(details.url),
      tab = this.getTab(details.tabId);

    if (!tab) {
      tab = this.recordMainFrame(details);
    }
    tab.origins.add(og);

    if (!tab.frames.has(details.frameId)) {
      this.recordSubFrame(details);
    }
    tab.frames.get(details.frameId).origins.add(og);
  },
};

return {TabData};
})();
