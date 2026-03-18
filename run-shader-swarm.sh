#!/bin/bash
# Shader Improvement Swarm Execution Script
# Runs a 4-agent pipeline: 1 Planner + 3 Workers to improve the yoga shader

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CODEPIT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
AI_CLI="$CODEPIT_DIR/ai-cli.sh"
SWARM_SPEC="$SCRIPT_DIR/swarm-spec-shader-improvements.yaml"
OUTPUT_DIR="$SCRIPT_DIR/swarm-outputs"

echo "🧘 Yoga Studio Shader Improvement Swarm"
echo "========================================"
echo ""

# Check dependencies
if [ ! -f "$AI_CLI" ]; then
    echo "❌ Error: ai-cli.sh not found at $AI_CLI"
    exit 1
fi

if [ ! -f "$SWARM_SPEC" ]; then
    echo "❌ Error: Swarm spec not found at $SWARM_SPEC"
    exit 1
fi

mkdir -p "$OUTPUT_DIR"

echo "📋 Phase 1: Planning"
echo "--------------------"
echo "Running ShaderArchitect to analyze GLSL and plan improvements..."
echo ""

# Phase 1: Planner Agent
PLANNER_PROMPT="
You are the ShaderArchitect agent for the yoga_studio shader improvement swarm.

Read and analyze the following files:
1. Original GLSL shader: projects/yoga_studio/public/yoga.glsl (990 lines)
2. Current WGSL shader: projects/yoga_studio/public/yoga-regular.wgsl (400 lines)
3. Swarm specification: projects/yoga_studio/swarm-spec-shader-improvements.yaml

Your task is to create a detailed implementation plan for the 3 worker agents:
- GeometrySpecialist: Port kalei() and starPattern() from GLSL
- EffectSpecialist: Port SDF text rendering system (alphabet + numbers)
- UISpecialist: Implement circular progress dial and counters

Create a file at: projects/yoga_studio/swarm-outputs/improvement_plan.json

The JSON should contain:
{
  \"summary\": \"Brief description of top 3 improvements\",
  \"agent_tasks\": [
    {
      \"agent\": \"GeometrySpecialist\",
      \"task_id\": \"GEO-001\",
      \"title\": \"...\",
      \"glsl_reference_lines\": \"...\",
      \"key_functions\": [...],
      \"requirements\": [...]
    },
    {
      \"agent\": \"EffectSpecialist\",
      \"task_id\": \"EFF-001\",
      \"title\": \"...\",
      \"glsl_reference_lines\": \"...\",
      \"key_functions\": [...],
      \"requirements\": [...]
    },
    {
      \"agent\": \"UISpecialist\",
      \"task_id\": \"UI-001\",
      \"title\": \"...\",
      \"glsl_reference_lines\": \"...\",
      \"key_functions\": [...],
      \"requirements\": [...]
    }
  ],
  \"integration_notes\": \"Order of integration and conflict resolution\"
}

Focus on what features from the 990-line GLSL are worth porting to WGSL for a meditation breathing app.
Be specific about function signatures, line references, and integration points.
"

echo "🤖 Running ShaderArchitect (Kimi recommended for long context)..."
if [ -n "$KIMI_API_KEY" ] || [ -n "$MOONSHOT_API_KEY" ]; then
    "$AI_CLI" --kimi "$PLANNER_PROMPT"
else
    echo "⚠️  Kimi API key not set. Using default provider..."
    "$AI_CLI" delegate planner "$PLANNER_PROMPT"
fi

echo ""
echo "📋 Phase 2: Parallel Worker Execution"
echo "--------------------------------------"

# Phase 2: Worker Agents (run in concept - actual parallel execution would need background jobs)

echo ""
echo "🤖 Agent 1/3: GeometrySpecialist"
echo "    Task: Port kalei() and starPattern() functions"
GEOMETRY_PROMPT="
You are the GeometrySpecialist agent for the yoga_studio shader swarm.

Your task: Port the background visual effects from GLSL to WGSL.

READ THESE FILES:
1. GLSL source (lines 275-293, 216-269): projects/yoga_studio/public/yoga.glsl
2. Current WGSL: projects/yoga_studio/public/yoga-regular.wgsl
3. Plan: projects/yoga_studio/swarm-outputs/implement_plan.json

DELIVERABLE: Create projects/yoga_studio/swarm-outputs/improvement-2-geometry.wgsl

Contents:
1. kalei() function - Port from GLSL, reduce iterations from 6 to 4
2. starPattern() with mapStars() helper - Port hex-symmetric star pattern
3. Updated trace() with fog integration
4. Integration notes

WGSL CONVERSION RULES:
- float → f32
- vec3 → vec3<f32>
- atan(y,x) → atan2(y,x)
- for(float i=0; i<N; i++) → for(var i: i32 = 0; i < N; i = i + 1)
- Use existing rot2() from yoga-regular.wgsl or create if missing

The kalei function creates a recursive kaleidoscope effect:
```glsl
vec3 kalei(vec3 p) {
    p.x = abs(p.x) - 2.5;
    vec3 q = p;
    q.y -= .5;
    q.y += .4*sin(tt);
    p.y += .3*sin(p.z*3.+.5*tt);
    float at = length(q) - .01;
    for(float i=0.; i < 6.; i++) {
        p.x = abs(p.x) - 1.5;
        p.xz *= rot2(1.-exp(-p.z*.14*i)+.2*tt+.1*at);
        p.xy *= rot2(sin(2.*i)+.2*tt);
        p.y += 1.-exp(-p.z*.1*i);
    }
    p.x = abs(p.x) + 2.5;
    return p;
}
```

Output ONLY the WGSL code with brief comments. No markdown code blocks, just raw WGSL.
"

echo "    Executing GeometrySpecialist..."
"$AI_CLI" delegate coder "$GEOMETRY_PROMPT" > "$OUTPUT_DIR/improvement-2-geometry.wgsl"

echo ""
echo "🤖 Agent 2/3: EffectSpecialist"
echo "    Task: Port SDF text rendering system"
EFFECT_PROMPT="
You are the EffectSpecialist agent for the yoga_studio shader swarm.

Your task: Port the SDF text rendering system from GLSL to WGSL.

READ THESE FILES:
1. GLSL source (lines 72-144, 487-731, 801-849): projects/yoga_studio/public/yoga.glsl
2. Current WGSL: projects/yoga_studio/public/yoga-regular.wgsl
3. Plan: projects/yoga_studio/swarm-outputs/improvement_plan.json

DELIVERABLE: Create projects/yoga_studio/swarm-outputs/improvement-2-effect.wgsl

Contents:
1. Glyph data arrays (char_numbers[10], char_dash, char_period)
2. Complete alphabet SDFs (aa through zz, plus brackets, semicolon)
3. Text layout system (convert #define macros to functions)
4. number() rendering function

KEY GLSL TO PORT:
- Glyph data: uvec4[10] char_numbers (10x uvec4 for digits 0-9)
- Bit extraction: _O() function for glyph lookup
- Character lookup: glyph() function
- All 26 letters: aa(), bb(), cc(), ..., zz() SDF functions
- Number rendering: number() function

WGSL CONVERSION:
- uvec4 → vec4<u32>
- uint → u32
- Bit ops: & (and), >> (shift)
- Arrays: array<vec4<u32>, 10>
- No #define - use const and functions

Output ONLY the WGSL code with brief comments. No markdown code blocks, just raw WGSL.
"

echo "    Executing EffectSpecialist..."
"$AI_CLI" delegate coder "$EFFECT_PROMPT" > "$OUTPUT_DIR/improvement-2-effect.wgsl"

echo ""
echo "🤖 Agent 3/3: UISpecialist"
echo "    Task: Implement progress dial and counters"
UI_PROMPT="
You are the UISpecialist agent for the yoga_studio shader swarm.

Your task: Implement the breath timing HUD elements.

READ THESE FILES:
1. GLSL source (lines 851-866, 940-989): projects/yoga_studio/public/yoga.glsl
2. Current WGSL: projects/yoga_studio/public/yoga-regular.wgsl
3. Plan: projects/yoga_studio/swarm-outputs/improvement_plan.json

DELIVERABLE: Create projects/yoga_studio/swarm-outputs/improvement-2-ui.wgsl

Contents:
1. progressDial() function - Circular progress with gradient
2. cycleCounter() function - Display current cycle number
3. timeDisplay() function - Time remaining in phase
4. mainImage integration snippet

KEY GLSL TO PORT:
- getGradientValue() for dial color (red→yellow)
- Circular arc rendering with smoothstep
- Progress calculation from phaseProgress

REQUIREMENTS:
- Use u_breath.phaseProgress for progress (0.0 - 1.0)
- Gradient: mix(vec3(1,0,0), vec3(1,1,0), progress)
- Position in screen corner (use fragCoord)
- Keep minimal and elegant for meditation app

Output ONLY the WGSL code with brief comments. No markdown code blocks, just raw WGSL.
"

echo "    Executing UISpecialist..."
"$AI_CLI" delegate coder "$UI_PROMPT" > "$OUTPUT_DIR/improvement-2-ui.wgsl"

echo ""
echo "📋 Phase 3: Integration"
echo "-----------------------"

INTEGRATION_PROMPT="
You are the IntegrationEngineer for the yoga_studio shader swarm.

Your task: Merge all worker outputs into a single cohesive WGSL shader.

READ THESE FILES:
1. Base shader: projects/yoga_studio/public/yoga-regular.wgsl
2. Geometry output: projects/yoga_studio/swarm-outputs/improvement-2-geometry.wgsl
3. Effect output: projects/yoga_studio/swarm-outputs/improvement-2-effect.wgsl
4. UI output: projects/yoga_studio/swarm-outputs/improvement-2-ui.wgsl

DELIVERABLE: Create projects/yoga_studio/public/shaders/breath-swarm-next.wgsl

MERGE ORDER:
1. Start with base shader structure
2. Add geometry functions (kalei, starPattern)
3. Add text system (glyph data, alphabet SDFs)
4. Add UI functions (progress dial)
5. Update mainImage() to integrate everything

VALIDATION CHECKLIST:
- [ ] All function names are unique (no collisions)
- [ ] Uniform bindings match: u_breath at binding 0, iResolution at binding 1
- [ ] No WGSL syntax errors
- [ ] Compiles with proper entry points: vs_main, fs_main
- [ ] Uses correct WGSL types: f32, vec3<f32>, etc.

OUTPUT: Complete, production-ready WGSL shader file.
Output ONLY the WGSL code. No markdown code blocks, just raw WGSL.
"

echo "🤖 Running IntegrationEngineer..."
mkdir -p "$SCRIPT_DIR/public/shaders"
"$AI_CLI" delegate coder "$INTEGRATION_PROMPT" > "$SCRIPT_DIR/public/shaders/breath-swarm-next.wgsl"

echo ""
echo "✅ Swarm execution complete!"
echo ""
echo "Output files:"
echo "  📄 Plan: $OUTPUT_DIR/improvement_plan.json"
echo "  📄 Geometry: $OUTPUT_DIR/improvement-2-geometry.wgsl"
echo "  📄 Effects: $OUTPUT_DIR/improvement-2-effect.wgsl"
echo "  📄 UI: $OUTPUT_DIR/improvement-2-ui.wgsl"
echo "  📄 Final: $SCRIPT_DIR/public/shaders/breath-swarm-next.wgsl"
echo ""
echo "Next steps:"
echo "  1. Validate the shader with: ./dev.sh start yoga_studio"
echo "  2. Update WebGPUShader.tsx to load breath-swarm-next.wgsl"
echo "  3. Test in browser with WebGPU enabled"
