import { beforeEach, describe, expect, it, vi } from 'vitest'
import { attachButtons, DISCOUNT_FACTOR, exportOrder } from '../export.js'
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
        vi.stubGlobal('fetch', fetchMock)
        vi.stubGlobal('prompt', vi.fn(() => null))
        vi.stubGlobal('alert', vi.fn())
        URL.createObjectURL = createObjectURL
        URL.revokeObjectURL = vi.fn()
        HTMLAnchorElement.prototype.click = click
    })

    it('applies the stored factor and takes the references from shipment then invoice', async () => {
        GM_setValue(DISCOUNT_FACTOR.key, 0.123)
        const button = document.createElement('button')
        await exportOrder(orderForm(), button, 'jtl')
        const sent = fetchMock.mock.calls.map(([, init]) => init.body as FormData)
        expect(sent.map((body) => body.get('document_no'))).toEqual(['AB-0001', 'LS-0001', 'RE-0001'])
        expect(sent[0]!.get('view_document_card')).toBe('1')
        expect(sent[0]!.has('request_document_pdf')).toBe(false)
        const { name, bom, text } = await downloaded()
        expect(name).toBe('herkules-AB-0001.csv')
        expect(bom).toBe('239,187,191')
        expect(text.split('\r\n')[1]).toBe('ART-0001;D-BE0000001;ART-X1;Testartikel Eins;6;0,5059;01.02.2030;N;AB-0001')
        expect(button.textContent).toMatch(/^✓ /)
    })

    it('stops before loading anything when the user cancels the factor prompt', async () => {
        const button = document.createElement('button')
        button.textContent = 'CSV'
        await exportOrder(orderForm(), button, 'jtl')
        expect(prompt).toHaveBeenCalledTimes(1)
        expect(fetchMock).not.toHaveBeenCalled()
        expect(createObjectURL).not.toHaveBeenCalled()
        expect(button.textContent).toBe('✗ CSV')
        expect(button.title).toBe('Export abgebrochen: kein Skonto-Faktor hinterlegt')
    })

    it('exports article;quantity without asking for the factor', async () => {
        await exportOrder(orderForm(), document.createElement('button'), 'artikel-menge')
        expect(prompt).not.toHaveBeenCalled()
        const { name, text } = await downloaded()
        expect(name).toBe('herkules-AB-0001-artikel-menge.csv')
        expect(text).toBe('Artikel;Menge\r\nART-0001;2\r\nART-0002;1000')
    })

    it('adds both buttons once, only to order forms', () => {
        orderForm()
        attachButtons()
        attachButtons()
        const labels = [...document.querySelectorAll('.herkules-export-btn')].map((b) => b.textContent)
        expect(labels).toEqual(['CSV', 'Artikel;Menge'])
    })
})
