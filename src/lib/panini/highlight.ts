/* Copyright (C) 1993-2026 Abhishek Choudhary | GPL-3.0-or-later */

export type TokenKind = "kw" | "str" | "num" | "cmt" | "id" | "op" | "dir" | "plain";

export type HlToken = { kind: TokenKind; text: string };

const KW: Record<string, string[]> = {
  c: "int return void if else while for do char goto break continue struct typedef sizeof union enum switch case default const static unsigned signed long short float double include define ifdef ifndef endif".split(" "),
  cpp: "int return void if else while for do class public private protected virtual bool true false new delete namespace template typename using const static".split(" "),
  cppp: "int return void if else while for do char define ifdef ifndef endif include undef pragma".split(" "),
  python: "def return if else elif while for in True False None class import from as pass break continue and or not print assert".split(" "),
  javascript: "var let const function if else return throw new typeof instanceof true false null undefined class".split(" "),
  typescript: "var let const function if else return throw new typeof class enum interface type as implements".split(" "),
  pascal: "program begin end procedure function if then else while do for to var const integer writeln".split(" "),
  basic: "CONST PRINT IF THEN ELSE FOR NEXT DIM SUB FUNCTION END GOTO WHILE WEND".split(" "),
  java: "class void public static int if else return new true false package import".split(" "),
  smalltalk: "Eval true false nil self super".split(" "),
  haskell: "main where let in print module if then else".split(" "),
  lisp: "defun let if quote lambda deftest t nil".split(" "),
  scheme: "define lambda if quote let cond else".split(" "),
  clojure: "defn def if let fn nil true false".split(" "),
  prolog: "is true fail".split(" "),
  fortran: "PROGRAM INTEGER STOP IF THEN END DO ELSE RETURN PRINT".split(" "),
  go: "package func return if for var const import type struct else".split(" "),
  rust: "fn let mut if return pub struct impl match else true false".split(" "),
  julia: "function end return if else for while true false".split(" "),
  lua: "function end local return if then else elseif while do for in true false nil assert print not and or".split(" "),
  zig: "pub fn return const var if else while for i32 void".split(" "),
  make: "ifeq ifneq ifdef ifndef endif include else export unexport override define endef".split(" "),
  asm: "movl addl subl xorl andl orl cmpl testl jmp je jne jl jg jle jge ret call push pop nop syscall mov add sub xor and or cmp test lea inc dec".split(" "),
  kconfig: "config menuconfig bool tristate string int hex default depends select help menu endmenu choice endchoice source if endif visible".split(" "),
  ld: "ENTRY SECTIONS MEMORY KEEP ALIGN PROVIDE OUTPUT_FORMAT OUTPUT_ARCH INPUT GROUP ASSERT HIDDEN".split(" "),
  forth: "DUP SWAP DROP OVER ROT . : ;".split(" "),
  ocaml: "let rec in if then else match with print_int fun".split(" "),
  panini: "MODULE END FUNCTION RETURN IF ELSE WHILE FOR FOREACH TRUE FALSE PRINT ASSERT CONSTITUTION CONST VAR".split(" "),
  csharp: "class static void int return if else while for using namespace public private protected internal new bool true false var Console WriteLine Main".split(" "),
  kotlin: "fun val var if else return class object println print Int Boolean true false".split(" "),
  swift: "func let var if else return import print Int Bool true false".split(" "),
  scala: "def val var object class if else return println print Int Boolean true false".split(" "),
  dart: "int void var final const if else return print true false class".split(" "),
  ada: "procedure function is begin end return Integer if then else loop while".split(" "),
  ruby: "def end puts print if else elsif while do class module return true false nil".split(" "),
  perl: "sub my our print say if else elsif while for return use".split(" "),
  php: "function echo print if else while for return class new true false".split(" "),
  r: "function if else for while repeat next break TRUE FALSE NULL print cat".split(" "),
  cobol: "IDENTIFICATION DIVISION PROGRAM-ID DATA WORKING-STORAGE PROCEDURE COMPUTE ADD MOVE DISPLAY STOP RUN PIC VALUE IF END-IF".split(" "),
  sql: "SELECT FROM WHERE INSERT INTO VALUES CREATE TABLE AS AND OR NOT INT".split(" "),
  octave: "function end endfunction if else for while disp fprintf true false".split(" "),
  sysml: "package part def attribute constraint requirement Integer".split(" "),
  logo: "REPEAT FORWARD BACK RIGHT LEFT PENUP PENDOWN HOME NORTH SOUTH EAST WEST".split(" "),
  lex: "%% printf".split(" "),
  yacc: "expr NUMBER printf".split(" "),
};

function lineComment(lang: string): string | null {
  if (["python", "forth"].includes(lang)) return "#";
  if (["lua", "haskell", "sql", "ada"].includes(lang)) return "--";
  if (lang === "fortran") return "!";
  if (["lisp", "scheme", "clojure", "asm", "make", "kconfig", "lex", "yacc"].includes(lang)) return lang === "lisp" || lang === "scheme" || lang === "clojure" ? ";" : "#";
  if (lang === "basic" || lang === "cobol") return lang === "cobol" ? "*" : "'";
  if (lang === "smalltalk") return null;
  if (["ruby", "perl", "r", "php"].includes(lang)) return "#";
  if (lang === "octave") return "%";
  return "//";
}

export function keywordsOf(lang: string): string[] {
  return [...(KW[lang] || KW.c)];
}

export function highlight(lang: string, source: string): HlToken[] {
  const kws = new Set((KW[lang] || KW.c).map((k) => (lang === "basic" || lang === "fortran" || lang === "forth" || lang === "panini" ? k : k)));
  const caseInsensitive = ["basic", "fortran", "forth", "pascal"].includes(lang);
  const cmt = lineComment(lang);
  const tokens: HlToken[] = [];
  let i = 0;
  const s = source;
  const n = s.length;
  const push = (kind: TokenKind, text: string) => {
    if (text) tokens.push({ kind, text });
  };
  while (i < n) {
    const c = s[i];
    if (cmt && s.startsWith(cmt, i) && !(lang === "c" && cmt === "//" && false)) {
      let j = i;
      while (j < n && s[j] !== "\n") j++;
      push("cmt", s.slice(i, j));
      i = j;
      continue;
    }
    if (c === "/" && s[i + 1] === "*" && ["c", "cpp", "cppp", "java", "javascript", "typescript", "go", "rust", "css"].includes(lang)) {
      let j = i + 2;
      while (j + 1 < n && !(s[j] === "*" && s[j + 1] === "/")) j++;
      j = Math.min(n, j + 2);
      push("cmt", s.slice(i, j));
      i = j;
      continue;
    }
    if (c === "(" && s[i + 1] === "*" && lang === "ocaml") {
      let j = i + 2;
      while (j + 1 < n && !(s[j] === "*" && s[j + 1] === ")")) j++;
      j = Math.min(n, j + 2);
      push("cmt", s.slice(i, j));
      i = j;
      continue;
    }
    if (c === '"' || (c === "'" && lang !== "smalltalk")) {
      const q = c;
      let j = i + 1;
      while (j < n && s[j] !== q) {
        if (s[j] === "\\") j += 2;
        else j++;
      }
      j = Math.min(n, j + 1);
      push("str", s.slice(i, j));
      i = j;
      continue;
    }
    if (c === "." && lang === "asm") {
      let j = i + 1;
      while (j < n && /[A-Za-z_]/.test(s[j])) j++;
      push("dir", s.slice(i, j));
      i = j;
      continue;
    }
    if (c === "#" && ["c", "cpp", "cppp"].includes(lang)) {
      let j = i + 1;
      while (j < n && s[j] !== "\n") j++;
      push("dir", s.slice(i, j));
      i = j;
      continue;
    }
    if (/[0-9]/.test(c) || (c === "$" && lang === "asm")) {
      let j = i + 1;
      while (j < n && /[0-9a-fA-FxX]/.test(s[j])) j++;
      push("num", s.slice(i, j));
      i = j;
      continue;
    }
    if (/[A-Za-z_%]/.test(c)) {
      let j = i + 1;
      while (j < n && /[A-Za-z0-9_']/.test(s[j])) j++;
      const w = s.slice(i, j);
      const key = caseInsensitive ? w.toUpperCase() : w;
      const set = caseInsensitive ? new Set([...kws].map((x) => x.toUpperCase())) : kws;
      if (set.has(key) || (lang === "asm" && w.startsWith("%"))) push("kw", w);
      else push("id", w);
      i = j;
      continue;
    }
    push("plain", c);
    i++;
  }
  return tokens;
}

export function colorOf(kind: TokenKind): string {
  switch (kind) {
    case "kw":
      return "var(--syn-kw)";
    case "str":
      return "var(--syn-str)";
    case "num":
      return "var(--syn-num)";
    case "cmt":
      return "var(--syn-cmt)";
    case "dir":
      return "var(--syn-dir)";
    case "id":
      return "var(--syn-id)";
    default:
      return "var(--syn-plain)";
  }
}
