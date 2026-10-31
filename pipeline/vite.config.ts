import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type ServerOptions } from 'vite'
import monkey from 'vite-plugin-monkey'
import { scriptVersion, scripts, userscriptHeader, type ScriptConfig } from './scripts.config.js'

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
// 127.0.0.1 only and never moved to another port. With DEV_PORT and DEV_HOST set it sits behind
// an HTTPS proxy on that port: only the proxy's host name is accepted (Vite's DNS-rebinding
// guard stays on), and HMR uses wss on the public port.
const devPort = process.env.DEV_PORT ? Number(process.env.DEV_PORT) : undefined
const devHost = process.env.DEV_HOST
if (devPort !== undefined && !devHost) throw new Error('vite.config.ts: DEV_PORT needs DEV_HOST, the proxy host name')
const proxied: ServerOptions =
    devPort === undefined || !devHost
        ? {}
        : { port: devPort, allowedHosts: [devHost], hmr: { protocol: 'wss', clientPort: devPort } }

/** The dev copy keeps updating from the dev server it was installed from, never from main. */
function withoutReleaseUrls<T extends ScriptConfig['userscript']>(header: T): Omit<T, 'updateURL' | 'downloadURL'> {
    const { updateURL: _update, downloadURL: _download, ...rest } = header
    return rest
}

export default defineConfig(({ command }) => {
    const header = userscriptHeader(scriptConfig, scriptVersion(scriptName))
    return {
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
                userscript: (command === 'serve' ? withoutReleaseUrls(header) : header) as Parameters<typeof monkey>[0]['userscript'],
                build: {
                    externalGlobals: scriptConfig.externalGlobals ?? {},
                    externalResource: scriptConfig.externalResource ?? {},
                    fileName: scriptConfig.outputFileName,
                },
            }),
        ],
    }
})
