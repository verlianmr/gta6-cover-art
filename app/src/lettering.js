// The poster lettering: a bold, auto-fitted caption with a dark outline, a warm gradient fill, a
// chromatic fringe and a soft shadow, plus the small tracked edition line and its accent rule.
// The caption is uppercased, wrapped to the box, and shrunk until it fits — at any poster size.

export const CAPTION_FAMILY = '"Liberation Sans", "Helvetica Neue", Arial, sans-serif';

function setFont(ctx, size, tracking) {
  ctx.font = `700 ${size}px ${CAPTION_FAMILY}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${(tracking * size).toFixed(2)}px`;
}

function measure(ctx, text, size, tracking) {
  setFont(ctx, size, tracking);
  return ctx.measureText(text).width;
}

function wrapLines(ctx, paragraphs, size, tracking, maxWidth) {
  const lines = [];
  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push('');
      continue;
    }
    let line = words[0];
    for (let i = 1; i < words.length; i += 1) {
      const test = `${line} ${words[i]}`;
      if (measure(ctx, test, size, tracking) <= maxWidth) line = test;
      else {
        lines.push(line);
        line = words[i];
      }
    }
    lines.push(line);
  }
  return lines;
}

/**
 * The largest type size at which the caption fits its box, with the wrapped lines.
 * Returns { size, lines, lineHeight }.
 */
export function fitCaption(ctx, text, boxWidth, boxHeight, options = {}) {
  const tracking = options.tracking ?? -0.028;
  const lineRatio = options.lineRatio ?? 0.9;
  const paragraphs = String(text || '')
    .toUpperCase()
    .split('\n')
    .map((s) => s.trim())
    .filter((s, i, all) => s.length > 0 || i < all.length - 1);
  if (!paragraphs.length) return { size: 0, lines: [], lineHeight: 0 };

  const maxSize = Math.max(12, Math.floor(boxHeight * 1.6));
  const minSize = Math.max(9, Math.floor(boxHeight * 0.1));
  for (let size = maxSize; size >= minSize; size -= Math.max(1, Math.round(size * 0.02))) {
    const lines = wrapLines(ctx, paragraphs, size, tracking, boxWidth);
    const lineHeight = size * lineRatio;
    const totalHeight = lines.length * lineHeight;
    const widest = Math.max(...lines.map((l) => measure(ctx, l, size, tracking)));
    if (widest <= boxWidth && totalHeight <= boxHeight) return { size, lines, lineHeight };
  }
  const size = minSize;
  const lines = wrapLines(ctx, paragraphs, size, tracking, boxWidth);
  return { size, lines, lineHeight: size * lineRatio };
}

function drawTitleLine(ctx, text, x, baseline, size, tracking, grade) {
  setFont(ctx, size, tracking);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';

  // Chromatic fringe behind the letters.
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = grade.accent2;
  ctx.fillText(text, x - size * 0.035, baseline + size * 0.012);
  ctx.fillStyle = grade.accent;
  ctx.fillText(text, x + size * 0.035, baseline - size * 0.008);
  ctx.restore();

  // Ink outline with a soft drop shadow.
  ctx.save();
  ctx.shadowColor = 'rgba(6,0,12,0.55)';
  ctx.shadowBlur = size * 0.18;
  ctx.shadowOffsetY = size * 0.06;
  ctx.lineWidth = Math.max(1.5, size * 0.085);
  ctx.strokeStyle = grade.ink;
  ctx.strokeText(text, x, baseline);
  ctx.restore();

  // Warm gradient fill.
  const fill = ctx.createLinearGradient(0, baseline - size * 0.78, 0, baseline + size * 0.08);
  fill.addColorStop(0, '#fffdf7');
  fill.addColorStop(0.5, '#fff3e4');
  fill.addColorStop(1, '#ffcfa8');
  ctx.fillStyle = fill;
  ctx.fillText(text, x, baseline);

  // A thin highlight along the top of the strokes.
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = Math.max(1, size * 0.018);
  ctx.strokeStyle = '#ffffff';
  ctx.strokeText(text, x, baseline);
  ctx.restore();
}

/** Draws the caption lockup: accent rule, edition line, big title. */
export function drawCaption(ctx, caption, edition, box, grade) {
  const x = box.x;
  const ruleH = Math.max(2, box.h * 0.022);
  const editionSize = Math.max(9, box.h * 0.082);
  const ruleW = box.w * 0.16;

  // Accent rule with a glow.
  ctx.save();
  ctx.shadowColor = grade.accent;
  ctx.shadowBlur = ruleH * 6;
  ctx.fillStyle = grade.accent;
  ctx.fillRect(x, box.y, ruleW, ruleH);
  ctx.restore();

  const editionText = String(edition || '').trim().toUpperCase();
  if (editionText) {
    setFont(ctx, editionSize, 0.22);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const baseline = box.y + ruleH + editionSize * 1.35;
    ctx.fillStyle = 'rgba(255,246,236,0.82)';
    ctx.fillText(editionText, x, baseline);
  }

  const titleTop = box.y + ruleH + (editionText ? editionSize * 2.1 : editionSize * 0.5);
  const titleBox = { w: box.w, h: box.y + box.h - titleTop };
  const fitted = fitCaption(ctx, caption, titleBox.w, titleBox.h);
  if (!fitted.lines.length) return;

  const tracking = -0.028;
  const total = fitted.lines.length * fitted.lineHeight;
  const start = titleTop + (titleBox.h - total) / 2 + fitted.size * 0.78;
  for (let i = 0; i < fitted.lines.length; i += 1) {
    drawTitleLine(
      ctx,
      fitted.lines[i],
      x,
      start + i * fitted.lineHeight,
      fitted.size,
      tracking,
      grade,
    );
  }
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
}
