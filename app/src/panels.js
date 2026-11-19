// The poster grid: each layout's panel and caption frames, the crop maths behind pan and zoom, and which panel a pointer is over.

export const LAYOUTS = [
  { id: 'classic', label: 'Classic', hint: 'Hero + side', slots: 2 },
  { id: 'triple', label: 'Triple', hint: 'Hero + two', slots: 3 },
  { id: 'grid', label: 'Grid 4', hint: 'Four panels', slots: 4 },
  { id: 'hero', label: 'Full-bleed', hint: 'One photo', slots: 1 },
];

export function layoutById(id) {
  return LAYOUTS.find((l) => l.id === id) ?? LAYOUTS[0];
}

const MARGIN = 0.028;
const GUTTER = 0.012;
const TOP = 0.2;

function panelFractions(id) {
  const m = MARGIN;
  const g = GUTTER;
  const left = m;
  const right = 1 - m;
  const innerW = right - left;
  const top = TOP;
  const bottom = 0.955;

  if (id === 'triple') {
    const heroW = innerW * 0.63;
    const rx = left + heroW + g;
    const rw = right - rx;
    const rh = (bottom - top - g) / 2;
    return [
      { x: left, y: top, w: heroW, h: bottom - top },
      { x: rx, y: top, w: rw, h: rh },
      { x: rx, y: top + rh + g, w: rw, h: rh },
    ];
  }

  if (id === 'grid') {
    const heroW = innerW * 0.58;
    const topH = (bottom - top - g) * 0.46;
    const rx = left + heroW + g;
    const rw = right - rx;
    return [
      { x: left, y: top, w: heroW, h: topH },
      { x: rx, y: top, w: rw, h: topH },
      { x: left, y: top + topH + g, w: heroW, h: bottom - top - topH - g },
      { x: rx, y: top + topH + g, w: rw, h: bottom - top - topH - g },
    ];
  }

  if (id === 'hero') {
    return [{ x: 0, y: 0, w: 1, h: 1 }];
  }

  // Classic: a tall hero beside one full-height side panel.
  const heroW = innerW * 0.615;
  return [
    { x: left, y: top, w: heroW, h: bottom - top },
    { x: left + heroW + g, y: top, w: innerW - heroW - g, h: bottom - top },
  ];
}

/**
 * The panel rectangles and the caption lockup, in pixels, for a poster `w` x `h`.
 * The caption box is where the edition line, the rule and the big title are drawn.
 */
export function framesFor(layoutId, w, h) {
  const panels = panelFractions(layoutId).map((f) => ({
    x: f.x * w,
    y: f.y * h,
    w: f.w * w,
    h: f.h * h,
  }));
  const caption = layoutId === 'hero'
    ? { x: w * 0.055, y: h * 0.64, w: w * 0.72, h: h * 0.26, align: 'left' }
    : { x: w * (MARGIN + 0.022), y: h * 0.63, w: w * 0.72, h: h * 0.255, align: 'left' };
  return { panels, caption, radius: Math.max(2, Math.min(w, h) * 0.006) };
}

/** A fresh crop: centred, at cover scale. */
export function defaultCrop() {
  return { zoom: 1, ox: 0, oy: 0 };
}

/** A sensible starting crop: portrait photos in wide panels show their top, where faces are. */
export function smartCrop(panel, photo) {
  const crop = defaultCrop();
  if (!photo || !panel) return crop;
  const panelAspect = panel.w / panel.h;
  const photoAspect = photo.width / photo.height;
  if (photoAspect < panelAspect * 0.82) crop.oy = -0.55;
  return crop;
}

/** Where the photo lands inside a panel for a crop: source rect and destination rect. */
export function cropRect(panel, photo, crop) {
  const iw = photo.width;
  const ih = photo.height;
  const base = Math.max(panel.w / iw, panel.h / ih);
  const scale = base * Math.max(1, crop.zoom || 1);
  const dw = iw * scale;
  const dh = ih * scale;
  const overX = Math.max(0, dw - panel.w);
  const overY = Math.max(0, dh - panel.h);
  const ox = clamp(crop.ox || 0, -1, 1);
  const oy = clamp(crop.oy || 0, -1, 1);
  return {
    dx: panel.x - overX * (0.5 + ox / 2),
    dy: panel.y - overY * (0.5 + oy / 2),
    dw,
    dh,
    overX,
    overY,
  };
}

export function clamp(value, lo, hi) {
  return Math.min(hi, Math.max(lo, value));
}

/** Pans a crop by a pointer move in poster pixels. */
export function panCrop(crop, panel, photo, dxPx, dyPx) {
  const r = cropRect(panel, photo, crop);
  const next = { ...crop };
  if (r.overX > 0.5) next.ox = clamp((crop.ox || 0) - (dxPx * 2) / r.overX, -1, 1);
  if (r.overY > 0.5) next.oy = clamp((crop.oy || 0) - (dyPx * 2) / r.overY, -1, 1);
  return next;
}

/** Zooms a crop about its centre. */
export function zoomCrop(crop, factor) {
  return { ...crop, zoom: clamp((crop.zoom || 1) * factor, 1, 4) };
}

/** The index of the panel under a point in poster pixels, or -1. */
export function panelAt(panels, x, y) {
  for (let i = panels.length - 1; i >= 0; i -= 1) {
    const p = panels[i];
    if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) return i;
  }
  return -1;
}
