// Sacred Breath Yoga Visuals - Clean WGSL Shader
// No text rendering - UI handled by React overlay

struct BreathUniforms {
  time: f32,           // Global time in seconds
  phase: u32,          // 0=inhale, 1=hold1, 2=exhale, 3=hold2
  phaseProgress: f32,  // 0.0 -> 1.0 through current phase
  cycle: u32,          // Current breath cycle
  strengthLevel: u32,  // 0=light, 1=medium, 2=strong
  intensity: f32,      // Pulse intensity
  resolution: vec2<f32>, // Screen resolution
  activeChakra: u32,   // 0-6 for chakra highlighting
};

@group(0) @binding(0) var<uniform> u: BreathUniforms;

const TAU = 6.28318530718;
const PI = 3.14159265359;

// Chakra colors (Muladhara to Sahasrara)
const CHAKRA_COLORS = array<vec3<f32>, 7>(
  vec3<f32>(1.0, 0.2, 0.1),    // Root - Red
  vec3<f32>(1.0, 0.5, 0.0),    // Sacral - Orange
  vec3<f32>(1.0, 0.85, 0.1),   // Solar Plexus - Yellow
  vec3<f32>(0.2, 0.9, 0.4),    // Heart - Green
  vec3<f32>(0.1, 0.7, 1.0),    // Throat - Cyan
  vec3<f32>(0.3, 0.2, 0.9),    // Third Eye - Indigo
  vec3<f32>(0.6, 0.2, 1.0)     // Crown - Violet
);

// Phase colors
const PHASE_COLORS = array<vec3<f32>, 4>(
  vec3<f32>(0.2, 0.9, 1.0),    // Inhale - Cyan
  vec3<f32>(1.0, 0.9, 0.2),    // Hold1 - Yellow
  vec3<f32>(1.0, 0.4, 0.2),    // Exhale - Orange
  vec3<f32>(0.2, 0.9, 0.6)     // Hold2 - Emerald
);

// Utility functions
fn hash11(p: f32) -> f32 {
  var x = p * 0.011;
  x = fract(x) * 314.159;
  return fract(x * x * (x + 1.0));
}

fn hash21(p: vec2<f32>) -> f32 {
  return fract(sin(dot(p, vec2<f32>(12.9898, 78.233))) * 43758.5453);
}

fn sdCircle(p: vec2<f32>, r: f32) -> f32 {
  return length(p) - r;
}

fn sdBox(p: vec2<f32>, b: vec2<f32>) -> f32 {
  let d = abs(p) - b;
  return length(max(d, vec2<f32>(0.0))) + min(max(d.x, d.y), 0.0);
}

fn sdSegment(p: vec2<f32>, a: vec2<f32>, b: vec2<f32>) -> f32 {
  let pa = p - a;
  let ba = b - a;
  let h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

// Smooth min for organic shapes
fn smin(a: f32, b: f32, k: f32) -> f32 {
  let h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}

// Sacred geometry - Flower of Life pattern
fn flowerOfLife(uv: vec2<f32>, t: f32) -> f32 {
  var d = 100.0;
  let rings = 3;
  
  for (var i = 0; i < rings; i++) {
    let angle = f32(i) * TAU / f32(rings) + t * 0.1;
    let radius = 0.15 + f32(i) * 0.08;
    let pos = vec2<f32>(cos(angle), sin(angle)) * radius;
    d = min(d, sdCircle(uv - pos, 0.1));
  }
  
  return d;
}

// Rotating mandala with sacred geometry
fn mandala(uv: vec2<f32>, radius: f32, spokes: f32, speed: f32, t: f32) -> f32 {
  let angle = atan2(uv.y, uv.x) + t * speed;
  let sector = floor(angle * spokes / TAU);
  let sectorAngle = (sector + 0.5) * TAU / spokes;
  let rot = mat2x2<f32>(
    cos(sectorAngle), sin(sectorAngle),
    -sin(sectorAngle), cos(sectorAngle)
  );
  let p = rot * uv;
  return abs(length(p) - radius) - 0.012;
}

// Lotus petals that bloom with breath
fn lotusPetals(uv: vec2<f32>, t: f32, phase: u32, progress: f32) -> f32 {
  let petalCount = 8.0;
  let angle = atan2(uv.y, uv.x);
  let dist = length(uv);
  
  var bloom = 0.85;
  if (phase == 0u) {      // inhale
    bloom = 0.75 + 0.75 * progress;
  } else if (phase == 1u) { // hold1
    bloom = 1.5;
  } else if (phase == 2u) { // exhale
    bloom = 1.5 - 0.75 * progress;
  } else {                  // hold2
    bloom = 0.75;
  }
  
  let petal = sin(angle * petalCount + t * 0.5) * 0.12 + 0.32 * bloom;
  return dist - petal;
}

// Prana particles flowing with breath
fn pranaFlow(uv: vec2<f32>, t: f32, phase: u32, progress: f32) -> vec3<f32> {
  var col = vec3<f32>(0.0);
  let outward = phase == 0u || phase == 1u;
  
  for (var i = 0.0; i < 36.0; i += 1.0) {
    let seed = i * 13.37;
    let a = i * TAU / 36.0 + t * 0.3 + hash11(seed) * 1.5;
    let r = 0.1 + fract(seed + t * 0.4) * 0.7;
    let flow = select(1.0 - progress, progress, outward);
    let pos = vec2<f32>(cos(a), sin(a)) * (r + flow * 0.12 * select(-1.0, 1.0, outward));
    let d = length(uv - pos);
    let intensity = exp(-d * 40.0);
    let hue = fract(i * 0.12 + t * 0.15);
    let pcol = 0.7 + 0.3 * cos(vec3<f32>(0.0, 2.0, 4.0) + hue * 6.0);
    col += intensity * pcol * 1.4;
  }
  
  return col;
}

// Star field background
fn starField(uv: vec2<f32>, t: f32) -> vec3<f32> {
  var col = vec3<f32>(0.0);
  
  for (var i = 0.0; i < 50.0; i += 1.0) {
    let seed = i * 23.45;
    let x = hash11(seed) * 2.4 - 1.2;
    let y = hash11(seed + 1.0) * 2.4 - 1.2;
    let pos = vec2<f32>(x, y);
    let twinkle = sin(t * (0.5 + hash11(seed + 2.0)) + seed) * 0.5 + 0.5;
    let d = length(uv - pos);
    let star = exp(-d * 80.0) * (0.3 + 0.7 * twinkle);
    let colorIndex = u32(hash11(seed + 3.0) * 7.0) % 7u;
    col += star * CHAKRA_COLORS[colorIndex] * 0.5;
  }
  
  return col;
}

// Chakra column visualization
fn chakraColumn(uv: vec2<f32>, t: f32, activeChakra: u32) -> vec3<f32> {
  var col = vec3<f32>(0.0);
  
  // Chakra positions along the spine
  let chakraY = array<f32, 7>(-0.35, -0.2, -0.05, 0.1, 0.25, 0.4, 0.55);
  let chakraSizes = array<f32, 7>(0.04, 0.035, 0.045, 0.04, 0.035, 0.03, 0.05);
  
  for (var i = 0u; i < 7u; i++) {
    let pos = vec2<f32>(0.0, chakraY[i]);
    let d = sdCircle(uv - pos, chakraSizes[i]);
    
    // Base glow
    let glow = exp(-abs(d) * 25.0);
    let isActive = i == activeChakra;
    let pulse = select(1.0, 1.0 + sin(t * 4.0) * 0.3, isActive);
    
    col += glow * CHAKRA_COLORS[i] * 0.8 * pulse;
    
    // Active chakra extra glow
    if (isActive) {
      let activeGlow = exp(-length(uv - pos) * 8.0);
      col += activeGlow * CHAKRA_COLORS[i] * 0.5;
    }
  }
  
  // Sushumna nadi (central channel)
  let nadiD = abs(uv.x) - 0.005;
  if (uv.y > -0.45 && uv.y < 0.65) {
    col += exp(-abs(nadiD) * 50.0) * vec3<f32>(0.8, 0.9, 1.0) * 0.3;
  }
  
  return col;
}

// Sacred rings (hexagon, triangle, circle)
fn sacredRings(uv: vec2<f32>, t: f32, phase: u32, progress: f32) -> vec3<f32> {
  var col = vec3<f32>(0.0);
  let phaseColor = PHASE_COLORS[phase];
  
  // Outer hexagon ring
  let hexRot = t * 0.1;
  let hexUV = mat2x2<f32>(cos(hexRot), sin(hexRot), -sin(hexRot), cos(hexRot)) * uv;
  let hexAngle = atan2(hexUV.y, hexUV.x);
  let hexRadius = 0.85 + sin(t * 0.3) * 0.02;
  let hexDist = abs(length(hexUV) - hexRadius) - 0.015;
  col += exp(-abs(hexDist) * 30.0) * phaseColor * 0.4;
  
  // Middle triangle ring (rotates opposite)
  let triRot = -t * 0.15;
  let triUV = mat2x2<f32>(cos(triRot), sin(triRot), -sin(triRot), cos(triRot)) * uv;
  let triRadius = 0.65 + cos(t * 0.25) * 0.015;
  let triDist = abs(length(triUV) - triRadius) - 0.012;
  col += exp(-abs(triDist) * 35.0) * vec3<f32>(1.0, 0.8, 0.3) * 0.35;
  
  // Inner circle (breathing)
  var circleRadius = 0.45;
  if (phase == 0u) {      // inhale
    circleRadius += progress * 0.15;
  } else if (phase == 1u) { // hold1
    circleRadius = 0.6;
  } else if (phase == 2u) { // exhale
    circleRadius = 0.6 - progress * 0.15;
  }
  let circleDist = abs(length(uv) - circleRadius) - 0.02;
  col += exp(-abs(circleDist) * 25.0) * vec3<f32>(1.0, 1.0, 0.9) * 0.6;
  
  return col;
}

// Simple stylized human figure (pills and smooth unions)
fn humanFigure(uv: vec2<f32>, t: f32, phase: u32, progress: f32) -> vec3<f32> {
  var col = vec3<f32>(0.0);
  
  // Body proportions
  let headPos = vec2<f32>(0.0, 0.35);
  let chestPos = vec2<f32>(0.0, 0.15);
  let hipsPos = vec2<f32>(0.0, -0.05);
  
  // Arm positions based on breath phase
  var leftHand = vec2<f32>(-0.25, 0.05);
  var rightHand = vec2<f32>(0.25, 0.05);
  
  if (phase == 0u) {      // inhale - arms rising
    let rise = progress;
    leftHand = mix(vec2<f32>(-0.25, 0.05), vec2<f32>(-0.2, 0.55), rise);
    rightHand = mix(vec2<f32>(0.25, 0.05), vec2<f32>(0.2, 0.55), rise);
  } else if (phase == 1u) { // hold1 - arms overhead
    leftHand = vec2<f32>(-0.2, 0.55);
    rightHand = vec2<f32>(0.2, 0.55);
  } else if (phase == 2u) { // exhale - arms lowering
    let lower = progress;
    leftHand = mix(vec2<f32>(-0.2, 0.55), vec2<f32>(-0.25, 0.05), lower);
    rightHand = mix(vec2<f32>(0.2, 0.55), vec2<f32>(0.25, 0.05), lower);
  }
  // hold2 - arms at sides (default)
  
  // Head (pill shape)
  let headD = sdCircle(uv - headPos, 0.06);
  col += exp(-abs(headD) * 30.0) * vec3<f32>(0.9, 0.9, 1.0) * 0.5;
  
  // Torso (connected pills)
  let chestD = sdCircle(uv - chestPos, 0.08);
  let hipsD = sdCircle(uv - hipsPos, 0.07);
  let torsoD = smin(chestD, hipsD, 0.1);
  col += exp(-abs(torsoD) * 25.0) * vec3<f32>(0.8, 0.85, 1.0) * 0.4;
  
  // Arms (segments)
  let leftArmD = sdSegment(uv, chestPos + vec2<f32>(-0.06, 0.05), leftHand) - 0.025;
  let rightArmD = sdSegment(uv, chestPos + vec2<f32>(0.06, 0.05), rightHand) - 0.025;
  col += exp(-abs(leftArmD) * 30.0) * vec3<f32>(0.8, 0.9, 1.0) * 0.45;
  col += exp(-abs(rightArmD) * 30.0) * vec3<f32>(0.8, 0.9, 1.0) * 0.45;
  
  // Hands
  let leftHandD = sdCircle(uv - leftHand, 0.03);
  let rightHandD = sdCircle(uv - rightHand, 0.03);
  col += exp(-abs(leftHandD) * 40.0) * PHASE_COLORS[phase] * 0.6;
  col += exp(-abs(rightHandD) * 40.0) * PHASE_COLORS[phase] * 0.6;
  
  // Legs (static standing)
  let leftLegD = sdSegment(uv, hipsPos, vec2<f32>(-0.12, -0.4)) - 0.03;
  let rightLegD = sdSegment(uv, hipsPos, vec2<f32>(0.12, -0.4)) - 0.03;
  col += exp(-abs(leftLegD) * 30.0) * vec3<f32>(0.75, 0.8, 1.0) * 0.4;
  col += exp(-abs(rightLegD) * 30.0) * vec3<f32>(0.75, 0.8, 1.0) * 0.4;
  
  return col;
}

// Breathing circle indicator
fn breathingCircle(uv: vec2<f32>, phase: u32, progress: f32) -> vec3<f32> {
  var col = vec3<f32>(0.0);
  
  var radius = 0.5;
  if (phase == 0u) {      // inhale - expand
    radius = 0.3 + progress * 0.4;
  } else if (phase == 1u) { // hold1 - full
    radius = 0.7;
  } else if (phase == 2u) { // exhale - contract
    radius = 0.7 - progress * 0.4;
  } else {                  // hold2 - empty
    radius = 0.3;
  }
  
  let d = sdCircle(uv, radius);
  let phaseColor = PHASE_COLORS[phase];
  
  // Outer glow ring
  col += exp(-abs(d) * 8.0) * phaseColor * 0.3 * u.intensity;
  
  // Progress arc (partial circle based on phase progress)
  let angle = atan2(uv.y, uv.x);
  let normalizedAngle = (angle + PI) / TAU;
  let arcActive = select(0.0, 1.0, normalizedAngle < progress);
  
  let ringD = abs(length(uv) - radius) - 0.015;
  col += exp(-abs(ringD) * 40.0) * phaseColor * 0.8 * arcActive;
  
  return col;
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
  // Normalize UV coordinates
  let uv = (fragCoord.xy - 0.5 * u.resolution) / min(u.resolution.x, u.resolution.y);
  let t = u.time * 1.0;
  
  // Deep cosmic background
  var color = vec3<f32>(0.01, 0.005, 0.04);
  
  // Add star field
  color += starField(uv, t * 0.1);
  
  // Breathing circle (background layer)
  color += breathingCircle(uv * 1.5, u.phase, u.phaseProgress);
  
  // Sacred geometry rings
  color += sacredRings(uv, t, u.phase, u.phaseProgress);
  
  // Lotus petals (central sacred geometry)
  let lotusD = lotusPetals(uv * 1.2, t, u.phase, u.phaseProgress);
  let lotusGlow = 1.0 - smoothstep(0.0, 0.15, lotusD);
  let lotusEdge = exp(-abs(lotusD) * 20.0);
  let lotusColor = mix(
    PHASE_COLORS[u.phase],
    CHAKRA_COLORS[u.activeChakra],
    0.3
  );
  color = mix(color, lotusColor, lotusGlow * 1.5);
  color += lotusEdge * lotusColor * 2.0;
  
  // Chakra column (spine energy)
  color += chakraColumn(uv * 0.8, t, u.activeChakra);
  
  // Human figure with animated arms
  color += humanFigure(uv * 0.7 + vec2<f32>(0.0, -0.1), t, u.phase, u.phaseProgress);
  
  // Prana particles (top layer)
  color += pranaFlow(uv, t, u.phase, u.phaseProgress);
  
  // Central core glow (stronger during holds)
  if (u.phase == 1u || u.phase == 3u) {
    let coreGlow = exp(-length(uv) * 10.0);
    color += coreGlow * vec3<f32>(1.0, 0.95, 0.8) * 0.4;
  }
  
  // Vignette
  color *= 1.0 - length(uv) * 0.35;
  
  // Tone mapping
  color = pow(color, vec3<f32>(0.9));
  
  return vec4<f32>(color, 1.0);
}
