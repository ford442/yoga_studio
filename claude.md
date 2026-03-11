# Claude.md - Development Guide for Yoga Studio

This document provides context for Claude Code sessions working on this project.

## Quick Project Summary

**Yoga Studio** is a Next.js web application that combines:
- Interactive breathing timer with 4-phase pranayama cycles
- WebGPU-powered chakra visualization
- SVG-based posture guidance with animated stick figures
- Educational yoga content (Sanskrit names, techniques, benefits)

**Tech Stack:** Next.js 16 + React 19 + TypeScript + Tailwind CSS v4 + WebGPU + WGSL

## Repository Structure

```
yoga_studio/
├── app/
│   ├── components/
│   │   ├── WebGPUShader.tsx      # GPU rendering + chakra visualization
│   │   ├── BreathTimer.tsx        # Timer UI and controls
│   │   └── PostureGuide.tsx       # Animated posture guidance
│   ├── hooks/
│   │   └── useSacredBreathTimer.ts # Breathing logic + chakra mapping
│   ├── page.tsx                    # Main page
│   ├── layout.tsx                  # Root layout
│   └── globals.css                 # Tailwind styles
├── public/                         # Static assets
├── package.json
├── tsconfig.json
├── next.config.ts
├── eslint.config.mjs
├── postcss.config.mjs
├── README.md                       # Project overview
├── AGENTS.md                       # Detailed architecture guide
└── claude.md                       # This file
```

## Key Technologies

### Next.js & React
- Using App Router (no pages directory)
- React 19 with TypeScript
- Client components marked with `'use client'`

### WebGPU & Shaders
- Custom WGSL shader for visualization
- Real-time uniform buffer updates
- GPU-accelerated graphics for breathing animation and chakra display

### Styling
- Tailwind CSS v4 with `@import "tailwindcss"` in globals.css
- Glassmorphism effects using `backdrop-blur`, `bg-white/10`
- Custom animations for breathing and chakra visualization

## Development Workflow

### Installation
```bash
npm install
```

### Running Locally
```bash
npm run dev
# Open http://localhost:3000
```

### Building
```bash
npm run build      # Creates optimized production build
npm start          # Runs production server
npm run lint       # Run ESLint checks
```

## Important Concepts

### Breath Phases
The app uses a 4-phase breathing cycle:
1. **Inhale (0-25%)** - Anahata chakra (heart, green)
2. **Hold-in (25-50%)** - Manipura chakra (solar plexus, yellow)
3. **Exhale (50-75%)** - Muladhara chakra (root, red)
4. **Hold-out (75-100%)** - Sahasrara chakra (crown, violet)

### Strength Levels
- **Level 0 (Light):** 5s per phase
- **Level 1 (Medium):** 7s per phase
- **Level 2 (Strong):** 7-10s depending on cycle progression

### Chakra System
Seven chakras are visualized with colors and Sanskrit names. Each breath phase highlights specific chakras through color changes and glow intensity.

## File-by-File Guide

### `app/hooks/useSacredBreathTimer.ts`
- **Purpose:** Core breathing timer logic and chakra mapping
- **Key exports:** `useSacredBreathTimer` hook
- **Returns:** Object with:
  - `phase`: current breathing phase ('inhale' | 'hold-in' | 'exhale' | 'hold-out')
  - `phaseProgress`: 0-1 progress within phase
  - `countdown`: seconds remaining in current phase
  - `cycle`: current cycle count
  - `strengthLevel`: 0-2 (Light/Medium/Strong)
  - `isRunning`: boolean
  - `getUniforms()`: returns shader uniform data

### `app/components/WebGPUShader.tsx`
- **Purpose:** WebGPU canvas setup and shader rendering
- **Props:** `strengthLevel` prop
- **Ref methods:** `updateUniforms(data)` to update shader in real-time
- **Features:**
  - Chakra visualization with color-coded glows
  - Breath-synchronized animations
  - Fallback message for unsupported browsers

### `app/components/BreathTimer.tsx`
- **Purpose:** (Legacy/unused - see PostureGuide instead)

### `app/components/PostureGuide.tsx`
- **Purpose:** Display animated posture guidance
- **Props:** `phase` (current breathing phase)
- **Features:**
  - Animated SVG stick figures
  - Chakra visualization along spine
  - Educational content (bandhas, drishti, pranayama wisdom)

### `app/page.tsx`
- **Purpose:** Main page orchestrating all components
- **Key features:**
  - Large countdown display (20vw font)
  - Phase label (INHALE, HOLD IN, etc.)
  - Cycle counter
  - Control buttons (Begin, Pause, Reset, Strength level selector)
  - WebGPU shader canvas
  - Posture guide

## Common Tasks

### Adding a New Breathing Phase
1. Update phase type in `useSacredBreathTimer.ts`
2. Add phase timing to strength level definitions
3. Define chakra mapping for the phase
4. Update shader color logic in WebGPUShader.tsx
5. Add posture guidance in PostureGuide.tsx

### Modifying Chakra Colors
- Primary definitions in `useSacredBreathTimer.ts` (chakra color array)
- Shader colors in `WebGPUShader.tsx` (getChakraColor function)
- Keep RGB values consistent between React and shader

### Adjusting Breathing Durations
- Edit `STRENGTH_LEVELS` object in `useSacredBreathTimer.ts`
- Values represent seconds per phase
- Test across all three strength levels

### Updating Educational Content
- Modify text in `PostureGuide.tsx`
- No need to recompile shader
- Easy to add new sections or images

## Testing Checklist

When making changes, verify:
- [ ] Timer progresses through all 4 phases
- [ ] Chakra colors match current phase
- [ ] WebGPU visualization renders (or fallback message shows)
- [ ] Controls (Begin, Pause, Reset) work
- [ ] Strength level changes affect timing
- [ ] Posture figure animates smoothly
- [ ] Responsive layout works on mobile
- [ ] No console errors in browser

## Linting & Code Quality

```bash
npm run lint
```

The project uses ESLint with Next.js config. Fix issues before committing:
```bash
npm run lint -- --fix
```

## Deployment

```bash
npm run build
python deploy.py  # Uses SFTP to deploy to remote server
```

The app is configured as a static export in `next.config.ts`.

## Known Browser Support

- **Chrome/Edge 113+** - Full WebGPU support
- **Safari Technology Preview** - WebGPU available
- **Firefox** - No WebGPU yet
- **Older browsers** - Shows fallback message

## Git Workflow

This project uses feature branches named `claude/[feature]-[session-id]`. When making changes:

```bash
# Ensure you're on the correct branch
git branch

# Make changes, test locally
npm run dev

# Commit with clear messages
git add .
git commit -m "Add feature description"

# Push to remote
git push -u origin claude/add-docs-and-readme-0efb8
```

## Resources

- **AGENTS.md** - Detailed architecture, chakra system, shader internals
- **README.md** - Getting started guide for users
- [Next.js Docs](https://nextjs.org/docs)
- [WebGPU Docs](https://gpuweb.github.io/gpuweb/)
- [Tailwind CSS](https://tailwindcss.com)

## Quick Troubleshooting

**Issue:** WebGPU canvas appears black
- Check browser console for shader errors
- Verify WebGPU support with `navigator.gpu`
- Test with `npm run dev` in development mode

**Issue:** Timer not advancing
- Check if `useSacredBreathTimer` hook is mounted
- Verify `isRunning` state in component
- Check browser console for JavaScript errors

**Issue:** Styling not working
- Clear `.next` directory: `rm -rf .next`
- Rebuild: `npm run build`
- Restart dev server: `npm run dev`

## Questions?

Refer to AGENTS.md for deeper technical details, or check component source code for implementation specifics.
