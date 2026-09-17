# gpu-chores native kernels.
#
# Two targets, two jobs:
#   chores_test — host binary, the fast correctness gate. Needs nothing but a
#                 C++20 compiler, so CI runs it on every push.
#   chores_wasm — the wasm32 module the browser loads. Built by
#                 scripts/build-wasm.sh (clang's own wasm target, freestanding),
#                 because the kernels need no libc and no Emscripten runtime.
#                 See README.md for why the toolchain is clang rather than emsdk.
#
# compile_commands.json for clangd:
#   cmake -S native/gpu-chores-wasm -B native/gpu-chores-wasm/build \
#         -DCMAKE_EXPORT_COMPILE_COMMANDS=ON
#   ln -sf native/gpu-chores-wasm/build/compile_commands.json compile_commands.json
# It is generated into the build dir and gitignored — never commit a copy, it
# goes stale the moment a flag changes.
cmake_minimum_required(VERSION 3.22)
project(gpu_chores_wasm CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

if(NOT CMAKE_BUILD_TYPE AND NOT CMAKE_CONFIGURATION_TYPES)
  set(CMAKE_BUILD_TYPE Release CACHE STRING "" FORCE)
endif()

set(CHORES_SOURCES
  src/histogram.cpp
  src/downsample.cpp
  src/lut.cpp
  src/runtime.cpp
)

# The kernels themselves, as a host library: no exceptions, no RTTI, nothing
# the wasm build would not also accept.
add_library(chores_kernels STATIC ${CHORES_SOURCES})
target_include_directories(chores_kernels PUBLIC src)
target_compile_options(chores_kernels PRIVATE -O3 -Wall -Wextra -Wpedantic -fno-exceptions -fno-rtti)

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
target_compile_options(chores_test PRIVATE -O2 -Wall -Wextra)

enable_testing()
add_test(NAME chores_kernels COMMAND chores_test)
