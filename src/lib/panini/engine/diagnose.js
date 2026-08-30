// @ts-nocheck
/* Copyright (C) 1993-2026 Abhishek Choudhary | GPL-3.0-or-later
 * Shared diagnostics for every frontend. One error shape: frontend, phase, line, hint, leftover.
 */

export function cDiag(src) {
  let braces = 0;
  let parens = 0;
  let line = 1;
  let col = 0;
  let braceLine = 1;
  let parenLine = 1;
  const s = String(src);
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "\n") {
      line++;
      col = 0;
      continue;
    }
    col++;
    if (c === '"') {
      i++;
      col++;
      while (i < s.length && s[i] !== '"') {
        if (s[i] === "\\") {
          i += 2;
          col += 2;
        } else {
          i++;
          col++;
        }
      }
      continue;
    }
    if (c === "/" && s[i + 1] === "/") {
      while (i < s.length && s[i] !== "\n") i++;
      i--;
      continue;
    }
    if (c === "{") {
      braces++;
      braceLine = line;
    } else if (c === "}") {
      braces--;
      if (braces < 0) return "compile error: unmatched } at line " + line + " col " + col;
    } else if (c === "(") {
      parens++;
      parenLine = line;
    } else if (c === ")") {
      parens--;
      if (parens < 0) return "compile error: unmatched ) at line " + line + " col " + col;
    }
  }
  if (braces) return "compile error: unbalanced braces (" + braces + " open, last '{' at line " + braceLine + ") — missing }";
  if (parens) return "compile error: unbalanced parentheses (" + parens + " open, last '(' at line " + parenLine + ") — missing )";
  return null;
}

const LEFTOVER = {
  python: /\bdef\s+\w+|\bprint\s*\(/,
  kotlin: /\bfun\s+\w+|\bprintln\b|\bval\s+/,
  swift: /\bfunc\s+\w+|\blet\s+\w+/,
  scala: /\bdef\s+\w+|\bobject\s+\w+|\bprintln\b/,
  dart: /\bExpect\.|\blate\s+/,
  csharp: /\bConsole\.|using\s+System/,
  rust: /\bfn\s+\w+|\blet\s+mut\b|\bprintln!/,
  go: /\bfunc\s+\w+|\bfmt\./,
  fortran: /\bprogram\b|\bend\s+program\b/i,
  ada: /\bprocedure\b|\bfunction\b.+\bis\b/i,
  ruby: /\bdef\s+\w+|\bputs\b/,
  perl: /\bsub\s+\w+|\$[a-z]/,
  php: /<\?php|\becho\b/,
  r: /\s<-\s|\bfunction\s*\(/,
  cobol: /\bIDENTIFICATION\b|\bDISPLAY\b/i,
  julia: /\bfunction\s+\w+|\bprintln\b/,
  zig: /@import|\bpub\s+fn/,
};

export function leftoverHint(id, lowered) {
  const re = LEFTOVER[id];
  if (!re) return null;
  const s = String(lowered || "");
  const m = s.match(re);
  if (!m) return null;
  const idx = s.indexOf(m[0]);
  const line = s.slice(0, idx).split("\n").length;
  return "unlowered " + id + " token " + JSON.stringify(m[0]) + " at lowered line " + line + " — the host C still contains source the frontend did not desugar";
}

export function numbered(src, limit) {
  return String(src || "")
    .split("\n")
    .slice(0, limit || 48)
    .map((l, i) => String(i + 1).padStart(4, " ") + " | " + l)
    .join("\n");
}

export function parseLoc(error) {
  const s = String(error || "");
  const m = s.match(/line\s+(\d+)(?:\s+col(?:umn)?\s+(\d+))?/i) || s.match(/:(\d+):(\d+)/);
  if (!m) return {};
  return { line: Number(m[1]), column: m[2] ? Number(m[2]) : undefined };
}

export function formatFrontendError(opts) {
  const frontend = opts.frontend || "PANINI";
  const id = opts.id || "";
  const phase = opts.phase || "run";
  const error = opts.error || "unknown error";
  const loc = parseLoc(error);
  const bits = [];
  bits.push("frontend: " + frontend);
  bits.push("phase: " + phase);
  bits.push("error: " + error);
  if (loc.line) bits.push("line: " + loc.line + (loc.column ? " col " + loc.column : ""));
  if (opts.leftover) bits.push("leftover: " + opts.leftover);
  if (opts.hint) bits.push("hint: " + opts.hint);
  bits.push("cli: panini fe " + (id || "<id>") + " <file>");
  if (opts.excerpt) {
    bits.push("source:");
    bits.push(opts.excerpt);
  }
  if (opts.lowered) {
    bits.push("lowered (first lines):");
    bits.push(numbered(opts.lowered, 36));
  }
  return bits.join("\n");
}

export function wrapDiag(frontend, e, extra) {
  const error = e instanceof Error ? e.message : String(e);
  const stack = e instanceof Error && e.stack ? e.stack.split("\n").slice(0, 6).join("\n") : "";
  const loc = parseLoc(error);
  return Object.assign(
    {
      ok: false,
      error,
      frontend,
      phase: (extra && extra.phase) || "run",
      stack: stack || undefined,
      line: loc.line,
      column: loc.column,
    },
    extra || {},
  );
}
