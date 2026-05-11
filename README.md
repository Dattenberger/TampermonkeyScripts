# TampermonkeyScripts

TypeScript-based Tampermonkey userscript repository. Multiple scripts live
side-by-side in one repo, share a common library (`src/lib/`), and are built
into single-file `.user.js` artefacts under `dist/` that Tampermonkey loads
via raw GitHub URLs.

## Toolchain

- **Node 24** (LTS), **TypeScript 6**
- **Vite 8** + [`vite-plugin-monkey`](https://github.com/lisonge/vite-plugin-monkey) for userscript bundling
- **ESLint 9** flat config + **typescript-eslint 8** (type-aware, strict)
  - Custom plugin `eslint-plugin-index-boundary` enforces `index.ts` as the public-API barrel of every shared lib module
- **Vitest 4** + jsdom + Tampermonkey GM_* mocks
- **Prettier 3**
- Pre-commit hook in Bash (`scripts/hooks/pre-commit`), activated via `core.hooksPath` — no Husky

## Repo Layout

```
src/
  lib/           Shared library code. Each sub-module has an index.ts barrel.
    utils/
      index.ts            ← public surface
      string.ts           ← internal
      __tests__/
  scripts/       One folder per userscript, with main.ts as the entry.
    <name>/
      main.ts
  test/setup.ts  Vitest setup (GM_* mocks)
  types/tampermonkey.d.ts
scripts.config.ts  ← single source of truth: registry of all scripts + their userscript metadata
tools/eslint-plugin-index-boundary/  ← project-local ESLint plugin
scripts/hooks/pre-commit             ← lint + typecheck + test + build
.github/workflows/
  ci.yml                  ← lint, typecheck, test, build on every push/PR
  auto-build-dist.yml     ← rebuild dist/ and commit-back when sources drift
dist/          Generated. Tampermonkey loads scripts from raw.githubusercontent.com/<…>/main/dist/<name>.user.js
legacy/        Original pre-TypeScript .js userscripts
```

## Adding a new userscript

1. Create `src/scripts/<name>/main.ts`.
2. Register the script in `scripts.config.ts` — entry path, output filename, full userscript metadata (`name`, `match`, `grant`, `connect`, `updateURL`, `downloadURL`).
3. Commit. The pre-commit hook lints, typechecks, tests and builds locally; the GitHub Action rebuilds and commits `dist/` on push if anything drifted.

## Common commands

```sh
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

## GitHub Actions

- **CI** (`ci.yml`): runs on every push and pull request. Lint → typecheck → test → build. Failures block PRs.
- **Auto-build dist** (`auto-build-dist.yml`): runs on every push to any branch. Rebuilds, diffs `dist/`, only commits back when sources have drifted from the committed `dist/`. The auto-commit carries `[skip ci]` to prevent loops.

If the local pre-commit hook already produced the expected `dist/`, the action's diff is empty and it commits nothing.

## Index-boundary lint rule

`src/lib/<module>/index.ts` is the public surface of that module. Code
outside the module (scripts, other libs, root files) may only import from
that `index.ts`, not from internal sibling files. Tests, tooling and the
`scripts/` infra-config are exempted.

## Notes

- The build is browser-targeted (Vite `build.target: es2022`). TypeScript's
  `target: es2024` only affects what the type-checker permits in source —
  Vite handles the actual bundling.
- `dist/*.user.js` files are committed to keep the Tampermonkey `updateURL`
  / `downloadURL` (which point at `raw.githubusercontent.com/.../main/dist/...`)
  always current with source.
