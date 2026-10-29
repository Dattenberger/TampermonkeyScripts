// Local per-user factor settings (e.g. a discount factor). This repository is public, so such
// values never go into code: the user enters them once, Tampermonkey's storage keeps them, and
// there is no default anywhere. The script declares the setting's key in scripts.config.ts.

export interface FactorSetting {
    /** GM storage key, as declared under `settings` in the registry. */
    key: string
    /** Prompt text naming what the factor is for. */
    label: string
}

const PLAIN_DECIMAL = /^\d*[.,]?\d+$/

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
