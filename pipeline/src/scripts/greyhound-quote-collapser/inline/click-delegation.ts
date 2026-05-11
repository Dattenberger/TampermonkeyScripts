import { CFG } from '../config.js'

// Click-delegation for the inline (non-iframe) layout. Identical toggle
// semantics to the iframe version (see ../iframe/click-delegation.ts) but
// runs on the page document — no iframe-height side effect needed because
// the inline body owns its own layout.
//
// Idempotent per document: registering twice is a no-op.

const delegatedDocs = new WeakSet<Document>()

export function setupInlineClickDelegation(doc: Document): void {
    if (delegatedDocs.has(doc)) return
    delegatedDocs.add(doc)

    doc.addEventListener('click', (event: Event) => {
        const target = event.target as Element | null
        if (target === null) return
        const closest = target.closest(`.${CFG.btnClass}`)
        if (closest === null) return
        const btn = closest as HTMLButtonElement

        event.preventDefault()
        event.stopPropagation()

        const wrapper = btn.nextElementSibling
        if (wrapper === null || !wrapper.classList.contains(CFG.wrapperClass)) return

        const nowVisible = wrapper.classList.toggle(CFG.visibleClass)
        const label = btn.dataset.label ?? ''
        btn.textContent = `${nowVisible ? '↑ ' : '↓ '}${label}${nowVisible ? ' ausblenden' : ' anzeigen'}`
    })
}
