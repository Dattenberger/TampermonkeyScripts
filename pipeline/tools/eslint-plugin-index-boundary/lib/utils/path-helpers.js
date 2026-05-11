// Path-helper utilities — boundary-containment checks and glob-pattern
// matching for the `exemptSources` rule option.

import * as path from 'node:path'

/**
 * Returns true when `child` lives strictly under `parent` on the filesystem.
 * Equality (child === parent) returns false — a directory does not contain itself.
 *
 * @param {string} child  - Absolute path that may sit under `parent`.
 * @param {string} parent - Absolute directory.
 * @returns {boolean}
 */
export function isPathUnder(child, parent) {
    const rel = path.relative(parent, child)
    if (rel === '') return false
    if (rel.startsWith('..')) return false
    if (path.isAbsolute(rel)) return false
    return true
}

/**
 * Convert a glob-pattern to a `RegExp`. Supports the subset commonly seen in
 * ESLint config glob fields: `**`, `*`, `?`, character classes via
 * pass-through. Anchored at start and end. The implementation is intentionally
 * small — minimatch would be more correct but would require an extra
 * dependency, which violates the plugin's no-new-deps constraint.
 *
 * Documented limitations:
 * - No brace expansion (`{a,b}`).
 * - No negation (`!pattern`).
 * - Unix-style separators only — patterns that hard-code `\\` will not match
 *   forward-slash paths. Callers should normalise to forward slashes before
 *   calling `globMatches`.
 *
 * @param {string} glob
 * @returns {RegExp}
 */
export function globToRegExp(glob) {
    // First, swap the multi-character globstar tokens for placeholders so they
    // survive the escape pass. The placeholders are word-only sequences that
    // contain no regex meta-characters.
    const PLACE_LEAD = ' GS_LEAD '    // `**/`  — optional path-prefix
    const PLACE_TAIL = ' GS_TAIL '    // `/**`  — optional path-suffix
    const PLACE_BARE = ' GS_BARE '    // `**`   — bare globstar, matches anything

    let result = glob
        .replaceAll('**/', PLACE_LEAD)
        .replaceAll('/**', PLACE_TAIL)
        .replaceAll('**', PLACE_BARE)

    // Escape regex meta-characters in everything that remains literal.
    result = result.replaceAll(/([.+^$(){}|\\/])/g, '\\$1')

    // Single-segment wildcards.
    result = result.replaceAll('*', '[^/]*').replaceAll('?', '[^/]')

    // Re-substitute the globstar placeholders with their regex equivalents.
    result = result
        .replaceAll(PLACE_LEAD, '(?:.*/)?')
        .replaceAll(PLACE_TAIL, '(?:/.*)?')
        .replaceAll(PLACE_BARE, '.*')

    return new RegExp(`^${result}$`)
}

/**
 * Test whether a file path matches any of the given glob patterns.
 * Both the path and patterns are normalised to forward slashes before
 * matching, so callers do not need to think about Windows separators.
 *
 * @param {string}   filePath - Absolute or relative path to test.
 * @param {string[]} patterns - List of glob patterns (may be empty).
 * @returns {boolean}
 */
export function globMatches(filePath, patterns) {
    if (patterns.length === 0) return false
    const normalised = filePath.replaceAll('\\', '/')
    for (const pattern of patterns) {
        const re = globToRegExp(pattern.replaceAll('\\', '/'))
        if (re.test(normalised)) return true
    }
    return false
}
