// ==UserScript==
// @name         HusqWebOrderOptimizer V2
// @namespace    https://github.com/lukasdatte/HusqWebOrder
// @version      0.0.1
// @description  try to take over the world!
// @author       You
// @match        https://supportsites.husqvarnagroup.com/de/web-order/einkaufswagen/
// @grant        none
// @updateURL    https://raw.githubusercontent.com/lukasdatte/HusqWebOrder/main/weborder_v2.js
// @downloadURL  https://raw.githubusercontent.com/lukasdatte/HusqWebOrder/main/weborder_v2.js
// @require      https://code.jquery.com/jquery-latest.min.js
// ==/UserScript==


(function () {

    const skontoFaktor = 0.97;


    function tableObserver(id){
        const observer = new MutationObserver(function(mutations, observer) {
            // fired when a mutation occurs
            // Scheint so, als würde der Wrapper der Tabelle verändert werden, wenn der Warenkorb verändert wird. Das Wrapper Element ist dann das Target einiger Mutations. Das wird ausgenutzt, denn wenn dieses Script Änderungen durchführt, ist eben dieses Wrapper Element kein Target. -> So wird verhindert, dass das ausführen der Funktion preise() rekursiv ein neues ausführen von sich selbst auslöst, was wieder für ein neues ausführen sorgen würde...
            if(mutations.some((mutation) => ($(id).parent().is($(mutation.target))))){
                console.log({triggeredBy: "triggeredBy", mutations})
                preise(id);
            }
        });
        observer.observe(document, {
            subtree: true,
            childList: true
        });
    }

    // 1.808,40	 -> 1808.40
    function parseNumber(text){
        return Number.parseFloat(text.replace(".", "").replace(',', '.'));
    }

    // 1808.40 -> 1.808,40
    // Zweimal den Wrapper Number() benutzt, weil sonst komische Sachen passieren.
    function formatNumber(number){
        return Number(Number(number).toFixed(2)).toLocaleString("de-DE")
    }


    //Die Preise der Tabelle mit der id hinzufügen.
    //Kümmert sich um die Einzelpreise, um eine weitere Spalte in der Tabelle sowie um den Footer.
    function preise(id){
        const tabelle = jQuery(id);

        //HEAD
        const head = tabelle.find("thead");
        if(head.find(".DatteEK").length === 0)
            head.find(":nth-child(10)").after(`<th class="DatteEK" class="sorting_disabled" rowspan="1" colspan="1" style="width: 133px;" aria-label="Rabatt">EK-Netto einzel inkl. Skonto</th>`);

        //FOOTER -> Summe mit Skonto
        const summe = parseNumber(tabelle.find(".total-net-price").text());
        const foot = tabelle.find("tfoot");
        let footerSkontoSumme = foot.find(".DatteEK")
        const footerSkontoSummeText = `EK-Netto inkl. Skonto: ${formatNumber(summe * skontoFaktor)}`;
        if(footerSkontoSumme.length === 0) {
            footerSkontoSumme = jQuery(`<b class="DatteEK" style="margin-left: 2em;">${footerSkontoSummeText}</b>`)
            const zeilenAnzeige = foot.find("td:nth-child(1)");
            zeilenAnzeige.find("h5").css("display","inline");
            zeilenAnzeige.append(footerSkontoSumme);
        } else {
            footerSkontoSumme.text(footerSkontoSummeText);
        }

        //ZEILEN -> Einzelpreise für jede Zeile berechnen
        const zeilen = tabelle.find("tbody tr")
        zeilen.each(function() {
            const zeile = $( this );
            let datteEk = zeile.find("td.DatteEK")
            if(datteEk.length === 0) {
                zeile.find(":nth-child(10)").after(`<td class="DatteEK" style="text-align:right;">EK-Netto einzel inkl. Skonto</td>`);
                datteEk = zeile.find("td.DatteEK");
            }

            const menge = zeile.find(".quantity-column input").val();
            const ekGesamt = parseNumber(zeile.find(":nth-child(10)").text());
            datteEk.text(formatNumber((ekGesamt * skontoFaktor / menge)));
        });
    }

    function start(){
        preise("#stockOrderCart-cart-table");
        tableObserver("#stockOrderCart-cart-table");

        preise("#shoppingCart-cart-table");
        tableObserver("#shoppingCart-cart-table");
    }

    jQuery( document ).ready(start);
})();
