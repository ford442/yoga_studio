// ============================================================================
// Bloom Compute Shader — Bright Extract + Separable Gaussian Blur
// ============================================================================
// Pass 1: Extract bright pixels + horizontal blur → bloomTemp texture
// Pass 2: Vertical blur on bloomTemp → bloom texture
// Both passes share the same shader with a direction uniform.
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

struct BloomParams {
    direction: vec2<f32>,  // (1,0) for horizontal, (0,1) for vertical
    texel_size: vec2<f32>, // 1.0 / texture dimensions
}

@group(0) @binding(0) var<uniform> u_breath: BreathUniforms;
@group(0) @binding(1) var<uniform> u_bloom: BloomParams;
@group(0) @binding(2) var input_tex: texture_2d<f32>;
@group(0) @binding(3) var output_tex: texture_storage_2d<rgba8unorm, write>;

// 13-tap Gaussian weights (sigma ~= 4.0)
const KERNEL_SIZE: i32 = 6;
const WEIGHTS = array<f32, 7>(
    0.1964825501511404,
    0.2969069646728344,
    0.09447039785044732,
    0.010381362401148057,
    0.0003951490938964498,
    5.2167863e-06,
    0.0
);

fn luminance(c: vec3<f32>) -> f32 {
    return dot(c, vec3<f32>(0.2126, 0.7152, 0.0722));
}

@compute @workgroup_size(16, 16)
fn bloom_extract(@builtin(global_invocation_id) gid: vec3<u32>) {
    let dims = textureDimensions(input_tex);
    if (gid.x >= dims.x || gid.y >= dims.y) { return; }

    let coord = vec2<i32>(gid.xy);
    let color = textureLoad(input_tex, coord, 0).rgb;

    // Adaptive threshold: lower during active breathing for more glow
    let threshold = 0.65 - 0.25 * u_breath.intensity;
    let lum = luminance(color);
    let bright = max(color - vec3<f32>(threshold), vec3<f32>(0.0));

    // Boost chakra-like colors (warm hues and cyans)
    let boost = 1.0 + 0.5 * u_breath.intensity;

    textureStore(output_tex, coord, vec4<f32>(bright * boost, 1.0));
}

@compute @workgroup_size(16, 16)
fn bloom_blur(@builtin(global_invocation_id) gid: vec3<u32>) {
    let dims = textureDimensions(input_tex);
    if (gid.x >= dims.x || gid.y >= dims.y) { return; }

    let coord = vec2<i32>(gid.xy);
    let dir = vec2<i32>(u_bloom.direction);

    var color = textureLoad(input_tex, coord, 0).rgb * WEIGHTS[0];

    for (var i: i32 = 1; i <= KERNEL_SIZE; i = i + 1) {
        let offset = dir * i;
        let c1 = textureLoad(input_tex, clamp(coord + offset, vec2<i32>(0), vec2<i32>(dims) - 1), 0).rgb;
        let c2 = textureLoad(input_tex, clamp(coord - offset, vec2<i32>(0), vec2<i32>(dims) - 1), 0).rgb;
        color += (c1 + c2) * WEIGHTS[i];
    }

    // Breath-responsive bloom intensity
    let phase_boost = select(1.0, 1.3, u_breath.phase == 0u || u_breath.phase == 1u);
    color *= phase_boost;

    textureStore(output_tex, coord, vec4<f32>(color, 1.0));
}
