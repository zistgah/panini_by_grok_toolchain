// @ts-nocheck
/**
 * Stage-0 VM primitives only. Compilers live in src/panini/frontends/*.pni.
 * Copyright (C) 1993-2026 Abhishek Choudhary | GPL-3.0-or-later
 */
import {
  Tag, vUnit, vBool, vInt, vStr, vList, vOk, vErr,
  display, typeName, toNumber, toStr, equals,
} from "./values.js";

export function installBuiltins(env, runtime) {
  const def = (name, fn) => {
    env.define(name, { tag: Tag.Function, value: async (...args) => fn(...args) }, { constant: true });
  };

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
  def("TYPEOF", (x) => vStr(typeName(x)));
  def("STR", (x) => vStr(toStr(x)));
  def("INT", (x) => vInt(toNumber(x)));
  def("CONTAINS", (xs, w) => {
    if (xs?.tag === Tag.List) {
      return vBool(xs.value.some((x) => equals(x, w) || toStr(x) === toStr(w)));
    }
    if (xs?.tag === Tag.Map) {
      return vBool(xs.value.has(toStr(w)));
    }
    return vBool(toStr(xs).indexOf(toStr(w)) >= 0);
  });
  def("ORD", (x) => {
    const s = toStr(x);
    return vInt(s.length ? s.charCodeAt(0) : 0);
  });
  def("CHR", (x) => vStr(String.fromCharCode(toNumber(x) | 0)));
  def("LEN", (x) => {
    if (!x) return vInt(0);
    if (x.tag === Tag.String || x.tag === Tag.List) return vInt(x.value.length);
    if (x.tag === Tag.Map) return vInt(x.value.size);
    return vInt(0);
  });
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
  });
  def("APPEND", (list, item) => {
    if (list?.tag === Tag.List) {
      list.value.push(item);
      return list;
    }
    return vList([item]);
  });
  def("POP", (list) => {
    if (list?.tag === Tag.List && list.value.length) {
      return list.value.pop();
    }
    return vInt(0);
  });
  def("HASKEY", (m, k) => {
    if (m?.tag === Tag.Map) return vBool(m.value.has(toStr(k)));
    return vBool(false);
  });
  def("BITAND", (a, b) => vInt((toNumber(a) | 0) & (toNumber(b) | 0)));
  def("BITOR", (a, b) => vInt((toNumber(a) | 0) | (toNumber(b) | 0)));
  def("BITXOR", (a, b) => vInt((toNumber(a) | 0) ^ (toNumber(b) | 0)));
  def("BITNOT", (a) => vInt(~(toNumber(a) | 0)));
  def("SHL", (a, b) => vInt((toNumber(a) | 0) << (toNumber(b) | 0)));
  def("SHR", (a, b) => vInt((toNumber(a) | 0) >> (toNumber(b) | 0)));
  def("QUOTE", () => vStr('"'));
  def("NEWLINE", () => vStr("\n"));
  def("TAB", () => vStr("\t"));
  def("CR", () => vStr("\r"));
  def("BACKSLASH", () => vStr("\\"));
  def("OK", (x) => vOk(x ?? vUnit()));
  def("ERR", (x) => vErr(x ?? vStr("error")));
}
