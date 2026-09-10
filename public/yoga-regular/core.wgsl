// ============================================================================
// YOGA REGULAR — CORE
// Uniform contract, constants, math/breath helpers, figure map inputs.
// ============================================================================

// ============================================================================
// YOGA BREATH SHADER — FINAL PRODUCTION VERSION
// Sacred breath timer synced to React + WebGPU
// ============================================================================

// Shared uniform contract — must match app/lib/shaderContract.ts exactly.
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
// ============================================================================
// CONSTANTS
// ============================================================================
const PI: f32  = 3.14159265359;
const TAU: f32 = 6.28318530718;

const CHAKRA_COLORS: array<vec3<f32>,7> = array<vec3<f32>,7>(
  vec3<f32>(0.93,0.27,0.27), vec3<f32>(0.98,0.45,0.09), vec3<f32>(0.92,0.72,0.03),
  vec3<f32>(0.13,0.77,0.37), vec3<f32>(0.02,0.71,0.83), vec3<f32>(0.39,0.40,0.95),
  vec3<f32>(0.66,0.33,0.97)
);

const INHALE_COLOR = vec3<f32>(1.0, 0.8, 0.4);
const HOLD1_COLOR  = vec3<f32>(1.0, 0.9, 0.6);
const EXHALE_COLOR = vec3<f32>(0.4, 0.5, 0.9);
const HOLD2_COLOR  = vec3<f32>(0.7, 0.8, 0.7);

// ============================================================================
// SACRED GEOMETRY CONSTANTS
// ============================================================================
const HEX_COS: f32 = 0.866025404;
const HEX_TAN: f32 = 0.577350269;

// ============================================================================
// MATH HELPERS
// ============================================================================
fn rot2(a: f32) -> mat2x2<f32> {
  let c = cos(a); let s = sin(a);
  return mat2x2<f32>(c, s, -s, c);
}

fn pmod1(a: f32, b: f32) -> f32 {
  return a - floor(a / b) * b;
}

fn sdPill(p: vec3<f32>, a: vec3<f32>, b: vec3<f32>, r: f32) -> f32 {
  let pa = p - a; let ba = b - a;
  let h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}

fn opSmoothUnion(d1: f32, d2: f32, k: f32) -> f32 {
  let h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
  return mix(d2, d1, h) - k * h * (1.0 - h);
}

// ============================================================================
// BREATH HELPERS (rich organic feel)
// ============================================================================
fn getArmAngle() -> f32 {
  let p = u.phaseProgress;
  let i = u.intensity;
  switch(u32(u.chakraPhase)) {
    case 0u: { return mix(0.0, PI*1.02, 1.0-pow(1.0-p,2.5)) * i; }
    case 1u: { return PI + sin(u.time*3.0)*0.03*i + sin(u.time*0.5)*0.02; }
    case 2u: { return mix(PI, -0.1, p*p*(3.0-2.0*p)) * i; }
    case 3u: { return -0.05 + sin(u.time*1.5)*0.02*(1.0-i*0.5); }
    default: { return 0.0; }
  }
}

fn getBreathScale() -> vec2<f32> {
  let p = u.phaseProgress;
  let i = u.intensity;
  switch(u32(u.chakraPhase)) {
    case 0u: { let s = 1.0 + p*0.08*i; return vec2<f32>(s,s); }
    case 1u: { let s = 1.08 + sin(u.time*3.0)*0.01*i; return vec2<f32>(s,s); }
    case 2u: { let s = 1.08 - p*0.08*i; return vec2<f32>(s,s); }
    default: { return vec2<f32>(1.0,1.0); }
  }
}

