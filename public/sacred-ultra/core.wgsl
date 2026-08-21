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
// Uniforms — must match WebGPUShader.tsx exactly (72 bytes)
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
    figurePose: f32,         // 0=lotus, 1=tadasana, 2=tai-chi, 3=heart-open, 4=chinmudra, 5=warrior, 6=tree
    qualityPreset: f32,      // 0.0=mobile (reduced detail), 1.0=high (full star field + rings)
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
const HEX_COS: f32 = 0.866025404;
const HEX_TAN: f32 = 0.577350269;
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

fn isHighQuality() -> bool {
    return u.qualityPreset >= 0.5;
}

fn fbm2(p: vec2<f32>, t: f32) -> f32 {
    var sum = 0.0;
    var amp = 0.5;
    var freq = 1.0;
    let octaves = select(2, 3, isHighQuality());
    for (var i = 0; i < 3; i = i + 1) {
        if (i >= octaves) { break; }
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
    for (var i = 0; i < 6; i = i + 1) {
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
    let idx = i32(clamp(index, 0.0, 6.0));
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
    let qualityScale = select(0.55, 1.0, isHighQuality());
    let ringCount = i32(clamp(3.0 + density * 4.0 * qualityScale, 3.0, 9.0));
    let dotCountBase = 6.0 + density * 12.0 * qualityScale;
    for (var i = 0; i < ringCount; i = i + 1) {
        let fi = f32(i);
        let rr = 0.08 + fi * 0.055 * (1.0 + density * 0.15);
        let band = exp(-abs(r - rr) * 35.0);
        let dots = i32(clamp(dotCountBase + fi * 4.0, 4.0, 36.0));
        for (var d = 0; d < dots; d = d + 1) {
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
    for (var i = 0; i < count; i = i + 1) {
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
    let qualityScale = select(0.55, 1.0, isHighQuality());
    let n = clamp(count + i32(density * 18.0 * qualityScale), 6, 48);
    for (var i = 0; i < n; i = i + 1) {
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

// ---------------------------------------------------------------------------
// Shadertoy-inspired background geometry (star field + stepped ring curves)
// ---------------------------------------------------------------------------

fn shadertoyCurve(t: f32, d: f32) -> f32 {
    let scaled = t / d;
    return mix(floor(scaled), floor(scaled) + 1.0, pow(smoothstep(0.0, 1.0, fract(scaled)), 20.0));
}

fn hueFromTime(v: f32) -> vec3<f32> {
    return 0.6 + 0.6 * cos(6.3 * v + vec3<f32>(0.0, 23.0, 21.0));
}

fn toLogPolar(p: vec2<f32>) -> vec2<f32> {
    return vec2<f32>(log(max(length(p), 1e-6)), atan2(p.y, p.x));
}

fn pmodRadial(pos: vec2<f32>, num: f32, out_id: ptr<function, f32>) -> vec2<f32> {
    let angle = atan2(pos.x, pos.y) + PI / num;
    let split = TAU / num;
    *out_id = floor(angle / split);
    let final_angle = (*out_id) * split;
    return rot2(final_angle) * pos;
}

fn mapStarsGeo(uv: vec2<f32>, near: ptr<function, vec3<f32>>, neighbor: ptr<function, vec3<f32>>) {
    var point: vec2<f32>;
    *near = vec3<f32>(1e+4, 1e+4, 1e+4);

    for (var y: f32 = -1.0; y <= 1.0; y = y + 2.0) {
        point = vec2<f32>(0.0, HEX_COS + y * HEX_TAN * 0.25);
        let dist = distance(uv, point);
        if ((*near).z >= dist) {
            *near = vec3<f32>(point, dist);
        }
    }

    for (var x: f32 = -1.0; x <= 1.0; x = x + 2.0) {
        for (var y: f32 = -1.0; y <= 1.0; y = y + 2.0) {
            for (var both: f32 = -1.0; both <= 1.0; both = both + 2.0) {
                point = vec2<f32>(x * 0.125, HEX_COS + y * HEX_COS * 0.5);
                point.x = point.x + both * 0.5 * 0.125 * -x;
                point.y = point.y + both * HEX_TAN * 0.125 * -y;
                let dist = distance(uv, point);
                if ((*near).z >= dist) {
                    *near = vec3<f32>(point, dist);
                }
            }
        }
    }

    *neighbor = vec3<f32>(1e+4, 1e+4, 1e+4);

    for (var y: f32 = -1.0; y <= 1.0; y = y + 2.0) {
        point = vec2<f32>(0.0, HEX_COS + y * HEX_TAN * 0.25);
        if (!all((*near).xy == point)) {
            let center = (point + (*near).xy) * 0.5;
            let dist = dot(uv - center, normalize((*near).xy - point));
            if ((*neighbor).z >= dist) {
                *neighbor = vec3<f32>(point, dist);
            }
        }
    }

    for (var x: f32 = -1.0; x <= 1.0; x = x + 2.0) {
        for (var y: f32 = -1.0; y <= 1.0; y = y + 2.0) {
            for (var both: f32 = -1.0; both <= 1.0; both = both + 2.0) {
                point = vec2<f32>(x * 0.125, HEX_COS + y * HEX_COS * 0.5);
                point.x = point.x + both * 0.5 * 0.125 * -x;
                point.y = point.y + both * HEX_TAN * 0.125 * -y;
                if (!all((*near).xy == point)) {
                    let center = (point + (*near).xy) * 0.5;
                    let dist = dot(uv - center, normalize((*near).xy - point));
                    if ((*neighbor).z >= dist) {
                        *neighbor = vec3<f32>(point, dist);
                    }
                }
            }
        }
    }
}

fn starPattern(uv_in: vec2<f32>, time: f32) -> f32 {
    let uvb = uv_in;
    var uv = uv_in;

    let width = 0.0001 + mix(0.03, 0.0, pow(dot(uv, uv), 0.3));

    uv = toLogPolar(uv * 0.01) * 2.5;
    uv.x = uv.x + (-0.2 * time);
    uv = vec2<f32>(pmod(uv.x, 1.0) - 0.5, pmod(uv.y, HEX_COS * 2.0) - HEX_COS);

    var id: f32 = 0.0;
    let reps: f32 = 5.0;
    let tt: f32 = 0.07 * (time + 6.0);
    let modt: f32 = pow(smoothstep(0.0, 0.3, abs(fract(0.1 * length(uvb) - tt) - 0.5)), 500.0);
    let alpha: f32 = mix(6.0, 18.0, modt);

    uv = pmodRadial(uv, alpha, &id);

    var near: vec3<f32>;
    var neighbor: vec3<f32>;
    mapStarsGeo(uv, &near, &neighbor);

    return 1.0 - smoothstep(0.0, width, neighbor.z);
}

fn dHex(p: vec2<f32>) -> f32 {
    let ap = abs(p);
    return max(dot(ap, normalize(vec2<f32>(1.0, 1.73))), ap.x);
}

fn dTri(p: vec2<f32>) -> f32 {
    let a = atan2(p.x, p.y) + PI;
    let r = TAU / 3.0;
    return cos(floor(0.5 + a / r) * r - a) * length(p);
}

fn strokeRing(dist: f32, thickness: f32, blur: f32) -> f32 {
    return 1.0 - smoothstep(0.0, thickness, abs(dist) - blur);
}

fn shadertoyHexRing(p: vec2<f32>, radius: f32, thickness: f32, blur: f32) -> f32 {
    return strokeRing(dHex(p) - radius, thickness, blur);
}

fn shadertoyTriRing(p: vec2<f32>, radius: f32, thickness: f32, blur: f32) -> f32 {
    return strokeRing(dTri(p) - radius, thickness, blur);
}

fn shadertoyCircleRing(p: vec2<f32>, radius: f32, thickness: f32, blur: f32) -> f32 {
    return strokeRing(length(p) - radius, thickness, blur);
}

fn moda(p: vec2<f32>, repetitions: f32) -> vec2<f32> {
    let angle = TAU / repetitions;
    var a = atan2(p.y, p.x) + angle * 0.5;
    a = pmod(a, angle) - angle * 0.5;
    return vec2<f32>(cos(a), sin(a)) * length(p);
}

fn shadertoySacredRings(uv_in: vec2<f32>, t: f32, expand: f32) -> vec3<f32> {
    var rings = 0.0;
    var uvr = uv_in * 1.2;

    let triSize = 0.286;
    let hexSize = 0.5;
    let circleSize = 0.143;
    let lineWidth = select(0.002, 0.0015, isHighQuality());
    let blur = 0.001;
    let glow = 0.3;
    let tt = 0.3 * t;
    let anim = shadertoyCurve(tt, 2.0);
    let ringPulse = mix(0.0, 0.5, sin(tt * PI) * 0.5 + 0.5);

    if (isHighQuality()) {
        for (var i = 0; i < 3; i = i + 1) {
            uvr = abs(uvr) - triSize;
            uvr = rot2(cos(uvr.x + tt)) * uvr;
        }
    }

    rings += shadertoyHexRing(uvr, hexSize, lineWidth, blur);
    rings += glow * shadertoyHexRing(uvr, hexSize, lineWidth * 5.0, blur);

    var uv0 = uvr;
    uv0 = rot2(-PI * anim) * uv0;
    rings += shadertoyHexRing(uv0, hexSize * 0.5, lineWidth, blur);
    rings += glow * shadertoyHexRing(uv0, hexSize * 0.5, lineWidth * 5.0, blur);

    var uv1 = uvr;
    uv1 = rot2(PI * anim) * uv1;
    rings += shadertoyTriRing(uv1, triSize, lineWidth, blur);
    rings += glow * shadertoyTriRing(uv1, triSize, lineWidth * 5.0, blur);

    var uv2 = uvr;
    uv2 = rot2(PI - anim * PI) * uv2;
    rings += shadertoyTriRing(uv2, triSize, lineWidth, blur);
    rings += glow * shadertoyTriRing(uv2, triSize, lineWidth * 5.0, blur);

    if (isHighQuality()) {
        var uv3 = uvr;
        uv3 = rot2(PI * 0.5) * uv3;
        uv3 = rot2(PI * anim) * uv3;
        uv3 = moda(uv3, 6.0);
        uv3.x = uv3.x - mix(triSize, 0.576, abs(pmod(anim, 2.0) - 1.0));
        rings += shadertoyCircleRing(uv3, circleSize, lineWidth, blur);
        rings += glow * shadertoyCircleRing(uv3, circleSize, lineWidth * 5.0, blur);
    }

    let ringColor = vec3<f32>(0.761, 0.851, 1.000);
    let hueCol = hueFromTime(-tt + length(uv_in) * 2.0 + 0.5 * PI);
    return 0.6 * mix(ringColor, hueCol, 0.5) * rings * ringPulse * (0.65 + expand * 0.35);
}

fn shadertoyStarField(uv: vec2<f32>, t: f32, expand: f32) -> vec3<f32> {
    if (!isHighQuality()) {
        return vec3<f32>(0.0);
    }

    let tt = 0.3 * t;
    let stars = starPattern(uv * 0.5, tt);
    let starHue = hueFromTime(-tt + length(uv));
    let vignette = mix(0.1, 0.2, sin(length(uv) * 1.5 + tt) * 0.5 + 0.5);
    return vec3<f32>(stars) * 0.6 * (0.1 + 0.9 * starHue) * vignette * (0.55 + expand * 0.45);
}

