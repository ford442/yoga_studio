// ============================================================================
// SACRED ULTRA — Master Yoga Meditation Shader
// ============================================================================
// Swarm-integrated composition merging:
//   • Background & Sacred Geometry Specialist (ultra-background.wgsl)
//   • Figure & Energy Systems Specialist       (ultra-figure.wgsl)
//   • Lotus & Post-Processing Specialist       (ultra-lotus.wgsl)
//
// Composition (back to front):
//   1. Background atmosphere  — nebula, stars, floating geometry, emanation rays
//   2. Volumetric light shafts
//   3. Sacred geometry rings  — hex/tri/circle + yantra + flower modes
//   4. Prana particles        — 32 breath-reactive orbiting lights
//   5. Energy ribbons         — FBM-warped toroidal prana streams
//   6. Figure aura            — nested elliptical energy shells
//   7. Human figure           — breath-driven arms, lotus/tai-chi/standing poses
//   8. Chakra column          — 7-chakra wave propagation + Sushumna nadi
//   9. Lotus + sacred symbol  — 5-layer translucent petals, OM ring, bindu
//  10. Progress ring          — dual-ring phase + cycle indicator
//  11. Cinematic post-process — ACES tone map, bloom, grain, chromatic aberration
// ============================================================================

// ---------------------------------------------------------------------------
// Uniforms — must match WebGPUShader.tsx exactly (64 bytes)
// ---------------------------------------------------------------------------
struct Uniforms {
    time: f32,
    breathPhase: f32,
    intensity: f32,
    chakraPhase: f32,
    theme: f32,
    mandalaStyle: f32,
    phaseProgress: f32,      // 0..1 progress within the current breath phase
    strengthLevel: f32,      // 0.0=light, 1.0=regular, 2.0=strong
    mouse: vec2<f32>,
    mouseStrength: f32,
    chakraFocus: f32,        // -1=none, 0..6=root..crown (repurposed padding slot)
    resolution: vec2<f32>,
    geometryDensity: f32,    // detail multiplier for geometry/petals/ring counts
    interference: f32,       // moire / recursive layer motion strength
}

@group(0) @binding(0) var<uniform> u: Uniforms;

// ---------------------------------------------------------------------------
// Vertex shader — full-screen triangle
// ---------------------------------------------------------------------------
@vertex
fn vs(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4<f32> {
    let pos = array<vec2<f32>, 6>(
        vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(-1.0, 1.0),
        vec2<f32>(-1.0, 1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0)
    );
    return vec4<f32>(pos[vertexIndex], 0.0, 1.0);
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const PI: f32 = 3.14159265359;
const TAU: f32 = 6.28318530718;
const GOLDEN_ANGLE: f32 = 2.39996323;
const CHAKRA = array<vec3<f32>, 7>(
    vec3<f32>(0.90, 0.12, 0.18), // root
    vec3<f32>(0.98, 0.45, 0.12), // sacral
    vec3<f32>(0.98, 0.85, 0.20), // solar
    vec3<f32>(0.25, 0.85, 0.45), // heart
    vec3<f32>(0.20, 0.55, 0.95), // throat
    vec3<f32>(0.35, 0.25, 0.80), // third-eye
    vec3<f32>(0.65, 0.30, 0.90), // crown
);

// ---------------------------------------------------------------------------
// Math helpers
// ---------------------------------------------------------------------------
fn pmod(a: f32, b: f32) -> f32 {
    return a - floor(a / b) * b;
}

fn rot2(a: f32) -> mat2x2<f32> {
    let c = cos(a);
    let s = sin(a);
    return mat2x2<f32>(c, -s, s, c);
}

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

fn fbmWarp(p: vec2<f32>, t: f32, octaves: i32) -> f32 {
    let q = vec2<f32>(
        fbm2(p * 0.85 + vec2<f32>(1.7, -2.3), t * 0.7),
        fbm2(p * 0.85 + vec2<f32>(-3.1, 2.1), t * 0.7)
    );

    var sum = 0.0;
    var amp = 0.5;
    var freq = 1.0;
    for (var i = 0; i < 6; i++) {
        if (i >= octaves) { break; }
        let warped = (p + q * 0.8) * freq + vec2<f32>(t * 0.12, -t * 0.09);
        sum += amp * noise2(warped);
        amp *= 0.5;
        freq *= 2.17;
    }
    return sum;
}

// ---------------------------------------------------------------------------
// SDF primitives
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Color helper
// ---------------------------------------------------------------------------
fn hsv2rgb(h: f32, s: f32, v: f32) -> vec3<f32> {
    let k = vec3<f32>(1.0, 0.666666667, 0.333333333);
    let p = abs(fract(vec3<f32>(h) + k) * 6.0 - vec3<f32>(3.0));
    return v * mix(vec3<f32>(1.0), clamp(p - vec3<f32>(1.0), vec3<f32>(0.0), vec3<f32>(1.0)), s);
}

// ---------------------------------------------------------------------------
// Breath helper — shared by all modules
// ---------------------------------------------------------------------------
fn deriveBreathExpand() -> f32 {
    var expand: f32 = 0.0;
    if (u.chakraPhase < 0.5) {
        expand = u.phaseProgress;
    } else if (u.chakraPhase < 1.5) {
        expand = 1.0;
    } else if (u.chakraPhase < 2.5) {
        expand = 1.0 - u.phaseProgress;
    } else {
        expand = 0.0;
    }
    return expand * expand * (3.0 - 2.0 * expand);
}

fn chakraColor(index: f32) -> vec3<f32> {
    let idx = u32(clamp(index, 0.0, 6.0));
    return CHAKRA[idx];
}

fn breathColor() -> vec3<f32> {
    let s = smoothstep(0.0, 1.0, u.phaseProgress);
    if (u.chakraPhase < 0.5) {
        return mix(CHAKRA[0], CHAKRA[1], s);          // inhale: root -> sacral
    } else if (u.chakraPhase < 1.5) {
        return mix(CHAKRA[2], CHAKRA[6], s);          // hold1: solar -> crown
    } else if (u.chakraPhase < 2.5) {
        return mix(CHAKRA[3], CHAKRA[4], s);          // exhale: heart -> throat
    }
    return mix(CHAKRA[5], CHAKRA[5] * 0.15, s);       // hold2: indigo -> stillness
}

fn focusedBreathColor() -> vec3<f32> {
    let base = breathColor();
    if (u.chakraFocus < 0.0) {
        return base;
    }
    let focus = chakraColor(u.chakraFocus);
    let focusMix = 0.30 + 0.10 * u.intensity;
    return mix(base, focus, focusMix);
}

// ---------------------------------------------------------------------------
// Kaleidoscope polar repetition
// ---------------------------------------------------------------------------
fn kalei(p: vec2<f32>, n: f32) -> vec2<f32> {
    let angle = TAU / n;
    let a = atan2(p.y, p.x) + angle * 0.5;
    let r = length(p);
    let c = floor(a / angle);
    let new_a = a - c * angle - angle * 0.5;
    return vec2<f32>(cos(new_a), sin(new_a)) * r;
}

// ---------------------------------------------------------------------------
// Micro-geometry helpers — dot lattices, vesica piscis chains, golden seeds
// ---------------------------------------------------------------------------
fn dotLattice(uv: vec2<f32>, t: f32, density: f32) -> vec3<f32> {
    let r = length(uv);
    var col = vec3<f32>(0.0);
    let ringCount = i32(clamp(3.0 + density * 4.0, 3.0, 9.0));
    let dotCountBase = 8.0 + density * 12.0;
    for (var i = 0; i < ringCount; i++) {
        let fi = f32(i);
        let rr = 0.08 + fi * 0.055 * (1.0 + density * 0.15);
        let band = exp(-abs(r - rr) * 35.0);
        let dots = i32(clamp(dotCountBase + fi * 4.0, 4.0, 36.0));
        for (var d = 0; d < dots; d++) {
            let fd = f32(d);
            let ang = fd * TAU / f32(dots) + t * 0.12 * (1.0 + fi * 0.2);
            let p = vec2<f32>(cos(ang), sin(ang)) * rr;
            let dd = length(uv - p) - 0.0055 * (1.0 + density * 0.25);
            let glow = exp(-abs(dd) * 130.0);
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
        let a = fi * TAU / f32(count) + t * 0.2;
        let r = radius * (0.85 + 0.15 * sin(t + fi));
        let c1 = center + vec2<f32>(cos(a), sin(a)) * r;
        let c2 = center + vec2<f32>(cos(a + TAU / f32(count) * 0.5), sin(a + TAU / f32(count) * 0.5)) * r * 0.7;
        let d1 = length(uv - c1) - 0.018 * density;
        let d2 = length(uv - c2) - 0.018 * density;
        let vesica = abs(max(d1, d2));
        col += exp(-vesica * 70.0) * vec3<f32>(1.0, 0.92, 0.72) * 0.12;
    }
    return col;
}

fn goldenSeedField(uv: vec2<f32>, center: vec2<f32>, count: i32, t: f32, density: f32) -> vec3<f32> {
    var col = vec3<f32>(0.0);
    let n = clamp(count + i32(density * 18.0), 6, 48);
    for (var i = 0; i < n; i++) {
        let fi = f32(i);
        let r = 0.02 + sqrt(fi) * 0.018 * density;
        let a = fi * GOLDEN_ANGLE + t * 0.2;
        let p = center + vec2<f32>(cos(a), sin(a)) * r;
        let d = length(uv - p) - 0.004 * (1.0 + density * 0.3);
        let glow = exp(-abs(d) * 160.0);
        let c = 0.6 + 0.4 * cos(vec3<f32>(0.0, 2.0, 4.0) + fi * 0.25);
        col += glow * c * 0.15;
    }
    return col;
}

// ============================================================================
// MODULE 1 — BACKGROUND ATMOSPHERE (Agent: Background & Geometry Specialist)
// ============================================================================

fn twinkleStars(uv: vec2<f32>, t: f32, breath: f32, expand: f32) -> vec3<f32> {
    var col = vec3<f32>(0.0);
    let starWarmth = 1.0 + expand * 0.15;

    let s1 = hash21(floor(uv * 42.0) + 100.0);
    let tw1 = sin(t * 0.7 + s1 * TAU) * 0.5 + 0.5;
    col += vec3<f32>(0.60, 0.62, 0.88) * starWarmth
         * smoothstep(0.982, 1.0, s1) * tw1 * 0.45;

    let s2 = hash21(floor(uv * 78.0) + 200.0);
    let tw2 = sin(t * 1.2 + s2 * TAU) * 0.5 + 0.5;
    col += vec3<f32>(0.68, 0.66, 0.92) * starWarmth
         * smoothstep(0.990, 1.0, s2) * tw2 * 0.32;

    let s3 = hash21(floor(uv * 130.0) + 300.0);
    let tw3 = sin(t * 1.9 + s3 * TAU) * 0.5 + 0.5;
    col += vec3<f32>(0.78, 0.72, 0.95) * starWarmth
         * smoothstep(0.994, 1.0, s3) * tw3 * 0.20;

    col *= (0.8 + expand * 0.22);
    return col;
}

fn nebulaDust(uv: vec2<f32>, t: f32, breath: f32, expand: f32) -> vec3<f32> {
    let r = length(uv);
    var col = vec3<f32>(0.0);

    let n1 = fbm2(uv * 0.7 + vec2<f32>(t * 0.015,  t * 0.012), t * 0.08);
    let n2 = fbm2(uv * 1.0 + vec2<f32>(-t * 0.012, t * 0.008), t * 0.06);
    let n3 = fbm2(uv * 1.6 + vec2<f32>( t * 0.010, -t * 0.015), t * 0.05);

    col += vec3<f32>(0.012, 0.006, 0.024) * n1 * exp(-r * r * 1.8)
         * (0.6 + expand * 0.35);
    col += vec3<f32>(0.014, 0.008, 0.016) * n2 * exp(-r * r * 2.5)
         * (0.5 + expand * 0.25);
    col += vec3<f32>(0.005, 0.008, 0.020) * n3 * exp(-r * r * 3.5) * 0.35;

    return col;
}

fn geometryFragment(uv: vec2<f32>, n: f32, size: f32, rot: f32, breath: f32) -> vec3<f32> {
    let r = length(uv);
    let a = atan2(uv.y, uv.x) + rot;
    let sector = TAU / n;
    let sa = pmod(a, sector) - sector * 0.5;

    let d = abs(r - size * 0.5) + abs(sa) * r * 1.8;
    let shape = smoothstep(size * 0.22, 0.0, d);
    let glow = exp(-d * d * 60.0) * 0.4;
    let fade = smoothstep(0.0, 0.02, r)
             * (1.0 - smoothstep(size * 0.85, size * 1.3, r));

    return (shape * 0.12 + glow) * fade
         * vec3<f32>(0.65, 0.55, 0.85) * (0.42 + breath * 0.08);
}

fn floatingGeometry(uv: vec2<f32>, t: f32, breath: f32, expand: f32) -> vec3<f32> {
    var col = vec3<f32>(0.0);

    let p1 = rot2(t * 0.035) * (uv - vec2<f32>(-1.15, 0.65));
    col += geometryFragment(p1, 6.0, 0.16, 0.0, breath) * 0.9;

    let p2 = rot2(-t * 0.025) * (uv - vec2<f32>(1.05, -0.55));
    col += geometryFragment(p2, 8.0, 0.20, 1.2, breath) * 0.7;

    let p3 = rot2(t * 0.018) * (uv - vec2<f32>(0.85, 0.85));
    col += geometryFragment(p3, 5.0, 0.12, 2.5, breath) * 0.5;

    let p4 = rot2(-t * 0.022) * (uv - vec2<f32>(-0.75, -0.85));
    col += geometryFragment(p4, 7.0, 0.14, 0.8, breath) * 0.6;

    let p5 = rot2(t * 0.015) * (uv - vec2<f32>(1.4, 0.2));
    col += geometryFragment(p5, 6.0, 0.10, 3.0, breath) * 0.35;

    return col;
}

fn emanationRays(uv: vec2<f32>, t: f32, breath: f32, expand: f32) -> vec3<f32> {
    var col = vec3<f32>(0.0);
    let a = atan2(uv.y, uv.x);
    let r = length(uv);

    for (var i = 0; i < 6; i++) {
        let fi = f32(i);
        let ray = pow(max(0.0, cos(a - t * 0.025 + fi * PI / 3.0)), 10.0);
        let fade = exp(-r * (1.6 + fi * 0.25));
        col += ray * fade * vec3<f32>(0.42, 0.32, 0.68)
             * (0.10 + expand * 0.12);
    }

    let bloom = exp(-r * r * 3.5) * (0.04 + expand * 0.06);
    col += bloom * vec3<f32>(0.48, 0.38, 0.78);

    let cross = pow(abs(cos(a * 2.0)), 16.0) + pow(abs(sin(a * 2.0)), 16.0);
    col += cross * exp(-r * r * 2.0) * 0.022
         * vec3<f32>(0.62, 0.52, 0.88);

    return col;
}

fn backgroundAtmosphere(uv: vec2<f32>, t: f32, breath: f32, expand: f32) -> vec3<f32> {
    let r = length(uv);
    var col = vec3<f32>(0.003, 0.0015, 0.010);
    col += nebulaDust(uv, t, breath, expand);
    col += twinkleStars(uv, t, breath, expand);
    col += floatingGeometry(uv, t, breath, expand);
    col += emanationRays(uv, t, breath, expand);
    col += vec3<f32>(0.006, 0.003, 0.016)
         * exp(-r * r * 2.5) * (0.35 + expand * 0.30);
    return col;
}

fn lightShafts(uv: vec2<f32>, t: f32, breath: f32, expand: f32) -> vec3<f32> {
    var col = vec3<f32>(0.0);
    let a = atan2(uv.y, uv.x);
    let r = length(uv);

    for (var i = 0; i < 3; i++) {
        let fi = f32(i);
        let beam = pow(max(0.0, cos(a - t * 0.06 + fi * TAU / 3.0)), 20.0);
        let fade = exp(-r * (2.4 + fi * 0.4));
        col += beam * fade * vec3<f32>(0.52, 0.40, 0.88)
             * (0.18 + expand * 0.30);
    }
    return col * 0.38;
}

fn godRays(uv: vec2<f32>, t: f32, intensity: f32, expand: f32) -> vec3<f32> {
    let r = length(uv);
    let dir = normalize(uv + vec2<f32>(1e-4, 1e-4));
    let steps = 10;
    var acc = 0.0;

    var phaseScale = 0.0;
    if (u.chakraPhase < 0.5) {
        phaseScale = u.phaseProgress;
    } else if (u.chakraPhase < 1.5) {
        phaseScale = 1.0;
    } else if (u.chakraPhase < 2.5) {
        phaseScale = 1.0 - u.phaseProgress * 0.8;
    } else {
        phaseScale = 0.0;
    }

    for (var i = 0; i < steps; i++) {
        let s = (f32(i) + 0.5) / f32(steps);
        let sp = uv - dir * s * 0.9;
        let sa = atan2(sp.y, sp.x);
        let n = fbm2(sp * 3.0 + vec2<f32>(0.0, t * 0.08), t * 0.12);
        let shafts = pow(max(0.0, cos(sa * 6.0 - t * 0.22 + n * 1.7)), 4.0);
        acc += shafts * (1.0 - s) * (0.6 + 0.4 * n);
    }

    let falloff = exp(-r * 1.45) * (0.45 + expand * 0.55);
    let strength = intensity * phaseScale;
    let rayCol = vec3<f32>(0.55, 0.45, 0.85);
    return rayCol * (acc / f32(steps)) * falloff * strength * 1.35;
}

// ============================================================================
// MODULE 2 — SACRED GEOMETRY RINGS & PRANA PARTICLES
// ============================================================================

fn sacredGeometryRings(uv: vec2<f32>, t: f32, breath: f32, expand: f32) -> vec3<f32> {
    var col = vec3<f32>(0.0);
    let phaseColor = focusedBreathColor();

    let isYantra = u.mandalaStyle > 0.5 && u.mandalaStyle < 1.5;
    let isFlower = u.mandalaStyle > 1.5;
    let isLotus = !(isYantra || isFlower);

    let density = clamp(u.geometryDensity + u.intensity * 0.25, 0.2, 3.0);
    let breathe = expand * 0.12 * (1.0 + 0.05 * u.intensity * sin(t * 3.0));

    if (isLotus) {
        let hexN = 6.0 + floor(density * 4.0);
        let hexUV = kalei(uv, hexN);
        let hexRot = t * 0.05 * (1.0 + u.interference * 0.3) + u.phaseProgress * 0.1;
        let hexR = rot2(hexRot) * hexUV;
        let hexD = abs(length(hexR) - (0.75 + breathe)) - 0.015;
        let hexGlow = exp(-abs(hexD) * 40.0);
        col += hexGlow * phaseColor * 0.5;

        let triN = 3.0 + floor(density * 2.0);
        let triUV = kalei(uv, triN);
        let triRot = -t * 0.08 * (1.0 + u.interference * 0.5) - u.phaseProgress * 0.15;
        let triR = rot2(triRot) * triUV;
        let triD = abs(length(triR) - (0.55 + breathe * 0.8)) - 0.012;
        let triGlow = exp(-abs(triD) * 45.0);
        col += triGlow * vec3<f32>(1.0, 0.85, 0.25) * 0.4;

        let ringCount = i32(clamp(2.0 + density * 3.0, 2.0, 7.0));
        for (var i = 0; i < ringCount; i++) {
            let fi = f32(i);
            let rad = 0.20 + fi * 0.08 + breathe * 0.3;
            let circleD = abs(length(uv) - rad) - 0.012;
            let circleGlow = exp(-abs(circleD) * 35.0);
            col += circleGlow * vec3<f32>(1.0, 0.95, 0.9) * (0.4 - fi * 0.04);
        }

        col += dotLattice(uv, t, density) * 0.35;

    } else if (isYantra) {
        let layerCount = i32(clamp(5.0 + density * 5.0, 5.0, 12.0));
        for (var i = 0; i < layerCount; i++) {
            let fi = f32(i);
            let layerScale = 0.12 + fi * 0.055 / (1.0 + density * 0.1);
            let triDir = select(-1.0, 1.0, (i % 2) == 0);
            let triRot = triDir * (t * 0.03 * (1.0 + u.interference * 0.4) + fi * 0.25);
            let kUV = kalei(uv, 3.0);
            let rUV = rot2(triRot) * kUV;
            let triD = abs(length(rUV) - layerScale * (1.0 + breathe)) - 0.006;
            let glow = exp(-abs(triD) * 55.0);
            let layerColor = mix(phaseColor, vec3<f32>(1.0, 0.85, 0.4), fi * 0.12);
            col += glow * layerColor * (0.32 - fi * 0.025);
        }

        let circleCount = i32(clamp(3.0 + density * 3.0, 3.0, 8.0));
        for (var i = 0; i < circleCount; i++) {
            let fi = f32(i);
            let cR = 0.08 + fi * 0.075;
            let cD = abs(sdCircle(uv, cR * (1.0 + breathe * 0.3))) - 0.004;
            let cGlow = exp(-abs(cD) * 60.0);
            col += cGlow * vec3<f32>(1.0, 0.9, 0.7) * 0.22;

            let dotCount = 6u + u32(fi) * 3u + u32(density * 4.0);
            for (var d = 0u; d < 24u; d = d + 1u) {
                if (d >= dotCount) { break; }
                let fd = f32(d);
                let a = fd * TAU / f32(dotCount) + t * 0.1 * (1.0 + fi) * (1.0 + u.interference);
                let dp = vec2<f32>(cos(a), sin(a)) * cR * (1.0 + breathe * 0.3);
                let dDist = length(uv - dp) - 0.010;
                let dGlow = exp(-abs(dDist) * 90.0);
                col += dGlow * vec3<f32>(1.0, 0.95, 0.6) * 0.12;
            }
        }

        let tipCount = i32(clamp(3.0 + density * 3.0, 3.0, 8.0));
        for (var i = 0; i < tipCount; i++) {
            let fi = f32(i);
            let tipUV = kalei(uv, 3.0);
            let tipRot = t * 0.05 * (1.0 + u.interference) + fi * 0.4;
            let tipR = rot2(tipRot) * tipUV;
            let tipD = abs(length(tipR) - (0.06 + fi * 0.025)) - 0.003;
            col += exp(-abs(tipD) * 100.0) * phaseColor * (0.15 - fi * 0.015);
        }

    } else {
        let flowerN = 12.0 + floor(density * 8.0);
        let flowerUV = kalei(uv, flowerN);
        let pRot = rot2(t * 0.04 * (1.0 + u.interference * 0.35)) * flowerUV;
        let petalCenter = vec2<f32>(0.30 * (1.0 + breathe), 0.0);
        let petalD = length(pRot - petalCenter) - 0.09;
        let petalGlow = exp(-abs(petalD) * 40.0);
        col += petalGlow * phaseColor * 0.45;

        let centerD = abs(length(uv) - 0.10 * (1.0 + breathe * 0.5)) - 0.015;
        let centerGlow = exp(-abs(centerD) * 50.0);
        col += centerGlow * vec3<f32>(1.0, 0.95, 0.8) * 0.55;

        let seedCount = i32(clamp(21.0 + density * 30.0, 21.0, 60.0));
        for (var i = 0; i < seedCount; i++) {
            let fi = f32(i);
            let r = 0.04 + sqrt(fi) * 0.055 / (1.0 + density * 0.05);
            let a = fi * GOLDEN_ANGLE + t * 0.15 * (1.0 + u.interference * 0.5);
            let fp = vec2<f32>(cos(a), sin(a)) * r * (1.0 + breathe * 0.2);
            let fd = length(uv - fp) - 0.007;
            let fGlow = exp(-abs(fd) * 90.0);
            let fCol = 0.6 + 0.4 * cos(vec3<f32>(0.0, 2.0, 4.0) + fi * 0.3);
            col += fGlow * fCol * 0.18;
        }

        col += vesicaPiscisChain(uv, vec2<f32>(0.0), 12.0, 0.22, t, density) * 0.25;
    }

    return col;
}

fn layeredSacredGeometry(uv: vec2<f32>, t: f32, breath: f32, expand: f32) -> vec3<f32> {
    var col = vec3<f32>(0.0);
    let inter = u.interference;
    col += sacredGeometryRings(uv / 0.30, t * (1.30 + inter * 0.4) + 1.7, breath, expand) * 0.22;
    col += sacredGeometryRings(uv / 0.60, t * (0.90 - inter * 0.35) + 0.8, breath, expand) * 0.45;
    col += sacredGeometryRings(uv,        t * (1.0 + inter * 0.15),       breath, expand) * 1.00;
    return col;
}

fn pranaParticles(uv: vec2<f32>, t: f32, breath: f32, expand: f32) -> vec3<f32> {
    var col = vec3<f32>(0.0);
    let outward = u.chakraPhase < 1.5;
    let flowSpeed = 0.25 + 0.15 * u.intensity;

    for (var i: f32 = 0.0; i < 32.0; i += 1.0) {
        let seed = i * 13.37;
        let a = i * TAU / 32.0 + t * flowSpeed + hash21(vec2<f32>(seed, 0.0));
        let r = 0.15 + fract(seed + t * 0.3) * 0.6;

        let flow = select(1.0 - u.phaseProgress, u.phaseProgress, outward);
        let pulseRadius = 1.0 + 0.1 * u.intensity * sin(t * 3.0 + i);
        let dir = select(-1.0, 1.0, outward);
        let pos = vec2<f32>(cos(a), sin(a))
                * (r + flow * 0.1 * dir) * pulseRadius;

        let d = length(uv - pos);
        let intensity = exp(-d * 45.0);
        let hue = fract(i * 0.1 + t * 0.15 + u.chakraPhase * 0.1);
        let pcol = 0.6 + 0.4 * cos(vec3<f32>(0.0, 2.0, 4.0) + hue * 6.0);

        col += intensity * pcol * 1.2 * (0.8 + 0.4 * u.intensity);
    }

    return col;
}

// ============================================================================
// MODULE 3 — HUMAN FIGURE & ENERGY SYSTEMS (Agent: Figure & Energy Specialist)
// ============================================================================

fn humanFigure(uv: vec2<f32>, t: f32, breath: f32, expand: f32) -> vec3<f32> {
    var col = vec3<f32>(0.0);
    let p = (uv - vec2<f32>(0.0, -0.05)) / 0.75;

    let headPos  = vec2<f32>(0.0,  0.30 + expand * 0.012);
    let chestPos = vec2<f32>(0.0,  0.10 + expand * 0.015);
    let hipsPos  = vec2<f32>(0.0, -0.10);

    let phaseColor = focusedBreathColor();

    var themeColor = vec3<f32>(0.85, 0.90, 1.00);
    if (u.theme < 0.5) {
        themeColor = vec3<f32>(0.75, 0.85, 1.00);
    } else if (u.theme < 1.5) {
        themeColor = vec3<f32>(1.00, 0.85, 0.45);
    } else {
        themeColor = vec3<f32>(0.45, 0.90, 1.00);
    }

    let figurePulse = 1.0 + 0.02 * u.intensity * sin(t * 2.0);
    let animAmp = 0.01 * u.intensity * (0.6 + 0.4 * u.strengthLevel);
    let isLotus  = u.mandalaStyle < 0.5;
    let isTaiChi = u.mandalaStyle > 1.5;

    // Arm animation — smooth eased motion with tiny overshoot/settle
    var leftHand  = vec2<f32>(-0.25, -0.05);
    var rightHand = vec2<f32>( 0.25, -0.05);

    if (isTaiChi) {
        let flow = sin(t * 0.8) * 0.03 * u.intensity;
        leftHand  = vec2<f32>(-0.25,  0.45 + flow);
        rightHand = vec2<f32>( 0.25, -0.15 - flow);
    } else {
        if (u.chakraPhase < 0.5) {
            let pp = u.phaseProgress;
            let rise = pp * pp * (3.0 - 2.0 * pp);
            let overshoot = 0.015 * sin(pp * PI) * (0.5 + 0.5 * u.intensity);
            leftHand  = mix(vec2<f32>(-0.25, -0.05), vec2<f32>(-0.20, 0.52), rise) + vec2<f32>(0.0, overshoot);
            rightHand = mix(vec2<f32>( 0.25, -0.05), vec2<f32>( 0.20, 0.52), rise) + vec2<f32>(0.0, overshoot);
        } else if (u.chakraPhase < 1.5) {
            let sway = sin(t * 2.0) * animAmp;
            let pulse = 1.0 + 0.02 * sin(t * 3.0) * u.intensity;
            leftHand  = vec2<f32>(-0.20 + sway, 0.52 * pulse);
            rightHand = vec2<f32>( 0.20 - sway, 0.52 * pulse);
        } else if (u.chakraPhase < 2.5) {
            let pp = u.phaseProgress;
            let lower = pp * pp * (3.0 - 2.0 * pp);
            let settle = 0.012 * sin(pp * PI) * (0.5 + 0.5 * u.intensity);
            leftHand  = mix(vec2<f32>(-0.20, 0.52), vec2<f32>(-0.25, -0.05), lower) - vec2<f32>(0.0, settle);
            rightHand = mix(vec2<f32>( 0.20, 0.52), vec2<f32>( 0.25, -0.05), lower) - vec2<f32>(0.0, settle);
        } else {
            let idle = sin(t * 1.5) * animAmp;
            leftHand  = vec2<f32>(-0.25 + idle, -0.05);
            rightHand = vec2<f32>( 0.25 - idle, -0.05);
        }
    }

    if (!isTaiChi) {
        let sway = sin(t * 1.5) * animAmp;
        leftHand.x  += sway;
        rightHand.x -= sway;
    }

    // Head
    let headD = sdCircle((p - headPos) / figurePulse, 0.055);
    col += exp(-abs(headD) * 35.0) * themeColor * 0.5;

    // Torso — chest expands on inhale, hips stay grounded
    let chestD = sdCircle((p - chestPos) / figurePulse, 0.075 * (1.0 + expand * 0.12));
    let hipsD  = sdCircle((p - hipsPos)  / figurePulse, 0.065 * (1.0 + expand * 0.04));
    let torsoD = smin(chestD, hipsD, 0.08);
    col += exp(-abs(torsoD) * 30.0) * themeColor * 0.4;

    // Arms
    let leftArmD  = sdSegment(p, chestPos + vec2<f32>(-0.055, 0.04), leftHand)  - 0.022;
    let rightArmD = sdSegment(p, chestPos + vec2<f32>( 0.055, 0.04), rightHand) - 0.022;
    col += exp(-abs(leftArmD)  * 35.0) * themeColor * 0.45;
    col += exp(-abs(rightArmD) * 35.0) * themeColor * 0.45;

    // Hands
    let handGlow = 0.6 + 0.4 * u.intensity;
    let leftHandD  = sdCircle(p - leftHand,  0.025);
    let rightHandD = sdCircle(p - rightHand, 0.025);
    col += exp(-abs(leftHandD)  * 45.0) * phaseColor * handGlow;
    col += exp(-abs(rightHandD) * 45.0) * phaseColor * handGlow;

    // Legs
    if (isLotus) {
        let leftThigh  = sdSegment(p, hipsPos + vec2<f32>(-0.03, -0.02), vec2<f32>(-0.18, -0.22)) - 0.025;
        let leftShin   = sdSegment(p, vec2<f32>(-0.18, -0.22), vec2<f32>( 0.04, -0.28)) - 0.022;
        let rightThigh = sdSegment(p, hipsPos + vec2<f32>( 0.03, -0.02), vec2<f32>( 0.18, -0.22)) - 0.025;
        let rightShin  = sdSegment(p, vec2<f32>( 0.18, -0.22), vec2<f32>(-0.04, -0.28)) - 0.022;
        col += exp(-abs(leftThigh)  * 35.0) * themeColor * 0.40;
        col += exp(-abs(leftShin)   * 35.0) * themeColor * 0.35;
        col += exp(-abs(rightThigh) * 35.0) * themeColor * 0.40;
        col += exp(-abs(rightShin)  * 35.0) * themeColor * 0.35;
    } else if (isTaiChi) {
        let leftLeg  = sdSegment(p, hipsPos, vec2<f32>(-0.22, -0.42)) - 0.028;
        let rightLeg = sdSegment(p, hipsPos, vec2<f32>( 0.18, -0.35)) - 0.028;
        col += exp(-abs(leftLeg)  * 35.0) * themeColor * 0.40;
        col += exp(-abs(rightLeg) * 35.0) * themeColor * 0.40;
    } else {
        let leftLeg  = sdSegment(p, hipsPos, vec2<f32>(-0.12, -0.45)) - 0.028;
        let rightLeg = sdSegment(p, hipsPos, vec2<f32>( 0.12, -0.45)) - 0.028;
        col += exp(-abs(leftLeg)  * 35.0) * themeColor * 0.40;
        col += exp(-abs(rightLeg) * 35.0) * themeColor * 0.40;
    }

    // Body glow
    let bodyCenterD = sdCircle(p - vec2<f32>(0.0, 0.05), 0.15);
    col += exp(-abs(bodyCenterD) * 12.0) * phaseColor * 0.12 * (0.5 + expand * 0.5);

    return col;
}

fn chakraColumn(uv: vec2<f32>, t: f32, breath: f32, expand: f32) -> vec3<f32> {
    var col = vec3<f32>(0.0);
    let p = (uv - vec2<f32>(0.0, -0.05)) / 0.75;

    let positions = array<f32, 7>(-0.35, -0.20, -0.05, 0.10, 0.25, 0.40, 0.55);
    let sizes     = array<f32, 7>( 0.04,  0.035, 0.045, 0.04, 0.035, 0.03, 0.05);
    let hues      = array<f32, 7>( 0.00,  0.08,  0.16,  0.33, 0.58,  0.75, 0.83);

    var hueShift: f32 = 0.0;
    if (u.chakraPhase < 0.5) {
        hueShift = 0.05 * u.phaseProgress;
    } else if (u.chakraPhase < 1.5) {
        hueShift = 0.05;
    } else if (u.chakraPhase < 2.5) {
        hueShift = 0.05 - 0.13 * u.phaseProgress;
    } else {
        hueShift = -0.08;
    }

    let intensityMult = 1.0 + 0.4 * u.intensity;
    let globalPulse   = 1.0 + 0.1 * sin(t * 2.0) * u.intensity;

    for (var i: u32 = 0u; i < 7u; i++) {
        let fIdx = f32(i);
        let pos  = vec2<f32>(0.0, positions[i]);
        let dist = length(p - pos);
        let baseRadius = sizes[i] * globalPulse;

        var activation: f32 = 0.0;
        var pulse: f32 = 1.0;

        if (u.chakraPhase < 0.5) {
            let delay = fIdx * 0.15;
            let wavePos = u.phaseProgress * 1.5 - delay;
            if (wavePos > 0.0) {
                activation = 0.3 + 0.7 * smoothstep(0.0, 0.3, wavePos);
                activation = min(activation, 1.0);
            } else {
                activation = 0.3;
            }
            pulse = 1.0 + sin(t * 3.0 + fIdx * 0.5) * 0.05;
        } else if (u.chakraPhase < 1.5) {
            activation = 1.0;
            pulse = 1.0 + sin(t * 2.0) * 0.1;
        } else if (u.chakraPhase < 2.5) {
            let reverseIdx = 6.0 - fIdx;
            let delay = reverseIdx * 0.15;
            let wavePos = u.phaseProgress * 1.5 - delay;
            if (wavePos > 0.0) {
                activation = 1.0 - 0.6 * smoothstep(0.0, 0.3, wavePos);
                activation = max(activation, 0.4);
            } else {
                activation = 1.0;
            }
            pulse = 1.0 + sin(t * 1.5 + fIdx * 0.3) * 0.05;
        } else {
            activation = 0.2;
            pulse = 1.0 + sin(t * 1.0) * 0.05;
        }

        let radius     = baseRadius * (0.5 + 0.5 * activation);
        let glowRadius = radius + 0.15 + 0.1 * activation;
        let glow       = smoothstep(glowRadius, radius, dist);

        let ringDist   = abs(dist - radius * 1.5);
        let ringGlow   = smoothstep(0.08, 0.0, ringDist) * 0.3 * activation;

        let baseHue = hues[i];
        var shiftedHue = baseHue + hueShift;
        shiftedHue = shiftedHue - floor(shiftedHue);

        var saturation: f32 = 0.9;
        var value: f32 = activation * pulse;
        if (u.chakraPhase > 0.5 && u.chakraPhase < 1.5) {
            saturation = 1.0;
            value = min(value * 1.1, 1.0);
        }

        let chakraCol = hsv2rgb(shiftedHue, saturation, value);
        col += chakraCol * glow;
        col += chakraCol * ringGlow;

        if (u.chakraPhase < 0.5 && i < 6u) {
            let nextPos = vec2<f32>(0.0, positions[i + 1u]);
            let midPos  = (pos + nextPos) * 0.5;
            let midDist = length(p - midPos);
            let flowGlow = exp(-midDist * 25.0) * u.phaseProgress * 0.25;
            col += hsv2rgb(shiftedHue, 0.7, 1.0) * flowGlow;
        }
    }

    // Sushumna nadi
    if (p.y > -0.5 && p.y < 0.65) {
        let nadiD = abs(p.x) - 0.006;
        let nadiPulse = 1.0 + 0.2 * u.intensity * sin(t * 3.0);
        var nadiColor = vec3<f32>(0.9, 0.95, 1.0);
        if (u.chakraPhase < 0.5) {
            nadiColor = mix(nadiColor, vec3<f32>(1.0, 0.85, 0.4), u.phaseProgress * 0.5);
        } else if (u.chakraPhase > 1.5 && u.chakraPhase < 2.5) {
            nadiColor = mix(vec3<f32>(1.0, 0.85, 0.4), vec3<f32>(0.4, 0.85, 1.0), u.phaseProgress * 0.5);
        }
        col += exp(-abs(nadiD) * 50.0) * nadiColor * 0.3 * nadiPulse;
    }

    col *= intensityMult;
    let palette = focusedBreathColor();
    col = mix(col, col * (0.60 + palette * 0.95), 0.28);
    return col;
}

fn progressRing(uv: vec2<f32>, breath: f32, expand: f32) -> vec3<f32> {
    var col = vec3<f32>(0.0);
    let r = length(uv);
    let a = atan2(uv.y, uv.x);

    let phaseColor  = focusedBreathColor();
    let glowStrength = 0.8 + 0.4 * u.intensity;

    let normalizedAngle = (a + PI) / TAU;

    // Outer ring — phase progress
    let outerRingD = abs(r - 0.65) - 0.015;
    let progressAngle = u.phaseProgress;
    let inArc = select(0.0, 1.0, normalizedAngle < progressAngle);

    col += exp(-abs(outerRingD) * 50.0) * phaseColor * glowStrength * inArc;
    col += exp(-abs(outerRingD) * 20.0) * phaseColor * 0.15;

    let progressPos = vec2<f32>(
        cos(progressAngle * TAU - PI),
        sin(progressAngle * TAU - PI)
    ) * 0.65;
    let glowD = length(uv - progressPos);
    let pointGlow = 0.8 + 0.6 * sin(u.time * 4.0) * u.intensity;
    col += exp(-glowD * 30.0) * phaseColor * pointGlow;

    // Inner ring — cycle progress
    let innerRingD = abs(r - 0.52) - 0.010;
    let cycleAngle = u.breathPhase;
    let inCycleArc = select(0.0, 1.0, normalizedAngle < cycleAngle);

    var cycleColor = mix(vec3<f32>(0.60, 0.70, 1.00), focusedBreathColor(), 0.35);
    if (u.theme < 0.5) {
        cycleColor = vec3<f32>(0.50, 0.70, 1.00);
    } else if (u.theme < 1.5) {
        cycleColor = vec3<f32>(1.00, 0.80, 0.40);
    } else {
        cycleColor = vec3<f32>(0.40, 0.85, 0.90);
    }

    col += exp(-abs(innerRingD) * 55.0) * cycleColor * 0.70 * inCycleArc;
    col += exp(-abs(innerRingD) * 20.0) * cycleColor * 0.10;

    let cyclePos = vec2<f32>(
        cos(cycleAngle * TAU - PI),
        sin(cycleAngle * TAU - PI)
    ) * 0.52;
    let cycleGlowD = length(uv - cyclePos);
    col += exp(-cycleGlowD * 35.0) * cycleColor * 0.6;

    // Sacred geometry at center
    let hexAngle = atan2(uv.y, uv.x);
    let hexPattern = abs(sin(hexAngle * 6.0 + u.time * 0.3)) * 0.5 + 0.5;
    let hexD = abs(r - 0.08) - 0.004;
    col += exp(-abs(hexD) * 80.0) * phaseColor * 0.3 * hexPattern;

    let seedD = sdCircle(uv, 0.025);
    col += exp(-abs(seedD) * 60.0) * vec3<f32>(1.0, 0.95, 0.8) * 0.4;

    return col;
}

fn figureAura(uv: vec2<f32>, t: f32, breath: f32, expand: f32) -> vec3<f32> {
    var col = vec3<f32>(0.0);
    let p = (uv - vec2<f32>(0.0, -0.05)) / 0.75;

    var auraColor = focusedBreathColor();

    if (u.theme < 0.5) {
        auraColor *= vec3<f32>(0.8, 0.9, 1.0);
    } else if (u.theme < 1.5) {
        auraColor *= vec3<f32>(1.1, 0.9, 0.6);
    } else {
        auraColor *= vec3<f32>(0.7, 1.0, 1.0);
    }

    let ellipse1 = length(p * vec2<f32>(1.0, 1.35)) - (0.28 + expand * 0.08);
    let ellipse2 = length(p * vec2<f32>(1.0, 1.35)) - (0.38 + expand * 0.10);
    let ellipse3 = length(p * vec2<f32>(1.0, 1.35)) - (0.48 + expand * 0.12);

    col += exp(-abs(ellipse1) * 8.0) * auraColor * 0.12 * (0.6 + expand * 0.4);
    col += exp(-abs(ellipse2) * 6.0) * auraColor * 0.08 * (0.5 + expand * 0.3);
    col += exp(-abs(ellipse3) * 4.0) * auraColor * 0.05 * (0.4 + expand * 0.2);

    let shellRot1 = rot2(t * 0.25 + breath * 0.5);
    let shellRot2 = rot2(-t * 0.18 - breath * 0.3);
    let shellRot3 = rot2(t * 0.12);

    let s1 = length((shellRot1 * p) * vec2<f32>(1.0, 1.5)) - 0.35;
    let s2 = length((shellRot2 * p) * vec2<f32>(1.3, 1.0)) - 0.40;
    let s3 = length((shellRot3 * p) * vec2<f32>(1.0, 1.2)) - 0.45;

    col += exp(-abs(s1) * 10.0) * auraColor * 0.06;
    col += exp(-abs(s2) * 10.0) * auraColor * 0.05;
    col += exp(-abs(s3) * 10.0) * auraColor * 0.04;

    if (u.chakraPhase < 0.5) {
        let tendril = sin(p.x * 12.0 + t * 2.0) * 0.5 + 0.5;
        let tendrilMask = smoothstep(-0.5, 0.5, p.y) * smoothstep(0.5, -0.2, p.y);
        col += auraColor * tendril * tendrilMask * u.phaseProgress * 0.08 * exp(-abs(p.x) * 3.0);
    }

    return col;
}

// ---------------------------------------------------------------------------
// Geometry that frames/grows from the human figure, changing with pose
// ---------------------------------------------------------------------------
fn figureFramingGeometry(uv: vec2<f32>, t: f32, breath: f32, expand: f32) -> vec3<f32> {
    var col = vec3<f32>(0.0);
    let density = clamp(u.geometryDensity, 0.2, 3.0);
    let isLotus = u.mandalaStyle < 0.5;
    let isYantra = u.mandalaStyle > 0.5 && u.mandalaStyle < 1.5;
    let phaseColor = focusedBreathColor();

    // Heart and head positions in uv space (matches humanFigure mapping)
    let heartUV = vec2<f32>(0.0, 0.025);
    let headUV  = vec2<f32>(0.0, 0.175);

    if (isLotus) {
        let hexN = 6.0 + floor(density * 4.0);
        let hexUV = kalei(uv - heartUV, hexN);
        let hexD = abs(length(hexUV) - (0.16 + expand * 0.04)) - 0.005;
        col += exp(-abs(hexD) * 80.0) * phaseColor * 0.35;
        col += goldenSeedField(uv, headUV, 12, t, density) * 0.5;
    } else if (isYantra) {
        let tipCount = i32(clamp(3.0 + density * 3.0, 3.0, 8.0));
        for (var i = 0; i < tipCount; i++) {
            let fi = f32(i);
            let tipUV = kalei(uv - heartUV, 3.0);
            let tipRot = t * 0.05 * (1.0 + u.interference) + fi * 0.4;
            let tipR = rot2(tipRot) * tipUV;
            let tipD = abs(length(tipR) - (0.06 + fi * 0.025) * (1.0 + expand * 0.1)) - 0.003;
            col += exp(-abs(tipD) * 100.0) * mix(phaseColor, vec3<f32>(1.0, 0.85, 0.4), fi * 0.15) * (0.18 - fi * 0.018);
        }
    } else {
        let ringD = abs(length(uv - heartUV) - (0.12 + expand * 0.03)) - 0.006;
        col += exp(-abs(ringD) * 70.0) * phaseColor * 0.30;
        col += vesicaPiscisChain(uv, heartUV, 8.0, 0.10, t, density) * 0.5;
    }

    return col;
}

// ============================================================================
// MODULE 4 — LOTUS, SACRED SYMBOL & ENERGY RIBBONS (Agent: Lotus & Post Specialist)
// ============================================================================

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

    let hv = hash22(vec2<f32>(petalId, n * 0.37));
    let lenVar = len * (0.93 + hv.x * 0.14);
    let widVar = wid * (0.88 + hv.y * 0.24);
    let hueJit = (hv.x - 0.5) * 0.10;

    let tip = lenVar * (1.0 + expand * 0.22);
    let baseR = base * (1.0 - expand * 0.08);

    var outc = vec3<f32>(0.0);
    var depth = 0.0;
    var facing = 0.0;
    var mask = 0.0;
    var tNorm = 0.0;
    var edgeAbs = 0.0;
    var w = 0.0;

    let bodyCol = color * (1.0 + vec3<f32>(hueJit, 0.0, -hueJit));
    let lightCol = mix(color, vec3<f32>(1.0, 0.94, 0.88), 0.45);

    if (u.mandalaStyle < 0.5) {
        let droop = max(0.0, r - baseR) * 0.12 * (min(n, 24.0) / 12.0) * (1.0 - expand * 0.35);
        let aD = a + droop;
        tNorm = clamp((r - baseR) / max(tip - baseR, 1e-3), 0.0, 1.0);
        let profile = pow(sin(tNorm * PI), 0.65);
        w = widVar * (0.10 + 0.90 * profile) * (1.0 + expand * 0.18);
        edgeAbs = abs(aD);

        let radial = smoother(baseR - 0.015, baseR + 0.03, r) *
                     smoother(tip, tip * 0.72, r);
        let angular = smoother(w, w * 0.05, edgeAbs);
        mask = radial * angular;

        let midrib = smoother(w * 0.55, 0.0, edgeAbs);
        let subsurface = mask * (0.35 + 0.65 * midrib) * (1.0 - tNorm * 0.45);
        let central = smoother(w * 0.10, 0.0, edgeAbs) * radial;
        let lateralWave = sin(edgeAbs * 26.0 - tNorm * 7.0 + petalId) * 0.5 + 0.5;
        let lateral = lateralWave * smoother(w * 0.7, w * 0.1, edgeAbs) * mask *
                      smoother(baseR + 0.04, baseR + 0.14, r);
        let veins = central * 0.5 + lateral * 0.18;
        let rim = (smoother(w, w * 0.78, edgeAbs) - smoother(w * 0.78, w * 0.5, edgeAbs)) *
                  radial * (0.6 + 0.4 * tNorm);
        let tipGlow = smoother(tip * 0.78, tip, r) * angular * 0.8;

        let nrm = normalize(uv + vec2<f32>(1e-5));
        facing = 0.62 + 0.38 * dot(nrm, vec2<f32>(0.22, 1.0));
        depth = smoother(0.0, 0.16, r) * (1.0 - smoother(tip * 0.78, tip * 1.08, r));

        outc += subsurface * 0.34 * bodyCol;
        outc += veins * bodyCol * vec3<f32>(1.1, 1.05, 1.0);
        outc += rim * 0.55 * lightCol;
        outc += tipGlow * 0.40 * lightCol;

    } else if (u.mandalaStyle > 0.5 && u.mandalaStyle < 1.5) {
        tNorm = clamp((r - baseR) / max(tip - baseR, 1e-3), 0.0, 1.0);
        let geoProfile = 1.0 - abs(tNorm * 2.0 - 1.0);
        w = widVar * (0.15 + 0.85 * geoProfile) * (1.0 + expand * 0.12);
        let aD = a + max(0.0, r - baseR) * 0.03;
        edgeAbs = abs(aD);

        let radial = smoother(baseR - 0.01, baseR + 0.02, r) *
                     smoother(tip, tip * 0.80, r);
        let angular = smoother(w, w * 0.02, edgeAbs);
        mask = radial * angular;

        let trimWidth = w * 0.15;
        let trim = smoother(w, w - trimWidth, edgeAbs) * radial * (0.7 + 0.3 * tNorm);
        let innerLine = smoother(w * 0.08, 0.0, edgeAbs) * radial;
        let crossLine = smoother(w * 0.6, w * 0.2, edgeAbs) * mask *
                        smoother(baseR + tip * 0.3, baseR + tip * 0.35, r) *
                        smoother(baseR + tip * 0.7, baseR + tip * 0.75, r);

        let nrm = normalize(uv + vec2<f32>(1e-5));
        facing = 0.65 + 0.35 * dot(nrm, vec2<f32>(0.0, 1.0));
        depth = smoother(0.0, 0.14, r) * (1.0 - smoother(tip * 0.85, tip * 1.05, r));

        let gold = vec3<f32>(1.0, 0.84, 0.35);
        let yantraBody = mix(bodyCol, bodyCol * vec3<f32>(1.1, 0.9, 0.7), 0.25);

        outc += mask * 0.45 * yantraBody;
        outc += trim * 0.6 * gold;
        outc += innerLine * 0.35 * gold;
        outc += crossLine * 0.2 * yantraBody;

    } else {
        let wind = sin(t * 0.8 + petalId * 1.3 + n * 0.2) * 0.025;
        let curl = max(0.0, r - baseR) * 0.18 * (n / 10.0) * (1.0 - expand * 0.25);
        let aD = a + curl + wind;

        tNorm = clamp((r - baseR) / max(tip - baseR, 1e-3), 0.0, 1.0);
        let profile = pow(sin(tNorm * PI), 0.55);
        let waveEdge = sin(tNorm * 12.0 + petalId * 2.0 + t * 0.5) * 0.08;
        w = widVar * (0.12 + 0.88 * profile + waveEdge) * (1.0 + expand * 0.18);
        edgeAbs = abs(aD);

        let radial = smoother(baseR - 0.018, baseR + 0.035, r) *
                     smoother(tip, tip * 0.70, r);
        let angular = smoother(w, w * 0.06, edgeAbs);
        mask = radial * angular;

        let midrib = smoother(w * 0.50, 0.0, edgeAbs);
        let subsurface = mask * (0.40 + 0.60 * midrib) * (1.0 - tNorm * 0.35);
        let central = smoother(w * 0.10, 0.0, edgeAbs) * radial;
        let lateralWave = sin(edgeAbs * 22.0 - tNorm * 6.0 + petalId + t * 0.3) * 0.5 + 0.5;
        let lateral = lateralWave * smoother(w * 0.65, w * 0.12, edgeAbs) * mask *
                      smoother(baseR + 0.04, baseR + 0.14, r);
        let veins = central * 0.45 + lateral * 0.20;
        let rim = (smoother(w, w * 0.80, edgeAbs) - smoother(w * 0.80, w * 0.55, edgeAbs)) *
                  radial * (0.5 + 0.5 * tNorm);
        let tipGlow = smoother(tip * 0.80, tip, r) * angular * 0.85;

        let nrm = normalize(uv + vec2<f32>(1e-5));
        facing = 0.60 + 0.40 * dot(nrm, vec2<f32>(0.25, 1.0));
        depth = smoother(0.0, 0.18, r) * (1.0 - smoother(tip * 0.80, tip * 1.12, r));

        outc += subsurface * 0.36 * bodyCol;
        outc += veins * bodyCol * vec3<f32>(1.08, 1.02, 1.0);
        outc += rim * 0.50 * lightCol;
        outc += tipGlow * 0.42 * lightCol;
    }

    let detailAA = clamp(1.0 - length(fwidth(uv)) * 42.0, 0.0, 1.0);
    let warpDetail = fbmWarp(uv * (9.0 + n * 0.35) + vec2<f32>(petalId * 0.21, t * 0.18), t, 5);
    let iri = sin(tNorm * 38.0 + u.phaseProgress * TAU) *
              sin(edgeAbs * 60.0 - t * 0.7 + warpDetail * 2.2);
    let microDetail = 0.90 + 0.14 * iri + 0.16 * (warpDetail - 0.5);
    outc *= mix(1.0, microDetail, detailAA);
    outc += mask * detailAA * (0.012 + 0.02 * warpDetail) * lightCol;

    return outc * depth * facing;
}

fn sacredSymbol(
    uv: vec2<f32>, t: f32,
    expand: f32, intensity: f32, chakraPhase: f32
) -> vec3<f32> {
    var col = vec3<f32>(0.0);
    let r = length(uv);
    let a = atan2(uv.y, uv.x);

    let beat = 0.5 + 0.5 * sin(t * 1.4);
    let symPulse = 1.0 + 0.06 * sin(t * 2.8) * (0.5 + intensity) + expand * 0.05;
    let sx = 0.150 * symPulse * (1.0 + expand * 0.12);
    let sy = 0.082 * symPulse * (1.0 + expand * 0.06);
    let d = length(vec2<f32>(uv.x / max(sx, 1e-4), uv.y / max(sy, 1e-4))) - 1.0;

    let r1 = abs(d) - 0.014;
    let r2 = abs(d) - 0.034;
    let r3 = abs(d) - 0.062;

    let core = 0.014 / (abs(d) + 0.005);
    let g1   = 0.008 / (abs(r1) + 0.003);
    let g2   = 0.0045 / (abs(r2) + 0.005);
    let g3   = 0.0022 / (abs(r3) + 0.009);

    var coreCol: vec3<f32>;
    var haloCol: vec3<f32>;
    if (u.theme < 0.5) {
        coreCol = vec3<f32>(0.82, 0.94, 1.0);
        haloCol = vec3<f32>(0.72, 0.55, 0.92);
    } else if (u.theme < 1.5) {
        coreCol = vec3<f32>(1.0, 0.85, 0.55);
        haloCol = vec3<f32>(1.0, 0.60, 0.72);
    } else {
        coreCol = vec3<f32>(0.55, 0.90, 0.88);
        haloCol = vec3<f32>(0.35, 0.55, 0.92);
    }

    let bright = 0.70 + expand * 1.05 + intensity * 0.42 + beat * 0.12;

    col += core * coreCol * bright * 2.1;
    col += g1   * coreCol * bright * 1.35;
    col += g2   * haloCol * bright * 0.78;
    col += g3   * haloCol * bright * 0.36;

    let fill = smoother(0.02, -0.01, d);
    col += fill * coreCol * bright * 0.55;

    let shimmer = (sin(a * 5.0 - t * 1.6) * 0.5 + 0.5) *
                  (sin(r * 60.0 - t * 2.2) * 0.5 + 0.5);
    col += fill * shimmer * coreCol * 0.18 * (0.4 + expand);

    var omRipple = 0.0;
    for (var i = 0; i < 4; i++) {
        let fi = f32(i);
        let ringRad = 0.06 + fi * 0.035;
        let ringPhase = sin(r * 5.0 - t * 2.5 + fi * 1.57) * 0.5 + 0.5;
        let ringMask = exp(-abs(r - ringRad) * 80.0) * ringPhase;
        omRipple += ringMask;
    }
    col += omRipple * haloCol * 0.15 * (0.5 + expand * 0.5);

    let seedR = 0.045 * (1.0 + expand * 0.35);
    for (var i = 0; i < 3; i++) {
        let ang = -t * 0.35 + f32(i) * (TAU / 3.0);
        let p = uv - vec2<f32>(cos(ang), sin(ang)) * seedR;
        let dd = length(p);
        col += (0.0016 / (dd + 0.004)) * coreCol * bright * 0.7;
    }

    let binduRad = 0.012 * (1.0 + expand * 0.2);
    var hold1Glow = 1.0;
    if (chakraPhase > 0.5 && chakraPhase < 1.5) {
        hold1Glow = 1.5 + 0.5 * sin(t * 4.0);
    }
    let bindu = smoother(binduRad, 0.0, r) * hold1Glow;
    col += bindu * vec3<f32>(1.0, 0.98, 0.95) * bright * 0.6;

    let flare = exp(-abs(uv.y) * 52.0) * exp(-abs(uv.x) * 3.0) * (0.35 + expand * 0.65);
    col += flare * coreCol * 0.78;

    col += exp(-r * 21.0) * haloCol * (0.45 + expand * 0.9) * 0.85;

    return col;
}

fn lotusAndSymbol(
    uv: vec2<f32>, t: f32,
    breath: f32, intensity: f32, chakraPhase: f32
) -> vec3<f32> {
    var col = vec3<f32>(0.0);
    let expand = deriveBreathExpand();

    let shimmer = 0.03 * sin(t * 1.6 + breath * 12.566) * intensity;
    let effExpand = expand + shimmer;
    let glowMult = 0.78 + effExpand * 0.62 + intensity * 0.25;
    let translucency = 0.88;
    let density = clamp(u.geometryDensity + u.intensity * 0.2, 0.2, 3.0);
    let timeM = 1.0 + u.interference * 0.35;

    let n1 = 8.0 + floor(density * 4.0);
    let n2 = 12.0 + floor(density * 5.0);
    let n3 = 16.0 + floor(density * 6.0);
    let n4 = mix(0.0, 20.0 + floor(density * 7.0), smoothstep(0.6, 1.4, density));
    let n5 = mix(0.0, 26.0 + floor(density * 9.0), smoothstep(1.0, 2.0, density));

    col += lotusLayer(uv, t, n1, 0.42, 0.16, 0.06,
                      (0.000 + t * 0.020) * timeM, effExpand,
                      vec3<f32>(0.95, 0.62, 0.75)) * glowMult * translucency;
    col += lotusLayer(uv, t, n2, 0.60, 0.20, 0.10,
                      (0.262 + t * 0.014) * timeM, effExpand,
                      vec3<f32>(0.82, 0.52, 0.92)) * glowMult * translucency;
    col += lotusLayer(uv, t, n3, 0.76, 0.24, 0.14,
                      (0.131 + t * 0.008) * timeM, effExpand,
                      vec3<f32>(0.55, 0.68, 0.92)) * glowMult * translucency;
    if (n4 > 0.0) {
        col += lotusLayer(uv, t, n4, 0.92, 0.28, 0.18,
                          (0.000 - t * 0.005) * timeM, effExpand * 0.7,
                          vec3<f32>(0.62, 0.75, 0.88)) * glowMult * 0.55 * translucency;
    }
    if (n5 > 0.0) {
        col += lotusLayer(uv, t, n5, 1.12, 0.32, 0.24,
                          (0.500 + t * 0.003) * timeM, effExpand * 0.45,
                          vec3<f32>(0.58, 0.72, 0.85)) * glowMult * 0.28 * translucency;
    }

    col += sacredSymbol(uv, t, effExpand, intensity, chakraPhase);

    // Micro-geometry nested in the lotus heart
    col += dotLattice(uv, t, density) * 0.22;
    col += goldenSeedField(uv, vec2<f32>(0.0), 18, t, density) * 0.14;
    col += vesicaPiscisChain(uv, vec2<f32>(0.0), 10.0, 0.18, t, density) * 0.13;

    let aura = exp(-length(uv) * 3.2) * (0.12 + effExpand * 0.18) * intensity;
    col += aura * vec3<f32>(0.72, 0.58, 0.92);

    return col;
}

fn ribbonStrand(
    uv: vec2<f32>, t: f32,
    orbitR: f32, n: f32, speed: f32, twist: f32, phase: f32, width: f32,
    color: vec3<f32>, expand: f32, intensity: f32
) -> vec3<f32> {
    let r = length(uv);
    let a = atan2(uv.y, uv.x);

    let warp1 = fbm2(uv * 1.6 + vec2<f32>(orbitR * 4.0, phase * 2.0 + t * 0.12), t * 0.30);
    let warp2 = fbm2(uv * 3.1 - vec2<f32>(t * 0.08, orbitR * 2.0), t * 0.22);
    let warpHi = fbmWarp(uv * 4.6 + vec2<f32>(phase * 0.8, t * 0.16), t * 0.42, 5);

    let spiralPhase = a * n + t * speed + twist * (r - orbitR) + phase + warp1 * 0.65;
    let weave = sin(spiralPhase * 0.85 + warp2 * 1.6) * width * 1.7;
    let orbit = orbitR + weave;
    let radialDist = r - orbit;

    let thick = width * (0.55 + 0.45 * (sin(spiralPhase * 1.3 + warp2) * 0.5 + 0.5));
    let flow = sin(spiralPhase) * 0.5 + 0.5;
    let seg = pow(flow, 2.5) * 0.7 + 0.3;
    let glow = exp(-radialDist * radialDist / (thick * thick * 2.6)) * 0.42;
    let core = exp(-radialDist * radialDist / (thick * thick * 0.40)) * seg;
    let filament = exp(-radialDist * radialDist / (thick * thick * 0.06)) * pow(flow, 4.0) * 0.55;

    let depth = 0.6 + 0.4 * (sin(spiralPhase * 0.85 + warp2 * 1.6) * 0.5 + 0.5);
    let centerFade = smoother(0.04, 0.17, r);
    let sideBias = pow(abs(cos(a)), 0.45) * 0.30 + 0.70;

    var ribbon = (core + glow) * centerFade * sideBias * depth + filament * centerFade;
    let detailAA = clamp(1.0 - length(fwidth(uv)) * 52.0, 0.0, 1.0);
    let iri = sin((r + warpHi * 0.08) * 44.0 + u.phaseProgress * TAU) *
              sin(abs(radialDist) * (92.0 + u.intensity * 22.0) - t * 0.9);
    let ribbonMicro = 1.0 + detailAA * (0.10 * (warpHi - 0.5) + 0.06 * iri);
    ribbon *= ribbonMicro;

    let colorShift = sin(spiralPhase * 0.35 + t * 0.4 + phase) * 0.5 + 0.5;
    let flowColor = mix(color, color * vec3<f32>(1.15, 0.85, 1.25), colorShift * 0.35);
    let hotColor = mix(flowColor, vec3<f32>(1.0, 0.96, 0.92), filament * 1.2);

    let bright = (0.38 + expand * 0.85 + intensity * 0.32);
    return ribbon * hotColor * bright;
}

fn energyRibbons(
    uv: vec2<f32>, t: f32,
    breath: f32, intensity: f32, chakraPhase: f32
) -> vec3<f32> {
    var col = vec3<f32>(0.0);
    let expand = deriveBreathExpand();
    let phasePalette = focusedBreathColor();

    let holdPulse = 1.0 + 0.08 * sin(t * 3.5) * expand * intensity;
    let flowSpeed = 1.0 + expand * 1.4;
    let radiusShift = 1.0 - expand * 0.18;
    let glowMult = 0.55 + expand * 0.95 + intensity * 0.28;

    var flowOffset = vec2<f32>(0.0);
    if (u.chakraPhase < 0.5) {
        flowOffset = vec2<f32>(0.0, expand * 0.06 + u.phaseProgress * 0.04);
    } else if (u.chakraPhase > 1.5 && u.chakraPhase < 2.5) {
        flowOffset = vec2<f32>(0.0, -(expand * 0.06 + u.phaseProgress * 0.04));
    }
    let driftUV = uv + flowOffset;

    let r1 = 0.32 * radiusShift;
    col += ribbonStrand(driftUV, t, r1, 4.0, flowSpeed * 1.0, 6.0, 0.00,
                        0.038, vec3<f32>(0.92, 0.48, 0.68), expand, intensity)
           * glowMult * holdPulse;
    col += ribbonStrand(driftUV, t, r1, 4.0, flowSpeed * 1.0, 6.0, 3.14159,
                        0.038, vec3<f32>(0.78, 0.42, 0.72), expand, intensity)
           * glowMult * holdPulse;

    let r2 = 0.58 * radiusShift;
    col += ribbonStrand(driftUV, t, r2, 6.0, flowSpeed * 1.2, 9.0, 0.60,
                        0.045, vec3<f32>(0.48, 0.68, 0.92), expand, intensity)
           * glowMult * 0.90 * holdPulse;
    col += ribbonStrand(driftUV, t, r2, 6.0, flowSpeed * 1.2, 9.0, 2.80,
                        0.045, vec3<f32>(0.55, 0.82, 0.72), expand, intensity)
           * glowMult * 0.90 * holdPulse;
    col += ribbonStrand(driftUV, t, r2, 6.0, flowSpeed * 1.2, 9.0, 4.50,
                        0.045, vec3<f32>(0.88, 0.52, 0.78), expand, intensity)
           * glowMult * 0.90 * holdPulse;

    let r3 = 0.92 * radiusShift;
    col += ribbonStrand(driftUV, t, r3, 8.0, flowSpeed * 0.85, 12.0, 1.10,
                        0.052, vec3<f32>(0.42, 0.62, 0.92), expand, intensity)
           * glowMult * 0.72 * holdPulse;
    col += ribbonStrand(driftUV, t, r3, 8.0, flowSpeed * 0.85, 12.0, 3.90,
                        0.052, vec3<f32>(0.68, 0.48, 0.88), expand, intensity)
           * glowMult * 0.72 * holdPulse;

    let r4 = 1.35 * radiusShift;
    col += ribbonStrand(driftUV, t, r4, 3.5, flowSpeed * 0.45, 5.0, 0.00,
                        0.075, vec3<f32>(0.52, 0.60, 0.88), expand, intensity)
           * glowMult * 0.38 * holdPulse;
    col += ribbonStrand(driftUV, t, r4, 3.5, flowSpeed * 0.45, 5.0, 2.09,
                        0.075, vec3<f32>(0.58, 0.52, 0.82), expand, intensity)
           * glowMult * 0.38 * holdPulse;

    if (chakraPhase < 0.5)      { col *= vec3<f32>(0.90, 0.98, 1.08); }
    else if (chakraPhase < 1.5) { col *= vec3<f32>(1.10, 0.94, 0.98); }
    else if (chakraPhase < 2.5) { col *= vec3<f32>(1.04, 0.98, 0.90); }
    else                        { col *= vec3<f32>(0.94, 0.98, 1.04); }
    col = mix(col, col * (0.55 + phasePalette * 1.05), 0.33);

    let r = length(driftUV);
    let a = atan2(driftUV.y, driftUV.x);
    let bridgePhase = a * 2.0 + t * 0.6 + expand * 2.0;
    let bridgeMask = exp(-(r - 0.70) * (r - 0.70) / 0.015) *
                     smoothstep(0.4, 0.8, sin(bridgePhase) * 0.5 + 0.5);
    col += vec3<f32>(0.72, 0.75, 0.95) * bridgeMask * 0.18 * glowMult;

    if (u.chakraPhase < 0.5) {
        let sparkY = -0.3 + u.phaseProgress * 0.6;
        let sparkPos = vec2<f32>(0.0, sparkY);
        let sparkDist = length(driftUV - sparkPos);
        let sparkSize = 0.012 + 0.008 * sin(t * 5.0);
        let spark = exp(-sparkDist * sparkDist / (sparkSize * sparkSize)) * 1.2;
        let sparkCol = mix(vec3<f32>(1.0, 0.30, 0.20), vec3<f32>(0.90, 0.80, 1.0), u.phaseProgress);
        col += spark * sparkCol * glowMult * 0.8;
    }

    if (intensity > 0.55) {
        let lightningSeed = floor(t * 8.0);
        let lightningHash = hash22(vec2<f32>(lightningSeed, r * 10.0));
        let branchPhase = a * 5.0 + t * 12.0 + lightningHash.x * 6.283;
        let branchMask = smoothstep(0.92, 1.0, sin(branchPhase) * 0.5 + 0.5) *
                         exp(-abs(r - 0.5) * 4.0) *
                         exp(-abs(driftUV.y) * 3.0);
        let branchCol = vec3<f32>(0.85, 0.90, 1.0);
        col += branchCol * branchMask * (intensity - 0.55) * 0.35;
    }

    return col;
}

// ============================================================================
// MODULE 5 — CINEMATIC POST-PROCESSING
// ============================================================================

fn acesTonemap(x: vec3<f32>) -> vec3<f32> {
    let a = 2.51;
    let b = 0.03;
    let c = 2.43;
    let d = 0.59;
    let e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), vec3<f32>(0.0), vec3<f32>(1.0));
}

fn applyColorGrading(
    col: vec3<f32>,
    uv: vec2<f32>,
    t: f32,
    expand: f32,
    theme: f32,
    phasePalette: vec3<f32>
) -> vec3<f32> {
    var graded = col;

    let sat = 1.0 + expand * 0.10;
    let luma = dot(graded, vec3<f32>(0.299, 0.587, 0.114));
    graded = mix(vec3<f32>(luma), graded, sat);

    let warmth = expand * 0.05;
    graded *= vec3<f32>(1.0 + warmth, 1.0 + warmth * 0.25, 1.0 - warmth * 0.35);

    let brightness = dot(graded, vec3<f32>(0.333));
    let chromaticWarmth = smoothstep(0.4, 1.2, brightness) * (0.04 + expand * 0.05);
    graded += vec3<f32>(chromaticWarmth, chromaticWarmth * 0.35, -chromaticWarmth * 0.25);

    if (theme > 0.5 && theme < 1.5) {
        graded = mix(graded, graded * vec3<f32>(1.18, 1.04, 0.78), 0.20);
    } else if (theme > 1.5) {
        graded = mix(graded, graded * vec3<f32>(0.82, 1.06, 1.12), 0.20);
    }

    graded = acesTonemap(graded * 1.05);

    let bloomThreshold = 0.55;
    var bloom = max(graded - bloomThreshold, vec3<f32>(0.0));
    let bloomSpread = smoothstep(0.0, 1.0, brightness) * 0.25;
    bloom += bloom * bloomSpread;
    graded += bloom * (0.22 + 0.13 * phasePalette);

    let grain = hash21(uv * 500.0 + t * 100.0) * 0.015;
    graded += grain;

    let edgeDist = length(uv);
    let ca = edgeDist * 0.004;
    graded.r += ca * 0.025 * edgeDist;
    graded.b -= ca * 0.020 * edgeDist;

    if (u.chakraPhase > 2.5) {
        graded.b *= 0.92;
    }

    graded = pow(graded, vec3<f32>(0.90));
    return max(graded, vec3<f32>(0.0));
}

// ============================================================================
// MAIN FRAGMENT SHADER — Final Composition
// ============================================================================

@fragment
fn main(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
    var uv = (fragCoord.xy - 0.5 * u.resolution) / u.resolution.y;
    let breath = u.breathPhase;
    let expand = deriveBreathExpand();
    let t = u.time;
    let r = length(uv);

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

    // ------------------------------------------------------------
    // LAYER 1 — Background atmosphere
    // ------------------------------------------------------------
    var col = backgroundAtmosphere(uv, t, breath, expand);
    let phasePalette = focusedBreathColor();

    // ------------------------------------------------------------
    // LAYER 2 — Volumetric light shafts
    // ------------------------------------------------------------
    col += lightShafts(uv * 0.85, t, breath, expand);
    col += godRays(uv * 0.95, t, u.intensity, expand);

    // ------------------------------------------------------------
    // LAYER 3 — Sacred geometry rings
    // ------------------------------------------------------------
    col += layeredSacredGeometry(uv, t, breath, expand);

    // ------------------------------------------------------------
    // LAYER 4 — Prana particles
    // ------------------------------------------------------------
    col += pranaParticles(uv, t, breath, expand);

    // ------------------------------------------------------------
    // LAYER 5 — Energy ribbons (behind lotus for translucency glow)
    // ------------------------------------------------------------
    col += energyRibbons(uv, t, breath, u.intensity, u.chakraPhase);

    // ------------------------------------------------------------
    // LAYER 6 — Figure aura
    // ------------------------------------------------------------
    col += figureAura(uv, t, breath, expand);

    // ------------------------------------------------------------
    // LAYER 6b — Figure-framing geometry (grows from heart/head)
    // ------------------------------------------------------------
    col += figureFramingGeometry(uv, t, breath, expand);

    // ------------------------------------------------------------
    // LAYER 7 — Human figure with animated arms
    // ------------------------------------------------------------
    col += humanFigure(uv, t, breath, expand);

    // ------------------------------------------------------------
    // LAYER 8 — Chakra column with breath pulse
    // ------------------------------------------------------------
    col += chakraColumn(uv, t, breath, expand);

    // ------------------------------------------------------------
    // LAYER 9 — Lotus + sacred symbol (hero focal point)
    // ------------------------------------------------------------
    col += lotusAndSymbol(uv, t, breath, u.intensity, u.chakraPhase);

    // ------------------------------------------------------------
    // LAYER 10 — Progress ring
    // ------------------------------------------------------------
    col += progressRing(uv, breath, expand);

    // ------------------------------------------------------------
    // LAYER 11 — Global breath aura
    // ------------------------------------------------------------
    let globalAura = exp(-r * 2.8) * (0.06 + expand * 0.10) * u.intensity;
    col += globalAura * mix(vec3<f32>(0.58, 0.48, 0.88), phasePalette, 0.55);

    // ------------------------------------------------------------
    // LAYER 12 — Exhale release wave
    // ------------------------------------------------------------
    let releaseWave = sin(r * 10.0 - breath * 15.708 - t * 1.2) * 0.5 + 0.5;
    let waveMask = exp(-r * 2.0) *
                   smoothstep(0.35, 0.75, releaseWave) *
                   (1.0 - expand) * 0.038;
    col += waveMask * mix(vec3<f32>(0.52, 0.42, 0.82), phasePalette, 0.45);

    // ------------------------------------------------------------
    // LAYER 13 — Atmospheric breath haze
    // ------------------------------------------------------------
    let haze = exp(-r * 1.3) * (0.12 + (1.0 - breath) * 0.22);
    let hold2Mask = smoothstep(2.5, 2.9, u.chakraPhase);
    let exhaleMask = smoothstep(1.5, 2.5, u.chakraPhase) * (1.0 - hold2Mask);
    let exhaleHaze = (exhaleMask * 0.08 + hold2Mask * 0.18) * (1.0 - expand);
    col = mix(col, vec3<f32>(0.045, 0.022, 0.14), haze * 0.30 + exhaleHaze);

    // ------------------------------------------------------------
    // POST — Vignette
    // ------------------------------------------------------------
    let vig = pow(1.0 - r * 0.68, 1.75);
    col *= vig * 1.28;

    // ------------------------------------------------------------
    // POST — Cinematic color grading
    // ------------------------------------------------------------
    col = applyColorGrading(col, uv, t, expand, u.theme, phasePalette);

    return vec4<f32>(col, 1.0);
}
