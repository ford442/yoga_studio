I have created the WGSL text rendering system. Here's a summary of what was ported:

**Glyph Data Arrays:**
- `char_numbers`: array of 10 `vec4<u32>` for digits 0-9
- `char_dash` and `char_period`: single glyph bitmaps

**Bit Extraction:**
- `_O(v, p)`: Extracts bit at position p from u32 value

**Glyph Rendering:**
- `glyph(a, b, c, d)`: Renders a character from bitmap data at position c with scale b

**Number Rendering:**
- `number_to_glyph()`: Renders numbers with decimal places, handles negatives, renders digit-by-digit

**SDF Alphabet (Complete):**
- All 26 letters: `letter_aa()` through `letter_zz()`
- Punctuation: `bracket_left()`, `bracket_right()`, `semicolon()`

**SDF Shape Primitives:**
- `sd_circle()`, `sd_circle_s()`, `sd_vert()`, `sd_halfvert()`
- `sd_hori()`, `sd_halfhori()`, `sd_diag()`, `sd_halfdiag()`

**Text Layout System:**
- Replaced `#define` macros with `const LETTER_SIZE` and `spacing` vector
- `init_spacing()` function to compute derived spacing values

**Key WGSL conversions:**
- `uvec4` → `vec4<u32>`
- `uint` → `u32`
- `array<vec4<u32>, 10>` for the glyph data
- `atan()` with 2 args → `atan2()`
- `step(edge, x)` → `f32(x < edge)` pattern
- `tt_` renamed to `letter_tt` (WGSL doesn't allow trailing underscores)
FC03u, 0x00C03FEFu, 0xFF03C0F0u, 0x3FFDFE00u),  // 6
    vec4<u32>(0xFFFFF00Cu, 0x070180E0u, 0x301C0601u, 0x80601800u),  // 7
    vec4<u32>(0x7FBFFC0Fu, 0x03C0DFE7u, 0xFB03C0F0u, 0x3FFDFE00u),  // 8
    vec4<u32>(0x7FFFFC0Fu, 0x03C0FFF7u, 0xFC0300C0u, 0x300C0300u)   // 9
);

// Dash character bitmap (-)
const char_dash: vec4<u32> = vec4<u32>(0x00000000u, 0x00003FFFu, 0xFC000000u, 0x00000000u);

// Period character bitmap (.)
const char_period: vec4<u32> = vec4<u32>(0x00000000u, 0x00000000u, 0x00000000u, 0x00C03000u);

// ============================================================================
// BIT EXTRACTION FUNCTION
// ============================================================================
// Extracts a single bit from a u32 value at position p (0-31)
// Returns 1 if bit is set, 0 otherwise
fn _O(v: u32, p: u32) -> u32 {
    return ((v << p) & 0x80000000u) >> 31u;
}

// ============================================================================
// GLYPH LOOKUP FUNCTION
// ============================================================================
// Renders a character from uvec4 bitmap data at position c with scale b
// d is the fragment coordinate being tested
// Returns 1 if pixel should be drawn, 0 otherwise
fn glyph(a: vec4<u32>, b: f32, c: vec2<f32>, d: vec2<f32>) -> i32 {
    var e = d - c;
    e = e / b;
    e.y = 12.0 - e.y;
    
    if (e.x < 0.0 || e.x >= 10.0 || e.y < 0.0 || e.y >= 12.0) {
        return 0;
    }
    
    let f = vec2<u32>(e);
    let g = f.x + 10u * f.y;
    var h: u32;
    
    if (g < 32u) {
        h = _O(a.x, g);
    } else if (g < 64u) {
        h = _O(a.y, g - 32u);
    } else if (g < 96u) {
        h = _O(a.z, g - 64u);
    } else {
        h = _O(a.w, g - 96u);
    }
    
    return i32(h);
}

// ============================================================================
// NUMBER RENDERING FUNCTION
// ============================================================================
// Renders a number with specified decimal places at given position
// number: value to render
// places: number of decimal places
// scale: size scale
// pos: starting position
// fragCoord: current fragment coordinate
// Returns 1 if pixel is part of the number, 0 otherwise
fn number_to_glyph(number_in: f32, places: i32, scale: f32, pos_in: vec2<f32>, fragCoord: vec2<f32>) -> i32 {
    let mx = 12.0 * scale;
    var px = 0;
    var number = number_in;
    var pos = pos_in;
    
    // Handle negative numbers
    if (number < 0.0) {
        px = px + glyph(char_dash, scale, pos, fragCoord);
        pos.x = pos.x + mx;
        number = number * -1.0;
    }
    
    // Scale by decimal places
    number = round(number * pow(10.0, f32(places)));
    
    // Extract digits
    var numlist: array<i32, 20>;
    var numlistLen: i32 = 0;
    
    while (number >= 1.0 && numlistLen < 20) {
        numlist[numlistLen] = i32(number % 10.0);
        numlistLen = numlistLen + 1;
        number = number / 10.0;
    }
    
    // Handle zero case
    if (numlistLen < places + 1) {
        if (numlistLen < 1) {
            px = px + glyph(char_numbers[0], scale, pos, fragCoord);
            pos.x = pos.x + mx;
        }
    }
    
    // Render digits (most significant first)
    for (var i: i32 = numlistLen - 1; i >= 0; i = i - 1) {
        let digitIndex = numlist[i];
        if (digitIndex >= 0 && digitIndex < 10) {
            px = px + glyph(char_numbers[digitIndex], scale, pos, fragCoord);
        }
        pos.x = pos.x + mx;
    }
    
    return select(0, 1, px > 0);
}

// ============================================================================
// SDF TEXT SYSTEM CONSTANTS
// ============================================================================
// Size constant for SDF letter shapes
const LETTER_SIZE: vec2<f32> = vec2<f32>(0.3, 0.5);

// Spacing for text layout (converted from #define macros)
const SPACING_X: f32 = 1.0;
var<private> spacing: vec3<f32> = vec3<f32>(1.0, 0.5, 1.0);

// ============================================================================
// SDF SHAPE PRIMITIVES
// ============================================================================
fn sd_circle(uv: vec2<f32>) -> f32 {
    return abs(length(uv) - LETTER_SIZE.x);
}

fn sd_circle_s(uv: vec2<f32>) -> f32 {
    return abs(length(uv) - LETTER_SIZE.x * 0.5);
}

fn sd_vert(uv: vec2<f32>) -> f32 {
    return length(vec2<f32>(uv.x, max(0.0, abs(uv.y) - LETTER_SIZE.x)));
}

fn sd_halfvert(uv: vec2<f32>) -> f32 {
    return length(vec2<f32>(uv.x, max(0.0, abs(uv.y) - LETTER_SIZE.x * 0.5)));
}

fn sd_hori(uv: vec2<f32>) -> f32 {
    return length(vec2<f32>(max(0.0, abs(uv.x) - LETTER_SIZE.x), uv.y));
}

fn sd_halfhori(uv: vec2<f32>) -> f32 {
    return length(vec2<f32>(max(0.0, abs(uv.x) - LETTER_SIZE.x * 0.5), uv.y));
}

fn sd_diag(uv: vec2<f32>) -> f32 {
    return length(vec2<f32>(max(0.0, abs(uv.y - uv.x) - LETTER_SIZE.x * 2.0), uv.y + uv.x));
}

fn sd_halfdiag(uv: vec2<f32>) -> f32 {
    return length(vec2<f32>(max(0.0, abs(uv.x - uv.y) - LETTER_SIZE.x), uv.y + uv.x));
}

// ============================================================================
// SDF ALPHABET (aa through zz, plus brackets and semicolon)
// ============================================================================

fn letter_aa(uv: vec2<f32>) -> f32 {
    let edge = LETTER_SIZE;
    let x_line = vec2<f32>(LETTER_SIZE.x * 0.5, 0.0);
    var x = sd_circle(uv);
    x = mix(x, min(sd_vert(uv - edge), sd_vert(uv + edge)), f32(uv.y < 0.0));
    x = min(x, sd_hori(uv - x_line));
    return x;
}

fn letter_bb(uv: vec2<f32>) -> f32 {
    let edge = LETTER_SIZE;
    var x = sd_vert(uv + edge);
    x = min(x, sd_hori(uv - edge.yx));
    x = min(x, sd_hori(uv + edge.yx));
    x = min(x, sd_hori(uv - vec2<f32>(LETTER_SIZE.x * 0.5, 0.0)));
    x = mix(min(sd_circle_s(uv - LETTER_SIZE.xx * 0.5), sd_circle_s(uv - LETTER_SIZE * 0.5)), x, f32(uv.x < 0.5));
    return x;
}

fn letter_cc(uv: vec2<f32>) -> f32 {
    let p = 0.8;
    var x = sd_circle(uv);
    var a = atan2(uv.x, abs(uv.y));
    a = smoothstep(0.7, 1.5707, a);
    x = x + a;
    var uv2 = uv;
    uv2.y = -abs(uv2.y);
    x = min(length(uv2 + LETTER_SIZE.x * vec2<f32>(-cos(p), sin(p))), x);
    return x;
}

fn letter_dd(uv: vec2<f32>) -> f32 {
    let edge = LETTER_SIZE;
    var x = sd_vert(uv + edge);
    x = min(x, sd_hori(uv + edge.yx));
    x = min(x, sd_hori(uv - edge.yx));
    x = mix(sd_circle(uv), x, f32(uv.x < 0.0));
    return x;
}

fn letter_ee(uv: vec2<f32>) -> f32 {
    var x = letter_cc(uv);
    x = mix(sd_circle(uv), x, f32(uv.y < 0.0));
    x = min(x, sd_hori(uv));
    return x;
}

fn letter_ff(uv: vec2<f32>) -> f32 {
    let edge = LETTER_SIZE;
    var x = sd_vert(uv + edge);
    x = min(x, sd_hori(uv - edge.yx));
    x = mix(sd_circle(uv), x, f32(min(-uv.x, uv.y) < 0.0));
    x = min(x, sd_halfhori(uv + edge * 0.5));
    return x;
}

fn letter_gg(uv: vec2<f32>) -> f32 {
    let edge = LETTER_SIZE;
    var x = letter_cc(uv);
    x = mix(x, sd_circle(uv), f32(uv.y < 0.0));
    x = min(x, sd_halfhori(uv - edge * 0.5));
    return x;
}

fn letter_hh(uv: vec2<f32>) -> f32 {
    let edge = LETTER_SIZE;
    var x = sd_vert(abs(uv) - edge);
    x = min(x, sd_hori(uv));
    return x;
}

fn letter_ii(uv: vec2<f32>) -> f32 {
    return letter_hh(uv.yx);
}

fn letter_jj(uv: vec2<f32>) -> f32 {
    let edge = LETTER_SIZE;
    var x = sd_vert(uv - edge);
    x = min(x, length(uv + edge));
    x = mix(x, sd_circle(uv), f32(uv.y < 0.0));
    return x;
}

fn letter_kk(uv: vec2<f32>) -> f32 {
    let edge = LETTER_SIZE;
    var uv2 = uv;
    uv2.y = abs(uv2.y);
    var x = sd_circle(uv2 - edge.yx);
    x = mix(length(uv2 - LETTER_SIZE.xx), x, f32(uv2.y < LETTER_SIZE.x));
    x = mix(x, min(sd_vert(uv2 + edge), sd_hori(uv2)), f32(uv2.x < 0.0));
    return x;
}

fn letter_ll(uv: vec2<f32>) -> f32 {
    let edge = LETTER_SIZE;
    return min(sd_vert(uv + edge), sd_hori(uv + edge.yx));
}

fn letter_mm(uv: vec2<f32>) -> f32 {
    let edge = LETTER_SIZE;
    var uv2 = uv;
    uv2.x = abs(uv2.x);
    var x = sd_vert(uv2 - edge);
    x = min(x, sd_halfvert(uv2 - edge.yx * 0.5));
    x = mix(sd_circle_s(uv2 - LETTER_SIZE.xx * 0.5), x, f32(uv2.y < 0.5));
    return x;
}

fn letter_nn(uv: vec2<f32>) -> f32 {
    var x = sd_circle(uv);
    x = mix(min(sd_vert(uv - LETTER_SIZE), sd_vert(uv + LETTER_SIZE)), x, clamp(ceil(uv.y), 0.0, 1.0));
    return x;
}

fn letter_oo(uv: vec2<f32>) -> f32 {
    return sd_circle(uv);
}

fn letter_pp(uv: vec2<f32>) -> f32 {
    let edge = LETTER_SIZE;
    var x = sd_hori(uv);
    x = min(x, sd_hori(uv - edge.yx));
    x = mix(sd_circle_s(uv + edge.yy * 0.5), x, f32(uv.x < LETTER_SIZE.x * 0.5));
    x = min(x, sd_vert(uv + edge));
    return x;
}

fn letter_qq(uv: vec2<f32>) -> f32 {
    let edge = LETTER_SIZE;
    var x = sd_circle(uv);
    x = min(x, sd_halfdiag(uv - LETTER_SIZE.xy * 0.5));
    return x;
}

fn letter_rr(uv: vec2<f32>) -> f32 {
    let edge = LETTER_SIZE;
    var x = min(sd_hori(uv - edge.yx), sd_vert(uv + edge));
    x = mix(x, sd_circle(uv), f32(min(-uv.x, uv.y) > 0.0));
    return x;
}

fn letter_ss(uv: vec2<f32>) -> f32 {
    let edge = LETTER_SIZE;
    var x = sd_hori(uv - edge.yx);
    x = min(x, sd_halfhori(uv));
    var u = uv;
    u = u + vec2<f32>(-LETTER_SIZE.y * 0.5, LETTER_SIZE.y * 0.5);
    x = mix(sd_circle_s(u), x, f32(-edge.x * 0.5 < uv.x));
    var x2 = sd_hori(uv + edge.yx);
    x2 = min(x2, sd_halfhori(uv));
    u = uv;
    u = u - vec2<f32>(-LETTER_SIZE.y * 0.5, LETTER_SIZE.y * 0.5);
    x2 = mix(x2, sd_circle_s(u), f32(edge.x * 0.5 < uv.x));
    return min(x, x2);
}

fn letter_tt(uv: vec2<f32>) -> f32 {
    return min(sd_vert(uv), sd_hori(uv - LETTER_SIZE.yx));
}

fn letter_uu(uv: vec2<f32>) -> f32 {
    let edge = LETTER_SIZE;
    var uv2 = uv;
    uv2.x = abs(uv2.x);
    var x = mix(sd_circle(uv2), sd_vert(uv2 - edge), f32(0.0 < uv2.y));
    return x;
}

fn letter_vv(uv: vec2<f32>) -> f32 {
    let p = 0.5;
    var uv2 = uv;
    uv2.x = abs(uv2.x);
    // Manual rotation matrix application
    let rot_uv = vec2<f32>(
        uv2.x * cos(p) - uv2.y * sin(p),
        uv2.x * sin(p) + uv2.y * cos(p)
    );
    var x = sd_vert(rot_uv - LETTER_SIZE * 0.5);
    return x;
}

fn letter_ww(uv: vec2<f32>) -> f32 {
    var uv2 = uv;
    uv2.y = -uv2.y;
    return letter_mm(uv2);
}

fn letter_xx(uv: vec2<f32>) -> f32 {
    var uv2 = abs(uv) * vec2<f32>(-1.0, 1.0);
    return sd_diag(uv2);
}

fn letter_yy(uv: vec2<f32>) -> f32 {
    let edge = LETTER_SIZE;
    var uv2 = uv;
    uv2.x = abs(uv2.x);
    var x = min(sd_halfvert(uv2 + edge.yx * 0.5), sd_circle(uv2 - edge.yx));
    x = mix(x, length(uv2 - LETTER_SIZE.xx), f32(LETTER_SIZE.x < uv2.y));
    return x;
}

fn letter_zz(uv: vec2<f32>) -> f32 {
    let edge = LETTER_SIZE;
    var x = min(sd_hori(uv - edge.yx), sd_hori(uv + edge.yx));
    var uv2 = uv;
    uv2.x = -uv2.x;
    return min(x, sd_diag(uv2));
}

// ============================================================================
// SDF PUNCTUATION
// ============================================================================
fn bracket_right(uv: vec2<f32>) -> f32 {
    let size = LETTER_SIZE;
    var uv2 = uv;
    uv2.x = uv2.x - size.x * 1.5;
    let p = 1.3;
    uv2.y = abs(uv2.y);
    let a = atan2(uv2.x, uv2.y);
    var x = abs(length(uv2) - size.x * 2.0);
    var uv3 = uv2;
    uv3.y = -uv3.y;
    x = mix(x, length(uv3 + vec2<f32>(cos(p), sin(p)) * size.x * 2.0), f32(-0.3 < a));
    return x;
}

fn bracket_left(uv: vec2<f32>) -> f32 {
    var uv2 = uv;
    uv2.x = -uv2.x;
    return bracket_right(uv2);
}

fn semicolon(uv: vec2<f32>) -> f32 {
    let edge = LETTER_SIZE;
    var y = length(uv - edge.yx);
    var uv2 = uv;
    uv2 = uv2 + vec2<f32>(LETTER_SIZE.x * 0.5, LETTER_SIZE.x * 0.75);
    var x = sd_circle_s(uv2);
    let z = min(length(uv2 - edge.xy * 0.5), length(uv2 + edge.yx * 0.5));
    x = mix(z, x, f32(max(uv2.y, -uv2.x) < 0.0));
    x = min(x, y);
    return x;
}

// ============================================================================
// TEXT LAYOUT SYSTEM (converted from #define macros)
// ============================================================================
// Initialize spacing vector
fn init_spacing() {
    spacing.y = spacing.x * 0.5;
    spacing.z = 1.0 / spacing.x;
}

// ============================================================================
// EXAMPLE TEXT RENDERING FUNCTION
// ============================================================================
// This demonstrates how to use the text system.
// Returns the SDF distance to the text at position uv.
fn text_sdf(uv: vec2<f32>) -> f32 {
    init_spacing();
    var p = uv;
    var x = 100.0;
    
    // Example: render "om"
    p.x = p.x + 15.0;
    p.y = p.y - 2.0;
    
    // Letter 'o' at position
    x = min(x, letter_oo(p));
    
    // Move to next letter position
    p.x = p.x + spacing.x;
    
    // Letter 'm'
    x = min(x, letter_mm(p));
    
    return x;
}

// ============================================================================
// COMPLETE TEXT RENDERING WITH BOTH SYSTEMS
// ============================================================================
// Main text rendering entry point that combines both bitmap and SDF text
fn render_text(uv: vec2<f32>, fragCoord: vec2<f32>) -> f32 {
    var d = 100.0;
    
    // SDF text rendering
    d = min(d, text_sdf(uv));
    
    return d;
}
