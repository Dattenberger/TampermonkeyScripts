import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type ServerOptions } from 'vite'
import monkey from 'vite-plugin-monkey'
import { scriptVersion, scripts, userscriptHeader } from './scripts.config.js'

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

// Dev server for trying a branch in Tampermonkey (README "Testing a feature branch"): bound to
// 127.0.0.1 only and never moved to another port. With DEV_PORT set it sits behind an HTTPS proxy
// on that same port, so the page is https and HMR must use wss on the public port.
const devPort = process.env.DEV_PORT ? Number(process.env.DEV_PORT) : undefined
const proxied: ServerOptions =
    devPort === undefined ? {} : { port: devPort, allowedHosts: true, hmr: { protocol: 'wss', clientPort: devPort } }

export default defineConfig({
    server: { host: '127.0.0.1', strictPort: true, ...proxied },
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
            userscript: userscriptHeader(scriptConfig, scriptVersion(scriptName)) as Parameters<typeof monkey>[0]['userscript'],
            build: {
                externalGlobals: scriptConfig.externalGlobals ?? {},
                externalResource: scriptConfig.externalResource ?? {},
                fileName: scriptConfig.outputFileName,
            },
        }),
    ],
})
