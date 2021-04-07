var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
export const getTab = () => __awaiter(void 0, void 0, void 0, function* () {
    const [tab] = yield browser.tabs.query({
        active: true,
        currentWindow: true
    });
    return tab;
});
const sendBadgerMessage = (message, extra) => __awaiter(void 0, void 0, void 0, function* () {
    const { id: tabId, url: tabUrl } = yield getTab();
    return yield browser.runtime.sendMessage(Object.assign({ type: message, tabId,
        tabUrl }, (extra !== null && extra !== void 0 ? extra : {})));
});
export const resetData = () => __awaiter(void 0, void 0, void 0, function* () {
    const { id: tabId, url: tabUrl } = yield getTab();
    return yield browser.runtime.sendMessage({
        type: 'resetData',
        tabId,
        tabUrl
    });
});
export const removeAllData = () => __awaiter(void 0, void 0, void 0, function* () {
    const { id: tabId, url: tabUrl } = yield getTab();
    return yield browser.runtime.sendMessage({
        type: 'removeAllData',
        tabId,
        tabUrl
    });
});
export const activateOnSite = () => __awaiter(void 0, void 0, void 0, function* () {
    console.log('trying to activate');
    const { id: tabId, url: tabUrl } = yield getTab();
    console.log(`${tabId}, ${tabUrl}`);
    return yield browser.runtime.sendMessage({
        type: 'activateOnSite',
        tabId,
        tabUrl
    });
});
export const deactivateOnSite = () => __awaiter(void 0, void 0, void 0, function* () {
    const { id: tabId, url: tabUrl } = yield getTab();
    return yield browser.runtime.sendMessage({
        type: 'deactivateOnSite',
        tabId,
        tabUrl
    });
});
export const getPrivacyData = () => __awaiter(void 0, void 0, void 0, function* () {
    const data = yield sendBadgerMessage('getPopupData');
    return data;
});
export const getPrivacyOptions = () => __awaiter(void 0, void 0, void 0, function* () {
    const data = yield sendBadgerMessage('getOptionsData');
    return data;
});
export const savePopupToggle = (origin, action) => __awaiter(void 0, void 0, void 0, function* () {
    return yield sendBadgerMessage('savePopupToggle', {
        origin,
        action
    });
});
export const revertDomainControl = (origin) => __awaiter(void 0, void 0, void 0, function* () {
    return yield sendBadgerMessage('revertDomainControl', { origin });
});
export const updateSettings = (settings) => __awaiter(void 0, void 0, void 0, function* () {
    return yield browser.runtime.sendMessage({
        type: 'updateSettings',
        data: settings
    });
});
export const updatePrivacyOverride = (settings) => __awaiter(void 0, void 0, void 0, function* () {
    yield updateSettings(settings);
    return yield browser.runtime.sendMessage({
        type: 'setPrivacyOverride'
    });
});
export const getManifestFragmentPath = () => {
    return `manifest-fragment.json`;
};
export const getCopyablesPaths = () => {
    const SRC_PATH = 'src';
    const copyables = [`${SRC_PATH}/data`, `${SRC_PATH}/js`, `${SRC_PATH}/lib`, 'sp-js'];
    return copyables;
};
