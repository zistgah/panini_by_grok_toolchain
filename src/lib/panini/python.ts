/* Copyright (C) 1993-2026 Abhishek Choudhary | GPL-3.0-or-later
 * Browser Python subset: def / return / if / else / print / integer arith.
 * Node uses python.pni for the frozen frontend.
 */
import type { RunResult } from "./protocol.ts";

function indentOf(line: string): number {
  const m = line.match(/^[ \t]*/);
  if (!m) return 0;
  return m[0].replace(/\t/g, "    ").length;
}

type Fn = { params: string[]; body: string[] };

function parseDefs(src: string): Record<string, Fn> {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const fns: Record<string, Fn> = {};
  let i = 0;
  while (i < lines.length) {
    const stripped = lines[i].replace(/#.*$/, "");
    const dm = stripped.match(/^def\s+(\w+)\s*\(([^)]*)\)\s*:/);
    if (!dm) {
      i++;
      continue;
    }
    const name = dm[1];
    const params = dm[2]
      .split(",")
      .map((x) => x.trim().split("=")[0].trim())
      .filter(Boolean);
    const base = indentOf(lines[i]);
    i++;
    const body: string[] = [];
    while (i < lines.length) {
      const t = lines[i].replace(/#.*$/, "");
      if (t.trim() === "") {
        body.push("");
        i++;
        continue;
      }
      if (indentOf(t) <= base) break;
      body.push(t);
      i++;
    }
    fns[name] = { params, body };
  }
  return fns;
}

function evalExpr(expr: string, env: Record<string, unknown>, call: (n: string, a: unknown[]) => unknown): unknown {
  let e = expr.trim();
  e = e.replace(/\bTrue\b/g, "true").replace(/\bFalse\b/g, "false").replace(/\bNone\b/g, "null");
  e = e.replace(/\band\b/g, "&&").replace(/\bor\b/g, "||").replace(/\bnot\b/g, "!");
  e = e.replace(/\b(\w+)\s*\(([^()]*)\)/g, (_all, n: string, a: string) => {
    if (n === "print" || n === "int" || n === "str" || n === "len" || n === "abs") return _all;
    const args = a.trim() ? splitArgs(a).map((x) => evalExpr(x, env, call)) : [];
    return JSON.stringify(call(n, args));
  });
  const keys = Object.keys(env).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (typeof env[k] === "function") continue;
    e = e.replace(new RegExp(`\\b${k}\\b`, "g"), JSON.stringify(env[k]));
  }
  e = e.replace(/\bprint\s*\((.*)\)/, "$1");
  try {
    return Function('"use strict"; return (' + e + ")")();
  } catch (err) {
    throw new Error("Python expr: " + (err instanceof Error ? err.message : String(err)) + " :: " + expr.trim());
  }
}

function splitArgs(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      if (cur.trim()) out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

class ReturnJump {
  value: unknown;
  constructor(value: unknown) {
    this.value = value;
  }
}

function execBlock(
  body: string[],
  env: Record<string, unknown>,
  fns: Record<string, Fn>,
  prints: string[],
): unknown {
  const nonempty = body.filter((l) => l.trim());
  const base = nonempty.length ? Math.min(...nonempty.map(indentOf)) : 0;

  function call(name: string, args: unknown[]): unknown {
    const fn = fns[name];
    if (!fn) throw new Error("NameError: name '" + name + "' is not defined");
    const local: Record<string, unknown> = Object.create(null);
    fn.params.forEach((p, i) => {
      local[p] = args[i];
    });
    try {
      return execBlock(fn.body, local, fns, prints);
    } catch (e) {
      if (e instanceof ReturnJump) return e.value;
      throw e;
    }
  }

  let i = 0;
  let last: unknown = 0;
  while (i < body.length) {
    const raw = body[i];
    if (!raw.trim()) {
      i++;
      continue;
    }
    const ind = indentOf(raw);
    const line = raw.trim();
    if (ind < base) break;

    if (line.startsWith("return ")) {
      throw new ReturnJump(evalExpr(line.slice(7), env, call));
    }
    if (line === "return") throw new ReturnJump(0);

    if (line.startsWith("print(") && line.endsWith(")")) {
      const inner = line.slice(6, -1);
      const v = evalExpr(inner, env, call);
      prints.push(String(v));
      last = v;
      i++;
      continue;
    }

    if (line.startsWith("if ") && line.endsWith(":")) {
      const cond = evalExpr(line.slice(3, -1), env, call);
      i++;
      const thenLines: string[] = [];
      while (i < body.length && (body[i].trim() === "" || indentOf(body[i]) > ind)) {
        thenLines.push(body[i]);
        i++;
      }
      let elseLines: string[] | null = null;
      if (i < body.length && body[i].trim() === "else:" && indentOf(body[i]) === ind) {
        i++;
        elseLines = [];
        while (i < body.length && (body[i].trim() === "" || indentOf(body[i]) > ind)) {
          elseLines.push(body[i]);
          i++;
        }
      }
      if (cond) last = execBlock(thenLines, env, fns, prints);
      else if (elseLines) last = execBlock(elseLines, env, fns, prints);
      continue;
    }

    const am = line.match(/^(\w+)\s*=\s*(.+)$/);
    if (am) {
      env[am[1]] = evalExpr(am[2], env, call);
      last = env[am[1]];
      i++;
      continue;
    }

    last = evalExpr(line, env, call);
    i++;
  }
  return last;
}

export function pythonRun(source: string): RunResult {
  const frontend = "PANINI.Frontend.Python";
  try {
    const src = String(source);
    if (!/\bdef\s+\w+/.test(src) && !/\bprint\s*\(/.test(src)) {
      return {
        ok: false,
        frontend,
        phase: "parse",
        error:
          "Python subset expected a def or print. Example:\n\ndef factorial(n):\n    if n <= 1:\n        return 1\n    return n * factorial(n - 1)\n\ndef main():\n    return factorial(6)\n",
        hint: "Workbench Python is a def/return/if/print integer subset. The frozen frontend is python.pni (Node).",
      };
    }
    const fns = parseDefs(src);
    const prints: string[] = [];
    let value: unknown = 0;
    const run = (body: string[], env: Record<string, unknown>) => {
      try {
        return execBlock(body, env, fns, prints);
      } catch (e) {
        if (e instanceof ReturnJump) return e.value;
        throw e;
      }
    };
    if (fns.main) {
      value = run(fns.main.body, Object.create(null));
    } else if (/\bprint\s*\(/.test(src)) {
      const env: Record<string, unknown> = Object.create(null);
      value = run(
        src.split("\n").filter((l) => !/^def\b/.test(l.trim())),
        env,
      );
    } else {
      const names = Object.keys(fns);
      const last = names[names.length - 1];
      value = run(fns[last].body, Object.create(null));
    }
    return {
      ok: true,
      value,
      prints,
      print: prints.join("\n"),
      frontend,
      note: "Python def/return/if/print integer subset. Frozen frontend is python.pni.",
    };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      error,
      frontend,
      phase: "eval",
      hint: "Check indentation, names, and that every def has a return. Nested classes, imports, and comprehensions are GAP.",
    };
  }
}
