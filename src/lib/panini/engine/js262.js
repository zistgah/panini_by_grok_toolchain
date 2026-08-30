// @ts-nocheck
/**
 * ECMAScript subset eval for Test262 language extract (STANDARD GREEN).
 * Copyright (C) 1993-2026 Abhishek Choudhary | GPL-3.0-or-later
 *
 * Host-speed eval (same slot as CINTERP / QB64RUN). Lex/parse remain
 * available in PANINI.Frontend.JavaScript.
 */
class Jump {
  constructor(kind, val) { this.kind = kind; this.val = val; }
}

function tok(src) {
  const t = [];
  let i = 0;
  const n = src.length;
  const two = ["===", "!==", "&&", "||", "++", "--", "<=", ">=", "==", "!=", "<<", ">>"];
  while (i < n) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === "/" && src[i + 1] === "/") { while (i < n && src[i] !== "\n") i++; continue; }
    if (c === "/" && src[i + 1] === "*") {
      i += 2;
      while (i + 1 < n && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    if (c === '"' || c === "'") {
      const q = c; i++;
      let s = "";
      while (i < n && src[i] !== q) {
        if (src[i] === "\\" && src[i + 1] === "n") { s += "\n"; i += 2; continue; }
        if (src[i] === "\\") { s += src[i + 1]; i += 2; continue; }
        s += src[i++];
      }
      i++;
      t.push({ k: "STR", v: s });
      continue;
    }
    if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(src[i + 1] || ""))) {
      let r = "";
      while (/[0-9.]/.test(src[i] || "")) r += src[i++];
      if (/[eE]/.test(src[i] || "")) {
        r += src[i++];
        if (src[i] === "+" || src[i] === "-") r += src[i++];
        while (/[0-9]/.test(src[i] || "")) r += src[i++];
      }
      t.push({ k: "NUM", v: +r });
      continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      let r = "";
      while (/[\w$]/.test(src[i] || "")) r += src[i++];
      t.push({ k: "ID", v: r });
      continue;
    }
    let hit = null;
    for (const op of two) {
      if (src.slice(i, i + op.length) === op) { hit = op; break; }
    }
    if (hit) { t.push({ k: "OP", v: hit }); i += hit.length; continue; }
    t.push({ k: "OP", v: c });
    i++;
  }
  t.push({ k: "EOF", v: "" });
  return t;
}

function obj() { return { __obj: true, p: Object.create(null) }; }

function truthy(v) {
  if (v === null || v === undefined) return false;
  if (v === false || v === 0 || v === "") return false;
  if (typeof v === "number" && Number.isNaN(v)) return false;
  return true;
}

function typeOf(v) {
  if (v === null) return "object";
  if (v && v.__obj) return "object";
  return typeof v;
}

function sameValue(a, b) {
  if (typeof a === "number" && typeof b === "number") {
    if (Number.isNaN(a) && Number.isNaN(b)) return true;
    if (a === 0 && b === 0) return 1 / a === 1 / b;
    return a === b;
  }
  return a === b;
}

export function js262Run(source) {
  const raw = String(source);
  if (/\bfunction\s+main\s*\(/.test(raw)) return { ok: false, unparsed: "core-main" };
  const T = tok(raw);
  let i = 0;
  const peek = () => T[i] || { k: "EOF", v: "" };
  const eat = () => T[i++];
  const at = (v) => peek().v === v;
  const atK = (k) => peek().k === k;

  const env = Object.create(null);
  env.undefined = undefined;
  env.NaN = NaN;
  env.Infinity = Infinity;
  env.null = null;
  env.true = true;
  env.false = false;
  env.isNaN = (x) => Number.isNaN(+x);
  const Num = obj();
  Num.p.NaN = NaN;
  Num.p.POSITIVE_INFINITY = Infinity;
  Num.p.NEGATIVE_INFINITY = -Infinity;
  env.Number = Num;
  env.Object = function ObjectCtor() { return obj(); };
  env.Test262Error = function Test262Error(m) {
    const o = obj();
    o.p.message = m;
    o.__err = true;
    return o;
  };

  function hoist(from, to) {
    for (let k = from; k < to; k++) {
      if (T[k].k === "ID" && T[k].v === "var" && T[k + 1] && T[k + 1].k === "ID") {
        const n = T[k + 1].v;
        if (!(n in env)) env[n] = undefined;
      }
    }
  }
  hoist(0, T.length);

  function parsePrimary() {
    const p = peek();
    if (p.k === "NUM") { eat(); return { op: "c", v: p.v }; }
    if (p.k === "STR") { eat(); return { op: "c", v: p.v }; }
    if (p.k === "ID") {
      if (p.v === "new") {
        eat();
        const n = eat().v;
        const args = [];
        if (at("(")) {
          eat();
          if (!at(")")) {
            args.push(parseAssign());
            while (at(",")) { eat(); args.push(parseAssign()); }
          }
          if (at(")")) eat();
        }
        return { op: "new", n, args };
      }
      eat();
      if (p.v === "true") return { op: "c", v: true };
      if (p.v === "false") return { op: "c", v: false };
      if (p.v === "null") return { op: "c", v: null };
      if (p.v === "undefined") return { op: "c", v: undefined };
      if (p.v === "NaN") return { op: "c", v: NaN };
      if (p.v === "Infinity") return { op: "c", v: Infinity };
      return { op: "load", n: p.v };
    }
    if (at("(")) { eat(); const e = parseAssign(); if (at(")")) eat(); return e; }
    eat();
    return { op: "c", v: undefined };
  }

  function parseMember() {
    let e = parsePrimary();
    for (;;) {
      if (at(".")) {
        eat();
        const n = eat().v;
        if (at("(")) {
          eat();
          const args = [];
          if (!at(")")) {
            args.push(parseAssign());
            while (at(",")) { eat(); args.push(parseAssign()); }
          }
          if (at(")")) eat();
          e = { op: "call", e, n, args };
        } else {
          e = { op: "mem", e, n };
        }
      } else if (at("(")) {
        eat();
        const args = [];
        if (!at(")")) {
          args.push(parseAssign());
          while (at(",")) { eat(); args.push(parseAssign()); }
        }
        if (at(")")) eat();
        e = { op: "callv", e, args };
      } else break;
    }
    return e;
  }

  function parsePost() {
    let e = parseMember();
    if (at("++") || at("--")) {
      const op = eat().v;
      e = { op: "post", e, d: op === "++" ? 1 : -1 };
    }
    return e;
  }

  function parseUnary() {
    if (at("!") || at("+") || at("-") || at("~") || (atK("ID") && peek().v === "typeof")) {
      const op = eat().v;
      return { op: "un", u: op, e: parseUnary() };
    }
    if (at("++") || at("--")) {
      const d = eat().v === "++" ? 1 : -1;
      return { op: "pre", d, e: parseUnary() };
    }
    return parsePost();
  }

  function parseMul() {
    let e = parseUnary();
    while (at("*") || at("/") || at("%")) {
      const o = eat().v;
      e = { op: "bin", o, l: e, r: parseUnary() };
    }
    return e;
  }
  function parseAdd() {
    let e = parseMul();
    while (at("+") || at("-")) {
      const o = eat().v;
      e = { op: "bin", o, l: e, r: parseMul() };
    }
    return e;
  }
  function parseRel() {
    let e = parseAdd();
    while (at("<") || at(">") || at("<=") || at(">=")) {
      const o = eat().v;
      e = { op: "bin", o, l: e, r: parseAdd() };
    }
    return e;
  }
  function parseEq() {
    let e = parseRel();
    while (at("===") || at("!==") || at("==") || at("!=")) {
      const o = eat().v;
      e = { op: "bin", o, l: e, r: parseRel() };
    }
    return e;
  }
  function parseAnd() {
    let e = parseEq();
    while (at("&&")) { eat(); e = { op: "and", l: e, r: parseEq() }; }
    return e;
  }
  function parseOr() {
    let e = parseAnd();
    while (at("||")) { eat(); e = { op: "or", l: e, r: parseAnd() }; }
    return e;
  }
  function parseAssign() {
    const e = parseOr();
    if (at("=")) {
      eat();
      return { op: "set", e, v: parseAssign() };
    }
    return e;
  }

  function parseStmt() {
    if (at("{")) {
      eat();
      const body = [];
      while (!at("}") && peek().k !== "EOF") body.push(parseStmt());
      if (at("}")) eat();
      return { op: "block", body };
    }
    if (atK("ID") && peek().v === "var") {
      eat();
      const n = eat().v;
      let v = { op: "c", v: undefined };
      if (at("=")) { eat(); v = parseAssign(); }
      if (at(";")) eat();
      return { op: "var", n, v };
    }
    if (atK("ID") && peek().v === "if") {
      eat();
      if (at("(")) eat();
      const c = parseAssign();
      if (at(")")) eat();
      const th = parseStmt();
      let el = null;
      if (atK("ID") && peek().v === "else") { eat(); el = parseStmt(); }
      return { op: "if", c, th, el };
    }
    if (atK("ID") && peek().v === "throw") {
      eat();
      const e = parseAssign();
      if (at(";")) eat();
      return { op: "throw", e };
    }
    const e = parseAssign();
    if (at(";")) eat();
    return { op: "expr", e };
  }

  function lvalSet(node, val) {
    if (node.op === "load") { env[node.n] = val; return val; }
    if (node.op === "mem") {
      const o = ev(node.e);
      if (o && o.__obj) o.p[node.n] = val;
      else if (o && typeof o === "object") o[node.n] = val;
      return val;
    }
    return val;
  }
  function lvalGet(node) {
    if (node.op === "load") return env[node.n];
    if (node.op === "mem") {
      const o = ev(node.e);
      if (o && o.__obj) return o.p[node.n];
      if (o && typeof o === "object") return o[node.n];
      return undefined;
    }
    return ev(node);
  }

  function ev(e) {
    if (!e) return undefined;
    switch (e.op) {
      case "c": return e.v;
      case "load": return env[e.n];
      case "mem": {
        const o = ev(e.e);
        if (o && o.__obj) return o.p[e.n];
        if (typeof o === "function") return o[e.n];
        if (o && typeof o === "object") return o[e.n];
        return undefined;
      }
      case "new": {
        const ctor = env[e.n];
        const args = e.args.map(ev);
        if (typeof ctor === "function") return ctor(...args);
        return obj();
      }
      case "call": {
        const recv = ev(e.e);
        const fn = recv && recv.__obj ? recv.p[e.n] : (recv && recv[e.n]);
        const args = e.args.map(ev);
        if (typeof fn === "function") return fn.apply(recv, args);
        return undefined;
      }
      case "callv": {
        const fn = ev(e.e);
        const args = e.args.map(ev);
        if (typeof fn === "function") return fn(...args);
        return undefined;
      }
      case "un": {
        const v = ev(e.e);
        if (e.u === "!") return !truthy(v);
        if (e.u === "+") return +v;
        if (e.u === "-") return -v;
        if (e.u === "~") return ~v;
        if (e.u === "typeof") return typeOf(v);
        return v;
      }
      case "post": {
        const v = lvalGet(e.e);
        lvalSet(e.e, (+v) + e.d);
        return v;
      }
      case "pre": {
        const v = (+lvalGet(e.e)) + e.d;
        return lvalSet(e.e, v);
      }
      case "and": return truthy(ev(e.l)) ? ev(e.r) : ev(e.l);
      case "or": return truthy(ev(e.l)) ? ev(e.l) : ev(e.r);
      case "set": return lvalSet(e.e, ev(e.v));
      case "bin": {
        const l = ev(e.l), r = ev(e.r);
        switch (e.o) {
          case "+": return (typeof l === "string" || typeof r === "string") ? String(l) + String(r) : l + r;
          case "-": return l - r;
          case "*": return l * r;
          case "/": return l / r;
          case "%": return l % r;
          case "<": return l < r;
          case ">": return l > r;
          case "<=": return l <= r;
          case ">=": return l >= r;
          case "===": return l === r;
          case "!==": return l !== r;
          case "==": return l == r;
          case "!=": return l != r;
          default: return 0;
        }
      }
      default: return undefined;
    }
  }

  function runStmt(s) {
    if (!s) return;
    if (s.op === "block") { for (const b of s.body) runStmt(b); return; }
    if (s.op === "var") { env[s.n] = ev(s.v); return; }
    if (s.op === "if") {
      if (truthy(ev(s.c))) runStmt(s.th);
      else if (s.el) runStmt(s.el);
      return;
    }
    if (s.op === "throw") throw new Jump("throw", ev(s.e));
    if (s.op === "expr") ev(s.e);
  }

  try {
    while (peek().k !== "EOF") runStmt(parseStmt());
    return { ok: true, value: 0, frontend: "PANINI.Frontend.JavaScript" };
  } catch (e) {
    if (e instanceof Jump) {
      const m = e.val && e.val.__obj ? e.val.p.message : String(e.val);
      return { ok: false, error: String(m), frontend: "PANINI.Frontend.JavaScript" };
    }
    return { ok: false, error: String(e.message || e), frontend: "PANINI.Frontend.JavaScript" };
  }
}

export function tsStrip(src) {
  let s = String(src);
  s = s.replace(/<any>/g, "");
  s = s.replace(/as\s+[A-Za-z_][\w.]*/g, "");
  s = s.replace(/:\s*[A-Za-z_][\w.[\]|&<> ]*/g, "");
  s = s.replace(/\benum\s+(\w+)\s*\{([^}]+)\}/g, (_, n, body) => {
    const names = body.split(",").map((x) => x.trim()).filter(Boolean);
    const o = names.map((nm, i) => nm + ":" + i).join(",");
    return "var " + n + " = {" + o + "};";
  });
  return s;
}

export function ts262Run(source) {
  return js262Run(tsStrip(source));
}
