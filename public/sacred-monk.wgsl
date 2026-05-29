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
    padding0: f32,           // 16-byte alignment padding
    resolution: vec2<f32>,
    padding1: f32,
    padding2: f32,
}

@group(0) @binding(0) var<uniform> u: Uniforms;

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

fn mandala(uv: vec2<f32>, t: f32, breath: f32) -> vec3<f32> {
    var col = vec3<f32>(0.0);
    let r = length(uv);
    let a = atan2(uv.y, uv.x);

    col += 0.042 * abs(sin(r * 13.0 - t * 1.2 + breath * 3.0));
    col += 0.028 * abs(sin(r * 24.0 + t * 0.8));

    if (u.mandalaStyle < 0.5) {
        let petals = sin(a * 12.0 + t * 0.5) * 0.5 + 0.5;
        col += smoothstep(0.38, 0.68, r) * smoothstep(0.88, 0.52, r) * petals * 0.9;
    } else if (u.mandalaStyle < 1.5) {
        col += abs(sin(a * 9.0 - t * 1.6)) * 0.07 * vec3<f32>(1.0, 0.8, 0.5);
    } else {
        col += sin(r * 30.0 - t * 1.1) * 0.05;
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

fn sacredMonk(uv: vec2<f32>, breath: f32) -> f32 {
    var d = 1e6;
    let pulse = 1.0 + 0.25 * sin(breath * 6.283185) * u.intensity;
    d = min(d, sdCircle(uv - vec2<f32>(0.0, 1.65), 0.28));
    d = min(d, sdSegment(uv, vec2<f32>(0.0, 1.35), vec2<f32>(0.0, 0.45)) / pulse);
    d = min(d, sdSegment(uv, vec2<f32>(0.0, 0.45), vec2<f32>(0.78, -0.4)));
    d = min(d, sdSegment(uv, vec2<f32>(0.0, 0.45), vec2<f32>(-0.78, -0.4)));
    d = min(d, sdSegment(uv, vec2<f32>(0.0, 1.1), vec2<f32>(0.82, 0.68)));
    d = min(d, sdSegment(uv, vec2<f32>(0.0, 1.1), vec2<f32>(-0.82, 0.68)));
    d = min(d, sdSegment(uv, vec2<f32>(0.0, 1.72), vec2<f32>(0.0, -0.38)));
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

    var col = cosmicBackground(uv, u.time);

    col += volumetricShafts(uv * 0.85, u.time, breath);
    col += mandala(uv * 0.9, u.time, breath);
    col += particles(uv, u.time, breath);

    let d = sacredMonk(uv, breath);
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

    return vec4<f32>(col, 1.0);
}
