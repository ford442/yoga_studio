# gpu-chores native kernels.
#
# Presets (see CMakePresets.json) — every flag lives in cmake/ChoresFlags.cmake
# so the host gate and the shipped wasm cannot drift apart:
#   host       Release host gate, the fast correctness check CI runs every push
#   host-asan  same tests under AddressSanitizer + UndefinedBehaviorSanitizer
#   host-tidy  same build with clang-tidy (.clang-tidy) as a compile step
#   wasm       the wasm32 module the browser loads (scripts/build-wasm.sh)
#
# compile_commands.json for clangd is generated into build/host/ (gitignored):
#   cmake --preset host
#   ln -sf native/gpu-chores-wasm/build/host/compile_commands.json compile_commands.json
# Never commit a copy — it goes stale the moment a flag changes.
cmake_minimum_required(VERSION 3.25)
project(gpu_chores_wasm CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

option(CHORES_TARGET_WASM "Build the freestanding wasm32 module instead of the host gate" OFF)
option(CHORES_SANITIZE "Build the host gate with ASan + UBSan" OFF)
option(CHORES_CLANG_TIDY "Run clang-tidy on the kernels while compiling" OFF)

if(NOT CMAKE_BUILD_TYPE AND NOT CMAKE_CONFIGURATION_TYPES)
  set(CMAKE_BUILD_TYPE Release CACHE STRING "" FORCE)
endif()

include(cmake/ChoresFlags.cmake)

set(CHORES_SOURCES
  src/histogram.cpp
  src/downsample.cpp
  src/lut.cpp
  src/runtime.cpp
)

if(CHORES_TARGET_WASM)
  # Mirrors what scripts/build-wasm.sh always passed to clang by hand. -O3 is set
  # explicitly (no -DNDEBUG from CMAKE_CXX_FLAGS_RELEASE) so the bytes stay the
  # same as the committed module.
  set(CMAKE_CXX_FLAGS_RELEASE "-O3")
  # --export-dynamic is not used on purpose: every symbol the loader may call is
  # listed here, so an accidental export cannot become part of the ABI.
  set(CHORES_WASM_EXPORTS
    chores_abi_version chores_has_simd
    chores_arena_alloc chores_arena_reset chores_arena_used
    chores_luma_histogram_bt709 chores_downsample_2d chores_lut_u8_map
  )
  add_executable(chores ${CHORES_SOURCES})
  set_target_properties(chores PROPERTIES SUFFIX ".wasm")
  target_include_directories(chores PRIVATE src)
  chores_apply_flags(chores -flto -msimd128 -nostdlib -ffreestanding ${CHORES_LANG_FLAGS})
  target_link_options(chores PRIVATE
    -flto -nostdlib -Wl,--no-entry -Wl,--strip-all -Wl,--export-memory
    -Wl,--initial-memory=1048576 -Wl,--max-memory=268435456)
  foreach(symbol IN LISTS CHORES_WASM_EXPORTS)
    target_link_options(chores PRIVATE "-Wl,--export=${symbol}")
  endforeach()
  return()
endif()

# The kernels themselves, as a host library: no exceptions, no RTTI, nothing
# the wasm build would not also accept.
add_library(chores_kernels STATIC ${CHORES_SOURCES})
target_include_directories(chores_kernels PUBLIC src)
chores_apply_flags(chores_kernels -O3 ${CHORES_LANG_FLAGS})

include(CheckCXXCompilerFlag)
check_cxx_compiler_flag("-msse2" CHORES_HAVE_MSSE2)
if(CHORES_HAVE_MSSE2)
  # Gives the host gate the same vector kernel shape the wasm build uses, so a
  # SIMD-only mistake fails on the fast gate instead of in a browser.
  target_compile_options(chores_kernels PRIVATE -msse2)
endif()

add_executable(chores_test testhost/kernels_test.cpp)
target_link_libraries(chores_test PRIVATE chores_kernels)
target_include_directories(chores_test PRIVATE testhost)
chores_apply_test_flags(chores_test -O2)

if(CHORES_SANITIZE)
  # Trap on the first finding: a sanitizer report that scrolls past is a pass.
  set(_san -fsanitize=address,undefined -fno-sanitize-recover=all -fno-omit-frame-pointer -g)
  target_compile_options(chores_kernels PRIVATE ${_san})
  target_compile_options(chores_test PRIVATE ${_san})
  target_link_options(chores_test PRIVATE ${_san})
endif()

if(CHORES_CLANG_TIDY)
  find_program(CHORES_CLANG_TIDY_EXE NAMES clang-tidy clang-tidy-18 clang-tidy-19 REQUIRED)
  # Kernels only: the test harness is allowed to use the STL freely.
  set_target_properties(chores_kernels PROPERTIES
    CXX_CLANG_TIDY "${CHORES_CLANG_TIDY_EXE};--warnings-as-errors=*")
endif()

enable_testing()
add_test(NAME chores_kernels COMMAND chores_test)
