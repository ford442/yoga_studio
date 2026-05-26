// ============================================================
// LOTUS & SACRED SYMBOL MODULE — Ethereal Cosmic Lotus
// ============================================================
// Integration Guide:
//   1. Paste the helpers + functions below into your fragment
//      shader (e.g. sacred-monk.wgsl) above the @fragment entry.
//   2. Call from fs_main:
//        let lotusCol = lotusAndSymbol(uv, u.time, u.breathPhase,
//                                      u.intensity, u.chakraPhase);
//        col += lotusCol;
//   3. No new uniforms are required — the function reads the
//      same `Uniforms` already used by the project.
//
// Breath Mapping:
//   `chakraPhase` encodes phase: 0=inhale, 1=hold1, 2=exhale, 3=hold2
//   `breathPhase` is 0..1 across the full 4-phase cycle.
//   Internally we derive `expand` (0..1 petal aperture) and a
//   central-symbol pulse from these two values.
// ============================================================

// ------------------------------------------------------------------
// Math helpers (safe to add; skip if your shader already has them)
// ------------------------------------------------------------------

fn pmod(a: f32, b: f32) -> f32 {
    return a - floor(a / b) * b;
}

fn rot2(a: f32) -> mat2x2<f32> {
    let c = cos(a);
    let s = sin(a);
    return mat2x2<f32>(c, -s, s, c);
}

fn hash21(p: vec2<f32>) -> f32 {
    let n = fract(dot(p, vec2<f32>(127.1, 311.7)));
    return fract(n * 43758.5453123);
}

// ------------------------------------------------------------------
// Single lotus petal layer
// ------------------------------------------------------------------
// Returns an RGB contribution for one concentric ring of petals.
// `uv`     — centered, aspect-corrected coords
// `t`      — elapsed time
// `n`      — petal count
// `len`    — petal length (radial)
// `wid`    — base angular width
// `base`   — inner radius where petals begin
// `off`    — angular offset (rotation)
// `expand` — 0..1 breath-driven aperture
// `color`  — layer tint
// ------------------------------------------------------------------
fn lotusLayer(
    uv: vec2<f32>,
    t: f32,
    n: f32,
    len: f32,
    wid: f32,
    base: f32,
    off: f32,
    expand: f32,
    color: vec3<f32>
) -> vec3<f32> {
    let angle = atan2(uv.y, uv.x);
    let r = length(uv);
    let sector = 6.28318530718 / n;
    let a = pmod(angle + off, sector) - sector * 0.5;

    // Breathing geometry
    let tip = len * (1.0 + expand * 0.22);
    let baseR = base * (1.0 - expand * 0.08);

    // --- Soft petal body ---
    // Radial mask: fade in from base, fade out at tip
    let radial = smoothstep(baseR, baseR + 0.035, r) *
                 smoothstep(tip, tip * 0.68, r);

    // Angular mask: petals are wider near the base, pointed at tip
    let taper = 1.0 - smoothstep(0.0, tip * 0.85, r);
    let w = wid * (0.55 + 0.45 * taper) * (1.0 + expand * 0.18);
    let angular = smoothstep(w, w * 0.18, abs(a));

    // Organic droop for outer rings
    let droop = max(0.0, r - baseR) * 0.12 * (n / 12.0) * (1.0 - expand * 0.35);
    let aDroop = a + droop;
    let angularDroop = smoothstep(w, w * 0.22, abs(aDroop));

    var mask = radial * angularDroop;

    // --- Edge glow ---
    // Brighter where the petal edge is thinnest
    let edge = smoothstep(w * 0.75, w * 0.15, abs(aDroop)) *
               smoothstep(tip * 0.92, tip * 0.55, r);

    // --- Vein detail ---
    let veins = sin(r * 28.0 - abs(aDroop) * 14.0 + t * 0.6 + n) * 0.5 + 0.5;
    let veinMask = mask * smoothstep(0.5, 0.15, abs(aDroop) / w) *
                   smoothstep(baseR + 0.05, baseR + 0.15, r);

    // --- Depth / translucency ---
    let depth = smoothstep(0.0, 0.18, r) *
                (1.0 - smoothstep(tip * 0.75, tip * 1.05, r));

    let body = mask * 0.32;
    let veinCol = veinMask * veins * 0.14;
    let edgeCol = edge * 0.45;

    return (body + veinCol + edgeCol) * color * depth;
}

// ------------------------------------------------------------------
// Central Sacred Symbol
// ------------------------------------------------------------------
// Horizontal luminous lens (vesica piscis / infinity-like) with
// nested glowing rings, soft bloom, and a horizontal flare.
// ------------------------------------------------------------------
fn sacredSymbol(
    uv: vec2<f32>,
    t: f32,
    expand: f32,
    intensity: f32,
    chakraPhase: f32
) -> vec3<f32> {
    var col = vec3<f32>(0.0);

    // Symbol geometry pulse
    let symPulse = 1.0 + 0.07 * sin(t * 2.8) * (0.5 + intensity);
    let sx = 0.155 * symPulse * (1.0 + expand * 0.12);
    let sy = 0.085 * symPulse * (1.0 + expand * 0.06);

    // Ellipse SDF (scaled to lens shape)
    let d = length(vec2<f32>(uv.x / max(sx, 0.0001), uv.y / max(sy, 0.0001))) - 1.0;

    // Nested ring offsets
    let r1 = abs(d) - 0.014;
    let r2 = abs(d) - 0.034;
    let r3 = abs(d) - 0.062;

    // Glow falloffs
    let core = 0.013 / (abs(d) + 0.006);
    let g1   = 0.007 / (abs(r1) + 0.003);
    let g2   = 0.004 / (abs(r2) + 0.005);
    let g3   = 0.002 / (abs(r3) + 0.009);

    // Phase-tinted color
    var c = vec3<f32>(1.0, 0.92, 0.72);
    if (chakraPhase < 0.5) {
        c = vec3<f32>(0.78, 0.95, 1.0);   // inhale  : cool white-blue
    } else if (chakraPhase < 1.5) {
        c = vec3<f32>(1.0, 0.78, 0.92);   // hold1   : rose-gold
    } else if (chakraPhase < 2.5) {
        c = vec3<f32>(1.0, 0.94, 0.68);   // exhale  : warm gold
    } else {
        c = vec3<f32>(0.9, 0.96, 1.0);    // hold2   : soft silver
    }

    // Breath brightness envelope
    let bright = 0.65 + expand * 1.0 + intensity * 0.4;

    col += core * c * bright * 2.0;
    col += g1   * c * bright * 1.3;
    col += g2   * c * bright * 0.75;
    col += g3   * c * bright * 0.35;

    // Inner luminous fill
    let fill = smoothstep(0.018, -0.008, d);
    col += fill * c * bright * 0.55;

    // Horizontal axial flare (the "bright bar" look)
    let flare = exp(-abs(uv.y) * 50.0) * exp(-abs(uv.x) * 3.2) * (0.35 + expand * 0.65);
    col += flare * c * 0.75;

    // Central point bloom
    col += exp(-length(uv) * 22.0) * c * (0.45 + expand * 0.9) * 0.8;

    return col;
}

// ------------------------------------------------------------------
// Main entry — Lotus + Sacred Symbol
// ------------------------------------------------------------------
// Call this from your fragment shader to obtain the full RGB
// contribution.  Composite with `+=` or `mix()` depending on how
// you want it to blend with your background.
// ------------------------------------------------------------------
fn lotusAndSymbol(
    uv: vec2<f32>,
    t: f32,
    breath: f32,
    intensity: f32,
    chakraPhase: f32
) -> vec3<f32> {
    var col = vec3<f32>(0.0);

    // --------------------------------------------------------------
    // Derive breath expand factor from breathPhase + chakraPhase
    // --------------------------------------------------------------
    // `breath` is 0..1 over the full 4-phase cycle.  Each phase
    // occupies roughly 0.25 of the range.
    // --------------------------------------------------------------
    var phaseProgress = fract(breath * 4.0);
    // Snap to the actual phase so we don't get boundary glitches
    if (breath < 0.23) {
        phaseProgress = breath / 0.25;
    } else if (breath < 0.48) {
        phaseProgress = (breath - 0.25) / 0.25;
    } else if (breath < 0.73) {
        phaseProgress = (breath - 0.50) / 0.25;
    } else {
        phaseProgress = (breath - 0.75) / 0.25;
    }
    phaseProgress = clamp(phaseProgress, 0.0, 1.0);

    var expand = 0.0;
    if (chakraPhase < 0.5) {
        // inhale  : opening
        expand = phaseProgress;
    } else if (chakraPhase < 1.5) {
        // hold1   : fully open with subtle pulse
        expand = 1.0;
    } else if (chakraPhase < 2.5) {
        // exhale  : gentle release
        expand = 1.0 - phaseProgress;
    } else {
        // hold2   : resting / calm
        expand = 0.0;
    }
    // Smooth ease-in-out
    expand = expand * expand * (3.0 - 2.0 * expand);

    // Subtle continuous shimmer even in hold phases
    let shimmer = 0.03 * sin(t * 1.6 + breath * 12.566) * intensity;
    expand += shimmer;

    // --------------------------------------------------------------
    // Lotus petal layers (inner → outer)
    // --------------------------------------------------------------
    let glowMult = 0.75 + expand * 0.65 + intensity * 0.25;

    // Layer 1 — inner ring (8 petals, rose)
    col += lotusLayer(
        uv, t, 8.0, 0.42, 0.16, 0.06, 0.000 + t * 0.020,
        expand, vec3<f32>(1.0, 0.72, 0.82)
    ) * glowMult;

    // Layer 2 — middle ring (12 petals, violet)
    col += lotusLayer(
        uv, t, 12.0, 0.60, 0.20, 0.10, 0.262 + t * 0.014,
        expand, vec3<f32>(0.88, 0.52, 0.96)
    ) * glowMult;

    // Layer 3 — outer ring (16 petals, sky blue / cyan)
    col += lotusLayer(
        uv, t, 16.0, 0.76, 0.24, 0.14, 0.131 + t * 0.008,
        expand, vec3<f32>(0.52, 0.78, 1.0)
    ) * glowMult;

    // Layer 4 — subtle outer whisps (20 petals, very soft)
    col += lotusLayer(
        uv, t, 20.0, 0.92, 0.28, 0.18, 0.000 - t * 0.005,
        expand * 0.7, vec3<f32>(0.68, 0.88, 1.0)
    ) * glowMult * 0.55;

    // --------------------------------------------------------------
    // Central sacred symbol
    // --------------------------------------------------------------
    col += sacredSymbol(uv, t, expand, intensity, chakraPhase);

    // --------------------------------------------------------------
    // Global lotus aura
    // --------------------------------------------------------------
    let aura = exp(-length(uv) * 3.2) * (0.12 + expand * 0.18) * intensity;
    col += aura * vec3<f32>(0.75, 0.65, 1.0);

    return col;
}

// ============================================================
// Example fs_main integration (do not paste this verbatim
// unless you are replacing the entire fragment stage):
// ============================================================
//
// @fragment
// fn main(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
//     var uv = (fragCoord.xy - 0.5 * u.resolution) / u.resolution.y;
//     let breath = u.breathPhase;
//
//     // --- your background first ---
//     var col = cosmicBackground(uv, u.time);
//     col += volumetricShafts(uv * 0.85, u.time, breath);
//
//     // --- add the lotus ---
//     col += lotusAndSymbol(uv, u.time, breath, u.intensity, u.chakraPhase);
//
//     // --- post-processing ---
//     let vig = pow(1.0 - length(uv) * 0.72, 1.85);
//     col *= vig * 1.32;
//     col = pow(col, vec3<f32>(0.83));
//     return vec4<f32>(col, 1.0);
// }
//
// ============================================================
