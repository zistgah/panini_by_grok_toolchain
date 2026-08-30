/* Copyright (C) 1993-2026 Abhishek Choudhary | GPL-3.0-or-later
 * Per-frontend host facts shared by the workbench, CLI, and highlighter.
 */
import type { FrontendGroup, FrontendMeta } from "./protocol.ts";
import { binOf } from "./tools.ts";

export const FRONTEND_META: Record<string, FrontendMeta> = {
  c: { ext: ".c", monaco: "c", ilm: true },
  cppp: { ext: ".c", monaco: "c", ilm: true },
  cpp: { ext: ".cpp", monaco: "cpp", ilm: true },
  python: { ext: ".py", monaco: "python", ilm: false },
  javascript: { ext: ".js", monaco: "javascript", ilm: false },
  typescript: { ext: ".ts", monaco: "typescript", ilm: false },
  pascal: { ext: ".pas", monaco: "pascal", ilm: false },
  basic: { ext: ".bas", monaco: "vb", ilm: true },
  java: { ext: ".java", monaco: "java", ilm: true },
  smalltalk: { ext: ".st", monaco: "plaintext", ilm: false },
  haskell: { ext: ".hs", monaco: "plaintext", ilm: false },
  lisp: { ext: ".lisp", monaco: "plaintext", ilm: false },
  prolog: { ext: ".pl", monaco: "plaintext", ilm: false },
  fortran: { ext: ".f90", monaco: "plaintext", ilm: false },
  go: { ext: ".go", monaco: "go", ilm: false },
  rust: { ext: ".rs", monaco: "rust", ilm: false },
  julia: { ext: ".jl", monaco: "plaintext", ilm: false },
  lua: { ext: ".lua", monaco: "lua", ilm: false },
  zig: { ext: ".zig", monaco: "plaintext", ilm: false },
  make: { ext: ".mk", monaco: "plaintext", ilm: false },
  asm: { ext: ".s", monaco: "plaintext", ilm: false },
  kconfig: { ext: ".kconfig", monaco: "plaintext", ilm: false },
  ld: { ext: ".lds", monaco: "plaintext", ilm: false },
  scheme: { ext: ".scm", monaco: "plaintext", ilm: false },
  forth: { ext: ".fs", monaco: "plaintext", ilm: false },
  ocaml: { ext: ".ml", monaco: "plaintext", ilm: false },
  clojure: { ext: ".clj", monaco: "plaintext", ilm: false },
  csharp: { ext: ".cs", monaco: "csharp", ilm: true },
  kotlin: { ext: ".kt", monaco: "plaintext", ilm: false },
  swift: { ext: ".swift", monaco: "swift", ilm: false },
  scala: { ext: ".scala", monaco: "plaintext", ilm: false },
  dart: { ext: ".dart", monaco: "plaintext", ilm: false },
  ada: { ext: ".adb", monaco: "plaintext", ilm: false },
  ruby: { ext: ".rb", monaco: "ruby", ilm: false },
  perl: { ext: ".pl", monaco: "perl", ilm: false },
  php: { ext: ".php", monaco: "php", ilm: false },
  r: { ext: ".R", monaco: "r", ilm: false },
  cobol: { ext: ".cob", monaco: "plaintext", ilm: false },
  sql: { ext: ".sql", monaco: "sql", ilm: false },
  octave: { ext: ".m", monaco: "plaintext", ilm: false },
  sysml: { ext: ".sysml", monaco: "plaintext", ilm: false },
  panini: { ext: ".pni", monaco: "plaintext", ilm: false },
  logo: { ext: ".logo", monaco: "plaintext", ilm: false },
  lex: { ext: ".l", monaco: "plaintext", ilm: false },
  yacc: { ext: ".y", monaco: "plaintext", ilm: false },
};

export const GROUP_ORDER: FrontendGroup[] = [
  "panini",
  "systems",
  "kernel",
  "dynamic",
  "classic",
  "lowhanging",
];

export function metaOf(id: string): FrontendMeta {
  return FRONTEND_META[id] || { ext: ".txt", monaco: "plaintext", ilm: false };
}

export function cliFor(id: string, file?: string, ilm?: string): string {
  const m = metaOf(id);
  const target = file || `program${m.ext}`;
  const ilmBit = ilm && ilm !== "en" ? ` --ilm ${ilm}` : "";
  return `${binOf(id)} ${target}${ilmBit}`;
}
