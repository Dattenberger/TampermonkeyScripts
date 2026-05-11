import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import monkey from 'vite-plugin-monkey'
import { scripts } from './scripts.config.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const scriptName = process.env.SCRIPT

if (!scriptName) {
    throw new Error(
        'vite.config.ts: SCRIPT env-var is required. Use `npm run build` (iterates over scripts.config.ts) '
            + 'or `cross-env SCRIPT=<name> vite build` for a single script.',
    )
}

const scriptConfig = scripts[scriptName]
if (!scriptConfig) {
    const known = Object.keys(scripts).join(', ') || '(none registered yet)'
    throw new Error(`vite.config.ts: unknown script "${scriptName}". Registered: ${known}`)
}

export default defineConfig({
    resolve: {
        alias: {
            '@lib': path.resolve(__dirname, 'src/lib'),
            '@scripts': path.resolve(__dirname, 'src/scripts'),
        },
    },
    build: {
        outDir: 'dist',
        emptyOutDir: false,
        target: 'es2022',
    },
    plugins: [
        monkey({
            entry: scriptConfig.entry,
            // The `grant` type in vite-plugin-monkey is a string-literal union
            // of every known GM_* grant — keeping `scripts.config.ts` plugin-
            // agnostic via `string[]` and casting here is the simpler trade.
            userscript: scriptConfig.userscript as Parameters<typeof monkey>[0]['userscript'],
            build: {
                externalGlobals: scriptConfig.externalGlobals ?? {},
                externalResource: scriptConfig.externalResource ?? {},
                fileName: scriptConfig.outputFileName,
            },
        }),
    ],
})
