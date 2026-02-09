# Yoga Studio - Sacred Breath Timer

An AI coding agent guide for this Next.js React application featuring WebGPU-powered breathing visualization.

---

## Project Overview

**Yoga Studio** is a single-page web application that demonstrates modern WebGPU capabilities through an immersive breathing visualization. It renders a pulsing, color-shifting circle using a custom WGSL (WebGPU Shading Language) shader synchronized to a calming breathing rhythm.

### Key Features
- WebGPU hardware-accelerated graphics with custom WGSL shader
- Smooth, rhythmic breathing animation (pulsing circle effect)
- Responsive UI built with Tailwind CSS
- Graceful degradation for browsers without WebGPU support

---

## Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Framework | Next.js | 16.1.6 |
| UI Library | React | 19.2.3 |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | 4.x |
| Graphics API | WebGPU | - |
| Build Output | Static Export | - |

### Important Dependencies

**Runtime:**
- `next` - React framework with App Router
- `react`, `react-dom` - UI library

**Development:**
- `@tailwindcss/postcss` - Tailwind CSS PostCSS plugin (v4 style)
- `@webgpu/types` - TypeScript definitions for WebGPU API
- `eslint`, `eslint-config-next` - Linting

---

## Project Structure

```
.
├── app/                          # Next.js App Router
│   ├── components/
│   │   └── WebGPUShader.tsx      # Main WebGPU visualization component
│   ├── favicon.ico
│   ├── globals.css               # Global styles with Tailwind v4
│   ├── layout.tsx                # Root layout component
│   └── page.tsx                  # Home page (main entry)
├── public/                       # Static assets
│   └── yoga.glsl                 # GLSL shader reference (not used at runtime)
├── deploy.py                     # SFTP deployment script
├── webgpu.d.ts                   # WebGPU type declarations
├── next.config.ts                # Next.js configuration (static export)
├── tsconfig.json                 # TypeScript configuration
├── eslint.config.mjs             # ESLint flat config
└── postcss.config.mjs            # PostCSS with Tailwind v4
```

### Code Organization

**Single-page architecture:** The application has one main page (`app/page.tsx`) that renders the `WebGPUShader` component.

**Component structure:**
- `WebGPUShader` is a client component (`'use client'`) that handles all WebGPU initialization, shader compilation, and rendering loop
- The WGSL shader code is embedded as a string within the component (lines 47-101 in WebGPUShader.tsx)

---

## Build and Development Commands

All commands use npm:

```bash
# Install dependencies
npm install

# Start development server (hot reload)
npm run dev
# → http://localhost:3000

# Build for production (static export)
npm run build
# → Output goes to `out/` directory

# Start production server (requires build first)
npm start

# Run ESLint
npm run lint
```

### Build Configuration

The project is configured for **static export**:

```typescript
// next.config.ts
{
  output: 'export',
  basePath: '/yoga',  // Assets prefixed with /yoga
}
```

This generates a static site in the `out/` directory suitable for deployment to any static hosting.

---

## Code Style Guidelines

### TypeScript Configuration

- **Target:** ES2017
- **Strict mode:** Enabled
- **Module resolution:** bundler
- **Path aliases:** `@/*` maps to `./*`

### Styling Conventions

**Tailwind CSS v4** is used with the new `@import` syntax:

```css
/* globals.css */
@import "tailwindcss";
```

- Utility-first approach with Tailwind classes
- CSS variables for theming in `globals.css`
- Dark mode support via `prefers-color-scheme` media query

### Component Patterns

- Use functional components with TypeScript
- Client components explicitly marked with `'use client'`
- React hooks for state management (no external state library)

### ESLint Rules

Uses `eslint-config-next` with TypeScript support:
- Core web vitals rules enabled
- TypeScript-specific rules enabled
- Ignores: `.next/`, `out/`, `build/`, `next-env.d.ts`

---

## WebGPU Implementation Details

### Browser Compatibility

**Supported browsers:**
- Chrome/Edge 113+ (stable)
- Opera 99+
- Safari Technology Preview

**Detection:** The app checks `navigator.gpu` and displays a fallback UI if WebGPU is unavailable.

### Shader Architecture

The WGSL shader creates a breathing visualization with:
- **Vertex shader:** Simple full-screen triangle strip (4 vertices)
- **Fragment shader:** 
  - Radial gradient with distance-based coloring
  - Sine-wave breathing animation (`sin(time * 0.5)`)
  - Smooth color transitions using hue rotation
  - Glow effect via exponential falloff

### Rendering Pipeline

1. Request GPU adapter and device
2. Configure canvas context with preferred format
3. Create shader module from WGSL code
4. Set up uniform buffer for time variable
5. Create render pipeline with blend modes for transparency
6. Render loop updates time uniform and submits commands

---

## Testing Instructions

**No automated tests are configured** in this project.

### Manual Testing Checklist

1. **WebGPU support detection:**
   - Test in Chrome/Edge 113+ - should show animated circle
   - Test in Firefox/Safari (without WebGPU) - should show "WebGPU Not Supported" message

2. **Visual verification:**
   - Circle should pulse smoothly (expand/contract cycle ~12 seconds)
   - Colors should shift gradually over time
   - Background gradient should be visible

3. **Responsiveness:**
   - Canvas should scale within its container (`max-width: 100%`)
   - Layout should center on all screen sizes

---

## Deployment Process

### Static Export Deployment

The project uses a custom Python deployment script:

```bash
# 1. Build the static site
npm run build

# 2. Deploy via SFTP
python deploy.py
```

**Deploy script details (`deploy.py`):**
- Uploads the `out/` directory via SFTP to `test.1ink.us/yoga`
- Requires `paramiko` library (`pip install paramiko`)
- Uses hardcoded credentials (note: contains plaintext password)
- Recursively creates directories and uploads files

### Manual Deployment

The `out/` directory contains the complete static site:
- Copy contents to any static web server
- Ensure assets are served from `/yoga` base path (configured in `next.config.ts`)

---

## Security Considerations

### Known Issues

**⚠️ Critical:** The `deploy.py` script contains hardcoded plaintext credentials:
- Password is visible in the source code (line 45)
- Should use environment variables or secure credential storage

### Browser Security

- WebGPU requires secure context (HTTPS or localhost)
- Shader code is executed on GPU - malformed shaders could cause GPU hangs
- The shader code in this project is hardcoded (not user-provided), mitigating injection risks

### Build Security

- No sensitive environment variables used in the application
- No API keys or secrets in the client-side code

---

## Common Issues and Solutions

### "WebGPU is not supported" error
- Use Chrome/Edge 113+ or enable WebGPU flags in browser
- Ensure HTTPS or localhost for secure context

### Build fails with "out directory not found"
- Run `npm run build` before `deploy.py`
- The deploy script expects the `out/` directory to exist

### Shader compilation errors
- Check browser console for WGSL syntax errors
- WebGPU shader compilation errors are logged to console by the browser

---

## File Reference

| File | Purpose |
|------|---------|
| `app/components/WebGPUShader.tsx` | Main WebGPU component with embedded WGSL shader |
| `app/page.tsx` | Home page with layout and title |
| `app/layout.tsx` | Root layout with metadata |
| `app/globals.css` | Tailwind v4 styles |
| `next.config.ts` | Static export configuration |
| `webgpu.d.ts` | WebGPU TypeScript types |
| `deploy.py` | SFTP deployment script |
