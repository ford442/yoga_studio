// ============================================================
// SACRED LOTUS + PRANA RIBBONS — Refined Integrated Composition
// ============================================================
// A complete drop-in replacement for sacred-monk.wgsl
// Compatible with yoga_studio's WebGPUShader.tsx (same Uniforms)
//
// Composition (back to front):
//   1. Background atmosphere  — nebula, stars, floating geometry,
//                               soft emanation rays
//   2. Volumetric light shafts — sharper divine beams
//   3. Energy ribbons (prana) — flowing, weaving toroidal streams
//   4. Lotus + sacred symbol  — hero focal element
//   5. Global breath aura     — unified radial glow
//   6. Exhale release wave    — subtle traveling ripple
//   7. Atmospheric haze       — depth + cohesion
//   8. Theme color grade      — Cosmic / Golden / Ocean
//   9. Vignette + tone map    — cinematic focus
//
// The ribbons render *behind* the lotus so translucent petals
// catch their glow, creating elegant depth and interweaving.
//
// ------------------------------------------------------------
// WHAT CHANGED IN THIS REVISION (high-signal summary)
// ------------------------------------------------------------
//  * Petals: leaf-profile half-width (sin curve) instead of a flat
//    wedge -> naturally pointed tips & rounded bases. Per-petal hash
//    variation in length/width/hue, central + lateral veins, a
//    subsurface translucency gradient, crisp rim light, and a faked
//    top-down light direction for genuine 3D layering.
//  * Symbol: a brighter radiant core with caustic shimmer, a slowly
//    counter-rotating tri-seed mandala, and a breath-synced pulse so
//    it feels alive and intentional rather than a static ring stack.
//  * Ribbons: FBM domain-warp + a weaving radial offset (front/back
//    depth), thickness that varies along arc length, a bright inner
//    filament inside a soft glow halo -> reads as fluid light, not a
//    dashed band.
//  * Post: ACES-ish tone curve, gentler bloom-style highlight bleed,
//    tighter color harmony. Shared TAU/PI/smoother helpers.
//
// ARCHITECTURE NOTE: every element is driven by `expand` (0..1 breath
// openness) so adding a new layer just means authoring one function
// that takes (uv, t, expand, intensity) and adding one line in main().
// ============================================================

const PI: f32 = 3.14159265359;
const TAU: f32 = 6.28318530718;
const CHAKRA = array<vec3<f32>, 7>(
    vec3<f32>(0.90, 0.12, 0.18),
    vec3<f32>(0.98, 0.45, 0.12),
    vec3<f32>(0.98, 0.85, 0.20),
    vec3<f32>(0.25, 0.85, 0.45),
    vec3<f32>(0.20, 0.55, 0.95),
    vec3<f32>(0.35, 0.25, 0.80),
    vec3<f32>(0.65, 0.30, 0.90),
);

struct Uniforms {
    time: f32,
    breathPhase: f32,
    intensity: f32,
    chakraPhase: f32,
    theme: f32,
    mandalaStyle: f32,
    phaseProgress: f32,      // 0..1 progress within the current breath phase
    strengthLevel: f32,      // 0.0=light, 1.0=regular, 2.0=strong
    mouse: vec2<f32>,        // -1..1 or (-2,-2) = inactive
    mouseStrength: f32,      // 0..1 touch strength
    chakraFocus: f32,        // -1=none, 0..6=root..crown (repurposed padding0)
    resolution: vec2<f32>,
    geometryDensity: f32,    // detail multiplier for geometry/petals/ring counts
    interference: f32,       // moire / recursive layer motion strength
    figurePose: f32,         // 0=lotus, 1=tadasana, 2=tai-chi, 3=heart-open, 4=chinmudra, 5=warrior, 6=tree
    qualityPreset: f32,      // 0.0=mobile, 1.0=high
}

@group(0) @binding(0) var<uniform> u: Uniforms;

@vertex
fn vs(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4<f32> {
    let pos = array<vec2<f32>, 6>(
        vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(-1.0, 1.0),
        vec2<f32>(-1.0, 1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0)
    );
    return vec4<f32>(pos[vertexIndex], 0.0, 1.0);
}

// =================================================================
// MATH HELPERS
// =================================================================

fn pmod(a: f32, b: f32) -> f32 {
    return a - floor(a / b) * b;
}

fn rot2(a: f32) -> mat2x2<f32> {
    let c = cos(a);
    let s = sin(a);
    return mat2x2<f32>(c, -s, s, c);
}

// Quintic smoothstep — C2 continuous, no derivative seams in glows.
fn smoother(e0: f32, e1: f32, x: f32) -> f32 {
    let t = clamp((x - e0) / (e1 - e0), 0.0, 1.0);
    return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

fn hash21(p: vec2<f32>) -> f32 {
    let n = fract(dot(p, vec2<f32>(127.1, 311.7)));
    return fract(n * 43758.5453123);
}

fn hash22(p: vec2<f32>) -> vec2<f32> {
    let k = vec2<f32>(
        dot(p, vec2<f32>(127.1, 311.7)),
        dot(p, vec2<f32>(269.5, 183.3))
    );
    return fract(sin(k) * 43758.5453123);
}

fn chakraFocusTint() -> vec3<f32> {
    if (u.chakraFocus < 0.0) {
        return vec3<f32>(0.58, 0.48, 0.88);
    }
    let idx = i32(clamp(u.chakraFocus, 0.0, 6.0));
    return CHAKRA[idx];
}

// Slow background clock — previously a uniform, now derived so the slot can
// be used for geometryDensity/interference.
fn fieldTime() -> f32 {
    return u.time * 0.37;
}

// =================================================================
// NOISE
// =================================================================

fn noise2(p: vec2<f32>) -> f32 {
    let i = floor(p);
    let f = fract(p);
    let u = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(hash21(i + vec2<f32>(0.0, 0.0)), hash21(i + vec2<f32>(1.0, 0.0)), u.x),
        mix(hash21(i + vec2<f32>(0.0, 1.0)), hash21(i + vec2<f32>(1.0, 1.0)), u.x),
        u.y
    );
}

fn fbm2(p: vec2<f32>, t: f32) -> f32 {
    var sum = 0.0;
    var amp = 0.5;
    var freq = 1.0;
    for (var i = 0; i < 3; i = i + 1) {
        let fi = f32(i);
        sum += amp * noise2(p * freq + t * 0.2 * fi);
        amp *= 0.5;
        freq *= 2.3;
    }
    return sum;
}

const GOLDEN_ANGLE: f32 = 2.39996323;

// -----------------------------------------------------------------
// Micro-geometry helpers: fine dot lattices, vesica chains, seeds
// -----------------------------------------------------------------
fn dotLattice(uv: vec2<f32>, t: f32, density: f32) -> vec3<f32> {
    let r = length(uv);
    var col = vec3<f32>(0.0);
    let ringCount = i32(clamp(3.0 + density * 4.0, 3.0, 9.0));
    let dotCountBase = 8.0 + density * 12.0;
    for (var i = 0; i < ringCount; i = i + 1) {
        let fi = f32(i);
        let rr = 0.05 + fi * 0.045 * (1.0 + density * 0.15);
        let band = exp(-abs(r - rr) * 40.0);
        let dots = i32(clamp(dotCountBase + fi * 4.0, 4.0, 36.0));
        for (var d = 0; d < dots; d = d + 1) {
            let fd = f32(d);
            let ang = fd * TAU / f32(dots) + t * 0.15 * (1.0 + fi * 0.25);
            let p = vec2<f32>(cos(ang), sin(ang)) * rr;
            let dd = length(uv - p) - 0.0045 * (1.0 + density * 0.25);
            let glow = exp(-abs(dd) * 150.0);
            let c = 0.6 + 0.4 * cos(vec3<f32>(0.0, 2.0, 4.0) + fd * 0.35 + fi * 0.5);
            col += glow * c * 0.10 * band;
        }
    }
    return col;
}

fn vesicaPiscisChain(uv: vec2<f32>, center: vec2<f32>, n: f32, radius: f32, t: f32, density: f32) -> vec3<f32> {
    var col = vec3<f32>(0.0);
    let count = i32(clamp(n * density, 3.0, 20.0));
    for (var i = 0; i < count; i = i + 1) {
        let fi = f32(i);
        let a = fi * TAU / f32(count) + t * 0.25;
        let r = radius * (0.85 + 0.15 * sin(t + fi));
        let c1 = center + vec2<f32>(cos(a), sin(a)) * r;
        let c2 = center + vec2<f32>(cos(a + TAU / f32(count) * 0.5), sin(a + TAU / f32(count) * 0.5)) * r * 0.7;
        let d1 = length(uv - c1) - 0.014 * density;
        let d2 = length(uv - c2) - 0.014 * density;
        let vesica = abs(max(d1, d2));
        col += exp(-vesica * 80.0) * vec3<f32>(1.0, 0.92, 0.72) * 0.11;
    }
    return col;
}

fn goldenSeedField(uv: vec2<f32>, center: vec2<f32>, count: i32, t: f32, density: f32) -> vec3<f32> {
    var col = vec3<f32>(0.0);
    let n = clamp(count + i32(density * 18.0), 6, 48);
    for (var i = 0; i < n; i = i + 1) {
        let fi = f32(i);
        let r = 0.015 + sqrt(fi) * 0.014 * density;
        let a = fi * GOLDEN_ANGLE + t * 0.25;
        let p = center + vec2<f32>(cos(a), sin(a)) * r;
        let d = length(uv - p) - 0.003 * (1.0 + density * 0.3);
        let glow = exp(-abs(d) * 180.0);
        let c = 0.6 + 0.4 * cos(vec3<f32>(0.0, 2.0, 4.0) + fi * 0.25);
        col += glow * c * 0.14;
    }
    return col;
}

// =================================================================
// BREATH HELPERS
// =================================================================

// Layered, slowly-drifting oscillator used in place of bare sin(t * f).
// The frequency itself wanders on a slow secondary cycle (seeded per-caller)
// so independent layers never lock into the same rhythm — this is what
// keeps the piece feeling like living tissue rather than a clockwork loop.
fn organicPulse(t: f32, baseFreq: f32, seed: f32) -> f32 {
    let drift = sin(t * 0.05 + seed) * cos(t * 0.033 + seed * 1.7);
    let f = baseFreq * (1.0 + drift * 0.18);
    return 0.5 + 0.5 * sin(t * f + sin(t * f * 0.31 + seed) * 0.6);
}

// Derive a smooth 0..1 "expand" factor from the 4-phase breath cycle,
// shaped to read like a chest/lung filling and releasing rather than a
// linear UI slider: slow to start, accelerating through the middle,
// easing near full; quick initial release on exhale, gentle settle at
// the bottom; and a faint stirring during holds rather than dead stillness.
// 0 = resting/closed, 1 = fully open/peak.
fn deriveBreathExpand(breath: f32, chakraPhase: f32) -> f32 {
    // Use the accurate per-phase progress supplied by the JS timer.
    var pp = clamp(u.phaseProgress, 0.0, 1.0);

    var expand = 0.0;
    if (chakraPhase < 0.5) {
        // inhale: cubic ease blended toward sqrt to lift the early curve —
        // the chest "catches" sooner and glides into the peak.
        let eased = pp * pp * (3.0 - 2.0 * pp);
        expand = mix(eased, sqrt(eased), 0.35);
    } else if (chakraPhase < 1.5) {
        // hold (full): not flat — a faint shimmer of fullness breathing in place.
        expand = 1.0 - 0.015 * (1.0 - sin(u.time * 0.9));
    } else if (chakraPhase < 2.5) {
        // exhale: faster initial release, long gentle settle at the tail.
        let e = 1.0 - pp;
        expand = pow(e, 1.35);
    } else {
        // hold (empty): resting state still stirs faintly with ambient life.
        expand = 0.04 + 0.04 * sin(u.time * 0.6);
    }
    return clamp(expand, 0.0, 1.0);
}

