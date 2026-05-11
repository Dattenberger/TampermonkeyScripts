import { CFG } from '../config.js'

export function makeToggleBtn(doc: Document, label: string, typeClass: string): HTMLButtonElement {
    const btn = doc.createElement('button')
    btn.type = 'button'
    btn.className = `${CFG.btnClass} ${typeClass}`
    btn.dataset.label = label
    btn.textContent = `↓ ${label} anzeigen`
    return btn
}
