// ============================================================================
// Aurora Energy Ribbons — Compute Shader
// ============================================================================
// Generates flowing, organic aurora-like energy bands using layered noise.
// Colors shift with breath phases. Fades near center to not obscure figure.
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

struct AuroraParams {
    resolution: vec2<f32>,
    _pad: vec2<f32>,
}

@group(0) @binding(0) var<uniform> u_breath: BreathUniforms;
@group(0) @binding(1) var<uniform> u_aurora: AuroraParams;
@group(0) @binding(2) var output_tex: texture_storage_2d<rgba8unorm, write>;

const PI:  f32 = 3.14159265359;
const TAU: f32 = 6.28318530718;

// ============================================================================
// Simplex-like noise (2D)
// ============================================================================
fn mod289_2(x: vec2<f32>) -> vec2<f32> { return x - floor(x * (1.0 / 289.0)) * 289.0; }
fn mod289_3(x: vec3<f32>) -> vec3<f32> { return x - floor(x * (1.0 / 289.0)) * 289.0; }
fn permute3(x: vec3<f32>) -> vec3<f32> { return mod289_3(((x * 34.0) + 1.0) * x); }

fn snoise(v: vec2<f32>) -> f32 {
    let C = vec4<f32>(0.211324865405187, 0.366025403784439,
                      -0.577350269189626, 0.024390243902439);
    var i  = floor(v + dot(v, C.yy));
    let x0 = v - i + dot(i, C.xx);
    var i1: vec2<f32>;
    if (x0.x > x0.y) { i1 = vec2<f32>(1.0, 0.0); }
    else { i1 = vec2<f32>(0.0, 1.0); }
    let x12 = vec4<f32>(x0.xy + C.xx - i1, x0.xy + C.zz);
    i = mod289_2(i);
    let p = permute3(permute3(i.y + vec3<f32>(0.0, i1.y, 1.0))
                     + i.x + vec3<f32>(0.0, i1.x, 1.0));
    var m = max(vec3<f32>(0.5) - vec3<f32>(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), vec3<f32>(0.0));
    m = m * m;
    m = m * m;
    let x  = 2.0 * fract(p * C.www) - 1.0;
    let h  = abs(x) - 0.5;
    let ox = floor(x + 0.5);
    let a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    let g = vec3<f32>(a0.x * x0.x + h.x * x0.y,
                      a0.y * x12.x + h.y * x12.y,
                      a0.z * x12.z + h.z * x12.w);
    return 130.0 * dot(m, g);
}

// Fractal Brownian Motion (3 octaves for performance)
fn fbm(p: vec2<f32>) -> f32 {
    var val: f32 = 0.0;
    var amp: f32 = 0.5;
    var freq: f32 = 1.0;
    var pos = p;
    for (var i: i32 = 0; i < 3; i = i + 1) {
        val += amp * snoise(pos * freq);
        freq *= 2.1;
        amp *= 0.5;
        // Rotate each octave for less axis-aligned artifacts
        pos = vec2<f32>(pos.x * 0.866 - pos.y * 0.5, pos.x * 0.5 + pos.y * 0.866);
    }
    return val;
}

// Phase-dependent colors
fn getAuroraColor(phase: u32, pp: f32, noiseVal: f32) -> vec3<f32> {
    // Base colors per phase
    let inhale_color  = vec3<f32>(0.1, 0.6, 0.9);  // Cyan/blue
    let hold1_color   = vec3<f32>(0.9, 0.8, 0.2);  // Golden
    let exhale_color  = vec3<f32>(0.7, 0.2, 0.9);  // Purple
    let hold2_color   = vec3<f32>(0.1, 0.9, 0.5);  // Emerald

    var c1: vec3<f32>;
    var c2: vec3<f32>;
    switch (phase) {
        case 0u: { c1 = inhale_color;  c2 = hold1_color; }
        case 1u: { c1 = hold1_color;   c2 = exhale_color; }
        case 2u: { c1 = exhale_color;  c2 = hold2_color; }
        default: { c1 = hold2_color;   c2 = inhale_color; }
    }

    let blend = smoothstep(-0.3, 0.3, noiseVal);
    var color = mix(c1, c2, pp);
    // Add noise-driven color variation
    color = mix(color, color * (1.0 + noiseVal * 0.3), blend);
    return color;
}

@compute @workgroup_size(16, 16)
fn generate_aurora(@builtin(global_invocation_id) gid: vec3<u32>) {
    let dims = vec2<u32>(u_aurora.resolution);
    if (gid.x >= dims.x || gid.y >= dims.y) { return; }

    let uv = (vec2<f32>(gid.xy) - vec2<f32>(dims) * 0.5) / f32(min(dims.x, dims.y));
    let t = u_breath.time;
    let phase = u_breath.phase;
    let pp = u_breath.phaseProgress;
    let intensity = u_breath.intensity;

    // Flow direction changes with breath phase
    var flowAngle: f32 = 0.0;
    switch (phase) {
        case 0u: { flowAngle = PI * 0.5 + pp * 0.3; }  // Upward during inhale
        case 1u: { flowAngle = PI * 0.8; }               // Diagonal during hold
        case 2u: { flowAngle = -PI * 0.5 - pp * 0.3; }  // Downward during exhale
        default: { flowAngle = 0.0; }                     // Horizontal during rest
    }
    let flowDir = vec2<f32>(cos(flowAngle), sin(flowAngle));

    // Time-varying flow offset
    let flowSpeed = 0.3 + 0.4 * intensity;
    let flowOffset = flowDir * t * flowSpeed;

    // Layer 1: Primary aurora bands
    let p1 = uv * 2.0 + flowOffset;
    let n1 = fbm(p1);

    // Layer 2: Secondary detail (faster, smaller)
    let p2 = uv * 4.0 + flowOffset * 1.5 + vec2<f32>(5.3, 2.7);
    let n2 = fbm(p2) * 0.5;

    // Layer 3: Slow large-scale modulation
    let p3 = uv * 0.8 + vec2<f32>(t * 0.05, t * 0.03);
    let n3 = fbm(p3);

    // Combine noise layers into ribbon shapes
    let combined = n1 + n2;
    let ribbon = smoothstep(0.0, 0.4, abs(combined)) * smoothstep(0.8, 0.3, abs(combined));

    // Large-scale envelope
    let envelope = smoothstep(-0.5, 0.5, n3) * 0.7 + 0.3;

    // Breath-responsive ribbon width
    let breathPulse = 0.7 + 0.3 * sin(pp * PI) * intensity;

    var alpha = ribbon * envelope * breathPulse;

    // Fade near center to keep the figure visible
    let centerDist = length(uv);
    let centerFade = smoothstep(0.15, 0.6, centerDist);
    alpha *= centerFade;

    // Edge fade (vignette)
    let edgeFade = 1.0 - smoothstep(0.7, 1.2, centerDist);
    alpha *= edgeFade;

    // Overall intensity modulation
    alpha *= 0.35 * intensity;

    // Get phase-colored aurora
    let color = getAuroraColor(phase, pp, combined);

    // Shimmer effect
    let shimmer = 1.0 + 0.15 * sin(t * 5.0 + uv.x * 10.0 + uv.y * 8.0);

    textureStore(output_tex, vec2<i32>(gid.xy), vec4<f32>(color * shimmer * alpha, alpha));
}
