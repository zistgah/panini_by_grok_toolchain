/* Copyright (C) 1993-2026 Abhishek Choudhary | GPL-3.0-or-later
 * Workbench --native: host cc on the server. Confined to a temp dir.
 */
import { createServerFn } from "@tanstack/react-start";
import type { NativeCcResult } from "./backend.ts";

type Args = {
  hint: "cc" | "c++" | "python3";
  files: { name: string; text: string }[];
  output?: string;
  run: boolean;
};

export const hostCompile = createServerFn({ method: "POST" })
  .validator((d: Args) => d)
  .handler(async ({ data }): Promise<NativeCcResult> => {
    const { runHostCc } = await import("./host-cc-run.server.ts");
    try {
      return runHostCc({ ...data, confine: true });
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  });
