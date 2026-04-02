// ============================================================================
// Composite Shader — Final Pass
// ============================================================================
// Blends: base scene + bloom + aurora + particles → canvas output
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
@group(0) @binding(1) var<uniform> iResolution: vec4<f32>;
@group(0) @binding(2) var scene_tex: texture_2d<f32>;
@group(0) @binding(3) var bloom_tex: texture_2d<f32>;
@group(0) @binding(4) var aurora_tex: texture_2d<f32>;
@group(0) @binding(5) var tex_sampler: sampler;
@group(0) @binding(6) var<storage, read> particles: ParticleBuffer;

const PI: f32 = 3.14159265359;
const PARTICLE_COUNT: u32 = 4096u;

// ============================================================================
// Vertex Shader — fullscreen quad
// ============================================================================
struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
}

@vertex
fn vs_main(@builtin(vertex_index) vid: u32) -> VertexOutput {
    let pos = array<vec2<f32>, 6>(
        vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(-1.0, 1.0),
        vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0), vec2<f32>(-1.0, 1.0)
    );
    var out: VertexOutput;
    out.position = vec4<f32>(pos[vid], 0.0, 1.0);
    out.uv = pos[vid] * 0.5 + 0.5;
    out.uv.y = 1.0 - out.uv.y; // Flip Y for texture sampling
    return out;
}

// ============================================================================
// HSV conversion for particle rendering
// ============================================================================
fn hsv2rgb(h: f32, s: f32, v: f32) -> vec3<f32> {
    let k = vec3<f32>(1.0, 0.666666667, 0.333333333);
    let p = abs(fract(vec3<f32>(h) + k) * 6.0 - vec3<f32>(3.0));
    return v * mix(vec3<f32>(1.0), clamp(p - vec3<f32>(1.0), vec3<f32>(0.0), vec3<f32>(1.0)), s);
}

// ============================================================================
// Render particles as soft glowing dots in screen space
// ============================================================================
fn renderParticles(fragUV: vec2<f32>) -> vec4<f32> {
    let res = iResolution.xy;
    // Convert UV to centered coordinates matching the base shader's space
    let aspect = res.x / res.y;
    let centered = (fragUV - 0.5) * 2.0;
    let screenPos = vec2<f32>(centered.x * aspect, -centered.y); // flip Y back

    var particleColor = vec3<f32>(0.0);
    var particleAlpha: f32 = 0.0;

    // Project each particle to screen and accumulate glow
    for (var i: u32 = 0u; i < PARTICLE_COUNT; i = i + 1u) {
        let p = particles.particles[i];
        if (p.life <= 0.0) { continue; }

        // Simple orthographic projection (camera at z=3, looking at -z)
        let projScale = 1.5 / (3.0 - p.pos.z + 0.001);
        let screenP = vec2<f32>(p.pos.x, p.pos.y) * projScale;

        let dist = length(screenPos - screenP);

        // Particle size based on life and intensity
        let size = 0.015 + 0.01 * p.life * u_breath.intensity;
        let glow = smoothstep(size * 3.0, 0.0, dist);
        let core = smoothstep(size, 0.0, dist);

        if (glow < 0.001) { continue; }

        let lifeAlpha = smoothstep(0.0, 0.3, p.life) * smoothstep(2.0, 1.5, p.life);
        let color = hsv2rgb(p.hue, 0.8, 1.0);

        particleColor += color * (core * 0.8 + glow * 0.3) * lifeAlpha;
        particleAlpha += glow * lifeAlpha * 0.15;
    }

    return vec4<f32>(particleColor, min(particleAlpha, 1.0));
}

// ============================================================================
// Fragment Shader — composite all layers
// ============================================================================
@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    let uv = in.uv;

    // Sample base scene at full resolution
    let scene = textureSample(scene_tex, tex_sampler, uv).rgb;

    // Sample bloom (rendered at half res, bilinear upscale via sampler)
    let bloom = textureSample(bloom_tex, tex_sampler, uv).rgb;

    // Sample aurora (rendered at half res)
    let aurora = textureSample(aurora_tex, tex_sampler, uv);

    // Render particles
    let particleLayer = renderParticles(uv);

    // Composite layers
    var color = scene;

    // Add bloom (additive, intensity-responsive)
    let bloomStrength = 0.6 + 0.4 * u_breath.intensity;
    color += bloom * bloomStrength;

    // Blend aurora (premultiplied alpha, behind the bright parts of scene)
    let sceneLum = dot(scene, vec3<f32>(0.2126, 0.7152, 0.0722));
    let auroraBlend = aurora.a * (1.0 - smoothstep(0.3, 0.8, sceneLum));
    color = mix(color, color + aurora.rgb, auroraBlend);

    // Add particles (additive)
    color += particleLayer.rgb * particleLayer.a;

    // Final tone mapping (soft clamp to avoid harsh clipping from additive blend)
    color = color / (color + vec3<f32>(1.0)); // Reinhard
    color = pow(color, vec3<f32>(1.0 / 1.1));  // Slight brightness lift

    return vec4<f32>(color, 1.0);
}
