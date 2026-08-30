// @ts-nocheck
/* tree-rev: 2026.08.28 */
/* Copyright (C) 1993-2026 Abhishek Choudhary
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
/** Token kinds and reserved words for PANINI 0.1.0 */

export const TokenKind = {
  EOF: "EOF",
  IDENT: "IDENT",
  NUMBER: "NUMBER",
  STRING: "STRING",
  KEYWORD: "KEYWORD",
  OP: "OP",
  NEWLINE: "NEWLINE",
  COMMENT: "COMMENT",
};

export const KEYWORDS = new Set([
  "MODULE", "SCOPE", "END", "CONSTITUTION", "NAME", "KIND", "SELF_HOSTING",
  "PURPOSE", "PRINCIPLES",
  "TYPE", "TRAIT", "INTERFACE", "CLASS", "FIELD", "METHOD",
  "FUNCTION", "RETURN", "LAMBDA",
  "IF", "ELSE", "ELSEIF", "ELSIF", "THEN",
  "FOR", "FOREACH", "IN", "WHILE", "UNTIL", "REPEAT",
  "CONTINUE", "BREAK",
  "TRY", "CATCH", "FINALLY",
  "MATCH", "CASE", "WHEN",
  "ASSERT", "REQUIRE", "ENSURE",
  "IMPORT", "EXPORT", "PACKAGE",
  "TRUE", "FALSE", "NULL", "UNIT", "NONE", "NOW",
  "AND", "OR", "NOT", "IS", "IS_NOT",
  "LET", "VAR", "CONST",
  "PRINT", "WRITE", "READ", "TO", "FROM", "AS", "WITH", "BY",
  "FILE", "MIME", "ENCODING", "CONTENT",
  "ARTIFACT", "DELIVERABLE", "ARTIFACT_REVISION",
  "CONFIGURATION", "PROGRAM", "TEST", "PROPERTY", "FORALL",
  "SCHEMA", "CONSTRAINT", "RULE", "ENUM",
  "EVENT", "WATCH", "SIGNAL", "ON", "ACTOR",
  "PARALLEL", "JOIN", "SCHEDULE", "TASK",
  "CYCLER", "META_CYCLER", "STAGE", "GATE", "CYCLE", "STATE",
  "AFTER", "WHEN",
  "MODEL", "PROMPT", "AGENT", "ROLE", "INPUT", "OUTPUT",
  "MEMORY", "MODELS", "TOOLS", "GOALS", "POLICY", "GOAL", "TOOL",
  "CLAIM", "STATUS", "SOURCE", "EVIDENCE",
  "MEASUREMENT", "VALUE", "UNIT", "UNCERTAINTY",
  "BOOTSTRAP", "DOCUMENT", "THEOREM", "INVARIANT",
  "CAPABILITY", "CAPABILITIES",
  "SERIALIZE", "CHECKPOINT", "RESTORE", "RESUME",
  "RESOLUTION", "RECOVERY",
  "WHERE", "OK", "ERR",
  "SIGNOFF", "RELEASE", "BASELINE", "BRANCH", "DIFF", "MERGE",
  "SUPERSEDE", "ARCHIVE", "INVALIDATE", "RUN",
  "ELICIT", "CAPTURE", "STRUCTURE", "REVIEW", "REVISE",
  "DERIVE", "REALIZE", "VERIFY", "PACKAGE", "PUBLISH", "PRESERVE",
  "GENERATE", "REQUEST", "HUMAN", "HUMAN_SIGNOFF",
  "COMPOSE", "ELEVATE", "DESCEND", "SPLIT",
  "OPERATIONS", "INVOCATION", "SOURCES", "PRINCIPLE",
  "DOMAIN_MODEL", "FORMATION", "POST_ABDICATION",
  "ARRIVE", "MAP", "NAVIGATE", "ENTER", "REMEMBER", "ROUTES",
  "METHOD", "VERSION", "FORMAT", "DEPENDS_ON", "CHANGE",
  "CREATED_BY", "CREATED_AT", "PROVENANCE",
  "DIRECTORY", "INCLUDES", "ARTIFACTS", "TITLE", "GIVEN",
  "DEFINE", "CONCLUDE", "COMPARE",
  "COMPONENT", "RUNTIME", "MODES", "BACKEND",
  "SYNTAX", "ESTATE", "SOVEREIGN", "VARZISH",
  "CAN_COMPILE", "NATIVE", "GENERATE_FROM", "SELF_COMPILE",
  "BUILD", "COMPILE", "COMPARE", "WITH", "VERIFY",
  "INPUT", "OUTPUT",
  "EXPECT", "SUCCESS",
  "THIS", "NEW",
]);

export const MULTI_OPS = [
  "...",
  "..",
  ":=",
  "->",
  "=>",
  "<=",
  ">=",
  "==",
  "!=",
  "&&",
  "||",
];

export const SINGLE_OPS = new Set([
  "+", "-", "*", "/", "%", "=", "<", ">", "!", ".",
  "(", ")", "[", "]", "{", "}", ",", ":", "@", "|", "?",
]);

export function isKeyword(word) {
  return KEYWORDS.has(word);
}
