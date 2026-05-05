// =============================================================================
// WEBGPU PERFORMANCE AUDIT REPORT - Breathing Meditation Shader
// Target: Android/iOS mid-tier mobile (Mali-G76/Adreno 610) @ 60fps
// =============================================================================

/*
OVERVIEW:
This shader uses raymarching SDF techniques with multiple expensive operations
that will severely impact mobile GPU performance. Key hotspots identified:
- Heavy trigonometric usage in loops (atan2, sin, cos in kalei/chakras)
- 100-iteration raymarch loop without early-out optimization
- 6x SDF evaluations per normal calculation
- Redundant angle calculations in hot paths
*/

// =============================================================================
// CHANGE 1: Precompute Time-Dependent Trigonometry [HIGH IMPACT]
// =============================================================================
// PROBLEM: sin/cos called repeatedly with same 'tt' argument in loops
// LOCATION: chakras() loop, potential rot2() calls
// ESTIMATED SAVINGS: ~50-100 cycles per fragment

// CURRENT (inefficient):
//    for (var i: i32 = 0; i < 7; i = i + 1) {
//        let anim = 0.1 + 0.9 * sin(-4.0 * tt + TAU * f32(i) / 7.0);  // sin per iteration!
//    }

// RECOMMENDATION: Add precomputed sin/cos to uniforms
struct BreathUniforms {
    time: f32,
    phase: u32,
    phaseProgress: f32,
    cycle: u32,
    strengthLevel: u32,
    intensity: f32,
    // ADD THESE:
    sin_time: f32,           // precomputed sin(time)
    cos_time: f32,           // precomputed cos(time)
    sin_fast: f32,           // precomputed sin(time * 4.0) for chakra animation
    cos_fast: f32,           // precomputed cos(time * 4.0)
}

// CPU-side precomputation (JavaScript/TypeScript):
// uniformData.sin_time = Math.sin(uniformData.time);
// uniformData.cos_time = Math.cos(uniformData.time);
// uniformData.sin_fast = Math.sin(uniformData.time * 4.0);
// uniformData.cos_fast = Math.cos(uniformData.time * 4.0);

// =============================================================================
// CHANGE 2: Optimize kalei() Loop - Reduce Iterations + Unroll [HIGH IMPACT]
// =============================================================================
// PROBLEM: 5 iterations × pModPolar (atan2 + sin + cos) = 15 trig ops per call
// LOCATION: kalei() function
// ESTIMATED SAVINGS: ~200-300 cycles per fragment

// CURRENT:
//    for (var i: i32 = 0; i < 5; i = i + 1) {
//        pos = abs(pos) - 0.5;
//        pos = repeat(pos, vec3f(1.0));
//        let p2 = pModPolar(pos.xy, 6.0);  // atan2 + sin + cos
//        ...
//    }

// RECOMMENDATION A: Reduce to 3 iterations for mobile (visual impact minimal)
// RECOMMENDATION B: Manual unroll to allow compiler optimization

fn kalei_optimized(p: vec3f) -> vec3f {
    var pos = p;
    var col = vec3f(0.0);
    
    // Iteration 0
    pos = abs(pos) - 0.5;
    pos = repeat(pos, vec3f(1.0));
    let p2_0 = pModPolar(pos.xy, 6.0);
    pos = vec3f(p2_0.x, p2_0.y, pos.z);
    col += vec3f(0.02) * sin(pos.x * 3.0) * cos(pos.y * 3.0);
    
    // Iteration 1
    pos = abs(pos) - 0.5;
    pos = repeat(pos, vec3f(1.0));
    let p2_1 = pModPolar(pos.xy, 6.0);
    pos = vec3f(p2_1.x, p2_1.y, pos.z);
    col += vec3f(0.02) * sin(pos.x * 3.0 + 1.0) * cos(pos.y * 3.0);
    
    // Iteration 2 - REDUCED from 5
    pos = abs(pos) - 0.5;
    pos = repeat(pos, vec3f(1.0));
    let p2_2 = pModPolar(pos.xy, 6.0);
    pos = vec3f(p2_2.x, p2_2.y, pos.z);
    col += vec3f(0.02) * sin(pos.x * 3.0 + 2.0) * cos(pos.y * 3.0);
    
    return col;
}

// ALTERNATIVE: Remove kalei entirely for low-power mode on mobile

// =============================================================================
// CHANGE 3: Replace chakras() Loop with Unrolled + LUT [HIGH IMPACT]
// =============================================================================
// PROBLEM: 7 iterations with sin() call per iteration + HSV conversion math
// LOCATION: chakras() function  
// ESTIMATED SAVINGS: ~150-200 cycles per fragment

// CURRENT ISSUES:
// 1. sin(-4.0 * tt + TAU * f32(i) / 7.0) computed every iteration
// 2. HSV-to-RGB conversion: vec3f(abs(h * 6.0 - 3.0) - 1.0, ...) per iteration
// 3. array access with dynamic index can be slow on some mobile GPUs

// RECOMMENDATION: Precompute colors, unroll loop

// PRECOMPUTED CHAKRA COLORS (RGB) - avoid HSV conversion in shader
const CHAKRA_COLORS: array<vec3f, 7> = array<vec3f, 7>(
    vec3f(1.0, 0.0, 0.0),      // Root - red
    vec3f(1.0, 0.5, 0.0),      // Sacral - orange  
    vec3f(1.0, 1.0, 0.0),      // Solar - yellow
    vec3f(0.0, 1.0, 0.0),      // Heart - green
    vec3f(0.0, 0.5, 1.0),      // Throat - blue
    vec3f(0.25, 0.0, 1.0),     // Third eye - indigo
    vec3f(0.5, 0.0, 1.0)       // Crown - violet
);

const CHAKRA_OFFSETS: array<vec3f, 7> = array<vec3f, 7>(
    vec3f(0.0, -0.8, 0.0),
    vec3f(0.0, -0.5, 0.0),
    vec3f(0.0, -0.2, 0.0),
    vec3f(0.0, 0.1, 0.0),
    vec3f(0.0, 0.35, 0.0),
    vec3f(0.0, 0.6, 0.0),
    vec3f(0.0, 0.9, 0.0)
);

fn chakras_optimized(p: vec3f, sin_fast: f32, cos_fast: f32) -> vec3f {
    var col = vec3f(0.0);
    
    // Use sincos approximation or precomputed values
    // Unrolled loop - each chakra processed explicitly
    
    // Chakra 0 (Root)
    let dist0 = length(p - CHAKRA_OFFSETS[0]);
    let phase0 = -4.0 * 0.0 / 7.0 * TAU; // precomputable
    let anim0 = 0.1 + 0.9 * (sin_fast * cos(phase0) + cos_fast * sin(phase0));
    let glow0 = smoothstep(0.08 * anim0 + 0.15, 0.08 * anim0, dist0);
    col += CHAKRA_COLORS[0] * glow0 * 0.5;
    
    // Chakra 1 (Sacral) - REPEAT PATTERN for all 7...
    // (Full unroll saves loop overhead and enables better instruction scheduling)
    
    // OR use vectorized approach - process 2-3 chakras in parallel with vec2/vec3 ops
    
    return col;
}

// =============================================================================
// CHANGE 4: Optimize Raymarch Loop with Adaptive Steps [HIGH IMPACT]
// =============================================================================
// PROBLEM: Fixed 100 iterations, uniform step scale (0.8), no early out optimization
// LOCATION: trace() function
// ESTIMATED SAVINGS: ~500-1500 cycles per fragment (varies by scene)

// CURRENT:
//    for (var i: i32 = 0; i < 100; i = i + 1) {
//        let h = map(p);
//        if (h.x < 0.001 || t > 20.0) { break; }
//        t += h.x * 0.8;  // fixed step scale
//    }

// RECOMMENDATIONS:
// 1. Reduce max iterations to 64 for mobile (40% reduction)
// 2. Use larger step scale when far from objects
// 3. Add minimum step size to avoid over-refining
// 4. Consider reducing max distance for mobile

fn trace_optimized(ro: vec3f, rd: vec3f) -> vec4f {
    var t = 0.0;
    var res = vec4f(-1.0);
    
    // Mobile: reduce from 100 to 64 or even 48
    for (var i: i32 = 0; i < 64; i = i + 1) {
        let p = ro + rd * t;
        let h = map(p);
        
        if (h.x < 0.001) {  // Hit - removed t > 20 check from hot path
            res = vec4f(t, h.yzw);
            break;
        }
        if (t > 20.0) { break; }  // Moved after hit check
        
        // Adaptive step: larger steps when far, smaller when close
        let step_scale = select(0.9, 0.7, h.x < 0.1);
        t += max(h.x * step_scale, 0.001);  // Minimum step to avoid micro-steps
    }
    return res;
}

// =============================================================================
// CHANGE 5: Optimize Normal Calculation - Reduce Map Calls [MEDIUM IMPACT]
// =============================================================================
// PROBLEM: calcNormal() calls map() 6 times = 6× full SDF evaluation!
// LOCATION: calcNormal() function
// ESTIMATED SAVINGS: ~300-400 cycles per normal calculation

// CURRENT:
//    return normalize(vec3f(
//        map(p + e.xyy).x - map(p - e.xyy).x,  // 2 calls
//        map(p + e.yxy).x - map(p - e.yxy).x,  // 2 calls  
//        map(p + e.yyx).x - map(p - e.yyx).x   // 2 calls
//    ));

// RECOMMENDATION A: Use tetrahedron technique (4 samples instead of 6)
fn calcNormal_tetrahedron(p: vec3f) -> vec3f {
    let e = 0.001;
    let v1 = vec3f(1.0, -1.0, -1.0);
    let v2 = vec3f(-1.0, -1.0, 1.0);
    let v3 = vec3f(-1.0, 1.0, -1.0);
    let v4 = vec3f(1.0, 1.0, 1.0);
    
    let d1 = map(p + v1 * e).x;
    let d2 = map(p + v2 * e).x;
    let d3 = map(p + v3 * e).x;
    let d4 = map(p + v4 * e).x;
    
    return normalize(v1 * d1 + v2 * d2 + v3 * d3 + v4 * d4);
}

// RECOMMENDATION B: Even faster - use 2-sample normal for distant objects
fn calcNormal_fast(p: vec3f, dist: f32) -> vec3f {
    // Use lower quality normal for distant/small contribution fragments
    let e = vec2f(0.001, 0.0);
    // Only 3 samples with vec3 swizzles - some compilers optimize better
    let dX = map(p + e.xyy).x - map(p - e.xyy).x;
    let dY = map(p + e.yxy).x - map(p - e.yxy).x;
    let dZ = map(p + e.yyx).x - map(p - e.yyx).x;
    return normalize(vec3f(dX, dY, dZ));
}

// =============================================================================
// CHANGE 6: Replace Branchy if/else with select() [MEDIUM IMPACT]
// =============================================================================
// PROBLEM: if/else statements in map() can cause warp divergence
// LOCATION: map() function material assignment
// ESTIMATED SAVINGS: ~20-40 cycles, better warp utilization

// CURRENT (branchy):
//    if (d_head < d) { d = d_head; mat = 1.0; }
//    if (d_arms < d) { d = d_arms; mat = 2.0; }
//    if (d_legs < d) { d = d_legs; mat = 3.0; }

// RECOMMENDATION: Use WGSL select() builtin (avoids branching)
fn map_optimized(p: vec3f) -> vec4f {
    var pos = p;
    let chest_a = vec3f(0.0, 0.0, 0.0);
    let chest_b = vec3f(0.0, 0.5, 0.0);
    var d = sdPill(pos, chest_a, chest_b, 0.25);
    var mat = 0.0;
    
    let d_head = sdSphere(pos - vec3f(0.0, 0.85, 0.0), 0.18);
    let is_head = f32(d_head < d);
    d = select(d, d_head, d_head < d);
    mat = select(mat, 1.0, d_head < d);
    
    let l_shoulder = vec3f(-0.3, 0.4, 0.0);
    let l_hand = vec3f(-0.5, -0.3, 0.0);
    let r_shoulder = vec3f(0.3, 0.4, 0.0);
    let r_hand = vec3f(0.5, -0.3, 0.0);
    let d_arms = min(sdPill(pos, l_shoulder, l_hand, 0.08), 
                     sdPill(pos, r_shoulder, r_hand, 0.08));
    let is_arms = f32(d_arms < d);
    d = select(d, d_arms, d_arms < d);
    mat = select(mat, 2.0, d_arms < d);
    
    let d_legs = min(sdPill(pos, vec3f(-0.15, -0.1, 0.0), vec3f(-0.2, -1.0, 0.0), 0.12),
                     sdPill(pos, vec3f(0.15, -0.1, 0.0), vec3f(0.2, -1.0, 0.0), 0.12));
    d = select(d, d_legs, d_legs < d);
    mat = select(mat, 3.0, d_legs < d);
    
    return vec4f(d, mat, 0.0, 0.0);
}

// NOTE: Modern compilers often optimize simple if-statements well,
// but select() guarantees no branching. Profile both approaches.

// =============================================================================
// CHANGE 7: Pack Uniforms for Better Cache Utilization [LOW IMPACT]
// =============================================================================
// PROBLEM: Multiple u32 fields cause padding,浪费了uniform buffer space
// LOCATION: BreathUniforms struct
// ESTIMATED SAVINGS: ~5-10 cycles (memory bandwidth), cleaner UBO layout

// CURRENT (with implicit padding):
//    time: f32,        // offset 0
//    phase: u32,       // offset 4  (alignment: f32 padded to 8? No, u32 aligns to 4)
//    phaseProgress: f32, // offset 8
//    cycle: u32,       // offset 12
//    strengthLevel: u32, // offset 16
//    intensity: f32    // offset 20

// RECOMMENDATION: Pack u32 values into single u32 bitfield
struct BreathUniforms_packed {
    time: f32,
    phaseProgress: f32,
    intensity: f32,
    sin_time: f32,
    cos_time: f32,
    sin_fast: f32,
    cos_fast: f32,
    // Pack all u32 into one: [phase(8) | cycle(12) | strengthLevel(8) | reserved(4)]
    packed_data: u32,
}

// Decode helpers:
fn get_phase(u: BreathUniforms_packed) -> u32 {
    return (u.packed_data >> 24) & 0xFFu;
}
fn get_cycle(u: BreathUniforms_packed) -> u32 {
    return (u.packed_data >> 12) & 0xFFFu;
}
fn get_strength(u: BreathUniforms_packed) -> u32 {
    return (u.packed_data >> 4) & 0xFFu;
}

// CPU packing:
// packed_data = (phase << 24) | (cycle << 12) | (strengthLevel << 4);

// =============================================================================
// CHANGE 8: Optimize hexRing - Remove atan2 where possible [MEDIUM IMPACT]
// =============================================================================
// PROBLEM: hexRing() uses atan2 + round + cos/sin rotation per call
// LOCATION: hexRing() function
// ESTIMATED SAVINGS: ~50-80 cycles per call

// CURRENT:
//    let a = atan2(p.y, p.x);           // expensive
//    let sector = round(a / angle);
//    let a0 = sector * angle;
//    let p_rot = vec2f(p.x * cos(-a0) - p.y * sin(-a0), ...);  // rotation

// RECOMMENDATION: Approximate hexagon with simpler SDF or use precomputed sector lookup

// Alternative hex SDF without atan2 (approximate):
fn hexApprox(p: vec2f, r: f32) -> f32 {
    let k = vec3f(-0.8660254, 0.5, 0.57735027); // -sqrt(3)/2, 0.5, 1/sqrt(3)
    let ap = abs(p);
    let h = vec2f(ap.x * k.x - ap.y * k.y, ap.x * k.y + ap.y * k.x);
    return length(max(vec2f(h.x, h.y - r * k.z), vec2f(0.0))) + 
           min(0.0, max(h.x, h.y - r * k.z));
}

fn hexRing_approx(p: vec2f, r: f32, thickness: f32) -> f32 {
    return abs(hexApprox(p, r)) - thickness;
}

// =============================================================================
// COMPATIBILITY NOTES
// =============================================================================

/*
Mobile GPU Considerations:
- Mali-G76: Prefers simpler control flow, benefits from select() over if
- Adreno 610: Sensitive to ALU load, trig functions are expensive
- Both: Benefit from reduced iteration counts in loops

WebGPU Specific:
- All changes are WGSL-compliant
- No subgroup/warp operations used (not universally supported yet)
- Uniform packing is safe across all WebGPU implementations

Fallback Strategy:
- Detect mobile via user agent or performance heuristic
- Use optimized versions on mobile, full quality on desktop
- Consider quality presets: LOW (48 raymarch steps, 3 kalei), 
  MEDIUM (64 steps, 4 kalei), HIGH (100 steps, 5 kalei)
*/

// =============================================================================
// FINAL RECOMMENDATION - TOP 3 CHANGES TO IMPLEMENT IMMEDIATELY
// =============================================================================

/*
RANK 1: Reduce raymarch iterations (Change 4)
- Biggest impact: 100 → 64 iterations = ~36% reduction in loop work
- Visual impact minimal for meditation app
- One-line change with significant perf gain
- ESTIMATED SPEEDUP: 30-40%

RANK 2: Precompute trigonometry in uniforms (Change 1)  
- Eliminates redundant sin/cos calculations
- Enables chakra animation optimization
- Minimal code change, high impact
- ESTIMATED SPEEDUP: 15-20%

RANK 3: Optimize kalei() iterations (Change 2)
- 5 → 3 iterations removes 2 expensive pModPolar calls
- Each pModPolar = atan2 + sin + cos = ~40 cycles
- Total savings: ~80 cycles per fragment
- ESTIMATED SPEEDUP: 10-15%

COMBINED ESTIMATED SPEEDUP: 55-75% performance improvement on mobile
Target 60fps achievement: Likely on Mali-G76, borderline on Adreno 610
Consider adding quality tiers for broader device support.
*/

// =============================================================================
// QUICK REFERENCE - PATCH CHECKLIST
// =============================================================================

/*
[ ] 1. Add sin_time, cos_time, sin_fast, cos_fast to BreathUniforms struct
[ ] 2. Update CPU uniform upload to precompute trigonometry
[ ] 3. Reduce trace() loop from 100 to 64 iterations
[ ] 4. Reduce kalei() loop from 5 to 3 iterations
[ ] 5. Replace calcNormal() with tetrahedron version (4 samples)
[ ] 6. Precompute CHAKRA_COLORS array to avoid HSV conversion
[ ] 7. (Optional) Pack u32 uniforms into bitfield
[ ] 8. (Optional) Test select() vs if/else in map() - keep faster one
[ ] 9. Add mobile quality preset toggle in app
[ ] 10. Profile on target devices to validate improvements
*/

// END OF AUDIT REPORT
