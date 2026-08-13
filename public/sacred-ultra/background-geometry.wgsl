// ============================================================================
// MODULE 1 — BACKGROUND ATMOSPHERE (Agent: Background & Geometry Specialist)
// ============================================================================

fn twinkleStars(uv: vec2<f32>, t: f32, breath: f32, expand: f32) -> vec3<f32> {
    var col = vec3<f32>(0.0);
    let starWarmth = 1.0 + expand * 0.15;

    let s1 = hash21(floor(uv * 42.0) + 100.0);
    let tw1 = sin(t * 0.7 + s1 * TAU) * 0.5 + 0.5;
    col += vec3<f32>(0.60, 0.62, 0.88) * starWarmth
         * smoothstep(0.982, 1.0, s1) * tw1 * 0.45;

    let s2 = hash21(floor(uv * 78.0) + 200.0);
    let tw2 = sin(t * 1.2 + s2 * TAU) * 0.5 + 0.5;
    col += vec3<f32>(0.68, 0.66, 0.92) * starWarmth
         * smoothstep(0.990, 1.0, s2) * tw2 * 0.32;

    let s3 = hash21(floor(uv * 130.0) + 300.0);
    let tw3 = sin(t * 1.9 + s3 * TAU) * 0.5 + 0.5;
    col += vec3<f32>(0.78, 0.72, 0.95) * starWarmth
         * smoothstep(0.994, 1.0, s3) * tw3 * 0.20;

    col *= (0.8 + expand * 0.22);
    return col;
}

fn nebulaDust(uv: vec2<f32>, t: f32, breath: f32, expand: f32) -> vec3<f32> {
    let r = length(uv);
    var col = vec3<f32>(0.0);

    let n1 = fbm2(uv * 0.7 + vec2<f32>(t * 0.015,  t * 0.012), t * 0.08);
    let n2 = fbm2(uv * 1.0 + vec2<f32>(-t * 0.012, t * 0.008), t * 0.06);
    let n3 = fbm2(uv * 1.6 + vec2<f32>( t * 0.010, -t * 0.015), t * 0.05);

    col += vec3<f32>(0.012, 0.006, 0.024) * n1 * exp(-r * r * 1.8)
         * (0.6 + expand * 0.35);
    col += vec3<f32>(0.014, 0.008, 0.016) * n2 * exp(-r * r * 2.5)
         * (0.5 + expand * 0.25);
    col += vec3<f32>(0.005, 0.008, 0.020) * n3 * exp(-r * r * 3.5) * 0.35;

    return col;
}

fn geometryFragment(uv: vec2<f32>, n: f32, size: f32, rot: f32, breath: f32) -> vec3<f32> {
    let r = length(uv);
    let a = atan2(uv.y, uv.x) + rot;
    let sector = TAU / n;
    let sa = pmod(a, sector) - sector * 0.5;

    let d = abs(r - size * 0.5) + abs(sa) * r * 1.8;
    let shape = smoothstep(size * 0.22, 0.0, d);
    let glow = exp(-d * d * 60.0) * 0.4;
    let fade = smoothstep(0.0, 0.02, r)
             * (1.0 - smoothstep(size * 0.85, size * 1.3, r));

    return (shape * 0.12 + glow) * fade
         * vec3<f32>(0.65, 0.55, 0.85) * (0.42 + breath * 0.08);
}

fn floatingGeometry(uv: vec2<f32>, t: f32, breath: f32, expand: f32) -> vec3<f32> {
    var col = vec3<f32>(0.0);

    let p1 = rot2(t * 0.035) * (uv - vec2<f32>(-1.15, 0.65));
    col += geometryFragment(p1, 6.0, 0.16, 0.0, breath) * 0.9;

    let p2 = rot2(-t * 0.025) * (uv - vec2<f32>(1.05, -0.55));
    col += geometryFragment(p2, 8.0, 0.20, 1.2, breath) * 0.7;

    let p3 = rot2(t * 0.018) * (uv - vec2<f32>(0.85, 0.85));
    col += geometryFragment(p3, 5.0, 0.12, 2.5, breath) * 0.5;

    if (isHighQuality()) {
        let p4 = rot2(-t * 0.022) * (uv - vec2<f32>(-0.75, -0.85));
        col += geometryFragment(p4, 7.0, 0.14, 0.8, breath) * 0.6;

        let p5 = rot2(t * 0.015) * (uv - vec2<f32>(1.4, 0.2));
        col += geometryFragment(p5, 6.0, 0.10, 3.0, breath) * 0.35;
    }

    return col;
}

fn emanationRays(uv: vec2<f32>, t: f32, breath: f32, expand: f32) -> vec3<f32> {
    var col = vec3<f32>(0.0);
    let a = atan2(uv.y, uv.x);
    let r = length(uv);

    for (var i = 0; i < 6; i++) {
        let fi = f32(i);
        let ray = pow(max(0.0, cos(a - t * 0.025 + fi * PI / 3.0)), 10.0);
        let fade = exp(-r * (1.6 + fi * 0.25));
        col += ray * fade * vec3<f32>(0.42, 0.32, 0.68)
             * (0.10 + expand * 0.12);
    }

    let bloom = exp(-r * r * 3.5) * (0.04 + expand * 0.06);
    col += bloom * vec3<f32>(0.48, 0.38, 0.78);

    let cross = pow(abs(cos(a * 2.0)), 16.0) + pow(abs(sin(a * 2.0)), 16.0);
    col += cross * exp(-r * r * 2.0) * 0.022
         * vec3<f32>(0.62, 0.52, 0.88);

    return col;
}

fn backgroundAtmosphere(uv: vec2<f32>, t: f32, breath: f32, expand: f32) -> vec3<f32> {
    let r = length(uv);
    var col = vec3<f32>(0.003, 0.0015, 0.010);
    col += shadertoyStarField(uv, t, expand);
    col += nebulaDust(uv, t, breath, expand);
    col += twinkleStars(uv, t, breath, expand);
    col += floatingGeometry(uv, t, breath, expand);
    col += emanationRays(uv, t, breath, expand);
    col += vec3<f32>(0.006, 0.003, 0.016)
         * exp(-r * r * 2.5) * (0.35 + expand * 0.30);
    return col;
}

fn lightShafts(uv: vec2<f32>, t: f32, breath: f32, expand: f32) -> vec3<f32> {
    var col = vec3<f32>(0.0);
    let a = atan2(uv.y, uv.x);
    let r = length(uv);

    for (var i = 0; i < 3; i++) {
        let fi = f32(i);
        let beam = pow(max(0.0, cos(a - t * 0.06 + fi * TAU / 3.0)), 20.0);
        let fade = exp(-r * (2.4 + fi * 0.4));
        col += beam * fade * vec3<f32>(0.52, 0.40, 0.88)
             * (0.18 + expand * 0.30);
    }
    return col * 0.38;
}

fn godRays(uv: vec2<f32>, t: f32, intensity: f32, expand: f32) -> vec3<f32> {
    let r = length(uv);
    let dir = normalize(uv + vec2<f32>(1e-4, 1e-4));
    let steps = select(6, 10, isHighQuality());
    var acc = 0.0;

    var phaseScale = 0.0;
    if (u.chakraPhase < 0.5) {
        phaseScale = u.phaseProgress;
    } else if (u.chakraPhase < 1.5) {
        phaseScale = 1.0;
    } else if (u.chakraPhase < 2.5) {
        phaseScale = 1.0 - u.phaseProgress * 0.8;
    } else {
        phaseScale = 0.0;
    }

    for (var i = 0; i < steps; i++) {
        let s = (f32(i) + 0.5) / f32(steps);
        let sp = uv - dir * s * 0.9;
        let sa = atan2(sp.y, sp.x);
        let n = fbm2(sp * 3.0 + vec2<f32>(0.0, t * 0.08), t * 0.12);
        let shafts = pow(max(0.0, cos(sa * 6.0 - t * 0.22 + n * 1.7)), 4.0);
        acc += shafts * (1.0 - s) * (0.6 + 0.4 * n);
    }

    let falloff = exp(-r * 1.45) * (0.45 + expand * 0.55);
    let strength = intensity * phaseScale;
    let rayCol = vec3<f32>(0.55, 0.45, 0.85);
    return rayCol * (acc / f32(steps)) * falloff * strength * 1.35;
}

// ============================================================================
// MODULE 2 — SACRED GEOMETRY RINGS & PRANA PARTICLES
// ============================================================================

fn sacredGeometryRings(uv: vec2<f32>, t: f32, breath: f32, expand: f32) -> vec3<f32> {
    var col = vec3<f32>(0.0);
    let phaseColor = focusedBreathColor();

    let isYantra = u.mandalaStyle > 0.5 && u.mandalaStyle < 1.5;
    let isFlower = u.mandalaStyle > 1.5;
    let isLotus = !(isYantra || isFlower);

    let density = clamp(u.geometryDensity + u.intensity * 0.25, 0.2, 3.0);
    let breathe = expand * 0.12 * (1.0 + 0.05 * u.intensity * sin(t * 3.0));

    if (isLotus) {
        let tt = 0.3 * t;
        let anim = shadertoyCurve(tt, 2.0);

        let hexN = select(4.0, 6.0 + floor(density * 4.0), isHighQuality());
        let hexUV = kalei(uv, hexN);
        let hexRot = -PI * anim + u.phaseProgress * 0.1;
        let hexR = rot2(hexRot) * hexUV;
        let hexD = abs(length(hexR) - (0.75 + breathe)) - 0.015;
        let hexGlow = exp(-abs(hexD) * 40.0);
        col += hexGlow * phaseColor * 0.5;

        let triN = select(3.0, 3.0 + floor(density * 2.0), isHighQuality());
        let triUV = kalei(uv, triN);
        let triRot = PI * anim - u.phaseProgress * 0.15;
        let triR = rot2(triRot) * triUV;
        let triD = abs(length(triR) - (0.55 + breathe * 0.8)) - 0.012;
        let triGlow = exp(-abs(triD) * 45.0);
        col += triGlow * vec3<f32>(1.0, 0.85, 0.25) * 0.4;

        let ringCount = i32(clamp(select(2.0, 2.0 + density * 3.0, isHighQuality()), 2.0, 7.0));
        for (var i = 0; i < ringCount; i++) {
            let fi = f32(i);
            let rad = 0.20 + fi * 0.08 + breathe * 0.3;
            let circleD = abs(length(uv) - rad) - 0.012;
            let circleGlow = exp(-abs(circleD) * 35.0);
            col += circleGlow * vec3<f32>(1.0, 0.95, 0.9) * (0.4 - fi * 0.04);
        }

        col += dotLattice(uv, t, density) * 0.35;

    } else if (isYantra) {
        let layerCount = i32(clamp(select(4.0 + density * 3.0, 5.0 + density * 5.0, isHighQuality()), 4.0, 12.0));
        for (var i = 0; i < layerCount; i++) {
            let fi = f32(i);
            let layerScale = 0.12 + fi * 0.055 / (1.0 + density * 0.1);
            let triDir = select(-1.0, 1.0, (i % 2) == 0);
            let triRot = triDir * (t * 0.03 * (1.0 + u.interference * 0.4) + fi * 0.25);
            let kUV = kalei(uv, 3.0);
            let rUV = rot2(triRot) * kUV;
            let triD = abs(length(rUV) - layerScale * (1.0 + breathe)) - 0.006;
            let glow = exp(-abs(triD) * 55.0);
            let layerColor = mix(phaseColor, vec3<f32>(1.0, 0.85, 0.4), fi * 0.12);
            col += glow * layerColor * (0.32 - fi * 0.025);
        }

        let circleCount = i32(clamp(select(2.0 + density * 2.0, 3.0 + density * 3.0, isHighQuality()), 2.0, 8.0));
        for (var i = 0; i < circleCount; i++) {
            let fi = f32(i);
            let cR = 0.08 + fi * 0.075;
            let cD = abs(sdCircle(uv, cR * (1.0 + breathe * 0.3))) - 0.004;
            let cGlow = exp(-abs(cD) * 60.0);
            col += cGlow * vec3<f32>(1.0, 0.9, 0.7) * 0.22;

            let dotCount = select(4u + u32(fi) * 2u + u32(density * 2.0), 6u + u32(fi) * 3u + u32(density * 4.0), isHighQuality());
            for (var d = 0u; d < 24u; d = d + 1u) {
                if (d >= dotCount) { break; }
                let fd = f32(d);
                let a = fd * TAU / f32(dotCount) + t * 0.1 * (1.0 + fi) * (1.0 + u.interference);
                let dp = vec2<f32>(cos(a), sin(a)) * cR * (1.0 + breathe * 0.3);
                let dDist = length(uv - dp) - 0.010;
                let dGlow = exp(-abs(dDist) * 90.0);
                col += dGlow * vec3<f32>(1.0, 0.95, 0.6) * 0.12;
            }
        }

        let tipCount = i32(clamp(select(2.0 + density * 2.0, 3.0 + density * 3.0, isHighQuality()), 2.0, 8.0));
        for (var i = 0; i < tipCount; i++) {
            let fi = f32(i);
            let tipUV = kalei(uv, 3.0);
            let tipRot = t * 0.05 * (1.0 + u.interference) + fi * 0.4;
            let tipR = rot2(tipRot) * tipUV;
            let tipD = abs(length(tipR) - (0.06 + fi * 0.025)) - 0.003;
            col += exp(-abs(tipD) * 100.0) * phaseColor * (0.15 - fi * 0.015);
        }

    } else {
        let flowerN = select(8.0 + floor(density * 4.0), 12.0 + floor(density * 8.0), isHighQuality());
        let flowerUV = kalei(uv, flowerN);
        let pRot = rot2(t * 0.04 * (1.0 + u.interference * 0.35)) * flowerUV;
        let petalCenter = vec2<f32>(0.30 * (1.0 + breathe), 0.0);
        let petalD = length(pRot - petalCenter) - 0.09;
        let petalGlow = exp(-abs(petalD) * 40.0);
        col += petalGlow * phaseColor * 0.45;

        let centerD = abs(length(uv) - 0.10 * (1.0 + breathe * 0.5)) - 0.015;
        let centerGlow = exp(-abs(centerD) * 50.0);
        col += centerGlow * vec3<f32>(1.0, 0.95, 0.8) * 0.55;

        let seedCount = i32(clamp(select(12.0 + density * 14.0, 21.0 + density * 30.0, isHighQuality()), 12.0, 60.0));
        for (var i = 0; i < seedCount; i++) {
            let fi = f32(i);
            let r = 0.04 + sqrt(fi) * 0.055 / (1.0 + density * 0.05);
            let a = fi * GOLDEN_ANGLE + t * 0.15 * (1.0 + u.interference * 0.5);
            let fp = vec2<f32>(cos(a), sin(a)) * r * (1.0 + breathe * 0.2);
            let fd = length(uv - fp) - 0.007;
            let fGlow = exp(-abs(fd) * 90.0);
            let fCol = 0.6 + 0.4 * cos(vec3<f32>(0.0, 2.0, 4.0) + fi * 0.3);
            col += fGlow * fCol * 0.18;
        }

        col += vesicaPiscisChain(uv, vec2<f32>(0.0), 12.0, 0.22, t, density) * 0.25;
    }

    return col;
}

fn layeredSacredGeometry(uv: vec2<f32>, t: f32, breath: f32, expand: f32) -> vec3<f32> {
    var col = vec3<f32>(0.0);
    let inter = u.interference;
    if (isHighQuality()) {
        col += shadertoySacredRings(uv, t, expand) * 0.70;
        col += sacredGeometryRings(uv / 0.30, t * (1.30 + inter * 0.4) + 1.7, breath, expand) * 0.22;
    } else {
        col += shadertoySacredRings(uv, t, expand) * 0.25;
    }
    col += sacredGeometryRings(uv / 0.60, t * (0.90 - inter * 0.35) + 0.8, breath, expand) * select(0.25, 0.45, isHighQuality());
    col += sacredGeometryRings(uv,        t * (1.0 + inter * 0.15),       breath, expand) * 1.00;
    return col;
}

fn pranaParticles(uv: vec2<f32>, t: f32, breath: f32, expand: f32) -> vec3<f32> {
    var col = vec3<f32>(0.0);
    let outward = u.chakraPhase < 1.5;
    let flowSpeed = 0.25 + 0.15 * u.intensity;
    let particleCount = select(16.0, 32.0, isHighQuality());

    for (var i: f32 = 0.0; i < particleCount; i += 1.0) {
        let seed = i * 13.37;
        let a = i * TAU / particleCount + t * flowSpeed + hash21(vec2<f32>(seed, 0.0));
        let r = 0.15 + fract(seed + t * 0.3) * 0.6;

        let flow = select(1.0 - u.phaseProgress, u.phaseProgress, outward);
        let pulseRadius = 1.0 + 0.1 * u.intensity * sin(t * 3.0 + i);
        let dir = select(-1.0, 1.0, outward);
        let pos = vec2<f32>(cos(a), sin(a))
                * (r + flow * 0.1 * dir) * pulseRadius;

        let d = length(uv - pos);
        let intensity = exp(-d * 45.0);
        let hue = fract(i * 0.1 + t * 0.15 + u.chakraPhase * 0.1);
        let pcol = 0.6 + 0.4 * cos(vec3<f32>(0.0, 2.0, 4.0) + hue * 6.0);

        col += intensity * pcol * 1.2 * (0.8 + 0.4 * u.intensity);
    }

    return col;
}

