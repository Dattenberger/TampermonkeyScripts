// The field for our D-BE number in an order row. What it shows is what the export uses: a number the
// user typed (stored, dark), else the one from the portal's references (not stored, grey), else nothing.

import { readOrderNumber, writeOrderNumber } from './order-numbers.js'
import { orderNumberOf, parseTypedOrderNumber } from './rows.js'

export const ORDER_FIELD = 'herkules-order-field'
const SUGGESTED = 'is-suggested'
/** Shown for a typed value that is no D-BE number; the export refuses it with the same words. */
export const INVALID_TEXT = 'Keine gültige D-BE-Nummer.'
/** Placeholders: while the references load, then, whatever they held, an invitation to type. */
const LOADING = 'lädt …'
const TYPE_IT = 'D-BE eintragen'

export interface OrderField {
    input: HTMLInputElement
    /** True until the references of the row were loaded or failed. */
    pending: () => boolean
    /** The number without -I, '' for an empty field, null for an invalid one. */
    read: () => string | null
    showReferences: (references: ReadonlyMap<string, string>) => void
    showLoadFailure: () => void
    markInvalid: () => void
}

/** `onEdit` gets the problem with the user's change, or nothing when the change was fine. */
export function createOrderField(portalOrder: string, onEdit: (problem?: string) => void): OrderField {
    const input = document.createElement('input')
    input.type = 'text'
    input.autocomplete = 'off'
    input.className = ORDER_FIELD
    input.setAttribute('aria-label', `D-BE-Nummer von Bestellung ${portalOrder}`)
    input.value = readOrderNumber(portalOrder)

    let source: string | undefined = 'Die Referenz aus Lieferschein und Rechnung lädt.'
    let pending = true
    let edited = Boolean(input.value)
    const describe = () => {
        const typed = edited && input.value ? 'Von Hand eingetragen. ' : ''
        input.title = `${typed}${source ?? ''}`
        input.placeholder = pending && !edited ? LOADING : TYPE_IT
    }
    describe()

    const commit = () => {
        const value = input.value.trim()
        const number = value ? parseTypedOrderNumber(value) : ''
        if (number === null) {
            input.setAttribute('aria-invalid', 'true')
            onEdit(INVALID_TEXT)
            return
        }
        input.value = number
        input.removeAttribute('aria-invalid')
        writeOrderNumber(portalOrder, number)
        describe()
        onEdit()
    }
    input.addEventListener('input', () => {
        edited = true
        input.classList.remove(SUGGESTED)
        input.removeAttribute('aria-invalid')
    })
    input.addEventListener('change', commit)
    // Inside the portal's form: Enter must not submit it, and a click must not reach the row.
    input.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return
        event.preventDefault()
        commit()
    })
    input.addEventListener('click', (event) => event.stopPropagation())

    return {
        input,
        pending: () => pending,
        read: () => {
            const value = input.value.trim()
            return value ? parseTypedOrderNumber(value) : ''
        },
        showReferences: (references) => {
            pending = false
            const texts = [...new Set(references.values())]
            const numbers = [...new Set(texts.map((text) => orderNumberOf(text)).filter(Boolean))]
            const portal = texts.length > 0 ? `„Ihre Referenz“ im Portal: ${texts.join(' · ')}` : 'In Lieferschein und Rechnung steht keine „Ihre Referenz“.'
            // One order becomes one JTL order: with two numbers in it, only the user can say which one.
            const unique = numbers.length === 1 ? numbers[0] : undefined
            source = unique ? portal : `Referenz nicht erkannt. ${portal}`
            if (unique && !edited) {
                input.value = unique
                input.classList.add(SUGGESTED)
            }
            describe()
        },
        showLoadFailure: () => {
            pending = false
            source = 'Lieferschein oder Rechnung konnten nicht geladen werden. Seite neu laden.'
            describe()
        },
        markInvalid: () => {
            input.setAttribute('aria-invalid', 'true')
            input.focus({ preventScroll: true })
        },
    }
}
