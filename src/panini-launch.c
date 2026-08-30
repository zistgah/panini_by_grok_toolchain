/* Copyright (C) 1993-2026 Abhishek Choudhary
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Named frontend launcher. Copied as panc, panpy, panmake, … — real ELF
 * files, not symlinks. argv0 selects the extract. Not gcc. Not CPython.
 */
#include <limits.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

static void die(const char *msg) {
  fprintf(stderr, "panini: %s\n", msg);
  exit(2);
}

static int readable(const char *p) { return p && p[0] && access(p, R_OK) == 0; }

/* parent of bindir: /opt/panini/bin → /opt/panini  (no ".." for access()) */
static void prefix_of(const char *bindir, char *out, size_t n) {
  snprintf(out, n, "%s", bindir);
  char *slash = strrchr(out, '/');
  if (slash && slash != out) *slash = 0;
  else if (slash) {
    slash[1] = 0;
  }
}

int main(int argc, char **argv) {
  char self[PATH_MAX];
  ssize_t n = readlink("/proc/self/exe", self, sizeof(self) - 1);
  if (n < 0) die("cannot resolve executable path");
  self[n] = 0;
  char *slash = strrchr(self, '/');
  if (!slash) die("bad executable path");
  *slash = 0; /* bindir */

  const char *base = slash + 1;
  if (argv[0] && argv[0][0]) {
    const char *s = strrchr(argv[0], '/');
    base = s ? s + 1 : argv[0];
  }

  char prefix[PATH_MAX];
  prefix_of(self, prefix, sizeof prefix);

  char t[8][PATH_MAX];
  int nt = 0;
  const char *root = getenv("PANINI_ROOT");
  if (root && root[0]) {
    snprintf(t[nt++], PATH_MAX, "%s/scripts/pan-tool.mjs", root);
    snprintf(t[nt++], PATH_MAX, "%s/lib/panini/scripts/pan-tool.mjs", root);
  }
  /* workspace / unpacked zip: PREFIX/bin + PREFIX/scripts */
  snprintf(t[nt++], PATH_MAX, "%s/scripts/pan-tool.mjs", prefix);
  /* install.sh layout: PREFIX/bin + PREFIX/lib/panini/scripts */
  snprintf(t[nt++], PATH_MAX, "%s/lib/panini/scripts/pan-tool.mjs", prefix);

  const char *script = NULL;
  for (int i = 0; i < nt; i++) {
    if (readable(t[i])) {
      script = t[i];
      break;
    }
  }
  if (!script) die("cannot find scripts/pan-tool.mjs — run ./install.sh or set PANINI_ROOT");

  const char *node = getenv("NODE");
  if (!node || !node[0]) node = "node";

  if (strcmp(base, "panini") != 0) setenv("PAN_TOOL", base, 1);
  else unsetenv("PAN_TOOL");

  char **nargv = calloc((size_t)argc + 6, sizeof(char *));
  if (!nargv) die("out of memory");
  int k = 0;
  nargv[k++] = (char *)node;
  nargv[k++] = "--experimental-strip-types";
  nargv[k++] = "--no-warnings";
  nargv[k++] = (char *)script;
  for (int a = 1; a < argc; a++) nargv[k++] = argv[a];
  nargv[k] = NULL;

  execvp(node, nargv);
  fprintf(stderr, "panini: cannot exec %s (Node.js is required for the extract runtime)\n", node);
  return 2;
}
