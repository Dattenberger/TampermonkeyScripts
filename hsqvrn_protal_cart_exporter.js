// ==UserScript==
// @name         HusqPortalCartExporter v1
// @namespace    https://github.com/Dattenberger/TampermonkeyScripts
// @version      1.1.0
// @description  This script allows to export cart data into csv file.
// @author       Lukas Dattenberger
// @match        https://portal.husqvarnagroup.com/de/checkout/*
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @updateURL    https://raw.githubusercontent.com/Dattenberger/TampermonkeyScripts/main/hsqvrn_protal_cart_exporter.js
// @downloadURL  https://raw.githubusercontent.com/Dattenberger/TampermonkeyScripts/main/hsqvrn_protal_cart_exporter.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery-csv/1.0.21/jquery.csv.min.js
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


    function tableObserver(tablesSelector, downloadIndex = null) {
        const observer = new MutationObserver(function (mutations, observer) {
            if (mutations.some((mutation) => ($(tablesSelector).parent().is($(mutation.target))))) {
                cartExporter(tablesSelector, downloadIndex);
            }
        });


        observer.observe(document, {
            subtree: true,
            childList: true
        });
    }

    function nullSaveMatch(string, regex, returnIndex) {
        if (!string)
            return "";
        const match = string.match(regex);
        if (!match || match.length < returnIndex)
            return "";
        return match[returnIndex];
    }

    function parseNumber(text) {
        return Number.parseFloat(
            text.replace(".", "").replace(',', '.')
        );
    }

    function formatNumber(number, fractionDigits = 4) {
        return Number(number).toLocaleString("de-DE", { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits })
    }

    function cartExporter(tablesSelector, downloadCsvIndex = null) {
        const discountFactor = readFactor();
        const cartsTables = jQuery(tablesSelector);

        cartsTables.each(function (index) {
            const table = $(this)

            const tableFooter = table.find(`div[role="rowgroup"]:eq(2) div[role="row"]`)

            let downloadBtn = $(tableFooter).find(`.export-btn-${index}`);

            if (downloadBtn.length === 0) {
                downloadBtn = $(`
                    <a class="export-btn-${index} b2b-bq" data-variant="secondary" data-size="compact" download="cart_export.csv">
                        <span class="b2b-by">
                            <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="none" viewBox="0 0 28 28">
                                <path fill="currentColor" d="M27.003 20a1 1 0 0 1 .992.884l.007.116L28 26.003a2 2 0 0 1-1.85 1.994l-.15.005H2a2 2 0 0 1-1.995-1.85L0 26.002V21a1 1 0 0 1 1.993-.117L2 21v5.002h24L26.002 21a1 1 0 0 1 1-1m-13-20a1 1 0 0 1 .992.883l.007.117v16.585l6.293-6.292a1 1 0 0 1 1.492 1.327l-.078.087-8 8a1 1 0 0 1-.085.076l-.009.007-.028.021a1 1 0 0 1-.075.05l-.026.014a1 1 0 0 1-.08.04l-.038.016-.051.018-.018.006a1 1 0 0 1-.124.03l-.027.004a1 1 0 0 1-.146.011h-.033l-.052-.004.085.004a1 1 0 0 1-.18-.016h-.002l-.023-.005-.059-.014-.032-.01h-.002l-.014-.005a1 1 0 0 1-.095-.036l-.003-.002-.018-.008-.045-.023-.036-.02-.004-.003q0 .002-.005-.003l-.01-.006-.065-.044-.024-.018a1 1 0 0 1-.09-.08l-8-8a1 1 0 0 1 1.327-1.492l.087.078 6.293 6.292V1a1 1 0 0 1 1-1"></path>
                            </svg>
                        </span>
                        <span class="label_s b2b-bu">Export CSV</span>
                    </a>
                `)

                $(tableFooter).append(downloadBtn)

                downloadBtn.click(() => cartExporter(tablesSelector, index))
            }

            const tableLines = table.find('div[role="rowgroup"]:eq(1) div[role="row"]')

            const csvData = []

            tableLines.each(function () {
                const line = $(this)

                const han = line.find('div[role="cell"]:eq(1) a').text().replace(/[^a-zA-Z0-9]/g, '');
                const description = line.find('div[role="cell"]:eq(2) span').text()
                const netPrice = parseNumber(line.find('div[role="cell"]:eq(6) span').text().replace(" €", ""))
                const deliveryDate = line.find('div[role="cell"]:eq(7) span div > span:eq(1)').text()
                const comment = line.find('div[role="cell"]:eq(8) input').val()
                const internalOrderNumber = nullSaveMatch(comment, /^(D-BE\S*)/, 1);
                const productNumber = nullSaveMatch(comment, /^D-BE\S*\s*(?:VPE=\d*)?\s*(\S*)/, 1);
                let vpe = parseInt(nullSaveMatch(comment, /^D-BE\S*\s*VPE=(\d+)/, 1));
                if (isNaN(vpe) || vpe <= 1) {
                    vpe = 1;
                }
                const quantity = parseFloat(line.find('div[role="cell"]:eq(5) input').val()) * vpe

                csvData.push({
                    "HAN": han,
                    "Interne Bestellnummer": !!internalOrderNumber ? internalOrderNumber.replace(/-I\d+$/, "-I") + "-I" : "",
                    "Artikelnummer": productNumber,
                    "Lieferantenbezeichnung": description,
                    "menge": quantity,
                    "EK netto": `${(netPrice * discountFactor / quantity).toFixed(4)}`.replace('.', ','),
                    "Lieferdatum": deliveryDate,
                    "Freiposition": "N",
                    "Fremdbelegnummer": ""
                })
            })

            const internalOrderNumbers = new Set();
            csvData.forEach(e => {
                if (!!e["Interne Bestellnummer"]) internalOrderNumbers.add(e["Interne Bestellnummer"])
            })

            if (downloadCsvIndex === null) {
                downloadBtn.attr('href', 'data:text/plain;charset=utf-8,' + "");
            } else if (discountFactor === null) {
                downloadBtn.attr('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent("Skonto-Wert fehlt: bitte unten rechts eintragen."));
            } else if (internalOrderNumbers.size > 1) {
                downloadBtn.attr('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent("Zu viele interne Bestellnummern: " + [...internalOrderNumbers.values()].join(", ")));
            } else if (downloadCsvIndex === index) {
                downloadBtn.attr('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent($.csv.fromObjects(csvData, { separator: ";" })));
            }
        })
    }

    function start() {
        showDiscountCard(readFactor() === null);
        const tablesSelector = `div[data-test="cart"] div[role="table"]`

        tableObserver(tablesSelector, null)
        cartExporter(tablesSelector, null)
    }

    jQuery(document).ready(start);
})();
