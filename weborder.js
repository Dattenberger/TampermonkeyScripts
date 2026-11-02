// ==UserScript==
// @name         HusqWebOrderOptimizer
// @namespace    https://github.com/Dattenberger/TampermonkeyScripts
// @version      3.2.0
// @description  Dieses Script fügt im Warenkorb der Weborder V1 Einzelpreise hinzu. Skonto wird automatisch mit eingerechnet. Dafür wird ein Button im Warenkorb hinzugefügt.
// @author       Lukas Dattenberger
// @match        http://weborder.husqvarna.com/*basket/basket_view_header.jsp
// @grant        GM_getValue
// @grant        GM_setValue
// @updateURL    https://raw.githubusercontent.com/Dattenberger/TampermonkeyScripts/main/weborder.js
// @downloadURL  https://raw.githubusercontent.com/Dattenberger/TampermonkeyScripts/main/weborder.js
// @require      https://code.jquery.com/jquery-latest.min.js
// ==/UserScript==


(function () {

    // --- local discount factor ---
    // A purchase condition never goes into this public repository: the user enters it once and
    // Tampermonkey keeps it in this browser. It is typed and shown in percent, as supplier terms state
    // it, and stored as the factor on the net price (one minus the percentage over a hundred), so
    // values stored by earlier versions stay valid. A card at the bottom right, above the portals'
    // own bottom bars, holds the field: folded to a small tab while a value is stored, open while
    // none is. Every root script that uses the key
    // carries this block unchanged (pipeline/src/test/local-factor.test.ts).
    const FACTOR_KEY = 'husqvarnaDiscountFactor';
    const DISCOUNT_CARD = 'robotico-discount-card';
    const PLAIN_DECIMAL = /^\d*[.,]?\d+$/;
    let discountChanged = null;

    function parseFactor(input) {
        const text = String(input ?? '').trim();
        const value = typeof input === 'number' ? input : PLAIN_DECIMAL.test(text) ? Number(text.replace(',', '.')) : NaN;
        return value > 0 && value <= 1 ? value : null;
    }

    function readFactor() {
        return parseFactor(GM_getValue(FACTOR_KEY));
    }

    /** '3', '2,5' or '3 %' as the stored factor; null outside [0, 100). */
    function parseDiscountPercent(input) {
        const text = String(input ?? '').trim().replace(/\s*%$/, '');
        const percent = PLAIN_DECIMAL.test(text) ? Number(text.replace(',', '.')) : NaN;
        return percent < 100 ? parseFactor(Math.round((1 - percent / 100) * 1e10) / 1e10) : null;
    }

    function formatDiscountPercent(factor) {
        const percent = Math.round((1 - factor) * 100 * 1e10) / 1e10;
        return percent.toLocaleString('de-DE', { useGrouping: false, maximumFractionDigits: 10 });
    }

    const DISCOUNT_CSS = `
        #${DISCOUNT_CARD} { position: fixed; right: 16px; bottom: 104px; z-index: 2147483000; box-sizing: border-box; width: max-content;
            background: #fafafa; border: 1px solid #dcdcdc; border-left: 3px solid #3d3d3c; border-radius: 6px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, .15); color: #3d3d3c; font: 13px/18px Arial, sans-serif; text-align: left; }
        #${DISCOUNT_CARD}.is-open { width: 240px; }
        #${DISCOUNT_CARD} * { box-sizing: border-box; }
        #${DISCOUNT_CARD} .rd-head { display: flex; width: 100%; align-items: center; gap: 8px; margin: 0; padding: 8px 10px;
            border: 0; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
        #${DISCOUNT_CARD} .rd-tag { flex: 1; white-space: nowrap; color: #6f6f6f; font: 600 10px/12px Arial, sans-serif; letter-spacing: .04em; text-transform: uppercase; }
        #${DISCOUNT_CARD} .rd-state { font-weight: 600; font-size: 12px; white-space: nowrap; }
        #${DISCOUNT_CARD}.is-missing .rd-state { color: #b02a37; }
        #${DISCOUNT_CARD}:not(.is-open) .rd-body { display: none; }
        #${DISCOUNT_CARD} .rd-body { padding: 0 10px 10px; }
        #${DISCOUNT_CARD} label { display: block; margin: 0; color: #3d3d3c; font-weight: 600; }
        #${DISCOUNT_CARD} .rd-percent { display: flex; align-items: center; gap: 6px; margin: 4px 0 6px; font-weight: 400; }
        #${DISCOUNT_CARD} input { width: 72px; height: auto; margin: 0; padding: 5px 8px; border: 1px solid #bbb; border-radius: 5px;
            background: #fff; color: #3d3d3c; font: 14px/18px Arial, sans-serif; text-align: right; }
        #${DISCOUNT_CARD} input[aria-invalid='true'] { border-color: #dc3545; background: #fff5f5; }
        #${DISCOUNT_CARD} input:focus-visible, #${DISCOUNT_CARD} .rd-head:focus-visible { outline: 2px solid #3d3d3c; outline-offset: 2px; }
        #${DISCOUNT_CARD} small { display: block; color: #6f6f6f; font-size: 11px; line-height: 14px; }
    `;

    function renderDiscountCard(card) {
        const missing = readFactor() === null;
        card.classList.toggle('is-missing', missing);
        card.querySelector('.rd-state').textContent = missing ? 'Skonto fehlt' : 'Skonto ✓';
        card.querySelector('.rd-head').setAttribute('aria-expanded', String(card.classList.contains('is-open')));
    }

    function buildDiscountCard() {
        const style = document.createElement('style');
        style.textContent = DISCOUNT_CSS;
        document.head.append(style);
        const card = document.createElement('aside');
        card.id = DISCOUNT_CARD;
        card.innerHTML = `
            <button type="button" class="rd-head" title="Skonto-Wert ein- oder ausblenden">
                <span class="rd-tag">Robotico · JTL</span><span class="rd-state"></span>
            </button>
            <div class="rd-body">
                <label>Skonto-Wert<span class="rd-percent"><input type="text" inputmode="decimal" autocomplete="off" placeholder="–">%</span></label>
                <small>Wird vom Netto-Preis abgezogen. Nur in diesem Browser gespeichert.</small>
            </div>`;
        const input = card.querySelector('input');
        const factor = readFactor();
        input.value = factor === null ? '' : formatDiscountPercent(factor);
        input.addEventListener('input', () => {
            const value = parseDiscountPercent(input.value);
            GM_setValue(FACTOR_KEY, value);
            input.setAttribute('aria-invalid', String(value === null));
            renderDiscountCard(card);
        });
        input.addEventListener('change', () => {
            if (readFactor() !== null && discountChanged) discountChanged();
        });
        input.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape' || readFactor() === null) return;
            card.classList.remove('is-open');
            renderDiscountCard(card);
        });
        card.querySelector('.rd-head').addEventListener('click', () => {
            card.classList.toggle('is-open');
            renderDiscountCard(card);
            if (card.classList.contains('is-open')) input.focus();
        });
        document.body.append(card);
        return card;
    }

    /**
     * Shows the card, once per page. `open` unfolds it with the cursor in the field: on start without
     * a value, and when an export needs one. `onChange` runs once the user has typed a valid value and
     * left the field (a script whose page shows prices with the discount recalculates there).
     */
    function showDiscountCard(open = false, onChange = null) {
        if (onChange) discountChanged = onChange;
        const card = document.getElementById(DISCOUNT_CARD) ?? buildDiscountCard();
        if (open) {
            card.classList.add('is-open');
            const input = card.querySelector('input');
            if (readFactor() === null) input.setAttribute('aria-invalid', 'true');
            input.focus({ preventScroll: true });
        }
        renderDiscountCard(card);
        return card;
    }
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
        // The prices with the discount are drawn on load: a new value takes a fresh page.
        showDiscountCard(readFactor() === null, () => location.reload());
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