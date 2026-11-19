// The compositor: paints a whole cover at any size from the model, back to front, so the preview and the exported PNG share one drawing code.

import { framesFor, cropRect } from './panels.js';
import { gradeFor, paintSky, paintForeground, gradePanel, paintFinish, roundRect, rgba } from './grade.js';
import { drawCaption } from './lettering.js';

const SEED = 1907;

function paintEmptyPanel(ctx, x, y, w, h, radius, grade) {
  ctx.save();
  roundRect(ctx, x, y, w, h, radius);
  ctx.clip();
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, '#241634');
  g.addColorStop(1, '#150c22');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(255,240,230,0.07)';
  ctx.lineWidth = Math.max(1, w * 0.004);
  const step = Math.max(10, w * 0.055);
  for (let i = -h; i < w + h; i += step) {
    ctx.beginPath();
    ctx.moveTo(x + i, y + h);
    ctx.lineTo(x + i + h, y);
    ctx.stroke();
  }
  const cx = x + w / 2;
  const cy = y + h / 2;
  const arm = Math.min(w, h) * 0.075;
  ctx.strokeStyle = rgba(grade.accent, 0.85);
  ctx.lineWidth = Math.max(2, Math.min(w, h) * 0.012);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - arm, cy);
  ctx.lineTo(cx + arm, cy);
  ctx.moveTo(cx, cy - arm);
  ctx.lineTo(cx, cy + arm);
  ctx.stroke();

  const label = 'ADD A PHOTO';
  const size = Math.max(7, Math.min(w, h) * 0.032);
  ctx.font = `700 ${size}px "Liberation Sans", Arial, sans-serif`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${size * 0.22}px`;
  ctx.fillStyle = 'rgba(255,240,230,0.42)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(label, cx, cy + arm * 1.25);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  ctx.restore();
}

function paintPanel(ctx, rect, panel, grade, radius) {
  const { x, y, w, h } = rect;

  ctx.save();
  ctx.shadowColor = 'rgba(8,0,16,0.6)';
  ctx.shadowBlur = Math.min(w, h) * 0.09;
  ctx.shadowOffsetY = h * 0.012;
  ctx.fillStyle = '#0e0716';
  roundRect(ctx, x, y, w, h, radius);
  ctx.fill();
  ctx.restore();

  const photo = panel && panel.photo;
  if (!photo) {
    paintEmptyPanel(ctx, x, y, w, h, radius, grade);
  } else {
    const crop = cropRect(rect, photo, panel.crop || { zoom: 1, ox: 0, oy: 0 });
    ctx.save();
    roundRect(ctx, x, y, w, h, radius);
    ctx.clip();
    ctx.imageSmoothingQuality = 'high';
    if ('filter' in ctx) ctx.filter = grade.photo.filter;
    ctx.drawImage(photo.image, crop.dx, crop.dy, crop.dw, crop.dh);
    if ('filter' in ctx) ctx.filter = 'none';
    ctx.restore();
    gradePanel(ctx, x, y, w, h, grade, radius);
  }

  // A printed cream edge around each photo.
  ctx.save();
  ctx.strokeStyle = 'rgba(255,246,235,0.9)';
  ctx.lineWidth = Math.max(1.2, Math.min(w, h) * 0.0055);
  roundRect(ctx, x, y, w, h, radius);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(20,4,28,0.55)';
  ctx.lineWidth = Math.max(1, Math.min(w, h) * 0.0025);
  roundRect(ctx, x - ctx.lineWidth, y - ctx.lineWidth, w + ctx.lineWidth * 2, h + ctx.lineWidth * 2, radius + ctx.lineWidth);
  ctx.stroke();
  ctx.restore();
}

/** Paints the whole cover for `model` onto a `w` x `h` context. */
export function drawPoster(ctx, model, w, h) {
  const grade = gradeFor(model.grade);
  const frames = framesFor(model.layout, w, h);

  ctx.save();
  ctx.fillStyle = grade.ink;
  ctx.fillRect(0, 0, w, h);
  paintSky(ctx, w, h, grade, SEED);

  const panels = model.panels || [];
  for (let i = 0; i < frames.panels.length; i += 1) {
    paintPanel(ctx, frames.panels[i], panels[i], grade, model.layout === 'hero' ? 0 : frames.radius);
  }

  paintForeground(ctx, w, h, grade, SEED);

  // Scrim under the title so the lettering reads over any photo.
  const scrim = ctx.createLinearGradient(0, h * 0.5, 0, h);
  scrim.addColorStop(0, 'rgba(10,2,18,0)');
  scrim.addColorStop(0.45, 'rgba(10,2,18,0.35)');
  scrim.addColorStop(0.78, 'rgba(10,2,18,0.72)');
  scrim.addColorStop(1, 'rgba(10,2,18,0.9)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, h * 0.5, w, h * 0.5);

  drawCaption(ctx, model.caption, model.edition, frames.caption, grade);
  paintFinish(ctx, w, h, grade);
  ctx.restore();
}
