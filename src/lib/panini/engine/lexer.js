// @ts-nocheck
/* tree-rev: 2026.08.28 */
/* Copyright (C) 1993-2026 Abhishek Choudhary
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { TokenKind, KEYWORDS, MULTI_OPS, SINGLE_OPS } from "./tokens.js";

export class LexError extends Error {
  constructor(message, line, column) {
    super(`${message} at ${line}:${column}`);
    this.line = line;
    this.column = column;
    this.name = "LexError";
  }
}

export class Lexer {
  constructor(source, filename = "<stdin>") {
    this.source = source;
    this.filename = filename;
    this.i = 0;
    this.line = 1;
    this.column = 1;
  }

  peek(n = 0) {
    return this.source[this.i + n] ?? "";
  }

  advance() {
    const ch = this.source[this.i++] ?? "";
    if (ch === "\n") {
      this.line += 1;
      this.column = 1;
    } else {
      this.column += 1;
    }
    return ch;
  }

  match(str) {
    if (this.source.startsWith(str, this.i)) {
      for (let k = 0; k < str.length; k++) this.advance();
      return true;
    }
    return false;
  }

  token(kind, value, start) {
    return {
      kind,
      value,
      start,
      end: { line: this.line, column: this.column, index: this.i },
      filename: this.filename,
    };
  }

  skipWhitespaceNoNL() {
    while (this.peek() === " " || this.peek() === "\t" || this.peek() === "\r") {
      this.advance();
    }
  }

  readLineComment() {
    const start = { line: this.line, column: this.column, index: this.i };
    this.match("//");
    let text = "";
    while (this.peek() && this.peek() !== "\n") text += this.advance();
    return this.token(TokenKind.COMMENT, text, start);
  }

  readHashComment() {
    const start = { line: this.line, column: this.column, index: this.i };
    this.advance(); // #
    let text = "";
    while (this.peek() && this.peek() !== "\n") text += this.advance();
    return this.token(TokenKind.COMMENT, text, start);
  }

  readLineRemainder(tag) {
    const start = { line: this.line, column: this.column, index: this.i };
    if (tag === "REM") {
      this.advance(); this.advance(); this.advance();
    } else if (tag === ";") {
      this.advance();
    }
    let text = "";
    while (this.peek() && this.peek() !== "\n") text += this.advance();
    return this.token(TokenKind.COMMENT, text, start);
  }

  readBlockComment() {
    const start = { line: this.line, column: this.column, index: this.i };
    this.match("/*");
    let text = "";
    while (this.i < this.source.length) {
      if (this.match("*/")) {
        return this.token(TokenKind.COMMENT, text, start);
      }
      text += this.advance();
    }
    throw new LexError("Unterminated block comment", start.line, start.column);
  }

  readString() {
    const start = { line: this.line, column: this.column, index: this.i };
    const quote = this.advance();
    let value = "";
    while (this.i < this.source.length) {
      const ch = this.peek();
      if (ch === quote) {
        this.advance();
        return this.token(TokenKind.STRING, value, start);
      }
      if (ch === "\\") {
        this.advance();
        const esc = this.advance();
        const map = { n: "\n", t: "\t", r: "\r", "\\": "\\", '"': '"', "'": "'" };
        value += map[esc] ?? esc;
      } else {
        value += this.advance();
      }
    }
    throw new LexError("Unterminated string", start.line, start.column);
  }

  readNumber() {
    const start = { line: this.line, column: this.column, index: this.i };
    let raw = "";
    while (/\d/.test(this.peek())) raw += this.advance();
    if (this.peek() === "." && /\d/.test(this.peek(1))) {
      raw += this.advance();
      while (/\d/.test(this.peek())) raw += this.advance();
    }
    if (/[eE]/.test(this.peek())) {
      raw += this.advance();
      if (this.peek() === "+" || this.peek() === "-") raw += this.advance();
      while (/\d/.test(this.peek())) raw += this.advance();
    }
    return this.token(TokenKind.NUMBER, raw.includes(".") || /[eE]/.test(raw) ? Number(raw) : Number(raw), start);
  }

  readIdent() {
    const start = { line: this.line, column: this.column, index: this.i };
    let raw = "";
    const first = this.peek();
    if (!/[A-Za-z_@\u0080-\uFFFF]/.test(first)) {
      throw new LexError(`Unexpected character ${JSON.stringify(first)}`, this.line, this.column);
    }
    raw += this.advance();
    while (/[A-Za-z0-9_$\u0080-\uFFFF]/.test(this.peek())) {
      raw += this.advance();
    }
    if (raw === "IS" && this.peek() === "_" ) {
      // handled as IS_NOT keyword if next is NOT — peek word
    }
    const kind = KEYWORDS.has(raw) ? TokenKind.KEYWORD : TokenKind.IDENT;
    return this.token(kind, raw, start);
  }

  nextToken(opts = { emitComments: false, emitNewlines: false }) {
    for (;;) {
      this.skipWhitespaceNoNL();
      if (this.i >= this.source.length) {
        return this.token(TokenKind.EOF, null, {
          line: this.line,
          column: this.column,
          index: this.i,
        });
      }
      const ch = this.peek();
      if (ch === "\n") {
        const start = { line: this.line, column: this.column, index: this.i };
        this.advance();
        if (opts.emitNewlines) return this.token(TokenKind.NEWLINE, "\n", start);
        continue;
      }
      if (ch === "/" && this.peek(1) === "/") {
        const tok = this.readLineComment();
        if (opts.emitComments) return tok;
        continue;
      }
      if (ch === "/" && this.peek(1) === "*") {
        const tok = this.readBlockComment();
        if (opts.emitComments) return tok;
        continue;
      }
      /* Literate PANINI: markdown headings, BASIC REM, and ;-to-EOL comments.
       * Documentation strand, not a syntax error. See spec/PANINI_LITERATE.md */
      if (ch === "#") {
        const tok = this.readHashComment();
        if (opts.emitComments) return tok;
        continue;
      }
      if (ch === ";") {
        const tok = this.readLineRemainder(";");
        if (opts.emitComments) return tok;
        continue;
      }
      if ((ch === "R" || ch === "r") && /^REM\b/i.test(this.source.slice(this.i, this.i + 4))) {
        const tok = this.readLineRemainder("REM");
        if (opts.emitComments) return tok;
        continue;
      }
      if (ch === '"' || ch === "'") return this.readString();
      if (/\d/.test(ch)) return this.readNumber();

      // multi-char ops
      for (const op of MULTI_OPS) {
        if (this.source.startsWith(op, this.i)) {
          const start = { line: this.line, column: this.column, index: this.i };
          this.match(op);
          return this.token(TokenKind.OP, op, start);
        }
      }

      if (SINGLE_OPS.has(ch)) {
        const start = { line: this.line, column: this.column, index: this.i };
        this.advance();
        return this.token(TokenKind.OP, ch, start);
      }

      if (/[A-Za-z_\u0080-\uFFFF]/.test(ch)) {
        // special-case IS_NOT as two-part keyword written with underscore already in KEYWORDS
        return this.readIdent();
      }

      throw new LexError(`Unexpected character ${JSON.stringify(ch)}`, this.line, this.column);
    }
  }

  tokenize(opts = {}) {
    const tokens = [];
    for (;;) {
      const tok = this.nextToken(opts);
      tokens.push(tok);
      if (tok.kind === TokenKind.EOF) break;
    }
    return tokens;
  }
}

export function lex(source, filename) {
  return new Lexer(source, filename).tokenize();
}
