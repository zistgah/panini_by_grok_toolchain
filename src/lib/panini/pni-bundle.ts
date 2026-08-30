/* Copyright (C) 1993-2026 Abhishek Choudhary | GPL-3.0-or-later
 * Vite raw map of PANINI frontend modules. Node CLI reads the .pni from disk.
 */
const raw = import.meta.glob("../../panini/frontends/*.pni", {
  query: "?raw",
  eager: true,
  import: "default",
}) as Record<string, string>;

export function getPni(file: string): string {
  const base = file.split("/").pop() || file;
  const hit = Object.entries(raw).find(([k]) => (k.split("/").pop() || k) === base);
  if (!hit) throw new Error("missing PANINI frontend " + file);
  return hit[1];
}

export function listPni(): string[] {
  return Object.keys(raw)
    .map((k) => k.split("/").pop() || k)
    .sort();
}
