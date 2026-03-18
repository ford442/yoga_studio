// ============================================================================
// YOGA BREATH SHADER — FINAL PRODUCTION VERSION
// Sacred breath timer synced to React + WebGPU
// ============================================================================

struct BreathUniforms {
  time:           f32,
  phase:          f32,      // 0=inhale, 1=hold1, 2=exhale, 3=hold2 (written as Float32Array from JS)
  phaseProgress:  f32,
  cycle:          f32,
  strengthLevel:  f32,
  intensity:      f32,
};

@group(0) @binding(0) var<uniform> u_breath: BreathUniforms;
@group(0) @binding(1) var<uniform> iResolution: vec2<f32>;

// ============================================================================
// CONSTANTS
// ============================================================================
const PI  = 3.14159265359;
const TAU = 6.28318530718;

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
const HEX_COS = 0.866025404;
const HEX_TAN = 0.577350269;

// ============================================================================
// MATH HELPERS
// ============================================================================
fn rot2(a: f32) -> mat2x2<f32> {
  let c = cos(a); let s = sin(a);
  return mat2x2<f32>(c, s, -s, c);
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
  let p = u_breath.phaseProgress;
  let i = u_breath.intensity;
  switch(u32(u_breath.phase)) {
    case 0u: { return mix(0.0, PI*1.02, 1.0-pow(1.0-p,2.5)) * i; }
    case 1u: { return PI + sin(u_breath.time*3.0)*0.03*i + sin(u_breath.time*0.5)*0.02; }
    case 2u: { return mix(PI, -0.1, p*p*(3.0-2.0*p)) * i; }
    case 3u: { return -0.05 + sin(u_breath.time*1.5)*0.02*(1.0-i*0.5); }
    default: { return 0.0; }
  }
}

fn getBreathScale() -> vec2<f32> {
  let p = u_breath.phaseProgress;
  let i = u_breath.intensity;
  switch(u32(u_breath.phase)) {
    case 0u: { let s = 1.0 + p*0.08*i; return vec2<f32>(s,s); }
    case 1u: { let s = 1.08 + sin(u_breath.time*3.0)*0.01*i; return vec2<f32>(s,s); }
    case 2u: { let s = 1.08 - p*0.08*i; return vec2<f32>(s,s); }
    default: { return vec2<f32>(1.0,1.0); }
  }
}

// ============================================================================
// FIGURE MAP (alive breathing body)
// ============================================================================
fn map(p_in: vec3<f32>) -> f32 {
  var p = p_in;
  if length(p) > 3.5 { return length(p) - 3.0; } // early out

  let armAngle = getArmAngle();
  let bs = getBreathScale();

  if p.y > 0.0 { p.x *= bs.x; p.z *= bs.y; }

  let head = length(p - vec3<f32>(0.0,2.2,0.0)) - 0.35;
  let torso = sdPill(p, vec3<f32>(0.0,0.5,0.0), vec3<f32>(0.0,1.8,0.0), 0.22);
  let hips  = length(p - vec3<f32>(0.0,-0.3,0.0)) - 0.4;
  let legL  = sdPill(p, vec3<f32>(-0.4,-0.3,0.0), vec3<f32>(-0.5,-2.0,0.1), 0.12);
  let legR  = sdPill(p, vec3<f32>(0.4,-0.3,0.0), vec3<f32>(0.5,-2.0,-0.1), 0.12);

  var armL = p - vec3<f32>(-0.5,1.5,0.0);
  var armR = p - vec3<f32>(0.5,1.5,0.0);
  armL.yz = rot2(armAngle) * armL.yz;
  armR.yz = rot2(armAngle) * armR.yz;
  let sweep = select(0.0, sin(armAngle*0.5)*0.3, u32(u_breath.phase) == 0u);
  armL.x += sweep; armR.x -= sweep;

  let armL3d = sdPill(armL, vec3<f32>(0.0,0.0,0.0), vec3<f32>(0.0,-1.2,0.0), 0.1);
  let armR3d = sdPill(armR, vec3<f32>(0.0,0.0,0.0), vec3<f32>(0.0,-1.2,0.0), 0.1);

  var d = opSmoothUnion(head, torso, 0.25);
  d = opSmoothUnion(d, hips, 0.3);
  d = opSmoothUnion(d, legL, 0.2);
  d = opSmoothUnion(d, legR, 0.2);
  d = opSmoothUnion(d, armL3d, 0.15);
  d = opSmoothUnion(d, armR3d, 0.15);
  return d;
}

// ============================================================================
// CHAKRAS (wave propagation + intensity boost)
// ============================================================================
fn chakras(uv: vec2<f32>) -> vec3<f32> {
  var col = vec3<f32>(0.0);
  let phase = u_breath.phase;
  let phaseU = u32(phase);
  let progress = u_breath.phaseProgress;
  let intensity = u_breath.intensity;
  let t = u_breath.time;
  
  var waveOffset: f32 = 0.0;
  switch(phaseU) {
    case 0u: { waveOffset = progress * 7.0; }
    case 1u: { waveOffset = 7.0; }
    case 2u: { waveOffset = 7.0 - progress * 7.0; }
    case 3u: { waveOffset = 0.0; }
    default: {}
  }
  
  var phaseTint = vec3<f32>(0.0);
  switch(phaseU) {
    case 0u: { phaseTint = INHALE_COLOR * progress * 0.3; }
    case 1u: { phaseTint = HOLD1_COLOR * 0.2; }
    case 2u: { phaseTint = EXHALE_COLOR * progress * 0.3; }
    case 3u: { phaseTint = HOLD2_COLOR * 0.1; }
    default: {}
  }
  
  for(var i: i32 = 0; i < 7; i = i + 1) {
    let fi = f32(i);
    let y = -0.6 + fi * 0.2;
    let cp = uv - vec2<f32>(0.0, y);
    let dist = length(cp);
    
    let wavePos = fi - waveOffset;
    let waveGlow = exp(-wavePos * wavePos * 2.0) * intensity;
    
    var ccol = CHAKRA_COLORS[i];
    ccol = mix(ccol, phaseTint + vec3<f32>(0.5), 0.3);
    
    var active: f32 = 0.0;
    if phaseU == 0u && (i == 3 || i == 4) { active = 1.0; }
    if phaseU == 1u && i == 2 { active = 1.0; }
    if phaseU == 2u && i == 0 { active = 1.0; }
    if phaseU == 3u && i == 6 { active = 1.0; }
    
    let pulse = 0.8 + 0.2 * sin(t * 3.0 + fi * 0.8);
    let size = 0.03 + 0.015 * waveGlow + 0.01 * active;
    let glow = exp(-dist / size) * (0.5 + waveGlow * 0.5 + active * 0.3) * pulse;
    
    col += ccol * glow * intensity;
    
    if phaseU == 0u && uv.y > y && uv.y < y + 0.3 {
      let flow = exp(-abs(uv.x) * 20.0) * progress * (1.0 - (uv.y - y) / 0.3);
      col += ccol * flow * 0.3 * intensity;
    }
  }
  
  col += vec3<f32>(1.0, 0.9, 0.7) * exp(-abs(uv.x) * 15.0) * 0.2 * intensity;
  
  let baseGlow = 0.3;
  let breathPulse = 0.7 + 0.3 * sin(t * 2.0 + phase * PI * 0.5);
  return col * (baseGlow + intensity * breathPulse);
}

// ============================================================================
// SACRED RINGS (breathing geometry)
// ============================================================================
fn ring(uv: vec2<f32>, r: f32, w: f32) -> f32 {
  let d = abs(length(uv) - r);
  return smoothstep(w, 0.0, d);
}

fn dHex(p_in: vec2<f32>, r: f32) -> f32 {
  let k = vec3<f32>(-0.866025404, 0.5, 0.577350269);
  var p = abs(p_in);
  p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
  p -= vec2<f32>(clamp(p.x, -k.z * r, k.z * r), r);
  return length(p) * sign(p.y);
}

fn dTri(p: vec2<f32>, r: f32) -> f32 {
  let k = sqrt(3.0);
  let px = abs(p.x) - r;
  let py = p.y + r / k;
  let w = length(vec2<f32>(px, py));
  return max(px, -w * sign(py + k * px));
}

fn hexRing(uv: vec2<f32>, r: f32) -> f32 {
  return smoothstep(0.02, 0.0, abs(dHex(uv, r)));
}

fn triRing(uv: vec2<f32>, r: f32) -> f32 {
  return smoothstep(0.02, 0.0, abs(dTri(uv, r)));
}

fn ringExpansion(idx: i32) -> f32 {
  let p = u_breath.phaseProgress;
  let i = u_breath.intensity;
  let t = u_breath.time;
  var exp: f32 = 0.0;
  switch(u32(u_breath.phase)) {
    case 0u: { exp = p * 0.3 * i; }
    case 1u: { exp = 0.3 * i + sin(t * 4.0 + f32(idx)) * 0.02 * i; }
    case 2u: { exp = (1.0 - p) * 0.3 * i; }
    case 3u: { exp = sin(t * 2.0 + f32(idx)) * 0.01; }
    default: {}
  }
  return exp + sin(p * PI + f32(idx) * 0.5) * 0.1;
}

fn rings(uv_in: vec2<f32>) -> vec3<f32> {
  var col = vec3<f32>(0.0);
  let t = u_breath.time * 0.2;
  var uv = rot2(t) * uv_in;
  
  let e1 = ringExpansion(0);
  col += vec3<f32>(0.4, 0.6, 0.9) * ring(uv, 0.8 + e1, 0.015) * 0.5;
  
  let e2 = ringExpansion(1);
  col += vec3<f32>(0.6, 0.4, 0.8) * hexRing(uv * rot2(t * 0.5), 0.6 + e2 * 0.8) * 0.4;
  
  let e3 = ringExpansion(2);
  col += vec3<f32>(0.5, 0.7, 0.5) * ring(uv, 0.45 + e3 * 0.5, 0.012) * 0.6;
  
  let e4 = ringExpansion(3);
  col += vec3<f32>(0.8, 0.6, 0.4) * triRing(uv * rot2(-t * 0.3), 0.3 + e4 * 0.6) * 0.4;
  
  if u32(u_breath.phase) == 1u || u32(u_breath.phase) == 3u {
    let pulse = 0.15 + 0.05 * sin(u_breath.time * 3.0) * u_breath.intensity;
    let micro = sin(u_breath.time * 6.0) * 0.01 * u_breath.intensity;
    col += vec3<f32>(1.0, 0.9, 0.7) * ring(uv, pulse + micro, 0.008) * 0.8;
  }
  
  return col * (0.4 + u_breath.intensity * (0.8 + 0.2 * sin(u_breath.time * 3.0)));
}

// ============================================================================
// SACRED GEOMETRY BACKGROUND (from improvement-2-geometry.wgsl)
// ============================================================================

// Kaleidoscope recursive transformation (4 iterations for performance)
fn kalei(p_in: vec3<f32>, time: f32) -> vec3<f32> {
  var p = p_in;
  let at = atan2(p.y, p.x);
  for(var i: i32 = 0; i < 4; i = i + 1) {
    let fi = f32(i);
    p = vec3<f32>(abs(p.x) - 0.2, p.y, p.z);
    p.xz = rot2(sin(f32(i)) + 0.2 * time + 0.1 * at) * p.xz;
    p.xy = rot2(sin(2.0 * f32(i)) + 0.2 * time) * p.xy;
    p.y = p.y + 1.0 - exp(-p.z * 0.1 * f32(i));
  }
  p.x = abs(p.x) + 2.5;
  return p;
}

// Hex-symmetric star point mapping with output parameters
fn mapStarsGeo(uv: vec2<f32>, out near: ptr<function, vec3<f32>>, out neighbor: ptr<function, vec3<f32>>) {
  var point: vec2<f32>;
  *near = vec3<f32>(1e+4, 1e+4, 1e+4);
  
  for(var y: f32 = -1.0; y <= 1.0; y = y + 2.0) {
    point = vec2<f32>(0.0, HEX_COS + y * HEX_TAN * 0.25);
    let dist = distance(uv, point);
    if ((*near).z >= dist) {
      *near = vec3<f32>(point, dist);
    }
  }
  
  for(var x: f32 = -1.0; x <= 1.0; x = x + 2.0) {
    for(var y: f32 = -1.0; y <= 1.0; y = y + 2.0) {
      for(var both: f32 = -1.0; both <= 1.0; both = both + 2.0) {
        point = vec2<f32>(x * 0.125, HEX_COS + y * HEX_COS * 0.5);
        point.x = point.x + both * 0.5 * 0.125 * -x;
        point.y = point.y + both * HEX_TAN * 0.125 * -y;
        let dist = distance(uv, point);
        if ((*near).z >= dist) {
          *near = vec3<f32>(point, dist);
        }
      }
    }
  }
  
  *neighbor = vec3<f32>(1e+4, 1e+4, 1e+4);
  
  for(var y: f32 = -1.0; y <= 1.0; y = y + 2.0) {
    point = vec2<f32>(0.0, HEX_COS + y * HEX_TAN * 0.25);
    if (!all((*near).xy == point)) {
      let center = (point + (*near).xy) * 0.5;
      let dist = dot(uv - center, normalize((*near).xy - point));
      if ((*neighbor).z >= dist) {
        *neighbor = vec3<f32>(point, dist);
      }
    }
  }
  
  for(var x: f32 = -1.0; x <= 1.0; x = x + 2.0) {
    for(var y: f32 = -1.0; y <= 1.0; y = y + 2.0) {
      for(var both: f32 = -1.0; both <= 1.0; both = both + 2.0) {
        point = vec2<f32>(x * 0.125, HEX_COS + y * HEX_COS * 0.5);
        point.x = point.x + both * 0.5 * 0.125 * -x;
        point.y = point.y + both * HEX_TAN * 0.125 * -y;
        if (!all((*near).xy == point)) {
          let center = (point + (*near).xy) * 0.5;
          let dist = dot(uv - center, normalize((*near).xy - point));
          if ((*neighbor).z >= dist) {
            *neighbor = vec3<f32>(point, dist);
          }
        }
      }
    }
  }
}

// Log-polar coordinate transform
fn toLogPolar(p: vec2<f32>) -> vec2<f32> {
  return vec2<f32>(log(length(p)), atan2(p.y, p.x));
}

// Polar repetition for hex symmetry
fn pmod(pos: vec2<f32>, num: f32, out_id: ptr<function, f32>) -> vec2<f32> {
  let angle = atan2(pos.x, pos.y) + PI / num;
  let split = TAU / num;
  *out_id = floor(angle / split);
  let final_angle = (*out_id) * split;
  return rot2(final_angle) * pos;
}

// Hex-symmetric star pattern with log-polar coords
fn starPattern(uv_in: vec2<f32>, time: f32) -> f32 {
  let uvb = uv_in;
  var uv = uv_in;
  
  let width = 0.0001 + mix(0.03, 0.0, pow(dot(uv, uv), 0.3));
  
  uv = toLogPolar(uv * 0.01) * 2.5;
  uv.x = uv.x + (-0.2 * time);
  uv = vec2<f32>(uv.x % 1.0 - 0.5, uv.y % (HEX_COS * 2.0) - HEX_COS);
  
  var id: f32 = 0.0;
  let reps: f32 = 5.0;
  let t: f32 = 0.07 * (time + 6.0);
  let modid: f32 = (floor(0.1 * length(uv) - t) % reps + 3.0) * 2.0;
  let modt: f32 = pow(smoothstep(0.0, 0.3, abs(fract(0.1 * length(uvb) - t) - 0.5)), 500.0);
  let alpha: f32 = mix(6.0, 18.0, modt);
  
  uv = pmod(uv, alpha, &id);
  
  var near: vec3<f32>;
  var neighbor: vec3<f32>;
  mapStarsGeo(uv, &near, &neighbor);
  
  let line: f32 = 1.0 - smoothstep(0.0, width, neighbor.z);
  return line;
}

// Phase-aware atmospheric fog color
fn getFogColor(phase: u32, progress: f32) -> vec3<f32> {
  var fogCol = vec3<f32>(0.016, 0.086, 0.125);
  
  switch(phase) {
    case 0u: {
      fogCol = mix(fogCol, INHALE_COLOR * 0.1, progress);
    }
    case 1u: {
      fogCol = mix(INHALE_COLOR * 0.1, HOLD1_COLOR * 0.15, progress);
    }
    case 2u: {
      fogCol = mix(HOLD1_COLOR * 0.15, EXHALE_COLOR * 0.1, progress);
    }
    case 3u: {
      fogCol = mix(EXHALE_COLOR * 0.1, vec3<f32>(0.02, 0.03, 0.05), progress);
    }
    default: {}
  }
  
  return fogCol;
}

// Render sacred geometry background
fn renderBackground(uv: vec2<f32>, time: f32, phase: u32, progress: f32, intensity: f32) -> vec3<f32> {
  var col = vec3<f32>(0.0);
  
  // Star pattern from kalei geometry
  let stars = starPattern(uv * 0.5, time * 0.3);
  col = col + stars * 0.6 * (0.1 + 0.9 * hueFromTime(-time + length(uv)));
  
  // Fog color based on phase
  let fogColor = getFogColor(phase, progress);
  col = col + fogColor * mix(0.3, 1.1, 1.0 - pow(dot(uv, uv), 0.5));
  
  // Apply intensity modulation
  col = col * (0.5 + intensity * 0.5);
  
  return col;
}

// Hue helper for star coloring
fn hueFromTime(v: f32) -> vec3<f32> {
  return 0.6 + 0.6 * cos(6.3 * v + vec3<f32>(0.0, 23.0, 21.0));
}

// ============================================================================
// ORIGINAL STARS (fallback/simple version)
// ============================================================================
fn mapStars(uv: vec2<f32>) -> vec3<f32> {
  var col = vec3<f32>(0.0);
  let t = u_breath.time * 0.1;
  let bp = 0.8 + 0.2 * u_breath.intensity * sin(t * 2.0);
  for(var i: i32 = 0; i < 8; i = i + 1) {
    let fi = f32(i);
    let pos = vec2<f32>(cos(fi * 0.78 + t * 0.1), sin(fi * 0.78 + t * 0.1)) * (0.3 + fi * 0.15);
    col += vec3<f32>(0.8, 0.9, 1.0) * exp(-length(uv - pos) * 50.0) * bp;
  }
  return col;
}

fn getBreathColorGrade(col: vec3<f32>) -> vec3<f32> {
  let phase = u_breath.phase;
  let p = u_breath.phaseProgress;
  let i = u_breath.intensity;
  let s = u_breath.strengthLevel;
  
  var tint = vec3<f32>(1.0);
  var sat = 1.0;
  var con = 1.0;
  
  switch(u32(phase)) {
    case 0u: { tint = mix(vec3<f32>(1.0), INHALE_COLOR, p * 0.3); sat = 1.0 + p * 0.1; con = 1.0 + p * 0.05; }
    case 1u: { tint = mix(INHALE_COLOR, HOLD1_COLOR, p * 0.25); sat = 1.1; con = 1.05; }
    case 2u: { tint = mix(HOLD1_COLOR, EXHALE_COLOR, p * 0.35); sat = 1.0 - p * 0.05; con = 1.0 + p * 0.05; }
    case 3u: { tint = mix(EXHALE_COLOR, vec3<f32>(1.0), p * 0.2); sat = 0.95; con = 1.0; }
    default: {}
  }
  
  var g = col * tint * (1.0 + i * 0.3);
  g = mix(vec3<f32>(0.5), g, con * (1.0 + s * 0.05));
  let gr = dot(g, vec3<f32>(0.299, 0.587, 0.114));
  return mix(vec3<f32>(gr), g, sat);
}

fn applyVignette(col: vec3<f32>, uv: vec2<f32>) -> vec3<f32> {
  return col * (1.0 - length(uv * 0.8) * length(uv * 0.8) * 0.5);
}

fn applyGamma(col: vec3<f32>) -> vec3<f32> {
  return pow(col, vec3<f32>(0.85));
}

// ============================================================================
// BREATH TIMING HUD (from improvement-2-ui.wgsl)
// ============================================================================

// Progress dial constants
const DIAL_CENTER = vec2<f32>(0.75, -0.75);
const DIAL_RADIUS = 0.12;
const DIAL_THICKNESS = 0.015;
const ANGLE_OFFSET = -PI * 0.5;
const DIAL_COLOR_START = vec3<f32>(1.0, 0.2, 0.2);
const DIAL_COLOR_END = vec3<f32>(1.0, 0.9, 0.2);

// Get gradient based on progress
fn getProgressGradient(progress: f32) -> vec3<f32> {
  let t = clamp(progress, 0.0, 1.0);
  return mix(DIAL_COLOR_START, DIAL_COLOR_END, t);
}

// Circular breath progress indicator
fn progressDial(uv: vec2<f32>, progress: f32) -> vec4<f32> {
  let delta = uv - DIAL_CENTER;
  let dist = length(delta);
  
  let innerRadius = DIAL_RADIUS - DIAL_THICKNESS * 0.5;
  let outerRadius = DIAL_RADIUS + DIAL_THICKNESS * 0.5;
  
  let w = DIAL_THICKNESS * 0.5;
  var ring = smoothstep(outerRadius + w, outerRadius - w, dist);
  ring -= smoothstep(innerRadius + w, innerRadius - w, dist);
  
  let angle = atan2(delta.y, delta.x) + ANGLE_OFFSET;
  let normalizedAngle = select(angle, angle + TAU, angle < 0.0);
  
  let endAngle = progress * TAU;
  
  var alpha = ring;
  
  if (normalizedAngle > endAngle) {
    let edgeDist = abs(normalizedAngle - endAngle);
    let fade = smoothstep(0.15, -w * 2.0, edgeDist);
    alpha *= fade;
  }
  
  if (normalizedAngle - w * 2.0 < 0.0) {
    let startFade = smoothstep(-w * 2.0, w * 2.0, abs(normalizedAngle));
    alpha *= startFade;
  }
  
  let color = getProgressGradient(progress);
  
  return vec4<f32>(color * alpha, alpha);
}

// Cycle counter position
const CYCLE_POS = vec2<f32>(0.82, 0.82);
const CYCLE_SIZE = 0.08;

// Simple 3x5 digit patterns
fn digitPattern(digit: i32, uv: vec2<f32>) -> f32 {
  let x = i32(uv.x * 3.0);
  let y = i32(uv.y * 5.0);
  let idx = y * 3 + x;
  
  switch(digit) {
    case 0: {
      if ((idx == 0) || (idx == 1) || (idx == 2) ||
          (idx == 3) || (idx == 5) ||
          (idx == 6) || (idx == 8) ||
          (idx == 9) || (idx == 11) ||
          (idx == 12) || (idx == 13) || (idx == 14)) { return 1.0; }
    }
    case 1: {
      if (idx == 1 || idx == 4 || idx == 7 || idx == 10 || idx == 13) { return 1.0; }
    }
    case 2: {
      if ((idx == 0) || (idx == 1) || (idx == 2) ||
          (idx == 5) ||
          (idx == 6) || (idx == 7) || (idx == 8) ||
          (idx == 9) ||
          (idx == 12) || (idx == 13) || (idx == 14)) { return 1.0; }
    }
    case 3: {
      if ((idx == 0) || (idx == 1) || (idx == 2) ||
          (idx == 5) ||
          (idx == 6) || (idx == 7) || (idx == 8) ||
          (idx == 11) ||
          (idx == 12) || (idx == 13) || (idx == 14)) { return 1.0; }
    }
    case 4: {
      if ((idx == 0) || (idx == 2) ||
          (idx == 3) || (idx == 5) ||
          (idx == 6) || (idx == 7) || (idx == 8) ||
          (idx == 11) ||
          (idx == 14)) { return 1.0; }
    }
    case 5: {
      if ((idx == 0) || (idx == 1) || (idx == 2) ||
          (idx == 3) ||
          (idx == 6) || (idx == 7) || (idx == 8) ||
          (idx == 11) ||
          (idx == 12) || (idx == 13) || (idx == 14)) { return 1.0; }
    }
    case 6: {
      if ((idx == 0) || (idx == 1) || (idx == 2) ||
          (idx == 3) ||
          (idx == 6) || (idx == 7) || (idx == 8) ||
          (idx == 9) || (idx == 11) ||
          (idx == 12) || (idx == 13) || (idx == 14)) { return 1.0; }
    }
    case 7: {
      if ((idx == 0) || (idx == 1) || (idx == 2) ||
          (idx == 5) ||
          (idx == 8) ||
          (idx == 11) ||
          (idx == 14)) { return 1.0; }
    }
    case 8: {
      if ((idx == 0) || (idx == 1) || (idx == 2) ||
          (idx == 3) || (idx == 5) ||
          (idx == 6) || (idx == 7) || (idx == 8) ||
          (idx == 9) || (idx == 11) ||
          (idx == 12) || (idx == 13) || (idx == 14)) { return 1.0; }
    }
    case 9: {
      if ((idx == 0) || (idx == 1) || (idx == 2) ||
          (idx == 3) || (idx == 5) ||
          (idx == 6) || (idx == 7) || (idx == 8) ||
          (idx == 11) ||
          (idx == 12) || (idx == 13) || (idx == 14)) { return 1.0; }
    }
    default: {}
  }
  return 0.0;
}

// Render cycle counter
fn cycleCounter(uv: vec2<f32>, cycle: f32) -> vec4<f32> {
  let cycleInt = i32(cycle);
  let tens = cycleInt / 10;
  let ones = cycleInt % 10;
  
  let boxMin = CYCLE_POS - vec2<f32>(CYCLE_SIZE * 1.2, CYCLE_SIZE * 0.6);
  let boxMax = CYCLE_POS + vec2<f32>(CYCLE_SIZE * 1.2, CYCLE_SIZE * 0.6);
  
  if (uv.x < boxMin.x || uv.x > boxMax.x || uv.y < boxMin.y || uv.y > boxMax.y) {
    return vec4<f32>(0.0);
  }
  
  let boxSize = boxMax - boxMin;
  let localUV = (uv - boxMin) / boxSize;
  
  var value: f32 = 0.0;
  
  if (tens > 0) {
    let leftUV = vec2<f32>(localUV.x * 2.0, localUV.y);
    if (leftUV.x < 1.0 && leftUV.x > 0.0 && leftUV.y > 0.0 && leftUV.y < 1.0) {
      let paddedUV = (leftUV - 0.5) * 0.8 + 0.5;
      if (paddedUV.x > 0.0 && paddedUV.x < 1.0 && paddedUV.y > 0.0 && paddedUV.y < 1.0) {
        value = digitPattern(tens, paddedUV);
      }
    }
  }
  
  let rightUV = vec2<f32>((localUV.x - 0.5) * 2.0, localUV.y);
  if (rightUV.x > 0.0 && rightUV.x < 1.0 && rightUV.y > 0.0 && rightUV.y < 1.0) {
    let paddedUV = (rightUV - 0.5) * 0.8 + 0.5;
    if (paddedUV.x > 0.0 && paddedUV.x < 1.0 && paddedUV.y > 0.0 && paddedUV.y < 1.0) {
      value = max(value, digitPattern(ones, paddedUV));
    }
  }
  
  value = smoothstep(0.3, 0.7, value);
  
  // Cyan color for cycle counter
  let color = vec3<f32>(0.02, 0.71, 0.83);
  
  return vec4<f32>(color * value, value);
}

// Time display position
const TIME_POS = vec2<f32>(-0.82, 0.82);
const TIME_SIZE = 0.06;

// Render time remaining display
fn timeDisplay(uv: vec2<f32>, timeRemaining: f32) -> vec4<f32> {
  let timeInt = i32(ceil(timeRemaining));
  let tens = min(timeInt / 10, 9);
  let ones = timeInt % 10;
  
  let boxMin = TIME_POS - vec2<f32>(TIME_SIZE * 1.5, TIME_SIZE * 0.8);
  let boxMax = TIME_POS + vec2<f32>(TIME_SIZE * 1.5, TIME_SIZE * 0.8);
  
  if (uv.x < boxMin.x || uv.x > boxMax.x || uv.y < boxMin.y || uv.y > boxMax.y) {
    return vec4<f32>(0.0);
  }
  
  let boxSize = boxMax - boxMin;
  let localUV = (uv - boxMin) / boxSize;
  
  var value: f32 = 0.0;
  
  if (tens > 0) {
    let leftUV = vec2<f32>(localUV.x * 2.0, localUV.y);
    if (leftUV.x < 1.0 && leftUV.x > 0.0 && leftUV.y > 0.0 && leftUV.y < 1.0) {
      let paddedUV = (leftUV - 0.5) * 0.85 + 0.5;
      if (paddedUV.x > 0.0 && paddedUV.x < 1.0 && paddedUV.y > 0.0 && paddedUV.y < 1.0) {
        value = digitPattern(tens, paddedUV);
      }
    }
  }
  
  let rightUV = vec2<f32>((localUV.x - select(0.0, 0.5, tens > 0)) * 
                          select(1.0, 2.0, tens > 0), localUV.y);
  if (rightUV.x > 0.0 && rightUV.x < 1.0 && rightUV.y > 0.0 && rightUV.y < 1.0) {
    let paddedUV = (rightUV - 0.5) * 0.85 + 0.5;
    if (paddedUV.x > 0.0 && paddedUV.x < 1.0 && paddedUV.y > 0.0 && paddedUV.y < 1.0) {
      value = max(value, digitPattern(ones, paddedUV));
    }
  }
  
  value = smoothstep(0.3, 0.7, value);
  
  var color = vec3<f32>(1.0, 0.9, 0.6);
  
  // Fade out when time is low (last 3 seconds)
  let urgency = smoothstep(3.0, 0.0, timeRemaining);
  color = mix(color, vec3<f32>(1.0, 0.3, 0.2), urgency * 0.5);
  
  return vec4<f32>(color * value, value);
}

// Render all HUD elements
fn renderBreathHUD(col: ptr<function, vec3<f32>>, uv: vec2<f32>, 
                   progress: f32, cycle: f32, phase: u32, time: f32) {
  // Progress dial with gradient
  let dial = progressDial(uv, progress);
  *col = mix(*col, dial.rgb, dial.a * 0.75);
  
  // Cycle counter
  let counter = cycleCounter(uv, cycle);
  *col = mix(*col, counter.rgb, counter.a * 0.8);
  
  // Time remaining (estimate from phase duration)
  var phaseDur: f32 = 5.0;
  switch(phase) {
    case 0u, 2u: { phaseDur = 5.0; }
    case 1u, 3u: { phaseDur = 5.0; }
    default: {}
  }
  let remaining = phaseDur * (1.0 - progress);
  let timeDisp = timeDisplay(uv, remaining);
  *col = mix(*col, timeDisp.rgb, timeDisp.a * 0.8);
}

// ============================================================================
// TRACING & SHADING
// ============================================================================
fn trace(ro: vec3<f32>, rd: vec3<f32>) -> vec4<f32> {
  var t = 0.0;
  let maxSteps = select(32, 48, u_breath.intensity > 0.5);
  for(var i: i32 = 0; i < maxSteps; i = i + 1) {
    let p = ro + rd * t;
    let d = map(p);
    if d < 0.005 || t > 15.0 { break; }
    t += d * select(0.9, 0.5, d < 0.5);
  }
  return vec4<f32>(ro + rd * t, t);
}

fn dNormal(p: vec3<f32>) -> vec3<f32> {
  let e = vec2<f32>(0.01, 0.0);
  return normalize(vec3<f32>(
    map(p + e.xyy) - map(p - e.xyy),
    map(p + e.yxy) - map(p - e.yxy),
    map(p + e.yyx) - map(p - e.yyx)
  ));
}

fn shade(ro: vec3<f32>, rd: vec3<f32>) -> vec3<f32> {
  let hit = trace(ro, rd);
  if hit.w > 19.0 { return vec3<f32>(0.0); }
  
  let n = dNormal(hit.xyz);
  let l = normalize(vec3<f32>(0.5, 0.8, 0.3));
  let diff = max(dot(n, l), 0.0);
  let spec = pow(max(dot(reflect(-l, n), -rd), 0.0), 16.0);
  
  var fc = vec3<f32>(0.7, 0.75, 0.8);
  switch(u32(u_breath.phase)) {
    case 0u: { fc = mix(fc, INHALE_COLOR, 0.2); }
    case 1u: { fc = mix(fc, HOLD1_COLOR, 0.25); }
    case 2u: { fc = mix(fc, EXHALE_COLOR, 0.2); }
    case 3u: { fc = mix(fc, HOLD2_COLOR, 0.15); }
    default: {}
  }
  
  return fc * (diff + 0.3) + vec3<f32>(0.3) * spec;
}

// ============================================================================
// MAIN IMAGE
// ============================================================================
fn mainImage(fragColor: ptr<function, vec4<f32>>, fragCoord: vec2<f32>) {
  let resolution = iResolution;
  let uv = (fragCoord - 0.5 * resolution) / resolution.y;
  let aspect = resolution.x / resolution.y;
  
  var col = vec3<f32>(0.02, 0.03, 0.05);
  
  // Sacred geometry background with phase-aware fog
  let bgCol = renderBackground(uv, u_breath.time, u32(u_breath.phase), 
                                u_breath.phaseProgress, u_breath.intensity);
  col = mix(col, bgCol, 0.7);
  
  // Phase background tint
  switch(u32(u_breath.phase)) {
    case 0u: { col = mix(col, INHALE_COLOR * 0.1, u_breath.phaseProgress); }
    case 1u: { col = mix(INHALE_COLOR * 0.1, HOLD1_COLOR * 0.15, u_breath.phaseProgress); }
    case 2u: { col = mix(HOLD1_COLOR * 0.15, EXHALE_COLOR * 0.1, u_breath.phaseProgress); }
    case 3u: { col = mix(EXHALE_COLOR * 0.1, vec3<f32>(0.02, 0.03, 0.05), u_breath.phaseProgress); }
    default: {}
  }
  
  // Original stars (subtle overlay)
  col += mapStars(uv) * 0.3;
  
  // Sacred rings
  col += rings(uv);
  
  // Chakras
  col += chakras(uv * 1.5);
  
  // 3D Figure
  let ro = vec3<f32>(0.0, 0.0, 4.0);
  let rd = normalize(vec3<f32>(uv, -1.5));
  let hit = trace(ro, rd);
  let figCol = shade(ro, rd);
  col = mix(col, figCol, smoothstep(0.02, 0.0, map(hit.xyz)));
  
  // Color grading
  col = getBreathColorGrade(col);
  
  // Global sacred pulse
  col *= 0.92 + 0.08 * sin(u_breath.time * 1.8 + u_breath.phase * 1.57);
  
  // Breath timing HUD
  renderBreathHUD(&col, uv, u_breath.phaseProgress, u_breath.cycle, 
                  u32(u_breath.phase), u_breath.time);
  
  // Vignette and gamma
  col = applyVignette(col, uv / aspect);
  col = applyGamma(col);
  
  *(fragColor) = vec4<f32>(col, 1.0);
}

@vertex
fn vs_main(@builtin(vertex_index) vid: u32) -> @builtin(position) vec4<f32> {
  let pos = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(-1.0, 1.0),
    vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0), vec2<f32>(-1.0, 1.0)
  );
  return vec4<f32>(pos[vid], 0.0, 1.0);
}

@fragment
fn fs_main(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
  var col: vec4<f32>;
  mainImage(&col, fragCoord.xy);
  return col;
}
