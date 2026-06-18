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
    let idx = u32(clamp(u.chakraFocus, 0.0, 6.0));
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
    for (var i = 0; i < 3; i++) {
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
    for (var i = 0; i < ringCount; i++) {
        let fi = f32(i);
        let rr = 0.05 + fi * 0.045 * (1.0 + density * 0.15);
        let band = exp(-abs(r - rr) * 40.0);
        let dots = i32(clamp(dotCountBase + fi * 4.0, 4.0, 36.0));
        for (var d = 0; d < dots; d++) {
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
    for (var i = 0; i < count; i++) {
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
    for (var i = 0; i < n; i++) {
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

// =================================================================
// BACKGROUND ATMOSPHERE
// =================================================================

fn twinkleStars(uv: vec2<f32>, t: f32, breath: f32, expand: f32) -> vec3<f32> {
    var col = vec3<f32>(0.0);

    // Star colors shift slightly warmer during inhale for cohesion
    let starWarmth = 1.0 + expand * 0.15;

    // Layer 1 — distant, sparse, slow twinkle
    let s1 = hash21(floor(uv * 42.0) + 100.0);
    let tw1 = sin(t * 0.7 + s1 * 6.283185) * 0.5 + 0.5;
    col += vec3<f32>(0.60, 0.62, 0.88) * starWarmth * smoothstep(0.982, 1.0, s1) * tw1 * 0.45;

    // Layer 2 — medium density, medium twinkle
    let s2 = hash21(floor(uv * 78.0) + 200.0);
    let tw2 = sin(t * 1.2 + s2 * 6.283185) * 0.5 + 0.5;
    col += vec3<f32>(0.68, 0.66, 0.92) * starWarmth * smoothstep(0.990, 1.0, s2) * tw2 * 0.32;

    // Layer 3 — close, very sparse, fast twinkle
    let s3 = hash21(floor(uv * 130.0) + 300.0);
    let tw3 = sin(t * 1.9 + s3 * 6.283185) * 0.5 + 0.5;
    col += vec3<f32>(0.78, 0.72, 0.95) * starWarmth * smoothstep(0.994, 1.0, s3) * tw3 * 0.20;

    // Gentle breath-reactive brightening
    col *= (0.8 + expand * 0.22);
    return col;
}

fn nebulaDust(uv: vec2<f32>, t: f32, breath: f32, expand: f32) -> vec3<f32> {
    let r = length(uv);
    var col = vec3<f32>(0.0);

    // Large-scale nebula clouds using low-frequency FBM
    let n1 = fbm2(uv * 0.7 + vec2<f32>(t * 0.015, t * 0.012), t * 0.08);
    let n2 = fbm2(uv * 1.0 + vec2<f32>(-t * 0.012, t * 0.008), t * 0.06);
    let n3 = fbm2(uv * 1.6 + vec2<f32>(t * 0.010, -t * 0.015), t * 0.05);

    // Deep violet inner nebula — harmonizes with lotus center
    col += vec3<f32>(0.012, 0.006, 0.024) * n1 * exp(-r * r * 1.8) * (0.6 + expand * 0.35);
    // Warm rose-gold mid nebula — bridges inner and outer space
    col += vec3<f32>(0.014, 0.008, 0.016) * n2 * exp(-r * r * 2.5) * (0.5 + expand * 0.25);
    // Cool indigo outer dust — matches outer lotus petals
    col += vec3<f32>(0.005, 0.008, 0.020) * n3 * exp(-r * r * 3.5) * 0.35;

    return col;
}

fn geometryFragment(uv: vec2<f32>, n: f32, size: f32, rot: f32, breath: f32) -> vec3<f32> {
    let r = length(uv);
    let a = atan2(uv.y, uv.x) + rot;
    let sector = 6.28318530718 / n;
    let sa = pmod(a, sector) - sector * 0.5;

    // Soft petal-like fragment shape
    let d = abs(r - size * 0.5) + abs(sa) * r * 1.8;
    let shape = smoothstep(size * 0.22, 0.0, d);
    let glow = exp(-d * d * 60.0) * 0.4;

    // Soft radial fade
    let fade = smoothstep(0.0, 0.02, r) * (1.0 - smoothstep(size * 0.85, size * 1.3, r));

    return (shape * 0.12 + glow) * fade * vec3<f32>(0.65, 0.55, 0.85) * (0.42 + breath * 0.08);
}

fn floatingGeometry(uv: vec2<f32>, t: f32, breath: f32, expand: f32) -> vec3<f32> {
    var col = vec3<f32>(0.0);

    // Fragment 1 — upper left, small lotus-like, slow rotation
    let p1 = rot2(t * 0.035) * (uv - vec2<f32>(-1.15, 0.65));
    col += geometryFragment(p1, 6.0, 0.16, 0.0, breath) * 0.9;

    // Fragment 2 — lower right, yantra-like
    let p2 = rot2(-t * 0.025) * (uv - vec2<f32>(1.05, -0.55));
    col += geometryFragment(p2, 8.0, 0.20, 1.2, breath) * 0.7;

    // Fragment 3 — upper right, very faint, small
    let p3 = rot2(t * 0.018) * (uv - vec2<f32>(0.85, 0.85));
    col += geometryFragment(p3, 5.0, 0.12, 2.5, breath) * 0.5;

    // Fragment 4 — lower left, distant
    let p4 = rot2(-t * 0.022) * (uv - vec2<f32>(-0.75, -0.85));
    col += geometryFragment(p4, 7.0, 0.14, 0.8, breath) * 0.6;

    // Fragment 5 — far right edge, barely visible
    let p5 = rot2(t * 0.015) * (uv - vec2<f32>(1.4, 0.2));
    col += geometryFragment(p5, 6.0, 0.10, 3.0, breath) * 0.35;

    return col;
}

fn emanationRays(uv: vec2<f32>, t: f32, breath: f32, expand: f32) -> vec3<f32> {
    var col = vec3<f32>(0.0);
    let a = atan2(uv.y, uv.x);
    let r = length(uv);

    // Wide, soft spiritual rays emanating from center
    for (var i = 0; i < 6; i++) {
        let fi = f32(i);
        let ray = pow(max(0.0, cos(a - t * 0.025 + fi * 1.047198)), 10.0);
        let fade = exp(-r * (1.6 + fi * 0.25));
        col += ray * fade * vec3<f32>(0.42, 0.32, 0.68) * (0.10 + expand * 0.12);
    }

    // Very soft radial bloom behind the lotus
    let bloom = exp(-r * r * 3.5) * (0.04 + expand * 0.06);
    col += bloom * vec3<f32>(0.48, 0.38, 0.78);

    // Subtle cross-shaped emanation (sacred geometry feel)
    let cross = pow(abs(cos(a * 2.0)), 16.0) + pow(abs(sin(a * 2.0)), 16.0);
    col += cross * exp(-r * r * 2.0) * 0.022 * vec3<f32>(0.62, 0.52, 0.88);

    return col;
}

fn backgroundAtmosphere(uv: vec2<f32>, t: f32, breath: f32, expand: f32) -> vec3<f32> {
    let r = length(uv);

    // Deep sacred space gradient
    var col = vec3<f32>(0.003, 0.0015, 0.010);

    // Nebula dust clouds
    col += nebulaDust(uv, t, breath, expand);

    // Twinkling starfield
    col += twinkleStars(uv, t, breath, expand);

    // Floating sacred geometry fragments (very faint)
    col += floatingGeometry(uv, t, breath, expand);

    // Soft emanation rays from behind the lotus
    col += emanationRays(uv, t, breath, expand);

    // Breath-reactive ambient center glow
    col += vec3<f32>(0.006, 0.003, 0.016) * exp(-r * r * 2.5) * (0.35 + expand * 0.30);

    return col;
}

fn lightShafts(uv: vec2<f32>, t: f32, breath: f32, expand: f32) -> vec3<f32> {
    var col = vec3<f32>(0.0);
    let a = atan2(uv.y, uv.x);
    let r = length(uv);
    for (var i = 0; i < 3; i++) {
        let fi = f32(i);
        let beam = pow(max(0.0, cos(a - t * 0.06 + fi * 2.094395)), 20.0);
        let fade = exp(-r * (2.4 + fi * 0.4));
        col += beam * fade * vec3<f32>(0.52, 0.40, 0.88) * (0.18 + expand * 0.30);
    }
    return col * 0.38;
}

// =================================================================
// LOTUS MODULE
// =================================================================
//
// A single radial ring of `n` petals. Compared to the previous wedge
// approach, each petal now has:
//   - a leaf profile (half-width follows sin along its length) so it
//     comes to a real point and rounds at the base,
//   - per-petal hash variation (length, width, hue) so the ring is
//     organic rather than mechanically perfect,
//   - a subsurface translucency gradient (glows from the base/center),
//   - central + lateral veins,
//   - a bright rim light hugging the petal edge,
//   - a faked top-down light so upper petals read brighter (3D depth).
// =================================================================
fn lotusLayer(
    uv: vec2<f32>, t: f32,
    n: f32, len: f32, wid: f32, base: f32, off: f32,
    expand: f32, color: vec3<f32>
) -> vec3<f32> {
    let angle = atan2(uv.y, uv.x);
    let r = length(uv);
    let sector = TAU / n;
    let petalId = floor((angle + off) / sector);
    let a = pmod(angle + off, sector) - sector * 0.5;

    // --- per-petal organic variation -------------------------------
    let hv = hash22(vec2<f32>(petalId, n * 0.37));
    let lenVar = len * (0.93 + hv.x * 0.14);
    let widVar = wid * (0.88 + hv.y * 0.24);
    let hueJit = (hv.x - 0.5) * 0.10;             // tiny per-petal hue drift

    let tip = lenVar * (1.0 + expand * 0.22);
    let baseR = base * (1.0 - expand * 0.08);

    // --- gentle outward droop/curl ---------------------------------
    let droop = max(0.0, r - baseR) * 0.12 * (min(n, 24.0) / 12.0) * (1.0 - expand * 0.35);
    let aD = a + droop;

    // --- leaf profile: half-width as a function of length ----------
    // tNorm 0 at base, 1 at tip. sin(PI*t) -> 0 at both ends, fat mid.
    let tNorm = clamp((r - baseR) / max(tip - baseR, 1e-3), 0.0, 1.0);
    let profile = pow(sin(tNorm * PI), 0.65);
    let w = widVar * (0.10 + 0.90 * profile) * (1.0 + expand * 0.18)
            * (1.0 + u.interference * 0.04 * sin(petalId));

    // --- masks -----------------------------------------------------
    let radial = smoother(baseR - 0.015, baseR + 0.03, r) *
                 smoother(tip, tip * 0.72, r);
    let edgeAbs = abs(aD);
    let angular = smoother(w, w * 0.05, edgeAbs);          // 1 center -> 0 edge
    var mask = radial * angular;

    // --- subsurface translucency: glow pooled at base & midrib -----
    let midrib = smoother(w * 0.55, 0.0, edgeAbs);
    let subsurface = mask * (0.35 + 0.65 * midrib) * (1.0 - tNorm * 0.45);

    // --- veins: bright central rib + soft laterals -----------------
    let central = smoother(w * 0.10, 0.0, edgeAbs) * radial;
    let lateralWave = sin(edgeAbs * 26.0 - tNorm * 7.0 + petalId) * 0.5 + 0.5;
    let lateral = lateralWave * smoother(w * 0.7, w * 0.1, edgeAbs) * mask *
                  smoother(baseR + 0.04, baseR + 0.14, r);
    let veins = central * 0.5 + lateral * 0.18;

    // --- rim light: thin bright band hugging the outer edge --------
    let rim = (smoother(w, w * 0.78, edgeAbs) - smoother(w * 0.78, w * 0.5, edgeAbs)) *
              radial * (0.6 + 0.4 * tNorm);

    // --- bright tip highlight (catches the divine light) -----------
    let tipGlow = smoother(tip * 0.78, tip, r) * angular * 0.8;

    // --- faked top-down light for 3D layering ----------------------
    let nrm = normalize(uv + vec2<f32>(1e-5));
    let facing = 0.62 + 0.38 * dot(nrm, vec2<f32>(0.22, 1.0));

    // --- depth fade so petals sit behind the symbol ---------------
    let depth = smoother(0.0, 0.16, r) * (1.0 - smoother(tip * 0.78, tip * 1.08, r));

    // tint: warm rim/tip (light side), cooler body (shadow side)
    let bodyCol  = color * (1.0 + vec3<f32>(hueJit, 0.0, -hueJit));
    let lightCol = mix(color, vec3<f32>(1.0, 0.94, 0.88), 0.45);

    var outc = vec3<f32>(0.0);
    outc += subsurface * 0.34 * bodyCol;
    outc += veins * bodyCol * vec3<f32>(1.1, 1.05, 1.0);
    outc += rim * 0.55 * lightCol;
    outc += tipGlow * 0.40 * lightCol;

    return outc * depth * facing;
}

// =================================================================
// SACRED SYMBOL — luminous heart of the composition
// =================================================================
// Layered: a soft radial halo, concentric light rings, a slowly
// counter-rotating tri-seed mandala for "intentional" motion, a
// caustic shimmer on the core, and a breath-synced pulse. Brightness
// is pushed deliberately high so it remains the focal point through
// bloom and tone mapping.
// =================================================================
fn sacredSymbol(
    uv: vec2<f32>, t: f32,
    expand: f32, intensity: f32, chakraPhase: f32
) -> vec3<f32> {
    var col = vec3<f32>(0.0);
    let r = length(uv);
    let a = atan2(uv.y, uv.x);

    // Breathing pulse: a wandering heartbeat (never locks to other layers'
    // rhythms) plus the breath openness itself.
    let beat = organicPulse(t, 1.4, 4.81);
    let symPulse = 1.0 + 0.06 * sin(t * 2.8 + beat) * (0.5 + intensity) + expand * 0.05;
    let sx = 0.150 * symPulse * (1.0 + expand * 0.12);
    let sy = 0.082 * symPulse * (1.0 + expand * 0.06);

    // Ellipse SDF (negative inside).
    let d = length(vec2<f32>(uv.x / max(sx, 1e-4), uv.y / max(sy, 1e-4))) - 1.0;

    // Nested ring offsets.
    let r1 = abs(d) - 0.014;
    let r2 = abs(d) - 0.034;
    let r3 = abs(d) - 0.062;

    // Glow falloffs (1/x style for a hot luminous core).
    let core = 0.014 / (abs(d) + 0.005);
    let g1   = 0.008 / (abs(r1) + 0.003);
    let g2   = 0.0045 / (abs(r2) + 0.005);
    let g3   = 0.0022 / (abs(r3) + 0.009);

    // Phase palette: inhale crystalline, hold1 rose-gold, exhale solar,
    // hold2 lunar silver.
    var c = vec3<f32>(1.0, 0.94, 0.72);
    if (chakraPhase < 0.5)      { c = vec3<f32>(0.82, 0.94, 1.0); }
    else if (chakraPhase < 1.5) { c = vec3<f32>(1.0, 0.80, 0.86); }
    else if (chakraPhase < 2.5) { c = vec3<f32>(1.0, 0.95, 0.70); }
    else                        { c = vec3<f32>(0.88, 0.94, 1.0); }

    let bright = 0.70 + expand * 1.05 + intensity * 0.42 + beat * 0.12;

    col += core * c * bright * 2.1;
    col += g1   * c * bright * 1.35;
    col += g2   * c * bright * 0.78;
    col += g3   * c * bright * 0.36;

    // Solid inner fill with a soft falloff.
    let fill = smoother(0.02, -0.01, d);
    col += fill * c * bright * 0.55;

    // Caustic shimmer riding the core — subtle living light.
    let shimmer = (sin(a * 5.0 - t * 1.6) * 0.5 + 0.5) *
                  (sin(r * 60.0 - t * 2.2) * 0.5 + 0.5);
    col += fill * shimmer * c * 0.18 * (0.4 + expand);

    // Counter-rotating tri-seed mandala (bindu-like). Three soft dots
    // orbiting the centre, gently scaling with the breath.
    let seedR = 0.045 * (1.0 + expand * 0.35);
    for (var i = 0; i < 3; i++) {
        let ang = -t * 0.35 * (1.0 + u.interference) + f32(i) * (TAU / 3.0);
        let p = uv - vec2<f32>(cos(ang), sin(ang)) * seedR;
        let dd = length(p);
        col += (0.0016 / (dd + 0.004)) * c * bright * 0.7;
    }

    // Horizontal lens flare across the symbol.
    let flare = exp(-abs(uv.y) * 52.0) * exp(-abs(uv.x) * 3.0) * (0.35 + expand * 0.65);
    col += flare * c * 0.78;

    // Halo bedding the symbol into the petals.
    col += exp(-r * 21.0) * c * (0.45 + expand * 0.9) * 0.85;

    return col;
}

fn lotusAndSymbol(
    uv: vec2<f32>, t: f32,
    breath: f32, intensity: f32, chakraPhase: f32
) -> vec3<f32> {
    var col = vec3<f32>(0.0);
    let expand = deriveBreathExpand(breath, chakraPhase);

    let shimmer = 0.03 * sin(t * 1.6 + breath * 12.566) * intensity;
    let effExpand = expand + shimmer;
    let glowMult = 0.78 + effExpand * 0.62 + intensity * 0.25;
    let density = clamp(u.geometryDensity + u.intensity * 0.2, 0.2, 3.0);
    let timeM = 1.0 + u.interference * 0.35;

    // Petal counts grow with density; outer layers emerge only at higher density.
    let n1 = 8.0 + floor(density * 4.0);
    let n2 = 12.0 + floor(density * 5.0);
    let n3 = 16.0 + floor(density * 6.0);
    let n4 = mix(0.0, 20.0 + floor(density * 7.0), smoothstep(0.6, 1.4, density));
    let n5 = mix(0.0, 26.0 + floor(density * 9.0), smoothstep(1.0, 2.0, density));

    col += lotusLayer(uv, t, n1, 0.42, 0.16, 0.06,
                      (0.000 + t * 0.020) * timeM, effExpand,
                      vec3<f32>(0.95, 0.62, 0.75)) * glowMult;

    col += lotusLayer(uv, t, n2, 0.60, 0.20, 0.10,
                      (0.262 + t * 0.014) * timeM, effExpand,
                      vec3<f32>(0.82, 0.52, 0.92)) * glowMult;

    col += lotusLayer(uv, t, n3, 0.76, 0.24, 0.14,
                      (0.131 + t * 0.008) * timeM, effExpand,
                      vec3<f32>(0.97, 0.55, 0.42)) * glowMult;

    if (n4 > 0.0) {
        col += lotusLayer(uv, t, n4, 0.92, 0.28, 0.18,
                          (0.000 - t * 0.005) * timeM, effExpand * 0.7,
                          vec3<f32>(0.95, 0.70, 0.45)) * glowMult * 0.55;
    }

    if (n5 > 0.0) {
        col += lotusLayer(uv, t, n5, 1.12, 0.32, 0.24,
                          (0.500 + t * 0.003) * timeM, effExpand * 0.45,
                          vec3<f32>(0.58, 0.72, 0.85)) * glowMult * 0.28;
    }

    // Central sacred symbol
    col += sacredSymbol(uv, t, effExpand, intensity, chakraPhase);

    // Recursive micro-geometry around the heart of the lotus
    col += dotLattice(uv, t, density) * 0.30;
    col += goldenSeedField(uv, vec2<f32>(0.0), 18, t, density) * 0.18;
    col += vesicaPiscisChain(uv, vec2<f32>(0.0), 10.0, 0.18, t, density) * 0.16;

    // Lotus aura bridges warm inner petals with cool outer space
    let aura = exp(-length(uv) * 3.2) * (0.12 + effExpand * 0.18) * intensity;
    col += aura * vec3<f32>(0.72, 0.58, 0.92);

    return col;
}

// =================================================================
// ENERGY RIBBONS MODULE
// =================================================================
//
// Each strand is a flowing torus around the centre. Fluidity comes
// from FBM domain-warp of the spiral phase plus a "weave" term that
// pushes the ribbon's centreline in and out radially, so it appears
// to dive behind and rise in front of neighbouring streams. Thickness
// breathes along the arc, a bright filament sits inside a soft glow,
// and depth shading dims the back of each weave.
// =================================================================
// Depth helpers: give each orbital ring its own sense of distance from the
// viewer. Inner rings (small orbitR) sit "close" — sharp and fast-panning;
// outer rings sit "far" — softer-edged and drifting more slowly, the way a
// background recedes behind a foreground subject.
fn ribbonLayerDepth(orbitR: f32) -> f32 {
    return 1.0 / (1.0 + orbitR * 1.3);   // 1.0 = near, → 0.0 = far
}

fn ribbonParallaxUV(uv: vec2<f32>, orbitR: f32) -> vec2<f32> {
    let layerDepth = ribbonLayerDepth(orbitR);
    let drift = vec2<f32>(sin(fieldTime() * 0.07), cos(fieldTime() * 0.05))
                * (1.0 - layerDepth) * 0.02;
    return uv + drift;
}

fn ribbonLayerBlur(orbitR: f32) -> f32 {
    let layerDepth = ribbonLayerDepth(orbitR);
    return mix(1.45, 1.0, layerDepth);   // far rings widen (blur), near stay crisp
}

fn ribbonStrand(
    uv: vec2<f32>, t: f32,
    orbitR: f32, n: f32, speed: f32, twist: f32, phase: f32, width: f32,
    color: vec3<f32>, expand: f32, intensity: f32
) -> vec3<f32> {
    let r = length(uv);
    let a = atan2(uv.y, uv.x);

    // Two-octave domain warp for organic, fluid motion.
    let warp1 = fbm2(uv * 1.6 + vec2<f32>(orbitR * 4.0, phase * 2.0 + t * 0.12), t * 0.30);
    let warp2 = fbm2(uv * 3.1 - vec2<f32>(t * 0.08, orbitR * 2.0), t * 0.22);

    // Flowing spiral coordinate along the ribbon.
    let spiralPhase = a * n + t * speed + twist * (r - orbitR) + phase + warp1 * 0.65;

    // Weave: centreline drifts in/out -> the ribbon snakes radially.
    let weave = sin(spiralPhase * 0.85 + warp2 * 1.6) * width * 1.7;
    let orbit = orbitR + weave;
    let radialDist = r - orbit;

    // Thickness breathes along arc length (catch-the-light variation).
    let thick = width * (0.55 + 0.45 * (sin(spiralPhase * 1.3 + warp2) * 0.5 + 0.5));

    // Soft glow halo + flowing energy segmentation.
    let flow = sin(spiralPhase) * 0.5 + 0.5;
    let seg = pow(flow, 2.5) * 0.7 + 0.3;
    let glow = exp(-radialDist * radialDist / (thick * thick * 2.6)) * 0.42;
    let core = exp(-radialDist * radialDist / (thick * thick * 0.40)) * seg;

    // Bright inner filament — the "wire" of light at the ribbon's heart.
    let filament = exp(-radialDist * radialDist / (thick * thick * 0.06)) * pow(flow, 4.0) * 0.55;

    // Depth shading: weave-back portions read dimmer & cooler.
    let depth = 0.6 + 0.4 * (sin(spiralPhase * 0.85 + warp2 * 1.6) * 0.5 + 0.5);

    let centerFade = smoother(0.04, 0.17, r);
    let sideBias = pow(abs(cos(a)), 0.45) * 0.30 + 0.70;

    var ribbon = (core + glow) * centerFade * sideBias * depth + filament * centerFade;

    // Flowing colour shift along the ribbon length.
    let colorShift = sin(spiralPhase * 0.35 + t * 0.4 + phase) * 0.5 + 0.5;
    let flowColor = mix(color, color * vec3<f32>(1.15, 0.85, 1.25), colorShift * 0.35);
    // Filament cores trend whiter (hot core, coloured glow).
    let hotColor = mix(flowColor, vec3<f32>(1.0, 0.96, 0.92), filament * 1.2);

    let bright = (0.38 + expand * 0.85 + intensity * 0.32);
    return ribbon * hotColor * bright;
}

fn energyRibbons(
    uv: vec2<f32>, t: f32,
    breath: f32, intensity: f32, chakraPhase: f32
) -> vec3<f32> {
    var col = vec3<f32>(0.0);
    let expand = deriveBreathExpand(breath, chakraPhase);

    let holdPulse = 1.0 + 0.08 * (organicPulse(t, 3.5, 7.45) * 2.0 - 1.0) * expand * intensity;
    let flowSpeed = 1.0 + expand * 1.4;
    let radiusShift = 1.0 - expand * 0.18;
    let glowMult = 0.55 + expand * 0.95 + intensity * 0.28;

    // Upward drift during inhale (prana rising)
    let baseDriftUV = uv + vec2<f32>(0.0, expand * 0.04);

    // Ribbon colors share the lotus palette for energetic continuity.
    // --- Layer 1: Inner prana streams (closest — sharp, fast parallax) ---
    let r1 = 0.32 * radiusShift;
    let uv1 = ribbonParallaxUV(baseDriftUV, r1);
    let blur1 = ribbonLayerBlur(r1);
    col += ribbonStrand(uv1, t, r1, 4.0, flowSpeed * 1.0, 6.0, 0.00,
                        0.038 * blur1, vec3<f32>(0.92, 0.48, 0.68), expand, intensity)
           * glowMult * holdPulse;
    col += ribbonStrand(uv1, t, r1, 4.0, flowSpeed * 1.0, 6.0, 3.14159,
                        0.038 * blur1, vec3<f32>(0.78, 0.42, 0.72), expand, intensity)
           * glowMult * holdPulse;

    // --- Layer 2: Mid energy rings ---
    let r2 = 0.58 * radiusShift;
    let uv2 = ribbonParallaxUV(baseDriftUV, r2);
    let blur2 = ribbonLayerBlur(r2);
    col += ribbonStrand(uv2, t, r2, 6.0, flowSpeed * 1.2, 9.0, 0.60,
                        0.045 * blur2, vec3<f32>(0.48, 0.68, 0.92), expand, intensity)
           * glowMult * 0.90 * holdPulse;
    col += ribbonStrand(uv2, t, r2, 6.0, flowSpeed * 1.2, 9.0, 2.80,
                        0.045 * blur2, vec3<f32>(0.55, 0.82, 0.72), expand, intensity)
           * glowMult * 0.90 * holdPulse;
    col += ribbonStrand(uv2, t, r2, 6.0, flowSpeed * 1.2, 9.0, 4.50,
                        0.045 * blur2, vec3<f32>(0.88, 0.52, 0.78), expand, intensity)
           * glowMult * 0.90 * holdPulse;

    // --- Layer 3: Outer cosmic streams (further — softer, slower parallax) ---
    let r3 = 0.92 * radiusShift;
    let uv3 = ribbonParallaxUV(baseDriftUV, r3);
    let blur3 = ribbonLayerBlur(r3);
    col += ribbonStrand(uv3, t, r3, 8.0, flowSpeed * 0.85, 12.0, 1.10,
                        0.052 * blur3, vec3<f32>(0.42, 0.62, 0.92), expand, intensity)
           * glowMult * 0.72 * holdPulse;
    col += ribbonStrand(uv3, t, r3, 8.0, flowSpeed * 0.85, 12.0, 3.90,
                        0.052 * blur3, vec3<f32>(0.68, 0.48, 0.88), expand, intensity)
           * glowMult * 0.72 * holdPulse;

    // --- Layer 4: Far aura whisps (most distant — softest, slowest drift) ---
    let r4 = 1.35 * radiusShift;
    let uv4 = ribbonParallaxUV(baseDriftUV, r4);
    let blur4 = ribbonLayerBlur(r4);
    col += ribbonStrand(uv4, t, r4, 3.5, flowSpeed * 0.45, 5.0, 0.00,
                        0.075 * blur4, vec3<f32>(0.52, 0.60, 0.88), expand, intensity)
           * glowMult * 0.38 * holdPulse;
    col += ribbonStrand(uv4, t, r4, 3.5, flowSpeed * 0.45, 5.0, 2.09,
                        0.075 * blur4, vec3<f32>(0.58, 0.52, 0.82), expand, intensity)
           * glowMult * 0.38 * holdPulse;

    // Breath-driven temperature shift for ribbons
    if (chakraPhase < 0.5)      { col *= vec3<f32>(0.90, 0.98, 1.08); }
    else if (chakraPhase < 1.5) { col *= vec3<f32>(1.10, 0.94, 0.98); }
    else if (chakraPhase < 2.5) { col *= vec3<f32>(1.04, 0.98, 0.90); }
    else                        { col *= vec3<f32>(0.94, 0.98, 1.04); }

    // Connecting bridges — faint arcs linking inner and outer streams
    let r = length(baseDriftUV);
    let a = atan2(baseDriftUV.y, baseDriftUV.x);
    let bridgePhase = a * 2.0 + t * 0.6 + expand * 2.0;
    let bridgeMask = exp(-(r - 0.70) * (r - 0.70) / 0.015) *
                     smoothstep(0.4, 0.8, sin(bridgePhase) * 0.5 + 0.5);
    col += vec3<f32>(0.72, 0.75, 0.95) * bridgeMask * 0.18 * glowMult;

    return col;
}

// =================================================================
// THEME & POST-PROCESS HELPERS
// =================================================================

// Narkowicz ACES approximation — filmic highlight roll-off that keeps
// the hot symbol core from turning into a flat white blob while
// preserving saturated colour in the mids. Cheaper than full ACES.
fn acesTonemap(x: vec3<f32>) -> vec3<f32> {
    let a = 2.51;
    let b = 0.03;
    let c = 2.43;
    let d = 0.59;
    let e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), vec3<f32>(0.0), vec3<f32>(1.0));
}

fn applyColorGrading(col: vec3<f32>, expand: f32, theme: f32, focusTint: vec3<f32>) -> vec3<f32> {
    var graded = col;

    // 1. Breath-driven saturation (peak inhale slightly more vivid).
    let sat = 1.0 + expand * 0.10;
    let luma = dot(graded, vec3<f32>(0.299, 0.587, 0.114));
    graded = mix(vec3<f32>(luma), graded, sat);

    // 2. Breath colour temperature (inhale warmer, exhale cooler) — pushed
    //    further so the "filling with light" sensation reads more strongly.
    let warmth = expand * 0.14;
    graded *= vec3<f32>(1.0 + warmth, 1.0 + warmth * 0.25, 1.0 - warmth * 0.35);

    // 3. Chromatic bloom bleed — bright areas warm slightly, bleeding
    //    gold into the cool petals for natural light interaction.
    let brightness = dot(graded, vec3<f32>(0.333));
    let chromaticWarmth = smoothstep(0.4, 1.2, brightness) * (0.04 + expand * 0.05);
    graded += vec3<f32>(chromaticWarmth, chromaticWarmth * 0.35, -chromaticWarmth * 0.25);

    // 4. Theme tint.
    if (theme > 0.5 && theme < 1.5) {
        graded = mix(graded, graded * vec3<f32>(1.18, 1.04, 0.78), 0.20);   // Golden
    } else if (theme > 1.5) {
        graded = mix(graded, graded * vec3<f32>(0.82, 1.06, 1.12), 0.20);   // Ocean
    }

    // 5. Focus-tinted highlight bleed and filmic tone map.
    let bright = dot(graded, vec3<f32>(0.333));
    let glowMask = smoothstep(0.45, 1.2, bright) * (0.05 + expand * 0.06);
    graded += glowMask * focusTint * 0.18;

    // 6. Filmic tone map (replaces ad-hoc S-curve + Reinhard shoulder).
    graded = acesTonemap(graded * 1.05);

    // 7. Gentle gamma lift so deep space stays ethereal, not crushed.
    graded = pow(graded, vec3<f32>(0.90));

    return max(graded, vec3<f32>(0.0));
}

// -----------------------------------------------------------------
// SDF primitives for optional figure layer
// -----------------------------------------------------------------
fn sdSegment(p: vec2<f32>, a: vec2<f32>, b: vec2<f32>) -> f32 {
    let pa = p - a;
    let ba = b - a;
    let h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h);
}

fn sdCircle(p: vec2<f32>, r: f32) -> f32 {
    return length(p) - r;
}

fn smin(a: f32, b: f32, k: f32) -> f32 {
    let h = max(k - abs(a - b), 0.0) / k;
    return min(a, b) - h * h * k * 0.25;
}

// -----------------------------------------------------------------
// Optional subtle seated figure behind the lotus
// Visible only at higher strength so the lotus remains the hero.
// -----------------------------------------------------------------
fn humanFigureLotus(uv: vec2<f32>, t: f32, breath: f32, expand: f32) -> vec3<f32> {
    var col = vec3<f32>(0.0);
    let figureStrength = smoothstep(0.8, 1.5, u.strengthLevel) + 0.15 * u.intensity;
    if (figureStrength < 0.05) { return col; }

    // Small seated figure centered just below the symbol
    let p = (uv - vec2<f32>(0.0, -0.26)) / 0.40;

    let phaseColor = chakraFocusTint();
    var themeColor = vec3<f32>(0.85, 0.90, 1.00);
    if (u.theme < 0.5)      { themeColor = vec3<f32>(0.75, 0.85, 1.00); }
    else if (u.theme < 1.5) { themeColor = vec3<f32>(1.00, 0.85, 0.45); }
    else                    { themeColor = vec3<f32>(0.45, 0.90, 1.00); }

    let headPos  = vec2<f32>(0.0, 0.28 + expand * 0.012);
    let chestPos = vec2<f32>(0.0, 0.08 + expand * 0.010);
    let hipsPos  = vec2<f32>(0.0, -0.12);

    // Head with subtle tilt & chin tuck
    let tilt = sin(t * 0.7) * 0.004 * u.intensity;
    let headD = sdCircle(p - (headPos + vec2<f32>(tilt, 0.0)), 0.055);
    col += exp(-abs(headD) * 35.0) * themeColor * 0.35;
    let chinD = sdCircle(p - (headPos + vec2<f32>(tilt * 0.5, -0.046)), 0.018);
    col += exp(-abs(chinD) * 55.0) * themeColor * 0.14;

    // Torso
    let chestD = sdCircle(p - chestPos, 0.075 * (1.0 + expand * 0.10));
    let hipsD  = sdCircle(p - hipsPos,  0.065 * (1.0 + expand * 0.03));
    let torsoD = smin(chestD, hipsD, 0.08);
    col += exp(-abs(torsoD) * 30.0) * themeColor * 0.28;

    // Arms resting softly
    let leftHand  = vec2<f32>(-0.22, -0.10 + expand * 0.015);
    let rightHand = vec2<f32>( 0.22, -0.10 + expand * 0.015);
    let leftArmD  = sdSegment(p, chestPos + vec2<f32>(-0.055, 0.02), leftHand) - 0.022;
    let rightArmD = sdSegment(p, chestPos + vec2<f32>( 0.055, 0.02), rightHand) - 0.022;
    col += exp(-abs(leftArmD)  * 35.0) * themeColor * 0.30;
    col += exp(-abs(rightArmD) * 35.0) * themeColor * 0.30;

    // Hands
    col += exp(-abs(sdCircle(p - leftHand,  0.025)) * 45.0) * phaseColor * 0.35;
    col += exp(-abs(sdCircle(p - rightHand, 0.025)) * 45.0) * phaseColor * 0.35;

    // Lotus seat
    let leftThigh  = sdSegment(p, hipsPos + vec2<f32>(-0.03, -0.02), vec2<f32>(-0.18, -0.22)) - 0.028;
    let leftShin   = sdSegment(p, vec2<f32>(-0.18, -0.22), vec2<f32>( 0.04, -0.28)) - 0.024;
    let rightThigh = sdSegment(p, hipsPos + vec2<f32>( 0.03, -0.02), vec2<f32>( 0.18, -0.22)) - 0.028;
    let rightShin  = sdSegment(p, vec2<f32>( 0.18, -0.22), vec2<f32>(-0.04, -0.28)) - 0.024;
    col += exp(-abs(leftThigh)  * 35.0) * themeColor * 0.30;
    col += exp(-abs(leftShin)   * 35.0) * themeColor * 0.26;
    col += exp(-abs(rightThigh) * 35.0) * themeColor * 0.30;
    col += exp(-abs(rightShin)  * 35.0) * themeColor * 0.26;

    // Sushumna nadi
    let nadiD = abs(p.x) - 0.0035;
    var nadiColor = vec3<f32>(0.9, 0.95, 1.0);
    if (u.chakraFocus >= 0.0) {
        nadiColor = mix(nadiColor, CHAKRA[u32(clamp(u.chakraFocus, 0.0, 6.0))], 0.45);
    }
    col += exp(-abs(nadiD) * 65.0) * nadiColor * 0.22 * (0.6 + expand * 0.4);

    return col * figureStrength * 0.55;
}

// =================================================================
// FRAGMENT SHADER — FINAL COMPOSITION
// =================================================================

@fragment
fn main(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
    var uv = (fragCoord.xy - 0.5 * u.resolution) / u.resolution.y;
    let breath = u.breathPhase;
    let expand = deriveBreathExpand(breath, u.chakraPhase);
    let t = u.time;
    let r = length(uv);
    let focusTint = chakraFocusTint();

    // ------------------------------------------------------------
    // Interactive mouse ripple (preserved from original app)
    // ------------------------------------------------------------
    if (u.mouse.x > -1.9) {
        let toMouse = uv - u.mouse;
        let dist = length(toMouse);
        let ripplePhase = t * 7.0 - dist * 42.0;
        let ripple = sin(ripplePhase) * exp(-dist * 5.5) * u.mouseStrength * 0.028;
        uv += toMouse * ripple * 2.2;
    }

    // LAYER 1 — Background atmosphere, driven by its own slow, un-synchronized
    // clock so the space around the figure keeps drifting independently —
    // most noticeable as held stillness in the foreground during breath holds.
    var col = backgroundAtmosphere(uv, fieldTime(), breath, expand);

    // LAYER 2 — Volumetric light shafts
    col += lightShafts(uv * 0.85, t, breath, expand);

    // LAYER 3 — Energy ribbons (behind lotus for translucency glow)
    col += energyRibbons(uv, t, breath, u.intensity, u.chakraPhase);

    // LAYER 3b — Optional subtle seated figure (strength-gated)
    col += humanFigureLotus(uv, t, breath, expand);

    // LAYER 4 — Lotus + sacred symbol (hero focal point)
    col += lotusAndSymbol(uv, t, breath, u.intensity, u.chakraPhase);

    // LAYER 5 — Global breath aura
    let globalAura = exp(-r * 2.8) * (0.06 + expand * 0.10) * u.intensity;
    col += globalAura * mix(vec3<f32>(0.58, 0.48, 0.88), focusTint, 0.55);

    // LAYER 6 — Exhale release wave (subtle traveling ripple)
    let releaseWave = sin(r * 10.0 - breath * 15.708 - t * 1.2) * 0.5 + 0.5;
    let waveMask = exp(-r * 2.0) *
                   smoothstep(0.35, 0.75, releaseWave) *
                   (1.0 - expand) * 0.038;
    col += waveMask * mix(vec3<f32>(0.52, 0.42, 0.82), focusTint, 0.40);

    // LAYER 7 — Atmospheric breath haze (depth + cohesion)
    let haze = exp(-r * 1.3) * (0.12 + (1.0 - breath) * 0.22);
    col = mix(col, vec3<f32>(0.045, 0.022, 0.14), haze * 0.30);

    // POST — vignette draws the eye to centre
    let vig = pow(1.0 - r * 0.68, 1.75);
    col *= vig * 1.28;

    // POST — saturation, temperature, bloom bleed, theme, tone map
    col = applyColorGrading(col, expand, u.theme, focusTint);
    col = mix(col, col * (0.62 + focusTint * 0.90), 0.20);

    return vec4<f32>(col, 1.0);
}
