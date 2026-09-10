// ============================================================================
// YOGA REGULAR — BACKGROUND
// Kaleidoscope tunnel, star pattern, fog, and color grading.
// ============================================================================

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
    let pXz = rot2(sin(f32(i)) + 0.2 * time + 0.1 * at) * p.xz;
    p.x = pXz.x;
    p.z = pXz.y;
    let pXy = rot2(sin(2.0 * f32(i)) + 0.2 * time) * p.xy;
    p.x = pXy.x;
    p.y = pXy.y;
    p.y = p.y + 1.0 - exp(-p.z * 0.1 * f32(i));
  }
  p.x = abs(p.x) + 2.5;
  return p;
}

// Hex-symmetric star point mapping with output parameters
fn mapStarsGeo(uv: vec2<f32>, near: ptr<function, vec3<f32>>, neighbor: ptr<function, vec3<f32>>) {
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
  uv = vec2<f32>(pmod1(uv.x, 1.0) - 0.5, pmod1(uv.y, HEX_COS * 2.0) - HEX_COS);
  
  var id: f32 = 0.0;
  let reps: f32 = 5.0;
  let t: f32 = 0.07 * (time + 6.0);
  let modid: f32 = (pmod1(floor(0.1 * length(uv) - t), reps) + 3.0) * 2.0;
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
  let t = u.time * 0.1;
  let bp = 0.8 + 0.2 * u.intensity * sin(t * 2.0);
  for(var i: i32 = 0; i < 8; i = i + 1) {
    let fi = f32(i);
    let pos = vec2<f32>(cos(fi * 0.78 + t * 0.1), sin(fi * 0.78 + t * 0.1)) * (0.3 + fi * 0.15);
    col += vec3<f32>(0.8, 0.9, 1.0) * exp(-length(uv - pos) * 50.0) * bp;
  }
  return col;
}

fn getBreathColorGrade(col: vec3<f32>) -> vec3<f32> {
  let phase = u.chakraPhase;
  let p = u.phaseProgress;
  let i = u.intensity;
  let s = u.strengthLevel;
  
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

