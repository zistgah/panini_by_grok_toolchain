// @ts-nocheck
/* Copyright (C) 1993-2026 Abhishek Choudhary | GPL-3.0-or-later
 * C extract parser. Shared by cinterp, --dump-ast, and the WASM backend.
 */
import { ccpp } from "./ccpp.js";
import { clower } from "./clower.js";

function tok(src) {
  const t = [];
  let i = 0;
  const n = src.length;
  const kw = new Set("int return void if else while for do char goto break continue struct typedef sizeof union enum switch case default".split(" "));
  const two = ["->","++","--","+=","-=","*=","==","!=","<=",">=","&&","||","<<",">>"];
  while (i < n) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === "#" || (c === "/" && src[i+1] === "/")) { while (i < n && src[i] !== "\n") i++; continue; }
    if (c === "/" && src[i+1] === "*") { i += 2; while (i+1 < n && !(src[i]==="*" && src[i+1]==="/")) i++; i += 2; continue; }
    if (c === '"') {
      i++; let s = "";
      while (i < n && src[i] !== '"') {
        if (src[i] === "\\" && src[i+1] === "n") { s += "\n"; i += 2; }
        else s += src[i++];
      }
      i++;
      while (/\s/.test(src[i])) i++;
      if (src[i] === '"') { i++; while (i < n && src[i] !== '"') s += src[i++]; i++; }
      t.push({k:"STR", v:s}); continue;
    }
    if (c === "'") { t.push({k:"NUM", v: src.charCodeAt(i+1)}); i += 3; continue; }
    if (c === "0" && (src[i+1]==="x"||src[i+1]==="X")) {
      i += 2; let h=0, hc=0;
      while (/[0-9a-fA-F]/.test(src[i])) { h = h*16 + parseInt(src[i++], 16); hc++; }
      t.push({k:"NUM", v: hc>8 ? -1 : h}); continue;
    }
    if (/\d/.test(c)) { let r=""; while (/\d/.test(src[i])) r += src[i++]; t.push({k:"NUM", v:+r}); continue; }
    if (/[A-Za-z_]/.test(c)) { let r=""; while (/\w/.test(src[i])) r += src[i++]; t.push({k: kw.has(r)?"KW":"IDENT", v:r}); continue; }
    const pair = src.slice(i, i+2);
    if (two.includes(pair)) { t.push({k:"OP", v:pair}); i += 2; continue; }
    t.push({k:"OP", v:c}); i++;
  }
  t.push({k:"EOF", v:""});
  return t;
}

export function parseC(source) {
  source = clower(ccpp(String(source)));
  const T = tok(source);
  let i = 0;
  const peek = () => T[i] || {k:"EOF", v:""};
  const eat = () => T[i++];
  const at = (v) => peek().v === v;
  const foff = {};
  let off = 0;

  function skipType() {
    let stars = 0;
    while (peek().k === "KW" && ["int","char","void","struct","typedef","union","enum"].includes(peek().v)) {
      if (peek().v === "struct" || peek().v === "union") {
        const un = peek().v === "union"; eat();
        if (peek().k === "IDENT") eat();
        while (at("*")) eat();
        if (at("{")) harvest(un);
      } else eat();
    }
    while (at("*")) { stars++; eat(); }
    return stars;
  }
  function harvest(un) {
    eat();
    let d = 1;
    const base = off;
    while (d > 0 && peek().k !== "EOF") {
      if (at("{")) { d++; eat(); }
      else if (at("}")) { d--; eat(); }
      else if (peek().k === "KW" && ["int","char","void"].includes(peek().v)) eat();
      else if (peek().k === "KW" && (peek().v === "struct" || peek().v === "union")) {
        const iu = peek().v === "union"; eat();
        if (peek().k === "IDENT") eat();
        while (at("*")) eat();
        if (at("{")) { if (iu) { const s=off; harvest(true); off=s+1; } else harvest(false); }
        else if (peek().k === "IDENT") { foff[eat().v] = off; if (!un) off++; }
      } else if (peek().k === "IDENT") {
        const nm = eat().v; foff[nm] = off;
        if (at("[")) { while (!at("]") && peek().k!=="EOF") eat(); if (at("]")) eat(); off += 2; }
        else if (!un) off++;
      } else eat();
    }
  }
  function coff(f) { return foff[f] ?? (f==="b"||f==="y"?1:f==="c"?2:f==="d"||f==="s"||f==="sub"?3:0); }

  function pUnary() {
    if (at("*")) { eat(); return {op:"deref", e:pUnary()}; }
    if (at("&")) { eat(); return {op:"addr", e:pUnary()}; }
    if (at("!")) { eat(); return {op:"not", e:pUnary()}; }
    if (at("-")) { eat(); return {op:"neg", e:pUnary()}; }
    if (at("+")) { eat(); return pUnary(); }
    if (at("~")) { eat(); return {op:"bnot", e:pUnary()}; }
    if (at("++")) { eat(); return {op:"preinc", e:pUnary()}; }
    if (at("--")) { eat(); return {op:"predec", e:pUnary()}; }
    const t = peek();
    if (t.k==="KW" && t.v==="sizeof") {
      eat();
      if (at("(")) {
        eat();
        if (peek().k==="KW" && ["int","char","void","struct"].includes(peek().v)) {
          const ty = peek().v; skipType(); if (at(")")) eat();
          return {op:"const", value: ty==="char"?1: ty==="void"?8:4};
        }
        const e = pAssign(); if (at(")")) eat(); return {op:"sizeof", e};
      }
      return {op:"sizeof", e:pUnary()};
    }
    if (t.k==="NUM") { eat(); return {op:"const", value:t.v}; }
    if (t.k==="STR") { eat(); return {op:"str", value:t.v}; }
    if (t.k==="IDENT" || t.k==="KW") {
      eat(); return pPost({op:"load", name:t.v});
    }
    if (at("(")) {
      eat();
      if (peek().k==="KW" && ["int","char","void","struct"].includes(peek().v)) {
        skipType(); if (at(")")) eat(); return {op:"cast", e:pUnary()};
      }
      const e = pAssign(); if (at(")")) eat(); return pPost(e);
    }
    eat(); return {op:"const", value:0};
  }
  function pPost(left) {
    for (;;) {
      if (at("(")) {
        eat(); const args=[];
        while (!at(")") && peek().k!=="EOF") { args.push(pAssign()); if (at(",")) eat(); }
        if (at(")")) eat();
        left = {op:"call", name:left.name, args, callee:left};
      } else if (at("[")) {
        eat(); const ix=pAssign(); if (at("]")) eat(); left={op:"index", base:left, index:ix};
      } else if (at(".")) { eat(); left={op:"dot", base:left, field:eat().v}; }
      else if (at("->")) { eat(); left={op:"arrow", base:left, field:eat().v}; }
      else if (at("++")) { eat(); left={op:"postinc", e:left}; }
      else if (at("--")) { eat(); left={op:"postdec", e:left}; }
      else return left;
    }
  }
  const bin = (next, ops) => () => {
    let l = next();
    while (ops.includes(peek().v)) { const o=eat().v; l={op:"bin", operator:o, left:l, right:next()}; }
    return l;
  };
  const pMul = bin(pUnary, ["*","/","%"]);
  const pAdd = bin(pMul, ["+","-"]);
  const pSh = bin(pAdd, ["<<",">>"]);
  const pRel = bin(pSh, ["<",">","<=",">="]);
  const pEq = bin(pRel, ["==","!="]);
  const pBand = bin(pEq, ["&"]);
  const pBxor = bin(pBand, ["^"]);
  const pBor = bin(pBxor, ["|"]);
  function pAnd() { let l=pBor(); while(at("&&")){eat(); l={op:"and", left:l, right:pBor()};} return l; }
  function pOr() { let l=pAnd(); while(at("||")){eat(); l={op:"or", left:l, right:pAnd()};} return l; }
  function pCond() {
    let l=pOr();
    if (at("?")) { eat(); const t=pCond(); if (at(":")) eat(); return {op:"tern", c:l, t, f:pCond()}; }
    return l;
  }
  function pInit() {
    if (!at("{")) return pCond();
    eat(); const items=[];
    while (!at("}") && peek().k!=="EOF") {
      let des="";
      if (at(".")) { eat(); des=eat().v; if (at("=")) eat(); }
      else if (at("[")) { eat(); des=String(peek().v); eat(); if (at("]")) eat(); if (at("=")) eat(); }
      items.push({des, val:pInit()}); if (at(",")) eat();
    }
    if (at("}")) eat();
    return {op:"init", items};
  }
  function pAssign() {
    if (at("{")) return pInit();
    const l=pCond();
    if (["=","+=","-=","*="].includes(peek().v)) { const o=eat().v; return {op:"assign", target:l, operator:o, value:pAssign()}; }
    return l;
  }

  function pStmt() {
    const t = peek();
    if (at(";")) { eat(); return {op:"nop"}; }
    if (t.k==="KW" && t.v==="return") { eat(); const e=at(";")?{op:"const",value:0}:pAssign(); if(at(";"))eat(); return {op:"return", arg:e}; }
    if (t.k==="KW" && t.v==="if") {
      eat(); if(at("("))eat(); const cond=pAssign(); if(at(")"))eat();
      const th=pStmt(); let el={op:"nop"}; if(peek().k==="KW"&&peek().v==="else"){eat(); el=pStmt();}
      return {op:"if", cond, then:th, else:el};
    }
    if (t.k==="KW" && t.v==="while") { eat(); if(at("("))eat(); const c=pAssign(); if(at(")"))eat(); return {op:"while", cond:c, body:pStmt()}; }
    if (t.k==="KW" && t.v==="do") {
      eat(); const b=pStmt(); if(peek().v==="while")eat(); if(at("("))eat(); const c=pAssign(); if(at(")"))eat(); if(at(";"))eat();
      return {op:"do", cond:c, body:b};
    }
    if (t.k==="KW" && t.v==="for") {
      eat(); if(at("("))eat();
      const ini = at(";") ? (eat(), {op:"nop"}) : pStmt();
      const cond = at(";") ? {op:"const", value:1} : pAssign(); if(at(";"))eat();
      const inc = at(")") ? {op:"nop"} : {op:"expr", value:pAssign()}; if(at(")"))eat();
      return {op:"for", init:ini, cond, inc, body:pStmt()};
    }
    if (t.k==="KW" && t.v==="switch") { eat(); if(at("("))eat(); const c=pAssign(); if(at(")"))eat(); return {op:"switch", cond:c, body:pStmt()}; }
    if (t.k==="KW" && t.v==="case") { eat(); const v=pCond(); if(at(":"))eat(); return {op:"case", val:v, stmt:pStmt()}; }
    if (t.k==="KW" && t.v==="default") { eat(); if(at(":"))eat(); return {op:"default", stmt:pStmt()}; }
    if (t.k==="KW" && t.v==="break") { eat(); if(at(";"))eat(); return {op:"break"}; }
    if (t.k==="KW" && t.v==="continue") { eat(); if(at(";"))eat(); return {op:"continue"}; }
    if (t.k==="KW" && t.v==="goto") { const lab= (eat(), eat().v); if(at(";"))eat(); return {op:"goto", label:lab}; }
    if (t.k==="IDENT" && T[i+1] && T[i+1].v===":") { const lab=eat().v; eat(); return {op:"label", name:lab, stmt:pStmt()}; }
    if (at("{")) { eat(); const body=[]; while(!at("}")&&peek().k!=="EOF") body.push(pStmt()); if(at("}"))eat(); return {op:"block", body}; }
    if (t.k==="KW" && ["int","char","void","struct","typedef","enum","union"].includes(t.v)) {
      if (t.v==="typedef") { eat(); skipType(); if(peek().k==="IDENT")eat(); if(at(";"))eat(); return {op:"nop"}; }
      if (t.v==="enum") {
        eat(); if(peek().k==="IDENT")eat(); const body=[]; let n=0;
        if (at("{")) { eat(); while(!at("}")&&peek().k!=="EOF"){ const nm=eat().v; if(at("=")){eat(); n=+eat().v;} body.push({op:"decl", name:nm, size:{op:"none"}, init:{op:"const", value:n}}); n++; if(at(","))eat(); } if(at("}"))eat(); }
        if (peek().k==="IDENT") { body.push({op:"decl", name:eat().v, size:{op:"none"}, init:{op:"none"}}); }
        if(at(";"))eat(); return {op:"block", body};
      }
      const stars = skipType();
      let name="anon";
      if (peek().k==="IDENT") name=eat().v;
      if (at("(")) {
        eat(); const params=[];
        while(!at(")")&&peek().k!=="EOF"){ skipType(); if(peek().k==="IDENT") params.push(eat().v); else if(!at(")")&&!at(",")) eat(); if(at("[")){ while(!at("]"))eat(); if(at("]"))eat(); } if(at(","))eat(); }
        if(at(")"))eat();
        if(at(";")){ eat(); return {op:"nop"}; }
        const blk = pStmt();
        return {op:"def", name, params, body: blk.op==="block" ? blk.body : [blk] };
      }
      let size={op:"none"};
      if (at("[")) { eat(); if(at("]")) eat(); else { size=pAssign(); if(at("]"))eat(); } }
      let init={op:"none"};
      if (at("=")) { eat(); init=pInit(); }
      const extras=[];
      while (at(",")) {
        eat(); let ps=0; while(at("*")){ps++; eat();}
        let n2="anon"; if(peek().k==="IDENT") n2=eat().v;
        let sz2={op:"none"}; if(at("[")){ eat(); if(!at("]")) sz2=pAssign(); if(at("]"))eat(); }
        let i2={op:"none"}; if(at("=")){ eat(); i2=pInit(); }
        extras.push({op:"decl", name:n2, size:sz2, init:i2, ptr:ps});
      }
      if(at(";"))eat();
      const d0={op:"decl", name, size, init, ptr:stars};
      return extras.length ? {op:"block", body:[d0, ...extras]} : d0;
    }
    const e=pAssign(); if(at(";"))eat(); return {op:"expr", value:e};
  }

  const body=[];
  while (peek().k!=="EOF") body.push(pStmt());

  return { op: "program", body, foff, source };
}

