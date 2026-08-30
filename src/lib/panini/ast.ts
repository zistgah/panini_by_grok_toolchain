/* Copyright (C) 1993-2026 Abhishek Choudhary | GPL-3.0-or-later
 * Dump / read AST. Parsing and lowering are PANINI modules.
 * Stage-0 lex/parse is used only for PANINI source itself (the VM).
 */
import { lex } from "./engine/lexer.js";
import { Parser } from "./engine/parser.js";
import { pniFn, pniLowerToC, runPniFrontend } from "./pni-front.ts";

export async function lowerToC(id: string, source: string): Promise<string | null> {
  return pniLowerToC(id, source);
}

export type AstDump = {
  lang: string;
  frontend: string;
  source: string;
  ast: unknown;
  lowered?: string;
  note?: string;
};

export async function dumpAst(id: string, source: string): Promise<AstDump> {
  const src = String(source);
  if (id === "c" || id === "cppp") {
    const pre = await pniFn("c", "ppCpp", [src]);
    const ast = await pniFn("c", "cParse", [pre == null ? src : String(pre)]);
    return { lang: id, frontend: "PANINI.Frontend.C", source: src, ast };
  }
  const lowered = await pniLowerToC(id, src);
  if (lowered != null) {
    const ast = await pniFn("c", "cParse", [lowered]);
    return {
      lang: id,
      frontend: "PANINI.Frontend." + id,
      source: src,
      lowered,
      ast,
      note: "AST is the C tree after PANINI lowering in to_c.pni.",
    };
  }
  if (id === "panini") {
    try {
      const tokens = lex(src, "program.pni");
      const ast = new Parser(tokens, src, "program.pni").parse();
      return { lang: id, frontend: "PANINI", source: src, ast, note: "Stage-0 PANINI parser (the VM)." };
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
  const r = await runPniFrontend(id, src);
  return {
    lang: id,
    frontend: r.frontend || "PANINI.Frontend." + id,
    source: src,
    ast: (r as { ast?: unknown }).ast ?? { op: "source", token_count: (r as { token_count?: number }).token_count },
    note: r.note || "PANINI frontend.",
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
