// public/sacred-monk.wgsl
// Final Interactive Temple — Touch Reactive + Audio Synced Feel

struct Uniforms {
    time: f32,
    breathPhase: f32,
    intensity: f32,
    chakraPhase: f32,
    theme: f32,
    mandalaStyle: f32,
    phaseProgress: f32,      // 0..1 progress within the current breath phase
    strengthLevel: f32,      // 0.0=light, 1.0=regular, 2.0=strong
    mouse: vec2<f32>,        // -1..1 or (-2,-2) = inactive
    mouseStrength: f32,      // 0..1 strength of current touch
    chakraFocus: f32,        // -1=none, 0..6=root..crown (repurposed padding0)
    resolution: vec2<f32>,
    geometryDensity: f32,    // detail multiplier for geometry/petals/ring counts
    interference: f32,       // moire / recursive layer motion strength
}

@group(0) @binding(0) var<uniform> u: Uniforms;

const CHAKRA = array<vec3<f32>, 7>(
    vec3<f32>(0.90, 0.12, 0.18),
    vec3<f32>(0.98, 0.45, 0.12),
    vec3<f32>(0.98, 0.85, 0.20),
    vec3<f32>(0.25, 0.85, 0.45),
    vec3<f32>(0.20, 0.55, 0.95),
    vec3<f32>(0.35, 0.25, 0.80),
    vec3<f32>(0.65, 0.30, 0.90),
);

const PI: f32 = 3.14159265359;
const TAU: f32 = 6.28318530718;
const GOLDEN_ANGLE: f32 = 2.39996323;

fn rot2(a: f32) -> mat2x2<f32> {
    let c = cos(a);
    let s = sin(a);
    return mat2x2<f32>(c, -s, s, c);
}

fn pmod(a: f32, b: f32) -> f32 {
    return a - floor(a / b) * b;
}

@vertex
fn vs(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4<f32> {
    let pos = array<vec2<f32>, 6>(
        vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(-1.0, 1.0),
        vec2<f32>(-1.0, 1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0)
    );
    return vec4<f32>(pos[vertexIndex], 0.0, 1.0);
}

fn sdSegment(p: vec2<f32>, a: vec2<f32>, b: vec2<f32>) -> f32 {
    let pa = p - a; let ba = b - a;
    let h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h);
}

fn sdCircle(p: vec2<f32>, r: f32) -> f32 {
    return length(p) - r;
}

fn chakraFocusTint() -> vec3<f32> {
    if (u.chakraFocus < 0.0) {
        return vec3<f32>(1.0);
    }
    let idx = u32(clamp(u.chakraFocus, 0.0, 6.0));
    return CHAKRA[idx];
}

fn dotLattice(uv: vec2<f32>, t: f32, density: f32) -> vec3<f32> {
    let r = length(uv);
    var col = vec3<f32>(0.0);
    let ringCount = i32(clamp(3.0 + density * 4.0, 3.0, 9.0));
    let dotCountBase = 8.0 + density * 12.0;
    for (var i = 0; i < ringCount; i++) {
        let fi = f32(i);
        let rr = 0.06 + fi * 0.05 * (1.0 + density * 0.15);
        let band = exp(-abs(r - rr) * 40.0);
        let dots = i32(clamp(dotCountBase + fi * 4.0, 4.0, 36.0));
        for (var d = 0; d < dots; d++) {
            let fd = f32(d);
            let ang = fd * TAU / f32(dots) + t * 0.15 * (1.0 + fi * 0.25);
            let p = vec2<f32>(cos(ang), sin(ang)) * rr;
            let dd = length(uv - p) - 0.0045 * (1.0 + density * 0.25);
            let glow = exp(-abs(dd) * 150.0);
            let c = 0.6 + 0.4 * cos(vec3<f32>(0.0, 2.0, 4.0) + fd * 0.35 + fi * 0.5);
            col += glow * c * 0.10 * band;
        }
    }
    return col;
}

fn goldenSeedField(uv: vec2<f32>, center: vec2<f32>, count: i32, t: f32, density: f32) -> vec3<f32> {
    var col = vec3<f32>(0.0);
    let n = clamp(count + i32(density * 18.0), 6, 48);
    for (var i = 0; i < n; i++) {
        let fi = f32(i);
        let r = 0.015 + sqrt(fi) * 0.014 * density;
        let a = fi * GOLDEN_ANGLE + t * 0.25;
        let p = center + vec2<f32>(cos(a), sin(a)) * r;
        let d = length(uv - p) - 0.003 * (1.0 + density * 0.3);
        let glow = exp(-abs(d) * 180.0);
        let c = 0.6 + 0.4 * cos(vec3<f32>(0.0, 2.0, 4.0) + fi * 0.25);
        col += glow * c * 0.14;
    }
    return col;
}

fn mandala(uv: vec2<f32>, t: f32, breath: f32) -> vec3<f32> {
    var col = vec3<f32>(0.0);
    let r = length(uv);
    let a = atan2(uv.y, uv.x);
    let density = clamp(u.geometryDensity + u.intensity * 0.25, 0.2, 3.0);
    let inter = u.interference;

    col += 0.042 * abs(sin(r * (13.0 + density * 6.0) - t * 1.2 + breath * 3.0));
    col += 0.028 * abs(sin(r * (24.0 + density * 12.0) + t * 0.8));

    if (u.mandalaStyle < 0.5) {
        let petals = sin(a * (12.0 + density * 8.0) + t * 0.5 * (1.0 + inter)) * 0.5 + 0.5;
        col += smoothstep(0.38, 0.68, r) * smoothstep(0.88, 0.52, r) * petals * 0.9;
        col += dotLattice(uv, t, density) * 0.25;
    } else if (u.mandalaStyle < 1.5) {
        col += abs(sin(a * (9.0 + density * 6.0) - t * 1.6 * (1.0 + inter))) * 0.07 * vec3<f32>(1.0, 0.8, 0.5);
        // nested rotating yantra triangles
        let triCount = i32(clamp(3.0 + density * 4.0, 3.0, 10.0));
        for (var i = 0; i < triCount; i++) {
            let fi = f32(i);
            let sector = TAU / 3.0;
            let sa = pmod(a + t * 0.1 * (1.0 + inter) * (fi + 1.0), sector) - sector * 0.5;
            let triD = abs(length(uv) - (0.25 + fi * 0.07)) + abs(sa) * r * 0.9;
            col += exp(-triD * 35.0) * vec3<f32>(1.0, 0.85, 0.45) * (0.12 - fi * 0.008);
        }
    } else {
        col += sin(r * (30.0 + density * 20.0) - t * 1.1 * (1.0 + inter)) * 0.05;
        col += goldenSeedField(uv, vec2<f32>(0.0), 21, t, density) * 0.25;
    }
    col += exp(-r * 7.5) * 1.4;
    return col;
}

fn cosmicBackground(uv: vec2<f32>, t: f32) -> vec3<f32> {
    var col = vec3<f32>(0.0035, 0.0015, 0.014);
    let stars = fract(sin(dot(uv * 1.3, vec2<f32>(12.9898, 78.233))) * 43758.5453);
    col += smoothstep(0.965, 1.0, stars) * 1.1;
    return col;
}

fn volumetricShafts(uv: vec2<f32>, t: f32, breath: f32) -> vec3<f32> {
    var col = vec3<f32>(0.0);
    let angle = atan2(uv.y, uv.x);
    for (var i = 0; i < 5; i++) {
        let fi = f32(i);
        let shaft = pow(max(0.0, cos(angle - t * 0.12 + fi * 1.256) * 3.0), 12.0);
        let fade = exp(-length(uv) * (2.8 + fi * 0.3));
        col += shaft * fade * vec3<f32>(0.6, 0.45, 1.0) * (0.45 + breath * 0.45);
    }
    return col * 0.65;
}

fn particles(uv: vec2<f32>, t: f32, breath: f32) -> vec3<f32> {
    var col = vec3<f32>(0.0);
    for (var i = 0; i < 9; i++) {
        let fi = f32(i);
        let y = fract(uv.y * 1.75 + t * (0.35 + fi * 0.06) + fi);
        let x = uv.x + sin(t * 0.45 + fi) * 0.28 * (1.0 - y * y);
        let d = length(vec2<f32>(x, y - 0.55));
        col += exp(-d * 28.0) * vec3<f32>(0.7, 0.85, 1.3) * (0.7 + breath);
    }
    return col;
}

fn breathExpand() -> f32 {
    var expand = 0.0;
    if (u.chakraPhase < 0.5) {
        expand = u.phaseProgress;
    } else if (u.chakraPhase < 1.5) {
        expand = 1.0;
    } else if (u.chakraPhase < 2.5) {
        expand = 1.0 - u.phaseProgress;
    } else {
        expand = 0.0;
    }
    return expand * expand * (3.0 - 2.0 * expand);
}

fn animatedHandPositions(t: f32, expand: f32) -> array<vec2<f32>, 2> {
    var hands: array<vec2<f32>, 2>;

    // Resting arms hang out to the sides
    var leftHand  = vec2<f32>(-0.82, 0.68);
    var rightHand = vec2<f32>( 0.82, 0.68);

    // Overhead target for inhale / hold1
    let leftUp  = vec2<f32>(-0.20, 1.85);
    let rightUp = vec2<f32>( 0.20, 1.85);

    if (u.chakraPhase < 0.5) {
        let pp = u.phaseProgress;
        let rise = pp * pp * (3.0 - 2.0 * pp);
        let overshoot = 0.04 * sin(pp * PI) * (0.5 + 0.5 * u.intensity);
        leftHand  = mix(vec2<f32>(-0.82, 0.68), leftUp, rise)  + vec2<f32>(0.0, overshoot);
        rightHand = mix(vec2<f32>( 0.82, 0.68), rightUp, rise) + vec2<f32>(0.0, overshoot);
    } else if (u.chakraPhase < 1.5) {
        let sway = sin(t * 2.0) * 0.02 * u.intensity;
        let pulse = 1.0 + 0.02 * sin(t * 3.0) * u.intensity;
        leftHand  = vec2<f32>(-0.20 + sway, 1.85 * pulse);
        rightHand = vec2<f32>( 0.20 - sway, 1.85 * pulse);
    } else if (u.chakraPhase < 2.5) {
        let pp = u.phaseProgress;
        let lower = pp * pp * (3.0 - 2.0 * pp);
        let settle = 0.03 * sin(pp * PI) * (0.5 + 0.5 * u.intensity);
        leftHand  = mix(leftUp,  vec2<f32>(-0.82, 0.68), lower) - vec2<f32>(0.0, settle);
        rightHand = mix(rightUp, vec2<f32>( 0.82, 0.68), lower) - vec2<f32>(0.0, settle);
    } else {
        let idle = sin(t * 1.5) * 0.015 * u.intensity;
        leftHand  = vec2<f32>(-0.82 + idle, 0.68);
        rightHand = vec2<f32>( 0.82 - idle, 0.68);
    }

    let microSway = sin(t * 1.5) * 0.01 * u.intensity;
    leftHand.x  += microSway;
    rightHand.x -= microSway;

    hands[0] = leftHand;
    hands[1] = rightHand;
    return hands;
}

fn figureGeometry(uv: vec2<f32>, t: f32, breath: f32) -> vec3<f32> {
    var col = vec3<f32>(0.0);
    let density = clamp(u.geometryDensity, 0.2, 3.0);
    let expand = breathExpand();
    let hands = animatedHandPositions(t, expand);

    // Heart / anahata position — where the arms meet the chest
    let heart = vec2<f32>(0.0, 1.10 + expand * 0.03);
    let heartRing = abs(length(uv - heart) - (0.18 + breath * 0.03)) - 0.006;
    col += exp(-abs(heartRing) * 80.0) * vec3<f32>(0.85, 0.75, 1.0) * 0.35;

    // Crown / sahasrara seed field
    let crown = vec2<f32>(0.0, 1.90 + expand * 0.04);
    col += goldenSeedField(uv, crown, 12, t, density) * 0.45;

    // Small geometry follows the animated hands
    col += goldenSeedField(uv, hands[0], 6, t, density) * 0.20;
    col += goldenSeedField(uv, hands[1], 6, t, density) * 0.20;

    return col;
}

fn sacredFigure(uv: vec2<f32>, t: f32, breath: f32, expand: f32) -> f32 {
    var d = 1e6;
    let pulse = 1.0 + 0.25 * sin(breath * 6.283185) * u.intensity;
    let hands = animatedHandPositions(t, expand);

    // Head rises subtly with the inhale
    let headPos = vec2<f32>(0.0, 1.65 + expand * 0.04);
    d = min(d, sdCircle(uv - headPos, 0.28));

    // Torso / chest expands around its center
    let torsoCenter = vec2<f32>(0.0, 0.9 + expand * 0.02);
    let torsoHalf = 0.45 * (1.0 + expand * 0.08);
    let torsoTop = torsoCenter + vec2<f32>(0.0, torsoHalf);
    let torsoBot = torsoCenter - vec2<f32>(0.0, torsoHalf);
    d = min(d, sdSegment(uv, torsoTop, torsoBot) / pulse);

    // Legs
    d = min(d, sdSegment(uv, vec2<f32>(0.0, 0.45), vec2<f32>(0.78, -0.4)));
    d = min(d, sdSegment(uv, vec2<f32>(0.0, 0.45), vec2<f32>(-0.78, -0.4)));

    // Arms — animated from the shoulders to the current hand targets
    let shoulderY = 1.10 + expand * 0.03;
    d = min(d, sdSegment(uv, vec2<f32>(0.0, shoulderY), hands[0]));
    d = min(d, sdSegment(uv, vec2<f32>(0.0, shoulderY), hands[1]));

    // Spine / sushumna
    d = min(d, sdSegment(uv, vec2<f32>(0.0, 1.72 + expand * 0.04), vec2<f32>(0.0, -0.38)));

    return d;
}

@fragment
fn main(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
    var uv = (fragCoord.xy - 0.5 * u.resolution) / u.resolution.y;
    let breath = u.breathPhase;

    // Stronger interactive ripple
    var ripple = 0.0;
    if (u.mouse.x > -1.9) {
        let toMouse = uv - u.mouse;
        let dist = length(toMouse);
        let ripplePhase = u.time * 7.0 - dist * 42.0;
        ripple = sin(ripplePhase) * exp(-dist * 5.5) * u.mouseStrength * 0.028;
        uv += toMouse * ripple * 2.2;   // stronger distortion
    }

    let expand = breathExpand();

    var col = cosmicBackground(uv, u.time);

    col += volumetricShafts(uv * 0.85, u.time, breath);
    col += mandala(uv * 0.9, u.time, breath);
    col += particles(uv, u.time, breath);
    col += figureGeometry(uv, u.time, breath);

    let d = sacredFigure(uv, u.time, breath, expand);
    let g1 = 0.017 / (abs(d) + 0.013);
    let g2 = 0.0098 / (abs(d - 0.036) + 0.011);
    let g3 = 0.0058 / (abs(d - 0.09) + 0.026);
    let g4 = 0.0024 / (abs(d - 0.17) + 0.045);

    var neon = vec3<f32>(0.2, 0.92, 1.1);
    if (u.chakraPhase < 0.5)      { neon = vec3<f32>(0.2, 0.92, 1.1); }
    else if (u.chakraPhase < 1.5) { neon = vec3<f32>(0.85, 0.45, 1.0); }
    else if (u.chakraPhase < 2.5) { neon = vec3<f32>(1.05, 0.6, 0.35); }
    else                          { neon = vec3<f32>(1.15, 0.95, 0.55); }

    if (u.theme > 0.5 && u.theme < 1.5) { neon *= vec3<f32>(1.35, 1.0, 0.75); }
    else if (u.theme > 1.5) { neon *= vec3<f32>(0.75, 1.2, 1.25); }
    neon = mix(neon, chakraFocusTint() * 1.15, 0.35);

    col += g1 * neon * 1.45;
    col += g2 * neon * 1.15;
    col += g3 * neon * 0.8;
    col += g4 * neon * 0.5;

    let aura = exp(-length(uv) * 2.1) * (0.8 + sin(breath * 18.0) * 0.9);
    col += aura * neon * u.intensity * (1.0 + ripple * 12.0);

    let haze = exp(-length(uv) * 1.05) * (0.22 + (1.0 - breath) * 0.35);
    col = mix(col, vec3<f32>(0.09, 0.05, 0.2), haze * 0.45);

    let flow = sin(uv.y * 38.0 - u.time * 8.0) * 0.14 * smoothstep(-0.1, 0.85, breath);
    col += flow * neon;

    let vig = pow(1.0 - length(uv) * 0.72, 1.85);
    col *= vig * 1.32;

    col = pow(col, vec3<f32>(0.83));
    col = mix(col, col * (0.6 + chakraFocusTint() * 0.95), 0.30);

    return vec4<f32>(col, 1.0);
}
