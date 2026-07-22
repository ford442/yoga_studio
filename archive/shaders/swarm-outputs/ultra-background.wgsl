// =================================================================
// ULTRA BACKGROUND & SACRED GEOMETRY MODULE
// =================================================================
// Drop-in WGSL functions for yoga_studio's sacred-monk shader.
// Compatible with the Uniforms struct already defined in the main shader.
//
// Integration: copy-paste everything below into the fragment stage
// after the Uniforms binding.  No vertex shader or main() here.
// =================================================================

const PI: f32 = 3.14159265359;
const TAU: f32 = 6.28318530718;
const GOLDEN_ANGLE: f32 = 2.39996323;   // radians

// -----------------------------------------------------------------
// MATH HELPERS
// -----------------------------------------------------------------

/// Wrap `a` into the range [0, b).
fn pmod(a: f32, b: f32) -> f32 {
    return a - floor(a / b) * b;
}

/// 2-D rotation matrix.
fn rot2(a: f32) -> mat2x2<f32> {
    let c = cos(a);
    let s = sin(a);
    return mat2x2<f32>(c, -s, s, c);
}

/// Quintic smoothstep — C2 continuous, no derivative seams in glows.
fn smoother(e0: f32, e1: f32, x: f32) -> f32 {
    let t = clamp((x - e0) / (e1 - e0), 0.0, 1.0);
    return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

/// Hash a vec2 into a scalar in [0,1].
fn hash21(p: vec2<f32>) -> f32 {
    let n = fract(dot(p, vec2<f32>(127.1, 311.7)));
    return fract(n * 43758.5453123);
}

/// Bilinear-interpolated value noise built on hash21.
fn noise2(p: vec2<f32>) -> f32 {
    let i = floor(p);
    let f = fract(p);
    let u = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(hash21(i + vec2<f32>(0.0, 0.0)), hash21(i + vec2<f32>(1.0, 0.0)), u.x),
        mix(hash21(i + vec2<f32>(0.0, 1.0)), hash21(i + vec2<f32>(1.0, 1.0)), u.x),
        u.y
    );
}

/// 3-octave FBM with drifting time offsets.
fn fbm2(p: vec2<f32>, t: f32) -> f32 {
    var sum  = 0.0;
    var amp  = 0.5;
    var freq = 1.0;
    for (var i = 0; i < 3; i++) {
        let fi = f32(i);
        sum += amp * noise2(p * freq + t * 0.2 * fi);
        amp  *= 0.5;
        freq *= 2.3;
    }
    return sum;
}

/// Polar repetition (kaleidoscope).  Mirrors `p` into one sector of `n` folds.
fn kalei(p: vec2<f32>, n: f32) -> vec2<f32> {
    let angle = TAU / n;
    let a = atan2(p.y, p.x) + angle * 0.5;
    let r = length(p);
    let c = floor(a / angle);
    let new_a = a - c * angle - angle * 0.5;
    return vec2<f32>(cos(new_a), sin(new_a)) * r;
}

/// Signed-distance to a line segment.
fn sdSegment(p: vec2<f32>, a: vec2<f32>, b: vec2<f32>) -> f32 {
    let pa = p - a;
    let ba = b - a;
    let h  = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h);
}

/// Signed-distance to a circle (positive outside).
fn sdCircle(p: vec2<f32>, r: f32) -> f32 {
    return length(p) - r;
}

// -----------------------------------------------------------------
// BREATH HELPER
// -----------------------------------------------------------------

/// Derive a smooth 0..1 "expand" factor from the 4-phase breath cycle.
/// 0 = resting/closed, 1 = fully open/peak.
fn deriveBreathExpand() -> f32 {
    let isInhale = select(0.0, 1.0, u.chakraPhase < 0.5);
    let isHold1  = select(0.0, 1.0, u.chakraPhase >= 0.5 && u.chakraPhase < 1.5);
    let isExhale = select(0.0, 1.0, u.chakraPhase >= 1.5 && u.chakraPhase < 2.5);
    let isHold2  = select(0.0, 1.0, u.chakraPhase >= 2.5);

    var expand = isInhale * u.phaseProgress
               + isHold1  * 1.0
               + isExhale * (1.0 - u.phaseProgress)
               + isHold2  * 0.0;
    expand = clamp(expand, 0.0, 1.0);
    return expand * expand * (3.0 - 2.0 * expand);
}

// -----------------------------------------------------------------
// BACKGROUND ATMOSPHERE
// -----------------------------------------------------------------

/// Three-layer twinkling starfield with phase-warmth.
fn twinkleStars(uv: vec2<f32>, t: f32, breath: f32, expand: f32) -> vec3<f32> {
    var col = vec3<f32>(0.0);

    // Star colors shift slightly warmer during inhale for cohesion
    let starWarmth = 1.0 + expand * 0.15;

    // Layer 1 — distant, sparse, slow twinkle
    let s1  = hash21(floor(uv * 42.0) + 100.0);
    let tw1 = sin(t * 0.7 + s1 * TAU) * 0.5 + 0.5;
    col += vec3<f32>(0.60, 0.62, 0.88) * starWarmth
         * smoothstep(0.982, 1.0, s1) * tw1 * 0.45;

    // Layer 2 — medium density, medium twinkle
    let s2  = hash21(floor(uv * 78.0) + 200.0);
    let tw2 = sin(t * 1.2 + s2 * TAU) * 0.5 + 0.5;
    col += vec3<f32>(0.68, 0.66, 0.92) * starWarmth
         * smoothstep(0.990, 1.0, s2) * tw2 * 0.32;

    // Layer 3 — close, very sparse, fast twinkle
    let s3  = hash21(floor(uv * 130.0) + 300.0);
    let tw3 = sin(t * 1.9 + s3 * TAU) * 0.5 + 0.5;
    col += vec3<f32>(0.78, 0.72, 0.95) * starWarmth
         * smoothstep(0.994, 1.0, s3) * tw3 * 0.20;

    // Gentle breath-reactive brightening
    col *= (0.8 + expand * 0.22);
    return col;
}

/// Nebula dust clouds using 3-octave FBM.
fn nebulaDust(uv: vec2<f32>, t: f32, breath: f32, expand: f32) -> vec3<f32> {
    let r = length(uv);
    var col = vec3<f32>(0.0);

    let n1 = fbm2(uv * 0.7 + vec2<f32>(t * 0.015,  t * 0.012), t * 0.08);
    let n2 = fbm2(uv * 1.0 + vec2<f32>(-t * 0.012, t * 0.008), t * 0.06);
    let n3 = fbm2(uv * 1.6 + vec2<f32>( t * 0.010, -t * 0.015), t * 0.05);

    // Deep violet inner nebula
    col += vec3<f32>(0.012, 0.006, 0.024) * n1 * exp(-r * r * 1.8)
         * (0.6 + expand * 0.35);
    // Warm rose-gold mid nebula
    col += vec3<f32>(0.014, 0.008, 0.016) * n2 * exp(-r * r * 2.5)
         * (0.5 + expand * 0.25);
    // Cool indigo outer dust
    col += vec3<f32>(0.005, 0.008, 0.020) * n3 * exp(-r * r * 3.5) * 0.35;

    return col;
}

/// Single floating sacred-geometry fragment.
fn geometryFragment(uv: vec2<f32>, n: f32, size: f32, rot: f32, breath: f32) -> vec3<f32> {
    let r = length(uv);
    let a = atan2(uv.y, uv.x) + rot;
    let sector = TAU / n;
    let sa = pmod(a, sector) - sector * 0.5;

    // Soft petal-like fragment shape
    let d = abs(r - size * 0.5) + abs(sa) * r * 1.8;
    let shape = smoothstep(size * 0.22, 0.0, d);
    let glow  = exp(-d * d * 60.0) * 0.4;

    // Soft radial fade
    let fade = smoothstep(0.0, 0.02, r)
             * (1.0 - smoothstep(size * 0.85, size * 1.3, r));

    return (shape * 0.12 + glow) * fade
         * vec3<f32>(0.65, 0.55, 0.85) * (0.42 + breath * 0.08);
}

/// Five distant floating geometry fragments.
fn floatingGeometry(uv: vec2<f32>, t: f32, breath: f32, expand: f32) -> vec3<f32> {
    var col = vec3<f32>(0.0);

    let p1 = rot2(t * 0.035) * (uv - vec2<f32>(-1.15, 0.65));
    col += geometryFragment(p1, 6.0, 0.16, 0.0, breath) * 0.9;

    let p2 = rot2(-t * 0.025) * (uv - vec2<f32>(1.05, -0.55));
    col += geometryFragment(p2, 8.0, 0.20, 1.2, breath) * 0.7;

    let p3 = rot2(t * 0.018) * (uv - vec2<f32>(0.85, 0.85));
    col += geometryFragment(p3, 5.0, 0.12, 2.5, breath) * 0.5;

    let p4 = rot2(-t * 0.022) * (uv - vec2<f32>(-0.75, -0.85));
    col += geometryFragment(p4, 7.0, 0.14, 0.8, breath) * 0.6;

    let p5 = rot2(t * 0.015) * (uv - vec2<f32>(1.4, 0.2));
    col += geometryFragment(p5, 6.0, 0.10, 3.0, breath) * 0.35;

    return col;
}

/// Wide spiritual rays + radial bloom + subtle cross.
fn emanationRays(uv: vec2<f32>, t: f32, breath: f32, expand: f32) -> vec3<f32> {
    var col = vec3<f32>(0.0);
    let a = atan2(uv.y, uv.x);
    let r = length(uv);

    // 6 wide, soft spiritual rays
    for (var i = 0; i < 6; i++) {
        let fi  = f32(i);
        let ray = pow(max(0.0, cos(a - t * 0.025 + fi * PI / 3.0)), 10.0);
        let fade = exp(-r * (1.6 + fi * 0.25));
        col += ray * fade * vec3<f32>(0.42, 0.32, 0.68)
             * (0.10 + expand * 0.12);
    }

    // Very soft radial bloom behind the lotus
    let bloom = exp(-r * r * 3.5) * (0.04 + expand * 0.06);
    col += bloom * vec3<f32>(0.48, 0.38, 0.78);

    // Subtle cross-shaped emanation
    let cross = pow(abs(cos(a * 2.0)), 16.0) + pow(abs(sin(a * 2.0)), 16.0);
    col += cross * exp(-r * r * 2.0) * 0.022
         * vec3<f32>(0.62, 0.52, 0.88);

    return col;
}

/// Deep cosmic background combining nebula, stars, geometry fragments,
/// soft rays, and a breath-reactive center glow.
fn backgroundAtmosphere(uv: vec2<f32>, t: f32, breath: f32, expand: f32) -> vec3<f32> {
    let r = length(uv);

    // Deep sacred space gradient
    var col = vec3<f32>(0.003, 0.0015, 0.010);

    // Nebula dust clouds
    col += nebulaDust(uv, t, breath, expand);

    // Twinkling starfield
    col += twinkleStars(uv, t, breath, expand);

    // Floating sacred geometry fragments (very faint)
    col += floatingGeometry(uv, t, breath, expand);

    // Soft emanation rays from behind the lotus
    col += emanationRays(uv, t, breath, expand);

    // Breath-reactive ambient center glow
    col += vec3<f32>(0.006, 0.003, 0.016)
         * exp(-r * r * 2.5) * (0.35 + expand * 0.30);

    return col;
}

// -----------------------------------------------------------------
// VOLUMETRIC LIGHT SHAFTS
// -----------------------------------------------------------------

/// 3 sharp divine beams with high pow() exponent, phase-brightened.
fn lightShafts(uv: vec2<f32>, t: f32, breath: f32, expand: f32) -> vec3<f32> {
    var col = vec3<f32>(0.0);
    let a = atan2(uv.y, uv.x);
    let r = length(uv);

    for (var i = 0; i < 3; i++) {
        let fi   = f32(i);
        let beam = pow(max(0.0, cos(a - t * 0.06 + fi * TAU / 3.0)), 20.0);
        let fade = exp(-r * (2.4 + fi * 0.4));
        col += beam * fade * vec3<f32>(0.52, 0.40, 0.88)
             * (0.18 + expand * 0.30);
    }
    return col * 0.38;
}

// -----------------------------------------------------------------
// SACRED GEOMETRY RINGS
// -----------------------------------------------------------------

/// Hex / tri / circle rings plus optional Yantra or Flower mandala styles.
fn sacredGeometryRings(uv: vec2<f32>, t: f32, breath: f32, expand: f32) -> vec3<f32> {
    var col = vec3<f32>(0.0);

    // ---- Phase color palette ------------------------------------
    var phaseColor: vec3<f32>;
    if (u.chakraPhase < 0.5) {
        phaseColor = vec3<f32>(0.2, 0.9, 1.0);   // inhale
    } else if (u.chakraPhase < 1.5) {
        phaseColor = vec3<f32>(1.0, 0.9, 0.2);   // hold1
    } else if (u.chakraPhase < 2.5) {
        phaseColor = vec3<f32>(1.0, 0.4, 0.2);   // exhale
    } else {
        phaseColor = vec3<f32>(0.2, 0.9, 0.6);   // hold2
    }

    // ---- Mandala style branching --------------------------------
    let isYantra = u.mandalaStyle > 0.5 && u.mandalaStyle < 1.5;
    let isFlower = u.mandalaStyle > 1.5;
    let isLotus  = !(isYantra || isFlower);

    // Breathing scale with intensity pulse
    let breathe = expand * 0.12 * (1.0 + 0.05 * u.intensity * sin(t * 3.0));

    if (isLotus) {
        // ---- LOTUS: hex + tri + circle --------------------------

        // Outer hexagon ring (kalei with 6 repetitions)
        let hexUV = kalei(uv, 6.0);
        let hexRot = t * 0.05 + u.phaseProgress * 0.1;
        let hexR   = rot2(hexRot) * hexUV;
        let hexD   = abs(length(hexR) - (0.75 + breathe)) - 0.015;
        let hexGlow = exp(-abs(hexD) * 40.0);
        col += hexGlow * phaseColor * 0.5;

        // Triangle ring (kalei with 3 repetitions), opposite rotation
        let triUV = kalei(uv, 3.0);
        let triRot = -t * 0.08 - u.phaseProgress * 0.15;
        let triR   = rot2(triRot) * triUV;
        let triD   = abs(length(triR) - (0.55 + breathe * 0.8)) - 0.012;
        let triGlow = exp(-abs(triD) * 45.0);
        col += triGlow * vec3<f32>(1.0, 0.85, 0.25) * 0.4;

        // Inner breathing circle
        let circleD = abs(length(uv) - (0.35 + breathe * 0.5)) - 0.02;
        let circleGlow = exp(-abs(circleD) * 30.0);
        col += circleGlow * vec3<f32>(1.0, 0.95, 0.9) * 0.6;

    } else if (isYantra) {
        // ---- YANTRA: Sri-Yantra-like nested triangles ------------

        // 9 interlocking triangles approximated with kalei(3.0) layers
        for (var i = 0; i < 5; i++) {
            let fi = f32(i);
            let layerScale = 0.18 + fi * 0.11;
            let triDir = select(-1.0, 1.0, (i % 2) == 0);
            let triRot = triDir * (t * 0.03 + fi * 0.25);
            let kUV = kalei(uv, 3.0);
            let rUV = rot2(triRot) * kUV;
            let triD = abs(length(rUV) - layerScale * (1.0 + breathe)) - 0.008;
            let glow = exp(-abs(triD) * 55.0);
            let layerColor = mix(phaseColor, vec3<f32>(1.0, 0.85, 0.4), fi * 0.15);
            col += glow * layerColor * (0.32 - fi * 0.045);
        }

        // Concentric circles with Sanskrit-seed-like dot patterns
        for (var i = 0; i < 3; i++) {
            let fi = f32(i);
            let cR = 0.12 + fi * 0.16;
            let cD = abs(sdCircle(uv, cR * (1.0 + breathe * 0.3))) - 0.005;
            let cGlow = exp(-abs(cD) * 60.0);
            col += cGlow * vec3<f32>(1.0, 0.9, 0.7) * 0.25;

            // Seed dots arranged on each circle
            let dotCount = 6u + u32(fi) * 3u;
            for (var d = 0u; d < dotCount; d = d + 1u) {
                let fd = f32(d);
                let a = fd * TAU / f32(dotCount) + t * 0.1 * (1.0 + fi);
                let dp = vec2<f32>(cos(a), sin(a)) * cR * (1.0 + breathe * 0.3);
                let dDist = length(uv - dp) - 0.012;
                let dGlow = exp(-abs(dDist) * 80.0);
                col += dGlow * vec3<f32>(1.0, 0.95, 0.6) * 0.15;
            }
        }

    } else {
        // ---- FLOWER: 12-petal rosette + Fibonacci spiral hints ---

        // 12-petal rosette using kalei(12.0)
        let flowerUV = kalei(uv, 12.0);
        let pRot = rot2(t * 0.04) * flowerUV;
        let petalCenter = vec2<f32>(0.30 * (1.0 + breathe), 0.0);
        let petalD = length(pRot - petalCenter) - 0.09;
        let petalGlow = exp(-abs(petalD) * 40.0);
        col += petalGlow * phaseColor * 0.45;

        // Inner breathing circle (flower center)
        let centerD = abs(length(uv) - 0.10 * (1.0 + breathe * 0.5)) - 0.015;
        let centerGlow = exp(-abs(centerD) * 50.0);
        col += centerGlow * vec3<f32>(1.0, 0.95, 0.8) * 0.55;

        // Fibonacci spiral hints — golden-angle placements
        for (var i = 0; i < 21; i++) {
            let fi = f32(i);
            let r = 0.04 + sqrt(fi) * 0.055;
            let a = fi * GOLDEN_ANGLE + t * 0.15;
            let fp = vec2<f32>(cos(a), sin(a)) * r * (1.0 + breathe * 0.2);
            let fd = length(uv - fp) - 0.007;
            let fGlow = exp(-abs(fd) * 90.0);
            let fCol = 0.6 + 0.4 * cos(vec3<f32>(0.0, 2.0, 4.0) + fi * 0.3);
            col += fGlow * fCol * 0.18;
        }
    }

    return col;
}

// -----------------------------------------------------------------
// PRANA PARTICLES
// -----------------------------------------------------------------

/// 32 circular-flow particles with phase-driven direction and rainbow hues.
fn pranaParticles(uv: vec2<f32>, t: f32, breath: f32, expand: f32) -> vec3<f32> {
    var col = vec3<f32>(0.0);

    // Flow direction: outward on inhale/hold1, inward on exhale/hold2
    let outward = u.chakraPhase < 1.5;
    let flowSpeed = 0.25 + 0.15 * u.intensity;

    for (var i: f32 = 0.0; i < 32.0; i += 1.0) {
        let seed = i * 13.37;
        let a = i * TAU / 32.0 + t * flowSpeed + hash21(vec2<f32>(seed, 0.0));
        let r = 0.15 + fract(seed + t * 0.3) * 0.6;

        // Flow with breath phase
        let flow = select(1.0 - u.phaseProgress, u.phaseProgress, outward);
        let pulseRadius = 1.0 + 0.1 * u.intensity * sin(t * 3.0 + i);
        let dir = select(-1.0, 1.0, outward);
        let pos = vec2<f32>(cos(a), sin(a))
                * (r + flow * 0.1 * dir) * pulseRadius;

        let d = length(uv - pos);
        let intensity = exp(-d * 45.0);

        // Phase-shifted rainbow colors
        let hue = fract(i * 0.1 + t * 0.15 + u.chakraPhase * 0.1);
        let pcol = 0.6 + 0.4 * cos(vec3<f32>(0.0, 2.0, 4.0) + hue * 6.0);

        col += intensity * pcol * 1.2 * (0.8 + 0.4 * u.intensity);
    }

    return col;
}
