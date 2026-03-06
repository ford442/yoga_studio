// ============================================================================
// Sacred Geometry Rings - WITH BREATHING ANIMATION
// ============================================================================

// Global breathing scale factor with wave propagation offsets
fn breathScale(phaseProgress: f32, intensity: f32, offset: f32) -> f32 {
    let phaseAngle = phaseProgress * TAU + offset;
    return 1.0 + 0.06 * sin(phaseAngle) * intensity;
}

// Rotation twist during inhale (phaseProgress 0.0 to 0.5 = inhale)
fn breathRotation(phaseProgress: f32, intensity: f32) -> f32 {
    // Only rotate during inhale (first half of cycle)
    let inhaleFactor = smoothstep(0.0, 0.5, phaseProgress) * (1.0 - smoothstep(0.5, 1.0, phaseProgress));
    return phaseProgress * 0.1 * intensity * inhaleFactor;
}

fn hexRing(p: vec2f, r: f32, thickness: f32) -> f32 {
    let angle = TAU / 6.0;
    let a = atan2(p.y, p.x);
    let sector = round(a / angle);
    let a0 = sector * angle;
    let p_rot = vec2f(
        p.x * cos(-a0) - p.y * sin(-a0),
        p.x * sin(-a0) + p.y * cos(-a0)
    );
    return abs(length(p_rot) - r) - thickness;
}

fn triRing(p: vec2f, r: f32, thickness: f32) -> f32 {
    let angle = TAU / 3.0;
    let a = atan2(p.y, p.x);
    let sector = round(a / angle);
    let a0 = sector * angle;
    let p_rot = vec2f(
        p.x * cos(-a0) - p.y * sin(-a0),
        p.x * sin(-a0) + p.y * cos(-a0)
    );
    return abs(length(p_rot) - r) - thickness;
}

fn rings(p: vec3f, tt: f32, uniforms: BreathUniforms) -> f32 {
    let p2_base = p.xz;
    var d = 1e10;
    
    let phaseProgress = uniforms.phaseProgress;
    let intensity = uniforms.intensity;
    
    // Precompute rotation for breath twist
    let rotAngle = breathRotation(phaseProgress, intensity);
    let cosRot = cos(rotAngle);
    let sinRot = sin(rotAngle);
    
    // Layer 1: Inner ring (offset 0.0) - closest to center, breathes first
    let scale1 = breathScale(phaseProgress, intensity, 0.0);
    let p2_1 = vec2f(
        p2_base.x * cosRot - p2_base.y * sinRot,
        p2_base.x * sinRot + p2_base.y * cosRot
    ) / scale1;
    d = min(d, hexRing(p2_1, 1.5, 0.02));
    
    // Layer 2: Mid ring (offset 0.5) - wave propagates outward
    let scale2 = breathScale(phaseProgress, intensity, 0.5);
    let p2_2 = vec2f(
        p2_base.x * cosRot - p2_base.y * sinRot,
        p2_base.x * sinRot + p2_base.y * cosRot
    ) / scale2;
    d = min(d, triRing(p2_2, 1.2, 0.015));
    
    // Layer 3: Outer ring (offset 1.0) - last to breathe, largest expansion
    let scale3 = breathScale(phaseProgress, intensity, 1.0);
    let p2_3 = vec2f(
        p2_base.x * cosRot - p2_base.y * sinRot,
        p2_base.x * sinRot + p2_base.y * cosRot
    ) / scale3;
    d = min(d, abs(length(p2_3) - 0.9) - 0.01);
    
    return d;
}

// ============================================================================
// Kaleidoscope Effect - WITH BREATHING PULSE
// ============================================================================

// Mobile-optimized kaleidoscope with radial breathing displacement
fn kalei(p: vec3f, time: f32, uniforms: BreathUniforms) -> vec3f {
    let phaseProgress = uniforms.phaseProgress;
    let intensity = uniforms.intensity;
    
    // Radial displacement: breathing pulse effect
    let PI = 3.14159265359;
    let dr = 0.02 * sin(phaseProgress * PI) * intensity;
    
    // Micro-oscillation for "alive" feel during hold phases
    let microOsc = sin(time * 8.0) * 0.005 * intensity;
    
    // Apply radial displacement to input position
    let p_radial = normalize(p + 1e-8);  // Avoid division by zero
    var pos = p + p_radial * (dr + microOsc);
    
    var col = vec3f(0.0);
    
    // Mobile-optimized: reduced to 3 iterations (was 5)
    // Precompute TAU multiplier for efficiency
    let patternScale = 3.0;
    
    for (var i: i32 = 0; i < 3; i = i + 1) {
        pos = abs(pos) - 0.5;
        pos = repeat(pos, vec3f(1.0));
        let p2 = pModPolar(pos.xy, 6.0);
        pos = vec3f(p2.x, p2.y, pos.z);
        
        // Breathing intensity affects pattern visibility
        let pattern = sin(pos.x * patternScale + f32(i)) * cos(pos.y * patternScale);
        let contribution = 0.02 * (1.0 + 0.3 * sin(phaseProgress * TAU) * intensity);
        col += vec3f(contribution) * pattern;
    }
    
    return col;
}

// Alternative signature for systems without full uniform struct
fn kalei_simple(p: vec3f, time: f32, phaseProgress: f32, intensity: f32) -> vec3f {
    let PI = 3.14159265359;
    let dr = 0.02 * sin(phaseProgress * PI) * intensity;
    let microOsc = sin(time * 8.0) * 0.005 * intensity;
    
    let p_radial = normalize(p + 1e-8);
    var pos = p + p_radial * (dr + microOsc);
    
    var col = vec3f(0.0);
    let patternScale = 3.0;
    
    for (var i: i32 = 0; i < 3; i = i + 1) {
        pos = abs(pos) - 0.5;
        pos = repeat(pos, vec3f(1.0));
        let p2 = pModPolar(pos.xy, 6.0);
        pos = vec3f(p2.x, p2.y, pos.z);
        
        let pattern = sin(pos.x * patternScale + f32(i)) * cos(pos.y * patternScale);
        let contribution = 0.02 * (1.0 + 0.3 * sin(phaseProgress * TAU) * intensity);
        col += vec3f(contribution) * pattern;
    }
    
    return col;
}

// ============================================================================
// Map Function - Background Mesh Layer WITH MESH BREATHING
// ============================================================================

fn map(p: vec3f, uniforms: BreathUniforms) -> vec4f {
    var pos = p;
    var d = 1e10;
    var mat = 0.0;
    
    // ... body parts would go here ...
    // Example: var d_body = sdBody(pos); etc.
    
    // =========================================================================
    // MESH BREATHING - Background Sacred Geometry
    // =========================================================================
    {
        let phaseProgress = uniforms.phaseProgress;
        let intensity = uniforms.intensity;
        
        // Breath factor: smooth sine wave over full cycle
        let breathFactor = sin(phaseProgress * TAU) * intensity * 0.5;
        
        // Scale repeat grids to create breathing mesh effect
        // Grid expands on inhale, contracts on exhale
        let gridScale = 1.0 + 0.02 * breathFactor;
        
        // Transform position for background layer
        let bg_pos = pos * 0.5 / gridScale;
        let bg_repeat = repeat(bg_pos, vec3f(2.0));
        
        // Box SDF with hollow effect
        var d_bg = sdBox(bg_repeat, vec3f(0.3)) - 0.05;
        d_bg = max(d_bg, -(length(bg_repeat) - 0.4)); // Hollow center
        
        // Breathing affects the hollow center size too
        let hollowBreath = 0.4 + 0.02 * breathFactor;
        d_bg = max(d_bg, -(length(bg_repeat) - hollowBreath));
        
        // Smooth material transition based on breath phase
        if (d_bg < d) {
            d = d_bg;
            mat = 5.0 + 0.5 * breathFactor; // Subtle material variation
        }
    }
    // =========================================================================
    
    // Add sacred geometry rings with breathing
    let ringDist = rings(pos, uniforms.time, uniforms);
    if (ringDist < d) {
        d = ringDist;
        mat = 6.0; // Rings material
    }
    
    return vec4f(d, mat, 0.0, 0.0);
}

// Simplified map without full uniform struct support
fn map_simple(p: vec3f, time: f32, phaseProgress: f32, intensity: f32) -> vec4f {
    var pos = p;
    var d = 1e10;
    var mat = 0.0;
    
    // MESH BREATHING - Background Sacred Geometry
    let breathFactor = sin(phaseProgress * TAU) * intensity * 0.5;
    let gridScale = 1.0 + 0.02 * breathFactor;
    
    let bg_pos = pos * 0.5 / gridScale;
    let bg_repeat = repeat(bg_pos, vec3f(2.0));
    
    var d_bg = sdBox(bg_repeat, vec3f(0.3)) - 0.05;
    let hollowBreath = 0.4 + 0.02 * breathFactor;
    d_bg = max(d_bg, -(length(bg_repeat) - hollowBreath));
    
    if (d_bg < d) {
        d = d_bg;
        mat = 5.0 + 0.5 * breathFactor;
    }
    
    return vec4f(d, mat, 0.0, 0.0);
}

// ============================================================================
// mainImage() Integration Example
// ============================================================================
/*
@fragment
fn mainFragment(@builtin(position) fragCoord: vec4f) -> @location(0) vec4f {
    // Setup uniforms (normally passed from CPU)
    var uniforms: BreathUniforms;
    uniforms.time = time;
    uniforms.phase = u32(phase);              // 0=inhale, 1=hold_in, 2=exhale, 3=hold_out
    uniforms.phaseProgress = phaseProgress;    // 0.0 -> 1.0 within current phase
    uniforms.cycle = u32(cycle);              // Current breath cycle number
    uniforms.strengthLevel = u32(strength);   // Breathing intensity level
    uniforms.intensity = intensity;            // 0.0-1.0 current breath intensity
    
    // Normalized UV coordinates
    let uv = (fragCoord.xy - resolution.xy * 0.5) / resolution.y;
    
    // Ray setup
    let ro = vec3f(0.0, 0.0, 3.0);
    let rd = normalize(vec3f(uv, -1.0));
    
    // Raymarch
    var t = 0.0;
    var col = vec3f(0.0);
    
    for (var i: i32 = 0; i < 64; i = i + 1) {
        let p = ro + rd * t;
        let res = map(p, uniforms);
        let d = res.x;
        let mat = res.y;
        
        if (d < 0.001 || t > 20.0) {
            break;
        }
        
        // Add kaleidoscope pulse to background
        if (mat < 0.1) {
            col += kalei(p, uniforms.time, uniforms) * 0.1;
        }
        
        t += d;
    }
    
    // Shade based on material
    if (t < 20.0) {
        let p = ro + rd * t;
        let res = map(p, uniforms);
        let mat = res.y;
        
        // Material coloring with breath influence
        let breathGlow = 1.0 + 0.3 * sin(uniforms.phaseProgress * TAU) * uniforms.intensity;
        
        if (mat > 5.5) {
            // Rings - golden with breath pulse
            col = vec3f(1.0, 0.84, 0.0) * breathGlow;
        } else if (mat > 4.5) {
            // Mesh background - cyan with breath
            col = vec3f(0.0, 0.8, 1.0) * breathGlow;
        }
    }
    
    // Apply kaleidoscope overlay for ethereal effect
    let p_final = ro + rd * min(t, 20.0);
    col += kalei(p_final, uniforms.time, uniforms) * 0.5;
    
    return vec4f(col, 1.0);
}
*/

// ============================================================================
// Helper Functions (assumed available)
// ============================================================================
// These would typically be defined elsewhere in the shader:
//
// fn repeat(p: vec3f, c: vec3f) -> vec3f { return p - c * round(p / c); }
// fn pModPolar(p: vec2f, repetitions: f32) -> vec2f { ... }
// fn sdBox(p: vec3f, b: vec3f) -> f32 { ... }
// const TAU: f32 = 6.28318530718;
