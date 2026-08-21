// =================================================================
// BACKGROUND ATMOSPHERE
// =================================================================

fn twinkleStars(uv: vec2<f32>, t: f32, breath: f32, expand: f32) -> vec3<f32> {
    var col = vec3<f32>(0.0);

    // Star colors shift slightly warmer during inhale for cohesion
    let starWarmth = 1.0 + expand * 0.15;

    // Layer 1 — distant, sparse, slow twinkle
    let s1 = hash21(floor(uv * 42.0) + 100.0);
    let tw1 = sin(t * 0.7 + s1 * 6.283185) * 0.5 + 0.5;
    col += vec3<f32>(0.60, 0.62, 0.88) * starWarmth * smoothstep(0.982, 1.0, s1) * tw1 * 0.45;

    // Layer 2 — medium density, medium twinkle
    let s2 = hash21(floor(uv * 78.0) + 200.0);
    let tw2 = sin(t * 1.2 + s2 * 6.283185) * 0.5 + 0.5;
    col += vec3<f32>(0.68, 0.66, 0.92) * starWarmth * smoothstep(0.990, 1.0, s2) * tw2 * 0.32;

    // Layer 3 — close, very sparse, fast twinkle
    let s3 = hash21(floor(uv * 130.0) + 300.0);
    let tw3 = sin(t * 1.9 + s3 * 6.283185) * 0.5 + 0.5;
    col += vec3<f32>(0.78, 0.72, 0.95) * starWarmth * smoothstep(0.994, 1.0, s3) * tw3 * 0.20;

    // Gentle breath-reactive brightening
    col *= (0.8 + expand * 0.22);
    return col;
}

fn nebulaDust(uv: vec2<f32>, t: f32, breath: f32, expand: f32) -> vec3<f32> {
    let r = length(uv);
    var col = vec3<f32>(0.0);

    // Large-scale nebula clouds using low-frequency FBM
    let n1 = fbm2(uv * 0.7 + vec2<f32>(t * 0.015, t * 0.012), t * 0.08);
    let n2 = fbm2(uv * 1.0 + vec2<f32>(-t * 0.012, t * 0.008), t * 0.06);
    let n3 = fbm2(uv * 1.6 + vec2<f32>(t * 0.010, -t * 0.015), t * 0.05);

    // Deep violet inner nebula — harmonizes with lotus center
    col += vec3<f32>(0.012, 0.006, 0.024) * n1 * exp(-r * r * 1.8) * (0.6 + expand * 0.35);
    // Warm rose-gold mid nebula — bridges inner and outer space
    col += vec3<f32>(0.014, 0.008, 0.016) * n2 * exp(-r * r * 2.5) * (0.5 + expand * 0.25);
    // Cool indigo outer dust — matches outer lotus petals
    col += vec3<f32>(0.005, 0.008, 0.020) * n3 * exp(-r * r * 3.5) * 0.35;

    return col;
}

fn geometryFragment(uv: vec2<f32>, n: f32, size: f32, rot: f32, breath: f32) -> vec3<f32> {
    let r = length(uv);
    let a = atan2(uv.y, uv.x) + rot;
    let sector = 6.28318530718 / n;
    let sa = pmod(a, sector) - sector * 0.5;

    // Soft petal-like fragment shape
    let d = abs(r - size * 0.5) + abs(sa) * r * 1.8;
    let shape = smoothstep(size * 0.22, 0.0, d);
    let glow = exp(-d * d * 60.0) * 0.4;

    // Soft radial fade
    let fade = smoothstep(0.0, 0.02, r) * (1.0 - smoothstep(size * 0.85, size * 1.3, r));

    return (shape * 0.12 + glow) * fade * vec3<f32>(0.65, 0.55, 0.85) * (0.42 + breath * 0.08);
}

fn floatingGeometry(uv: vec2<f32>, t: f32, breath: f32, expand: f32) -> vec3<f32> {
    var col = vec3<f32>(0.0);

    // Fragment 1 — upper left, small lotus-like, slow rotation
    let p1 = rot2(t * 0.035) * (uv - vec2<f32>(-1.15, 0.65));
    col += geometryFragment(p1, 6.0, 0.16, 0.0, breath) * 0.9;

    // Fragment 2 — lower right, yantra-like
    let p2 = rot2(-t * 0.025) * (uv - vec2<f32>(1.05, -0.55));
    col += geometryFragment(p2, 8.0, 0.20, 1.2, breath) * 0.7;

    // Fragment 3 — upper right, very faint, small
    let p3 = rot2(t * 0.018) * (uv - vec2<f32>(0.85, 0.85));
    col += geometryFragment(p3, 5.0, 0.12, 2.5, breath) * 0.5;

    // Fragment 4 — lower left, distant
    let p4 = rot2(-t * 0.022) * (uv - vec2<f32>(-0.75, -0.85));
    col += geometryFragment(p4, 7.0, 0.14, 0.8, breath) * 0.6;

    // Fragment 5 — far right edge, barely visible
    let p5 = rot2(t * 0.015) * (uv - vec2<f32>(1.4, 0.2));
    col += geometryFragment(p5, 6.0, 0.10, 3.0, breath) * 0.35;

    return col;
}

fn emanationRays(uv: vec2<f32>, t: f32, breath: f32, expand: f32) -> vec3<f32> {
    var col = vec3<f32>(0.0);
    let a = atan2(uv.y, uv.x);
    let r = length(uv);

    // Wide, soft spiritual rays emanating from center
    for (var i = 0; i < 6; i++) {
        let fi = f32(i);
        let ray = pow(max(0.0, cos(a - t * 0.025 + fi * 1.047198)), 10.0);
        let fade = exp(-r * (1.6 + fi * 0.25));
        col += ray * fade * vec3<f32>(0.42, 0.32, 0.68) * (0.10 + expand * 0.12);
    }

    // Very soft radial bloom behind the lotus
    let bloom = exp(-r * r * 3.5) * (0.04 + expand * 0.06);
    col += bloom * vec3<f32>(0.48, 0.38, 0.78);

    // Subtle cross-shaped emanation (sacred geometry feel)
    let cross = pow(abs(cos(a * 2.0)), 16.0) + pow(abs(sin(a * 2.0)), 16.0);
    col += cross * exp(-r * r * 2.0) * 0.022 * vec3<f32>(0.62, 0.52, 0.88);

    return col;
}

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
    col += vec3<f32>(0.006, 0.003, 0.016) * exp(-r * r * 2.5) * (0.35 + expand * 0.30);

    return col;
}

fn lightShafts(uv: vec2<f32>, t: f32, breath: f32, expand: f32) -> vec3<f32> {
    var col = vec3<f32>(0.0);
    let a = atan2(uv.y, uv.x);
    let r = length(uv);
    for (var i = 0; i < 3; i++) {
        let fi = f32(i);
        let beam = pow(max(0.0, cos(a - t * 0.06 + fi * 2.094395)), 20.0);
        let fade = exp(-r * (2.4 + fi * 0.4));
        col += beam * fade * vec3<f32>(0.52, 0.40, 0.88) * (0.18 + expand * 0.30);
    }
    return col * 0.38;
}

