// Photos: reading the user's own files on their machine, decoding them into drawable images,
// building the small chips the editor shows, and the two bundled samples plus one procedurally
// drawn sample. Nothing here ever leaves the page.

import { GRADES, makeRandom, drawPalm, rgba } from './grade.js';

let nextId = 1;

function decodeWithImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That file could not be read as an image.'));
    };
    img.src = url;
  });
}

/** A small square JPEG data URI for the photo chips in the rail. */
function thumbnail(image, width, height) {
  const size = 120;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const scale = Math.max(size / width, size / height);
  const dw = width * scale;
  const dh = height * scale;
  ctx.drawImage(image, (size - dw) / 2, (size - dh) / 2, dw, dh);
  return canvas.toDataURL('image/jpeg', 0.72);
}

function photoFrom(image, name, width, height) {
  return {
    id: nextId++,
    name,
    image,
    width,
    height,
    thumb: thumbnail(image, width, height),
  };
}

/** Reads one File into a photo object; the file stays on the device. */
export async function readPhotoFile(file) {
  let image;
  if ('createImageBitmap' in window) {
    try {
      image = await createImageBitmap(file);
    } catch {
      image = await decodeWithImage(file);
    }
  } else {
    image = await decodeWithImage(file);
  }
  const width = image.width || image.naturalWidth;
  const height = image.height || image.naturalHeight;
  const name = (file.name || 'photo').replace(/\.[^.]+$/, '');
  return photoFrom(image, name, width, height);
}

/** Reads a list of Files, skipping ones that fail to decode. */
export async function readPhotoFiles(files) {
  const photos = [];
  for (const file of files) {
    try {
      photos.push(await readPhotoFile(file));
    } catch {
      // A file that is not an image is simply left out.
    }
  }
  return photos;
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('sample photo missing'));
    img.src = src;
  });
}

export const SAMPLE_NAMES = ['boulevard', 'pier'];

/** Loads one of the bundled CC0 sample photos (or the drawn skyline). */
export async function loadSample(name) {
  if (name === 'skyline') return skylinePhoto();
  const file = SAMPLE_NAMES.includes(name) ? name : SAMPLE_NAMES[0];
  const img = await loadImageElement(new URL(`../samples/${file}.jpg`, import.meta.url).href);
  return photoFrom(img, file, img.naturalWidth, img.naturalHeight);
}

let skylineCache = null;

/** A procedurally drawn night skyline, used as a third photo so grid layouts can be filled. */
export function skylinePhoto() {
  if (skylineCache) return skylineCache;
  const w = 900;
  const h = 1200;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const grade = GRADES.neon;
  const rnd = makeRandom(12);
  const horizon = h * 0.6;

  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  grade.sky.forEach(([stop, colour]) => sky.addColorStop(stop, colour));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, horizon);

  for (let i = 0; i < 70; i += 1) {
    ctx.fillStyle = `rgba(255,255,255,${0.2 + rnd() * 0.5})`;
    ctx.beginPath();
    ctx.arc(rnd() * w, rnd() * horizon * 0.55, rnd() * 1.6 + 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  const sx = w * 0.66;
  const sy = horizon * 0.78;
  const sr = w * 0.17;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 4.4);
  halo.addColorStop(0, 'rgba(255,47,160,0.85)');
  halo.addColorStop(0.3, 'rgba(255,47,160,0.3)');
  halo.addColorStop(1, 'rgba(255,47,160,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, w, horizon);
  ctx.restore();
  const disc = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
  disc.addColorStop(0, '#fff2fb');
  disc.addColorStop(0.6, '#ffd0ee');
  disc.addColorStop(1, 'rgba(255,47,160,0.85)');
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(sx, sy, sr, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = sky;
  for (let i = 0; i < 5; i += 1) {
    ctx.fillRect(sx - sr * 1.2, sy + sr * (0.05 + i * 0.19), sr * 2.4, sr * (0.05 + i * 0.015));
  }

  // Towers along the waterline.
  let x = -30;
  while (x < w + 30) {
    const bw = 42 + rnd() * 96;
    const bh = 90 + Math.pow(rnd(), 1.7) * 430;
    ctx.fillStyle = '#0a0318';
    ctx.fillRect(x, horizon - bh, bw, bh);
    for (let wy = horizon - bh + 14; wy < horizon - 14; wy += 22) {
      for (let wx = x + 7; wx < x + bw - 7; wx += 16) {
        if (rnd() < 0.26) {
          ctx.fillStyle = rnd() < 0.5 ? 'rgba(53,230,255,0.85)' : 'rgba(255,62,200,0.8)';
          ctx.fillRect(wx, wy, 6, 8);
        }
      }
    }
    x += bw + 4 + rnd() * 18;
  }

  // Water: the sky reflected, broken into ripples.
  const water = ctx.createLinearGradient(0, horizon, 0, h);
  water.addColorStop(0, '#3a1260');
  water.addColorStop(0.35, '#1b0a33');
  water.addColorStop(1, '#07020f');
  ctx.fillStyle = water;
  ctx.fillRect(0, horizon, w, h - horizon);
  for (let i = 0; i < 90; i += 1) {
    const ry = horizon + Math.pow(rnd(), 1.4) * (h - horizon);
    const rw = 20 + rnd() * 220;
    const rx = sx - rw / 2 + (rnd() - 0.5) * 260;
    ctx.fillStyle = `rgba(255,${80 + Math.floor(rnd() * 80)},200,${0.05 + rnd() * 0.16})`;
    ctx.fillRect(rx, ry, rw, 2 + rnd() * 3);
  }
  ctx.fillStyle = 'rgba(53,230,255,0.10)';
  ctx.fillRect(0, horizon - 2, w, 3);

  drawPalm(ctx, w * 0.06, h * 1.01, h * 0.62, 0.1, '#05010d', rnd);
  drawPalm(ctx, w * 0.96, h * 1.02, h * 0.5, -0.08, '#05010d', rnd);
  ctx.fillStyle = rgba('#000000', 0.18);
  ctx.fillRect(0, 0, w, h);

  skylineCache = photoFrom(canvas, 'skyline', w, h);
  return skylineCache;
}
