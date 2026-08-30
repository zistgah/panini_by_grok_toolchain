/* Copyright (C) 1993-2026 Abhishek Choudhary | GPL-3.0-or-later
 * Shared contract for every frontend: one result shape, one diagnostic shape.
 */

export type FrontendGroup =
  | "systems"
  | "dynamic"
  | "classic"
  | "kernel"
  | "lowhanging"
  | "panini";

export type Diagnostic = {
  phase: string;
  error: string;
  line?: number;
  column?: number;
  hint?: string;
  leftover?: string;
  excerpt?: string;
};

export type RunResult = {
  ok: boolean;
  value?: unknown;
  print?: string;
  prints?: string[];
  lowered?: string;
  tokens?: string[];
  error?: string;
  rejected?: string;
  frontend: string;
  note?: string;
  regs?: Record<string, number>;
  config?: Record<string, unknown>;
  phase?: string;
  stack?: string;
  line?: number;
  column?: number;
  hint?: string;
  leftover?: string;
  excerpt?: string;
  cli?: string;
  diagnostics?: Diagnostic[];
  ast?: unknown;
  wat?: string;
  wasmBytes?: number;
  wasmBase64?: string;
};

export type ExampleKind = "run" | "error";

export type Example = {
  id: string;
  title: string;
  blurb: string;
  source: string;
  kind: ExampleKind;
  expect?: { ok: boolean; value?: unknown };
  files?: { name: string; text: string }[];
};

export type FrontendMeta = {
  ext: string;
  monaco: string;
  ilm: boolean;
};

export function asText(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
