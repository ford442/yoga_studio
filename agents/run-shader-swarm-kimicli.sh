#!/bin/bash
# Shader Improvement Swarm Execution Script using kimi-cli
# Runs a 4-agent pipeline: 1 Planner + 3 Workers to improve the yoga shader

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_DIR="$SCRIPT_DIR/swarm-outputs"
KIMI_CLI="${KIMI_CLI:-kimi-cli}"

echo "🧘 Yoga Studio Shader Improvement Swarm (kimi-cli)"
echo "==================================================="
echo ""

# Check dependencies
if ! command -v "$KIMI_CLI" &> /dev/null; then
    echo "❌ Error: kimi-cli not found in PATH"
    echo "   Install from: https://kimi.com"
    exit 1
fi

mkdir -p "$OUTPUT_DIR"

# Helper function to run kimi-cli with proper flags
run_kimi() {
    local prompt="$1"
    local output_file="$2"
    local work_dir="${3:-$SCRIPT_DIR}"
    
    "$KIMI_CLI" \
        --print \
        --quiet \
        --work-dir "$work_dir" \
        --add-dir "$SCRIPT_DIR/public" \
        --prompt "$prompt" \
        > "$output_file" 2>&1
}

echo "📋 Phase 1: Planning"
echo "--------------------"
echo "Running ShaderArchitect to analyze GLSL and plan improvements..."
echo ""

# Phase 1: Planner Agent
PLANNER_PROMPT="You are the ShaderArchitect agent for the yoga_studio shader improvement swarm.

Read and analyze the following files in the workspace:
1. Original GLSL shader: public/yoga.glsl (990 lines) - full raymarcher with text rendering
2. Current WGSL shader: public/yoga-regular.wgsl (400 lines) - simplified version
3. Swarm specification: swarm-spec-shader-improvements.yaml

Your task is to create a detailed implementation plan for the 3 worker agents:
- GeometrySpecialist: Port kalei() and starPattern() from GLSL
- EffectSpecialist: Port SDF text rendering system (alphabet + numbers)
- UISpecialist: Implement circular progress dial and counters

Create a file at: swarm-outputs/improvement_plan.json

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

First, read the files, then create the improvement_plan.json file."

echo "🤖 Running ShaderArchitect..."
run_kimi "$PLANNER_PROMPT" "$OUTPUT_DIR/planner_output.txt"

# Extract just the JSON from the output (in case there's extra text)
if [ -f "$OUTPUT_DIR/planner_output.txt" ]; then
    # Try to extract JSON content between braces
    grep -oP '\{.*\}' "$OUTPUT_DIR/planner_output.txt" > "$OUTPUT_DIR/improvement_plan.json" 2>/dev/null || \
        cp "$OUTPUT_DIR/planner_output.txt" "$OUTPUT_DIR/improvement_plan.json"
fi

echo ""
echo "📋 Phase 2: Parallel Worker Execution"
echo "--------------------------------------"

# Phase 2: Worker Agents

echo ""
echo "🤖 Agent 1/3: GeometrySpecialist"
echo "    Task: Port kalei() and starPattern() functions"

GEOMETRY_PROMPT="You are the GeometrySpecialist agent for the yoga_studio shader swarm.

Your task: Port the background visual effects from GLSL to WGSL.

READ THESE FILES from the workspace:
1. GLSL source (lines 275-293, 216-269): public/yoga.glsl
2. Current WGSL: public/yoga-regular.wgsl

DELIVERABLE: Create swarm-outputs/improvement-2-geometry.wgsl

Contents:
1. kalei() function - Port from GLSL kalei(), reduce iterations from 6 to 4
2. starPattern() with mapStars() helper - Port hex-symmetric star pattern
3. Updated trace() with fog integration
4. Integration notes

WGSL CONVERSION RULES:
- float → f32
- vec3 → vec3<f32>
- atan(y,x) → atan2(y,x)
- for(float i=0; i<N; i++) → for(var i: i32 = 0; i < N; i = i + 1)
- Use existing rot2() from yoga-regular.wgsl

The kalei function from GLSL creates a recursive kaleidoscope effect with polar repetition.
The starPattern uses log-polar coordinates with hexagonal symmetry.

Create the file swarm-outputs/improvement-2-geometry.wgsl with the WGSL functions."

echo "    Executing GeometrySpecialist..."
run_kimi "$GEOMETRY_PROMPT" "$OUTPUT_DIR/improvement-2-geometry.wgsl"

echo ""
echo "🤖 Agent 2/3: EffectSpecialist"
echo "    Task: Port SDF text rendering system"

EFFECT_PROMPT="You are the EffectSpecialist agent for the yoga_studio shader swarm.

Your task: Port the SDF text rendering system from GLSL to WGSL.

READ THESE FILES from the workspace:
1. GLSL source (lines 72-144, 487-731, 801-849): public/yoga.glsl
2. Current WGSL: public/yoga-regular.wgsl

DELIVERABLE: Create swarm-outputs/improvement-2-effect.wgsl

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

Create the file swarm-outputs/improvement-2-effect.wgsl with the WGSL text system."

echo "    Executing EffectSpecialist..."
run_kimi "$EFFECT_PROMPT" "$OUTPUT_DIR/improvement-2-effect.wgsl"

echo ""
echo "🤖 Agent 3/3: UISpecialist"
echo "    Task: Implement progress dial and counters"

UI_PROMPT="You are the UISpecialist agent for the yoga_studio shader swarm.

Your task: Implement the breath timing HUD elements.

READ THESE FILES from the workspace:
1. GLSL source (lines 851-866, 940-989): public/yoga.glsl
2. Current WGSL: public/yoga-regular.wgsl

DELIVERABLE: Create swarm-outputs/improvement-2-ui.wgsl

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

Create the file swarm-outputs/improvement-2-ui.wgsl with the WGSL UI functions."

echo "    Executing UISpecialist..."
run_kimi "$UI_PROMPT" "$OUTPUT_DIR/improvement-2-ui.wgsl"

echo ""
echo "📋 Phase 3: Integration"
echo "-----------------------"

INTEGRATION_PROMPT="You are the IntegrationEngineer for the yoga_studio shader swarm.

Your task: Merge all worker outputs into a single cohesive WGSL shader.

READ THESE FILES from the workspace:
1. Base shader: public/yoga-regular.wgsl
2. Geometry output: swarm-outputs/improvement-2-geometry.wgsl
3. Effect output: swarm-outputs/improvement-2-effect.wgsl
4. UI output: swarm-outputs/improvement-2-ui.wgsl

DELIVERABLE: Create public/shaders/breath-swarm-next.wgsl

MERGE ORDER:
1. Start with base shader structure
2. Add geometry functions (kalei, starPattern)
3. Add text system (glyph data, alphabet SDFs)
4. Add UI functions (progress dial)
5. Update mainImage() to integrate everything

VALIDATION CHECKLIST:
- All function names are unique (no collisions)
- Uniform bindings match: u_breath at binding 0, iResolution at binding 1
- No WGSL syntax errors
- Compiles with proper entry points: vs_main, fs_main
- Uses correct WGSL types: f32, vec3<f32>, etc.

Create the final merged shader at public/shaders/breath-swarm-next.wgsl"

echo "🤖 Running IntegrationEngineer..."
mkdir -p "$SCRIPT_DIR/public/shaders"
run_kimi "$INTEGRATION_PROMPT" "$SCRIPT_DIR/public/shaders/breath-swarm-next.wgsl"

echo ""
echo "✅ Swarm execution complete!"
echo ""
echo "Output files:"
echo "  📄 Plan output: $OUTPUT_DIR/planner_output.txt"
echo "  📄 Plan JSON: $OUTPUT_DIR/improvement_plan.json"
echo "  📄 Geometry: $OUTPUT_DIR/improvement-2-geometry.wgsl"
echo "  📄 Effects: $OUTPUT_DIR/improvement-2-effect.wgsl"
echo "  📄 UI: $OUTPUT_DIR/improvement-2-ui.wgsl"
echo "  📄 Final: $SCRIPT_DIR/public/shaders/breath-swarm-next.wgsl"
echo ""
echo "Next steps:"
echo "  1. Validate the shader with: ./dev.sh start yoga_studio"
echo "  2. Update WebGPUShader.tsx to load breath-swarm-next.wgsl"
echo "  3. Test in browser with WebGPU enabled"
