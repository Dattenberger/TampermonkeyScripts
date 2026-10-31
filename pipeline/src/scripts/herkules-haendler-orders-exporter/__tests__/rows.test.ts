import { describe, expect, it } from 'vitest'
import { csvField, toArticleQuantityRows, toCsv, toJtlRows } from '../rows.js'

const positions = [
    { articleNumber: 'ART-0001', name: 'Eins', quantity: 2, unitPrice: 12.34 },
    { articleNumber: 'ART-0002', name: 'Zwei', quantity: Number.NaN, unitPrice: 5 },
]

describe('herkules export rows', () => {
    it('builds the JTL rows with VPE, our article number and the factor applied', () => {
        const references = new Map([['ART-0001', 'D-BE0000001234567 VPE=3 ART-X1']])
        const [first, second] = toJtlRows(positions, 'AB-0001', '01.02.2030', references, 0.123)
        expect(first).toEqual({
            HAN: 'ART-0001',
            'Interne Bestellnummer': 'D-BE0000001234',
            Artikelnummer: 'ART-X1',
            Lieferantenbezeichnung: 'Eins',
            menge: 6,
            // 12.34 × 2 × 0.123 / 6
            'EK netto': '0,5059',
            Lieferdatum: '01.02.2030',
            Freiposition: 'N',
            Fremdbelegnummer: 'AB-0001',
        })
        expect(second).toMatchObject({ 'Interne Bestellnummer': '', Artikelnummer: '', menge: '', 'EK netto': '' })
    })

    it('treats a reference without VPE as one piece per unit', () => {
        const [row] = toJtlRows(positions.slice(0, 1), 'AB-0001', '', new Map([['ART-0001', 'D-BE0000001 ART-X1']]), 1)
        expect(row).toMatchObject({ menge: 2, Artikelnummer: 'ART-X1', 'EK netto': '12,3400' })
    })

    it('builds the article;quantity rows for the re-import', () => {
        expect(toArticleQuantityRows(positions)).toEqual([
            { Artikel: 'ART-0001', Menge: 2 },
            { Artikel: 'ART-0002', Menge: '' },
        ])
    })

    it('quotes CSV fields only when needed and joins with semicolons and CRLF', () => {
        expect(csvField('a "b"; c')).toBe('"a ""b""; c"')
        expect(csvField(1.5)).toBe('1.5')
        expect(toCsv([{ a: 'x;y', b: 1 }, { a: 'z', b: '' }])).toBe('a;b\r\n"x;y";1\r\nz;')
        expect(toCsv([])).toBe('')
    })
})
