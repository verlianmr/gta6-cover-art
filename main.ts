// Hand-in program for gta6-cover-art-01 (Vice Cover Studio), Node 22, standard library only.
//
// What it hands in: this repository's app/ (a static, offline desktop-browser app: index.html plus its ES
// modules, styles, fonts and sample photos — no network requests, no build step) and screenshots/ (four
// rendered covers, the first by name the cover), copied into the output directory, together with
// dossier.json — the make.fun dossier the judge reads, produced by the vendored library from exactly what
// was copied.
//
// Where it writes: /output by default; set MAKEFUN_OUTPUT_DIR to build anywhere else:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// To try the app locally, serve app/ with `node serve.ts` and open http://localhost:8080.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

/** The directory this program reads app/ and screenshots/ from: this file's own directory. */
const here = fileURLToPath(new URL('.', import.meta.url));

/**
 * The caps the bounty's scorer applies (reference/gate.json), passed through unchanged. Only
 * text_max_bytes shapes the dossier's bytes; the rest only refuse — an app/ with too many entries or
 * bytes or too long a path, screenshots/ with more than four images or one over 256 KiB — so passing
 * them makes this program fail where the scorer would, rather than hand in something it rejects.
 */
const SCORER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

/** The output directory: MAKEFUN_OUTPUT_DIR when set, else the grader's /output. Created if missing. */
function resolveOutputDir(): string {
  const dir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Copy the app itself (app/) into the output directory, as static files the browser loads offline. */
function copyApp(outDir: string): void {
  cpSync(join(here, 'app'), join(outDir, 'app'), { recursive: true });
}

/**
 * Copy the screenshots into the output directory. The directory is always created; the copy happens only
 * when this repository has screenshots/ to copy.
 */
function copyScreenshots(outDir: string): void {
  const from = join(here, 'screenshots');
  const to = join(outDir, 'screenshots');
  mkdirSync(to, { recursive: true });
  if (existsSync(from)) cpSync(from, to, { recursive: true });
}

/** Write dossier.json: the vendored library's summary of what was just copied, under the scorer's caps. */
function writeDossier(outDir: string): void {
  const dossier = buildDossier(outDir, SCORER_CAPS);
  writeFileSync(join(outDir, 'dossier.json'), dossier);
}

const outDir = resolveOutputDir();
copyApp(outDir);
copyScreenshots(outDir);
writeDossier(outDir);
