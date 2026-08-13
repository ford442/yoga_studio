// =================================================================
// LOTUS MODULE
// =================================================================
//
// A single radial ring of `n` petals. Compared to the previous wedge
// approach, each petal now has:
//   - a leaf profile (half-width follows sin along its length) so it
//     comes to a real point and rounds at the base,
//   - per-petal hash variation (length, width, hue) so the ring is
//     organic rather than mechanically perfect,
//   - a subsurface translucency gradient (glows from the base/center),
//   - central + lateral veins,
//   - a bright rim light hugging the petal edge,
//   - a faked top-down light so upper petals read brighter (3D depth).
// =================================================================
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

    // --- per-petal organic variation -------------------------------
    let hv = hash22(vec2<f32>(petalId, n * 0.37));
    let lenVar = len * (0.93 + hv.x * 0.14);
    let widVar = wid * (0.88 + hv.y * 0.24);
    let hueJit = (hv.x - 0.5) * 0.10;             // tiny per-petal hue drift

    let tip = lenVar * (1.0 + expand * 0.22);
    let baseR = base * (1.0 - expand * 0.08);

    // --- gentle outward droop/curl ---------------------------------
    let droop = max(0.0, r - baseR) * 0.12 * (min(n, 24.0) / 12.0) * (1.0 - expand * 0.35);
    let aD = a + droop;

    // --- leaf profile: half-width as a function of length ----------
    // tNorm 0 at base, 1 at tip. sin(PI*t) -> 0 at both ends, fat mid.
    let tNorm = clamp((r - baseR) / max(tip - baseR, 1e-3), 0.0, 1.0);
    let profile = pow(sin(tNorm * PI), 0.65);
    let w = widVar * (0.10 + 0.90 * profile) * (1.0 + expand * 0.18)
            * (1.0 + u.interference * 0.04 * sin(petalId));

    // --- masks -----------------------------------------------------
    let radial = smoother(baseR - 0.015, baseR + 0.03, r) *
                 smoother(tip, tip * 0.72, r);
    let edgeAbs = abs(aD);
    let angular = smoother(w, w * 0.05, edgeAbs);          // 1 center -> 0 edge
    var mask = radial * angular;

    // --- subsurface translucency: glow pooled at base & midrib -----
    let midrib = smoother(w * 0.55, 0.0, edgeAbs);
    let subsurface = mask * (0.35 + 0.65 * midrib) * (1.0 - tNorm * 0.45);

    // --- veins: bright central rib + soft laterals -----------------
    let central = smoother(w * 0.10, 0.0, edgeAbs) * radial;
    let lateralWave = sin(edgeAbs * 26.0 - tNorm * 7.0 + petalId) * 0.5 + 0.5;
    let lateral = lateralWave * smoother(w * 0.7, w * 0.1, edgeAbs) * mask *
                  smoother(baseR + 0.04, baseR + 0.14, r);
    let veins = central * 0.5 + lateral * 0.18;

    // --- rim light: thin bright band hugging the outer edge --------
    let rim = (smoother(w, w * 0.78, edgeAbs) - smoother(w * 0.78, w * 0.5, edgeAbs)) *
              radial * (0.6 + 0.4 * tNorm);

    // --- bright tip highlight (catches the divine light) -----------
    let tipGlow = smoother(tip * 0.78, tip, r) * angular * 0.8;

    // --- faked top-down light for 3D layering ----------------------
    let nrm = normalize(uv + vec2<f32>(1e-5));
    let facing = 0.62 + 0.38 * dot(nrm, vec2<f32>(0.22, 1.0));

    // --- depth fade so petals sit behind the symbol ---------------
    let depth = smoother(0.0, 0.16, r) * (1.0 - smoother(tip * 0.78, tip * 1.08, r));

    // tint: warm rim/tip (light side), cooler body (shadow side)
    let bodyCol  = color * (1.0 + vec3<f32>(hueJit, 0.0, -hueJit));
    let lightCol = mix(color, vec3<f32>(1.0, 0.94, 0.88), 0.45);

    var outc = vec3<f32>(0.0);
    outc += subsurface * 0.34 * bodyCol;
    outc += veins * bodyCol * vec3<f32>(1.1, 1.05, 1.0);
    outc += rim * 0.55 * lightCol;
    outc += tipGlow * 0.40 * lightCol;

    return outc * depth * facing;
}

// =================================================================
// SACRED SYMBOL — luminous heart of the composition
// =================================================================
// Layered: a soft radial halo, concentric light rings, a slowly
// counter-rotating tri-seed mandala for "intentional" motion, a
// caustic shimmer on the core, and a breath-synced pulse. Brightness
// is pushed deliberately high so it remains the focal point through
// bloom and tone mapping.
// =================================================================
fn sacredSymbol(
    uv: vec2<f32>, t: f32,
    expand: f32, intensity: f32, chakraPhase: f32
) -> vec3<f32> {
    var col = vec3<f32>(0.0);
    let r = length(uv);
    let a = atan2(uv.y, uv.x);

    // Breathing pulse: a wandering heartbeat (never locks to other layers'
    // rhythms) plus the breath openness itself.
    let beat = organicPulse(t, 1.4, 4.81);
    let symPulse = 1.0 + 0.06 * sin(t * 2.8 + beat) * (0.5 + intensity) + expand * 0.05;
    let sx = 0.150 * symPulse * (1.0 + expand * 0.12);
    let sy = 0.082 * symPulse * (1.0 + expand * 0.06);

    // Ellipse SDF (negative inside).
    let d = length(vec2<f32>(uv.x / max(sx, 1e-4), uv.y / max(sy, 1e-4))) - 1.0;

    // Nested ring offsets.
    let r1 = abs(d) - 0.014;
    let r2 = abs(d) - 0.034;
    let r3 = abs(d) - 0.062;

    // Glow falloffs (1/x style for a hot luminous core).
    let core = 0.014 / (abs(d) + 0.005);
    let g1   = 0.008 / (abs(r1) + 0.003);
    let g2   = 0.0045 / (abs(r2) + 0.005);
    let g3   = 0.0022 / (abs(r3) + 0.009);

    // Phase palette: inhale crystalline, hold1 rose-gold, exhale solar,
    // hold2 lunar silver.
    var c = vec3<f32>(1.0, 0.94, 0.72);
    if (chakraPhase < 0.5)      { c = vec3<f32>(0.82, 0.94, 1.0); }
    else if (chakraPhase < 1.5) { c = vec3<f32>(1.0, 0.80, 0.86); }
    else if (chakraPhase < 2.5) { c = vec3<f32>(1.0, 0.95, 0.70); }
    else                        { c = vec3<f32>(0.88, 0.94, 1.0); }

    let bright = 0.70 + expand * 1.05 + intensity * 0.42 + beat * 0.12;

    col += core * c * bright * 2.1;
    col += g1   * c * bright * 1.35;
    col += g2   * c * bright * 0.78;
    col += g3   * c * bright * 0.36;

    // Solid inner fill with a soft falloff.
    let fill = smoother(0.02, -0.01, d);
    col += fill * c * bright * 0.55;

    // Caustic shimmer riding the core — subtle living light.
    let shimmer = (sin(a * 5.0 - t * 1.6) * 0.5 + 0.5) *
                  (sin(r * 60.0 - t * 2.2) * 0.5 + 0.5);
    col += fill * shimmer * c * 0.18 * (0.4 + expand);

    // Counter-rotating tri-seed mandala (bindu-like). Three soft dots
    // orbiting the centre, gently scaling with the breath.
    let seedR = 0.045 * (1.0 + expand * 0.35);
    for (var i = 0; i < 3; i++) {
        let ang = -t * 0.35 * (1.0 + u.interference) + f32(i) * (TAU / 3.0);
        let p = uv - vec2<f32>(cos(ang), sin(ang)) * seedR;
        let dd = length(p);
        col += (0.0016 / (dd + 0.004)) * c * bright * 0.7;
    }

    // Horizontal lens flare across the symbol.
    let flare = exp(-abs(uv.y) * 52.0) * exp(-abs(uv.x) * 3.0) * (0.35 + expand * 0.65);
    col += flare * c * 0.78;

    // Halo bedding the symbol into the petals.
    col += exp(-r * 21.0) * c * (0.45 + expand * 0.9) * 0.85;

    return col;
}

fn lotusAndSymbol(
    uv: vec2<f32>, t: f32,
    breath: f32, intensity: f32, chakraPhase: f32
) -> vec3<f32> {
    var col = vec3<f32>(0.0);
    let expand = deriveBreathExpand(breath, chakraPhase);

    let shimmer = 0.03 * sin(t * 1.6 + breath * 12.566) * intensity;
    let effExpand = expand + shimmer;
    let glowMult = 0.78 + effExpand * 0.62 + intensity * 0.25;
    let density = clamp(u.geometryDensity + u.intensity * 0.2, 0.2, 3.0);
    let timeM = 1.0 + u.interference * 0.35;

    // Petal counts grow with density; outer layers emerge only at higher density.
    let n1 = 8.0 + floor(density * 4.0);
    let n2 = 12.0 + floor(density * 5.0);
    let n3 = 16.0 + floor(density * 6.0);
    let n4 = mix(0.0, 20.0 + floor(density * 7.0), smoothstep(0.6, 1.4, density));
    let n5 = mix(0.0, 26.0 + floor(density * 9.0), smoothstep(1.0, 2.0, density));

    col += lotusLayer(uv, t, n1, 0.42, 0.16, 0.06,
                      (0.000 + t * 0.020) * timeM, effExpand,
                      vec3<f32>(0.95, 0.62, 0.75)) * glowMult;

    col += lotusLayer(uv, t, n2, 0.60, 0.20, 0.10,
                      (0.262 + t * 0.014) * timeM, effExpand,
                      vec3<f32>(0.82, 0.52, 0.92)) * glowMult;

    col += lotusLayer(uv, t, n3, 0.76, 0.24, 0.14,
                      (0.131 + t * 0.008) * timeM, effExpand,
                      vec3<f32>(0.97, 0.55, 0.42)) * glowMult;

    if (n4 > 0.0) {
        col += lotusLayer(uv, t, n4, 0.92, 0.28, 0.18,
                          (0.000 - t * 0.005) * timeM, effExpand * 0.7,
                          vec3<f32>(0.95, 0.70, 0.45)) * glowMult * 0.55;
    }

    if (n5 > 0.0) {
        col += lotusLayer(uv, t, n5, 1.12, 0.32, 0.24,
                          (0.500 + t * 0.003) * timeM, effExpand * 0.45,
                          vec3<f32>(0.58, 0.72, 0.85)) * glowMult * 0.28;
    }

    // Central sacred symbol
    col += sacredSymbol(uv, t, effExpand, intensity, chakraPhase);

    // Recursive micro-geometry around the heart of the lotus
    col += dotLattice(uv, t, density) * 0.30;
    col += goldenSeedField(uv, vec2<f32>(0.0), 18, t, density) * 0.18;
    col += vesicaPiscisChain(uv, vec2<f32>(0.0), 10.0, 0.18, t, density) * 0.16;

    // Lotus aura bridges warm inner petals with cool outer space
    let aura = exp(-length(uv) * 3.2) * (0.12 + effExpand * 0.18) * intensity;
    col += aura * vec3<f32>(0.72, 0.58, 0.92);

    return col;
}

