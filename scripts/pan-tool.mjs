#!/usr/bin/env node
/* Copyright (C) 1993-2026 Abhishek Choudhary | GPL-3.0-or-later
 * Named frontend tools: panc, panpy, pancxx, …
 * argv0 (or PAN_TOOL) selects the frontend. Exit 0/1/2.
 *
 * The first process re-execs with --experimental-strip-types; that rewrite
 * changes argv0 to pan-tool.mjs, so the tool name is stashed in PAN_TOOL.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const cliTs = path.join(here, "../src/lib/panini/cli.ts");

function pathToFileUrl(p) {
  return "file://" + path.resolve(p);
}

function toolName() {
  const env = process.env.PAN_TOOL;
  if (env && env !== "panini") return env;
  const base = path.basename(process.argv[1] || "").replace(/\.(mjs|js)$/, "");
  if (base && base !== "pan-tool" && base !== "_run" && base !== "panini") return base;
  return "";
}

if (!process.execArgv.includes("--experimental-strip-types")) {
  const name = toolName();
  const env = { ...process.env };
  if (name) env.PAN_TOOL = name;
  const child = spawn(
    process.execPath,
    ["--experimental-strip-types", "--no-warnings", fileURLToPath(import.meta.url), ...process.argv.slice(2)],
    { stdio: "inherit", env },
  );
  child.on("exit", (code) => process.exit(code ?? 0));
} else {
  const { runCli } = await import(pathToFileUrl(cliTs));
  const { runHostCc } = await import(pathToFileUrl(path.join(here, "../src/lib/panini/host-cc-run.server.ts")));
  const name = toolName();
  const rest = process.argv.slice(2);
  const argv = name && rest[0] !== name ? [name, ...rest] : rest.length ? rest : name ? [name, "--help"] : ["help"];
  const code = await runCli(argv, undefined, {
    readFile: (p) => fs.readFileSync(p, "utf8"),
    writeFile: (p, d) => fs.writeFileSync(p, d),
    nativeCc: runHostCc,
  });
  process.exit(code);
}
