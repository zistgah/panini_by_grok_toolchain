// @ts-nocheck
/** Runtime values for the PANINI JS bootstrap. */

export const Tag = {
  Unit: "Unit",
  Bool: "Bool",
  Int: "Int",
  Float: "Float",
  String: "String",
  List: "List",
  Map: "Map",
  Function: "Function",
  Class: "Class",
  Object: "Object",
  Artifact: "Artifact",
  Option: "Option",
  Result: "Result",
  Range: "Range",
  Enum: "Enum",
  Type: "Type",
  Module: "Module",
};

export function vUnit() {
  return { tag: Tag.Unit, value: null };
}

export function vBool(b) {
  return { tag: Tag.Bool, value: Boolean(b) };
}

export function vInt(n) {
  return { tag: Tag.Int, value: Number(n) | 0 };
}

export function vNum(n) {
  const x = Number(n);
  return Number.isInteger(x) ? { tag: Tag.Int, value: x } : { tag: Tag.Float, value: x };
}

export function vStr(s) {
  return { tag: Tag.String, value: String(s) };
}

export function vList(items) {
  return { tag: Tag.List, value: items };
}

export function vMap(entries) {
  const m = entries instanceof Map ? entries : new Map(entries);
  return { tag: Tag.Map, value: m };
}

export function vFn(fn) {
  return { tag: Tag.Function, value: fn };
}

export function vObj(cls, fields) {
  return { tag: Tag.Object, cls, fields };
}

export function vArtifact(art) {
  return { tag: Tag.Artifact, value: art };
}

export function vOk(value) {
  return { tag: Tag.Result, ok: true, value };
}

export function vErr(error) {
  return { tag: Tag.Result, ok: false, error };
}

export function vSome(value) {
  return { tag: Tag.Option, some: true, value };
}

export function vNone() {
  return { tag: Tag.Option, some: false, value: null };
}

export function vRange(start, end) {
  return { tag: Tag.Range, start, end };
}

export function isTruthy(v) {
  if (v == null) return false;
  if (typeof v !== "object" || !v.tag) return Boolean(v);
  switch (v.tag) {
    case Tag.Unit: return false;
    case Tag.Bool: return v.value;
    case Tag.Int:
    case Tag.Float: return v.value !== 0;
    case Tag.String: return v.value.length > 0;
    case Tag.List: return v.value.length > 0;
    case Tag.Option: return v.some;
    case Tag.Result: return v.ok;
    default: return true;
  }
}

export function unwrap(v) {
  if (v == null) return null;
  if (typeof v !== "object" || !v.tag) return v;
  switch (v.tag) {
    case Tag.Unit: return null;
    case Tag.Bool:
    case Tag.Int:
    case Tag.Float:
    case Tag.String:
    case Tag.List: return v.value;
    case Tag.Map: {
      const o = {};
      for (const [k, val] of v.value) o[k] = unwrap(val);
      return o;
    }
    case Tag.Option: return v.some ? unwrap(v.value) : null;
    case Tag.Result: return v.ok ? unwrap(v.value) : unwrap(v.error);
    case Tag.Range: return [v.start, v.end];
    case Tag.Artifact: return v.value;
    default: return v;
  }
}

export function wrap(js) {
  if (js == null) return vUnit();
  if (typeof js === "boolean") return vBool(js);
  if (typeof js === "number") return vNum(js);
  if (typeof js === "string") return vStr(js);
  if (Array.isArray(js)) return vList(js.map(wrap));
  if (js instanceof Map) return vMap([...js].map(([k, v]) => [k, wrap(v)]));
  if (typeof js === "object" && js.tag) return js;
  if (typeof js === "function") return vFn(js);
  const m = new Map();
  for (const [k, v] of Object.entries(js)) m.set(k, wrap(v));
  return vMap(m);
}

export function typeName(v) {
  if (v == null) return "Unit";
  if (typeof v !== "object" || !v.tag) return typeof v;
  return v.tag;
}

export function display(v) {
  if (v == null) return "NULL";
  if (typeof v !== "object" || !v.tag) return String(v);
  switch (v.tag) {
    case Tag.Unit: return "UNIT";
    case Tag.Bool: return v.value ? "TRUE" : "FALSE";
    case Tag.Int:
    case Tag.Float: return String(v.value);
    case Tag.String: return v.value;
    case Tag.List: return "[" + v.value.map(display).join(", ") + "]";
    case Tag.Map: {
      const parts = [];
      for (const [k, val] of v.value) parts.push(`${k}: ${display(val)}`);
      return "{ " + parts.join(", ") + " }";
    }
    case Tag.Function: return "<function>";
    case Tag.Object: return `<object ${v.cls || "Object"}>`;
    case Tag.Artifact: return `<artifact ${v.value?.id || v.value?.name || ""}>`;
    case Tag.Result: return v.ok ? `OK(${display(v.value)})` : `ERR(${display(v.error)})`;
    case Tag.Option: return v.some ? `Some(${display(v.value)})` : "None";
    case Tag.Range: return `${v.start}..${v.end}`;
    default: return `<${v.tag}>`;
  }
}

export function equals(a, b) {
  if (a === b) return true;
  if (!a || !b || a.tag !== b.tag) {
    if (typeof a !== "object" || typeof b !== "object") return a === b;
    return false;
  }
  switch (a.tag) {
    case Tag.Unit: return true;
    case Tag.Bool:
    case Tag.Int:
    case Tag.Float:
    case Tag.String: return a.value === b.value;
    case Tag.List:
      if (a.value.length !== b.value.length) return false;
      return a.value.every((x, i) => equals(x, b.value[i]));
    default: return unwrap(a) === unwrap(b);
  }
}

export function toNumber(v) {
  if (typeof v === "number") return v;
  if (v && (v.tag === Tag.Int || v.tag === Tag.Float)) return v.value;
  if (v && v.tag === Tag.String) return Number(v.value);
  if (v && v.tag === Tag.Bool) return v.value ? 1 : 0;
  return Number(unwrap(v));
}

export function toStr(v) {
  if (typeof v === "string") return v;
  if (v && v.tag === Tag.String) return v.value;
  return display(v);
}

export function iterate(v) {
  if (!v) return [];
  if (v.tag === Tag.Range) {
    const out = [];
    const s = typeof v.start === "number" ? v.start : toNumber(v.start);
    const e = typeof v.end === "number" ? v.end : toNumber(v.end);
    for (let i = s; i <= e; i++) out.push(vInt(i));
    return out;
  }
  if (v.tag === Tag.List) return v.value;
  if (v.tag === Tag.String) return [...v.value].map(vStr);
  if (v.tag === Tag.Map) return [...v.value.entries()].map(([k, val]) => vList([wrap(k), val]));
  if (Array.isArray(v)) return v;
  return [];
}
