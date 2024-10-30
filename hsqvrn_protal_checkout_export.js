// ==UserScript==
// @name         HusqWebOrderOptimizer V3
// @namespace    https://github.com/Dattenberger/TampermonkeyScripts
// @version      5.0.0
// @description  This script adds individual prices to the Weborder V shopping cart. Discount is automatically included.
// @author       Lukas Dattenberger
// @match        https://portal.husqvarnagroup.com/de/checkout/*
// @grant        GM_addStyle
// @updateURL    https://raw.githubusercontent.com/Dattenberger/TampermonkeyScripts/main/weborder_v2.js
// @downloadURL  https://raw.githubusercontent.com/Dattenberger/TampermonkeyScripts/main/weborder_v2.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery-csv/1.0.21/jquery.csv.min.js
// ==/UserScript==


(function () {
    const discountFactor = 0.97;


    function tableObserver(tableSelector, idHeaderButton, checkout) {
        const observer = new MutationObserver(function (mutations, observer) {
            if (mutations.some((mutation) => ($(tableSelector).parent().is($(mutation.target))))) {
                prices(tableSelector, idHeaderButton, false, checkout);
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

    function parseNumber(text){
        return Number.parseFloat(text.replace(".", "").replace(',', '.'));
    }

    function formatNumber(number, fractionDigits = 4) {
        return Number(number).toLocaleString("de-DE", {minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits})
    }

    function prices(id, idHeaderButton, updateDownload, checkout) {
        const table = jQuery(id);

        const header = table.find('div[role="rowgroup"]:eq(0)')
        const lines = table.find('div[role="row"].b2b-n-.b2b-e0')
        const footer = table.find('div[role="rowgroup"]:eq(2)')

        // if (header.find(".single-ek-discount").length === 0 || header.find(".single-ek").length === 0) {
        //     const deliveryDate = header.find(`div[role="row"] > div[role="columnheader"]:eq(6)`);
        //     console.log(`header`, header)

        //     console.log(`deliveryDate`, deliveryDate)
        //     deliveryDate.after(`
        //         <div class="single-ek-discount b2b-nz">
        //             <span class="body_xs_bold">EK-Netto einzel<br>inkl. Skonto</span>
        //         </th>
        //     `);

        //     deliveryDate.after(`
        //         <div class="single-ek-discount b2b-nz">
        //             <span class="body_xs_bold">EK-Netto einzel<br>exkl. Skonto</span>
        //         </th>
        //     `);
        // }



        const csvData = []

        lines.each(function () {
            const line = $(this)

            const han = line.find('div[role="cell"]:eq(1) > div.b2b-hf.b2b-hg a').text()
            const description = line.find('div[role="cell"]:eq(2) span').text()
            const quantity = line.find('div[role="cell"]:eq(4) input').val()
            const deliveryDate = line.find('div[role="cell"]:eq(6) > span.b2b-r_ > div.b2b-gg.b2b-sa > span.body_xxs_default.b2b-gi').text()
            const comment = line.find('div[role="cell"]:eq(7) input').val()
            // const ekTotal = parseNumber(zeile.find(checkout ? "td:nth-child(9)" : "td:nth-child(11)").text());

            const internalOrderNumber = nullSaveMatch(comment, /^(D-BE\S*)/, 1);
            const productNumber = nullSaveMatch(comment, /^D-BE\S*\s*(?:VPE=\d*)?\s*(\S*)/, 1);
            const EKNetto = 0

            csvData.push({
                "HAN": han,
                "Interne Bestellnummer": !!internalOrderNumber ? internalOrderNumber + "-I" : "",
                "Artikelnummer": productNumber,
                "Lieferantenbezeichnung": description,
                "menge": quantity,
                "EK netto": formatNumber((10 * discountFactor / quantity)),
                "Lieferdatum": deliveryDate,
                "Freiposition": "N"
            })
        })

        const internalOrderNumbers = new Set();
        csvData.forEach(e => {
            if (!!e["Interne Bestellnummer"]) internalOrderNumbers.add(e["Interne Bestellnummer"])
        })


        let download = $(footer).find(".download");

        if (download.length === 0) {
            download = $('<a class="download btn btn-default" download="bestellung.csv" style=" float: left">Download CSV</a>')

            $(footer).append(download)

            download.click(() => prices(id, idHeaderButton, true, checkout))
        }

        if (!updateDownload) {
            download.attr('href', 'data:text/plain;charset=utf-8,' + "");
        } else if (internalOrderNumbers.size > 1) {
            download.attr('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent("Zu viele interne Bestellnummern: " + [...internalOrderNumbers.values()].join(", ")));
        } else {
            download.attr('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent($.csv.fromObjects(csvData, { separator: ";" })));
        }
    }

    function start() {
        const tableSelector = `div[role|="table"].b2b-ey`

        tableObserver(tableSelector, '', false)
        prices(tableSelector, '', false, false)
    }

    jQuery(document).ready(start);
})();
