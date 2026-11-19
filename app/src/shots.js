// Deterministic screenshot scenes. `?shot=cover` renders a finished cover through the real PNG
// export and shows that PNG alone; `?shot=editor` fills the studio with photos, a layout and a
// grade so the editor can be captured with its panels and controls visible.
// Query: shot, photo, photo2, photo3, caption, edition, grade, layout, size, zoom, export.

import { loadSample } from './photos.js';
import { makePng, sizeFromParam } from './export.js';
import { layoutById } from './panels.js';

const DEFAULTS = {
  caption: 'Sunset Heist',
  edition: 'The Gold Coast Edition',
  grade: 'sunset',
  layout: 'classic',
};

async function loadPhotos(app, names) {
  const photos = [];
  for (const name of names) {
    try {
      photos.push(await loadSample(name));
    } catch {
      // A missing sample is skipped; the scene still renders.
    }
  }
  app.state.photos = photos;
  app.state.slots.forEach((slot) => {
    slot.photoId = null;
    slot.crop = { zoom: 1, ox: 0, oy: 0 };
  });
  const count = layoutById(app.state.layout).slots;
  for (let i = 0; i < count && photos.length; i += 1) {
    app.state.slots[i].photoId = photos[i % photos.length].id;
  }
}

function applyText(app, params) {
  app.state.caption = params.get('caption') ?? DEFAULTS.caption;
  app.state.edition = params.get('edition') ?? DEFAULTS.edition;
  app.state.grade = params.get('grade') ?? DEFAULTS.grade;
  app.state.layout = layoutById(params.get('layout') ?? DEFAULTS.layout).id;
}


/** Per-panel crops: zoom=N for all panels, or crop0..crop3 as "zoom,ox,oy". */
function applyCrops(app, params) {
  const zoom = Number(params.get('zoom') ?? '1');
  if (Number.isFinite(zoom) && zoom !== 1) {
    app.state.slots.forEach((slot) => {
      if (slot.photoId) slot.crop = { ...slot.crop, zoom };
    });
  }
  for (let i = 0; i < app.state.slots.length; i += 1) {
    const spec = params.get(`crop${i}`);
    if (!spec) continue;
    const [z, ox, oy] = spec.split(',').map((n) => Number(n));
    const slot = app.state.slots[i];
    if (!slot.photoId) continue;
    slot.crop = {
      zoom: Number.isFinite(z) && z > 0 ? z : 1,
      ox: Number.isFinite(ox) ? Math.max(-1, Math.min(1, ox)) : 0,
      oy: Number.isFinite(oy) ? Math.max(-1, Math.min(1, oy)) : 0,
    };
  }
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

/** Runs the screenshot scene named by the query. Sets window.__shotReady when painted. */
export async function runShot(app, params) {
  const kind = params.get('shot');
  document.documentElement.dataset.shot = kind ?? '';

  if (kind === 'cover') {
    document.body.classList.add('shot-cover');
    applyText(app, params);
    const names = [params.get('photo') ?? 'pier', params.get('photo2'), params.get('photo3')].filter(Boolean);
    await loadPhotos(app, names);
    const size = sizeFromParam(params.get('size') ?? '1080x1080');
    applyCrops(app, params);
    const png = await makePng(app.modelFor(), size);
    const stage = document.getElementById('shotStage');
    stage.hidden = false;
    const img = new Image();
    img.alt = 'The exported cover';
    img.src = png.url;
    stage.append(img);
    try {
      await img.decode();
    } catch {
      // The image is already on screen even if decode() is unsupported.
    }
    await nextFrame();
    window.__shotReady = true;
    return;
  }

  // Editor scene.
  applyText(app, params);
  const size = sizeFromParam(params.get('size') ?? '1080x1080');
  app.state.size = size.id;
  const names = [
    params.get('photo') ?? 'boulevard',
    params.get('photo2') ?? 'pier',
    params.get('photo3'),
  ].filter(Boolean);
  await loadPhotos(app, names);
  const selected = Number(params.get('panel') ?? '0');
  app.state.selected = Number.isFinite(selected) ? selected : 0;
  applyCrops(app, params);

  app.syncAll();
  app.layoutPreview();
  app.setStatus('Ready to export');
  if (params.get('export') === '1') {
    await app.exportNow({ download: false });
  }
  await nextFrame();
  window.__shotReady = true;
}
