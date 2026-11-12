# Contributing

## Development setup

Use Node.js 22 and npm 10 or newer. Install the locked dependency tree with:

```bash
npm ci
```

The content and shader validators run TypeScript through `tsx`. The package is ESM (`"type": "module"`), so validator imports use the same module semantics locally and in CI without Node's experimental type-stripping flag.

## Required verification order

Run the same foundation gates as CI in this order:

```bash
npm run check
npm test
npm run build
npm run smoke
```

`npm run check` runs lint, TypeScript checks, shader-contract validation, and content/asset validation. `npm test` is the fast deterministic suite. The build must run before `npm run smoke` because smoke checks the generated static export in `out/`. `npm run lint` allows zero warnings.

`npm test` runs two Vitest projects (`unit-node` for pure logic, `ui-jsdom` for components and hooks); `npm run test:unit` / `npm run test:ui` run one. A test that needs a DOM outside the UI directories opts in with a `// @vitest-environment jsdom` first line. Never fix a timing flake by raising its timeout.

For renderer, instructor, session-journey, or other browser-visible changes, also run the serialized Playwright suite:

```bash
npm run test:e2e
```

## Native (C++ / wasm) changes

Needs `clang`, `lld`, `cmake` and `clang-tidy` (`apt install clang lld cmake clang-tidy`). If you touch anything under `native/`:

```bash
npm run test:native && npm run test:native:asan && npm run test:native:tidy
npm run build:chores-wasm   # then commit app/lib/gpuChores/wasm/
```

CI rebuilds `chores.wasm` from source (clang 18) and fails if it differs from the committed file. The build script never overwrites the committed artifact unless the whole build succeeds. For clangd, generate `compile_commands.json` into the gitignored build tree and symlink it:

```bash
(cd native/gpu-chores-wasm && cmake --preset host)
ln -sf native/gpu-chores-wasm/build/host/compile_commands.json compile_commands.json
```

## Dependency changes

`package-lock.json` is tracked and CI installs with `npm ci`. After editing a dependency in `package.json`, run `npm install` and commit both files; if they disagree, every CI job fails at install.

## Coverage policy

CI runs `npm run test:coverage` and enforces line-coverage floors of 90% for `app/lib/**`, 70% for `app/renderer/**`, and 95% for `app/hooks/useBreathTimer.ts`. The initial thresholds deliberately sit just below the current baseline so a regression fails while follow-up work can ratchet them upward. Do not lower a threshold to merge a change; add focused tests or document why the core coverage boundary itself should change.

## Dependency security policy

Dependabot checks npm dependencies weekly and opens grouped development-tooling updates. Before changing dependencies, run:

```bash
npm run audit:high
```

High-severity findings require either a dependency update or a tracked exception that names the advisory, affected path, practical exposure, owner, and review date. This static-export application does not use server-only Next.js features at runtime, but build and development tooling advisories still require review. Avoid `npm audit fix --force`: framework-major or out-of-range updates must pass the full verification order above.
