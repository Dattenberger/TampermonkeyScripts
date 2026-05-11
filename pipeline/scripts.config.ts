// Single source of truth for all userscripts in this repo.
//
// Adding a new script:
//   1. Create `src/scripts/<name>/main.ts` (entry).
//   2. Add an entry to `scripts` below.
//   3. Commit. CI builds `dist/<outputFileName>` automatically.

export interface ScriptConfig {
    entry: string
    outputFileName: string
    userscript: {
        name: string
        namespace: string
        version: string
        description: string
        author: string
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

export const scripts: Record<string, ScriptConfig> = {
    'greyhound-quote-collapser': {
        entry: 'src/scripts/greyhound-quote-collapser/main.ts',
        outputFileName: 'greyhound-quote-collapser.user.js',
        userscript: {
            name: 'Greyhound Quote Collapser',
            namespace: 'https://robotico.de/',
            version: '2.0.0',
            description:
                'Klappt Signatur+Verlauf in Greyhound-E-Mails ein. Manipuliert das iframe-Document direkt (kein Klon), weil Greyhound die Mail in <iframe srcdoc> rendert und React den iframe-Inhalt nicht reconciliert.',
            author: 'Lukas Dattenberger',
            match: ['https://greyhound.dattenberger.com/web/unity/*'],
            grant: [],
            'run-at': 'document-idle',
            updateURL:
                'https://raw.githubusercontent.com/Dattenberger/TampermonkeyScripts/main/dist/greyhound-quote-collapser.user.js',
            downloadURL:
                'https://raw.githubusercontent.com/Dattenberger/TampermonkeyScripts/main/dist/greyhound-quote-collapser.user.js',
        },
    },
}
