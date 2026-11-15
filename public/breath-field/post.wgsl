// Breath field — HDR post: dual-filter bloom chain + tone map to the swap chain.
//
//   bloom_prefilter_fs  HDR target → mip 0 (half res), soft-knee threshold
//   bloom_down_fs       mip i-1 → mip i
//   bloom_up_fs         mip i → mip i-1, blended additively by the pipeline
//   tonemap_fs          HDR target + mip 0 → swap chain
//
// Every pass draws one fullscreen triangle; uv comes from the vertex stage so
// it covers the target exactly whatever its (odd) size.

// @include "common.wgsl"

@group(1) @binding(0) var postSampler: sampler;
@group(1) @binding(1) var source: texture_2d<f32>;
@group(1) @binding(2) var bloom: texture_2d<f32>;

// Linear-light threshold where bloom starts, and how soft the knee is.
override BLOOM_THRESHOLD: f32 = 0.85;
override BLOOM_KNEE: f32 = 0.3;
// Values below this pass the tone map untouched (the SDR scene's look).
override SHOULDER_START: f32 = 0.8;

struct PostVarying {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
}

@vertex
fn post_vs(@builtin(vertex_index) vertexIndex: u32) -> PostVarying {
    let pos = array<vec2<f32>, 3>(
        vec2<f32>(-1.0, -1.0), vec2<f32>(3.0, -1.0), vec2<f32>(-1.0, 3.0)
    );
    let p = pos[vertexIndex];
    var out: PostVarying;
    out.position = vec4<f32>(p, 0.0, 1.0);
    out.uv = vec2<f32>(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5);
    return out;
}

fn halfTexel() -> vec2<f32> {
    return 0.5 / vec2<f32>(textureDimensions(source));
}

fn tap(uv: vec2<f32>) -> vec3<f32> {
    return textureSampleLevel(source, postSampler, uv, 0.0).rgb;
}

// Dual-filter (Kawase) downsample: 5 bilinear taps.
fn downsample(uv: vec2<f32>) -> vec3<f32> {
    let h = halfTexel();
    var sum = tap(uv) * 4.0;
    sum = sum + tap(uv - h);
    sum = sum + tap(uv + h);
    sum = sum + tap(uv + vec2<f32>(h.x, -h.y));
    sum = sum + tap(uv - vec2<f32>(h.x, -h.y));
    return sum / 8.0;
}

fn softThreshold(color: vec3<f32>) -> vec3<f32> {
    let brightness = max(color.r, max(color.g, color.b));
    let knee = max(BLOOM_KNEE, 1e-4);
    let soft = clamp(brightness - BLOOM_THRESHOLD + knee, 0.0, 2.0 * knee);
    let curve = soft * soft / (4.0 * knee);
    let contribution = max(curve, brightness - BLOOM_THRESHOLD) / max(brightness, 1e-4);
    return color * contribution;
}

@fragment
fn bloom_prefilter_fs(v: PostVarying) -> @location(0) vec4<f32> {
    return vec4<f32>(softThreshold(downsample(v.uv)), 1.0);
}

@fragment
fn bloom_down_fs(v: PostVarying) -> @location(0) vec4<f32> {
    return vec4<f32>(downsample(v.uv), 1.0);
}

// Dual-filter upsample: 8 bilinear taps on a diamond.
@fragment
fn bloom_up_fs(v: PostVarying) -> @location(0) vec4<f32> {
    let h = halfTexel();
    var sum = tap(v.uv + vec2<f32>(-2.0 * h.x, 0.0));
    sum = sum + tap(v.uv + vec2<f32>(-h.x, h.y)) * 2.0;
    sum = sum + tap(v.uv + vec2<f32>(0.0, 2.0 * h.y));
    sum = sum + tap(v.uv + vec2<f32>(h.x, h.y)) * 2.0;
    sum = sum + tap(v.uv + vec2<f32>(2.0 * h.x, 0.0));
    sum = sum + tap(v.uv + vec2<f32>(h.x, -h.y)) * 2.0;
    sum = sum + tap(v.uv + vec2<f32>(0.0, -2.0 * h.y));
    sum = sum + tap(v.uv + vec2<f32>(-h.x, -h.y)) * 2.0;
    return vec4<f32>(sum / 12.0, 1.0);
}

// Identity below SHOULDER_START, exponential roll-off to 1 above it.
fn shoulder(x: f32) -> f32 {
    let k = SHOULDER_START;
    if (x <= k) {
        return x;
    }
    return k + (1.0 - k) * (1.0 - exp(-(x - k) / (1.0 - k)));
}

@fragment
fn tonemap_fs(v: PostVarying) -> @location(0) vec4<f32> {
    let hdr = textureSampleLevel(source, postSampler, v.uv, 0.0).rgb;
    let glow = textureSampleLevel(bloom, postSampler, v.uv, 0.0).rgb;
    let strength = 0.32 * clamp(u.intensity, 0.4, 1.6);
    let c = max(hdr + glow * strength, vec3<f32>(0.0));
    return vec4<f32>(shoulder(c.r), shoulder(c.g), shoulder(c.b), 1.0);
}
