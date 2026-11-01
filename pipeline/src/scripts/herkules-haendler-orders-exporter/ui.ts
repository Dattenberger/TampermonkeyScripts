// The script's look on the document history: the panel on the right with the discount factor, the
// states of a CSV button, the reference label. Follows the Husqvarna exporter's buttons: dark
// outline, rounded, upper case, a coloured state; the factor field is the only thing to change.

import { factorInput, type FactorSetting } from '@lib/settings'

export const CSV_BUTTON = 'herkules-csv-btn'
export const REFERENCE = 'herkules-reference'
const PANEL_ID = 'herkules-export-panel'

const CSS = `
    .${CSV_BUTTON} {
        display: inline-flex; align-items: center; gap: .4rem;
        margin-left: 12px; padding: 6px 14px;
        border: 1px solid #3d3d3c; border-radius: 8px;
        background: #fff; color: #3d3d3c;
        font: 600 12px/16px Arial, sans-serif; letter-spacing: .03em; text-transform: uppercase;
        cursor: pointer; transition: background-color .15s ease, color .15s ease;
    }
    .${CSV_BUTTON}:hover { background: #3d3d3c; color: #fff; }
    .${CSV_BUTTON}:focus-visible, #${PANEL_ID} input:focus-visible { outline: 2px solid #3d3d3c; outline-offset: 2px; }
    .${CSV_BUTTON}.is-loading { background: #6f6f6f; border-color: #6f6f6f; color: #fff; cursor: progress; }
    .${CSV_BUTTON}.is-success { background: #28a745; border-color: #28a745; color: #fff; }
    .${CSV_BUTTON}.is-warning { background: #ffc107; border-color: #ffc107; color: #212529; }
    .${CSV_BUTTON}.is-error { background: #dc3545; border-color: #dc3545; color: #fff; }
    .${REFERENCE} { margin-left: 10px; color: #3d3d3c; font: 12px/16px Arial, sans-serif; white-space: nowrap; }
    .${REFERENCE}.is-missing { color: #b02a37; }
    #${PANEL_ID} {
        position: fixed; top: 140px; right: 16px; z-index: 1000; width: 190px; padding: 14px 16px;
        background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; box-shadow: 0 2px 10px rgba(0, 0, 0, .12);
        color: #3d3d3c; font: 13px/18px Arial, sans-serif;
    }
    #${PANEL_ID} .herkules-panel-title { margin: 0 0 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .03em; font-size: 12px; }
    #${PANEL_ID} label { display: block; font-weight: 600; }
    #${PANEL_ID} input {
        box-sizing: border-box; width: 100%; margin: 4px 0 6px; padding: 6px 8px;
        border: 1px solid #3d3d3c; border-radius: 6px; font: 14px/18px Arial, sans-serif;
    }
    #${PANEL_ID} input[aria-invalid='true'] { border-color: #dc3545; background: #fff5f5; }
    #${PANEL_ID} small { display: block; color: #6f6f6f; font-size: 11px; line-height: 14px; }
`

export type ButtonState = 'idle' | 'loading' | 'success' | 'warning' | 'error'

const BUTTON_TEXT: Readonly<Record<ButtonState, string>> = {
    idle: 'CSV',
    loading: 'Lädt …',
    success: '✓ CSV',
    warning: '⚠ CSV',
    error: '✗ CSV',
}

/** Text, colour and availability of a CSV button; `detail` is the tooltip of a warning or an error. */
export function setButtonState(button: HTMLButtonElement, state: ButtonState, detail?: string): void {
    button.textContent = BUTTON_TEXT[state]
    button.disabled = state === 'loading'
    for (const name of ['is-loading', 'is-success', 'is-warning', 'is-error']) button.classList.remove(name)
    if (state !== 'idle') button.classList.add(`is-${state}`)
    if (detail) button.title = detail
}

/** The panel with the factor field, on the right of the page, once. */
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
    label.append(factorInput(setting))
    const hint = document.createElement('small')
    hint.textContent = 'Nur lokal in diesem Browser gespeichert.'
    panel.append(title, label, hint)
    document.body.append(panel)
}

/** Takes the user to the factor field when an export needs a value. */
export function focusFactor(): void {
    document.querySelector<HTMLInputElement>(`#${PANEL_ID} input`)?.focus()
}
