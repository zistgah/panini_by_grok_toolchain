// @ts-nocheck
/* tree-rev: 2026.08.28 */
/* Copyright (C) 1993-2026 Abhishek Choudhary
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
/** AST node constructors for PANINI. */

export function loc(start, end) {
  return { start, end };
}

export function node(kind, props = {}, location = null) {
  return { kind, ...props, loc: location };
}

export const N = {
  Program: (body, loc) => node("Program", { body }, loc),
  Module: (name, body, loc) => node("Module", { name, body }, loc),
  Constitution: (fields, loc) => node("Constitution", { fields }, loc),
  TypeDecl: (name, spec, loc) => node("TypeDecl", { name, spec }, loc),
  FunctionDecl: (name, params, returnType, body, loc) =>
    node("FunctionDecl", { name, params, returnType, body }, loc),
  Lambda: (params, returnType, body, loc) =>
    node("Lambda", { params, returnType, body }, loc),
  ClassDecl: (name, members, loc) => node("ClassDecl", { name, members }, loc),
  FieldDecl: (name, type, loc) => node("FieldDecl", { name, type }, loc),
  MethodDecl: (name, params, returnType, body, loc) =>
    node("MethodDecl", { name, params, returnType, body }, loc),
  Import: (path, loc) => node("Import", { path }, loc),
  Export: (names, loc) => node("Export", { names }, loc),
  Package: (name, loc) => node("Package", { name }, loc),
  FileBlock: (path, mime, encoding, content, loc) =>
    node("FileBlock", { path, mime, encoding, content }, loc),
  Artifact: (name, fields, loc) => node("Artifact", { name, fields }, loc),
  Configuration: (name, fields, loc) => node("Configuration", { name, fields }, loc),
  ProgramDecl: (name, body, loc) => node("ProgramDecl", { name, body }, loc),
  TestDecl: (name, body, loc) => node("TestDecl", { name, body }, loc),
  Cycler: (name, body, loc) => node("Cycler", { name, body }, loc),
  EnumDecl: (name, variants, loc) => node("EnumDecl", { name, variants }, loc),
  SchemaDecl: (name, fields, loc) => node("SchemaDecl", { name, fields }, loc),
  Block: (statements, loc) => node("Block", { statements }, loc),
  If: (test, consequent, alternate, loc) =>
    node("If", { test, consequent, alternate }, loc),
  For: (name, iter, body, loc) => node("For", { name, iter, body }, loc),
  ForEach: (name, iter, body, loc) => node("ForEach", { name, iter, body }, loc),
  While: (test, body, loc) => node("While", { test, body }, loc),
  Until: (test, body, loc) => node("Until", { test, body }, loc),
  Repeat: (count, body, loc) => node("Repeat", { count, body }, loc),
  Try: (body, catchName, catchBody, finallyBody, loc) =>
    node("Try", { body, catchName, catchBody, finallyBody }, loc),
  Match: (value, cases, loc) => node("Match", { value, cases }, loc),
  Case: (pattern, guard, body, loc) => node("Case", { pattern, guard, body }, loc),
  Return: (argument, loc) => node("Return", { argument }, loc),
  Assert: (test, message, loc) => node("Assert", { test, message }, loc),
  Assign: (target, value, loc) => node("Assign", { target, value }, loc),
  ExprStmt: (expression, loc) => node("ExprStmt", { expression }, loc),
  Continue: (guard, loc) => node("Continue", { guard }, loc),
  Break: (guard, loc) => node("Break", { guard }, loc),
  Identifier: (name, loc) => node("Identifier", { name }, loc),
  Literal: (value, raw, loc) => node("Literal", { value, raw }, loc),
  Binary: (op, left, right, loc) => node("Binary", { op, left, right }, loc),
  Unary: (op, argument, loc) => node("Unary", { op, argument }, loc),
  Call: (callee, args, loc) => node("Call", { callee, args }, loc),
  Member: (object, property, computed, loc) =>
    node("Member", { object, property, computed }, loc),
  Index: (object, index, loc) => node("Index", { object, index }, loc),
  List: (elements, loc) => node("List", { elements }, loc),
  Map: (entries, loc) => node("Map", { entries }, loc),
  Range: (start, end, loc) => node("Range", { start, end }, loc),
  TypedIdent: (name, type, loc) => node("TypedIdent", { name, type }, loc),
  TypeRef: (name, args, loc) => node("TypeRef", { name, args }, loc),
  Declarative: (keyword, name, body, loc) =>
    node("Declarative", { keyword, name, body }, loc),
  RawBlock: (keyword, name, fields, loc) =>
    node("RawBlock", { keyword, name, fields }, loc),
};
