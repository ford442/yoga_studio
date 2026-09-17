/*
 * A ~100-line Catch2-shaped harness (TEST_CASE / REQUIRE / CHECK).
 *
 * The kit's rule is "no new runtime dependencies"; this keeps the same spirit
 * at build time. Pulling GoogleTest or Catch2 in for three numeric kernels would
 * mean either vendoring a few megabytes or making the fast test gate depend on
 * a network fetch, and the assertions below are the whole of what these tests
 * need. If the tests ever grow fixtures, matchers or parameterisation, swap this
 * for Catch2 — the TEST_CASE/REQUIRE surface is deliberately source-compatible.
 */
#ifndef CHORES_MICROTEST_H
#define CHORES_MICROTEST_H

#include <cstdio>
#include <cstdlib>
#include <string>
#include <vector>

namespace microtest {

struct Case {
  const char* name;
  void (*fn)();
};

inline std::vector<Case>& Registry() {
  static std::vector<Case> cases;
  return cases;
}

inline int& Failures() {
  static int failures = 0;
  return failures;
}

struct Registrar {
  Registrar(const char* name, void (*fn)()) { Registry().push_back(Case{name, fn}); }
};

inline void Fail(const char* file, int line, const char* expr, const std::string& detail) {
  Failures() += 1;
  std::fprintf(stderr, "  FAILED %s:%d\n    %s\n", file, line, expr);
  if (!detail.empty()) std::fprintf(stderr, "    %s\n", detail.c_str());
}

inline int RunAll() {
  int failed_cases = 0;
  for (const Case& c : Registry()) {
    const int before = Failures();
    std::printf("[ RUN  ] %s\n", c.name);
    c.fn();
    if (Failures() > before) {
      failed_cases += 1;
      std::printf("[ FAIL ] %s\n", c.name);
    } else {
      std::printf("[  OK  ] %s\n", c.name);
    }
  }
  std::printf("\n%zu cases, %d failing, %d assertions failed\n", Registry().size(), failed_cases,
              Failures());
  return failed_cases == 0 ? 0 : 1;
}

}  // namespace microtest

#define MICROTEST_CAT_(a, b) a##b
#define MICROTEST_CAT(a, b) MICROTEST_CAT_(a, b)

#define TEST_CASE(name)                                                                 \
  static void MICROTEST_CAT(microtest_case_, __LINE__)();                               \
  static ::microtest::Registrar MICROTEST_CAT(microtest_reg_, __LINE__)(                \
      name, &MICROTEST_CAT(microtest_case_, __LINE__));                                 \
  static void MICROTEST_CAT(microtest_case_, __LINE__)()

#define CHECK(expr)                                              \
  do {                                                           \
    if (!(expr)) ::microtest::Fail(__FILE__, __LINE__, #expr, {}); \
  } while (0)

#define REQUIRE(expr)                                              \
  do {                                                             \
    if (!(expr)) {                                                 \
      ::microtest::Fail(__FILE__, __LINE__, #expr, {});            \
      return;                                                      \
    }                                                              \
  } while (0)

#define CHECK_EQ(a, b)                                                                    \
  do {                                                                                    \
    const auto microtest_a_ = (a);                                                        \
    const auto microtest_b_ = (b);                                                        \
    if (!(microtest_a_ == microtest_b_)) {                                                \
      ::microtest::Fail(__FILE__, __LINE__, #a " == " #b,                                 \
                        "got " + std::to_string(microtest_a_) + ", want " +               \
                            std::to_string(microtest_b_));                                \
    }                                                                                     \
  } while (0)

#endif  // CHORES_MICROTEST_H
