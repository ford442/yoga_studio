// Sacred Breath Yoga Visuals - Clean WGSL Shader
// All UI/text rendering removed - handled by React overlay

struct BreathUniforms {
  time: f32,
  phase: u32,           // 0=inhale, 1=hold1, 2=exhale, 3=hold2
  phaseProgress: f32,   // 0.0 → 1.0
  cycle: u32,
  strengthLevel: u32,   // 0=light, 1=medium, 2=strong
  intensity: f32,
};

@group(0) @binding(0) var<uniform> u_breath: BreathUniforms;
@group(0) @binding(1) var<uniform> iResolution: vec3<f32>;

const PI = 3.14159265359;
const TAU = 6.28318530718;

// Chakra colors (Muladhara to Sahasrara)
const CHAKRA_COLORS = array<vec3<f32>, 7>(
  vec3<f32>(1.0, 0.15, 0.1),   // Root - Red
  vec3<f32>(1.0, 0.5, 0.05),   // Sacral - Orange  
  vec3<f32>(1.0, 0.9, 0.05),   // Solar Plexus - Yellow
  vec3<f32>(0.15, 0.85, 0.35), // Heart - Green
  vec3<f32>(0.1, 0.75, 1.0),   // Throat - Cyan
  vec3<f32>(0.35, 0.25, 0.95), // Third Eye - Indigo
  vec3<f32>(0.7, 0.2, 1.0)     // Crown - Violet
);

// Phase colors
const PHASE_COLORS = array<vec3<f32>, 4>(
  vec3<f32>(0.2, 0.9, 1.0),    // Inhale - Cyan
  vec3<f32>(1.0, 0.9, 0.2),    // Hold1 - Yellow
  vec3<f32>(1.0, 0.4, 0.2),    // Exhale - Orange/Red
  vec3<f32>(0.2, 0.9, 0.6)     // Hold2 - Emerald
);

// Utility functions
fn hash11(p: f32) -> f32 {
  var x = p * 0.1031;
  x = fract(x);
  x *= x + 33.33;
  x *= x + x;
  return fract(x);
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

fn smin(a: f32, b: f32, k: f32) -> f32 {
  let h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}

fn rotate2d(a: f32) -> mat2x2<f32> {
  let s = sin(a);
  let c = cos(a);
  return mat2x2<f32>(c, s, -s, c);
}

// Kaleidoscope effect
fn kalei(p: vec2<f32>, n: f32) -> vec2<f32> {
  let a = atan2(p.y, p.x);
  let r = length(p);
  let sector = TAU / n;
  let a2 = abs(fract(a / sector + 0.5) - 0.5) * sector;
  return vec2<f32>(cos(a2), sin(a2)) * r;
}

// Star field background
fn starPattern(uv: vec2<f32>, t: f32) -> vec3<f32> {
  var col = vec3<f32>(0.0);
  
  for (var i: f32 = 0.0; i < 60.0; i += 1.0) {
    let seed = i * 17.37;
    let x = hash11(seed) * 3.0 - 1.5;
    let y = hash11(seed + 1.0) * 3.0 - 1.5;
    let pos = vec2<f32>(x, y);
    
    let twinkle = sin(t * (0.3 + hash11(seed + 2.0) * 0.5) + seed) * 0.5 + 0.5;
    let d = length(uv - pos);
    let star = exp(-d * 80.0) * (0.2 + 0.8 * twinkle);
    
    let colorIdx = u32(hash11(seed + 3.0) * 7.0) % 7u;
    col += star * CHAKRA_COLORS[colorIdx] * 0.6;
  }
  
  return col;
}

// Sacred geometry rings
fn rings(uv: vec2<f32>, t: f32) -> vec3<f32> {
  var col = vec3<f32>(0.0);
  let phaseColor = PHASE_COLORS[u_breath.phase];
  
  // Breathing factor based on phase
  var breathe = 0.0;
  if (u_breath.phase == 0u) {
    breathe = u_breath.phaseProgress * 0.15; // inhale - expand
  } else if (u_breath.phase == 1u) {
    breathe = 0.15; // hold - full
  } else if (u_breath.phase == 2u) {
    breathe = 0.15 * (1.0 - u_breath.phaseProgress); // exhale - contract
  }
  
  // Outer hexagon ring
  let hexUV = kalei(uv, 6.0);
  let hexRot = t * 0.05;
  let hexR = rotate2d(hexRot) * hexUV;
  let hexD = abs(length(hexR) - (0.75 + breathe)) - 0.015;
  col += exp(-abs(hexD) * 40.0) * phaseColor * 0.5;
  
  // Triangle ring (rotates opposite)
  let triUV = kalei(uv, 3.0);
  let triRot = -t * 0.08;
  let triR = rotate2d(triRot) * triUV;
  let triD = abs(length(triR) - (0.55 + breathe * 0.8)) - 0.012;
  col += exp(-abs(triD) * 45.0) * vec3<f32>(1.0, 0.8, 0.2) * 0.4;
  
  // Inner circle (breathing)
  let circleD = abs(length(uv) - (0.35 + breathe * 0.5)) - 0.02;
  col += exp(-abs(circleD) * 30.0) * vec3<f32>(1.0, 0.95, 0.9) * 0.6;
  
  return col;
}

// Lotus petals
fn lotus(uv: vec2<f32>, t: f32) -> vec3<f32> {
  var col = vec3<f32>(0.0);
  let angle = atan2(uv.y, uv.x);
  let dist = length(uv);
  
  var bloom = 0.85;
  if (u_breath.phase == 0u) {
    bloom = 0.75 + 0.75 * u_breath.phaseProgress;
  } else if (u_breath.phase == 1u) {
    bloom = 1.5;
  } else if (u_breath.phase == 2u) {
    bloom = 1.5 - 0.75 * u_breath.phaseProgress;
  } else {
    bloom = 0.75;
  }
  
  let petalCount = 8.0;
  let petal = sin(angle * petalCount + t * 0.3) * 0.12 + 0.32 * bloom;
  let d = dist - petal;
  
  let phaseColor = PHASE_COLORS[u_breath.phase];
  let lotusGlow = 1.0 - smoothstep(0.0, 0.15, d);
  let lotusEdge = exp(-abs(d) * 20.0);
  
  col = mix(col, phaseColor, lotusGlow * 1.5);
  col += lotusEdge * phaseColor * 2.0;
  
  return col;
}

// Chakra column
fn chakras(uv: vec2<f32>, t: f32) -> vec3<f32> {
  var col = vec3<f32>(0.0);
  
  // Chakra positions along the spine
  let positions = array<f32, 7>(-0.4, -0.25, -0.1, 0.05, 0.2, 0.35, 0.5);
  let sizes = array<f32, 7>(0.045, 0.04, 0.05, 0.045, 0.04, 0.035, 0.055);
  
  for (var i: u32 = 0u; i < 7u; i++) {
    let pos = vec2<f32>(0.0, positions[i]);
    let d = sdCircle(uv - pos, sizes[i]);
    
    // Base glow
    let glow = exp(-abs(d) * 25.0);
    
    // Active chakra pulse
    var pulse = 1.0;
    let activeChakra = select(3u, select(2u, select(0u, 6u, u_breath.phase == 3u), u_breath.phase == 2u), u_breath.phase == 1u);
    if (i == activeChakra) {
      pulse = 1.0 + sin(t * 4.0) * 0.3;
    }
    
    col += glow * CHAKRA_COLORS[i] * 0.8 * pulse;
    
    // Extra glow for active chakra
    if (i == activeChakra) {
      let activeGlow = exp(-length(uv - pos) * 8.0);
      col += activeGlow * CHAKRA_COLORS[i] * 0.4;
    }
  }
  
  // Sushumna nadi (central channel)
  if (uv.y > -0.5 && uv.y < 0.6) {
    let nadiD = abs(uv.x) - 0.005;
    col += exp(-abs(nadiD) * 50.0) * vec3<f32>(0.9, 0.95, 1.0) * 0.25;
  }
  
  return col;
}

// Human figure with animated arms
fn figure(uv: vec2<f32>, t: f32) -> vec3<f32> {
  var col = vec3<f32>(0.0);
  
  // Body proportions
  let headPos = vec2<f32>(0.0, 0.3);
  let chestPos = vec2<f32>(0.0, 0.1);
  let hipsPos = vec2<f32>(0.0, -0.1);
  
  // Calculate arm positions based on breath phase
  var leftHand = vec2<f32>(-0.25, -0.05);
  var rightHand = vec2<f32>(0.25, -0.05);
  
  if (u_breath.phase == 0u) { // inhale - arms rising
    let rise = u_breath.phaseProgress;
    leftHand = mix(vec2<f32>(-0.25, -0.05), vec2<f32>(-0.2, 0.5), rise);
    rightHand = mix(vec2<f32>(0.25, -0.05), vec2<f32>(0.2, 0.5), rise);
  } else if (u_breath.phase == 1u) { // hold1 - arms overhead
    leftHand = vec2<f32>(-0.2, 0.5);
    rightHand = vec2<f32>(0.2, 0.5);
  } else if (u_breath.phase == 2u) { // exhale - arms lowering
    let lower = u_breath.phaseProgress;
    leftHand = mix(vec2<f32>(-0.2, 0.5), vec2<f32>(-0.25, -0.05), lower);
    rightHand = mix(vec2<f32>(0.2, 0.5), vec2<f32>(0.25, -0.05), lower);
  }
  // hold2 - arms at sides (default)
  
  // Head
  let headD = sdCircle(uv - headPos, 0.055);
  col += exp(-abs(headD) * 35.0) * vec3<f32>(0.9, 0.9, 1.0) * 0.5;
  
  // Torso (connected shapes)
  let chestD = sdCircle(uv - chestPos, 0.075);
  let hipsD = sdCircle(uv - hipsPos, 0.065);
  let torsoD = smin(chestD, hipsD, 0.08);
  col += exp(-abs(torsoD) * 30.0) * vec3<f32>(0.85, 0.88, 1.0) * 0.4;
  
  // Arms
  let leftArmD = sdSegment(uv, chestPos + vec2<f32>(-0.055, 0.04), leftHand) - 0.022;
  let rightArmD = sdSegment(uv, chestPos + vec2<f32>(0.055, 0.04), rightHand) - 0.022;
  col += exp(-abs(leftArmD) * 35.0) * vec3<f32>(0.85, 0.9, 1.0) * 0.45;
  col += exp(-abs(rightArmD) * 35.0) * vec3<f32>(0.85, 0.9, 1.0) * 0.45;
  
  // Hands with phase color
  let phaseColor = PHASE_COLORS[u_breath.phase];
  let leftHandD = sdCircle(uv - leftHand, 0.025);
  let rightHandD = sdCircle(uv - rightHand, 0.025);
  col += exp(-abs(leftHandD) * 45.0) * phaseColor * 0.6;
  col += exp(-abs(rightHandD) * 45.0) * phaseColor * 0.6;
  
  // Legs (static standing)
  let leftLegD = sdSegment(uv, hipsPos, vec2<f32>(-0.12, -0.45)) - 0.028;
  let rightLegD = sdSegment(uv, hipsPos, vec2<f32>(0.12, -0.45)) - 0.028;
  col += exp(-abs(leftLegD) * 35.0) * vec3<f32>(0.8, 0.85, 1.0) * 0.4;
  col += exp(-abs(rightLegD) * 35.0) * vec3<f32>(0.8, 0.85, 1.0) * 0.4;
  
  return col;
}

// Breathing progress ring
fn progressRing(uv: vec2<f32>) -> vec3<f32> {
  var col = vec3<f32>(0.0);
  
  let r = length(uv);
  let a = atan2(uv.y, uv.x);
  
  // Base ring
  let ringD = abs(r - 0.65) - 0.015;
  let phaseColor = PHASE_COLORS[u_breath.phase];
  
  // Progress arc
  let normalizedAngle = (a + PI) / TAU;
  let progressAngle = u_breath.phaseProgress;
  let inArc = select(0.0, 1.0, normalizedAngle < progressAngle);
  
  col += exp(-abs(ringD) * 50.0) * phaseColor * 0.8 * inArc;
  col += exp(-abs(ringD) * 20.0) * phaseColor * 0.2; // dim base ring
  
  // Glow at progress point
  let progressPos = vec2<f32>(cos(progressAngle * TAU - PI), sin(progressAngle * TAU - PI)) * 0.65;
  let glowD = length(uv - progressPos);
  col += exp(-glowD * 30.0) * phaseColor * 0.8;
  
  return col;
}

// Particle flow
fn particles(uv: vec2<f32>, t: f32) -> vec3<f32> {
  var col = vec3<f32>(0.0);
  
  let outward = u_breath.phase == 0u || u_breath.phase == 1u;
  
  for (var i: f32 = 0.0; i < 32.0; i += 1.0) {
    let seed = i * 13.37;
    let a = i * TAU / 32.0 + t * 0.25 + hash11(seed);
    let r = 0.15 + fract(seed + t * 0.3) * 0.6;
    
    let flow = select(1.0 - u_breath.phaseProgress, u_breath.phaseProgress, outward);
    let pos = vec2<f32>(cos(a), sin(a)) * (r + flow * 0.1 * select(-1.0, 1.0, outward));
    
    let d = length(uv - pos);
    let intensity = exp(-d * 45.0);
    let hue = fract(i * 0.1 + t * 0.15);
    let pcol = 0.6 + 0.4 * cos(vec3<f32>(0.0, 2.0, 4.0) + hue * 6.0);
    
    col += intensity * pcol * 1.2;
  }
  
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
  let uv = (fragCoord.xy - 0.5 * iResolution.xy) / min(iResolution.x, iResolution.y);
  let t = u_breath.time * 0.8;
  
  // Deep cosmic background
  var color = vec3<f32>(0.008, 0.003, 0.035);
  
  // Star field
  color += starPattern(uv, t * 0.2);
  
  // Sacred geometry rings
  color += rings(uv, t);
  
  // Lotus
  color += lotus(uv * 1.1, t);
  
  // Progress ring
  color += progressRing(uv);
  
  // Chakra column
  color += chakras(uv * 0.9, t);
  
  // Human figure
  color += figure(uv * 0.75 + vec2<f32>(0.0, -0.05), t);
  
  // Particles
  color += particles(uv, t);
  
  // Core glow during holds
  if (u_breath.phase == 1u || u_breath.phase == 3u) {
    let core = exp(-length(uv) * 12.0);
    color += core * vec3<f32>(1.0, 0.95, 0.85) * 0.35;
  }
  
  // Vignette
  color *= 1.0 - length(uv) * 0.3;
  
  // Tone mapping
  color = pow(color, vec3<f32>(0.9));
  
  return vec4<f32>(color, 1.0);
}
