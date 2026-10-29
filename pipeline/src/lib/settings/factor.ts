// Local per-user factor settings (e.g. a discount factor). This repository is public, so such
// values never go into code: the user enters them once, Tampermonkey's storage keeps them, and
// there is no default anywhere. The script declares the setting's key in scripts.config.ts.

export interface FactorSetting {
    /** GM storage key, as declared under `settings` in the registry. */
    key: string
    /** Prompt text naming what the factor is for. */
    label: string
}

/** A plain decimal with comma or dot; only factors in (0, 1] are valid, anything else is null. */
export function parseFactor(input: unknown): number | null {
    let value = Number.NaN
    if (typeof input === 'number') value = input
    // The whole string must be the number: parseFloat alone would take '0,123abc' as 0.123.
    if (typeof input === 'string' && /^\d*[.,]?\d+$/.test(input.trim())) value = Number(input.trim().replace(',', '.'))
    return Number.isFinite(value) && value > 0 && value <= 1 ? value : null
}

/** Asks until the input is valid, then stores it; null (and nothing stored) when cancelled. */
export function askFactor(setting: FactorSetting): number | null {
    const current = parseFactor(GM_getValue<unknown>(setting.key))
    for (;;) {
        const input = globalThis.prompt(
            `${setting.label}\nWird nur lokal in Tampermonkey gespeichert.`,
            // toLocaleString, not String(): String(1e-7) is '1e-7', which parseFactor refuses.
            current === null ? '' : current.toLocaleString('de-DE', { useGrouping: false, maximumFractionDigits: 20 }),
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
