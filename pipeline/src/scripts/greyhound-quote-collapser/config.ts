// Greyhound Quote Collapser — runtime configuration.
//
// Selectors target Greyhound's class-with-hash naming (CSS modules) via
// substring matchers. The hashes change between Greyhound deployments;
// `[class*="chatView__itemContent___"]` survives those renames.

export interface CollapserConfig {
    readonly itemSelector: string
    readonly outgoingSelector: string
    readonly iframeSelector: string
    readonly wrapperClass: string
    readonly visibleClass: string
    readonly btnClass: string
    readonly btnQuoteClass: string
    readonly btnDetectedSigClass: string
    readonly quotePatterns: readonly RegExp[]
    readonly footerPatterns: readonly RegExp[]
    readonly debounceMs: number
    readonly threadSigMaxIterations: number
}

export const CFG: CollapserConfig = {
    itemSelector: '[class*="chatView__itemContent___"]',
    outgoingSelector: '[class*="chatView__itemOutgoing"]',
    iframeSelector: 'iframe[srcdoc]',

    wrapperClass: 'gh-qc-collapsed',
    visibleClass: 'gh-qc-visible',
    btnClass: 'gh-qc-toggle',
    btnQuoteClass: 'gh-qc-toggle-quote',
    btnDetectedSigClass: 'gh-qc-toggle-detected-sig',

    quotePatterns: [
        /-{3,}\s*Urspr(ü|ue)ngliche Daten\s*-{3,}/i,
        /-{3,}\s*Original Message\s*-{3,}/i,
        /-{3,}\s*Forwarded message\s*-{3,}/i,
        /^Am .{1,120} schrieb .+:?$/m,
    ],
    footerPatterns: [
        /^[-_]{2,}\s*$/m,
        /^Robotico\.de\s*$/im,
        /^Datenschutz\s*:/im,
        /^Mährobotertechnik\b/im,
    ],

    debounceMs: 80,
    threadSigMaxIterations: 10,
}

export const STYLE_MARKER_ATTR = 'data-gh-qc'

export const IFRAME_CSS = `
    .${CFG.wrapperClass} { display: none; }
    .${CFG.wrapperClass}.${CFG.visibleClass} { display: block; }
    .${CFG.btnClass} {
        display: inline-block;
        margin: 6px 6px 6px 0;
        padding: 3px 10px;
        font-size: 11px;
        background: #f0f0f0;
        border: 1px solid #ccc;
        border-radius: 3px;
        cursor: pointer;
        color: #555;
        font-family: inherit;
        user-select: none;
    }
    .${CFG.btnClass}:hover { background: #e5e5e5; }
    .${CFG.btnDetectedSigClass} {
        background: #e8f4fd;
        border-color: #a8d4f4;
        color: #2c5d8a;
    }
    .${CFG.btnDetectedSigClass}:hover { background: #d4ecfc; }
`
