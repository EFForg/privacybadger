export type BadgerMessages =
  | "getPopupData"
  | "getOptionsData"
  | "resetData"
  | "removeAllData"
  | "activateOnSite"
  | "deactivateOnSite"
  | "revertDomainControl"
  | "downloadCloud"
  | "uploadCloud"
  | "savePopupToggle"
  | "saveOptionsToggle"
  | "mergeUserData"
  | "updateSettings"
  | "setPrivacyOverrides"
  | "disablePrivacyBadgerForOrigin"
  | "enablePrivacyBadgerForOriginList";

export type Actions =
  | "block"
  | "allow"
  | "cookieblock"
  | "user_block"
  | "user_allow"
  | "user_cookieblock";

export const parseAction = (
  action: string
): { setByUser: boolean; action: Actions } => {
  let setByUser = false;
  let parsedAction = action;
  if (action.includes("user_")) {
    [, parsedAction] = action.split("_");
    setByUser = true;
  }
  return { action: parsedAction as Actions, setByUser };
};

type Settings = {
  checkForDNTPolicy: boolean;
  disableGoogleNavErrorService: boolean;
  disableHyperlinkAuditing: boolean;
  disabledSites: [];
  hideBlockedElements: boolean;
  learnInIncognito: boolean;
  learnLocally: boolean;
  migrationLevel: number;
  preventWebRTCIPLeak: boolean;
  seenComic: boolean;
  sendDNTSignal: boolean;
  showCounter: boolean;
  showIntroPage: boolean;
  showNonTrackingDomains: boolean;
  showTrackingDomains: boolean;
  socialWidgetReplacementEnabled: boolean;
  widgetReplacementExceptions: [];
  widgetSiteAllowlist: OriginBlocks;
};

type Request = {
  origin: string;
  action: Actions;
};

export type OriginBlocks = {
  [key: string]: Actions;
};

type Options = {
  [key: string]: boolean;
};

export type BadgerData = {
  cookieblocked?: Options;
  enabled?: boolean;
  learnLocally?: boolean;
  noTabData?: boolean;
  origins?: OriginBlocks;
  seenComic?: boolean;
  showLearningPrompt?: boolean;
  showNonTrackingDomains?: boolean;
  tabHost?: string;
  tabId?: number;
  tabUrl?: string;
  trackerCount?: number;
};

export type BadgerOptions = {
  cookieBlocked?: Options;
  origins?: OriginBlocks;
  settings?: Settings;

  isWidgetReplacementEnabled?: boolean;
  webRTCAvailable?: boolean;
  widgets?: string[];
};

const getTab = async () => {
  const [tab] = await browser.tabs.query({
    active: true,
    lastFocusedWindow: true,
  });
  return tab;
};

export const sendBadgerMessage = async (
  message: BadgerMessages,
  extra?: Request
) => {
  const { id: tabId, url: tabUrl } = await getTab();
  const data = await browser.runtime.sendMessage({
    type: message,
    tabId,
    tabUrl,
    ...(extra ?? {}),
  });
  return data;
};

export const resetData = async () => {
  const { id: tabId, url: tabUrl } = await getTab();
  const data = await browser.runtime.sendMessage({
    type: "resetData",
    tabId,
    tabUrl,
  });
  return data;
};

export const removeAllData = async () => {
  const { id: tabId, url: tabUrl } = await getTab();
  const data = await browser.runtime.sendMessage({
    type: "removeAllData",
    tabId,
    tabUrl,
  });
  return data;
};

export const activateOnSite = async () => {
  const { id: tabId, url: tabUrl } = await getTab();
  const data = await browser.runtime.sendMessage({
    type: "activateOnSite",
    tabId,
    tabUrl,
  });
  return data;
};

export const deactivateOnSite = async () => {
  const { id: tabId, url: tabUrl } = await getTab();
  const data = await browser.runtime.sendMessage({
    type: "deactivateOnSite",
    tabId,
    tabUrl,
  });
  return data;
};

export const getBadgerData = async () => {
  const data = await sendBadgerMessage("getPopupData");
  return data as BadgerData;
};

export const getBadgerOptions = async () => {
  const data = await sendBadgerMessage("getOptionsData");
  return data as BadgerOptions;
};

export const savePopupToggle = (origin: string, action: Actions) => {
  sendBadgerMessage("savePopupToggle", {
    origin,
    action,
  });
};
