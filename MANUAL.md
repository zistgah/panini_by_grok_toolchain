# PANINI named toolchain — manual

Copyright (C) 1993-2026 Abhishek Choudhary
GPL-3.0-or-later

panc is not gcc. panpy is not CPython. Each `bin/pan*` is a real ELF.
Default with no flags: the named extract runs. `-o` emits WASM. `--native` is host cc.

## Install

```
unzip panini-toolchain.zip && cd panini-toolchain
./install.sh                 # ~/.local/bin
./install.sh /usr/local
export PATH="$HOME/.local/bin:$PATH"
panc --example factorial     # 720
panpy --example gcd          # 21
```

## Flags (every frontend)

- `file…` — named source files (tabs in the workbench, paths on the ELF)
- `-o FILE` — write artifact; WASM unless --native
- `-c` — compile only (do not run)
- `-S` — emit WAT
- `--emit wasm|wat|c|ast` — choose the PANINI backend product
- `--dump-ast` — AST JSON (includes source for --read-ast)
- `--read-ast FILE` — compile from a dumped AST
- `--native` — host cc/gcc/clang (C/C++/as) or python3 (panpy)
- `--run` — run after emit
- `-e CODE` — program text instead of a file
- `--example NAME` — workbench example
- `--ilm LANG` — transduce native keywords to host C
- `--keywords` — keyword × human-language table
- `-v / --json / --help` — verbose · machine result · usage

## Exit

- 0 — ok
- 1 — compile or runtime diagnostic
- 2 — usage (missing file, unknown flag, unknown example)

## Human languages (ILM)

C-keyword maps. Hindi bar is 29. Empty cell = no invented translation.

- Arabic (arabic) — Arabic, 29 rows
- Aramaic (aramaic) — Aramaic, 29 rows
- Assamese (assamese) — Bengali-Assamese, 29 rows
- Bengali (bengali) — Bengali, 29 rows
- Dari (dari) — Perso-Arabic, 29 rows
- Gujarati (gujarati) — Gujarati, 29 rows
- Hebrew (hebrew) — Hebrew, 29 rows
- Hindi (hindi) — Devanagari, 29 rows
- Kannada (kannada) — Kannada, 29 rows
- Kashmiri (kashmiri) — Perso-Arabic, 29 rows
- Malayalam (malayalam) — Malayalam, 29 rows
- Marathi (marathi) — Devanagari, 29 rows
- Nepali (nepali) — Devanagari, 29 rows
- Odia (odia) — Odia, 29 rows
- Pali (pali) — Devanagari, 29 rows
- Pashto (pashto) — Perso-Arabic, 29 rows
- Persian (persian) — Perso-Arabic, 29 rows
- Phoenician (phoenician) — Phoenician, 29 rows
- Prakrit (prakrit) — Devanagari, 29 rows
- Punjabi (punjabi) — Gurmukhi, 29 rows
- Sanskrit (sanskrit) — Devanagari, 29 rows
- Punjabi Shahmukhi (shahmukhi) — Perso-Arabic (Shahmukhi), 29 rows
- Sindhi (sindhi) — Perso-Arabic, 29 rows
- Syriac (syriac) — Syriac, 29 rows
- Tamil (tamil) — Tamil, 29 rows
- Telugu (telugu) — Telugu, 29 rows
- Urdu (urdu) — Perso-Arabic (Nastaliq), 29 rows

## Test suites

STANDARD GREEN is a named issuing-body extract. CORE GREEN is a homemade set until that extract exists. The gap column is what is *not* claimed.

| bin | language | suite | gap | WASM | host |
|---|---|---|---|---|---|
| panc | C | WG14 N1570 + c-testsuite single-exec 104 | Full gcc torture / libgcc | yes | cc |
| pancpp | cpp (preprocessor) | N1570 translation phases 1–4 via CPP() | full gcc.dg/cpp | yes | cc |
| pancxx | C++ | WG21 N4296 + g++.dg/expr named extract 5 | Full libstdc++ / gcc torture | yes | c++ |
| panpy | Python | CPython 3.12 Lib/test language extract 68 | Full CPython Lib/test (unittest) | — | python3 |
| panjs | ECMAScript | ECMA-262 + Test262 language extract 13 | built-ins, async, modules | — | — |
| pants | TypeScript | tsc v5.4.5 compiler unaryPlus + 2dArrays | full tsc checker | — | — |
| panpas | Pascal | ISO 7185 via Pascal-P5 PRT reject + hello.pas | iso7185pat.pas 123 KB | yes | — |
| panbas | BASIC / QB64 | QB64pe tests/compile_tests/const/expression.bas 38 | QB64 graphics / $INCLUDE | — | — |
| panjava | Java | OpenJDK javac Parens1/2/3 fail + LambdaConv01 accept | LambdaConv01 execute | yes | — |
| panst | Smalltalk | GNU Smalltalk tests/intmath.st Eval before LargeIntegers 31 | LargeIntegers | — | — |
| panhs | Haskell | GHC codeGen should_run cgrun001/002/005 | full GHC testsuite | — | — |
| panlisp | Common Lisp | ansi-test self-contained deftest 19 | full ansi-test | — | — |
| panpl | Prolog | Ciao iso_tests ISO 8.6/8.7 arith 23 | bagof/setof/IO | — | — |
| panfort | Fortran | gfortran.dg execute (retrieved, not skip=0) | gfortran execute skip=0 | yes | — |
| pango | Go | CORE 20-case; all.bash not skip=0 | all.bash | yes | — |
| panrs | Rust | CORE 20-case; rustc ui not skip=0 | rustc ui | yes | — |
| panjl | Julia | CORE 20-case | Julia test suite | yes | — |
| panlua | Lua | Lua 5.4 named extract (assert/print/function) | lua-5.4.7 tests skip=0 | — | — |
| panzig | Zig | CORE 20-case | zig behavior tests | yes | — |
| panmake | Make | GNU make manual Setting Variables / echo / deps | full GNU make testsuite / kbuild | — | — |
| panas | GNU as | gas integer mov/add/ret + comment.s class | ld / ELF / full gas testsuite | — | cc |
| pankconfig | Kconfig | Linux Kconfig language named extract (config/bool/default) | scripts/kconfig (conf, mconf, nconf) | — | — |
| panld | GNU ld (script) | GNU ld script tokens (ENTRY / SECTIONS) | actual relocation / ELF emission | — | — |
| panscm | Scheme | R5RS integer/define/lambda named extract | R5RS/R7RS suite skip=0 | — | — |
| panforth | Forth | ANS Forth integer named extract | gforth tests skip=0 | — | — |
| panml | OCaml | OCaml integer let/print_int named extract | ocaml testsuite skip=0 | — | — |
| panclj | Clojure | Clojure-shaped list eval (Scheme cousin) | official Clojure suite | — | — |
| pancs | C# | ECMA-334 integer Main/Console named extract | roslyn / ECMA-334 suite skip=0 | yes | — |
| pankt | Kotlin | Kotlin NumbersTest.kt Int.MIN/MAX + one (4) | Long/Short/Byte overflow / kotlinc box | yes | — |
| panswift | Swift | Swift IntegerDiagnostics expected-error + simple.swift run (2) | Full stdlib/Int.swift | yes | — |
| panscala | Scala | Scala t0005.scala def main compile-accept | unapply/match execute / full scalac | yes | — |
| pandart | Dart | Dart operator_test.dart i1/i2 Expect.equals integer extract | operator-overload class / language/arithmetic | yes | — |
| panada | Ada | ISO/IEC 8652 ACATS C45411A unary +/− INTEGER (1) | full ACATS / INTEGER'IMAGE | yes | — |
| panrb | Ruby | ISO/IEC 30170-shaped def/puts named extract | MRI / RubySpec skip=0 | — | — |
| panperl | Perl | Perl integer sub/print named extract | perlpolicy suite skip=0 | — | — |
| panphp | PHP | PHP integer function/echo named extract | php-src suite skip=0 | — | — |
| panr | R | GNU R simple-true.R 1:12 cumsum + typeof integer L (5) | lowess/polyroot/float | — | — |
| pancobol | COBOL | ISO/IEC 1989 integer COMPUTE/DISPLAY named extract | gnucobol suite skip=0 | — | — |
| pansql | SQL | ISO/IEC 9075 integer SELECT/INSERT named extract | ISO 9075 suite skip=0 | — | — |
| panoct | GNU Octave | GNU Octave M-file integer function/disp named extract | Octave test suite skip=0 | — | — |
| pansysml | SysML | SysML v2 textual package/part/constraint named extract | full SysML v2 model-check | — | — |
| panpni | PANINI | Stage-0 integer FUNCTION/IF/RETURN/PRINT | browser is a subset of the Node host parser | — | — |
| panlogo | Logo | UCBLogo named extract (REPEAT / FORWARD / RIGHT) | full UCBLogo suite | — | — |
| panlex | Lex / flex | flex named extract (pattern { printf }) | POSIX lex / full flex | — | — |
| panyacc | Yacc / bison | yacc calculator named extract | full POSIX yacc | — | — |

## Binaries

| bin | language | what | ext | ILM | examples |
|---|---|---|---|---|---|
| panc | C | compiler | .c | yes | factorial, split, gcd, sumloop, unbalanced |
| pancpp | cpp (preprocessor) | preprocessor | .c | yes | macro, guards |
| pancxx | C++ | compiler | .cpp | yes | bool, enum |
| panpy | Python | interpreter | .py | — | factorial, gcd, nameerror |
| panjs | ECMAScript | interpreter | .js | — | arith, logical |
| pants | TypeScript | compiler | .ts | — | enum, annot |
| panpas | Pascal | compiler | .pas | — | hello, arith |
| panbas | BASIC / QB64 | interpreter | .bas | yes | expr, loop |
| panjava | Java | compiler | .java | yes | class, parens |
| panst | Smalltalk | interpreter | .st | — | intmath, compare |
| panhs | Haskell | compiler | .hs | — | cgrun, let |
| panlisp | Common Lisp | interpreter | .lisp | — | let, deftest |
| panpl | Prolog | interpreter | .pl | — | is, compare |
| panfort | Fortran | compiler | .f90 | — | stop, loop |
| pango | Go | compiler | .go | — | add, gcd |
| panrs | Rust | compiler | .rs | — | add, fact |
| panjl | Julia | interpreter | .jl | — | add, fact |
| panlua | Lua | interpreter | .lua | — | add, fact, assertfail |
| panzig | Zig | compiler | .zig | — | main, add |
| panmake | Make | build | .mk | — | deps, ifeq |
| panas | GNU as | assembler | .s | — | eax, loop |
| pankconfig | Kconfig | interpreter | .kconfig | — | bool, tristate |
| panld | GNU ld (script) | compiler | .lds | — | vmlinux, keep |
| panscm | Scheme | interpreter | .scm | — | factorial, gcd |
| panforth | Forth | interpreter | .fs | — | colon, tbrace, unknown |
| panml | OCaml | compiler | .ml | — | add, rec |
| panclj | Clojure | interpreter | .clj | — | defn, fact |
| pancs | C# | compiler | .cs | yes | main |
| pankt | Kotlin | compiler | .kt | — | add |
| panswift | Swift | compiler | .swift | — | add |
| panscala | Scala | compiler | .scala | — | object |
| pandart | Dart | compiler | .dart | — | add |
| panada | Ada | compiler | .adb | — | main |
| panrb | Ruby | interpreter | .rb | — | add, fact |
| panperl | Perl | interpreter | .pl | — | add |
| panphp | PHP | interpreter | .php | — | add |
| panr | R | interpreter | .R | — | add, seq |
| pancobol | COBOL | compiler | .cob | — | compute |
| pansql | SQL | interpreter | .sql | — | select, where |
| panoct | GNU Octave | interpreter | .m | — | add |
| pansysml | SysML | interpreter | .sysml | — | constraint |
| panpni | PANINI | interpreter | .pni | — | factorial, gcd, unknown |
| panlogo | Logo | interpreter | .logo | — | square, hindi |
| panlex | Lex / flex | compiler | .l | — | printf |
| panyacc | Yacc / bison | compiler | .y | — | calc |

## panini

### panpni — PANINI

The language itself. Browser runs the integer core. Node self-host is a fixed point on 36 functions. Blocks close with END.

- suite: Stage-0 integer FUNCTION/IF/RETURN/PRINT
- gap: browser is a subset of the Node host parser
- module: src/panini/lexer.pni + parser.pni
- usage: `panpni program.pni`
- WASM: no
- host: no
- ILM: no
- keywords: MODULE, FUNCTION, END, IF, ELSE, WHILE, RETURN, PRINT, CONSTITUTION
- examples: factorial, gcd, unknown (err)

## systems

### panc — C

ISO C11 subset. Frozen lexer in PANINI. Lowering and heap eval are host-speed (same slot as CINTERP). This is the kernel compiler path — the host C the rest lower into.

- suite: WG14 N1570 + c-testsuite single-exec 104
- gap: Full gcc torture / libgcc
- module: src/panini/frontends/c.pni
- usage: `panc program.c`
- WASM: C extract backend (integer subset)
- host: cc
- ILM: yes
- keywords: int, return, if, else, while, for, struct, sizeof, typedef
- examples: factorial, split, gcd, sumloop, unbalanced (err)

### pancxx — C++

cpp.pni is frozen. Work is in cpplower.js. Named extract: enum1.C run + four dg-error files. Not libstdc++.

- suite: WG21 N4296 + g++.dg/expr named extract 5
- gap: Full libstdc++ / gcc torture
- module: src/panini/frontends/cpp.pni
- usage: `pancxx program.cpp`
- WASM: C extract backend (integer subset)
- host: c++
- ILM: yes
- keywords: class, bool, template, namespace, new, delete, virtual
- examples: bool, enum

### panfort — Fortran

Spec N2146 retrieved. Official execute is a named GAP. Homemade 20-case is CORE GREEN only.

- suite: gfortran.dg execute (retrieved, not skip=0)
- gap: gfortran execute skip=0
- module: src/panini/frontends/fortran.pni
- usage: `panfort program.f90`
- WASM: C extract backend (integer subset)
- host: no
- ILM: no
- keywords: PROGRAM, INTEGER, STOP, IF, THEN, END, DO
- examples: stop, loop

### pango — Go

Frozen frontend. CORE GREEN only until all.bash.

- suite: CORE 20-case; all.bash not skip=0
- gap: all.bash
- module: src/panini/frontends/go.pni
- usage: `pango program.go`
- WASM: C extract backend (integer subset)
- host: no
- ILM: no
- keywords: package, func, return, if, for, var, const
- examples: add, gcd

### panrs — Rust

Frozen frontend. CORE GREEN only.

- suite: CORE 20-case; rustc ui not skip=0
- gap: rustc ui
- module: src/panini/frontends/rust.pni
- usage: `panrs program.rs`
- WASM: C extract backend (integer subset)
- host: no
- ILM: no
- keywords: fn, let, mut, if, return, pub, struct
- examples: add, fact

### panzig — Zig

CORE GREEN. zig test suite not retrieved.

- suite: CORE 20-case
- gap: zig behavior tests
- module: src/panini/frontends/zig.pni
- usage: `panzig program.zig`
- WASM: C extract backend (integer subset)
- host: no
- ILM: no
- keywords: pub, fn, return, const, var, if
- examples: main, add

### pancs — C#

Shaili स्वर. Host-speed desugar to C. Not roslyn.

- suite: ECMA-334 integer Main/Console named extract
- gap: roslyn / ECMA-334 suite skip=0
- module: src/panini/frontends/csharp.pni
- usage: `pancs program.cs`
- WASM: C extract backend (integer subset)
- host: no
- ILM: yes
- keywords: class, static, int, return, Console, WriteLine, Main
- examples: main

### pankt — Kotlin

Shaili प्रवाह. STANDARD GREEN on NumbersTest.kt Int min/max. Not kotlinc.

- suite: Kotlin NumbersTest.kt Int.MIN/MAX + one (4)
- gap: Long/Short/Byte overflow / kotlinc box
- module: src/panini/frontends/kotlin.pni
- usage: `pankt program.kt`
- WASM: C extract backend (integer subset)
- host: no
- ILM: no
- keywords: fun, val, var, println, return
- examples: add

### panswift — Swift

Shaili शीघ्र. Apache-2.0 language. Not Apple Swift™. STANDARD GREEN on diagnostics reject + simple.swift.

- suite: Swift IntegerDiagnostics expected-error + simple.swift run (2)
- gap: Full stdlib/Int.swift
- module: src/panini/frontends/swift.pni
- usage: `panswift program.swift`
- WASM: C extract backend (integer subset)
- host: no
- ILM: no
- keywords: func, let, var, print, return
- examples: add

### pandart — Dart

Shaili बाण. STANDARD GREEN on operator_test.dart i1/i2 integer extract.

- suite: Dart operator_test.dart i1/i2 Expect.equals integer extract
- gap: operator-overload class / language/arithmetic
- module: src/panini/frontends/dart.pni
- usage: `pandart program.dart`
- WASM: C extract backend (integer subset)
- host: no
- ILM: no
- keywords: int, void, var, print, return
- examples: add

## kernel

### pancpp — cpp (preprocessor)

The preprocessor the kernel and gurucc already use. #define (object and function-like), #ifdef / #ifndef / #if / #else / #endif, #undef, stringizing, ##. Kernel .c files are cpp before cc.

- suite: N1570 translation phases 1–4 via CPP()
- gap: full gcc.dg/cpp
- module: runtime/ccpp.js
- usage: `pancpp program.c`
- WASM: C extract backend (integer subset)
- host: cc
- ILM: yes
- keywords: #define, #ifdef, #ifndef, #include, #undef, defined
- examples: macro, guards

### panmake — Make

POSIX/GNU make tokens the kernel build uses: VAR=, ?=, +=, target: deps, tab recipes, $(VAR), $@, $<, $^, ifeq/ifdef, include, obj-y. Not GNU make itself. Not full kbuild.

- suite: GNU make manual Setting Variables / echo / deps
- gap: full GNU make testsuite / kbuild
- module: src/panini/frontends/make.pni
- usage: `panmake program.mk`
- WASM: no
- host: no
- ILM: no
- keywords: ifeq, ifdef, include, obj-y, PHONY, export
- examples: deps, ifeq

### panas — GNU as

AT&T integer subset for kernel .s files. movl/addl/xorl/cmpl/jcc/push/pop/call/ret, directives .globl .text .type .size. Tokens first. Not ld, not ELF.

- suite: gas integer mov/add/ret + comment.s class
- gap: ld / ELF / full gas testsuite
- module: src/panini/frontends/asm.pni
- usage: `panas program.s`
- WASM: no
- host: cc
- ILM: no
- keywords: .globl, .text, movl, addl, ret, %eax, $imm
- examples: eax, loop

### pankconfig — Kconfig

Kconfig is how the kernel is configured. Tokens: config, menuconfig, bool, tristate, string, int, hex, default, depends on, select, help, menu, source. Eval applies default y/n.

- suite: Linux Kconfig language named extract (config/bool/default)
- gap: scripts/kconfig (conf, mconf, nconf)
- module: runtime extras (browser)
- usage: `pankconfig program.kconfig`
- WASM: no
- host: no
- ILM: no
- keywords: config, bool, tristate, default, depends, select, help
- examples: bool, tristate

### panld — GNU ld (script)

Linker scripts the kernel uses (vmlinux.lds.S class). Tokens: ENTRY, SECTIONS, MEMORY, KEEP, ALIGN, PROVIDE, OUTPUT_FORMAT. Not a linker — tokens + structure, which is what the architect asked for.

- suite: GNU ld script tokens (ENTRY / SECTIONS)
- gap: actual relocation / ELF emission
- module: runtime extras (browser)
- usage: `panld program.lds`
- WASM: no
- host: no
- ILM: no
- keywords: ENTRY, SECTIONS, KEEP, ALIGN, PROVIDE, MEMORY
- examples: vmlinux, keep

### panlex — Lex / flex

Tokens first. pattern → printf. POSIX lex / full flex suite is GAP.

- suite: flex named extract (pattern { printf })
- gap: POSIX lex / full flex
- module: runtime extras (browser)
- usage: `panlex program.l`
- WASM: no
- host: no
- ILM: no
- keywords: %%, printf
- examples: printf

### panyacc — Yacc / bison

Calculator named extract from HindiYACC host. Full POSIX yacc is GAP.

- suite: yacc calculator named extract
- gap: full POSIX yacc
- module: runtime extras (browser)
- usage: `panyacc program.y`
- WASM: no
- host: no
- ILM: no
- keywords: expr, NUMBER, %%
- examples: calc

## dynamic

### panpy — Python

Frozen PANINI frontend. STANDARD GREEN on self-contained CPython asserts. The workbench runs a host-speed def-main subset; Node uses python.pni.

- suite: CPython 3.12 Lib/test language extract 68
- gap: Full CPython Lib/test (unittest)
- module: src/panini/frontends/python.pni
- usage: `panpy program.py`
- WASM: no
- host: python3
- ILM: no
- keywords: def, return, if, else, for, while, True, False, None
- examples: factorial, gcd, nameerror (err)

### panjs — ECMAScript

Test262 if/types/addition/unary/logical-not/subtraction. new Object and member assign are in the extract.

- suite: ECMA-262 + Test262 language extract 13
- gap: built-ins, async, modules
- module: src/panini/frontends/javascript.pni
- usage: `panjs program.js`
- WASM: no
- host: no
- ILM: no
- keywords: var, let, const, function, if, return, throw, new
- examples: arith, logical

### pants — TypeScript

Types are stripped. unaryPlus executes; 2dArrays is compile-accept.

- suite: tsc v5.4.5 compiler unaryPlus + 2dArrays
- gap: full tsc checker
- module: src/panini/frontends/typescript.pni
- usage: `pants program.ts`
- WASM: no
- host: no
- ILM: no
- keywords: enum, interface, type, as, implements
- examples: enum, annot

### panjl — Julia

Frozen frontend. CORE GREEN only.

- suite: CORE 20-case
- gap: Julia test suite
- module: src/panini/frontends/julia.pni
- usage: `panjl program.jl`
- WASM: C extract backend (integer subset)
- host: no
- ILM: no
- keywords: function, end, return, if, else, for
- examples: add, fact

### panrb — Ruby

Shaili माणिक्य. Integer def/puts. Not MRI.

- suite: ISO/IEC 30170-shaped def/puts named extract
- gap: MRI / RubySpec skip=0
- module: src/panini/frontends/ruby.pni
- usage: `panrb program.rb`
- WASM: no
- host: no
- ILM: no
- keywords: def, end, puts, print, if, else
- examples: add, fact

### panperl — Perl

Shaili मोती. Integer sub/print. Not perl.

- suite: Perl integer sub/print named extract
- gap: perlpolicy suite skip=0
- module: src/panini/frontends/perl.pni
- usage: `panperl program.pl`
- WASM: no
- host: no
- ILM: no
- keywords: sub, my, print, say, return
- examples: add

### panphp — PHP

Shaili जालधर. Integer function/echo.

- suite: PHP integer function/echo named extract
- gap: php-src suite skip=0
- module: src/panini/frontends/php.pni
- usage: `panphp program.php`
- WASM: no
- host: no
- ILM: no
- keywords: function, echo, print, return
- examples: add

### panr — R

Shaili गणना. STANDARD GREEN on GNU R simple-true.R integer extract.

- suite: GNU R simple-true.R 1:12 cumsum + typeof integer L (5)
- gap: lowess/polyroot/float
- module: src/panini/frontends/r.pni
- usage: `panr program.R`
- WASM: no
- host: no
- ILM: no
- keywords: function, if, else, print, TRUE, FALSE
- examples: add, seq

### panoct — GNU Octave

Shaili मातृका. GNU Octave M files. Not MATLAB.

- suite: GNU Octave M-file integer function/disp named extract
- gap: Octave test suite skip=0
- module: src/panini/frontends/octave.pni
- usage: `panoct program.m`
- WASM: no
- host: no
- ILM: no
- keywords: function, end, endfunction, disp, if, else
- examples: add

## classic

### panpas — Pascal

Reject the official iso7185prt extract; accept hello.pas. Full PAT is GAP.

- suite: ISO 7185 via Pascal-P5 PRT reject + hello.pas
- gap: iso7185pat.pas 123 KB
- module: src/panini/frontends/pascal.pni
- usage: `panpas program.pas`
- WASM: C extract backend (integer subset)
- host: no
- ILM: no
- keywords: program, begin, end, procedure, function, if, then, var
- examples: hello, arith

### panbas — BASIC / QB64

Not ECMA-116. Not VB.NET. Named QB64 Phoenix expression extract.

- suite: QB64pe tests/compile_tests/const/expression.bas 38
- gap: QB64 graphics / $INCLUDE
- module: src/panini/frontends/basic.pni
- usage: `panbas program.bas`
- WASM: no
- host: no
- ILM: yes
- keywords: CONST, PRINT, IF, THEN, FOR, NEXT, DIM, SUB
- examples: expr, loop

### panjava — Java

Not Java™ branding. Compile-fail Parens + compile-accept LambdaConv01. @run main execute is GAP.

- suite: OpenJDK javac Parens1/2/3 fail + LambdaConv01 accept
- gap: LambdaConv01 execute
- module: src/panini/frontends/java.pni
- usage: `panjava program.java`
- WASM: C extract backend (integer subset)
- host: no
- ILM: yes
- keywords: class, void, public, static, if, return, new
- examples: class, parens (err)

### panst — Smalltalk

// floor-div, \\ remainder, 2r/8r/16r bases. LargeIntegers / factorial GAP.

- suite: GNU Smalltalk tests/intmath.st Eval before LargeIntegers 31
- gap: LargeIntegers
- module: src/panini/frontends/smalltalk.pni
- usage: `panst program.st`
- WASM: no
- host: no
- ILM: no
- keywords: Eval, true, false, nil, self, super
- examples: intmath, compare

### panhs — Haskell

where-bindings flattened. Type signatures ignored.

- suite: GHC codeGen should_run cgrun001/002/005
- gap: full GHC testsuite
- module: src/panini/frontends/haskell.pni
- usage: `panhs program.hs`
- WASM: no
- host: no
- ILM: no
- keywords: main, where, let, in, print, module
- examples: cgrun, let

### panlisp — Common Lisp

ANSI INCITS 226 named extract. languages/lisp.pni is museum.

- suite: ansi-test self-contained deftest 19
- gap: full ansi-test
- module: src/panini/frontends/lisp.pni
- usage: `panlisp program.lisp`
- WASM: no
- host: no
- ILM: no
- keywords: defun, let, if, quote, lambda, deftest
- examples: let, deftest

### panpl — Prolog

ISO/IEC 13211-1 arithmetic extract. bagof/setof/IO GAP.

- suite: Ciao iso_tests ISO 8.6/8.7 arith 23
- gap: bagof/setof/IO
- module: src/panini/frontends/prolog.pni
- usage: `panpl program.pl`
- WASM: no
- host: no
- ILM: no
- keywords: is, true, fail, :-
- examples: is, compare

### panada — Ada

Shaili सुरक्षा. STANDARD GREEN / ISO GREEN on ACATS C45411A. Not GNAT.

- suite: ISO/IEC 8652 ACATS C45411A unary +/− INTEGER (1)
- gap: full ACATS / INTEGER'IMAGE
- module: src/panini/frontends/ada.pni
- usage: `panada program.adb`
- WASM: C extract backend (integer subset)
- host: no
- ILM: no
- keywords: procedure, function, is, begin, end, return, Integer
- examples: main

### pancobol — COBOL

Shaili व्यवसाय. Integer COMPUTE/DISPLAY. gnucobol suite GAP.

- suite: ISO/IEC 1989 integer COMPUTE/DISPLAY named extract
- gap: gnucobol suite skip=0
- module: src/panini/frontends/cobol.pni
- usage: `pancobol program.cob`
- WASM: no
- host: no
- ILM: no
- keywords: IDENTIFICATION, DIVISION, COMPUTE, DISPLAY, STOP, RUN
- examples: compute

### pansql — SQL

Shaili सूत्र. Integer SELECT/INSERT. Not a DBMS.

- suite: ISO/IEC 9075 integer SELECT/INSERT named extract
- gap: ISO 9075 suite skip=0
- module: src/panini/frontends/sql.pni
- usage: `pansql program.sql`
- WASM: no
- host: no
- ILM: no
- keywords: SELECT, FROM, WHERE, INSERT, INTO, VALUES, CREATE, TABLE
- examples: select, where

### pansysml — SysML

Shaili नक्शा. SysML v2 textual. Not a model checker.

- suite: SysML v2 textual package/part/constraint named extract
- gap: full SysML v2 model-check
- module: src/panini/frontends/sysml.pni
- usage: `pansysml program.sysml`
- WASM: no
- host: no
- ILM: no
- keywords: package, part, def, attribute, constraint, requirement
- examples: constraint

### panlogo — Logo

Turtle integer extract. Hindi primitives (आगे, दाएँ) sit on the same runner.

- suite: UCBLogo named extract (REPEAT / FORWARD / RIGHT)
- gap: full UCBLogo suite
- module: runtime extras (browser)
- usage: `panlogo program.logo`
- WASM: no
- host: no
- ILM: no
- keywords: REPEAT, FORWARD, BACK, RIGHT, LEFT, PENUP, PENDOWN
- examples: square, hindi

## lowhanging

### panlua — Lua

Low-hanging fruit. Official lua.org 5.4.7 tests are in the tree. This alpha runs a named extract: assert, print, local, function. Full suite remains GAP.

- suite: Lua 5.4 named extract (assert/print/function)
- gap: lua-5.4.7 tests skip=0
- module: src/panini/frontends/lua.pni
- usage: `panlua program.lua`
- WASM: no
- host: no
- ILM: no
- keywords: function, end, local, return, if, then, assert, print
- examples: add, fact, assertfail (err)

### panscm — Scheme

Low-hanging fruit: Lisp cousin. define, lambda, if, arithmetic. R5RS/R7RS full suite GAP.

- suite: R5RS integer/define/lambda named extract
- gap: R5RS/R7RS suite skip=0
- module: src/panini/frontends/application.pni (cousin of lisp.pni)
- usage: `panscm program.scm`
- WASM: no
- host: no
- ILM: no
- keywords: define, lambda, if, quote, let
- examples: factorial, gcd

### panforth — Forth

Low-hanging fruit. Stack machine: +, DUP, SWAP, DROP, ., colon definitions. gforth tests GAP.

- suite: ANS Forth integer named extract
- gap: gforth tests skip=0
- module: src/panini/frontends/application.pni
- usage: `panforth program.fs`
- WASM: no
- host: no
- ILM: no
- keywords: :, ;, DUP, SWAP, DROP, OVER, .
- examples: colon, tbrace, unknown (err)

### panml — OCaml

Low-hanging fruit. let-bindings and integer expressions. ocaml testsuite GAP.

- suite: OCaml integer let/print_int named extract
- gap: ocaml testsuite skip=0
- module: src/panini/frontends/application.pni
- usage: `panml program.ml`
- WASM: no
- host: no
- ILM: no
- keywords: let, rec, in, if, then, else, match
- examples: add, rec

### panclj — Clojure

Lisp cousin. Official Clojure test suite is not skip=0; CORE on the Scheme evaluator.

- suite: Clojure-shaped list eval (Scheme cousin)
- gap: official Clojure suite
- module: src/panini/frontends/application.pni
- usage: `panclj program.clj`
- WASM: no
- host: no
- ILM: no
- keywords: defn, def, if, let, fn
- examples: defn, fact

### panscala — Scala

Shaili सोपान. STANDARD GREEN on t0005.scala compile-accept. Not scalac.

- suite: Scala t0005.scala def main compile-accept
- gap: unapply/match execute / full scalac
- module: src/panini/frontends/scala.pni
- usage: `panscala program.scala`
- WASM: C extract backend (integer subset)
- host: no
- ILM: no
- keywords: def, val, object, class, println
- examples: object

## panini (meta)

The language itself is `panpni`. This binary lists tools and forwards `panini keywords panc`.

```
panini list
panini examples c
panini keywords panc
panini help
```

Frontends in this tree: 45. Named ELFs: 46 (plus panini).
