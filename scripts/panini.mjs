#!/usr/bin/env node
/* Copyright (C) 1993-2026 Abhishek Choudhary | GPL-3.0-or-later
 * Node entry for `panini fe`. Re-execs with strip-types so the TS runner loads.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const cliTs = path.join(here, "../src/lib/panini/cli.ts");

if (!process.execArgv.includes("--experimental-strip-types")) {
  const child = spawn(
    process.execPath,
    ["--experimental-strip-types", "--no-warnings", fileURLToPath(import.meta.url), ...process.argv.slice(2)],
    { stdio: "inherit" },
  );
  child.on("exit", (code) => process.exit(code ?? 0));
} else {
  const { runCli } = await import(pathToFileUrl(cliTs));
  const { runHostCc } = await import(pathToFileUrl(path.join(here, "../src/lib/panini/host-cc-run.server.ts")));
  const code = await runCli(process.argv.slice(2), undefined, {
    readFile: (p) => fs.readFileSync(p, "utf8"),
    writeFile: (p, d) => fs.writeFileSync(p, d),
    nativeCc: runHostCc,
  });
  process.exit(code);
}

function pathToFileUrl(p) {
  const u = path.resolve(p);
  return "file://" + u;
}
