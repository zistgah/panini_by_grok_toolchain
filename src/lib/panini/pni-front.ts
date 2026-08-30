/* Copyright (C) 1993-2026 Abhishek Choudhary | GPL-3.0-or-later
 * Load a PANINI-written frontend and call its run_* function.
 * JavaScript here only loads and calls. The compiler is the .pni.
 */
import { runSource } from "./engine/interpreter.js";
import { unwrap, wrap } from "./engine/values.js";
import type { RunResult } from "./protocol.ts";

export type FrontSpec = { file: string; fn: string; deps?: string[] };

const CDEPS = ["preprocess.pni", "to_c.pni", "c.pni"];
const APPDEPS = ["application.pni"];
const LISPDEPS = ["sexpr.pni"];

/** Frontend id → PANINI module. */
export const PNI_TABLE: Record<string, FrontSpec> = {
  python: { file: "python.pni", fn: "run_python" },
  c: { file: "c.pni", fn: "run_c", deps: ["preprocess.pni"] },
  cppp: { file: "cppp.pni", fn: "run_cppp", deps: ["preprocess.pni", "c.pni"] },
  cpp: { file: "cpp.pni", fn: "run_cpp", deps: CDEPS },
  fortran: { file: "fortran.pni", fn: "run_fortran", deps: CDEPS },
  typescript: { file: "typescript.pni", fn: "run_typescript", deps: ["javascript.pni"] },
  zig: { file: "zig.pni", fn: "run_zig", deps: CDEPS },
  lua: { file: "lua.pni", fn: "run_lua", deps: CDEPS },
  javascript: { file: "javascript.pni", fn: "run_javascript" },
  pascal: { file: "pascal.pni", fn: "run_pascal", deps: CDEPS },
  basic: { file: "basic.pni", fn: "run_basic" },
  java: { file: "java.pni", fn: "run_java", deps: CDEPS },
  rust: { file: "rust.pni", fn: "run_rust", deps: CDEPS },
  go: { file: "go.pni", fn: "run_go", deps: CDEPS },
  julia: { file: "julia.pni", fn: "run_julia", deps: CDEPS },
  haskell: { file: "haskell.pni", fn: "run_haskell" },
  smalltalk: { file: "smalltalk.pni", fn: "run_smalltalk" },
  lisp: { file: "lisp.pni", fn: "run_lisp", deps: LISPDEPS },
  prolog: { file: "prolog.pni", fn: "run_prolog" },
  make: { file: "make.pni", fn: "run_make" },
  asm: { file: "asm.pni", fn: "run_asm" },
  csharp: { file: "csharp.pni", fn: "run_csharp", deps: CDEPS },
  kotlin: { file: "kotlin.pni", fn: "run_kotlin", deps: CDEPS },
  swift: { file: "swift.pni", fn: "run_swift", deps: CDEPS },
  scala: { file: "scala.pni", fn: "run_scala", deps: CDEPS },
  dart: { file: "dart.pni", fn: "run_dart", deps: CDEPS },
  ada: { file: "ada.pni", fn: "run_ada", deps: CDEPS },
  ruby: { file: "ruby.pni", fn: "run_ruby", deps: APPDEPS },
  perl: { file: "perl.pni", fn: "run_perl", deps: APPDEPS },
  php: { file: "php.pni", fn: "run_php", deps: APPDEPS },
  r: { file: "r.pni", fn: "run_r", deps: APPDEPS },
  cobol: { file: "cobol.pni", fn: "run_cobol", deps: APPDEPS },
  sql: { file: "sql.pni", fn: "run_sql" },
  octave: { file: "octave.pni", fn: "run_octave", deps: APPDEPS },
  sysml: { file: "sysml.pni", fn: "run_sysml", deps: APPDEPS },
  kconfig: { file: "kconfig.pni", fn: "run_kconfig" },
  ld: { file: "ld.pni", fn: "run_ld" },
  scheme: { file: "scheme.pni", fn: "run_scheme", deps: LISPDEPS },
  forth: { file: "forth.pni", fn: "run_forth" },
  ocaml: { file: "ocaml.pni", fn: "run_ocaml", deps: APPDEPS },
  clojure: { file: "clojure.pni", fn: "run_clojure", deps: LISPDEPS },
  logo: { file: "logo.pni", fn: "run_logo" },
  lex: { file: "lex.pni", fn: "run_lex" },
  yacc: { file: "yacc.pni", fn: "run_yacc" },
  panini: { file: "panini.pni", fn: "run_panini" },
};

/** PANINI to_c.pni function that lowers this frontend to C. */
const TO_C_FN: Record<string, string> = {
  rust: "rustToC",
  go: "goToC",
  cpp: "cppToC",
  fortran: "fortranToC",
  zig: "zigToC",
  lua: "luaToC",
  pascal: "pascalToC",
  java: "javaToC",
  julia: "juliaToC",
  csharp: "csharpToC",
  kotlin: "kotlinToC",
  swift: "swiftToC",
  scala: "scalaToC",
  dart: "dartToC",
  ada: "adaToC",
};

type Slot = { fn: unknown; interp: { callValue: Function; global: unknown; runtime: { prints: string[]; functions: Map<string, unknown> } } };
const cache = new Map<string, Slot>();

async function readFromFs(file: string): Promise<string | null> {
  try {
    if (typeof window !== "undefined") return null;
    if (typeof process === "undefined" || !process.versions?.node) return null;
    const fs = await import(/* @vite-ignore */ "node:fs");
    const path = await import(/* @vite-ignore */ "node:path");
    const url = await import(/* @vite-ignore */ "node:url");
    const here = path.dirname(url.fileURLToPath(import.meta.url));
    const envRoot = process.env.PANINI_ROOT;
    const candidates = [
      path.resolve(here, "../../panini/frontends", file),
      path.resolve(here, "../../../panini/frontends", file),
      path.resolve(here, "../../panini", file),
      path.resolve(process.cwd(), "src/panini/frontends", file),
      path.resolve(process.cwd(), "src/panini", file),
      envRoot ? path.join(envRoot, "src/panini/frontends", file) : "",
      envRoot ? path.join(envRoot, "lib/panini/src/panini/frontends", file) : "",
    ].filter(Boolean);
    for (const p of candidates) {
      if (fs.existsSync(p)) return fs.readFileSync(p, "utf8");
    }
    return null;
  } catch {
    return null;
  }
}

export async function pniSource(file: string): Promise<string> {
  const disk = await readFromFs(file);
  if (disk != null) return disk;
  const { getPni } = await import("./pni-bundle.ts");
  return getPni(file);
}

export function pniFileFor(id: string): string | undefined {
  return PNI_TABLE[id]?.file;
}

async function loadSlot(id: string): Promise<Slot> {
  const hit = cache.get(id);
  if (hit) return hit;
  const spec = PNI_TABLE[id];
  if (!spec) throw new Error("unknown frontend " + id);
  const parts: string[] = [];
  for (const d of spec.deps || []) {
    parts.push(await pniSource(d));
  }
  parts.push(await pniSource(spec.file));
  const src = parts.join("\n");
  const { interpreter } = await runSource(src, "src/panini/frontends/" + spec.file, {
    runMain: false,
    maxSteps: 2_000_000_000,
  });
  const fn = interpreter.runtime.functions.get(spec.fn);
  if (!fn) throw new Error("PANINI frontend missing " + spec.fn + " in " + spec.file);
  const slot = { fn, interp: interpreter };
  cache.set(id, slot);
  return slot;
}

/** Call a named function inside a loaded PANINI frontend module. */
export async function pniFn(id: string, name: string, args: unknown[]): Promise<unknown> {
  const slot = await loadSlot(id);
  const fn = slot.interp.runtime.functions.get(name);
  if (!fn) throw new Error("PANINI missing " + name + " in " + id);
  return unwrap(await slot.interp.callValue(fn, args.map(wrap), slot.interp.global));
}

/** Lower a surface language to C using to_c.pni. */
export async function pniLowerToC(id: string, source: string): Promise<string | null> {
  if (id === "c") return source;
  if (id === "cppp") {
    const pre = await pniFn("c", "ppCpp", [source]);
    return pre == null ? source : String(pre);
  }
  const fn = TO_C_FN[id];
  if (!fn) return null;
  const result = await pniFn(id, fn, [source]);
  return result == null ? null : String(result);
}

export async function runPniFrontend(id: string, source: string): Promise<RunResult> {
  const spec = PNI_TABLE[id];
  if (!spec) return { ok: false, error: "unknown frontend " + id, frontend: "PANINI", phase: "dispatch" };
  try {
    const slot = await loadSlot(id);
    slot.interp.runtime.prints = [];
    const panini = unwrap(await slot.interp.callValue(slot.fn, [wrap(source)], slot.interp.global)) as RunResult & {
      ok?: boolean;
      error?: string;
      rejected?: string;
    };
    const hostPrints = slot.interp.runtime.prints || [];
    if (panini && typeof panini === "object") {
      const ok = panini.ok !== false && !panini.error && !panini.rejected;
      const fromMod = Array.isArray(panini.prints)
        ? panini.prints.map((p) => (p == null ? "" : typeof p === "object" ? String((p as { value?: unknown }).value ?? p) : String(p)))
        : [];
      return {
        ...panini,
        ok,
        prints: fromMod.length ? fromMod : hostPrints,
        frontend: panini.frontend || "PANINI.Frontend." + id,
        phase: panini.phase || "eval",
      };
    }
    return { ok: true, value: panini, prints: hostPrints, frontend: "PANINI.Frontend." + id, phase: "eval" };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error && e.stack ? e.stack.split("\n").slice(0, 8).join("\n") : undefined;
    return { ok: false, error, frontend: "PANINI.Frontend." + id, phase: "eval", stack };
  }
}
