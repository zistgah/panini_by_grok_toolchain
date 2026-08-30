// @ts-nocheck
/**
 * Browser/Pages builtins for the C→WASM flow. No Node toolchain.
 * Copyright (C) 1993-2026 Abhishek Choudhary | GPL-3.0-or-later
 */
import {
  Tag, vUnit, vBool, vInt, vStr, vList, vOk, vErr,
  wrap, unwrap, display, typeName, toNumber, toStr,
} from "./values.js";
import { ccpp } from "./ccpp.js";
import { clower } from "./clower.js";
import { gnuc } from "./gnuc.js";
import { cpplower } from "./cpplower.js";
import { rustToC, goToC, juliaToC, csharpToC, kotlinToC, swiftToC, scalaToC, dartToC, adaToC } from "./stdlower.js";
import { cinterp } from "./cinterp.js";
import { rubyRun, perlRun, phpRun, rRun, cobolRun, sqlRun, octaveRun, sysmlRun } from "./appeval.js";

export function installBuiltins(env, runtime) {
  const def = (name, fn, arity) => {
    env.define(name, vFnWrap(fn), { constant: true });
  };
  function vFnWrap(fn) {
    return { tag: Tag.Function, value: async (...args) => fn(...args) };
  }

  def("PRINT", (...args) => {
    const line = args.map(display).join(" ");
    if (runtime.stdout && runtime.stdout.write) runtime.stdout.write(line + "\n");
    runtime.prints.push(line);
    return vUnit();
  });
  def("WRITE", (...args) => {
    const line = args.map(display).join(" ");
    if (runtime.stdout && runtime.stdout.write) runtime.stdout.write(line);
    runtime.prints.push(line);
    return vUnit();
  });
  def("TYPEOF", (x) => vStr(typeName(x)), 1);
  def("STR", (x) => vStr(toStr(x)), 1);
  def("INT", (x) => vInt(toNumber(x)), 1);
  def("CPP", (x) => vStr(ccpp(toStr(x))), 1);
  def("CLOWER", (x) => vStr(clower(toStr(x))), 1);
  def("GNUC", (x) => vStr(gnuc(toStr(x))), 1);
  def("CPPLOWER", (x) => vStr(cpplower(toStr(x))), 1);
  def("RUSTLOWER", (x) => vStr(rustToC(toStr(x))), 1);
  def("GOLOWER", (x) => vStr(goToC(toStr(x))), 1);
  def("JULIALOWER", (x) => vStr(juliaToC(toStr(x))), 1);
  def("CSHARPLOWER", (x) => vStr(csharpToC(toStr(x))), 1);
  def("KOTLINLOWER", (x) => vStr(kotlinToC(toStr(x))), 1);
  def("SWIFTLOWER", (x) => vStr(swiftToC(toStr(x))), 1);
  def("SCALALOWER", (x) => vStr(scalaToC(toStr(x))), 1);
  def("DARTLOWER", (x) => vStr(dartToC(toStr(x))), 1);
  def("ADALOWER", (x) => vStr(adaToC(toStr(x))), 1);
  def("RUBYRUN", (x) => wrap(rubyRun(toStr(x))), 1);
  def("PERLRUN", (x) => wrap(perlRun(toStr(x))), 1);
  def("PHPRUN", (x) => wrap(phpRun(toStr(x))), 1);
  def("RRUN", (x) => wrap(rRun(toStr(x))), 1);
  def("COBOLRUN", (x) => wrap(cobolRun(toStr(x))), 1);
  def("SQLRUN", (x) => wrap(sqlRun(toStr(x))), 1);
  def("OCTAVERUN", (x) => wrap(octaveRun(toStr(x))), 1);
  def("SYSMLRUN", (x) => wrap(sysmlRun(toStr(x))), 1);
  def("CINTERP", (x) => vInt(cinterp(toStr(x)) | 0), 1);
  def("CONTAINS", (xs, w) => vBool(toStr(xs).indexOf(toStr(w)) >= 0), 2);
  def("ORD", (x) => {
    const s = toStr(x);
    return vInt(s.length ? s.charCodeAt(0) : 0);
  }, 1);
  def("LEN", (x) => {
    if (!x) return vInt(0);
    if (x.tag === Tag.String || x.tag === Tag.List) return vInt(x.value.length);
    if (x.tag === Tag.Map) return vInt(x.value.size);
    return vInt(0);
  }, 1);
  def("SLICE", (s, a, b) => {
    if (s?.tag === Tag.List) {
      const start = toNumber(a);
      const end = b == null || b.tag === Tag.Unit ? s.value.length : toNumber(b);
      return vList(s.value.slice(start, end));
    }
    const str = toStr(s);
    const start = toNumber(a);
    const end = b == null || b.tag === Tag.Unit ? str.length : toNumber(b);
    return vStr(str.slice(start, end));
  }, 2);
  def("APPEND", (list, item) => {
    if (list?.tag === Tag.List) {
      list.value.push(item);
      return list;
    }
    return vList([item]);
  }, 2);
  def("HASKEY", (m, k) => {
    if (m?.tag === Tag.Map) return vBool(m.value.has(toStr(k)));
    return vBool(false);
  }, 2);
  def("QUOTE", () => vStr('"'));
  def("NEWLINE", () => vStr("\n"));
  def("TAB", () => vStr("\t"));
  def("CR", () => vStr("\r"));
  def("OK", (x) => vOk(x ?? vUnit()));
  def("ERR", (x) => vErr(x ?? vStr("error")));
}
