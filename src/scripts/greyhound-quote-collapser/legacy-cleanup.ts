// Artefacts left behind by the v1.x clone-architecture of this script.
// Once enough time has passed that no installed user still has v1.x
// state on screen, this whole module can be deleted.

export function cleanupLegacyClones(root: Document = document): void {
    for (const el of root.querySelectorAll('.gh-qc-clone')) {
        el.remove()
    }
    for (const el of root.querySelectorAll('.gh-qc-original-hidden')) {
        el.classList.remove('gh-qc-original-hidden')
    }
    for (const el of root.querySelectorAll('.gh-qc-processed')) {
        el.classList.remove('gh-qc-processed')
    }
}
