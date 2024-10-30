// ==UserScript==
// @name         HusqOrdersExporter V3
// @namespace    https://github.com/Dattenberger/TampermonkeyScripts
// @version      5.0.0
// @description  This script adds individual prices to the Weborder V shopping cart. Discount is automatically included.
// @author       Lukas Dattenberger
// @match        https://portal.husqvarnagroup.com/de/orders/*
// @grant        GM_addStyle
// @updateURL    https://raw.githubusercontent.com/Dattenberger/TampermonkeyScripts/main/weborder_v2.js
// @downloadURL  https://raw.githubusercontent.com/Dattenberger/TampermonkeyScripts/main/weborder_v2.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery-csv/1.0.21/jquery.csv.min.js
// ==/UserScript==


(function () {
    function tableObserver(tableSelector) {
        const observer = new MutationObserver(function (mutations, observer) {
            // mutations.forEach(m => console.log(m.target))

            if (mutations.some((mutation) => ($(tableSelector).is($(mutation.target))))) {
                ordersExporter(tableSelector);
            }
        });


        observer.observe(document, {
            subtree: true,
            childList: true
        });
    }

    function orderDetailExporter() {
        console.log(`orderDetailExporter`)
    }

    function ordersExporter(tableSelector) {
        if (location.search.includes('?order=')) {
            const modal = $(tableSelector)
            const modalHeader = modal.find(`header`)
            const table = modal.find('table.b2b-pa')
            
            console.log(`modal`, modal)
            console.log(`modalHeader`, modalHeader)
            console.log(`table`, table)
            
            console.log(`orderDetailsExporter`)
        } else {
            return
        }
    }

    function start() {
        const modalSelector = `div#ui-modal-target div.ui-f.ui-eh.ui-dr.ui-hp`

        tableObserver(modalSelector)
        // ordersExporter(modalSelector)
    }

    jQuery(document).ready(start);
})();
