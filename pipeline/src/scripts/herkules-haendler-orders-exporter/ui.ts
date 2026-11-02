// The script's look on the document history: the panel on the right with the discount factor, the
// states of a CSV button, the field for our order number (order-field.ts). Follows the Husqvarna exporter's buttons: dark
// outline, rounded, upper case, a coloured state; the factor field is the only thing to change.

import { factorInput, type FactorSetting } from '@lib/settings'
import { ORDER_FIELD } from './order-field.js'

export const CSV_BUTTON = 'herkules-csv-btn'
export const STATUS = 'herkules-status'
const PANEL_ID = 'herkules-export-panel'
const BUTTON_TITLE = 'CSV dieser Bestellung für den JTL-Import herunterladen'

const CSS = `
    button.${CSV_BUTTON} {
        display: inline-flex; align-items: center; justify-content: center; gap: .4rem;
        min-width: 78px; min-height: 26px; margin-left: 12px; padding: 4px 12px;
        border: 1px solid #3d3d3c; border-radius: 6px;
        background: #fff; color: #3d3d3c;
        font: 600 12px/16px Arial, sans-serif; letter-spacing: .03em; text-transform: uppercase;
        cursor: pointer; transition: background-color .15s ease, color .15s ease;
    }
    button.${CSV_BUTTON}:hover { background: #3d3d3c; color: #fff; }
    button.${CSV_BUTTON}:focus-visible, #${PANEL_ID} input:focus-visible { outline: 2px solid #3d3d3c; outline-offset: 2px; }
    button.${CSV_BUTTON}.is-loading { background: #6f6f6f; border-color: #6f6f6f; color: #fff; cursor: progress; }
    button.${CSV_BUTTON}.is-success { background: #1e7e34; border-color: #1e7e34; color: #fff; }
    button.${CSV_BUTTON}.is-error { background: #dc3545; border-color: #dc3545; color: #fff; }
    button.${CSV_BUTTON}.is-success:hover { background: #155d27; border-color: #155d27; }
    button.${CSV_BUTTON}.is-error:hover { background: #bd2130; border-color: #bd2130; }
    .${STATUS} { display: block; width: 300px; max-width: 100%; margin: 4px 0 0 auto; color: #b02a37; font: 12px/16px Arial, sans-serif; text-align: right; }
    .${STATUS}:empty { display: none; }
    .${STATUS}.is-info { color: #6f6f6f; }
    input.${ORDER_FIELD} {
        box-sizing: border-box; width: 150px; min-height: 26px; margin-left: 12px; padding: 3px 7px; vertical-align: middle;
        border: 1px solid #bbb; border-radius: 6px; background: #fff; color: #3d3d3c; font: 13px/18px Arial, sans-serif;
    }
    input.${ORDER_FIELD}::placeholder { color: #8a8a8a; font-style: italic; }
    input.${ORDER_FIELD}.is-suggested { color: #767676; }
    input.${ORDER_FIELD}:focus-visible { outline: 2px solid #3d3d3c; outline-offset: 1px; }
    input.${ORDER_FIELD}[aria-invalid='true'] { border-color: #dc3545; background: #fff5f5; }
    #${PANEL_ID} {
        float: right; box-sizing: border-box; width: 190px; margin: 0 0 12px 24px; padding: 12px 14px;
        background: #fff; border: 1px solid #e0e0e0; border-radius: 8px;
        color: #3d3d3c; font: 13px/18px Arial, sans-serif;
    }
    #${PANEL_ID}.is-floating { float: none; position: fixed; right: 16px; bottom: 16px; z-index: 1000; margin: 0; box-shadow: 0 2px 10px rgba(0, 0, 0, .12); }
    #${PANEL_ID} .herkules-panel-title { margin: 0 0 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .03em; font-size: 12px; }
    #${PANEL_ID} label { display: block; font-weight: 600; }
    #${PANEL_ID} input {
        box-sizing: border-box; width: 100%; margin: 4px 0 6px; padding: 6px 8px;
        border: 1px solid #bbb; border-radius: 6px; font: 14px/18px Arial, sans-serif;
    }
    #${PANEL_ID} input[aria-invalid='true'] { border-color: #dc3545; background: #fff5f5; }
    #${PANEL_ID} small { display: block; color: #6f6f6f; font-size: 11px; line-height: 14px; }
    @media (max-width: 880px) { #${PANEL_ID}:not(.is-floating) { float: none; width: auto; margin: 0 0 12px; } }
`

export type ButtonState = 'idle' | 'loading' | 'success' | 'error'

const BUTTON_TEXT: Readonly<Record<ButtonState, string>> = {
    idle: 'CSV',
    loading: 'Lädt …',
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
    status.classList.toggle('is-info', state === 'success')
}

/** The panel with the factor field, on the right, once. */
export function attachPanel(setting: FactorSetting): void {
    if (document.querySelector(`#${PANEL_ID}`)) return
    GM_addStyle(CSS)
    const panel = document.createElement('aside')
    panel.id = PANEL_ID
    const title = document.createElement('p')
    title.className = 'herkules-panel-title'
    title.textContent = 'CSV-Export'
    const label = document.createElement('label')
    label.textContent = 'Skonto-Faktor'
    label.title = setting.label
    const input = factorInput(setting)
    input.placeholder = 'Faktor eintragen'
    label.append(input)
    const hint = document.createElement('small')
    hint.textContent = 'Faktor auf den Netto-Händlerpreis. Nur lokal in diesem Browser gespeichert.'
    panel.append(title, label, hint)
    // Beside the page heading, in the free space above the table; without one, in a corner.
    const heading = document.querySelector('h1')
    if (heading) heading.before(panel)
    else {
        panel.classList.add('is-floating')
        document.body.append(panel)
    }
}

/** Takes the user to the factor field when an export needs a value. */
export function focusFactor(): void {
    const input = document.querySelector<HTMLInputElement>(`#${PANEL_ID} input`)
    input?.setAttribute('aria-invalid', 'true')
    input?.focus({ preventScroll: true })
}
