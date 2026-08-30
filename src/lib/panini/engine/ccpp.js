// @ts-nocheck
/**
 * C translation phases 1–4 (preprocessor).
 * Copyright (C) 1993-2026 Abhishek Choudhary | GPL-3.0-or-later
 * Called from PANINI via CPP(). Lexer/parser/eval stay in c.pni.
 */
export function ccpp(src) {
  src = String(src).replace(/\r\n/g, "\n").replace(/\\\n/g, "");
  const lines = src.split("\n");
  const obj = new Map();
  const fn = new Map();
  const out = [];
  const skip = [];
  const active = () => skip.every(Boolean);

  function takeDefine(rest) {
    const m = rest.match(/^([A-Za-z_]\w*)\s*(\(([^)]*)\))?\s*(.*)$/);
    if (!m) return;
    const name = m[1];
    if (m[2] != null) {
      const params = m[3].split(",").map((s) => s.trim()).filter(Boolean);
      fn.set(name, { params, body: m[4].trim() });
      obj.delete(name);
    } else {
      obj.set(name, m[4].trim());
      fn.delete(name);
    }
  }

  function expandOnce(text, hide) {
    let i = 0, r = "";
    const n = text.length;
    const hid = hide || new Set();
    while (i < n) {
      const c = text[i];
      if (/[A-Za-z_]/.test(c)) {
        let j = i + 1;
        while (j < n && /\w/.test(text[j])) j++;
        const id = text.slice(i, j);
        i = j;
        if (hid.has(id)) { r += id; continue; }
        let k = i;
        while (k < n && /\s/.test(text[k])) k++;
        if (fn.has(id) && text[k] === "(") {
          const mac = fn.get(id);
          let depth = 1, p = k + 1, args = [], cur = "";
          while (p < n && depth) {
            const ch = text[p++];
            if (ch === "(") { depth++; cur += ch; }
            else if (ch === ")") {
              depth--;
              if (depth) cur += ch;
            } else if (ch === "," && depth === 1) { args.push(cur.trim()); cur = ""; }
            else cur += ch;
          }
          if (cur.trim() || args.length) args.push(cur.trim());
          i = p;
          let body = mac.body;
          const named = mac.params.filter((p) => p !== "...");
          named.forEach((pn, ix) => {
            body = body.replace(new RegExp(`\\b${pn}\\b`, "g"), args[ix] ?? "");
          });
          if (mac.params.includes("...") || body.includes("__VA_ARGS__")) {
            body = body.replace(/__VA_ARGS__/g, args.slice(named.length).join(", "));
          }
          const nextHide = new Set(hid);
          nextHide.add(id);
          r += expandOnce(body, nextHide);
          continue;
        }
        if (obj.has(id)) {
          const nextHide = new Set(hid);
          nextHide.add(id);
          r += expandOnce(obj.get(id), nextHide);
          continue;
        }
        r += id;
        continue;
      }
      r += c;
      i++;
    }
    return r;
  }

  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith("#")) {
      const body = t.slice(1).trim();
      if (body.startsWith("define ") && active()) takeDefine(body.slice(7).trim());
      else if (body.startsWith("if ")) {
        const cond = body.slice(3).trim();
        skip.push(active() && cond !== "0" && cond !== "false");
      } else if (body.startsWith("ifdef ")) skip.push(active() && obj.has(body.slice(6).trim()));
      else if (body.startsWith("ifndef ")) skip.push(active() && !obj.has(body.slice(7).trim()));
      else if (body.startsWith("else")) { if (skip.length) skip[skip.length - 1] = !skip[skip.length - 1]; }
      else if (body.startsWith("endif")) skip.pop();
      else if (body.startsWith("include")) { /* drop */ }
      continue;
    }
    if (active()) out.push(expandOnce(line));
  }
  return out.join("\n");
}
