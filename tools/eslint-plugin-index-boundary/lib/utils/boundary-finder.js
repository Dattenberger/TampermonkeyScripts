// Boundary-finder — walk the directory tree upwards from any file and find
// the nearest ancestor directory that contains an `index.ts` (or whichever
// filenames the caller configured as boundary markers). The result is the
// "Public-API boundary" that the file belongs to.
//
// Hybrid strategy: lazy walk-up + per-directory memoization. Each directory's
// lookup is O(d) the first time it is queried (where d = depth from the
// directory to the nearest ancestor with a boundary file) and O(1) on every
// subsequent query within the same ESLint run.

import * as fs from 'node:fs'
import * as path from 'node:path'

/**
 * @typedef {Object} BoundaryInfo
 * @property {string} dir       - Absolute path of the directory that owns the boundary.
 * @property {string} indexFile - Absolute path of the boundary marker file (e.g. `index.ts`).
 */

/**
 * Build a fresh boundary-finder. The caller decides the cache lifecycle —
 * a new finder per ESLint run keeps results consistent with on-disk reality
 * even when files are moved between runs.
 *
 * @param {Object}   options
 * @param {string[]} options.boundaryFiles - Filenames that mark a boundary, e.g. `['index.ts', 'index.tsx']`.
 * @returns {{
 *   findNearestBoundary: (filePath: string) => BoundaryInfo | null,
 *   clearCache: () => void,
 * }}
 */
export function createBoundaryFinder(options) {
    const { boundaryFiles } = options
    if (!Array.isArray(boundaryFiles) || boundaryFiles.length === 0) {
        throw new TypeError('createBoundaryFinder: boundaryFiles must be a non-empty array')
    }

    /** @type {Map<string, BoundaryInfo | null>} */
    const dirToBoundaryCache = new Map()

    /**
     * @param {string} filePath
     * @returns {BoundaryInfo | null}
     */
    function findNearestBoundary(filePath) {
        const startDir = path.dirname(filePath)
        if (dirToBoundaryCache.has(startDir)) {
            return dirToBoundaryCache.get(startDir) ?? null
        }

        /** @type {BoundaryInfo | null} */
        let result = null
        let cursor = startDir
        while (cursor !== path.dirname(cursor)) {
            // Walk-up cache hit on a parent → adopt that result.
            if (dirToBoundaryCache.has(cursor)) {
                result = dirToBoundaryCache.get(cursor) ?? null
                break
            }
            const found = probeBoundaryFiles(cursor, boundaryFiles)
            if (found !== null) {
                result = found
                break
            }
            cursor = path.dirname(cursor)
        }
        dirToBoundaryCache.set(startDir, result)
        return result
    }

    function clearCache() {
        dirToBoundaryCache.clear()
    }

    return { findNearestBoundary, clearCache }
}

/**
 * @param {string}   dir
 * @param {string[]} boundaryFiles
 * @returns {BoundaryInfo | null}
 */
function probeBoundaryFiles(dir, boundaryFiles) {
    for (const filename of boundaryFiles) {
        const candidate = path.join(dir, filename)
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
            return { dir, indexFile: candidate }
        }
    }
    return null
}
