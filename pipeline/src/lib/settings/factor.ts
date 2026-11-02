// Local per-user factor settings (e.g. a discount factor). This repository is public, so such
// values never go into code: the user types them into the field the script shows where the user
// works, Tampermonkey's storage keeps them, and there is no default anywhere. The script declares
// the setting's key in scripts.config.ts.
//
// A discount is typed and shown as a percentage, the way supplier terms state it, but stored as the
// factor on the price (factor = 1 − percent / 100): the stored values of earlier versions stay valid.

export interface FactorSetting {
    /** GM storage key, as declared under `settings` in the registry. */
    key: string
    /** Text naming what the factor is for. */
    label: string
}

const PLAIN_DECIMAL = /^\d*[.,]?\d+$/
/** Digits kept when converting between factor and percent, so 1 − 0.03 shows as 3, not 2.9999…. */
const PRECISION = 1e10

/** A number as the user types it: comma, no grouping, no exponent (String(1e-7) is '1e-7'). */
function formatDecimal(value: number): string {
    return value.toLocaleString('de-DE', { useGrouping: false, maximumFractionDigits: 20 })
}

/** A plain decimal with comma or dot in (0, 1]; anything else is null. The field shows a factor
 *  with at most 20 fractional digits, so one that would read as 0 there (1e-21) is not a factor. */
export function parseFactor(input: unknown): number | null {
    let value = Number.NaN
    if (typeof input === 'number') value = input
    if (typeof input === 'string' && PLAIN_DECIMAL.test(input.trim())) value = Number(input.trim().replace(',', '.'))
    const shown = Number.isFinite(value) ? Number(formatDecimal(value).replace(',', '.')) : Number.NaN
    return value > 0 && value <= 1 && shown > 0 ? value : null
}

/** A typed discount in percent ('3', '2,5', '3 %') as the stored factor; null outside [0, 100). */
export function parseDiscountPercent(input: string): number | null {
    const text = input.trim().replace(/\s*%$/, '')
    if (!PLAIN_DECIMAL.test(text)) return null
    const percent = Number(text.replace(',', '.'))
    if (percent >= 100) return null
    return parseFactor(Math.round((1 - percent / 100) * PRECISION) / PRECISION)
}

/** The stored factor as the percentage the user typed, without a % sign. */
export function formatDiscountPercent(factor: number): string {
    return formatDecimal(Math.round((1 - factor) * 100 * PRECISION) / PRECISION)
}

/** The stored factor, null when none is stored. */
export function readFactor(setting: FactorSetting): number | null {
    return parseFactor(GM_getValue<unknown>(setting.key))
}

/**
 * A text field for a discount in percent over a stored factor. What it shows is what applies: a
 * valid input is stored at once, and an empty or invalid one removes the stored value and sets
 * `aria-invalid`, so nothing keeps using an old value the user has cleared. An untouched empty field
 * is not marked yet. The field follows changes from another tab, also while focused, since an export
 * reads the stored value. The caller labels, places and styles it.
 */
export function discountPercentInput(setting: FactorSetting): HTMLInputElement {
    const input = document.createElement('input')
    input.type = 'text'
    input.inputMode = 'decimal'
    input.autocomplete = 'off'
    const show = () => {
        const value = readFactor(setting)
        input.value = value === null ? '' : formatDiscountPercent(value)
    }
    show()
    input.addEventListener('input', () => {
        const value = parseDiscountPercent(input.value)
        GM_setValue(setting.key, value)
        input.setAttribute('aria-invalid', String(value === null))
    })
    GM_addValueChangeListener(setting.key, (_key, _old, _new, remote) => {
        if (remote) show()
    })
    return input
}
