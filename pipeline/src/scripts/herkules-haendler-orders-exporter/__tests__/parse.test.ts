import { describe, expect, it } from 'vitest'
import { parseNumber, parseOrderDate, parsePositions, parseReferences } from '../parse.js'
import { INVOICE_PAGE, ORDER_PAGE, SHIPMENT_PAGE } from './fixtures.js'

const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html')

describe('herkules page parsing', () => {
    it('reads German numbers with thousands dots and currency', () => {
        expect(parseNumber('1.234,50 €')).toBe(1234.5)
        expect(parseNumber(' 2 ')).toBe(2)
        expect(parseNumber('')).toBeNaN()
    })

    it('reads the positions of an order and skips header and section rows', () => {
        expect(parsePositions(parse(ORDER_PAGE))).toEqual([
            { articleNumber: 'ART-0001', name: 'Testartikel Eins', quantity: 2, unitPrice: 12.34 },
            { articleNumber: 'ART-0002', name: 'Testartikel; "Zwei"', quantity: 1000, unitPrice: 1234.5 },
        ])
    })

    it('reads the reference of the row after each position, first one per article', () => {
        expect([...parseReferences(parse(SHIPMENT_PAGE))]).toEqual([['ART-0001', 'D-BE0000001 VPE=3 ART-X1']])
        expect(parseReferences(parse(INVOICE_PAGE)).get('ART-0001')).toBe('D-BE0000009')
    })

    it('reads the order date from the modal, empty without one', () => {
        expect(parseOrderDate(parse(ORDER_PAGE))).toBe('01.02.2030')
        expect(parseOrderDate(parse('<div class="modal">kein Datum</div>'))).toBe('')
    })
})
