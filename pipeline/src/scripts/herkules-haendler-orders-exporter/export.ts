// The export flow and its buttons. The portal has no JSON API: every row of the document history
// is a <form> that POSTs document_type/document_no/view_document_card back to the same URL, and
// the answer is the whole page with the document as a modal. The flow repeats that POST with
// fetch, parses the modal and builds the CSV in the browser.

import { readFactor, type FactorSetting } from '@lib/settings'
import { parseOrderDate, parsePositions, parseReferences } from './parse.js'
import { createOrderField, INVALID_TEXT, type OrderField } from './order-field.js'
import { downloadCsv, toCsv, toJtlRows } from './rows.js'
import { attachPanel, CSV_BUTTON, exportGroup, focusDiscount, labelColumn, setButtonState, STATUS } from './ui.js'

/** Discount factor per the supplier's terms: a local setting, never a value in this public code. */
export const DISCOUNT_FACTOR: FactorSetting = {
    key: 'herkulesDiscountFactor',
    label: 'Skonto laut Lieferantenkonditionen, in Prozent vom Netto-Händlerpreis.',
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

const loadedReferences = new WeakMap<HTMLFormElement, Promise<Map<string, string>>>()

/** One request chain per row, shared by the field and the export; a failure is tried again by the next caller. */
function referencesOf(form: HTMLFormElement): Promise<Map<string, string>> {
    const known = loadedReferences.get(form)
    if (known) return known
    const loading = fetchReferences(form)
    loadedReferences.set(form, loading)
    loading.catch(() => loadedReferences.delete(form))
    return loading
}

interface OrderRow {
    form: HTMLFormElement
    button: HTMLButtonElement
    status: HTMLElement
    field: OrderField
}

/** The values as the fields show them now; on a problem, says so in the row and returns null. */
function exportValues({ button, status, field }: OrderRow, allowEmpty: boolean): { orderNumberInJtl: string; discountFactor: number } | null {
    const fail = (reason: string) => {
        setButtonState(button, 'error', status, reason)
        return null
    }
    const orderNumberInJtl = field.read()
    if (orderNumberInJtl === null || (orderNumberInJtl === '' && !allowEmpty && !field.pending())) {
        field.markInvalid()
        return fail(orderNumberInJtl === null ? INVALID_TEXT : 'D-BE fehlt. Doppelklick auf CSV exportiert ohne Nummer.')
    }
    if (orderNumberInJtl === '' && field.pending()) return fail('Referenz lädt noch, gleich erneut klicken.')
    const discountFactor = readFactor(DISCOUNT_FACTOR)
    if (discountFactor === null) {
        focusDiscount()
        return fail('Skonto-Wert fehlt (oben rechts).')
    }
    return { orderNumberInJtl, discountFactor }
}

/** Exports with what the fields show; `allowEmpty` is the double click that asks for a new number in JTL. */
async function exportOrder(row: OrderRow, allowEmpty = false): Promise<void> {
    const { form, button, status } = row
    const orderNumber = field(form, 'document_no') ?? ''
    if (!exportValues(row, allowEmpty)) return
    setButtonState(button, 'loading', status)
    try {
        const doc = await fetchDocument(form)
        const positions = parsePositions(doc)
        if (positions.length === 0) throw new Error('keine Positionen gefunden')
        const references = await referencesOf(form)
        // Both fields stay editable while the documents load: what they show now is what applies.
        const values = exportValues(row, allowEmpty)
        if (!values) return
        const rows = toJtlRows(positions, orderNumber, parseOrderDate(doc), references, values.discountFactor, values.orderNumberInJtl)
        downloadCsv(toCsv(rows), `herkules-${orderNumber}.csv`)
        const result = values.orderNumberInJtl ? `Heruntergeladen: ${values.orderNumberInJtl}-I` : 'Ohne Nummer heruntergeladen, JTL vergibt eine.'
        setButtonState(button, 'success', status, result)
        // The double click accepted the empty field the first click had marked.
        row.field.input.removeAttribute('aria-invalid')
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

function makeRow(form: HTMLFormElement): OrderRow {
    const orderNumber = field(form, 'document_no') ?? ''
    const status = makeStatus()
    const button = document.createElement('button')
    // During an export the button stays locked: that run reads the field again before it writes the file.
    const orderField = createOrderField(orderNumber, (problem) => {
        if (!button.disabled) setButtonState(button, 'idle', status, problem)
    })
    const row: OrderRow = { form, button, status, field: orderField }
    button.type = 'button'
    button.className = CSV_BUTTON
    button.setAttribute('aria-label', `CSV für Bestellung ${orderNumber}`)
    button.addEventListener('click', (event) => {
        event.preventDefault()
        event.stopPropagation()
        // The second click of a double click is the dblclick's business, never a second file.
        if (event.detail < 2) void exportOrder(row)
    })
    button.addEventListener('dblclick', (event) => {
        event.preventDefault()
        event.stopPropagation()
        if (orderField.read() === '') void exportOrder(row, true)
    })
    setButtonState(button, 'idle', status)
    return row
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

function queueReferences({ form, field: orderField }: OrderRow): void {
    referenceQueue.push(async () => {
        try {
            orderField.showReferences(await referencesOf(form))
        } catch (error) {
            console.error('[HerkulesExporter]', field(form, 'document_no'), error)
            orderField.showLoadFailure()
        }
    })
}

/** Adds the panel and the column head once, and to every order row, once per form, our number's field and the CSV button after "Details". */
export function attachExport(): void {
    attachPanel(DISCOUNT_FACTOR)
    labelColumn()
    let added = 0
    for (const form of document.querySelectorAll<HTMLFormElement>('form[action*="webshop_document_history"]')) {
        const details = form.querySelector('button[name="view_document_card"]')
        if (field(form, 'document_type') !== 'order' || form.dataset.herkulesExport || !details) continue
        form.dataset.herkulesExport = '1'
        const row = makeRow(form)
        details.after(exportGroup(row.field.input, row.button, row.status))
        queueReferences(row)
        added += 1
    }
    for (let i = 0; i < Math.min(added, REFERENCE_REQUESTS); i += 1) void runReferenceQueue()
}
