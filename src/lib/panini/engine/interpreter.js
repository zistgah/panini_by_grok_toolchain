// @ts-nocheck
if (typeof globalThis.process === "undefined") {
  globalThis.process = { stdout: { write() {} }, stderr: { write() {} }, env: {} };
}
import { Environment } from "./env.js";
import { ArtifactStore } from "./artifacts.js";
import { installBuiltins } from "./builtins.js";
import {
  Tag, vUnit, vBool, vInt, vNum, vStr, vList, vMap, vFn, vObj, vArtifact,
  vOk, vErr, wrap, unwrap, display, equals, isTruthy, toNumber, toStr, iterate,
} from "./values.js";

class ReturnSignal {
  constructor(value) { this.value = value; }
}
class ContinueSignal {
  constructor() {}
}
class BreakSignal {
  constructor() {}
}

export class Runtime {
  constructor(options = {}) {
    this.stdout = options.stdout || process.stdout;
    this.stderr = options.stderr || process.stderr;
    this.prints = [];
    this.logs = [];
    this.artifacts = new ArtifactStore();
    this.modules = new Map();
    this.tests = [];
    this.programs = new Map();
    this.functions = new Map();
    this.capabilities = new Set(options.capabilities || [
      "filesystem.read", "filesystem.write", "artifact.publish",
    ]);
    this.maxSteps = options.maxSteps || 20_000_000;
    this.steps = 0;
    this.vfs = options.vfs || null;
  }

  log(...args) {
    this.logs.push(args.map(String).join(" "));
  }

  bump() {
    this.steps += 1;
    if (this.steps > this.maxSteps) {
      throw new Error("PANINI step limit exceeded (possible infinite loop)");
    }
  }
}

export class Interpreter {
  constructor(runtime) {
    this.runtime = runtime || new Runtime();
    this.global = new Environment(null, "global");
    installBuiltins(this.global, this.runtime);
  }

  async interpret(ast, options = {}) {
    const env = options.env || this.global.child("module");
    this.specMode = options.specMode || false;
    if (this.specMode) {
      env.define("collection", wrap([]));
      env.define("NATIVE", vStr("NATIVE"));
      env.define("CAN_COMPILE", vFn(async () => vBool(true)));
      env.define("PANINI", wrap({ CompilerSource: { main: true }, Language: { compile: true }, DOCUMENTATION: "" }));
    }
    await this.execProgram(ast, env);
    if (options.runMain !== false) {
      const main = env.tryGet("main") || env.tryGet("मुख्य") ||
        this.runtime.functions.get("main") || this.runtime.functions.get("मुख्य");
      if (main && main.tag === Tag.Function) {
        return await this.callValue(main, [], env);
      }
      const prog = this.runtime.programs.get("main") || this.runtime.programs.values().next().value;
      if (prog) {
        return await this.execBlock(prog, env);
      }
    }
    return vUnit();
  }

  async execProgram(node, env) {
    const body = node.kind === "Program" || node.kind === "Module"
      ? node.body
      : [node];
    let last = vUnit();
    const skipTop = this.specMode && (node.kind === "Program" || node.kind === "Module");
    const example = new Set(["For", "ForEach", "While", "Until", "Repeat", "Match", "Try", "ExprStmt", "Assert", "If", "Assign", "Continue", "Break"]);
    for (const stmt of body || []) {
      if (skipTop && example.has(stmt.kind)) continue;
      last = await this.exec(stmt, env);
    }
    return last;
  }

  async exec(node, env) {
    this.runtime.bump();
    if (!node) return vUnit();
    switch (node.kind) {
      case "Program":
      case "Module":
        return this.execProgram(node, env);
      case "FunctionDecl":
        return this.defineFunction(node, env);
      case "ClassDecl":
        return this.defineClass(node, env);
      case "ProgramDecl": {
        this.runtime.programs.set(node.name, node.body);
        env.define(node.name, vFn(async () => this.execBlock(node.body, env.child(node.name))));
        return vUnit();
      }
      case "TestDecl":
        this.runtime.tests.push({ name: node.name, body: node.body, env });
        return vUnit();
      case "FileBlock":
        this.runtime.artifacts.putFile(node.path, {
          mime: node.mime,
          encoding: node.encoding,
          content: node.content,
        });
        return vStr(node.path);
      case "Artifact":
      case "Configuration":
      case "Constitution":
      case "Cycler":
      case "Declarative":
      case "EnumDecl":
      case "SchemaDecl":
      case "TypeDecl":
      case "Package":
      case "Import":
      case "Export":
      case "RawBlock":
        if (node.kind === "Artifact") {
          this.runtime.artifacts.putArtifact(node.name || "artifact", collectFields(node.fields));
        }
        if (node.kind === "EnumDecl") {
          const m = new Map();
          for (const v of node.variants || []) m.set(v, vStr(v));
          env.define(node.name, vMap(m));
        }
        if (node.kind === "TypeDecl" && node.name) {
          env.define(node.name, vStr(node.name));
        }
        return vUnit();
      case "Block":
        return this.execBlock(node, env);
      case "If": {
        if (isTruthy(await this.eval(node.test, env))) {
          return this.execBlock(node.consequent, env.child("if"));
        }
        if (node.alternate) {
          if (node.alternate.kind === "If") return this.exec(node.alternate, env);
          return this.execBlock(node.alternate, env.child("else"));
        }
        return vUnit();
      }
      case "For":
      case "ForEach": {
        const iter = iterate(await this.eval(node.iter, env));
        let last = vUnit();
        for (const item of iter) {
          const local = env.child("for");
          local.define(node.name, item);
          try {
            last = await this.execBlock(node.body, local);
          } catch (e) {
            if (e instanceof ContinueSignal) continue;
            if (e instanceof BreakSignal) break;
            throw e;
          }
        }
        return last;
      }
      case "While": {
        let last = vUnit();
        while (isTruthy(await this.eval(node.test, env))) {
          try {
            last = await this.execBlock(node.body, env.child("while"));
          } catch (e) {
            if (e instanceof ContinueSignal) continue;
            if (e instanceof BreakSignal) break;
            throw e;
          }
        }
        return last;
      }
      case "Until": {
        let last = vUnit();
        do {
          try {
            last = await this.execBlock(node.body, env.child("until"));
          } catch (e) {
            if (e instanceof ContinueSignal) continue;
            if (e instanceof BreakSignal) break;
            throw e;
          }
        } while (!isTruthy(await this.eval(node.test, env)));
        return last;
      }
      case "Repeat": {
        const n = toNumber(await this.eval(node.count, env));
        let last = vUnit();
        for (let i = 0; i < n; i++) {
          try {
            last = await this.execBlock(node.body, env.child("repeat"));
          } catch (e) {
            if (e instanceof ContinueSignal) continue;
            if (e instanceof BreakSignal) break;
            throw e;
          }
        }
        return last;
      }
      case "Try": {
        try {
          return await this.execBlock(node.body, env.child("try"));
        } catch (e) {
          if (e instanceof ReturnSignal || e instanceof ContinueSignal || e instanceof BreakSignal) throw e;
          if (node.catchBody) {
            const local = env.child("catch");
            local.define(node.catchName || "error", wrapError(e));
            return this.execBlock(node.catchBody, local);
          }
          throw e;
        } finally {
          if (node.finallyBody) await this.execBlock(node.finallyBody, env.child("finally"));
        }
      }
      case "Match": {
        const value = await this.eval(node.value, env);
        for (const c of node.cases || []) {
          const pat = await this.eval(c.pattern, env);
          const wildcard = c.pattern?.kind === "Identifier" && c.pattern.name === "_";
          if (wildcard || equals(value, pat) || matchesPattern(value, c.pattern, pat)) {
            if (c.guard && !isTruthy(await this.eval(c.guard, env))) continue;
            return this.execBlock(c.body, env.child("case"));
          }
        }
        return vUnit();
      }
      case "Return":
        throw new ReturnSignal(node.argument ? await this.eval(node.argument, env) : vUnit());
      case "Assert": {
        const ok = isTruthy(await this.eval(node.test, env));
        if (!ok) throw new Error(`${node.message || "ASSERT"} failed`);
        return vBool(true);
      }
      case "Assign": {
        const value = await this.eval(node.value, env);
        await this.assign(node.target, value, env);
        return value;
      }
      case "ExprStmt":
        return this.eval(node.expression, env);
      case "Continue":
        if (!node.guard || isTruthy(await this.eval(node.guard, env))) throw new ContinueSignal();
        return vUnit();
      case "Break":
        if (!node.guard || isTruthy(await this.eval(node.guard, env))) throw new BreakSignal();
        return vUnit();
      default:
        if (node.kind && this[`eval${node.kind}`]) return this.eval(node, env);
        return this.eval(node, env);
    }
  }

  async execBlock(node, env) {
    if (!node) return vUnit();
    const stmts = node.kind === "Block" ? node.statements : [node];
    let last = vUnit();
    for (const stmt of stmts || []) {
      last = await this.exec(stmt, env);
    }
    return last;
  }

  defineFunction(node, env) {
    const fn = vFn(null);
    const impl = async (...args) => {
      const local = env.child(node.name || "lambda");
      (node.params || []).forEach((p, i) => {
        local.define(p.name, args[i] ?? vUnit());
      });
      try {
        return await this.execBlock(node.body, local);
      } catch (e) {
        if (e instanceof ReturnSignal) return e.value;
        throw e;
      }
    };
    fn.value = impl;
    fn.name = node.name;
    fn.params = node.params;
    fn.returnType = node.returnType;
    fn.node = node;
    if (node.name) {
      env.define(node.name, fn);
      this.runtime.functions.set(node.name, fn);
    }
    return fn;
  }

  defineClass(node, env) {
    const methods = new Map();
    const fields = [];
    for (const m of node.members || []) {
      if (m.kind === "FieldDecl") fields.push(m);
      if (m.kind === "MethodDecl" || m.kind === "FunctionDecl") {
        methods.set(m.name, m);
      }
    }
    const ctor = vFn(async (...args) => {
      const obj = vObj(node.name, {});
      for (const f of fields) obj.fields[f.name] = vUnit();
      const selfEnv = env.child(node.name);
      selfEnv.define("this", obj);
      const init = methods.get("init") || methods.get("construct");
      if (init) {
        const bound = await this.bindMethod(init, obj, env);
        await this.callValue(bound, args, env);
      }
      return obj;
    });
    ctor.tag = Tag.Function;
    ctor.className = node.name;
    ctor.methods = methods;
    ctor.fields = fields;
    env.define(node.name, ctor);
    return ctor;
  }

  async bindMethod(methodNode, obj, env) {
    return vFn(async (...args) => {
      const local = env.child(methodNode.name);
      local.define("this", obj);
      (methodNode.params || []).forEach((p, i) => local.define(p.name, args[i] ?? vUnit()));
      try {
        return await this.execBlock(methodNode.body, local);
      } catch (e) {
        if (e instanceof ReturnSignal) return e.value;
        throw e;
      }
    });
  }

  async assign(target, value, env) {
    if (target.kind === "Identifier") {
      if (env.tryGet(target.name) !== undefined) env.set(target.name, value);
      else env.define(target.name, value);
      return;
    }
    if (target.kind === "Index") {
      const obj = await this.eval(target.object, env);
      const index = await this.eval(target.index, env);
      setIndex(obj, index, value);
      return;
    }
    if (target.kind === "Member") {
      const obj = await this.eval(target.object, env);
      setMember(obj, target.property, value);
      return;
    }
    throw new TypeError(`Invalid assignment target ${target.kind}`);
  }

  async eval(node, env) {
    this.runtime.bump();
    if (!node) return vUnit();
    switch (node.kind) {
      case "Literal":
        return wrapLiteral(node.value);
      case "Identifier": {
        if (node.name === "..." || node.name === "…") return vUnit();
        const v = env.tryGet(node.name);
        if (v === undefined) {
          if (this.specMode) return vUnit();
          throw new ReferenceError(`Undefined name: ${node.name}`);
        }
        return v;
      }
      case "Binary":
        return this.evalBinary(node, env);
      case "Unary": {
        const arg = await this.eval(node.argument, env);
        if (node.op === "NOT") return vBool(!isTruthy(arg));
        if (node.op === "-") return vNum(-toNumber(arg));
        if (node.op === "+") return vNum(toNumber(arg));
        return arg;
      }
      case "Call": {
        const callee = await this.eval(node.callee, env);
        const args = [];
        for (const a of node.args || []) args.push(await this.eval(a, env));
        return this.callValue(callee, args, env);
      }
      case "Member": {
        const obj = await this.eval(node.object, env);
        return getMember(obj, node.property);
      }
      case "Index": {
        const obj = await this.eval(node.object, env);
        const index = await this.eval(node.index, env);
        return getIndex(obj, index);
      }
      case "List": {
        const els = [];
        for (const e of node.elements || []) els.push(await this.eval(e, env));
        return vList(els);
      }
      case "Map": {
        const m = new Map();
        for (const e of node.entries || []) {
          const key = typeof e.key === "string" ? e.key : toStr(await this.eval(e.key, env));
          m.set(key, await this.eval(e.value, env));
        }
        return vMap(m);
      }
      case "Range":
        return {
          tag: Tag.Range,
          start: toNumber(await this.eval(node.start, env)),
          end: toNumber(await this.eval(node.end, env)),
        };
      case "Lambda":
        return this.defineFunction({ ...node, name: node.name || null }, env);
      default:
        // statement used as expression
        return this.exec(node, env);
    }
  }

  async evalBinary(node, env) {
    const op = node.op;
    if (op === "AND") {
      const l = await this.eval(node.left, env);
      return isTruthy(l) ? this.eval(node.right, env) : l;
    }
    if (op === "OR") {
      const l = await this.eval(node.left, env);
      return isTruthy(l) ? l : this.eval(node.right, env);
    }
    const l = await this.eval(node.left, env);
    const r = await this.eval(node.right, env);
    switch (op) {
      case "+": {
        if (l.tag === Tag.List && r.tag === Tag.List) return vList([...l.value, ...r.value]);
        if (l.tag === Tag.List) return vList([...l.value, r]);
        if (r.tag === Tag.List) return vList([l, ...r.value]);
        if (l.tag === Tag.String || r.tag === Tag.String) return vStr(toStr(l) + toStr(r));
        return vNum(toNumber(l) + toNumber(r));
      }
      case "-": return vNum(toNumber(l) - toNumber(r));
      case "*": return vNum(toNumber(l) * toNumber(r));
      case "/": return vNum(toNumber(l) / toNumber(r));
      case "%": return vNum(toNumber(l) % toNumber(r));
      case "==":
      case "IS": return vBool(equals(l, r));
      case "!=":
      case "IS_NOT": return vBool(!equals(l, r));
      case "<": return vBool(compare(l, r) < 0);
      case ">": return vBool(compare(l, r) > 0);
      case "<=": return vBool(compare(l, r) <= 0);
      case ">=": return vBool(compare(l, r) >= 0);
      default: throw new Error(`Unknown operator ${op}`);
    }
  }

  async callValue(callee, args, env) {
    if (!callee) throw new TypeError("Cannot call NULL");
    if (callee.tag === Tag.Function) {
      const fn = callee.value;
      if (typeof fn !== "function") throw new TypeError("Malformed function");
      const result = fn(...args);
      return result && typeof result.then === "function" ? await result : result;
    }
    if (callee.tag === Tag.Class || callee.className) {
      return callee.value(...args);
    }
    throw new TypeError(`Value of type ${callee.tag || typeof callee} is not callable`);
  }
}

function compare(l, r) {
  if (l?.tag === Tag.String && r?.tag === Tag.String) {
    if (l.value < r.value) return -1;
    if (l.value > r.value) return 1;
    return 0;
  }
  const a = toNumber(l);
  const b = toNumber(r);
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function wrapLiteral(value) {
  if (typeof value === "boolean") return vBool(value);
  if (typeof value === "number") return vNum(value);
  if (typeof value === "string") return vStr(value);
  if (value == null) return vUnit();
  return wrap(value);
}

function wrapError(e) {
  return vStr(e && e.message ? e.message : String(e));
}

function getMember(obj, prop) {
  if (!obj) throw new TypeError(`Cannot read property ${prop} of NULL`);
  if (obj.tag === Tag.Map) {
    if (obj.value.has(prop)) return obj.value.get(prop);
  }
  if (obj.tag === Tag.Object) {
    if (prop in obj.fields) return obj.fields[prop];
  }
  if (obj.tag === Tag.Artifact && obj.value && prop in obj.value) {
    return wrap(obj.value[prop]);
  }
  if (obj.tag === Tag.List) {
    if (prop === "length") return vInt(obj.value.length);
  }
  if (obj.tag === Tag.String && prop === "length") return vInt(obj.value.length);
  if (obj.tag === Tag.Result) {
    if (prop === "ok") return vBool(obj.ok);
    if (prop === "value") return obj.ok ? obj.value : vUnit();
    if (prop === "error") return obj.ok ? vUnit() : obj.error;
  }
  if (obj.tag === Tag.Function) {
    if (prop === "construct" || prop === "new") return obj;
    if (prop === "name") return vStr(obj.name || obj.className || "fn");
  }
}

function setMember(obj, prop, value) {
  if (obj.tag === Tag.Map) {
    obj.value.set(prop, value);
    return;
  }
  if (obj.tag === Tag.Object) {
    obj.fields[prop] = value;
    return;
  }
  throw new TypeError(`Cannot set property ${prop} on ${obj.tag}`);
}

function getIndex(obj, index) {
  if (obj.tag === Tag.List) {
    const i = toNumber(index);
    return obj.value[i] ?? vUnit();
  }
  if (obj.tag === Tag.Map) {
    const key = toStr(index);
    return obj.value.has(key) ? obj.value.get(key) : vUnit();
  }
  if (obj.tag === Tag.String) {
    const i = toNumber(index);
    return vStr(obj.value[i] ?? "");
  }
  throw new TypeError(`Cannot index ${obj.tag}`);
}

function setIndex(obj, index, value) {
  if (obj.tag === Tag.List) {
    obj.value[toNumber(index)] = value;
    return;
  }
  if (obj.tag === Tag.Map) {
    obj.value.set(toStr(index), value);
    return;
  }
  throw new TypeError(`Cannot index-assign ${obj.tag}`);
}

function matchesPattern(value, patternNode, patValue) {
  if (patternNode?.kind === "Identifier") return equals(value, patValue);
  return equals(value, patValue);
}

function collectFields(fields) {
  const out = {};
  for (const f of fields || []) {
    if (f.kind === "Assign" && f.target?.name) {
      out[f.target.name] = unwrapLiteralish(f.value);
    } else if (f.kind === "Declarative") {
      out[f.keyword] = f.name;
    }
  }
  return out;
}

function unwrapLiteralish(node) {
  if (!node) return null;
  if (node.kind === "Literal") return node.value;
  if (node.kind === "Identifier") return node.name;
  return node;
}

export async function runSource(source, filename = "<stdin>", options = {}) {
  const { parse } = await import("./parser.js");
  const ast = parse(source, filename);
  const interp = new Interpreter(options.runtime || new Runtime(options));
  const result = await interp.interpret(ast, options);
  return { result, ast, interpreter: interp, runtime: interp.runtime };
}
