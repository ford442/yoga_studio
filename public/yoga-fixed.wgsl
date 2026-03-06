// === Bindings & Uniforms ====================================================

@group(0) @binding(0) var<uniform> u_breath: BreathUniforms;
@group(0) @binding(1) var<uniform> iResolution: vec3<f32>;
@group(0) @binding(2) var<uniform> iFrame: f32;

struct BreathUniforms {
    time:           f32,
    phase:          u32,          // 0=inhale, 1=hold1, 2=exhale, 3=hold2
    phaseProgress:  f32,
    cycle:          u32,
    strengthLevel:  u32,
    intensity:      f32,
};

// === Constants & Helpers ====================================================

const PI = 3.14159265359;
const TAU = 6.28318530718;
const PHI = 1.61803398875;

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
    vec3<f32>(1.0, 0.9, 0.2),    // Hold1 - Yellow/Gold
    vec3<f32>(1.0, 0.4, 0.2),    // Exhale - Orange/Red
    vec3<f32>(0.2, 0.9, 0.6)     // Hold2 - Emerald
);

fn rot2(a: f32) -> mat2x2<f32> {
    let c = cos(a);
    let s = sin(a);
    return mat2x2<f32>(c, s, -s, c);
}

fn hue(v: f32) -> vec3<f32> {
    return 0.6 + 0.6 * cos(6.3 * v + vec3<f32>(0.0, 2.3, 2.1));
}

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

// Kaleidoscope effect
fn kalei(p: vec2<f32>, n: f32) -> vec2<f32> {
    let a = atan2(p.y, p.x);
    let r = length(p);
    let sector = TAU / n;
    let a2 = abs(fract(a / sector + 0.5) - 0.5) * sector;
    return vec2<f32>(cos(a2), sin(a2)) * r;
}

// === Star Field ============================================================

fn starPattern(uv: vec2<f32>, t: f32) -> vec3<f32> {
    var col = vec3<f32>(0.0);
    
    // Phase-based hue shift for stars
    let phaseHue = f32(u_breath.phase) * 0.15 + u_breath.phaseProgress * 0.1;
    
    for (var i: f32 = 0.0; i < 60.0; i += 1.0) {
        let seed = i * 17.37;
        let x = hash11(seed) * 3.0 - 1.5;
        let y = hash11(seed + 1.0) * 3.0 - 1.5;
        let pos = vec2<f32>(x, y);
        
        let twinkle = sin(t * (0.3 + hash11(seed + 2.0) * 0.5) + seed) * 0.5 + 0.5;
        let d = length(uv - pos);
        let star = exp(-d * 80.0) * (0.2 + 0.8 * twinkle);
        
        let colorIdx = u32(hash11(seed + 3.0) * 7.0) % 7u;
        let baseColor = CHAKRA_COLORS[colorIdx];
        
        // Shift star colors with breath phase
        let shiftedColor = baseColor * (0.8 + 0.4 * sin(phaseHue + t * 0.2));
        col += star * shiftedColor * 0.6;
    }
    
    return col;
}

// === Sacred Geometry Rings =================================================

fn sacredRings(uv: vec2<f32>, t: f32) -> vec3<f32> {
    var col = vec3<f32>(0.0);
    
    // Get phase color with gentle hue shift
    let basePhaseColor = PHASE_COLORS[u_breath.phase];
    let hueShift = u_breath.phaseProgress * 0.1;
    let phaseColor = basePhaseColor * (1.0 + 0.2 * sin(hueShift * TAU));
    
    // Breathing scale based on phase
    var breathe = 0.0;
    if (u_breath.phase == 0u) {
        breathe = u_breath.phaseProgress * 0.12; // inhale - expand
    } else if (u_breath.phase == 1u) {
        breathe = 0.12; // hold - full
    } else if (u_breath.phase == 2u) {
        breathe = 0.12 * (1.0 - u_breath.phaseProgress); // exhale - contract
    }
    
    // Add pulse from intensity uniform
    let pulse = 1.0 + 0.05 * u_breath.intensity * sin(t * 3.0);
    breathe *= pulse;
    
    // Outer hexagon ring (rotates slowly)
    let hexUV = kalei(uv, 6.0);
    let hexRot = t * 0.05 + u_breath.phaseProgress * 0.1;
    let hexR = rot2(hexRot) * hexUV;
    let hexD = abs(length(hexR) - (0.75 + breathe)) - 0.015;
    let hexGlow = exp(-abs(hexD) * 40.0);
    col += hexGlow * phaseColor * 0.5;
    
    // Triangle ring (rotates opposite direction)
    let triUV = kalei(uv, 3.0);
    let triRot = -t * 0.08 - u_breath.phaseProgress * 0.15;
    let triR = rot2(triRot) * triUV;
    let triD = abs(length(triR) - (0.55 + breathe * 0.8)) - 0.012;
    let triGlow = exp(-abs(triD) * 45.0);
    col += triGlow * vec3<f32>(1.0, 0.85, 0.25) * 0.4;
    
    // Inner breathing circle
    let circleD = abs(length(uv) - (0.35 + breathe * 0.5)) - 0.02;
    let circleGlow = exp(-abs(circleD) * 30.0);
    col += circleGlow * vec3<f32>(1.0, 0.95, 0.9) * 0.6;
    
    return col;
}

// === Lotus Flower ==========================================================

fn lotus(uv: vec2<f32>, t: f32) -> vec3<f32> {
    var col = vec3<f32>(0.0);
    let angle = atan2(uv.y, uv.x);
    let dist = length(uv);
    
    // Bloom factor driven by breath phase
    var bloom = 0.85;
    if (u_breath.phase == 0u) {
        bloom = 0.75 + 0.75 * smoothstep(0.0, 1.0, u_breath.phaseProgress);
    } else if (u_breath.phase == 1u) {
        bloom = 1.5;
    } else if (u_breath.phase == 2u) {
        bloom = 1.5 - 0.75 * smoothstep(0.0, 1.0, u_breath.phaseProgress);
    } else {
        bloom = 0.75;
    }
    
    // Add subtle pulse from intensity
    bloom *= (1.0 + 0.03 * u_breath.intensity);
    
    let petalCount = 8.0;
    let petal = sin(angle * petalCount + t * 0.3) * 0.12 + 0.32 * bloom;
    let d = dist - petal;
    
    // Phase color with breathing hue shift
    let phaseColor = PHASE_COLORS[u_breath.phase];
    let hueBreath = sin(t * 0.5 + u_breath.phaseProgress * PI) * 0.1;
    let animatedColor = phaseColor * (1.0 + hueBreath);
    
    let lotusGlow = 1.0 - smoothstep(0.0, 0.15, d);
    let lotusEdge = exp(-abs(d) * 20.0);
    
    col = mix(col, animatedColor, lotusGlow * 1.5);
    col += lotusEdge * animatedColor * 2.0;
    
    return col;
}

// === Chakra Column =========================================================

fn chakras(uv: vec2<f32>, t: f32) -> vec3<f32> {
    var col = vec3<f32>(0.0);
    
    let positions = array<f32, 7>(-0.4, -0.25, -0.1, 0.05, 0.2, 0.35, 0.5);
    let sizes = array<f32, 7>(0.045, 0.04, 0.05, 0.045, 0.04, 0.035, 0.055);
    
    // Active chakra based on phase
    let activeChakra = select(
        select(select(6u, 0u, u_breath.phase == 2u), 2u, u_breath.phase == 1u),
        3u,
        u_breath.phase == 0u
    );
    
    // Breathing pulse for all chakras
    let globalPulse = 1.0 + 0.1 * sin(t * 2.0 + u_breath.phaseProgress * TAU) * u_breath.intensity;
    
    for (var i: u32 = 0u; i < 7u; i++) {
        let pos = vec2<f32>(0.0, positions[i]);
        let d = sdCircle(uv - pos, sizes[i] * globalPulse);
        
        let glow = exp(-abs(d) * 25.0);
        
        // Active chakra gets extra pulse
        var pulse = 1.0;
        if (i == activeChakra) {
            pulse = 1.0 + 0.4 * sin(t * 4.0) * u_breath.intensity;
        }
        
        col += glow * CHAKRA_COLORS[i] * 0.8 * pulse;
        
        // Extra glow for active chakra
        if (i == activeChakra) {
            let activeGlow = exp(-length(uv - pos) * 8.0);
            col += activeGlow * CHAKRA_COLORS[i] * 0.5 * (0.7 + 0.3 * u_breath.intensity);
        }
    }
    
    // Sushumna nadi (central channel) with breath pulse
    if (uv.y > -0.5 && uv.y < 0.6) {
        let nadiD = abs(uv.x) - 0.005;
        let nadiPulse = 1.0 + 0.2 * u_breath.intensity * sin(t * 3.0);
        col += exp(-abs(nadiD) * 50.0) * vec3<f32>(0.9, 0.95, 1.0) * 0.25 * nadiPulse;
    }
    
    return col;
}

// === Human Figure with Breath-Driven Arms ==================================

fn figure(uv: vec2<f32>, t: f32) -> vec3<f32> {
    var col = vec3<f32>(0.0);
    
    // Body proportions
    let headPos = vec2<f32>(0.0, 0.3);
    let chestPos = vec2<f32>(0.0, 0.1);
    let hipsPos = vec2<f32>(0.0, -0.1);
    
    // === BREATH-DRIVEN ARM MOVEMENT ======================================
    // Default: arms at sides (hold2)
    var leftHand = vec2<f32>(-0.25, -0.05);
    var rightHand = vec2<f32>(0.25, -0.05);
    
    // Inhale: arms rising (0 to 1.2 units up)
    if (u_breath.phase == 0u) {
        let rise = smoothstep(0.0, 0.7, u_breath.phaseProgress);
        leftHand = mix(vec2<f32>(-0.25, -0.05), vec2<f32>(-0.2, 0.5), rise);
        rightHand = mix(vec2<f32>(0.25, -0.05), vec2<f32>(0.2, 0.5), rise);
    }
    // Hold1: arms fully extended overhead
    else if (u_breath.phase == 1u) {
        leftHand = vec2<f32>(-0.2, 0.5);
        rightHand = vec2<f32>(0.2, 0.5);
    }
    // Exhale: arms lowering
    else if (u_breath.phase == 2u) {
        let lower = smoothstep(0.0, 0.8, u_breath.phaseProgress);
        leftHand = mix(vec2<f32>(-0.2, 0.5), vec2<f32>(-0.25, -0.05), lower);
        rightHand = mix(vec2<f32>(0.2, 0.5), vec2<f32>(0.25, -0.05), lower);
    }
    // Hold2: arms at sides (default)
    
    // Add subtle breath pulse to figure size
    let figurePulse = 1.0 + 0.02 * u_breath.intensity * sin(t * 2.0);
    
    // Head
    let headD = sdCircle((uv - headPos) / figurePulse, 0.055);
    col += exp(-abs(headD) * 35.0) * vec3<f32>(0.9, 0.9, 1.0) * 0.5;
    
    // Torso
    let chestD = sdCircle((uv - chestPos) / figurePulse, 0.075);
    let hipsD = sdCircle((uv - hipsPos) / figurePulse, 0.065);
    let torsoD = smin(chestD, hipsD, 0.08);
    col += exp(-abs(torsoD) * 30.0) * vec3<f32>(0.85, 0.88, 1.0) * 0.4;
    
    // Arms (with slight breathing sway)
    let sway = sin(t * 1.5) * 0.01 * u_breath.intensity;
    leftHand.x += sway;
    rightHand.x -= sway;
    
    let leftArmD = sdSegment(uv, chestPos + vec2<f32>(-0.055, 0.04), leftHand) - 0.022;
    let rightArmD = sdSegment(uv, chestPos + vec2<f32>(0.055, 0.04), rightHand) - 0.022;
    col += exp(-abs(leftArmD) * 35.0) * vec3<f32>(0.85, 0.9, 1.0) * 0.45;
    col += exp(-abs(rightArmD) * 35.0) * vec3<f32>(0.85, 0.9, 1.0) * 0.45;
    
    // Hands with phase-colored glow
    let phaseColor = PHASE_COLORS[u_breath.phase];
    let handGlow = 0.6 + 0.4 * u_breath.intensity;
    let leftHandD = sdCircle(uv - leftHand, 0.025);
    let rightHandD = sdCircle(uv - rightHand, 0.025);
    col += exp(-abs(leftHandD) * 45.0) * phaseColor * handGlow;
    col += exp(-abs(rightHandD) * 45.0) * phaseColor * handGlow;
    
    // Legs
    let leftLegD = sdSegment(uv, hipsPos, vec2<f32>(-0.12, -0.45)) - 0.028;
    let rightLegD = sdSegment(uv, hipsPos, vec2<f32>(0.12, -0.45)) - 0.028;
    col += exp(-abs(leftLegD) * 35.0) * vec3<f32>(0.8, 0.85, 1.0) * 0.4;
    col += exp(-abs(rightLegD) * 35.0) * vec3<f32>(0.8, 0.85, 1.0) * 0.4;
    
    return col;
}

// === Breathing Progress Ring ===============================================

fn progressRing(uv: vec2<f32>) -> vec3<f32> {
    var col = vec3<f32>(0.0);
    
    let r = length(uv);
    let a = atan2(uv.y, uv.x);
    
    // Main ring
    let ringD = abs(r - 0.65) - 0.015;
    let phaseColor = PHASE_COLORS[u_breath.phase];
    
    // Progress arc based on real phaseProgress
    let normalizedAngle = (a + PI) / TAU;
    let progressAngle = u_breath.phaseProgress;
    let inArc = select(0.0, 1.0, normalizedAngle < progressAngle);
    
    // Glow intensity modulated by intensity uniform
    let glowStrength = 0.8 + 0.4 * u_breath.intensity;
    col += exp(-abs(ringD) * 50.0) * phaseColor * glowStrength * inArc;
    col += exp(-abs(ringD) * 20.0) * phaseColor * 0.15; // dim base ring
    
    // Glow at progress point
    let progressPos = vec2<f32>(cos(progressAngle * TAU - PI), sin(progressAngle * TAU - PI)) * 0.65;
    let glowD = length(uv - progressPos);
    let pointGlow = 0.8 + 0.6 * sin(u_breath.time * 4.0) * u_breath.intensity;
    col += exp(-glowD * 30.0) * phaseColor * pointGlow;
    
    return col;
}

// === Prana Particles =======================================================

fn particles(uv: vec2<f32>, t: f32) -> vec3<f32> {
    var col = vec3<f32>(0.0);
    
    // Flow direction: outward on inhale/hold, inward on exhale/hold2
    let outward = u_breath.phase == 0u || u_breath.phase == 1u;
    let flowSpeed = 0.25 + 0.15 * u_breath.intensity;
    
    for (var i: f32 = 0.0; i < 32.0; i += 1.0) {
        let seed = i * 13.37;
        let a = i * TAU / 32.0 + t * flowSpeed + hash11(seed);
        let r = 0.15 + fract(seed + t * 0.3) * 0.6;
        
        // Flow with breath phase
        let flow = select(1.0 - u_breath.phaseProgress, u_breath.phaseProgress, outward);
        let pulseRadius = 1.0 + 0.1 * u_breath.intensity * sin(t * 3.0 + i);
        let pos = vec2<f32>(cos(a), sin(a)) * (r + flow * 0.1 * select(-1.0, 1.0, outward)) * pulseRadius;
        
        let d = length(uv - pos);
        let intensity = exp(-d * 45.0);
        
        // Phase-shifted colors
        let hue = fract(i * 0.1 + t * 0.15 + f32(u_breath.phase) * 0.1);
        let pcol = 0.6 + 0.4 * cos(vec3<f32>(0.0, 2.0, 4.0) + hue * 6.0);
        
        col += intensity * pcol * 1.2 * (0.8 + 0.4 * u_breath.intensity);
    }
    
    return col;
}

// === Vertex Shader =========================================================

@vertex
fn vs_main(@builtin(vertex_index) vid: u32) -> @builtin(position) vec4<f32> {
    let pos = array<vec2<f32>, 6>(
        vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(-1.0, 1.0),
        vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0), vec2<f32>(-1.0, 1.0)
    );
    return vec4<f32>(pos[vid], 0.0, 1.0);
}

// === Fragment Shader =======================================================

@fragment
fn fs_main(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
    let uv = (fragCoord.xy - 0.5 * iResolution.xy) / min(iResolution.x, iResolution.y);
    let t = u_breath.time * 0.8;
    
    // Deep cosmic background
    var color = vec3<f32>(0.008, 0.003, 0.035);
    
    // Global intensity modulation
    let globalIntensity = 0.85 + 0.35 * u_breath.intensity;
    
    // Star field with phase-shifted hues
    color += starPattern(uv, t * 0.2) * globalIntensity;
    
    // Sacred geometry rings (breathing)
    color += sacredRings(uv, t) * globalIntensity;
    
    // Lotus (bloom/close with breath)
    color += lotus(uv * 1.1, t) * globalIntensity;
    
    // Progress ring (synced to phaseProgress)
    color += progressRing(uv) * (0.8 + 0.4 * u_breath.intensity);
    
    // Chakra column with breath pulse
    var chakraCol = chakras(uv * 0.9, t);
    let phaseHueShift = f32(u_breath.phase) * 0.15 + u_breath.phaseProgress * 0.1;
    chakraCol *= hue(t * 0.4 + phaseHueShift + length(uv) * 0.8);
    color += chakraCol * globalIntensity;
    
    // Human figure with animated arms
    color += figure(uv * 0.75 + vec2<f32>(0.0, -0.05), t) * globalIntensity;
    
    // Prana particles
    color += particles(uv, t) * globalIntensity;
    
    // === PHASE-SPECIFIC ENHANCEMENTS =======================================
    
    // Stronger pulse during inhale
    if (u_breath.phase == 0u) {
        let inhaleBoost = 1.0 + 0.25 * u_breath.phaseProgress * u_breath.intensity;
        color *= inhaleBoost;
    }
    
    // Deep calm during hold2
    if (u_breath.phase == 3u) {
        let calmPulse = 1.0 + 0.1 * sin(t * 2.0) * u_breath.intensity;
        color *= calmPulse;
    }
    
    // Core glow during holds (stronger with intensity)
    if (u_breath.phase == 1u || u_breath.phase == 3u) {
        let coreGlow = exp(-length(uv) * 12.0) * (0.35 + 0.25 * u_breath.intensity);
        color += coreGlow * vec3<f32>(1.0, 0.95, 0.85);
    }
    
    // Vignette
    color *= 1.0 - length(uv) * 0.3;
    
    // Final tone mapping with intensity modulation
    let gamma = 0.9 - 0.1 * u_breath.intensity;
    color = pow(color, vec3<f32>(gamma));
    
    // Subtle brightness boost based on intensity
    color *= 0.95 + 0.15 * u_breath.intensity;
    
    return vec4<f32>(color, 1.0);
}
