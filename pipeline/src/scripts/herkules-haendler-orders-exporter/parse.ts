// Parsing of the portal's document modals (.modal .itemtable_list .itemtable_row).
// Positions come from the order card; our reference per position only from its shipment and
// invoice cards, so it is empty for an order that has neither yet.

export interface Position {
    articleNumber: string
    name: string
    quantity: number
    unitPrice: number
}

const ROWS = '.modal .itemtable_list .itemtable_row'

/** German number ("1.234,50 €"); NaN when there is none. */
export function parseNumber(text: string): number {
    const cleaned = text.replaceAll(/[^\d,.-]/g, '').replaceAll('.', '').replace(',', '.')
    return Number.parseFloat(cleaned)
}

/** Cell text without the labels the portal repeats for small screens ("Menge", "Stück:"). */
export function cellText(row: Element, selector: string): string {
    const cell = row.querySelector(selector)
    if (!cell) return ''
    const clone = cell.cloneNode(true) as Element
    for (const label of clone.querySelectorAll('.itemtable_label, [class*="visible-"]')) label.remove()
    return (clone.textContent ?? '').replaceAll(/\s+/g, ' ').trim()
}

function parsePosition(row: Element): Position | null {
    const description = row.querySelector('.description_line')
    const match = /Artikel-Nr\.:\s*(\S+)/.exec(description?.textContent ?? '')
    if (!description || !match?.[1]) return null // header row and section rows ("Ihre Onlinebestellung: …")
    return {
        articleNumber: match[1],
        name: (description.querySelector('strong')?.textContent ?? '').replaceAll(/\s+/g, ' ').trim(),
        quantity: parseNumber(cellText(row, '.text-center')),
        unitPrice: parseNumber(cellText(row, '.text-right.hidden-xs')),
    }
}

/** Positions of an order modal: article number, description, quantity, unit price. */
export function parsePositions(doc: ParentNode): Position[] {
    return [...doc.querySelectorAll(ROWS)].map((row) => parsePosition(row)).filter((p) => p !== null)
}

/**
 * "Ihre Referenz" (the per-position reference typed in the basket, our D-BE… order number) is
 * shown only in the shipment and invoice cards, as the row right after the position row
 * ("Nr.: <article>"). Returns article number → reference, the first one per article.
 */
export function parseReferences(doc: ParentNode): Map<string, string> {
    const references = new Map<string, string>()
    let lastArticle: string | undefined
    for (const row of doc.querySelectorAll(ROWS)) {
        const text = cellText(row, '.description_line')
        const article = /Nr\.:\s*(\S+)/.exec(text)?.[1]
        const reference = /Ihre Referenz:\s*(.+?)\s*$/.exec(text)?.[1]
        if (article) lastArticle = article
        else if (reference && lastArticle && !references.has(lastArticle)) references.set(lastArticle, reference)
    }
    return references
}

export function parseOrderDate(doc: ParentNode): string {
    return /Datum:\s*(\d{2}\.\d{2}\.\d{4})/.exec(doc.querySelector('.modal')?.textContent ?? '')?.[1] ?? ''
}
