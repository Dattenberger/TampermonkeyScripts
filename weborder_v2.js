// ==UserScript==
// @name         HusqWebOrderOptimizer V2
// @namespace    https://github.com/lukasdatte/HusqWebOrder
// @version      3.1.0
// @description  Dieses Script fügt im Warenkorb der Weborder V2 Einzelpreise hinzu. Skonto wird automatisch mit eingerechnet.
// @author       Lukas Dattenberger
// @match        https://supportsites.husqvarnagroup.com/de/web-order/einkaufswagen/
// @grant        GM_addStyle
// @updateURL    https://raw.githubusercontent.com/lukasdatte/TampermonkeyScripts/main/weborder_v2.js
// @downloadURL  https://raw.githubusercontent.com/lukasdatte/TampermonkeyScripts/main/weborder_v2.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery-csv/1.0.21/jquery.csv.min.js
// ==/UserScript==


(function () {

    const skontoFaktor = 0.97;

    /**
     * Beobachtet Änderungen am DOM. Bei Änderungen am Wrapperelement der Tabelle wird die Funktion {@link preise} aufgerufen. Änderungen durch z.B. das Hinzufügen und Entfernen von Artikeln sorgt für ein erneutes berechnen aller Einzelpreise und des Skonto Gesamtpreises.
     * @param id die HTML id der Tabelle.
     */
    function tableObserver(id, idHeaderButton){
        const observer = new MutationObserver(function(mutations, observer) {
            // fired when a mutation occurs
            // Scheint so, als würde der Wrapper der Tabelle verändert werden, wenn der Warenkorb verändert wird. Das Wrapper Element ist dann das Target einiger Mutations. Das wird ausgenutzt, denn wenn dieses Script Änderungen durchführt, ist eben dieses Wrapper Element kein Target. -> So wird verhindert, dass das ausführen der Funktion preise() rekursiv ein neues ausführen von sich selbst auslöst, was wieder für ein neues ausführen sorgen würde...
            if(mutations.some((mutation) => ($(id).parent().is($(mutation.target))))){
                console.log({triggeredBy: "triggeredBy", mutations})
                preise(id, idHeaderButton);
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

    function nullSaveMatch(string, regex, returnIndex) {
        if(!string)
            return "";
        const match = string.match(regex);
        if(!match || match.length < returnIndex)
            return "";
        return match[returnIndex];
    }

    function download(file) {
        var element = document.createElement('a');
        element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
        element.setAttribute('download', filename);

        element.style.display = 'none';
        document.body.appendChild(element);

        element.click();

        document.body.removeChild(element);
    }

    /**
     * Die führt die Änderungen an der der Tabelle mit der id durch. Diese Funktion kümmert sich um die Einzelpreise, den Header sowie um den Footer.
     * @param id die HTML id der Tabelle.
     */
    function preise(id, idHeaderButton){
        const tabelle = jQuery(id);
        const csvData = [];

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
            let einzelEkElement = zeile.find("td.einzel-ek")
            let einzelEkSkontoElement = zeile.find("td.einzel-ek-skonto")

            if(einzelEkSkontoElement.length === 0 || einzelEkElement.length === 0) {
                if(einzelEkSkontoElement.length === 0 ^ einzelEkElement.length === 0)
                    throw "Es ist nur eine der neuen Zellen vorhanden. Das macht keinen Sinn!: einzel-ek und einzel-ek-skonto "

                const nettoEkGesamtElement = zeile.find("td:nth-child(10)");
                einzelEkElement = $(`<td class="einzel-ek" style="text-align:right;">EK-Netto einzel exkl. Skonto</td>`)
                einzelEkSkontoElement =$(`<td class="einzel-ek-skonto" style="text-align:right;">EK-Netto einzel inkl. Skonto</td>`);

                nettoEkGesamtElement.after(einzelEkSkontoElement);
                nettoEkGesamtElement.after(einzelEkElement);
            }

            const kommentar = zeile.find("td:nth-child(4) textarea").val();
            let vpe = parseInt(nullSaveMatch(kommentar, /^D-BE\S*\s*VPE=(\d+)/, 1));
            if(isNaN(vpe) || vpe <= 1)
                vpe = 1;

            const menge = zeile.find(".quantity-column input").val() * vpe;
            const ekGesamt = parseNumber(zeile.find("td:nth-child(10)").text());
            const vpeText = vpe === 1 ? "" : "<br>(bei VPE=" + vpe + ")"
            einzelEkElement.html(formatNumber((ekGesamt / menge)) + vpeText);
            einzelEkSkontoElement.html(formatNumber((ekGesamt * skontoFaktor / menge)) + vpeText);

            //Datum im Format: 20220214
            const lieferdatumHinweis = nullSaveMatch(zeile.find("td:nth-child(13)").text(), /Erwartetes Lieferdatum ist (\d*)/, 1);
            //Matche 2022 02 14
            const lieferdatumZerlegt = lieferdatumHinweis.match(/(\d{4})(\d{2})(\d{2})/);
            const lieferdatum = !lieferdatumZerlegt || lieferdatumZerlegt.length !== 4 ? "" : `${lieferdatumZerlegt[3]}.${lieferdatumZerlegt[2]}.${lieferdatumZerlegt[1]}`

            const hanElement = zeile.find("td:nth-child(2)");
            //[0].childNodes[0].nodeValue => Nur text vom Parent element.
            const han = hanElement.length > 0 && hanElement[0].childNodes.length > 0 ? zeile.find("td:nth-child(2)")[0].childNodes[0].nodeValue.replace(/\D+/g, "") : "";
            const interneBestellnummer = nullSaveMatch(kommentar, /^(D-BE\S*)/, 1);
            const artikelnummer = nullSaveMatch(kommentar, /^D-BE\S*\s*(?:VPE=\d*)?\s*(\S*)/, 1);

            csvData.push({
                HAN: han,
                "Interne Bestellnummer": !!interneBestellnummer ? interneBestellnummer + "-I" : "",
                Artikelnummer: interneBestellnummer,
                Lieferantenbezeichnung: artikelnummer,
                menge: menge,
                "EK netto": formatNumber((ekGesamt * skontoFaktor / menge)),
                "Lieferdatum": lieferdatum,
                "Freiposition": "N"
            })
        });

        const interneBestellnummern = new Set();
        csvData.forEach(e => {
            if (!!e["Interne Bestellnummer"]) interneBestellnummern.add(e["Interne Bestellnummer"])
        })

        //TODO sicherstellen, dass die Interne Bestellnummer bei allen Datensätzen gleich oder nicht gegeben ist.
        let download = $(idHeaderButton).parent().find(".download");
        if( download.length === 0 ){
            download = $('<a class="download btn btn-default" download="bestellung.csv" style=" float: left">Download CSV</a>')
            $(idHeaderButton).before(download)
            download.click( e=> preise(id, idHeaderButton))
        }

        if(interneBestellnummern.size > 1)
            download.attr('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent("Zu viele interne Bestellnummern: " + [...interneBestellnummern.values()].join(", ")));
        else
            download.attr('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent($.csv.fromObjects(csvData, {separator: ";"})));
    }

    /**
     * Start
     */
    function start(){
        GM_addStyle(".einzel-ek, .einzel-ek-skonto {width: 90px !important; text-align: right; }" +
            "th[aria-label=\"Kommentar\"] {width: 250px !important;}" +
            ".web-order-modules .cart-container .cart-table td textarea { height: 5.5em;}" +
            "/*@media (min-width: 1470px) { .container { max-width: 1800px !important; width: auto !important; } }*/")


        preise("#stockOrderCart-cart-table", "#stockOrderCart .cart-header .input-group-btn");
        tableObserver("#stockOrderCart-cart-table", "#stockOrderCart .cart-header .input-group-btn");

        preise("#shoppingCart-cart-table", "#shoppingCart .cart-header .input-group-btn");
        tableObserver("#shoppingCart-cart-table", "#shoppingCart .cart-header .input-group-btn");
    }

    jQuery( document ).ready(start);
})();
