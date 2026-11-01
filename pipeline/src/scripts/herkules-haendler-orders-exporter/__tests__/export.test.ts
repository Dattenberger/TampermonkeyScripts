import { beforeEach, describe, expect, it, vi } from 'vitest'
import { attachExport, DISCOUNT_FACTOR } from '../export.js'
import { HISTORY_PAGE, INVOICE_PAGE, ORDER_PAGE, SHIPMENT_PAGE } from './fixtures.js'

const pages: Record<string, string> = { 'AB-0001': ORDER_PAGE, 'LS-0001': SHIPMENT_PAGE, 'RE-0001': INVOICE_PAGE }
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
        vi.stubGlobal('fetch', fetchMock)
        URL.createObjectURL = createObjectURL
        URL.revokeObjectURL = vi.fn()
        HTMLAnchorElement.prototype.click = click
    })

    /** The row as the script builds it, and a click on its CSV button. */
    function clickCsv(page = HISTORY_PAGE) {
        document.body.innerHTML = page
        attachExport()
        const button = document.querySelector<HTMLButtonElement>('.herkules-csv-btn')!
        button.click()
        return { button, status: document.querySelector<HTMLElement>('.herkules-status')! }
    }
    const field = () => document.querySelector<HTMLInputElement>('.herkules-order-number input')

    it('asks for the number with a suggestion from the references, then exports with the factor and -I', async () => {
        GM_setValue(DISCOUNT_FACTOR.key, 0.123)
        const { button } = clickCsv()
        await vi.waitFor(() => expect(field()).not.toBeNull())
        expect(field()!.value).toBe('D-BE0000001')
        const sent = fetchMock.mock.calls.map(([, init]) => init.body as FormData)
        expect(sent.map((body) => body.get('document_no'))).toEqual(['AB-0001', 'LS-0001', 'RE-0001'])
        expect(sent[0]!.get('view_document_card')).toBe('1')
        expect(sent[0]!.has('request_document_pdf')).toBe(false)
        expect(createObjectURL).not.toHaveBeenCalled()
        expect(button.disabled).toBe(true)
        field()!.value = 'D-BE0000007-I'
        document.querySelector<HTMLButtonElement>('.herkules-order-number .is-primary')!.click()
        await vi.waitFor(() => expect(button.textContent).toBe('✓ CSV'))
        const { name, bom, text } = await downloaded()
        expect(name).toBe('herkules-AB-0001.csv')
        expect(bom).toBe('239,187,191')
        const lines = text.split('\r\n')
        expect(lines[1]).toBe('ART-0001;D-BE0000007-I;ART-X1;Testartikel Eins;6;0,5059;01.02.2030;N;AB-0001')
        expect(lines[2]!.split(';')[1]).toBe('D-BE0000007-I')
        expect(field()).toBeNull()
    })

    it('refuses anything but a D-BE number, and Enter does not submit the portal form', async () => {
        GM_setValue(DISCOUNT_FACTOR.key, 0.123)
        const submit = vi.fn((event: Event) => event.preventDefault())
        clickCsv()
        document.querySelector('form')!.addEventListener('submit', submit)
        await vi.waitFor(() => expect(field()).not.toBeNull())
        field()!.value = 'Rahn'
        const enter = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true })
        field()!.dispatchEvent(enter)
        expect(enter.defaultPrevented).toBe(true)
        expect(field()!.getAttribute('aria-invalid')).toBe('true')
        expect(createObjectURL).not.toHaveBeenCalled()
        expect(submit).not.toHaveBeenCalled()
    })

    it('cancelling leaves no file and the button as it was', async () => {
        GM_setValue(DISCOUNT_FACTOR.key, 0.123)
        const { button } = clickCsv()
        await vi.waitFor(() => expect(field()).not.toBeNull())
        field()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
        await vi.waitFor(() => expect(button.textContent).toBe('CSV'))
        expect(createObjectURL).not.toHaveBeenCalled()
        expect(button.disabled).toBe(false)
    })

    it('without a stored factor loads nothing, says why in the row and takes the user to the field', async () => {
        GM_setValue(DISCOUNT_FACTOR.key, undefined)
        const { button, status } = clickCsv()
        await vi.waitFor(() => expect(button.textContent).toBe('✗ CSV'))
        expect(fetchMock).not.toHaveBeenCalled()
        expect(status.textContent).toContain('Skonto-Faktor fehlt')
        const input = document.querySelector('#herkules-export-panel input')
        expect(document.activeElement).toBe(input)
        expect(input?.getAttribute('aria-invalid')).toBe('true')
    })

    it('adds one CSV button per order and one panel, however often it runs, and asks the portal nothing until a click', () => {
        document.body.innerHTML = `<h1>Bestellungen</h1>${HISTORY_PAGE}`
        attachExport()
        attachExport()
        expect([...document.querySelectorAll('.herkules-csv-btn')].map((b) => b.textContent)).toEqual(['CSV'])
        expect(document.querySelectorAll('#herkules-export-panel')).toHaveLength(1)
        expect(document.querySelector('h1')?.previousElementSibling?.id).toBe('herkules-export-panel')
        expect(fetchMock).not.toHaveBeenCalled()
    })
})
