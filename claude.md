# Claude.md

**[AGENTS.md](./AGENTS.md) is the single source of truth** for this repo: architecture, shader/uniform contract, timing system, testing, common tasks, troubleshooting and pitfalls. Read it first. This file intentionally holds no duplicate of that content — it used to, and the copy drifted (stale versions, "no automated tests", removed preset buttons).

Yoga Studio is a Next.js (static export) + React + TypeScript pranayama timer with a WebGPU/WebGL2 breathing visualization and a small C++/wasm numeric tier.

Everything you need before pushing:

```bash
npm run check      # lint (0 warnings) + typecheck + validate:shaders + validate:content
npm test           # Vitest: unit-node + ui-jsdom projects
npm run build && npm run smoke
# if you touched native/: npm run test:native{,:asan,:tidy} && npm run build:chores-wasm
```

Versions live in `package.json`; if AGENTS.md disagrees with it, the file is wrong — fix it. See also `CONTRIBUTING.md` and `native/gpu-chores-wasm/README.md`.
