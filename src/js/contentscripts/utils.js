/*
 * This file is part of Privacy Badger <https://www.eff.org/privacybadger>
 * Copyright (C) 2018 Electronic Frontier Foundation
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

function getFrameUrl() {
  let url = document.location.href,
    parentFrame = (document != window.top) && window.parent;
  while (parentFrame && url && !url.startsWith("http")) {
    try {
      url = parentFrame.document.location.href;
    } catch (ex) {
      // ignore 'Blocked a frame with origin "..."
      // from accessing a cross-origin frame.' exceptions
    }
    parentFrame = (parentFrame != window.top) && parentFrame.parent;
  }
  return url;
}
window.FRAME_URL = getFrameUrl();
