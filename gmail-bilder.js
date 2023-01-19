// ==UserScript==
// @name         Gmail CSS (Bilder)
// @namespace    https://github.com/lukasdatte/HusqWebOrder
// @version      1.0.1
// @description  Stellt sicher, dass die Bilder in Gmail nicht breiter als das Fenster werden.
// @author       Lukas Dattenberger
// @match        https://mail.google.com/mail/u/*
// @icon         https://www.google.com/s2/favicons?domain=google.com
// @updateURL    https://raw.githubusercontent.com/lukasdatte/TampermonkeyScripts/main/gmail-bilder.js
// @downloadURL  https://raw.githubusercontent.com/lukasdatte/TampermonkeyScripts/main/gmail-bilder.js
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    GM_addStyle('div[data-message-id] img {max-width: 100%;}');
    console.log('gmail css tempered with - gmail-bilder.js');
})();
