// =================================================================
// ENERGY RIBBONS MODULE
// =================================================================
//
// Each strand is a flowing torus around the centre. Fluidity comes
// from FBM domain-warp of the spiral phase plus a "weave" term that
// pushes the ribbon's centreline in and out radially, so it appears
// to dive behind and rise in front of neighbouring streams. Thickness
// breathes along the arc, a bright filament sits inside a soft glow,
// and depth shading dims the back of each weave.
// =================================================================
// Depth helpers: give each orbital ring its own sense of distance from the
// viewer. Inner rings (small orbitR) sit "close" — sharp and fast-panning;
// outer rings sit "far" — softer-edged and drifting more slowly, the way a
// background recedes behind a foreground subject.
fn ribbonLayerDepth(orbitR: f32) -> f32 {
    return 1.0 / (1.0 + orbitR * 1.3);   // 1.0 = near, → 0.0 = far
}

fn ribbonParallaxUV(uv: vec2<f32>, orbitR: f32) -> vec2<f32> {
    let layerDepth = ribbonLayerDepth(orbitR);
    let drift = vec2<f32>(sin(fieldTime() * 0.07), cos(fieldTime() * 0.05))
                * (1.0 - layerDepth) * 0.02;
    return uv + drift;
}

fn ribbonLayerBlur(orbitR: f32) -> f32 {
    let layerDepth = ribbonLayerDepth(orbitR);
    return mix(1.45, 1.0, layerDepth);   // far rings widen (blur), near stay crisp
}

fn ribbonStrand(
    uv: vec2<f32>, t: f32,
    orbitR: f32, n: f32, speed: f32, twist: f32, phase: f32, width: f32,
    color: vec3<f32>, expand: f32, intensity: f32
) -> vec3<f32> {
    let r = length(uv);
    let a = atan2(uv.y, uv.x);

    // Two-octave domain warp for organic, fluid motion.
    let warp1 = fbm2(uv * 1.6 + vec2<f32>(orbitR * 4.0, phase * 2.0 + t * 0.12), t * 0.30);
    let warp2 = fbm2(uv * 3.1 - vec2<f32>(t * 0.08, orbitR * 2.0), t * 0.22);

    // Flowing spiral coordinate along the ribbon.
    let spiralPhase = a * n + t * speed + twist * (r - orbitR) + phase + warp1 * 0.65;

    // Weave: centreline drifts in/out -> the ribbon snakes radially.
    let weave = sin(spiralPhase * 0.85 + warp2 * 1.6) * width * 1.7;
    let orbit = orbitR + weave;
    let radialDist = r - orbit;

    // Thickness breathes along arc length (catch-the-light variation).
    let thick = width * (0.55 + 0.45 * (sin(spiralPhase * 1.3 + warp2) * 0.5 + 0.5));

    // Soft glow halo + flowing energy segmentation.
    let flow = sin(spiralPhase) * 0.5 + 0.5;
    let seg = pow(flow, 2.5) * 0.7 + 0.3;
    let glow = exp(-radialDist * radialDist / (thick * thick * 2.6)) * 0.42;
    let core = exp(-radialDist * radialDist / (thick * thick * 0.40)) * seg;

    // Bright inner filament — the "wire" of light at the ribbon's heart.
    let filament = exp(-radialDist * radialDist / (thick * thick * 0.06)) * pow(flow, 4.0) * 0.55;

    // Depth shading: weave-back portions read dimmer & cooler.
    let depth = 0.6 + 0.4 * (sin(spiralPhase * 0.85 + warp2 * 1.6) * 0.5 + 0.5);

    let centerFade = smoother(0.04, 0.17, r);
    let sideBias = pow(abs(cos(a)), 0.45) * 0.30 + 0.70;

    var ribbon = (core + glow) * centerFade * sideBias * depth + filament * centerFade;

    // Flowing colour shift along the ribbon length.
    let colorShift = sin(spiralPhase * 0.35 + t * 0.4 + phase) * 0.5 + 0.5;
    let flowColor = mix(color, color * vec3<f32>(1.15, 0.85, 1.25), colorShift * 0.35);
    // Filament cores trend whiter (hot core, coloured glow).
    let hotColor = mix(flowColor, vec3<f32>(1.0, 0.96, 0.92), filament * 1.2);

    let bright = (0.38 + expand * 0.85 + intensity * 0.32);
    return ribbon * hotColor * bright;
}

fn energyRibbons(
    uv: vec2<f32>, t: f32,
    breath: f32, intensity: f32, chakraPhase: f32
) -> vec3<f32> {
    var col = vec3<f32>(0.0);
    let expand = deriveBreathExpand(breath, chakraPhase);

    let holdPulse = 1.0 + 0.08 * (organicPulse(t, 3.5, 7.45) * 2.0 - 1.0) * expand * intensity;
    let flowSpeed = 1.0 + expand * 1.4;
    let radiusShift = 1.0 - expand * 0.18;
    let glowMult = 0.55 + expand * 0.95 + intensity * 0.28;

    // Upward drift during inhale (prana rising)
    let baseDriftUV = uv + vec2<f32>(0.0, expand * 0.04);

    // Ribbon colors share the lotus palette for energetic continuity.
    // --- Layer 1: Inner prana streams (closest — sharp, fast parallax) ---
    let r1 = 0.32 * radiusShift;
    let uv1 = ribbonParallaxUV(baseDriftUV, r1);
    let blur1 = ribbonLayerBlur(r1);
    col += ribbonStrand(uv1, t, r1, 4.0, flowSpeed * 1.0, 6.0, 0.00,
                        0.038 * blur1, vec3<f32>(0.92, 0.48, 0.68), expand, intensity)
           * glowMult * holdPulse;
    col += ribbonStrand(uv1, t, r1, 4.0, flowSpeed * 1.0, 6.0, 3.14159,
                        0.038 * blur1, vec3<f32>(0.78, 0.42, 0.72), expand, intensity)
           * glowMult * holdPulse;

    // --- Layer 2: Mid energy rings ---
    let r2 = 0.58 * radiusShift;
    let uv2 = ribbonParallaxUV(baseDriftUV, r2);
    let blur2 = ribbonLayerBlur(r2);
    col += ribbonStrand(uv2, t, r2, 6.0, flowSpeed * 1.2, 9.0, 0.60,
                        0.045 * blur2, vec3<f32>(0.48, 0.68, 0.92), expand, intensity)
           * glowMult * 0.90 * holdPulse;
    col += ribbonStrand(uv2, t, r2, 6.0, flowSpeed * 1.2, 9.0, 2.80,
                        0.045 * blur2, vec3<f32>(0.55, 0.82, 0.72), expand, intensity)
           * glowMult * 0.90 * holdPulse;
    col += ribbonStrand(uv2, t, r2, 6.0, flowSpeed * 1.2, 9.0, 4.50,
                        0.045 * blur2, vec3<f32>(0.88, 0.52, 0.78), expand, intensity)
           * glowMult * 0.90 * holdPulse;

    // --- Layer 3: Outer cosmic streams (further — softer, slower parallax) ---
    let r3 = 0.92 * radiusShift;
    let uv3 = ribbonParallaxUV(baseDriftUV, r3);
    let blur3 = ribbonLayerBlur(r3);
    col += ribbonStrand(uv3, t, r3, 8.0, flowSpeed * 0.85, 12.0, 1.10,
                        0.052 * blur3, vec3<f32>(0.42, 0.62, 0.92), expand, intensity)
           * glowMult * 0.72 * holdPulse;
    col += ribbonStrand(uv3, t, r3, 8.0, flowSpeed * 0.85, 12.0, 3.90,
                        0.052 * blur3, vec3<f32>(0.68, 0.48, 0.88), expand, intensity)
           * glowMult * 0.72 * holdPulse;

    // --- Layer 4: Far aura whisps (most distant — softest, slowest drift) ---
    let r4 = 1.35 * radiusShift;
    let uv4 = ribbonParallaxUV(baseDriftUV, r4);
    let blur4 = ribbonLayerBlur(r4);
    col += ribbonStrand(uv4, t, r4, 3.5, flowSpeed * 0.45, 5.0, 0.00,
                        0.075 * blur4, vec3<f32>(0.52, 0.60, 0.88), expand, intensity)
           * glowMult * 0.38 * holdPulse;
    col += ribbonStrand(uv4, t, r4, 3.5, flowSpeed * 0.45, 5.0, 2.09,
                        0.075 * blur4, vec3<f32>(0.58, 0.52, 0.82), expand, intensity)
           * glowMult * 0.38 * holdPulse;

    // Breath-driven temperature shift for ribbons
    if (chakraPhase < 0.5)      { col *= vec3<f32>(0.90, 0.98, 1.08); }
    else if (chakraPhase < 1.5) { col *= vec3<f32>(1.10, 0.94, 0.98); }
    else if (chakraPhase < 2.5) { col *= vec3<f32>(1.04, 0.98, 0.90); }
    else                        { col *= vec3<f32>(0.94, 0.98, 1.04); }

    // Connecting bridges — faint arcs linking inner and outer streams
    let r = length(baseDriftUV);
    let a = atan2(baseDriftUV.y, baseDriftUV.x);
    let bridgePhase = a * 2.0 + t * 0.6 + expand * 2.0;
    let bridgeMask = exp(-(r - 0.70) * (r - 0.70) / 0.015) *
                     smoothstep(0.4, 0.8, sin(bridgePhase) * 0.5 + 0.5);
    col += vec3<f32>(0.72, 0.75, 0.95) * bridgeMask * 0.18 * glowMult;

    return col;
}

