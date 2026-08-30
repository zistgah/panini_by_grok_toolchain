// @ts-nocheck
/**
 * VGA / Super VGA framebuffer for the PANINI console (same CRT as VT100).
 * Mode 13h: 320×200×256. Mode 12h: 640×480×16. Mode 3: text (VT100).
 * Copyright (C) 1993-2026 Abhishek Choudhary | GPL-3.0-or-later
 */
export const VGA_MODES = {
  3: { w: 80, h: 25, bpp: "text", name: "VGA text" },
  13: { w: 320, h: 200, bpp: 8, name: "VGA Mode 13h" },
  12: { w: 640, h: 480, bpp: 4, name: "VGA Mode 12h" },
  18: { w: 640, h: 480, bpp: 4, name: "VGA Mode 12h alias" },
  101: { w: 640, h: 480, bpp: 8, name: "SVGA 640×480×256" },
  103: { w: 800, h: 600, bpp: 8, name: "SVGA 800×600×256" },
};

function palette256() {
  const p = [[0, 0, 0], [0, 0, 170], [0, 170, 0], [0, 170, 170], [170, 0, 0], [170, 0, 170], [170, 85, 0], [170, 170, 170],
    [85, 85, 85], [85, 85, 255], [85, 255, 85], [85, 255, 255], [255, 85, 85], [255, 85, 255], [255, 255, 85], [255, 255, 255]];
  while (p.length < 256) {
    const i = p.length;
    p.push([i, i, i]);
  }
  return p;
}

export function createVga(mode = 13) {
  const spec = VGA_MODES[mode] || VGA_MODES[13];
  const vga = {
    mode,
    w: spec.w,
    h: spec.h,
    bpp: spec.bpp,
    name: spec.name,
    pixels: new Uint8Array(spec.w * spec.h),
    pal: palette256(),
    color: 15,
  };
  return vga;
}

export function vgaScreen(vga, mode) {
  const n = createVga(mode);
  Object.assign(vga, n);
}

export function vgaPset(vga, x, y, c) {
  x = x | 0; y = y | 0;
  if (x < 0 || y < 0 || x >= vga.w || y >= vga.h) return;
  if (c != null) vga.color = c & 255;
  vga.pixels[y * vga.w + x] = vga.color;
}

export function vgaLine(vga, x0, y0, x1, y1, c) {
  if (c != null) vga.color = c & 255;
  x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy, x = x0, y = y0;
  for (;;) {
    vgaPset(vga, x, y, vga.color);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
  }
}

export function vgaToImageData(vga) {
  const { w, h, pixels, pal } = vga;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const [r, g, b] = pal[pixels[i] & 255] || [0, 0, 0];
    data[i * 4] = r; data[i * 4 + 1] = g; data[i * 4 + 2] = b; data[i * 4 + 3] = 255;
  }
  return { w, h, data };
}

export function vgaCls(vga, c = 0) { vga.pixels.fill(c & 255); }
