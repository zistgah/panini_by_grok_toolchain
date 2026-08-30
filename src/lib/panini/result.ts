/* Copyright (C) 1993-2026 Abhishek Choudhary | GPL-3.0-or-later
 * One diagnostic pass at the frontend boundary. Every runner exits through here.
 */
import { leftoverHint, numbered } from "./engine/diagnose.js";
import { cliFor } from "./meta.ts";
import type { Diagnostic, RunResult } from "./protocol.ts";

export function parseLoc(error: string | undefined): { line?: number; column?: number } {
  const s = String(error || "");
  const m =
    s.match(/line\s+(\d+)(?:\s+col(?:umn)?\s+(\d+))?/i) ||
    s.match(/:(\d+):(\d+)/) ||
    s.match(/\bL(\d+)(?:C(\d+))?/);
  if (!m) return {};
  return {
    line: Number(m[1]),
    column: m[2] ? Number(m[2]) : undefined,
  };
}

export function excerptAt(src: string, line?: number, radius = 2): string | undefined {
  if (!line || line < 1) return undefined;
  const lines = String(src).split("\n");
  const i = line - 1;
  if (i >= lines.length) return undefined;
  const from = Math.max(0, i - radius);
  const to = Math.min(lines.length, i + radius + 1);
  return lines
    .slice(from, to)
    .map((l, k) => {
      const n = from + k + 1;
      const mark = n === line ? ">" : " ";
      return `${mark}${String(n).padStart(4, " ")} | ${l}`;
    })
    .join("\n");
}

function hintFor(id: string, r: RunResult): string | undefined {
  if (r.hint) return r.hint;
  if (r.leftover) return r.leftover;
  if (r.ok) return undefined;
  const err = String(r.error || r.rejected || "");
  if (/unbalanced|unmatched/.test(err)) return "Count { } and ( ) — a missing closer is reported at the first imbalance.";
  if (/unknown (word|form|function|frontend)/i.test(err)) return "The token is not in this frontend's named extract. Load a workbench example to see the accepted shape.";
  if (/leftover|unlowered/i.test(err)) return "The frontend desugared only part of the source. The leftover is still in the host C.";
  if (/NameError|not defined/.test(err)) return "A name was used before it was bound. Check spelling and that the def/function is above the call.";
  if (/subset|GAP|not implemented/i.test(err)) return "This construct is outside the named extract. See the frontend gap on the Frontends page.";
  const fallback: Record<string, string> = {
    python: "def/return/if/print integer subset. Recursion is allowed.",
    make: "VAR=, tab recipes, $(VAR), ifeq/ifdef, echo. First target runs.",
    asm: "AT&T integer: mov/add/sub/xor/cmp/jcc/push/pop/call/ret. Result is %eax.",
    panini: "FUNCTION / IF / RETURN / PRINT. Blocks close with END. Entry is main.",
  };
  return fallback[id];
}

export function normalize(id: string, raw: RunResult, source: string, ilm?: string): RunResult {
  const loc = parseLoc(raw.error || raw.rejected);
  const line = raw.line ?? loc.line;
  const column = raw.column ?? loc.column;
  const leftover = raw.leftover || leftoverHint(id, raw.lowered || "");
  const excerpt = raw.excerpt || excerptAt(source, line);
  const hint = hintFor(id, { ...raw, leftover: leftover || undefined });
  const cli = raw.cli || cliFor(id, undefined, ilm);
  const phase = raw.phase || (raw.ok ? "eval" : raw.rejected ? "reject" : "eval");

  const diagnostics: Diagnostic[] = raw.ok
    ? []
    : [
        {
          phase,
          error: String(raw.error || raw.rejected || "failed"),
          line,
          column,
          hint,
          leftover: leftover || undefined,
          excerpt,
        },
      ];

  let error = raw.error;
  if (!raw.ok) {
    const bits = [
      `frontend: ${raw.frontend || id}`,
      `phase: ${phase}`,
      `error: ${raw.error || raw.rejected || "failed"}`,
    ];
    if (line) bits.push(`line: ${line}` + (column ? ` col ${column}` : ""));
    if (leftover) bits.push(`leftover: ${leftover}`);
    if (hint) bits.push(`hint: ${hint}`);
    bits.push(`cli: ${cli}`);
    if (excerpt) bits.push("source:\n" + excerpt);
    if (raw.lowered) bits.push("lowered (first lines):\n" + numbered(raw.lowered, 24));
    error = bits.join("\n");
  }

  return {
    ...raw,
    ok: raw.ok,
    error,
    phase,
    line,
    column,
    leftover: leftover || undefined,
    hint,
    excerpt,
    cli,
    diagnostics,
  };
}

export function formatSuccess(r: RunResult): string {
  const bits: string[] = [];
  bits.push("frontend: " + r.frontend);
  if (r.phase) bits.push("phase: " + r.phase);
  if (r.value !== undefined) bits.push("value: " + stringify(r.value));
  if (r.print) bits.push("print:\n" + r.print);
  if (r.prints && r.prints.length) bits.push("prints: " + JSON.stringify(r.prints));
  if (r.regs) bits.push("regs: " + JSON.stringify(r.regs));
  if (r.config) bits.push("config: " + JSON.stringify(r.config, null, 2));
  if (r.tokens && r.tokens.length) bits.push("tokens: " + r.tokens.slice(0, 40).join(" "));
  if (r.note) bits.push(r.note);
  if (r.lowered) bits.push("lowered:\n" + String(r.lowered).slice(0, 1800));
  if (r.cli) bits.push("cli: " + r.cli);
  if (r.wat) bits.push("wat:\n" + String(r.wat).slice(0, 1800));
  if (r.wasmBytes) bits.push("wasm: " + r.wasmBytes + " bytes");
  if (r.ast) bits.push("ast: " + (typeof r.ast === "object" ? "yes" : String(r.ast)));
  return bits.join("\n");
}

function stringify(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}
