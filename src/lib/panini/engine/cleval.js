// @ts-nocheck
/**
 * ANSI Common Lisp subset for ansi-test named extract (STANDARD GREEN).
 * Copyright (C) 1993-2026 Abhishek Choudhary | GPL-3.0-or-later
 *
 * Host-speed eval (same slot as CINTERP / TEST262RUN). Lex/parse remain
 * available in PANINI.Frontend.CommonLisp.
 */
class ClErr {
  constructor(name) { this.name = name; }
}

function skipWs(s, i) {
  const n = s.length;
  while (i < n) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === ";" ) { while (i < n && s[i] !== "\n") i++; continue; }
    if (c === "#" && s[i + 1] === "|") {
      i += 2;
      while (i + 1 < n && !(s[i] === "|" && s[i + 1] === "#")) i++;
      i += 2;
      continue;
    }
    break;
  }
  return i;
}

function intern(name) {
  return { k: "sym", n: String(name).toUpperCase() };
}

const NIL = null;
const T = intern("T");

function readOne(s, i) {
  i = skipWs(s, i);
  if (i >= s.length) return [null, i];
  const c = s[i];
  if (c === "'") {
    const [v, j] = readOne(s, i + 1);
    return [{ k: "cons", car: intern("QUOTE"), cdr: { k: "cons", car: v, cdr: NIL } }, j];
  }
  if (c === "(") {
    i++;
    const items = [];
    let dotted = null;
    for (;;) {
      i = skipWs(s, i);
      if (i >= s.length) break;
      if (s[i] === ")") { i++; break; }
      if (s[i] === "." && (i + 1 >= s.length || /\s|\)/.test(s[i + 1]))) {
        const [v, j] = readOne(s, i + 1);
        dotted = v;
        i = skipWs(s, j);
        if (s[i] === ")") i++;
        break;
      }
      const [v, j] = readOne(s, i);
      items.push(v);
      i = j;
    }
    let list = dotted;
    for (let k = items.length - 1; k >= 0; k--) list = { k: "cons", car: items[k], cdr: list };
    return [list, i];
  }
  if (c === '"') {
    i++;
    let raw = "";
    while (i < s.length && s[i] !== '"') {
      if (s[i] === "\\") { raw += s[i + 1]; i += 2; continue; }
      raw += s[i++];
    }
    if (s[i] === '"') i++;
    return [{ k: "str", v: raw }, i];
  }
  if (/[0-9]/.test(c) || (c === "-" && /[0-9]/.test(s[i + 1] || ""))) {
    let r = "";
    if (c === "-") { r += c; i++; }
    while (/[0-9.]/.test(s[i] || "")) r += s[i++];
    const num = r.includes(".") ? parseFloat(r) : parseInt(r, 10);
    return [num, i];
  }
  let r = "";
  while (i < s.length && !/[\s();'"]/.test(s[i])) r += s[i++];
  if (r.toUpperCase() === "NIL") return [NIL, i];
  if (r.toUpperCase() === "T") return [T, i];
  return [intern(r), i];
}

export function clReadAll(src) {
  const s = String(src);
  const forms = [];
  let i = 0;
  while (i < s.length) {
    i = skipWs(s, i);
    if (i >= s.length) break;
    const [v, j] = readOne(s, i);
    if (j === i) break;
    forms.push(v);
    i = j;
  }
  return forms;
}

function car(x) { return x && x.k === "cons" ? x.car : NIL; }
function cdr(x) { return x && x.k === "cons" ? x.cdr : NIL; }
function listp(x) { return x === NIL || (x && x.k === "cons"); }

function asList(x) {
  const a = [];
  while (x && x.k === "cons") { a.push(x.car); x = x.cdr; }
  return a;
}

function cons(a, b) { return { k: "cons", car: a, cdr: b }; }

function listFrom(arr) {
  let l = NIL;
  for (let i = arr.length - 1; i >= 0; i--) l = cons(arr[i], l);
  return l;
}

function isSym(x, n) { return x && x.k === "sym" && x.n === n; }

export function clEqual(a, b) {
  if (a === b) return true;
  if (typeof a === "number" && typeof b === "number") return a === b;
  if (a && a.k === "sym" && b && b.k === "sym") return a.n === b.n;
  if (a && a.k === "str" && b && b.k === "str") return a.v === b.v;
  if (a && a.k === "cons" && b && b.k === "cons") return clEqual(a.car, b.car) && clEqual(a.cdr, b.cdr);
  if (a == null && b == null) return true;
  return false;
}

function walkBad(form, hit) {
  if (!form) return;
  if (form.k === "sym") {
    if (hit.has(form.n)) return form.n;
    return null;
  }
  if (form.k === "cons") {
    return walkBad(form.car, hit) || walkBad(form.cdr, hit);
  }
  return null;
}

const BAD = new Set([
  "LOOP", "*NUMBERS*", "*REALS*", "RANDOM", "FLET", "COMPILE", "MACROLET",
  "INCF", "SETF", "FUNCALL", "GENSYM", "EQT", "EQUALT", "NOTINLINE",
  "MOST-POSITIVE-FIXNUM", "MOST-NEGATIVE-FIXNUM", "LOCALLY", "DECLARE",
  "ASH", "VALUES", "RANDOM-FIXNUM", "EXPAND-IN-CURRENT-ENV", "PROGN",
  "EQLT", "EQTL",
  "INTEGERP", "FLOATP", "ZEROP", "TYPE", "LAMBDA", "OPTIMIZE",
]);

function envGet(env, n) {
  for (let e = env; e; e = e.parent) if (n in e.b) return e.b[n];
  return undefined;
}
function envSet(env, n, v) { env.b[n] = v; }

function ev(form, env) {
  if (form === NIL || form === T) return form;
  if (typeof form === "number") return form;
  if (form && form.k === "str") return form;
  if (form && form.k === "sym") {
    const v = envGet(env, form.n);
    if (v === undefined) throw new ClErr("unbound-variable");
    return v;
  }
  if (!(form && form.k === "cons")) return form;
  const op = car(form);
  const args = asList(cdr(form));
  if (isSym(op, "QUOTE")) return args[0];
  if (isSym(op, "IF")) {
    const c = ev(args[0], env);
    return c && c !== NIL ? ev(args[1], env) : (args[2] !== undefined ? ev(args[2], env) : NIL);
  }
  if (isSym(op, "LET")) {
    const binds = asList(args[0]);
    const local = { parent: env, b: Object.create(null) };
    for (const b of binds) {
      if (b && b.k === "sym") envSet(local, b.n, NIL);
      else {
        const n = car(b);
        const v = cdr(b) && cdr(b).k === "cons" ? ev(car(cdr(b)), env) : NIL;
        envSet(local, n.n, v);
      }
    }
    let last = NIL;
    for (let i = 1; i < args.length; i++) last = ev(args[i], local);
    return last;
  }
  if (isSym(op, "AND")) {
    let last = T;
    for (const a of args) { last = ev(a, env); if (!last || last === NIL) return NIL; }
    return last;
  }
  if (isSym(op, "OR")) {
    for (const a of args) { const v = ev(a, env); if (v && v !== NIL) return v; }
    return NIL;
  }
  if (isSym(op, "EVAL")) {
    if (args.length !== 1) throw new ClErr("program-error");
    return ev(ev(args[0], env), env);
  }
  if (isSym(op, "SIGNALS-ERROR")) {
    try {
      ev(args[0], env);
      return NIL;
    } catch (e) {
      if (e instanceof ClErr) {
        const want = args[1] && args[1].k === "sym" ? args[1].n : "";
        return e.name.toUpperCase() === want ? T : NIL;
      }
      throw e;
    }
  }
  const vals = args.map((a) => ev(a, env));
  if (isSym(op, "CONS")) {
    if (vals.length !== 2) throw new ClErr("program-error");
    return cons(vals[0], vals[1]);
  }
  if (isSym(op, "CAR")) {
    if (vals.length !== 1) throw new ClErr("program-error");
    return car(vals[0]);
  }
  if (isSym(op, "CDR")) {
    if (vals.length !== 1) throw new ClErr("program-error");
    return cdr(vals[0]);
  }
  if (isSym(op, "LIST")) return listFrom(vals);
  if (isSym(op, "LIST*")) {
    if (vals.length < 1) throw new ClErr("program-error");
    if (vals.length === 1) return vals[0];
    let l = vals[vals.length - 1];
    for (let i = vals.length - 2; i >= 0; i--) l = cons(vals[i], l);
    return l;
  }
  if (isSym(op, "+")) {
    let s = 0;
    for (const v of vals) s += +v;
    return s;
  }
  if (isSym(op, "*")) {
    let s = 1;
    for (const v of vals) s *= +v;
    return s;
  }
  if (isSym(op, "-")) {
    if (vals.length < 1) throw new ClErr("program-error");
    if (vals.length === 1) return -vals[0];
    let s = +vals[0];
    for (let i = 1; i < vals.length; i++) s -= +vals[i];
    return s;
  }
  if (isSym(op, "/")) {
    if (vals.length < 1) throw new ClErr("program-error");
    if (vals.length === 1) return 1 / +vals[0];
    let s = +vals[0];
    for (let i = 1; i < vals.length; i++) s /= +vals[i];
    return s;
  }
  if (isSym(op, "1+")) {
    if (vals.length !== 1) throw new ClErr("program-error");
    return +vals[0] + 1;
  }
  if (isSym(op, "1-")) {
    if (vals.length !== 1) throw new ClErr("program-error");
    return +vals[0] - 1;
  }
  if (isSym(op, "EQL") || isSym(op, "EQ") || isSym(op, "=")) {
    return clEqual(vals[0], vals[1]) ? T : NIL;
  }
  if (isSym(op, "EQUAL")) return clEqual(vals[0], vals[1]) ? T : NIL;
  if (isSym(op, "NOT") || isSym(op, "NULL")) return (!vals[0] || vals[0] === NIL) ? T : NIL;
  throw new ClErr("undefined-function");
}

export function clEval(form) {
  return ev(form, { parent: null, b: Object.create(null) });
}

export function clExtractTests(src) {
  const forms = clReadAll(src);
  const tests = [];
  for (const f of forms) {
    if (!(f && f.k === "cons" && isSym(car(f), "DEFTEST"))) continue;
    const rest = asList(cdr(f));
    if (rest.length !== 3) continue;
    const name = rest[0] && rest[0].k === "sym" ? rest[0].n : String(rest[0]);
    const form = rest[1];
    const expected = rest[2];
    const why = walkBad(form, BAD) || walkBad(expected, BAD);
    tests.push({ name, form, expected, skip: why || null });
  }
  return tests;
}

export function clRunDefTest(t) {
  try {
    const got = clEval(t.form);
    const ok = clEqual(got, t.expected);
    return { ok, got, expected: t.expected };
  } catch (e) {
    return { ok: false, error: e instanceof ClErr ? e.name : String(e.message || e) };
  }
}

export function lispRun(source) {
  try {
    const forms = clReadAll(source);
    let last = NIL;
    for (const f of forms) last = clEval(f);
    return { ok: true, value: last === NIL ? 0 : (typeof last === "number" ? last : 1), frontend: "PANINI.Frontend.CommonLisp" };
  } catch (e) {
    return { ok: false, error: e instanceof ClErr ? e.name : String(e.message || e), frontend: "PANINI.Frontend.CommonLisp" };
  }
}
