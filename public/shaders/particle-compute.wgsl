// ============================================================================
// Prana Particle System — Compute Shader
// ============================================================================
// Simulates energy particles flowing along the chakra column (spine).
// Breath-synchronized: inhale draws up, exhale bursts out, holds orbit.
// ============================================================================

struct BreathUniforms {
    time:          f32,
    phase:         u32,
    phaseProgress: f32,
    cycle:         u32,
    strengthLevel: u32,
    intensity:     f32,
    sin_time:      f32,
    cos_time:      f32,
    sin_fast:      f32,
    cos_fast:      f32,
}

struct Particle {
    pos:  vec3<f32>,
    life: f32,
    vel:  vec3<f32>,
    hue:  f32,
}

struct ParticleBuffer {
    particles: array<Particle>,
}

@group(0) @binding(0) var<uniform> u_breath: BreathUniforms;
@group(0) @binding(1) var<storage, read_write> particles: ParticleBuffer;

const PI:  f32 = 3.14159265359;
const TAU: f32 = 6.28318530718;
const PARTICLE_COUNT: u32 = 4096u;
const DT: f32 = 0.016; // ~60fps timestep

// Chakra Y positions along the spine (from muladhara to sahasrara)
const CHAKRA_Y = array<f32, 7>(-0.8, -0.5, -0.2, 0.1, 0.35, 0.6, 0.9);
const CHAKRA_HUES = array<f32, 7>(0.0, 0.08, 0.16, 0.33, 0.58, 0.75, 0.83);

// Simple hash for pseudo-random numbers
fn hash(n: u32) -> f32 {
    var x = n;
    x = x ^ (x >> 16u);
    x = x * 0x45d9f3bu;
    x = x ^ (x >> 16u);
    x = x * 0x45d9f3bu;
    x = x ^ (x >> 16u);
    return f32(x) / 4294967295.0;
}

fn hash3(seed: u32) -> vec3<f32> {
    return vec3<f32>(
        hash(seed),
        hash(seed + 1u),
        hash(seed + 2u)
    );
}

// Simple 3D noise-like turbulence from hashing
fn turbulence(p: vec3<f32>, seed: u32) -> vec3<f32> {
    let t = u_breath.time;
    let s = u32(p.x * 7.3 + p.y * 13.7 + p.z * 5.1 + t * 3.0) + seed;
    return (hash3(s) - vec3<f32>(0.5)) * 2.0;
}

fn getActiveChakraIndex() -> i32 {
    return clamp(i32(u_breath.activeChakra), 0, 6);
}

fn respawnParticle(idx: u32) -> Particle {
    let seed = idx * 7u + u32(u_breath.time * 100.0);
    let r = hash3(seed);

    // Spawn along the spine column near the base
    let spawnY = CHAKRA_Y[0] + r.y * 0.3;
    let angle = r.x * TAU;
    let radius = 0.02 + r.z * 0.08;

    var p: Particle;
    p.pos = vec3<f32>(cos(angle) * radius, spawnY, sin(angle) * radius);
    p.vel = vec3<f32>(0.0, 0.3 + r.y * 0.2, 0.0); // Initial upward drift
    p.life = 0.5 + r.x * 1.5; // 0.5 - 2.0 seconds
    p.hue = CHAKRA_HUES[0]; // Start with root chakra color
    return p;
}

@compute @workgroup_size(256)
fn update_particles(@builtin(global_invocation_id) gid: vec3<u32>) {
    let idx = gid.x;
    if (idx >= PARTICLE_COUNT) { return; }

    var p = particles.particles[idx];

    // Respawn dead particles
    if (p.life <= 0.0) {
        p = respawnParticle(idx);
        particles.particles[idx] = p;
        return;
    }

    let phase = u_breath.phase;
    let pp = u_breath.phaseProgress;
    let intensity = u_breath.intensity;
    let activeChakra = getActiveChakraIndex();
    let targetY = CHAKRA_Y[activeChakra];

    // Base forces
    var force = vec3<f32>(0.0);

    // Gravity: slight upward bias (prana rises)
    force.y += 0.15;

    // Turbulence for organic motion
    let turb = turbulence(p.pos, idx);
    force += turb * 0.3;

    // Phase-specific behavior
    switch (phase) {
        case 0u: { // INHALE — strong upward pull, converge toward spine
            let upForce = 0.5 + pp * 1.0;
            force.y += upForce * intensity;
            // Converge toward center (spine)
            force.x -= p.pos.x * 3.0 * intensity;
            force.z -= p.pos.z * 3.0 * intensity;
            // Pull toward active chakra
            let toChakra = vec3<f32>(0.0, targetY, 0.0) - p.pos;
            force += normalize(toChakra + vec3<f32>(0.001)) * 0.5 * intensity;
        }
        case 1u: { // HOLD-IN — orbit around crown chakra
            let toCenter = vec3<f32>(0.0, targetY, 0.0) - p.pos;
            let dist = length(toCenter);
            // Orbit force (perpendicular to radial direction in XZ plane)
            let radial = normalize(vec3<f32>(p.pos.x, 0.0, p.pos.z) + vec3<f32>(0.001));
            let tangent = vec3<f32>(-radial.z, 0.0, radial.x);
            force += tangent * 1.5 * intensity;
            // Gentle attraction to keep orbit radius stable
            force += toCenter * 0.8;
            // Subtle bobbing
            force.y += sin(u_breath.time * 3.0 + f32(idx) * 0.01) * 0.2;
        }
        case 2u: { // EXHALE — burst outward in expanding spiral
            let outForce = 0.3 + pp * 0.8;
            // Push away from spine
            let radialDir = normalize(vec3<f32>(p.pos.x, 0.0, p.pos.z) + vec3<f32>(0.001, 0.0, 0.001));
            force += radialDir * outForce * intensity;
            // Spiral rotation
            let spiralTangent = vec3<f32>(-radialDir.z, 0.0, radialDir.x);
            force += spiralTangent * 0.6 * intensity;
            // Gentle downward
            force.y -= 0.3 * pp * intensity;
        }
        case 3u: { // HOLD-OUT — gentle drift, low energy
            force *= 0.3;
            // Slow settling toward base
            force.y -= 0.1;
            // Very gentle drift
            force.x += sin(u_breath.time * 0.5 + f32(idx) * 0.1) * 0.1;
            force.z += cos(u_breath.time * 0.5 + f32(idx) * 0.1) * 0.1;
        }
        default: {}
    }

    // Damping
    let damping = select(0.96, 0.92, phase == 3u);
    p.vel = p.vel * damping + force * DT;

    // Speed limit
    let speed = length(p.vel);
    if (speed > 3.0) {
        p.vel = p.vel / speed * 3.0;
    }

    // Integrate position
    p.pos += p.vel * DT;

    // Soft boundary: keep particles in a reasonable volume
    let bounds = vec3<f32>(2.0, 2.0, 2.0);
    p.pos = clamp(p.pos, -bounds, bounds);

    // Update hue based on nearest chakra
    let ny = (p.pos.y + 0.8) / 1.7; // normalize Y to 0-1 along spine
    let chakraIdx = clamp(i32(ny * 6.0), 0, 6);
    p.hue = mix(p.hue, CHAKRA_HUES[chakraIdx], 0.05);

    // Decay life
    let lifeDecay = select(DT, DT * 0.6, phase == 1u); // slower decay during hold
    p.life -= lifeDecay;

    particles.particles[idx] = p;
}
