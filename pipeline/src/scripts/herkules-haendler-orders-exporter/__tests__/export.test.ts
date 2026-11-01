import { beforeEach, describe, expect, it, vi } from 'vitest'
import { attachExport, DISCOUNT_FACTOR, exportOrder } from '../export.js'
import { HISTORY_PAGE, INVOICE_PAGE, ORDER_PAGE, SHIPMENT_PAGE } from './fixtures.js'

const pages: Record<string, string> = { 'AB-0001': ORDER_PAGE, 'LS-0001': SHIPMENT_PAGE, 'RE-0001': INVOICE_PAGE }
const fetchMock = vi.fn((_url: string, init: RequestInit) => {
    const body = init.body as FormData
    return Promise.resolve(new Response(pages[body.get('document_no') as string] ?? ''))
})
const createObjectURL = vi.fn((_blob: Blob) => 'blob:fake')
const click = vi.fn<(this: HTMLAnchorElement) => void>()

function orderForm(): HTMLFormElement {
    document.body.innerHTML = HISTORY_PAGE
    return document.querySelector('form')!
}

/** The downloaded file; `text` is decoded without the BOM, `bom` the first three bytes. */
async function downloaded(): Promise<{ name: string; bom: string; text: string }> {
    const link = click.mock.contexts[0]!
    const bytes = new Uint8Array(await createObjectURL.mock.calls[0]![0].arrayBuffer())
    return { name: link.download, bom: bytes.slice(0, 3).join(','), text: new TextDecoder().decode(bytes) }
}

describe('herkules export', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        document.querySelector('#herkules-export-panel')?.remove()
        vi.stubGlobal('fetch', fetchMock)
        URL.createObjectURL = createObjectURL
        URL.revokeObjectURL = vi.fn()
        HTMLAnchorElement.prototype.click = click
    })

    it('applies the stored factor and takes the references from shipment then invoice', async () => {
        GM_setValue(DISCOUNT_FACTOR.key, 0.123)
        const button = document.createElement('button')
        const status = document.createElement('span')
        await exportOrder(orderForm(), button, status)
        const sent = fetchMock.mock.calls.map(([, init]) => init.body as FormData)
        expect(sent.map((body) => body.get('document_no'))).toEqual(['AB-0001', 'LS-0001', 'RE-0001'])
        expect(sent[0]!.get('view_document_card')).toBe('1')
        expect(sent[0]!.has('request_document_pdf')).toBe(false)
        const { name, bom, text } = await downloaded()
        expect(name).toBe('herkules-AB-0001.csv')
        expect(bom).toBe('239,187,191')
        expect(text.split('\r\n')[1]).toBe('ART-0001;D-BE0000001-I;ART-X1;Testartikel Eins;6;0,5059;01.02.2030;N;AB-0001')
        // ART-0002 has no reference in the fixtures: the file is written, the button says so.
        expect(button.textContent).toBe('⚠ CSV')
        expect(status.textContent).toContain('1 von 2 Positionen ohne D-BE-Referenz')
    })

    it('without a stored factor loads nothing, says why and takes the user to the field', async () => {
        GM_setValue(DISCOUNT_FACTOR.key, undefined)
        const form = orderForm()
        attachExport()
        await vi.waitFor(() => expect(document.querySelector('.herkules-reference')?.textContent).toBe('D-BE0000001 VPE=3 ART-X1'))
        fetchMock.mockClear()
        const button = document.querySelector<HTMLButtonElement>('.herkules-csv-btn')!
        const status = document.querySelector<HTMLElement>('.herkules-status')!
        await exportOrder(form, button, status)
        expect(fetchMock).not.toHaveBeenCalled()
        expect(createObjectURL).not.toHaveBeenCalled()
        expect(button.textContent).toBe('✗ CSV')
        expect(status.textContent).toContain('Skonto-Faktor fehlt')
        const input = document.querySelector('#herkules-export-panel input')
        expect(document.activeElement).toBe(input)
        expect(input?.getAttribute('aria-invalid')).toBe('true')
        GM_setValue(DISCOUNT_FACTOR.key, 0.123)
        await exportOrder(form, button, status)
        expect(status.textContent).toContain('ohne D-BE-Referenz')
        expect(button.title).not.toContain('Skonto-Faktor fehlt')
    })

    it('adds one CSV button and one reference per order, and one panel, however often it runs', async () => {
        orderForm()
        attachExport()
        attachExport()
        expect([...document.querySelectorAll('.herkules-csv-btn')].map((b) => b.textContent)).toEqual(['CSV'])
        expect(document.querySelectorAll('.herkules-reference')).toHaveLength(1)
        expect(document.querySelectorAll('#herkules-export-panel')).toHaveLength(1)
        await vi.waitFor(() => expect(document.querySelector('.herkules-reference')?.textContent).toBe('D-BE0000001 VPE=3 ART-X1'))
    })

    it('marks a reference the import cannot use, and places the panel beside the heading', async () => {
        const shipment = pages['LS-0001']!
        pages['LS-0001'] = shipment.replace('D-BE0000001 VPE=3 ART-X1', 'Freitext')
        document.body.innerHTML = `<h1>Bestellungen</h1>${HISTORY_PAGE}`
        attachExport()
        const label = () => document.querySelector<HTMLElement>('.herkules-reference')
        await vi.waitFor(() => expect(label()?.textContent).toBe('Freitext'))
        expect(label()?.classList.contains('is-unusable')).toBe(true)
        expect(label()?.title).toContain('Keine D-BE-Nummer')
        expect(document.querySelector('h1')?.previousElementSibling?.id).toBe('herkules-export-panel')
        pages['LS-0001'] = shipment
    })

    it('shows when an order has no reference yet, without asking the portal for a document it does not have', async () => {
        document.body.innerHTML = HISTORY_PAGE.replaceAll(/<form[^>]*>(?:(?!<\/form>)[\s\S])*?value="(?:shipment|invoice)"(?:(?!<\/form>)[\s\S])*?<\/form>/g, '')
        attachExport()
        await vi.waitFor(() => expect(document.querySelector('.herkules-reference')?.textContent).toBe('Referenz fehlt'))
        expect(fetchMock).not.toHaveBeenCalled()
    })
})
