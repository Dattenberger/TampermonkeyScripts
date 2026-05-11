// Greyhound Quote Collapser v2 — iframe-direct manipulation.
//
// Greyhound renders mail bodies into `<iframe srcdoc>`; React does not
// reconcile the iframe document, so we mutate `contentDocument` directly.
// Click delegation runs in the parent window context (no need for
// `allow-scripts` on the iframe sandbox).

import { cleanupLegacyClones } from './legacy-cleanup.js'
import { startDiscovery } from './discovery.js'

cleanupLegacyClones()
startDiscovery()

console.log('[Greyhound Quote Collapser v2.0] aktiv – iframe-direkter Ansatz')
