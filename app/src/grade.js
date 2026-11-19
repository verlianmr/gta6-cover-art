// Colour grades and every procedural scenery layer (sky, sun, clouds, skyline, palms, panel grade, grain, scanlines, vignette, frame), drawn with canvas paths and seeded randomness so a cover repeats pixel for pixel.

const TAU = Math.PI * 2;

/** A small deterministic PRNG (mulberry32) so a cover is repeatable. */
export function makeRandom(seed) {
  let t = seed >>> 0;
  return function random() {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** `#rrggbb` plus an alpha, as a canvas colour. */
export function rgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

export const GRADES = {
  sunset: {
    id: 'sunset',
    label: 'Sunset',
    hint: 'Vice Beach, 8:41 pm',
    swatch: ['#ffd27a', '#ff4d8d', '#3b1b63'],
    sky: [
      [0, '#1a0a30'],
      [0.28, '#3d1450'],
      [0.5, '#8d2560'],
      [0.68, '#d8466e'],
      [0.82, '#ff8446'],
      [0.93, '#ffc168'],
      [1, '#ffe2a8'],
    ],
    cloud: '#ffd9c2',
    sun: { x: 0.72, y: 0.6, r: 0.055, core: '#fff6da', halo: '#ff7a3c', bands: false },
    horizon: 0.205,
    city: '#2a0e33',
    cityTint: '#ff9a5a',
    windows: false,
    accent: '#ff3f86',
    accent2: '#ffb03a',
    ink: '#180720',
    photo: {
      filter: 'saturate(1.14) contrast(1.14) brightness(0.98)',
      top: 'rgba(110,40,120,0.36)',
      bottom: 'rgba(255,140,70,0.4)',
      multiply: 'rgba(255,150,80,0.14)',
      topColor: '#7a2a5e',
      bottomColor: '#ffb066',
    },
    grain: 0.085,
    scanlines: 0,
    glow: '#ff7a5a',
    bloom: 0.1,
  },
  neon: {
    id: 'neon',
    label: 'Neon night',
    hint: 'After midnight, Ocean Drive',
    swatch: ['#ff3ec8', '#35e6ff', '#12062a'],
    sky: [
      [0, '#05030f'],
      [0.3, '#140a2e'],
      [0.52, '#3a1260'],
      [0.7, '#7b1a7a'],
      [0.84, '#e0348c'],
      [1, '#ff7ac0'],
    ],
    cloud: '#b06cff',
    sun: { x: 0.3, y: 0.64, r: 0.072, core: '#ffe2f6', halo: '#ff2fa0', bands: true },
    horizon: 0.205,
    city: '#0b0418',
    cityTint: '#35e6ff',
    windows: true,
    accent: '#35e6ff',
    accent2: '#ff3ec8',
    ink: '#08030f',
    photo: {
      filter: 'saturate(1.18) contrast(1.16) brightness(0.78)',
      top: 'rgba(30,10,90,0.45)',
      bottom: 'rgba(255,50,140,0.32)',
      multiply: 'rgba(38,6,86,0.34)',
      topColor: '#2a1466',
      bottomColor: '#ff2f86',
    },
    grain: 0.095,
    scanlines: 0.05,
    glow: '#3cdcff',
    bloom: 0.1,
  },
  golden: {
    id: 'golden',
    label: 'Golden hour',
    hint: 'Palm-lined boulevard, 6:12 pm',
    swatch: ['#ffe6a8', '#ff9d3c', '#7a4a3a'],
    sky: [
      [0, '#2a2144'],
      [0.3, '#7b3550'],
      [0.52, '#c25a4c'],
      [0.7, '#f0904c'],
      [0.86, '#ffc266'],
      [1, '#fff2cc'],
    ],
    cloud: '#ffe8c0',
    sun: { x: 0.8, y: 0.55, r: 0.055, core: '#fffbe8', halo: '#ffab4a', bands: false },
    horizon: 0.205,
    city: '#3a2233',
    cityTint: '#ffcf7a',
    windows: false,
    accent: '#ff9d3c',
    accent2: '#ffe07a',
    ink: '#1d1020',
    photo: {
      filter: 'saturate(1.14) contrast(1.14) brightness(1.01)',
      top: 'rgba(150,90,40,0.3)',
      bottom: 'rgba(255,200,120,0.34)',
      multiply: 'rgba(255,170,80,0.17)',
      topColor: '#6b4a2a',
      bottomColor: '#ffc274',
    },
    grain: 0.07,
    scanlines: 0,
    glow: '#ffc478',
    bloom: 0.1,
  },
};

/** The grade object for an id, never null. */
export function gradeFor(id) {
  return GRADES[id] ?? GRADES.sunset;
}

/** A rounded rectangle path on the context (no fill, no stroke). */
export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

/** One palm tree in silhouette: a leaning trunk and a crown of drooping fronds. */
export function drawPalm(ctx, x, baseY, height, lean, color, rnd, rim) {
  const topX = x + lean * height * 0.5;
  const topY = baseY - height;
  const tw = Math.max(1.2, height * 0.022);
  const path = new Path2D();

  // Trunk: a tapered S-curve.
  path.moveTo(x - tw, baseY);
  path.bezierCurveTo(
    x - tw * 0.9 + lean * height * 0.06, baseY - height * 0.38,
    topX - tw * 0.45 + lean * height * 0.12, baseY - height * 0.74,
    topX - tw * 0.32, topY,
  );
  path.lineTo(topX + tw * 0.32, topY);
  path.bezierCurveTo(
    topX + tw * 0.45 + lean * height * 0.12, baseY - height * 0.74,
    x + tw * 0.9 + lean * height * 0.06, baseY - height * 0.38,
    x + tw, baseY,
  );
  path.closePath();

  // Crown: long tapered fronds that arc out and droop.
  const fronds = 11;
  for (let i = 0; i < fronds; i += 1) {
    const t = i / (fronds - 1);
    const angle = -Math.PI * 0.94 + t * Math.PI * 0.88;
    const reach = height * (0.18 + rnd() * 0.07) * (0.8 + 0.35 * Math.sin(t * Math.PI));
    const droop = 0.5 + rnd() * 0.55;
    const midX = topX + Math.cos(angle) * reach * 0.52;
    const midY = topY + Math.sin(angle) * reach * 0.28 - reach * 0.1;
    const tipX = topX + Math.cos(angle) * reach;
    const tipY = topY + Math.sin(angle) * reach * 0.5 + reach * droop * 0.5;
    const px = -Math.sin(angle);
    const py = Math.cos(angle);
    const hw = reach * 0.075;
    path.moveTo(topX + px * hw * 0.25, topY + py * hw * 0.25);
    path.quadraticCurveTo(midX + px * hw, midY + py * hw, tipX, tipY);
    path.quadraticCurveTo(midX - px * hw, midY - py * hw, topX - px * hw * 0.25, topY - py * hw * 0.25);
    path.closePath();
  }

  if (rim) {
    ctx.save();
    ctx.translate(topX, topY);
    ctx.scale(1.035, 1.035);
    ctx.translate(-topX, -topY);
    ctx.fillStyle = rim;
    ctx.fill(path);
    ctx.restore();
  }
  ctx.fillStyle = color;
  ctx.fill(path);
}

/** Distant skyline along the horizon, with lit windows for the neon grade. */
function paintSkyline(ctx, w, h, grade, rnd) {
  const base = h * grade.horizon;

  // A far row, hazy and low, for depth.
  let x = -w * 0.02;
  while (x < w * 1.02) {
    const bw = w * (0.012 + rnd() * 0.028);
    const bh = h * (0.004 + Math.pow(rnd(), 2) * 0.026);
    ctx.fillStyle = rgba(grade.city, 0.4);
    ctx.fillRect(x, base - bh, bw, bh + h * 0.004);
    x += bw * 1.15;
  }

  // The near row: taller blocks, darker at the waterline, hazy at the top.
  x = -w * 0.03;
  while (x < w * 1.03) {
    const bw = w * (0.015 + rnd() * 0.042);
    const tall = rnd() < 0.2;
    const bh = h * (0.008 + Math.pow(rnd(), 2.4) * (tall ? 0.062 : 0.036));
    const shade = ctx.createLinearGradient(0, base - bh, 0, base);
    shade.addColorStop(0, rgba(grade.city, 0.78));
    shade.addColorStop(1, rgba(grade.city, 1));
    ctx.fillStyle = shade;
    ctx.fillRect(x, base - bh, bw * 0.94, bh + h * 0.004);
    if (tall) {
      ctx.fillStyle = rgba(grade.city, 0.9);
      ctx.fillRect(x + bw * 0.44, base - bh - h * 0.012, Math.max(1, w * 0.0012), h * 0.012);
    }
    if (grade.windows && bw > w * 0.018) {
      const cols = Math.max(2, Math.floor(bw / (w * 0.006)));
      const rows = Math.max(2, Math.floor(bh / (h * 0.009)));
      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          if (rnd() > 0.34) continue;
          ctx.fillStyle = rnd() < 0.5 ? rgba(grade.cityTint, 0.8) : rgba(grade.accent2, 0.65);
          ctx.fillRect(
            x + bw * 0.06 + (c * (bw * 0.88)) / cols,
            base - bh + h * 0.004 + (r * (bh * 0.9)) / rows,
            Math.max(1, ((bw * 0.88) / cols) * 0.45),
            Math.max(1, ((bh * 0.9) / rows) * 0.4),
          );
        }
      }
    }
    x += bw;
  }
  ctx.fillStyle = rgba(grade.cityTint, 0.5);
  ctx.fillRect(0, base - Math.max(1, h * 0.0012), w, Math.max(1, h * 0.0016));
}

/** The sky: gradient, stars, sun with halo, cloud bands, horizon haze, skyline, small palms. */
export function paintSky(ctx, w, h, grade, seed) {
  const rnd = makeRandom(seed);
  const horizon = h * grade.horizon;
  const grad = ctx.createLinearGradient(0, 0, 0, horizon);
  for (const [stop, colour] of grade.sky) grad.addColorStop(stop, colour);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, horizon);
  // Below the horizon the sky settles into the poster's dark ground.
  const ground = ctx.createLinearGradient(0, horizon, 0, horizon + h * 0.16);
  ground.addColorStop(0, grade.sky[grade.sky.length - 1][1]);
  ground.addColorStop(0.45, grade.sky[3][1]);
  ground.addColorStop(1, grade.ink);
  ctx.fillStyle = ground;
  ctx.fillRect(0, horizon, w, h - horizon);
  ctx.fillStyle = grade.ink;
  ctx.fillRect(0, horizon + h * 0.16, w, h);

  if (grade.id === 'neon') {
    for (let i = 0; i < 90; i += 1) {
      const sx = rnd() * w;
      const sy = rnd() * horizon * 0.85;
      const sr = Math.max(0.6, rnd() * Math.min(w, h) * 0.0016);
      ctx.fillStyle = `rgba(255,255,255,${0.15 + rnd() * 0.55})`;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, TAU);
      ctx.fill();
    }
  }

  const sx = w * grade.sun.x;
  const sy = horizon * grade.sun.y;
  const sr = Math.min(w, h) * grade.sun.r;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 9);
  halo.addColorStop(0, rgba(grade.sun.halo, 0.95));
  halo.addColorStop(0.14, rgba(grade.sun.halo, 0.45));
  halo.addColorStop(0.38, rgba(grade.sun.halo, 0.17));
  halo.addColorStop(1, rgba(grade.sun.halo, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, w, horizon * 2.4);
  ctx.restore();

  const disc = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
  disc.addColorStop(0, '#fffdf4');
  disc.addColorStop(0.55, grade.sun.core);
  disc.addColorStop(1, rgba(grade.sun.halo, 0.92));
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(sx, sy, sr, 0, TAU);
  ctx.fill();

  if (grade.sun.bands) {
    // Retro slices through the sun: repaint the sky colour over it.
    ctx.fillStyle = grad;
    for (let i = 0; i < 5; i += 1) {
      const yy = sy + sr * (0.05 + i * 0.19);
      ctx.fillRect(sx - sr * 1.3, yy, sr * 2.6, sr * (0.035 + i * 0.014));
    }
  }

  // Cloud bands: long soft ellipses, brighter where the sun is.
  for (let i = 0; i < 13; i += 1) {
    const cy = horizon * (0.08 + rnd() * 0.62);
    const cw = w * (0.16 + rnd() * 0.46);
    const ch = h * (0.003 + rnd() * 0.009);
    const cx = w * (rnd() * 1.15 - 0.08);
    const near = 1 - Math.min(1, Math.abs(cx - sx) / (w * 0.55));
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.1 + rnd() * 0.14 + near * 0.2;
    const cg = ctx.createLinearGradient(cx, cy - ch, cx, cy + ch);
    cg.addColorStop(0, rgba(grade.cloud, 0));
    cg.addColorStop(0.5, rgba(grade.cloud, 1));
    cg.addColorStop(1, rgba(grade.cloud, 0));
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.ellipse(cx, cy, cw / 2, ch, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // Haze where the sky meets the city.
  const haze = ctx.createLinearGradient(0, horizon - h * 0.075, 0, horizon + h * 0.01);
  haze.addColorStop(0, rgba(grade.accent2, 0));
  haze.addColorStop(0.75, rgba(grade.accent2, 0.32));
  haze.addColorStop(1, rgba(grade.accent2, 0));
  ctx.fillStyle = haze;
  ctx.fillRect(0, horizon - h * 0.075, w, h * 0.09);

  paintSkyline(ctx, w, h, grade, rnd);

  // Palms along the horizon, behind the panels.
  const small = h * 0.17;
  drawPalm(ctx, w * 0.075, horizon + h * 0.004, small, 0.08, grade.city, rnd);
  drawPalm(ctx, w * 0.145, horizon + h * 0.004, small * 0.8, -0.12, grade.city, rnd);
  drawPalm(ctx, w * 0.815, horizon + h * 0.004, small * 0.9, 0.1, grade.city, rnd);

  // A few birds.
  ctx.strokeStyle = rgba(grade.city, 0.75);
  ctx.lineWidth = Math.max(1, w * 0.0012);
  for (let i = 0; i < 4; i += 1) {
    const bx = w * (0.2 + rnd() * 0.6);
    const by = horizon * (0.18 + rnd() * 0.4);
    const s = Math.min(w, h) * (0.006 + rnd() * 0.006);
    ctx.beginPath();
    ctx.moveTo(bx - s, by);
    ctx.quadraticCurveTo(bx - s * 0.4, by - s * 0.8, bx, by - s * 0.1);
    ctx.quadraticCurveTo(bx + s * 0.4, by - s * 0.8, bx + s, by);
    ctx.stroke();
  }
}

/** Palms at the bottom corners and a ground shadow, drawn over the panels and under the title. */
export function paintForeground(ctx, w, h, grade, seed) {
  const rnd = makeRandom(seed + 77);
  const dark = grade.id === 'neon' ? '#07020f' : '#150820';
  const rim = rgba(grade.accent2, 0.5);
  drawPalm(ctx, w * 1.012, h * 1.02, h * 0.3, -0.06, dark, rnd, rim);
  drawPalm(ctx, w * -0.012, h * 1.03, h * 0.24, 0.1, dark, rnd, rgba(grade.accent2, 0.3));

  const ground = ctx.createLinearGradient(0, h * 0.88, 0, h);
  ground.addColorStop(0, 'rgba(10,3,18,0)');
  ground.addColorStop(1, 'rgba(10,3,18,0.4)');
  ctx.fillStyle = ground;
  ctx.fillRect(0, h * 0.88, w, h * 0.12);
}

/** The colour grade laid over a photo panel: duotone wash, bloom, vignette. */
export function gradePanel(ctx, x, y, w, h, grade, radius) {
  ctx.save();
  roundRect(ctx, x, y, w, h, radius);
  ctx.clip();

  const wash = ctx.createLinearGradient(0, y, 0, y + h);
  wash.addColorStop(0, grade.photo.top);
  wash.addColorStop(0.55, 'rgba(255,255,255,0)');
  wash.addColorStop(1, grade.photo.bottom);
  ctx.globalCompositeOperation = 'soft-light';
  ctx.fillStyle = wash;
  ctx.fillRect(x, y, w, h);

  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = grade.photo.multiply;
  ctx.fillRect(x, y, w, h);

  ctx.globalCompositeOperation = 'color';
  ctx.globalAlpha = 0.14;
  const duotone = ctx.createLinearGradient(0, y, 0, y + h);
  duotone.addColorStop(0, grade.photo.topColor);
  duotone.addColorStop(1, grade.photo.bottomColor);
  ctx.fillStyle = duotone;
  ctx.fillRect(x, y, w, h);
  ctx.globalAlpha = 1;

  ctx.globalCompositeOperation = 'screen';
  const bloom = ctx.createRadialGradient(
    x + w * 0.5, y + h * 0.18, 0, x + w * 0.5, y + h * 0.18, Math.max(w, h) * 0.75,
  );
  bloom.addColorStop(0, rgba(grade.glow, grade.bloom));
  bloom.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = bloom;
  ctx.fillRect(x, y, w, h);

  ctx.globalCompositeOperation = 'source-over';
  const vig = ctx.createRadialGradient(
    x + w * 0.5, y + h * 0.5, Math.min(w, h) * 0.25,
    x + w * 0.5, y + h * 0.5, Math.max(w, h) * 0.78,
  );
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(14,2,20,0.34)');
  ctx.fillStyle = vig;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

let grainTile = null;

/** A cached 140 px tile of monochrome noise. */
function grainPattern(ctx) {
  if (!grainTile) {
    const size = 140;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const g = c.getContext('2d');
    const img = g.createImageData(size, size);
    const rnd = makeRandom(4242);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 120 + Math.floor(rnd() * 135);
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    grainTile = c;
  }
  return ctx.createPattern(grainTile, 'repeat');
}

/** Film grain, scanlines, vignette, the chromatic edge and the printed frame. */
export function paintFinish(ctx, w, h, grade) {
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = grade.grain;
  ctx.fillStyle = grainPattern(ctx);
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  if (grade.scanlines) {
    ctx.save();
    ctx.globalAlpha = grade.scanlines;
    ctx.fillStyle = '#05010c';
    const step = Math.max(2, Math.round(h / 380));
    for (let y = 0; y < h; y += step) ctx.fillRect(0, y, w, Math.max(1, step / 2));
    ctx.restore();
  }

  // A soft warm light leak across the frame, like sun on the lens.
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const leak = ctx.createLinearGradient(w * 0.05, 0, w * 0.95, h);
  leak.addColorStop(0, rgba(grade.accent2, 0.12));
  leak.addColorStop(0.35, rgba(grade.accent, 0.05));
  leak.addColorStop(0.7, 'rgba(0,0,0,0)');
  ctx.fillStyle = leak;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  const vig = ctx.createRadialGradient(w / 2, h * 0.46, Math.min(w, h) * 0.32, w / 2, h * 0.5, Math.max(w, h) * 0.78);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(8,2,14,0.5)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);

  // Chromatic edge: a red fringe on one side, cyan on the other.
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const edge = Math.max(6, w * 0.014);
  const left = ctx.createLinearGradient(0, 0, edge, 0);
  left.addColorStop(0, 'rgba(255,42,96,0.42)');
  left.addColorStop(1, 'rgba(255,42,96,0)');
  ctx.fillStyle = left;
  ctx.fillRect(0, 0, edge, h);
  const right = ctx.createLinearGradient(w, 0, w - edge, 0);
  right.addColorStop(0, 'rgba(53,230,255,0.4)');
  right.addColorStop(1, 'rgba(53,230,255,0)');
  ctx.fillStyle = right;
  ctx.fillRect(w - edge, 0, edge, h);
  ctx.restore();

  // Frame: a dark printed border with a thin lit line inside it.
  const frame = Math.max(4, Math.round(w * 0.012));
  ctx.fillStyle = grade.ink;
  ctx.fillRect(0, 0, w, frame);
  ctx.fillRect(0, h - frame, w, frame);
  ctx.fillRect(0, 0, frame, h);
  ctx.fillRect(w - frame, 0, frame, h);
  ctx.strokeStyle = rgba(grade.accent, 0.32);
  ctx.lineWidth = Math.max(1, frame * 0.12);
  ctx.strokeRect(frame * 1.5, frame * 1.5, w - frame * 3, h - frame * 3);
}
