import { buildUniformsWgsl } from '../lib/shaderContract';

export const OVERLAY_VERTEX_ENTRY = 'overlay_vs';
export const OVERLAY_FRAGMENT_ENTRY = 'overlay_fs';

/**
 * WGSL port of the hex/tri geometry overlay (`WEBGL_OVERLAY_FRAGMENT_SHADER`
 * in `overlay.ts`). Drawn as a second render pass on the scene's encoder, so it
 * reads the same group-0 uniform buffer instead of a GLSL uniform map.
 */
const OVERLAY_BODY = /* wgsl */ `
const PI: f32 = 3.14159265359;
const TAU: f32 = 6.28318530718;

@vertex
fn overlay_vs(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4<f32> {
    let pos = array<vec2<f32>, 3>(
        vec2<f32>(-1.0, -1.0), vec2<f32>(3.0, -1.0), vec2<f32>(-1.0, 3.0)
    );
    return vec4<f32>(pos[vertexIndex], 0.0, 1.0);
}

fn pmod(a: f32, b: f32) -> f32 {
    return a - floor(a / b) * b;
}

fn rot(a: f32) -> mat2x2<f32> {
    let s = sin(a);
    let c = cos(a);
    return mat2x2<f32>(c, -s, s, c);
}

fn curve(t0: f32, d: f32) -> f32 {
    let t = t0 / d;
    return mix(floor(t), floor(t) + 1.0, pow(smoothstep(0.0, 1.0, fract(t)), 20.0));
}

fn dHex(p0: vec2<f32>) -> f32 {
    let p = abs(p0);
    return max(dot(p, normalize(vec2<f32>(1.0, 1.73))), p.x);
}

fn dTri(p: vec2<f32>) -> f32 {
    let a = atan2(p.x, p.y) + PI;
    let r = TAU / 3.0;
    return cos(floor(0.5 + a / r) * r - a) * length(p);
}

fn strokeRing(dist: f32, thickness: f32, blur: f32) -> f32 {
    return 1.0 - smoothstep(0.0, thickness, abs(dist) - blur);
}

fn hexRing(p: vec2<f32>, radius: f32, thickness: f32, blur: f32) -> f32 {
    return strokeRing(dHex(p) - radius, thickness, blur);
}

fn triRing(p: vec2<f32>, radius: f32, thickness: f32, blur: f32) -> f32 {
    return strokeRing(dTri(p) - radius, thickness, blur);
}

fn circleRing(p: vec2<f32>, radius: f32, thickness: f32, blur: f32) -> f32 {
    return strokeRing(length(p) - radius, thickness, blur);
}

fn moda(p: vec2<f32>, repetitions: f32) -> vec2<f32> {
    let angle = TAU / repetitions;
    let a = pmod(atan2(p.y, p.x) + angle * 0.5, angle) - angle * 0.5;
    return vec2<f32>(cos(a), sin(a)) * length(p);
}

fn overlayPalette(theme: f32, phase: f32) -> vec3<f32> {
    let cosmic = mix(vec3<f32>(0.35, 0.72, 1.0), vec3<f32>(0.82, 0.42, 1.0), phase);
    let golden = mix(vec3<f32>(1.0, 0.62, 0.22), vec3<f32>(1.0, 0.88, 0.42), phase);
    let ocean = mix(vec3<f32>(0.22, 0.92, 0.82), vec3<f32>(0.28, 0.58, 1.0), phase);
    var color = cosmic;
    color = mix(color, golden, smoothstep(0.35, 1.0, 1.0 - abs(theme - 1.0)));
    color = mix(color, ocean, smoothstep(0.35, 1.0, 1.0 - abs(theme - 2.0)));
    return color;
}

fn floatingShape(p: vec2<f32>, sides: f32, size: f32, rotation: f32) -> f32 {
    let r = length(p);
    let a = atan2(p.y, p.x) + rotation;
    let sector = TAU / sides;
    let sa = pmod(a + sector * 0.5, sector) - sector * 0.5;
    let d = abs(r - size * 0.5) + abs(sa) * r * 1.4;
    return smoothstep(size * 0.18, 0.0, d);
}

@fragment
fn overlay_fs(@builtin(position) position: vec4<f32>) -> @location(0) vec4<f32> {
    // WebGPU's framebuffer origin is top-left; flip to GL's bottom-left so the
    // rotations and floating-shape orbits match the former WebGL2 overlay.
    let fragCoord = vec2<f32>(position.x, u.resolution.y - position.y);
    let uv = (fragCoord - 0.5 * u.resolution) / max(u.resolution.y, 1.0);
    let breath = 0.5 + 0.5 * sin(u.breathPhase * TAU - PI * 0.5);
    let tt = 0.3 * u.time;
    let anim = curve(tt, 2.0);
    let phaseMix = clamp(u.chakraPhase / 3.0, 0.0, 1.0);
    let accent = overlayPalette(u.theme, phaseMix);
    let highQuality = u.qualityPreset >= 0.5;

    let uvr = uv * (1.15 + breath * 0.05);
    let lineWidth = mix(0.0022, 0.0015, step(0.5, u.qualityPreset));
    let blur = 0.001;
    let glow = 0.35;

    var rings = 0.0;
    rings = rings + hexRing(uvr, 0.62, lineWidth, blur);
    rings = rings + glow * hexRing(uvr, 0.62, lineWidth * 5.0, blur);

    let uv0 = rot(-PI * anim) * uvr;
    rings = rings + hexRing(uv0, 0.31, lineWidth, blur);
    rings = rings + glow * hexRing(uv0, 0.31, lineWidth * 5.0, blur);

    let uv1 = rot(PI * anim) * uvr;
    rings = rings + triRing(uv1, 0.34, lineWidth, blur);
    rings = rings + glow * triRing(uv1, 0.34, lineWidth * 5.0, blur);

    let uv2 = rot(PI - anim * PI) * uvr;
    rings = rings + triRing(uv2, 0.22, lineWidth, blur);

    if (highQuality) {
        var uv3 = rot(PI * 0.5) * uvr;
        uv3 = rot(PI * anim) * uv3;
        uv3 = moda(uv3, 6.0);
        uv3.x = uv3.x - mix(0.22, 0.48, abs(pmod(anim, 2.0) - 1.0));
        rings = rings + circleRing(uv3, 0.12, lineWidth, blur);
        rings = rings + glow * circleRing(uv3, 0.12, lineWidth * 5.0, blur);
    }

    let ringPulse = mix(0.0, 0.55, sin(tt * PI) * 0.5 + 0.5);
    var ringCol = mix(vec3<f32>(0.76, 0.85, 1.0), accent, 0.35) * rings * ringPulse;

    var shapes = vec3<f32>(0.0);
    var shapeAlpha = 0.0;
    let layerCount = select(3, 6, highQuality);

    for (var i: i32 = 0; i < layerCount; i = i + 1) {
        let fi = f32(i);
        let sides = mix(3.0, 8.0, fract(fi * 0.37));
        let anchor = vec2<f32>(
            sin(u.time * (0.11 + fi * 0.013) + fi * 1.9),
            cos(u.time * (0.09 + fi * 0.017) + fi * 2.4)
        ) * (0.55 + fi * 0.08);
        let local = rot(u.time * (0.04 + fi * 0.01) + anim * 0.35) * (uv - anchor);
        let shape = floatingShape(local, sides, 0.14 + fi * 0.015, fi * 0.8);
        let layerAlpha = shape * (0.08 + u.intensity * 0.06) * (1.0 - fi * 0.08);
        shapes = shapes + accent * layerAlpha;
        shapeAlpha = max(shapeAlpha, layerAlpha);
    }

    let orbit = circleRing(rot(u.time * 0.08 + anim) * uvr, 0.88 + breath * 0.04, lineWidth * 0.8, blur);
    ringCol = ringCol + accent * orbit * 0.22;

    let color = ringCol + shapes;
    var alpha = clamp(max(rings * 0.28, shapeAlpha) * (0.42 + u.intensity * 0.18), 0.0, 0.72);
    alpha = alpha * smoothstep(1.35, 0.15, length(uv));

    // The old overlay canvas stored (color * a, a * a) unpremultiplied and was
    // CSS \`mix-blend-mode: screen\`-ed over the opaque scene, which works out to
    // scene + color * a^3 * (1 - scene). The pipeline's one-minus-dst / one
    // blend applies the (1 - scene) term; this supplies color * a^3. The clamp
    // stands in for the unorm8 target clamping \`color\` before that blend.
    return vec4<f32>(saturate(color) * (alpha * alpha * alpha), 0.0);
}
`;

/** Full overlay module source: the contract's `struct Uniforms` + binding, then the overlay entry points. */
export const buildOverlayWgsl = (): string => `${buildUniformsWgsl()}${OVERLAY_BODY}`;

/**
 * Screen blend onto the opaque scene: `dst + src * (1 - dst)` for color, scene
 * alpha kept. Mirrors `applyOverlayBlend` in `overlay.ts`.
 */
export const OVERLAY_BLEND: GPUBlendState = {
  color: { srcFactor: 'one-minus-dst', dstFactor: 'one', operation: 'add' },
  alpha: { srcFactor: 'zero', dstFactor: 'one', operation: 'add' },
};
