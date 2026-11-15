// Breath field — particle billboards, drawn additively with drawIndirect.
//
// The instance count comes from field_cull (sim.wgsl); `visible[instance]`
// maps it back to a particle. No vertex buffer: each billboard's two
// triangles are built from the vertex index.

// @include "common.wgsl"

@group(1) @binding(0) var<storage, read> particles: array<Particle>;
@group(1) @binding(1) var<storage, read> visible: array<u32>;
@group(1) @binding(2) var<uniform> field: FieldParams;

// Target particles-per-pixel at which each particle draws at full brightness;
// denser fields (64k on a small canvas) dim per particle so the sum stays a haze.
const REFERENCE_DENSITY: f32 = 0.004;

fn densityScale() -> f32 {
    let pixels = max(u.resolution.x * u.resolution.y, 1.0);
    let density = f32(field.count) / pixels;
    return clamp(sqrt(REFERENCE_DENSITY / max(density, 1e-6)), 0.25, 1.0);
}

// 1.0 on the 8-bit swap chain; >1 on the HDR target so cores feed bloom.
override HDR_GAIN: f32 = 1.0;

struct ParticleVarying {
    @builtin(position) position: vec4<f32>,
    @location(0) local: vec2<f32>,
    @location(1) color: vec3<f32>,
}

fn billboardCorner(vertexIndex: u32) -> vec2<f32> {
    // Triangle list (0,0) (1,0) (0,1) / (0,1) (1,0) (1,1).
    let right = vertexIndex == 1u || vertexIndex == 4u || vertexIndex == 5u;
    let top = vertexIndex == 2u || vertexIndex == 3u || vertexIndex == 5u;
    return vec2<f32>(select(-1.0, 1.0, right), select(-1.0, 1.0, top));
}

@vertex
fn particle_vs(@builtin(vertex_index) vertexIndex: u32, @builtin(instance_index) instance: u32) -> ParticleVarying {
    let p = particles[visible[instance]];
    let corner = billboardCorner(vertexIndex);
    // Fade in after spawn and out before respawn.
    let fade = smoothstep(0.0, 0.12, p.life) * smoothstep(1.0, 0.9, p.life);
    let sizePx = mix(1.4, 3.6, hash01(p.seed ^ 0x165667b1u)) * max(u.resolution.y / 1080.0, 0.75);
    let halfNdc = vec2<f32>(sizePx * 2.0 / max(u.resolution.x, 1.0), sizePx * 2.0 / max(u.resolution.y, 1.0));
    let centre = vec2<f32>(p.pos.x * 2.0 / aspect(), -p.pos.y * 2.0);

    let speed = clamp(length(p.vel) * 6.0, 0.0, 1.0);
    let tint = fieldPalette(u.theme, clamp(u.chakraPhase / 3.0, 0.0, 1.0));
    let warm = mix(tint, vec3<f32>(1.0, 0.96, 0.9), 0.25 + 0.35 * speed);
    let breath = 0.5 + 0.5 * sin(u.breathPhase * TAU - PI * 0.5);
    let brightness = fade * (0.16 + 0.1 * breath + 0.14 * speed) * clamp(u.intensity, 0.4, 1.6) * densityScale();

    var out: ParticleVarying;
    out.position = vec4<f32>(centre + corner * halfNdc, 0.0, 1.0);
    out.local = corner;
    out.color = warm * brightness;
    return out;
}

@fragment
fn particle_fs(v: ParticleVarying) -> @location(0) vec4<f32> {
    let d2 = dot(v.local, v.local);
    if (d2 > 1.0) {
        discard;
    }
    let falloff = exp(-d2 * 4.0);
    let core = exp(-d2 * 24.0);
    // SDR: a soft Gaussian. HDR: the same halo plus a hot core that only
    // clears the bloom threshold where particles bunch up (inhale, pointer).
    let color = v.color * (falloff + core * (HDR_GAIN - 1.0));
    return vec4<f32>(color, 0.0);
}
