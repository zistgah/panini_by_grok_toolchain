/* Copyright (C) 1993-2026 Abhishek Choudhary | GPL-3.0-or-later
 * Browser frontend exerciser. Every path exits through normalize() so errors share one shape.
 */
import { cinterp } from "./engine/cinterp.js";
import { clower } from "./engine/clower.js";
import { gnuc } from "./engine/gnuc.js";
import { ccpp } from "./engine/ccpp.js";
import { cpplower, cppReject } from "./engine/cpplower.js";
import { js262Run, ts262Run } from "./engine/js262.js";
import { haskellRun } from "./engine/hseval.js";
import { stRunFile, stFormat } from "./engine/steval.js";
import { qb64Run } from "./engine/qb64.js";
import {
  rustToC,
  goToC,
  juliaToC,
  zigToC,
  fortranToC,
  pascalToC,
  pascalReject,
  javaToC,
  javaReject,
  csharpToC,
  kotlinToC,
  swiftToC,
  scalaToC,
  dartToC,
  adaToC,
} from "./engine/stdlower.js";
import { lispRun } from "./engine/cleval.js";
import { prologRun } from "./engine/pleval.js";
import {
  wrapErr,
  makeRun,
  asRun,
  kconfigRun,
  ldRun,
  luaRun,
  forthRun,
  schemeRun,
  ocamlRun,
  clojureRun,
  paniniRun,
  logoRun,
  lexRun,
  yaccRun,
} from "./extras.ts";
import type { RunResult } from "./protocol.ts";
import {
  rubyRun,
  perlRun,
  phpRun,
  rRun,
  cobolRun,
  sqlRun,
  octaveRun,
  sysmlRun,
} from "./engine/appeval.js";
import { cDiag, leftoverHint, formatFrontendError, wrapDiag } from "./engine/diagnose.js";
import { pythonRun } from "./python.ts";
import { normalize } from "./result.ts";

function cRun(src: string, frontend: string): RunResult {
  try {
    const diag = cDiag(src);
    if (diag) return { ok: false, error: diag, frontend, phase: "parse" };
    const c = clower(gnuc(src));
    const value = cinterp(c) | 0;
    return { ok: true, value, lowered: c, frontend, phase: "eval" };
  } catch (e) {
    return wrapDiag(frontend, e, { phase: "eval" }) as RunResult;
  }
}

function lowerRun(toC: (s: string) => string, src: string, frontend: string, id?: string): RunResult {
  let c = "";
  try {
    c = toC(src);
    const left = leftoverHint(id || "", c);
    const diag = cDiag(c);
    if (diag) {
      return {
        ok: false,
        error: formatFrontendError({ frontend, id, phase: "after-lower", error: diag, leftover: left, lowered: c }),
        frontend,
        lowered: c,
        leftover: left || undefined,
        phase: "after-lower",
      };
    }
    const value = cinterp(c) | 0;
    return { ok: true, value, lowered: c, frontend, phase: "eval" };
  } catch (e) {
    const left = leftoverHint(id || "", c);
    return wrapDiag(frontend, e, {
      phase: "eval",
      lowered: c,
      leftover: left,
      error: formatFrontendError({
        frontend,
        id,
        phase: "eval",
        error: e instanceof Error ? e.message : String(e),
        leftover: left,
        lowered: c,
      }),
    }) as RunResult;
  }
}

async function dispatch(id: string, src: string): Promise<RunResult> {
  switch (id) {
    case "c":
      return cRun(src, "PANINI.Frontend.C");
    case "cppp": {
      const out = ccpp(src);
      try {
        return { ok: true, value: cinterp(clower(out)) | 0, lowered: out, frontend: "PANINI.Frontend.Cppp", phase: "eval" };
      } catch {
        return { ok: true, lowered: out, value: out, frontend: "PANINI.Frontend.Cppp", phase: "preprocess" };
      }
    }
    case "cpp": {
      const why = cppReject(src);
      if (why)
        return { ok: false, rejected: why, error: "compile error: " + why, frontend: "PANINI.Frontend.Cpp", phase: "reject" };
      const c = cpplower(src);
      try {
        return { ok: true, value: cinterp(c) | 0, lowered: c, frontend: "PANINI.Frontend.Cpp", phase: "eval" };
      } catch (e) {
        return wrapErr("PANINI.Frontend.Cpp", e);
      }
    }
    case "python":
      return pythonRun(src);
    case "javascript":
      return js262Run(src) as RunResult;
    case "typescript":
      return ts262Run(src) as RunResult;
    case "pascal": {
      const why = pascalReject(src);
      if (why)
        return { ok: false, rejected: why, error: "compile error: " + why, frontend: "PANINI.Frontend.Pascal", phase: "reject" };
      return lowerRun(pascalToC, src, "PANINI.Frontend.Pascal", "pascal");
    }
    case "basic": {
      const r = qb64Run(src) as {
        ok?: boolean;
        prints?: unknown[];
        frontend?: string;
        error?: string;
      };
      return {
        ok: r.ok !== false && !r.error,
        value: (r.prints && r.prints[0]) ?? 0,
        prints: (r.prints || []).map(String),
        error: r.error,
        frontend: r.frontend || "PANINI.Frontend.BASIC",
      };
    }
    case "java": {
      const why = javaReject(src);
      if (why)
        return { ok: false, rejected: why, error: "compile error: " + why, frontend: "PANINI.Frontend.Java", phase: "reject" };
      return lowerRun(javaToC, src, "PANINI.Frontend.Java", "java");
    }
    case "smalltalk": {
      const r = stRunFile(src);
      return {
        ok: r.ok,
        prints: (r.prints || []).map((v) => stFormat(v)),
        value: r.prints && r.prints[0],
        error: r.error,
        frontend: r.frontend || "PANINI.Frontend.Smalltalk",
      };
    }
    case "haskell":
      return haskellRun(src) as RunResult;
    case "lisp":
      return lispRun(src) as RunResult;
    case "prolog":
      return prologRun(src) as RunResult;
    case "fortran":
      return lowerRun(fortranToC, src, "PANINI.Frontend.Fortran", "fortran");
    case "go":
      return lowerRun(goToC, src, "PANINI.Frontend.Go", "go");
    case "rust":
      return lowerRun(rustToC, src, "PANINI.Frontend.Rust", "rust");
    case "julia":
      return lowerRun(juliaToC, src, "PANINI.Frontend.Julia", "julia");
    case "lua":
      return luaRun(src);
    case "zig":
      return lowerRun(zigToC, src, "PANINI.Frontend.Zig", "zig");
    case "make":
      return makeRun(src);
    case "asm":
      return asRun(src);
    case "kconfig":
      return kconfigRun(src);
    case "ld":
      return ldRun(src);
    case "scheme":
      return schemeRun(src);
    case "forth":
      return forthRun(src);
    case "ocaml":
      return ocamlRun(src);
    case "clojure":
      return clojureRun(src);
    case "logo":
      return logoRun(src);
    case "lex":
      return lexRun(src);
    case "yacc":
      return yaccRun(src);
    case "panini":
      return paniniRun(src);
    case "csharp":
      return lowerRun(csharpToC, src, "PANINI.Frontend.CSharp", "csharp");
    case "kotlin":
      return lowerRun(kotlinToC, src, "PANINI.Frontend.Kotlin", "kotlin");
    case "swift":
      return lowerRun(swiftToC, src, "PANINI.Frontend.Swift", "swift");
    case "scala":
      return lowerRun(scalaToC, src, "PANINI.Frontend.Scala", "scala");
    case "dart":
      return lowerRun(dartToC, src, "PANINI.Frontend.Dart", "dart");
    case "ada":
      return lowerRun(adaToC, src, "PANINI.Frontend.Ada", "ada");
    case "ruby":
      return rubyRun(src);
    case "perl":
      return perlRun(src);
    case "php":
      return phpRun(src);
    case "r":
      return rRun(src);
    case "cobol":
      return cobolRun(src);
    case "sql":
      return sqlRun(src);
    case "octave":
      return octaveRun(src);
    case "sysml":
      return sysmlRun(src);
    default:
      return { ok: false, error: "unknown frontend " + id, frontend: "PANINI", phase: "dispatch" };
  }
}

export async function runLang(id: string, source: string, ilm?: string): Promise<RunResult> {
  const src = String(source);
  try {
    const raw = await dispatch(id, src);
    return normalize(id, raw, src, ilm);
  } catch (e) {
    return normalize(id, wrapErr("PANINI.Frontend." + id, e), src, ilm);
  }
}

export type { RunResult } from "./protocol.ts";
