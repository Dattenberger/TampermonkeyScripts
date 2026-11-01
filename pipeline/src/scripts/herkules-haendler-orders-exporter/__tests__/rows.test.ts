import { describe, expect, it } from 'vitest'
import { csvField, orderNumberOf, parseTypedOrderNumber, toCsv, toJtlRows } from '../rows.js'

const positions = [
    { articleNumber: 'ART-0001', name: 'Eins', quantity: 2, unitPrice: 12.34 },
    { articleNumber: 'ART-0002', name: 'Zwei', quantity: Number.NaN, unitPrice: 5 },
]

describe('herkules export rows', () => {
    it('builds the JTL rows with VPE, our article number and the factor applied', () => {
        const references = new Map([['ART-0001', 'D-BE00000012 VPE=3 ART-X1']])
        const [first, second] = toJtlRows(positions, 'AB-0001', '01.02.2030', references, 0.123, 'D-BE00000012')
        expect(first).toEqual({
            HAN: 'ART-0001',
            'Interne Bestellnummer': 'D-BE00000012-I',
            Artikelnummer: 'ART-X1',
            Lieferantenbezeichnung: 'Eins',
            menge: 6,
            // 12.34 × 2 × 0.123 / 6
            'EK netto': '0,5059',
            Lieferdatum: '01.02.2030',
            Freiposition: 'N',
            Fremdbelegnummer: 'AB-0001',
        })
        expect(second).toMatchObject({ 'Interne Bestellnummer': 'D-BE00000012-I', Artikelnummer: '', menge: '', 'EK netto': '' })
    })

    it('treats a reference without VPE as one piece per unit', () => {
        const [row] = toJtlRows(positions.slice(0, 1), 'AB-0001', '', new Map([['ART-0001', 'D-BE0000001 ART-X1']]), 1, 'D-BE0000001')
        expect(row).toMatchObject({ menge: 2, Artikelnummer: 'ART-X1', 'EK netto': '12,3400' })
    })

    it('takes the typed number with or without -I, and nothing else', () => {
        expect(parseTypedOrderNumber('D-BE00000012')).toBe('D-BE00000012')
        expect(parseTypedOrderNumber(' d-be00000012-i ')).toBe('D-BE00000012')
        for (const bad of ['', 'Rahn', 'D-BE', 'D-BE12 X', 'D-AU12', 'D-BE12-I-2']) expect(parseTypedOrderNumber(bad)).toBeNull()
    })

    it('finds a suggestion at the start of a reference only', () => {
        expect(orderNumberOf('D-BE00000012 VPE=3 ART-X1')).toBe('D-BE00000012')
        expect(orderNumberOf('D-BE00000012-I')).toBe('D-BE00000012')
        expect(orderNumberOf('Kunde D-BE1')).toBe('')
    })

    it('quotes CSV fields only when needed and joins with semicolons and CRLF', () => {
        expect(csvField('a "b"; c')).toBe('"a ""b""; c"')
        expect(csvField(1.5)).toBe('1.5')
        expect(toCsv([{ a: 'x;y', b: 1 }, { a: 'z', b: '' }])).toBe('a;b\r\n"x;y";1\r\nz;')
        expect(toCsv([])).toBe('')
    })
})
