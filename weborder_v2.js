// ==UserScript==
// @name         HusqWebOrderOptimizer V2
// @namespace    https://github.com/lukasdatte/HusqWebOrder
// @version      2.0.0
// @description  Dieses Script fügt im Warenkorb der Weborder V2 Einzelpreise hinzu. Skonto wird automatisch mit eingerechnet.
// @author       Lukas Dattenberger
// @match        https://supportsites.husqvarnagroup.com/de/web-order/einkaufswagen/
// @grant        GM_addStyle
// @updateURL    https://raw.githubusercontent.com/lukasdatte/HusqWebOrder/main/weborder_v2.js
// @downloadURL  https://raw.githubusercontent.com/lukasdatte/HusqWebOrder/main/weborder_v2.js
// @require      https://code.jquery.com/jquery-latest.min.js
// ==/UserScript==


(function () {

    const skontoFaktor = 0.97;

    /**
     * Beobachtet Änderungen am DOM. Bei Änderungen am Wrapperelement der Tabelle wird die Funktion {@link preise} aufgerufen. Änderungen durch z.B. das Hinzufügen und Entfernen von Artikeln sorgt für ein erneutes berechnen aller Einzelpreise und des Skonto Gesamtpreises.
     * @param id die HTML id der Tabelle.
     */
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

    /**
     * 1.808,40	 -> 1808.40
     * @param text Text, welcher als Nummer geparsde werden soll.
     * @return {number} Die geparsde Nummer.
     */
    function parseNumber(text){
        return Number.parseFloat(text.replace(".", "").replace(',', '.'));
    }


    /**
     * Formatiert eine Zahl.
     * 1808.40 -> 1.808,4000
     * @param number die zu formatierende Zahl.
     * @param fractionDigits die Anzahlt der Nachkommastellen.
     * @return {string} die Formatiere Zahl.
     */
    function formatNumber(number, fractionDigits = 4) {
        return Number(number).toLocaleString("de-DE", {minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits})
    }


    /**
     * Die führt die Änderungen an der der Tabelle mit der id durch. Diese Funktion kümmert sich um die Einzelpreise, den Header sowie um den Footer.
     * @param id die HTML id der Tabelle.
     */
    function preise(id){
        const tabelle = jQuery(id);

        //HEAD
        const head = tabelle.find("thead");

        if(head.find(".einzel-ek-skonto").length === 0 || head.find(".einzel-ek").length === 0) {
            if(head.find(".einzel-ek-skonto").length === 0 ^ head.find(".einzel-ek").length === 0)
                throw "Es ist nur eine der neuen Zellen vorhanden. Das macht keinen Sinn!: einzelEkSkonto und einzelEk "

            const nettoEkGesamt = head.find("th:nth-child(10)");
            nettoEkGesamt.after(`<th class="einzel-ek-skonto sorting_disabled" rowspan="1" colspan="1" aria-label="Rabatt">EK-Netto einzel<br>inkl. Skonto</th>`);
            nettoEkGesamt.after(`<th class="einzel-ek sorting_disabled" rowspan="1" colspan="1" aria-label="Rabatt">EK-Netto einzel<br>exkl. Skonto</th>`);
        }

        //FOOTER -> Summe mit Skonto
        const summe = parseNumber(tabelle.find(".total-net-price").text());
        const foot = tabelle.find("tfoot");
        let footerSkontoSumme = foot.find(".einzel-ek-skonto")
        const footerSkontoSummeText = `EK-Netto inkl. Skonto: ${formatNumber(summe * skontoFaktor, 2)}`;
        if(footerSkontoSumme.length === 0) {
            footerSkontoSumme = jQuery(`<b class="einzel-ek-skonto" style="margin-left: 2em;">${footerSkontoSummeText}</b>`)
            const zeilenAnzeige = foot.find("td:nth-child(1)");
            zeilenAnzeige.find("h5").css("display","inline");
            zeilenAnzeige.append(footerSkontoSumme);

            //foot.find("td:last-child").attr("colspan",4)
        } else {
            footerSkontoSumme.text(footerSkontoSummeText);
        }

        //ZEILEN -> Einzelpreise für jede Zeile berechnen
        const zeilen = tabelle.find("tbody tr")
        zeilen.each(function() {
            const zeile = $( this );
            let einzelEk = zeile.find("td.einzel-ek")
            let einzelEkSkonto = zeile.find("td.einzel-ek-skonto")

            if(einzelEkSkonto.length === 0 || einzelEk.length === 0) {
                if(einzelEkSkonto.length === 0 ^ einzelEk.length === 0)
                    throw "Es ist nur eine der neuen Zellen vorhanden. Das macht keinen Sinn!: einzel-ek und einzel-ek-skonto "

                const nettoEkGesamt = zeile.find("td:nth-child(10)");
                einzelEk = $(`<td class="einzel-ek" style="text-align:right;">EK-Netto einzel exkl. Skonto</td>`)
                einzelEkSkonto =$(`<td class="einzel-ek-skonto" style="text-align:right;">EK-Netto einzel inkl. Skonto</td>`);

                nettoEkGesamt.after(einzelEkSkonto);
                nettoEkGesamt.after(einzelEk);
            }

            const menge = zeile.find(".quantity-column input").val();
            const ekGesamt = parseNumber(zeile.find("td:nth-child(10)").text());
            einzelEk.text(formatNumber((ekGesamt / menge)));
            einzelEkSkonto.text(formatNumber((ekGesamt * skontoFaktor / menge)));
        });
    }

    /**
     * Start
     */
    function start(){
        GM_addStyle(".einzel-ek, .einzel-ek-skonto {width: 90px !important; text-align: right; }")

        preise("#stockOrderCart-cart-table");
        tableObserver("#stockOrderCart-cart-table");

        preise("#shoppingCart-cart-table");
        tableObserver("#shoppingCart-cart-table");
    }

    jQuery( document ).ready(start);
})();
