// ==UserScript==
// @name         HusqPortalOrdersExporter V3
// @namespace    https://github.com/Dattenberger/TampermonkeyScripts
// @version      1.0.2
// @description  This script allows to export orders data into csv file.
// @author       Lukas Dattenberger
// @match        https://portal.husqvarnagroup.com/de/orders/*
// @grant        GM_addStyle
// @updateURL    https://raw.githubusercontent.com/Dattenberger/TampermonkeyScripts/main/hsqvrn_protal_orders_exporter.js
// @downloadURL  https://raw.githubusercontent.com/Dattenberger/TampermonkeyScripts/main/hsqvrn_protal_orders_exporter.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery-csv/1.0.21/jquery.csv.min.js
// ==/UserScript==


(function () {
    function tableObserver(tableSelector) {
        const observer = new MutationObserver(function (mutations, observer) {
            if (mutations.some(
                (mutation) => ($(tableSelector).is($(mutation.target)) || $(tableSelector).find(`article`).parent().is($(mutation.target))))
            ) {
                ordersExporter(tableSelector, false);
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

    function formatData(date) {
        const monthMap = {
            Januar: '01',
            Februar: '02',
            März: '03',
            April: '04',
            Mai: '05',
            Juni: '06',
            Juli: '07',
            August: '08',
            September: '09',
            Oktober: '10',
            November: '11',
            Dezember: '12'
        };

        // Split the input date into parts
        const parts = date.split(' ');
        const day = parts[0]; // The day
        const month = monthMap[parts[1]]; // The month number from the map
        const year = parts[2]; // The year

        // Return the formatted date string
        return `${day}.${month}.${year}`.replace('..', '.')
    }

    function prepareCsvDataToExport(csvData) {
        return csvData.map(data => {
            let vpe = parseInt(nullSaveMatch(data["Kommentar"], /^D-BE\S*\s*VPE=(\d+)/, 1));
            if (isNaN(vpe) || vpe <= 1)
                vpe = 1;

            const menge = data["Anz/Konf."].split('/')[0] * vpe

            return {
                "HAN": data["Artikelnumer"],
                "Interne Bestellnummer": data["Interne Bestellnummer"].slice(0, 14),
                "Artikelnummer": nullSaveMatch(data["Kommentar"], /^D-BE\S*\s*(?:VPE=\d*)?\s*(\S*)/, 1),
                "Lieferantenbezeichnung": data["Beschreibung"],
                "menge": menge,
                "EK netto": `${(parseFloat(data["Gesamt"].replace(/\./g, '').replace(',', '.')) * 0.97 / menge).toFixed(4)}`.replace('.', ','),
                "Lieferdatum": formatData(data["Versendet"]),
                "Freiposition": "N",
                "Fremdbelegnummer": data["Fremdbelegnummer"],
            }
        })
    }

    function ordersExporter(modalSelector, downloadCsv = false) {
        if (location.search.includes('?order=')) {
            const initSelector = $(modalSelector)

            const modal = initSelector.find(`article`)


            const modalHeader = modal.find(`header`)
            const table = modal.find('table')

            let download = modalHeader.find(`.export-btn`)
            if (!download.length) {
                const divToInsertExportBtn = modalHeader.find(`div`)

                divToInsertExportBtn.css({ "display": "flex", "justify-content": "space-between" })

                download = $(`
                    <a class="export-btn" data-variant="secondary" data-size="compact" download="order-${divToInsertExportBtn.text()}.csv">
                        <span class="b2b-bx">
                            <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="none" viewBox="0 0 28 28">
                                <path fill="currentColor" d="M27.003 20a1 1 0 0 1 .992.884l.007.116L28 26.003a2 2 0 0 1-1.85 1.994l-.15.005H2a2 2 0 0 1-1.995-1.85L0 26.002V21a1 1 0 0 1 1.993-.117L2 21v5.002h24L26.002 21a1 1 0 0 1 1-1m-13-20a1 1 0 0 1 .992.883l.007.117v16.585l6.293-6.292a1 1 0 0 1 1.492 1.327l-.078.087-8 8a1 1 0 0 1-.085.076l-.009.007-.028.021a1 1 0 0 1-.075.05l-.026.014a1 1 0 0 1-.08.04l-.038.016-.051.018-.018.006a1 1 0 0 1-.124.03l-.027.004a1 1 0 0 1-.146.011h-.033l-.052-.004.085.004a1 1 0 0 1-.18-.016h-.002l-.023-.005-.059-.014-.032-.01h-.002l-.014-.005a1 1 0 0 1-.095-.036l-.003-.002-.018-.008-.045-.023-.036-.02-.004-.003q0 .002-.005-.003l-.01-.006-.065-.044-.024-.018a1 1 0 0 1-.09-.08l-8-8a1 1 0 0 1 1.327-1.492l.087.078 6.293 6.292V1a1 1 0 0 1 1-1"></path>
                            </svg>
                        </span>
                        <span class="label_s">Export CSV</span>
                    </a>
                `)

                divToInsertExportBtn.append(download)
                download.click(() => ordersExporter(modalSelector, true))
            }


            const csvData = []

            const tableLines = table.find(`tbody tr`)

            const innerOrderNumber = modal.find(`dl > dd:eq(0)`).text()
            const outerOrderNumber = modal.find(`dl > dd:eq(1)`).text()

            tableLines.each(function () {
                const line = $(this)

                csvData.push({
                    "Artikelnumer": line.find('td:eq(0) div div:eq(0)').text() || line.find('td:eq(0) div div:eq(1)').text(),
                    "Kommentar": line.find('td:eq(1) div').text(),
                    "Beschreibung": line.find('td:eq(2) div').text(),
                    "Angefragt": line.find('td:eq(3) div').text(),
                    "Versendet": line.find('td:eq(4) div').text(),
                    "Anz/Konf.": line.find('td:eq(5) div').text(),
                    "Gesamt": line.find('td:eq(6) div').text(),
                    "Tracking link": line.find('td:eq(7) span').text(),
                    "Interne Bestellnummer": innerOrderNumber,
                    "Fremdbelegnummer": outerOrderNumber
                })
            })



            if (!downloadCsv) {
                download.attr('href', 'data:text/plain;charset=utf-8,' + "");
            } else {
                download.attr('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent($.csv.fromObjects(prepareCsvDataToExport(csvData), { separator: ";" })));
            }

            console.log(`orderDetailsExporter`)
        } else {
            return
        }
    }

    function start() {
        const modalSelector = `div#ui-modal-target`

        tableObserver(modalSelector, false)
    }

    jQuery(document).ready(start);
})();
