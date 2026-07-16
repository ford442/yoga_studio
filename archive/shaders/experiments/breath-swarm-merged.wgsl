// ============================================================================
// Breathing Meditation Shader - SWARM MERGED VERSION
// ============================================================================
// Agents: 1(Animation) + 2(Energy) + 3(Geometry) + 4(Color) + 5(Performance)
// Merge Order: Base → Agent5 patches → Agent1 → Agent3 → Agent2 → Agent4
// Target: Mobile WebGPU @ 60fps (Mali-G76/Adreno 610)
// ============================================================================

// ============================================================================
// Uniform Buffer - WITH PERFORMANCE OPTIMIZATIONS (Agent 5 Change 1, 7)
// ============================================================================
struct BreathUniforms {
    time: f32,
    phase: u32,          // 0=inhale, 1=hold1, 2=exhale, 3=hold2
    phaseProgress: f32,  // 0.0 -> 1.0 within current phase
    cycle: u32,
    strengthLevel: u32,  // 0-10
    intensity: f32,      // 0.0-1.0
    // Precomputed trig (Agent 5 optimization)
    sin_time: f32,
    cos_time: f32,
    sin_fast: f32,
    cos_fast: f32,
}

@binding(0) @group(0) var<uniform> u_breath: BreathUniforms;

// ============================================================================
// Constants
// ============================================================================
const PI: f32 = 3.14159265359;
const TAU: f32 = 6.28318530718;
const EPSILON: f32 = 0.001;

// Arm animation constants (Agent 1)
const ARM_RELAXED_ANGLE: f32 = 0.26;
const ARM_RAISED_ANGLE: f32 = 1.22;
const ELBOW_RELAXED_BEND: f32 = 0.0;
const ELBOW_INHALE_BEND: f32 = 0.17;

// ============================================================================
// Color Grading Palette (Agent 4)
// ============================================================================
struct BreathPalette {
    tint: vec3f,
    hueShift: f32,
    satMod: f32,
    contrast: f32,
}

const PALETTE_INHALE: BreathPalette = BreathPalette(vec3f(1.1, 0.95, 0.8), 0.03, 1.2, 1.0);
const PALETTE_HOLD1: BreathPalette = BreathPalette(vec3f(1.0, 1.0, 1.0), 0.0, 1.1, 1.1);
const PALETTE_EXHALE: BreathPalette = BreathPalette(vec3f(0.9, 1.0, 1.05), -0.05, 0.9, 1.0);
const PALETTE_HOLD2: BreathPalette = BreathPalette(vec3f(1.0, 1.0, 1.0), 0.0, 0.85, 0.95);

// ============================================================================
// SDF Primitives & Operations
// ============================================================================
fn sdSphere(p: vec3f, r: f32) -> f32 {
    return length(p) - r;
}

fn sdPill(p: vec3f, a: vec3f, b: vec3f, r: f32) -> f32 {
    let pa = p - a;
    let ba = b - a;
    let h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
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

fn sminBlend(a: f32, b: f32, k: f32) -> vec2f {
    let h = max(k - abs(a - b), 0.0) / k;
    let m = h * h * 0.5;
    let s = m * k * 0.5;
    return vec2f(min(a, b) - s, m);
}

// ============================================================================
// Transformation Helpers
// ============================================================================
fn rot2(angle: f32) -> mat2x2f {
    let c = cos(angle);
    let s = sin(angle);
    return mat2x2f(c, -s, s, c);
}

fn rotX(angle: f32) -> mat3x3f {
    let c = cos(angle);
    let s = sin(angle);
    return mat3x3f(1.0, 0.0, 0.0, 0.0, c, -s, 0.0, s, c);
}

fn rotZ(angle: f32) -> mat3x3f {
    let c = cos(angle);
    let s = sin(angle);
    return mat3x3f(c, -s, 0.0, s, c, 0.0, 0.0, 0.0, 1.0);
}

fn pModPolar(p: vec2f, repetitions: f32) -> vec2f {
    let angle = TAU / repetitions;
    let a = atan2(p.y, p.x) + angle * 0.5;
    let r = length(p);
    let c = floor(a / angle);
    let new_a = a - c * angle - angle * 0.5;
    return vec2f(cos(new_a), sin(new_a)) * r;
}

fn repeat(p: vec3f, c: vec3f) -> vec3f {
    return p - c * round(p / c);
}

// ============================================================================
// Agent 1: Arm Animation Helpers
// ============================================================================
fn getBreathAnimationFactors() -> vec4f {
    let phase = u_breath.phase;
    let progress = u_breath.phaseProgress;
    let intensity = u_breath.intensity;
    let time = u_breath.time;
    let strength = f32(u_breath.strengthLevel);
    
    var shoulderAngle: f32 = ARM_RELAXED_ANGLE;
    var elbowBend: f32 = ELBOW_RELAXED_BEND;
    var shoulderLift: f32 = 0.0;
    var chestScale: f32 = 1.0;
    
    switch(phase) {
        case 0u: {
            let t = smoothstep(0.0, 1.0, progress);
            let ease = 1.0 - pow(1.0 - t, 2.0);
            shoulderAngle = ARM_RELAXED_ANGLE + (ARM_RAISED_ANGLE - ARM_RELAXED_ANGLE) * ease;
            elbowBend = ELBOW_RELAXED_BEND + ELBOW_INHALE_BEND * ease;
            shoulderLift = 0.04 * ease;
            chestScale = 1.0 + 0.03 * intensity * sin(t * PI);
        }
        case 1u: {
            shoulderAngle = ARM_RAISED_ANGLE;
            elbowBend = ELBOW_INHALE_BEND;
            shoulderLift = 0.04;
            let sway = sin(time * 2.0) * 0.0087 * intensity;
            shoulderAngle += sway;
            let variance = sin(time * 0.7 + f32(u_breath.cycle)) * 0.01 * (strength / 10.0);
            shoulderAngle += variance;
            chestScale = 1.0 + 0.02 * intensity;
        }
        case 2u: {
            let t = smoothstep(0.0, 1.0, progress);
            let ease = t * t;
            shoulderAngle = ARM_RAISED_ANGLE - (ARM_RAISED_ANGLE - ARM_RELAXED_ANGLE) * ease;
            elbowBend = ELBOW_INHALE_BEND * (1.0 - ease);
            shoulderLift = 0.04 * (1.0 - ease);
            chestScale = 1.0 + 0.02 * intensity * (1.0 - ease);
        }
        case 3u: {
            shoulderAngle = ARM_RELAXED_ANGLE;
            elbowBend = ELBOW_RELAXED_BEND;
            shoulderLift = 0.0;
            let idle = sin(time * 1.5) * 0.02 * intensity * (1.0 + strength / 20.0);
            shoulderAngle += idle;
            chestScale = 1.0 + 0.01 * intensity * sin(time * 2.0);
        }
        default: {
            shoulderAngle = ARM_RELAXED_ANGLE;
        }
    }
    
    let currentRange = shoulderAngle - ARM_RELAXED_ANGLE;
    shoulderAngle = ARM_RELAXED_ANGLE + currentRange * intensity;
    
    return vec4f(shoulderAngle, elbowBend, shoulderLift, chestScale);
}

struct ArmSegments {
    elbow: vec3f,
    hand: vec3f,
}

fn computeLeftArm(shoulderAngle: f32, elbowBend: f32, shoulderLift: f32) -> ArmSegments {
    let shoulderPos = vec3f(-0.3, 0.4 + shoulderLift, 0.0);
    let upperArmLen: f32 = 0.35;
    let upperArmDir = vec2f(-sin(shoulderAngle), -cos(shoulderAngle));
    let elbowPos = shoulderPos + vec3f(upperArmDir.x * upperArmLen, upperArmDir.y * upperArmLen, 0.0);
    
    let forearmLen: f32 = 0.35;
    let forearmAngle = shoulderAngle + elbowBend;
    let forearmDir = vec2f(-sin(forearmAngle), -cos(forearmAngle));
    let handPos = elbowPos + vec3f(forearmDir.x * forearmLen, forearmDir.y * forearmLen, 0.0);
    
    return ArmSegments(elbowPos, handPos);
}

fn computeRightArm(shoulderAngle: f32, elbowBend: f32, shoulderLift: f32) -> ArmSegments {
    let shoulderPos = vec3f(0.3, 0.4 + shoulderLift, 0.0);
    let upperArmLen: f32 = 0.35;
    let upperArmDir = vec2f(sin(shoulderAngle), -cos(shoulderAngle));
    let elbowPos = shoulderPos + vec3f(upperArmDir.x * upperArmLen, upperArmDir.y * upperArmLen, 0.0);
    
    let forearmLen: f32 = 0.35;
    let forearmAngle = shoulderAngle + elbowBend;
    let forearmDir = vec2f(sin(forearmAngle), -cos(forearmAngle));
    let handPos = elbowPos + vec3f(forearmDir.x * forearmLen, forearmDir.y * forearmLen, 0.0);
    
    return ArmSegments(elbowPos, handPos);
}

// ============================================================================
// Agent 3: Sacred Geometry Rings
// ============================================================================
fn breathScale(phaseProgress: f32, intensity: f32, offset: f32) -> f32 {
    let phaseAngle = phaseProgress * TAU + offset;
    return 1.0 + 0.06 * sin(phaseAngle) * intensity;
}

fn breathRotation(phaseProgress: f32, intensity: f32) -> f32 {
    let inhaleFactor = smoothstep(0.0, 0.5, phaseProgress) * (1.0 - smoothstep(0.5, 1.0, phaseProgress));
    return phaseProgress * 0.1 * intensity * inhaleFactor;
}

fn hexRing(p: vec2f, r: f32, thickness: f32) -> f32 {
    let angle = TAU / 6.0;
    let a = atan2(p.y, p.x);
    let sector = round(a / angle);
    let a0 = sector * angle;
    let p_rot = vec2f(p.x * cos(-a0) - p.y * sin(-a0), p.x * sin(-a0) + p.y * cos(-a0));
    return abs(length(p_rot) - r) - thickness;
}

fn triRing(p: vec2f, r: f32, thickness: f32) -> f32 {
    let angle = TAU / 3.0;
    let a = atan2(p.y, p.x);
    let sector = round(a / angle);
    let a0 = sector * angle;
    let p_rot = vec2f(p.x * cos(-a0) - p.y * sin(-a0), p.x * sin(-a0) + p.y * cos(-a0));
    return abs(length(p_rot) - r) - thickness;
}

fn rings(p: vec3f) -> f32 {
    let p2_base = p.xz;
    var d = 1e10;
    
    let phaseProgress = u_breath.phaseProgress;
    let intensity = u_breath.intensity;
    
    let rotAngle = breathRotation(phaseProgress, intensity);
    let cosRot = cos(rotAngle);
    let sinRot = sin(rotAngle);
    
    // Layer 1: Inner ring
    let scale1 = breathScale(phaseProgress, intensity, 0.0);
    let p2_1 = vec2f(p2_base.x * cosRot - p2_base.y * sinRot, p2_base.x * sinRot + p2_base.y * cosRot) / scale1;
    d = min(d, hexRing(p2_1, 1.5, 0.02));
    
    // Layer 2: Mid ring
    let scale2 = breathScale(phaseProgress, intensity, 0.5);
    let p2_2 = vec2f(p2_base.x * cosRot - p2_base.y * sinRot, p2_base.x * sinRot + p2_base.y * cosRot) / scale2;
    d = min(d, triRing(p2_2, 1.2, 0.015));
    
    // Layer 3: Outer ring
    let scale3 = breathScale(phaseProgress, intensity, 1.0);
    let p2_3 = vec2f(p2_base.x * cosRot - p2_base.y * sinRot, p2_base.x * sinRot + p2_base.y * cosRot) / scale3;
    d = min(d, abs(length(p2_3) - 0.9) - 0.01);
    
    return d;
}

// ============================================================================
// Agent 3: Kaleidoscope with Breathing
// ============================================================================
fn kalei(p: vec3f) -> vec3f {
    let phaseProgress = u_breath.phaseProgress;
    let intensity = u_breath.intensity;
    let time = u_breath.time;
    
    let dr = 0.02 * sin(phaseProgress * PI) * intensity;
    let microOsc = sin(time * 8.0) * 0.005 * intensity;
    
    let p_radial = normalize(p + 1e-8);
    var pos = p + p_radial * (dr + microOsc);
    
    var col = vec3f(0.0);
    let patternScale = 3.0;
    
    // Agent 5: Reduced to 3 iterations (was 5)
    for (var i: i32 = 0; i < 3; i = i + 1) {
        pos = abs(pos) - 0.5;
        pos = repeat(pos, vec3f(1.0));
        let p2 = pModPolar(pos.xy, 6.0);
        pos = vec3f(p2.x, p2.y, pos.z);
        
        let pattern = sin(pos.x * patternScale + f32(i)) * cos(pos.y * patternScale);
        let contribution = 0.02 * (1.0 + 0.3 * sin(phaseProgress * TAU) * intensity);
        col += vec3f(contribution) * pattern;
    }
    
    return col;
}

// ============================================================================
// MERGED MAP: Agent 1 + Agent 3 (Arm Animation + Mesh Breathing)
// ============================================================================
fn map(p: vec3f) -> vec4f {
    var pos = p;
    var d: f32 = 1000.0;
    var mat: f32 = 0.0;
    
    // --- Agent 1: Precompute animation factors ---
    let anim = getBreathAnimationFactors();
    let shoulderAngle = anim.x;
    let elbowBend = anim.y;
    let shoulderLift = anim.z;
    let chestScale = anim.w;
    
    // --- Agent 1: Torso with breathing scale ---
    let chest_a = vec3f(0.0, 0.0, 0.0);
    let chest_b = vec3f(0.0, 0.5, 0.0);
    let chest_r = 0.25 * chestScale;
    d = sdPill(pos, chest_a, chest_b, chest_r);
    mat = 0.0;
    
    // --- Head ---
    let head_pos = vec3f(0.0, 0.85, 0.0);
    let head_r = 0.18;
    let d_head = sdSphere(pos - head_pos, head_r);
    if (d_head < d) {
        d = d_head;
        mat = 1.0;
    }
    
    // --- Agent 1: Animated Arms ---
    let l_arm = computeLeftArm(shoulderAngle, elbowBend, shoulderLift);
    let l_shoulder = vec3f(-0.3, 0.4 + shoulderLift, 0.0);
    let l_elbow = l_arm.elbow;
    let l_hand = l_arm.hand;
    
    let r_arm = computeRightArm(shoulderAngle, elbowBend, shoulderLift);
    let r_shoulder = vec3f(0.3, 0.4 + shoulderLift, 0.0);
    let r_elbow = r_arm.elbow;
    let r_hand = r_arm.hand;
    
    let d_l_upper = sdPill(pos, l_shoulder, l_elbow, 0.09);
    let d_r_upper = sdPill(pos, r_shoulder, r_elbow, 0.09);
    let d_l_fore = sdPill(pos, l_elbow, l_hand, 0.08);
    let d_r_fore = sdPill(pos, r_elbow, r_hand, 0.08);
    let d_l_hand = sdSphere(pos - l_hand, 0.09);
    let d_r_hand = sdSphere(pos - r_hand, 0.09);
    
    let k_arm = 0.08;
    var d_l_arm = smin(d_l_upper, d_l_fore, k_arm);
    d_l_arm = smin(d_l_arm, d_l_hand, k_arm);
    var d_r_arm = smin(d_r_upper, d_r_fore, k_arm);
    d_r_arm = smin(d_r_arm, d_r_hand, k_arm);
    
    let d_arms = min(d_l_arm, d_r_arm);
    if (d_arms < d) {
        d = d_arms;
        mat = 2.0;
    }
    
    // --- Legs ---
    let l_hip = vec3f(-0.15, -0.1, 0.0);
    let l_foot = vec3f(-0.2, -1.0, 0.0);
    let d_lleg = sdPill(pos, l_hip, l_foot, 0.12);
    
    let r_hip = vec3f(0.15, -0.1, 0.0);
    let r_foot = vec3f(0.2, -1.0, 0.0);
    let d_rleg = sdPill(pos, r_hip, r_foot, 0.12);
    
    let d_legs = min(d_lleg, d_rleg);
    if (d_legs < d) {
        d = d_legs;
        mat = 3.0;
    }
    
    // --- Agent 3: Mesh Breathing (Background) ---
    let phaseProgress = u_breath.phaseProgress;
    let intensity = u_breath.intensity;
    let breathFactor = sin(phaseProgress * TAU) * intensity * 0.5;
    let gridScale = 1.0 + 0.02 * breathFactor;
    
    let bg_pos = pos * 0.5 / gridScale;
    let bg_repeat = repeat(bg_pos, vec3f(2.0));
    var d_bg = sdBox(bg_repeat, vec3f(0.3)) - 0.05;
    let hollowBreath = 0.4 + 0.02 * breathFactor;
    d_bg = max(d_bg, -(length(bg_repeat) - hollowBreath));
    
    if (d_bg < d) {
        d = d_bg;
        mat = 5.0;
    }
    
    // --- Agent 3: Sacred Geometry Rings ---
    let ringDist = rings(pos);
    if (ringDist < d) {
        d = ringDist;
        mat = 6.0;
    }
    
    return vec4f(d, mat, 0.0, 0.0);
}

// ============================================================================
// Agent 2: Chakra Energy System
// ============================================================================
fn cheapSin(x: f32) -> f32 {
    let y = x - TAU * floor(x / TAU + 0.5);
    let y3 = y * y * y;
    return y - y3 / 6.0 + y3 * y * y / 120.0;
}

fn cheapCos(x: f32) -> f32 {
    return cheapSin(x + 1.57079632679);
}

fn getPhaseShiftedHue(baseHue: f32, phase: u32, phaseProgress: f32) -> f32 {
    var hueOffset: f32 = 0.0;
    switch(phase) {
        case 0u: { hueOffset = 0.05 * phaseProgress; }
        case 1u: { hueOffset = 0.05; }
        case 2u: { hueOffset = 0.05 - 0.13 * phaseProgress; }
        case 3u: { hueOffset = -0.08; }
        default: { hueOffset = 0.0; }
    }
    var newHue = baseHue + hueOffset;
    return newHue - floor(newHue);
}

fn hsv2rgb(h: f32, s: f32, v: f32) -> vec3f {
    let k = vec3f(1.0, 0.666666667, 0.333333333);
    let p = abs(fract(vec3f(h) + k) * 6.0 - vec3f(3.0));
    return v * mix(vec3f(1.0), clamp(p - vec3f(1.0), vec3f(0.0), vec3f(1.0)), s);
}

fn energyFlow(p: vec3f, phase: u32, phaseProgress: f32, tt: f32) -> vec3f {
    var flowIntensity: f32 = 0.0;
    
    if (phase == 0u) {
        flowIntensity = phaseProgress * 0.6;
    } else if (phase == 1u) {
        flowIntensity = 0.6 + cheapSin(tt * 2.0) * 0.1;
    }
    
    if (flowIntensity < 0.01) {
        return vec3f(0.0);
    }
    
    let distFromSpine = length(vec2f(p.x, p.z));
    if (distFromSpine > 0.25) {
        return vec3f(0.0);
    }
    
    let yMin = -0.8;
    let yMax = 0.9;
    let yNorm = (p.y - yMin) / (yMax - yMin);
    
    var flowWave: f32 = 0.0;
    if (phase == 0u) {
        let wavePos = phaseProgress * 1.2 - 0.1;
        flowWave = smoothstep(wavePos - 0.3, wavePos, yNorm) * smoothstep(wavePos + 0.2, wavePos, yNorm);
    } else {
        flowWave = 0.7 + cheapSin(yNorm * 8.0 + tt * 2.0) * 0.3;
    }
    
    let beamGlow = smoothstep(0.25, 0.0, distFromSpine) * smoothstep(0.0, 0.15, distFromSpine);
    
    var energyHue: f32 = 0.12;
    if (phase == 2u || phase == 3u) {
        energyHue = 0.55;
    }
    
    let energyCol = hsv2rgb(energyHue, 0.8, 1.0);
    return energyCol * flowWave * beamGlow * flowIntensity * 0.4;
}

fn chakras(p: vec3f, tt: f32) -> vec3f {
    let offs = array<vec3f, 7>(
        vec3f(0.0, -0.8, 0.0), vec3f(0.0, -0.5, 0.0), vec3f(0.0, -0.2, 0.0),
        vec3f(0.0, 0.1, 0.0), vec3f(0.0, 0.35, 0.0), vec3f(0.0, 0.6, 0.0), vec3f(0.0, 0.9, 0.0)
    );
    let hues = array<f32, 7>(0.0, 0.08, 0.16, 0.33, 0.58, 0.75, 0.83);
    
    var col = vec3f(0.0);
    let phase = u_breath.phase;
    let phaseProgress = u_breath.phaseProgress;
    let intensity = u_breath.intensity;
    
    for (var i: i32 = 0; i < 7; i = i + 1) {
        let center = offs[i];
        let dist = length(p - center);
        let fIdx = f32(i);
        
        var activation: f32 = 0.0;
        var pulse: f32 = 1.0;
        
        switch(phase) {
            case 0u: {
                let delay = fIdx * 0.15;
                let wavePos = phaseProgress * 1.5 - delay;
                if (wavePos > 0.0) {
                    activation = 0.3 + 0.7 * smoothstep(0.0, 0.3, wavePos);
                    activation = min(activation, 1.0);
                } else {
                    activation = 0.3;
                }
                pulse = 1.0 + cheapSin(tt * 3.0 + fIdx * 0.5) * 0.05;
            }
            case 1u: {
                activation = 1.0;
                pulse = 1.0 + cheapSin(tt * 2.0) * 0.1;
            }
            case 2u: {
                let reverseIdx = 6.0 - fIdx;
                let delay = reverseIdx * 0.15;
                let wavePos = phaseProgress * 1.5 - delay;
                if (wavePos > 0.0) {
                    activation = 1.0 - 0.6 * smoothstep(0.0, 0.3, wavePos);
                    activation = max(activation, 0.4);
                } else {
                    activation = 1.0;
                }
                pulse = 1.0 + cheapSin(tt * 1.5 + fIdx * 0.3) * 0.05;
            }
            case 3u: {
                activation = 0.2;
                pulse = 1.0 + cheapSin(tt * 1.0) * 0.05;
            }
            default: {
                activation = 0.3;
                pulse = 1.0;
            }
        }
        
        let baseRadius = 0.08;
        let radius = baseRadius * (0.5 + 0.5 * activation);
        let glowRadius = radius + 0.15 + 0.1 * activation;
        let glow = smoothstep(glowRadius, radius, dist);
        
        let ringDist = abs(dist - radius * 1.5);
        let ringGlow = smoothstep(0.08, 0.0, ringDist) * 0.3 * activation;
        
        let baseHue = hues[i];
        let shiftedHue = getPhaseShiftedHue(baseHue, phase, phaseProgress);
        
        var saturation: f32 = 0.9;
        var value: f32 = activation * pulse;
        
        if (phase == 1u) {
            saturation = 1.0;
            value = min(value * 1.1, 1.0);
        }
        
        let chakraCol = hsv2rgb(shiftedHue, saturation, value);
        col += chakraCol * glow;
        col += chakraCol * ringGlow;
    }
    
    let flowCol = energyFlow(p, phase, phaseProgress, tt);
    col += flowCol;
    
    let intensityMult = 1.0 + 0.4 * intensity;
    col *= intensityMult;
    
    return col;
}

// ============================================================================
// Agent 5: Optimized Raymarching (64 iterations, adaptive step)
// ============================================================================
fn trace(ro: vec3f, rd: vec3f) -> vec4f {
    var t = 0.0;
    var res = vec4f(-1.0);
    
    // Reduced from 100 to 64 iterations (Agent 5 Change 4)
    for (var i: i32 = 0; i < 64; i = i + 1) {
        let p = ro + rd * t;
        let h = map(p);
        
        if (h.x < 0.001) {
            res = vec4f(t, h.yzw);
            break;
        }
        if (t > 20.0) { break; }
        
        // Adaptive step scale
        let step_scale = select(0.9, 0.7, h.x < 0.1);
        t += max(h.x * step_scale, 0.001);
    }
    return res;
}

// Agent 5: Tetrahedron normal (4 samples instead of 6)
fn calcNormal(p: vec3f) -> vec3f {
    let e = 0.001;
    let v1 = vec3f(1.0, -1.0, -1.0);
    let v2 = vec3f(-1.0, -1.0, 1.0);
    let v3 = vec3f(-1.0, 1.0, -1.0);
    let v4 = vec3f(1.0, 1.0, 1.0);
    
    let d1 = map(p + v1 * e).x;
    let d2 = map(p + v2 * e).x;
    let d3 = map(p + v3 * e).x;
    let d4 = map(p + v4 * e).x;
    
    return normalize(v1 * d1 + v2 * d2 + v3 * d3 + v4 * d4);
}

fn shade(p: vec3f, n: vec3f, mat: f32, rd: vec3f) -> vec3f {
    let light_dir = normalize(vec3f(0.5, 1.0, 0.5));
    let diff = max(dot(n, light_dir), 0.0);
    let amb = 0.3;
    
    var col: vec3f;
    switch (i32(mat)) {
        case 0: { col = vec3f(0.8, 0.7, 0.6); }
        case 1: { col = vec3f(0.9, 0.85, 0.8); }
        case 2: { col = vec3f(0.7, 0.6, 0.5); }
        case 3: { col = vec3f(0.6, 0.5, 0.4); }
        case 4: { col = vec3f(0.9, 0.8, 0.7); }
        case 5: { col = vec3f(0.0, 0.8, 1.0); } // Background mesh
        case 6: { col = vec3f(1.0, 0.84, 0.0); } // Rings
        default: { col = vec3f(0.5); }
    }
    
    return col * (diff + amb);
}

// ============================================================================
// Agent 4: Color Grading Functions
// ============================================================================
fn getPalette(phase: u32) -> BreathPalette {
    switch phase {
        case 0u: { return PALETTE_INHALE; }
        case 1u: { return PALETTE_HOLD1; }
        case 2u: { return PALETTE_EXHALE; }
        case 3u: { return PALETTE_HOLD2; }
        default: { return PALETTE_HOLD2; }
    }
}

fn rgbToHsv(c: vec3f) -> vec3f {
    let K = vec4f(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    let p = mix(vec4f(c.bg, K.wz), vec4f(c.gb, K.xy), step(c.b, c.g));
    let q = mix(vec4f(p.xyw, c.r), vec4f(c.r, p.yzx), step(p.x, c.r));
    let d = q.x - min(q.w, q.y);
    let e = 1.0e-10;
    return vec3f(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

fn hsvToRgb(c: vec3f) -> vec3f {
    let K = vec3f(1.0, 2.0 / 3.0, 1.0 / 3.0);
    let p = abs(fract(c.xxx + K.xyz) * 6.0 - vec3f(3.0));
    return c.z * mix(vec3f(K.x), clamp(p - vec3f(K.x), vec3f(0.0), vec3f(1.0)), c.y);
}

fn applyHueShift(col: vec3f, shift: f32) -> vec3f {
    let hsv = rgbToHsv(col);
    return hsvToRgb(vec3f(fract(hsv.x + shift), hsv.y, hsv.z));
}

fn mixPalettes(a: BreathPalette, b: BreathPalette, t: f32) -> BreathPalette {
    return BreathPalette(mix(a.tint, b.tint, t), mix(a.hueShift, b.hueShift, t),
                         mix(a.satMod, b.satMod, t), mix(a.contrast, b.contrast, t));
}

fn getBlendedPalette(phase: u32, phaseProgress: f32) -> BreathPalette {
    let current = getPalette(phase);
    let next = getPalette((phase + 1u) % 4u);
    return mixPalettes(current, next, smoothstep(0.0, 1.0, phaseProgress));
}

fn applyContrast(col: vec3f, contrast: f32) -> vec3f {
    return (col - vec3f(0.5)) * contrast + vec3f(0.5);
}

fn applyBreathGrade(linearCol: vec3f, br: BreathUniforms) -> vec3f {
    var col = linearCol;
    let palette = getBlendedPalette(br.phase, br.phaseProgress);
    
    col = applyContrast(col, palette.contrast);
    
    let hsv = rgbToHsv(col);
    let adjustedSat = clamp(hsv.y * palette.satMod, 0.0, 1.0);
    col = hsvToRgb(vec3f(hsv.x, adjustedSat, hsv.z));
    
    col = applyHueShift(col, palette.hueShift);
    col = col * palette.tint;
    
    let strengthBoost = 1.0 + f32(br.strengthLevel) * 0.02;
    let hsv2 = rgbToHsv(col);
    col = hsvToRgb(vec3f(hsv2.x, clamp(hsv2.y * strengthBoost, 0.0, 1.0), hsv2.z));
    
    return clamp(col, vec3f(0.0), vec3f(2.0));
}

fn applyBreathVignette(uv: vec2f, intensity: f32) -> f32 {
    let dist = length(uv);
    let baseVig = pow(1.0 - dist, 2.0);
    let vigMultiplier = 0.8 + 0.4 * intensity;
    return baseVig * vigMultiplier * 0.5 + 0.5;
}

// ============================================================================
// Main Image - Full Integration
// ============================================================================
@fragment
fn mainImage(@builtin(position) fragCoord: vec4f) -> @location(0) vec4f {
    let uv = (fragCoord.xy - vec2f(400.0, 300.0)) / vec2f(600.0, 600.0);
    
    let ro = vec3f(0.0, 0.0, 3.0);
    let rd = normalize(vec3f(uv.x, uv.y, -1.5));
    
    var col = vec3f(0.05, 0.05, 0.1);
    
    // Agent 3: Kaleidoscope
    col += kalei(ro + rd * 2.0) * 0.3;
    
    // Agent 5: Optimized raymarch
    let res = trace(ro, rd);
    
    if (res.x > 0.0) {
        let p = ro + rd * res.x;
        let n = calcNormal(p);
        col = shade(p, n, res.y, rd);
        
        let fog = 1.0 - exp(-res.x * 0.1);
        col = mix(col, vec3f(0.05, 0.05, 0.1), fog);
    }
    
    // Agent 2: Chakras
    let chakra_col = chakras(ro + rd * res.x, u_breath.time);
    col += chakra_col;
    
    // Agent 4: Color grading (BEFORE gamma)
    col = applyBreathGrade(col, u_breath);
    
    // Agent 4: Vignette
    let vig = applyBreathVignette(uv, u_breath.intensity);
    col *= vig;
    
    // Gamma correction (LAST)
    col = pow(col, vec3f(1.0 / 2.2));
    
    return vec4f(col, 1.0);
}
