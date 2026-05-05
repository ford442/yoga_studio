// ============================================================================
// Energy Systems Engineer - Chakra Wave Propagation Shader
// Wave-propagating chakra activation synchronized with breath phases
// ============================================================================

// ============================================================================
// Cheap sine approximation for small angles (x - x³/6.0)
// ============================================================================
fn cheapSin(x: f32) -> f32 {
    // Normalize to [-PI, PI] range for better approximation
    let pi = 3.14159265359;
    let tau = 6.28318530718;
    let y = x - tau * floor(x / tau + 0.5);
    let y3 = y * y * y;
    return y - y3 / 6.0 + y3 * y * y / 120.0;
}

fn cheapCos(x: f32) -> f32 {
    return cheapSin(x + 1.57079632679);
}

// ============================================================================
// Hue Shift Helper - Adjusts base hue based on breath phase
// ============================================================================
// Inhale: Shift toward warm gold/amber (+0.05)
// Exhale: Shift toward cool cyan/blue (-0.08)
fn getPhaseShiftedHue(baseHue: f32, phase: u32, phaseProgress: f32) -> f32 {
    var hueOffset: f32 = 0.0;
    
    switch(phase) {
        case 0u: { // Inhale: transition to warm gold
            hueOffset = 0.05 * phaseProgress;
        }
        case 1u: { // Hold1: maintain warm tone
            hueOffset = 0.05;
        }
        case 2u: { // Exhale: transition to cool cyan
            hueOffset = 0.05 - 0.13 * phaseProgress; // 0.05 -> -0.08
        }
        case 3u: { // Hold2: maintain cool tone
            hueOffset = -0.08;
        }
        default: {
            hueOffset = 0.0;
        }
    }
    
    // Wrap hue to [0, 1] range
    var newHue = baseHue + hueOffset;
    newHue = newHue - floor(newHue);
    return newHue;
}

// ============================================================================
// HSV to RGB conversion for vibrant chakra colors
// ============================================================================
fn hsv2rgb(h: f32, s: f32, v: f32) -> vec3f {
    let k = vec3f(1.0, 0.666666667, 0.333333333);
    let p = abs(fract(vec3f(h) + k) * 6.0 - vec3f(3.0));
    return v * mix(vec3f(1.0), clamp(p - vec3f(1.0), vec3f(0.0), vec3f(1.0)), s);
}

// ============================================================================
// Energy Flow Gradient - Vertical glow between chakras during inhale
// ============================================================================
fn energyFlow(p: vec3f, phase: u32, phaseProgress: f32, tt: f32) -> vec3f {
    // Only show during inhale and early hold
    var flowIntensity: f32 = 0.0;
    
    if (phase == 0u) {
        // Inhale: flow builds from bottom to top
        flowIntensity = phaseProgress * 0.6;
    } else if (phase == 1u) {
        // Hold1: sustained flow with pulse
        flowIntensity = 0.6 + cheapSin(tt * 2.0) * 0.1;
    }
    
    if (flowIntensity < 0.01) {
        return vec3f(0.0);
    }
    
    // Spine vertical range
    let yMin = -0.8;
    let yMax = 0.9;
    
    // Check if point is near the spine
    let distFromSpine = length(vec2f(p.x, p.z));
    if (distFromSpine > 0.25) {
        return vec3f(0.0);
    }
    
    // Vertical position factor
    let yNorm = (p.y - yMin) / (yMax - yMin);
    
    // Flow wave travels upward during inhale
    var flowWave: f32 = 0.0;
    if (phase == 0u) {
        let wavePos = phaseProgress * 1.2 - 0.1; // Slightly overshoot for smoothness
        flowWave = smoothstep(wavePos - 0.3, wavePos, yNorm) * smoothstep(wavePos + 0.2, wavePos, yNorm);
    } else {
        // Hold1: full column with gentle undulation
        flowWave = 0.7 + cheapSin(yNorm * 8.0 + tt * 2.0) * 0.3;
    }
    
    // Beam-like glow falloff
    let beamGlow = smoothstep(0.25, 0.0, distFromSpine) * smoothstep(0.0, 0.15, distFromSpine);
    
    // Energy color: warm gold during inhale, cool during exhale
    var energyHue: f32 = 0.12; // Gold default
    if (phase == 2u || phase == 3u) {
        energyHue = 0.55; // Cyan/blue
    }
    
    let energyCol = hsv2rgb(energyHue, 0.8, 1.0);
    
    return energyCol * flowWave * beamGlow * flowIntensity * 0.4;
}

// ============================================================================
// Chakra Energy Visualization - Wave Propagation Implementation
// ============================================================================
// 
// VISUAL DESCRIPTION OF EXPECTED EFFECT:
// --------------------------------------
// Inhale (phase 0): A wave of energy starts at the root chakra (base of spine)
//   and travels upward to the crown. Each chakra lights up in sequence with a 
//   0.15s delay between them. Brightness ramps from 0.3 to 1.0 as the wave passes.
//   The chakras shift toward warm gold/amber tones during this phase.
//   A vertical energy beam connects the chakras, following the wave upward.
//
// Hold1 (phase 1): All seven chakras glow at peak brightness with a gentle 
//   breathing pulse (subtle 0.1 amplitude oscillation). The warm gold hue is 
//   sustained, creating a moment of full activation and energy retention.
//
// Exhale (phase 2): Energy releases from crown to root in a downward wave.
//   Brightness fades from 1.0 to 0.4 as the release passes each chakra.
//   Colors shift toward cool cyan/blue tones, representing calm and release.
//
// Hold2 (phase 3): Minimal resting state with all chakras at 0.2 base glow.
//   Cool blue tones persist, creating a serene, grounded feeling between cycles.
//   This is the recovery phase before the next inhale begins.
//
// The overall effect creates a luminous energy column that breathes with the
// user, promoting mindfulness and visual meditation synchronization.
//
fn chakras(p: vec3f, tt: f32) -> vec3f {
    // 7 Chakra positions along spine (y-axis)
    let offs = array<vec3f, 7>(
        vec3f(0.0, -0.8, 0.0),   // Root (red) - i=0
        vec3f(0.0, -0.5, 0.0),   // Sacral (orange) - i=1
        vec3f(0.0, -0.2, 0.0),   // Solar Plexus (yellow) - i=2
        vec3f(0.0, 0.1, 0.0),    // Heart (green) - i=3
        vec3f(0.0, 0.35, 0.0),   // Throat (blue) - i=4
        vec3f(0.0, 0.6, 0.0),    // Third Eye (indigo) - i=5
        vec3f(0.0, 0.9, 0.0)     // Crown (violet) - i=6
    );
    
    // Base hues for each chakra
    let hues = array<f32, 7>(
        0.0,   // Root - Red
        0.08,  // Sacral - Orange
        0.16,  // Solar Plexus - Yellow
        0.33,  // Heart - Green
        0.58,  // Throat - Blue
        0.75,  // Third Eye - Indigo
        0.83   // Crown - Violet
    );
    
    var col = vec3f(0.0);
    
    // Extract breath parameters from uniforms
    let phase = u_breath.phase;
    let phaseProgress = u_breath.phaseProgress;
    let intensity = u_breath.intensity;
    
    for (var i: i32 = 0; i < 7; i = i + 1) {
        let center = offs[i];
        let dist = length(p - center);
        let fIdx = f32(i);
        
        // =========================================================================
        // Wave Propagation Logic
        // =========================================================================
        
        var activation: f32 = 0.0;
        var pulse: f32 = 1.0;
        
        switch(phase) {
            // -------------------------------------------------------------------
            // INHALE: Bottom-up activation wave (root -> crown)
            // -------------------------------------------------------------------
            case 0u: {
                // Staggered delay: each chakra activates 0.15s after the previous
                let delay = fIdx * 0.15;
                let wavePos = phaseProgress * 1.5 - delay; // 1.5x to ensure full coverage
                
                if (wavePos > 0.0) {
                    // Brightness: 0.3 -> 1.0 as wave passes
                    activation = 0.3 + 0.7 * smoothstep(0.0, 0.3, wavePos);
                    // Clamp and sustain
                    activation = min(activation, 1.0);
                } else {
                    activation = 0.3; // Base glow before wave arrives
                }
                
                // Gentle pre-pulse before main activation
                pulse = 1.0 + cheapSin(tt * 3.0 + fIdx * 0.5) * 0.05;
            }
            
            // -------------------------------------------------------------------
            // HOLD1: All chakras at peak with gentle breathing pulse
            // -------------------------------------------------------------------
            case 1u: {
                activation = 1.0; // Peak brightness
                // Gentle pulse: sin(time*2.0) * 0.1 amplitude
                pulse = 1.0 + cheapSin(tt * 2.0) * 0.1;
            }
            
            // -------------------------------------------------------------------
            // EXHALE: Top-down release wave (crown -> root)
            // -------------------------------------------------------------------
            case 2u: {
                // Reverse order: crown (6) releases first
                let reverseIdx = 6.0 - fIdx;
                let delay = reverseIdx * 0.15;
                let wavePos = phaseProgress * 1.5 - delay;
                
                if (wavePos > 0.0) {
                    // Brightness fades: 1.0 -> 0.4 as release passes
                    activation = 1.0 - 0.6 * smoothstep(0.0, 0.3, wavePos);
                    activation = max(activation, 0.4);
                } else {
                    activation = 1.0; // Still at peak before release arrives
                }
                
                // Slow release pulse
                pulse = 1.0 + cheapSin(tt * 1.5 + fIdx * 0.3) * 0.05;
            }
            
            // -------------------------------------------------------------------
            // HOLD2: Minimal glow, resting state
            // -------------------------------------------------------------------
            case 3u: {
                activation = 0.2; // Base resting glow
                pulse = 1.0 + cheapSin(tt * 1.0) * 0.05; // Very subtle
            }
            
            default: {
                activation = 0.3;
                pulse = 1.0;
            }
        }
        
        // =========================================================================
        // Chakra Glow Calculation
        // =========================================================================
        
        // Dynamic radius based on activation
        let baseRadius = 0.08;
        let radius = baseRadius * (0.5 + 0.5 * activation);
        
        // Glow falloff with smoothstep for soft edges
        let glowRadius = radius + 0.15 + 0.1 * activation; // Larger glow when active
        let glow = smoothstep(glowRadius, radius, dist);
        
        // Add subtle ring effect at outer edge
        let ringDist = abs(dist - radius * 1.5);
        let ringGlow = smoothstep(0.08, 0.0, ringDist) * 0.3 * activation;
        
        // =========================================================================
        // Color Calculation with Phase-Based Hue Shift
        // =========================================================================
        
        let baseHue = hues[i];
        let shiftedHue = getPhaseShiftedHue(baseHue, phase, phaseProgress);
        
        // Saturation and value adjustments based on phase
        var saturation: f32 = 0.9;
        var value: f32 = activation * pulse;
        
        // Boost vibrancy during hold phases
        if (phase == 1u) {
            saturation = 1.0;
            value = min(value * 1.1, 1.0);
        }
        
        let chakraCol = hsv2rgb(shiftedHue, saturation, value);
        
        // Accumulate color
        col += chakraCol * glow;
        col += chakraCol * ringGlow;
    }
    
    // =========================================================================
    // Energy Flow Visualization (Vertical gradient between chakras)
    // =========================================================================
    let flowCol = energyFlow(p, phase, phaseProgress, tt);
    col += flowCol;
    
    // =========================================================================
    // Final Intensity Multiplier
    // =========================================================================
    let intensityMult = 1.0 + 0.4 * intensity;
    col *= intensityMult;
    
    return col;
}

// ============================================================================
// Modified mainImage() - Integration Point
// ============================================================================
// 
// The chakras() function should be integrated into mainImage() like this:
//
// @fragment
// fn mainImage(@builtin(position) fragCoord: vec4f) -> @location(0) vec4f {
//     let uv = (fragCoord.xy - vec2f(400.0, 300.0)) / vec2f(600.0, 600.0);
//     
//     // Camera setup
//     let ro = vec3f(0.0, 0.0, 3.0);
//     let rd = normalize(vec3f(uv.x, uv.y, -1.5));
//     
//     // Dark background with slight blue tint
//     var col = vec3f(0.05, 0.05, 0.1);
//     
//     // Raymarching for other scene elements
//     let res = trace(ro, rd);
//     
//     // ... other scene rendering ...
//     
//     // ================================================================
//     // CHAKRA INTEGRATION - Add wave-propagating chakra visualization
//     // Position is on the ray at the hit distance (or fixed plane)
//     // ================================================================
//     let chakraPos = ro + rd * res.x;
//     let chakraCol = chakras(chakraPos, u_breath.time);
//     col += chakraCol;
//     
//     // Tone mapping and gamma correction
//     col = col / (col + vec3f(1.0)); // Reinhard tone mapping
//     col = pow(col, vec3f(0.4545));  // Gamma correction
//     
//     return vec4f(col, 1.0);
// }
//
// Alternative integration (screen-space overlay for glow effect):
//
//     // For a more ethereal effect, sample chakras at multiple depths
//     let chakraCol1 = chakras(ro + rd * 2.0, u_breath.time) * 0.5;
//     let chakraCol2 = chakras(ro + rd * 3.5, u_breath.time) * 0.3;
//     col += chakraCol1 + chakraCol2;

// ============================================================================
// Uniform Buffer Declaration (for reference)
// ============================================================================
// @group(0) @binding(0) var<uniform> u_breath: BreathUniforms;
//
// struct BreathUniforms {
//     time: f32,
//     phase: u32,          // 0=inhale, 1=hold1, 2=exhale, 3=hold2
//     phaseProgress: f32,  // 0.0 -> 1.0
//     cycle: u32,
//     strengthLevel: u32,
//     intensity: f32,
// }
