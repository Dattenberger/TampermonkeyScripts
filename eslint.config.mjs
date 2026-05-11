// ESLint flat-config for the Tampermonkey-Scripts repo.
//
// Architecture & rule philosophy carried over from the JTL-Zentralisierungs-Repo
// (Dattenberger/ersatzteil-scraper @ feature/jtl-catalog-reference). Adapted
// for a browser-targeted Vite + vite-plugin-monkey project:
//   - `eslint-plugin-n` (Node-Plugin) is intentionally NOT wired — userscripts
//     run in the browser, not in Node.
//   - No legacy-excludes block — we start clean.
//   - No `eslint-suppressions.json` mechanic — re-introduce when a migration
//     wave actually needs it.

import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import unicorn from 'eslint-plugin-unicorn'
import importPlugin from 'eslint-plugin-import'
import unusedImports from 'eslint-plugin-unused-imports'
import prettier from 'eslint-config-prettier'
import indexBoundary from './tools/eslint-plugin-index-boundary/lib/index.js'

export default tseslint.config(
    // 1. Global ignores ───────────────────────────────────────────────
    // We only lint TypeScript. JS/MJS/CJS at the repo root and the
    // project-local ESLint plugin are out of scope for the main config.
    {
        ignores: [
            'dist/**',
            'node_modules/**',
            'legacy/**',
            'tools/**',
            'coverage/**',
            '**/*.user.js',
            '**/*.cjs',
            '**/*.mjs',
            '**/*.js',
        ],
    },

    // 2. Base presets ─────────────────────────────────────────────────
    js.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,
    unicorn.configs['flat/recommended'],
    importPlugin.flatConfigs.recommended,
    prettier,

    // 3. Project parser options + repository-wide rules ────────────────
    // Applies to every TS file in the lint scope. parserOptions.project
    // points at tsconfig.eslint.json so that test files and the root-
    // level config files (vite.config.ts, scripts.config.ts, build.ts)
    // are part of the type-aware program.
    {
        files: ['**/*.ts', '**/*.mts', '**/*.cts'],
        languageOptions: {
            parser: tseslint.parser,
            parserOptions: {
                project: './tsconfig.eslint.json',
                tsconfigRootDir: import.meta.dirname,
            },
            globals: {
                // Tampermonkey GM_* APIs are declared in src/types/tampermonkey.d.ts.
                // Listing them as `readonly` here keeps no-undef quiet for
                // configs that re-enable it; the umbrella config disables
                // no-undef for typescript-eslint by default.
                GM_addStyle: 'readonly',
                GM_xmlhttpRequest: 'readonly',
                GM_getValue: 'readonly',
                GM_setValue: 'readonly',
                GM_deleteValue: 'readonly',
                GM_openInTab: 'readonly',
                GM_setClipboard: 'readonly',
                GM_notification: 'readonly',
                unsafeWindow: 'readonly',
            },
        },
        settings: {
            'import/resolver': {
                typescript: { project: './tsconfig.json' },
            },
        },
        plugins: {
            'unused-imports': unusedImports,
            'index-boundary': indexBoundary,
        },
        rules: {
            // ── index-boundary: enforce barrel-imports ─────────────────
            // src/lib/<module>/index.ts is the public surface of each
            // shared library. Scripts must import from there, not from
            // internal files of the lib. Tests and tooling are exempted.
            'index-boundary/enforce-boundary': ['error', {
                boundaryFiles: ['index.ts'],
                exemptSources: [
                    '**/__tests__/**',
                    '**/*.test.ts',
                    '**/tools/**',
                    '**/scripts/**',
                ],
                enforceForTypeImports: true,
            }],

            // ── unused-imports: auto-fixable removal ───────────────────
            'unused-imports/no-unused-imports': 'error',

            // Disabled — too noisy for type-only fixtures; the TS compiler
            // catches actually-unused variables under `noUnusedLocals` when
            // we want it.
            '@typescript-eslint/no-unused-vars': 'off',
            'no-unused-vars': 'off',

            // ── any-Detection: error ───────────────────────────────────
            '@typescript-eslint/no-explicit-any': 'error',

            // ── Type-aware rule promotions (already 'error' via the
            // recommended-type-checked preset; re-declared so the active
            // rule set is greppable in this file).
            '@typescript-eslint/require-await': 'error',
            '@typescript-eslint/no-unsafe-member-access': 'error',
            '@typescript-eslint/no-unsafe-call': 'error',
            '@typescript-eslint/no-unsafe-argument': 'error',
            '@typescript-eslint/no-unsafe-assignment': 'error',
            '@typescript-eslint/no-unsafe-return': 'error',

            // ── eqeqeq: error, with `null: 'ignore'` relaxation ───────
            // The `x != null` idiom (= "neither null nor undefined") stays
            // legal; everything else has to use ===.
            eqeqeq: ['error', 'always', { null: 'ignore' }],

            // ── prefer-const: keep at warn ────────────────────────────
            'prefer-const': 'warn',

            // ── unicorn opinionated overrides (matched to JTL-Repo) ───
            'unicorn/prevent-abbreviations': 'off',
            'unicorn/no-null': 'off',
            'unicorn/prefer-module': 'off',
            'unicorn/filename-case': 'off',
            'unicorn/no-array-reduce': 'off',
            'unicorn/prefer-top-level-await': 'off',
            'unicorn/catch-error-name': 'off',
            'unicorn/no-useless-undefined': 'off',
            'unicorn/consistent-function-scoping': 'error',

            // ── import opinionated overrides ──────────────────────────
            'import/no-unresolved': 'error',
            'import/order': 'off',
        },
    },

    // 4. Test-file relaxation ─────────────────────────────────────────
    {
        files: ['src/**/*.test.ts', 'src/**/__tests__/**/*.ts'],
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-non-null-assertion': 'off',
            'no-console': 'off',
            'unicorn/consistent-function-scoping': 'off',
            // `@typescript-eslint/no-floating-promises` deliberately stays
            // at default ('error' from recommended-type-checked) for tests
            // too — floating promises in test bodies are typically real bugs.
        },
    },

    // 5. Build & repo-config files ────────────────────────────────────
    // build.ts / vite.config.ts / vitest.config.ts / scripts.config.ts
    // run in Node, not the browser. Type-check them with the same project
    // but relax browser-specific assumptions and CLI patterns.
    {
        files: ['*.ts', '*.mts', '*.config.ts'],
        rules: {
            'import/no-unresolved': 'off',
            'index-boundary/enforce-boundary': 'off',
            // Legitimate CLI pattern in build.ts and similar runners.
            'unicorn/no-process-exit': 'off',
            // CLIs may legitimately log to stdout.
            'no-console': 'off',
        },
    },
)
