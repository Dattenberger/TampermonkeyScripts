// The export flow and its buttons. The portal has no JSON API: every row of the document history
// is a <form> that POSTs document_type/document_no/view_document_card back to the same URL, and
// the answer is the whole page with the document as a modal. The flow repeats that POST with
// fetch, parses the modal and builds the CSV in the browser.

import { readFactor, type FactorSetting } from '@lib/settings'
import { parseOrderDate, parsePositions, parseReferences } from './parse.js'
import { downloadCsv, toCsv, toJtlRows } from './rows.js'
import { attachPanel, CSV_BUTTON, focusFactor, REFERENCE, setButtonState } from './ui.js'

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

/** Our order number as typed in the basket, for the overview: the first hit, as few requests as possible. */
async function fetchFirstReference(orderForm: HTMLFormElement): Promise<string | undefined> {
    for (const form of relatedForms(orderForm)) {
        const [reference] = parseReferences(await fetchDocument(form)).values()
        if (reference) return reference
    }
    return undefined
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

export async function exportOrder(form: HTMLFormElement, button: HTMLButtonElement): Promise<void> {
    const orderNumber = field(form, 'document_no') ?? ''
    const discountFactor = readFactor(DISCOUNT_FACTOR)
    if (discountFactor === null) {
        setButtonState(button, 'error', 'Skonto-Faktor fehlt: bitte rechts im Feld eintragen.')
        focusFactor()
        return
    }
    setButtonState(button, 'loading')
    try {
        const doc = await fetchDocument(form)
        const positions = parsePositions(doc)
        if (positions.length === 0) throw new Error('keine Positionen gefunden')
        const rows = toJtlRows(positions, orderNumber, parseOrderDate(doc), await fetchReferences(form), discountFactor)
        downloadCsv(toCsv(rows), `herkules-${orderNumber}.csv`)
        const missing = rows.filter((row) => !row['Interne Bestellnummer']).length
        if (missing > 0) setButtonState(button, 'warning', `${missing} von ${rows.length} Positionen ohne Referenz: Der Import in JTL findet sie nicht.`)
        else setButtonState(button, 'success')
    } catch (error) {
        console.error('[HerkulesExporter]', orderNumber, error)
        setButtonState(button, 'error', error instanceof Error ? error.message : String(error))
    }
}

function makeButton(form: HTMLFormElement): HTMLButtonElement {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = `buttonLink ${CSV_BUTTON}`
    button.title = 'CSV für den JTL-Import (gleiches Format wie die Husqvarna-Exporter)'
    button.addEventListener('click', (event) => {
        event.preventDefault()
        event.stopPropagation()
        void exportOrder(form, button)
    })
    setButtonState(button, 'idle')
    return button
}

const REFERENCE_REQUESTS = 2
const referenceQueue: (() => Promise<void>)[] = []
let referenceWorkers = 0

/** Works through the rows of a page with few requests at a time: the portal is a shop, not an API. */
async function runReferenceQueue(): Promise<void> {
    if (referenceWorkers >= REFERENCE_REQUESTS) return
    referenceWorkers += 1
    for (let job = referenceQueue.shift(); job; job = referenceQueue.shift()) await job()
    referenceWorkers -= 1
}

function makeReference(form: HTMLFormElement): HTMLElement {
    const label = document.createElement('span')
    label.className = REFERENCE
    label.textContent = 'Referenz …'
    referenceQueue.push(async () => {
        try {
            const reference = await fetchFirstReference(form)
            label.textContent = reference ? (/^D-BE\d+/.exec(reference)?.[0] ?? reference) : 'Referenz fehlt'
            label.classList.toggle('is-missing', !reference)
            label.title = reference ? `Ihre Referenz: ${reference}` : 'Noch kein Lieferschein oder keine Rechnung mit „Ihre Referenz“.'
        } catch (error) {
            console.error('[HerkulesExporter]', field(form, 'document_no'), error)
            label.textContent = 'Referenz ?'
            label.classList.add('is-missing')
        }
    })
    return label
}

/** Adds the panel once, and to every order row, once per form, the CSV button and our reference after "Details". */
export function attachExport(): void {
    const forms = [...document.querySelectorAll<HTMLFormElement>('form[action*="webshop_document_history"]')].filter(
        (form) => field(form, 'document_type') === 'order' && !form.dataset.herkulesExport && form.querySelector('button[name="view_document_card"]'),
    )
    attachPanel(DISCOUNT_FACTOR)
    for (const form of forms) {
        form.dataset.herkulesExport = '1'
        form.querySelector('button[name="view_document_card"]')!.after(makeButton(form), makeReference(form))
    }
    for (let i = 0; i < Math.min(forms.length, REFERENCE_REQUESTS); i += 1) void runReferenceQueue()
}
