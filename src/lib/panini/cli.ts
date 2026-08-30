/* Copyright (C) 1993-2026 Abhishek Choudhary | GPL-3.0-or-later
 * Named tools (panc, panpy, …). gcc-shaped files / -o / AST / WASM / --native.
 * Exit 0 ok · 1 diagnostic · 2 usage.
 */
import { astToSource, dumpAst } from "./ast.ts";
import {
  base64ToBytes,
  bytesToBase64,
  emitLoweredC,
  emitWasm,
  emitWat,
  joinTranslationUnits,
  nativeHint,
  runWasm,
  type NativeCcFn,
} from "./backend.ts";
import { FRONTEND_BY_ID } from "./catalog.ts";
import { examplesFor, exampleById } from "./examples.ts";
import { transduceToHost } from "./ilm.ts";
import { formatKeywordsTsv } from "./kwtable.ts";
import { metaOf } from "./meta.ts";
import { formatSuccess } from "./result.ts";
import { runLang } from "./run.ts";
import { BIN_TO_ID, ID_TO_BIN, TOOLS, binOf, toolHelp } from "./tools.ts";
import type { RunResult } from "./protocol.ts";

export type CliIo = {
  out: (s: string) => void;
  err: (s: string) => void;
};

export type CliHost = {
  readFile?: (p: string) => string;
  writeFile?: (p: string, data: string | Uint8Array) => void;
  nativeCc?: NativeCcFn;
};

const defaultIo: CliIo = {
  out: (s) => console.log(s),
  err: (s) => console.error(s),
};

export const EXIT_OK = 0;
export const EXIT_FAIL = 1;
export const EXIT_USAGE = 2;

export function helpText(): string {
  const bins = TOOLS.map((t) => `  ${t.bin.padEnd(12)} ${t.title}`).join("\n");
  return `PANINI — named frontend tools

Each frontend is a Unix ELF in bin/ (panc, panpy, panmake, …), not a symlink.
The workbench CLI pane is the same program. ./install.sh puts them on PATH.

Usage:
  panc file.c
  panc a.c b.c -o prog.wasm
  panc --dump-ast file.c
  panc --read-ast file.json
  panc --native a.c b.c -o prog
  panini list
  ./install.sh

Exit: 0 ok · 1 compile/runtime · 2 usage

Tools:
${bins}

Common flags:
  -o FILE          write artifact (wasm by default)
  -c               compile only (do not run)
  -S               emit WAT
  --emit wasm|wat|c|ast
  --dump-ast       print AST JSON
  --read-ast FILE  compile from a dumped AST
  --native         host cc/gcc/clang. panpy: python3
  --run            run after emit
  -e CODE          source text
  --example NAME   workbench example
  --keywords       keyword × human-language table
  --ilm LANG       transduce native keywords to host
  -v, --json, --help
`;
}

export function listText(): string {
  const lines = ["bin\tid\tgroup\twhat\ttitle"];
  for (const t of TOOLS) {
    const f = FRONTEND_BY_ID[t.id];
    lines.push(`${t.bin}\t${t.id}\t${f?.group || ""}\t${t.what}\t${t.title}`);
  }
  return lines.join("\n");
}

export function examplesText(id: string): string {
  const list = examplesFor(id);
  if (!list.length) return `no examples for ${id}`;
  return list.map((e) => `${e.id}\t${e.kind}\t${e.title}\t${e.blurb}`).join("\n");
}

function asHost(x?: CliHost | ((p: string) => string)): CliHost {
  if (!x) return {};
  if (typeof x === "function") return { readFile: x };
  return x;
}

type ToolOpts = {
  files: string[];
  output?: string;
  compileOnly: boolean;
  emitAsm: boolean;
  emit?: string;
  dumpAst: boolean;
  readAst?: string;
  native: boolean;
  forceRun: boolean;
  example?: string;
  sourceFlag?: string;
  ilm: string;
  json: boolean;
  verbose: boolean;
  help: boolean;
  version: boolean;
  keywords: boolean;
  examples: boolean;
  unknown?: string;
};

function parseToolArgs(argsIn: string[]): ToolOpts {
  const args = argsIn.slice();
  const o: ToolOpts = {
    files: [],
    compileOnly: false,
    emitAsm: false,
    dumpAst: false,
    native: false,
    forceRun: false,
    ilm: "en",
    json: false,
    verbose: false,
    help: false,
    version: false,
    keywords: false,
    examples: false,
  };
  const take = (i: number) => {
    const v = args[i + 1];
    if (v == null || v.startsWith("-")) return { v: undefined as string | undefined, n: 1 };
    return { v, n: 2 };
  };
  let i = 0;
  while (i < args.length) {
    const a = args[i];
    if (a === "--") {
      o.files.push(...args.slice(i + 1));
      break;
    }
    if (a === "-") {
      o.files.push("-");
      i++;
      continue;
    }
    if (!a.startsWith("-")) {
      o.files.push(a);
      i++;
      continue;
    }
    if (a === "-h" || a === "--help") {
      o.help = true;
      i++;
      continue;
    }
    if (a === "-V" || a === "--version") {
      o.version = true;
      i++;
      continue;
    }
    if (a === "-v" || a === "--verbose") {
      o.verbose = true;
      i++;
      continue;
    }
    if (a === "--json") {
      o.json = true;
      i++;
      continue;
    }
    if (a === "-c") {
      o.compileOnly = true;
      i++;
      continue;
    }
    if (a === "-S") {
      o.emitAsm = true;
      i++;
      continue;
    }
    if (a === "--dump-ast" || a === "-fdump-ast" || a === "--ast") {
      o.dumpAst = true;
      i++;
      continue;
    }
    if (a === "--native" || a === "--host-cc" || a === "--cc") {
      o.native = true;
      i++;
      continue;
    }
    if (a === "--run") {
      o.forceRun = true;
      i++;
      continue;
    }
    if (a === "--keywords" || a === "--kw") {
      o.keywords = true;
      i++;
      continue;
    }
    if (a === "--examples" || a === "--list-examples") {
      o.examples = true;
      i++;
      continue;
    }
    if (a === "-o" || a === "--output") {
      const { v, n } = take(i);
      if (!v) {
        o.unknown = a + " needs a file";
        break;
      }
      o.output = v;
      i += n;
      continue;
    }
    if (a.startsWith("-o") && a.length > 2) {
      o.output = a.slice(2);
      i++;
      continue;
    }
    if (a === "--emit") {
      const { v, n } = take(i);
      o.emit = v;
      i += n;
      continue;
    }
    if (a.startsWith("--emit=")) {
      o.emit = a.slice(7);
      i++;
      continue;
    }
    if (a === "--read-ast" || a === "--ast-in") {
      const { v, n } = take(i);
      o.readAst = v;
      i += n;
      continue;
    }
    if (a === "--example") {
      const { v, n } = take(i);
      o.example = v;
      i += n;
      continue;
    }
    if (a === "-e" || a === "--source") {
      const { v, n } = take(i);
      o.sourceFlag = v;
      i += n;
      continue;
    }
    if (a === "--ilm" || a === "--lang") {
      const { v, n } = take(i);
      o.ilm = v || "en";
      i += n;
      continue;
    }
    o.unknown = a;
    break;
  }
  return o;
}

function formatProgramOutput(r: RunResult): string {
  if (r.prints && r.prints.length) return r.prints.join("\n");
  if (r.print !== undefined && r.print !== "") return String(r.print);
  if (r.value !== undefined && r.value !== null) return String(r.value);
  return "";
}

function writeOut(host: CliHost, path: string, data: string | Uint8Array): string | undefined {
  if (!host.writeFile) return `cannot write ${path} in this host`;
  host.writeFile(path, data);
  return undefined;
}

async function runTool(
  id: string,
  argsIn: string[],
  host: CliHost,
): Promise<{ code: number; stdout: string; stderr: string; result?: RunResult }> {
  const bin = binOf(id);
  const o = parseToolArgs(argsIn);
  if (o.unknown) {
    return { code: EXIT_USAGE, stdout: "", stderr: `${bin}: unknown flag ${o.unknown}\n${toolHelp(bin)}` };
  }
  if (o.help) return { code: EXIT_OK, stdout: toolHelp(bin), stderr: "" };
  if (o.version) {
    return { code: EXIT_OK, stdout: `${bin} 0.2.0 (PANINI named extract, not the vendor toolchain)\n`, stderr: "" };
  }
  if (o.examples) return { code: EXIT_OK, stdout: examplesText(id) + "\n", stderr: "" };
  if (o.keywords) return { code: EXIT_OK, stdout: formatKeywordsTsv(id) + "\n", stderr: "" };

  const units: { name: string; text: string }[] = [];
  if (o.readAst) {
    if (!host.readFile) return { code: EXIT_USAGE, stdout: "", stderr: `${bin}: cannot read ${o.readAst}\n` };
    try {
      const raw = host.readFile(o.readAst);
      const dump = JSON.parse(raw);
      const got = astToSource(dump);
      units.push({ name: o.readAst, text: got.source });
    } catch (e) {
      return { code: EXIT_FAIL, stdout: "", stderr: `${bin}: --read-ast: ${e instanceof Error ? e.message : String(e)}\n` };
    }
  }
  if (o.sourceFlag) units.push({ name: "<expr>", text: o.sourceFlag });
  if (o.example) {
    const ex = exampleById(id, o.example);
    if (!ex) {
      return { code: EXIT_USAGE, stdout: "", stderr: `${bin}: unknown example '${o.example}'\n${examplesText(id)}\n` };
    }
    units.push({ name: o.example + metaOf(id).ext, text: ex.source });
  }
  for (const file of o.files) {
    if (file === "-") {
      return { code: EXIT_USAGE, stdout: "", stderr: `${bin}: stdin (-) is not wired in this host\n` };
    }
    if (!host.readFile) {
      return { code: EXIT_USAGE, stdout: "", stderr: `${bin}: cannot read file ${file} in this host\n` };
    }
    try {
      units.push({ name: file, text: host.readFile(file) });
    } catch (e) {
      return {
        code: EXIT_USAGE,
        stdout: "",
        stderr: `${bin}: ${e instanceof Error ? e.message : String(e)}\n`,
      };
    }
  }
  if (!units.length) {
    const ex = exampleById(id);
    if (ex) units.push({ name: ex.id + metaOf(id).ext, text: ex.source });
  }
  if (!units.length) {
    return {
      code: EXIT_USAGE,
      stdout: "",
      stderr: `${bin}: no source\nusage: ${bin} [file...] | ${bin} -e '…' | ${bin} --example <name>\n`,
    };
  }

  const joined = joinTranslationUnits(units);
  const hostSrc = transduceToHost(joined, o.ilm);
  const emit = (o.emit || "").toLowerCase();
  const wantAst = o.dumpAst || emit === "ast";
  const wantWat = o.emitAsm || emit === "wat";
  const wantC = emit === "c";
  const wantNative = o.native || emit === "native";
  const wantWasm = emit === "wasm" || (!!o.output && !wantAst && !wantWat && !wantC && !wantNative && emit !== "run");
  const wantRun = o.forceRun || (!o.output && !o.compileOnly && !wantAst && !wantWat && !wantC && !wantWasm && !wantNative);

  const pack = (result: RunResult, stdout: string, stderr: string, code: number) => {
    if (o.json) {
      return {
        code: result.ok ? EXIT_OK : EXIT_FAIL,
        stdout: JSON.stringify(result, null, 2) + "\n",
        stderr: "",
        result,
      };
    }
    return { code, stdout, stderr, result };
  };

  try {
    if (wantAst) {
      const dump = dumpAst(id, hostSrc);
      const text = JSON.stringify(dump, null, 2) + "\n";
      if (o.output) {
        const err = writeOut(host, o.output, text);
        if (err) return { code: EXIT_USAGE, stdout: "", stderr: `${bin}: ${err}\n` };
      }
      const result: RunResult = { ok: true, frontend: dump.frontend, phase: "ast", ast: dump.ast, note: dump.note };
      return pack(result, o.output ? `wrote ${o.output}\n` : text, "", EXIT_OK);
    }
    if (wantWat) {
      const wat = emitWat(id, hostSrc);
      if (o.output) {
        const err = writeOut(host, o.output, wat);
        if (err) return { code: EXIT_USAGE, stdout: "", stderr: `${bin}: ${err}\n` };
      }
      const result: RunResult = { ok: true, frontend: "PANINI.Backend.Wasm", phase: "wat", wat };
      if (o.forceRun) {
        const ran = await runWasm(id, hostSrc);
        result.value = ran.value;
        result.wasmBytes = ran.bytes.length;
      }
      return pack(result, o.output ? `wrote ${o.output}\n` : wat, "", EXIT_OK);
    }
    if (wantC) {
      const c = emitLoweredC(id, hostSrc);
      if (o.output) {
        const err = writeOut(host, o.output, c);
        if (err) return { code: EXIT_USAGE, stdout: "", stderr: `${bin}: ${err}\n` };
      }
      const result: RunResult = { ok: true, frontend: "PANINI.Frontend." + id, phase: "lower", lowered: c };
      return pack(result, o.output ? `wrote ${o.output}\n` : c + (c.endsWith("\n") ? "" : "\n"), "", EXIT_OK);
    }
    if (wantNative) {
      const hint = nativeHint(id);
      if (!hint) {
        return {
          code: EXIT_FAIL,
          stdout: "",
          stderr: `${bin}: --native has no host compiler for ${id} (C/C++/Python only)\n`,
        };
      }
      if (!host.nativeCc) {
        return {
          code: EXIT_FAIL,
          stdout: "",
          stderr: `${bin}: --native needs a host cc.\n`,
        };
      }
      const r = await host.nativeCc({
        hint,
        files: units.map((u) => ({ name: u.name, text: transduceToHost(u.text, o.ilm) })),
        output: o.output,
        run: o.forceRun || !o.output,
      });
      const result: RunResult = {
        ok: !!r.ok,
        frontend: "host." + (r.compiler || hint),
        phase: "native",
        error: r.ok ? undefined : r.error || r.stderr || "native compile failed",
        print: r.stdout,
        note: (r.argv || []).join(" ") + (r.output ? " → " + r.output : ""),
      };
      if (!r.ok) return pack(result, r.stdout || "", (r.stderr || r.error || "failed") + "\n", EXIT_FAIL);
      if (o.output && r.binaryBase64) {
        const err = writeOut(host, o.output, base64ToBytes(r.binaryBase64));
        if (err) return { code: EXIT_USAGE, stdout: "", stderr: `${bin}: ${err}\n` };
      }
      const bits = [r.stdout];
      if (!r.stdout && typeof r.status === "number") bits.push("status " + r.status);
      if (r.output && !o.forceRun) bits.push("wrote " + r.output);
      const out = bits.filter(Boolean).join("\n");
      return pack(result, out.endsWith("\n") || !out ? out : out + "\n", r.stderr || "", EXIT_OK);
    }
    if (wantWasm) {
      const { wat, bytes } = await emitWasm(id, hostSrc);
      if (o.output) {
        const err = writeOut(host, o.output, bytes);
        if (err) return { code: EXIT_USAGE, stdout: "", stderr: `${bin}: ${err}\n` };
      }
      const result: RunResult = {
        ok: true,
        frontend: "PANINI.Backend.Wasm",
        phase: "wasm",
        wat,
        wasmBytes: bytes.length,
        wasmBase64: bytesToBase64(bytes),
      };
      let stdout = o.output ? `wrote ${o.output} (${bytes.length} bytes)\n` : `WASM ${bytes.length} bytes\n${bytesToBase64(bytes)}\n`;
      if (o.forceRun) {
        const ran = await runWasm(id, hostSrc);
        result.value = ran.value;
        stdout = (o.output ? `wrote ${o.output}\n` : "") + String(ran.value) + "\n";
      }
      return pack(result, stdout, "", EXIT_OK);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const result: RunResult = { ok: false, error: msg, frontend: "PANINI.Backend", phase: "emit" };
    return pack(result, "", msg + "\n", EXIT_FAIL);
  }

  const result = await runLang(id, hostSrc, o.ilm);
  if (o.json) {
    return { code: result.ok ? EXIT_OK : EXIT_FAIL, stdout: JSON.stringify(result, null, 2) + "\n", stderr: "", result };
  }
  if (result.ok) {
    const out = formatProgramOutput(result);
    const extra = o.verbose ? (out ? "\n" : "") + formatSuccess(result) : "";
    return { code: EXIT_OK, stdout: (out + extra).replace(/\n$/, "") + (out || extra ? "\n" : ""), stderr: "", result };
  }
  return { code: EXIT_FAIL, stdout: "", stderr: (result.error || "failed") + "\n", result };
}

export async function dispatchCli(
  argv: string[],
  host?: CliHost | ((p: string) => string),
): Promise<{ code: number; stdout: string; stderr: string; result?: RunResult }> {
  const h = asHost(host);
  const args = argv.slice();
  const cmd = args.shift() || "help";

  if (cmd === "help" || cmd === "--help" || cmd === "-h") {
    return { code: EXIT_OK, stdout: helpText(), stderr: "" };
  }
  if (cmd === "list" || cmd === "tools") {
    return { code: EXIT_OK, stdout: listText() + "\n", stderr: "" };
  }
  if (cmd === "version" || cmd === "--version" || cmd === "-V") {
    return { code: EXIT_OK, stdout: "PANINI 0.2.0 (named frontend tools)\n", stderr: "" };
  }
  if (cmd === "examples") {
    const id = args[0];
    if (!id) return { code: EXIT_USAGE, stdout: "", stderr: "usage: panini examples <id>\n" };
    const real = BIN_TO_ID[id] || id;
    return { code: EXIT_OK, stdout: examplesText(real) + "\n", stderr: "" };
  }
  if (cmd === "keywords") {
    const kid = args[0];
    if (!kid) return { code: EXIT_USAGE, stdout: "", stderr: "usage: panini keywords <id|bin>\n" };
    const real = BIN_TO_ID[kid] || kid;
    if (!FRONTEND_BY_ID[real] && !ID_TO_BIN[real]) {
      return { code: EXIT_USAGE, stdout: "", stderr: `unknown frontend ${kid}\n` };
    }
    return { code: EXIT_OK, stdout: formatKeywordsTsv(real) + "\n", stderr: "" };
  }
  if (cmd === "fe") {
    const fid = args.shift();
    if (!fid || fid === "list") return { code: EXIT_OK, stdout: listText() + "\n", stderr: "" };
    const real = BIN_TO_ID[fid] || fid;
    if (!FRONTEND_BY_ID[real] && !ID_TO_BIN[real]) {
      return { code: EXIT_USAGE, stdout: "", stderr: `unknown frontend ${fid}\n${listText()}\n` };
    }
    return runTool(real, args, h);
  }

  const asBin = BIN_TO_ID[cmd] || (FRONTEND_BY_ID[cmd] ? cmd : undefined);
  if (asBin) {
    const real = BIN_TO_ID[cmd] || cmd;
    return runTool(real, args, h);
  }

  return { code: EXIT_USAGE, stdout: "", stderr: `unknown command ${cmd}\n` + helpText() };
}

export async function runCli(
  argv: string[],
  io: CliIo = defaultIo,
  host?: CliHost | ((p: string) => string),
): Promise<number> {
  const r = await dispatchCli(argv, host);
  if (r.stdout) {
    const s = r.stdout.endsWith("\n") ? r.stdout.slice(0, -1) : r.stdout;
    io.out(s);
  }
  if (r.stderr) {
    const s = r.stderr.endsWith("\n") ? r.stderr.slice(0, -1) : r.stderr;
    io.err(s);
  }
  return r.code;
}

export { metaOf };
