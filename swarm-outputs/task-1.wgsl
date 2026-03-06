// ============================================================================
// Breathing Meditation Shader - Organic Arm Animation
// ============================================================================
// AGENT 1: Organic Animation Specialist
// Implements realistic arm raising/lowering synchronized with breath phases
//
// CONFLICT FLAGS:
// - Modifies: map() function completely (arm construction logic rewritten)
// - Adds: getBreathAnimationFactors(), computeArmRotations() helpers
// - Uses: u_breath.phase, u_breath.phaseProgress, u_breath.intensity
// - Coordinate: If Agent 2 modifies arm geometry, merge rotation logic
// - Coordinate: If Agent 3 adds hand details, ensure hand positions passed through
// ============================================================================

// Uniform buffer matching React BreathUniforms interface
struct BreathUniforms {
    time: f32,
    phase: u32,          // 0=inhale, 1=hold1, 2=exhale, 3=hold2
    phaseProgress: f32,  // 0.0 -> 1.0 within current phase
    cycle: u32,
    strengthLevel: u32,  // 0-10
    intensity: f32,      // 0.0-1.0
}

@binding(0) @group(0) var<uniform> u_breath: BreathUniforms;

// ============================================================================
// Constants
// ============================================================================
const PI: f32 = 3.14159265359;
const TAU: f32 = 6.28318530718;
const EPSILON: f32 = 0.001;

// Arm animation angle constants (in radians)
const ARM_RELAXED_ANGLE: f32 = 0.26;      // ~15° from body (slight outward)
const ARM_RAISED_ANGLE: f32 = 1.22;       // ~70° outward at peak
const ELBOW_RELAXED_BEND: f32 = 0.0;      // Straight when relaxed
const ELBOW_INHALE_BEND: f32 = 0.17;      // ~10° bend at peak inhale

// ============================================================================
// SDF Primitives & Operations
// ============================================================================
fn sdSphere(p: vec3f, r: f32) -> f32 {
    return length(p) - r;
}

fn sdCapsule(p: vec3f, a: vec3f, b: vec3f, r: f32) -> f32 {
    let pa = p - a;
    let ba = b - a;
    let h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h) - r;
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

// 3D rotation around X axis (for arm swing)
fn rotX(angle: f32) -> mat3x3f {
    let c = cos(angle);
    let s = sin(angle);
    return mat3x3f(
        1.0, 0.0, 0.0,
        0.0, c, -s,
        0.0, s, c
    );
}

// 3D rotation around Z axis (for arm outward/inward)
fn rotZ(angle: f32) -> mat3x3f {
    let c = cos(angle);
    let s = sin(angle);
    return mat3x3f(
        c, -s, 0.0,
        s, c, 0.0,
        0.0, 0.0, 1.0
    );
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
// Breathing Animation Helpers
// ============================================================================

// Precompute animation factors based on breath phase
// Returns: vec4f(shoulderAngle, elbowBend, shoulderLift, chestScale)
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
    
    // Phase-based animation logic
    switch(phase) {
        case 0u: { // INHALE: raise arms
            let t = smoothstep(0.0, 1.0, progress);
            // Ease-out for natural lifting
            let ease = 1.0 - pow(1.0 - t, 2.0);
            shoulderAngle = ARM_RELAXED_ANGLE + (ARM_RAISED_ANGLE - ARM_RELAXED_ANGLE) * ease;
            elbowBend = ELBOW_RELAXED_BEND + ELBOW_INHALE_BEND * ease;
            shoulderLift = 0.04 * ease;
            chestScale = 1.0 + 0.03 * intensity * sin(t * PI);
        }
        case 1u: { // HOLD1: maintain with micro-sway
            shoulderAngle = ARM_RAISED_ANGLE;
            elbowBend = ELBOW_INHALE_BEND;
            shoulderLift = 0.04;
            // Micro-sway: ±0.5° * intensity
            let sway = sin(time * 2.0) * 0.0087 * intensity; // 0.0087 rad ≈ 0.5°
            shoulderAngle += sway;
            // Add subtle human variance based on strengthLevel
            let variance = sin(time * 0.7 + f32(u_breath.cycle)) * 0.01 * (strength / 10.0);
            shoulderAngle += variance;
            chestScale = 1.0 + 0.02 * intensity;
        }
        case 2u: { // EXHALE: lower with gravity feel
            let t = smoothstep(0.0, 1.0, progress);
            // Ease-in for gravity-based lowering
            let ease = t * t;
            shoulderAngle = ARM_RAISED_ANGLE - (ARM_RAISED_ANGLE - ARM_RELAXED_ANGLE) * ease;
            elbowBend = ELBOW_INHALE_BEND * (1.0 - ease);
            shoulderLift = 0.04 * (1.0 - ease);
            chestScale = 1.0 + 0.02 * intensity * (1.0 - ease);
        }
        case 3u: { // HOLD2: fully relaxed, idle breathing
            shoulderAngle = ARM_RELAXED_ANGLE;
            elbowBend = ELBOW_RELAXED_BEND;
            shoulderLift = 0.0;
            // Subtle idle motion
            let idle = sin(time * 1.5) * 0.02 * intensity * (1.0 + strength / 20.0);
            shoulderAngle += idle;
            chestScale = 1.0 + 0.01 * intensity * sin(time * 2.0);
        }
        default: {
            shoulderAngle = ARM_RELAXED_ANGLE;
        }
    }
    
    // Apply global intensity modulation
    let angleRange = ARM_RAISED_ANGLE - ARM_RELAXED_ANGLE;
    let currentRange = shoulderAngle - ARM_RELAXED_ANGLE;
    shoulderAngle = ARM_RELAXED_ANGLE + currentRange * intensity;
    
    return vec4f(shoulderAngle, elbowBend, shoulderLift, chestScale);
}

// ============================================================================
// Arm Construction with Rotation Hierarchy
// ============================================================================

// Compute arm segment endpoints with proper joint rotations
// 
// ROTATION HIERARCHY EXPLANATION:
// 1. Shoulder is the root joint - apply primary outward/inward rotation (Z-axis)
// 2. Elbow is the secondary joint - apply bend during inhale (Z-axis, local to arm)
// 3. Both rotations happen in the XZ plane (side view of arm movement)
// 4. Hand position derived from elbow position + forearm vector
//
// For left arm (negative X side):
//   - Positive Z rotation = arm moves outward/away from body
//   - At shoulder: rotated vector points more upward during inhale
// For right arm (positive X side):
//   - Negative Z rotation = arm moves outward/away from body
//   - Rotation sign is flipped for symmetry

fn computeLeftArm(shoulderAngle: f32, elbowBend: f32, shoulderLift: f32) -> vec4f {
    // Base shoulder position with lift
    let shoulderPos = vec3f(-0.3, 0.4 + shoulderLift, 0.0);
    
    // Upper arm: from shoulder to elbow
    // Relaxed: pointing down at slight outward angle
    // Raised: rotated outward around Z axis (positive for left arm)
    let upperArmLen: f32 = 0.35;
    let upperArmDir = vec2f(-sin(shoulderAngle), -cos(shoulderAngle));
    let elbowPos = shoulderPos + vec3f(upperArmDir.x * upperArmLen, upperArmDir.y * upperArmLen, 0.0);
    
    // Forearm: from elbow to hand
    // Apply secondary elbow bend (additional outward rotation during inhale)
    let forearmLen: f32 = 0.35;
    let forearmAngle = shoulderAngle + elbowBend;
    let forearmDir = vec2f(-sin(forearmAngle), -cos(forearmAngle));
    let handPos = elbowPos + vec3f(forearmDir.x * forearmLen, forearmDir.y * forearmLen, 0.0);
    
    return vec4f(elbowPos, handPos);
}

fn computeRightArm(shoulderAngle: f32, elbowBend: f32, shoulderLift: f32) -> vec4f {
    // Base shoulder position with lift
    let shoulderPos = vec3f(0.3, 0.4 + shoulderLift, 0.0);
    
    // Upper arm: mirrored from left (negative Z rotation for right arm)
    let upperArmLen: f32 = 0.35;
    let upperArmDir = vec2f(sin(shoulderAngle), -cos(shoulderAngle));
    let elbowPos = shoulderPos + vec3f(upperArmDir.x * upperArmLen, upperArmDir.y * upperArmLen, 0.0);
    
    // Forearm with elbow bend
    let forearmLen: f32 = 0.35;
    let forearmAngle = shoulderAngle + elbowBend;
    let forearmDir = vec2f(sin(forearmAngle), -cos(forearmAngle));
    let handPos = elbowPos + vec3f(forearmDir.x * forearmLen, forearmDir.y * forearmLen, 0.0);
    
    return vec4f(elbowPos, handPos);
}

// ============================================================================
// Figure Construction (Humanoid with Animated Arms)
// ============================================================================
fn map(p: vec3f) -> vec4f {
    var pos = p;
    var d: f32 = 1000.0;
    var mat: f32 = 0.0;
    
    // --- Precompute animation factors (single call) ---
    let anim = getBreathAnimationFactors();
    let shoulderAngle = anim.x;
    let elbowBend = anim.y;
    let shoulderLift = anim.z;
    let chestScale = anim.w;
    
    // --- Torso (chest capsule with breathing scale) ---
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
    
    // --- Arms (ANIMATED) ---
    // Compute arm geometry with breathing animation
    let l_arm = computeLeftArm(shoulderAngle, elbowBend, shoulderLift);
    let l_shoulder = vec3f(-0.3, 0.4 + shoulderLift, 0.0);
    let l_elbow = l_arm.xyz;
    let l_hand = l_arm.w;
    
    let r_arm = computeRightArm(shoulderAngle, elbowBend, shoulderLift);
    let r_shoulder = vec3f(0.3, 0.4 + shoulderLift, 0.0);
    let r_elbow = r_arm.xyz;
    let r_hand = r_arm.w;
    
    // Upper arms (shoulder to elbow)
    let d_l_upper = sdPill(pos, l_shoulder, l_elbow, 0.09);
    let d_r_upper = sdPill(pos, r_shoulder, r_elbow, 0.09);
    
    // Forearms (elbow to hand)
    let d_l_fore = sdPill(pos, l_elbow, l_hand, 0.08);
    let d_r_fore = sdPill(pos, r_elbow, r_hand, 0.08);
    
    // Hands (small spheres at endpoints)
    let d_l_hand = sdSphere(pos - l_hand, 0.09);
    let d_r_hand = sdSphere(pos - r_hand, 0.09);
    
    // Combine arm segments with smooth union
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
    
    // --- Legs (static, grounded) ---
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
    
    return vec4f(d, mat, 0.0, 0.0);
}

// ============================================================================
// Technical Summary
// ============================================================================
// 
// ANIMATION IMPLEMENTATION:
// - getBreathAnimationFactors(): Single function computes all animation state
//   based on u_breath.phase and u_breath.phaseProgress
// - Uses smoothstep() for phase transitions, sin() for micro-sway/idle motion
// - Max 3 sin/cos calls in animation path (within performance budget)
//
// ROTATION HIERARCHY:
// - Primary: Shoulder rotation around Z-axis (outward/inward)
// - Secondary: Elbow bend for natural arm curve during inhale
// - Both computed in 2D XZ plane, then applied to 3D positions
// - Left/right arms use mirrored angle calculations
//
// TORSO INTEGRATION:
// - Shoulder lift (0.0 → 0.04 units) follows arm rotation
// - Chest capsule scales 1.0 → 1.03 during inhale peak
// - Both effects modulated by u_breath.intensity
//
// PERFORMANCE:
// - Precomputed rotation matrices not needed (2D trig sufficient)
// - 4 sdPill + 2 sdSphere calls for arms (acceptable)
// - Single switch statement for phase logic
//
// COORDINATION NOTES:
// - If merging with hand detail modifications: l_hand/r_hand positions exposed
// - If merging with material changes: mat=2.0 for arms
// - If merging with lighting: shoulderLift affects arm shadow positions
// ============================================================================
