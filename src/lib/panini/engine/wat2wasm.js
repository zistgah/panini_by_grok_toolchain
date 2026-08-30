// @ts-nocheck
/**
 * In-tree WAT subset → WASM binary. No wabt.
 * Copyright (C) 1993-2026 Abhishek Choudhary | GPL-3.0-or-later
 *
 * Covers the subset the PANINI backend emits: module, memory, global,
 * func (named params/locals, export), i32 ops, load/store, block/loop/if,
 * br/br_if, call, return.
 */
function uleb(n) {
  const out = [];
  n = Number(n) >>> 0;
  do {
    let b = n & 0x7f;
    n >>>= 7;
    if (n) b |= 0x80;
    out.push(b);
  } while (n);
  return out;
}
function sleb(n) {
  const out = [];
  n = Number(n) | 0;
  while (true) {
    let b = n & 0x7f;
    n >>= 7;
    const sign = (b & 0x40) !== 0;
    if ((n === 0 && !sign) || (n === -1 && sign)) {
      out.push(b);
      break;
    }
    out.push(b | 0x80);
  }
  return out;
}
function vec(bytes) {
  return [...uleb(bytes.length), ...bytes];
}
function section(id, body) {
  return [id, ...uleb(body.length), ...body];
}

function tokenize(src) {
  const t = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === " " || c === "\t" || c === "\n" || c === "\r") { i++; continue; }
    if (c === ";" && src[i + 1] === ";") { while (i < n && src[i] !== "\n") i++; continue; }
    if (c === "(" || c === ")") { t.push(c); i++; continue; }
    if (c === '"') {
      i++;
      let s = "";
      while (i < n && src[i] !== '"') {
        if (src[i] === "\\" && src[i + 1] === "n") { s += "\n"; i += 2; continue; }
        s += src[i++];
      }
      i++;
      t.push({ k: "str", v: s });
      continue;
    }
    let r = "";
    while (i < n && !/[\s()]/.test(src[i])) r += src[i++];
    if (r) t.push(r);
  }
  return t;
}

function parseS(src) {
  const t = tokenize(src);
  let i = 0;
  function one() {
    const x = t[i++];
    if (x === "(") {
      const list = [];
      while (i < t.length && t[i] !== ")") list.push(one());
      if (t[i] === ")") i++;
      return list;
    }
    return x;
  }
  const top = [];
  while (i < t.length) top.push(one());
  return top.length === 1 ? top[0] : top;
}

function atom(x) {
  if (x == null) return "";
  if (typeof x === "string") return x;
  if (x.k === "str") return x.v;
  return String(x);
}
function isStr(x) { return x && typeof x === "object" && x.k === "str"; }

const OP = {
  "i32.add": 0x6a, "i32.sub": 0x6b, "i32.mul": 0x6c, "i32.div_s": 0x6d, "i32.div_u": 0x6e,
  "i32.rem_s": 0x6f, "i32.eq": 0x46, "i32.ne": 0x47, "i32.lt_s": 0x48, "i32.lt_u": 0x49,
  "i32.gt_s": 0x4a, "i32.gt_u": 0x4b, "i32.le_s": 0x4c, "i32.le_u": 0x4d,
  "i32.ge_s": 0x4e, "i32.ge_u": 0x4f, "i32.eqz": 0x45,
  "i32.and": 0x71, "i32.or": 0x72, "i32.xor": 0x73, "i32.shl": 0x74, "i32.shr_s": 0x75, "i32.shr_u": 0x76,
  "i32.clz": 0x67, "i32.ctz": 0x68, "i32.popcnt": 0x69,
  "i32.wrap_i64": 0xa7, "i32.trunc_f32_s": 0xa8, "i32.trunc_f64_s": 0xaa,
  "f32.add": 0x92, "f32.sub": 0x93, "f32.mul": 0x94, "f32.div": 0x95,
  "f64.add": 0xa0, "f64.sub": 0xa1, "f64.mul": 0xa2, "f64.div": 0xa3,
  return: 0x0f, drop: 0x1a, nop: 0x01, unreachable: 0x00, end: 0x0b, else: 0x05,
};

function typeCode(t) {
  if (t === "i32") return 0x7f;
  if (t === "i64") return 0x7e;
  if (t === "f32") return 0x7d;
  if (t === "f64") return 0x7c;
  return 0x7f;
}

function encodeInstr(node, ctx, labels) {
  if (node == null) return [];
  if (!Array.isArray(node)) {
    const a = atom(node);
    if (OP[a] != null) return [OP[a]];
    if (a === "end") return [0x0b];
    return [];
  }
  const op = atom(node[0]);
  const rest = node.slice(1);
  if (op === "i32.const") return [0x41, ...sleb(Number(atom(rest[0])) || 0)];
  if (op === "i64.const") return [0x42, ...sleb(Number(atom(rest[0])) || 0)];
  if (op === "f32.const") {
    const buf = new ArrayBuffer(4);
    new DataView(buf).setFloat32(0, Number(atom(rest[0])) || 0, true);
    return [0x43, ...new Uint8Array(buf)];
  }
  if (op === "local.get") return [0x20, ...uleb(ctx.localIndex(atom(rest[0])))];
  if (op === "local.set") return [0x21, ...uleb(ctx.localIndex(atom(rest[0])))];
  if (op === "local.tee") return [0x22, ...uleb(ctx.localIndex(atom(rest[0])))];
  if (op === "global.get") return [0x23, ...uleb(ctx.globalIndex(atom(rest[0])))];
  if (op === "global.set") return [0x24, ...uleb(ctx.globalIndex(atom(rest[0])))];
  if (op === "i32.load") return [0x28, 2, 0];
  if (op === "i32.store") return [0x36, 2, 0];
  if (op === "i32.load8_u") return [0x2d, 0, 0];
  if (op === "i32.store8") return [0x3a, 0, 0];
  if (op === "call") return [0x10, ...uleb(ctx.funcIndex(atom(rest[0])))];
  if (op === "br") return [0x0c, ...uleb(ctx.labelIndex(atom(rest[0]), labels))];
  if (op === "br_if") return [0x0d, ...uleb(ctx.labelIndex(atom(rest[0]), labels))];
  if (op === "br_table") {
    const labs = rest.map(atom).filter(Boolean);
    const def = labs.length ? labs[labs.length - 1] : "0";
    const vec = labs.slice(0, -1);
    const out = [0x0e, ...uleb(vec.length)];
    for (const l of vec) out.push(...uleb(ctx.labelIndex(l, labels)));
    out.push(...uleb(ctx.labelIndex(def, labels)));
    return out;
  }
  if (op === "unreachable") return [0x00];
  if (op === "return") return [0x0f];
  if (op === "drop") return [0x1a];
  if (op === "nop") return [0x01];
  if (op === "block" || op === "loop" || op === "if") {
    const kind = op === "block" ? 0x02 : op === "loop" ? 0x03 : 0x04;
    let i = 0;
    let name = null;
    if (rest[0] && !Array.isArray(rest[0]) && atom(rest[0]).startsWith("$")) { name = atom(rest[0]); i++; }
    let bt = 0x40;
    if (rest[i] && Array.isArray(rest[i]) && atom(rest[i][0]) === "result") {
      bt = typeCode(atom(rest[i][1]));
      i++;
    }
    const innerLabels = [name, ...labels];
    const body = [];
    for (; i < rest.length; i++) {
      if (Array.isArray(rest[i]) && atom(rest[i][0]) === "then") {
        for (const s of rest[i].slice(1)) body.push(...encodeInstr(s, ctx, innerLabels));
        continue;
      }
      if (Array.isArray(rest[i]) && atom(rest[i][0]) === "else") {
        body.push(0x05);
        for (const s of rest[i].slice(1)) body.push(...encodeInstr(s, ctx, innerLabels));
        continue;
      }
      if (atom(rest[i]) === "else") { body.push(0x05); continue; }
      body.push(...encodeInstr(rest[i], ctx, innerLabels));
    }
    return [kind, bt, ...body, 0x0b];
  }
  if (OP[op] != null) {
    const folded = [];
    for (const a of rest) folded.push(...encodeInstr(a, ctx, labels));
    folded.push(OP[op]);
    return folded;
  }
  const acc = [];
  for (const a of node) acc.push(...encodeInstr(a, ctx, labels));
  return acc;
}

function parseFunc(node) {
  const f = { name: "", export: null, params: [], results: [], locals: [], body: [] };
  for (let i = 1; i < node.length; i++) {
    const x = node[i];
    if (!Array.isArray(x)) {
      const a = atom(x);
      if (a.startsWith("$") && !f.name) f.name = a;
      else f.body.push(x);
      continue;
    }
    const h = atom(x[0]);
    if (h === "export") f.export = isStr(x[1]) ? x[1].v : atom(x[1]).replace(/^"|"$/g, "");
    else if (h === "param") {
      if (x.length === 2 && !atom(x[1]).startsWith("$")) f.params.push({ name: "$p" + f.params.length, type: atom(x[1]) });
      else {
        for (let j = 1; j < x.length; j++) {
          if (atom(x[j]).startsWith("$")) {
            const n = atom(x[j]);
            const t = atom(x[j + 1] || "i32");
            f.params.push({ name: n, type: t.startsWith("$") ? "i32" : t });
            if (!t.startsWith("$")) j++;
          } else f.params.push({ name: "$p" + f.params.length, type: atom(x[j]) });
        }
      }
    } else if (h === "result") f.results.push(atom(x[1]));
    else if (h === "local") {
      for (let j = 1; j < x.length; ) {
        if (atom(x[j]).startsWith("$")) {
          const n = atom(x[j]);
          const t = atom(x[j + 1] || "i32");
          f.locals.push({ name: n, type: t.startsWith("$") ? "i32" : t });
          j += t.startsWith("$") ? 1 : 2;
        } else {
          f.locals.push({ name: "$l" + f.locals.length, type: atom(x[j]) });
          j++;
        }
      }
    } else f.body.push(x);
  }
  return f;
}

export function wat2wasm(text) {
  const tree = parseS(String(text));
  const mod = Array.isArray(tree) && atom(tree[0]) === "module" ? tree.slice(1) : [tree];
  const funcs = [];
  const memories = [];
  const globals = [];
  const exports = [];
  for (const item of mod) {
    if (!Array.isArray(item)) continue;
    const h = atom(item[0]);
    if (h === "memory") {
      let pages = 1, exp = null;
      for (const p of item.slice(1)) {
        if (Array.isArray(p) && atom(p[0]) === "export") exp = isStr(p[1]) ? p[1].v : atom(p[1]);
        else if (!Array.isArray(p) && /^\d+$/.test(atom(p))) pages = +atom(p);
      }
      memories.push({ pages, export: exp });
    } else if (h === "global") {
      let name = "", mut = false, type = "i32", init = 0;
      for (const p of item.slice(1)) {
        if (!Array.isArray(p) && atom(p).startsWith("$")) name = atom(p);
        else if (Array.isArray(p) && atom(p[0]) === "mut") { mut = true; type = atom(p[1]); }
        else if (Array.isArray(p) && atom(p[0]) === "i32.const") init = Number(atom(p[1])) || 0;
        else if (!Array.isArray(p) && ["i32", "i64", "f32", "f64"].includes(atom(p))) type = atom(p);
      }
      globals.push({ name, mut, type, init });
    } else if (h === "func") funcs.push(parseFunc(item));
    else if (h === "export") {
      const nm = isStr(item[1]) ? item[1].v : atom(item[1]);
      const desc = item[2];
      if (Array.isArray(desc) && atom(desc[0]) === "func") exports.push({ name: nm, kind: "func", id: atom(desc[1]) });
      if (Array.isArray(desc) && atom(desc[0]) === "memory") exports.push({ name: nm, kind: "memory", id: 0 });
    }
  }

  const ctx = {
    funcs,
    globals,
    funcIndex(name) {
      const i = funcs.findIndex((f) => f.name === name || f.name === "$" + name || f.export === name);
      return i < 0 ? 0 : i;
    },
    globalIndex(name) {
      const i = globals.findIndex((g) => g.name === name || g.name === "$" + name);
      return i < 0 ? 0 : i;
    },
    localIndex() { return 0; },
    labelIndex(name, labels) {
      if (/^\d+$/.test(String(name).replace(/^\$/, ""))) return +String(name).replace(/^\$/, "");
      const i = (labels || []).indexOf(name);
      return i < 0 ? 0 : i;
    },
  };

  const types = [];
  function typeIndex(f) {
    const key = f.params.map((p) => p.type).join(",") + "->" + f.results.join(",");
    let i = types.findIndex((t) => t.key === key);
    if (i < 0) { i = types.length; types.push({ key, params: f.params.map((p) => p.type), results: f.results }); }
    return i;
  }
  funcs.forEach(typeIndex);

  const typeSec = [];
  typeSec.push(...uleb(types.length));
  for (const t of types) {
    typeSec.push(0x60);
    typeSec.push(...uleb(t.params.length), ...t.params.map(typeCode));
    typeSec.push(...uleb(t.results.length), ...t.results.map(typeCode));
  }

  const funcSec = [...uleb(funcs.length), ...funcs.map((f) => uleb(typeIndex(f))).flat()];

  const memSec = [];
  if (memories.length) {
    memSec.push(...uleb(memories.length));
    for (const m of memories) memSec.push(0x00, ...uleb(m.pages));
  }

  const globSec = [];
  if (globals.length) {
    globSec.push(...uleb(globals.length));
    for (const g of globals) {
      globSec.push(typeCode(g.type), g.mut ? 1 : 0, 0x41, ...sleb(g.init), 0x0b);
    }
  }

  const exp = [];
  for (const f of funcs) if (f.export) exp.push({ name: f.export, kind: 0, idx: funcs.indexOf(f) });
  memories.forEach((m, i) => { if (m.export) exp.push({ name: m.export, kind: 2, idx: i }); });
  for (const e of exports) {
    if (e.kind === "func") exp.push({ name: e.name, kind: 0, idx: ctx.funcIndex(e.id) });
    if (e.kind === "memory") exp.push({ name: e.name, kind: 2, idx: 0 });
  }
  const expSec = [...uleb(exp.length)];
  for (const e of exp) {
    const nb = Array.from(new TextEncoder().encode(e.name));
    expSec.push(...uleb(nb.length), ...nb, e.kind, ...uleb(e.idx));
  }

  const codeSec = [...uleb(funcs.length)];
  for (const f of funcs) {
    const names = [...f.params.map((p) => p.name), ...f.locals.map((l) => l.name)];
    const localCtx = {
      ...ctx,
      localIndex(name) {
        const n = atom(name);
        let i = names.indexOf(n);
        if (i < 0) i = names.indexOf("$" + n);
        if (i < 0 && /^\d+$/.test(n)) i = +n;
        return i < 0 ? 0 : i;
      },
    };
    const locGroups = [];
    for (const l of f.locals) locGroups.push([1, typeCode(l.type)]);
    const locBytes = [...uleb(locGroups.length)];
    for (const g of locGroups) locBytes.push(...uleb(g[0]), g[1]);
    const body = [];
    for (const ins of f.body) body.push(...encodeInstr(ins, localCtx, []));
    body.push(0x0b);
    const fnBody = [...locBytes, ...body];
    codeSec.push(...uleb(fnBody.length), ...fnBody);
  }

  const out = [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00];
  out.push(...section(1, typeSec));
  out.push(...section(3, funcSec));
  if (memories.length) out.push(...section(5, memSec));
  if (globals.length) out.push(...section(6, globSec));
  out.push(...section(7, expSec));
  out.push(...section(10, codeSec));
  return Uint8Array.from(out);
}

export async function wasmRun(bytes, name = "main", args = []) {
  const { instance } = await WebAssembly.instantiate(bytes);
  const fn = instance.exports[name] || instance.exports.main || instance.exports.compute;
  if (typeof fn !== "function") throw new Error("no export " + name);
  return fn(...args);
}

export function watToBase64(text) {
  const b = wat2wasm(text);
  let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s);
}
