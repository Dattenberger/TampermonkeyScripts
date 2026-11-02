import { beforeEach, describe, expect, it, vi } from 'vitest'
import { attachExport, DISCOUNT_FACTOR } from '../export.js'
import { ORDER_NUMBERS_KEY } from '../order-numbers.js'
import { HISTORY_PAGE, INVOICE_PAGE, modal, ORDER_PAGE, row, SHIPMENT_PAGE } from './fixtures.js'

const pages: Record<string, string> = {}
const fetchMock = vi.fn((_url: string, init: RequestInit) => {
    const body = init.body as FormData
    return Promise.resolve(new Response(pages[body.get('document_no') as string] ?? ''))
})
const createObjectURL = vi.fn((_blob: Blob) => 'blob:fake')
const click = vi.fn<(this: HTMLAnchorElement) => void>()

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
        Object.assign(pages, { 'AB-0001': ORDER_PAGE, 'LS-0001': SHIPMENT_PAGE, 'RE-0001': INVOICE_PAGE })
        GM_setValue(DISCOUNT_FACTOR.key, 0.123)
        GM_setValue(ORDER_NUMBERS_KEY, undefined)
        vi.stubGlobal('fetch', fetchMock)
        URL.createObjectURL = createObjectURL
        URL.revokeObjectURL = vi.fn()
        HTMLAnchorElement.prototype.click = click
    })

    /** The row as the script builds it, once its references are loaded. */
    async function loadRow(page = HISTORY_PAGE) {
        document.body.innerHTML = page
        attachExport()
        const input = document.querySelector<HTMLInputElement>('.herkules-order-field')!
        await vi.waitFor(() => expect(input.title).not.toContain('lädt'))
        return {
            input,
            button: document.querySelector<HTMLButtonElement>('.herkules-csv-btn')!,
            status: document.querySelector<HTMLElement>('.herkules-status')!,
        }
    }
    function type(input: HTMLInputElement, value: string) {
        input.value = value
        input.dispatchEvent(new Event('input'))
        input.dispatchEvent(new Event('change'))
    }
    function exportedFrom(references: string) {
        pages['LS-0001'] = references
        pages['RE-0001'] = '<html></html>'
    }

    it('fills the field grey from the reference, without storing it, and exports it with -I', async () => {
        const { input, button, status } = await loadRow()
        expect(input.value).toBe('D-BE0000001')
        expect(input.classList.contains('is-suggested')).toBe(true)
        expect(input.title).toContain('D-BE0000001 VPE=3 ART-X1')
        expect(GM_getValue(ORDER_NUMBERS_KEY)).toBeUndefined()
        const sent = fetchMock.mock.calls.map(([, init]) => init.body as FormData)
        expect(sent.map((body) => body.get('document_no'))).toEqual(['LS-0001', 'RE-0001'])
        fetchMock.mockClear()
        button.click()
        await vi.waitFor(() => expect(button.textContent).toBe('✓ CSV'))
        const order = fetchMock.mock.calls.map(([, init]) => init.body as FormData)
        expect(order.map((body) => body.get('document_no'))).toEqual(['AB-0001'])
        expect(order[0]!.get('view_document_card')).toBe('1')
        expect(order[0]!.has('request_document_pdf')).toBe(false)
        const { name, bom, text } = await downloaded()
        expect(name).toBe('herkules-AB-0001.csv')
        expect(bom).toBe('239,187,191')
        const lines = text.split('\r\n')
        expect(lines[1]).toBe('ART-0001;D-BE0000001-I;ART-X1;Testartikel Eins;6;0,5059;01.02.2030;N;AB-0001')
        expect(lines[2]!.split(';')[1]).toBe('D-BE0000001-I')
        expect(status.textContent).toBe('Heruntergeladen mit D-BE0000001-I')
    })

    it('stores a typed number without -I, prefers it over the reference after a reload, and keeps other orders', async () => {
        GM_setValue(ORDER_NUMBERS_KEY, { version: 1, orders: { 'AB-0002': { orderNumber: 'D-BE2', updatedAt: 'x' } } })
        const { input } = await loadRow()
        type(input, ' d-be0000007-i ')
        expect(input.value).toBe('D-BE0000007')
        expect(input.classList.contains('is-suggested')).toBe(false)
        expect(input.title).toContain('Von Hand eingetragen')
        const stored = GM_getValue<{ orders: Record<string, { orderNumber: string }> }>(ORDER_NUMBERS_KEY)
        expect(Object.keys(stored.orders).toSorted()).toEqual(['AB-0001', 'AB-0002'])
        expect(stored.orders['AB-0001']!.orderNumber).toBe('D-BE0000007')
        const reloaded = await loadRow()
        expect(reloaded.input.value).toBe('D-BE0000007')
        expect(reloaded.input.classList.contains('is-suggested')).toBe(false)
    })

    it('keeps a reference that is no D-BE number out of the field, and shows it on hover', async () => {
        exportedFrom(modal(row('Nr.: ART-0001') + row('Ihre Referenz: Kunde Muster')))
        const { input } = await loadRow()
        expect(input.value).toBe('')
        expect(input.placeholder).toBe('Referenz nicht erkannt')
        expect(input.title).toContain('Kunde Muster')
    })

    it('fills nothing when an order holds two different numbers, and shows both on hover', async () => {
        exportedFrom(modal(row('Nr.: ART-0001') + row('Ihre Referenz: D-BE1') + row('Nr.: ART-0002') + row('Ihre Referenz: D-BE2')))
        const { input } = await loadRow()
        expect(input.value).toBe('')
        expect(input.title).toContain('D-BE1 · D-BE2')
    })

    it('says so when the references cannot be loaded, and a typed number still exports', async () => {
        fetchMock.mockRejectedValueOnce(new Error('offline'))
        const { input, button } = await loadRow()
        expect(input.placeholder).toBe('Referenz nicht geladen')
        type(input, 'D-BE0000007')
        button.click()
        await vi.waitFor(() => expect(button.textContent).toBe('✓ CSV'))
        const { text } = await downloaded()
        expect(text.split('\r\n')[1]).toContain(';D-BE0000007-I;ART-X1;')
    })

    it('refuses an invalid number without storing it, and Enter does not submit the portal form', async () => {
        const submit = vi.fn((event: Event) => event.preventDefault())
        const { input, button, status } = await loadRow()
        document.querySelector('form')!.addEventListener('submit', submit)
        input.value = 'Test123'
        const enter = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true })
        input.dispatchEvent(enter)
        expect(enter.defaultPrevented).toBe(true)
        expect(submit).not.toHaveBeenCalled()
        expect(input.getAttribute('aria-invalid')).toBe('true')
        expect(status.textContent).toContain('Nicht gespeichert')
        expect(GM_getValue(ORDER_NUMBERS_KEY)).toBeUndefined()
        fetchMock.mockClear()
        button.click()
        await vi.waitFor(() => expect(button.textContent).toBe('✗ CSV'))
        expect(fetchMock).not.toHaveBeenCalled()
        expect(createObjectURL).not.toHaveBeenCalled()
    })

    it('with an empty field one click only asks, a double click exports without a number', async () => {
        const { input, button, status } = await loadRow()
        type(input, '')
        expect(input.value).toBe('')
        button.dispatchEvent(new MouseEvent('click', { detail: 1 }))
        expect(button.textContent).toBe('✗ CSV')
        expect(status.textContent).toContain('Doppelklick')
        expect(document.activeElement).toBe(input)
        expect(createObjectURL).not.toHaveBeenCalled()
        button.dispatchEvent(new MouseEvent('click', { detail: 2 }))
        button.dispatchEvent(new MouseEvent('dblclick', { detail: 2 }))
        await vi.waitFor(() => expect(button.textContent).toBe('✓ CSV'))
        expect(createObjectURL).toHaveBeenCalledTimes(1)
        const { text } = await downloaded()
        const fields = text.split('\r\n')[1]!.split(';')
        expect(fields[1]).toBe('')
        expect(fields[8]).toBe('AB-0001')
        expect(status.textContent).toContain('ohne Nummer')
    })

    it('a double click with a number exports once', async () => {
        const { button } = await loadRow()
        button.dispatchEvent(new MouseEvent('click', { detail: 1 }))
        button.dispatchEvent(new MouseEvent('click', { detail: 2 }))
        button.dispatchEvent(new MouseEvent('dblclick', { detail: 2 }))
        await vi.waitFor(() => expect(button.textContent).toBe('✓ CSV'))
        expect(createObjectURL).toHaveBeenCalledTimes(1)
    })

    it('while the references load, an empty field neither asks for a number nor exports without one', () => {
        document.body.innerHTML = HISTORY_PAGE
        attachExport()
        const button = document.querySelector<HTMLButtonElement>('.herkules-csv-btn')!
        button.dispatchEvent(new MouseEvent('click', { detail: 1 }))
        button.dispatchEvent(new MouseEvent('dblclick', { detail: 2 }))
        expect(document.querySelector('.herkules-status')!.textContent).toContain('lädt noch')
        expect(createObjectURL).not.toHaveBeenCalled()
    })

    it('uses the factor and the number shown once the documents are there, and stops if the factor was cleared', async () => {
        GM_setValue(DISCOUNT_FACTOR.key, 0.5)
        const { input, button, status } = await loadRow()
        button.click()
        GM_setValue(DISCOUNT_FACTOR.key, 0.123)
        type(input, 'D-BE0000007')
        await vi.waitFor(() => expect(button.textContent).toBe('✓ CSV'))
        const { text } = await downloaded()
        expect(text.split('\r\n')[1]).toContain(';D-BE0000007-I;ART-X1;Testartikel Eins;6;0,5059;')
        vi.clearAllMocks()
        GM_setValue(DISCOUNT_FACTOR.key, 0.5)
        button.click()
        GM_setValue(DISCOUNT_FACTOR.key, undefined)
        await vi.waitFor(() => expect(button.textContent).toBe('✗ CSV'))
        expect(createObjectURL).not.toHaveBeenCalled()
        expect(status.textContent).toContain('Skonto-Faktor fehlt')
    })

    it('without a stored factor loads no order, says why in the row and takes the user to the field', async () => {
        GM_setValue(DISCOUNT_FACTOR.key, undefined)
        const { button, status } = await loadRow()
        fetchMock.mockClear()
        button.click()
        expect(button.textContent).toBe('✗ CSV')
        expect(fetchMock).not.toHaveBeenCalled()
        expect(status.textContent).toContain('Skonto-Faktor fehlt')
        const input = document.querySelector('#herkules-export-panel input')
        expect(document.activeElement).toBe(input)
        expect(input?.getAttribute('aria-invalid')).toBe('true')
    })

    it('adds one field, one CSV button per order and one panel, however often it runs, and loads each row once', async () => {
        document.body.innerHTML = `<h1>Bestellungen</h1>${HISTORY_PAGE}`
        attachExport()
        attachExport()
        expect([...document.querySelectorAll('.herkules-csv-btn')].map((b) => b.textContent)).toEqual(['CSV'])
        expect(document.querySelectorAll('.herkules-order-field')).toHaveLength(1)
        expect(document.querySelector('.herkules-order-field')?.nextElementSibling?.className).toBe('herkules-csv-btn')
        expect(document.querySelectorAll('#herkules-export-panel')).toHaveLength(1)
        expect(document.querySelector('h1')?.previousElementSibling?.id).toBe('herkules-export-panel')
        await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    })
})
