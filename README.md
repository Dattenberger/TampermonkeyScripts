# TampermonkeyScripts

Userscript collection for Dattenberger / Robotico workflows. The repo
has **two coexisting layouts**:

- **Root level**: legacy standalone `.user.js` scripts. Each is a single
  self-contained file with its own `// ==UserScript== ... // ==/UserScript==`
  header. Installed directly via Tampermonkey from the raw GitHub URL of
  the `.js` file. No build step.
- **`pipeline/`**: TypeScript-based build pipeline for new scripts.
  Multiple scripts share a common library (`pipeline/src/lib/`), are
  type-checked, linted, tested with Vitest, and bundled into single-file
  `.user.js` artefacts under `pipeline/dist/` that Tampermonkey loads
  via raw GitHub URLs.

New scripts should go in `pipeline/`. Legacy scripts at root stay where
they are — they predate the pipeline, are stable, and have no test suite
or shared dependencies.

## Root-level (legacy) scripts

```
greyhound.js                              Greyhound Alt+J shortcut helper
gmail-bilder.js                           Inline-image helpers for Gmail
gmail-search-by-sender.user.js            Sender-scoped search in Gmail
hsqvrn_protal_cart_exporter.js            Husqvarna portal cart export
hsqvrn_protal_orders_exporter.js          Husqvarna portal order export
husqvarna-product-image-download-button.js
mfr-kd-auftragsformatter.js               Auftragsformatter for MFR portal
weborder.js / weborder_v2.js              Weborder helpers
```

Install via Tampermonkey using the file's raw GitHub URL.

## `pipeline/` — TypeScript build pipeline

### Toolchain

- **Node 24** (LTS), **TypeScript 6**
- **Vite 8** + [`vite-plugin-monkey`](https://github.com/lisonge/vite-plugin-monkey) for userscript bundling
- **ESLint 9** flat config + **typescript-eslint 8** (type-aware, strict)
  - Custom plugin `eslint-plugin-index-boundary` enforces `index.ts` as the public-API barrel of every shared lib module
- **Vitest 4** + jsdom + Tampermonkey GM_* mocks
- **Prettier 3**
- Pre-commit hook in Bash (`pipeline/scripts/hooks/pre-commit`), activated via `core.hooksPath` — no Husky

### Layout

```
pipeline/
  src/
    lib/                     Shared library code. Each sub-module has an index.ts barrel.
      utils/
        index.ts                ← public surface
        debounce.ts             ← internal
        string.ts               ← internal
        __tests__/
    scripts/                 One folder per userscript, with main.ts as the entry.
      greyhound-quote-collapser/
        main.ts
        ...
    test/setup.ts            Vitest setup (GM_* mocks)
    types/tampermonkey.d.ts
  scripts.config.ts          ← single source of truth: registry of all scripts + their userscript metadata
  tools/eslint-plugin-index-boundary/  ← project-local ESLint plugin
  scripts/hooks/pre-commit               ← lint + typecheck + test + build
  dist/                      Generated. Tampermonkey loads from raw.githubusercontent.com/.../main/pipeline/dist/<name>.user.js

.github/workflows/
  ci.yml                     ← lint, typecheck, test, build on every push/PR (runs inside pipeline/)
  auto-build-dist.yml        ← rebuild pipeline/dist/ and commit-back when sources drift
```

### Adding a new userscript

1. `cd pipeline`
2. Create `src/scripts/<name>/main.ts`.
3. Register the script in `scripts.config.ts` — entry path, output filename, full userscript metadata (`name`, `match`, `grant`, `connect`, `updateURL`, `downloadURL`). The `updateURL` / `downloadURL` should point at `…/main/pipeline/dist/<name>.user.js`.
4. Commit. The pre-commit hook lints, typechecks, tests and builds locally; the GitHub Action rebuilds and commits `pipeline/dist/` on push if anything drifted.

### Common commands

All run from `pipeline/`:

```sh
cd pipeline
npm install            # also activates the git hook via `prepare`
npm run dev            # vite dev server (mainly useful for shared lib work)
npm run build          # builds every script registered in scripts.config.ts
npm run typecheck      # tsc --noEmit
npm run lint           # eslint .
npm run lint:fix
npm run test           # vitest run
npm run format         # prettier --write .
npm run check          # full pre-PR sanity (= pre-commit --all)
```

### Skip-flags for the pre-commit hook (debugging only)

```
SKIP_LINT=1 SKIP_TYPECHECK=1 SKIP_TESTS=1 SKIP_BUILD=1 git commit ...
git commit --no-verify   # bypass entirely, leaves a trail
```

### GitHub Actions

- **CI** (`ci.yml`): runs on every push and pull request. Lint → typecheck → test → build. Failures block PRs.
- **Auto-build dist** (`auto-build-dist.yml`): runs on every push to any branch. Rebuilds, diffs `pipeline/dist/`, only commits back when sources have drifted from the committed `dist/`. The auto-commit carries `[skip ci]` to prevent loops.

If the local pre-commit hook already produced the expected `dist/`, the action's diff is empty and it commits nothing.

### Index-boundary lint rule

`pipeline/src/lib/<module>/index.ts` is the public surface of that module. Code
outside the module (scripts, other libs, root files) may only import from
that `index.ts`, not from internal sibling files. Tests, tooling and
`scripts.config.ts` are exempted.

### Notes

- The build is browser-targeted (Vite `build.target: es2022`). TypeScript's
  `target: es2024` only affects what the type-checker permits in source —
  Vite handles the actual bundling.
- `pipeline/dist/*.user.js` files are committed to keep the Tampermonkey
  `updateURL` / `downloadURL` (which point at
  `raw.githubusercontent.com/.../main/pipeline/dist/...`) always current with
  source.
