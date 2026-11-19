// Export: the three post sizes, rendering the poster at full resolution, encoding a PNG and
// handing it to the browser as a download. The same renderer draws the editor preview.

import { drawPoster } from './poster.js';

export const SIZES = [
  { id: 'wide', label: '1920 × 1080', tag: 'Landscape', w: 1920, h: 1080 },
  { id: 'square', label: '1080 × 1080', tag: 'Square', w: 1080, h: 1080 },
  { id: 'portrait', label: '1080 × 1350', tag: 'Portrait', w: 1080, h: 1350 },
];

export function sizeById(id) {
  return SIZES.find((s) => s.id === id) ?? SIZES[0];
}

export function sizeFromParam(text) {
  const match = /^(\d{3,4})x(\d{3,4})$/.exec(String(text || '').trim());
  if (match) {
    const w = Number(match[1]);
    const h = Number(match[2]);
    const known = SIZES.find((s) => s.w === w && s.h === h);
    if (known) return known;
    return { id: `custom-${w}x${h}`, label: `${w} × ${h}`, tag: 'Custom', w, h };
  }
  return sizeById(text);
}

/** Paints the poster for `model` at the export size and returns the canvas. */
export function renderPoster(model, size) {
  const canvas = document.createElement('canvas');
  canvas.width = size.w;
  canvas.height = size.h;
  const ctx = canvas.getContext('2d');
  drawPoster(ctx, model, size.w, size.h);
  return canvas;
}

export function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('The browser could not encode the PNG.'));
    }, 'image/png');
  });
}

/** Renders and encodes a PNG, returning the blob and an object URL for it. */
export async function makePng(model, size) {
  const canvas = renderPoster(model, size);
  const blob = await canvasToBlob(canvas);
  return {
    blob,
    url: URL.createObjectURL(blob),
    bytes: blob.size,
    width: size.w,
    height: size.h,
    label: size.label,
  };
}

export function downloadUrl(url, filename) {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function formatBytes(bytes) {
  if (!bytes) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
