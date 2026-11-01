// Local per-user factor settings (e.g. a discount factor). This repository is public, so such
// values never go into code: the user types them into the field the script shows where the user
// works, Tampermonkey's storage keeps them, and there is no default anywhere. The script declares
// the setting's key in scripts.config.ts.

export interface FactorSetting {
    /** GM storage key, as declared under `settings` in the registry. */
    key: string
    /** Text naming what the factor is for. */
    label: string
}

const PLAIN_DECIMAL = /^\d*[.,]?\d+$/

/** A factor as the user types it: comma, no grouping, no exponent (String(1e-7) is '1e-7'). */
function formatFactor(value: number): string {
    return value.toLocaleString('de-DE', { useGrouping: false, maximumFractionDigits: 20 })
}

/** A plain decimal with comma or dot in (0, 1]; anything else is null. The field shows a factor
 *  with at most 20 fractional digits, so one that would read as 0 there (1e-21) is not a factor. */
export function parseFactor(input: unknown): number | null {
    let value = Number.NaN
    if (typeof input === 'number') value = input
    if (typeof input === 'string' && PLAIN_DECIMAL.test(input.trim())) value = Number(input.trim().replace(',', '.'))
    const shown = Number.isFinite(value) ? Number(formatFactor(value).replace(',', '.')) : Number.NaN
    return value > 0 && value <= 1 && shown > 0 ? value : null
}

/** The stored factor, null when none is stored. */
export function readFactor(setting: FactorSetting): number | null {
    return parseFactor(GM_getValue<unknown>(setting.key))
}

/**
 * A text field showing the stored factor. Every valid input is stored at once; an invalid one stays
 * unsaved and sets `aria-invalid`, which also marks a field without a stored value. The field follows
 * changes from another tab, unless it holds the focus. The caller labels, places and styles it.
 */
export function factorInput(setting: FactorSetting): HTMLInputElement {
    const input = document.createElement('input')
    input.type = 'text'
    input.inputMode = 'decimal'
    input.autocomplete = 'off'
    const show = () => {
        const value = readFactor(setting)
        input.value = value === null ? '' : formatFactor(value)
        input.setAttribute('aria-invalid', String(value === null))
    }
    show()
    input.addEventListener('input', () => {
        const value = parseFactor(input.value)
        if (value !== null) GM_setValue(setting.key, value)
        input.setAttribute('aria-invalid', String(value === null))
    })
    input.addEventListener('blur', show)
    GM_addValueChangeListener(setting.key, () => {
        if (document.activeElement !== input) show()
    })
    return input
}
