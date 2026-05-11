// Resize the iframe to the max of its document/body scrollHeight.
// Greyhound's iframe is non-scrollable by design; without resizing, our
// collapsed/expanded toggles would either clip or leave whitespace.
export function updateIframeHeight(iframe: HTMLIFrameElement): void {
    const doc = iframe.contentDocument
    if (doc === null) return
    const root = doc.documentElement
    const body = doc.body
    const newHeight = Math.max(root.scrollHeight, body.scrollHeight)
    if (newHeight > 0) {
        iframe.style.height = `${newHeight}px`
    }
}
