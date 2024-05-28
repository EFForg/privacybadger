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

globalThis.DEBUG = true;

let time_prev = null,
  time_total = 0,
  // make local ref. to avoid problems caused by fake timers on the unit tests page
  DATE = Date;

function float_fmt(num) {
  return num.toLocaleString(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  });
}

/**
 * Log a message to the console if debugging is enabled
 */
function log(/*...*/) {
  if (!globalThis.DEBUG) {
    return;
  }

  let time_now = +new DATE,
    time_diff = "";

  if (time_prev) {
    time_diff = time_now - time_prev;
    time_total += time_diff;
  }
  time_prev = time_now;

  let args = Array.from(arguments),
    time_total_fmt = float_fmt(time_total / 1000) + "s",
    time_diff_fmt = (time_diff ? (time_diff > 999 ? float_fmt(time_diff / 1000) + "s" : time_diff + "ms") : ""),
    num_spaces = 16 - time_total_fmt.length - 1 - time_diff_fmt.length,
    spaces_fmt = (num_spaces > 0 ? " ".repeat(num_spaces) : " ");

  if (time_diff > 99) {
    time_diff_fmt = '%c' + time_diff_fmt + '%c';
    // insert styles as second and third args
    args.splice(1, 0, 'color:yellow', 'color:auto');
  }

  // prepend first arg with timing info
  args[0] = time_total_fmt + " " + time_diff_fmt + spaces_fmt + args[0];

  console.log.apply(console, args);
}

export {
  log
};
