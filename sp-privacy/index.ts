type BadgerMessages =
    | 'getPopupData'
    | 'getOptionsData'
    | 'resetData'
    | 'removeAllData'
    | 'activateOnSite'
    | 'deactivateOnSite'
    | 'revertDomainControl'
    | 'downloadCloud'
    | 'uploadCloud'
    | 'savePopupToggle'
    | 'saveOptionsToggle'
    | 'mergeUserData'
    | 'updateSettings'
    | 'setPrivacyOverrides'
    | 'disablePrivacyBadgerForOrigin'
    | 'enablePrivacyBadgerForOriginList';

export type Actions = 'block' | 'allow' | 'cookieblock' | 'user_block' | 'user_allow' | 'user_cookieblock' | 'noaction';

type Settings = {
    checkForDNTPolicy: boolean;
    disableGoogleNavErrorService: boolean;
    disableHyperlinkAuditing: boolean;
    disableNetworkPrediction: boolean;
    disabledSites: string[];
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
    widgetReplacementExceptions: string[];
    widgetSiteAllowlist: OriginBlocks;
};

type Request = {
    origin: string;
    action?: Actions;
    tabId?: number;
};

export type OriginBlocks = {
    [key: string]: Actions;
};

type Options = {
    [key: string]: boolean;
};

export type PrivacyData = {
    cookieblocked: Options;
    enabled: boolean;
    learnLocally: boolean;
    noTabData: boolean;
    origins: OriginBlocks;
    seenComic: boolean;
    showLearningPrompt: boolean;
    showNonTrackingDomains: boolean;
    tabHost: string;
    tabId: number;
    tabUrl: string;
    trackerCount: number;
};

export type PrivacyOptions = {
    cookieBlocked: Options;
    origins: OriginBlocks;
    settings: Settings;
    isWidgetReplacementEnabled: boolean;
    webRTCAvailable: boolean;
    widgets: string[];
};

export const getTab = async () => {
    const [tab] = await browser.tabs.query({
        active: true,
        currentWindow: true
    });
    return tab;
};

const sendBadgerMessage = async (message: BadgerMessages, extra?: Request) => {
    const {id: tabId, url: tabUrl} = await getTab();
    return await browser.runtime.sendMessage({
        type: message,
        tabId,
        tabUrl,
        ...(extra ?? {})
    });
};

export const resetData = async () => {
    const {id: tabId, url: tabUrl} = await getTab();
    return await browser.runtime.sendMessage({
        type: 'resetData',
        tabId,
        tabUrl
    });
};

export const removeAllData = async () => {
    const {id: tabId, url: tabUrl} = await getTab();
    return await browser.runtime.sendMessage({
        type: 'removeAllData',
        tabId,
        tabUrl
    });
};

export const activateOnSite = async () => {
    console.log('trying to activate');
    const {id: tabId, url: tabUrl} = await getTab();
    console.log(`${tabId}, ${tabUrl}`);
    return await browser.runtime.sendMessage({
        type: 'activateOnSite',
        tabId,
        tabUrl
    });
};

export const deactivateOnSite = async () => {
    const {id: tabId, url: tabUrl} = await getTab();
    return await browser.runtime.sendMessage({
        type: 'deactivateOnSite',
        tabId,
        tabUrl
    });
};

export const getPrivacyData = async () => {
    const data = await sendBadgerMessage('getPopupData');
    return data as PrivacyData;
};

export const getPrivacyOptions = async () => {
    const data = await sendBadgerMessage('getOptionsData');
    return data as PrivacyOptions;
};

export const savePopupToggle = async (origin: string, action: Actions) => {
    return await sendBadgerMessage('savePopupToggle', {
        origin,
        action
    });
};

export const revertDomainControl = async (origin: string) => {
    return await sendBadgerMessage('revertDomainControl', {origin});
};

export const updateSettings = async (settings: Settings) => {
    return await browser.runtime.sendMessage({
        type: 'updateSettings',
        data: settings
    });
};

export const updatePrivacyOverride = async (settings: Settings) => {
    await updateSettings(settings);
    return await browser.runtime.sendMessage({
        type: 'setPrivacyOverride'
    });
};

export const getManifestFragmentPath = () => {
    return `manifest-fragment.json`;
};

export const getCopyablesPaths = () => {
    const SRC_PATH = 'src';
    const copyables = [`${SRC_PATH}/data`, `${SRC_PATH}/js`, `${SRC_PATH}/lib`, 'sp-js', 'sp-icons'];
    return copyables;
};
