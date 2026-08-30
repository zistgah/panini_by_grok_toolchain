// @ts-nocheck
/* tree-rev: 2026.08.28 */
/* Copyright (C) 1993-2026 Abhishek Choudhary
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { TokenKind } from "./tokens.js";
import { Lexer } from "./lexer.js";
import { N } from "./ast.js";

export class ParseError extends Error {
  constructor(message, token) {
    const at = token
      ? `${token.filename || "?"}:${token.start?.line}:${token.start?.column}`
      : "?";
    super(`${message} (${at})`);
    this.token = token;
    this.name = "ParseError";
  }
}

const BLOCK_STARTERS = new Set([
  "MODULE", "SCOPE", "CONSTITUTION", "FUNCTION", "CLASS", "TRAIT", "INTERFACE",
  "IF", "ELSE", "ELSEIF", "ELSIF", "FOR", "FOREACH", "WHILE", "UNTIL", "REPEAT",
  "TRY", "CATCH", "FINALLY", "MATCH", "CASE",
  "FILE", "CONTENT", "ARTIFACT", "DELIVERABLE", "ARTIFACT_REVISION",
  "CONFIGURATION", "PROGRAM", "TEST", "PROPERTY",
  "SCHEMA", "CONSTRAINT", "RULE", "ENUM",
  "EVENT", "WATCH", "ACTOR", "PARALLEL",
  "CYCLER", "META_CYCLER", "STAGE", "CYCLE", "STATE",
  "MODEL", "PROMPT", "AGENT",
  "CLAIM", "MEASUREMENT", "BOOTSTRAP", "DOCUMENT", "THEOREM", "INVARIANT",
  "CAPABILITY", "POLICY", "GATE", "RECOVERY",
  "PROVENANCE", "OPERATIONS", "INVOCATION", "SOURCES",
  "DOMAIN_MODEL", "FORMATION", "POST_ABDICATION", "ROUTES",
  "RUNTIME", "PACKAGE", "TASK",
  "PRINCIPLES", "GIVEN", "DEFINE", "REQUIRE", "CONCLUDE",
]);

export class Parser {
  constructor(tokens, source = "", filename = "<stdin>") {
    this.tokens = tokens.filter((t) => t.kind !== TokenKind.COMMENT);
    this.source = source;
    this.filename = filename;
    this.i = 0;
  }

  peek(n = 0) {
    return this.tokens[this.i + n] ?? this.tokens[this.tokens.length - 1];
  }

  at(kindOrValue, n = 0) {
    const t = this.peek(n);
    if (!t) return false;
    if (kindOrValue === t.kind) return true;
    if (t.kind === TokenKind.KEYWORD && t.value === kindOrValue) return true;
    if (t.kind === TokenKind.OP && t.value === kindOrValue) return true;
    return false;
  }

  eat() {
    const t = this.peek();
    this.i += 1;
    return t;
  }

  expect(kindOrValue, message) {
    if (this.at(kindOrValue)) return this.eat();
    throw new ParseError(message || `Expected ${kindOrValue}, got ${this.describe(this.peek())}`, this.peek());
  }

  describe(t) {
    if (!t) return "EOF";
    if (t.kind === TokenKind.EOF) return "EOF";
    return `${t.kind}:${JSON.stringify(t.value)}`;
  }

  skipEndSuffix() {
    // Bare END. "END FILE" is the only safe labeled closer (FILE cannot
    // start a following declaration in the same way MODULE/FUNCTION can).
    if (this.at("END")) {
      this.eat();
      if (this.at("FILE")) this.eat();
      return true;
    }
    return false;
  }

  parse() {
    const body = [];
    while (!this.at(TokenKind.EOF)) {
      if (this.at("END")) {
        // stray closer at top-level of a wrapped module body handled by caller
        break;
      }
      body.push(this.parseTop());
    }
    return N.Program(body);
  }

  parseTop() {
    if (this.at("MODULE") || this.at("SCOPE")) return this.parseModule();
    if (this.at("CONSTITUTION")) return this.parseNamedBlock("CONSTITUTION", "Constitution");
    if (this.at("FUNCTION")) return this.parseFunction();
    if (this.at("CLASS")) return this.parseClass();
    if (this.at("TRAIT") || this.at("INTERFACE") || this.at("SYNTAX") || this.at("RESOLUTION")) {
      return this.parseNamedBlock(this.peek().value);
    }
    if (this.at("SIGNAL") || this.at("COMPONENT") || this.at("POLICY")) {
      return this.parseNamedBlock(this.peek().value);
    }
    if (this.at("TYPE")) return this.parseTypeDecl();
    if (this.at("IMPORT")) return this.parseImport();
    if (this.at("EXPORT")) return this.parseExport();
    if (this.at("PACKAGE")) return this.parsePackage();
    if (this.at("FILE")) return this.parseFileBlock();
    if (this.at("ARTIFACT") || this.at("DELIVERABLE") || this.at("ARTIFACT_REVISION")) {
      return this.parseNamedBlock(this.peek().value, "Artifact");
    }
    if (this.at("CONFIGURATION")) return this.parseNamedBlock("CONFIGURATION", "Configuration");
    if (this.at("PROGRAM")) return this.parseProgramDecl();
    if (this.at("TEST") || this.at("PROPERTY")) return this.parseTestDecl();
    if (this.at("ENUM")) return this.parseEnum();
    if (this.at("SCHEMA")) return this.parseNamedBlock("SCHEMA", "Schema");
    if (this.at("CYCLER") || this.at("META_CYCLER")) return this.parseNamedBlock(this.peek().value, "Cycler");
    if (this.at("AGENT") || this.at("MODEL") || this.at("PROMPT")) return this.parseNamedBlock(this.peek().value);
    if (this.at("THEOREM") || this.at("INVARIANT") || this.at("BOOTSTRAP") || this.at("DOCUMENT")) {
      return this.parseNamedBlock(this.peek().value);
    }
    if (this.at("RUNTIME") || this.at("ESTATE") || this.at("CAPABILITY") || this.at("POLICY") || this.at("GATE")) {
      return this.parseNamedBlock(this.peek().value);
    }
    if (this.at("CYCLE") || this.at("STATE") || this.at("EVENT") || this.at("WATCH") || this.at("ACTOR")) {
      return this.parseNamedBlock(this.peek().value);
    }
    if (this.at("CLAIM") || this.at("RULE") || this.at("CONSTRAINT") || this.at("MEASUREMENT")) {
      return this.parseNamedBlock(this.peek().value);
    }
    if (this.at("TASK") || this.at("SERIALIZE") || this.at("CHECKPOINT") || this.at("RESTORE")) {
      return this.parseNamedBlock(this.peek().value);
    }
    if (
      this.at("PURPOSE") || this.at("PRINCIPLES") || this.at("PRINCIPLE") ||
      this.at("NAME") || this.at("KIND") || this.at("SELF_HOSTING")
    ) {
      return this.parseLooseField();
    }
    // fall through to statement so programs can have bare statements
    return this.parseStatement();
  }

  parseModule() {
    if (this.at("SCOPE")) this.eat();
    else this.expect("MODULE");
    const name = this.parseNameish();
    const body = [];
    while (!this.at(TokenKind.EOF) && !this.at("END")) {
      body.push(this.parseTop());
    }
    this.skipEndSuffix();
    return N.Module(name, body);
  }

  parseNameish() {
    if (this.at(TokenKind.STRING) || this.at(TokenKind.NUMBER)) {
      return this.eat().value;
    }
    if (this.at(TokenKind.IDENT) || this.at(TokenKind.KEYWORD)) {
      let name = this.eat().value;
      while (this.at(".")) {
        this.eat();
        if (this.at(TokenKind.IDENT) || this.at(TokenKind.KEYWORD)) {
          name += "." + this.eat().value;
        } else {
          break;
        }
      }
      return name;
    }
    return null;
  }

  parseTypeDecl() {
    this.expect("TYPE");
    const nameTok = this.expect(TokenKind.IDENT, "Expected type name");
    let spec = null;
    if (this.at("<")) {
      this.eat();
      const params = [];
      while (!this.at(">") && !this.at(TokenKind.EOF)) {
        params.push(this.parseTypeRef());
        if (this.at(",")) this.eat();
        else break;
      }
      if (this.at(">")) this.eat();
      spec = { kind: "Generic", params };
    }
    if (this.at("=")) {
      this.eat();
      spec = this.parseTypeRef();
      if (this.at("WHERE")) {
        this.eat();
        spec = { kind: "Refinement", base: spec, where: this.parseExpression() };
      }
    } else if (this.at("(")) {
      // TYPE TYPEOF(x:Any) -> Type
      const params = this.parseParamList();
      let ret = null;
      if (this.at("->")) {
        this.eat();
        ret = this.parseTypeRef();
      }
      spec = { kind: "TypeFunction", params, returnType: ret };
    } else if (!this.at("END") && !this.at(TokenKind.EOF) && (this.at(TokenKind.IDENT) || this.at(TokenKind.KEYWORD))) {
      const variants = [];
      while ((this.at(TokenKind.IDENT) || this.at(TokenKind.KEYWORD)) && !this.looksLikeTop() && !this.at("END")) {
        const vname = this.eat().value;
        let args = [];
        if (this.at("(")) {
          this.skipParenList();
          args = ["..."];
        }
        variants.push({ name: vname, args });
      }
      if (this.at("END")) this.skipEndSuffix();
      spec = { kind: "Sum", variants };
      return N.TypeDecl(nameTok.value, spec);
    }
    if (this.at("END")) this.skipEndSuffix();
    return N.TypeDecl(nameTok.value, spec);
  }

  looksLikeTop() {
    const t = this.peek();
    if (!t || t.kind !== TokenKind.KEYWORD) return false;
    return [
      "MODULE", "TYPE", "FUNCTION", "CLASS", "TRAIT", "INTERFACE",
      "IMPORT", "EXPORT", "PACKAGE", "FILE", "ARTIFACT", "CONFIGURATION",
      "PROGRAM", "TEST", "ENUM", "SCHEMA", "CYCLER", "AGENT", "END",
    ].includes(t.value);
  }

  parseFunction() {
    this.expect("FUNCTION");
    const name = this.at(TokenKind.IDENT) || this.at(TokenKind.KEYWORD) ? this.eat().value : null;
    
    const params = this.at("(") ? this.parseParamList() : [];
    let returnType = null;
    if (this.at("->")) {
      this.eat();
      returnType = this.parseTypeRef();
    }
    const headerOnly = this.at("FUNCTION") || this.at("CLASS") || this.at("TYPE") ||
      this.at("MODULE") || this.at("TRAIT") || this.at("INTERFACE") ||
      this.at("TEST") || this.at("CYCLER") || this.at("END") && false;
    if (this.at("FUNCTION") || this.at("CLASS") || this.at("TYPE") || this.at("MODULE") ||
        this.at("TRAIT") || this.at("INTERFACE") || this.at("TEST") || this.at("CYCLER")) {
      return N.FunctionDecl(name, params, returnType, N.Block([]));
    }
    const body = this.parseBlockUntilEnd();
    return N.FunctionDecl(name, params, returnType, body);
  }

  parseParamList() {
    this.expect("(");
    const params = [];
    while (!this.at(")") && !this.at(TokenKind.EOF)) {
      params.push(this.parseParam());
      if (this.at(",")) this.eat();
      else break;
    }
    this.expect(")");
    return params;
  }

  parseParam() {
    const nameTok = this.at(TokenKind.IDENT) || this.at(TokenKind.KEYWORD)
      ? this.eat()
      : this.expect(TokenKind.IDENT, "Expected parameter name");
    let type = null;
    if (this.at(":")) {
      this.eat();
      type = this.parseTypeRef();
    }
    return N.TypedIdent(nameTok.value, type);
  }

  parseTypeRef() {
    if (this.at(TokenKind.IDENT) || this.at(TokenKind.KEYWORD)) {
      let name = this.eat().value;
      while (this.at(".")) {
        this.eat();
        if (this.at(TokenKind.IDENT) || this.at(TokenKind.KEYWORD)) name += "." + this.eat().value;
        else break;
      }
      const args = [];
      if (this.at("<")) {
        this.eat();
        while (!this.at(">") && !this.at(TokenKind.EOF)) {
          args.push(this.parseTypeRef());
          if (this.at(",")) this.eat();
          else break;
        }
        if (this.at(">")) this.eat();
      }
      return N.TypeRef(name, args);
    }
    if (this.at(TokenKind.STRING)) return N.TypeRef(this.eat().value, []);
    return N.TypeRef("Any", []);
  }

  parseClass() {
    this.expect("CLASS");
    const name = this.parseNameish();
    this.skipTypeParams();
    const members = [];
    while (!this.at("END") && !this.at(TokenKind.EOF)) {
      if (this.at("FIELD")) {
        this.eat();
        const fname = this.parseNameish();
        let type = null;
        if (this.at(":")) {
          this.eat();
          type = this.parseTypeRef();
        }
        members.push(N.FieldDecl(fname, type));
      } else if (this.at("METHOD") || this.at("FUNCTION")) {
        const isMethod = this.at("METHOD");
        this.eat();
        const mname = this.parseNameish();
        const params = this.at("(") ? this.parseParamList() : [];
        let rt = null;
        if (this.at("->")) {
          this.eat();
          rt = this.parseTypeRef();
        }
        const body = this.parseBlockUntilEnd();
        members.push(isMethod ? N.MethodDecl(mname, params, rt, body) : N.FunctionDecl(mname, params, rt, body));
      } else {
        members.push(this.parseStatement());
      }
    }
    this.skipEndSuffix();
    return N.ClassDecl(name, members);
  }

  parseImport() {
    this.expect("IMPORT");
    const path = this.parseNameish();
    return N.Import(path);
  }

  parseExport() {
    this.expect("EXPORT");
    const names = [];
    names.push(this.parseNameish());
    while (this.at(",")) {
      this.eat();
      names.push(this.parseNameish());
    }
    return N.Export(names);
  }

  parsePackage() {
    this.expect("PACKAGE");
    const name = this.parseNameish();
    if (this.at("END") || this.looksLikeBlockBody()) {
      const fields = [];
      if (!this.at("END") && this.looksLikeBlockBody()) {
        while (!this.at("END") && !this.at(TokenKind.EOF) && !this.looksLikeTop()) {
          if (this.at(TokenKind.KEYWORD) && BLOCK_STARTERS.has(this.peek().value) && this.peek().value !== "PACKAGE") break;
          fields.push(this.parseStatement());
          if (fields.length > 200) break;
        }
        if (this.at("END")) this.skipEndSuffix();
      }
      return N.Package(name);
    }
    return N.Package(name);
  }

  looksLikeBlockBody() {
    return this.at("VERSION") || this.at("DIRECTORY") || this.at("PURPOSE") || this.at("NAME");
  }

  parseFileBlock() {
    this.expect("FILE");
    const path = this.at(TokenKind.STRING) || this.at(TokenKind.IDENT) ? this.eat().value : this.parseNameish();
    let mime = null;
    let encoding = null;
    let content = "";
    while (!this.at(TokenKind.EOF)) {
      if (this.at("END")) {
        this.eat();
        if (this.at("FILE") && this.peek(1)?.kind !== TokenKind.STRING) this.eat();
        break;
      }
      if (this.at("MIME")) {
        this.eat();
        mime = this.at(TokenKind.STRING) ? this.eat().value : String(this.parseNameish());
        continue;
      }
      if (this.at("ENCODING")) {
        this.eat();
        encoding = this.at(TokenKind.STRING) ? this.eat().value : String(this.parseNameish());
        continue;
      }
      if (this.at("CONTENT")) {
        this.eat();
        if (this.at(TokenKind.STRING)) {
          content = this.eat().value;
          if (this.at("END")) this.eat();
          continue;
        }
        content = this.captureRawUntilEnd();
        continue;
      }
      // unknown field
      this.eat();
    }
    return N.FileBlock(path, mime, encoding, content);
  }

  captureRawUntilEnd() {
    // Reconstruct raw text from remaining tokens until a lone END
    const parts = [];
    let depth = 1;
    while (!this.at(TokenKind.EOF)) {
      if (this.at("END")) {
        depth -= 1;
        if (depth <= 0) {
          this.eat();
          break;
        }
        parts.push("END");
        this.eat();
        continue;
      }
      if (this.at(TokenKind.KEYWORD) && BLOCK_STARTERS.has(this.peek().value)) {
        depth += 1;
      }
      const t = this.eat();
      if (t.kind === TokenKind.STRING) parts.push(JSON.stringify(t.value));
      else if (t.value == null) parts.push("");
      else parts.push(String(t.value));
    }
    return parts.join(" ");
  }

  parseProgramDecl() {
    this.expect("PROGRAM");
    const name = this.parseNameish();
    const body = this.parseBlockUntilEnd();
    return N.ProgramDecl(name, body);
  }

  parseTestDecl() {
    const kind = this.eat().value;
    const name = this.parseNameish();
    const body = this.parseBlockUntilEnd();
    return N.TestDecl(name || kind, body);
  }

  parseEnum() {
    this.expect("ENUM");
    const name = this.parseNameish();
    const variants = [];
    while (!this.at("END") && !this.at(TokenKind.EOF)) {
      if (this.at(TokenKind.IDENT) || this.at(TokenKind.KEYWORD)) {
        variants.push(this.eat().value);
      } else {
        this.eat();
      }
    }
    this.skipEndSuffix();
    return N.EnumDecl(name, variants);
  }

  skipTypeParams() {
    if (!this.at("<")) return;
    this.eat();
    let depth = 1;
    while (!this.at(TokenKind.EOF) && depth > 0) {
      if (this.at("<")) { this.eat(); depth += 1; }
      else if (this.at(">")) { this.eat(); depth -= 1; }
      else this.eat();
    }
  }

  skipParenList() {
    if (!this.at("(")) return;
    this.eat();
    let depth = 1;
    while (!this.at(TokenKind.EOF) && depth > 0) {
      if (this.at("(")) { this.eat(); depth += 1; }
      else if (this.at(")")) { this.eat(); depth -= 1; }
      else this.eat();
    }
  }

  parseNamedBlock(keyword, astKind = "Declarative") {
    this.expect(keyword);
    if (keyword === "SYNTAX") {
      const raw = [];
      while (!this.at(TokenKind.EOF)) {
        if (this.at("END")) {
          const nxt = this.peek(1);
          const closer = !nxt || nxt.kind === TokenKind.EOF ||
            (nxt.kind === TokenKind.KEYWORD && ["FUNCTION", "FOR", "FOREACH", "WHILE", "TYPE", "MODULE", "CLASS", "TEST"].includes(nxt.value));
          if (closer) {
            this.eat();
            break;
          }
        }
        raw.push(this.eat().value);
      }
      return N.Declarative(keyword, raw, []);
    }
    let name = null;
    if ((this.at(TokenKind.IDENT) || this.at(TokenKind.KEYWORD) || this.at(TokenKind.STRING)) && !this.at(":=", 1)) {
      name = this.parseNameish();
    }
    this.skipTypeParams();
    this.skipParenList();
    const fields = [];
    const oneLiners = new Set([
      "RESOLUTION", "SIGNAL", "EVENT", "PACKAGE", "IMPORT", "EXPORT",
    ]);
    if (oneLiners.has(keyword) && (this.at(TokenKind.KEYWORD) && BLOCK_STARTERS.has(this.peek().value) || this.at(TokenKind.EOF) || this.at("END") === false && this.looksLikeTop())) {
      if (this.at("END")) this.skipEndSuffix();
      if (astKind === "Cycler") return N.Cycler(name, fields);
      if (astKind === "Artifact") return N.Artifact(name, fields);
      return N.Declarative(keyword, name, fields);
    }
    while (!this.at("END") && !this.at(TokenKind.EOF)) {
      // nested named blocks
      if (this.at(TokenKind.KEYWORD) && BLOCK_STARTERS.has(this.peek().value) && this.peek().value !== "END") {
        const innerKw = this.peek().value;
        if (["FUNCTION", "CLASS", "MODULE", "PROGRAM", "TEST", "FILE"].includes(innerKw)) {
          fields.push(this.parseTop());
          continue;
        }
        fields.push(this.parseNamedBlock(innerKw));
        continue;
      }
      fields.push(this.parseLooseField());
    }
    this.skipEndSuffix();
    if (astKind === "Cycler") return N.Cycler(name, fields);
    if (astKind === "Artifact") return N.Artifact(name, fields);
    if (astKind === "Configuration") return N.Configuration(name, fields);
    if (astKind === "Constitution") return N.Constitution(fields);
    if (astKind === "Schema") return N.SchemaDecl(name, fields);
    return N.Declarative(keyword, name, fields);
  }

  parseLooseField() {
    // name = expr   OR   KEYWORD rest... as a declarative line
    if ((this.at(TokenKind.IDENT) || this.at(TokenKind.KEYWORD)) && this.at("=", 1)) {
      const name = this.eat().value;
      this.expect("=");
      const value = this.parseExpression();
      return N.Assign(N.Identifier(name), value);
    }
    if (this.at(TokenKind.IDENT) || this.at(TokenKind.KEYWORD)) {
      const key = this.eat().value;
      const values = [];
      while (
        !this.at(TokenKind.EOF) &&
        !this.at("END") &&
        !(this.at(TokenKind.KEYWORD) && BLOCK_STARTERS.has(this.peek().value)) &&
        !(this.at(TokenKind.IDENT) && this.at("=", 1)) &&
        !(this.at(TokenKind.KEYWORD) && this.at("=", 1))
      ) {
        if (this.at(TokenKind.KEYWORD) && ["FUNCTION", "CLASS", "TYPE", "MODULE"].includes(this.peek().value)) break;
        if (this.at(TokenKind.OP) && !["[", "{", "(", "-", "!"].includes(this.peek().value)) {
          values.push(this.eat().value);
          continue;
        }
        values.push(this.parseUnary());
        if (this.at(",")) this.eat();
        else break;
      }
      return N.Declarative(key, values.length === 1 ? values[0] : values, []);
    }
    if (this.at(TokenKind.OP)) {
      const bits = [];
      while (!this.at(TokenKind.EOF) && !this.at("END") &&
             !(this.at(TokenKind.KEYWORD) && BLOCK_STARTERS.has(this.peek().value))) {
        bits.push(this.eat().value);
        if (bits.length > 80) break;
      }
      return N.Declarative("syntax", bits, []);
    }
    return this.parseStatement();
  }

  parseBlockUntilEnd() {
    const statements = [];
    while (!this.at("END") && !this.at("ELSE") && !this.at("CATCH") && !this.at("FINALLY") && !this.at("CASE") && !this.at(TokenKind.EOF)) {
      statements.push(this.parseStatement());
    }
    if (this.at("END")) this.skipEndSuffix();
    return N.Block(statements);
  }

  parseStatement() {
    if (this.at("FILE")) return this.parseFileBlock();
    if (this.at("ARTIFACT") || this.at("DELIVERABLE") || this.at("CYCLER") || this.at("META_CYCLER") || this.at("PROGRAM") || this.at("TEST") || this.at("ENUM") || this.at("BOOTSTRAP") || this.at("DOCUMENT") || this.at("THEOREM") || this.at("INVARIANT")) {
      return this.parseTop();
    }
    if (this.at("FUNCTION")) return this.parseFunction();
    if (this.at("TYPE")) return this.parseTypeDecl();
    if (this.at("IF")) return this.parseIf();
    if (this.at("FOR")) return this.parseFor();
    if (this.at("FOREACH")) return this.parseForEach();
    if (this.at("WHILE")) return this.parseWhile();
    if (this.at("UNTIL")) return this.parseUntil();
    if (this.at("REPEAT")) return this.parseRepeat();
    if (this.at("TRY")) return this.parseTry();
    if (this.at("MATCH")) return this.parseMatch();
    if (this.at("RETURN")) {
      this.eat();
      const arg = this.isExprStart() ? this.parseExpression() : null;
      return N.Return(arg);
    }
    if (this.at("ASSERT") || this.at("REQUIRE") || this.at("ENSURE")) {
      const kw = this.eat().value;
      const test = this.parseExpression();
      return N.Assert(test, kw);
    }
    if (this.at("CONTINUE")) {
      this.eat();
      let guard = null;
      if (this.at("IF")) {
        this.eat();
        guard = this.parseExpression();
      }
      return N.Continue(guard);
    }
    if (this.at("BREAK")) {
      this.eat();
      let guard = null;
      if (this.at("IF")) {
        this.eat();
        guard = this.parseExpression();
      }
      return N.Break(guard);
    }
    if (this.at("LET") || this.at("VAR") || this.at("CONST")) {
      this.eat();
      const name = this.parseNameish();
      this.expect("=");
      const value = this.parseExpression();
      return N.Assign(N.Identifier(name), value);
    }
    if (this.at("FUNCTION")) return this.parseFunction();
    if (this.at("PRINT")) {
      this.eat();
      const arg = this.parseExpression();
      return N.ExprStmt(N.Call(N.Identifier("PRINT"), [arg]));
    }

    const expr = this.parseExpression();
    if (this.at("=")) {
      this.eat();
      const value = this.parseExpression();
      return N.Assign(expr, value);
    }
    return N.ExprStmt(expr);
  }

  isExprStart() {
    const t = this.peek();
    if (!t || t.kind === TokenKind.EOF) return false;
    if (t.kind === TokenKind.NUMBER || t.kind === TokenKind.STRING || t.kind === TokenKind.IDENT) return true;
    if (t.kind === TokenKind.OP && ["(", "[", "{", "-", "!", "+"].includes(t.value)) return true;
    if (t.kind === TokenKind.KEYWORD && ["TRUE", "FALSE", "NULL", "UNIT", "NONE", "NOW", "NOT", "FUNCTION", "NEW"].includes(t.value)) return true;
    return false;
  }

  parseIf() {
    this.expect("IF");
    return this.parseIfTail();
  }

  parseIfTail() {
    const test = this.parseExpression();
    const consequent = this.parseBlockKeepEnd(["ELSE", "ELSEIF", "ELSIF", "END"]);
    let alternate = null;
    if (this.at("ELSEIF") || this.at("ELSIF")) {
      this.eat();
      alternate = this.parseIfTail();
    } else if (this.at("ELSE")) {
      this.eat();
      // Newline-insensitive lexer: ELSE then IF is a nested IF, not ELSEIF.
      // Flat chains must use the ELSEIF / ELSIF keyword.
      alternate = this.parseBlockUntilEnd();
    } else if (this.at("END")) {
      this.skipEndSuffix();
    }
    return N.If(test, consequent, alternate);
  }

  parseBlockKeepEnd(stoppers) {
    const statements = [];
    while (!this.at(TokenKind.EOF) && !stoppers.some((s) => this.at(s))) {
      statements.push(this.parseStatement());
    }
    return N.Block(statements);
  }

  parseFor() {
    this.expect("FOR");
    const name = this.parseNameish();
    this.expect("IN");
    const iter = this.parseExpression();
    const body = this.parseBlockUntilEnd();
    return N.For(name, iter, body);
  }

  parseForEach() {
    this.expect("FOREACH");
    const name = this.parseNameish();
    this.expect("IN");
    const iter = this.parseExpression();
    const body = this.parseBlockUntilEnd();
    return N.ForEach(name, iter, body);
  }

  parseWhile() {
    this.expect("WHILE");
    const test = this.parseExpression();
    const body = this.parseBlockUntilEnd();
    return N.While(test, body);
  }

  parseUntil() {
    this.expect("UNTIL");
    const test = this.parseExpression();
    const body = this.parseBlockUntilEnd();
    return N.Until(test, body);
  }

  parseRepeat() {
    this.expect("REPEAT");
    const count = this.parseExpression();
    const body = this.parseBlockUntilEnd();
    return N.Repeat(count, body);
  }

  parseTry() {
    this.expect("TRY");
    const body = this.parseBlockKeepEnd(["CATCH", "FINALLY", "END"]);
    let catchName = null;
    let catchBody = null;
    let finallyBody = null;
    if (this.at("CATCH")) {
      this.eat();
      catchName = this.at(TokenKind.IDENT) || this.at(TokenKind.KEYWORD) ? this.eat().value : "error";
      catchBody = this.parseBlockKeepEnd(["FINALLY", "END"]);
    }
    if (this.at("FINALLY")) {
      this.eat();
      finallyBody = this.parseBlockUntilEnd();
    } else if (this.at("END")) {
      this.skipEndSuffix();
    }
    return N.Try(body, catchName, catchBody, finallyBody);
  }

  parseMatch() {
    this.expect("MATCH");
    const value = this.parseExpression();
    const cases = [];
    while (this.at("CASE")) {
      this.eat();
      const pattern = this.parseExpression();
      let guard = null;
      if (this.at("WHEN")) {
        this.eat();
        guard = this.parseExpression();
      }
      const body = this.parseBlockKeepEnd(["CASE", "END"]);
      cases.push(N.Case(pattern, guard, body));
    }
    if (this.at("END")) this.skipEndSuffix();
    return N.Match(value, cases);
  }

  parseExpression() {
    return this.parseOr();
  }

  parseOr() {
    let left = this.parseAnd();
    while (this.at("OR") || this.at("||")) {
      const op = this.eat().value;
      left = N.Binary(op === "||" ? "OR" : op, left, this.parseAnd());
    }
    return left;
  }

  parseAnd() {
    let left = this.parseNot();
    while (this.at("AND") || this.at("&&")) {
      const op = this.eat().value;
      left = N.Binary(op === "&&" ? "AND" : op, left, this.parseNot());
    }
    return left;
  }

  parseNot() {
    if (this.at("NOT") || this.at("!")) {
      const op = this.eat().value;
      return N.Unary(op === "!" ? "NOT" : op, this.parseNot());
    }
    return this.parseCompare();
  }

  parseCompare() {
    let left = this.parseRange();
    while (
      this.at("==") || this.at("!=") || this.at("<") || this.at(">") ||
      this.at("<=") || this.at(">=") || this.at("IS") || this.at("IS_NOT")
    ) {
      let op = this.eat().value;
      if (op === "IS" && this.at("NOT")) {
        this.eat();
        op = "IS_NOT";
      }
      left = N.Binary(op, left, this.parseRange());
    }
    return left;
  }

  parseRange() {
    let left = this.parseAdd();
    if (this.at("..")) {
      this.eat();
      return N.Range(left, this.parseAdd());
    }
    return left;
  }

  parseAdd() {
    let left = this.parseMul();
    while (this.at("+") || this.at("-")) {
      const op = this.eat().value;
      left = N.Binary(op, left, this.parseMul());
    }
    return left;
  }

  parseMul() {
    let left = this.parseUnary();
    while (this.at("*") || this.at("/") || this.at("%")) {
      const op = this.eat().value;
      left = N.Binary(op, left, this.parseUnary());
    }
    return left;
  }

  parseUnary() {
    if (this.at("-") || this.at("+")) {
      const op = this.eat().value;
      return N.Unary(op, this.parseUnary());
    }
    return this.parsePostfix();
  }

  parsePostfix() {
    let expr = this.parsePrimary();
    for (;;) {
      if (this.at("(")) {
        const args = this.parseArgList();
        expr = N.Call(expr, args);
        continue;
      }
      if (this.at(".")) {
        this.eat();
        const prop = this.at(TokenKind.IDENT) || this.at(TokenKind.KEYWORD)
          ? this.eat().value
          : this.parseNameish();
        expr = N.Member(expr, prop, false);
        continue;
      }
      if (this.at("[")) {
        this.eat();
        const index = this.parseExpression();
        this.expect("]");
        expr = N.Index(expr, index);
        continue;
      }
      break;
    }
    return expr;
  }

  parseArgList() {
    this.expect("(");
    const args = [];
    while (!this.at(")") && !this.at(TokenKind.EOF)) {
      args.push(this.parseExpression());
      if (this.at(",")) this.eat();
      else break;
    }
    this.expect(")");
    return args;
  }

  parsePrimary() {
    if (this.at("TRUE")) { this.eat(); return N.Literal(true, "TRUE"); }
    if (this.at("FALSE")) { this.eat(); return N.Literal(false, "FALSE"); }
    if (this.at("NULL") || this.at("NONE") || this.at("UNIT")) {
      const raw = this.eat().value;
      return N.Literal(null, raw);
    }
    if (this.at("NOW")) { this.eat(); return N.Call(N.Identifier("NOW"), []); }
    if (this.at(TokenKind.NUMBER)) {
      const t = this.eat();
      return N.Literal(t.value, String(t.value));
    }
    if (this.at(TokenKind.STRING)) {
      const t = this.eat();
      return N.Literal(t.value, t.value);
    }
    if (this.at("FUNCTION") || this.at("LAMBDA")) {
      this.eat();
      const params = this.at("(") ? this.parseParamList() : [];
      let rt = null;
      if (this.at("->")) {
        this.eat();
        rt = this.parseTypeRef();
      }
      const body = this.parseBlockUntilEnd();
      return N.Lambda(params, rt, body);
    }
    if (this.at("NEW")) {
      this.eat();
      const callee = this.parsePostfix();
      return N.Call(N.Member(callee.kind === "Call" ? callee.callee : callee, "construct", false), callee.kind === "Call" ? callee.args : []);
    }
    if (this.at("[")) {
      this.eat();
      const elements = [];
      while (!this.at("]") && !this.at(TokenKind.EOF)) {
        elements.push(this.parseExpression());
        if (this.at(",")) this.eat();
        else break;
      }
      this.expect("]");
      return N.List(elements);
    }
    if (this.at("{")) {
      this.eat();
      const entries = [];
      while (!this.at("}") && !this.at(TokenKind.EOF)) {
        let key;
        if (this.at(TokenKind.STRING) || this.at(TokenKind.IDENT) || this.at(TokenKind.KEYWORD)) {
          key = this.eat().value;
        } else {
          key = this.parseExpression();
        }
        this.expect(":");
        const value = this.parseExpression();
        entries.push({ key, value });
        if (this.at(",")) this.eat();
        else break;
      }
      this.expect("}");
      return N.Map(entries);
    }
    if (this.at("(")) {
      this.eat();
      const expr = this.parseExpression();
      this.expect(")");
      return expr;
    }
    if (this.at(TokenKind.IDENT) || this.at(TokenKind.KEYWORD)) {
      const t = this.eat();
      return N.Identifier(t.value);
    }
    if (this.at("...") || this.peek()?.value === "...") {
      this.eat();
      return N.Identifier("...");
    }
    throw new ParseError(`Unexpected token ${this.describe(this.peek())}`, this.peek());
  }
}

export function parse(source, filename = "<stdin>") {
  const lexer = new Lexer(source, filename);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens, source, filename);
  const ast = parser.parse();
  if (!parser.at(TokenKind.EOF) && parser.peek()?.kind !== TokenKind.EOF) {
    // leftover END from outer module is ok
    while (parser.at("END")) parser.skipEndSuffix();
  }
  return ast;
}
