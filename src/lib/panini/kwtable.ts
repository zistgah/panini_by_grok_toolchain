/* Copyright (C) 1993-2026 Abhishek Choudhary | GPL-3.0-or-later
 * Per-frontend keyword table × ILM human languages.
 *
 * Honest join: the linguist maps are C keywords (Hindi bar = 29). A frontend
 * keyword maps if it IS a C keyword, or if we name a cognate (def → void for
 * "function", print → printf). Unmapped cells stay empty — we do not invent
 * translations for fn/package/elif beyond that cognate.
 */
import { keywordsOf } from "./highlight.ts";
import { ILM_LANGUAGES } from "./keywords.ts";

export const ILM_LANG_IDS = Object.keys(ILM_LANGUAGES);

const C_KEYS = new Set<string>();
for (const L of Object.values(ILM_LANGUAGES)) {
  for (const row of L.rows) C_KEYS.add(row.c);
}

/** Frontend keyword (lowercased) → C ILM key. Only where the identity is the same idea. */
const COGNATE: Record<string, string> = {
  def: "void",
  fn: "void",
  func: "void",
  function: "void",
  procedure: "void",
  sub: "void",
  defun: "void",
  defn: "void",
  lambda: "void",
  fun: "void",
  elif: "else",
  elsif: "else",
  elseif: "else",
  print: "printf",
  println: "printf",
  puts: "printf",
  echo: "printf",
  writeln: "printf",
  disp: "printf",
  cat: "printf",
  writeline: "printf",
  import: "include",
  using: "include",
  integer: "int",
  i32: "int",
  i64: "int",
  int64: "int",
};

/** Extra joins that must not apply to every frontend (define is cpp/make, not scheme). */
const PER_FE: Record<string, Record<string, string>> = {
  scheme: { define: "void" },
  lisp: { t: "int" },
  panini: { FUNCTION: "void", PRINT: "printf", IF: "if", ELSE: "else", WHILE: "while", FOR: "for", RETURN: "return", CONST: "const", VAR: "int" },
  fortran: { INTEGER: "int", DO: "for", PRINT: "printf", IF: "if", ELSE: "else", RETURN: "return" },
  basic: { PRINT: "printf", IF: "if", ELSE: "else", FOR: "for", CONST: "const", SUB: "void", FUNCTION: "void", WHILE: "while" },
  cobol: { IF: "if" },
  sql: { INT: "int" },
  ada: { Integer: "int", function: "void", procedure: "void" },
  pascal: { integer: "int", function: "void", procedure: "void", writeln: "printf" },
  kconfig: { int: "int" },
  python: { def: "void", print: "printf" },
  rust: { fn: "void", i32: "int" },
  go: { func: "void" },
  kotlin: { fun: "void", Int: "int", println: "printf" },
  swift: { func: "void", Int: "int", print: "printf" },
  scala: { def: "void", Int: "int", println: "printf" },
  ruby: { def: "void", puts: "printf" },
  perl: { sub: "void", print: "printf" },
  php: { function: "void", echo: "printf" },
  lua: { function: "void", print: "printf" },
  julia: { function: "void" },
  octave: { function: "void", disp: "printf" },
  r: { function: "void", print: "printf" },
  haskell: { print: "printf" },
  csharp: { Main: "void", WriteLine: "printf" },
  dart: { print: "printf" },
};

function nativeForC(cKey: string, langId: string, preferFn: boolean): string | null {
  const lang = ILM_LANGUAGES[langId];
  if (!lang) return null;
  const rows = lang.rows.filter((r) => r.c === cKey);
  if (!rows.length) return null;
  if (preferFn && cKey === "void" && rows.length > 1) return rows[rows.length - 1].native;
  return rows[0].native;
}

export function viaOf(host: string, frontendId: string): string | null {
  const per = PER_FE[frontendId];
  if (per) {
    if (per[host]) return per[host];
    const low = per[host.toLowerCase()];
    if (low) return low;
  }
  const low = host.toLowerCase();
  if (C_KEYS.has(low)) return low;
  if (C_KEYS.has(host)) return host;
  if (COGNATE[low]) return COGNATE[low];
  if (COGNATE[host]) return COGNATE[host];
  return null;
}

export type KwRow = {
  host: string;
  via: string | null;
  mapped: Record<string, string | null>;
};

export function keywordTable(frontendId: string): KwRow[] {
  const kws = keywordsOf(frontendId);
  return kws.map((host) => {
    const via = viaOf(host, frontendId);
    const preferFn = via === "void" && host.toLowerCase() !== "void";
    const mapped: Record<string, string | null> = {};
    for (const id of ILM_LANG_IDS) {
      mapped[id] = via ? nativeForC(via, id, preferFn) : null;
    }
    return { host, via, mapped };
  });
}

export function formatKeywordsTsv(frontendId: string): string {
  const rows = keywordTable(frontendId);
  const langs = ILM_LANG_IDS;
  const head = ["host", "via", ...langs].join("\t");
  const body = rows.map((r) => {
    const via = r.via && r.via !== r.host.toLowerCase() ? r.via : "";
    const cells = langs.map((id) => r.mapped[id] || "");
    return [r.host, via, ...cells].join("\t");
  });
  return [head, ...body].join("\n");
}
