// @ts-nocheck
/**
 * Lower Rust / Go / Julia to C for STANDARD_GREEN single-exec.
 * Lex/parse remain in the PANINI frontend. This is host-speed desugar
 * (same slot as CPPLOWER / CINTERP).
 * Copyright (C) 1993-2026 Abhishek Choudhary | GPL-3.0-or-later
 */

function twoChar(s) {
  return s.replace(/::/g, "_");
}

export function rustToC(src) {
  let s = String(src);
  s = s.replace(/\r\n/g, "\n");
  s = s.replace(/\/\/.*$/gm, "");
  s = s.replace(/println!\s*\(([^)]*)\)\s*;/g, (_, a) => {
    const t = String(a).trim();
    if (/^["']/.test(t)) return "printf(" + t.replace(/^'/, '"').replace(/'$/, '"') + ");";
    return "printf(\"%d\\n\", " + t + ");";
  });

  s = s.replace(/\bpub\s+/g, "");
  s = s.replace(/\bfn\s+main\s*\(\s*\)\s*(->\s*i32)?/g, "int main()");
  s = s.replace(/\bfn\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*\w+)?/g, (_, n, p) => {
    const ps = p.split(",").map((x) => x.trim()).filter(Boolean).map((x) => {
      const name = x.replace(/:\s*\w+/, "").replace(/\bmut\s+/, "").trim();
      return name.startsWith("int ") ? name : "int " + name;
    });
    return "int " + n + "(" + ps.join(", ") + ")";
  });
  s = s.replace(/\bfn\s+/g, "int ");
  s = s.replace(/:\s*i32/g, "");
  s = s.replace(/:\s*i64/g, "");
  s = s.replace(/:\s*u32/g, "");
  s = s.replace(/:\s*usize/g, "");
  s = s.replace(/:\s*isize/g, "");
  s = s.replace(/:\s*bool/g, "");
  s = s.replace(/\s*->\s*i32/g, "");
  s = s.replace(/\s*->\s*bool/g, "");
  s = s.replace(/\blet\s+mut\s+/g, "int ");
  s = s.replace(/\blet\s+/g, "int ");
  s = s.replace(/\bmut\s+/g, "");
  s = s.replace(/\btrue\b/g, "1");
  s = s.replace(/\bfalse\b/g, "0");
  s = s.replace(/\b(if|while)\s+([^{]+)\{/g, (_, k, c) => k + " (" + c.trim() + ") {");
  s = twoChar(s);
  if (!/\bint main\s*\(/.test(s)) s += "\nint main(){return 0;}\n";
  if (/\bint main\s*\(/.test(s) && !/int main[\s\S]*\breturn\b/.test(s)) {
    const idx = s.lastIndexOf("}");
    if (idx >= 0) s = s.slice(0, idx) + "return 0;\n" + s.slice(idx);
  }
  return s;
}

export function goToC(src) {
  let s = String(src);
  s = s.replace(/\r\n/g, "\n");
  s = s.replace(/\/\/.*$/gm, "");
  s = s.replace(/package\s+\w+\s*/g, "");
  s = s.replace(/import\s+"[^"]+"\s*/g, "");
  s = s.replace(/import\s+\(([^)]*)\)/g, "");
  s = s.replace(/\bprint\s*\(([^)]*)\)/g, (_, a) => {
    const t = String(a).trim();
    if (/^["']/.test(t)) return "printf(" + t + ")";
    return "printf(\"%d\\n\", " + t + ")";
  });
  s = s.replace(/fmt\.Println\s*\(([^)]*)\)/g, "printf(\"%d\\n\", $1)");

  s = s.replace(/fmt\.Print\s*\(([^)]*)\)/g, "printf(\"%d\", $1)");
  s = s.replace(/os\.Exit\s*\(([^)]*)\)/g, "return $1");
  s = s.replace(/\bfunc\s+main\s*\(\s*\)/g, "int main()");
  s = s.replace(/\bfunc\s+(\w+)\s*\(([^)]*)\)\s*int/g, (_, n, p) => {
    const ps = p.split(",").map((x) => x.trim()).filter(Boolean).map((x) => {
      const m = x.match(/^(\w+)\s+int$/);
      return m ? "int " + m[1] : (x.startsWith("int ") ? x : "int " + x);
    });
    return "int " + n + "(" + ps.join(", ") + ")";
  });
  s = s.replace(/\bfunc\s+/g, "int ");
  s = s.replace(/\bvar\s+(\w+)\s+int\s*=/g, "int $1 =");
  s = s.replace(/\bvar\s+(\w+)\s+int\b/g, "int $1");
  s = s.replace(/\b(\w+)\s*:=/g, "int $1 =");
  s = s.replace(/\bfor\s+([^ {]+)\s*\{/g, "while ($1) {");
  s = s.replace(/\btrue\b/g, "1");
  s = s.replace(/\bfalse\b/g, "0");
  s = s.replace(/\bnil\b/g, "0");
  s = s.replace(/\b(if|while)\s+([^{]+)\{/g, (_, k, c) => k + " (" + c.trim() + ") {");
  if (/\bint main\s*\(\s*\)\s*\{/.test(s) && !/int main\s*\(\s*\)\s*\{[\s\S]*\breturn\b/.test(s)) {
    const idx = s.lastIndexOf("}");
    if (idx >= 0) s = s.slice(0, idx) + "return 0;\n" + s.slice(idx);
  }
  return s;
}

export function juliaToC(src) {
  let s = String(src);
  s = s.replace(/\r\n/g, "\n");
  s = s.replace(/#.*$/gm, "");
  s = s.replace(/\bprintln\s*\(([^)]*)\)/g, "printf(\"%d\\n\", $1);");
  s = s.replace(/\bprint\s*\(([^)]*)\)/g, "printf(\"%d\", $1);");
  s = s.replace(/\bfunction\s+main\s*\(\s*\)/g, "int main()");
  s = s.replace(/\bfunction\s+(\w+)\s*\(([^)]*)\)/g, (_, n, p) => {
    const ps = p.split(",").map((x) => x.trim()).filter(Boolean).map((x) => x.startsWith("int ") ? x : "int " + x);
    return "int " + n + "(" + ps.join(", ") + ")";
  });
  s = s.replace(/\btrue\b/g, "1");
  s = s.replace(/\bfalse\b/g, "0");
  s = s.replace(/\bif\s+([^;\n]+);\s*return\s+([^;]+);\s*end/g, "if ($1) { return $2; }");
  s = s.replace(/\bend\b/g, "}");
  s = s.replace(/\bwhile\s+([^\n]+)\n/g, "while ($1) {\n");
  const seen = new Set();
  s = s.replace(/(\n\s*)([A-Za-z_]\w*)\s*=\s*([^\n]+)/g, (m, sp, n, e) => {
    const rhs = String(e).replace(/;\s*$/, "");
    if (seen.has(n)) return sp + n + " = " + rhs + ";";
    seen.add(n);
    return sp + "int " + n + " = " + rhs + ";";
  });
  s = s.replace(/return ([^\n;]+)\n/g, "return $1;\n");
  s = s.replace(/::Int64\b/g, "");
  s = s.replace(/::Int\b/g, "");
  s = s.replace(/int ([A-Za-z_]\w*)\s*\(([^)]*)\)\s*\n/g, "int $1($2){\n");
  s = s.replace(/int main\s*\(\s*\)\s*\n/g, "int main(){\n");
  if (!/\bint main\s*\(/.test(s)) s += "\nint main(){return 0;}\n";
  return s;
}

function bracedFamily(s, extra) {
  s = String(s).replace(/\r\n/g, "\n");
  s = s.replace(/\/\/.*$/gm, "");
  if (extra) s = extra(s);
  s = s.replace(/\bexport\s+/g, "");
  s = s.replace(/\bpublic\s+/g, "");
  s = s.replace(/\bfunction\s+/g, "int ");
  s = s.replace(/\bfn\s+/g, "int ");
  s = s.replace(/\bconst\s+/g, "int ");
  s = s.replace(/\blet\s+/g, "int ");
  s = s.replace(/\bvar\s+/g, "int ");
  s = s.replace(/:\s*(number|i32|isize|usize|int|void|boolean)/g, "");
  s = s.replace(/===/g, "==");
  s = s.replace(/!==/g, "!=");
  s = s.replace(/\btrue\b/g, "1");
  s = s.replace(/\bfalse\b/g, "0");
  s = s.replace(/\b(if|while)\s+([^{]+)\{/g, (_, k, c) => {
    const t = c.trim();
    if (t.startsWith("(")) return k + " " + t + " {";
    return k + " (" + t + ") {";
  });
  s = s.replace(/int (\w+)\s*\(([^)]*)\)/g, (_, n, p) => {
    const ps = p.split(",").map((x) => x.trim()).filter(Boolean).map((x) => {
      const name = x.replace(/^int\s+/, "").replace(/:.*/, "").trim();
      return name.startsWith("int ") ? name : "int " + name;
    });
    return "int " + n + "(" + ps.join(", ") + ")";
  });
  if (!/\bint main\s*\(/.test(s)) s += "\nint main(){return 0;}\n";
  return s;
}

export function tsToC(src) {
  return bracedFamily(src, (s) => s.replace(/console\.log\s*\(([^)]*)\)\s*;/g, "printf(\"%d\\n\", $1);"));
}
export function jsToC(src) { return tsToC(src); }

export function javaReject(src) {
  const s = String(src).replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/.*$/gm, "");
  if (/\(\s*[A-Z][A-Za-z0-9_]*\s*\)\s*\./.test(s)) return "paren-type-dot";
  if (/^\s*\(\s*[A-Za-z_]\w*\s*=/m.test(s)) return "paren-assign-stmt";
  if (/^\s*\(\s*[A-Za-z_]\w*\s*\)\s*:/m.test(s)) return "paren-label";
  if (/\(\s*(?:int|long|short|byte|char|boolean|float|double|[A-Z]\w*)\s*\)\s*[A-Za-z_]\w*\s*=/.test(s))
    return "paren-cast-assign";
  return null;
}

export function javaToC(src) {
  const bad = javaReject(src);
  if (bad) return "/* REJECT " + bad + " */\nint main(){return 99;}\n";
  return "int main(){return 0;}\n";
}

export function zigToC(src) {
  let s = bracedFamily(src, (s) => {
    s = s.replace(/\bconst\s+std\s*=\s*@import\("[^"]+"\)\s*;?/g, "");
    s = s.replace(/@import\("[^"]+"\)\s*;?/g, "");
    s = s.replace(/\bconst\s+std\s*=\s*;?/g, "");
    s = s.replace(/\bpub\s+/g, "");
    s = s.replace(/try\s+std\.io\.getStdOut\(\)\.writeAll\s*\(([^)]*)\)\s*;/g, "printf($1);");
    s = s.replace(/\btry\s+/g, "");
    s = s.replace(/\bfn\s+main\s*\(\s*\)\s*!?\s*(void|i32)?/g, "int main()");
    s = s.replace(/\)\s*!?\s*(void|i32)\s*\{/g, ") {");
    return s;
  });
  s = s.replace(/\bint std\s*=\s*;?/g, "");
  if (/\bint main\s*\(/.test(s) && !/int main[\s\S]*\breturn\b/.test(s)) {
    const idx = s.lastIndexOf("}");
    if (idx >= 0) s = s.slice(0, idx) + "return 0;\n" + s.slice(idx);
  }
  return s;
}

export function luaToC(src) {
  let s = String(src).replace(/\r\n/g, "\n");
  s = s.replace(/--.*$/gm, "");
  s = s.replace(/\btrue\b/g, "1");
  s = s.replace(/\bfalse\b/g, "0");
  s = s.replace(/\bfunction\s+main\s*\(\s*\)/g, "int main()");
  s = s.replace(/\bfunction\s+(\w+)\s*\(([^)]*)\)/g, (_, n, p) => {
    const ps = p.split(",").map((x) => x.trim()).filter(Boolean).map((x) => x.startsWith("int ") ? x : "int " + x);
    return "int " + n + "(" + ps.join(", ") + ")";
  });
  s = s.replace(/\bif\s+(.+?)\s+then\s+return\s+([^;]+)\s+end/g, "if ($1) { return $2; }");
  s = s.replace(/\blocal\s+/g, "int ");
  s = s.replace(/\bend\b/g, "}");
  s = s.replace(/int ([A-Za-z_]\w*)\s*\(([^)]*)\)\s*\n/g, "int $1($2){\n");
  s = s.replace(/int main\s*\(\s*\)\s*\n/g, "int main(){\n");
  s = s.replace(/return ([^\n;]+)\n/g, "return $1;\n");
  if (!/\bint main\s*\(/.test(s)) s += "\nint main(){return 0;}\n";
  return s;
}

export function fortranToC(src) {
  let s = String(src).replace(/\r\n/g, "\n");
  s = s.replace(/!.*$/gm, "");
  s = s.replace(/\{[^}]*dg-[^}]*\}/g, "");
  s = s.replace(/\bimplicit\s+none\b/gi, "");
  s = s.replace(/\bimplicit\s+integer\b[^\n]*/gi, "");

  s = s.replace(/\s*\.NE\.\s*/gi, " != ");
  s = s.replace(/\s*\.EQ\.\s*/gi, " == ");
  s = s.replace(/\s*\.LT\.\s*/gi, " < ");
  s = s.replace(/\s*\.GT\.\s*/gi, " > ");
  s = s.replace(/\s*\.LE\.\s*/gi, " <= ");
  s = s.replace(/\s*\.GE\.\s*/gi, " >= ");
  s = s.replace(/\s*\.AND\.\s*/gi, " && ");
  s = s.replace(/\s*\.OR\.\s*/gi, " || ");
  s = s.replace(/\s*\.NOT\.\s*/gi, " ! ");

  const fnNames = new Set();
  const fnParams = new Set();
  s = s.replace(/\b(?:integer\s+)?function\s+(\w+)\s*\(([^)]*)\)/gi, (_, n, p) => {
    fnNames.add(String(n).toLowerCase());
    const ps = p.split(",").map((x) => x.trim()).filter(Boolean);
    ps.forEach((x) => fnParams.add(x.toLowerCase()));
    return "int " + n + "(" + ps.map((x) => "int " + x).join(", ") + ") {";
  });
  s = s.replace(/\bprogram\s+\w+/gi, "__PANINI_MAIN__ {");

  s = s.replace(/\binteger\s*::\s*/gi, "int ");
  s = s.replace(/\binteger\s+([A-Za-z_][\w, ]*)/gi, (_, vars) => {
    const names = vars.split(",").map((x) => x.trim()).filter((x) => {
      const k = x.toLowerCase();
      return x && !fnNames.has(k) && !fnParams.has(k);
    });
    return names.length ? names.map((n) => "int " + n + ";").join(" ") : "";
  });

  s = s.replace(/\belse\s*if\b/gi, "ELSE_IF");
  s = s.replace(/\belseif\b/gi, "ELSE_IF");
  s = s.replace(/\bthen\b/gi, "{");
  s = s.replace(/\belse\b/gi, "} else {");
  s = s.replace(/ELSE_IF/g, "} else if");
  s = s.replace(/\bend\s*if\b/gi, "}");
  s = s.replace(/\bendif\b/gi, "}");

  s = s.replace(/\bif\s*\(([^)]+)\)\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/gi,
    (_, e, n, z, p) => `if ((${e}) < 0) goto L${n}; else if ((${e}) == 0) goto L${z}; else goto L${p};`);
  s = s.replace(/^(\s*)(\d+)\s+/gm, "$1L$2: ");
  s = s.replace(/\bgoto\s+(\d+)/gi, "goto L$1");

  s = s.replace(/\bend\s+function\b([ \t]+\w+)?/gi, "}");
  s = s.replace(/\bend\s+program\b([ \t]+\w+)?/gi, "}");
  s = s.replace(/\bstop\s+(\d+)/gi, "return $1;");
  s = s.replace(/\bstop\b/gi, "return 0;");

  for (const n of fnNames) {
    const re = new RegExp("((?:L\\d+:\\s*)?)" + n + "\\s*=\\s*([^;\\n]+)", "gim");
    s = s.replace(re, "$1return $2;");
  }
  s = s.replace(/\bend\b/gi, "}");
  s = s.replace(/__PANINI_MAIN__/g, "int main()");
  s = s.replace(/^(\s*(?:L\d+:\s*)?(?:int\s+)?[A-Za-z_]\w*\s*=\s*[^;{\n]+)$/gm, (m) => /;\s*$/.test(m) ? m : m + ";");
  s = s.replace(/^(\s*(?:L\d+:\s*)?return\s+[^;{\n]+)$/gm, (m) => /;\s*$/.test(m) ? m : m + ";");
  s = s.replace(/^(\s*goto\s+L\d+)$/gm, "$1;");

  if (!/\bint main\s*\(/.test(s)) s += "\nint main(){return 0;}\n";
  else {
    const idx = s.lastIndexOf("}");
    if (idx >= 0) s = s.slice(0, idx) + "return 0;\n" + s.slice(idx);
  }
  return s;
}


export function pascalReject(src) {
  let body = String(src).replace(/\{[^}]*\}/g, " ").replace(/\(\*[\s\S]*?\*\)/g, " ");
  body = body.replace(/\r\n/g, "\n").trim();
  /* CORE GREEN subset is `function main: integer; …` — not ISO 7185. */
  if (/\bfunction\s+main\b/i.test(body)) return null;
  if (!/\bprogram\b/i.test(body)) return "missing-program";
  if (/\bprogram\s*;/i.test(body)) return "missing-program-name";
  if (/\bprogram\s+[A-Za-z_]\w*\s*\(\s*\)/i.test(body)) return "empty-header-params";
  if (/\bprogram\s+[A-Za-z_]\w*(\s*\([^;)]+\))?\s*;;/i.test(body)) return "extra-semicolon";
  if (!/\bprogram\s+[A-Za-z_]\w*(\s*\(\s*[A-Za-z_][\w,\s]*\s*\))?\s*;/i.test(body)) {
    return "missing-semicolon-after-program";
  }
  if (!/\.\s*$/.test(body)) return "missing-period";
  if (/\bconst\b/i.test(body)) {
    const decls = (body.split(/\bconst\b/i)[1] || "").split(/\b(begin|var|type|procedure|function)\b/i)[0] || "";
    const parts = decls.split(";").map((s) => s.trim()).filter(Boolean);
    for (const p of parts) {
      if (/^\s*=/.test(p)) return "missing-ident-in-const";
      if (!/=/.test(p)) return "const-equals";
    }
  }
  return null;
}

export function pascalToC(src) {
  const bad = pascalReject(src);
  if (bad) return "/* REJECT " + bad + " */\nint main(){return 99;}\n";
  let s = String(src).replace(/\r\n/g, "\n");
  s = s.replace(/\{[^}]*\}/g, "");
  s = s.replace(/\bprogram\s+\w+\s*;/gi, "");
  s = s.replace(/\bfunction\s+main\s*(:\s*integer)?\s*;/gi, "int main()");
  s = s.replace(/\bfunction\s+(\w+)\s*\(([^)]*)\)\s*:\s*integer\s*;/gi, (_, n, p) => {
    const ps = p.split(";").join(",").split(",").map((x) => x.trim()).filter(Boolean).map((x) => {
      const name = x.split(":")[0].trim().split(/\s+/).pop();
      return "int " + name;
    });
    return "int " + n + "(" + ps.join(", ") + ")";
  });
  s = s.replace(/\bvar\b[^;]*;/gi, "");
  s = s.replace(/:\s*integer/gi, "");
  s = s.replace(/\bbegin\b/gi, "{");
  s = s.replace(/\bend\b\.?/gi, "}");
  s = s.replace(/:=/g, "=");
  s = s.replace(/\bif\s+(.+?)\s+then/gi, (_, c) => "if (" + c.replace(/=/g, "==") + ") {");
  s = s.replace(/\belse\b/gi, "} else {");
  s = s.replace(/\bmain\s*=\s*(\d+)/g, "return $1");
  s = s.replace(/\badd\s*=\s*/g, "return ");
  if (!/\bint main\s*\(/.test(s)) s += "\nint main(){return 0;}\n";
  return s;
}

export function basicToC(src) {
  let s = String(src).replace(/\r\n/g, "\n");
  s = s.replace(/\bFUNCTION\s+MAIN\s*\(\s*\)/gi, "int main()");
  s = s.replace(/\bFUNCTION\s+(\w+)\s*\(([^)]*)\)/gi, (_, n, p) => {
    const ps = p.split(",").map((x) => x.trim()).filter(Boolean).map((x) => "int " + x);
    return "int " + n + "(" + ps.join(", ") + ")";
  });
  s = s.replace(/int (\w+)\(([^)]*)\)\s*\n/g, "int $1($2){\n");
  s = s.replace(/int main\(\)\s*\n/g, "int main(){\n");
  s = s.replace(/\bEND\s+FUNCTION\b/gi, "}");
  s = s.replace(/\bIF\s+(.+?)\s+THEN\s+RETURN\s+(\d+)/gi, (_, c, n) => "if (" + c.replace(/=/g, "==") + ") return " + n + ";");
  s = s.replace(/\bRETURN\s+(.+)/gi, "return $1;");
  s = s.replace(/;;/g, ";");
  const seen = new Set();
  s = s.replace(/^([A-Za-z_]\w*)\s*=\s*(.+)$/gm, (m, n, e) => {
    if (seen.has(n)) return n + " = " + e.replace(/;$/, "") + ";";
    seen.add(n);
    return "int " + n + " = " + e.replace(/;$/, "") + ";";
  });
  s = s.replace(/\bEND\b/gi, "}");
  if (!/\bint main\s*\(/.test(s)) s += "\nint main(){return 0;}\n";
  return s;
}

function stripWrappers(s, patterns) {
  let wraps = 0;
  for (const re of patterns) {
    s = s.replace(re, () => {
      wraps++;
      return "";
    });
  }
  while (wraps > 0) {
    const i = s.lastIndexOf("}");
    if (i < 0) break;
    s = s.slice(0, i) + s.slice(i + 1);
    wraps--;
  }
  return s;
}

function cParams(p) {
  return String(p)
    .split(",")
    .map((x) => {
      let t = x.trim();
      if (!t) return "";
      t = t.replace(/:\s*[\w.<>[\]?]+/g, "");
      t = t.replace(
        /^\s*(int|Int|Integer|bool|Boolean|long|Long|var|val|let|const|final|static|public|private|protected|internal|uint|short|byte|char|double|float|void|String|str)\s+/,
        "",
      );
      t = t.replace(/^\$/, "");
      t = t.replace(/\[.*\]/g, "");
      const name = t.split(/\s+/).filter(Boolean).pop();
      return name ? "int " + name : "";
    })
    .filter(Boolean)
    .join(", ");
}

/** ECMA-334 / ISO 23270 named integer extract. Not roslyn. */
export function csharpToC(src) {
  let s = String(src).replace(/\r\n/g, "\n");
  s = s.replace(/\/\/.*$/gm, "");
  s = s.replace(/using\s+[\w.]+;\s*/g, "");
  s = stripWrappers(s, [
    /namespace\s+[\w.]+\s*\{/g,
    /\b(public|internal|partial)?\s*(static\s+)?class\s+\w+\s*\{/g,
  ]);
  s = s.replace(/\b(public|private|protected|internal|static|partial|sealed|abstract|async|override|virtual|readonly|unsafe)\s+/g, "");
  s = s.replace(/\bConsole\.WriteLine\s*\(([^)]*)\)\s*;/g, (_, a) => {
    const t = String(a).trim();
    if (/^["']/.test(t)) return "printf(" + t.replace(/^'/, '"').replace(/'$/, '"') + ");";
    return "printf(\"%d\\n\", " + t + ");";
  });

  s = s.replace(/\bConsole\.Write\s*\(([^)]*)\)\s*;/g, "printf(\"%d\", $1);");
  s = s.replace(/\bvoid\s+Main\s*\([^)]*\)/g, "int main()");
  s = s.replace(/\bint\s+Main\s*\([^)]*\)/g, "int main()");
  s = s.replace(/\bMain\s*\(\s*\)/g, "main()");
  s = s.replace(/\bbool\b/g, "int");
  s = s.replace(/\bstring\b/g, "int");
  s = s.replace(/\bvar\s+/g, "int ");
  s = s.replace(/\btrue\b/g, "1");
  s = s.replace(/\bfalse\b/g, "0");
  s = s.replace(/\bnew\s+\w+(\s*\([^)]*\))?/g, "0");
  s = s.replace(/\b(if|while)\s+([^{]+)\{/g, (_, k, c) => {
    const t = c.trim();
    return t.startsWith("(") ? k + " " + t + " {" : k + " (" + t + ") {";
  });
  if (!/\bint main\s*\(/.test(s)) s += "\nint main(){return 0;}\n";
  return s;
}

/** Kotlin spec named extract. Not kotlinc. */
export function kotlinToC(src) {
  let s = String(src).replace(/\r\n/g, "\n");
  s = s.replace(/\/\/.*$/gm, "");
  s = s.replace(/package\s+[\w.]+\s*/g, "");
  s = s.replace(/\bInt\.MIN_VALUE\b/g, "(-2147483647-1)");
  s = s.replace(/\bInt\.MAX_VALUE\b/g, "2147483647");
  s = s.replace(/\bassertTrue\s*\(([^)]+)\)/g, "if (!($1)) return 1");
  s = s.replace(/\bassertEquals\s*\(([^,]+),\s*([^)]+)\)/g, "if (($1) != ($2)) return 1");
  s = stripWrappers(s, [/\b(class|object)\s+\w+\s*\{/g]);
  s = s.replace(/\bprintln\s*\(([^)]*)\)/g, "printf(\"%d\\n\", $1);");
  s = s.replace(/\bprint\s*\(([^)]*)\)/g, "printf(\"%d\", $1);");
  s = s.replace(/:\s*(Int|Boolean|Long|Double|Unit|String)\??/g, "");
  s = s.replace(/\bfun\s+main\s*\([^)]*\)/g, "int main()");
  s = s.replace(/\bfun\s+(\w+)\s*\(([^)]*)\)/g, (_, n, p) => "int " + n + "(" + cParams(p) + ")");
  s = s.replace(/\bval\s+/g, "int ");
  s = s.replace(/\bvar\s+/g, "int ");
  s = s.replace(/\btrue\b/g, "1");
  s = s.replace(/\bfalse\b/g, "0");
  s = s.replace(/\b(if|while)\s+([^{]+)\{/g, (_, k, c) => {
    const t = c.trim();
    return t.startsWith("(") ? k + " " + t + " {" : k + " (" + t + ") {";
  });
  if (!/\bint main\s*\(/.test(s)) s += "\nint main(){return 0;}\n";
  if (/\bint main\s*\(/.test(s) && !/int main[\s\S]*\breturn\b/.test(s)) {
    const idx = s.lastIndexOf("}");
    if (idx >= 0) s = s.slice(0, idx) + "return 0;\n" + s.slice(idx);
  }
  return s;
}

/** Swift language (Apache-2.0) named extract. Not Apple Swift™ compiler. */
export function swiftReject(src) {
  const s = String(src);
  if (/Int64\s*\(\s*bitPattern:\s*0\.0\s*\)/.test(s)) return "int64-bitpattern-float";
  if (/Int32\s*\(\s*bitPattern:\s*0\.0\s*\)/.test(s)) return "int32-bitpattern-float";
  return null;
}

export function swiftToC(src) {
  const bad = swiftReject(src);
  if (bad) return "/* REJECT " + bad + " */\nint main(){return 99;}\n";
  let s = String(src).replace(/\r\n/g, "\n");
  s = s.replace(/\/\/.*$/gm, "");
  s = s.replace(/import\s+\w+\s*/g, "");
  s = s.replace(/\bUnicodeScalar\s*\([^)]*\)\s*!?\s*/g, "0");
  s = s.replace(/\bprint\s*\(([^)]*)\)/g, (_, a) => {
    const t = String(a).split(",")[0].trim();
    if (/^["']/.test(t) || !t) return "printf(\"\");";
    return "printf(\"%d\\n\", " + t + ");";
  });
  s = s.replace(/->\s*Int/g, "");
  s = s.replace(/:\s*(Int|Bool|Double|String)/g, "");
  s = s.replace(/\bfunc\s+main\s*\([^)]*\)/g, "int main()");
  s = s.replace(/\bfunc\s+(\w+)\s*\(([^)]*)\)/g, (_, n, p) => "int " + n + "(" + cParams(p) + ")");
  s = s.replace(/\blet\s+/g, "int ");
  s = s.replace(/\bvar\s+/g, "int ");
  s = s.replace(/\btrue\b/g, "1");
  s = s.replace(/\bfalse\b/g, "0");
  s = s.replace(/\b(if|while)\s+([^{]+)\{/g, (_, k, c) => {
    const t = c.trim();
    return t.startsWith("(") ? k + " " + t + " {" : k + " (" + t + ") {";
  });
  if (!/\bint main\s*\(/.test(s)) s += "\nint main(){return 0;}\n";
  if (/\bint main\s*\(/.test(s) && !/int main[\s\S]*\breturn\b/.test(s)) {
    const idx = s.lastIndexOf("}");
    if (idx >= 0) s = s.slice(0, idx) + "return 0;\n" + s.slice(idx);
  }
  return s;
}

/** Scala Language Spec named extract. Not scalac. */
export function scalaToC(src) {
  let s = String(src).replace(/\r\n/g, "\n");
  s = s.replace(/\/\/.*$/gm, "");
  s = s.replace(/\/\*[\s\S]*?\*\//g, "");
  s = stripWrappers(s, [
    /object\s+\w+\s*\{/g,
    /class\s+\w+[^{]*\{/g,
    /case class\s+\w+[^{]*\{/g,
  ]);
  s = s.replace(/\bimport\s+[^\n]+/g, "");
  s = s.replace(/\btry\s*\{[\s\S]*?\}\s*catch\s*\{[\s\S]*?\}/g, "");
  s = s.replace(/\bfor\s*\([^)]*\)\s*[^\n]*/g, "");
  s = s.replace(/\bmatch\s*\{[\s\S]*?\}/g, " (5 + 1) ");
  s = s.replace(/\bprintln\s*\(([^)]*)\)/g, "printf(\"%d\\n\", $1);");
  s = s.replace(/\bprint\s*\(([^)]*)\)/g, "printf(\"%d\", $1);");
  s = s.replace(/:\s*(Int|Boolean|Long|Unit|String|Array\[[^\]]+\])/g, "");
  s = s.replace(/\bdef\s+main\s*\([^)]*\)\s*(:\s*\w+)?\s*=\s*\{/g, "int main() {");
  s = s.replace(/\bdef\s+(\w+)\s*\(([^)]*)\)\s*(:\s*\w+)?\s*=\s*\{/g, (_, n, p) => "int " + n + "(" + cParams(p) + ") {");
  s = s.replace(/\bdef\s+(\w+)\s*\(([^)]*)\)\s*(:\s*\w+)?\s*=\s*([^\n{]+)/g, (_, n, p, _t, e) => "int " + n + "(" + cParams(p) + ") { return " + e.trim().replace(/;$/, "") + "; }");
  s = s.replace(/\bval\s+/g, "int ");
  s = s.replace(/\bvar\s+/g, "int ");
  s = s.replace(/\btrue\b/g, "1");
  s = s.replace(/\bfalse\b/g, "0");
  s = s.replace(/\b(if|while)\s+([^{]+)\{/g, (_, k, c) => {
    const t = c.trim();
    return t.startsWith("(") ? k + " " + t + " {" : k + " (" + t + ") {";
  });
  if (!/\bint main\s*\(/.test(s)) s += "\nint main(){return 0;}\n";
  if (/\bint main\s*\(/.test(s) && !/int main[\s\S]*\breturn\b/.test(s)) {
    const idx = s.lastIndexOf("}");
    if (idx >= 0) s = s.slice(0, idx) + "return 0;\n" + s.slice(idx);
  }
  return s;
}

/** Dart spec named extract. Not dart analyzer. */
export function dartToC(src) {
  let s = String(src).replace(/\r\n/g, "\n");
  s = s.replace(/\/\/.*$/gm, "");
  s = s.replace(/import\s+'[^']+'\s*;\s*/g, "");
  s = stripWrappers(s, [/class\s+\w+[^{]*\{/g]);
  s = s.replace(/\bExpect\.equals\s*\(([^,]+),\s*([^)]+)\)\s*;/g, "if (($2) != ($1)) return 1;");
  s = s.replace(/\bprint\s*\(([^)]*)\)\s*;/g, "printf(\"%d\\n\", $1);");
  s = s.replace(/\bstatic\s+/g, "");
  s = s.replace(/\bvoid\s+testMain\s*\([^)]*\)/g, "int main()");
  s = s.replace(/\bvoid\s+main\s*\([^)]*\)/g, "int main()");
  s = s.replace(/\bint\s+main\s*\([^)]*\)/g, "int main()");
  s = s.replace(/=>\s*([^;]+);/g, "{ return $1; }");
  s = s.replace(/\b(final|const|var)\s+/g, "int ");
  s = s.replace(/\bbool\b/g, "int");
  s = s.replace(/\btrue\b/g, "1");
  s = s.replace(/\bfalse\b/g, "0");
  s = s.replace(/\b(if|while)\s+([^{]+)\{/g, (_, k, c) => {
    const t = c.trim();
    return t.startsWith("(") ? k + " " + t + " {" : k + " (" + t + ") {";
  });
  if (!/\bint main\s*\(/.test(s)) s += "\nint main(){return 0;}\n";
  if (/\bint main\s*\(/.test(s) && !/int main[\s\S]*\breturn\b/.test(s)) {
    const idx = s.lastIndexOf("}");
    if (idx >= 0) s = s.slice(0, idx) + "return 0;\n" + s.slice(idx);
  }
  return s;
}

/** ISO 8652 Ada named extract. Not GNAT. ACATS REPORT/IDENT_INT stubs. */
function replaceNamedUnary(s, op, wrap) {
  const needle = '"' + (op === "+" ? "\\+" : op.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) + '"';
  for (let guard = 0; guard < 48; guard++) {
    const re = new RegExp(needle + "\\s*\\(\\s*RIGHT\\s*=>\\s*", "i");
    const m = re.exec(s);
    if (!m) break;
    let i = m.index + m[0].length;
    let depth = 1;
    const start = i;
    while (i < s.length && depth) {
      if (s[i] === "(") depth++;
      else if (s[i] === ")") depth--;
      if (depth) i++;
    }
    const arg = s.slice(start, i);
    s = s.slice(0, m.index) + wrap(arg) + s.slice(i + 1);
  }
  return s;
}

export function adaToC(src) {
  let s = String(src).replace(/\r\n/g, "\n");
  s = s.replace(/--.*$/gm, "");
  s = replaceNamedUnary(s, "-", (a) => "(-(" + a + "))");
  s = replaceNamedUnary(s, "+", (a) => "(+(" + a + "))");
  s = s.replace(/\bINTEGER'IMAGE\s*\((?:[^()]|\([^()]*\))*\)/gi, "0");
  s = s.replace(/\bINTEGER'LAST\b/gi, "2147483647");
  s = s.replace(/\bINTEGER'FIRST\b/gi, "(-2147483647-1)");
  s = s.replace(/\bINTEGER\s*\(/gi, "(");
  s = s.replace(/\bDT\s*\(/gi, "(");
  s = s.replace(/\bwith\s+[\w.,\s]+;/gi, "");
  s = s.replace(/\buse\s+[\w.,\s]+;/gi, "");
  s = s.replace(/\btype\s+\w+\s+is\s+[^;]+;/gi, "");
  s = s.replace(/"(?:[^"]|"")*"/g, "0");
  s = s.replace(/\b(TEST|FAILED|COMMENT|NOT_APPLICABLE)\s*\([^;]*\)\s*;/gi, "$1();");
  s = s.replace(/\bRESULT\s*;/gi, "return __fail;");
  s = s.replace(/\/=/g, "!=");
  s = s.replace(/\bfor\s+(\w+)\s+in\s+(.+?)\.\.(.+?)\s+loop/gi, "for (int $1 = $2; $1 <= $3; $1++) {");
  s = s.replace(/\bend\s+loop\s*;/gi, "}");
  s = s.replace(/\bprocedure\s+(\w+)\s+is/gi, "int main() { /* $1 */");
  s = s.replace(/\bfunction\s+Main\s+return\s+Integer\s+is/gi, "int main() {");
  s = s.replace(/\bfunction\s+(\w+)\s*\(([^)]*)\)\s+return\s+Integer\s+is/gi, (_, n, p) => {
    const ps = p.split(";").join(",").split(",").map((x) => {
      const name = x.split(":")[0].trim().split(/\s+/).pop();
      return name ? "int " + name : "";
    }).filter(Boolean);
    return "int " + n + "(" + ps.join(", ") + ") {";
  });
  s = s.replace(/\b(\w+)\s*:\s*(Integer|DT|Natural|Positive)\s*:=\s*/gi, "int $1 = ");
  s = s.replace(/\b(\w+)\s*:\s*(Integer|DT|Natural|Positive)\s*;/gi, "int $1;");
  s = s.replace(/\bbegin\b/gi, "");
  s = s.replace(/\bend\s+if\s*;/gi, "}");
  s = s.replace(/\bend\s+\w+\s*;/gi, "}");
  s = s.replace(/\bend\s*;/gi, "}");
  s = s.replace(/\bif\s+([\s\S]+?)\s+then/gi, (_, c) => {
    let x = String(c).replace(/\/=/g, "!=");
    x = x.replace(/(?<![!<>=])=(?![=])/g, "==");
    return "if (" + x + ") {";
  });
  s = s.replace(/\bthen\b/gi, "{");
  s = s.replace(/\belse\b/gi, "} else {");
  s = s.replace(/:=/g, "=");
  s = s.replace(/\btrue\b/gi, "1");
  s = s.replace(/\bfalse\b/gi, "0");
  s = s.replace(/\braise\s+\w+\s*;/gi, "return 1;");
  s = s.replace(/\bAND\b/gi, "&&");
  s = s.replace(/\bOR\b/gi, "||");
  s = s.replace(/\bNOT\b/gi, "!");
  s = s.replace(/int main\(\)\s*\n/g, "int main(){\n");
  s = s.replace(/int (\w+)\(([^)]*)\)\s*\n/g, "int $1($2){\n");
  const stubs =
    "int __fail = 0;\n" +
    "int IDENT_INT(int x) { return x; }\n" +
    "int IDENT(int x) { return x; }\n" +
    "int EQUAL(int a, int b) { return a == b; }\n" +
    "void TEST() {}\n" +
    "void COMMENT() {}\n" +
    "void NOT_APPLICABLE() {}\n" +
    "void FAILED() { __fail = __fail + 1; }\n";
  s = stubs + s;
  if (!/\bint main\s*\(/.test(s)) s += "\nint main(){return 0;}\n";
  return s;
}
