# Yoga Studio Shader Improvement Swarm

This guide explains how to run the agent swarm to enhance the yoga shader with features from the original GLSL.

## Overview

**Current State:**
- `public/yoga.glsl` - 990-line original with full raymarching, text rendering, star patterns
- `public/yoga-regular.wgsl` - 400-line simplified WGSL version

**Goal:** Port key GLSL features to WGSL:
1. **Kaleidoscope background** (`kalei()` function)
2. **SDF text rendering** (alphabet, numbers, breath instructions)
3. **Progress dial UI** (circular indicator, cycle counter)

## Running the Swarm

### Option 1: Using kimi-cli directly (Recommended)

```bash
cd projects/yoga_studio
./run-shader-swarm-kimicli.sh
```

This runs 4 agents sequentially using your local kimi-cli:
1. **ShaderArchitect** (Planner) - Analyzes GLSL vs WGSL
2. **GeometrySpecialist** - Ports kalei() and starPattern()
3. **EffectSpecialist** - Ports text rendering system
4. **UISpecialist** - Implements progress dial
5. **IntegrationEngineer** - Merges everything

### Option 2: Using the main AI CLI (API-based)

If you have API keys set:

```bash
# Set API key (for Moonshot/Kimi API)
export KIMI_API_KEY=sk-...
# or
export MOONSHOT_API_KEY=sk-...

cd projects/yoga_studio
./run-shader-swarm.sh
```

### Option 3: Manual Agent Delegation

Run individual agents manually using kimi-cli:

```bash
# Planner
cd projects/yoga_studio
kimi-cli --yolo -p "Read yoga.glsl and yoga-regular.wgsl, create an implementation plan for porting text rendering, kaleidoscope, and progress dial to WGSL"

# Workers (run in separate terminals)
kimi-cli --yolo -p "Port the kalei() function from GLSL to WGSL..."
kimi-cli --yolo -p "Port the SDF text alphabet from GLSL to WGSL..."
kimi-cli --yolo -p "Implement a circular progress dial in WGSL..."
```

## Swarm Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    SWARM ORCHESTRATOR                        │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
┌──────────────┐ ┌──────────┐ ┌──────────┐
│   Planner    │ │ Worker 1 │ │ Worker 2 │
│(ShaderArchitec│ │(Geometry)│ │ (Effect) │
└──────┬───────┘ └────┬─────┘ └────┬─────┘
       │              │            │
       ▼              ▼            ▼
 improvement_   improvement-  improvement-
   plan.json    2-geometry    2-effect
                    .wgsl         .wgsl
                       │            │
                       └─────┬──────┘
                             │
                    ┌────────▼────────┐
                    │  Integration    │
                    │  Engineer       │
                    └────────┬────────┘
                             │
                             ▼
              breath-swarm-next.wgsl
```

## Key GLSL Features to Port

### 1. kalei() - Kaleidoscope Tunnel
**GLSL Lines:** 296-312
```glsl
vec3 kalei(vec3 p) {
    p.x = abs(p.x) - 2.5;
    // ... recursive polar transforms
    for(float i=0.; i < 6.; i++) {
        p.x = abs(p.x) - 1.5;
        p.xz *= rot2(...);
        p.xy *= rot2(...);
    }
    return p;
}
```

### 2. SDF Text Rendering
**GLSL Lines:** 72-144 (glyphs), 487-731 (alphabet)
```glsl
uvec4[10] char_numbers = uvec4[10](...);  // Bit-packed glyphs
int glyph(uvec4 a, float b, vec2 c, vec2 d) { ... }  // Character lookup
float aa(vec2 uv) { ... }  // Letter 'a' SDF
// ... 26 letter functions
float text(vec3 pos) { ... }  // Composite text
```

### 3. Progress Dial
**GLSL Lines:** 851-866, 940-989
```glsl
vec4 getGradientValue(in vec2 uv) { ... }  // Red→yellow gradient
float progress = mod(iTime + strength * 0.5, strength) / strength;
// Circular arc rendering with smoothstep
```

## WGSL Conversion Notes

| GLSL | WGSL |
|------|------|
| `float` | `f32` |
| `vec3` | `vec3<f32>` |
| `uvec4` | `vec4<u32>` |
| `atan(y,x)` | `atan2(y,x)` |
| `for(float i=0; i<N; i++)` | `for(var i: i32 = 0; i < N; i = i + 1)` |
| `#define PI 3.14` | `const PI: f32 = 3.14;` |

## Output Files

After running the swarm:

```
projects/yoga_studio/
├── swarm-outputs/
│   ├── improvement_plan.json          # Planner output
│   ├── improvement-2-geometry.wgsl    # GeometrySpecialist
│   ├── improvement-2-effect.wgsl      # EffectSpecialist
│   └── improvement-2-ui.wgsl          # UISpecialist
└── public/shaders/
    └── breath-swarm-next.wgsl         # Final merged shader
```

## Integration

After the shader is generated:

1. **Test compilation:**
   ```bash
   ./dev.sh start yoga_studio
   ```

2. **Update WebGPUShader.tsx:**
   ```typescript
   const response = await fetch('./shaders/breath-swarm-next.wgsl');
   ```

3. **Verify uniforms match:**
   - `u_breath` at binding 0
   - `iResolution` at binding 1

## Performance Considerations

- **kalei() iterations:** Reduced from 6 to 4 for mobile performance
- **Text rendering:** May be expensive - consider making optional
- **Star pattern:** Keep simplified version for low-end devices
- **Progress dial:** Should be minimal overhead

## Troubleshooting

### kimi-cli not found
```bash
# Check installation
which kimi-cli

# Or set path explicitly
export KIMI_CLI=/path/to/kimi-cli
./run-shader-swarm-kimicli.sh
```

### Shader compilation errors
1. Check WGSL syntax with online validator
2. Ensure uniform buffer layouts match
3. Verify all functions have unique names

### Missing features after merge
- Check integration notes in improvement_plan.json
- Verify merge order was followed
- May need manual conflict resolution
