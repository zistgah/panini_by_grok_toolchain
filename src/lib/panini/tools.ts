/* Copyright (C) 1993-2026 Abhishek Choudhary | GPL-3.0-or-later
 * Named Unix tools. panc is not gcc. panpy is not CPython.
 * Each name is the same runner as the workbench, with compiler-shaped flags
 * and exit codes: 0 ok, 1 compile/runtime, 2 usage.
 */

export type Tool = {
  bin: string;
  id: string;
  title: string;
  what: "compiler" | "interpreter" | "preprocessor" | "assembler" | "build";
};

/** Frontend id → argv0. panini (the language) is panpni so `panini` stays the meta CLI. */
export const TOOLS: Tool[] = [
  { bin: "panc", id: "c", title: "C", what: "compiler" },
  { bin: "pancpp", id: "cppp", title: "cpp (preprocessor)", what: "preprocessor" },
  { bin: "pancxx", id: "cpp", title: "C++", what: "compiler" },
  { bin: "panpy", id: "python", title: "Python", what: "interpreter" },
  { bin: "panjs", id: "javascript", title: "ECMAScript", what: "interpreter" },
  { bin: "pants", id: "typescript", title: "TypeScript", what: "compiler" },
  { bin: "panpas", id: "pascal", title: "Pascal", what: "compiler" },
  { bin: "panbas", id: "basic", title: "BASIC / QB64", what: "interpreter" },
  { bin: "panjava", id: "java", title: "Java", what: "compiler" },
  { bin: "panst", id: "smalltalk", title: "Smalltalk", what: "interpreter" },
  { bin: "panhs", id: "haskell", title: "Haskell", what: "compiler" },
  { bin: "panlisp", id: "lisp", title: "Common Lisp", what: "interpreter" },
  { bin: "panpl", id: "prolog", title: "Prolog", what: "interpreter" },
  { bin: "panfort", id: "fortran", title: "Fortran", what: "compiler" },
  { bin: "pango", id: "go", title: "Go", what: "compiler" },
  { bin: "panrs", id: "rust", title: "Rust", what: "compiler" },
  { bin: "panjl", id: "julia", title: "Julia", what: "interpreter" },
  { bin: "panlua", id: "lua", title: "Lua", what: "interpreter" },
  { bin: "panzig", id: "zig", title: "Zig", what: "compiler" },
  { bin: "panmake", id: "make", title: "Make", what: "build" },
  { bin: "panas", id: "asm", title: "GNU as", what: "assembler" },
  { bin: "pankconfig", id: "kconfig", title: "Kconfig", what: "interpreter" },
  { bin: "panld", id: "ld", title: "GNU ld (script)", what: "compiler" },
  { bin: "panscm", id: "scheme", title: "Scheme", what: "interpreter" },
  { bin: "panforth", id: "forth", title: "Forth", what: "interpreter" },
  { bin: "panml", id: "ocaml", title: "OCaml", what: "compiler" },
  { bin: "panclj", id: "clojure", title: "Clojure", what: "interpreter" },
  { bin: "pancs", id: "csharp", title: "C#", what: "compiler" },
  { bin: "pankt", id: "kotlin", title: "Kotlin", what: "compiler" },
  { bin: "panswift", id: "swift", title: "Swift", what: "compiler" },
  { bin: "panscala", id: "scala", title: "Scala", what: "compiler" },
  { bin: "pandart", id: "dart", title: "Dart", what: "compiler" },
  { bin: "panada", id: "ada", title: "Ada", what: "compiler" },
  { bin: "panrb", id: "ruby", title: "Ruby", what: "interpreter" },
  { bin: "panperl", id: "perl", title: "Perl", what: "interpreter" },
  { bin: "panphp", id: "php", title: "PHP", what: "interpreter" },
  { bin: "panr", id: "r", title: "R", what: "interpreter" },
  { bin: "pancobol", id: "cobol", title: "COBOL", what: "compiler" },
  { bin: "pansql", id: "sql", title: "SQL", what: "interpreter" },
  { bin: "panoct", id: "octave", title: "GNU Octave", what: "interpreter" },
  { bin: "pansysml", id: "sysml", title: "SysML", what: "interpreter" },
  { bin: "panpni", id: "panini", title: "PANINI", what: "interpreter" },
  { bin: "panlogo", id: "logo", title: "Logo", what: "interpreter" },
  { bin: "panlex", id: "lex", title: "Lex / flex", what: "compiler" },
  { bin: "panyacc", id: "yacc", title: "Yacc / bison", what: "compiler" },
];

export const BIN_TO_ID: Record<string, string> = Object.fromEntries(TOOLS.map((t) => [t.bin, t.id]));
export const ID_TO_BIN: Record<string, string> = Object.fromEntries(TOOLS.map((t) => [t.id, t.bin]));
export const TOOL_BY_BIN: Record<string, Tool> = Object.fromEntries(TOOLS.map((t) => [t.bin, t]));

export function binOf(id: string): string {
  return ID_TO_BIN[id] || "panini";
}

export function idOfBin(bin: string): string | undefined {
  return BIN_TO_ID[bin];
}

export function toolHelp(bin: string): string {
  const t = TOOL_BY_BIN[bin];
  if (!t) return "";
  const kind =
    t.what === "compiler"
      ? "compiler (named extract, not gcc/javac/rustc)"
      : t.what === "preprocessor"
        ? "preprocessor (named extract, not GNU cpp)"
        : t.what === "assembler"
          ? "assembler (AT&T integer extract, not GNU as)"
          : t.what === "build"
            ? "make (named extract, not GNU make)"
            : "interpreter (named extract, not CPython/MRI/node)";
  return `${t.bin} — PANINI ${t.title} ${kind}

Usage:
  ${t.bin} file${t.bin === "panpy" ? ".py" : t.bin === "panc" ? ".c" : ""} [file...]
  ${t.bin} a.c b.c -o prog.wasm
  ${t.bin} -e 'source'
  ${t.bin} --example <name>
  ${t.bin} --dump-ast [file]
  ${t.bin} --read-ast file.json
  ${t.bin} --native a.c b.c -o prog
  ${t.bin} --keywords
  ${t.bin} --help

Flags:
  -o FILE             write artifact (wasm by default)
  -c                  compile only
  -S                  emit WAT
  --emit wasm|wat|c|ast
  --dump-ast          AST JSON (includes source for --read-ast)
  --read-ast FILE     compile from dumped AST
  --native            host cc/gcc/clang (workbench or Node). panpy: python3
  --run               run after emit
  -e, --source CODE   program text
  --example NAME      workbench example
  --ilm LANG          transduce native keywords to host
  --keywords          keyword × human-language table
  --examples          list examples
  -v, --verbose       dump phase / lowered / note
  --json              machine-readable result
  -h, --help          this help

Exit:
  0  ok
  1  compile or runtime diagnostic
  2  usage (missing file, unknown flag, unknown example)

Invoke from the workbench CLI pane, or as the ${t.bin} ELF after ./install.sh
(bin/${t.bin} is a real file, not a symlink). This is not the vendor toolchain.
Multi-file C is amalgamated (one main), except --native which passes every file
to the host compiler like gcc a.c b.c -o prog.
`;
}
