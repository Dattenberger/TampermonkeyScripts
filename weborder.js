// ==UserScript==
// @name         HusqWebOrderOptimizer
// @namespace    https://github.com/Dattenberger/TampermonkeyScripts
// @version      3.1.1
// @description  Dieses Script fügt im Warenkorb der Weborder V1 Einzelpreise hinzu. Skonto wird automatisch mit eingerechnet. Dafür wird ein Button im Warenkorb hinzugefügt.
// @author       Lukas Dattenberger
// @match        http://weborder.husqvarna.com/*basket/basket_view_header.jsp
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @updateURL    https://raw.githubusercontent.com/Dattenberger/TampermonkeyScripts/main/weborder.js
// @downloadURL  https://raw.githubusercontent.com/Dattenberger/TampermonkeyScripts/main/weborder.js
// @require      https://code.jquery.com/jquery-latest.min.js
// ==/UserScript==


(function () {

    // --- local discount factor ---
    // A purchase condition never goes into this public repository: the user enters it once and
    // Tampermonkey keeps it in this browser. The menu entry changes it.
    const FACTOR_KEY = 'husqvarnaDiscountFactor';

    function parseFactor(input) {
        const text = String(input ?? '').trim();
        const value = typeof input === 'number' ? input : /^\d*[.,]?\d+$/.test(text) ? Number(text.replace(',', '.')) : NaN;
        return value > 0 && value <= 1 ? value : null;
    }

    function readFactor() {
        return parseFactor(GM_getValue(FACTOR_KEY));
    }

    function askFactor() {
        for (;;) {
            const shown = readFactor();
            const input = globalThis.prompt(
                'Skonto-Faktor für Husqvarna (Faktor auf den Netto-Preis).\nWird nur lokal in Tampermonkey gespeichert.',
                shown === null ? '' : shown.toLocaleString('de-DE', { useGrouping: false, maximumFractionDigits: 20 }),
            );
            if (input === null) return null;
            const value = parseFactor(input);
            if (value !== null) {
                GM_setValue(FACTOR_KEY, value);
                return value;
            }
            globalThis.alert('Bitte eine Zahl größer 0 und höchstens 1 eingeben.');
        }
    }

    GM_registerMenuCommand('Skonto-Faktor ändern', askFactor);
    // --- end local discount factor ---


    function skontoText(value, digits = 4) {
        const factor = readFactor();
        return factor === null ? '–' : (value * factor).toFixed(digits).toLocaleString("de-DE");
    }

    function artikelpreise() {
        function td(menge, element) {
            element = jQuery(element);
            const text = element.has("span.datte-value").size() > 0 ? element.find("span.datte-value").text() : element.text()

            const wertDouble = Number.parseFloat(text.replace(",", ""));
            const wertText = wertDouble.toFixed(4).toLocaleString("de-DE");
            const stückText = (wertDouble / menge).toFixed(4).toLocaleString("de-DE");
            const stückSkontoText = skontoText(wertDouble / menge);

            element.html(`<span style="display: block; margin-bottom: 5px">${wertText}</span><span style="display: block">${stückText}</span><span style="display: block">${stückSkontoText}</span>`)
        }

        function row(e) {
            const element = jQuery(e);
            const menge = element.find("[id^=\"td_quantity\"]");
            const uvp = element.find("[id^=\"td_grossPrice\"]");
            const ek = element.find("[id^=\"td_netPrice\"]");
            const mengei = Number.parseInt(menge.text());
            td(mengei, uvp)
            td(mengei, ek)

        }
            const rows = jQuery(".orderBasketRow", top.frames["main"].document.getElementsByTagName("frame").content.contentDocument)
            rows.toArray().map(row)
    }

    function observer(){
        const observer = new MutationObserver(function(mutations, observer) {
            // fired when a mutation occurs
            //console.log(mutations, observer);
            for (const mutation of  mutations) {
                const jTarget = jQuery(mutation.target);
                /*const targetIsNetPrice = jTarget.is("[id^=\"td_netPrice\"]")
                const targetIsGrossPrice = jTarget.is("[id^=\"td_grossPrice\"]")*/
                if(jTarget.is("[id^=\"td_netPrice\"]") && jTarget.has("span").length === 0 /*|| (!targetIsNetPrice && !targetIsGrossPrice)*/) {
                    artikelpreise()
                }
            }
        });

        // define what element should be observed by the observer
        // and what types of mutations trigger the callback
        //observer.observe(top.frames["main"].document.getElementsByTagName("frame").content.contentDocument, {
        observer.observe(top.frames["main"].document.getElementsByTagName("frame").content.contentDocument, {
            subtree: true,
            childList: true
        });
    }

    //Den Endpreis mit Skonto ausrechnen
    function endpreis(){
        let ekGesamtElement = jQuery("body > table > tbody > tr > td:nth-child(3) > table > tbody > tr:nth-child(4) > td:nth-child(2)", top.frames["main"].document.getElementsByTagName("frame").bottom.contentDocument)
        let ekGesamtOriginalerEK = ekGesamtElement.find("b");
        let ekGesamt = Number.parseFloat(ekGesamtOriginalerEK.text().replace(",", ""));
        ekGesamtElement.html(`<b>${ekGesamtOriginalerEK.text()}</b><p style="font-weight: bold; margin-top: 5px;">${skontoText(ekGesamt, 2).toLocaleString("de-DE")}</p>`)
    }

    function start(){
        if (readFactor() === null) askFactor();
        try{
            artikelpreise();
            observer(artikelpreise);
            endpreis()
        } catch (e) {
            console.log(e)
        }
    }

    function firstStep(){
        const buttonHtml = "<button id=\"datte-reload\" style=\"\n" +
            "    display: block;\n" +
            "    position: absolute;\n" +
            "    top: 0em;\n" +
            "    right: 1em;\n" +
            "    padding: .3em 1em;\n" +
            "    /* border: 1px solid #ccc; */\n" +
            "    border-radius: 30px;\n" +
            "    background-color: #383838;\n" +
            "    color: white;\n" +
            "    font-family: sans-serif;\n" +
            "    text-decoration: none;\n" +
            "    \">Preise berechnen</button>"

        const button = jQuery(buttonHtml);
        jQuery('html').append(button);
        jQuery("#datte-reload").click((e) => {
            start();
        });
        //start()
    }
    jQuery( document ).ready(firstStep);
})();