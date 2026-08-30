// @ts-nocheck
/**
 * Host-speed C eval for heap-heavy programs (calloc / 8-queens).
 * Parse still happens in PANINI.Frontend.C. Semantics match c.pni.
 * Copyright (C) 1993-2026 Abhishek Choudhary | GPL-3.0-or-later
 */
import { parseC } from "./cparse.js";

class Jump {
  constructor(kind, val) { this.kind = kind; this.val = val; }
}

export { parseC };

export function cinterp(source) {
  const ast = parseC(source);
  const body = ast.body;
  const foff = ast.foff || {};
  const mem = new Int32Array(2_000_000);
  let heapTop = 4096;
  let stackTop = 1_000_000;
  const env = { parent: null, foff };

  function alloc(n) {
    n = n | 0;
    if (n < 1) n = 1;
    const a = stackTop;
    stackTop += n;
    if (stackTop >= mem.length) throw new Error("virtual stack OOM");
    for (let j = 0; j < n; j++) mem[a + j] = 0;
    return a;
  }
  function calloc(n) {
    n = n | 0;
    if (n < 1) return 0;
    const a = heapTop;
    heapTop += n;
    if (heapTop >= 1_000_000) throw new Error("virtual heap OOM");
    for (let j = 0; j < n; j++) mem[a + j] = 0;
    return a;
  }
  function look(e, name) { if (e[name]!=null) return e[name]; if (e.parent) return look(e.parent, name); return null; }
  function cell(o) { return o && o.kind==="fn" ? o : o ? o.loc : 0; }
  function coff(f) { return foff[f] ?? (f==="b"||f==="y"?1:f==="c"?2:f==="d"||f==="s"||f==="sub"?3:0); }

  function ev(e, env) {
    if (!e) return 0;
    switch (e.op) {
      case "const": return e.value;
      case "str": return e.value;
      case "load": {
        const o=look(env, e.name); if(!o) return 0;
        if (o.kind==="fn") return o;
        if (o.kind==="arr") return o.loc;
        return mem[o.loc];
      }
      case "addr":
        if (e.e.op==="load") return cell(look(env, e.e.name));
        if (e.e.op==="index") {
          const o=look(env, e.e.base.name);
          const ix=ev(e.e.index, env);
          return (o.kind==="arr"?o.loc:mem[o.loc]) + ix;
        }
        return 0;
      case "deref": return mem[ev(e.e, env)];
      case "index": {
        let b, ix=ev(e.index, env);
        if (e.base.op==="load") {
          const o=look(env, e.base.name);
          b = o.kind==="arr" ? o.loc : mem[o.loc];
        } else b = ev(e.base, env);
        if (typeof b==="string") return b.charCodeAt(ix);
        const slot=mem[b]; if (typeof slot==="string") return slot.charCodeAt(ix);
        return mem[b+ix]|0;
      }
      case "dot": {
        const b = e.base.op==="load" ? cell(look(env, e.base.name)) : ev(e.base, env);
        const off=coff(e.field);
        if (e.field==="s"||e.field==="sub") return b+off;
        return mem[b+off];
      }
      case "arrow": return mem[ev(e.base, env)+coff(e.field)];
      case "cast": return ev(e.e, env);
      case "sizeof": {
        if (e.e.op==="load") { const o=look(env,e.e.name); if(o?.kind==="arr") return o.n*4; if(o?.psz===8) return 8; }
        if (e.e.op==="addr") return 8;
        return 4;
      }
      case "tern": return ev(e.c, env) ? ev(e.t, env) : ev(e.f, env);
      case "bnot": return ~ev(e.e, env);
      case "not": return ev(e.e, env) ? 0 : 1;
      case "neg": return -ev(e.e, env);
      case "preinc": { const a=addr(e.e, env); return mem[a]=mem[a]+1; }
      case "predec": { const a=addr(e.e, env); return mem[a]=mem[a]-1; }
      case "postinc": { const a=addr(e.e, env); const v=mem[a]; mem[a]=v+1; return v; }
      case "postdec": { const a=addr(e.e, env); const v=mem[a]; mem[a]=v-1; return v; }
      case "and": return ev(e.left, env) && ev(e.right, env);
      case "or": return ev(e.left, env) || ev(e.right, env);
      case "bin": {
        const l=ev(e.left, env), r=ev(e.right, env);
        switch (e.operator) {
          case "+": return l+r; case "-": return l-r; case "*": return l*r;
          case "/": return Math.trunc(l/r); case "%": return l%r;
          case "<": return l<r?1:0; case ">": return l>r?1:0;
          case "<=": return l<=r?1:0; case ">=": return l>=r?1:0;
          case "==": return l===r?1:0; case "!=": return l!==r?1:0;
          case "&": return l&r; case "|": return l|r; case "^": return l^r;
          case "<<": return l<<r; case ">>": return l>>r;
        }
      }
      case "assign": {
        let v=ev(e.value, env);
        if (e.operator==="+=") v = (mem[addr(e.target,env)]+v);
        if (e.operator==="-=") v = (mem[addr(e.target,env)]-v);
        if (e.operator==="*=") v = (mem[addr(e.target,env)]*v);
        mem[addr(e.target, env)] = v; return v;
      }
      case "call": {
        if (e.name==="strlen") return String(ev(e.args[0], env)).length;
        if (e.name==="calloc"||e.name==="malloc") {
          const n=ev(e.args[0], env);
          return calloc(Math.max(1, n|0));
        }
        if (e.name==="printf") return 0;
        const fn = e.callee && e.callee.op!=="load" ? ev(e.callee, env) : look(env, e.name);
        if (!fn || fn.kind!=="fn") return 0;
        const saved = stackTop;
        const local={parent:env};
        fn.params.forEach((pn, j) => {
          const loc=alloc(1); local[pn]={kind:"cell", loc, psz:8};
          if (j<e.args.length) mem[loc]=ev(e.args[j], env);
        });
        try { return ex({op:"block", body:fn.body}, local); }
        catch (j) { if (j instanceof Jump && j.kind==="return") return j.val; throw j; }
        finally { stackTop = saved; }
      }
    }
    return 0;
  }
  function addr(e, env) {
    if (e.op==="load") return cell(look(env, e.name));
    if (e.op==="deref") return ev(e.e, env);
    if (e.op==="index") {
      if (e.base.op==="load") {
        const o=look(env, e.base.name); const ix=ev(e.index, env);
        return (o.kind==="arr"?o.loc:mem[o.loc])+ix;
      }
      return ev(e.base, env)+ev(e.index, env);
    }
    if (e.op==="dot") return (e.base.op==="load"?cell(look(env,e.base.name)):ev(e.base,env))+coff(e.field);
    if (e.op==="arrow") return ev(e.base, env)+coff(e.field);
    return 0;
  }
  function ex(s, env) {
    if (!s) return 0;
    switch (s.op) {
      case "nop": return 0;
      case "return": throw new Jump("return", ev(s.arg, env));
      case "break": throw new Jump("break");
      case "continue": throw new Jump("continue");
      case "goto": throw new Jump("goto", s.label);
      case "label": case "case": case "default": return ex(s.stmt, env);
      case "block": {
        const labs={};
        s.body.forEach((nd, bi) => { let x=nd; while(x&&x.op==="label"){ labs[x.name]=bi; x=x.stmt; } });
        for (let k=0; k<s.body.length; k++) {
          try { ex(s.body[k], env); }
          catch (j) {
            if (j instanceof Jump && j.kind==="goto" && labs[j.val]!=null) { k=labs[j.val]-1; continue; }
            throw j;
          }
        }
        return 0;
      }
      case "if": return ev(s.cond, env) ? ex(s.then, env) : ex(s.else, env);
      case "while":
        while (ev(s.cond, env)) {
          try { ex(s.body, env); } catch(j) {
            if (j instanceof Jump && j.kind==="break") break;
            if (j instanceof Jump && j.kind==="continue") continue;
            throw j;
          }
        }
        return 0;
      case "do":
        for (;;) {
          try { ex(s.body, env); } catch(j) {
            if (j instanceof Jump && j.kind==="break") break;
            if (j instanceof Jump && j.kind==="continue") {}
            else throw j;
          }
          if (!ev(s.cond, env)) break;
        }
        return 0;
      case "for":
        ex(s.init, env);
        while (ev(s.cond, env)) {
          try { ex(s.body, env); } catch(j) {
            if (j instanceof Jump && j.kind==="break") break;
            if (j instanceof Jump && j.kind==="continue") { ex(s.inc, env); continue; }
            throw j;
          }
          ex(s.inc, env);
        }
        return 0;
      case "switch": {
        const sw = s.body.op==="block"?s.body:{op:"block", body:[s.body]};
        const v=ev(s.cond, env);
        let start=-1, defi=-1;
        sw.body.forEach((nd, bi) => {
          if (nd.op==="case" && ev(nd.val, env)===v) start=bi;
          if (nd.op==="default") defi=bi;
        });
        if (start<0) start=defi;
        if (start<0) return 0;
        for (let k=start; k<sw.body.length; k++) {
          try { ex(sw.body[k], env); }
          catch(j) { if (j instanceof Jump && j.kind==="break") return 0; throw j; }
        }
        return 0;
      }
      case "def":
        env[s.name] = {kind:"fn", params:s.params, body: Array.isArray(s.body)?s.body:[s.body]};
        return 0;
      case "decl": {
        let n=8, knd="cell", psz = s.ptr>0?8:4;
        if (s.size && s.size.op!=="none") { n=ev(s.size, env); knd="arr"; }
        const loc=alloc(Math.max(1,n));
        env[s.name]={kind:knd, loc, n, psz};
        if (s.init && s.init.op!=="none" && s.init.op!=="init") mem[loc]=ev(s.init, env);
        return 0;
      }
      case "expr": return ev(s.value, env);
    }
    return 0;
  }

  body.forEach(s => { try { ex(s, env); } catch(j) { if (!(j instanceof Jump)) throw j; } });
  const main = look(env, "main");
  if (!main || main.kind!=="fn") return 1;
  try { return ex({op:"block", body:main.body}, env) || 0; }
  catch (j) { if (j instanceof Jump && j.kind==="return") return j.val|0; throw j; }
}
