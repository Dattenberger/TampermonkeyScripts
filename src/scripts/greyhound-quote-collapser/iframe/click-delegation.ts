import { CFG } from '../config.js'
import { updateIframeHeight } from './height.js'

const delegatedDocs = new WeakSet<Document>()

// Delegated click handler on the iframe's document — toggles the wrapper
// next to a clicked button and updates the button label. Runs in the
// parent-window JS context, so we don't need `allow-scripts` on the
// iframe sandbox.
//
// Cross-realm caveat: the iframe's contentDocument is a separate JS realm,
// so its elements are NOT `instanceof Element` of the parent window. We
// duck-type via `closest`/`classList`/`dataset` access instead of
// `instanceof` guards.
export function setupClickDelegation(iframe: HTMLIFrameElement, doc: Document): void {
    if (delegatedDocs.has(doc)) return
    delegatedDocs.add(doc)

    doc.addEventListener('click', (event: Event) => {
        const target = event.target as Element | null
        if (target === null) return
        const closest = target.closest(`.${CFG.btnClass}`)
        if (closest === null) return
        // Narrow Element to HTMLButtonElement so `dataset` is accessible.
        // We trust the selector — only our toggle buttons carry btnClass.
        const btn = closest as HTMLButtonElement

        event.preventDefault()
        event.stopPropagation()

        const wrapper = btn.nextElementSibling
        if (wrapper === null || !wrapper.classList.contains(CFG.wrapperClass)) return

        const nowVisible = wrapper.classList.toggle(CFG.visibleClass)
        const label = btn.dataset.label ?? ''
        btn.textContent = `${nowVisible ? '↑ ' : '↓ '}${label}${nowVisible ? ' ausblenden' : ' anzeigen'}`

        const view = doc.defaultView
        const raf = view?.requestAnimationFrame ?? globalThis.requestAnimationFrame
        raf(() => {
            updateIframeHeight(iframe)
        })
    })
}
