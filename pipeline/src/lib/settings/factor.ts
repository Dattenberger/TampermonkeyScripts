// Local per-user factor settings (e.g. a discount factor). This repository is public, so such
// values never go into code: the user enters them once, Tampermonkey's storage keeps them, and
// there is no default anywhere. The script declares the setting's key in scripts.config.ts and
// shows the stored value where the user works (factorBadge), changeable there with one click; the
// Tampermonkey menu entry stays as the fallback.

export interface FactorSetting {
    /** GM storage key, as declared under `settings` in the registry. */
    key: string
    /** Prompt text naming what the factor is for. */
    label: string
}

const PLAIN_DECIMAL = /^\d*[.,]?\d+$/
const BADGE_ATTRIBUTE = 'data-factor-setting'

/** A factor as the user types it: comma, no grouping, no exponent (String(1e-7) is '1e-7'). */
function formatFactor(value: number): string {
    return value.toLocaleString('de-DE', { useGrouping: false, maximumFractionDigits: 20 })
}

/** A plain decimal with comma or dot in (0, 1]; anything else is null. The prompt shows a factor
 *  with at most 20 fractional digits, so one that would read as 0 there (1e-21) is not a factor. */
export function parseFactor(input: unknown): number | null {
    let value = Number.NaN
    if (typeof input === 'number') value = input
    if (typeof input === 'string' && PLAIN_DECIMAL.test(input.trim())) value = Number(input.trim().replace(',', '.'))
    const shown = Number.isFinite(value) ? Number(formatFactor(value).replace(',', '.')) : Number.NaN
    return value > 0 && value <= 1 && shown > 0 ? value : null
}

/** Asks until the input is valid, then stores it; null (and nothing stored) when cancelled. */
export function askFactor(setting: FactorSetting): number | null {
    const current = parseFactor(GM_getValue<unknown>(setting.key))
    for (;;) {
        const input = globalThis.prompt(
            `${setting.label}\nWird nur lokal in Tampermonkey gespeichert.`,
            current === null ? '' : formatFactor(current),
        )
        if (input === null) return null
        const value = parseFactor(input)
        if (value !== null) {
            GM_setValue(setting.key, value)
            refreshBadges(setting)
            return value
        }
        globalThis.alert('Bitte eine Zahl größer 0 und höchstens 1 eingeben.')
    }
}

/** The stored factor; asks on first use. Null when the user cancels. */
export function getFactor(setting: FactorSetting): number | null {
    return parseFactor(GM_getValue<unknown>(setting.key)) ?? askFactor(setting)
}

/** Menu entry in the Tampermonkey menu to change the stored factor. */
export function registerFactorMenu(setting: FactorSetting, caption: string): void {
    GM_registerMenuCommand(caption, () => {
        askFactor(setting)
    })
}

function badgeText(setting: FactorSetting): string {
    const value = parseFactor(GM_getValue<unknown>(setting.key))
    return value === null ? 'Faktor fehlt · eingeben' : `Faktor ${formatFactor(value)} · ändern`
}

/** Shows the stored value on every badge of the setting, after a change from any place. */
function refreshBadges(setting: FactorSetting): void {
    for (const badge of document.querySelectorAll(`[${BADGE_ATTRIBUTE}="${setting.key}"]`)) {
        badge.textContent = badgeText(setting)
    }
}

/** A button showing the stored factor ("Faktor 0,… · ändern", without one "Faktor fehlt") that
 *  asks for a new value on click. The caller places and styles it. */
export function factorBadge(setting: FactorSetting): HTMLButtonElement {
    const badge = document.createElement('button')
    badge.type = 'button'
    badge.setAttribute(BADGE_ATTRIBUTE, setting.key)
    badge.title = `${setting.label}\nWird nur lokal in Tampermonkey gespeichert.`
    badge.textContent = badgeText(setting)
    badge.addEventListener('click', (event) => {
        event.preventDefault()
        event.stopPropagation()
        askFactor(setting)
    })
    return badge
}
