// ============================================================================
// Particle Render Shader — Instanced Gaussian Splats
// ============================================================================
// Renders each particle as a small screen-aligned quad with soft glow.
// Uses instanced drawing: 6 vertices × PARTICLE_COUNT instances.
// Reads the particle SSBO for position, life, and hue.
// Output goes to particleTexture (additive blended).
// ============================================================================

// BreathUniforms is injected by the shared header at load time.

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
@group(0) @binding(1) var<uniform> iResolution: vec4<f32>;
@group(0) @binding(2) var<storage, read> particles: ParticleBuffer;

const PARTICLE_COUNT: u32 = 4096u;

// ============================================================================
// Vertex Shader — position each quad around its particle
// ============================================================================
struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) quadUV: vec2<f32>,   // -1..1 within the quad
    @location(1) hue: f32,
    @location(2) lifeAlpha: f32,
}

@vertex
fn vs_main(
    @builtin(vertex_index) vid: u32,
    @builtin(instance_index) iid: u32,
) -> VertexOutput {
    // 6 vertices per quad (two triangles)
    let quadPos = array<vec2<f32>, 6>(
        vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(-1.0, 1.0),
        vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0), vec2<f32>(-1.0, 1.0)
    );

    let p = particles.particles[iid];
    var out: VertexOutput;

    // Dead particles: collapse quad to zero size
    if (p.life <= 0.0) {
        out.position = vec4<f32>(0.0, 0.0, 0.0, 1.0);
        out.quadUV = vec2<f32>(0.0);
        out.hue = 0.0;
        out.lifeAlpha = 0.0;
        return out;
    }

    let aspect = iResolution.x / iResolution.y;

    // Orthographic projection (camera at z=3, looking at -z)
    let projScale = 1.5 / (3.0 - p.pos.z + 0.001);
    let screenP = vec2<f32>(p.pos.x, p.pos.y) * projScale;

    // Particle size — matches the old composite particle sizing
    let size = (0.015 + 0.01 * p.life * u_breath.intensity) * 3.0;

    // Offset quad corners in NDC (screen-aligned billboard)
    let offset = quadPos[vid] * size;
    let ndc = vec2<f32>(
        screenP.x / aspect + offset.x / aspect,
        -screenP.y + offset.y
    );

    out.position = vec4<f32>(ndc, 0.0, 1.0);
    out.quadUV = quadPos[vid];
    out.hue = p.hue;
    out.lifeAlpha = smoothstep(0.0, 0.3, p.life) * smoothstep(2.0, 1.5, p.life);

    return out;
}

// ============================================================================
// HSV conversion
// ============================================================================
fn hsv2rgb(h: f32, s: f32, v: f32) -> vec3<f32> {
    let k = vec3<f32>(1.0, 0.666666667, 0.333333333);
    let p = abs(fract(vec3<f32>(h) + k) * 6.0 - vec3<f32>(3.0));
    return v * mix(vec3<f32>(1.0), clamp(p - vec3<f32>(1.0), vec3<f32>(0.0), vec3<f32>(1.0)), s);
}

// ============================================================================
// Fragment Shader — gaussian splat per particle quad
// ============================================================================
@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    if (in.lifeAlpha <= 0.0) {
        discard;
    }

    let dist = length(in.quadUV);

    // Gaussian-ish falloff: bright core + soft glow
    let core = smoothstep(0.35, 0.0, dist);
    let glow = smoothstep(1.0, 0.0, dist);

    let color = hsv2rgb(in.hue, 0.8, 1.0);
    let intensity = (core * 0.8 + glow * 0.3) * in.lifeAlpha;
    let alpha = glow * in.lifeAlpha * 0.15;

    return vec4<f32>(color * intensity, alpha);
}
