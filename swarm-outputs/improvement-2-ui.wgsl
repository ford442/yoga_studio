I've created the `swarm-outputs/improvement-2-ui.wgsl` file with the breath timing HUD elements. Here's a summary of what's included:

## Contents Overview

### 1. `progressDial()` Function
- Circular progress indicator positioned in the bottom-right corner
- Uses `u_breath.phaseProgress` (0.0-1.0) for arc angle
- Gradient from **red → yellow** using `mix()` 
- Anti-aliased ring with smoothstep edges
- Smooth fade at progress boundary

### 2. `cycleCounter()` Function
- Displays current breath cycle number (0-99)
- Positioned in the top-right corner
- Uses simple 3x5 digit patterns rendered procedurally
- Cyan color matching the inhale/heart chakra theme

### 3. `timeDisplay()` Function
- Shows seconds remaining in current phase
- Positioned in the top-left corner
- Turns reddish in the last 3 seconds (urgency indicator)
- Procedurally rendered digits

### 4. `renderBreathHUD()` Integration Helper
- Single function to render all HUD elements
- Takes `uv`, `progress`, `cycle`, `phase`, and `time` parameters
- Blends HUD elements with scene color using alpha mixing

### 5. Main Image Integration Snippet
- Comment block showing exactly where and how to add the HUD to `mainImage()`
- Includes phase duration lookup for time calculation

All functions use **normalized UV coordinates** (matching the current WGSL shader) and follow the minimal/elegant aesthetic appropriate for a meditation app.
ART, DIAL_COLOR_END, t);
}

// Get gradient based on progress (0.0 to 1.0)
fn getProgressGradient(progress: f32) -> vec3<f32> {
  let t = clamp(progress, 0.0, 1.0);
  return mix(DIAL_COLOR_START, DIAL_COLOR_END, t);
}

// ============================================================================
// PROGRESS DIAL — Circular breath progress indicator
// ============================================================================

// Renders a circular arc showing breath phase progress
// Returns RGBA color for the dial at given UV coordinate
fn progressDial(uv: vec2<f32>, progress: f32) -> vec4<f32> {
  // Calculate distance from dial center
  let delta = uv - DIAL_CENTER;
  let dist = length(delta);
  
  // Define inner and outer radius with smoothstep width
  let innerRadius = DIAL_RADIUS - DIAL_THICKNESS * 0.5;
  let outerRadius = DIAL_RADIUS + DIAL_THICKNESS * 0.5;
  
  // Create ring mask using smoothstep for anti-aliased edges
  let w = DIAL_THICKNESS * 0.5;
  var ring = smoothstep(outerRadius + w, outerRadius - w, dist);
  ring -= smoothstep(innerRadius + w, innerRadius - w, dist);
  
  // Calculate angle for progress arc
  let angle = atan2(delta.y, delta.x) + ANGLE_OFFSET;
  let normalizedAngle = select(angle, angle + TAU, angle < 0.0);
  
  // End angle based on progress (0 to TAU)
  let endAngle = progress * TAU;
  
  // Fade out parts of the ring beyond current progress
  var alpha = ring;
  
  if (normalizedAngle > endAngle) {
    // Smooth fade at the progress boundary
    let edgeDist = abs(normalizedAngle - endAngle);
    let fade = smoothstep(0.15, -w * 2.0, edgeDist);
    alpha *= fade;
  }
  
  // Smooth fade at the start angle (top of dial)
  if (normalizedAngle - w * 2.0 < 0.0) {
    let startFade = smoothstep(-w * 2.0, w * 2.0, abs(normalizedAngle));
    alpha *= startFade;
  }
  
  // Get gradient color based on progress
  let color = getProgressGradient(progress);
  
  return vec4<f32>(color * alpha, alpha);
}

// Alternative simpler dial function for direct integration
fn progressDialSimple(uv: vec2<f32>, progress: f32) -> vec3<f32> {
  let delta = uv - DIAL_CENTER;
  let dist = length(delta);
  
  let innerR = DIAL_RADIUS - DIAL_THICKNESS * 0.5;
  let outerR = DIAL_RADIUS + DIAL_THICKNESS * 0.5;
  let w = DIAL_THICKNESS * 0.3;
  
  // Ring mask
  var c = smoothstep(outerR + w, outerR - w, dist);
  c -= smoothstep(innerR + w, innerR - w, dist);
  
  // Angle for arc clipping
  let angle = atan2(delta.y, delta.x) + ANGLE_OFFSET;
  let endAngle = progress * TAU;
  
  // Clip to progress arc
  if (angle < 0.0 || angle > endAngle) {
    let edgeDist = abs(angle - endAngle);
    let clip = smoothstep(0.1, -w * 2.0, edgeDist);
    c *= clip;
  }
  
  let color = getProgressGradient(progress);
  return color * c;
}

// ============================================================================
// CYCLE COUNTER — Display current breath cycle number
// ============================================================================

// Position for cycle counter (top right corner)
const CYCLE_POS = vec2<f32>(0.82, 0.82);
const CYCLE_SIZE = 0.08;

// Render cycle counter using simple digit patterns
// Returns grayscale value (0-1) for digit at position
fn digitPattern(digit: i32, uv: vec2<f32>) -> f32 {
  // Simple 3x5 grid patterns for digits 0-9
  // uv should be in [0,1] range for the digit
  let x = i32(uv.x * 3.0);
  let y = i32(uv.y * 5.0);
  let idx = y * 3 + x;
  
  // Bit patterns for each digit (3x5 grid, row-major)
  // 1 = pixel on, 0 = pixel off
  switch(digit) {
    case 0: { // 111/101/101/101/111 = 0x1F,0x11,0x1F
      if ((idx == 0) || (idx == 1) || (idx == 2) ||
          (idx == 3) || (idx == 5) ||
          (idx == 6) || (idx == 8) ||
          (idx == 9) || (idx == 11) ||
          (idx == 12) || (idx == 13) || (idx == 14)) { return 1.0; }
    }
    case 1: { // 010/010/010/010/010
      if (idx == 1 || idx == 4 || idx == 7 || idx == 10 || idx == 13) { return 1.0; }
    }
    case 2: { // 111/001/111/100/111
      if ((idx == 0) || (idx == 1) || (idx == 2) ||
          (idx == 5) ||
          (idx == 6) || (idx == 7) || (idx == 8) ||
          (idx == 9) ||
          (idx == 12) || (idx == 13) || (idx == 14)) { return 1.0; }
    }
    case 3: { // 111/001/111/001/111
      if ((idx == 0) || (idx == 1) || (idx == 2) ||
          (idx == 5) ||
          (idx == 6) || (idx == 7) || (idx == 8) ||
          (idx == 11) ||
          (idx == 12) || (idx == 13) || (idx == 14)) { return 1.0; }
    }
    case 4: { // 101/101/111/001/001
      if ((idx == 0) || (idx == 2) ||
          (idx == 3) || (idx == 5) ||
          (idx == 6) || (idx == 7) || (idx == 8) ||
          (idx == 11) ||
          (idx == 14)) { return 1.0; }
    }
    case 5: { // 111/100/111/001/111
      if ((idx == 0) || (idx == 1) || (idx == 2) ||
          (idx == 3) ||
          (idx == 6) || (idx == 7) || (idx == 8) ||
          (idx == 11) ||
          (idx == 12) || (idx == 13) || (idx == 14)) { return 1.0; }
    }
    case 6: { // 111/100/111/101/111
      if ((idx == 0) || (idx == 1) || (idx == 2) ||
          (idx == 3) ||
          (idx == 6) || (idx == 7) || (idx == 8) ||
          (idx == 9) || (idx == 11) ||
          (idx == 12) || (idx == 13) || (idx == 14)) { return 1.0; }
    }
    case 7: { // 111/001/001/001/001
      if ((idx == 0) || (idx == 1) || (idx == 2) ||
          (idx == 5) ||
          (idx == 8) ||
          (idx == 11) ||
          (idx == 14)) { return 1.0; }
    }
    case 8: { // 111/101/111/101/111
      if ((idx == 0) || (idx == 1) || (idx == 2) ||
          (idx == 3) || (idx == 5) ||
          (idx == 6) || (idx == 7) || (idx == 8) ||
          (idx == 9) || (idx == 11) ||
          (idx == 12) || (idx == 13) || (idx == 14)) { return 1.0; }
    }
    case 9: { // 111/101/111/001/111
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

// Render cycle counter at screen position
// cycle: current breath cycle number (0-99)
fn cycleCounter(uv: vec2<f32>, cycle: f32) -> vec4<f32> {
  // Convert to integer for digit extraction
  let cycleInt = i32(cycle);
  let tens = cycleInt / 10;
  let ones = cycleInt % 10;
  
  // Define counter box
  let boxMin = CYCLE_POS - vec2<f32>(CYCLE_SIZE * 1.2, CYCLE_SIZE * 0.6);
  let boxMax = CYCLE_POS + vec2<f32>(CYCLE_SIZE * 1.2, CYCLE_SIZE * 0.6);
  
  // Check if we're inside the counter area
  if (uv.x < boxMin.x || uv.x > boxMax.x || uv.y < boxMin.y || uv.y > boxMax.y) {
    return vec4<f32>(0.0);
  }
  
  // Normalize to box
  let boxSize = boxMax - boxMin;
  let localUV = (uv - boxMin) / boxSize;
  
  var value: f32 = 0.0;
  
  // Left digit (tens) - only show if >= 10
  if (tens > 0) {
    let leftUV = vec2<f32>(localUV.x * 2.0, localUV.y);
    if (leftUV.x < 1.0 && leftUV.x > 0.0 && leftUV.y > 0.0 && leftUV.y < 1.0) {
      // Add padding around digit
      let paddedUV = (leftUV - 0.5) * 0.8 + 0.5;
      if (paddedUV.x > 0.0 && paddedUV.x < 1.0 && paddedUV.y > 0.0 && paddedUV.y < 1.0) {
        value = digitPattern(tens, paddedUV);
      }
    }
  }
  
  // Right digit (ones)
  let rightUV = vec2<f32>((localUV.x - 0.5) * 2.0, localUV.y);
  if (rightUV.x > 0.0 && rightUV.x < 1.0 && rightUV.y > 0.0 && rightUV.y < 1.0) {
    let paddedUV = (rightUV - 0.5) * 0.8 + 0.5;
    if (paddedUV.x > 0.0 && paddedUV.x < 1.0 && paddedUV.y > 0.0 && paddedUV.y < 1.0) {
      value = max(value, digitPattern(ones, paddedUV));
    }
  }
  
  // Smooth the digit edges
  value = smoothstep(0.3, 0.7, value);
  
  // Cyan color for cycle counter (matches inhale/heart chakra theme)
  let color = vec3<f32>(0.02, 0.71, 0.83);
  
  return vec4<f32>(color * value, value);
}

// ============================================================================
// TIME DISPLAY — Show time remaining in current phase
// ============================================================================

// Position for time display (top left)
const TIME_POS = vec2<f32>(-0.82, 0.82);
const TIME_SIZE = 0.06;

// Render time remaining in phase (0-99 seconds)
// timeRemaining: seconds left in current phase
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
  
  // Left digit (tens)
  if (tens > 0) {
    let leftUV = vec2<f32>(localUV.x * 2.0, localUV.y);
    if (leftUV.x < 1.0 && leftUV.x > 0.0 && leftUV.y > 0.0 && leftUV.y < 1.0) {
      let paddedUV = (leftUV - 0.5) * 0.85 + 0.5;
      if (paddedUV.x > 0.0 && paddedUV.x < 1.0 && paddedUV.y > 0.0 && paddedUV.y < 1.0) {
        value = digitPattern(tens, paddedUV);
      }
    }
  }
  
  // Right digit (ones)
  let rightUV = vec2<f32>((localUV.x - select(0.0, 0.5, tens > 0)) * 
                          select(1.0, 2.0, tens > 0), localUV.y);
  if (rightUV.x > 0.0 && rightUV.x < 1.0 && rightUV.y > 0.0 && rightUV.y < 1.0) {
    let paddedUV = (rightUV - 0.5) * 0.85 + 0.5;
    if (paddedUV.x > 0.0 && paddedUV.x < 1.0 && paddedUV.y > 0.0 && paddedUV.y < 1.0) {
      value = max(value, digitPattern(ones, paddedUV));
    }
  }
  
  value = smoothstep(0.3, 0.7, value);
  
  // Color based on phase
  var color = vec3<f32>(1.0, 0.9, 0.6); // Default warm white
  
  // Fade out when time is low (last 3 seconds)
  let urgency = smoothstep(3.0, 0.0, timeRemaining);
  color = mix(color, vec3<f32>(1.0, 0.3, 0.2), urgency * 0.5);
  
  return vec4<f32>(color * value, value);
}

// ============================================================================
// MAIN IMAGE INTEGRATION SNIPPET
// ============================================================================
// Add this to the end of your mainImage function, before applying gamma:
//
//   // === BREATH TIMING HUD ===
//   let progress = u_breath.phaseProgress;
//   let cycle = u_breath.cycle;
//   
//   // Progress dial (bottom right)
//   let dial = progressDial(uv, progress);
//   col = mix(col, dial.rgb, dial.a * 0.8);
//   
//   // Cycle counter (top right)
//   let counter = cycleCounter(uv, cycle);
//   col = mix(col, counter.rgb, counter.a * 0.9);
//   
//   // Time display - calculate remaining time from phase and progress
//   var phaseDuration: f32 = 5.0;
//   switch(u32(u_breath.phase)) {
//     case 0u: { phaseDuration = 5.0; }  // Inhale
//     case 1u: { phaseDuration = 5.0; }  // Hold-in
//     case 2u: { phaseDuration = 5.0; }  // Exhale
//     case 3u: { phaseDuration = 5.0; }  // Hold-out
//     default: {}
//   }
//   let timeRemaining = phaseDuration * (1.0 - progress);
//   let timeDisp = timeDisplay(uv, timeRemaining);
//   col = mix(col, timeDisp.rgb, timeDisp.a * 0.85);
//
// ============================================================================

// ============================================================================
// SIMPLIFIED INTEGRATION (for minimal footprint)
// ============================================================================

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
    case 0u, 2u: { phaseDur = 5.0; }  // Inhale/Exhale
    case 1u, 3u: { phaseDur = 5.0; }  // Holds
    default: {}
  }
  let remaining = phaseDur * (1.0 - progress);
  let timeDisp = timeDisplay(uv, remaining);
  *col = mix(*col, timeDisp.rgb, timeDisp.a * 0.8);
}
