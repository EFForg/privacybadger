"use strict";

/*
 * Copyright (C) 2021 Surfboard Holding B.V. <https://www.startpage.com>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCopyablesPaths = exports.getManifestFragmentPath = exports.updatePrivacyOverride = exports.updateSettings = exports.revertDomainControl = exports.savePopupToggle = exports.getPrivacyOptions = exports.getPrivacyData = exports.deactivateOnSite = exports.activateOnSite = exports.removeAllData = exports.resetData = exports.getTab = void 0;
const getTab = () => __awaiter(void 0, void 0, void 0, function* () {
    const [tab] = yield browser.tabs.query({
        active: true,
        currentWindow: true
    });
    return tab;
});
exports.getTab = getTab;
const sendBadgerMessage = (message, extra) => __awaiter(void 0, void 0, void 0, function* () {
    const { id: tabId, url: tabUrl } = yield exports.getTab();
    return yield browser.runtime.sendMessage(Object.assign({ type: message, tabId,
        tabUrl }, (extra !== null && extra !== void 0 ? extra : {})));
});
const resetData = () => __awaiter(void 0, void 0, void 0, function* () {
    const { id: tabId, url: tabUrl } = yield exports.getTab();
    return yield browser.runtime.sendMessage({
        type: 'resetData',
        tabId,
        tabUrl
    });
});
exports.resetData = resetData;
const removeAllData = () => __awaiter(void 0, void 0, void 0, function* () {
    const { id: tabId, url: tabUrl } = yield exports.getTab();
    return yield browser.runtime.sendMessage({
        type: 'removeAllData',
        tabId,
        tabUrl
    });
});
exports.removeAllData = removeAllData;
const activateOnSite = () => __awaiter(void 0, void 0, void 0, function* () {
    console.log('trying to activate');
    const { id: tabId, url: tabUrl } = yield exports.getTab();
    console.log(`${tabId}, ${tabUrl}`);
    return yield browser.runtime.sendMessage({
        type: 'activateOnSite',
        tabId,
        tabUrl
    });
});
exports.activateOnSite = activateOnSite;
const deactivateOnSite = () => __awaiter(void 0, void 0, void 0, function* () {
    const { id: tabId, url: tabUrl } = yield exports.getTab();
    return yield browser.runtime.sendMessage({
        type: 'deactivateOnSite',
        tabId,
        tabUrl
    });
});
exports.deactivateOnSite = deactivateOnSite;
const getPrivacyData = () => __awaiter(void 0, void 0, void 0, function* () {
    const data = yield sendBadgerMessage('getPopupData');
    return data;
});
exports.getPrivacyData = getPrivacyData;
const getPrivacyOptions = () => __awaiter(void 0, void 0, void 0, function* () {
    const data = yield sendBadgerMessage('getOptionsData');
    return data;
});
exports.getPrivacyOptions = getPrivacyOptions;
const savePopupToggle = (origin, action) => __awaiter(void 0, void 0, void 0, function* () {
    return yield sendBadgerMessage('savePopupToggle', {
        origin,
        action
    });
});
exports.savePopupToggle = savePopupToggle;
const revertDomainControl = (origin) => __awaiter(void 0, void 0, void 0, function* () {
    return yield sendBadgerMessage('revertDomainControl', { origin });
});
exports.revertDomainControl = revertDomainControl;
const updateSettings = (settings) => __awaiter(void 0, void 0, void 0, function* () {
    return yield browser.runtime.sendMessage({
        type: 'updateSettings',
        data: settings
    });
});
exports.updateSettings = updateSettings;
const updatePrivacyOverride = (settings) => __awaiter(void 0, void 0, void 0, function* () {
    yield exports.updateSettings(settings);
    return yield browser.runtime.sendMessage({
        type: 'setPrivacyOverride'
    });
});
exports.updatePrivacyOverride = updatePrivacyOverride;
const getManifestFragmentPath = () => {
    return `manifest-fragment.json`;
};
exports.getManifestFragmentPath = getManifestFragmentPath;
const getCopyablesPaths = () => {
    const SRC_PATH = 'src';
    const copyables = [`${SRC_PATH}/data`, `${SRC_PATH}/js`, `${SRC_PATH}/lib`, 'sp-js'];
    return copyables;
};
exports.getCopyablesPaths = getCopyablesPaths;
