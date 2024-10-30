// ==UserScript==
// @name         HusqPortalCartExporter v1
// @namespace    https://github.com/Dattenberger/TampermonkeyScripts
// @version      1.0.0
// @description  This script allows to export cart data into csv file.
// @author       Lukas Dattenberger
// @match        https://portal.husqvarnagroup.com/de/checkout/*
// @grant        GM_addStyle
// @updateURL    https://raw.githubusercontent.com/Dattenberger/TampermonkeyScripts/main/hsqvrn_protal_cart_exporter.js
// @downloadURL  https://raw.githubusercontent.com/Dattenberger/TampermonkeyScripts/main/hsqvrn_protal_cart_exporter.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery-csv/1.0.21/jquery.csv.min.js
// ==/UserScript==


(function () {
    const discountFactor = 0.97;


    function tableObserver(tableSelector, checkout) {
        const observer = new MutationObserver(function (mutations, observer) {
            console.log(mutations)
            if (mutations.some((mutation) => ($(tableSelector).is($(mutation.target))))) {
                console.log(123)
                cartExporter(tableSelector, false);
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
        return Number.parseFloat(text.replace(".", "").replace(',', '.'));
    }

    function formatNumber(number, fractionDigits = 4) {
        return Number(number).toLocaleString("de-DE", { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits })
    }

    function cartExporter(tableSelector, downloadCsv = false) {
        const table = jQuery(tableSelector);

        const cartHeader = $('div[data-test="cart"] header')

        let downloadBtn = $(cartHeader).find(".export-btn");

        if (downloadBtn.length === 0) {
            downloadBtn = $(`
                <a class="export-btn b2b-br" data-variant="secondary" data-size="compact" download="cart_export.csv">
                    <span class="b2b-by">
                        <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="none" viewBox="0 0 28 28">
                            <path fill="currentColor" d="M27.003 20a1 1 0 0 1 .992.884l.007.116L28 26.003a2 2 0 0 1-1.85 1.994l-.15.005H2a2 2 0 0 1-1.995-1.85L0 26.002V21a1 1 0 0 1 1.993-.117L2 21v5.002h24L26.002 21a1 1 0 0 1 1-1m-13-20a1 1 0 0 1 .992.883l.007.117v16.585l6.293-6.292a1 1 0 0 1 1.492 1.327l-.078.087-8 8a1 1 0 0 1-.085.076l-.009.007-.028.021a1 1 0 0 1-.075.05l-.026.014a1 1 0 0 1-.08.04l-.038.016-.051.018-.018.006a1 1 0 0 1-.124.03l-.027.004a1 1 0 0 1-.146.011h-.033l-.052-.004.085.004a1 1 0 0 1-.18-.016h-.002l-.023-.005-.059-.014-.032-.01h-.002l-.014-.005a1 1 0 0 1-.095-.036l-.003-.002-.018-.008-.045-.023-.036-.02-.004-.003q0 .002-.005-.003l-.01-.006-.065-.044-.024-.018a1 1 0 0 1-.09-.08l-8-8a1 1 0 0 1 1.327-1.492l.087.078 6.293 6.292V1a1 1 0 0 1 1-1"></path>
                        </svg>
                    </span>
                    <span class="label_s b2b-bu">Export CSV</span>
                </a>
            `)

            $(cartHeader).append(downloadBtn)

            downloadBtn.click(() => cartExporter(tableSelector, true))
        }


        const tableLines = table.find('div[role="row"].b2b-n-.b2b-e0')

        const csvData = []

        tableLines.each(function () {
            const line = $(this)

            const han = line.find('div[role="cell"]:eq(1) > div.b2b-hf.b2b-hg a').text()
            const description = line.find('div[role="cell"]:eq(2) span').text()
            const netPrice = line.find('div[role="cell"]:eq(3) span').text()
            const quantity = line.find('div[role="cell"]:eq(5) input').val()
            const deliveryDate = line.find('div[role="cell"]:eq(7) > span.b2b-r_ > div.b2b-gg.b2b-sa > span.body_xxs_default.b2b-gi').text()
            const comment = line.find('div[role="cell"]:eq(8) input').val()

            const internalOrderNumber = nullSaveMatch(comment, /^(D-BE\S*)/, 1);
            const productNumber = nullSaveMatch(comment, /^D-BE\S*\s*(?:VPE=\d*)?\s*(\S*)/, 1);

            csvData.push({
                "HAN": han,
                "Interne Bestellnummer": !!internalOrderNumber ? internalOrderNumber + "-I" : "",
                "Artikelnummer": productNumber,
                "Lieferantenbezeichnung": description,
                "menge": quantity,
                "EK netto": netPrice,
                "Lieferdatum": deliveryDate,
                "Freiposition": "N"
            })
        })

        const internalOrderNumbers = new Set();
        csvData.forEach(e => {
            if (!!e["Interne Bestellnummer"]) internalOrderNumbers.add(e["Interne Bestellnummer"])
        })


        if (!downloadCsv) {
            downloadBtn.attr('href', 'data:text/plain;charset=utf-8,' + "");
        } else if (internalOrderNumbers.size > 1) {
            downloadBtn.attr('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent("Zu viele interne Bestellnummern: " + [...internalOrderNumbers.values()].join(", ")));
        } else {
            downloadBtn.attr('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent($.csv.fromObjects(csvData, { separator: ";" })));
        }
    }

    function start() {
        const tableSelector = `div[role|="table"].b2b-ey`

        tableObserver(tableSelector, false)
        cartExporter(tableSelector, false)
    }

    jQuery(document).ready(start);
})();