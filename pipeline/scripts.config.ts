// Single source of truth for all userscripts in this repo.
//
// Adding a new script:
//   1. Create `src/scripts/<name>/main.ts` (entry).
//   2. Add an entry to `scripts` below.
//   3. Commit. CI builds `dist/<outputFileName>` automatically.
//
// The repository is public: `@author` is the neutral AUTHOR for every script (set here, never per
// script), and local per-user values (e.g. a discount factor) are declared under `settings` by
// name only, never with a value; their grants follow from the declaration (userscriptHeader).

export const AUTHOR = 'Robotico'
const SETTINGS_GRANTS = ['GM_getValue', 'GM_setValue', 'GM_registerMenuCommand']

export interface ScriptConfig {
    entry: string
    outputFileName: string
    /** GM storage keys of local per-user settings (see @lib/settings). */
    settings?: readonly string[]
    userscript: {
        name: string
        namespace: string
        version: string
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

/** The header as built: neutral author, explicit grants plus those the declared settings need. */
export function userscriptHeader(config: ScriptConfig): ScriptConfig['userscript'] & { author: string } {
    const settingsGrants = config.settings?.length ? SETTINGS_GRANTS : []
    const grant = [...new Set([...config.userscript.grant, ...settingsGrants])]
    return { ...config.userscript, author: AUTHOR, grant }
}

export const scripts: Record<string, ScriptConfig> = {
    'greyhound-quote-collapser': {
        entry: 'src/scripts/greyhound-quote-collapser/main.ts',
        outputFileName: 'greyhound-quote-collapser.user.js',
        userscript: {
            name: 'Greyhound Quote Collapser',
            namespace: 'https://robotico.de/',
            version: '2.1.0',
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
}
