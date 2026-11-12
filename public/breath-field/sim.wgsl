// Breath field — particle sim + cull (compute, one pass, two dispatches).
//
//   field_step: particlesIn (A) → particlesOut (B). Curl-noise drift plus a
//               breath-driven radial force: draw inward and rise on inhale,
//               hover on the holds, settle outward on exhale. Pointer/touch
//               pushes and swirls. Dead or escaped particles respawn here, on
//               the GPU — the CPU never reads this buffer back.
//   field_cull: counts live particles of B into `visible` and bumps
//               drawArgs.instanceCount for `drawIndirect`.
//
// The host swaps A/B every frame (two bind groups).

// @include "common.wgsl"

@group(1) @binding(0) var<uniform> field: FieldParams;
@group(1) @binding(1) var<storage, read> particlesIn: array<Particle>;
@group(1) @binding(2) var<storage, read_write> particlesOut: array<Particle>;
@group(1) @binding(3) var<storage, read_write> visible: array<u32>;
@group(1) @binding(4) var<storage, read_write> drawArgs: DrawArgs;

const WORKGROUP_SIZE: u32 = 64u;

fn valueNoise(p: vec2<f32>) -> f32 {
    let i = floor(p);
    let f = fract(p);
    let w = f * f * (3.0 - 2.0 * f);
    let base = vec2<u32>(vec2<i32>(i) + vec2<i32>(4096));
    let a = hash01((base.x * 73856093u) ^ (base.y * 19349663u));
    let b = hash01(((base.x + 1u) * 73856093u) ^ (base.y * 19349663u));
    let c = hash01((base.x * 73856093u) ^ ((base.y + 1u) * 19349663u));
    let d = hash01(((base.x + 1u) * 73856093u) ^ ((base.y + 1u) * 19349663u));
    return mix(mix(a, b, w.x), mix(c, d, w.x), w.y);
}

// Divergence-free drift: the curl of a slowly evolving noise potential.
fn curlNoise(p: vec2<f32>, t: f32) -> vec2<f32> {
    let e = 0.01;
    let q = p * 3.2 + vec2<f32>(t * 0.05, -t * 0.03);
    let dx = valueNoise(q + vec2<f32>(e, 0.0)) - valueNoise(q - vec2<f32>(e, 0.0));
    let dy = valueNoise(q + vec2<f32>(0.0, e)) - valueNoise(q - vec2<f32>(0.0, e));
    return vec2<f32>(dy, -dx) / (2.0 * e);
}

fn respawn(index: u32, salt: u32) -> Particle {
    let s = hashU32(index * 9781u + salt * 6271u + 17u);
    let angle = hash01(s) * TAU;
    // A loose ring well outside the monk, so inhale visibly gathers it in.
    let radius = mix(0.32, 0.62, sqrt(hash01(s ^ 0x9e3779b9u)));
    let pos = vec2<f32>(cos(angle) * radius * max(aspect(), 1.0) * 0.8, sin(angle) * radius);
    var p: Particle;
    p.pos = pos;
    p.vel = vec2<f32>(0.0);
    // Stagger lifetimes so respawn is continuous rather than in waves.
    p.life = mix(0.55, 1.0, hash01(s ^ 0x85ebca6bu));
    p.seed = s;
    return p;
}

// Phase force on one particle: inward + up on inhale, near-still on holds,
// outward + down on exhale. `progress` eases each phase in and out.
fn breathForce(pos: vec2<f32>, phase: i32, progress: f32) -> vec2<f32> {
    let r = max(length(pos), 1e-4);
    let radial = pos / r;
    // No pull inside the heart of the figure: keeps a soft void instead of a pile-up.
    let reach = smoothstep(0.05, 0.22, r);
    let ease = sin(clamp(progress, 0.0, 1.0) * PI);
    if (phase == PHASE_INHALE) {
        return (-radial * 0.55 * reach + vec2<f32>(0.0, -0.22)) * (0.35 + 0.65 * ease);
    }
    if (phase == PHASE_EXHALE) {
        return (radial * 0.34 + vec2<f32>(0.0, 0.12)) * (0.3 + 0.7 * ease);
    }
    return vec2<f32>(0.0);
}

fn pointerForce(pos: vec2<f32>) -> vec2<f32> {
    if (u.mouseStrength <= 0.0 || u.mouse.x < -1.5) {
        return vec2<f32>(0.0);
    }
    let d = pos - u.mouse;
    let dist = length(d);
    let radius = max(field.pointerRadius, 1e-3);
    if (dist > radius) {
        return vec2<f32>(0.0);
    }
    let falloff = 1.0 - smoothstep(0.0, radius, dist);
    let away = d / max(dist, 1e-3);
    let swirl = vec2<f32>(-away.y, away.x);
    return (away * 2.4 + swirl * 1.6) * falloff * u.mouseStrength;
}

@compute @workgroup_size(64)
fn field_step(@builtin(global_invocation_id) gid: vec3<u32>) {
    let index = gid.x;
    if (index >= field.count) {
        return;
    }
    var p = particlesIn[index];
    let dt = clamp(field.dt, 0.0, 0.05);
    let phase = breathPhaseIndex();
    let holding = phase == PHASE_HOLD_IN || phase == PHASE_HOLD_OUT;

    // Fresh (zeroed) buffers and dead particles respawn without any CPU seeding.
    if (p.life <= 0.0 || p.seed == 0u) {
        particlesOut[index] = respawn(index, field.frame);
        return;
    }

    let jitter = hash01(p.seed) * 0.6 + 0.7;
    var force = curlNoise(p.pos, u.time) * select(0.06, 0.022, holding) * jitter;
    force = force + breathForce(p.pos, phase, u.phaseProgress) * jitter;
    force = force + pointerForce(p.pos);

    // Holds damp hard so the field visibly hovers; the moving phases glide.
    let damping = select(1.6, 4.5, holding);
    p.vel = (p.vel + force * dt) * exp(-damping * dt);
    p.pos = p.pos + p.vel * dt;
    p.life = p.life - dt / mix(7.0, 13.0, hash01(p.seed ^ 0x27d4eb2fu));

    let bounds = vec2<f32>(aspect() * 0.5 + 0.05, 0.55);
    if (abs(p.pos.x) > bounds.x || abs(p.pos.y) > bounds.y) {
        p.life = 0.0;
    }
    particlesOut[index] = p;
}

@compute @workgroup_size(64)
fn field_cull(@builtin(global_invocation_id) gid: vec3<u32>) {
    let index = gid.x;
    if (index >= field.count) {
        return;
    }
    let p = particlesOut[index];
    // Fade-in/out alpha is life-shaped; skip particles that would draw nothing.
    if (p.life <= 0.01 || p.seed == 0u) {
        return;
    }
    let slot = atomicAdd(&drawArgs.instanceCount, 1u);
    visible[slot] = index;
}
