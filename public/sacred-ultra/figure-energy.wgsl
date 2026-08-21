// ============================================================================
// MODULE 3 — HUMAN FIGURE & ENERGY SYSTEMS (Agent: Figure & Energy Specialist)
// ============================================================================

// Figure pose enum (matches SessionMode.figurePose from the React app)
//   0 = seated lotus (padmasana)
//   1 = standing tadasana / mountain arms overhead
//   2 = tai-chi flowing single whip
//   3 = heart-opening arms-wide
//   4 = chinmudra seated (wisdom seal)
//   5 = warrior II (virabhadrasana)
//   6 = tree pose (vrksasana)

fn poseAwareHands(t: f32, expand: f32) -> array<vec2<f32>, 2> {
    var hands: array<vec2<f32>, 2>;
    let pose = i32(u.figurePose + 0.5);
    let pp = u.phaseProgress;
    let ease = pp * pp * (3.0 - 2.0 * pp);
    let animAmp = 0.01 * u.intensity * (0.6 + 0.4 * u.strengthLevel);

    var leftHand  = vec2<f32>(-0.25, -0.05);
    var rightHand = vec2<f32>( 0.25, -0.05);

    if (pose == 0) {
        // Lotus: arms rise from the lap to overhead
        if (u.chakraPhase < 0.5) {
            let overshoot = 0.015 * sin(pp * PI) * (0.5 + 0.5 * u.intensity);
            leftHand  = mix(vec2<f32>(-0.25, -0.05), vec2<f32>(-0.20, 0.52), ease) + vec2<f32>(0.0, overshoot);
            rightHand = mix(vec2<f32>( 0.25, -0.05), vec2<f32>( 0.20, 0.52), ease) + vec2<f32>(0.0, overshoot);
        } else if (u.chakraPhase < 1.5) {
            let sway = sin(t * 2.0) * animAmp;
            let pulse = 1.0 + 0.02 * sin(t * 3.0) * u.intensity;
            leftHand  = vec2<f32>(-0.20 + sway, 0.52 * pulse);
            rightHand = vec2<f32>( 0.20 - sway, 0.52 * pulse);
        } else if (u.chakraPhase < 2.5) {
            let settle = 0.012 * sin(pp * PI) * (0.5 + 0.5 * u.intensity);
            leftHand  = mix(vec2<f32>(-0.20, 0.52), vec2<f32>(-0.25, -0.05), ease) - vec2<f32>(0.0, settle);
            rightHand = mix(vec2<f32>( 0.20, 0.52), vec2<f32>( 0.25, -0.05), ease) - vec2<f32>(0.0, settle);
        } else {
            let idle = sin(t * 1.5) * animAmp;
            leftHand  = vec2<f32>(-0.25 + idle, -0.05);
            rightHand = vec2<f32>( 0.25 - idle, -0.05);
        }
    } else if (pose == 1) {
        // Tadasana: arms straight up, close to ears
        if (u.chakraPhase < 0.5) {
            leftHand  = mix(vec2<f32>(-0.25, -0.05), vec2<f32>(-0.10, 0.62), ease);
            rightHand = mix(vec2<f32>( 0.25, -0.05), vec2<f32>( 0.10, 0.62), ease);
        } else if (u.chakraPhase < 1.5) {
            let sway = sin(t * 2.0) * animAmp;
            leftHand  = vec2<f32>(-0.10 + sway, 0.62);
            rightHand = vec2<f32>( 0.10 - sway, 0.62);
        } else if (u.chakraPhase < 2.5) {
            leftHand  = mix(vec2<f32>(-0.10, 0.62), vec2<f32>(-0.25, -0.05), ease);
            rightHand = mix(vec2<f32>( 0.10, 0.62), vec2<f32>( 0.25, -0.05), ease);
        } else {
            let idle = sin(t * 1.5) * animAmp;
            leftHand  = vec2<f32>(-0.25 + idle, -0.05);
            rightHand = vec2<f32>( 0.25 - idle, -0.05);
        }
    } else if (pose == 2) {
        // Tai-chi single whip: one hand high and open, one low and rounded
        let flow = sin(t * 0.8 + expand * PI) * 0.04 * u.intensity;
        if (u.chakraPhase < 0.5) {
            leftHand  = mix(vec2<f32>(-0.25, -0.05), vec2<f32>(-0.32, 0.48), ease) + vec2<f32>(0.0, flow);
            rightHand = mix(vec2<f32>( 0.25, -0.05), vec2<f32>( 0.22, 0.05), ease) - vec2<f32>(0.0, flow);
        } else if (u.chakraPhase < 1.5) {
            leftHand  = vec2<f32>(-0.32 + flow, 0.48);
            rightHand = vec2<f32>( 0.22 - flow, 0.05);
        } else if (u.chakraPhase < 2.5) {
            leftHand  = mix(vec2<f32>(-0.32, 0.48), vec2<f32>(-0.25, -0.05), ease) - vec2<f32>(0.0, flow);
            rightHand = mix(vec2<f32>( 0.22, 0.05), vec2<f32>( 0.25, -0.05), ease) + vec2<f32>(0.0, flow);
        } else {
            let idle = sin(t * 1.5) * animAmp;
            leftHand  = vec2<f32>(-0.25 + idle, -0.05);
            rightHand = vec2<f32>( 0.25 - idle, -0.05);
        }
    } else if (pose == 3) {
        // Heart-opening: arms sweep wide, proud chest
        if (u.chakraPhase < 0.5) {
            leftHand  = mix(vec2<f32>(-0.25, -0.05), vec2<f32>(-0.65, 0.32), ease);
            rightHand = mix(vec2<f32>( 0.25, -0.05), vec2<f32>( 0.65, 0.32), ease);
        } else if (u.chakraPhase < 1.5) {
            let pulse = 1.0 + 0.02 * sin(t * 2.5) * u.intensity;
            leftHand  = vec2<f32>(-0.65, 0.32 * pulse);
            rightHand = vec2<f32>( 0.65, 0.32 * pulse);
        } else if (u.chakraPhase < 2.5) {
            leftHand  = mix(vec2<f32>(-0.65, 0.32), vec2<f32>(-0.25, -0.05), ease);
            rightHand = mix(vec2<f32>( 0.65, 0.32), vec2<f32>( 0.25, -0.05), ease);
        } else {
            let idle = sin(t * 1.5) * animAmp;
            leftHand  = vec2<f32>(-0.25 + idle, -0.05);
            rightHand = vec2<f32>( 0.25 - idle, -0.05);
        }
    } else if (pose == 4) {
        // Chinmudra: hands rest on knees, gentle breath micro-movement
        let breathe = 0.02 * sin(pp * PI) * select(0.0, 1.0, u.chakraPhase < 1.5);
        leftHand  = vec2<f32>(-0.22, -0.22 + breathe);
        rightHand = vec2<f32>( 0.22, -0.22 + breathe);
    } else if (pose == 5) {
        // Warrior II: arms horizontal, strong and wide
        if (u.chakraPhase < 0.5) {
            let reach = ease * 0.20;
            leftHand  = vec2<f32>(-0.62 - reach, 0.30);
            rightHand = vec2<f32>( 0.62 + reach, 0.30);
        } else if (u.chakraPhase < 1.5) {
            let sway = sin(t * 2.0) * animAmp;
            leftHand  = vec2<f32>(-0.62 + sway, 0.30);
            rightHand = vec2<f32>( 0.62 - sway, 0.30);
        } else if (u.chakraPhase < 2.5) {
            let reach = ease * 0.20;
            leftHand  = vec2<f32>(-0.62 + reach, 0.30);
            rightHand = vec2<f32>( 0.62 - reach, 0.30);
        } else {
            let idle = sin(t * 1.5) * animAmp;
            leftHand  = vec2<f32>(-0.62 + idle, 0.30);
            rightHand = vec2<f32>( 0.62 - idle, 0.30);
        }
    } else if (pose == 6) {
        // Tree pose: hands at heart center, subtle rise with inhale
        if (u.chakraPhase < 0.5) {
            leftHand  = mix(vec2<f32>(-0.25, -0.05), vec2<f32>(-0.08, 0.28), ease);
            rightHand = mix(vec2<f32>( 0.25, -0.05), vec2<f32>( 0.08, 0.28), ease);
        } else if (u.chakraPhase < 1.5) {
            let sway = sin(t * 1.8) * animAmp * 0.6;
            leftHand  = vec2<f32>(-0.08 + sway, 0.28);
            rightHand = vec2<f32>( 0.08 - sway, 0.28);
        } else if (u.chakraPhase < 2.5) {
            leftHand  = mix(vec2<f32>(-0.08, 0.28), vec2<f32>(-0.25, -0.05), ease);
            rightHand = mix(vec2<f32>( 0.08, 0.28), vec2<f32>( 0.25, -0.05), ease);
        } else {
            let idle = sin(t * 1.5) * animAmp;
            leftHand  = vec2<f32>(-0.25 + idle, -0.05);
            rightHand = vec2<f32>( 0.25 - idle, -0.05);
        }
    }

    if (pose != 2) {
        let sway = sin(t * 1.5) * animAmp;
        leftHand.x  += sway;
        rightHand.x -= sway;
    }

    hands[0] = leftHand;
    hands[1] = rightHand;
    return hands;
}

// ---------------------------------------------------------------------------
// Graceful human figure helpers
// ---------------------------------------------------------------------------

fn handMudra(
    p: vec2<f32>, handPos: vec2<f32>, side: f32,
    t: f32, expand: f32, phaseColor: vec3<f32>
) -> vec3<f32> {
    var col = vec3<f32>(0.0);
    let strengthBase = smoothstep(1.0, 2.0, u.strengthLevel) + 0.35 * smoothstep(0.75, 1.0, u.intensity);
    let holdGlow = select(0.0, 1.0, u.chakraPhase > 0.5 && u.chakraPhase < 2.5);
    let strength = strengthBase + holdGlow * 0.25;
    if (strength < 0.05) { return col; }

    // Tiny thumb-to-index circle (chinmudra / finger presence)
    let thumbTip = handPos + vec2<f32>(side * 0.011, -0.005);
    let indexTip = handPos + vec2<f32>(side * 0.007,  0.009);
    let mudraCenter = (thumbTip + indexTip) * 0.5;
    let mudraD = abs(sdCircle(p - mudraCenter, 0.0085)) - 0.0018;
    col += exp(-abs(mudraD) * 130.0) * phaseColor * 0.55 * strength;

    // Subtle palm arc
    let palmA = handPos + vec2<f32>(side * 0.016, 0.002);
    let palmB = handPos + vec2<f32>(side * 0.010, 0.013);
    let palmD = sdSegment(p, palmA, palmB) - 0.0025;
    col += exp(-abs(palmD) * 110.0) * phaseColor * 0.30 * strength;

    return col;
}

fn ribcageBreath(
    p: vec2<f32>, chestPos: vec2<f32>,
    expand: f32, themeColor: vec3<f32>
) -> vec3<f32> {
    var col = vec3<f32>(0.0);
    let breathAmp = 0.005 * expand;
    let leftRib  = sdSegment(p, chestPos + vec2<f32>(-0.055 - breathAmp, 0.020),
                                   chestPos + vec2<f32>(-0.085 - breathAmp, -0.040)) - 0.018;
    let rightRib = sdSegment(p, chestPos + vec2<f32>( 0.055 + breathAmp, 0.020),
                                   chestPos + vec2<f32>( 0.085 + breathAmp, -0.040)) - 0.018;
    col += exp(-abs(leftRib)  * 45.0) * themeColor * 0.16;
    col += exp(-abs(rightRib) * 45.0) * themeColor * 0.16;
    return col;
}

fn flowingRobe(
    p: vec2<f32>, chestPos: vec2<f32>, hipsPos: vec2<f32>,
    hands: array<vec2<f32>, 2>, expand: f32, t: f32,
    themeColor: vec3<f32>
) -> vec3<f32> {
    var col = vec3<f32>(0.0);
    let robeStrength = smoothstep(0.8, 2.0, u.strengthLevel) + 0.22 * u.intensity;
    if (robeStrength < 0.05) { return col; }

    let sway = sin(t * 1.2) * 0.006 * u.intensity;
    let armLift = max(0.0, (hands[0].y + hands[1].y) * 0.5 + 0.05);

    // Inner robe lines hugging torso
    let leftInner  = sdSegment(p, chestPos + vec2<f32>(-0.085 + sway, 0.015),
                                     hipsPos + vec2<f32>(-0.075, 0.0)) - 0.032;
    let rightInner = sdSegment(p, chestPos + vec2<f32>( 0.085 - sway, 0.015),
                                     hipsPos + vec2<f32>( 0.075, 0.0)) - 0.032;
    col += exp(-abs(leftInner)  * 32.0) * themeColor * 0.13 * robeStrength;
    col += exp(-abs(rightInner) * 32.0) * themeColor * 0.13 * robeStrength;

    // Outer robe lines that drift with arm motion
    let leftOuter  = sdSegment(p, chestPos + vec2<f32>(-0.115, -0.005),
                                     hipsPos + vec2<f32>(-0.125 + armLift * 0.04, -0.055)) - 0.022;
    let rightOuter = sdSegment(p, chestPos + vec2<f32>( 0.115, -0.005),
                                     hipsPos + vec2<f32>( 0.125 - armLift * 0.04, -0.055)) - 0.022;
    col += exp(-abs(leftOuter)  * 30.0) * themeColor * 0.09 * robeStrength;
    col += exp(-abs(rightOuter) * 30.0) * themeColor * 0.09 * robeStrength;

    return col;
}

fn lotusSeat(
    p: vec2<f32>, hipsPos: vec2<f32>,
    expand: f32, themeColor: vec3<f32>
) -> vec3<f32> {
    var col = vec3<f32>(0.0);

    // Overlapping curved thighs and shins
    let leftThigh  = sdSegment(p, hipsPos + vec2<f32>(-0.03, -0.02), vec2<f32>(-0.18, -0.22)) - 0.028;
    let leftShin   = sdSegment(p, vec2<f32>(-0.18, -0.22), vec2<f32>( 0.04, -0.28)) - 0.024;
    let rightThigh = sdSegment(p, hipsPos + vec2<f32>( 0.03, -0.02), vec2<f32>( 0.18, -0.22)) - 0.028;
    let rightShin  = sdSegment(p, vec2<f32>( 0.18, -0.22), vec2<f32>(-0.04, -0.28)) - 0.024;
    col += exp(-abs(leftThigh)  * 35.0) * themeColor * 0.42;
    col += exp(-abs(leftShin)   * 35.0) * themeColor * 0.38;
    col += exp(-abs(rightThigh) * 35.0) * themeColor * 0.42;
    col += exp(-abs(rightShin)  * 35.0) * themeColor * 0.38;

    // Subtle petal-like platform under hips
    let platformD = abs(sdCircle(p - (hipsPos + vec2<f32>(0.0, -0.02)), 0.13 + expand * 0.008)) - 0.014;
    col += exp(-abs(platformD) * 55.0) * themeColor * 0.22;

    // Knee highlights
    let leftKnee  = sdCircle(p - vec2<f32>(-0.18, -0.22), 0.018);
    let rightKnee = sdCircle(p - vec2<f32>( 0.18, -0.22), 0.018);
    col += exp(-abs(leftKnee)  * 60.0) * themeColor * 0.18;
    col += exp(-abs(rightKnee) * 60.0) * themeColor * 0.18;

    return col;
}

fn groundedFeet(
    p: vec2<f32>, footL: vec2<f32>, footR: vec2<f32>,
    pose: i32, themeColor: vec3<f32>
) -> vec3<f32> {
    var col = vec3<f32>(0.0);
    if (pose == 6) {
        // Tree pose: rooted foot + lifted-heel balance line
        let rooted = sdSegment(p, footL, footL + vec2<f32>(-0.045, 0.0)) - 0.020;
        let lifted = sdSegment(p, footR, footR + vec2<f32>( 0.025, 0.0)) - 0.014;
        col += exp(-abs(rooted) * 42.0) * themeColor * 0.32;
        col += exp(-abs(lifted) * 42.0) * themeColor * 0.22;
    } else {
        // Grounded foot lines
        let leftFoot  = sdSegment(p, footL, footL + vec2<f32>(-0.055, 0.0)) - 0.032;
        let rightFoot = sdSegment(p, footR, footR + vec2<f32>( 0.055, 0.0)) - 0.032;
        col += exp(-abs(leftFoot)  * 40.0) * themeColor * 0.28;
        col += exp(-abs(rightFoot) * 40.0) * themeColor * 0.28;
    }
    return col;
}

fn sushumnaNadi(
    p: vec2<f32>, expand: f32, t: f32
) -> vec3<f32> {
    var col = vec3<f32>(0.0);
    if (p.y < -0.52 || p.y > 0.62) { return col; }

    let nadiD = abs(p.x) - 0.0035;
    let nadiPulse = 1.0 + 0.2 * u.intensity * sin(t * 3.0);
    var nadiColor = vec3<f32>(0.9, 0.95, 1.0);

    if (u.chakraFocus >= 0.0) {
        nadiColor = mix(nadiColor, chakraColor(u.chakraFocus), 0.45);
    } else if (u.chakraPhase < 0.5) {
        nadiColor = mix(nadiColor, vec3<f32>(1.0, 0.85, 0.4), u.phaseProgress * 0.35);
    } else if (u.chakraPhase > 1.5 && u.chakraPhase < 2.5) {
        nadiColor = mix(vec3<f32>(1.0, 0.85, 0.4), vec3<f32>(0.4, 0.85, 1.0), u.phaseProgress * 0.35);
    }

    col += exp(-abs(nadiD) * 65.0) * nadiColor * 0.32 * nadiPulse * (0.6 + expand * 0.4);
    return col;
}

fn humanFigure(uv: vec2<f32>, t: f32, breath: f32, expand: f32) -> vec3<f32> {
    var col = vec3<f32>(0.0);
    let p = (uv - vec2<f32>(0.0, -0.05)) / 0.75;

    let phaseColor = focusedBreathColor();

    var themeColor = vec3<f32>(0.85, 0.90, 1.00);
    if (u.theme < 0.5) {
        themeColor = vec3<f32>(0.75, 0.85, 1.00);
    } else if (u.theme < 1.5) {
        themeColor = vec3<f32>(1.00, 0.85, 0.45);
    } else {
        themeColor = vec3<f32>(0.45, 0.90, 1.00);
    }

    let figurePulse = 1.0 + 0.02 * u.intensity * sin(t * 2.0);
    let pose = i32(u.figurePose + 0.5);
    let hands = poseAwareHands(t, expand);

    // Arm height drives head drishti tilt
    let armHeight = (hands[0].y + hands[1].y) * 0.5 - 0.25;

    let headBase  = vec2<f32>(0.0, 0.30 + expand * 0.012);
    let chestPos  = vec2<f32>(0.0, 0.10 + expand * 0.015);
    let hipsPos   = vec2<f32>(0.0, -0.10);
    let shoulderY = 0.04 + expand * 0.012;
    let shoulderL = chestPos + vec2<f32>(-0.055, shoulderY);
    let shoulderR = chestPos + vec2<f32>( 0.055, shoulderY);

    // Head with subtle tilt & chin tuck
    let tilt = clamp(armHeight * 0.05, -0.010, 0.010) * (0.5 + 0.5 * sin(t * 0.7));
    let headPos = headBase + vec2<f32>(tilt, 0.0);
    let headD = sdCircle((p - headPos) / figurePulse, 0.055);
    col += exp(-abs(headD) * 35.0) * themeColor * 0.5;

    let chinD = sdCircle(p - (headPos + vec2<f32>(tilt * 0.5, -0.046)), 0.018);
    col += exp(-abs(chinD) * 55.0) * themeColor * 0.20;

    // Torso — chest expands on inhale, hips stay grounded
    let chestD = sdCircle((p - chestPos) / figurePulse, 0.075 * (1.0 + expand * 0.12));
    let hipsD  = sdCircle((p - hipsPos)  / figurePulse, 0.065 * (1.0 + expand * 0.04));
    let torsoD = smin(chestD, hipsD, 0.08);
    col += exp(-abs(torsoD) * 30.0) * themeColor * 0.4;

    // Independent ribcage breath + shoulder lift
    col += ribcageBreath(p, chestPos, expand, themeColor);

    // Flowing robe silhouette
    col += flowingRobe(p, chestPos, hipsPos, hands, expand, t, themeColor);

    // Arms
    let leftArmD  = sdSegment(p, shoulderL, hands[0]) - 0.022;
    let rightArmD = sdSegment(p, shoulderR, hands[1]) - 0.022;
    col += exp(-abs(leftArmD)  * 35.0) * themeColor * 0.45;
    col += exp(-abs(rightArmD) * 35.0) * themeColor * 0.45;

    // Hands + mudra detail
    let handGlow = 0.6 + 0.4 * u.intensity;
    let leftHandD  = sdCircle(p - hands[0],  0.025);
    let rightHandD = sdCircle(p - hands[1], 0.025);
    col += exp(-abs(leftHandD)  * 45.0) * phaseColor * handGlow;
    col += exp(-abs(rightHandD) * 45.0) * phaseColor * handGlow;
    col += handMudra(p, hands[0], -1.0, t, expand, phaseColor);
    col += handMudra(p, hands[1],  1.0, t, expand, phaseColor);

    // Legs, seat, and feet depend on pose
    if (pose == 0 || pose == 4) {
        col += lotusSeat(p, hipsPos, expand, themeColor);
    } else {
        var footL = vec2<f32>(0.0);
        var footR = vec2<f32>(0.0);
        if (pose == 1) {
            footL = vec2<f32>(-0.10, -0.50);
            footR = vec2<f32>( 0.10, -0.50);
            let leftLeg  = sdSegment(p, hipsPos, footL) - 0.028;
            let rightLeg = sdSegment(p, hipsPos, footR) - 0.028;
            col += exp(-abs(leftLeg)  * 35.0) * themeColor * 0.40;
            col += exp(-abs(rightLeg) * 35.0) * themeColor * 0.40;
        } else if (pose == 2) {
            footL = vec2<f32>(-0.22, -0.42);
            footR = vec2<f32>( 0.18, -0.35);
            let leftLeg  = sdSegment(p, hipsPos, footL) - 0.028;
            let rightLeg = sdSegment(p, hipsPos, footR) - 0.028;
            col += exp(-abs(leftLeg)  * 35.0) * themeColor * 0.40;
            col += exp(-abs(rightLeg) * 35.0) * themeColor * 0.40;
        } else if (pose == 3) {
            footL = vec2<f32>(-0.13, -0.48);
            footR = vec2<f32>( 0.13, -0.48);
            let leftLeg  = sdSegment(p, hipsPos, footL) - 0.028;
            let rightLeg = sdSegment(p, hipsPos, footR) - 0.028;
            col += exp(-abs(leftLeg)  * 35.0) * themeColor * 0.40;
            col += exp(-abs(rightLeg) * 35.0) * themeColor * 0.40;
        } else if (pose == 5) {
            footL = vec2<f32>(-0.28, -0.38);
            footR = vec2<f32>( 0.28, -0.48);
            let leftLeg  = sdSegment(p, hipsPos, footL) - 0.028;
            let rightLeg = sdSegment(p, hipsPos, footR) - 0.028;
            col += exp(-abs(leftLeg)  * 35.0) * themeColor * 0.40;
            col += exp(-abs(rightLeg) * 35.0) * themeColor * 0.40;
        } else if (pose == 6) {
            footL = vec2<f32>( 0.0, -0.50);
            footR = vec2<f32>( 0.18, -0.12);
            let leftLeg  = sdSegment(p, hipsPos, footL) - 0.028;
            let rightLeg = sdSegment(p, hipsPos, footR) - 0.025;
            col += exp(-abs(leftLeg)  * 35.0) * themeColor * 0.40;
            col += exp(-abs(rightLeg) * 35.0) * themeColor * 0.40;
        }
        col += groundedFeet(p, footL, footR, pose, themeColor);
    }

    // Energetic spine / sushumna nadi
    col += sushumnaNadi(p, expand, t);

    // Body glow
    let bodyCenterD = sdCircle(p - vec2<f32>(0.0, 0.05), 0.15);
    col += exp(-abs(bodyCenterD) * 12.0) * phaseColor * 0.12 * (0.5 + expand * 0.5);

    return col;
}

fn chakraColumn(uv: vec2<f32>, t: f32, breath: f32, expand: f32) -> vec3<f32> {
    var col = vec3<f32>(0.0);
    let p = (uv - vec2<f32>(0.0, -0.05)) / 0.75;

    let positions = array<f32, 7>(-0.35, -0.20, -0.05, 0.10, 0.25, 0.40, 0.55);
    let sizes     = array<f32, 7>( 0.04,  0.035, 0.045, 0.04, 0.035, 0.03, 0.05);
    let hues      = array<f32, 7>( 0.00,  0.08,  0.16,  0.33, 0.58,  0.75, 0.83);

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

    for (var i: i32 = 0; i < 7; i = i + 1) {
        let fIdx = f32(i);
        let pos  = vec2<f32>(0.0, positions[i]);
        let dist = length(p - pos);
        let baseRadius = sizes[i] * globalPulse;

        var activation: f32 = 0.0;
        var pulse: f32 = 1.0;

        if (u.chakraPhase < 0.5) {
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
            activation = 1.0;
            pulse = 1.0 + sin(t * 2.0) * 0.1;
        } else if (u.chakraPhase < 2.5) {
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
            activation = 0.2;
            pulse = 1.0 + sin(t * 1.0) * 0.05;
        }

        let radius     = baseRadius * (0.5 + 0.5 * activation);
        let glowRadius = radius + 0.15 + 0.1 * activation;
        let glow       = smoothstep(glowRadius, radius, dist);

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

        if (u.chakraPhase < 0.5 && i < 6u) {
            let nextPos = vec2<f32>(0.0, positions[i + 1u]);
            let midPos  = (pos + nextPos) * 0.5;
            let midDist = length(p - midPos);
            let flowGlow = exp(-midDist * 25.0) * u.phaseProgress * 0.25;
            col += hsv2rgb(shiftedHue, 0.7, 1.0) * flowGlow;
        }
    }

    // Sushumna nadi
    if (p.y > -0.5 && p.y < 0.65) {
        let nadiD = abs(p.x) - 0.006;
        let nadiPulse = 1.0 + 0.2 * u.intensity * sin(t * 3.0);
        var nadiColor = vec3<f32>(0.9, 0.95, 1.0);
        if (u.chakraPhase < 0.5) {
            nadiColor = mix(nadiColor, vec3<f32>(1.0, 0.85, 0.4), u.phaseProgress * 0.5);
        } else if (u.chakraPhase > 1.5 && u.chakraPhase < 2.5) {
            nadiColor = mix(vec3<f32>(1.0, 0.85, 0.4), vec3<f32>(0.4, 0.85, 1.0), u.phaseProgress * 0.5);
        }
        col += exp(-abs(nadiD) * 50.0) * nadiColor * 0.3 * nadiPulse;
    }

    col *= intensityMult;
    let palette = focusedBreathColor();
    col = mix(col, col * (0.60 + palette * 0.95), 0.28);
    return col;
}

fn progressRing(uv: vec2<f32>, breath: f32, expand: f32) -> vec3<f32> {
    var col = vec3<f32>(0.0);
    let r = length(uv);
    let a = atan2(uv.y, uv.x);

    let phaseColor  = focusedBreathColor();
    let glowStrength = 0.8 + 0.4 * u.intensity;

    let normalizedAngle = (a + PI) / TAU;

    // Outer ring — phase progress
    let outerRingD = abs(r - 0.65) - 0.015;
    let progressAngle = u.phaseProgress;
    let inArc = select(0.0, 1.0, normalizedAngle < progressAngle);

    col += exp(-abs(outerRingD) * 50.0) * phaseColor * glowStrength * inArc;
    col += exp(-abs(outerRingD) * 20.0) * phaseColor * 0.15;

    let progressPos = vec2<f32>(
        cos(progressAngle * TAU - PI),
        sin(progressAngle * TAU - PI)
    ) * 0.65;
    let glowD = length(uv - progressPos);
    let pointGlow = 0.8 + 0.6 * sin(u.time * 4.0) * u.intensity;
    col += exp(-glowD * 30.0) * phaseColor * pointGlow;

    // Inner ring — cycle progress
    let innerRingD = abs(r - 0.52) - 0.010;
    let cycleAngle = u.breathPhase;
    let inCycleArc = select(0.0, 1.0, normalizedAngle < cycleAngle);

    var cycleColor = mix(vec3<f32>(0.60, 0.70, 1.00), focusedBreathColor(), 0.35);
    if (u.theme < 0.5) {
        cycleColor = vec3<f32>(0.50, 0.70, 1.00);
    } else if (u.theme < 1.5) {
        cycleColor = vec3<f32>(1.00, 0.80, 0.40);
    } else {
        cycleColor = vec3<f32>(0.40, 0.85, 0.90);
    }

    col += exp(-abs(innerRingD) * 55.0) * cycleColor * 0.70 * inCycleArc;
    col += exp(-abs(innerRingD) * 20.0) * cycleColor * 0.10;

    let cyclePos = vec2<f32>(
        cos(cycleAngle * TAU - PI),
        sin(cycleAngle * TAU - PI)
    ) * 0.52;
    let cycleGlowD = length(uv - cyclePos);
    col += exp(-cycleGlowD * 35.0) * cycleColor * 0.6;

    // Sacred geometry at center
    let hexAngle = atan2(uv.y, uv.x);
    let hexPattern = abs(sin(hexAngle * 6.0 + u.time * 0.3)) * 0.5 + 0.5;
    let hexD = abs(r - 0.08) - 0.004;
    col += exp(-abs(hexD) * 80.0) * phaseColor * 0.3 * hexPattern;

    let seedD = sdCircle(uv, 0.025);
    col += exp(-abs(seedD) * 60.0) * vec3<f32>(1.0, 0.95, 0.8) * 0.4;

    return col;
}

fn figureAura(uv: vec2<f32>, t: f32, breath: f32, expand: f32) -> vec3<f32> {
    var col = vec3<f32>(0.0);
    let p = (uv - vec2<f32>(0.0, -0.05)) / 0.75;

    var auraColor = focusedBreathColor();

    if (u.theme < 0.5) {
        auraColor *= vec3<f32>(0.8, 0.9, 1.0);
    } else if (u.theme < 1.5) {
        auraColor *= vec3<f32>(1.1, 0.9, 0.6);
    } else {
        auraColor *= vec3<f32>(0.7, 1.0, 1.0);
    }

    let ellipse1 = length(p * vec2<f32>(1.0, 1.35)) - (0.28 + expand * 0.08);
    let ellipse2 = length(p * vec2<f32>(1.0, 1.35)) - (0.38 + expand * 0.10);
    let ellipse3 = length(p * vec2<f32>(1.0, 1.35)) - (0.48 + expand * 0.12);

    col += exp(-abs(ellipse1) * 8.0) * auraColor * 0.12 * (0.6 + expand * 0.4);
    col += exp(-abs(ellipse2) * 6.0) * auraColor * 0.08 * (0.5 + expand * 0.3);
    col += exp(-abs(ellipse3) * 4.0) * auraColor * 0.05 * (0.4 + expand * 0.2);

    let shellRot1 = rot2(t * 0.25 + breath * 0.5);
    let shellRot2 = rot2(-t * 0.18 - breath * 0.3);
    let shellRot3 = rot2(t * 0.12);

    let s1 = length((shellRot1 * p) * vec2<f32>(1.0, 1.5)) - 0.35;
    let s2 = length((shellRot2 * p) * vec2<f32>(1.3, 1.0)) - 0.40;
    let s3 = length((shellRot3 * p) * vec2<f32>(1.0, 1.2)) - 0.45;

    col += exp(-abs(s1) * 10.0) * auraColor * 0.06;
    col += exp(-abs(s2) * 10.0) * auraColor * 0.05;
    col += exp(-abs(s3) * 10.0) * auraColor * 0.04;

    if (u.chakraPhase < 0.5) {
        let tendril = sin(p.x * 12.0 + t * 2.0) * 0.5 + 0.5;
        let tendrilMask = smoothstep(-0.5, 0.5, p.y) * smoothstep(0.5, -0.2, p.y);
        col += auraColor * tendril * tendrilMask * u.phaseProgress * 0.08 * exp(-abs(p.x) * 3.0);
    }

    return col;
}

// ---------------------------------------------------------------------------
// Geometry that frames/grows from the human figure, changing with pose
// ---------------------------------------------------------------------------
fn figureFramingGeometry(uv: vec2<f32>, t: f32, breath: f32, expand: f32) -> vec3<f32> {
    var col = vec3<f32>(0.0);
    let density = clamp(u.geometryDensity, 0.2, 3.0);
    let isLotus = u.mandalaStyle < 0.5;
    let isYantra = u.mandalaStyle > 0.5 && u.mandalaStyle < 1.5;
    let phaseColor = focusedBreathColor();

    // Heart and head positions in uv space (matches humanFigure mapping)
    let heartUV = vec2<f32>(0.0, 0.025);
    let headUV  = vec2<f32>(0.0, 0.175);

    if (isLotus) {
        let hexN = 6.0 + floor(density * 4.0);
        let hexUV = kalei(uv - heartUV, hexN);
        let hexD = abs(length(hexUV) - (0.16 + expand * 0.04)) - 0.005;
        col += exp(-abs(hexD) * 80.0) * phaseColor * 0.35;
        col += goldenSeedField(uv, headUV, 12, t, density) * 0.5;
    } else if (isYantra) {
        let tipCount = i32(clamp(3.0 + density * 3.0, 3.0, 8.0));
        for (var i = 0; i < tipCount; i = i + 1) {
            let fi = f32(i);
            let tipUV = kalei(uv - heartUV, 3.0);
            let tipRot = t * 0.05 * (1.0 + u.interference) + fi * 0.4;
            let tipR = rot2(tipRot) * tipUV;
            let tipD = abs(length(tipR) - (0.06 + fi * 0.025) * (1.0 + expand * 0.1)) - 0.003;
            col += exp(-abs(tipD) * 100.0) * mix(phaseColor, vec3<f32>(1.0, 0.85, 0.4), fi * 0.15) * (0.18 - fi * 0.018);
        }
    } else {
        let ringD = abs(length(uv - heartUV) - (0.12 + expand * 0.03)) - 0.006;
        col += exp(-abs(ringD) * 70.0) * phaseColor * 0.30;
        col += vesicaPiscisChain(uv, heartUV, 8.0, 0.10, t, density) * 0.5;
    }

    return col;
}

