// @ts-nocheck
/**
 * QB64 integer/CONST expression semantics (Phoenix-Edition tests).
 * TRUE is -1. AND/OR/NOT/XOR/EQV/IMP are bitwise 32-bit.
 * Copyright (C) 1993-2026 Abhishek Choudhary | GPL-3.0-or-later
 */
function i32(n) { return n | 0; }

export function qb64Eval(expr, env = {}) {
  const s = String(expr).trim();
  let i = 0;
  function peek() { return s[i] || ""; }
  function skip() { while (/\s/.test(peek())) i++; }
  function ident() {
    skip();
    const m = s.slice(i).match(/^[A-Za-z_][\w.]*/);
    if (!m) return null;
    i += m[0].length;
    return m[0];
  }
  function eatSuffix() {
    skip();
    const m = s.slice(i).match(/^~?[%&]+/);
    if (m) i += m[0].length;
    if (peek() === "!") i++;
  }
  function num() {
    skip();
    if (s[i] === "&" && (s[i + 1] === "H" || s[i + 1] === "h")) {
      i += 2;
      const m = s.slice(i).match(/^[0-9A-Fa-f]+/);
      i += m[0].length;
      eatSuffix();
      return parseInt(m[0], 16) | 0;
    }
    const m = s.slice(i).match(/^(\d+\.\d+|\.\d+|\d+)/);
    if (!m) return null;
    i += m[0].length;
    eatSuffix();
    return m[0].includes(".") ? parseFloat(m[0]) : (parseInt(m[0], 10) | 0);
  }
  function primary() {
    skip();
    if (peek() === "(") { i++; const v = parseImp(); skip(); if (peek() === ")") i++; return v; }
    if (peek() === '"') {
      i++;
      let t = "";
      while (i < s.length && s[i] !== '"') t += s[i++];
      if (s[i] === '"') i++;
      return t;
    }
    const n = num();
    if (n != null) return n;
    const id = ident();
    if (id != null) {
      if (/^(NOT|AND|OR|XOR|EQV|IMP|MOD)$/i.test(id)) {
        i -= id.length;
        return 0;
      }
      if (Object.prototype.hasOwnProperty.call(env, id)) return env[id];
      return 0;
    }
    return 0;
  }
  function pow() {
    let left = primary();
    skip();
    if (peek() === "^") { i++; left = Math.pow(Number(left), Number(unary())); }
    return left;
  }
  function unary() {
    skip();
    if (peek() === "-") { i++; return 0 - unary(); }
    if (peek() === "+") { i++; return unary(); }
    return pow();
  }
  function mul() {
    let left = unary();
    for (;;) {
      skip();
      if (peek() === "*") { i++; left = left * pow(); }
      else if (peek() === "/") { i++; left = left / pow(); }
      else if (peek() === "\\") { i++; left = i32(left / pow()); }
      else if (/^MOD\b/i.test(s.slice(i))) { i += 3; left = i32(left) % i32(pow()); }
      else break;
    }
    return left;
  }
  function add() {
    let left = mul();
    for (;;) {
      skip();
      if (peek() === "+" && s[i + 1] !== "=") {
        if (typeof left === "string") { i++; left = String(left) + String(mul()); }
        else { i++; left = left + mul(); }
      } else if (peek() === "-" && s[i + 1] !== "=") { i++; left = left - mul(); }
      else break;
    }
    return left;
  }
  function cmp() {
    let left = add();
    skip();
    const ops = [["<>", 2], ["><", 2], ["<=", 2], ["=<", 2], [">=", 2], ["=>", 2], ["=", 1], [">", 1], ["<", 1]];
    for (const [op, n] of ops) {
      if (s.slice(i, i + n) === op) {
        i += n;
        const r = add();
        let t = false;
        if (op === "=") t = left === r;
        else if (op === "<>" || op === "><") t = left !== r;
        else if (op === "<=" || op === "=<") t = left <= r;
        else if (op === ">=" || op === "=>") t = left >= r;
        else if (op === ">") t = left > r;
        else if (op === "<") t = left < r;
        return t ? -1 : 0;
      }
    }
    return left;
  }
  function parseNot() {
    skip();
    if (/^NOT\b/i.test(s.slice(i))) { i += 3; return i32(~parseNot()); }
    return cmp();
  }
  function parseAnd() {
    let left = parseNot();
    while (/\s/.test(peek())) skip();
    while (/^AND\b/i.test(s.slice(i))) { i += 3; left = i32(left) & i32(cmp()); skip(); }
    return left;
  }
  function parseXor() {
    let left = parseAnd();
    skip();
    while (/^XOR\b/i.test(s.slice(i))) { i += 3; left = i32(left) ^ i32(parseAnd()); skip(); }
    return left;
  }
  function parseOr() {
    let left = parseXor();
    skip();
    while (/^OR\b/i.test(s.slice(i))) { i += 2; left = i32(left) | i32(parseXor()); skip(); }
    return left;
  }
  function parseEqv() {
    let left = parseOr();
    skip();
    while (/^EQV\b/i.test(s.slice(i))) { i += 3; left = i32(~(i32(left) ^ i32(parseOr()))); skip(); }
    return left;
  }
  function parseImp() {
    let left = parseEqv();
    skip();
    while (/^IMP\b/i.test(s.slice(i))) { i += 3; left = i32((~i32(left)) | i32(parseEqv())); skip(); }
    return left;
  }
  return parseImp();
}

export function qb64Run(source) {
  const env = Object.create(null);
  const out = [];
  const lines = String(source).replace(/\r\n/g, "\n").split("\n");
  for (const raw of lines) {
    const line = raw.replace(/'.*$/, "").trim();
    if (!line || line.startsWith("$") || /^OPTION\b/i.test(line) || /^_DEFINE\b/i.test(line)) continue;
    if (/^SYSTEM\b/i.test(line)) break;
    let m = line.match(/^CONST\s+(\w+)\s*=\s*(.+)$/i);
    if (m) { env[m[1]] = qb64Eval(m[2], env); continue; }
    m = line.match(/^PRINT\s+(.+)$/i);
    if (m) {
      const v = qb64Eval(m[1], env);
      out.push(v);
    }
  }
  return { ok: true, prints: out, env, frontend: "PANINI.Frontend.BASIC/QB64" };
}
