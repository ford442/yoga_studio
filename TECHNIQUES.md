# Techniques Library

Sacred Breath Timer maps each practice session to a **named pranayama technique** with phase timings, chakra emphasis, shader visuals, posture guidance, and optional science context. This document summarizes the collection and how selections drive the app.

## How selection works

When you choose a technique in the **Techniques Library**:

| Layer | What changes |
|-------|----------------|
| **Breath engine** | `inhale` / `hold1` / `exhale` / `hold2` seconds (`useBreathTimer`) |
| **Phase cues** | On-screen guidance text per phase (`technique.phaseCues`) |
| **WebGPU shader** | `shaderPath`, `theme`, `mandalaStyle`, `figurePose`, `chakraFocusIndex`, `strengthLevel`, `geometryDensity`, `interference` |
| **Environment** | Default photographic background (`backgroundId`) when environment override is Auto |
| **Instructor video** | Pose clips follow `figurePose` when the guide layer is enabled |
| **Education** | Sanskrit name, tagline, science benefit, expandable science sheet |

Source of truth: [`app/data/techniques.ts`](app/data/techniques.ts)  
Types: [`app/types/technique.ts`](app/types/technique.ts), [`app/types/sessionMode.ts`](app/types/sessionMode.ts)

## Practice goals

Filter chips in the library map to `technique.goals`:

| Goal | Intent | Example techniques |
|------|--------|-------------------|
| **Calm** | Downshift stress, sleep prep, grounding | Box Breathing, Coherent Breath, Deep Release, Grounding |
| **Focus** | Steady attention, channel balance | Box Breathing, Nadi Shodhana, Prana Flow, Sacred Integration |
| **Energize** | Morning vitality, creative flow | Prana Flow, Sacred Integration |
| **Deep Practice** | Retention, tradition, advanced visualization | Nadi Shodhana, Ujjayi, Lotus Heart, Grounding, Deep Release, Sacred Integration |

Techniques marked `beginnerFriendly: true` show a **Start here** badge when no goal filter is active.

## Technique catalog

### Sama Vṛtti — Box Breathing (`classic-mandala`)

- **Ratio:** 4-4-4-4 · **Chakra:** Ajna (Third Eye) · **Difficulty:** Gentle  
- **Science:** Equal-phase pacing supports HRV and parasympathetic activation.  
- **Visuals:** `sacred-monk.wgsl`, yantra mandala, tadasana figure, temple dawn environment.  
- **Best for:** First sessions, stress recovery, focus.

### Nāḍī Śodhana — Alternate Nostril Foundation (`nadi-shodhana`)

- **Ratio:** 4-4-4-2 · **Chakra:** Sushumna (all channels) · **Difficulty:** Moderate  
- **Science:** Alternate-nostril pacing linked to autonomic balance and attention in yoga research.  
- **Visuals:** Lotus shader, chin mudra seat, zendo environment.  
- **Note:** Timed phases approximate the practice; visualize alternating nostrils each cycle.

### Ujjāyī — Victorious Breath (`ujjayi`)

- **Ratio:** 4-2-6-2 · **Chakra:** Vishuddha (Throat) · **Difficulty:** Moderate  
- **Science:** Throat resonance + extended exhale supports vagal tone.  
- **Visuals:** Lotus shader, seated lotus, twilight sky.

### Hridaya Sama Vṛtti — Heart Coherence (`lotus-heart`)

- **Ratio:** 5-5-5-0 (~6 breaths/min) · **Chakra:** Anahata · **Difficulty:** Gentle  
- **Science:** Coherent breathing near 0.1 Hz entrains heart rhythms.  
- **Visuals:** Lotus bloom, heart-opening pose, mist mandala.

### Mūlādhāra Kumbhaka — Root Grounding (`grounding`)

- **Ratio:** 4-0-6-8 · **Chakra:** Muladhara · **Difficulty:** Moderate  
- **Science:** Long exhale + empty hold supports parasympathetic grounding.  
- **Visuals:** Monk shader, mountain pose, stone wabi environment.

### Prāṇa Vāyu — Prana Flow (`prana-flow`)

- **Ratio:** 4-3-7-2 · **Chakra:** Svadhisthana · **Difficulty:** Moderate  
- **Science:** Asymmetric ratios + movement cues increase interoceptive engagement.  
- **Visuals:** Dynamic ribbons, tai-chi figure, forest shafts.

### Visam Vṛtti · 4-7-8 — Deep Release (`deep-release`)

- **Ratio:** 4-7-8-0 · **Chakra:** Sahasrara · **Difficulty:** Moderate  
- **Science:** Extended retention + long exhale triggers relaxation response.  
- **Visuals:** Lotus shader, chin mudra, twilight sky. Not for driving or high-focus tasks.

### Saṃā Vāyu — Coherent Breathing (`nervous-system-reg`)

- **Ratio:** 4-4-6-0 · **Chakra:** Anahata · **Difficulty:** Gentle  
- **Science:** ~6 breaths/minute among the most replicated HRV protocols.  
- **Visuals:** `yoga-regular.wgsl`, simpler geometry, zendo dawn.

### Sapta Chakra Krama — Sacred Integration (`sacred-ultra`)

- **Ratio:** 4-4-6-2 · **Chakra:** Full column · **Difficulty:** Advanced  
- **Science:** Chakra-coupled breath + visualization deepens sustained attention.  
- **Visuals:** `sacred-ultra.wgsl`, cinematic post-processing, cosmic bokeh. Caps DPR for performance.

## Shader uniform mapping

All active shaders share the 72-byte `Uniforms` buffer documented in [AGENTS.md](./AGENTS.md). Technique fields map as:

- `theme` → color palette (Cosmic / Golden / Ocean / …)
- `mandalaStyle` → lotus / yantra / flower kaleidoscope
- `figurePose` → seated lotus, tadasana, tai-chi, heart-open, chin mudra, warrior, tree
- `chakraFocusIndex` → -1 (none/all) or 0–6 root through crown
- `strengthLevel` → particle/glow density (0.5 light · 1.0 regular · 2.0 strong)
- `geometryDensity` / `interference` → visual complexity and moiré motion

## Adding a new technique

1. Add a `SessionMode` entry to `TECHNIQUES` in `app/data/techniques.ts` with full `technique` metadata.  
2. Choose an existing shader or add a new `.wgsl` under `public/`.  
3. Verify uniform layout matches `WebGPUShader.tsx` if using a new shader file.  
4. Update this document and the goal filter if introducing a new primary benefit.  
5. Run `npm run build` and manually verify phase cues, timing, and WebGPU render.

## References (neutral tone)

Benefit summaries draw on widely cited mechanisms: heart-rate variability entrainment, baroreflex resonance near 0.1 Hz, parasympathetic rebound on extended exhale, and yoga-specific studies on alternate-nostril and slow breathing. The in-app copy stays minimal; practitioners are encouraged to explore classical texts (e.g. *Hatha Yoga Pradipika*) alongside contemporary breath science.
