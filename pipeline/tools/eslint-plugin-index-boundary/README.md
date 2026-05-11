# eslint-plugin-index-boundary

Project-Local ESLint plugin. Single rule: `index-boundary/enforce-boundary`.

## What it does

Any directory containing an `index.ts` file is treated as a Public-API
boundary. Code outside that directory may only import the boundary's
`index.ts`, never an internal sibling file inside it. Code inside the
boundary may import freely between siblings.

This forces consumers to go through the explicit public surface, which
makes refactors safer (internal restructuring stays internal) and the
public API auditable.

## Activation

Type-aware lint is required — the rule uses the TypeScript Compiler API
(`ts.resolveModuleName`) via `@typescript-eslint/parser`'s parser-services.

```js
// eslint.config.mjs
import indexBoundary from './tools/eslint-plugin-index-boundary/lib/index.js'

export default [
    {
        plugins: { 'index-boundary': indexBoundary },
        languageOptions: {
            parserOptions: {
                project: './tsconfig.json',
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            'index-boundary/enforce-boundary': ['error', {
                boundaryFiles: ['index.ts'],
                exemptSources: ['**/tests/**', '**/*.test.ts', '**/tools/**'],
                enforceForTypeImports: true,
            }],
        },
    },
]
```

## Options

| Option | Default | Description |
|---|---|---|
| `boundaryFiles` | `['index.ts']` | Filenames that mark a boundary. Add `index.tsx` for React. |
| `exemptSources` | `[]` | Glob patterns of source files for which the rule is suppressed (e.g. tests). |
| `enforceForTypeImports` | `true` | When `false`, `import type { ... }` is not checked. |

## Limitations

- No auto-fix. Rewriting imports requires knowing whether the boundary's
  index actually re-exports the symbol; the AST alone does not.
- Glob support is intentionally minimal (no brace expansion, no negation).

## Origin

Lifted from `Dattenberger/ersatzteil-scraper` branch
`feature/jtl-catalog-reference`, where it was developed as part of the
ESLint-modernization plan (ADR-0037).
