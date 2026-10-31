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
      settings/                ← local per-user settings (factor + its badge), see below
      utils/
        index.ts                ← public surface
        debounce.ts             ← internal
        string.ts               ← internal
        __tests__/
    scripts/                 One folder per userscript, with main.ts as the entry.
      greyhound-quote-collapser/
      herkules-haendler-orders-exporter/
    test/                    Vitest setup (GM_* mocks), registry and workflow rules
    types/tampermonkey.d.ts
  scripts.config.ts          ← registry of all scripts + their userscript metadata (no versions)
  versions.json              ← version + bundle hash per script; written only by `npm run version:update`
  scripts/
    hooks/pre-commit         ← lint + typecheck + test + build + version update
    versioning/              ← version:update / version:check
    data-guard/              ← public data guard
  tools/eslint-plugin-index-boundary/  ← project-local ESLint plugin
  dist/                      Built bundles. Tampermonkey loads raw.githubusercontent.com/.../main/pipeline/dist/<name>.user.js

.github/workflows/
  ci.yml                     ← checks on pull requests into main, pushes to main and manual runs
```

### Working model: feature branches, main delivers

`main` is always ready to use and is the only delivery path: every installed
pipeline script updates from its raw URL on `main`
(`…/main/pipeline/dist/<name>.user.js`), the legacy scripts from
`…/main/<file>.js`. There are no release channels and no other URLs.

Work happens on feature branches and reaches `main` only through a pull request
with green CI (ruleset on `main`: pull request and the `Checks` status required,
no force push, no deletion). The pull request carries the built bundles and their
versions; CI never writes to the repository.

### Versions

Tampermonkey updates an installed script only when its `@version` rises, so
versions are never set by hand. `pipeline/versions.json` records per script the
version and a hash of its bundle without the `@version` line. The pre-commit hook
runs `npm run version:update`, which builds every script and gives each one whose
bundle differs from `main` the next version:

- **patch** by default;
- **minor** or **major**: run `npm run version:update -- --level minor` (or
  `major`) and put the label `release:minor` (or `release:major`) on the pull
  request; CI checks that the versions match the label.

CI (`npm run version:check`) fails when `versions.json` or `dist/` are not
exactly what `version:update` writes against `main`. The fix is always the
same: `npm run version:update`, then commit.

### Rolling back a script

Open a revert pull request (GitHub's "Revert" button or `git revert` on a
branch). Reverting brings the old bundle back but also the old version, which
Tampermonkey would ignore, so CI fails on it until the version is raised: check
out the revert branch, run `npm run version:update` in `pipeline/` and commit.
The old code then ships under a new, higher version and reaches every
installation with the next update check.

### Testing a feature branch in Tampermonkey

Without a test channel, a branch is tried from the
[`vite-plugin-monkey`](https://github.com/lisonge/vite-plugin-monkey) dev
server on the development machine. The server binds `127.0.0.1` only and never
switches ports (`strictPort`); an HTTPS proxy on the same port makes it reachable
from the browser, for example `tailscale serve`:

```sh
cd pipeline
SCRIPT=herkules-haendler-orders-exporter DEV_HOST=<dev-host> DEV_PORT=<port> npm run dev
# in a second shell, once:
tailscale serve --bg --https=<port> http://127.0.0.1:<port>
```

Open `https://<dev-host>:<port>/` in the browser with Tampermonkey. The page
forwards to the install script; install it next to (or instead of) the released
one. It loads the branch's code live from the dev server, with hot reload over
`wss` on the same port, and keeps updating from there, never from `main`. The
server answers only requests for `DEV_HOST` (Vite's DNS-rebinding guard). Local
settings are kept per
installed script, so the dev copy asks for its own values. Pages with a strict
Content-Security-Policy may block the live module; then build the branch
(`npm run build`) and install `pipeline/dist/<name>.user.js` from the branch
instead.

Afterwards stop the dev server and remove the proxy mapping
(`tailscale serve --https=<port> off`).

### Local settings (discount factors)

Purchase or payment conditions never go into this public code. A script that
needs such a factor declares the setting by name in `scripts.config.ts`
(`settings`), asks the user once, and keeps the value in Tampermonkey's storage
(`GM_getValue`/`GM_setValue`), without a default. The script shows the stored
value in its own interface and lets the user change it with one click
(`factorBadge` from `@lib/settings`, e.g. "Faktor … · ändern" beside the
Herkules exporter's CSV button, "Faktor fehlt · eingeben" without a value); the
Tampermonkey menu entry is the fallback. Tests use random values.

### Adding a new userscript

1. `cd pipeline`
2. Create `src/scripts/<name>/main.ts`.
3. Register the script in `scripts.config.ts` — entry path, output filename, userscript metadata (`name`, `match`, `grant`, `connect`, `updateURL`, `downloadURL`; no `version`, no `@author`). The `updateURL` / `downloadURL` point at `…/main/pipeline/dist/<name>.user.js`.
4. Commit. The pre-commit hook lints, typechecks, tests, builds and records the script in `versions.json` (a new script starts at 1.0.0).

### Common commands

All run from `pipeline/`:

```sh
cd pipeline
npm install                # also activates the git hook via `prepare`
npm run build              # builds every script registered in scripts.config.ts
npm run version:update     # build + next versions against main (the hook runs it)
npm run version:check      # what CI checks: versions and dist/ match the sources
npm run data-guard         # public data guard over src/ and dist/
npm run typecheck          # tsc --noEmit
npm run lint               # eslint .
npm run lint:fix
npm run test               # vitest run
npm run format             # prettier --write .
npm run check              # full pre-PR sanity (= pre-commit --all)
SCRIPT=<name> npm run dev  # dev server, see "Testing a feature branch"
```

### Skip-flags for the pre-commit hook (debugging only)

```
SKIP_LINT=1 SKIP_TYPECHECK=1 SKIP_TESTS=1 SKIP_BUILD=1 git commit ...
git commit --no-verify   # bypass entirely, leaves a trail; CI still checks everything
```

### GitHub Actions

`ci.yml` runs one job, `Checks`, on pull requests into `main` (also when a
`release:*` label changes), on pushes to `main` and by hand
(`workflow_dispatch`): actionlint, ESLint, typecheck, Vitest, build with the
version check, the public data guard and a gitleaks scan of the whole history.
It runs with a read-only token, uses no secrets and never `pull_request_target`
(pinned by `pipeline/src/test/workflows.test.ts`).

### Repo standard: exception

This repository is **public**, and the company's repo standard and its CI live in
the private repository `robotico-ci`, whose reusable workflows a public
repository cannot call. The repository therefore stays outside the standard and
keeps its own, self-contained checks, all in `ci.yml` above:

| Check | Where |
|---|---|
| Workflow lint | actionlint (container) + `src/test/workflows.test.ts` (no secrets, no `pull_request_target`, read-only token, triggers) |
| Lint, typecheck, unit tests | `npm run lint`, `npm run typecheck`, `npm test` |
| Build, versions | `npm run version:check` |
| Public data guard | `npm run data-guard`: no internal hosts, tailnet names or addresses, no company mail address except the published role mailboxes, in any file of `src/` or `dist/` |
| Secrets | gitleaks over every commit |
| Purchase conditions | not machine-checkable (a bare number); every review checks that no factor or condition value is in code, tests or fixtures |

Review point: if the repository becomes private, the standard applies again and
these checks move into it.

### Index-boundary lint rule

`pipeline/src/lib/<module>/index.ts` is the public surface of that module. Code
outside the module (scripts, other libs, root files) may only import from
that `index.ts`, not from internal sibling files. Tests, tooling and
`scripts.config.ts` are exempted.

### Notes

- The build is browser-targeted (Vite `build.target: es2022`). TypeScript's
  `target: es2024` only affects what the type-checker permits in source —
  Vite handles the actual bundling.
- `pipeline/dist/*.user.js` files are committed because the Tampermonkey
  `updateURL` / `downloadURL` point at
  `raw.githubusercontent.com/.../main/pipeline/dist/...`; CI checks that they
  are exactly what the sources build.
