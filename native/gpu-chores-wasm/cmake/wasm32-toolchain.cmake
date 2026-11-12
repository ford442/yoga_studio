# Freestanding wasm32 via plain clang (no Emscripten) — see README "Why clang".
# Selected by the `wasm` preset in CMakePresets.json.
set(CMAKE_SYSTEM_NAME Generic)
set(CMAKE_SYSTEM_PROCESSOR wasm32)

if(DEFINED ENV{CLANG})
  set(CMAKE_CXX_COMPILER "$ENV{CLANG}")
else()
  set(CMAKE_CXX_COMPILER clang++)
endif()
set(CMAKE_CXX_COMPILER_TARGET wasm32)

# The compiler probe cannot link a wasm executable before our link flags exist.
set(CMAKE_TRY_COMPILE_TARGET_TYPE STATIC_LIBRARY)
