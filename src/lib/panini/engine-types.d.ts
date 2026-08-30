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
declare module "./engine/values.js" {
  export const Tag: Record<string, string>;
  export function wrap(js: unknown): unknown;
  export function unwrap(v: unknown): unknown;
  export function display(v: unknown): string;
}
declare module "./engine/interpreter.js" {
  export class Runtime {
    prints: string[];
    functions: Map<string, unknown>;
  }
  export class Interpreter {
    runtime: Runtime;
    global: unknown;
    callValue(fn: unknown, args: unknown[], env: unknown): Promise<unknown>;
  }
  export function runSource(
    source: string,
    filename?: string,
    options?: { runMain?: boolean; maxSteps?: number; runtime?: Runtime },
  ): Promise<{ result: unknown; ast: unknown; interpreter: Interpreter; runtime: Runtime }>;
}
