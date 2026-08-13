// =================================================================
// THEME & POST-PROCESS HELPERS
// =================================================================

// Narkowicz ACES approximation — filmic highlight roll-off that keeps
// the hot symbol core from turning into a flat white blob while
// preserving saturated colour in the mids. Cheaper than full ACES.
fn acesTonemap(x: vec3<f32>) -> vec3<f32> {
    let a = 2.51;
    let b = 0.03;
    let c = 2.43;
    let d = 0.59;
    let e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), vec3<f32>(0.0), vec3<f32>(1.0));
}

fn applyColorGrading(col: vec3<f32>, expand: f32, theme: f32, focusTint: vec3<f32>) -> vec3<f32> {
    var graded = col;

    // 1. Breath-driven saturation (peak inhale slightly more vivid).
    let sat = 1.0 + expand * 0.10;
    let luma = dot(graded, vec3<f32>(0.299, 0.587, 0.114));
    graded = mix(vec3<f32>(luma), graded, sat);

    // 2. Breath colour temperature (inhale warmer, exhale cooler) — pushed
    //    further so the "filling with light" sensation reads more strongly.
    let warmth = expand * 0.14;
    graded *= vec3<f32>(1.0 + warmth, 1.0 + warmth * 0.25, 1.0 - warmth * 0.35);

    // 3. Chromatic bloom bleed — bright areas warm slightly, bleeding
    //    gold into the cool petals for natural light interaction.
    let brightness = dot(graded, vec3<f32>(0.333));
    let chromaticWarmth = smoothstep(0.4, 1.2, brightness) * (0.04 + expand * 0.05);
    graded += vec3<f32>(chromaticWarmth, chromaticWarmth * 0.35, -chromaticWarmth * 0.25);

    // 4. Theme tint.
    if (theme > 0.5 && theme < 1.5) {
        graded = mix(graded, graded * vec3<f32>(1.18, 1.04, 0.78), 0.20);   // Golden
    } else if (theme > 1.5) {
        graded = mix(graded, graded * vec3<f32>(0.82, 1.06, 1.12), 0.20);   // Ocean
    }

    // 5. Focus-tinted highlight bleed and filmic tone map.
    let bright = dot(graded, vec3<f32>(0.333));
    let glowMask = smoothstep(0.45, 1.2, bright) * (0.05 + expand * 0.06);
    graded += glowMask * focusTint * 0.18;

    // 6. Filmic tone map (replaces ad-hoc S-curve + Reinhard shoulder).
    graded = acesTonemap(graded * 1.05);

    // 7. Gentle gamma lift so deep space stays ethereal, not crushed.
    graded = pow(graded, vec3<f32>(0.90));

    return max(graded, vec3<f32>(0.0));
}

// -----------------------------------------------------------------
// SDF primitives for optional figure layer
// -----------------------------------------------------------------
fn sdSegment(p: vec2<f32>, a: vec2<f32>, b: vec2<f32>) -> f32 {
    let pa = p - a;
    let ba = b - a;
    let h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h);
}

fn sdCircle(p: vec2<f32>, r: f32) -> f32 {
    return length(p) - r;
}

fn smin(a: f32, b: f32, k: f32) -> f32 {
    let h = max(k - abs(a - b), 0.0) / k;
    return min(a, b) - h * h * k * 0.25;
}

// -----------------------------------------------------------------
// Optional subtle seated figure behind the lotus
// Visible only at higher strength so the lotus remains the hero.
// -----------------------------------------------------------------
fn humanFigureLotus(uv: vec2<f32>, t: f32, breath: f32, expand: f32) -> vec3<f32> {
    var col = vec3<f32>(0.0);
    let figureStrength = smoothstep(0.8, 1.5, u.strengthLevel) + 0.15 * u.intensity;
    if (figureStrength < 0.05) { return col; }

    // Small seated figure centered just below the symbol
    let p = (uv - vec2<f32>(0.0, -0.26)) / 0.40;

    let phaseColor = chakraFocusTint();
    var themeColor = vec3<f32>(0.85, 0.90, 1.00);
    if (u.theme < 0.5)      { themeColor = vec3<f32>(0.75, 0.85, 1.00); }
    else if (u.theme < 1.5) { themeColor = vec3<f32>(1.00, 0.85, 0.45); }
    else                    { themeColor = vec3<f32>(0.45, 0.90, 1.00); }

    let headPos  = vec2<f32>(0.0, 0.28 + expand * 0.012);
    let chestPos = vec2<f32>(0.0, 0.08 + expand * 0.010);
    let hipsPos  = vec2<f32>(0.0, -0.12);

    // Head with subtle tilt & chin tuck
    let tilt = sin(t * 0.7) * 0.004 * u.intensity;
    let headD = sdCircle(p - (headPos + vec2<f32>(tilt, 0.0)), 0.055);
    col += exp(-abs(headD) * 35.0) * themeColor * 0.35;
    let chinD = sdCircle(p - (headPos + vec2<f32>(tilt * 0.5, -0.046)), 0.018);
    col += exp(-abs(chinD) * 55.0) * themeColor * 0.14;

    // Torso
    let chestD = sdCircle(p - chestPos, 0.075 * (1.0 + expand * 0.10));
    let hipsD  = sdCircle(p - hipsPos,  0.065 * (1.0 + expand * 0.03));
    let torsoD = smin(chestD, hipsD, 0.08);
    col += exp(-abs(torsoD) * 30.0) * themeColor * 0.28;

    // Arms resting softly
    let leftHand  = vec2<f32>(-0.22, -0.10 + expand * 0.015);
    let rightHand = vec2<f32>( 0.22, -0.10 + expand * 0.015);
    let leftArmD  = sdSegment(p, chestPos + vec2<f32>(-0.055, 0.02), leftHand) - 0.022;
    let rightArmD = sdSegment(p, chestPos + vec2<f32>( 0.055, 0.02), rightHand) - 0.022;
    col += exp(-abs(leftArmD)  * 35.0) * themeColor * 0.30;
    col += exp(-abs(rightArmD) * 35.0) * themeColor * 0.30;

    // Hands
    col += exp(-abs(sdCircle(p - leftHand,  0.025)) * 45.0) * phaseColor * 0.35;
    col += exp(-abs(sdCircle(p - rightHand, 0.025)) * 45.0) * phaseColor * 0.35;

    // Lotus seat
    let leftThigh  = sdSegment(p, hipsPos + vec2<f32>(-0.03, -0.02), vec2<f32>(-0.18, -0.22)) - 0.028;
    let leftShin   = sdSegment(p, vec2<f32>(-0.18, -0.22), vec2<f32>( 0.04, -0.28)) - 0.024;
    let rightThigh = sdSegment(p, hipsPos + vec2<f32>( 0.03, -0.02), vec2<f32>( 0.18, -0.22)) - 0.028;
    let rightShin  = sdSegment(p, vec2<f32>( 0.18, -0.22), vec2<f32>(-0.04, -0.28)) - 0.024;
    col += exp(-abs(leftThigh)  * 35.0) * themeColor * 0.30;
    col += exp(-abs(leftShin)   * 35.0) * themeColor * 0.26;
    col += exp(-abs(rightThigh) * 35.0) * themeColor * 0.30;
    col += exp(-abs(rightShin)  * 35.0) * themeColor * 0.26;

    // Sushumna nadi
    let nadiD = abs(p.x) - 0.0035;
    var nadiColor = vec3<f32>(0.9, 0.95, 1.0);
    if (u.chakraFocus >= 0.0) {
        nadiColor = mix(nadiColor, CHAKRA[u32(clamp(u.chakraFocus, 0.0, 6.0))], 0.45);
    }
    col += exp(-abs(nadiD) * 65.0) * nadiColor * 0.22 * (0.6 + expand * 0.4);

    return col * figureStrength * 0.55;
}

// =================================================================
// FRAGMENT SHADER — FINAL COMPOSITION
// =================================================================

@fragment
fn main(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
    var uv = (fragCoord.xy - 0.5 * u.resolution) / u.resolution.y;
    let breath = u.breathPhase;
    let expand = deriveBreathExpand(breath, u.chakraPhase);
    let t = u.time;
    let r = length(uv);
    let focusTint = chakraFocusTint();

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

    // LAYER 1 — Background atmosphere, driven by its own slow, un-synchronized
    // clock so the space around the figure keeps drifting independently —
    // most noticeable as held stillness in the foreground during breath holds.
    var col = backgroundAtmosphere(uv, fieldTime(), breath, expand);

    // LAYER 2 — Volumetric light shafts
    col += lightShafts(uv * 0.85, t, breath, expand);

    // LAYER 3 — Energy ribbons (behind lotus for translucency glow)
    col += energyRibbons(uv, t, breath, u.intensity, u.chakraPhase);

    // LAYER 3b — Optional subtle seated figure (strength-gated)
    col += humanFigureLotus(uv, t, breath, expand);

    // LAYER 4 — Lotus + sacred symbol (hero focal point)
    col += lotusAndSymbol(uv, t, breath, u.intensity, u.chakraPhase);

    // LAYER 5 — Global breath aura
    let globalAura = exp(-r * 2.8) * (0.06 + expand * 0.10) * u.intensity;
    col += globalAura * mix(vec3<f32>(0.58, 0.48, 0.88), focusTint, 0.55);

    // LAYER 6 — Exhale release wave (subtle traveling ripple)
    let releaseWave = sin(r * 10.0 - breath * 15.708 - t * 1.2) * 0.5 + 0.5;
    let waveMask = exp(-r * 2.0) *
                   smoothstep(0.35, 0.75, releaseWave) *
                   (1.0 - expand) * 0.038;
    col += waveMask * mix(vec3<f32>(0.52, 0.42, 0.82), focusTint, 0.40);

    // LAYER 7 — Atmospheric breath haze (depth + cohesion)
    let haze = exp(-r * 1.3) * (0.12 + (1.0 - breath) * 0.22);
    col = mix(col, vec3<f32>(0.045, 0.022, 0.14), haze * 0.30);

    // POST — vignette draws the eye to centre
    let vig = pow(1.0 - r * 0.68, 1.75);
    col *= vig * 1.28;

    // POST — saturation, temperature, bloom bleed, theme, tone map
    col = applyColorGrading(col, expand, u.theme, focusTint);
    col = mix(col, col * (0.62 + focusTint * 0.90), 0.20);

    return vec4<f32>(col, 1.0);
}
