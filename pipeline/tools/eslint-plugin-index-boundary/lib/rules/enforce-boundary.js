// Rule: `index-boundary/enforce-boundary`
//
// Enforces the convention "any directory that contains an `index.ts` is a
// Public-API boundary". Code that lives outside the boundary may only import
// the boundary's index file, never an internal sibling. Code inside the
// boundary may import freely between siblings.
//
// Cascading is implicit: when `outer/inner/index.ts` exists alongside
// `outer/index.ts`, the nearest-walk-up returns the inner boundary first,
// so external code is rejected at the inner boundary level — which is the
// more specific (and more helpful) error message.
//
// The rule consumes parser-services from the host's TypeScript-aware ESLint
// setup. `ts.resolveModuleName(...)` is the authoritative module resolver —
// same logic the compiler uses, no drift between lint and `tsc`.

import * as path from 'node:path'

import { ESLintUtils } from '@typescript-eslint/utils'
import ts from 'typescript'

import { createBoundaryFinder } from '../utils/boundary-finder.js'
import { isPathUnder, globMatches } from '../utils/path-helpers.js'

const DEFAULT_BOUNDARY_FILES = ['index.ts']
const DEFAULT_EXEMPT_SOURCES = []

/** @type {import('eslint').Rule.RuleModule} */
export const enforceBoundary = {
    meta: {
        type: 'problem',
        docs: {
            description:
                'Forbid imports that bypass a directory-level Public-API boundary marked by an index file.',
            recommended: false,
        },
        // Auto-fix is intentionally NOT supported. The rule is diagnostic-only;
        // rewriting imports requires semantic knowledge (does the index actually
        // re-export the symbol?) that the AST does not have.
        schema: [
            {
                type: 'object',
                additionalProperties: false,
                properties: {
                    boundaryFiles: {
                        type: 'array',
                        items: { type: 'string' },
                        description:
                            'Filenames that mark a Public-API boundary. Default: ["index.ts"]. Add "index.tsx" for React-aware codebases.',
                    },
                    exemptSources: {
                        type: 'array',
                        items: { type: 'string' },
                        description:
                            'Glob patterns of source files for which the rule is suppressed (e.g. tests).',
                    },
                    enforceForTypeImports: {
                        type: 'boolean',
                        description:
                            'When false, `import type { ... }` is not checked. Default: true.',
                    },
                },
            },
        ],
        messages: {
            violatesBoundary:
                'Import bypasses the index boundary at "{{ boundaryDir }}". Import from the boundary index file ("{{ boundaryFile }}") instead of the internal file ("{{ targetFile }}").',
        },
    },

    create(context) {
        /** @type {{
         *   boundaryFiles?: string[],
         *   exemptSources?: string[],
         *   enforceForTypeImports?: boolean,
         * }} */
        const options = context.options[0] ?? {}
        const boundaryFiles = options.boundaryFiles ?? DEFAULT_BOUNDARY_FILES
        const exemptSources = options.exemptSources ?? DEFAULT_EXEMPT_SOURCES
        const enforceForTypeImports = options.enforceForTypeImports ?? true

        const sourceFile = context.filename ?? context.getFilename()
        if (typeof sourceFile !== 'string' || sourceFile === '<input>' || sourceFile === '<text>') {
            // Inline-linted text without a real path — boundary semantics
            // do not apply. Skip silently.
            return {}
        }

        if (globMatches(sourceFile, exemptSources)) {
            return {}
        }

        // Parser-services are mandatory. `getParserServices` throws a
        // standardised error message if the host is not running the rule
        // under `parserOptions.project` (or `projectService`) with the
        // typescript-eslint parser. That is intentional: the rule has no
        // fallback resolver — type-aware lint is the contract.
        const services = ESLintUtils.getParserServices(context, true)
        const compilerOptions = services.program.getCompilerOptions()

        const finder = createBoundaryFinder({ boundaryFiles })

        /**
         * @param {string} importSource
         * @param {import('estree').Node} node
         * @param {boolean} isTypeOnly
         */
        function checkSource(importSource, node, isTypeOnly) {
            if (isTypeOnly && !enforceForTypeImports) return
            if (typeof importSource !== 'string' || importSource.length === 0) return

            // Authoritative module resolution via the TypeScript Compiler
            // API. Same algorithm `tsc` uses, so:
            //   - tsconfig `paths` aliases (@lib/...) resolve correctly,
            //   - `extends` chains are honoured,
            //   - extension-fallback (.ts/.tsx/.js/...) follows tsc's rules.
            const resolution = ts.resolveModuleName(
                importSource,
                sourceFile,
                compilerOptions,
                ts.sys,
            )
            const resolved = resolution.resolvedModule
            if (!resolved) return
            if (resolved.isExternalLibraryImport) return
            const targetFile = resolved.resolvedFileName

            const targetBoundary = finder.findNearestBoundary(targetFile)
            if (targetBoundary === null) {
                // Target has no enclosing boundary — nothing to enforce.
                return
            }

            // Source is "inside" the boundary when it lives under the boundary directory.
            const sourceInside = isPathUnder(sourceFile, targetBoundary.dir)
                || path.normalize(sourceFile) === path.normalize(targetBoundary.indexFile)
            if (sourceInside) return

            // Source is outside. Importing the boundary's index file itself is allowed.
            const importingIndex =
                path.normalize(targetFile) === path.normalize(targetBoundary.indexFile)
            if (importingIndex) return

            context.report({
                node,
                messageId: 'violatesBoundary',
                data: {
                    boundaryDir: path.relative(process.cwd(), targetBoundary.dir),
                    boundaryFile: path.relative(process.cwd(), targetBoundary.indexFile),
                    targetFile: path.relative(process.cwd(), targetFile),
                },
            })
        }

        return {
            ImportDeclaration(node) {
                const isTypeOnly = node.importKind === 'type'
                if (typeof node.source.value === 'string') {
                    checkSource(node.source.value, node, isTypeOnly)
                }
            },
            ImportExpression(node) {
                if (
                    node.source.type === 'Literal'
                    && typeof node.source.value === 'string'
                ) {
                    checkSource(node.source.value, node, false)
                }
            },
            ExportAllDeclaration(node) {
                if (node.source && typeof node.source.value === 'string') {
                    const isTypeOnly = node.exportKind === 'type'
                    checkSource(node.source.value, node, isTypeOnly)
                }
            },
            ExportNamedDeclaration(node) {
                if (node.source && typeof node.source.value === 'string') {
                    const isTypeOnly = node.exportKind === 'type'
                    checkSource(node.source.value, node, isTypeOnly)
                }
            },
            // CommonJS `require('./foo')` — defensive coverage for files that
            // still use it. ESM is the project default but consistent
            // diagnostics across module systems is cheap.
            CallExpression(node) {
                if (
                    node.callee.type === 'Identifier'
                    && node.callee.name === 'require'
                    && node.arguments.length === 1
                    && node.arguments[0].type === 'Literal'
                    && typeof node.arguments[0].value === 'string'
                ) {
                    checkSource(node.arguments[0].value, node, false)
                }
            },
        }
    },
}
