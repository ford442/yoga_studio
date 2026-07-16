# Yoga Breath Shader - Refactoring Summary

## Overview
Complete refactoring of `yoga-regular.wgsl` from a minified 120KB text-heavy shader to a clean, breath-driven sacred geometry visualization.

---

## Task 1: Foundation Cleanup + BreathUniforms Integration

### Added
```wgsl
struct BreathUniforms {
  time: f32,
  phase: u32,           // 0=inhale, 1=hold1, 2=exhale, 3=hold2
  phaseProgress: f32,   // 0.0-1.0 within current phase
  cycle: u32,
  strengthLevel: u32,   // 0=light, 1=medium, 2=strong
  intensity: f32,       // 0.0-1.0 breath intensity
};
@group(0) @binding(0) var<uniform> u_breath: BreathUniforms;
```

### Removed (Completely)
- **All text/glyph code**: `char_numbers`, `char_dash`, `char_period`
- **Alphabet functions**: `aa_vf2_` through `semicolon` (26+ glyph functions)
- **Number rendering**: `number_f1_i1_f1_vf2_vf2_`, `glyph_vu4_f1_vf2_vf2_`
- **Text system**: `text_vf3_`, `fField_vf3_`
- **Cycle/strength logic**: `getCurrentCycle_()`, `updateStrength_()`
- **Old uniforms**: `iTime`, `iFrame`, `iResolution` (replaced with `u_breath.time`)
- **Private vars**: `cycless`, `scycles`, `strengthLevel`, `cycle_1`, etc.

### What Stayed
- Video texture support (`videoSampler`, `videoOUT`)
- Core SDF functions (`sdPill`, `opSmoothUnion`, `opSmoothIntersection`)
- Math utilities (`rot2`, `moda`, `pmod`)

---

## Task 2: Breath-Driven Figure & Arm Animation

### New Functions
```wgsl
fn getArmAngle() -> f32
fn getBreathScale() -> vec2<f32>
```

### Animation Details

| Phase | Arm Movement | Chest/Shoulder |
|-------|-------------|----------------|
| **Inhale (0)** | Arms rise smoothly overhead (0→π) using easeOutCubic | Chest expands +8% |
| **Hold1 (1)** | Arms stay high with subtle flex pulse (sin wave) | Sustained expansion with micro-pulse |
| **Exhale (2)** | Arms lower gracefully (π→0) using easeInQuad | Chest contracts back to normal |
| **Hold2 (3)** | Arms relaxed at sides | Normal scale |

### Implementation
- Uses `rot2()` matrix for arm segment rotation
- Outward sweep during inhale for natural feel
- Intensity modulation for subtle vs strong practice
- Strength level affects animation amplitude

---

## Task 3: Enhanced Chakra Column + Energy Flow

### New Features

#### Wave-Like Propagation
```
Inhale:  Lower chakras brighten first, wave travels upward
Hold1:   Sustained glow across all chakras
Exhale:  Upper chakras release, wave travels downward
Hold2:   Soft reset, all chakras dim
```

#### Phase-Specific Chakra Activation
| Phase | Primary Chakra | Color Theme |
|-------|---------------|-------------|
| Inhale | Heart (Anahata) + Throat (Vishuddha) | Green/Cyan |
| Hold1 | Solar Plexus (Manipura) | Yellow |
| Exhale | Root (Muladhara) | Red |
| Hold2 | Crown (Sahasrara) | Violet |

#### Energy Flow Visualization
- Upward flow glow during inhale
- Central sushumna (energy channel) glow
- Color harmony: warm golden on inhale, cool indigo on exhale
- All brightness multiplied by `u_breath.intensity`

### Chakra Colors
```wgsl
0: Muladhara    - Red (#ef4444)
1: Svadhisthana - Orange (#f97316)
2: Manipura     - Yellow (#eab308)
3: Anahata      - Green (#22c55e)
4: Vishuddha    - Cyan (#06b6d4)
5: Ajna         - Indigo (#6366f1)
6: Sahasrara    - Violet (#a855f7)
```

---

## Task 4: Breathing Rings, Mesh & Video Reactivity

### New Function
```wgsl
fn getBreathExpansion(layerIndex: i32) -> f32
```

### Sacred Geometry Layers
1. **Outer Ring** - Blue tint, primary breath expansion
2. **Hex Ring** - Purple, kaleidoscopic rotation
3. **Inner Ring** - Green, secondary expansion
4. **Triangle Ring** - Orange, counter-rotation
5. **Center Ring** - White/gold, micro-oscillation during holds

### Expansion Behavior
- **Inhale**: Rings expand outward (0% → 30%)
- **Hold1**: Sustained with micro-oscillation (4Hz)
- **Exhale**: Contract inward (30% → 0%)
- **Hold2**: Subtle rest position

### Video Reactivity
```wgsl
fn sampleVideo(uv: vec2<f32>) -> vec3<f32>
```
- Brightness pulses with breath phases (+10% on inhale/hold1)
- Saturation modulated by intensity (+20% max)
- Micro-oscillation during hold phases
- Mixed at 30% opacity based on intensity

### Performance Optimizations
- 5 ring layers (mobile-friendly)
- Simple SDF operations only
- No heavy raymarching in rings
- Video sampling at reduced blend factor

---

## Task 5: Color Grading, Intensity & Final Polish

### New Function
```wgsl
fn getBreathColorGrade(col: vec3<f32>) -> vec3<f32>
```

### 4-Phase Color Tints

| Phase | Tint | Saturation | Contrast |
|-------|------|------------|----------|
| **Inhale** | Warm golden (1.0, 0.8, 0.4) | +10% | +5% |
| **Hold1** | Peak glow (1.0, 0.9, 0.6) | +10% | +5% |
| **Exhale** | Cool indigo (0.4, 0.5, 0.9) | -5% | +5% |
| **Hold2** | Soft reset (0.7, 0.8, 0.7) | -5% | 0% |

### Grading Pipeline
1. **Phase tint blending** - Smooth interpolation via phaseProgress
2. **Intensity boost** - Up to +30% brightness
3. **Strength scaling** - Saturation/contrast based on strengthLevel
4. **Contrast curve** - Lift shadows for sacred glow
5. **Saturation adjust** - Grayscale mix based on phase
6. **Vignette** - Soft edge darkening (50% falloff)
7. **Gamma** - 0.85 curve for gentle highlights

### Extra Polish
- Background gradient shifts with phases
- Figure inherits phase tint colors
- Smooth transitions between all states
- Mobile-optimized performance

---

## File Size Comparison

| Version | Size | Change |
|---------|------|--------|
| Original (minified) | ~120 KB | - |
| **New (clean)** | **~22 KB** | **-82%** |

---

## Integration Notes

### Binding Layout
```
@group(0) @binding(0) - BreathUniforms
@group(0) @binding(1) - videoSampler
@group(0) @binding(2) - videoOUT
```

### JavaScript Update Pattern
```typescript
const breathUniforms = new Float32Array([
  time,           // f32
  phase,          // u32 (padded to 4 bytes)
  phaseProgress,  // f32
  cycle,          // u32 (padded)
  strengthLevel,  // u32 (padded)
  intensity,      // f32
]);
device.queue.writeBuffer(uniformBuffer, 0, breathUniforms);
```

---

## Sacred Practice Integration

The shader now serves as a complete **sadhana support tool**:

1. **Visual Breath Guide** - Figure arms mirror practitioner's movements
2. **Chakra Awareness** - Active chakra glows correspond to breath phase
3. **Sacred Geometry** - Mandala-like rings for focus
4. **Energy Visualization** - Upward/downward flow synchronized to prana
5. **Atmospheric Immersion** - Color grading creates mood for each phase

---

## Testing Checklist

- [ ] All 4 phases render correctly
- [ ] Arms animate through full range (down → up → down)
- [ ] Chakras pulse in sequence during inhale/exhale
- [ ] Rings expand/contract with breath
- [ ] Video brightness pulses with intensity
- [ ] Color grading shifts smoothly between phases
- [ ] No text/glyph artifacts present
- [ ] 60fps on mobile devices
