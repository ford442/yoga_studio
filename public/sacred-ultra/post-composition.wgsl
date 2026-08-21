// ============================================================================
// MODULE 5 — CINEMATIC POST-PROCESSING
// ============================================================================

fn acesTonemap(x: vec3<f32>) -> vec3<f32> {
    let a = 2.51;
    let b = 0.03;
    let c = 2.43;
    let d = 0.59;
    let e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), vec3<f32>(0.0), vec3<f32>(1.0));
}

fn applyColorGrading(
    col: vec3<f32>,
    uv: vec2<f32>,
    t: f32,
    expand: f32,
    theme: f32,
    phasePalette: vec3<f32>
) -> vec3<f32> {
    var graded = col;

    let sat = 1.0 + expand * 0.10;
    let luma = dot(graded, vec3<f32>(0.299, 0.587, 0.114));
    graded = mix(vec3<f32>(luma), graded, sat);

    let warmth = expand * 0.05;
    graded *= vec3<f32>(1.0 + warmth, 1.0 + warmth * 0.25, 1.0 - warmth * 0.35);

    let brightness = dot(graded, vec3<f32>(0.333));
    let chromaticWarmth = smoothstep(0.4, 1.2, brightness) * (0.04 + expand * 0.05);
    graded += vec3<f32>(chromaticWarmth, chromaticWarmth * 0.35, -chromaticWarmth * 0.25);

    if (theme > 0.5 && theme < 1.5) {
        graded = mix(graded, graded * vec3<f32>(1.18, 1.04, 0.78), 0.20);
    } else if (theme > 1.5) {
        graded = mix(graded, graded * vec3<f32>(0.82, 1.06, 1.12), 0.20);
    }

    graded = acesTonemap(graded * 1.05);

    let bloomThreshold = 0.55;
    var bloom = max(graded - bloomThreshold, vec3<f32>(0.0));
    let bloomSpread = smoothstep(0.0, 1.0, brightness) * 0.25;
    bloom += bloom * bloomSpread;
    graded += bloom * (0.22 + 0.13 * phasePalette);

    let grain = hash21(uv * 500.0 + t * 100.0) * 0.015;
    graded += grain;

    let edgeDist = length(uv);
    let ca = edgeDist * 0.004;
    graded.r += ca * 0.025 * edgeDist;
    graded.b -= ca * 0.020 * edgeDist;

    if (u.chakraPhase > 2.5) {
        graded.b *= 0.92;
    }

    graded = pow(graded, vec3<f32>(0.90));
    return max(graded, vec3<f32>(0.0));
}

// ============================================================================
// MAIN FRAGMENT SHADER — Final Composition
// ============================================================================

@fragment
fn main(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
    var uv = (fragCoord.xy - 0.5 * u.resolution) / u.resolution.y;
    let breath = u.breathPhase;
    let expand = deriveBreathExpand();
    let t = u.time;
    let r = length(uv);

    // ------------------------------------------------------------
    // Interactive mouse ripple (preserved from original app)
    // ------------------------------------------------------------
    if (u.mouse.x > -1.9) {
        let toMouse = uv - u.mouse;
        let dist = length(toMouse);
        let ripplePhase = t * 7.0 - dist * 42.0;
        let ripple = sin(ripplePhase) * exp(-dist * 5.5) * u.mouseStrength * 0.028;
        uv += toMouse * ripple * 2.2;
    }

    // ------------------------------------------------------------
    // LAYER 1 — Background atmosphere
    // ------------------------------------------------------------
    var col = backgroundAtmosphere(uv, t, breath, expand);
    let phasePalette = focusedBreathColor();

    // ------------------------------------------------------------
    // LAYER 2 — Volumetric light shafts
    // ------------------------------------------------------------
    col += lightShafts(uv * 0.85, t, breath, expand);
    col += godRays(uv * 0.95, t, u.intensity, expand) * select(0.55, 1.0, isHighQuality());

    // ------------------------------------------------------------
    // LAYER 3 — Sacred geometry rings
    // ------------------------------------------------------------
    col += layeredSacredGeometry(uv, t, breath, expand);

    // ------------------------------------------------------------
    // LAYER 4 — Prana particles
    // ------------------------------------------------------------
    col += pranaParticles(uv, t, breath, expand);

    // ------------------------------------------------------------
    // LAYER 5 — Energy ribbons (behind lotus for translucency glow)
    // ------------------------------------------------------------
    col += energyRibbons(uv, t, breath, u.intensity, u.chakraPhase) * select(0.72, 1.0, isHighQuality());

    // ------------------------------------------------------------
    // LAYER 6 — Figure aura
    // ------------------------------------------------------------
    col += figureAura(uv, t, breath, expand);

    // ------------------------------------------------------------
    // LAYER 6b — Figure-framing geometry (grows from heart/head)
    // ------------------------------------------------------------
    if (isHighQuality()) {
        col += figureFramingGeometry(uv, t, breath, expand);
    }

    // ------------------------------------------------------------
    // LAYER 7 — Human figure with animated arms
    // ------------------------------------------------------------
    col += humanFigure(uv, t, breath, expand);

    // ------------------------------------------------------------
    // LAYER 8 — Chakra column with breath pulse
    // ------------------------------------------------------------
    col += chakraColumn(uv, t, breath, expand);

    // ------------------------------------------------------------
    // LAYER 9 — Lotus + sacred symbol (hero focal point)
    // ------------------------------------------------------------
    col += lotusAndSymbol(uv, t, breath, u.intensity, u.chakraPhase);

    // ------------------------------------------------------------
    // LAYER 10 — Progress ring
    // ------------------------------------------------------------
    col += progressRing(uv, breath, expand);

    // ------------------------------------------------------------
    // LAYER 11 — Global breath aura
    // ------------------------------------------------------------
    let globalAura = exp(-r * 2.8) * (0.06 + expand * 0.10) * u.intensity;
    col += globalAura * mix(vec3<f32>(0.58, 0.48, 0.88), phasePalette, 0.55);

    // ------------------------------------------------------------
    // LAYER 12 — Exhale release wave
    // ------------------------------------------------------------
    let releaseWave = sin(r * 10.0 - breath * 15.708 - t * 1.2) * 0.5 + 0.5;
    let waveMask = exp(-r * 2.0) *
                   smoothstep(0.35, 0.75, releaseWave) *
                   (1.0 - expand) * 0.038;
    col += waveMask * mix(vec3<f32>(0.52, 0.42, 0.82), phasePalette, 0.45);

    // ------------------------------------------------------------
    // LAYER 13 — Atmospheric breath haze
    // ------------------------------------------------------------
    let haze = exp(-r * 1.3) * (0.12 + (1.0 - breath) * 0.22);
    let hold2Mask = smoothstep(2.5, 2.9, u.chakraPhase);
    let exhaleMask = smoothstep(1.5, 2.5, u.chakraPhase) * (1.0 - hold2Mask);
    let exhaleHaze = (exhaleMask * 0.08 + hold2Mask * 0.18) * (1.0 - expand);
    col = mix(col, vec3<f32>(0.045, 0.022, 0.14), haze * 0.30 + exhaleHaze);

    // ------------------------------------------------------------
    // POST — Vignette
    // ------------------------------------------------------------
    let vig = pow(1.0 - r * 0.68, 1.75);
    col *= vig * 1.28;

    // ------------------------------------------------------------
    // POST — Cinematic color grading
    // ------------------------------------------------------------
    col = applyColorGrading(col, uv, t, expand, u.theme, phasePalette);

    return vec4<f32>(col, 1.0);
}
