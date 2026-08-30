declare module "./engine/cinterp.js" {
  export function cinterp(source: string): number;
  export function parseC(source: string): { op: string; body: unknown[]; foff?: Record<string, number>; source?: string };
}
declare module "./engine/cparse.js" {
  export function parseC(source: string): { op: string; body: unknown[]; foff?: Record<string, number>; source?: string };
}
declare module "./engine/c2wat.js" {
  export function cToWat(source: string | object): string;
  export function cToWasm(source: string | object): { wat: string; bytes: Uint8Array };
  export function runCWasm(
    source: string,
    name?: string,
    args?: unknown[],
  ): Promise<{ wat: string; bytes: Uint8Array; value: number }>;
}
declare module "./engine/wat2wasm.js" {
  export function wat2wasm(text: string): Uint8Array;
  export function wasmRun(bytes: Uint8Array, name?: string, args?: unknown[]): Promise<unknown>;
  export function watToBase64(text: string): string;
}
declare module "./engine/clower.js" {
  export function clower(src: string): string;
}
declare module "./engine/gnuc.js" {
  export function gnuc(src: string): string;
}
declare module "./engine/ccpp.js" {
  export function ccpp(src: string): string;
}
declare module "./engine/cpplower.js" {
  export function cpplower(src: string): string;
  export function cppReject(src: string): string | null;
}
declare module "./engine/js262.js" {
  export function js262Run(source: string): { ok: boolean; value?: unknown; error?: string; frontend?: string; unparsed?: string };
  export function ts262Run(source: string): { ok: boolean; value?: unknown; error?: string; frontend?: string };
}
declare module "./engine/hseval.js" {
  export function haskellRun(source: string): { ok: boolean; value?: unknown; print?: string; error?: string; frontend?: string };
}
declare module "./engine/steval.js" {
  export function stRunFile(src: string): { ok: boolean; prints?: unknown[]; error?: string; frontend?: string };
  export function stFormat(v: unknown): string;
}
declare module "./engine/qb64.js" {
  export function qb64Run(source: string): { ok?: boolean; prints?: unknown[]; frontend?: string; error?: string };
}
declare module "./engine/stdlower.js" {
  export function rustToC(src: string): string;
  export function goToC(src: string): string;
  export function juliaToC(src: string): string;
  export function zigToC(src: string): string;
  export function luaToC(src: string): string;
  export function fortranToC(src: string): string;
  export function pascalToC(src: string): string;
  export function pascalReject(src: string): string | null;
  export function javaToC(src: string): string;
  export function javaReject(src: string): string | null;
  export function csharpToC(src: string): string;
  export function kotlinToC(src: string): string;
  export function swiftToC(src: string): string;
  export function swiftReject(src: string): string | null;
  export function scalaToC(src: string): string;
  export function dartToC(src: string): string;
  export function adaToC(src: string): string;
}
declare module "./engine/appeval.js" {
  export type AppEvalResult = {
    ok: boolean;
    value?: unknown;
    print?: string;
    prints?: string[];
    error?: string;
    frontend: string;
    note?: string;
    config?: Record<string, unknown>;
  };
  export function rubyRun(source: string): AppEvalResult;
  export function perlRun(source: string): AppEvalResult;
  export function phpRun(source: string): AppEvalResult;
  export function rRun(source: string): AppEvalResult;
  export function cobolRun(source: string): AppEvalResult;
  export function sqlRun(source: string): AppEvalResult;
  export function octaveRun(source: string): AppEvalResult;
  export function sysmlRun(source: string): AppEvalResult;
}
declare module "./engine/cleval.js" {
  export function lispRun(source: string): { ok: boolean; value?: unknown; error?: string; frontend?: string };
}
declare module "./engine/pleval.js" {
  export function prologRun(source: string): { ok: boolean; value?: unknown; error?: string; frontend?: string };
}
declare module "./engine/diagnose.js" {
  export function cDiag(src: string): string | null;
  export function leftoverHint(id: string, lowered: string): string | null;
  export function numbered(src: string, limit?: number): string;
  export function parseLoc(error: string): { line?: number; column?: number };
  export function formatFrontendError(opts: {
    frontend?: string;
    id?: string;
    phase?: string;
    error?: string;
    leftover?: string;
    hint?: string;
    lowered?: string;
    excerpt?: string;
  }): string;
  export function wrapDiag(
    frontend: string,
    e: unknown,
    extra?: Record<string, unknown>,
  ): Record<string, unknown>;
}
declare module "./engine/lexer.js" {
  export class Lexer {
    constructor(source: string, filename?: string);
    tokenize(opts?: object): unknown[];
  }
  export function lex(source: string, filename?: string): unknown[];
}
declare module "./engine/parser.js" {
  export class Parser {
    constructor(tokens: unknown[], source?: string, filename?: string);
    parse(): unknown;
  }
  export class ParseError extends Error {}
}
