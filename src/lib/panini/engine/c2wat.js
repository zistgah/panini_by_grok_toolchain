// @ts-nocheck
/* Copyright (C) 1993-2026 Abhishek Choudhary | GPL-3.0-or-later
 * C extract AST → WAT (linear ops the in-tree assembler accepts).
 * Integer functions, if/while/for, recursion. Pointers/structs/++ are GAP.
 */
import { parseC } from "./cparse.js";
import { wat2wasm, wasmRun } from "./wat2wasm.js";

function flatten(nodes, out = []) {
  for (const n of nodes || []) {
    if (!n) continue;
    if (n.op === "block") flatten(n.body, out);
    else out.push(n);
  }
  return out;
}

function defsOf(ast) {
  return flatten(ast.body).filter((n) => n && n.op === "def");
}

function localsOf(body, params) {
  const set = new Set();
  function walk(n) {
    if (!n) return;
    if (n.op === "decl" && n.name) set.add(n.name);
    if (n.op === "block") (n.body || []).forEach(walk);
    if (n.then) walk(n.then);
    if (n.else) walk(n.else);
    if (n.body && Array.isArray(n.body)) n.body.forEach(walk);
    else if (n.body) walk(n.body);
    if (n.op === "for") {
      walk(n.init);
      walk(n.inc);
    }
  }
  (Array.isArray(body) ? body : [body]).forEach(walk);
  for (const p of params || []) set.delete(p);
  return [...set];
}

const BIN = {
  "+": "i32.add",
  "-": "i32.sub",
  "*": "i32.mul",
  "/": "i32.div_s",
  "%": "i32.rem_s",
  "==": "i32.eq",
  "!=": "i32.ne",
  "<": "i32.lt_s",
  ">": "i32.gt_s",
  "<=": "i32.le_s",
  ">=": "i32.ge_s",
  "&": "i32.and",
  "|": "i32.or",
  "^": "i32.xor",
  "<<": "i32.shl",
  ">>": "i32.shr_s",
};

function unsupported(n) {
  const op = n && n.op;
  if (["deref", "addr", "dot", "arrow", "index", "init"].includes(op)) {
    throw new Error("WASM extract: no " + op + " (integer functions only)");
  }
}

/** Instructions that leave one i32 on the stack. */
function emitExpr(e) {
  if (!e) return "(i32.const 0)";
  unsupported(e);
  switch (e.op) {
    case "const":
      return `(i32.const ${e.value | 0})`;
    case "load":
      return `(local.get $${e.name})`;
    case "neg":
      return `(i32.const 0)\n    ${emitExpr(e.e)}\n    (i32.sub)`;
    case "not":
      return `${emitExpr(e.e)}\n    (i32.eqz)`;
    case "bnot":
      return `${emitExpr(e.e)}\n    (i32.const -1)\n    (i32.xor)`;
    case "bin": {
      const op = BIN[e.operator];
      if (!op) throw new Error("WASM extract: operator " + e.operator);
      return `${emitExpr(e.left)}\n    ${emitExpr(e.right)}\n    (${op})`;
    }
    case "and":
      return `${emitExpr(e.left)}\n    ${emitExpr(e.right)}\n    (i32.and)`;
    case "or":
      return `${emitExpr(e.left)}\n    ${emitExpr(e.right)}\n    (i32.or)`;
    case "tern":
      return `${emitExpr(e.c)}\n    (if (result i32) (then ${emitExpr(e.t)}) (else ${emitExpr(e.f)}))`;
    case "call": {
      const name = e.name || e.callee?.name;
      if (!name) throw new Error("WASM extract: anonymous call");
      if (name === "printf" || name === "puts" || name === "putchar") {
        const args = (e.args || []).map(emitExpr);
        return (args.length ? args.join("\n    ") + "\n    (drop)\n    " : "") + "(i32.const 0)";
      }
      const args = (e.args || []).map(emitExpr).join("\n    ");
      return `${args}${args ? "\n    " : ""}(call $${name})`;
    }
    case "assign":
      return emitAssign(e, true);
    case "cast":
      return emitExpr(e.e);
    case "preinc":
    case "postinc":
    case "predec":
    case "postdec":
      throw new Error("WASM extract: ++/-- is GAP (use n = n + 1)");
    default:
      throw new Error("WASM extract: expr " + (e.op || "?"));
  }
}

function emitAssign(s, asExpr) {
  const t = s.target;
  if (!t || t.op !== "load") throw new Error("WASM extract: assignment needs a local");
  let val = emitExpr(s.value);
  if (s.operator && s.operator !== "=") {
    const op = BIN[s.operator[0]];
    if (!op) throw new Error("WASM extract: operator " + s.operator);
    val = `(local.get $${t.name})\n    ${emitExpr(s.value)}\n    (${op})`;
  }
  const set = asExpr ? `(local.tee $${t.name})` : `(local.set $${t.name})`;
  return `${val}\n    ${set}`;
}

function emitStmt(s) {
  if (!s || s.op === "nop") return "";
  unsupported(s);
  switch (s.op) {
    case "return":
      return `${emitExpr(s.arg)}\n    (return)`;
    case "expr":
      if (s.value && s.value.op === "assign") return emitAssign(s.value, false);
      return `${emitExpr(s.value)}\n    (drop)`;
    case "assign":
      return emitAssign(s, false);
    case "decl":
      if (s.init && s.init.op !== "none") return `${emitExpr(s.init)}\n    (local.set $${s.name})`;
      return "";
    case "block":
      return (s.body || []).map(emitStmt).filter(Boolean).join("\n    ");
    case "if": {
      const th = emitStmt(s.then) || "nop";
      const el = s.else && s.else.op !== "nop" ? emitStmt(s.else) : "";
      return `${emitExpr(s.cond)}\n    (if${el ? "" : ""} (then ${th})${el ? " (else " + el + ")" : ""})`;
    }
    case "while":
      return `(block $br
      (loop $lp
        ${emitExpr(s.cond)}
        (i32.eqz)
        (br_if $br)
        ${emitStmt(s.body)}
        (br $lp)))`;
    case "do":
      return `(block $br
      (loop $lp
        ${emitStmt(s.body)}
        ${emitExpr(s.cond)}
        (br_if $lp)))`;
    case "for":
      return `${emitStmt(s.init)}
    (block $br
      (loop $lp
        ${emitExpr(s.cond)}
        (i32.eqz)
        (br_if $br)
        ${emitStmt(s.body)}
        ${emitStmt(s.inc)}
        (br $lp)))`;
    case "break":
      return "(br $br)";
    case "continue":
      return "(br $lp)";
    case "def":
      return "";
    default:
      throw new Error("WASM extract: stmt " + s.op);
  }
}

function emitFunc(fn) {
  const params = fn.params || [];
  const body = Array.isArray(fn.body) ? fn.body : [fn.body];
  const locals = localsOf(body, params);
  const paramWat = params.map((p) => `(param $${p} i32)`).join(" ");
  const localWat = locals.map((n) => `(local $${n} i32)`).join(" ");
  const inner = body.map(emitStmt).filter(Boolean).join("\n    ");
  return `  (func $${fn.name} (export "${fn.name}") ${paramWat} (result i32) ${localWat}
    ${inner}
    (i32.const 0))`;
}

export function cToWat(source) {
  const ast = typeof source === "object" && source && source.op === "program" ? source : parseC(source);
  const defs = defsOf(ast);
  if (!defs.length) throw new Error("WASM extract: no functions");
  const funcs = defs.map(emitFunc).join("\n");
  return `(module
${funcs}
)
`;
}

export function cToWasm(source) {
  const wat = cToWat(source);
  const bytes = wat2wasm(wat);
  return { wat, bytes };
}

export async function runCWasm(source, name = "main", args = []) {
  const { wat, bytes } = cToWasm(source);
  const value = await wasmRun(bytes, name, args);
  return { wat, bytes, value: value | 0 };
}
