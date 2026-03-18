// ============================================================================
// Breathing Meditation Shader — Production Version
// ============================================================================
// Source: Kimi Agent Swarm (5 agents merged)
// Agents: 1(Animation) + 2(Energy) + 3(Geometry) + 4(Color) + 5(Performance)
// Integration: vs_main + fs_main entry points, iResolution uniform, 40-byte layout
// ============================================================================

// ============================================================================
// Uniform Buffer — 40 bytes
// ============================================================================
struct BreathUniforms {
    time:          f32,   // offset  0
    phase:         u32,   // offset  4 — 0=inhale 1=hold1 2=exhale 3=hold2
    phaseProgress: f32,   // offset  8
    cycle:         u32,   // offset 12
    strengthLevel: u32,   // offset 16
    intensity:     f32,   // offset 20
    sin_time:      f32,   // offset 24 — precomputed sin(time)
    cos_time:      f32,   // offset 28 — precomputed cos(time)
    sin_fast:      f32,   // offset 32 — precomputed sin(time * 4)
    cos_fast:      f32,   // offset 36 — precomputed cos(time * 4)
}

@binding(0) @group(0) var<uniform> u_breath: BreathUniforms;
@binding(1) @group(0) var<uniform> iResolution: vec4<f32>;  // xy = canvas size

// ============================================================================
// Constants
// ============================================================================
const PI:  f32 = 3.14159265359;
const TAU: f32 = 6.28318530718;

// Arm animation constants
const ARM_RELAXED_ANGLE:  f32 = 0.26;
const ARM_RAISED_ANGLE:   f32 = 1.22;
const ELBOW_RELAXED_BEND: f32 = 0.0;
const ELBOW_INHALE_BEND:  f32 = 0.17;

// ============================================================================
// Color Grading Palettes
// ============================================================================
struct BreathPalette {
    tint:     vec3f,
    hueShift: f32,
    satMod:   f32,
    contrast: f32,
}

const PALETTE_INHALE: BreathPalette = BreathPalette(vec3f(1.1, 0.95, 0.8),  0.03,  1.2,  1.0);
const PALETTE_HOLD1:  BreathPalette = BreathPalette(vec3f(1.0, 1.0,  1.0),  0.0,   1.1,  1.1);
const PALETTE_EXHALE: BreathPalette = BreathPalette(vec3f(0.9, 1.0,  1.05), -0.05, 0.9,  1.0);
const PALETTE_HOLD2:  BreathPalette = BreathPalette(vec3f(1.0, 1.0,  1.0),  0.0,   0.85, 0.95);

// ============================================================================
// Vertex Shader — fullscreen quad
// ============================================================================
@vertex
fn vs_main(@builtin(vertex_index) vid: u32) -> @builtin(position) vec4<f32> {
    let pos = array<vec2<f32>, 6>(
        vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(-1.0, 1.0),
        vec2<f32>( 1.0, -1.0), vec2<f32>(1.0,  1.0), vec2<f32>(-1.0, 1.0)
    );
    return vec4<f32>(pos[vid], 0.0, 1.0);
}

// ============================================================================
// SDF Primitives & Operations
// ============================================================================
fn sdSphere(p: vec3f, r: f32) -> f32 {
    return length(p) - r;
}

fn sdPill(p: vec3f, a: vec3f, b: vec3f, r: f32) -> f32 {
    let pa = p - a;
    let ba = b - a;
    let h  = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h) - r;
}

fn sdBox(p: vec3f, b: vec3f) -> f32 {
    let q = abs(p) - b;
    return length(max(q, vec3f(0.0))) + min(max(q.x, max(q.y, q.z)), 0.0);
}

fn smin(a: f32, b: f32, k: f32) -> f32 {
    let h = max(k - abs(a - b), 0.0) / k;
    return min(a, b) - h * h * k * 0.25;
}

// ============================================================================
// Transformation Helpers
// ============================================================================
fn pModPolar(p: vec2f, repetitions: f32) -> vec2f {
    let angle = TAU / repetitions;
    let a     = atan2(p.y, p.x) + angle * 0.5;
    let r     = length(p);
    let c     = floor(a / angle);
    let new_a = a - c * angle - angle * 0.5;
    return vec2f(cos(new_a), sin(new_a)) * r;
}

fn repeat(p: vec3f, c: vec3f) -> vec3f {
    return p - c * round(p / c);
}

// ============================================================================
// Arm Animation Helpers
// ============================================================================
fn getBreathAnimationFactors() -> vec4f {
    let phase     = u_breath.phase;
    let progress  = u_breath.phaseProgress;
    let intensity = u_breath.intensity;
    let time      = u_breath.time;
    let strength  = f32(u_breath.strengthLevel);

    var shoulderAngle: f32 = ARM_RELAXED_ANGLE;
    var elbowBend:     f32 = ELBOW_RELAXED_BEND;
    var shoulderLift:  f32 = 0.0;
    var chestScale:    f32 = 1.0;

    switch(phase) {
        case 0u: {
            let t    = smoothstep(0.0, 1.0, progress);
            let ease = 1.0 - pow(1.0 - t, 2.0);
            shoulderAngle = ARM_RELAXED_ANGLE + (ARM_RAISED_ANGLE - ARM_RELAXED_ANGLE) * ease;
            elbowBend     = ELBOW_RELAXED_BEND + ELBOW_INHALE_BEND * ease;
            shoulderLift  = 0.04 * ease;
            chestScale    = 1.0 + 0.03 * intensity * sin(t * PI);
        }
        case 1u: {
            shoulderAngle  = ARM_RAISED_ANGLE;
            elbowBend      = ELBOW_INHALE_BEND;
            shoulderLift   = 0.04;
            shoulderAngle += sin(time * 2.0) * 0.0087 * intensity;
            shoulderAngle += sin(time * 0.7 + f32(u_breath.cycle)) * 0.01 * (strength / 10.0);
            chestScale     = 1.0 + 0.02 * intensity;
        }
        case 2u: {
            let t    = smoothstep(0.0, 1.0, progress);
            let ease = t * t;
            shoulderAngle = ARM_RAISED_ANGLE - (ARM_RAISED_ANGLE - ARM_RELAXED_ANGLE) * ease;
            elbowBend     = ELBOW_INHALE_BEND * (1.0 - ease);
            shoulderLift  = 0.04 * (1.0 - ease);
            chestScale    = 1.0 + 0.02 * intensity * (1.0 - ease);
        }
        case 3u: {
            shoulderAngle  = ARM_RELAXED_ANGLE;
            elbowBend      = ELBOW_RELAXED_BEND;
            shoulderLift   = 0.0;
            shoulderAngle += sin(time * 1.5) * 0.02 * intensity * (1.0 + strength / 20.0);
            chestScale     = 1.0 + 0.01 * intensity * sin(time * 2.0);
        }
        default: { shoulderAngle = ARM_RELAXED_ANGLE; }
    }

    shoulderAngle = ARM_RELAXED_ANGLE + (shoulderAngle - ARM_RELAXED_ANGLE) * intensity;
    return vec4f(shoulderAngle, elbowBend, shoulderLift, chestScale);
}

struct ArmSegments {
    elbow: vec3f,
    hand:  vec3f,
}

fn computeLeftArm(sa: f32, eb: f32, sl: f32) -> ArmSegments {
    let shoulder = vec3f(-0.3, 0.4 + sl, 0.0);
    let elbow    = shoulder + vec3f(-sin(sa), -cos(sa), 0.0) * 0.35;
    let hand     = elbow    + vec3f(-sin(sa + eb), -cos(sa + eb), 0.0) * 0.35;
    return ArmSegments(elbow, hand);
}

fn computeRightArm(sa: f32, eb: f32, sl: f32) -> ArmSegments {
    let shoulder = vec3f(0.3, 0.4 + sl, 0.0);
    let elbow    = shoulder + vec3f(sin(sa), -cos(sa), 0.0) * 0.35;
    let hand     = elbow    + vec3f(sin(sa + eb), -cos(sa + eb), 0.0) * 0.35;
    return ArmSegments(elbow, hand);
}

// ============================================================================
// Sacred Geometry Rings
// ============================================================================
fn breathScale(pp: f32, intensity: f32, offset: f32) -> f32 {
    return 1.0 + 0.06 * sin(pp * TAU + offset) * intensity;
}

fn breathRotation(pp: f32, intensity: f32) -> f32 {
    let f = smoothstep(0.0, 0.5, pp) * (1.0 - smoothstep(0.5, 1.0, pp));
    return pp * 0.1 * intensity * f;
}

fn hexRing(p: vec2f, r: f32, thickness: f32) -> f32 {
    let angle  = TAU / 6.0;
    let a0     = round(atan2(p.y, p.x) / angle) * angle;
    let p_rot  = vec2f(p.x * cos(-a0) - p.y * sin(-a0), p.x * sin(-a0) + p.y * cos(-a0));
    return abs(length(p_rot) - r) - thickness;
}

fn triRing(p: vec2f, r: f32, thickness: f32) -> f32 {
    let angle  = TAU / 3.0;
    let a0     = round(atan2(p.y, p.x) / angle) * angle;
    let p_rot  = vec2f(p.x * cos(-a0) - p.y * sin(-a0), p.x * sin(-a0) + p.y * cos(-a0));
    return abs(length(p_rot) - r) - thickness;
}

fn rings(p: vec3f) -> f32 {
    let pp        = u_breath.phaseProgress;
    let intensity = u_breath.intensity;
    let rot       = breathRotation(pp, intensity);
    let cRot      = cos(rot);
    let sRot      = sin(rot);
    var d:        f32 = 1e10;

    let rotate2 = fn(v: vec2f) -> vec2f { return vec2f(v.x * cRot - v.y * sRot,
                                                        v.x * sRot + v.y * cRot); };
    d = min(d, hexRing(rotate2(p.xz) / breathScale(pp, intensity, 0.0), 1.5, 0.02));
    d = min(d, triRing(rotate2(p.xz) / breathScale(pp, intensity, 0.5), 1.2, 0.015));
    d = min(d, abs(length(rotate2(p.xz) / breathScale(pp, intensity, 1.0)) - 0.9) - 0.01);
    return d;
}

// ============================================================================
// Kaleidoscope (3 iterations — mobile optimised)
// ============================================================================
fn kalei(p: vec3f) -> vec3f {
    let pp        = u_breath.phaseProgress;
    let intensity = u_breath.intensity;
    let dr        = 0.02 * sin(pp * PI) * intensity;
    let microOsc  = sin(u_breath.time * 8.0) * 0.005 * intensity;
    var pos       = p + normalize(p + 1e-8) * (dr + microOsc);
    var col       = vec3f(0.0);

    for (var i: i32 = 0; i < 3; i = i + 1) {
        pos      = abs(pos) - 0.5;
        pos      = repeat(pos, vec3f(1.0));
        let p2   = pModPolar(pos.xy, 6.0);
        pos      = vec3f(p2.x, p2.y, pos.z);
        let pat  = sin(pos.x * 3.0 + f32(i)) * cos(pos.y * 3.0);
        col     += vec3f(0.02 * (1.0 + 0.3 * sin(pp * TAU) * intensity)) * pat;
    }
    return col;
}

// ============================================================================
// Scene Map
// ============================================================================
fn map(p: vec3f) -> vec4f {
    var d:   f32 = 1000.0;
    var mat: f32 = 0.0;

    let anim = getBreathAnimationFactors();
    let sa   = anim.x;
    let eb   = anim.y;
    let sl   = anim.z;
    let cs   = anim.w;

    // Torso
    d   = sdPill(p, vec3f(0.0, 0.0, 0.0), vec3f(0.0, 0.5, 0.0), 0.25 * cs);
    mat = 0.0;

    // Head
    let dh = sdSphere(p - vec3f(0.0, 0.85, 0.0), 0.18);
    if (dh < d) { d = dh; mat = 1.0; }

    // Arms
    let la  = computeLeftArm(sa, eb, sl);
    let ra  = computeRightArm(sa, eb, sl);
    let lsh = vec3f(-0.3, 0.4 + sl, 0.0);
    let rsh = vec3f( 0.3, 0.4 + sl, 0.0);
    let k:  f32 = 0.08;

    var dl = smin(sdPill(p, lsh, la.elbow, 0.09), sdPill(p, la.elbow, la.hand, 0.08), k);
    dl     = smin(dl, sdSphere(p - la.hand, 0.09), k);
    var dr = smin(sdPill(p, rsh, ra.elbow, 0.09), sdPill(p, ra.elbow, ra.hand, 0.08), k);
    dr     = smin(dr, sdSphere(p - ra.hand, 0.09), k);

    let da = min(dl, dr);
    if (da < d) { d = da; mat = 2.0; }

    // Legs
    let dlegs = min(sdPill(p, vec3f(-0.15, -0.1, 0.0), vec3f(-0.2, -1.0, 0.0), 0.12),
                    sdPill(p, vec3f( 0.15, -0.1, 0.0), vec3f( 0.2, -1.0, 0.0), 0.12));
    if (dlegs < d) { d = dlegs; mat = 3.0; }

    // Background mesh
    let bf      = sin(u_breath.phaseProgress * TAU) * u_breath.intensity * 0.5;
    let bg_rep  = repeat(p * 0.5 / (1.0 + 0.02 * bf), vec3f(2.0));
    var dbg     = sdBox(bg_rep, vec3f(0.3)) - 0.05;
    dbg         = max(dbg, -(length(bg_rep) - (0.4 + 0.02 * bf)));
    if (dbg < d) { d = dbg; mat = 5.0; }

    // Rings
    let dr2 = rings(p);
    if (dr2 < d) { d = dr2; mat = 6.0; }

    return vec4f(d, mat, 0.0, 0.0);
}

// ============================================================================
// Chakra Energy System
// ============================================================================
fn cheapSin(x: f32) -> f32 {
    let y  = x - TAU * floor(x / TAU + 0.5);
    let y3 = y * y * y;
    return y - y3 / 6.0 + y3 * y * y / 120.0;
}

fn hsv2rgb(h: f32, s: f32, v: f32) -> vec3f {
    let k = vec3f(1.0, 0.666666667, 0.333333333);
    let p = abs(fract(vec3f(h) + k) * 6.0 - vec3f(3.0));
    return v * mix(vec3f(1.0), clamp(p - vec3f(1.0), vec3f(0.0), vec3f(1.0)), s);
}

fn getPhaseShiftedHue(baseHue: f32, phase: u32, pp: f32) -> f32 {
    var off: f32 = 0.0;
    switch(phase) {
        case 0u: { off =  0.05 * pp; }
        case 1u: { off =  0.05; }
        case 2u: { off =  0.05 - 0.13 * pp; }
        case 3u: { off = -0.08; }
        default: { off =  0.0; }
    }
    let h = baseHue + off;
    return h - floor(h);
}

fn energyFlow(p: vec3f, phase: u32, pp: f32, tt: f32) -> vec3f {
    var fi: f32 = 0.0;
    if (phase == 0u)      { fi = pp * 0.6; }
    else if (phase == 1u) { fi = 0.6 + cheapSin(tt * 2.0) * 0.1; }
    if (fi < 0.01) { return vec3f(0.0); }

    let ds = length(vec2f(p.x, p.z));
    if (ds > 0.25) { return vec3f(0.0); }

    let yn = (p.y + 0.8) / 1.7;
    var fw: f32 = 0.0;
    if (phase == 0u) {
        let wp = pp * 1.2 - 0.1;
        fw     = smoothstep(wp - 0.3, wp, yn) * smoothstep(wp + 0.2, wp, yn);
    } else {
        fw = 0.7 + cheapSin(yn * 8.0 + tt * 2.0) * 0.3;
    }

    let beam = smoothstep(0.25, 0.0, ds) * smoothstep(0.0, 0.15, ds);
    let hue  = select(0.12, 0.55, phase == 2u || phase == 3u);
    return hsv2rgb(hue, 0.8, 1.0) * fw * beam * fi * 0.4;
}

fn chakras(p: vec3f, tt: f32) -> vec3f {
    let offs = array<vec3f, 7>(
        vec3f(0.0, -0.8, 0.0), vec3f(0.0, -0.5, 0.0), vec3f(0.0, -0.2, 0.0),
        vec3f(0.0,  0.1, 0.0), vec3f(0.0,  0.35, 0.0), vec3f(0.0,  0.6, 0.0),
        vec3f(0.0,  0.9, 0.0)
    );
    let hues = array<f32, 7>(0.0, 0.08, 0.16, 0.33, 0.58, 0.75, 0.83);

    var col  = vec3f(0.0);
    let ph   = u_breath.phase;
    let pp   = u_breath.phaseProgress;
    let intn = u_breath.intensity;

    for (var i: i32 = 0; i < 7; i = i + 1) {
        let dist = length(p - offs[i]);
        let fi   = f32(i);
        var act: f32 = 0.0;
        var pls: f32 = 1.0;

        switch(ph) {
            case 0u: {
                let wp = pp * 1.5 - fi * 0.15;
                act    = select(0.3, min(0.3 + 0.7 * smoothstep(0.0, 0.3, wp), 1.0), wp > 0.0);
                pls    = 1.0 + cheapSin(tt * 3.0 + fi * 0.5) * 0.05;
            }
            case 1u: { act = 1.0; pls = 1.0 + cheapSin(tt * 2.0) * 0.1; }
            case 2u: {
                let wp = pp * 1.5 - (6.0 - fi) * 0.15;
                act    = select(1.0, max(1.0 - 0.6 * smoothstep(0.0, 0.3, wp), 0.4), wp > 0.0);
                pls    = 1.0 + cheapSin(tt * 1.5 + fi * 0.3) * 0.05;
            }
            case 3u: { act = 0.2; pls = 1.0 + cheapSin(tt * 1.0) * 0.05; }
            default: { act = 0.3; pls = 1.0; }
        }

        let rad      = 0.08 * (0.5 + 0.5 * act);
        let glow     = smoothstep(rad + 0.15 + 0.1 * act, rad, dist);
        let ringGlow = smoothstep(0.08, 0.0, abs(dist - rad * 1.5)) * 0.3 * act;

        var sat: f32 = 0.9;
        var val: f32 = act * pls;
        if (ph == 1u) { sat = 1.0; val = min(val * 1.1, 1.0); }

        let cc = hsv2rgb(getPhaseShiftedHue(hues[i], ph, pp), sat, val);
        col   += cc * (glow + ringGlow);
    }

    col += energyFlow(p, ph, pp, tt);
    col *= 1.0 + 0.4 * intn;
    return col;
}

// ============================================================================
// Optimised Raymarcher
// ============================================================================
fn trace(ro: vec3f, rd: vec3f) -> vec4f {
    var t   = 0.0;
    var res = vec4f(-1.0);
    for (var i: i32 = 0; i < 64; i = i + 1) {
        let h = map(ro + rd * t);
        if (h.x < 0.001) { res = vec4f(t, h.yzw); break; }
        if (t > 20.0) { break; }
        t += max(h.x * select(0.9, 0.7, h.x < 0.1), 0.001);
    }
    return res;
}

fn calcNormal(p: vec3f) -> vec3f {
    let e  = 0.001;
    let v1 = vec3f( 1.0, -1.0, -1.0);
    let v2 = vec3f(-1.0, -1.0,  1.0);
    let v3 = vec3f(-1.0,  1.0, -1.0);
    let v4 = vec3f( 1.0,  1.0,  1.0);
    return normalize(v1 * map(p + v1 * e).x + v2 * map(p + v2 * e).x
                   + v3 * map(p + v3 * e).x + v4 * map(p + v4 * e).x);
}

fn shade(mat: f32, diff: f32) -> vec3f {
    var col: vec3f;
    switch (i32(mat)) {
        case 0:  { col = vec3f(0.8, 0.7, 0.6); }
        case 1:  { col = vec3f(0.9, 0.85, 0.8); }
        case 2:  { col = vec3f(0.7, 0.6, 0.5); }
        case 3:  { col = vec3f(0.6, 0.5, 0.4); }
        case 5:  { col = vec3f(0.0, 0.8, 1.0); }
        case 6:  { col = vec3f(1.0, 0.84, 0.0); }
        default: { col = vec3f(0.5); }
    }
    return col * (diff + 0.3);
}

// ============================================================================
// Color Grading
// ============================================================================
fn rgbToHsv(c: vec3f) -> vec3f {
    let K = vec4f(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    let p = mix(vec4f(c.bg, K.wz), vec4f(c.gb, K.xy), step(c.b, c.g));
    let q = mix(vec4f(p.xyw, c.r), vec4f(c.r, p.yzx), step(p.x, c.r));
    let d = q.x - min(q.w, q.y);
    return vec3f(abs(q.z + (q.w - q.y) / (6.0 * d + 1e-10)), d / (q.x + 1e-10), q.x);
}

fn hsvToRgb(c: vec3f) -> vec3f {
    let K = vec3f(1.0, 2.0 / 3.0, 1.0 / 3.0);
    let p = abs(fract(c.xxx + K.xyz) * 6.0 - vec3f(3.0));
    return c.z * mix(vec3f(K.x), clamp(p - vec3f(K.x), vec3f(0.0), vec3f(1.0)), c.y);
}

fn getPalette(phase: u32) -> BreathPalette {
    switch phase {
        case 0u: { return PALETTE_INHALE; }
        case 1u: { return PALETTE_HOLD1;  }
        case 2u: { return PALETTE_EXHALE; }
        default: { return PALETTE_HOLD2;  }
    }
}

fn applyBreathGrade(col_in: vec3f) -> vec3f {
    var col     = col_in;
    let current = getPalette(u_breath.phase);
    let next    = getPalette((u_breath.phase + 1u) % 4u);
    let t       = smoothstep(0.0, 1.0, u_breath.phaseProgress);
    let pal     = BreathPalette(
        mix(current.tint,     next.tint,     t),
        mix(current.hueShift, next.hueShift, t),
        mix(current.satMod,   next.satMod,   t),
        mix(current.contrast, next.contrast, t)
    );

    col = (col - vec3f(0.5)) * pal.contrast + vec3f(0.5);

    var hsv = rgbToHsv(col);
    col     = hsvToRgb(vec3f(hsv.x, clamp(hsv.y * pal.satMod, 0.0, 1.0), hsv.z));

    hsv = rgbToHsv(col);
    col = hsvToRgb(vec3f(fract(hsv.x + pal.hueShift), hsv.y, hsv.z));

    col     = col * pal.tint;
    hsv     = rgbToHsv(col);
    let boost = 1.0 + f32(u_breath.strengthLevel) * 0.02;
    col     = hsvToRgb(vec3f(hsv.x, clamp(hsv.y * boost, 0.0, 1.0), hsv.z));

    return clamp(col, vec3f(0.0), vec3f(2.0));
}

// ============================================================================
// Fragment Shader
// ============================================================================
@fragment
fn fs_main(@builtin(position) fragCoord: vec4f) -> @location(0) vec4f {
    let res = iResolution.xy;
    let uv  = (fragCoord.xy - res * 0.5) / min(res.x, res.y);

    let ro  = vec3f(0.0, 0.0, 3.0);
    let rd  = normalize(vec3f(uv.x, uv.y, -1.5));

    var col = vec3f(0.05, 0.05, 0.1);

    // Kaleidoscope background
    col += kalei(ro + rd * 2.0) * 0.3;

    // Raymarch
    let hit = trace(ro, rd);
    if (hit.x > 0.0) {
        let p    = ro + rd * hit.x;
        let n    = calcNormal(p);
        let diff = max(dot(n, normalize(vec3f(0.5, 1.0, 0.5))), 0.0);
        col      = shade(hit.y, diff);
        col      = mix(col, vec3f(0.05, 0.05, 0.1), 1.0 - exp(-hit.x * 0.1));
    }

    // Chakra overlay (sample along ray; fall back to near midpoint if no hit)
    col += chakras(ro + rd * select(2.0, hit.x, hit.x > 0.0), u_breath.time);

    // Color grading
    col = applyBreathGrade(col);

    // Vignette
    col *= pow(1.0 - length(uv), 2.0) * (0.8 + 0.4 * u_breath.intensity) * 0.5 + 0.5;

    // Gamma
    col = pow(max(col, vec3f(0.0)), vec3f(1.0 / 2.2));

    return vec4f(col, 1.0);
}
