// ============================================================================
// MODULE 4 — LOTUS, SACRED SYMBOL & ENERGY RIBBONS (Agent: Lotus & Post Specialist)
// ============================================================================

fn lotusLayer(
    uv: vec2<f32>, t: f32,
    n: f32, len: f32, wid: f32, base: f32, off: f32,
    expand: f32, color: vec3<f32>
) -> vec3<f32> {
    let angle = atan2(uv.y, uv.x);
    let r = length(uv);
    let sector = TAU / n;
    let petalId = floor((angle + off) / sector);
    let a = pmod(angle + off, sector) - sector * 0.5;

    let hv = hash22(vec2<f32>(petalId, n * 0.37));
    let lenVar = len * (0.93 + hv.x * 0.14);
    let widVar = wid * (0.88 + hv.y * 0.24);
    let hueJit = (hv.x - 0.5) * 0.10;

    let tip = lenVar * (1.0 + expand * 0.22);
    let baseR = base * (1.0 - expand * 0.08);

    var outc = vec3<f32>(0.0);
    var depth = 0.0;
    var facing = 0.0;
    var mask = 0.0;
    var tNorm = 0.0;
    var edgeAbs = 0.0;
    var w = 0.0;

    let bodyCol = color * (1.0 + vec3<f32>(hueJit, 0.0, -hueJit));
    let lightCol = mix(color, vec3<f32>(1.0, 0.94, 0.88), 0.45);

    if (u.mandalaStyle < 0.5) {
        let droop = max(0.0, r - baseR) * 0.12 * (min(n, 24.0) / 12.0) * (1.0 - expand * 0.35);
        let aD = a + droop;
        tNorm = clamp((r - baseR) / max(tip - baseR, 1e-3), 0.0, 1.0);
        let profile = pow(sin(tNorm * PI), 0.65);
        w = widVar * (0.10 + 0.90 * profile) * (1.0 + expand * 0.18);
        edgeAbs = abs(aD);

        let radial = smoother(baseR - 0.015, baseR + 0.03, r) *
                     smoother(tip, tip * 0.72, r);
        let angular = smoother(w, w * 0.05, edgeAbs);
        mask = radial * angular;

        let midrib = smoother(w * 0.55, 0.0, edgeAbs);
        let subsurface = mask * (0.35 + 0.65 * midrib) * (1.0 - tNorm * 0.45);
        let central = smoother(w * 0.10, 0.0, edgeAbs) * radial;
        let lateralWave = sin(edgeAbs * 26.0 - tNorm * 7.0 + petalId) * 0.5 + 0.5;
        let lateral = lateralWave * smoother(w * 0.7, w * 0.1, edgeAbs) * mask *
                      smoother(baseR + 0.04, baseR + 0.14, r);
        let veins = central * 0.5 + lateral * 0.18;
        let rim = (smoother(w, w * 0.78, edgeAbs) - smoother(w * 0.78, w * 0.5, edgeAbs)) *
                  radial * (0.6 + 0.4 * tNorm);
        let tipGlow = smoother(tip * 0.78, tip, r) * angular * 0.8;

        let nrm = normalize(uv + vec2<f32>(1e-5));
        facing = 0.62 + 0.38 * dot(nrm, vec2<f32>(0.22, 1.0));
        depth = smoother(0.0, 0.16, r) * (1.0 - smoother(tip * 0.78, tip * 1.08, r));

        outc += subsurface * 0.34 * bodyCol;
        outc += veins * bodyCol * vec3<f32>(1.1, 1.05, 1.0);
        outc += rim * 0.55 * lightCol;
        outc += tipGlow * 0.40 * lightCol;

    } else if (u.mandalaStyle > 0.5 && u.mandalaStyle < 1.5) {
        tNorm = clamp((r - baseR) / max(tip - baseR, 1e-3), 0.0, 1.0);
        let geoProfile = 1.0 - abs(tNorm * 2.0 - 1.0);
        w = widVar * (0.15 + 0.85 * geoProfile) * (1.0 + expand * 0.12);
        let aD = a + max(0.0, r - baseR) * 0.03;
        edgeAbs = abs(aD);

        let radial = smoother(baseR - 0.01, baseR + 0.02, r) *
                     smoother(tip, tip * 0.80, r);
        let angular = smoother(w, w * 0.02, edgeAbs);
        mask = radial * angular;

        let trimWidth = w * 0.15;
        let trim = smoother(w, w - trimWidth, edgeAbs) * radial * (0.7 + 0.3 * tNorm);
        let innerLine = smoother(w * 0.08, 0.0, edgeAbs) * radial;
        let crossLine = smoother(w * 0.6, w * 0.2, edgeAbs) * mask *
                        smoother(baseR + tip * 0.3, baseR + tip * 0.35, r) *
                        smoother(baseR + tip * 0.7, baseR + tip * 0.75, r);

        let nrm = normalize(uv + vec2<f32>(1e-5));
        facing = 0.65 + 0.35 * dot(nrm, vec2<f32>(0.0, 1.0));
        depth = smoother(0.0, 0.14, r) * (1.0 - smoother(tip * 0.85, tip * 1.05, r));

        let gold = vec3<f32>(1.0, 0.84, 0.35);
        let yantraBody = mix(bodyCol, bodyCol * vec3<f32>(1.1, 0.9, 0.7), 0.25);

        outc += mask * 0.45 * yantraBody;
        outc += trim * 0.6 * gold;
        outc += innerLine * 0.35 * gold;
        outc += crossLine * 0.2 * yantraBody;

    } else {
        let wind = sin(t * 0.8 + petalId * 1.3 + n * 0.2) * 0.025;
        let curl = max(0.0, r - baseR) * 0.18 * (n / 10.0) * (1.0 - expand * 0.25);
        let aD = a + curl + wind;

        tNorm = clamp((r - baseR) / max(tip - baseR, 1e-3), 0.0, 1.0);
        let profile = pow(sin(tNorm * PI), 0.55);
        let waveEdge = sin(tNorm * 12.0 + petalId * 2.0 + t * 0.5) * 0.08;
        w = widVar * (0.12 + 0.88 * profile + waveEdge) * (1.0 + expand * 0.18);
        edgeAbs = abs(aD);

        let radial = smoother(baseR - 0.018, baseR + 0.035, r) *
                     smoother(tip, tip * 0.70, r);
        let angular = smoother(w, w * 0.06, edgeAbs);
        mask = radial * angular;

        let midrib = smoother(w * 0.50, 0.0, edgeAbs);
        let subsurface = mask * (0.40 + 0.60 * midrib) * (1.0 - tNorm * 0.35);
        let central = smoother(w * 0.10, 0.0, edgeAbs) * radial;
        let lateralWave = sin(edgeAbs * 22.0 - tNorm * 6.0 + petalId + t * 0.3) * 0.5 + 0.5;
        let lateral = lateralWave * smoother(w * 0.65, w * 0.12, edgeAbs) * mask *
                      smoother(baseR + 0.04, baseR + 0.14, r);
        let veins = central * 0.45 + lateral * 0.20;
        let rim = (smoother(w, w * 0.80, edgeAbs) - smoother(w * 0.80, w * 0.55, edgeAbs)) *
                  radial * (0.5 + 0.5 * tNorm);
        let tipGlow = smoother(tip * 0.80, tip, r) * angular * 0.85;

        let nrm = normalize(uv + vec2<f32>(1e-5));
        facing = 0.60 + 0.40 * dot(nrm, vec2<f32>(0.25, 1.0));
        depth = smoother(0.0, 0.18, r) * (1.0 - smoother(tip * 0.80, tip * 1.12, r));

        outc += subsurface * 0.36 * bodyCol;
        outc += veins * bodyCol * vec3<f32>(1.08, 1.02, 1.0);
        outc += rim * 0.50 * lightCol;
        outc += tipGlow * 0.42 * lightCol;
    }

    let detailAA = clamp(1.0 - length(fwidth(uv)) * 42.0, 0.0, 1.0);
    let warpDetail = fbmWarp(uv * (9.0 + n * 0.35) + vec2<f32>(petalId * 0.21, t * 0.18), t, 5);
    let iri = sin(tNorm * 38.0 + u.phaseProgress * TAU) *
              sin(edgeAbs * 60.0 - t * 0.7 + warpDetail * 2.2);
    let microDetail = 0.90 + 0.14 * iri + 0.16 * (warpDetail - 0.5);
    outc *= mix(1.0, microDetail, detailAA);
    outc += mask * detailAA * (0.012 + 0.02 * warpDetail) * lightCol;

    return outc * depth * facing;
}

fn sacredSymbol(
    uv: vec2<f32>, t: f32,
    expand: f32, intensity: f32, chakraPhase: f32
) -> vec3<f32> {
    var col = vec3<f32>(0.0);
    let r = length(uv);
    let a = atan2(uv.y, uv.x);

    let beat = 0.5 + 0.5 * sin(t * 1.4);
    let symPulse = 1.0 + 0.06 * sin(t * 2.8) * (0.5 + intensity) + expand * 0.05;
    let sx = 0.150 * symPulse * (1.0 + expand * 0.12);
    let sy = 0.082 * symPulse * (1.0 + expand * 0.06);
    let d = length(vec2<f32>(uv.x / max(sx, 1e-4), uv.y / max(sy, 1e-4))) - 1.0;

    let r1 = abs(d) - 0.014;
    let r2 = abs(d) - 0.034;
    let r3 = abs(d) - 0.062;

    let core = 0.014 / (abs(d) + 0.005);
    let g1   = 0.008 / (abs(r1) + 0.003);
    let g2   = 0.0045 / (abs(r2) + 0.005);
    let g3   = 0.0022 / (abs(r3) + 0.009);

    var coreCol: vec3<f32>;
    var haloCol: vec3<f32>;
    if (u.theme < 0.5) {
        coreCol = vec3<f32>(0.82, 0.94, 1.0);
        haloCol = vec3<f32>(0.72, 0.55, 0.92);
    } else if (u.theme < 1.5) {
        coreCol = vec3<f32>(1.0, 0.85, 0.55);
        haloCol = vec3<f32>(1.0, 0.60, 0.72);
    } else {
        coreCol = vec3<f32>(0.55, 0.90, 0.88);
        haloCol = vec3<f32>(0.35, 0.55, 0.92);
    }

    let bright = 0.70 + expand * 1.05 + intensity * 0.42 + beat * 0.12;

    col += core * coreCol * bright * 2.1;
    col += g1   * coreCol * bright * 1.35;
    col += g2   * haloCol * bright * 0.78;
    col += g3   * haloCol * bright * 0.36;

    let fill = smoother(0.02, -0.01, d);
    col += fill * coreCol * bright * 0.55;

    let shimmer = (sin(a * 5.0 - t * 1.6) * 0.5 + 0.5) *
                  (sin(r * 60.0 - t * 2.2) * 0.5 + 0.5);
    col += fill * shimmer * coreCol * 0.18 * (0.4 + expand);

    var omRipple = 0.0;
    for (var i = 0; i < 4; i++) {
        let fi = f32(i);
        let ringRad = 0.06 + fi * 0.035;
        let ringPhase = sin(r * 5.0 - t * 2.5 + fi * 1.57) * 0.5 + 0.5;
        let ringMask = exp(-abs(r - ringRad) * 80.0) * ringPhase;
        omRipple += ringMask;
    }
    col += omRipple * haloCol * 0.15 * (0.5 + expand * 0.5);

    let seedR = 0.045 * (1.0 + expand * 0.35);
    for (var i = 0; i < 3; i++) {
        let ang = -t * 0.35 + f32(i) * (TAU / 3.0);
        let p = uv - vec2<f32>(cos(ang), sin(ang)) * seedR;
        let dd = length(p);
        col += (0.0016 / (dd + 0.004)) * coreCol * bright * 0.7;
    }

    let binduRad = 0.012 * (1.0 + expand * 0.2);
    var hold1Glow = 1.0;
    if (chakraPhase > 0.5 && chakraPhase < 1.5) {
        hold1Glow = 1.5 + 0.5 * sin(t * 4.0);
    }
    let bindu = smoother(binduRad, 0.0, r) * hold1Glow;
    col += bindu * vec3<f32>(1.0, 0.98, 0.95) * bright * 0.6;

    let flare = exp(-abs(uv.y) * 52.0) * exp(-abs(uv.x) * 3.0) * (0.35 + expand * 0.65);
    col += flare * coreCol * 0.78;

    col += exp(-r * 21.0) * haloCol * (0.45 + expand * 0.9) * 0.85;

    return col;
}

fn lotusAndSymbol(
    uv: vec2<f32>, t: f32,
    breath: f32, intensity: f32, chakraPhase: f32
) -> vec3<f32> {
    var col = vec3<f32>(0.0);
    let expand = deriveBreathExpand();

    let shimmer = 0.03 * sin(t * 1.6 + breath * 12.566) * intensity;
    let effExpand = expand + shimmer;
    let glowMult = 0.78 + effExpand * 0.62 + intensity * 0.25;
    let translucency = 0.88;
    let density = clamp(u.geometryDensity + u.intensity * 0.2, 0.2, 3.0);
    let timeM = 1.0 + u.interference * 0.35;

    let n1 = select(6.0 + floor(density * 2.0), 8.0 + floor(density * 4.0), isHighQuality());
    let n2 = select(8.0 + floor(density * 3.0), 12.0 + floor(density * 5.0), isHighQuality());
    let n3 = select(10.0 + floor(density * 4.0), 16.0 + floor(density * 6.0), isHighQuality());
    let n4 = mix(0.0, 20.0 + floor(density * 7.0), smoothstep(0.6, 1.4, density)) * select(0.0, 1.0, isHighQuality());
    let n5 = mix(0.0, 26.0 + floor(density * 9.0), smoothstep(1.0, 2.0, density)) * select(0.0, 1.0, isHighQuality());

    col += lotusLayer(uv, t, n1, 0.42, 0.16, 0.06,
                      (0.000 + t * 0.020) * timeM, effExpand,
                      vec3<f32>(0.95, 0.62, 0.75)) * glowMult * translucency;
    col += lotusLayer(uv, t, n2, 0.60, 0.20, 0.10,
                      (0.262 + t * 0.014) * timeM, effExpand,
                      vec3<f32>(0.82, 0.52, 0.92)) * glowMult * translucency;
    col += lotusLayer(uv, t, n3, 0.76, 0.24, 0.14,
                      (0.131 + t * 0.008) * timeM, effExpand,
                      vec3<f32>(0.55, 0.68, 0.92)) * glowMult * translucency;
    if (n4 > 0.0) {
        col += lotusLayer(uv, t, n4, 0.92, 0.28, 0.18,
                          (0.000 - t * 0.005) * timeM, effExpand * 0.7,
                          vec3<f32>(0.62, 0.75, 0.88)) * glowMult * 0.55 * translucency;
    }
    if (n5 > 0.0) {
        col += lotusLayer(uv, t, n5, 1.12, 0.32, 0.24,
                          (0.500 + t * 0.003) * timeM, effExpand * 0.45,
                          vec3<f32>(0.58, 0.72, 0.85)) * glowMult * 0.28 * translucency;
    }

    col += sacredSymbol(uv, t, effExpand, intensity, chakraPhase);

    // Micro-geometry nested in the lotus heart
    col += dotLattice(uv, t, density) * 0.22;
    col += goldenSeedField(uv, vec2<f32>(0.0), 18, t, density) * 0.14;
    col += vesicaPiscisChain(uv, vec2<f32>(0.0), 10.0, 0.18, t, density) * 0.13;

    let aura = exp(-length(uv) * 3.2) * (0.12 + effExpand * 0.18) * intensity;
    col += aura * vec3<f32>(0.72, 0.58, 0.92);

    return col;
}

fn ribbonStrand(
    uv: vec2<f32>, t: f32,
    orbitR: f32, n: f32, speed: f32, twist: f32, phase: f32, width: f32,
    color: vec3<f32>, expand: f32, intensity: f32
) -> vec3<f32> {
    let r = length(uv);
    let a = atan2(uv.y, uv.x);

    let warp1 = fbm2(uv * 1.6 + vec2<f32>(orbitR * 4.0, phase * 2.0 + t * 0.12), t * 0.30);
    let warp2 = fbm2(uv * 3.1 - vec2<f32>(t * 0.08, orbitR * 2.0), t * 0.22);
    let warpHi = fbmWarp(uv * 4.6 + vec2<f32>(phase * 0.8, t * 0.16), t * 0.42, 5);

    let spiralPhase = a * n + t * speed + twist * (r - orbitR) + phase + warp1 * 0.65;
    let weave = sin(spiralPhase * 0.85 + warp2 * 1.6) * width * 1.7;
    let orbit = orbitR + weave;
    let radialDist = r - orbit;

    let thick = width * (0.55 + 0.45 * (sin(spiralPhase * 1.3 + warp2) * 0.5 + 0.5));
    let flow = sin(spiralPhase) * 0.5 + 0.5;
    let seg = pow(flow, 2.5) * 0.7 + 0.3;
    let glow = exp(-radialDist * radialDist / (thick * thick * 2.6)) * 0.42;
    let core = exp(-radialDist * radialDist / (thick * thick * 0.40)) * seg;
    let filament = exp(-radialDist * radialDist / (thick * thick * 0.06)) * pow(flow, 4.0) * 0.55;

    let depth = 0.6 + 0.4 * (sin(spiralPhase * 0.85 + warp2 * 1.6) * 0.5 + 0.5);
    let centerFade = smoother(0.04, 0.17, r);
    let sideBias = pow(abs(cos(a)), 0.45) * 0.30 + 0.70;

    var ribbon = (core + glow) * centerFade * sideBias * depth + filament * centerFade;
    let detailAA = clamp(1.0 - length(fwidth(uv)) * 52.0, 0.0, 1.0);
    let iri = sin((r + warpHi * 0.08) * 44.0 + u.phaseProgress * TAU) *
              sin(abs(radialDist) * (92.0 + u.intensity * 22.0) - t * 0.9);
    let ribbonMicro = 1.0 + detailAA * (0.10 * (warpHi - 0.5) + 0.06 * iri);
    ribbon *= ribbonMicro;

    let colorShift = sin(spiralPhase * 0.35 + t * 0.4 + phase) * 0.5 + 0.5;
    let flowColor = mix(color, color * vec3<f32>(1.15, 0.85, 1.25), colorShift * 0.35);
    let hotColor = mix(flowColor, vec3<f32>(1.0, 0.96, 0.92), filament * 1.2);

    let bright = (0.38 + expand * 0.85 + intensity * 0.32);
    return ribbon * hotColor * bright;
}

fn energyRibbons(
    uv: vec2<f32>, t: f32,
    breath: f32, intensity: f32, chakraPhase: f32
) -> vec3<f32> {
    var col = vec3<f32>(0.0);
    let expand = deriveBreathExpand();
    let phasePalette = focusedBreathColor();

    let holdPulse = 1.0 + 0.08 * sin(t * 3.5) * expand * intensity;
    let flowSpeed = 1.0 + expand * 1.4;
    let radiusShift = 1.0 - expand * 0.18;
    let glowMult = 0.55 + expand * 0.95 + intensity * 0.28;

    var flowOffset = vec2<f32>(0.0);
    if (u.chakraPhase < 0.5) {
        flowOffset = vec2<f32>(0.0, expand * 0.06 + u.phaseProgress * 0.04);
    } else if (u.chakraPhase > 1.5 && u.chakraPhase < 2.5) {
        flowOffset = vec2<f32>(0.0, -(expand * 0.06 + u.phaseProgress * 0.04));
    }
    let driftUV = uv + flowOffset;

    let r1 = 0.32 * radiusShift;
    col += ribbonStrand(driftUV, t, r1, 4.0, flowSpeed * 1.0, 6.0, 0.00,
                        0.038, vec3<f32>(0.92, 0.48, 0.68), expand, intensity)
           * glowMult * holdPulse;
    col += ribbonStrand(driftUV, t, r1, 4.0, flowSpeed * 1.0, 6.0, 3.14159,
                        0.038, vec3<f32>(0.78, 0.42, 0.72), expand, intensity)
           * glowMult * holdPulse;

    let r2 = 0.58 * radiusShift;
    col += ribbonStrand(driftUV, t, r2, 6.0, flowSpeed * 1.2, 9.0, 0.60,
                        0.045, vec3<f32>(0.48, 0.68, 0.92), expand, intensity)
           * glowMult * 0.90 * holdPulse;
    col += ribbonStrand(driftUV, t, r2, 6.0, flowSpeed * 1.2, 9.0, 2.80,
                        0.045, vec3<f32>(0.55, 0.82, 0.72), expand, intensity)
           * glowMult * 0.90 * holdPulse;
    col += ribbonStrand(driftUV, t, r2, 6.0, flowSpeed * 1.2, 9.0, 4.50,
                        0.045, vec3<f32>(0.88, 0.52, 0.78), expand, intensity)
           * glowMult * 0.90 * holdPulse;

    let r3 = 0.92 * radiusShift;
    col += ribbonStrand(driftUV, t, r3, 8.0, flowSpeed * 0.85, 12.0, 1.10,
                        0.052, vec3<f32>(0.42, 0.62, 0.92), expand, intensity)
           * glowMult * 0.72 * holdPulse;
    col += ribbonStrand(driftUV, t, r3, 8.0, flowSpeed * 0.85, 12.0, 3.90,
                        0.052, vec3<f32>(0.68, 0.48, 0.88), expand, intensity)
           * glowMult * 0.72 * holdPulse;

    let r4 = 1.35 * radiusShift;
    col += ribbonStrand(driftUV, t, r4, 3.5, flowSpeed * 0.45, 5.0, 0.00,
                        0.075, vec3<f32>(0.52, 0.60, 0.88), expand, intensity)
           * glowMult * 0.38 * holdPulse;
    col += ribbonStrand(driftUV, t, r4, 3.5, flowSpeed * 0.45, 5.0, 2.09,
                        0.075, vec3<f32>(0.58, 0.52, 0.82), expand, intensity)
           * glowMult * 0.38 * holdPulse;

    if (chakraPhase < 0.5)      { col *= vec3<f32>(0.90, 0.98, 1.08); }
    else if (chakraPhase < 1.5) { col *= vec3<f32>(1.10, 0.94, 0.98); }
    else if (chakraPhase < 2.5) { col *= vec3<f32>(1.04, 0.98, 0.90); }
    else                        { col *= vec3<f32>(0.94, 0.98, 1.04); }
    col = mix(col, col * (0.55 + phasePalette * 1.05), 0.33);

    let r = length(driftUV);
    let a = atan2(driftUV.y, driftUV.x);
    let bridgePhase = a * 2.0 + t * 0.6 + expand * 2.0;
    let bridgeMask = exp(-(r - 0.70) * (r - 0.70) / 0.015) *
                     smoothstep(0.4, 0.8, sin(bridgePhase) * 0.5 + 0.5);
    col += vec3<f32>(0.72, 0.75, 0.95) * bridgeMask * 0.18 * glowMult;

    if (u.chakraPhase < 0.5) {
        let sparkY = -0.3 + u.phaseProgress * 0.6;
        let sparkPos = vec2<f32>(0.0, sparkY);
        let sparkDist = length(driftUV - sparkPos);
        let sparkSize = 0.012 + 0.008 * sin(t * 5.0);
        let spark = exp(-sparkDist * sparkDist / (sparkSize * sparkSize)) * 1.2;
        let sparkCol = mix(vec3<f32>(1.0, 0.30, 0.20), vec3<f32>(0.90, 0.80, 1.0), u.phaseProgress);
        col += spark * sparkCol * glowMult * 0.8;
    }

    if (intensity > 0.55) {
        let lightningSeed = floor(t * 8.0);
        let lightningHash = hash22(vec2<f32>(lightningSeed, r * 10.0));
        let branchPhase = a * 5.0 + t * 12.0 + lightningHash.x * 6.283;
        let branchMask = smoothstep(0.92, 1.0, sin(branchPhase) * 0.5 + 0.5) *
                         exp(-abs(r - 0.5) * 4.0) *
                         exp(-abs(driftUV.y) * 3.0);
        let branchCol = vec3<f32>(0.85, 0.90, 1.0);
        col += branchCol * branchMask * (intensity - 0.55) * 0.35;
    }

    return col;
}

