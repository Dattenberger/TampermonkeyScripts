// The script's look on the document history: the card on the right with the discount, and per order
// row one framed export group right of the portal's "Details" link, the field for our order number
// (order-field.ts) beside the CSV button and a short hint below. The groups read as a column of
// their own: the portal's type, date and sum columns give up some width for it, and the table head
// names it, so it is clear the column is ours. Follows the Husqvarna exporter's buttons: dark
// outline, rounded, upper case, a coloured state.

import { discountPercentInput, type FactorSetting } from '@lib/settings'
import { ORDER_FIELD } from './order-field.js'

export const CSV_BUTTON = 'herkules-csv-btn'
export const STATUS = 'herkules-status'
const GROUP = 'herkules-export'
const GROUP_LINE = 'herkules-export-line'
const COLUMN_LABEL = 'herkules-column'
const TAG = 'herkules-tag'
const PERCENT = 'herkules-percent'
const PANEL_ID = 'herkules-export-panel'
/** One name on the row groups and the card, so both read as the same tool. */
const TAG_TEXT = 'Robotico · JTL-Export'
const BUTTON_TITLE = 'CSV dieser Bestellung für den JTL-Import herunterladen'

const INK = '#3d3d3c'
const MUTED = '#6f6f6f'
/** The groups and the column head share one width and one gap to "Details", so the head stands over the groups. */
const COLUMN_WIDTH = '214px'
const COLUMN_GAP = '16px'
const CSS = `
    @media (min-width: 768px) { .archiveTable__typeLine, .archiveTable__dateLine, .archiveTable__totalLine { width: 125px; } }
    form[data-herkules-export] { display: flex; align-items: center; justify-content: flex-end; gap: ${COLUMN_GAP}; }
    .${COLUMN_LABEL} {
        display: inline-block; width: ${COLUMN_WIDTH}; margin-left: ${COLUMN_GAP}; text-align: left; vertical-align: middle;
        color: ${MUTED}; font: 600 11px/14px Arial, sans-serif; letter-spacing: .04em; text-transform: uppercase;
    }
    .${GROUP} {
        flex: 0 0 auto; box-sizing: border-box; width: ${COLUMN_WIDTH}; max-width: 100%; margin: 0; padding: 6px 7px;
        border: 1px solid #dcdcdc; border-left: 3px solid ${INK}; border-radius: 6px; background: #fafafa;
        color: ${INK}; font: 12px/16px Arial, sans-serif; text-align: left;
    }
    .${TAG} { display: block; margin: 0 0 8px; color: ${MUTED}; font: 600 10px/12px Arial, sans-serif; letter-spacing: .04em; text-transform: uppercase; }
    .${GROUP_LINE} { display: flex; gap: 6px; align-items: center; }
    input.${ORDER_FIELD} {
        box-sizing: border-box; flex: 1 1 auto; width: 0; min-width: 0; height: 28px; margin: 0; padding: 3px 7px;
        border: 1px solid #bbb; border-radius: 5px; background: #fff; color: ${INK}; font: 13px/18px Arial, sans-serif;
    }
    input.${ORDER_FIELD}::placeholder { color: #8a8a8a; }
    input.${ORDER_FIELD}.is-suggested { color: #767676; }
    input.${ORDER_FIELD}:focus-visible { outline: 2px solid ${INK}; outline-offset: 1px; }
    input.${ORDER_FIELD}[aria-invalid='true'] { border-color: #dc3545; background: #fff5f5; }
    button.${CSV_BUTTON} {
        flex: 0 0 auto; box-sizing: border-box; min-width: 54px; height: 28px; margin: 0; padding: 0 8px;
        border: 1px solid ${INK}; border-radius: 5px; background: #fff; color: ${INK};
        font: 600 12px/16px Arial, sans-serif; letter-spacing: .03em; text-transform: uppercase; white-space: nowrap;
        cursor: pointer; transition: background-color .15s ease, color .15s ease;
    }
    button.${CSV_BUTTON}:hover { background: ${INK}; color: #fff; }
    button.${CSV_BUTTON}:focus-visible, #${PANEL_ID} input:focus-visible { outline: 2px solid ${INK}; outline-offset: 2px; }
    button.${CSV_BUTTON}.is-loading { background: ${MUTED}; border-color: ${MUTED}; color: #fff; cursor: progress; }
    button.${CSV_BUTTON}.is-success { background: #1e7e34; border-color: #1e7e34; color: #fff; }
    button.${CSV_BUTTON}.is-error { background: #dc3545; border-color: #dc3545; color: #fff; }
    button.${CSV_BUTTON}.is-success:hover { background: #155d27; border-color: #155d27; }
    button.${CSV_BUTTON}.is-error:hover { background: #bd2130; border-color: #bd2130; }
    .${STATUS} { display: block; margin: 5px 0 0; color: #b02a37; font: 11px/14px Arial, sans-serif; }
    .${STATUS}:empty { display: none; }
    .${STATUS}.is-success { color: #1e7e34; }
    #${PANEL_ID} {
        float: right; box-sizing: border-box; width: 210px; margin: 0 0 12px 24px; padding: 10px 12px 12px;
        background: #fafafa; border: 1px solid #dcdcdc; border-left: 3px solid ${INK}; border-radius: 6px;
        color: ${INK}; font: 13px/18px Arial, sans-serif;
    }
    #${PANEL_ID}.is-floating { float: none; position: fixed; right: 16px; bottom: 16px; z-index: 1000; margin: 0; box-shadow: 0 2px 10px rgba(0, 0, 0, .12); }
    #${PANEL_ID} label { display: block; color: ${INK}; font-weight: 600; }
    .${PERCENT} { display: flex; align-items: center; gap: 6px; margin: 4px 0 6px; font-weight: 400; }
    #${PANEL_ID} input {
        box-sizing: border-box; width: 72px; margin: 0; padding: 5px 8px; text-align: right;
        border: 1px solid #bbb; border-radius: 5px; background: #fff; font: 14px/18px Arial, sans-serif;
    }
    #${PANEL_ID} input[aria-invalid='true'] { border-color: #dc3545; background: #fff5f5; }
    #${PANEL_ID} small { display: block; color: ${MUTED}; font-size: 11px; line-height: 14px; }
    @media (max-width: 880px) { #${PANEL_ID}:not(.is-floating) { float: none; width: auto; margin: 0 0 12px; } }
`

export type ButtonState = 'idle' | 'loading' | 'success' | 'error'

const BUTTON_TEXT: Readonly<Record<ButtonState, string>> = {
    idle: 'CSV ↓',
    loading: '…',
    success: '✓ CSV',
    error: '✗ CSV',
}

/** Text, colour and availability of a CSV button; `detail`, an error's reason or a result, shows in `status`. */
export function setButtonState(button: HTMLButtonElement, state: ButtonState, status: HTMLElement, detail?: string): void {
    button.textContent = BUTTON_TEXT[state]
    button.disabled = state === 'loading'
    for (const name of ['is-loading', 'is-success', 'is-error']) button.classList.remove(name)
    if (state !== 'idle') button.classList.add(`is-${state}`)
    button.title = detail ?? BUTTON_TITLE
    status.textContent = detail ?? ''
    status.classList.toggle('is-success', state === 'success')
}

/** The framed group of one order row: field and button in one line, the hint below. */
export function exportGroup(field: HTMLInputElement, button: HTMLButtonElement, status: HTMLElement): HTMLElement {
    const group = document.createElement('div')
    group.className = GROUP
    group.title = TAG_TEXT
    const line = document.createElement('div')
    line.className = GROUP_LINE
    line.append(field, button)
    group.append(line, status)
    return group
}

/** Names the column of the groups in the table head, once. */
export function labelColumn(): void {
    const head = document.querySelector('.archiveTable__header .archiveTable__actionLine')
    if (!head || head.querySelector(`.${COLUMN_LABEL}`)) return
    const label = document.createElement('span')
    label.className = COLUMN_LABEL
    label.textContent = TAG_TEXT
    head.append(label)
}

/** The card with the discount field, on the right, once. */
export function attachPanel(setting: FactorSetting): void {
    if (document.querySelector(`#${PANEL_ID}`)) return
    GM_addStyle(CSS)
    const panel = document.createElement('aside')
    panel.id = PANEL_ID
    const label = document.createElement('label')
    label.textContent = 'Skonto-Wert'
    label.title = setting.label
    const percent = document.createElement('span')
    percent.className = PERCENT
    const input = discountPercentInput(setting)
    input.placeholder = '–'
    percent.append(input, '%')
    label.append(percent)
    const hint = document.createElement('small')
    hint.textContent = 'Wird in der CSV vom Netto-Händlerpreis abgezogen. Nur in diesem Browser gespeichert.'
    const tag = document.createElement('span')
    tag.className = TAG
    tag.textContent = TAG_TEXT
    panel.append(tag, label, hint)
    // Beside the page heading, in the free space above the table; without one, in a corner.
    const heading = document.querySelector('h1')
    if (heading) heading.before(panel)
    else {
        panel.classList.add('is-floating')
        document.body.append(panel)
    }
}

/** Takes the user to the discount field when an export needs a value. */
export function focusDiscount(): void {
    const input = document.querySelector<HTMLInputElement>(`#${PANEL_ID} input`)
    input?.setAttribute('aria-invalid', 'true')
    input?.focus({ preventScroll: true })
}
