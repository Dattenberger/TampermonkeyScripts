// ==UserScript==
// @name         HusqWebOrderOptimizer
// @namespace    http://tampermonkey.net/
// @version      2
// @description  try to take over the world!
// @author       You
// @match        http://weborder.husqvarna.com/*
// @grant        none
// ==/UserScript==


(function () {
    function loadJquery(callback) {
        const script = document.createElement("SCRIPT");
        script.src = '//code.jquery.com/jquery-latest.min.js';
        script.type = 'text/javascript';
        script.onload = function () {
            callback();
        };
        document.getElementsByTagName("head")[0].appendChild(script);
    }

    function pricing() {
        function td(menge, element) {
            element = jQuery(element);
            const text = element.has("span.datte-value").size() > 0 ? element.find("span.datte-value").text() : element.text()

            const wertDouble = Number.parseFloat(text.replace(",", ""));
            const wertText = wertDouble.toFixed(4).toLocaleString("de-DE");
            const stückText = (wertDouble / menge).toFixed(4).toLocaleString("de-DE");

            element.html(`<span style="display: block" class="datte-value">${wertText}</span><span>${stückText}</span>`)
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
                    pricing()
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

    function start(){
        try{
            pricing();
            observer(pricing);
        } catch (e) {
            console.log(e)
        }
    }

    function firstStep(){
        const buttonHtml = "<button id=\"datte-reload\" style=\"\n" +
            "    display: block;\n" +
            "    position: absolute;\n" +
            "    top: 1em;\n" +
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
        start()
    }

    if (typeof(jQuery) === 'undefined')
        loadJquery(firstStep)
    else
        firstStep();
})();