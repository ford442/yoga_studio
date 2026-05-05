// ============================================================================
// Phase-Based Color Grading System for Breathing Meditation Shader
// Agent 4: Color Science & Grading Specialist
// ============================================================================

// ----------------------------------------------------------------------------
// 1. PALETTE STRUCT AND DEFINITIONS
// ----------------------------------------------------------------------------

struct BreathPalette {
    tint: vec3f,      // Multiplicative color tint
    hueShift: f32,     // Hue rotation in normalized space (-0.1 to +0.1)
    satMod: f32,       // Saturation multiplier
    contrast: f32,     // Contrast adjustment (0.0=flat, 1.0=normal, 2.0=high)
}

// Constant palette definitions for each breathing phase
const PALETTE_INHALE: BreathPalette = BreathPalette(
    vec3f(1.1, 0.95, 0.8),   // Warm golden-violet rise
    0.03,                     // Slight warm hue shift (+)
    1.2,                      // Boosted saturation
    1.0                       // Normal contrast
);

const PALETTE_HOLD1: BreathPalette = BreathPalette(
    vec3f(1.0, 1.0, 1.0),    // Bright steady peak (neutral)
    0.0,                      // No hue shift
    1.1,                      // Slightly boosted saturation
    1.1                       // Slightly higher contrast
);

const PALETTE_EXHALE: BreathPalette = BreathPalette(
    vec3f(0.9, 1.0, 1.05),   // Cooling blue-green release
    -0.05,                    // Cool hue shift (-)
    0.9,                      // Reduced saturation
    1.0                       // Normal contrast
);

const PALETTE_HOLD2: BreathPalette = BreathPalette(
    vec3f(1.0, 1.0, 1.0),    // Neutral soft reset
    0.0,                      // No hue shift
    0.85,                     // Reduced saturation (calming)
    0.95                      // Slightly reduced contrast
);

// Array for indexed access (WGSL doesn't support const arrays directly, 
// so we use a switch or manual indexing)
fn getPalette(phase: u32) -> BreathPalette {
    switch phase {
        case 0u: { return PALETTE_INHALE; }
        case 1u: { return PALETTE_HOLD1; }
        case 2u: { return PALETTE_EXHALE; }
        case 3u: { return PALETTE_HOLD2; }
        default: { return PALETTE_HOLD2; }
    }
}

// ----------------------------------------------------------------------------
// 2. COLOR SPACE UTILITIES (for hue shifting)
// ----------------------------------------------------------------------------

// Convert RGB to HSV color space
fn rgbToHsv(c: vec3f) -> vec3f {
    let K = vec4f(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    let p = mix(vec4f(c.bg, K.wz), vec4f(c.gb, K.xy), step(c.b, c.g));
    let q = mix(vec4f(p.xyw, c.r), vec4f(c.r, p.yzx), step(p.x, c.r));
    
    let d = q.x - min(q.w, q.y);
    let e = 1.0e-10;
    return vec3f(
        abs(q.z + (q.w - q.y) / (6.0 * d + e)),  // H
        d / (q.x + e),                            // S
        q.x                                       // V
    );
}

// Convert HSV to RGB color space
fn hsvToRgb(c: vec3f) -> vec3f {
    let K = vec3f(1.0, 2.0 / 3.0, 1.0 / 3.0);
    let p = abs(fract(c.xxx + K.xyz) * 6.0 - vec3f(3.0));
    return c.z * mix(vec3f(K.x), clamp(p - vec3f(K.x), vec3f(0.0), vec3f(1.0)), c.y);
}

// Apply hue shift to a color
fn applyHueShift(col: vec3f, shift: f32) -> vec3f {
    let hsv = rgbToHsv(col);
    hsv.x = fract(hsv.x + shift);  // Shift hue (wrap around)
    return hsvToRgb(hsv);
}

// ----------------------------------------------------------------------------
// 3. PALETTE BLENDING
// ----------------------------------------------------------------------------

// Linear interpolation between two palettes
fn mixPalettes(a: BreathPalette, b: BreathPalette, t: f32) -> BreathPalette {
    return BreathPalette(
        mix(a.tint, b.tint, t),
        mix(a.hueShift, b.hueShift, t),
        mix(a.satMod, b.satMod, t),
        mix(a.contrast, b.contrast, t)
    );
}

// Get the blended palette for current phase and progress
fn getBlendedPalette(phase: u32, phaseProgress: f32) -> BreathPalette {
    let currentPalette = getPalette(phase);
    let nextPhase = (phase + 1u) % 4u;
    let nextPalette = getPalette(nextPhase);
    
    // Smooth transition using smoothstep for natural feel
    let blendFactor = smoothstep(0.0, 1.0, phaseProgress);
    
    return mixPalettes(currentPalette, nextPalette, blendFactor);
}

// ----------------------------------------------------------------------------
// 4. CONTRAST CURVE
// ----------------------------------------------------------------------------

// Apply contrast adjustment in linear space
// contrast: 0.0 = flat (mid-gray), 1.0 = normal, 2.0 = high contrast
fn applyContrast(col: vec3f, contrast: f32) -> vec3f {
    // Use standard contrast formula: (col - 0.5) * contrast + 0.5
    // When contrast < 1, image becomes flatter
    // When contrast > 1, image becomes more contrasty
    return (col - vec3f(0.5)) * contrast + vec3f(0.5);
}

// ----------------------------------------------------------------------------
// 5. MAIN GRADING FUNCTION
// ----------------------------------------------------------------------------

// Apply complete breathing-based color grade to linear RGB
// NOTE: Must be called BEFORE gamma correction, in linear color space
fn applyBreathGrade(linearCol: vec3f, br: BreathUniforms) -> vec3f {
    var col = linearCol;
    
    // Get the blended palette for current phase
    let palette = getBlendedPalette(br.phase, br.phaseProgress);
    
    // --- Step 1: Apply contrast adjustment (in linear space) ---
    col = applyContrast(col, palette.contrast);
    
    // --- Step 2: Apply saturation modification ---
    // Convert to HSV, modify saturation, convert back
    let hsv = rgbToHsv(col);
    let adjustedSat = clamp(hsv.y * palette.satMod, 0.0, 1.0);
    col = hsvToRgb(vec3f(hsv.x, adjustedSat, hsv.z));
    
    // --- Step 3: Apply hue shift ---
    col = applyHueShift(col, palette.hueShift);
    
    // --- Step 4: Apply multiplicative tint ---
    col = col * palette.tint;
    
    // --- Step 5: Apply strength-based saturation boost ---
    // strengthLevel (0-10) adds subtle saturation: level * 0.02
    let strengthBoost = 1.0 + f32(br.strengthLevel) * 0.02;
    let hsv2 = rgbToHsv(col);
    col = hsvToRgb(vec3f(hsv2.x, clamp(hsv2.y * strengthBoost, 0.0, 1.0), hsv2.z));
    
    // --- Step 6: HDR Safety - clamp before gamma ---
    col = clamp(col, vec3f(0.0), vec3f(2.0));
    
    return col;
}

// ----------------------------------------------------------------------------
// 6. VIGNETTE FUNCTION (intensity-aware)
// ----------------------------------------------------------------------------

// Calculate vignette with intensity scaling
fn applyBreathVignette(uv: vec2f, intensity: f32) -> f32 {
    // Base vignette calculation
    let dist = length(uv);
    let baseVig = pow(1.0 - dist, 2.0);
    
    // Intensity scaling: vignette strength *= (0.8 + 0.4 * intensity)
    // At intensity 0: multiplier = 0.8 (subtle)
    // At intensity 1: multiplier = 1.2 (stronger)
    let vigMultiplier = 0.8 + 0.4 * intensity;
    
    // Apply vignette with intensity modulation
    // Map from [0,1] vignette to [0.5,1.0] range (never fully dark)
    return baseVig * vigMultiplier * 0.5 + 0.5;
}

// ----------------------------------------------------------------------------
// 7. MAINIMAGE INTEGRATION CODE
// ----------------------------------------------------------------------------
/*

REPLACE THE END OF mainImage() WITH THE FOLLOWING:

@fragment
fn mainImage(@builtin(position) fragCoord: vec4f) -> @location(0) vec4f {
    let uv = (fragCoord.xy - vec2f(400.0, 300.0)) / vec2f(600.0, 600.0);
    
    let ro = vec3f(0.0, 0.0, 3.0);
    let rd = normalize(vec3f(uv.x, uv.y, -1.5));
    
    var col = vec3f(0.05, 0.05, 0.1); // Background base
    
    // Add kaleidoscope effect
    col += kalei(ro + rd * 2.0) * 0.3;
    
    // Raymarch
    let res = trace(ro, rd);
    
    if (res.x > 0.0) {
        let p = ro + rd * res.x;
        let n = calcNormal(p);
        col = shade(p, n, res.y, rd);
        
        // Fog
        let fog = 1.0 - exp(-res.x * 0.1);
        col = mix(col, vec3f(0.05, 0.05, 0.1), fog);
    }
    
    // Add chakras
    let chakra_col = chakras(ro + rd * res.x, u_breath.time);
    col += chakra_col;
    
    // Add rings
    let ring_d = rings(ro + rd * 3.0, u_breath.time);
    if (ring_d < 0.1) {
        col += vec3f(0.3, 0.4, 0.5) * smoothstep(0.1, 0.0, ring_d);
    }
    
    // --- PHASE-BASED COLOR GRADING (NEW) ---
    
    // Apply breath-based color grade (in linear space, BEFORE gamma)
    col = applyBreathGrade(col, u_breath);
    
    // Apply intensity-aware vignette
    let vig = applyBreathVignette(uv, u_breath.intensity);
    col *= vig;
    
    // Gamma correction (ALWAYS LAST)
    col = pow(col, vec3f(1.0 / 2.2));
    
    return vec4f(col, 1.0);
}

*/

// ----------------------------------------------------------------------------
// 8. PIPELINE ORDER REFERENCE
// ----------------------------------------------------------------------------
/*
COLOR GRADING PIPELINE ORDER:
===========================

1. RENDER SCENE (raymarch, chakras, rings, etc.)
   ↓
2. APPLY COLOR GRADE (applyBreathGrade)
   - Contrast adjustment
   - Saturation modification
   - Hue shifting
   - Multiplicative tint
   - Strength-based saturation boost
   - HDR clamping (max 2.0)
   ↓
3. APPLY VIGNETTE (applyBreathVignette)
   - Vignette with intensity scaling
   ↓
4. GAMMA CORRECTION (pow(col, 1.0/2.2))
   - ALWAYS LAST
   ↓
5. OUTPUT

CRITICAL RULES:
- All grading happens in LINEAR color space
- Gamma correction must be the FINAL step
- HDR clamp (max 2.0) prevents washout
- Intensity affects vignette strength
- Strength level affects saturation

PHASE COLOR PROGRESSION:
========================
INHALE  (0): Warm golden-violet  → Rising, energizing
HOLD1   (1): Bright steady       → Peak clarity  
EXHALE  (2): Cool blue-green     → Releasing, calming
HOLD2   (3): Neutral soft        → Reset, grounding
*/
