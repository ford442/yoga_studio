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

`npm run check` runs lint, TypeScript checks, shader-contract validation, and content/asset validation. `npm test` is the fast deterministic suite. The build must run before `npm run smoke` because smoke checks the generated static export in `out/`.

For renderer, instructor, session-journey, or other browser-visible changes, also run the serialized Playwright suite:

```bash
npm run test:e2e
```

## Coverage policy

CI runs `npm run test:coverage` and enforces line-coverage floors of 90% for `app/lib/**`, 70% for `app/renderer/**`, and 95% for `app/hooks/useBreathTimer.ts`. The initial thresholds deliberately sit just below the current baseline so a regression fails while follow-up work can ratchet them upward. Do not lower a threshold to merge a change; add focused tests or document why the core coverage boundary itself should change.

## Dependency security policy

Dependabot checks npm dependencies weekly and opens grouped development-tooling updates. Before changing dependencies, run:

```bash
npm run audit:high
```

High-severity findings require either a dependency update or a tracked exception that names the advisory, affected path, practical exposure, owner, and review date. This static-export application does not use server-only Next.js features at runtime, but build and development tooling advisories still require review. Avoid `npm audit fix --force`: framework-major or out-of-range updates must pass the full verification order above.
