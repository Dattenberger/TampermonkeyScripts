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
        updateURL?: string
        downloadURL?: string
    }
    externalGlobals?: Record<string, string | [string, (version: string) => string]>
    externalResource?: Record<string, string>
}

export const scripts: Record<string, ScriptConfig> = {
    // Register scripts here once they exist under `src/scripts/<name>/`.
    // Example shape (kept as a comment so the empty registry stays valid):
    //
    // 'example-script': {
    //     entry: 'src/scripts/example-script/main.ts',
    //     outputFileName: 'example-script.user.js',
    //     userscript: {
    //         name: 'Example Script',
    //         namespace: 'https://github.com/Dattenberger/TampermonkeyScripts',
    //         version: '1.0.0',
    //         description: 'Short description',
    //         author: 'Lukas Dattenberger',
    //         match: ['https://example.com/*'],
    //         grant: ['GM_addStyle'],
    //         updateURL: 'https://raw.githubusercontent.com/Dattenberger/TampermonkeyScripts/main/dist/example-script.user.js',
    //         downloadURL: 'https://raw.githubusercontent.com/Dattenberger/TampermonkeyScripts/main/dist/example-script.user.js',
    //     },
    // },
}
