require.scopes.tabdata = (function() {

/* events */
function Occurrence(name) {
  this.name = name;
  this.listeners = [];
}

Occurrence.prototype = {
  addListener: function(func) {
    this.listeners.push(func);
  },
  dispatch: function() {
    this.listeners.forEach(func => func.apply(null, arguments));
  },
};

let events = [
  'onForgetTab',
  'onRecordMainFrame',
  'onRecordSubFrame',
  'onLogRequest',
];

/* utils */
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

/* constructor */
function TabData() {
  this._data = new Map();
  this.initializeEvents();
  this.initializeTabs();
}

TabData.prototype = {
  /* initializers */
  initializeEvents: function() {
    events.forEach(name => this[name] = new Occurrence(name));
  },

  initializeTabs: function() {
    let self = this;
    chrome.tabs.query({}, tabs => { // update all tabs
      tabs.forEach(tab => {
        self.recordMainFrame({url: tab.url, tabId: tab.id, frameId: 0});
      });
    });
  },

  /* tab handling */
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
    this.onForgetTab.dispatch(tabId);
    return this._data.delete(tabId);
  },

  /* request accounting */
  recordMainFrame: function(details) {
    // firefox bug, remove when there is no more ff51
    if (details.frameId != 0 && details.type == 'main_frame') {
      details.frameId = 0;
    }

    let frame = newFrame(details.url, details.tabId, -1);

    if (this.hasTab(details.tabId)) {
      this.forgetTab(details.tabId);
    }

    this.setTab(details.tabId, frame);
    this.onRecordMainFrame.dispatch(frame);
    return frame;
  },

  recordSubFrame: function(details) {
    let tab = this.getTab(details.tabId),
      frame = newFrame(details.url, details.frameId, details.parentFrameId),
      parentFrame = tab.frames.get(details.parentFrameId);
    // add new frame
    tab.frames.set(details.frameId, frame);

    // link to its parent frame, if it exists
    if (parentFrame) {
      parentFrame.frames.set(details.frameId, frame);
    }
    this.onRecordSubFrame.dispatch(frame);
    return frame;
  },

  logRequest: function(details) {
    let origin = window.extractHostFromURL(details.url),
      tab = this.getTab(details.tabId),
      frame;

    if (!tab) { // create the tab/main_frame if we don't have it
      tab = this.recordMainFrame(details);
    }

    frame = tab.frames.get(details.frameId);
    if (!frame) { // create sub_frame if we don't have it
      frame = this.recordSubFrame(details);
    }

    tab.origins.add(origin);    // add the origin to the tab
    frame.origins.add(origin);  // add the origin to its frame

    this.onLogRequest.dispatch(tab, frame, origin);
  },

  /* utilities */
  getAllOriginsForTab: function(tabId) {
    return this.getTab(tabId).origins.keys();
  },
};

return {TabData};
})();
