// ============================================================================
// Composite Shader — Final Pass
// ============================================================================
// Blends: base scene + bloom + aurora + particle texture → canvas output
// ============================================================================

// BreathUniforms is injected by the shared header at load time.

@group(0) @binding(0) var<uniform> u_breath: BreathUniforms;
@group(0) @binding(1) var<uniform> iResolution: vec4<f32>;
@group(0) @binding(2) var scene_tex: texture_2d<f32>;
@group(0) @binding(3) var bloom_tex: texture_2d<f32>;
@group(0) @binding(4) var aurora_tex: texture_2d<f32>;
@group(0) @binding(5) var tex_sampler: sampler;
@group(0) @binding(6) var particle_tex: texture_2d<f32>;

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

    // Sample pre-rendered particle layer
    let particleLayer = textureSample(particle_tex, tex_sampler, uv);

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
