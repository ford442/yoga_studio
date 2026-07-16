// ============================================================
// ENERGY RIBBONS / PRANA FLOW MODULE
// ============================================================
// Integration Guide:
//   1. Paste these helpers + functions into your fragment shader
//      (e.g. sacred-monk.wgsl) alongside the lotus module.
//   2. In fs_main, composite after background, typically before
//      or mixed with the lotus depending on desired depth:
//        let flowCol = energyRibbons(uv, u.time, u.breathPhase,
//                                    u.intensity, u.chakraPhase);
//        col += flowCol;
//   3. No new uniforms are required.
//
// Breath Mapping:
//   `chakraPhase` : 0=inhale, 1=hold1, 2=exhale, 3=hold2
//   `breathPhase` : 0..1 over the full 4-phase cycle
//   Ribbons contract & brighten on inhale, expand & soften on
//   exhale, and pulse gently during holds.
// ============================================================

// ------------------------------------------------------------------
// Math helpers (safe to add; skip if already present in shader)
// ------------------------------------------------------------------

fn pmod(a: f32, b: f32) -> f32 {
    return a - floor(a / b) * b;
}

fn hash21(p: vec2<f32>) -> f32 {
    let n = fract(dot(p, vec2<f32>(127.1, 311.7)));
    return fract(n * 43758.5453123);
}

// ------------------------------------------------------------------
// Value noise + FBM for organic ribbon distortion
// ------------------------------------------------------------------

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

// ------------------------------------------------------------------
// Single ribbon strand
// ------------------------------------------------------------------
// `uv`       — centered, aspect-corrected fragment coords
// `t`        — elapsed time
// `orbitR`   — orbital radius of this ribbon ring
// `n`        — number of spiral twists around the circle
// `speed`    — angular flow speed
// `twist`    — radial-to-angular spiral coupling (higher = tighter spiral)
// `phase`    — per-strand angular offset
// `width`    — radial thickness of the ribbon tube
// `color`    — base tint
// `expand`   — 0..1 breath-driven aperture (from energyRibbons)
// `intensity`— global intensity uniform
// ------------------------------------------------------------------
fn ribbonStrand(
    uv: vec2<f32>,
    t: f32,
    orbitR: f32,
    n: f32,
    speed: f32,
    twist: f32,
    phase: f32,
    width: f32,
    color: vec3<f32>,
    expand: f32,
    intensity: f32
) -> vec3<f32> {
    let r = length(uv);
    let a = atan2(uv.y, uv.x);

    // Organic distortion using FBM — gives the stream a living,
    // ever-changing quality rather than a rigid geometric curve.
    let distort = fbm2(uv * 1.8 + vec2<f32>(orbitR * 5.0, phase * 2.0), t * 0.35) * 0.55;

    // Flowing spiral phase: angle wraps with time, couples to radius
    // for helical motion, and picks up the noise distortion.
    let spiralPhase = a * n + t * speed + twist * (r - orbitR) + phase + distort;

    // Multi-octave wave composition creates richer, more detailed
    // ribbon texture with natural-looking heads and tails.
    let wave1 = sin(spiralPhase);
    let wave2 = sin(spiralPhase * 2.1 + 0.9);
    let wave3 = sin(spiralPhase * 0.65 - 1.1);
    var flow = wave1 * 0.50 + wave2 * 0.30 + wave3 * 0.20;
    flow = flow * 0.5 + 0.5; // remap to 0..1

    // Sharpen to create distinct flowing segments with soft tails
    let segment = pow(flow, 3.0);

    // Radial tube mask — soft gaussian falloff from the orbit radius
    let radialDist = abs(r - orbitR);
    let radialMask = exp(-radialDist * radialDist / (width * width * 0.45));

    // Fade ribbons smoothly near the center to avoid hard
    // intersection artifacts at the origin.
    let centerFade = smoothstep(0.0, 0.12, r);

    // Toroidal side bias: ribbons feel stronger on left & right,
    // suggesting energy rising up one side and descending the other.
    let sideBias = pow(abs(cos(a)), 0.45) * 0.35 + 0.65;

    // Core ribbon
    var ribbon = segment * radialMask * centerFade * sideBias;

    // Soft outer halo — gives the stream volumetric glow
    let halo = exp(-radialDist * radialDist / (width * width * 2.2)) * flow * 0.22;
    ribbon += halo;

    // Flowing color shift along the ribbon length
    let colorShift = sin(spiralPhase * 0.35 + t * 0.4 + phase) * 0.5 + 0.5;
    let flowColor = mix(color, color * vec3<f32>(1.15, 0.85, 1.25), colorShift * 0.35);

    // Breath brightness envelope
    let bright = (0.38 + expand * 0.85 + intensity * 0.32);

    return ribbon * flowColor * bright;
}

// ------------------------------------------------------------------
// Main entry — Energy Ribbons / Prana Flows
// ------------------------------------------------------------------
// Returns an RGB contribution for the full ribbon system.
// Composite with `+=` or `mix()` as desired.
// ------------------------------------------------------------------
fn energyRibbons(
    uv: vec2<f32>,
    t: f32,
    breath: f32,
    intensity: f32,
    chakraPhase: f32
) -> vec3<f32> {
    var col = vec3<f32>(0.0);

    // --------------------------------------------------------------
    // Derive breath expand factor (mirrors lotus logic for cohesion)
    // --------------------------------------------------------------
    var phaseProgress = fract(breath * 4.0);
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
        // inhale  : drawing inward, accelerating
        expand = phaseProgress;
    } else if (chakraPhase < 1.5) {
        // hold1   : condensed, bright, subtle pulse
        expand = 1.0;
    } else if (chakraPhase < 2.5) {
        // exhale  : releasing outward, decelerating
        expand = 1.0 - phaseProgress;
    } else {
        // hold2   : calm, orbital drift
        expand = 0.0;
    }
    expand = expand * expand * (3.0 - 2.0 * expand);

    // Hold-phase micro-pulse (heartbeat-like glow modulation)
    let holdPulse = 1.0 + 0.08 * sin(t * 3.5) * expand * intensity;

    // Breath-driven global parameters
    let flowSpeed = 1.0 + expand * 1.4;           // faster when inhaling
    let radiusShift = 1.0 - expand * 0.18;        // contract toward center on inhale
    let glowMult = 0.55 + expand * 0.95 + intensity * 0.28;

    // Slight upward drift during inhale (prana rising sensation)
    let driftUV = uv + vec2<f32>(0.0, expand * 0.04);

    // ==============================================================
    // Layer 1 — Inner Prana Streams (weave through inner lotus)
    // ==============================================================
    let r1 = 0.32 * radiusShift;
    col += ribbonStrand(driftUV, t, r1, 4.0, flowSpeed * 1.0, 6.0, 0.00,
                        0.038, vec3<f32>(1.0, 0.45, 0.65), expand, intensity)
           * glowMult * holdPulse;
    col += ribbonStrand(driftUV, t, r1, 4.0, flowSpeed * 1.0, 6.0, 3.14159,
                        0.038, vec3<f32>(0.85, 0.40, 0.75), expand, intensity)
           * glowMult * holdPulse;

    // ==============================================================
    // Layer 2 — Mid Energy Rings (between lotus layers)
    // ==============================================================
    let r2 = 0.58 * radiusShift;
    col += ribbonStrand(driftUV, t, r2, 6.0, flowSpeed * 1.2, 9.0, 0.60,
                        0.045, vec3<f32>(0.45, 0.75, 1.0), expand, intensity)
           * glowMult * 0.90 * holdPulse;
    col += ribbonStrand(driftUV, t, r2, 6.0, flowSpeed * 1.2, 9.0, 2.80,
                        0.045, vec3<f32>(0.55, 0.90, 0.70), expand, intensity)
           * glowMult * 0.90 * holdPulse;
    col += ribbonStrand(driftUV, t, r2, 6.0, flowSpeed * 1.2, 9.0, 4.50,
                        0.045, vec3<f32>(0.90, 0.55, 0.80), expand, intensity)
           * glowMult * 0.90 * holdPulse;

    // ==============================================================
    // Layer 3 — Outer Cosmic Streams (wrap around lotus perimeter)
    // ==============================================================
    let r3 = 0.92 * radiusShift;
    col += ribbonStrand(driftUV, t, r3, 8.0, flowSpeed * 0.85, 12.0, 1.10,
                        0.052, vec3<f32>(0.40, 0.70, 1.0), expand, intensity)
           * glowMult * 0.72 * holdPulse;
    col += ribbonStrand(driftUV, t, r3, 8.0, flowSpeed * 0.85, 12.0, 3.90,
                        0.052, vec3<f32>(0.70, 0.45, 0.95), expand, intensity)
           * glowMult * 0.72 * holdPulse;

    // ==============================================================
    // Layer 4 — Far Aura Whisps (very faint, expansive)
    // ==============================================================
    let r4 = 1.35 * radiusShift;
    col += ribbonStrand(driftUV, t, r4, 3.5, flowSpeed * 0.45, 5.0, 0.00,
                        0.075, vec3<f32>(0.50, 0.65, 0.95), expand, intensity)
           * glowMult * 0.38 * holdPulse;
    col += ribbonStrand(driftUV, t, r4, 3.5, flowSpeed * 0.45, 5.0, 2.09,
                        0.075, vec3<f32>(0.60, 0.55, 0.90), expand, intensity)
           * glowMult * 0.38 * holdPulse;

    // ==============================================================
    // Global phase tint (harmonizes with lotus chakra colors)
    // ==============================================================
    if (chakraPhase < 0.5) {
        // inhale  : cool, crystalline
        col *= vec3<f32>(0.88, 1.0, 1.12);
    } else if (chakraPhase < 1.5) {
        // hold1   : warm rose-gold amplification
        col *= vec3<f32>(1.12, 0.92, 1.0);
    } else if (chakraPhase < 2.5) {
        // exhale  : warm, golden release
        col *= vec3<f32>(1.06, 1.0, 0.88);
    } else {
        // hold2   : soft silver calm
        col *= vec3<f32>(0.94, 1.0, 1.06);
    }

    // --------------------------------------------------------------
    // Subtle connecting bridges — faint arcs that link the inner
    // and outer streams, making the system feel like one unified
    // toroidal field rather than separate rings.
    // --------------------------------------------------------------
    let r = length(driftUV);
    let a = atan2(driftUV.y, driftUV.x);
    let bridgePhase = a * 2.0 + t * 0.6 + expand * 2.0;
    let bridgeMask = exp(-abs(r - 0.70) * abs(r - 0.70) / 0.015)
                     * smoothstep(0.4, 0.8, sin(bridgePhase) * 0.5 + 0.5);
    let bridgeCol = vec3<f32>(0.75, 0.80, 1.0) * bridgeMask * 0.18 * glowMult;
    col += bridgeCol;

    return col;
}

// ============================================================
// Recommended fs_main integration pattern
// ============================================================
//
// @fragment
// fn main(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
//     var uv = (fragCoord.xy - 0.5 * u.resolution) / u.resolution.y;
//     let breath = u.breathPhase;
//
//     // 1. Background
//     var col = cosmicBackground(uv, u.time);
//     col += volumetricShafts(uv * 0.85, u.time, breath);
//
//     // 2. Energy ribbons (render before lotus so petals can
//     //    appear to sit in front, or after for glow layering)
//     col += energyRibbons(uv, u.time, breath, u.intensity, u.chakraPhase);
//
//     // 3. Lotus & sacred symbol
//     col += lotusAndSymbol(uv, u.time, breath, u.intensity, u.chakraPhase);
//
//     // 4. Post-process
//     let vig = pow(1.0 - length(uv) * 0.72, 1.85);
//     col *= vig * 1.32;
//     col = pow(col, vec3<f32>(0.83));
//     return vec4<f32>(col, 1.0);
// }
//
// ============================================================
// Tunable parameters (adjust these constants in the function
// body to tweak the visual without changing the interface):
// ============================================================
//
// | Parameter        | Location            | Effect                         |
// |------------------|---------------------|--------------------------------|
// | flowSpeed        | energyRibbons()     | Base orbital velocity          |
// | radiusShift      | energyRibbons()     | Inhale contraction amount      |
// | glowMult         | energyRibbons()     | Overall brightness scalar      |
// | r1, r2, r3, r4   | Layer blocks        | Orbit radii for each layer     |
// | n (twist count)  | ribbonStrand calls  | Spirals per revolution         |
// | twist            | ribbonStrand calls  | Spiral tightness               |
// | width            | ribbonStrand calls  | Radial thickness of each tube  |
// | fbm scale        | ribbonStrand()      | Organic waviness               |
// | holdPulse        | energyRibbons()     | Hold-phase shimmer depth       |
//
// ============================================================
