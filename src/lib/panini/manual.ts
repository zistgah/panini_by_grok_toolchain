/* Copyright (C) 1993-2026 Abhishek Choudhary | GPL-3.0-or-later
 * One row per named binary: language, suite, gap, examples, WASM, host cc.
 */
import { FRONTEND_BY_ID, FRONTENDS, type Frontend } from "./catalog.ts";
import { examplesFor } from "./examples.ts";
import { ILM_LANGUAGES } from "./keywords.ts";
import { GROUP_ORDER, metaOf } from "./meta.ts";
import { TOOLS, type Tool } from "./tools.ts";

function hostOf(id: string): "cc" | "c++" | "python3" | null {
  if (id === "c" || id === "cppp" || id === "asm") return "cc";
  if (id === "cpp") return "c++";
  if (id === "python") return "python3";
  return null;
}

/** Frontends the C extract WASM backend can emit (integer subset). */
export const WASM_IDS = new Set([
  "c",
  "cppp",
  "cpp",
  "rust",
  "go",
  "julia",
  "zig",
  "fortran",
  "pascal",
  "java",
  "csharp",
  "kotlin",
  "swift",
  "scala",
  "dart",
  "ada",
]);

export type ManualRow = {
  bin: string;
  id: string;
  title: string;
  what: Tool["what"];
  group: Frontend["group"];
  status: Frontend["status"];
  ext: string;
  suite: string;
  gap: string;
  blurb: string;
  keywords: string[];
  module: string;
  ilm: boolean;
  wasm: boolean;
  native: "cc" | "c++" | "python3" | null;
  examples: { id: string; title: string; kind: string }[];
};

export function manualRows(): ManualRow[] {
  return TOOLS.map((t) => {
    const f = FRONTEND_BY_ID[t.id];
    const m = metaOf(t.id);
    return {
      bin: t.bin,
      id: t.id,
      title: t.title,
      what: t.what,
      group: f?.group || "classic",
      status: f?.status || "core",
      ext: m.ext,
      suite: f?.suite || "named extract",
      gap: f?.gap || "—",
      blurb: f?.blurb || "",
      keywords: f?.keywords || [],
      module: f?.module || "",
      ilm: m.ilm,
      wasm: WASM_IDS.has(t.id),
      native: hostOf(t.id),
      examples: examplesFor(t.id).map((e) => ({ id: e.id, title: e.title, kind: e.kind })),
    };
  });
}

export function rowsByGroup(): { group: string; items: ManualRow[] }[] {
  const rows = manualRows();
  return GROUP_ORDER.map((group) => ({
    group,
    items: rows.filter((r) => r.group === group),
  })).filter((g) => g.items.length);
}

export const COMMON_FLAGS = [
  ["file…", "named source files (tabs in the workbench, paths on the ELF)"],
  ["-o FILE", "write artifact; WASM unless --native"],
  ["-c", "compile only (do not run)"],
  ["-S", "emit WAT"],
  ["--emit wasm|wat|c|ast", "choose the PANINI backend product"],
  ["--dump-ast", "AST JSON (includes source for --read-ast)"],
  ["--read-ast FILE", "compile from a dumped AST"],
  ["--native", "host cc/gcc/clang (C/C++/as) or python3 (panpy)"],
  ["--run", "run after emit"],
  ["-e CODE", "program text instead of a file"],
  ["--example NAME", "workbench example"],
  ["--ilm LANG", "transduce native keywords to host C"],
  ["--keywords", "keyword × human-language table"],
  ["-v / --json / --help", "verbose · machine result · usage"],
];

export const EXIT_LINES = [
  ["0", "ok"],
  ["1", "compile or runtime diagnostic"],
  ["2", "usage (missing file, unknown flag, unknown example)"],
];

export function ilmLanguageList(): { id: string; title: string; script: string; n: number; bar: number }[] {
  return Object.values(ILM_LANGUAGES).map((L) => ({
    id: L.id,
    title: L.title,
    script: L.script,
    n: L.n,
    bar: L.bar,
  }));
}

export function formatManualMarkdown(): string {
  const rows = manualRows();
  const ilm = ilmLanguageList();
  const lines: string[] = [];
  lines.push("# PANINI named toolchain — manual");
  lines.push("");
  lines.push("Copyright (C) 1993-2026 Abhishek Choudhary");
  lines.push("GPL-3.0-or-later");
  lines.push("");
  lines.push("panc is not gcc. panpy is not CPython. Each `bin/pan*` is a real ELF.");
  lines.push("Default with no flags: the named extract runs. `-o` emits WASM. `--native` is host cc.");
  lines.push("");
  lines.push("## Install");
  lines.push("");
  lines.push("```");
  lines.push("unzip panini-toolchain.zip && cd panini-toolchain");
  lines.push("./install.sh                 # ~/.local/bin");
  lines.push("./install.sh /usr/local");
  lines.push("export PATH=\"$HOME/.local/bin:$PATH\"");
  lines.push("panc --example factorial     # 720");
  lines.push("panpy --example gcd          # 21");
  lines.push("```");
  lines.push("");
  lines.push("## Flags (every frontend)");
  lines.push("");
  for (const [k, v] of COMMON_FLAGS) lines.push(`- \`${k}\` — ${v}`);
  lines.push("");
  lines.push("## Exit");
  lines.push("");
  for (const [k, v] of EXIT_LINES) lines.push(`- ${k} — ${v}`);
  lines.push("");
  lines.push("## Human languages (ILM)");
  lines.push("");
  lines.push(`C-keyword maps. Hindi bar is ${ilm.find((x) => x.id === "hindi")?.bar ?? 29}. Empty cell = no invented translation.`);
  lines.push("");
  for (const L of ilm) lines.push(`- ${L.title} (${L.id}) — ${L.script}, ${L.n} rows`);
  lines.push("");
  lines.push("## Test suites");
  lines.push("");
  lines.push("STANDARD GREEN is a named issuing-body extract. CORE GREEN is a homemade set until that extract exists. The gap column is what is *not* claimed.");
  lines.push("");
  lines.push("| bin | language | suite | gap | WASM | host |");
  lines.push("|---|---|---|---|---|---|");
  for (const r of rows) {
    lines.push(
      `| ${r.bin} | ${r.title} | ${r.suite.replace(/\|/g, "/")} | ${r.gap.replace(/\|/g, "/")} | ${r.wasm ? "yes" : "—"} | ${r.native || "—"} |`,
    );
  }
  lines.push("");
  lines.push("## Binaries");
  lines.push("");
  lines.push("| bin | language | what | ext | ILM | examples |");
  lines.push("|---|---|---|---|---|---|");
  for (const r of rows) {
    const ilmBit = r.ilm ? "yes" : "—";
    const ex = r.examples.map((e) => e.id).join(", ") || "—";
    lines.push(`| ${r.bin} | ${r.title} | ${r.what} | ${r.ext} | ${ilmBit} | ${ex} |`);
  }
  lines.push("");
  for (const g of rowsByGroup()) {
    lines.push(`## ${g.group}`);
    lines.push("");
    for (const r of g.items) {
      lines.push(`### ${r.bin} — ${r.title}`);
      lines.push("");
      lines.push(r.blurb);
      lines.push("");
      lines.push(`- suite: ${r.suite}`);
      lines.push(`- gap: ${r.gap}`);
      lines.push(`- module: ${r.module}`);
      lines.push(`- usage: \`${r.bin} program${r.ext}\``);
      lines.push(`- WASM: ${r.wasm ? "C extract backend (integer subset)" : "no"}`);
      lines.push(`- host: ${r.native || "no"}`);
      lines.push(`- ILM: ${r.ilm ? "yes" : "no"}`);
      lines.push(`- keywords: ${r.keywords.join(", ") || "—"}`);
      lines.push(`- examples: ${r.examples.map((e) => `${e.id}${e.kind === "error" ? " (err)" : ""}`).join(", ") || "—"}`);
      lines.push("");
    }
  }
  lines.push("## panini (meta)");
  lines.push("");
  lines.push("The language itself is `panpni`. This binary lists tools and forwards `panini keywords panc`.");
  lines.push("");
  lines.push("```");
  lines.push("panini list");
  lines.push("panini examples c");
  lines.push("panini keywords panc");
  lines.push("panini help");
  lines.push("```");
  lines.push("");
  lines.push(`Frontends in this tree: ${FRONTENDS.length}. Named ELFs: ${rows.length + 1} (plus panini).`);
  lines.push("");
  return lines.join("\n");
}
