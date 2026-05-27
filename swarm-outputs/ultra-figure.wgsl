// ============================================================================
// Ultra Figure & Energy Systems Module
// Figure & Energy Systems Specialist — Shader Enhancement Swarm
// ============================================================================
// NOTE: This file is intended to be copy-pasted into a larger shader that
// already defines the Uniforms struct and uniform binding.
// Do NOT paste the Uniforms struct or @binding declarations from here.
// ============================================================================

// ----------------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------------

/// 2D signed-distance to a line segment from a to b
fn sdSegment(p: vec2<f32>, a: vec2<f32>, b: vec2<f32>) -> f32 {
    let pa = p - a;
    let ba = b - a;
    let h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h);
}

/// 2D signed-distance to a circle of radius r
fn sdCircle(p: vec2<f32>, r: f32) -> f32 {
    return length(p) - r;
}

/// Smooth minimum (Koroenbroek-style) for organic blob unions
fn smin(a: f32, b: f32, k: f32) -> f32 {
    let h = max(k - abs(a - b), 0.0) / k;
    return min(a, b) - h * h * k * 0.25;
}

/// Fast HSV to RGB conversion
fn hsv2rgb(h: f32, s: f32, v: f32) -> vec3<f32> {
    let k = vec3<f32>(1.0, 0.666666667, 0.333333333);
    let p = abs(fract(vec3<f32>(h) + k) * 6.0 - vec3<f32>(3.0));
    return v * mix(vec3<f32>(1.0), clamp(p - vec3<f32>(1.0), vec3<f32>(0.0), vec3<f32>(1.0)), s);
}

/// 2D rotation matrix
fn rot2(a: f32) -> mat2x2<f32> {
    let c = cos(a);
    let s = sin(a);
    return mat2x2<f32>(c, s, -s, c);
}

/// 2D hash
fn hash21(p: vec2<f32>) -> f32 {
    return fract(sin(dot(p, vec2<f32>(12.9898, 78.233))) * 43758.5453);
}

// NOTE: WGSL provides smoothstep() as a built-in; it is used directly below.

// ----------------------------------------------------------------------------
// Breath Expansion Deriver
// ----------------------------------------------------------------------------

/// Returns a smoothed 0..1 breath openness value based on phase and progress.
fn deriveBreathExpand() -> f32 {
    var expand: f32 = 0.0;
    if (u.chakraPhase < 0.5) {
        // inhale
        expand = u.phaseProgress;
    } else if (u.chakraPhase < 1.5) {
        // hold1
        expand = 1.0;
    } else if (u.chakraPhase < 2.5) {
        // exhale
        expand = 1.0 - u.phaseProgress;
    } else {
        // hold2
        expand = 0.0;
    }
    // Cubic smoothstep for organic easing
    return expand * expand * (3.0 - 2.0 * expand);
}

// ----------------------------------------------------------------------------
// Human Figure
// ----------------------------------------------------------------------------

/// Enhanced human figure with breath-driven arms, posture variations,
/// theme-aware glow, and phase-colored hand energy.
fn humanFigure(uv: vec2<f32>, t: f32, breath: f32, expand: f32) -> vec3<f32> {
    var col = vec3<f32>(0.0);

    // Map incoming uv into figure-local space: scale 0.75, center (0, -0.05)
    let p = (uv - vec2<f32>(0.0, -0.05)) / 0.75;

    // Body anchor points
    let headPos  = vec2<f32>(0.0,  0.30);
    let chestPos = vec2<f32>(0.0,  0.10);
    let hipsPos  = vec2<f32>(0.0, -0.10);

    // Resolve current phase index for color lookups
    var phaseIdx: u32 = 0u;
    if (u.chakraPhase < 0.5)       { phaseIdx = 0u; }
    else if (u.chakraPhase < 1.5)  { phaseIdx = 1u; }
    else if (u.chakraPhase < 2.5)  { phaseIdx = 2u; }
    else                           { phaseIdx = 3u; }

    let phaseColors = array<vec3<f32>, 4>(
        vec3<f32>(0.20, 0.90, 1.00), // inhale  — cyan
        vec3<f32>(1.00, 0.90, 0.20), // hold1   — gold
        vec3<f32>(1.00, 0.40, 0.20), // exhale  — warm orange
        vec3<f32>(0.20, 0.90, 0.60)  // hold2   — emerald
    );
    let phaseColor = phaseColors[phaseIdx];

    // Theme-aware body tint
    var themeColor = vec3<f32>(0.85, 0.90, 1.00);
    if (u.theme < 0.5) {
        themeColor = vec3<f32>(0.75, 0.85, 1.00); // Cosmic
    } else if (u.theme < 1.5) {
        themeColor = vec3<f32>(1.00, 0.85, 0.45); // Golden
    } else {
        themeColor = vec3<f32>(0.45, 0.90, 1.00); // Ocean
    }

    // Subtle whole-body breathing pulse
    let figurePulse = 1.0 + 0.02 * u.intensity * sin(t * 2.0);

    // Posture mode flags
    let isLotus   = u.mandalaStyle < 0.5;
    let isTaiChi  = u.mandalaStyle > 1.5;

    // === ARM ANIMATION ======================================================
    var leftHand  = vec2<f32>(-0.25, -0.05);
    var rightHand = vec2<f32>( 0.25, -0.05);

    if (isTaiChi) {
        // Flowing tai chi pose: one arm up, one arm down
        let flow = sin(t * 0.8) * 0.03 * u.intensity;
        leftHand  = vec2<f32>(-0.25,  0.45 + flow);
        rightHand = vec2<f32>( 0.25, -0.15 - flow);
    } else {
        // Standard pranayama breath-driven arm movement
        if (u.chakraPhase < 0.5) {
            // Inhale: arms rise from sides to overhead
            let rise = smoothstep(0.0, 0.7, u.phaseProgress);
            leftHand  = mix(vec2<f32>(-0.25, -0.05), vec2<f32>(-0.20, 0.50), rise);
            rightHand = mix(vec2<f32>( 0.25, -0.05), vec2<f32>( 0.20, 0.50), rise);
        } else if (u.chakraPhase < 1.5) {
            // Hold1: arms fully extended overhead with micro-sway
            let sway = sin(t * 2.0) * 0.015 * u.intensity;
            leftHand  = vec2<f32>(-0.20 + sway, 0.50);
            rightHand = vec2<f32>( 0.20 - sway, 0.50);
        } else if (u.chakraPhase < 2.5) {
            // Exhale: arms lower back to sides
            let lower = smoothstep(0.0, 0.8, u.phaseProgress);
            leftHand  = mix(vec2<f32>(-0.20, 0.50), vec2<f32>(-0.25, -0.05), lower);
            rightHand = mix(vec2<f32>( 0.20, 0.50), vec2<f32>( 0.25, -0.05), lower);
        } else {
            // Hold2: arms at sides with gentle idle breathing motion
            let idle = sin(t * 1.5) * 0.01 * u.intensity;
            leftHand  = vec2<f32>(-0.25 + idle, -0.05);
            rightHand = vec2<f32>( 0.25 - idle, -0.05);
        }
    }

    // Global arm sway (applied unless tai chi, which already has flow)
    if (!isTaiChi) {
        let sway = sin(t * 1.5) * 0.01 * u.intensity;
        leftHand.x  += sway;
        rightHand.x -= sway;
    }

    // === HEAD ===============================================================
    let headD = sdCircle((p - headPos) / figurePulse, 0.055);
    col += exp(-abs(headD) * 35.0) * themeColor * 0.5;

    // === TORSO ==============================================================
    let chestD = sdCircle((p - chestPos) / figurePulse, 0.075);
    let hipsD  = sdCircle((p - hipsPos)  / figurePulse, 0.065);
    let torsoD = smin(chestD, hipsD, 0.08);
    col += exp(-abs(torsoD) * 30.0) * themeColor * 0.4;

    // === ARMS ===============================================================
    let leftArmD  = sdSegment(p, chestPos + vec2<f32>(-0.055, 0.04), leftHand)  - 0.022;
    let rightArmD = sdSegment(p, chestPos + vec2<f32>( 0.055, 0.04), rightHand) - 0.022;
    col += exp(-abs(leftArmD)  * 35.0) * themeColor * 0.45;
    col += exp(-abs(rightArmD) * 35.0) * themeColor * 0.45;

    // === HANDS — phase-colored glow =========================================
    let handGlow = 0.6 + 0.4 * u.intensity;
    let leftHandD  = sdCircle(p - leftHand,  0.025);
    let rightHandD = sdCircle(p - rightHand, 0.025);
    col += exp(-abs(leftHandD)  * 45.0) * phaseColor * handGlow;
    col += exp(-abs(rightHandD) * 45.0) * phaseColor * handGlow;

    // === LEGS — posture variants ============================================
    if (isLotus) {
        // Cross-legged meditation seat (padmasana approximation)
        let leftThigh  = sdSegment(p, hipsPos + vec2<f32>(-0.03, -0.02), vec2<f32>(-0.18, -0.22)) - 0.025;
        let leftShin   = sdSegment(p, vec2<f32>(-0.18, -0.22), vec2<f32>( 0.04, -0.28)) - 0.022;
        let rightThigh = sdSegment(p, hipsPos + vec2<f32>( 0.03, -0.02), vec2<f32>( 0.18, -0.22)) - 0.025;
        let rightShin  = sdSegment(p, vec2<f32>( 0.18, -0.22), vec2<f32>(-0.04, -0.28)) - 0.022;
        col += exp(-abs(leftThigh)  * 35.0) * themeColor * 0.40;
        col += exp(-abs(leftShin)   * 35.0) * themeColor * 0.35;
        col += exp(-abs(rightThigh) * 35.0) * themeColor * 0.40;
        col += exp(-abs(rightShin)  * 35.0) * themeColor * 0.35;
    } else if (isTaiChi) {
        // Tai chi stance: one leg forward, one back
        let leftLeg  = sdSegment(p, hipsPos, vec2<f32>(-0.22, -0.42)) - 0.028;
        let rightLeg = sdSegment(p, hipsPos, vec2<f32>( 0.18, -0.35)) - 0.028;
        col += exp(-abs(leftLeg)  * 35.0) * themeColor * 0.40;
        col += exp(-abs(rightLeg) * 35.0) * themeColor * 0.40;
    } else {
        // Standing legs
        let leftLeg  = sdSegment(p, hipsPos, vec2<f32>(-0.12, -0.45)) - 0.028;
        let rightLeg = sdSegment(p, hipsPos, vec2<f32>( 0.12, -0.45)) - 0.028;
        col += exp(-abs(leftLeg)  * 35.0) * themeColor * 0.40;
        col += exp(-abs(rightLeg) * 35.0) * themeColor * 0.40;
    }

    // === BODY GLOW ==========================================================
    let bodyCenterD = sdCircle(p - vec2<f32>(0.0, 0.05), 0.15);
    col += exp(-abs(bodyCenterD) * 12.0) * phaseColor * 0.12 * (0.5 + expand * 0.5);

    return col;
}

// ----------------------------------------------------------------------------
// Chakra Energy Column
// ----------------------------------------------------------------------------

/// 7-chakra energy system with wave propagation, phase-tinted hues,
/// Sushumna nadi beam, and inter-chakra energy flow.
fn chakraColumn(uv: vec2<f32>, t: f32, breath: f32, expand: f32) -> vec3<f32> {
    var col = vec3<f32>(0.0);

    // Align with scaled figure
    let p = (uv - vec2<f32>(0.0, -0.05)) / 0.75;

    // Chakra data: root → crown
    let positions = array<f32, 7>(-0.35, -0.20, -0.05, 0.10, 0.25, 0.40, 0.55);
    let sizes     = array<f32, 7>( 0.04,  0.035, 0.045, 0.04, 0.035, 0.03, 0.05);
    let hues      = array<f32, 7>( 0.00,  0.08,  0.16,  0.33, 0.58,  0.75, 0.83);

    // Phase-based global hue shift (warm gold on inhale, cool cyan on exhale)
    var hueShift: f32 = 0.0;
    if (u.chakraPhase < 0.5) {
        hueShift = 0.05 * u.phaseProgress;
    } else if (u.chakraPhase < 1.5) {
        hueShift = 0.05;
    } else if (u.chakraPhase < 2.5) {
        hueShift = 0.05 - 0.13 * u.phaseProgress;
    } else {
        hueShift = -0.08;
    }

    let intensityMult = 1.0 + 0.4 * u.intensity;
    let globalPulse   = 1.0 + 0.1 * sin(t * 2.0) * u.intensity;

    for (var i: u32 = 0u; i < 7u; i++) {
        let fIdx = f32(i);
        let pos  = vec2<f32>(0.0, positions[i]);
        let dist = length(p - pos);
        let baseRadius = sizes[i] * globalPulse;

        // --- Wave propagation per phase ------------------------------------
        var activation: f32 = 0.0;
        var pulse: f32 = 1.0;

        if (u.chakraPhase < 0.5) {
            // Inhale: bottom-up activation wave (0.15s stagger per chakra)
            let delay = fIdx * 0.15;
            let wavePos = u.phaseProgress * 1.5 - delay;
            if (wavePos > 0.0) {
                activation = 0.3 + 0.7 * smoothstep(0.0, 0.3, wavePos);
                activation = min(activation, 1.0);
            } else {
                activation = 0.3;
            }
            pulse = 1.0 + sin(t * 3.0 + fIdx * 0.5) * 0.05;
        } else if (u.chakraPhase < 1.5) {
            // Hold1: all chakras peak with gentle unified pulse
            activation = 1.0;
            pulse = 1.0 + sin(t * 2.0) * 0.1;
        } else if (u.chakraPhase < 2.5) {
            // Exhale: top-down release wave
            let reverseIdx = 6.0 - fIdx;
            let delay = reverseIdx * 0.15;
            let wavePos = u.phaseProgress * 1.5 - delay;
            if (wavePos > 0.0) {
                activation = 1.0 - 0.6 * smoothstep(0.0, 0.3, wavePos);
                activation = max(activation, 0.4);
            } else {
                activation = 1.0;
            }
            pulse = 1.0 + sin(t * 1.5 + fIdx * 0.3) * 0.05;
        } else {
            // Hold2: minimal resting glow
            activation = 0.2;
            pulse = 1.0 + sin(t * 1.0) * 0.05;
        }

        let radius     = baseRadius * (0.5 + 0.5 * activation);
        let glowRadius = radius + 0.15 + 0.1 * activation;
        let glow       = smoothstep(glowRadius, radius, dist);

        // Outer ring around active chakra
        let ringDist   = abs(dist - radius * 1.5);
        let ringGlow   = smoothstep(0.08, 0.0, ringDist) * 0.3 * activation;

        let baseHue = hues[i];
        var shiftedHue = baseHue + hueShift;
        shiftedHue = shiftedHue - floor(shiftedHue);

        var saturation: f32 = 0.9;
        var value: f32 = activation * pulse;
        if (u.chakraPhase > 0.5 && u.chakraPhase < 1.5) {
            saturation = 1.0;
            value = min(value * 1.1, 1.0);
        }

        let chakraCol = hsv2rgb(shiftedHue, saturation, value);
        col += chakraCol * glow;
        col += chakraCol * ringGlow;

        // Energy flow gradient between adjacent chakras during inhale
        if (u.chakraPhase < 0.5 && i < 6u) {
            let nextPos = vec2<f32>(0.0, positions[i + 1u]);
            let midPos  = (pos + nextPos) * 0.5;
            let midDist = length(p - midPos);
            let flowGlow = exp(-midDist * 25.0) * u.phaseProgress * 0.25;
            col += hsv2rgb(shiftedHue, 0.7, 1.0) * flowGlow;
        }
    }

    // --- Sushumna nadi (central energy channel) -----------------------------
    if (p.y > -0.5 && p.y < 0.65) {
        let nadiD = abs(p.x) - 0.006;
        let nadiPulse = 1.0 + 0.2 * u.intensity * sin(t * 3.0);

        // Phase-tint the central beam
        var nadiColor = vec3<f32>(0.9, 0.95, 1.0);
        if (u.chakraPhase < 0.5) {
            nadiColor = mix(nadiColor, vec3<f32>(1.0, 0.85, 0.4), u.phaseProgress * 0.5);
        } else if (u.chakraPhase > 1.5 && u.chakraPhase < 2.5) {
            nadiColor = mix(vec3<f32>(1.0, 0.85, 0.4), vec3<f32>(0.4, 0.85, 1.0), u.phaseProgress * 0.5);
        }

        col += exp(-abs(nadiD) * 50.0) * nadiColor * 0.3 * nadiPulse;
    }

    col *= intensityMult;
    return col;
}

// ----------------------------------------------------------------------------
// Progress Ring
// ----------------------------------------------------------------------------

/// Dual-ring progress indicator with phase arc, cycle arc, and
/// subtle sacred geometry at the center.
fn progressRing(uv: vec2<f32>, breath: f32, expand: f32) -> vec3<f32> {
    var col = vec3<f32>(0.0);

    let r = length(uv);
    let a = atan2(uv.y, uv.x);
    let TAU = 6.28318530718;
    let PI  = 3.14159265359;

    // Phase index & colors
    var phaseIdx: u32 = 0u;
    if (u.chakraPhase < 0.5)       { phaseIdx = 0u; }
    else if (u.chakraPhase < 1.5)  { phaseIdx = 1u; }
    else if (u.chakraPhase < 2.5)  { phaseIdx = 2u; }
    else                           { phaseIdx = 3u; }

    let phaseColors = array<vec3<f32>, 4>(
        vec3<f32>(0.20, 0.90, 1.00),
        vec3<f32>(1.00, 0.90, 0.20),
        vec3<f32>(1.00, 0.40, 0.20),
        vec3<f32>(0.20, 0.90, 0.60)
    );
    let phaseColor  = phaseColors[phaseIdx];
    let glowStrength = 0.8 + 0.4 * u.intensity;

    // Normalised angle 0..1 starting from left (-PI)
    let normalizedAngle = (a + PI) / TAU;

    // === OUTER RING — current breath phase progress =========================
    let outerRingD = abs(r - 0.65) - 0.015;
    let progressAngle = u.phaseProgress;
    let inArc = select(0.0, 1.0, normalizedAngle < progressAngle);

    col += exp(-abs(outerRingD) * 50.0) * phaseColor * glowStrength * inArc;
    col += exp(-abs(outerRingD) * 20.0) * phaseColor * 0.15; // dim baseline ring

    // Pulsing glow dot at the progress tip
    let progressPos = vec2<f32>(
        cos(progressAngle * TAU - PI),
        sin(progressAngle * TAU - PI)
    ) * 0.65;
    let glowD = length(uv - progressPos);
    let pointGlow = 0.8 + 0.6 * sin(u.time * 4.0) * u.intensity;
    col += exp(-glowD * 30.0) * phaseColor * pointGlow;

    // === INNER RING — total breath cycle progress ===========================
    let innerRingD = abs(r - 0.52) - 0.010;
    let cycleAngle = u.breathPhase; // 0..1 mapped to full circle
    let inCycleArc = select(0.0, 1.0, normalizedAngle < cycleAngle);

    var cycleColor = vec3<f32>(0.60, 0.70, 1.00);
    if (u.theme < 0.5) {
        cycleColor = vec3<f32>(0.50, 0.70, 1.00);
    } else if (u.theme < 1.5) {
        cycleColor = vec3<f32>(1.00, 0.80, 0.40);
    } else {
        cycleColor = vec3<f32>(0.40, 0.85, 0.90);
    }

    col += exp(-abs(innerRingD) * 55.0) * cycleColor * 0.70 * inCycleArc;
    col += exp(-abs(innerRingD) * 20.0) * cycleColor * 0.10; // faint base

    // Cycle dot
    let cyclePos = vec2<f32>(
        cos(cycleAngle * TAU - PI),
        sin(cycleAngle * TAU - PI)
    ) * 0.52;
    let cycleGlowD = length(uv - cyclePos);
    col += exp(-cycleGlowD * 35.0) * cycleColor * 0.6;

    // === SACRED GEOMETRY AT CENTER ==========================================
    // Small rotating hexagon ring
    let hexAngle = atan2(uv.y, uv.x);
    let hexPattern = abs(sin(hexAngle * 6.0 + u.time * 0.3)) * 0.5 + 0.5;
    let hexD = abs(r - 0.08) - 0.004;
    col += exp(-abs(hexD) * 80.0) * phaseColor * 0.3 * hexPattern;

    // Central lotus seed point
    let seedD = sdCircle(uv, 0.025);
    col += exp(-abs(seedD) * 60.0) * vec3<f32>(1.0, 0.95, 0.8) * 0.4;

    return col;
}

// ----------------------------------------------------------------------------
// Figure Aura
// ----------------------------------------------------------------------------

/// Expanding/contracting elliptical aura with nested rotating energy shells
/// and breath-phase color shifting.
fn figureAura(uv: vec2<f32>, t: f32, breath: f32, expand: f32) -> vec3<f32> {
    var col = vec3<f32>(0.0);

    // Transform into figure-local coordinates
    let p = (uv - vec2<f32>(0.0, -0.05)) / 0.75;

    // Breath-phase aura color
    var auraColor = vec3<f32>(0.2, 0.85, 1.0);
    if (u.chakraPhase < 0.5) {
        auraColor = mix(vec3<f32>(0.2, 0.60, 1.0), vec3<f32>(0.3, 0.90, 1.0), u.phaseProgress);
    } else if (u.chakraPhase < 1.5) {
        auraColor = vec3<f32>(1.0, 0.85, 0.3);
    } else if (u.chakraPhase < 2.5) {
        auraColor = mix(vec3<f32>(1.0, 0.60, 0.3), vec3<f32>(0.3, 0.80, 0.9), u.phaseProgress);
    } else {
        auraColor = vec3<f32>(0.3, 0.90, 0.7);
    }

    // Theme tint
    if (u.theme < 0.5) {
        auraColor *= vec3<f32>(0.8, 0.9, 1.0);
    } else if (u.theme < 1.5) {
        auraColor *= vec3<f32>(1.1, 0.9, 0.6);
    } else {
        auraColor *= vec3<f32>(0.7, 1.0, 1.0);
    }

    // Main elliptical aura shells (expand/contract with breath)
    let ellipse1 = length(p * vec2<f32>(1.0, 1.35)) - (0.28 + expand * 0.08);
    let ellipse2 = length(p * vec2<f32>(1.0, 1.35)) - (0.38 + expand * 0.10);
    let ellipse3 = length(p * vec2<f32>(1.0, 1.35)) - (0.48 + expand * 0.12);

    col += exp(-abs(ellipse1) * 8.0) * auraColor * 0.12 * (0.6 + expand * 0.4);
    col += exp(-abs(ellipse2) * 6.0) * auraColor * 0.08 * (0.5 + expand * 0.3);
    col += exp(-abs(ellipse3) * 4.0) * auraColor * 0.05 * (0.4 + expand * 0.2);

    // Rotating nested energy shells (2-3 ellipses at different angles)
    let shellRot1 = rot2(t * 0.25 + breath * 0.5);
    let shellRot2 = rot2(-t * 0.18 - breath * 0.3);
    let shellRot3 = rot2(t * 0.12);

    let s1 = length((shellRot1 * p) * vec2<f32>(1.0, 1.5)) - 0.35;
    let s2 = length((shellRot2 * p) * vec2<f32>(1.3, 1.0)) - 0.40;
    let s3 = length((shellRot3 * p) * vec2<f32>(1.0, 1.2)) - 0.45;

    col += exp(-abs(s1) * 10.0) * auraColor * 0.06;
    col += exp(-abs(s2) * 10.0) * auraColor * 0.05;
    col += exp(-abs(s3) * 10.0) * auraColor * 0.04;

    // Bottom-up energy tendrils during inhale
    if (u.chakraPhase < 0.5) {
        let tendril = sin(p.x * 12.0 + t * 2.0) * 0.5 + 0.5;
        let tendrilMask = smoothstep(-0.5, 0.5, p.y) * smoothstep(0.5, -0.2, p.y);
        col += auraColor * tendril * tendrilMask * u.phaseProgress * 0.08 * exp(-abs(p.x) * 3.0);
    }

    return col;
}
