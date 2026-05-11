// Greyhound Quote Collapser v2.1 — multi-layout dispatch.
//
// Two Greyhound rendering paths are supported via the layout registry:
//   - iframe-srcdoc (Detail/Vollansicht): mutate iframe.contentDocument
//   - inline (ChatView):                   self-healing mutation on the page DOM
//
// See layouts/index.ts for the registry, layouts/types.ts for the interface,
// and layouts/{iframe,inline}.ts for the handlers.

import { cleanupLegacyClones } from './legacy-cleanup.js'
import { startDiscovery } from './discovery.js'

cleanupLegacyClones()
startDiscovery()

console.log('[Greyhound Quote Collapser v2.1] aktiv – Layout-Dispatch (iframe + inline)')
