/* Copyright (C) 1993-2026 Abhishek Choudhary | GPL-3.0-or-later
 * Dump / read AST. C uses the extract parser. Others: lowered-C, PANINI parse, or source wrapper.
 */
import { parseC } from "./engine/cparse.js";
import { lex } from "./engine/lexer.js";
import { Parser } from "./engine/parser.js";
import {
  rustToC,
  goToC,
  juliaToC,
  zigToC,
  fortranToC,
  pascalToC,
  javaToC,
  csharpToC,
  kotlinToC,
  swiftToC,
  scalaToC,
  dartToC,
  adaToC,
} from "./engine/stdlower.js";
import { cpplower } from "./engine/cpplower.js";

const TO_C: Record<string, (s: string) => string> = {
  rust: rustToC,
  go: goToC,
  julia: juliaToC,
  zig: zigToC,
  fortran: fortranToC,
  pascal: pascalToC,
  java: javaToC,
  csharp: csharpToC,
  kotlin: kotlinToC,
  swift: swiftToC,
  scala: scalaToC,
  dart: dartToC,
  ada: adaToC,
  cpp: cpplower,
};

export function lowerToC(id: string, source: string): string | null {
  if (id === "c" || id === "cppp") return source;
  const fn = TO_C[id];
  return fn ? fn(source) : null;
}

function pythonAst(source: string) {
  const fns: { op: string; name: string; params: string[] }[] = [];
  const re = /^def\s+(\w+)\s*\(([^)]*)\)\s*:/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    const params = m[2]
      .split(",")
      .map((x) => x.trim().split("=")[0].trim())
      .filter(Boolean);
    fns.push({ op: "def", name: m[1], params });
  }
  return { op: "module", functions: fns };
}

export type AstDump = {
  lang: string;
  frontend: string;
  source: string;
  ast: unknown;
  lowered?: string;
  note?: string;
};

export function dumpAst(id: string, source: string): AstDump {
  const src = String(source);
  if (id === "c" || id === "cppp") {
    return { lang: id, frontend: "PANINI.Frontend.C", source: src, ast: parseC(src) };
  }
  const lowered = lowerToC(id, src);
  if (lowered != null) {
    return {
      lang: id,
      frontend: "PANINI.Frontend." + id,
      source: src,
      lowered,
      ast: parseC(lowered),
      note: "AST is the lowered C extract, not a native " + id + " tree.",
    };
  }
  if (id === "panini") {
    try {
      const tokens = lex(src, "program.pni");
      const ast = new Parser(tokens, src, "program.pni").parse();
      return { lang: id, frontend: "PANINI", source: src, ast };
    } catch (e) {
      return {
        lang: id,
        frontend: "PANINI",
        source: src,
        ast: null,
        note: e instanceof Error ? e.message : String(e),
      };
    }
  }
  if (id === "python") {
    return {
      lang: id,
      frontend: "PANINI.Frontend.Python",
      source: src,
      ast: pythonAst(src),
      note: "def/params only — the workbench Python is a def-main subset.",
    };
  }
  return {
    lang: id,
    frontend: "PANINI.Frontend." + id,
    source: src,
    ast: { op: "source" },
    note: "No structured AST for this extract. --read-ast will reuse the source field.",
  };
}

export function astToSource(dump: unknown): { id?: string; source: string } {
  if (!dump || typeof dump !== "object") throw new Error("AST JSON is not an object");
  const d = dump as AstDump & { op?: string; body?: unknown };
  if (typeof d.source === "string" && d.source.length) return { id: d.lang, source: d.source };
  if (d.op === "program" && Array.isArray(d.body)) {
    throw new Error("--read-ast: C tree without source; dump with --dump-ast so source is stored");
  }
  throw new Error("--read-ast: JSON needs a source field (panc --dump-ast writes one)");
}
