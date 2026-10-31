// Single source of truth for all userscripts in this repo.
//
// Adding a new script:
//   1. Create `src/scripts/<name>/main.ts` (entry).
//   2. Add an entry to `scripts` below.
//   3. Commit. The pre-commit hook builds `dist/<outputFileName>` and records the version in
//      `versions.json` (`npm run version:update`); CI checks both. Versions are never set by hand.
//
// The repository is public: `@author` is the neutral AUTHOR for every script (set here, never per
// script), and local per-user values (e.g. a discount factor) are declared under `settings` by
// name only, never with a value; their grants follow from the declaration (userscriptHeader).

import versions from './versions.json' with { type: 'json' }

export const AUTHOR = 'Robotico'
const SETTINGS_GRANTS = ['GM_getValue', 'GM_setValue', 'GM_addValueChangeListener', 'GM_registerMenuCommand']

export interface ScriptConfig {
    entry: string
    outputFileName: string
    /** GM storage keys of local per-user settings (see @lib/settings). */
    settings?: readonly string[]
    userscript: {
        name: string
        namespace: string
        description: string
        match: string[]
        grant: string[]
        connect?: string[]
        icon?: string
        'run-at'?: 'document-start' | 'document-body' | 'document-end' | 'document-idle' | 'context-menu'
        updateURL?: string
        downloadURL?: string
    }
    externalGlobals?: Record<string, string | [string, (version: string) => string]>
    externalResource?: Record<string, string>
}

/** The recorded version (versions.json); a script new on this branch builds as 0.0.0 until
 *  `npm run version:update` records it. */
export function scriptVersion(name: string): string {
    return (versions as Record<string, { version: string } | undefined>)[name]?.version ?? '0.0.0'
}

/** The header as built: neutral author, the recorded version, explicit grants plus those the
 *  declared settings need. */
export function userscriptHeader(
    config: ScriptConfig,
    version: string,
): ScriptConfig['userscript'] & { author: string; version: string } {
    const settingsGrants = config.settings?.length ? SETTINGS_GRANTS : []
    // vite-plugin-monkey emits only `@grant none` once that sentinel is present, dropping the rest.
    if (settingsGrants.length > 0 && config.userscript.grant.includes('none')) {
        throw new Error(`${config.outputFileName}: declared settings need GM grants, not 'none'`)
    }
    const grant = [...new Set([...config.userscript.grant, ...settingsGrants])]
    return { ...config.userscript, author: AUTHOR, version, grant }
}

export const scripts: Record<string, ScriptConfig> = {
    'greyhound-quote-collapser': {
        entry: 'src/scripts/greyhound-quote-collapser/main.ts',
        outputFileName: 'greyhound-quote-collapser.user.js',
        userscript: {
            name: 'Greyhound Quote Collapser',
            namespace: 'https://robotico.de/',
            description:
                'Klappt Signatur+Verlauf in Greyhound-E-Mails ein. Unterstützt iframe-srcdoc (Detail-Vollansicht) und inline (ChatView) gleichermaßen. Inline-Pfad mit Self-Healing-MutationObserver gegen React-Re-Renders.',
            match: ['https://greyhound.dattenberger.com/web/unity/*'],
            grant: [],
            'run-at': 'document-idle',
            updateURL:
                'https://raw.githubusercontent.com/Dattenberger/TampermonkeyScripts/main/pipeline/dist/greyhound-quote-collapser.user.js',
            downloadURL:
                'https://raw.githubusercontent.com/Dattenberger/TampermonkeyScripts/main/pipeline/dist/greyhound-quote-collapser.user.js',
        },
    },
    'herkules-haendler-orders-exporter': {
        entry: 'src/scripts/herkules-haendler-orders-exporter/main.ts',
        outputFileName: 'herkules-haendler-orders-exporter.user.js',
        settings: ['herkulesDiscountFactor'],
        userscript: {
            name: 'HerkulesHaendlerOrdersExporter v1',
            namespace: 'https://github.com/Dattenberger/TampermonkeyScripts',
            description:
                'Exportiert Bestellungen aus der Herkules-Händler-Dokumenthistorie als CSV im JTL-Format der Husqvarna-Exporter (und optional Artikel;Menge).',
            match: ['https://www.herkules-haendler.de/garten/de/account/*'],
            grant: [],
            updateURL:
                'https://raw.githubusercontent.com/Dattenberger/TampermonkeyScripts/main/pipeline/dist/herkules-haendler-orders-exporter.user.js',
            downloadURL:
                'https://raw.githubusercontent.com/Dattenberger/TampermonkeyScripts/main/pipeline/dist/herkules-haendler-orders-exporter.user.js',
        },
    },
}
