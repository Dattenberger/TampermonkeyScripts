// Invented fixtures shaped like the dealer portal's pages (no real orders, articles or prices).

const ACTION = '/garten/de/account/?action=webshop_document_history'

function documentForm(type: string, no: string): string {
    return `<form action="${ACTION}" method="post">
        <input type="hidden" name="document_type" value="${type}">
        <input type="hidden" name="document_no" value="${no}">
        <button type="submit" name="view_document_card" value="1">Details</button>
        <button type="submit" name="request_document_pdf" value="1">PDF</button>
    </form>`
}

/** One order row of the document history with its shipment and invoice. */
export const HISTORY_PAGE = `<div class="archiveTable__row">
    ${documentForm('order', 'AB-0001')}${documentForm('shipment', 'LS-0001')}${documentForm('invoice', 'RE-0001')}
</div>`

function row(description: string, quantity = '', price = ''): string {
    return `<div class="itemtable_row">
        <div class="description_line">${description}</div>
        <div class="text-center"><span class="itemtable_label">Menge</span> ${quantity}</div>
        <div class="text-right hidden-xs"><span class="visible-xs">Preis:</span> ${price}</div>
    </div>`
}

function modal(body: string): string {
    return `<html><body><div class="modal"><p>Datum: 01.02.2030</p><div class="itemtable_list">${body}</div></div></body></html>`
}

export const ORDER_PAGE = modal(
    row('Artikel', 'Menge', 'Preis')
        + row('Ihre Onlinebestellung: WEB-0001')
        + row('<strong>Testartikel   Eins</strong> Artikel-Nr.: ART-0001', '2', '12,34 €')
        + row('<strong>Testartikel; "Zwei"</strong> Artikel-Nr.: ART-0002', '1.000', '1.234,50 €'),
)

export const SHIPMENT_PAGE = modal(
    row('Nr.: ART-0001') + row('Ihre Referenz: D-BE0000001 VPE=3 ART-X1 ') + row('Nr.: ART-0002'),
)

/** The invoice repeats ART-0001 with another reference: the shipment's (first) one wins. */
export const INVOICE_PAGE = modal(row('Nr.: ART-0001') + row('Ihre Referenz: D-BE0000009'))
