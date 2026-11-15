// Breath field — shared declarations for sim.wgsl, particles.wgsl and post.wgsl.
//
// Group 0 is the same 72-byte `Uniforms` every scene shader binds
// (app/lib/shaderContract.ts). The group-1 structs below are also declared in
// the contract (`GROUP1_STRUCTS`); `npm run validate:shaders` fails if these
// copies drift from it. Keep this module free of entry points.

struct Uniforms {
    time: f32,
    breathPhase: f32,
    intensity: f32,
    chakraPhase: f32,
    theme: f32,
    mandalaStyle: f32,
    phaseProgress: f32,
    strengthLevel: f32,
    mouse: vec2<f32>,
    mouseStrength: f32,
    chakraFocus: f32,
    resolution: vec2<f32>,
    geometryDensity: f32,
    interference: f32,
    figurePose: f32,
    qualityPreset: f32,
}

@group(0) @binding(0) var<uniform> u: Uniforms;

// Pointer space (shared with `u.mouse`): origin at the canvas centre, units of
// canvas height, y pointing down. x spans ±aspect/2, y spans ±0.5.
struct Particle {
    pos: vec2<f32>,
    vel: vec2<f32>,
    life: f32,
    seed: u32,
}

struct FieldParams {
    dt: f32,
    count: u32,
    frame: u32,
    pointerRadius: f32,
}

struct DrawArgs {
    vertexCount: u32,
    instanceCount: atomic<u32>,
    firstVertex: u32,
    firstInstance: u32,
}

const PI: f32 = 3.14159265359;
const TAU: f32 = 6.28318530718;

// Breath phase indices carried by `u.chakraPhase` (PracticeScreen CHAKRA_LABELS).
const PHASE_INHALE: i32 = 0;
const PHASE_HOLD_IN: i32 = 1;
const PHASE_EXHALE: i32 = 2;
const PHASE_HOLD_OUT: i32 = 3;

fn aspect() -> f32 {
    return max(u.resolution.x, 1.0) / max(u.resolution.y, 1.0);
}

fn breathPhaseIndex() -> i32 {
    return clamp(i32(round(u.chakraPhase)), 0, 3);
}

// PCG-style integer hash; deterministic per (seed, salt).
fn hashU32(x: u32) -> u32 {
    let v = x * 747796405u + 2891336453u;
    let word = ((v >> ((v >> 28u) + 4u)) ^ v) * 277803737u;
    return (word >> 22u) ^ word;
}

fn hash01(x: u32) -> f32 {
    return f32(hashU32(x)) / 4294967295.0;
}

// Same three theme palettes as the geometry overlay, so the field reads as one scene.
fn fieldPalette(theme: f32, mixAmount: f32) -> vec3<f32> {
    let cosmic = mix(vec3<f32>(0.42, 0.74, 1.0), vec3<f32>(0.86, 0.5, 1.0), mixAmount);
    let golden = mix(vec3<f32>(1.0, 0.66, 0.28), vec3<f32>(1.0, 0.9, 0.5), mixAmount);
    let ocean = mix(vec3<f32>(0.3, 0.95, 0.85), vec3<f32>(0.36, 0.62, 1.0), mixAmount);
    var color = cosmic;
    color = mix(color, golden, smoothstep(0.35, 1.0, 1.0 - abs(theme - 1.0)));
    color = mix(color, ocean, smoothstep(0.35, 1.0, 1.0 - abs(theme - 2.0)));
    return color;
}
