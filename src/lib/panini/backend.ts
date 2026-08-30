/* Copyright (C) 1993-2026 Abhishek Choudhary | GPL-3.0-or-later
 * Emit: WASM (in-tree wat2wasm), WAT, lowered C, host cc.
 * panc is not gcc. --native is gcc/clang when a host provides it.
 */
import { dumpAst, lowerToC } from "./ast.ts";
import { cToWat, cToWasm, runCWasm } from "./engine/c2wat.js";
import { clower } from "./engine/clower.js";
import { gnuc } from "./engine/gnuc.js";

export type EmitKind = "run" | "wasm" | "wat" | "c" | "ast" | "native";

export type NativeCcResult = {
  ok: boolean;
  status?: number | null;
  stdout?: string;
  stderr?: string;
  output?: string;
  argv?: string[];
  compiler?: string;
  error?: string;
  binaryBase64?: string;
};

export type NativeCcFn = (args: {
  hint: "cc" | "c++" | "python3";
  files: { name: string; text: string }[];
  output?: string;
  run: boolean;
}) => NativeCcResult | Promise<NativeCcResult>;

export function joinTranslationUnits(files: { name: string; text: string }[]): string {
  if (files.length === 1) return files[0].text;
  return files
    .map((f) => `/* file: ${f.name} */\n${f.text.replace(/\s+$/, "")}\n`)
    .join("\n");
}

export function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

export function base64ToBytes(s: string): Uint8Array {
  if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(s, "base64"));
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function emitWasm(id: string, source: string): Promise<{ wat: string; bytes: Uint8Array }> {
  const c = lowerToC(id, source);
  if (c == null) {
    throw new Error("WASM backend is the C extract. " + id + " does not lower to C.");
  }
  return cToWasm(c);
}

export function emitWat(id: string, source: string): string {
  const c = lowerToC(id, source);
  if (c == null) throw new Error("WAT backend is the C extract. " + id + " does not lower to C.");
  return cToWat(c);
}

export function emitLoweredC(id: string, source: string): string {
  const c = lowerToC(id, source);
  if (c == null) throw new Error(id + " has no C lowering");
  if (id === "c" || id === "cppp") return clower(gnuc(c));
  return c;
}

export async function runWasm(id: string, source: string): Promise<{ wat: string; bytes: Uint8Array; value: number }> {
  const c = lowerToC(id, source);
  if (c == null) throw new Error("WASM backend is the C extract.");
  return runCWasm(c);
}

export function nativeHint(id: string): "cc" | "c++" | "python3" | null {
  if (id === "c" || id === "cppp" || id === "asm") return "cc";
  if (id === "cpp") return "c++";
  if (id === "python") return "python3";
  return null;
}

export { dumpAst, cToWat, cToWasm };
