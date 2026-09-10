// ============================================================================
// YOGA REGULAR — RENDER
// Raymarch tracing/shading, mainImage composition, vertex/fragment entries.
// ============================================================================

// ============================================================================
// TRACING & SHADING
// ============================================================================
fn trace(ro: vec3<f32>, rd: vec3<f32>) -> vec4<f32> {
  var t = 0.0;
  let maxSteps = select(32, 48, u.intensity > 0.5);
  for(var i: i32 = 0; i < maxSteps; i = i + 1) {
    let p = ro + rd * t;
    let d = map(p);
    if (d < 0.005 || t > 15.0) { break; }
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
  if (hit.w > 19.0) { return vec3<f32>(0.0); }
  
  let n = dNormal(hit.xyz);
  let l = normalize(vec3<f32>(0.5, 0.8, 0.3));
  let diff = max(dot(n, l), 0.0);
  let spec = pow(max(dot(reflect(-l, n), -rd), 0.0), 16.0);
  
  var fc = vec3<f32>(0.7, 0.75, 0.8);
  switch(u32(u.chakraPhase)) {
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
  let resolution = u.resolution;
  let uv = (fragCoord - 0.5 * resolution) / resolution.y;
  let aspect = resolution.x / resolution.y;
  
  var col = vec3<f32>(0.02, 0.03, 0.05);
  
  // Sacred geometry background with phase-aware fog
  let bgCol = renderBackground(uv, u.time, u32(u.chakraPhase), 
                                u.phaseProgress, u.intensity);
  col = mix(col, bgCol, 0.7);
  
  // Phase background tint
  switch(u32(u.chakraPhase)) {
    case 0u: { col = mix(col, INHALE_COLOR * 0.1, u.phaseProgress); }
    case 1u: { col = mix(INHALE_COLOR * 0.1, HOLD1_COLOR * 0.15, u.phaseProgress); }
    case 2u: { col = mix(HOLD1_COLOR * 0.15, EXHALE_COLOR * 0.1, u.phaseProgress); }
    case 3u: { col = mix(EXHALE_COLOR * 0.1, vec3<f32>(0.02, 0.03, 0.05), u.phaseProgress); }
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
  col *= 0.92 + 0.08 * sin(u.time * 1.8 + u.chakraPhase * 1.57);
  
  // Breath timing HUD
  renderBreathHUD(&col, uv, u.phaseProgress, u.breathPhase, 
                  u32(u.chakraPhase), u.time);
  
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
