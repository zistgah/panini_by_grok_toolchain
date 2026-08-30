/* Copyright (C) 1993-2026 Abhishek Choudhary | GPL-3.0-or-later
 * Workbench examples: workhorse programs, not 40+2 toys.
 * Each frontend has a run example that exercises the named extract, plus an error case.
 */
import type { Example } from "./protocol.ts";

const E = (
  id: string,
  title: string,
  blurb: string,
  source: string,
  kind: Example["kind"] = "run",
  expect?: Example["expect"],
  files?: Example["files"],
): Example => ({ id, title, blurb, source: source.replace(/^\n/, ""), kind, expect, files });

export const EXAMPLES: Record<string, Example[]> = {
  c: [
    E(
      "factorial",
      "Factorial",
      "Recursive factorial. Entry is main; the value is the process result.",
      `int factorial(int n) {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
}

int main(void) {
    return factorial(6);
}
`,
      "run",
      { ok: true, value: 720 },
    ),
    E(
      "split",
      "Two files",
      "Two translation units. panc fact.c main.c amalgamates. --native passes both to cc like gcc a.c b.c -o prog.",
      `int factorial(int n) {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
}

int factorial(int n);

int main(void) {
    return factorial(6);
}
`,
      "run",
      { ok: true, value: 720 },
      [
        {
          name: "fact.c",
          text: `int factorial(int n) {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
}
`,
        },
        {
          name: "main.c",
          text: `int factorial(int n);

int main(void) {
    return factorial(6);
}
`,
        },
      ],
    ),
    E(
      "gcd",
      "Euclid GCD",
      "Iterative Euclid. 1071 and 462 share 21.",
      `int gcd(int a, int b) {
    while (b) {
        int t = a % b;
        a = b;
        b = t;
    }
    return a;
}

int main(void) {
    return gcd(1071, 462);
}
`,
      "run",
      { ok: true, value: 21 },
    ),
    E(
      "sumloop",
      "Sum 1..n",
      "Counted for-loop. Sum of 1..20 is 210.",
      `int main(void) {
    int n = 20;
    int s = 0;
    int i;
    for (i = 1; i <= n; i = i + 1) {
        s = s + i;
    }
    return s;
}
`,
      "run",
      { ok: true, value: 210 },
    ),
    E(
      "unbalanced",
      "Unbalanced braces",
      "Deliberate compile error — diagnostics must name the line.",
      `int main(void) {
    int x = 1;
    if (x) {
        return x;
    /* missing closer */
}
`,
      "error",
    ),
  ],
  cppp: [
    E(
      "macro",
      "Object + function macros",
      "cpp phases 1–4: #define, function-like, #ifdef.",
      `#define ANSWER 40
#define ADD(a, b) ((a) + (b))
#ifdef ANSWER
int main(void) { return ADD(ANSWER, 2); }
#else
int main(void) { return 0; }
#endif
`,
      "run",
      { ok: true, value: 42 },
    ),
    E(
      "guards",
      "Include guards",
      "Object macros and #ifndef/#define/#endif.",
      `#ifndef PANINI_H
#define PANINI_H
#define N 21
#endif
int main(void) { return N + N; }
`,
      "run",
      { ok: true, value: 42 },
    ),
  ],
  cpp: [
    E(
      "bool",
      "bool and ternary",
      "C++ named extract: bool, true, the ternary that lowers to C.",
      `int main() {
    bool ok = true;
    int n = ok ? 40 + 2 : 0;
    return n;
}
`,
      "run",
      { ok: true, value: 42 },
    ),
    E(
      "enum",
      "enum values",
      "enum constants used in arithmetic.",
      `enum E { some, thing, other = 40 };
int main() {
    return other + 2;
}
`,
      "run",
    ),
  ],
  python: [
    E(
      "factorial",
      "Recursive factorial",
      "def / if / return. main is the entry.",
      `def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)

def main():
    return factorial(6)
`,
      "run",
      { ok: true, value: 720 },
    ),
    E(
      "gcd",
      "Euclid GCD",
      "While-less Euclid via recursion + print.",
      `def gcd(a, b):
    if b == 0:
        return a
    return gcd(b, a % b)

def main():
    n = gcd(1071, 462)
    print(n)
    return n
`,
      "run",
      { ok: true, value: 21 },
    ),
    E(
      "nameerror",
      "Undefined name",
      "Diagnostics must name the missing binding.",
      `def main():
    return missing(6)
`,
      "error",
    ),
  ],
  javascript: [
    E(
      "arith",
      "Integer + Test262 guard",
      "ECMA-262 extract: var, arithmetic, !==, throw. (function/while are GAP on this host.)",
      `var a = 40 + 2;
if (a !== 42) throw new Test262Error("add");
var b = 6 * 7;
if (b !== 42) throw new Test262Error("mul");
if (!true) throw new Test262Error("not");
`,
      "run",
    ),
    E(
      "logical",
      "Logical not / types",
      "Unary and additive extract.",
      `var x = 1 + 1;
if (x !== 2) throw new Test262Error("x");
if (!true) throw new Test262Error("not");
`,
      "run",
    ),
  ],
  typescript: [
    E(
      "enum",
      "enum + unary plus",
      "Types stripped; enum members are numbers.",
      `var a = +1;
enum E { some, thing }
var c = +E.some;
var d = +E.thing;
`,
      "run",
    ),
    E(
      "annot",
      "Type annotations stripped",
      "Parameter and return annotations vanish before js262.",
      `function add(a: number, b: number): number {
  return a + b;
}
var n = add(40, 2);
`,
      "run",
    ),
  ],
  pascal: [
    E(
      "hello",
      "hello.pas",
      "ISO 7185 accept: program / begin / writeln / end.",
      `program hello;
begin
  writeln('hello');
end.
`,
      "run",
    ),
    E(
      "arith",
      "Integer function",
      "Pascal function returning an integer.",
      `program arith;
function add(a, b: integer): integer;
begin
  add := a + b;
end;
begin
  writeln(add(40, 2));
end.
`,
      "run",
    ),
  ],
  basic: [
    E(
      "expr",
      "CONST expression",
      "QB64 Phoenix const/expression extract.",
      `CONST a = 1 + 2 * 3
CONST b = (40 + 2)
PRINT a
PRINT b
`,
      "run",
    ),
    E(
      "loop",
      "FOR / NEXT sum",
      "Classic counted loop.",
      `DIM s
s = 0
FOR i = 1 TO 10
  s = s + i
NEXT i
PRINT s
`,
      "run",
    ),
  ],
  java: [
    E(
      "class",
      "Simple method",
      "Compile-accept class body. LambdaConv execute is GAP.",
      `class T {
  static int add(int a, int b) {
    return a + b;
  }
  static int main() {
    return add(40, 2);
  }
}
`,
      "run",
    ),
    E(
      "parens",
      "Illegal paren-type (reject)",
      "OpenJDK Parens fail: named compile-error.",
      `class T { void f() { (int) i = 1; } }
`,
      "error",
    ),
  ],
  smalltalk: [
    E(
      "intmath",
      "Integer arithmetic",
      "GNU Smalltalk intmath.st class: + // remainder radix.",
      `Eval [ 3 + 4 ]
Eval [ 12 // 5 ]
Eval [ 12 \\\\ 5 ]
Eval [ 2r1010 ]
`,
      "run",
    ),
    E(
      "compare",
      "Comparisons",
      "Relational extract.",
      `Eval [ 3 < 4 ]
Eval [ 5 max: 2 ]
`,
      "run",
    ),
  ],
  haskell: [
    E(
      "cgrun",
      "where-bindings",
      "GHC codeGen should_run style: print of integer expr.",
      `main = print (1 + 2 + 32767 - 4)
`,
      "run",
    ),
    E(
      "let",
      "let-in",
      "let bindings flattened to the integer core.",
      `main = print (let x = 40 in x + 2)
`,
      "run",
    ),
  ],
  lisp: [
    E(
      "let",
      "LET + arithmetic",
      "ANSI extract: LET / + / *. defun is GAP on the browser host.",
      `(let ((a 40) (b 2))
  (+ a (* b 1)))
`,
      "run",
    ),
    E(
      "deftest",
      "deftest extract",
      "ansi-test self-contained deftest.",
      `(deftest arith.1
  (+ 40 2)
  42)
`,
      "run",
    ),
  ],
  prolog: [
    E(
      "is",
      "is/2 arithmetic",
      "ISO 8.6/8.7 integer extract.",
      `X is 1+2.
Y is 6*7.
`,
      "run",
    ),
    E(
      "compare",
      "Comparisons",
      "Arithmetic comparison extract.",
      `X is 40+2.
X =:= 42.
X > 10.
`,
      "run",
    ),
  ],
  fortran: [
    E(
      "stop",
      "PROGRAM / INTEGER / STOP",
      "N2146-shaped integer program.",
      `PROGRAM P
  INTEGER :: N
  N = 40 + 2
  STOP 0
END PROGRAM
`,
      "run",
    ),
    E(
      "loop",
      "DO loop sum",
      "Counted DO. Official gfortran execute remains GAP.",
      `PROGRAM SUMN
  INTEGER :: I, S
  S = 0
  DO I = 1, 10
    S = S + I
  END DO
  STOP 0
END PROGRAM
`,
      "run",
    ),
  ],
  go: [
    E(
      "add",
      "func add",
      "package main + helper. Result is main's return.",
      `package main
func add(a int, b int) int {
    return a + b
}
func main() {
    return add(40, 2)
}
`,
      "run",
    ),
    E(
      "gcd",
      "GCD",
      "for as while. CORE extract.",
      `package main
func gcd(a int, b int) int {
    for b != 0 {
        t := a % b
        a = b
        b = t
    }
    return a
}
func main() {
    return gcd(1071, 462)
}
`,
      "run",
    ),
  ],
  rust: [
    E(
      "add",
      "fn add",
      "i32 integer extract. println! lowers to printf.",
      `fn add(a: i32, b: i32) -> i32 {
    return a + b;
}
fn main() -> i32 {
    return add(40, 2);
}
`,
      "run",
    ),
    E(
      "fact",
      "Recursive factorial",
      "fn + if. Recursion through the C host.",
      `fn factorial(n: i32) -> i32 {
    if n <= 1 { return 1; }
    return n * factorial(n - 1);
}
fn main() -> i32 {
    return factorial(6);
}
`,
      "run",
    ),
  ],
  julia: [
    E(
      "add",
      "function add",
      "function / end integer extract.",
      `function add(a, b)
    return a + b
end
function main()
    return add(40, 2)
end
`,
      "run",
    ),
    E(
      "fact",
      "Factorial",
      "Recursive function + end.",
      `function factorial(n)
    if n <= 1; return 1; end
    return n * factorial(n - 1)
end
function main()
    return factorial(6)
end
`,
      "run",
    ),
  ],
  lua: [
    E(
      "add",
      "function + assert",
      "Lua 5.4 named extract: assert, print, function.",
      `function add(a, b)
  return a + b
end
assert(1 + 1 == 2)
print(add(40, 2))
`,
      "run",
      { ok: true, value: 42 },
    ),
    E(
      "fact",
      "Recursive factorial",
      "Lua function recursion + print.",
      `function factorial(n)
  if n <= 1 then return 1 end
  return n * factorial(n - 1)
end
print(factorial(6))
`,
      "run",
    ),
    E(
      "assertfail",
      "Failed assert",
      "assert must surface the expression.",
      `assert(1 + 1 == 3)
`,
      "error",
    ),
  ],
  zig: [
    E(
      "main",
      "pub fn main",
      "i32 return. zig test suite not retrieved.",
      `pub fn main() i32 {
    return 40 + 2;
}
`,
      "run",
    ),
    E(
      "add",
      "Helper fn",
      "Integer helper lowered to C.",
      `pub fn add(a: i32, b: i32) i32 {
    return a + b;
}
pub fn main() i32 {
    return add(40, 2);
}
`,
      "run",
    ),
  ],
  make: [
    E(
      "deps",
      "Variables, deps, recipes",
      "First target runs; deps fire first; $(FOO) $@ $< expand.",
      `FOO = panini
BAR ?= fallback
BAR += kernel

all: lib app
	echo $(FOO)
	echo done

lib:
	echo building-lib

app: lib
	echo building-app $(FOO)
`,
      "run",
    ),
    E(
      "ifeq",
      "ifeq / ifdef",
      "Conditional assignment the kernel build uses.",
      `MODE = release
ifeq ($(MODE),release)
CFLAGS = -O2
else
CFLAGS = -O0
endif
all:
	echo $(CFLAGS)
`,
      "run",
    ),
  ],
  asm: [
    E(
      "eax",
      "movl $imm, %eax",
      "AT&T integer subset. Result is %eax after ret.",
      `.text
.globl main
main:
    movl $40, %eax
    addl $2, %eax
    ret
`,
      "run",
      { ok: true, value: 42 },
    ),
    E(
      "loop",
      "Counted add via labels",
      "cmp / jcc / labels. Sum 1..5 in %eax.",
      `.text
.globl main
main:
    movl $0, %eax
    movl $1, %ebx
loop:
    cmpl $6, %ebx
    jge done
    addl %ebx, %eax
    addl $1, %ebx
    jmp loop
done:
    ret
`,
      "run",
    ),
  ],
  kconfig: [
    E(
      "bool",
      "config / bool / default",
      "Kernel config language. default y/n eval.",
      `config PANINI
	bool "Panini kernel token"
	default y
	depends on EXPERT

config EXPERT
	bool "Expert"
	default y

config NPROC
	int "Processors"
	default 4
`,
      "run",
    ),
    E(
      "tristate",
      "tristate + hex",
      "tristate/hex/string tokens.",
      `config DEBUG
	tristate "Debug"
	default n
config MAGIC
	hex "Magic"
	default 0xA5
`,
      "run",
    ),
  ],
  ld: [
    E(
      "vmlinux",
      "ENTRY + SECTIONS",
      "vmlinux.lds.S class. Tokens, not a linker.",
      `ENTRY(main)
SECTIONS {
  .text : { *(.text) }
  .rodata : { *(.rodata) }
  .data : { *(.data) }
  .bss  : { *(.bss) }
}
`,
      "run",
    ),
    E(
      "keep",
      "KEEP / ALIGN / PROVIDE",
      "Directives the kernel linker script uses.",
      `ENTRY(_start)
SECTIONS {
  .text ALIGN(16) : { KEEP(*(.text)) }
  PROVIDE(_end = .);
}
`,
      "run",
    ),
  ],
  scheme: [
    E(
      "factorial",
      "define factorial",
      "R5RS define / lambda / if integer extract.",
      `(define (factorial n)
  (if (<= n 1)
      1
      (* n (factorial (- n 1)))))
(factorial 6)
`,
      "run",
      { ok: true, value: 720 },
    ),
    E(
      "gcd",
      "gcd",
      "Named gcd primitive + define.",
      `(define (gcd a b)
  (if (= b 0)
      a
      (gcd b (remainder a b))))
(gcd 1071 462)
`,
      "run",
    ),
  ],
  forth: [
    E(
      "colon",
      "Colon definition",
      "ANS Forth integer: : word ; + . DUP.",
      `: SQUARE DUP * ;
: ADD + ;
40 2 ADD .
6 SQUARE .
`,
      "run",
    ),
    E(
      "tbrace",
      "T{ … }T",
      "Forth-2012 test harness extract.",
      `T{ 1 2 + -> 3 }T
T{ 6 7 * -> 42 }T
`,
      "run",
    ),
    E(
      "unknown",
      "Unknown word",
      "Unknown word must name itself.",
      `40 2 FROB .
`,
      "error",
    ),
  ],
  ocaml: [
    E(
      "add",
      "let add",
      "let / print_int integer extract.",
      `let add a b = a + b
let () = print_int (add 40 2)
`,
      "run",
    ),
    E(
      "rec",
      "let rec factorial",
      "Recursive let. Body is a single expression.",
      `let rec factorial n = n
let () = print_int (factorial 6)
`,
      "run",
    ),
  ],
  clojure: [
    E(
      "defn",
      "defn add",
      "Clojure-shaped list eval on the Scheme cousin.",
      `(defn add [a b] (+ a b))
(add 40 2)
`,
      "run",
    ),
    E(
      "fact",
      "Recursive defn",
      "if + recursion.",
      `(defn factorial [n]
  (if (<= n 1) 1 (* n (factorial (- n 1)))))
(factorial 6)
`,
      "run",
    ),
  ],
  csharp: [
    E(
      "main",
      "Console.WriteLine",
      "ECMA-334 integer Main extract. Desugars to C.",
      `using System;
class Program {
  static int Add(int a, int b) {
    return a + b;
  }
  static int Main() {
    int n = Add(40, 2);
    Console.WriteLine(n);
    return n;
  }
}
`,
      "run",
    ),
  ],
  kotlin: [
    E(
      "add",
      "fun add",
      "NumbersTest.kt integer extract.",
      `fun add(a: Int, b: Int): Int {
  return a + b
}
fun main(): Int {
  val n = add(40, 2)
  println(n)
  return n
}
`,
      "run",
    ),
  ],
  swift: [
    E(
      "add",
      "func add",
      "simple.swift integer run.",
      `func add(a: Int, b: Int) -> Int {
  return a + b
}
func main() -> Int {
  let n = add(40, 2)
  print(n)
  return n
}
`,
      "run",
    ),
  ],
  scala: [
    E(
      "object",
      "object / def main",
      "t0005.scala compile-accept class.",
      `object P {
  def add(a: Int, b: Int): Int = a + b
  def main(args: Array[String]): Int = {
    val n = add(40, 2)
    println(n)
    return n
  }
}
`,
      "run",
    ),
  ],
  dart: [
    E(
      "add",
      "int add",
      "operator_test.dart integer extract.",
      `int add(int a, int b) {
  return a + b;
}
int main() {
  var n = add(40, 2);
  print(n);
  return n;
}
`,
      "run",
    ),
  ],
  ada: [
    E(
      "main",
      "function Main",
      "ACATS C45411A-shaped INTEGER.",
      `function Main return Integer is
  N : Integer := 40 + 2;
begin
  return N;
end Main;
`,
      "run",
    ),
  ],
  ruby: [
    E(
      "add",
      "def add / puts",
      "Integer def/puts extract.",
      `def add(a, b)
  a + b
end
puts add(40, 2)
`,
      "run",
    ),
    E(
      "fact",
      "Recursive factorial",
      "def / end recursion.",
      `def factorial(n)
  return 1 if n <= 1
  n * factorial(n - 1)
end
puts factorial(6)
`,
      "run",
    ),
  ],
  perl: [
    E(
      "add",
      "sub add",
      "Integer sub/print extract.",
      `sub add {
  my ($a, $b) = @_;
  return $a + $b;
}
print add(40, 2);
`,
      "run",
    ),
  ],
  php: [
    E(
      "add",
      "function add",
      "Integer function/echo extract.",
      `<?php
function add($a, $b) {
  return $a + $b;
}
echo add(40, 2);
`,
      "run",
    ),
  ],
  r: [
    E(
      "add",
      "function / <-",
      "GNU R simple-true.R integer extract.",
      `add <- function(a, b) { a + b }
print(add(40, 2))
`,
      "run",
    ),
    E(
      "seq",
      "Integer sequence sum",
      "Named integer extract, not lowess/float.",
      `s <- 0
add <- function(a, b) { a + b }
print(add(20, 22))
`,
      "run",
    ),
  ],
  cobol: [
    E(
      "compute",
      "COMPUTE / DISPLAY",
      "ISO 1989 integer COMPUTE/DISPLAY.",
      `IDENTIFICATION DIVISION.
PROGRAM-ID. ADDN.
DATA DIVISION.
WORKING-STORAGE SECTION.
01 N PIC 9(4) VALUE 40.
PROCEDURE DIVISION.
    COMPUTE N = N + 2
    DISPLAY N
    STOP RUN.
`,
      "run",
    ),
  ],
  sql: [
    E(
      "select",
      "CREATE / INSERT / SELECT",
      "ISO 9075 integer extract. Not a DBMS.",
      `CREATE TABLE t (n INT);
INSERT INTO t VALUES (40);
SELECT n + 2 FROM t;
`,
      "run",
    ),
    E(
      "where",
      "WHERE filter",
      "Integer WHERE.",
      `CREATE TABLE t (n INT);
INSERT INTO t VALUES (40);
INSERT INTO t VALUES (2);
SELECT n FROM t WHERE n > 10;
`,
      "run",
    ),
  ],
  octave: [
    E(
      "add",
      "function / disp",
      "GNU Octave M-file integer extract.",
      `function r = add(a, b)
  r = a + b;
end
function r = main()
  n = add(40, 2);
  disp(n);
  r = n;
end
`,
      "run",
    ),
  ],
  sysml: [
    E(
      "constraint",
      "package / constraint",
      "SysML v2 textual named extract.",
      `package Demo {
  part def Motor {
    attribute power : Integer = 40;
  }
  constraint def Add { 40 + 2 }
}
`,
      "run",
    ),
  ],
  panini: [
    E(
      "factorial",
      "FUNCTION factorial",
      "Stage-0 integer core. Blocks close with END. Entry is main.",
      `FUNCTION factorial(n:Int) -> Int
    IF n <= 1
        RETURN 1
    ELSE
        RETURN n * factorial(n - 1)
    END
END

FUNCTION main() -> Int
    PRINT factorial(6)
    RETURN 0
END
`,
      "run",
    ),
    E(
      "gcd",
      "FUNCTION gcd",
      "Iterative remainder via IF. PRINT the result.",
      `FUNCTION gcd(a:Int, b:Int) -> Int
    IF b = 0
        RETURN a
    ELSE
        RETURN gcd(b, a - b * (a / b))
    END
END

FUNCTION main() -> Int
    PRINT gcd(1071, 462)
    RETURN 0
END
`,
      "run",
    ),
    E(
      "unknown",
      "Unknown function",
      "Calling a name that was never FUNCTION.",
      `FUNCTION main() -> Int
    RETURN missing(1)
END
`,
      "error",
    ),
  ],
  logo: [
    E(
      "square",
      "REPEAT square",
      "UCBLogo named extract. FORWARD/RIGHT.",
      `REPEAT 4 [ FORWARD 50 RIGHT 90 ]
`,
      "run",
    ),
    E(
      "hindi",
      "Hindi primitives",
      "आगे / दाएँ sit on the same extract.",
      `दोहराओ 4 [ आगे 40 दाएँ 90 ]
`,
      "run",
    ),
  ],
  lex: [
    E(
      "printf",
      "pattern { printf }",
      "flex named extract.",
      `%%
"ab+"  { printf("match"); }
%%
`,
      "run",
    ),
  ],
  yacc: [
    E(
      "calc",
      "Infix comment + printf",
      "yacc calculator named extract.",
      `expr: expr '+' expr { $$ = $1 + $3; }
    | NUMBER
    ;
/* 1+2*3 */
printf("calc");
`,
      "run",
    ),
  ],
};

export function examplesFor(id: string): Example[] {
  return EXAMPLES[id] || [];
}

export function exampleById(frontendId: string, exampleId?: string | null): Example | undefined {
  const list = examplesFor(frontendId);
  if (!list.length) return undefined;
  if (exampleId) return list.find((e) => e.id === exampleId) || list[0];
  return list.find((e) => e.kind === "run") || list[0];
}
