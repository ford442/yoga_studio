# Yoga Studio - Sacred Breath Timer

An AI coding agent guide for this Next.js React application featuring WebGPU-powered breathing visualization with yoga posture guidance and chakra awareness.

---

## Project Overview

**Yoga Studio** is a comprehensive yoga sadhana (spiritual practice) tool that combines:
- Precise breath timing with 4-phase pranayama cycles
- Visual posture guidance with animated stick figures
- Chakra awareness synchronized to breath phases
- WebGPU-powered visualization with energy channel graphics

The application transforms a simple breath timer into a complete practice guide suitable for Kundalini, Hatha, and standing breathwork traditions.

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

---

## Project Structure

```
.
├── app/                          # Next.js App Router
│   ├── components/
│   │   ├── WebGPUShader.tsx      # WebGPU visualization with chakra highlighting
│   │   ├── BreathTimer.tsx       # Timer UI with chakra display
│   │   └── PostureGuide.tsx      # SVG stick figure posture guide
│   ├── hooks/
│   │   └── useBreathTimer.ts     # Breath timing + chakra mapping logic
│   ├── favicon.ico
│   ├── globals.css               # Global styles with Tailwind v4
│   ├── layout.tsx                # Root layout component
│   └── page.tsx                  # Home page with all components
├── public/                       # Static assets
│   ├── yoga.glsl                 # Original GLSL shader reference
│   ├── yoga-regular.wgsl         # WGSL shader reference
│   └── yoga-fixed.wgsl           # Fixed WGSL shader reference
├── deploy.py                     # SFTP deployment script
├── webgpu.d.ts                   # WebGPU type declarations
├── next.config.ts                # Next.js configuration (static export)
├── tsconfig.json                 # TypeScript configuration
├── eslint.config.mjs             # ESLint flat config
└── postcss.config.mjs            # PostCSS with Tailwind v4
```

---

## Breath Timing System

### 4-Phase Pranayama Cycle

```
┌──────────────┬──────────────┬──────────────┬──────────────┐
│   INHALE     │  HOLD IN     │   EXHALE     │  HOLD OUT    │
│   (0-25%)    │   (25-50%)   │   (50-75%)   │   (75-100%)  │
├──────────────┼──────────────┼──────────────┼──────────────┤
│ Breath in    │ Hold breath  │ Breath out   │ Hold empty   │
│ Raise arms   │ Flex/Engage  │ Lower arms   │ Relax        │
│ Anahata      │ Manipura     │ Muladhara    │ Sahasrara    │
│ (Heart)      │ (Solar Plex) │ (Root)       │ (Crown)      │
│ Cyan         │ Yellow       │ Purple       │ Green        │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

### Strength Levels

| Level | Initial | After 16 cycles | After 31 cycles | After 61 cycles |
|-------|---------|-----------------|-----------------|-----------------|
| Light | 5s | 7s | - | - |
| Medium | 7s | 8s | - | - |
| Strong | 7s | 8s | 10s | - |

---

## Chakra System

### The Seven Chakras

| # | Name | Sanskrit | Color | Location | Element | Phase Association |
|---|------|----------|-------|----------|---------|-------------------|
| 1 | Muladhara | मूलाधार | Red (#ef4444) | Base of spine | Earth | Exhale (grounding) |
| 2 | Svadhisthana | स्वाधिष्ठान | Orange (#f97316) | Lower abdomen | Water | - |
| 3 | Manipura | मणिपूर | Yellow (#eab308) | Solar plexus | Fire | Hold-in (power) |
| 4 | Anahata | अनाहत | Green (#22c55e) | Heart center | Air | Inhale (opening) |
| 5 | Vishuddha | विशुद्ध | Cyan (#06b6d4) | Throat | Ether | Inhale secondary |
| 6 | Ajna | आज्ञा | Indigo (#6366f1) | Between eyebrows | Light | - |
| 7 | Sahasrara | सहस्रार | Violet (#a855f7) | Crown of head | Cosmic | Hold-out (liberation) |

### Phase-Chakra Mapping

```typescript
PHASE_CHAKRAS: Record<BreathPhase, { primary: ChakraName; secondary?: ChakraName; significance: string }>

inhale:   { primary: 'Anahata', secondary: 'Vishuddha', significance: 'Opening the heart, receiving prana' }
hold-in:  { primary: 'Manipura', significance: 'Building internal fire, charging solar plexus' }
exhale:   { primary: 'Muladhara', significance: 'Grounding, releasing into earth element' }
hold-out: { primary: 'Sahasrara', significance: 'Open to cosmic consciousness, shunya (void)' }
```

---

## Yoga Knowledge Integration

### Posture Guide (PostureGuide.tsx)

**Animated SVG stick figures** display for each breath phase:
- **Inhale**: Arms rising overhead (Urdhva Hastasana)
- **Hold-in**: Arms extended with subtle tension, core engaged
- **Exhale**: Arms gracefully lowering
- **Hold-out**: Neutral standing (Tadasana), complete relaxation

**Features:**
- Phase-appropriate arm positions with CSS animations
- Chakra indicators along the spine (7 glowing dots)
- Active chakra pulse animation
- Sanskrit names and detailed instructions
- Bandha (energy lock) guidance
- Drishti (gaze) recommendations

### Educational Content

The bottom section provides:
1. **Practice Guidelines** - Step-by-step instructions
2. **Pranayama Wisdom** - Concepts explained:
   - Kumbhaka (breath retention)
   - Bandhas (Mula, Uddiyana, Jalandhara)
   - Nadis (Ida, Pingala, Sushumna)
3. **Current Phase Info** - Real-time context for the active phase

---

## WebGPU Shader Architecture

### Uniform Buffer (32 bytes)

```wgsl
struct Uniforms {
  resolution: vec2<f32>,      // Canvas size
  time: f32,                  // Continuous animation time
  breathProgress: f32,        // 0.0-1.0 within breath cycle
  breathPhase: f32,           // 0=inhale, 1=hold-in, 2=exhale, 3=hold-out
  cycleNumber: f32,           // Current breath cycle
  isRunning: f32,             // 1.0 running, 0.0 paused
  activeChakra: f32,          // 0-6 representing the 7 chakras
  secondaryChakra: f32,       // -1 if none, otherwise 0-6
};
```

### Visual Features

1. **Kaleidoscope Pattern** - Animated raymarched geometry
2. **Breath Synchronization** - Pattern scales/pulses with breathProgress
3. **Phase Colors** - Cyan/Yellow/Purple/Green based on breathPhase
4. **Chakra Visualization** - All 7 chakras displayed along central channel (sushumna)
   - Active chakra glows brightly with pulse animation
   - Secondary chakra shows moderate glow
   - Inactive chakras show subtle base glow
5. **Breath Ring Overlay** - Expanding/contracting ring showing breath state

### Chakra Colors in Shader

```wgsl
// 0=Root(red), 1=Sacral(orange), 2=Solar(yellow), 3=Heart(green)
// 4=Throat(cyan), 5=ThirdEye(indigo), 6=Crown(violet)
fn getChakraColor(chakraIndex: f32) -> vec3<f32> {
  if (chakraIndex < 0.5) { return vec3<f32>(0.93, 0.27, 0.27); }  // Red
  if (chakraIndex < 1.5) { return vec3<f32>(0.98, 0.45, 0.09); }  // Orange
  if (chakraIndex < 2.5) { return vec3<f32>(0.92, 0.72, 0.03); }  // Yellow
  if (chakraIndex < 3.5) { return vec3<f32>(0.13, 0.77, 0.37); }  // Green
  if (chakraIndex < 4.5) { return vec3<f32>(0.02, 0.71, 0.83); }  // Cyan
  if (chakraIndex < 5.5) { return vec3<f32>(0.39, 0.40, 0.95); }  // Indigo
  return vec3<f32>(0.66, 0.33, 0.97);                             // Violet
}
```

---

## Build and Development Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev
# → http://localhost:3000

# Build for production
npm run build
# → Output goes to `out/` directory

# Start production server
npm start

# Run ESLint
npm run lint
```

---

## Code Style Guidelines

### TypeScript Configuration

- **Target:** ES2017
- **Strict mode:** Enabled
- **Module resolution:** bundler
- **Path aliases:** `@/*` maps to `./*`

### Component Patterns

- Functional components with TypeScript
- Client components marked with `'use client'`
- Custom hooks for complex logic (useBreathTimer)
- Props interfaces defined inline

### Tailwind CSS v4

```css
/* globals.css */
@import "tailwindcss";
```

- Utility-first approach
- Glassmorphism effects: `backdrop-blur`, `bg-white/10`
- Chakra colors mapped to Tailwind classes

---

## Testing Checklist

### Manual Testing

1. **Breath Timer**
   - [ ] Timer starts automatically
   - [ ] Phases progress correctly
   - [ ] Cycle count increments
   - [ ] Pause/Resume works
   - [ ] Reset returns to cycle 0

2. **Posture Guide**
   - [ ] Stick figure changes pose per phase
   - [ ] Chakra glows pulse on active chakra
   - [ ] Sanskrit names display correctly
   - [ ] Bandha/drishti info updates per phase

3. **Chakra Display**
   - [ ] Active chakra color matches phase
   - [ ] Secondary chakra shows when applicable
   - [ ] Chakra significance text updates

4. **WebGPU Shader**
   - [ ] Chakra visualization renders
   - [ ] Active chakra glows brighter
   - [ ] Colors shift with breath phases
   - [ ] Fallback message shows in non-WebGPU browsers

5. **Educational Content**
   - [ ] All three info cards display
   - [ ] Current phase info updates in real-time
   - [ ] Responsive layout works on mobile

---

## Deployment Process

```bash
# Build the static site
npm run build

# Deploy via SFTP
python deploy.py
```

The `out/` directory contains the complete static site ready for any static hosting.

---

## Architecture Decisions

### Why Separate Yoga Logic from Shader?

**Original approach:** All text and posture info rendered in shader
**New approach:** React manages yoga knowledge, shader focuses on visuals

**Benefits:**
- Easier to update yoga content without shader recompilation
- Better accessibility (screen readers can access text)
- More flexible UI (CSS animations, responsive design)
- Better performance (shader does less work)

### Why SVG Stick Figures?

- **Lightweight** - No external image assets
- **Scalable** - Looks crisp at any size
- **Animatable** - CSS animations for arm movements
- **Accessible** - Semantic SVG elements
- **Sacred aesthetic** - Minimalist line drawings match yoga tradition

### Chakra Phase Mapping Rationale

| Phase | Chakra | Rationale |
|-------|--------|-----------|
| Inhale | Anahata (Heart) | Opening to receive, compassion |
| Hold-in | Manipura (Solar Plexus) | Building power, transformation |
| Exhale | Muladhara (Root) | Grounding, releasing to earth |
| Hold-out | Sahasrara (Crown) | Connection to cosmic consciousness |

---

## File Reference

| File | Purpose |
|------|---------|
| `app/hooks/useBreathTimer.ts` | Breath timing + chakra mapping |
| `app/components/WebGPUShader.tsx` | WebGPU with chakra visualization |
| `app/components/BreathTimer.tsx` | Timer UI with chakra display |
| `app/components/PostureGuide.tsx` | SVG posture guide with stick figures |
| `app/page.tsx` | Main page integrating all components |
| `app/layout.tsx` | Root layout with metadata |
| `app/globals.css` | Tailwind v4 styles |

---

## Future Enhancements

Potential features to consider:

1. **Audio cues** - "So Hum" mantra or bell sounds per phase
2. **Progress tracking** - Session history, statistics
3. **More pranayama types** - Nadi Shodhana, Kapalabhati, etc.
4. **Seated variations** - Postures for chair practice
5. **Meditation timer** - Silent practice after breathwork
6. **Export/Share** - Session summaries

---

## Sacred Practice Notes

This tool is designed as a **sadhana support** - a digital companion for traditional yoga practice. Key principles:

- **Respect the tradition** - Accurate Sanskrit, proper technique descriptions
- **Embodied practice** - Visual posture guidance, not just breath timing
- **Energy awareness** - Chakra visualization for subtle body experience
- **Progressive approach** - Three levels matching traditional pranayama progression

The goal is to support practitioners in developing a consistent, informed, and deeply felt pranayama practice.
