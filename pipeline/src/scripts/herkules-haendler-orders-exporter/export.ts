// The export flow and its buttons. The portal has no JSON API: every row of the document history
// is a <form> that POSTs document_type/document_no/view_document_card back to the same URL, and
// the answer is the whole page with the document as a modal. The flow repeats that POST with
// fetch, parses the modal and builds the CSV in the browser.

import { getFactor, type FactorSetting } from '@lib/settings'
import { parseOrderDate, parsePositions, parseReferences } from './parse.js'
import { downloadCsv, toArticleQuantityRows, toCsv, toJtlRows } from './rows.js'

export type ExportFormat = 'jtl' | 'artikel-menge'

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

export async function exportOrder(form: HTMLFormElement, button: HTMLButtonElement, format: ExportFormat): Promise<void> {
    const orderNumber = field(form, 'document_no') ?? ''
    const label = (button.textContent ?? '').replace(/^[✓✗] /, '')
    button.disabled = true
    try {
        // Asked before loading so the prompt is not interrupted by the network round trips.
        const discountFactor = format === 'jtl' ? getFactor(DISCOUNT_FACTOR) : 1
        if (discountFactor === null) throw new Error('Export abgebrochen: kein Skonto-Faktor hinterlegt')
        button.textContent = 'Lädt…'
        const doc = await fetchDocument(form)
        const positions = parsePositions(doc)
        if (positions.length === 0) throw new Error('keine Positionen gefunden')
        const rows = format === 'jtl'
            ? toJtlRows(positions, orderNumber, parseOrderDate(doc), await fetchReferences(form), discountFactor)
            : toArticleQuantityRows(positions)
        downloadCsv(toCsv(rows), `herkules-${orderNumber}${format === 'jtl' ? '' : '-artikel-menge'}.csv`)
        button.textContent = `✓ ${label}`
    } catch (error) {
        console.error('[HerkulesExporter]', orderNumber, error)
        button.textContent = `✗ ${label}`
        button.title = error instanceof Error ? error.message : String(error)
    } finally {
        button.disabled = false
    }
}

function makeButton(form: HTMLFormElement, text: string, title: string, format: ExportFormat): HTMLButtonElement {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'buttonLink herkules-export-btn'
    button.textContent = text
    button.title = title
    button.style.marginLeft = '12px'
    button.addEventListener('click', (event) => {
        event.preventDefault()
        event.stopPropagation()
        void exportOrder(form, button, format)
    })
    return button
}

/** Adds the two export buttons after "Details" of every order row, once per form. */
export function attachButtons(): void {
    for (const form of document.querySelectorAll<HTMLFormElement>('form[action*="webshop_document_history"]')) {
        const details = form.querySelector('button[name="view_document_card"]')
        if (field(form, 'document_type') !== 'order' || form.dataset.herkulesExport || !details) continue
        form.dataset.herkulesExport = '1'
        details.after(
            makeButton(form, 'CSV', 'Export CSV für JTL (gleiches Format wie Husqvarna-Exporter)', 'jtl'),
            makeButton(form, 'Artikel;Menge', 'Export Artikel;Menge (Reimport)', 'artikel-menge'),
        )
    }
}
