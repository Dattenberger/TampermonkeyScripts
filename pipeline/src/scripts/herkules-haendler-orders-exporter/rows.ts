// CSV rows of the two export formats and the CSV helpers.

import type { Position } from './parse.js'

export type CsvRow = Record<string, string | number>

const SEPARATOR = ';'
const BOM = String.fromCodePoint(0xfe_ff)

function group(text: string, regex: RegExp): string {
    return regex.exec(text)?.[1] ?? ''
}

/**
 * Same columns and order as the Husqvarna portal orders exporter (JTL purchase-order import).
 * The reference follows the same conventions as there: "D-BE<nr> [VPE=<n>] [<our article no>]".
 */
export function toJtlRows(
    positions: Position[],
    orderNumber: string,
    deliveryDate: string,
    references: Map<string, string>,
    discountFactor: number,
): CsvRow[] {
    return positions.map((p) => {
        const reference = references.get(p.articleNumber) ?? ''
        const parsedVpe = Number.parseInt(group(reference, /^D-BE\S*\s*VPE=(\d+)/), 10)
        const vpe = Number.isFinite(parsedVpe) && parsedVpe >= 1 ? parsedVpe : 1
        const quantity = p.quantity * vpe
        const price = Number.isFinite(p.unitPrice) && quantity > 0 ? (p.unitPrice * p.quantity * discountFactor) / quantity : Number.NaN
        return {
            HAN: p.articleNumber,
            'Interne Bestellnummer': group(reference, /^(D-BE\S*)/).slice(0, 14),
            Artikelnummer: group(reference, /^D-BE\S*\s*(?:VPE=\d*)?\s*(\S*)/),
            Lieferantenbezeichnung: p.name,
            menge: Number.isFinite(quantity) ? quantity : '',
            'EK netto': Number.isFinite(price) ? price.toFixed(4).replace('.', ',') : '',
            Lieferdatum: deliveryDate,
            Freiposition: 'N',
            Fremdbelegnummer: orderNumber,
        }
    })
}

/** Re-import format for Herkules orders: manufacturer number;quantity. */
export function toArticleQuantityRows(positions: Position[]): CsvRow[] {
    return positions.map((p) => ({ Artikel: p.articleNumber, Menge: Number.isFinite(p.quantity) ? p.quantity : '' }))
}

export function csvField(value: string | number | undefined): string {
    const text = value == null ? '' : String(value)
    return /[";\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function toCsv(rows: CsvRow[]): string {
    if (rows.length === 0) return ''
    const header = Object.keys(rows[0]!)
    const lines = [header.map((h) => csvField(h)), ...rows.map((row) => header.map((h) => csvField(row[h])))]
    return lines.map((fields) => fields.join(SEPARATOR)).join('\r\n')
}

/** Downloads the CSV (UTF-8 with BOM, so Excel reads the umlauts). */
export function downloadCsv(csv: string, filename: string): void {
    const url = URL.createObjectURL(new Blob([BOM + csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = filename.replaceAll(/[\\/:*?"<>|]+/g, '_')
    document.body.append(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
