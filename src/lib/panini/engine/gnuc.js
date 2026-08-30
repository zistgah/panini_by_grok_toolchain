// @ts-nocheck
/**
 * GNU C pre-pass. Does not claim vmlinux.
 * Copyright (C) 1993-2026 Abhishek Choudhary | GPL-3.0-or-later
 *
 * Parsed and lowered:
 *   __attribute__((...))           stripped
 *   x ?: y                         x ? x : y  (double-eval named)
 *   __builtin_expect(e, c)         e
 *   __builtin_constant_p(n)        1 if numeric literal else 0
 *   [0 ... 9] = v                  expanded assignments (range init)
 *   case 1 ... 5:                  expanded cases
 *
 * Recognised, not executed:
 *   ({ ... }) statement expressions (left as a compound; run_c may reject)
 *   typeof / __auto_type
 *   asm volatile (handoff to asm-bridge when the emulator is present)
 */
export function gnuc(src) {
  let s = String(src);
  s = s.replace(/__attribute__\s*\(\([^)]*\)\)/g, "");
  s = s.replace(/__extension__/g, "");
  s = s.replace(/\b__builtin_expect\s*\(([^,]+),[^)]+\)/g, "($1)");
  s = s.replace(/\b__builtin_constant_p\s*\(\s*(\d+)\s*\)/g, "1");
  s = s.replace(/\b__builtin_constant_p\s*\([^)]*\)/g, "0");
  s = s.replace(/(\b[A-Za-z_]\w*|\([^;]+\)|\d+)\s*\?\s*:\s*/g, "$1 ? $1 : ");
  s = s.replace(/\[(\d+)\s*\.\.\.\s*(\d+)\]\s*=\s*([^,;}]+)/g, (m, a, b, v) => {
    const lo = Number(a), hi = Number(b);
    const parts = [];
    for (let i = lo; i <= hi && i - lo < 64; i++) parts.push("[" + i + "] = " + v);
    return parts.join(", ");
  });
  s = s.replace(/case\s+(\d+)\s*\.\.\.\s*(\d+)\s*:/g, (m, a, b) => {
    const lo = Number(a), hi = Number(b);
    const parts = [];
    for (let i = lo; i <= hi && i - lo < 32; i++) parts.push("case " + i + ":");
    return parts.join(" ");
  });
  return s;
}

export function gnuRecognised(src) {
  const s = String(src);
  return {
    attributes: /__attribute__/.test(s),
    stmt_expr: /\(\s*\{/.test(s),
    typeof: /\btypeof\s*\(/.test(s) || /\b__auto_type\b/.test(s),
    asm: /\basm\s+volatile/.test(s) || /\b__asm__/.test(s),
    omitted_middle: /\?\s*:/.test(s),
  };
}
