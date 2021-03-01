/* 
This file privdes overides to https://github.com/Openmail/privacybadger/blob/master/src/js/background.js
*/

// Disable privacy badger icon updates
window.badger.updateBadge = () => {
    /* NOOP */
};
window.badger.updateIcon = () => {
    /* NOOP */
};
