// The export flow and its buttons. The portal has no JSON API: every row of the document history
// is a <form> that POSTs document_type/document_no/view_document_card back to the same URL, and
// the answer is the whole page with the document as a modal. The flow repeats that POST with
// fetch, parses the modal and builds the CSV in the browser.

import { readFactor, type FactorSetting } from '@lib/settings'
import { parseOrderDate, parsePositions, parseReferences } from './parse.js'
import { downloadCsv, orderNumberOf, toCsv, toJtlRows } from './rows.js'
import { askOrderNumber, attachPanel, CSV_BUTTON, focusFactor, setButtonState, STATUS } from './ui.js'

/** Discount factor per the supplier's terms: a local setting, never a value in this public code. */
export const DISCOUNT_FACTOR: FactorSetting = {
    key: 'herkulesDiscountFactor',
    label: 'Skonto-Faktor laut Lieferantenkonditionen (Faktor auf den Netto-Händlerpreis).',
}

function field(form: HTMLFormElement, name: string): string | undefined {
    return (form.elements.namedItem(name) as HTMLInputElement | null)?.value
}

/** Posts the row form like a click on "Details" and returns the parsed answer page. */
async function fetchDocument(form: HTMLFormElement): Promise<Document> {
    const body = new FormData()
    for (const element of form.elements) {
        const { name, value } = element as HTMLInputElement
        if (name && name !== 'request_document_pdf') body.append(name, value)
    }
    const response = await fetch(form.action, { method: 'POST', body, credentials: 'include' })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return new DOMParser().parseFromString(await response.text(), 'text/html')
}

/** Shipment and invoice forms of the same order row, shipments first. */
function relatedForms(orderForm: HTMLFormElement): HTMLFormElement[] {
    const forms = [...(orderForm.closest('.archiveTable__row')?.querySelectorAll('form') ?? [])]
    const byType = (type: string) => forms.filter((f) => field(f, 'document_no') && field(f, 'document_type') === type)
    return [...byType('shipment'), ...byType('invoice')]
}

async function fetchReferences(orderForm: HTMLFormElement): Promise<Map<string, string>> {
    const references = new Map<string, string>()
    for (const form of relatedForms(orderForm)) {
        for (const [article, reference] of parseReferences(await fetchDocument(form))) {
            if (!references.has(article)) references.set(article, reference)
        }
    }
    return references
}

export async function exportOrder(form: HTMLFormElement, button: HTMLButtonElement, status: HTMLElement): Promise<void> {
    const orderNumber = field(form, 'document_no') ?? ''
    const missingFactor = () => {
        setButtonState(button, 'error', status, 'Skonto-Faktor fehlt: bitte oben rechts im Feld „Skonto-Faktor“ eintragen.')
        focusFactor()
    }
    if (readFactor(DISCOUNT_FACTOR) === null) {
        missingFactor()
        return
    }
    setButtonState(button, 'loading', status)
    try {
        const doc = await fetchDocument(form)
        const positions = parsePositions(doc)
        if (positions.length === 0) throw new Error('keine Positionen gefunden')
        const references = await fetchReferences(form)
        // The portal has no field for our number: a reference typed in the basket is only a suggestion.
        const suggestion = [...references.values()].map((reference) => orderNumberOf(reference)).find(Boolean) ?? ''
        const orderNumberInJtl = await askOrderNumber(status, suggestion)
        if (orderNumberInJtl === null) {
            setButtonState(button, 'idle', status)
            return
        }
        // The field stays editable while the user types the number: what it shows now is what applies.
        const discountFactor = readFactor(DISCOUNT_FACTOR)
        if (discountFactor === null) {
            missingFactor()
            return
        }
        const rows = toJtlRows(positions, orderNumber, parseOrderDate(doc), references, discountFactor, orderNumberInJtl)
        downloadCsv(toCsv(rows), `herkules-${orderNumber}.csv`)
        setButtonState(button, 'success', status)
    } catch (error) {
        console.error('[HerkulesExporter]', orderNumber, error)
        setButtonState(button, 'error', status, error instanceof Error ? error.message : String(error))
    }
}

function makeStatus(): HTMLElement {
    const status = document.createElement('span')
    status.className = STATUS
    status.setAttribute('role', 'status')
    return status
}

function makeButton(form: HTMLFormElement, status: HTMLElement): HTMLButtonElement {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = CSV_BUTTON
    button.setAttribute('aria-label', `CSV für Bestellung ${field(form, 'document_no') ?? ''}`)
    button.addEventListener('click', (event) => {
        event.preventDefault()
        event.stopPropagation()
        void exportOrder(form, button, status)
    })
    setButtonState(button, 'idle', status)
    return button
}

/** Adds the panel once, and to every order row, once per form, the CSV button after "Details". */
export function attachExport(): void {
    attachPanel(DISCOUNT_FACTOR)
    for (const form of document.querySelectorAll<HTMLFormElement>('form[action*="webshop_document_history"]')) {
        const details = form.querySelector('button[name="view_document_card"]')
        if (field(form, 'document_type') !== 'order' || form.dataset.herkulesExport || !details) continue
        form.dataset.herkulesExport = '1'
        const status = makeStatus()
        details.after(makeButton(form, status), status)
    }
}
