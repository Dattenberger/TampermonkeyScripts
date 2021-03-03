(async function (){
    function loadJquery(callback){
            const script = document.createElement("SCRIPT");
            script.src = '//code.jquery.com/jquery-latest.min.js';
            script.type = 'text/javascript';
            script.onload = callback;
            document.getElementsByTagName("head")[0].appendChild(script);
    }
    loadJquery();

    function pricing(){
        function td(menge, element){
            element = jQuery(element);
            const text =  element.has("span.datte-value").size() > 0 ? element.find("span.datte-value").text() : element.text()

            const wertDouble = Number.parseFloat(text);
            const wertText = wertDouble.toFixed(4).toLocaleString("de-DE");
            const stückText = (wertDouble / menge).toFixed(4).toLocaleString("de-DE");

            element.html(`<span style="display: block" class="datte-value">${wertText}</span><span>${stückText}</span>`)
        }

        function row(e){
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

    if(!jQuery)
        loadJquery(pricing)
    else
        pricing();
})();