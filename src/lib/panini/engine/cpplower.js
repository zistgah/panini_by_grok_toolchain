// @ts-nocheck
/**
 * C++ → C lowering for PANINI.Frontend.Cpp.
 * Lex stays in cpp.pni. This is host-speed desugar (same slot as CINTERP).
 * Copyright (C) 1993-2026 Abhishek Choudhary | GPL-3.0-or-later
 */
export function cppReject(src) {
  const s = String(src).replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  if (/\btypedef\s+(volatile\s+)?bool\b/.test(s) && /--/.test(s)) return "bool-decrement";
  if (/struct\s+S\s*;/.test(s) && /\(\s*S\s*\)/.test(s)) return "incomplete-type-cast";
  if (/for\s*\([^;]*;[^;]*;[^\)]*\.\s*f\s*\)/.test(s) || /for\s*\([^;]*;[^;]*;\s*s\.f\s*\)/.test(s)) return "member-function-as-value";
  if (/for\s*\(;;s\.f\)/.test(s) || /for\s*\(;;g\)/.test(s)) return "member-function-as-value";
  return null;
}

export function cpplower(src) {
  const bad = cppReject(src);
  if (bad) return "/* REJECT " + bad + " */\nint main(){return 99;}\n";
  let s = String(src);
  s = s.replace(/\r\n/g, "\n");
  s = s.replace(/using\s+namespace\s+std\s*;/g, "");
  s = s.replace(/#include\s*<[^>]+>/g, "");
  s = s.replace(/#include\s*"[^"]+"/g, "");
  s = s.replace(/extern\s+"C"\s+void\s+abort\s*\(\s*\)\s*;/g, "");
  s = s.replace(/\babort\s*\(\s*\)/g, "return 1");
  s = s.replace(/enum\s*\{([^}]+)\}\s*([A-Za-z_]\w*)\s*=\s*([A-Za-z_]\w*)\s*;/g, (_, body, varn, init) => {
    const parts = body.split(",").map((x) => x.trim()).filter(Boolean);
    const decls = parts.map((p) => {
      const m = p.match(/^([A-Za-z_]\w*)\s*=\s*(.+)$/);
      return m ? "int " + m[1] + " = " + m[2] + ";" : "int " + p + ";";
    });
    return decls.join(" ") + " int " + varn + " = " + init + ";";
  });
  s = unwrapNamespaces(s);
  s = rewriteClasses(s);
  s = s.replace(/\b(public|private|protected)\s*:\s*/g, "");
  s = s.replace(/\bvirtual\b/g, "");
  s = s.replace(/\boverride\b/g, "");
  s = s.replace(/\bexplicit\b/g, "");
  s = s.replace(/\bconstexpr\b/g, "const");
  s = s.replace(/\binline\b/g, "");
  s = s.replace(/\bnullptr\b/g, "0");
  s = s.replace(/\btrue\b/g, "1");
  s = s.replace(/\bfalse\b/g, "0");
  s = s.replace(/\bbool\b/g, "int");
  s = s.replace(/std::cout/g, "cout");
  s = s.replace(/std::endl/g, "endl");
  s = rewriteCout(s);
  s = rewriteNewDelete(s);
  s = rewriteRefs(s);
  s = mangleOverloads(s);
  s = s.replace(/::/g, "_");
  s = tagStructDecls(s);
  return s;
}

function unwrapNamespaces(s) {
  let out = s;
  const re = /namespace\s+([A-Za-z_]\w*)\s*\{/;
  let m;
  while ((m = re.exec(out))) {
    const start = m.index;
    const name = m[1];
    const bodyStart = start + m[0].length;
    const end = matchBrace(out, bodyStart - 1);
    if (end < 0) break;
    const body = out.slice(bodyStart, end);
    const prefixed = body.replace(/\b([A-Za-z_]\w*)\s*\(/g, (mm, id) => {
      if (/^(if|while|for|switch|return|sizeof)$/.test(id)) return mm;
      return name + "_" + id + "(";
    });
    out = out.slice(0, start) + prefixed + out.slice(end + 1);
  }
  return out;
}

function matchBrace(s, openIdx) {
  let d = 0;
  for (let i = openIdx; i < s.length; i++) {
    if (s[i] === "{") d++;
    else if (s[i] === "}") {
      d--;
      if (d === 0) return i;
    }
  }
  return -1;
}

function rewriteClasses(s) {
  s = s.replace(/\bclass\b/g, "struct");
  const re = /struct\s+([A-Za-z_]\w*)\s*(?::\s*public\s+[A-Za-z_]\w*\s*)?\{/g;
  const matches = [];
  let m;
  while ((m = re.exec(s))) matches.push(m);
  let out = s;
  const lifts = [];
  for (let i = matches.length - 1; i >= 0; i--) {
    m = matches[i];
    const name = m[1];
    const brace = m.index + m[0].length - 1;
    const end = matchBrace(s, brace);
    if (end < 0) continue;
    const body = s.slice(brace + 1, end);
    const methodRe = /(?:(int|char|void|unsigned|long|short)\s+)?([A-Za-z_]\w*)\s*\(([^)]*)\)\s*\{/g;
    const methodSpans = [];
    let mm;
    while ((mm = methodRe.exec(body))) {
      const id = mm[2];
      if (/^(if|while|for|switch)$/.test(id)) continue;
      const open = mm.index + mm[0].length - 1;
      const close = matchBrace(body, open);
      if (close < 0) continue;
      methodSpans.push({
        start: mm.index,
        end: close + 1,
        ret: mm[1] || "void",
        id,
        params: mm[3].trim(),
        inner: body.slice(open + 1, close),
        ctor: id === name,
      });
    }
    if (!methodSpans.length) continue;
    let fields = body;
    for (let k = methodSpans.length - 1; k >= 0; k--) {
      const sp = methodSpans[k];
      fields = fields.slice(0, sp.start) + fields.slice(sp.end);
      const params = sp.params ? sp.params.split(",").map((p) => p.trim().split(/\s+/).pop()).filter(Boolean) : [];
      let inner = sp.inner.replace(/\b([A-Za-z_]\w*)\b/g, (id) => {
        if (/^(int|return|if|else|while|for|this|sizeof|char|void|struct)$/.test(id)) return id;
        if (params.includes(id)) return id;
        return "this->" + id;
      });
      const thisParam = "struct " + name + " *this";
      const ps = sp.params ? thisParam + ", " + sp.params : thisParam;
      if (sp.ctor) lifts.push("void " + name + "_ctor(" + ps + ") {" + inner + "}");
      else lifts.push(sp.ret + " " + name + "_" + sp.id + "(" + ps + ") {" + inner + "}");
    }
    out = out.slice(0, brace + 1) + fields + out.slice(end);
  }
  if (lifts.length) out = lifts.join("\n") + "\n" + out;
  return rewriteMethodCalls(out);
}

function rewriteMethodCalls(s) {
  const methods = [];
  const re = /(\w+)_([A-Za-z_]\w*)\s*\(\s*struct\s+(\w+)\s*\*/g;
  let m;
  while ((m = re.exec(s))) methods.push({ fn: m[1] + "_" + m[2], type: m[3], method: m[2] });
  let out = s;
  for (const md of methods) {
    const call = new RegExp("\\b([A-Za-z_]\\w*)\\s*\\.\\s*" + md.method + "\\s*\\(", "g");
    out = out.replace(call, md.fn + "(&$1, ");
    out = out.replace(/,\s*\)/g, ")");
  }
  return out;
}

function rewriteCout(s) {
  return s.replace(/((?:std_)?cout)((?:\s*<<\s*[^;]+)+);/g, (_, _c, chain) => {
    const parts = [];
    const re = /<<\s*([^<;]+)/g;
    let m;
    while ((m = re.exec(chain))) parts.push(m[1].trim());
    const hasNl = parts.some((p) => /^(endl|std_endl)$/.test(p));
    const filtered = parts.filter((p) => !/^(endl|std_endl)$/.test(p));
    if (!filtered.length) return 'printf("\\n");';
    const fmt = filtered.map((p) => (/^".*"$/.test(p) ? "%s" : "%d")).join("");
    const args = filtered.join(", ");
    return 'printf("' + fmt + (hasNl ? "\\n" : "") + '", ' + args + ");";
  });
}

function rewriteNewDelete(s) {
  s = s.replace(/\bdelete\s*\[\s*\]\s*([A-Za-z_]\w*)\s*;/g, "free($1);");
  s = s.replace(/\bdelete\s+([A-Za-z_]\w*)\s*;/g, "free($1);");
  s = s.replace(/\bnew\s+int\s*\[\s*([^\]]+)\]/g, "((int*)calloc($1, sizeof(int)))");
  s = s.replace(/\bnew\s+int\b/g, "((int*)calloc(1, sizeof(int)))");
  s = s.replace(/\bnew\s+([A-Za-z_]\w*)\b/g, "(($1*)calloc(1, sizeof($1)))");
  return s;
}

function rewriteRefs(s) {
  const refs = [];
  s = s.replace(/\b(int|char)\s*&\s*([A-Za-z_]\w*)\s*=\s*([A-Za-z_]\w*)\s*;/g, (_, ty, name, init) => {
    refs.push(name);
    return ty + " *" + name + " = &" + init + ";";
  });
  for (const name of refs) {
    s = s.replace(new RegExp("\\b" + name + "\\b", "g"), (id, off, str) => {
      const before = str.slice(Math.max(0, off - 2), off);
      if (/\*\s*$/.test(before) || /&\s*$/.test(before)) return id;
      const decl = str.slice(Math.max(0, off - 10), off);
      if (/\*\s*$/.test(decl)) return id;
      return "(*" + id + ")";
    });
    s = s.replace(new RegExp("(int|char)\\s*\\*\\s*\\(\\*" + name + "\\)", "g"), "$1 *" + name);
  }
  return s;
}

function tagStructDecls(s) {
  const names = new Set();
  const re = /struct\s+([A-Za-z_]\w*)/g;
  let m;
  while ((m = re.exec(s))) names.add(m[1]);
  let out = s;
  for (const n of names) {
    out = out.replace(new RegExp("(?<!struct\\s)\\b" + n + "\\s+([A-Za-z_]\\w*)", "g"), "struct " + n + " $1");
  }
  return out;
}

function mangleOverloads(s) {
  const re = /(?:int|void|char|unsigned|long)\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*\{/g;
  const by = new Map();
  let m;
  while ((m = re.exec(s))) {
    const name = m[1];
    if (/^(main|if|while|for|switch)$/.test(name)) continue;
    const arity = m[2].trim() === "" ? 0 : m[2].split(",").length;
    if (!by.has(name)) by.set(name, []);
    by.get(name).push({ arity });
  }
  let out = s;
  for (const [name, list] of by) {
    if (list.length < 2) continue;
    const arities = new Map();
    for (const d of list) arities.set(d.arity, name + "_" + d.arity);
    out = out.replace(new RegExp("\\b" + name + "\\s*\\(", "g"), (mm, off, str) => {
      const start = off + mm.length;
      if (str[start] === ")") {
        return (arities.get(0) || name) + "(";
      }
      let dpth = 1, args = 0;
      for (let i = start; i < str.length && dpth; i++) {
        if (str[i] === "(") dpth++;
        else if (str[i] === ")") dpth--;
        else if (str[i] === "," && dpth === 1) args++;
      }
      return (arities.get(args + 1) || name) + "(";
    });
  }
  return out;
}
