// @ts-nocheck
export class Environment {
  constructor(parent = null, name = "env") {
    this.parent = parent;
    this.name = name;
    this.bindings = new Map();
    this.constants = new Set();
  }

  define(name, value, { constant = false } = {}) {
    this.bindings.set(name, value);
    if (constant) this.constants.add(name);
    return value;
  }

  hasLocal(name) {
    return this.bindings.has(name);
  }

  get(name) {
    if (this.bindings.has(name)) return this.bindings.get(name);
    if (this.parent) return this.parent.get(name);
    throw new ReferenceError(`Undefined name: ${name}`);
  }

  tryGet(name) {
    if (this.bindings.has(name)) return this.bindings.get(name);
    if (this.parent) return this.parent.tryGet(name);
    return undefined;
  }

  set(name, value) {
    if (this.bindings.has(name)) {
      if (this.constants.has(name)) throw new TypeError(`Cannot assign to constant ${name}`);
      this.bindings.set(name, value);
      return value;
    }
    if (this.parent) return this.parent.set(name, value);
    this.bindings.set(name, value);
    return value;
  }

  child(name = "block") {
    return new Environment(this, name);
  }

  snapshot() {
    const obj = {};
    for (const [k, v] of this.bindings) obj[k] = v;
    return obj;
  }
}
