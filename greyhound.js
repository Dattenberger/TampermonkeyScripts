// ==UserScript==
// @name         Greyhound Alt+J
// @version      1.1
// @description  Löst beim Drücken von Alt+J einen Klick auf "Erstelle Anrede" aus – auch in dynamisch hinzugefügten iframes.
// @namespace    https://github.com/Dattenberger/TampermonkeyScripts
// @author       Lukas Dattenberger
// @updateURL    https://raw.githubusercontent.com/Dattenberger/TampermonkeyScripts/main/greyhound.js
// @downloadURL  https://raw.githubusercontent.com/Dattenberger/TampermonkeyScripts/main/greyhound.js

// @match        https://greyhound.dattenberger.com/web/unity/*
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

// Make the email title selectable by the user so they can copy the text.
(function() {
    'use strict';
    GM_addStyle('.chatView__header__subject___90376f74{user-select: text;}');
})();


// Ali + J -> "Erstelle Anrede"
(() => {
    // 2) Handler-Funktion
    function onAltJ(e) {
        if (e.altKey && e.key.toLowerCase() === 'j') {
            console.log(e)

            e.preventDefault();
            // Klick im parent-Dokument
            let anredeElement = $('[role=menuitem]:contains("Erstelle Anrede")')
            if (anredeElement.length === 0) {
                $('[title="KI generierter Inhalt"]').click();
                anredeElement = $('[role=menuitem]:contains("Erstelle Anrede")')
            }
            anredeElement.click();
        }
    }

    function processIframe() {
        const iframeJQ = $("iframe");
        const iframe = iframeJQ[0];
        if(!iframe || iframeJQ.data("tempermonky-processed")) return;

        iframeJQ.data("tempermonky-processed", true);

        console.log("processing iframe");

        // 3) Listener-Anhänger für das Iframe‑Document
        function attachListener() {
            const doc = iframe.contentDocument || iframe.contentWindow.document;
            if (!doc) return;

            //make sure we don't add the listener multiple times
            doc.removeEventListener('keydown', onAltJ, false);

            doc.addEventListener('keydown', onAltJ, false);
        }

        // 4) Prüfen, ob das Iframe schon vollständig ready ist
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        if (doc && doc.readyState === 'complete') {
            // schon geladen → direkt anhängen
            attachListener();
        } else {
            // noch nicht loaded → beim Load-Event anhängen
            iframe.addEventListener('load', attachListener);
        }
    }

    // Select the node that will be observed for mutations

// Options for the observer (which mutations to observe)
    const config = { attributes: true, childList: true, subtree: true };

// Callback function to execute when mutations are observed
    const callback = (mutationList, observer) => {
        let hasIframe = false;

        //if jQuery is not loaded we don't neet to continue
        if(typeof $ === "undefined")
            return;

        for (const mutation of mutationList) {
            if(mutation.target.nodeName === "IFRAME" || $(mutation.target).has("iframe").length !== 0)
                hasIframe = true;
        }

        if(!hasIframe)
            return;

        processIframe();
    };

// Create an observer instance linked to the callback function
    const observer = new MutationObserver(callback);

// Start observing the target node for configured mutations
    observer.observe(document, config);
})();
