// ============================================================================
// YOGA REGULAR — FIGURE
// Figure SDF map, chakras, sacred rings.
// ============================================================================

// ============================================================================
// FIGURE MAP (alive breathing body)
// ============================================================================
fn map(p_in: vec3<f32>) -> f32 {
  var p = p_in;
  if (length(p) > 3.5) { return length(p) - 3.0; } // early out

  let armAngle = getArmAngle();
  let bs = getBreathScale();

  if (p.y > 0.0) { p.x *= bs.x; p.z *= bs.y; }

  let head = length(p - vec3<f32>(0.0,2.2,0.0)) - 0.35;
  let torso = sdPill(p, vec3<f32>(0.0,0.5,0.0), vec3<f32>(0.0,1.8,0.0), 0.22);
  let hips  = length(p - vec3<f32>(0.0,-0.3,0.0)) - 0.4;
  let legL  = sdPill(p, vec3<f32>(-0.4,-0.3,0.0), vec3<f32>(-0.5,-2.0,0.1), 0.12);
  let legR  = sdPill(p, vec3<f32>(0.4,-0.3,0.0), vec3<f32>(0.5,-2.0,-0.1), 0.12);

  var armL = p - vec3<f32>(-0.5,1.5,0.0);
  var armR = p - vec3<f32>(0.5,1.5,0.0);
  // WGSL disallows assignment to swizzles — write components individually.
  let armLRot = rot2(armAngle) * armL.yz;
  armL.y = armLRot.x;
  armL.z = armLRot.y;
  let armRRot = rot2(armAngle) * armR.yz;
  armR.y = armRRot.x;
  armR.z = armRRot.y;
  let sweep = select(0.0, sin(armAngle*0.5)*0.3, u32(u.chakraPhase) == 0u);
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
  let phase = u.chakraPhase;
  let phaseU = u32(phase);
  let progress = u.phaseProgress;
  let intensity = u.intensity;
  let t = u.time;
  
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
    
    // `active` is a reserved WGSL keyword — use isActive instead.
    var isActive: f32 = 0.0;
    if (phaseU == 0u && (i == 3 || i == 4)) { isActive = 1.0; }
    if (phaseU == 1u && i == 2) { isActive = 1.0; }
    if (phaseU == 2u && i == 0) { isActive = 1.0; }
    if (phaseU == 3u && i == 6) { isActive = 1.0; }
    
    let pulse = 0.8 + 0.2 * sin(t * 3.0 + fi * 0.8);
    let size = 0.03 + 0.015 * waveGlow + 0.01 * isActive;
    let glow = exp(-dist / size) * (0.5 + waveGlow * 0.5 + isActive * 0.3) * pulse;
    
    col += ccol * glow * intensity;
    
    if (phaseU == 0u && uv.y > y && uv.y < y + 0.3) {
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
  let p = u.phaseProgress;
  let i = u.intensity;
  let t = u.time;
  var exp: f32 = 0.0;
  switch(u32(u.chakraPhase)) {
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
  let t = u.time * 0.2;
  var uv = rot2(t) * uv_in;
  
  let e1 = ringExpansion(0);
  col += vec3<f32>(0.4, 0.6, 0.9) * ring(uv, 0.8 + e1, 0.015) * 0.5;
  
  let e2 = ringExpansion(1);
  col += vec3<f32>(0.6, 0.4, 0.8) * hexRing(uv * rot2(t * 0.5), 0.6 + e2 * 0.8) * 0.4;
  
  let e3 = ringExpansion(2);
  col += vec3<f32>(0.5, 0.7, 0.5) * ring(uv, 0.45 + e3 * 0.5, 0.012) * 0.6;
  
  let e4 = ringExpansion(3);
  col += vec3<f32>(0.8, 0.6, 0.4) * triRing(uv * rot2(-t * 0.3), 0.3 + e4 * 0.6) * 0.4;
  
  if (u32(u.chakraPhase) == 1u || u32(u.chakraPhase) == 3u) {
    let pulse = 0.15 + 0.05 * sin(u.time * 3.0) * u.intensity;
    let micro = sin(u.time * 6.0) * 0.01 * u.intensity;
    col += vec3<f32>(1.0, 0.9, 0.7) * ring(uv, pulse + micro, 0.008) * 0.8;
  }
  
  return col * (0.4 + u.intensity * (0.8 + 0.2 * sin(u.time * 3.0)));
}

