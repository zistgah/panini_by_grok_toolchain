// @ts-nocheck
import { vArtifact, vMap, vStr, wrap } from "./values.js";

export class ArtifactStore {
  constructor() {
    this.byId = new Map();
    this.files = new Map();
    this.revisions = [];
    this.baselines = new Map();
    this.checkpoints = new Map();
  }

  putArtifact(name, fields = {}) {
    const art = {
      id: fields.id || name,
      name,
      type: fields.TYPE || fields.type || "artifact",
      format: fields.FORMAT || fields.format || "application/octet-stream",
      version: fields.VERSION || fields.version || "0.1.0",
      status: fields.STATUS || fields.status || "DRAFT",
      source: fields.SOURCE || fields.source || "panini",
      provenance: fields.PROVENANCE || {
        created_by: "PANINI",
        created_at: new Date().toISOString(),
      },
      fields,
    };
    this.byId.set(art.id, art);
    return vArtifact(art);
  }

  putFile(path, { mime, encoding, content } = {}) {
    const file = {
      path,
      mime: mime || "application/octet-stream",
      encoding: encoding || "utf-8",
      content: content ?? "",
      provenance: {
        created_by: "PANINI",
        created_at: new Date().toISOString(),
      },
    };
    this.files.set(path, file);
    return file;
  }

  getFile(path) {
    return this.files.get(path);
  }

  checkpoint(name, state) {
    this.checkpoints.set(name, structuredCloneSafe(state));
    return name;
  }

  restore(name) {
    return this.checkpoints.get(name);
  }

  manifest() {
    return {
      artifacts: [...this.byId.values()].map((a) => ({
        id: a.id,
        type: a.type,
        version: a.version,
        status: a.status,
      })),
      files: [...this.files.keys()],
      revisions: this.revisions.length,
    };
  }
}

function structuredCloneSafe(x) {
  try {
    return JSON.parse(JSON.stringify(x));
  } catch {
    return x;
  }
}

export function artifactToMap(art) {
  const m = new Map();
  m.set("id", vStr(art.id));
  m.set("name", vStr(art.name));
  m.set("type", vStr(String(art.type)));
  m.set("version", vStr(String(art.version)));
  m.set("status", vStr(String(art.status)));
  return vMap(m);
}
