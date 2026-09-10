// ============================================================================
// SDF TEXT — analytic letter distance fields ported from the legacy GLSL
// reference (archive/shaders/legacy/yoga.glsl lines 482-731, the `aa()`..`zz()`
// alphabet). Wired into a small screen-space breath-phase label
// ("INHALE" / "HOLD" / "EXHALE") composited by renderBreathHUD().
// ============================================================================

const TEXT_SIZE: vec2<f32> = vec2<f32>(0.55, -0.55);
const TEXT_EDGE: vec2<f32> = vec2<f32>(0.5, 0.1);

fn glyphCircle(uv: vec2<f32>) -> f32 {
  return abs(length(uv) - TEXT_SIZE.x);
}

fn glyphCircleHalf(uv: vec2<f32>) -> f32 {
  return abs(length(uv) - TEXT_SIZE.x * 0.5);
}

fn glyphVert(uv: vec2<f32>) -> f32 {
  return length(vec2<f32>(uv.x, max(0.0, abs(uv.y) - TEXT_SIZE.x)));
}

fn glyphVertHalf(uv: vec2<f32>) -> f32 {
  return length(vec2<f32>(uv.x, max(0.0, abs(uv.y) - TEXT_SIZE.x * 0.5)));
}

fn glyphHori(uv: vec2<f32>) -> f32 {
  return length(vec2<f32>(max(0.0, abs(uv.x) - TEXT_SIZE.x), uv.y));
}

fn glyphHoriHalf(uv: vec2<f32>) -> f32 {
  return length(vec2<f32>(max(0.0, abs(uv.x) - TEXT_SIZE.x * 0.5), uv.y));
}

fn glyphDiag(uv: vec2<f32>) -> f32 {
  return length(vec2<f32>(max(0.0, abs(uv.y - uv.x) - TEXT_SIZE.x * 2.0), uv.y + uv.x));
}

fn glyphDiagHalf(uv: vec2<f32>) -> f32 {
  return length(vec2<f32>(max(0.0, abs(uv.x - uv.y) - TEXT_SIZE.x), uv.y + uv.x));
}

// ---------------------------------------------------------------------------
// Alphabet (a=0 .. z=25), ported 1:1 from the GLSL reference.
// ---------------------------------------------------------------------------

fn letterA(uv: vec2<f32>) -> f32 {
  var x = glyphCircle(uv);
  x = mix(x, min(glyphVert(uv - TEXT_EDGE), glyphVert(uv + TEXT_EDGE)), step(uv.y, 0.0));
  x = min(x, glyphHori(uv));
  return x;
}

fn letterB(uv: vec2<f32>) -> f32 {
  var x = glyphVert(uv + TEXT_EDGE);
  x = min(x, glyphHori(uv - TEXT_EDGE.yx));
  x = min(x, glyphHori(uv + TEXT_EDGE.yx));
  x = min(x, glyphHori(uv));
  x = mix(min(glyphCircleHalf(uv - TEXT_SIZE.xx * 0.5), glyphCircleHalf(uv - TEXT_SIZE * 0.5)), x, step(uv.x, 0.5));
  return x;
}

fn letterC(uv: vec2<f32>) -> f32 {
  var x = glyphCircle(uv);
  let p: f32 = 0.8;
  var a = atan2(uv.x, abs(uv.y));
  a = smoothstep(0.7, 1.5707, a);
  x = x + a;
  var uv2 = uv;
  uv2.y = -abs(uv2.y);
  x = min(length(uv2 + TEXT_SIZE.x * vec2<f32>(-cos(p), sin(p))), x);
  return x;
}

fn letterD(uv: vec2<f32>) -> f32 {
  var x = glyphVert(uv + TEXT_EDGE);
  x = min(x, glyphHori(uv + TEXT_EDGE.yx));
  x = min(x, glyphHori(uv - TEXT_EDGE.yx));
  x = mix(glyphCircle(uv), x, step(uv.x, 0.0));
  return x;
}

fn letterE(uv: vec2<f32>) -> f32 {
  var x = letterC(uv);
  x = mix(glyphCircle(uv), x, step(uv.y, 0.0));
  x = min(x, glyphHori(uv));
  return x;
}

fn letterF(uv: vec2<f32>) -> f32 {
  var x = glyphVert(uv + TEXT_EDGE);
  x = min(x, glyphHori(uv - TEXT_EDGE.yx));
  x = mix(glyphCircle(uv), x, step(min(-uv.x, uv.y), 0.0));
  x = min(x, glyphHoriHalf(uv + TEXT_EDGE * 0.5));
  return x;
}

fn letterG(uv: vec2<f32>) -> f32 {
  var x = letterC(uv);
  x = mix(x, glyphCircle(uv), step(uv.y, 0.0));
  x = min(x, glyphHoriHalf(uv - TEXT_EDGE * 0.5));
  return x;
}

fn letterH(uv: vec2<f32>) -> f32 {
  var x = glyphVert(abs(uv) - TEXT_EDGE);
  x = min(x, glyphHori(uv));
  return x;
}

fn letterI(uv: vec2<f32>) -> f32 {
  return letterH(uv.yx);
}

fn letterJ(uv: vec2<f32>) -> f32 {
  var x = glyphVert(uv - TEXT_EDGE);
  x = min(x, length(uv + TEXT_EDGE));
  x = mix(x, glyphCircle(uv), step(uv.y, 0.0));
  return x;
}

fn letterK(uv_in: vec2<f32>) -> f32 {
  var uv = uv_in;
  uv.y = abs(uv.y);
  var x = glyphCircle(uv - TEXT_EDGE.yx);
  x = mix(length(uv - TEXT_SIZE.xx), x, step(uv.y, TEXT_SIZE.x));
  x = mix(x, min(glyphVert(uv + TEXT_EDGE), glyphHori(uv)), step(uv.x, 0.0));
  return x;
}

fn letterL(uv: vec2<f32>) -> f32 {
  return min(glyphVert(uv + TEXT_EDGE), glyphHori(uv + TEXT_EDGE.yx));
}

fn letterM(uv_in: vec2<f32>) -> f32 {
  var uv = uv_in;
  uv.x = abs(uv.x);
  var x = glyphVert(uv - TEXT_EDGE);
  x = min(x, glyphVertHalf(uv - TEXT_EDGE.yx * 0.5));
  x = mix(glyphCircleHalf(uv - TEXT_SIZE.xx * 0.5), x, step(uv.y, 0.5));
  return x;
}

fn letterN(uv: vec2<f32>) -> f32 {
  var x = glyphCircle(uv);
  x = mix(min(glyphVert(uv - TEXT_EDGE), glyphVert(uv + TEXT_EDGE)), x, clamp(ceil(uv.y), 0.0, 1.0));
  return x;
}

fn letterO(uv: vec2<f32>) -> f32 {
  return glyphCircle(uv);
}

fn letterP(uv: vec2<f32>) -> f32 {
  var x = glyphHori(uv);
  x = min(x, glyphHori(uv - TEXT_EDGE.yx));
  x = mix(glyphCircleHalf(uv + TEXT_SIZE.yy * 0.5), x, step(uv.x, TEXT_SIZE.x * 0.5));
  x = min(x, glyphVert(uv + TEXT_EDGE));
  return x;
}

fn letterQ(uv: vec2<f32>) -> f32 {
  var x = glyphCircle(uv);
  x = min(x, glyphDiagHalf(uv - TEXT_SIZE.xy * 0.5));
  return x;
}

fn letterR(uv: vec2<f32>) -> f32 {
  var x = min(glyphHori(uv - TEXT_EDGE.yx), glyphVert(uv + TEXT_EDGE));
  x = mix(x, glyphCircle(uv), step(0.0, min(-uv.x, uv.y)));
  return x;
}

fn letterS(uv: vec2<f32>) -> f32 {
  var x = glyphHori(uv - TEXT_EDGE.yx);
  x = min(x, glyphHoriHalf(uv));
  var u = uv + vec2<f32>(-TEXT_SIZE.y * 0.5, TEXT_SIZE.y * 0.5);
  x = mix(glyphCircleHalf(u), x, step(-TEXT_EDGE.x * 0.5, uv.x));
  var x2 = glyphHori(uv + TEXT_EDGE.yx);
  x2 = min(x2, glyphHoriHalf(uv));
  u = uv - vec2<f32>(-TEXT_SIZE.y * 0.5, TEXT_SIZE.y * 0.5);
  x2 = mix(x2, glyphCircleHalf(u), step(TEXT_EDGE.x * 0.5, uv.x));
  return min(x, x2);
}

fn letterT(uv: vec2<f32>) -> f32 {
  return min(glyphVert(uv), glyphHori(uv - TEXT_EDGE.yx));
}

fn letterU(uv_in: vec2<f32>) -> f32 {
  var uv = uv_in;
  uv.x = abs(uv.x);
  let x = mix(glyphCircle(uv), glyphVert(uv - TEXT_EDGE), step(0.0, uv.y));
  return x;
}

fn letterV(uv_in: vec2<f32>) -> f32 {
  var uv = uv_in;
  uv.x = abs(uv.x);
  let p: f32 = 0.5;
  let c = cos(p);
  let s = sin(p);
  uv = vec2<f32>(uv.x * c + uv.y * s, uv.x * -s + uv.y * c);
  let x = glyphVert(uv - TEXT_EDGE * 0.5);
  return x;
}

fn letterW(uv_in: vec2<f32>) -> f32 {
  var uv = uv_in;
  uv.y = -uv.y;
  return letterM(uv);
}

fn letterX(uv: vec2<f32>) -> f32 {
  return glyphDiag(abs(uv) * vec2<f32>(-1.0, 1.0));
}

fn letterY(uv_in: vec2<f32>) -> f32 {
  var uv = uv_in;
  uv.x = abs(uv.x);
  var x = min(glyphVertHalf(uv + TEXT_EDGE.yx * 0.5), glyphCircle(uv - TEXT_EDGE.yx));
  x = mix(x, length(uv - TEXT_SIZE.xx), step(TEXT_SIZE.x, uv.y));
  return x;
}

fn letterZ(uv_in: vec2<f32>) -> f32 {
  var uv = uv_in;
  var x = min(glyphHori(uv - TEXT_EDGE.yx), glyphHori(uv + TEXT_EDGE.yx));
  uv.x = -uv.x;
  return min(x, glyphDiag(uv));
}

// Letter code -> SDF dispatch (a=0 .. z=25).
fn letterSDF(code: i32, uv: vec2<f32>) -> f32 {
  switch (code) {
    case 0: { return letterA(uv); }
    case 1: { return letterB(uv); }
    case 2: { return letterC(uv); }
    case 3: { return letterD(uv); }
    case 4: { return letterE(uv); }
    case 5: { return letterF(uv); }
    case 6: { return letterG(uv); }
    case 7: { return letterH(uv); }
    case 8: { return letterI(uv); }
    case 9: { return letterJ(uv); }
    case 10: { return letterK(uv); }
    case 11: { return letterL(uv); }
    case 12: { return letterM(uv); }
    case 13: { return letterN(uv); }
    case 14: { return letterO(uv); }
    case 15: { return letterP(uv); }
    case 16: { return letterQ(uv); }
    case 17: { return letterR(uv); }
    case 18: { return letterS(uv); }
    case 19: { return letterT(uv); }
    case 20: { return letterU(uv); }
    case 21: { return letterV(uv); }
    case 22: { return letterW(uv); }
    case 23: { return letterX(uv); }
    case 24: { return letterY(uv); }
    case 25: { return letterZ(uv); }
    default: { return 1000.0; }
  }
}

const TEXT_MAX_LEN: i32 = 8;

// Composite a fixed-length run of letter codes into one SDF, laid out
// left-to-right and centered on uv.x == 0.
fn textLine(codes: array<i32, 8>, count: i32, uv: vec2<f32>, advance: f32) -> f32 {
  var d: f32 = 1000.0;
  let half = f32(count - 1) * 0.5;
  for (var i: i32 = 0; i < count; i = i + 1) {
    let penX = (f32(i) - half) * advance;
    let p = uv - vec2<f32>(penX, 0.0);
    d = min(d, letterSDF(codes[i], p));
  }
  return d;
}

// ---------------------------------------------------------------------------
// Breath phase label overlay ("INHALE" / "HOLD" / "EXHALE"), screen-space,
// analogous to progressDial()/cycleCounter() but built on the SDF alphabet
// above instead of the 3x5 digitPattern() font.
// ---------------------------------------------------------------------------

const TEXT_LABEL_POS: vec2<f32> = vec2<f32>(0.0, -0.42);
const TEXT_LABEL_HALF_EXTENT: vec2<f32> = vec2<f32>(0.42, 0.06);
const TEXT_LABEL_SCALE: f32 = 0.05;
const TEXT_LABEL_ADVANCE: f32 = 1.5;
const TEXT_LABEL_STROKE: f32 = 0.16;
const TEXT_LABEL_AA: f32 = 0.05;

fn breathLabel(uv: vec2<f32>, phase: u32) -> vec4<f32> {
  let boxMin = TEXT_LABEL_POS - TEXT_LABEL_HALF_EXTENT;
  let boxMax = TEXT_LABEL_POS + TEXT_LABEL_HALF_EXTENT;
  if (uv.x < boxMin.x || uv.x > boxMax.x || uv.y < boxMin.y || uv.y > boxMax.y) {
    return vec4<f32>(0.0);
  }

  var codes: array<i32, 8>;
  var count: i32 = 4;
  var color = HOLD1_COLOR;
  switch (phase) {
    case 0u: {
      // I N H A L E
      codes[0] = 8; codes[1] = 13; codes[2] = 7; codes[3] = 0; codes[4] = 11; codes[5] = 4;
      count = 6;
      color = INHALE_COLOR;
    }
    case 1u: {
      // H O L D
      codes[0] = 7; codes[1] = 14; codes[2] = 11; codes[3] = 3;
      count = 4;
      color = HOLD1_COLOR;
    }
    case 2u: {
      // E X H A L E
      codes[0] = 4; codes[1] = 23; codes[2] = 7; codes[3] = 0; codes[4] = 11; codes[5] = 4;
      count = 6;
      color = EXHALE_COLOR;
    }
    case 3u: {
      // H O L D
      codes[0] = 7; codes[1] = 14; codes[2] = 11; codes[3] = 3;
      count = 4;
      color = HOLD2_COLOR;
    }
    default: {}
  }

  let local = (uv - TEXT_LABEL_POS) / TEXT_LABEL_SCALE;
  let d = textLine(codes, count, local, TEXT_LABEL_ADVANCE);
  let value = 1.0 - smoothstep(TEXT_LABEL_STROKE - TEXT_LABEL_AA, TEXT_LABEL_STROKE + TEXT_LABEL_AA, d);

  return vec4<f32>(color * value, value);
}
