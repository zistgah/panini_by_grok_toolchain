/* Copyright (C) 1993-2026 Abhishek Choudhary | GPL-3.0-or-later
 * ILM: representation varies; identity does not. Keyword maps from keywords.ts.
 */
import { ILM_LANGUAGES, type IlmLanguage } from "./keywords.ts";
import { metaOf } from "./meta.ts";

export type IlmId = keyof typeof ILM_LANGUAGES | "en";

export const ILM_OPTIONS: { id: string; title: string; script: string; dir: "ltr" | "rtl" }[] = [
  { id: "en", title: "English", script: "Latin", dir: "ltr" },
  ...Object.values(ILM_LANGUAGES).map((L) => ({
    id: L.id,
    title: L.title,
    script: L.script,
    dir: rtlScript(L) ? ("rtl" as const) : ("ltr" as const),
  })),
];

function rtlScript(L: IlmLanguage): boolean {
  return /arabic|aramaic|hebrew|syriac|phoenician|urdu|shahmukhi|pashto|persian|dari|sindhi|kashmiri/i.test(
    `${L.id} ${L.script} ${L.family}`,
  );
}

function rules(langId: string, nativeToHost: boolean): { from: string; to: string }[] {
  const lang = ILM_LANGUAGES[langId];
  if (!lang) return [];
  const seen = new Set<string>();
  const out: { from: string; to: string }[] = [];
  for (const row of lang.rows) {
    const from = nativeToHost ? row.native : row.c;
    const to = nativeToHost ? row.c : row.native;
    if (!from || !to || seen.has(from)) continue;
    seen.add(from);
    out.push({ from, to });
  }
  out.sort((a, b) => b.from.length - a.from.length);
  return out;
}

function applyAsciiAware(src: string, list: { from: string; to: string }[], hostKeys: boolean): string {
  let out = src;
  for (const r of list) {
    if (!r.from) continue;
    if (hostKeys && /^[A-Za-z_][\w]*$/.test(r.from)) {
      out = out.replace(new RegExp(`\\b${r.from}\\b`, "g"), r.to);
    } else {
      out = out.split(r.from).join(r.to);
    }
  }
  return out;
}

export function transduceToHost(source: string, ilmId: string): string {
  if (!ilmId || ilmId === "en") return source;
  return applyAsciiAware(source, rules(ilmId, true), false);
}

export function transduceToNative(source: string, ilmId: string): string {
  if (!ilmId || ilmId === "en") return source;
  return applyAsciiAware(source, rules(ilmId, false), true);
}

export function canIlm(frontendId: string): boolean {
  return metaOf(frontendId).ilm;
}

export function ilmLanguage(id: string): IlmLanguage | null {
  return ILM_LANGUAGES[id] || null;
}
