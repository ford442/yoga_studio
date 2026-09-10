// ============================================================================
// YOGA REGULAR — HUD
// Progress dial, cycle counter, time display, and breath phase label.
// ============================================================================

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

  // Breath phase label (INHALE / HOLD / EXHALE)
  let label = breathLabel(uv, phase);
  *col = mix(*col, label.rgb, label.a * 0.85);
}
