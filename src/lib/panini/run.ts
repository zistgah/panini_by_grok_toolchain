/* Copyright (C) 1993-2026 Abhishek Choudhary | GPL-3.0-or-later
 * Every frontend run goes through a PANINI .pni module.
 * Stage-0 JS is the PANINI virtual machine, not a frontend.
 */
import { runPniFrontend } from "./pni-front.ts";
import { normalize } from "./result.ts";
import type { RunResult } from "./protocol.ts";

export async function runLang(id: string, source: string, ilm?: string): Promise<RunResult> {
  const src = String(source);
  try {
    const raw = await runPniFrontend(id, src);
    return normalize(id, raw, src, ilm);
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return normalize(id, { ok: false, error, frontend: "PANINI.Frontend." + id, phase: "eval" }, src, ilm);
  }
}

export type { RunResult } from "./protocol.ts";
