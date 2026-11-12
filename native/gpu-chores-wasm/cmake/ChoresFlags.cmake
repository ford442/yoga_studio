# Flags shared by the host gate and the wasm module, so a warning the wasm build
# would reject also fails the fast host gate (and vice versa).

option(CHORES_WERROR "Treat warnings as errors" ON)

set(CHORES_WARNING_FLAGS
  -Wall -Wextra -Wpedantic
  -Wconversion -Wshadow -Wdouble-promotion
)
if(CHORES_WERROR)
  list(APPEND CHORES_WARNING_FLAGS -Werror)
endif()

# The kernels are freestanding C++: nothing may need exceptions or RTTI.
set(CHORES_LANG_FLAGS -fno-exceptions -fno-rtti -fvisibility=hidden)

# The kernels get the strict set. The test harness (STL-heavy, reference
# transliterations of JS) only gets the baseline: -Wconversion there is noise.
set(CHORES_TEST_WARNING_FLAGS -Wall -Wextra -Wshadow)
if(CHORES_WERROR)
  list(APPEND CHORES_TEST_WARNING_FLAGS -Werror)
endif()

function(chores_apply_flags target)
  target_compile_options(${target} PRIVATE ${CHORES_WARNING_FLAGS} ${ARGN})
endfunction()

function(chores_apply_test_flags target)
  target_compile_options(${target} PRIVATE ${CHORES_TEST_WARNING_FLAGS} ${ARGN})
endfunction()
