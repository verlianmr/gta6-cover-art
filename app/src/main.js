// The editor: photo import (drop, picker, samples), the layout/grade/size controls, the live preview with per-panel pan and zoom, captions, and PNG export.

import { SIZES, sizeById, makePng, downloadUrl, formatBytes } from './export.js';
import { LAYOUTS, layoutById, framesFor, defaultCrop, smartCrop, panelAt, panCrop, zoomCrop } from './panels.js';
import { GRADES } from './grade.js';
import { drawPoster } from './poster.js';
import { readPhotoFiles, loadSample } from './photos.js';
import { runShot } from './shots.js';

const $ = (id) => document.getElementById(id);
const DPR = Math.min(2, window.devicePixelRatio || 1);

const PANEL_LABELS = {
  classic: ['Hero', 'Side'],
  triple: ['Hero', 'Upper right', 'Lower right'],
  grid: ['Hero', 'Top right', 'Lower left', 'Lower right'],
  hero: ['Full bleed'],
};

const state = {
  layout: 'classic',
  grade: 'sunset',
  caption: 'Sunset Heist',
  edition: 'The Gold Coast Edition',
  size: 'wide',
  selected: 0,
  photos: [],
  slots: Array.from({ length: 4 }, () => ({ photoId: null, crop: defaultCrop() })),
};

const preview = $('preview');
const ctx = preview.getContext('2d');
let lastExport = null;
let drag = null;
let drawQueued = false;

/* ---------- model ---------- */

function photoById(id) {
  return state.photos.find((p) => p.id === id) ?? null;
}

export function modelFor(s = state) {
  const count = layoutById(s.layout).slots;
  const panels = [];
  for (let i = 0; i < count; i += 1) {
    const slot = s.slots[i];
    panels.push({ photo: photoById(slot.photoId), crop: slot.crop });
  }
  return {
    layout: s.layout,
    grade: s.grade,
    caption: s.caption,
    edition: s.edition,
    panels,
  };
}

function panelLabel(layout, index) {
  const labels = PANEL_LABELS[layout] ?? PANEL_LABELS.classic;
  return labels[index] ?? `Panel ${index + 1}`;
}

function activeCount() {
  return layoutById(state.layout).slots;
}

function cropFor(slotIndex, photo) {
  const size = sizeById(state.size);
  const frames = framesFor(state.layout, size.w, size.h);
  return smartCrop(frames.panels[slotIndex] ?? { w: 1, h: 1 }, photo);
}

function fillEmptySlots() {
  if (!state.photos.length) return;
  const count = activeCount();
  for (let i = 0; i < count; i += 1) {
    const slot = state.slots[i];
    if (!slot.photoId || !photoById(slot.photoId)) {
      const photo = state.photos[i % state.photos.length];
      slot.photoId = photo.id;
      slot.crop = cropFor(i, photo);
    }
  }
}

/* ---------- preview ---------- */

function layoutPreview() {
  const stage = $('stageInner');
  const size = sizeById(state.size);
  const availW = Math.max(160, stage.clientWidth - 26);
  const availH = Math.max(160, stage.clientHeight - 26);
  const aspect = size.w / size.h;
  let w = availW;
  let h = w / aspect;
  if (h > availH) {
    h = availH;
    w = h * aspect;
  }
  preview.style.width = `${Math.round(w)}px`;
  preview.style.height = `${Math.round(h)}px`;
  preview.width = Math.max(1, Math.round(w * DPR));
  preview.height = Math.max(1, Math.round(h * DPR));
  draw();
}

function draw() {
  const w = preview.width;
  const h = preview.height;
  if (!w || !h) return;
  drawPoster(ctx, modelFor(), w, h);
  drawSelection(w, h);
}

function scheduleDraw() {
  if (drawQueued) return;
  drawQueued = true;
  requestAnimationFrame(() => {
    drawQueued = false;
    draw();
  });
}

function drawSelection(w, h) {
  const frames = framesFor(state.layout, w, h);
  const panel = frames.panels[state.selected];
  if (!panel) return;
  const unit = Math.min(w, h);
  ctx.save();
  ctx.strokeStyle = 'rgba(53,230,214,0.95)';
  ctx.lineWidth = Math.max(2, unit * 0.004);
  ctx.setLineDash([unit * 0.018, unit * 0.012]);
  ctx.strokeRect(panel.x + 2, panel.y + 2, panel.w - 4, panel.h - 4);
  ctx.setLineDash([]);

  const handle = Math.max(4, unit * 0.009);
  ctx.fillStyle = 'rgba(53,230,214,0.95)';
  const corners = [
    [panel.x, panel.y],
    [panel.x + panel.w, panel.y],
    [panel.x, panel.y + panel.h],
    [panel.x + panel.w, panel.y + panel.h],
  ];
  for (const [cx, cy] of corners) ctx.fillRect(cx - handle / 2, cy - handle / 2, handle, handle);

  const label = `${panelLabel(state.layout, state.selected).toUpperCase()} · DRAG TO PAN`;
  const size = Math.max(9, unit * 0.017);
  ctx.font = `700 ${size}px "Liberation Sans", Arial, sans-serif`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${size * 0.08}px`;
  const textW = ctx.measureText(label).width;
  const padX = size * 0.7;
  const boxH = size * 1.9;
  const bx = panel.x + size * 0.6;
  const by = panel.y + size * 0.6;
  ctx.fillStyle = 'rgba(8,4,14,0.82)';
  ctx.beginPath();
  ctx.roundRect(bx, by, textW + padX * 2, boxH, boxH / 2);
  ctx.fill();
  ctx.fillStyle = '#35e6d6';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, bx + padX, by + boxH / 2 + size * 0.06);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  ctx.restore();
}

function toPoster(event) {
  const rect = preview.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * preview.width,
    y: ((event.clientY - rect.top) / rect.height) * preview.height,
  };
}

preview.addEventListener('pointerdown', (event) => {
  const point = toPoster(event);
  const frames = framesFor(state.layout, preview.width, preview.height);
  const index = panelAt(frames.panels, point.x, point.y);
  if (index < 0) return;
  selectPanel(index);
  drag = { index, x: point.x, y: point.y };
  preview.setPointerCapture(event.pointerId);
  preview.classList.add('dragging');
});

preview.addEventListener('pointermove', (event) => {
  if (!drag) return;
  const point = toPoster(event);
  const slot = state.slots[drag.index];
  const photo = photoById(slot.photoId);
  if (photo) {
    const frames = framesFor(state.layout, preview.width, preview.height);
    slot.crop = panCrop(slot.crop, frames.panels[drag.index], photo, point.x - drag.x, point.y - drag.y);
    drag.x = point.x;
    drag.y = point.y;
    scheduleDraw();
  }
});

function endDrag() {
  if (!drag) return;
  drag = null;
  preview.classList.remove('dragging');
  syncPanelCard();
}
preview.addEventListener('pointerup', endDrag);
preview.addEventListener('pointercancel', endDrag);
preview.addEventListener('lostpointercapture', endDrag);

preview.addEventListener('wheel', (event) => {
  event.preventDefault();
  const point = toPoster(event);
  const frames = framesFor(state.layout, preview.width, preview.height);
  let index = panelAt(frames.panels, point.x, point.y);
  if (index < 0) index = state.selected;
  const slot = state.slots[index];
  if (!slot.photoId) return;
  slot.crop = zoomCrop(slot.crop, Math.exp(-event.deltaY * 0.0014));
  if (index !== state.selected) selectPanel(index);
  else syncZoom();
  scheduleDraw();
}, { passive: false });

preview.addEventListener('dblclick', () => {
  const slot = state.slots[state.selected];
  slot.crop = defaultCrop();
  syncZoom();
  draw();
});

/* ---------- controls ---------- */

function buildSizeButtons() {
  const host = $('sizes');
  host.textContent = '';
  for (const size of SIZES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'size-btn';
    button.dataset.size = size.id;
    button.setAttribute('aria-pressed', String(state.size === size.id));
    button.innerHTML = `<b>${size.label}</b><span>${size.tag}</span>`;
    button.addEventListener('click', () => setSize(size.id));
    host.append(button);
  }
}

function miniDiagram(layoutId) {
  const mini = document.createElement('span');
  mini.className = 'mini';
  const frames = framesFor(layoutId, 30, 30);
  for (const panel of frames.panels) {
    const cell = document.createElement('i');
    cell.style.left = `${panel.x}px`;
    cell.style.top = `${panel.y}px`;
    cell.style.width = `${Math.max(2, panel.w)}px`;
    cell.style.height = `${Math.max(2, panel.h)}px`;
    mini.append(cell);
  }
  return mini;
}

function buildLayoutButtons() {
  const host = $('layouts');
  host.textContent = '';
  for (const layout of LAYOUTS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'layout-btn';
    button.dataset.layout = layout.id;
    button.setAttribute('aria-pressed', String(state.layout === layout.id));
    const text = document.createElement('span');
    text.className = 'txt';
    text.innerHTML = `<b>${layout.label}</b><small>${layout.hint}</small>`;
    button.append(miniDiagram(layout.id), text);
    button.addEventListener('click', () => setLayout(layout.id));
    host.append(button);
  }
}

function buildGradeButtons() {
  const host = $('grades');
  host.textContent = '';
  for (const grade of Object.values(GRADES)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'grade-btn';
    button.dataset.grade = grade.id;
    button.setAttribute('aria-pressed', String(state.grade === grade.id));
    button.title = grade.hint;
    button.innerHTML = `
      <span class="swatch" style="background:linear-gradient(165deg, ${grade.swatch[0]}, ${grade.swatch[1]} 55%, ${grade.swatch[2]})"></span>
      <b>${grade.label}</b>
      <small>${grade.hint}</small>`;
    button.addEventListener('click', () => setGrade(grade.id));
    host.append(button);
  }
}

function thumbButton(photo, { removable = false } = {}) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'thumb';
  button.dataset.photo = String(photo.id);
  const img = document.createElement('img');
  img.src = photo.thumb;
  img.alt = photo.name;
  button.append(img);
  if (removable) {
    const x = document.createElement('span');
    x.className = 'x';
    x.textContent = '×';
    x.setAttribute('role', 'button');
    x.setAttribute('aria-label', `Remove ${photo.name}`);
    x.addEventListener('click', (event) => {
      event.stopPropagation();
      removePhoto(photo.id);
    });
    button.append(x);
  }
  return button;
}

function renderThumbs() {
  const host = $('thumbs');
  host.textContent = '';
  for (const photo of state.photos) {
    const button = thumbButton(photo, { removable: true });
    button.title = `${photo.name} — click to place in the selected panel`;
    button.addEventListener('click', () => assignPhoto(photo.id));
    host.append(button);
  }
}

function syncPanelCard() {
  const slot = state.slots[state.selected];
  $('panelName').textContent = `${panelLabel(state.layout, state.selected)} · panel ${state.selected + 1}`;
  const host = $('panelPhotos');
  host.textContent = '';
  for (const photo of state.photos) {
    const button = thumbButton(photo);
    button.setAttribute('aria-pressed', String(slot.photoId === photo.id));
    button.title = `Use ${photo.name} in this panel`;
    button.addEventListener('click', () => assignPhoto(photo.id));
    host.append(button);
  }
  syncZoom();
}

function syncZoom() {
  const slot = state.slots[state.selected];
  const zoom = slot.crop.zoom || 1;
  const input = $('zoom');
  input.value = String(zoom);
  $('zoomOut').textContent = `${zoom.toFixed(2)}×`;
}

function syncAll() {
  for (const button of $('sizes').children) {
    button.setAttribute('aria-pressed', String(button.dataset.size === state.size));
  }
  for (const button of $('layouts').children) {
    button.setAttribute('aria-pressed', String(button.dataset.layout === state.layout));
  }
  for (const button of $('grades').children) {
    button.setAttribute('aria-pressed', String(button.dataset.grade === state.grade));
  }
  $('caption').value = state.caption;
  $('edition').value = state.edition;
  renderThumbs();
  syncPanelCard();
  draw();
}

function setStatus(text) {
  $('status').textContent = text;
}

function selectPanel(index) {
  state.selected = Math.max(0, Math.min(activeCount() - 1, index));
  syncPanelCard();
  scheduleDraw();
}

function setLayout(id) {
  state.layout = layoutById(id).id;
  state.selected = Math.min(state.selected, activeCount() - 1);
  fillEmptySlots();
  syncAll();
}

function setGrade(id) {
  state.grade = GRADES[id] ? id : 'sunset';
  syncAll();
}

function setSize(id) {
  state.size = sizeById(id).id;
  for (const button of $('sizes').children) {
    button.setAttribute('aria-pressed', String(button.dataset.size === state.size));
  }
  layoutPreview();
}

function assignPhoto(photoId) {
  const slot = state.slots[state.selected];
  slot.photoId = photoId;
  slot.crop = cropFor(state.selected, photoById(photoId));
  syncPanelCard();
  draw();
}

function removePhoto(photoId) {
  state.photos = state.photos.filter((p) => p.id !== photoId);
  for (const slot of state.slots) {
    if (slot.photoId === photoId) slot.photoId = null;
  }
  fillEmptySlots();
  syncAll();
}

/* ---------- photos ---------- */

async function addFiles(files) {
  if (!files || !files.length) return;
  setStatus('Reading photos…');
  const photos = await readPhotoFiles(files);
  if (!photos.length) {
    setStatus('Those files could not be read as images');
    return;
  }
  state.photos.push(...photos);
  if (photos.length === 1) {
    const slot = state.slots[state.selected];
    slot.photoId = photos[0].id;
    slot.crop = cropFor(state.selected, photos[0]);
  }
  fillEmptySlots();
  syncAll();
  setStatus(`${photos.length} photo${photos.length > 1 ? 's' : ''} loaded`);
}

async function addSample(name) {
  setStatus(`Loading ${name}…`);
  try {
    const photo = await loadSample(name);
    const existing = state.photos.find((p) => p.name === photo.name);
    const chosen = existing ?? photo;
    if (!existing) state.photos.push(photo);
    const slot = state.slots[state.selected];
    slot.photoId = chosen.id;
    slot.crop = cropFor(state.selected, chosen);
    fillEmptySlots();
    syncAll();
    setStatus(`${photo.name} added`);
  } catch {
    setStatus('That sample could not be loaded');
  }
}

/* ---------- export ---------- */

function showExport(png) {
  const host = $('exportPreview');
  host.textContent = '';
  const img = document.createElement('img');
  img.src = png.url;
  img.alt = 'The exported cover';
  host.append(img);
  $('exportMeta').textContent = `${png.width} × ${png.height} PNG · ${formatBytes(png.bytes)}`;
}

async function exportNow({ download = true } = {}) {
  const size = sizeById(state.size);
  setStatus('Rendering PNG…');
  const png = await makePng(modelFor(), size);
  if (lastExport) URL.revokeObjectURL(lastExport.url);
  lastExport = png;
  if (download) downloadUrl(png.url, `vice-cover-${size.w}x${size.h}.png`);
  showExport(png);
  setStatus(`${download ? 'Saved' : 'Rendered'} vice-cover-${size.w}x${size.h}.png · ${formatBytes(png.bytes)}`);
  return png;
}

/* ---------- wiring ---------- */

function wire() {
  $('pickBtn').addEventListener('click', () => $('fileInput').click());
  $('fileInput').addEventListener('change', async (event) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    await addFiles(files);
  });

  const drop = $('drop');
  drop.addEventListener('click', (event) => {
    if (event.target.closest('button')) return;
    $('fileInput').click();
  });
  for (const type of ['dragenter', 'dragover']) {
    drop.addEventListener(type, (event) => {
      event.preventDefault();
      drop.classList.add('over');
    });
  }
  for (const type of ['dragleave', 'drop']) {
    drop.addEventListener(type, (event) => {
      event.preventDefault();
      drop.classList.remove('over');
    });
  }
  drop.addEventListener('drop', (event) => {
    const files = Array.from(event.dataTransfer?.files ?? []).filter((f) => f.type.startsWith('image/'));
    addFiles(files);
  });

  document.addEventListener('dragover', (event) => event.preventDefault());
  document.addEventListener('drop', (event) => {
    if (event.target.closest('#drop')) return;
    event.preventDefault();
    const files = Array.from(event.dataTransfer?.files ?? []).filter((f) => f.type.startsWith('image/'));
    if (files.length) addFiles(files);
  });

  for (const button of document.querySelectorAll('[data-sample]')) {
    button.addEventListener('click', () => addSample(button.dataset.sample));
  }

  $('caption').addEventListener('input', (event) => {
    state.caption = event.target.value;
    scheduleDraw();
  });
  $('edition').addEventListener('input', (event) => {
    state.edition = event.target.value;
    scheduleDraw();
  });

  $('zoom').addEventListener('input', (event) => {
    const slot = state.slots[state.selected];
    slot.crop = { ...slot.crop, zoom: Number(event.target.value) };
    $('zoomOut').textContent = `${slot.crop.zoom.toFixed(2)}×`;
    scheduleDraw();
  });

  $('autoFit').addEventListener('click', () => {
    const slot = state.slots[state.selected];
    slot.crop = defaultCrop();
    syncZoom();
    draw();
  });

  $('exportTop').addEventListener('click', () => exportNow());
  $('exportSide').addEventListener('click', () => exportNow());
  window.addEventListener('resize', layoutPreview);
}

async function loadFonts() {
  try {
    await Promise.all([
      document.fonts.load('700 64px "Liberation Sans"'),
      document.fonts.load('400 16px "Liberation Sans"'),
    ]);
    await document.fonts.ready;
  } catch {
    // The fallback stack is fine if the font refuses to load.
  }
}

export const app = {
  state,
  modelFor,
  draw,
  layoutPreview,
  syncAll,
  syncPanelCard,
  addSample,
  addFiles,
  setLayout,
  setGrade,
  setSize,
  selectPanel,
  exportNow,
  setStatus,
  loadFonts,
};

async function boot() {
  window.__cover = app;
  buildSizeButtons();
  buildLayoutButtons();
  buildGradeButtons();
  wire();
  syncAll();
  layoutPreview();
  await loadFonts();
  draw();

  const params = new URLSearchParams(location.search);
  if (params.get('shot')) {
    await runShot(app, params);
  } else {
    setStatus('Drop a photo to begin');
  }
}

boot();
