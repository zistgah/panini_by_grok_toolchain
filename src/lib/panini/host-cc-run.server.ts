/* Copyright (C) 1993-2026 Abhishek Choudhary | GPL-3.0-or-later
 * Host cc/gcc/clang or python3. Node only — not the C extract, not WASM.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { NativeCcResult } from "./backend.ts";

function which(names: string[]): string | null {
  for (const n of names) {
    const r = spawnSync("sh", ["-c", "command -v " + n], { encoding: "utf8" });
    if (r.status === 0 && r.stdout.trim()) return r.stdout.trim();
  }
  return null;
}

function safeBase(name: string, i: number): string {
  const base = path.basename(name || "src-" + i).replace(/[^A-Za-z0-9._-]/g, "_") || "src-" + i;
  return base;
}

export function runHostCc(args: {
  hint: "cc" | "c++" | "python3";
  files: { name: string; text: string }[];
  output?: string;
  run: boolean;
  confine?: boolean;
}): NativeCcResult {
  const hint = args.hint;
  const files = (args.files || []).slice(0, 16);
  if (!files.length) return { ok: false, error: "no source files" };
  for (const f of files) {
    if (String(f.text || "").length > 256 * 1024) return { ok: false, error: "source too large" };
  }
  const bins =
    hint === "python3" ? ["python3", "python"] : hint === "c++" ? ["c++", "g++", "clang++"] : ["cc", "gcc", "clang"];
  const bin = which(bins);
  if (!bin) return { ok: false, error: "no host " + bins[0] + " on PATH" };

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pan-"));
  const timeout = 15000;

  if (hint === "python3") {
    const paths = files.map((f, i) => {
      const base = safeBase(f.name, i);
      const p = path.join(dir, base.endsWith(".py") ? base : base + ".py");
      let text = f.text;
      if (/\bdef\s+main\s*\(/.test(text) && !/\bmain\s*\(/.test(text.replace(/def\s+main\s*\([^)]*\)\s*:/, ""))) {
        text += "\nmain()\n";
      }
      fs.writeFileSync(p, text);
      return p;
    });
    const r = spawnSync(bin, paths, { encoding: "utf8", timeout, maxBuffer: 1024 * 1024 });
    return {
      ok: r.status === 0,
      status: r.status,
      stdout: r.stdout || "",
      stderr: r.stderr || "",
      compiler: bin,
      argv: [bin, ...paths],
      error: r.status === 0 ? undefined : r.stderr || "python failed",
    };
  }

  const paths = files.map((f, i) => {
    const base = safeBase(f.name, i);
    const p = path.join(dir, base);
    fs.writeFileSync(p, f.text);
    return p;
  });
  const requested = args.output ? path.basename(args.output) : "a.out";
  const out = args.confine || !args.output ? path.join(dir, requested || "a.out") : path.resolve(args.output);
  const argv = [bin, ...paths, "-o", out];
  const c = spawnSync(argv[0], argv.slice(1), { encoding: "utf8", timeout, maxBuffer: 1024 * 1024 });
  if (c.status !== 0) {
    return {
      ok: false,
      status: c.status,
      stdout: c.stdout || "",
      stderr: c.stderr || "",
      compiler: bin,
      argv,
      error: c.stderr || "compile failed",
    };
  }
  let binaryBase64: string | undefined;
  try {
    const bytes = fs.readFileSync(out);
    if (bytes.length <= 4 * 1024 * 1024) binaryBase64 = bytes.toString("base64");
  } catch {
    /* leave unset */
  }
  if (!args.run) {
    return {
      ok: true,
      status: 0,
      output: args.confine ? requested : out,
      compiler: bin,
      argv,
      stdout: "wrote " + (args.confine ? requested : out) + "\n",
      binaryBase64,
    };
  }
  const x = spawnSync(out, [], { encoding: "utf8", timeout, maxBuffer: 1024 * 1024 });
  return {
    ok: true,
    status: x.status,
    stdout: x.stdout || "",
    stderr: x.stderr || "",
    compiler: bin,
    argv,
    output: args.confine ? requested : out,
    binaryBase64,
  };
}
