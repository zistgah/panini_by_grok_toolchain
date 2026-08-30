// @ts-nocheck
/* Copyright (C) 1993-2026 Abhishek Choudhary | GPL-3.0-or-later
 * Named-extract eval for Ruby, Perl, PHP, R, COBOL, SQL, Octave, SysML.
 * Cousin of extras.ts luaRun. Not MRI / perl / php / R / gnucobol / octave-the-program.
 */

function wrapErr(frontend, e) {
  const error = e instanceof Error ? e.message : String(e);
  return { ok: false, error, frontend };
}

function evalIntExpr(expr, env) {
  let s = String(expr).trim().replace(/;+\s*$/, "");
  s = s.replace(/\btrue\b/gi, "true").replace(/\bfalse\b/gi, "false").replace(/\bnil\b/gi, "null").replace(/\bNULL\b/g, "null");
  s = s.replace(/\band\b/gi, "&&").replace(/\bor\b/gi, "||").replace(/\bnot\b/gi, "!");
  s = s.replace(/\beq\b/gi, "==").replace(/\bne\b/gi, "!=");
  s = s.replace(/<>/g, "!=").replace(/=~/g, "==");
  s = s.replace(/\bmod\b/gi, "%");
  s = s.replace(/:=/g, "=");
  const keys = Object.keys(env).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    const v = env[k];
    if (typeof v === "function") continue;
    s = s.replace(new RegExp("\\$" + k + "\\b", "g"), JSON.stringify(v));
    s = s.replace(new RegExp("\\b" + k + "\\b", "g"), JSON.stringify(v));
  }
  s = s.replace(/\$(\w+)/g, (_, n) => (n in env ? JSON.stringify(env[n]) : "0"));
  try {
    return Function('"use strict"; return (' + s + ")")();
  } catch (e) {
    throw new Error("expr: " + (e instanceof Error ? e.message : e) + " :: " + expr);
  }
}

function callIfFn(inner, env) {
  const call = String(inner).trim().match(/^(\w+)\s*\((.*)\)$/);
  if (call && typeof env[call[1]] === "function") {
    const fn = env[call[1]];
    const args = call[2]
      ? call[2].split(",").map((x) => evalIntExpr(x.trim(), env))
      : [];
    return fn(...args);
  }
  return evalIntExpr(inner, env);
}

function grabEndFns(src, defKw, endKw) {
  const env = Object.create(null);
  const re = new RegExp(
    defKw + "\\s+(\\w+)\\s*(?:\\(([^)]*)\\))?\\s*\\n([\\s\\S]*?)\\n\\s*" + endKw + "\\b",
    "gi",
  );
  let m;
  while ((m = re.exec(src))) {
    const name = m[1];
    const params = (m[2] || "")
      .split(",")
      .map((x) => x.trim().replace(/^\$/, "").replace(/:.*/, ""))
      .filter(Boolean);
    const body = m[3];
    env[name] = (...args) => {
      const local = Object.create(env);
      params.forEach((p, i) => {
        local[p] = args[i];
      });
      const rm = body.match(/\breturn\s+(.+)/i);
      if (rm) return evalIntExpr(rm[1], local);
      const lines = body.split("\n").map((l) => l.trim()).filter(Boolean);
      let last = 0;
      for (const line of lines) {
        const am = line.match(/^(\w+)\s*=\s*(.+)$/);
        if (am) {
          local[am[1]] = evalIntExpr(am[2], local);
          last = local[am[1]];
          continue;
        }
        last = evalIntExpr(line, local);
      }
      return last;
    };
  }
  return env;
}

function grabBraceFns(src, defKw) {
  const env = Object.create(null);
  const re = new RegExp(defKw + "\\s+(\\$?\\w+)\\s*(?:\\(([^)]*)\\))?\\s*\\{", "gi");
  let m;
  while ((m = re.exec(src))) {
    const name = m[1].replace(/^\$/, "");
    const params = (m[2] || "")
      .split(",")
      .map((x) => x.trim().replace(/^\$/, "").replace(/:.*/, "").replace(/^my\s+/, ""))
      .filter(Boolean);
    let i = m.index + m[0].length;
    let depth = 1;
    const start = i;
    while (i < src.length && depth) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}") depth--;
      i++;
    }
    const body = src.slice(start, i - 1);
    env[name] = (...args) => {
      const local = Object.create(env);
      params.forEach((p, i2) => {
        local[p] = args[i2];
      });
      const my = body.match(/my\s*\(([^)]*)\)\s*=\s*@_/);
      if (my) {
        my[1].split(",").map((x) => x.trim().replace(/^\$/, "")).filter(Boolean)
          .forEach((p, i2) => { local[p] = args[i2]; });
      }
      const lines = body.split("\n").map((l) => l.trim().replace(/;+$/, "")).filter(Boolean);
      let last = 0;
      for (const line of lines) {
        if (/^my\b/.test(line) && /@_/.test(line)) continue;
        const inc = line.match(/^\$?(\w+)\s*\+\+$/) || line.match(/^\+\+\s*\$?(\w+)$/);
        if (inc) {
          local[inc[1]] = (Number(local[inc[1]]) || 0) + 1;
          last = local[inc[1]];
          continue;
        }
        const rm = line.match(/^(?:return)\s*\((.+)\)\s*$/i) || line.match(/^(?:return)\s+(.+)$/i);
        if (rm) return evalIntExpr(rm[1].replace(/[;$]+$/, ""), local);
        const am = line.match(/^(?:my\s+)?\$?(\w+)\s*=\s*(.+)$/);
        if (am) {
          local[am[1]] = evalIntExpr(am[2], local);
          last = local[am[1]];
          continue;
        }
        last = evalIntExpr(line, local);
      }
      return last;
    };
  }
  return env;
}

/** ISO/IEC 30170-shaped Ruby named extract. Not MRI. */
export function rubyRun(source) {
  try {
    const src = String(source).replace(/\r\n/g, "\n").replace(/#.*$/gm, "");
    const env = grabEndFns(src, "def", "end");
    const prints = [];
    const lines = src.split("\n");
    let skipping = 0;
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      if (/^def\b/.test(line)) { skipping++; continue; }
      if (/^end\b/.test(line)) { skipping = Math.max(0, skipping - 1); continue; }
      if (skipping) continue;
      const pm = line.match(/^(?:puts|print|p)\s+(.*)$/) || line.match(/^(?:puts|print|p)\s*\((.*)\)\s*$/);
      if (pm) {
        const v = callIfFn(pm[1], env);
        prints.push(String(v));
        env.__last = v;
        continue;
      }
      const am = line.match(/^(\w+)\s*=\s*(.+)$/);
      if (am) {
        env[am[1]] = callIfFn(am[2], env);
        continue;
      }
      env.__last = callIfFn(line, env);
    }
    const value = env.main && typeof env.main === "function" ? env.main() : (prints.length ? prints[prints.length - 1] : env.__last ?? 0);
    return {
      ok: true,
      value,
      prints,
      print: prints.join("\n"),
      frontend: "PANINI.Frontend.Ruby",
      note: "Ruby integer def/puts named extract. MRI / RubySpec GAP.",
    };
  } catch (e) {
    return wrapErr("PANINI.Frontend.Ruby", e);
  }
}

/** Perl named extract (Artistic/GPL). Not perl. */
export function perlRun(source) {
  try {
    let src = String(source).replace(/\r\n/g, "\n").replace(/#.*$/gm, "");
    src = src.replace(/use\s+\w+[^;]*;/g, "");
    const env = grabBraceFns(src, "sub");
    const prints = [];
    src.replace(/(?:my\s+)?\$(\w+)\s*=\s*([^;]+);/g, (_, n, e) => {
      try { env[n] = callIfFn(String(e).replace(/;$/, ""), env); } catch { /* */ }
      return "";
    });
    src = src.replace(/if\s*\(([^)]+)\)\s*\{\s*([^}]*)\}\s*else\s*\{\s*([^}]*)\}/g, (_, c, a, b) => {
      let cond;
      try { cond = evalIntExpr(c, env); } catch { cond = 0; }
      const body = cond ? a : b;
      const pm = body.match(/print\s+(.+?);/);
      if (pm) {
        let inner = pm[1].replace(/,\s*["']\\n["']/, "").trim();
        if (/^["']/.test(inner)) prints.push(inner.replace(/^['"]/, "").replace(/['"]$/, "").replace(/\\n/g, ""));
        else prints.push(String(callIfFn(inner, env)));
      }
      return "";
    });
    const lines = src.split("\n");
    let depth = 0;
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      depth += (line.match(/\{/g) || []).length;
      depth -= (line.match(/\}/g) || []).length;
      if (/^sub\b/.test(line) || depth > 0) continue;
      const pm = line.match(/^print\s+(.+?)(?:,\s*["']\\n["'])?;?$/) || line.match(/^print\s*\((.*)\)\s*;?$/);
      if (pm) {
        let inner = pm[1].replace(/,\s*["']\\n["']/, "").trim().replace(/;$/, "");
        if (/^["']/.test(inner)) {
          const s = inner.replace(/^['"]/, "").replace(/['"]$/, "").replace(/\\n/g, "\n");
          prints.push(s.replace(/\n$/, ""));
          env.__last = s;
          continue;
        }
        inner = inner.replace(/["']/g, "");
        inner = inner.replace(/^say\s+/, "");
        const v = callIfFn(inner.replace(/;$/, ""), env);
        prints.push(String(v));
        env.__last = v;
        continue;
      }
      const sm = line.match(/^say\s+(.+)$/);
      if (sm) {
        const v = callIfFn(sm[1].replace(/;$/, ""), env);
        prints.push(String(v));
        env.__last = v;
        continue;
      }
      const am = line.match(/^(?:my\s+)?\$?(\w+)\s*=\s*(.+);?$/);
      if (am && !/^sub\b/.test(line)) {
        env[am[1]] = callIfFn(am[2].replace(/;$/, ""), env);
      }
    }
    const value = prints.length ? prints[prints.length - 1] : env.__last ?? 0;
    return {
      ok: true,
      value,
      prints,
      print: prints.join("\n"),
      frontend: "PANINI.Frontend.Perl",
      note: "Perl integer sub/print named extract. perlpolicy suite GAP.",
    };
  } catch (e) {
    return wrapErr("PANINI.Frontend.Perl", e);
  }
}

/** PHP language named extract. Not php-src. */
export function phpRun(source) {
  try {
    let src = String(source).replace(/\r\n/g, "\n");
    src = src.replace(/<\?php/g, "").replace(/\?>/g, "");
    src = src.replace(/\/\/.*$/gm, "").replace(/#.*$/gm, "");
    const env = grabBraceFns(src, "function");
    const prints = [];
    function echoVal(inner) {
      inner = String(inner).trim().replace(/;+$/, "");
      if (/^["']/.test(inner)) {
        const s = inner.replace(/^['"]/, "").replace(/['"]$/, "");
        prints.push(s);
        env.__last = s;
        return;
      }
      const v = callIfFn(inner, env);
      prints.push(String(v));
      env.__last = v;
    }
    function execBlock(block) {
      const lines = String(block).split("\n");
      for (const raw of lines) {
        const line = raw.trim();
        if (!line) continue;
        const em = line.match(/^(?:echo|print)\s+(.+);?$/);
        if (em) {
          echoVal(em[1]);
          continue;
        }
        const inc = line.match(/^\$(\w+)\+\+;?$/) || line.match(/^\+\+\$(\w+);?$/);
        if (inc) {
          env[inc[1]] = (Number(env[inc[1]]) || 0) + 1;
          continue;
        }
        const am = line.match(/^\$(\w+)\s*=\s*(.+);?$/);
        if (am) env[am[1]] = callIfFn(am[2].replace(/;$/, ""), env);
      }
    }
    src.replace(/\$(\w+)\s*=\s*([^;]+);/g, (all, n, e) => {
      if (/function/.test(all)) return all;
      try { env[n] = callIfFn(e, env); } catch { /* later */ }
      return all;
    });
    /* one-line if/else echo: if($a>0) { echo "Yes"; } */
    src = src.replace(/if\s*\(([^)]+)\)\s*\{\s*(echo|print)\s+([^;]+);?\s*\}\s*else\s*\{\s*(echo|print)\s+([^;]+);?\s*\}/gi, (_, c, _e1, a, _e2, b) => {
      const ok = callIfFn(c, env);
      echoVal(ok ? a : b);
      return "";
    });
    src = src.replace(/if\s*\(([^)]+)\)\s*\{\s*(echo|print)\s+([^;]+);?\s*\}/gi, (_, c, _e, a) => {
      if (callIfFn(c, env)) echoVal(a);
      return "";
    });
    src = src.replace(/while\s*\(([^)]+)\)\s*\{([^}]+)\}/gi, (_, c, body) => {
      let n = 0;
      while (callIfFn(c, env) && n++ < 10000) execBlock(body);
      return "";
    });
    const lines = src.split("\n");
    let depth = 0;
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      depth += (line.match(/\{/g) || []).length;
      depth -= (line.match(/\}/g) || []).length;
      if (/^function\b/.test(line) || depth > 0) continue;
      const em = line.match(/^(?:echo|print)\s+(.+);?$/);
      if (em) {
        echoVal(em[1]);
        continue;
      }
      const inc = line.match(/^\$(\w+)\+\+;?$/) || line.match(/^\+\+\$(\w+);?$/);
      if (inc) {
        env[inc[1]] = (Number(env[inc[1]]) || 0) + 1;
        continue;
      }
      const am = line.match(/^\$(\w+)\s*=\s*(.+);?$/);
      if (am) env[am[1]] = callIfFn(am[2].replace(/;$/, ""), env);
    }
    const value = prints.length ? prints[prints.length - 1] : env.__last ?? 0;
    return {
      ok: true,
      value,
      prints,
      print: prints.join(""),
      frontend: "PANINI.Frontend.PHP",
      note: "PHP integer function/echo named extract. php-src suite GAP.",
    };
  } catch (e) {
    return wrapErr("PANINI.Frontend.PHP", e);
  }
}

function rEval(expr, env) {
  let s = String(expr).trim().replace(/;+\s*$/, "");
  if (!s) return 0;
  const tm = s.match(/^typeof\s*\((.+)\)\s*(?:==\s*"(\w+)")?$/);
  if (tm) {
    const inner = tm[1].trim();
    let kind;
    if (/^\d+(?:e\d+)?L$/i.test(inner) || /^\d+$/.test(inner) || /^-?\d+:-?\d+$/.test(inner)) kind = "integer";
    else {
      const v = rEval(inner, env);
      if (typeof v === "number" && Number.isInteger(v)) kind = "integer";
      else if (Array.isArray(v) && v.every((x) => typeof x === "number" && Number.isInteger(x))) kind = "integer";
      else if (typeof v === "number") kind = "double";
      else kind = typeof v;
    }
    if (tm[2]) return kind === tm[2];
    return kind;
  }
  const allm = s.match(/^all\s*\((.+)\)$/);
  if (allm) {
    const inner = allm[1].trim();
    const eq = inner.match(/^(.+?)\s*==\s*(.+)$/);
    if (eq) {
      const a = rEval(eq[1], env);
      const b = rEval(eq[2], env);
      if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => x === b[i]);
      return a === b;
    }
    const v = rEval(inner, env);
    if (Array.isArray(v)) return v.every(Boolean);
    return !!v;
  }
  const csm = s.match(/^cumsum\s*\((.+)\)$/);
  if (csm) {
    const arr = rEval(csm[1], env);
    const xs = Array.isArray(arr) ? arr : [arr];
    let acc = 0;
    return xs.map((x) => (acc += Number(x)));
  }
  const repm = s.match(/^rep\s*\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)$/);
  if (repm) return Array(Number(repm[2])).fill(Number(repm[1]));
  const range = s.match(/^(-?\d+)\s*:\s*(-?\d+)$/);
  if (range) {
    const a = Number(range[1]);
    const b = Number(range[2]);
    const out = [];
    if (a <= b) for (let i = a; i <= b; i++) out.push(i);
    else for (let i = a; i >= b; i--) out.push(i);
    return out;
  }
  s = s.replace(/(\d+)L\b/g, "$1");
  return evalIntExpr(s, env);
}

/** R Language Definition named extract. Not GNU R. */
export function rRun(source) {
  try {
    const src = String(source).replace(/\r\n/g, "\n").replace(/#.*$/gm, "");
    const env = Object.create(null);
    const fnRe = /(\w+)\s*<-\s*function\s*\(([^)]*)\)\s*\{([\s\S]*?)\}/g;
    let m;
    while ((m = fnRe.exec(src))) {
      const name = m[1];
      const params = m[2].split(",").map((x) => x.trim()).filter(Boolean);
      const body = m[3];
      env[name] = (...args) => {
        const local = Object.create(env);
        params.forEach((p, i) => { local[p] = args[i]; });
        const rm = body.match(/\breturn\s*\((.+)\)/) || body.match(/\breturn\s+(.+)/);
        if (rm) return rEval(rm[1], local);
        const lines = body.split("\n").map((l) => l.trim()).filter(Boolean);
        let last = 0;
        for (const line of lines) {
          const am = line.match(/^(\w+)\s*(?:<-|=)\s*(.+)$/);
          if (am) {
            local[am[1]] = rEval(am[2], local);
            last = local[am[1]];
            continue;
          }
          last = rEval(line, local);
        }
        return last;
      };
    }
    const prints = [];
    const lines = src.split("\n");
    let depth = 0;
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      depth += (line.match(/\{/g) || []).length;
      depth -= (line.match(/\}/g) || []).length;
      if (/function\s*\(/.test(line) || depth > 0) continue;
      const pm = line.match(/^print\s*\((.+)\)\s*$/) || line.match(/^cat\s*\((.+)\)\s*$/);
      if (pm) {
        const v = callIfFn(pm[1], env);
        prints.push(String(v));
        env.__last = v;
        continue;
      }
      const am = line.match(/^(\w+)\s*(?:<-|=)\s*(.+)$/);
      if (am && !/function\s*\(/.test(am[2])) {
        env[am[1]] = callIfFn(am[2], env);
        env.__last = env[am[1]];
        continue;
      }
      if (/^(typeof|all|cumsum|rep)\s*\(/.test(line) || /^\d+L\b/.test(line) || /^-?\d+\s*:/.test(line)) {
        try {
          const v = rEval(line, env);
          env.__last = v;
          prints.push(String(v));
        } catch {
          /* skip non-integer official lines */
        }
      }
    }
    const value = prints.length ? prints[prints.length - 1] : env.__last ?? 0;
    return {
      ok: true,
      value,
      prints,
      print: prints.join("\n"),
      frontend: "PANINI.Frontend.R",
      note: "R integer <- / function / print + GNU R simple-true.R named extract.",
    };
  } catch (e) {
    return wrapErr("PANINI.Frontend.R", e);
  }
}

/** ISO/IEC 1989 COBOL named extract. Not gnucobol. */
export function cobolRun(source) {
  try {
    const src = String(source).replace(/\r\n/g, "\n");
    const env = Object.create(null);
    const prints = [];
    const valRe = /01\s+(\w+)\s+PIC\s+[^(]*\([^)]*\)\s+VALUE\s+(-?\d+)/gi;
    let m;
    while ((m = valRe.exec(src))) env[m[1].toUpperCase()] = Number(m[2]);
    const val2 = /01\s+(\w+)[^.]*VALUE\s+(-?\d+)/gi;
    while ((m = val2.exec(src))) {
      if (!(m[1].toUpperCase() in env)) env[m[1].toUpperCase()] = Number(m[2]);
    }
    const lines = src.split("\n");
    for (const raw of lines) {
      const line = raw.replace(/^\s*\d+\s+/, "").trim();
      if (!line) continue;
      const up = line.toUpperCase();
      const cm = up.match(/^COMPUTE\s+(\w+)\s*=\s*(.+)$/);
      if (cm) {
        const name = cm[1];
        const expr = line.replace(/^compute\s+\w+\s*=\s*/i, "").replace(/\.$/, "");
        const bound = Object.create(null);
        for (const [k, v] of Object.entries(env)) bound[k] = v;
        env[name] = evalIntExpr(expr, bound) | 0;
        continue;
      }
      const add = up.match(/^ADD\s+(-?\d+|\w+)\s+TO\s+(\w+)/);
      if (add) {
        const a = /^-?\d+$/.test(add[1]) ? Number(add[1]) : (env[add[1]] | 0);
        env[add[2]] = (env[add[2]] | 0) + a;
        continue;
      }
      const mv = up.match(/^MOVE\s+(-?\d+|\w+)\s+TO\s+(\w+)/);
      if (mv) {
        const a = /^-?\d+$/.test(mv[1]) ? Number(mv[1]) : (env[mv[1]] | 0);
        env[mv[2]] = a;
        continue;
      }
      const ds = up.match(/^DISPLAY\s+(.+?)(?:\s+END-DISPLAY)?\.?$/);
      if (ds) {
        let arg = ds[1].trim().replace(/\.$/, "");
        const orig = line.replace(/^display\s+/i, "").replace(/\s+end-display\.?$/i, "").replace(/\.$/, "").trim();
        if (/^["']/.test(orig) || /^["']/.test(arg)) {
          const s = orig.replace(/^["']/, "").replace(/["']$/, "");
          prints.push(s);
          env.__last = s;
        } else if (/^[+-]?\d+(\.\d+)?(E[+-]?\d+)?$/i.test(arg.replace(/\s/g, ""))) {
          prints.push(orig || arg);
          env.__last = Number(arg);
        } else {
          const name = arg.split(/\s+/)[0];
          const v = env[name] ?? env[name.toUpperCase()] ?? name;
          prints.push(String(v));
          env.__last = v;
        }
        continue;
      }
    }
    const value = prints.length ? prints[prints.length - 1] : env.__last ?? env.N ?? 0;
    return {
      ok: true,
      value,
      prints,
      print: prints.join("\n"),
      frontend: "PANINI.Frontend.COBOL",
      note: "COBOL integer COMPUTE/DISPLAY named extract. gnucobol suite GAP.",
    };
  } catch (e) {
    return wrapErr("PANINI.Frontend.COBOL", e);
  }
}

/** ISO/IEC 9075 SQL named extract. Not a DBMS. */
export function sqlRun(source) {
  try {
    const src = String(source).replace(/\r\n/g, "\n").replace(/--.*$/gm, "");
    const tables = Object.create(null);
    const prints = [];
    const stmts = src.split(";").map((s) => s.trim()).filter(Boolean);
    let last = 0;
    for (const st of stmts) {
      const up = st.replace(/\s+/g, " ");
      const ct = up.match(/^CREATE TABLE\s+(\w+)\s*\((.+)\)$/i);
      if (ct) {
        const cols = ct[2].split(",").map((c) => c.trim().split(/\s+/)[0]);
        tables[ct[1].toUpperCase()] = { cols: cols.map((c) => c.toUpperCase()), rows: [] };
        continue;
      }
      const ins = up.match(/^INSERT INTO\s+(\w+)\s*(?:\([^)]*\))?\s*VALUES\s*\((.+)\)$/i);
      if (ins) {
        const t = tables[ins[1].toUpperCase()] || (tables[ins[1].toUpperCase()] = { cols: [], rows: [] });
        const row = ins[2].split(",").map((x) => Number(x.trim()) || 0);
        t.rows.push(row);
        if (!t.cols.length) t.cols = row.map((_, i) => "C" + i);
        continue;
      }
      const sel = up.match(/^SELECT\s+(.+?)(?:\s+AS\s+\w+)?(?:\s+FROM\s+(\w+))?(?:\s+WHERE\s+(.+))?$/i);
      if (sel) {
        const expr = sel[1].trim();
        const from = sel[2] ? sel[2].toUpperCase() : null;
        const where = sel[3] ? sel[3].trim() : null;
        if (!from) {
          last = evalIntExpr(expr, {});
          prints.push(String(last));
          continue;
        }
        const t = tables[from] || { cols: [], rows: [] };
        for (const row of t.rows) {
          const env = Object.create(null);
          t.cols.forEach((c, i) => { env[c] = row[i]; env[c.toLowerCase()] = row[i]; });
          if (where && !evalIntExpr(where, env)) continue;
          last = evalIntExpr(expr, env);
          prints.push(String(last));
        }
      }
    }
    return {
      ok: true,
      value: last,
      prints,
      print: prints.join("\n"),
      frontend: "PANINI.Frontend.SQL",
      note: "SQL integer SELECT/INSERT named extract. Full ISO 9075 GAP.",
    };
  } catch (e) {
    return wrapErr("PANINI.Frontend.SQL", e);
  }
}

/** GNU Octave M-file named extract. Not MATLAB. */
export function octaveRun(source) {
  try {
    let src = String(source).replace(/\r\n/g, "\n");
    src = src.replace(/%[^\n]*/g, "").replace(/#[^\n]*/g, "");
    const env = Object.create(null);
    env.factorial = (n) => {
      n = Number(n);
      if (n < 0 || n !== (n | 0)) throw new Error("factorial domain");
      let f = 1;
      for (let i = 2; i <= n; i++) f *= i;
      return f;
    };
    const fnRe = /function\s+(?:(\w+)\s*=\s*)?(\w+)\s*(?:\(([^)]*)\))?\s*\n([\s\S]*?)\n\s*(?:end|endfunction)\b/gi;
    let m;
    while ((m = fnRe.exec(src))) {
      const out = m[1] || "ans";
      const name = m[2];
      const params = (m[3] || "").split(",").map((x) => x.trim()).filter(Boolean);
      const body = m[4];
      env[name] = (...args) => {
        const local = Object.create(env);
        params.forEach((p, i) => { local[p] = args[i]; });
        local[out] = 0;
        const lines = body.split("\n");
        for (const raw of lines) {
          const line = raw.trim().replace(/;+$/, "");
          if (!line) continue;
          const dm = line.match(/^disp\s*\((.+)\)$/) || line.match(/^fprintf\s*\((.+)\)$/);
          if (dm) {
            local.__print = evalIntExpr(dm[1], local);
            continue;
          }
          const am = line.match(/^(\w+)\s*=\s*(.+)$/);
          if (am) {
            local[am[1]] = callIfFn(am[2], local);
            continue;
          }
        }
        return local[out] ?? local.__print ?? 0;
      };
    }
    const prints = [];
    const lines = src.split("\n");
    let skipping = 0;
    for (const raw of lines) {
      const line = raw.trim().replace(/;+$/, "");
      if (!line) continue;
      if (/^function\b/.test(line)) { skipping++; continue; }
      if (/^(end|endfunction)\b/.test(line)) { skipping = Math.max(0, skipping - 1); continue; }
      if (skipping) continue;
      const dm = line.match(/^disp\s*\((.+)\)$/) || line.match(/^fprintf\s*\((.+)\)$/);
      if (dm) {
        const v = callIfFn(dm[1], env);
        prints.push(String(v));
        env.__last = v;
        continue;
      }
      const am = line.match(/^(\w+)\s*=\s*(.+)$/);
      if (am && !/^function\b/.test(line)) {
        env[am[1]] = callIfFn(am[2], env);
        env.__last = env[am[1]];
      }
    }
    let value = prints.length ? prints[prints.length - 1] : env.__last ?? 0;
    if (typeof env.main === "function") {
      value = env.main();
      if (value != null && prints.length === 0) prints.push(String(value));
    }
    return {
      ok: true,
      value,
      prints,
      print: prints.join("\n"),
      frontend: "PANINI.Frontend.Octave",
      note: "GNU Octave M-file integer named extract. Not MATLAB. Octave test suite GAP.",
    };
  } catch (e) {
    return wrapErr("PANINI.Frontend.Octave", e);
  }
}

/** SysML v2 textual named extract. Not a model checker. Uses languages/sysml.pni stub shape. */
export function sysmlRun(source) {
  try {
    const src = String(source).replace(/\r\n/g, "\n").replace(/\/\/.*$/gm, "");
    const attrs = Object.create(null);
    const prints = [];
    let m;
    const at = /attribute\s+(\w+)\s*(?::\s*\w+)?\s*=\s*(-?\d+)/gi;
    while ((m = at.exec(src))) attrs[m[1]] = Number(m[2]);
    const at2 = /(\w+)\s*:\s*Integer\s*=\s*(-?\d+)/gi;
    while ((m = at2.exec(src))) attrs[m[1]] = Number(m[2]);
    const cq = /constraint(?:\s+def)?\s+\w+\s*\{([^}]+)\}/gi;
    let last = 0;
    while ((m = cq.exec(src))) {
      const body = m[1].trim().replace(/;+$/, "");
      const eq = body.match(/^(.+?)==(.+)$/);
      if (eq) {
        const l = evalIntExpr(eq[1], attrs);
        const r = evalIntExpr(eq[2], attrs);
        last = l === r ? 1 : 0;
      } else {
        last = evalIntExpr(body, attrs);
      }
      prints.push(String(last));
    }
    if (!prints.length) {
      const vals = Object.values(attrs);
      last = vals.length ? vals[vals.length - 1] : (/\bpackage\b/.test(src) ? String(src).length : 0);
      if (vals.length) prints.push(String(last));
    }
    const hasPkg = /\bpackage\b/.test(src);
    const hasPart = /\bpart\b/.test(src);
    return {
      ok: true,
      value: last,
      prints,
      print: prints.join("\n"),
      frontend: "PANINI.Frontend.SysML",
      note: "SysML v2 textual package/part/attribute/constraint named extract. Not a model checker.",
      config: { package: hasPkg, part: hasPart },
    };
  } catch (e) {
    return wrapErr("PANINI.Frontend.SysML", e);
  }
}
