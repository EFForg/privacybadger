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

let noop = function () {};

let Migrations= {

  changePrivacySettings: noop,
  migrateAbpToStorage: noop,
  migrateBlockedSubdomainsToCookieblock: noop,
  migrateLegacyFirefoxData: noop,
  migrateDntRecheckTimes: noop,
  migrateDntRecheckTimes2: noop,
  forgetMistakenlyBlockedDomains: noop,
  unblockIncorrectlyBlockedDomains: noop,
  forgetBlockedDNTDomains: noop,
  reapplyYellowlist: noop,
  forgetNontrackingDomains: noop,
  resetWebRTCIPHandlingPolicy: noop,
  enableShowNonTrackingDomains: noop,
  forgetFirstPartySnitches: noop,
  forgetCloudflare: noop,
  forgetConsensu: noop,
  resetWebRTCIPHandlingPolicy2: noop,
  resetWebRtcIpHandlingPolicy3: noop,
  forgetOpenDNS: noop,
  unsetWebRTCIPHandlingPolicy: noop,

};

export {
  Migrations,
};
