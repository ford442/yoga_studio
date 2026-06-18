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
    figurePose: f32,         // 0=lotus, 1=tadasana, 2=tai-chi, 3=heart-open, 4=chinmudra, 5=warrior, 6=tree
    qualityPreset: f32,      // 0.0=mobile, 1.0=high
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

// ---------------------------------------------------------------------------
// Figure pose enum (matches SessionMode.figurePose from the React app)
//   0 = seated lotus (padmasana)
//   1 = standing tadasana / mountain arms overhead
//   2 = tai-chi flowing single whip
//   3 = heart-opening arms-wide
//   4 = chinmudra seated (wisdom seal)
//   5 = warrior II (virabhadrasana)
//   6 = tree pose (vrksasana)
// ---------------------------------------------------------------------------

fn poseHandTargets(t: f32, expand: f32) -> array<vec2<f32>, 2> {
    var hands: array<vec2<f32>, 2>;
    let pose = i32(u.figurePose + 0.5);
    let pp = u.phaseProgress;
    let ease = pp * pp * (3.0 - 2.0 * pp);
    let idle = sin(t * 1.5) * 0.015 * u.intensity;

    // Defaults: resting arms at sides
    var leftHand  = vec2<f32>(-0.82, 0.68);
    var rightHand = vec2<f32>( 0.82, 0.68);

    if (pose == 0) {
        // Lotus: arms float from sides to overhead with the breath
        let leftUp  = vec2<f32>(-0.20, 1.85);
        let rightUp = vec2<f32>( 0.20, 1.85);
        if (u.chakraPhase < 0.5) {
            let overshoot = 0.04 * sin(pp * PI) * (0.5 + 0.5 * u.intensity);
            leftHand  = mix(vec2<f32>(-0.82, 0.68), leftUp, ease)  + vec2<f32>(0.0, overshoot);
            rightHand = mix(vec2<f32>( 0.82, 0.68), rightUp, ease) + vec2<f32>(0.0, overshoot);
        } else if (u.chakraPhase < 1.5) {
            let sway = sin(t * 2.0) * 0.02 * u.intensity;
            let pulse = 1.0 + 0.02 * sin(t * 3.0) * u.intensity;
            leftHand  = vec2<f32>(-0.20 + sway, 1.85 * pulse);
            rightHand = vec2<f32>( 0.20 - sway, 1.85 * pulse);
        } else if (u.chakraPhase < 2.5) {
            let settle = 0.03 * sin(pp * PI) * (0.5 + 0.5 * u.intensity);
            leftHand  = mix(leftUp,  vec2<f32>(-0.82, 0.68), ease) - vec2<f32>(0.0, settle);
            rightHand = mix(rightUp, vec2<f32>( 0.82, 0.68), ease) - vec2<f32>(0.0, settle);
        } else {
            leftHand  = vec2<f32>(-0.82 + idle, 0.68);
            rightHand = vec2<f32>( 0.82 - idle, 0.68);
        }
    } else if (pose == 1) {
        // Tadasana: arms straight up overhead, drift slightly with breath
        if (u.chakraPhase < 0.5) {
            leftHand  = mix(vec2<f32>(-0.25, 0.65), vec2<f32>(-0.12, 1.92), ease);
            rightHand = mix(vec2<f32>( 0.25, 0.65), vec2<f32>( 0.12, 1.92), ease);
        } else if (u.chakraPhase < 1.5) {
            let sway = sin(t * 2.0) * 0.015 * u.intensity;
            leftHand  = vec2<f32>(-0.12 + sway, 1.92);
            rightHand = vec2<f32>( 0.12 - sway, 1.92);
        } else if (u.chakraPhase < 2.5) {
            leftHand  = mix(vec2<f32>(-0.12, 1.92), vec2<f32>(-0.25, 0.65), ease);
            rightHand = mix(vec2<f32>( 0.12, 1.92), vec2<f32>( 0.25, 0.65), ease);
        } else {
            leftHand  = vec2<f32>(-0.25 + idle, 0.65);
            rightHand = vec2<f32>( 0.25 - idle, 0.65);
        }
    } else if (pose == 2) {
        // Tai-chi single whip: asymmetric wave, hands trade high/low
        let flow = sin(t * 0.7 + expand * PI) * 0.08 * u.intensity;
        if (u.chakraPhase < 0.5) {
            leftHand  = mix(vec2<f32>(-0.60, 0.55), vec2<f32>(-0.85, 1.25), ease) + vec2<f32>(0.0, flow);
            rightHand = mix(vec2<f32>( 0.60, 0.55), vec2<f32>( 0.35, 0.45), ease) - vec2<f32>(0.0, flow);
        } else if (u.chakraPhase < 1.5) {
            leftHand  = vec2<f32>(-0.85 + flow, 1.25);
            rightHand = vec2<f32>( 0.35 - flow, 0.45);
        } else if (u.chakraPhase < 2.5) {
            leftHand  = mix(vec2<f32>(-0.85, 1.25), vec2<f32>(-0.60, 0.55), ease) - vec2<f32>(0.0, flow);
            rightHand = mix(vec2<f32>( 0.35, 0.45), vec2<f32>( 0.60, 0.55), ease) + vec2<f32>(0.0, flow);
        } else {
            leftHand  = vec2<f32>(-0.60 + idle, 0.55);
            rightHand = vec2<f32>( 0.60 - idle, 0.55);
        }
    } else if (pose == 3) {
        // Heart-opening: arms sweep wide horizontally, chest proud
        if (u.chakraPhase < 0.5) {
            leftHand  = mix(vec2<f32>(-0.35, 0.70), vec2<f32>(-1.05, 1.05), ease);
            rightHand = mix(vec2<f32>( 0.35, 0.70), vec2<f32>( 1.05, 1.05), ease);
        } else if (u.chakraPhase < 1.5) {
            let pulse = 1.0 + 0.02 * sin(t * 2.5) * u.intensity;
            leftHand  = vec2<f32>(-1.05, 1.05 * pulse);
            rightHand = vec2<f32>( 1.05, 1.05 * pulse);
        } else if (u.chakraPhase < 2.5) {
            leftHand  = mix(vec2<f32>(-1.05, 1.05), vec2<f32>(-0.35, 0.70), ease);
            rightHand = mix(vec2<f32>( 1.05, 1.05), vec2<f32>( 0.35, 0.70), ease);
        } else {
            leftHand  = vec2<f32>(-0.35 + idle, 0.70);
            rightHand = vec2<f32>( 0.35 - idle, 0.70);
        }
    } else if (pose == 4) {
        // Chinmudra: hands rest softly on knees, very little travel
        let breathe = 0.03 * sin(pp * PI) * select(0.0, 1.0, u.chakraPhase < 1.5);
        leftHand  = vec2<f32>(-0.72, -0.12 + breathe + idle * 0.3);
        rightHand = vec2<f32>( 0.72, -0.12 + breathe - idle * 0.3);
    } else if (pose == 5) {
        // Warrior II: arms horizontal, strong wide stance
        if (u.chakraPhase < 0.5) {
            let reach = ease * 0.25;
            leftHand  = vec2<f32>(-1.05 - reach, 0.92);
            rightHand = vec2<f32>( 1.05 + reach, 0.92);
        } else if (u.chakraPhase < 1.5) {
            let sway = sin(t * 2.0) * 0.02 * u.intensity;
            leftHand  = vec2<f32>(-1.05 + sway, 0.92);
            rightHand = vec2<f32>( 1.05 - sway, 0.92);
        } else if (u.chakraPhase < 2.5) {
            let reach = ease * 0.25;
            leftHand  = vec2<f32>(-1.05 + reach, 0.92);
            rightHand = vec2<f32>( 1.05 - reach, 0.92);
        } else {
            leftHand  = vec2<f32>(-1.05 + idle, 0.92);
            rightHand = vec2<f32>( 1.05 - idle, 0.92);
        }
    } else if (pose == 6) {
        // Tree pose: hands at heart center, subtle rise/fall
        if (u.chakraPhase < 0.5) {
            leftHand  = mix(vec2<f32>(-0.18, 0.85), vec2<f32>(-0.10, 1.18), ease);
            rightHand = mix(vec2<f32>( 0.18, 0.85), vec2<f32>( 0.10, 1.18), ease);
        } else if (u.chakraPhase < 1.5) {
            let sway = sin(t * 1.8) * 0.01 * u.intensity;
            leftHand  = vec2<f32>(-0.10 + sway, 1.18);
            rightHand = vec2<f32>( 0.10 - sway, 1.18);
        } else if (u.chakraPhase < 2.5) {
            leftHand  = mix(vec2<f32>(-0.10, 1.18), vec2<f32>(-0.18, 0.85), ease);
            rightHand = mix(vec2<f32>( 0.10, 1.18), vec2<f32>( 0.18, 0.85), ease);
        } else {
            leftHand  = vec2<f32>(-0.18 + idle, 0.85);
            rightHand = vec2<f32>( 0.18 - idle, 0.85);
        }
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
    let hands = poseHandTargets(t, expand);

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

fn lotusSeatMonk(p: vec2<f32>, hipsPos: vec2<f32>, expand: f32) -> f32 {
    var d = 1e6;
    // Overlapping thighs and shins
    d = min(d, sdSegment(p, hipsPos + vec2<f32>(-0.03, -0.02), vec2<f32>(-0.78, -0.40)) - 0.075);
    d = min(d, sdSegment(p, vec2<f32>(-0.78, -0.40), vec2<f32>( 0.04, -0.52)) - 0.065);
    d = min(d, sdSegment(p, hipsPos + vec2<f32>( 0.03, -0.02), vec2<f32>( 0.78, -0.40)) - 0.075);
    d = min(d, sdSegment(p, vec2<f32>( 0.78, -0.40), vec2<f32>(-0.04, -0.52)) - 0.065);
    // Seat platform under hips
    d = min(d, abs(sdCircle(p - (hipsPos + vec2<f32>(0.0, -0.06)), 0.55 + expand * 0.03)) - 0.06);
    return d;
}

fn groundedFeetMonk(p: vec2<f32>, footL: vec2<f32>, footR: vec2<f32>, pose: i32) -> f32 {
    var d = 1e6;
    if (pose == 6) {
        // Tree: rooted foot + lifted-heel balance line
        d = min(d, sdSegment(p, footL, footL + vec2<f32>(-0.18, 0.0)) - 0.075);
        d = min(d, sdSegment(p, footR, footR + vec2<f32>( 0.10, 0.0)) - 0.050);
    } else {
        d = min(d, sdSegment(p, footL, footL + vec2<f32>(-0.20, 0.0)) - 0.10);
        d = min(d, sdSegment(p, footR, footR + vec2<f32>( 0.20, 0.0)) - 0.10);
    }
    return d;
}

fn sacredFigure(uv: vec2<f32>, t: f32, breath: f32, expand: f32) -> f32 {
    var d = 1e6;
    let pulse = 1.0 + 0.25 * sin(breath * 6.283185) * u.intensity;
    let hands = poseHandTargets(t, expand);
    let pose = i32(u.figurePose + 0.5);

    // Arm height drives subtle head drishti tilt
    let armHeight = (hands[0].y + hands[1].y) * 0.5 - 1.10;
    let tilt = clamp(armHeight * 0.04, -0.025, 0.025) * (0.5 + 0.5 * sin(t * 0.7));

    // Head rises subtly with the inhale, with tilt and chin tuck
    let headPos = vec2<f32>(tilt, 1.65 + expand * 0.04);
    d = min(d, sdCircle(uv - headPos, 0.28));
    d = min(d, sdCircle(uv - (headPos + vec2<f32>(tilt * 0.5, -0.13)), 0.09));

    // Torso / chest expands around its center
    let torsoCenter = vec2<f32>(0.0, 0.9 + expand * 0.02);
    let torsoHalf = 0.45 * (1.0 + expand * 0.08);
    let torsoTop = torsoCenter + vec2<f32>(0.0, torsoHalf);
    let torsoBot = torsoCenter - vec2<f32>(0.0, torsoHalf);
    d = min(d, sdSegment(uv, torsoTop, torsoBot) / pulse);

    // Legs / seat depend on the selected figure pose
    if (pose == 0 || pose == 4) {
        d = min(d, lotusSeatMonk(uv, vec2<f32>(0.0, 0.45), expand));
    } else {
        var footL = vec2<f32>(0.0);
        var footR = vec2<f32>(0.0);
        if (pose == 1) {
            footL = vec2<f32>(-0.18, -0.55);
            footR = vec2<f32>( 0.18, -0.55);
            d = min(d, sdSegment(uv, vec2<f32>(0.0, 0.45), footL));
            d = min(d, sdSegment(uv, vec2<f32>(0.0, 0.45), footR));
        } else if (pose == 2) {
            footL = vec2<f32>(-0.55, -0.25);
            footR = vec2<f32>( 0.55, -0.45);
            d = min(d, sdSegment(uv, vec2<f32>(0.0, 0.45), footL));
            d = min(d, sdSegment(uv, vec2<f32>(0.0, 0.45), footR));
        } else if (pose == 3) {
            footL = vec2<f32>(-0.22, -0.48);
            footR = vec2<f32>( 0.22, -0.48);
            d = min(d, sdSegment(uv, vec2<f32>(0.0, 0.45), footL));
            d = min(d, sdSegment(uv, vec2<f32>(0.0, 0.45), footR));
        } else if (pose == 5) {
            footL = vec2<f32>(-0.85, -0.30);
            footR = vec2<f32>( 0.85, -0.30);
            d = min(d, sdSegment(uv, vec2<f32>(0.0, 0.45), footL));
            d = min(d, sdSegment(uv, vec2<f32>(0.0, 0.45), footR));
        } else if (pose == 6) {
            footL = vec2<f32>(0.0, -0.55);
            footR = vec2<f32>(0.28, -0.05);
            d = min(d, sdSegment(uv, vec2<f32>(0.0, 0.45), footL));
            d = min(d, sdSegment(uv, vec2<f32>(0.0, 0.45), footR));
        }
        d = min(d, groundedFeetMonk(uv, footL, footR, pose));
    }

    // Arms — animated from the shoulders to the current hand targets
    let shoulderY = 1.10 + expand * 0.03 + expand * 0.025;
    d = min(d, sdSegment(uv, vec2<f32>(-0.02, shoulderY), hands[0]));
    d = min(d, sdSegment(uv, vec2<f32>( 0.02, shoulderY), hands[1]));

    // Spine / sushumna
    d = min(d, sdSegment(uv, vec2<f32>(0.0, 1.72 + expand * 0.04), vec2<f32>(0.0, -0.38)));

    return d;
}

fn figureDetailsMonk(uv: vec2<f32>, t: f32, breath: f32, expand: f32) -> vec3<f32> {
    var col = vec3<f32>(0.0);
    let hands = poseHandTargets(t, expand);
    let pose = i32(u.figurePose + 0.5);
    let chestPos = vec2<f32>(0.0, 0.9 + expand * 0.02);
    let hipsPos = vec2<f32>(0.0, 0.45);
    let p = uv;

    var themeColor = vec3<f32>(0.85, 0.90, 1.00);
    if (u.theme < 0.5)      { themeColor = vec3<f32>(0.75, 0.85, 1.00); }
    else if (u.theme < 1.5) { themeColor = vec3<f32>(1.00, 0.85, 0.45); }
    else                    { themeColor = vec3<f32>(0.45, 0.90, 1.00); }

    // Independent ribcage breath
    let breathAmp = 0.015 * expand;
    let leftRib  = sdSegment(p, chestPos + vec2<f32>(-0.16 - breathAmp, 0.05),
                                   chestPos + vec2<f32>(-0.25 - breathAmp, -0.12)) - 0.05;
    let rightRib = sdSegment(p, chestPos + vec2<f32>( 0.16 + breathAmp, 0.05),
                                   chestPos + vec2<f32>( 0.25 + breathAmp, -0.12)) - 0.05;
    col += exp(-abs(leftRib)  * 20.0) * themeColor * 0.14;
    col += exp(-abs(rightRib) * 20.0) * themeColor * 0.14;

    // Flowing robe lines (strength-gated)
    let robeStrength = smoothstep(0.8, 2.0, u.strengthLevel) + 0.20 * u.intensity;
    if (robeStrength > 0.05) {
        let sway = sin(t * 1.2) * 0.015 * u.intensity;
        let armLift = max(0.0, (hands[0].y + hands[1].y) * 0.5 - 1.10);
        let leftRobe  = sdSegment(p, chestPos + vec2<f32>(-0.24 + sway, 0.02),
                                        hipsPos + vec2<f32>(-0.22, 0.0)) - 0.09;
        let rightRobe = sdSegment(p, chestPos + vec2<f32>( 0.24 - sway, 0.02),
                                        hipsPos + vec2<f32>( 0.22, 0.0)) - 0.09;
        col += exp(-abs(leftRobe)  * 14.0) * themeColor * 0.11 * robeStrength;
        col += exp(-abs(rightRobe) * 14.0) * themeColor * 0.11 * robeStrength;
    }

    // Hand mudra detail
    let mudraBase = smoothstep(1.0, 2.0, u.strengthLevel) + 0.35 * smoothstep(0.75, 1.0, u.intensity);
    let holdGlow = select(0.0, 1.0, u.chakraPhase > 0.5 && u.chakraPhase < 2.5);
    let mudraStrength = mudraBase + holdGlow * 0.25;
    if (mudraStrength > 0.05) {
        let phaseColor = chakraFocusTint();

        // Left hand
        let thumbL = hands[0] + vec2<f32>(-0.032, -0.015);
        let indexL = hands[0] + vec2<f32>(-0.022,  0.025);
        let mudraCenterL = (thumbL + indexL) * 0.5;
        let mudraDL = abs(sdCircle(p - mudraCenterL, 0.024)) - 0.005;
        col += exp(-abs(mudraDL) * 60.0) * phaseColor * 0.45 * mudraStrength;

        // Right hand
        let thumbR = hands[1] + vec2<f32>( 0.032, -0.015);
        let indexR = hands[1] + vec2<f32>( 0.022,  0.025);
        let mudraCenterR = (thumbR + indexR) * 0.5;
        let mudraDR = abs(sdCircle(p - mudraCenterR, 0.024)) - 0.005;
        col += exp(-abs(mudraDR) * 60.0) * phaseColor * 0.45 * mudraStrength;
    }

    // Sushumna nadi glow (tied to chakraFocus)
    if (p.y > -0.45 && p.y < 1.75) {
        let nadiD = abs(p.x) - 0.012;
        var nadiColor = vec3<f32>(0.9, 0.95, 1.0);
        if (u.chakraFocus >= 0.0) {
            nadiColor = mix(nadiColor, CHAKRA[u32(clamp(u.chakraFocus, 0.0, 6.0))], 0.45);
        } else if (u.chakraPhase < 0.5) {
            nadiColor = mix(nadiColor, vec3<f32>(1.0, 0.85, 0.4), u.phaseProgress * 0.30);
        } else if (u.chakraPhase > 1.5 && u.chakraPhase < 2.5) {
            nadiColor = mix(vec3<f32>(1.0, 0.85, 0.4), vec3<f32>(0.4, 0.85, 1.0), u.phaseProgress * 0.30);
        }
        col += exp(-abs(nadiD) * 30.0) * nadiColor * 0.16 * (0.6 + expand * 0.4);
    }

    return col;
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
    let figureDetailCol = figureDetailsMonk(uv, u.time, breath, expand);

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

    col += figureDetailCol;

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
