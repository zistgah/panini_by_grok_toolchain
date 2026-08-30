// @ts-nocheck
/**
 * ISO Prolog subset for Ciao iso_tests arithmetic extract (STANDARD GREEN).
 * Copyright (C) 1993-2026 Abhishek Choudhary | GPL-3.0-or-later
 *
 * Host-speed eval (same slot as CINTERP). Named extract is ISO 8.6 is/2
 * and 8.7 arithmetic comparison from Ciao iso_tests.pl.
 */
class PlErr {
  constructor(name) { this.name = name; }
}

function tok(src) {
  const t = [];
  let i = 0;
  const n = src.length;
  const two = ["=:=", "=\\=", ">=", "=<", ":-"];
  function lastIsOp() {
    if (!t.length) return true;
    const p = t[t.length - 1];
    return p.k === "op" && p.n !== ")";
  }
  while (i < n) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === "%") { while (i < n && src[i] !== "\n") i++; continue; }
    if (c === "/" && src[i + 1] === "*") {
      i += 2;
      while (i + 1 < n && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    if (c === "'") {
      i++;
      let r = "";
      while (i < n && src[i] !== "'") {
        if (src[i] === "\\" && src[i + 1] === "\\") { r += "\\"; i += 2; continue; }
        if (src[i] === "\\" && src[i + 1] === "'") { r += "'"; i += 2; continue; }
        r += src[i++];
      }
      if (src[i] === "'") i++;
      t.push({ k: "atom", n: r });
      continue;
    }
    if (/[0-9]/.test(c) || (c === "-" && /[0-9]/.test(src[i + 1] || "") && lastIsOp())) {
      let r = "";
      if (c === "-") { r += c; i++; }
      while (/[0-9]/.test(src[i] || "")) r += src[i++];
      let isF = false;
      if (src[i] === "." && /[0-9]/.test(src[i + 1] || "")) {
        isF = true;
        r += src[i++];
        while (/[0-9]/.test(src[i] || "")) r += src[i++];
      }
      t.push({ k: "num", v: isF ? parseFloat(r) : parseInt(r, 10), f: isF });
      continue;
    }
    if (/[A-Z_]/.test(c)) {
      let r = "";
      while (/[A-Za-z0-9_]/.test(src[i] || "")) r += src[i++];
      t.push({ k: "var", n: r });
      continue;
    }
    if (/[a-z]/.test(c)) {
      let r = "";
      while (/[A-Za-z0-9_]/.test(src[i] || "")) r += src[i++];
      t.push({ k: "atom", n: r });
      continue;
    }
    let hit = null;
    for (const op of two) {
      if (src.slice(i, i + op.length) === op) { hit = op; break; }
    }
    if (hit) { t.push({ k: "op", n: hit }); i += hit.length; continue; }
    t.push({ k: "op", n: c });
    i++;
  }
  t.push({ k: "eof", n: "" });
  return t;
}

const PREC = {
  ",": { p: 1000, spec: "xfy" },
  "is": { p: 700, spec: "xfx" },
  "=": { p: 700, spec: "xfx" },
  "=:=": { p: 700, spec: "xfx" },
  "=\\=": { p: 700, spec: "xfx" },
  "<": { p: 700, spec: "xfx" },
  ">": { p: 700, spec: "xfx" },
  ">=": { p: 700, spec: "xfx" },
  "=<": { p: 700, spec: "xfx" },
  "+": { p: 500, spec: "yfx" },
  "-": { p: 500, spec: "yfx" },
  "*": { p: 400, spec: "yfx" },
  "/": { p: 400, spec: "yfx" },
};

function neqName(n) {
  return n === "=\\=";
}

function parseGoal(src) {
  const T = tok(src);
  let i = 0;
  const peek = () => T[i] || { k: "eof", n: "" };
  const eat = () => T[i++];
  const at = (n) => peek().n === n;

  function atomName(tk) {
    if (tk.k === "atom" || tk.k === "op") return tk.n;
    return null;
  }

  function parsePrec(maxP) {
    let left = parsePrim();
    for (;;) {
      const tk = peek();
      const name = atomName(tk);
      const inf = name && (PREC[name] || (neqName(name) ? PREC["=\\="] : null));
      if (!inf || inf.p > maxP) break;
      if (tk.k !== "op" && tk.k !== "atom") break;
      eat();
      const rightMax = inf.spec === "xfy" ? inf.p : inf.p - 1;
      const right = parsePrec(rightMax);
      left = { t: "fun", n: name, a: [left, right] };
    }
    return left;
  }

  function parsePrim() {
    const tk = peek();
    if (tk.k === "num") { eat(); return { t: tk.f ? "float" : "int", v: tk.v }; }
    if (tk.k === "var") { eat(); return { t: "var", n: tk.n }; }
    if (tk.n === "(") {
      eat();
      const e = parsePrec(1200);
      if (at(")")) eat();
      return e;
    }
    if (tk.n === "-") {
      eat();
      const e = parsePrim();
      return { t: "fun", n: "-", a: [e] };
    }
    if (tk.k === "atom" || (tk.k === "op" && tk.n !== "," && tk.n !== ".")) {
      const n = eat().n;
      if (at("(")) {
        eat();
        const a = [];
        if (!at(")")) {
          a.push(parsePrec(999));
          while (at(",")) { eat(); a.push(parsePrec(999)); }
        }
        if (at(")")) eat();
        return { t: "fun", n, a };
      }
      return { t: "atom", n };
    }
    eat();
    return { t: "atom", n: "fail" };
  }

  return parsePrec(1200);
}

function deref(x, env) {
  while (x && x.t === "var" && Object.prototype.hasOwnProperty.call(env, x.n)) x = env[x.n];
  return x;
}

function unify(a, b, env) {
  a = deref(a, env);
  b = deref(b, env);
  if (a && a.t === "var") { env[a.n] = b; return true; }
  if (b && b.t === "var") { env[b.n] = a; return true; }
  if (a && b && a.t === "int" && b.t === "int") return a.v === b.v;
  if (a && b && a.t === "float" && b.t === "float") return a.v === b.v;
  if (a && b && a.t === "atom" && b.t === "atom") return a.n === b.n;
  if (a && b && a.t === "fun" && b.t === "fun" && a.n === b.n && a.a.length === b.a.length) {
    for (let k = 0; k < a.a.length; k++) if (!unify(a.a[k], b.a[k], env)) return false;
    return true;
  }
  return false;
}

function arith(term, env) {
  term = deref(term, env);
  if (term.t === "int" || term.t === "float") return { t: term.t, v: term.v };
  if (term.t === "var") throw new PlErr("instantiation_error");
  if (term.t === "fun") {
    const args = term.a.map((x) => arith(x, env));
    const num = (x) => x.v;
    const promote = (...xs) => xs.some((x) => x.t === "float") ? "float" : "int";
    if (term.n === "+" && args.length === 2) return { t: promote(args[0], args[1]), v: num(args[0]) + num(args[1]) };
    if (term.n === "-" && args.length === 1) return { t: args[0].t, v: -num(args[0]) };
    if (term.n === "-" && args.length === 2) return { t: promote(args[0], args[1]), v: num(args[0]) - num(args[1]) };
    if (term.n === "*" && args.length === 2) return { t: promote(args[0], args[1]), v: num(args[0]) * num(args[1]) };
    if (term.n === "/" && args.length === 2) return { t: "float", v: num(args[0]) / num(args[1]) };
  }
  throw new PlErr("type_error");
}

function numEq(a, b) { return a.v === b.v; }

function prove(goal, env) {
  goal = deref(goal, env);
  if (goal.t === "fun" && goal.n === ",") {
    return prove(goal.a[0], env) && prove(goal.a[1], env);
  }
  if (goal.t === "fun" && goal.n === "is") {
    const v = arith(goal.a[1], env);
    return unify(goal.a[0], v, env);
  }
  if (goal.t === "fun" && (goal.n === "=:=" || neqName(goal.n) || goal.n === "<" || goal.n === ">" || goal.n === ">=" || goal.n === "=<")) {
    const l = arith(goal.a[0], env);
    const r = arith(goal.a[1], env);
    if (goal.n === "=:=") return numEq(l, r);
    if (neqName(goal.n)) return !numEq(l, r);
    if (goal.n === "<") return l.v < r.v;
    if (goal.n === ">") return l.v > r.v;
    if (goal.n === ">=") return l.v >= r.v;
    if (goal.n === "=<") return l.v <= r.v;
  }
  if (goal.t === "fun" && goal.n === "=") return unify(goal.a[0], goal.a[1], env);
  if (goal.t === "atom" && goal.n === "true") return true;
  if (goal.t === "atom" && goal.n === "fail") return false;
  return false;
}

export function plQuery(src) {
  try {
    const g = parseGoal(String(src).replace(/\.\s*$/, ""));
    const env = Object.create(null);
    const ok = prove(g, env);
    return { ok: true, success: !!ok, env, frontend: "PANINI.Frontend.Prolog" };
  } catch (e) {
    return { ok: false, success: false, error: e instanceof PlErr ? e.name : String(e.message || e), frontend: "PANINI.Frontend.Prolog" };
  }
}

export function plExtractIsoArith(src) {
  const text = String(src);
  const start = text.indexOf("%! # 8.6 Arithmetic evaluation");
  const end = text.indexOf("%! # 8.8 ");
  const slice = start >= 0 ? text.slice(start, end < 0 ? text.length : end) : text;
  const tests = [];
  const declRe = /:- test (\w+)(?:\(([^)]*)\))?\s*([\s\S]*?)#\s*"(\[ISO\] arith[^"]*)"/g;
  let m;
  while ((m = declRe.exec(slice))) {
    const name = m[1];
    const head = m[3] || "";
    const fails = /\+\s*fails/.test(head);
    const except = /\+\s*exception/.test(head);
    const wantM = head.match(/=>\s*\(([^)]*)\)/);
    const clause = new RegExp("^" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?:\\([^)]*\\))?\\s*:-\\s*(.+)\\.\\s*$", "m");
    const cm = slice.match(clause);
    if (!cm) continue;
    tests.push({
      name,
      body: cm[1].trim(),
      fails,
      except,
      want: wantM ? wantM[1].trim() : null,
    });
  }
  return tests;
}

export function prologRun(source) {
  const r = plQuery(source);
  return { ok: r.ok, value: r.success ? 1 : 0, success: r.success, error: r.error, frontend: "PANINI.Frontend.Prolog" };
}
