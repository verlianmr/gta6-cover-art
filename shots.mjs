// Captures screenshots/ from the app's deterministic shot scenes (see shots.json).
// For each shot: headless Chrome renders the scene, the window is cropped to the viewport
// (headless Chrome adds 87 px of window chrome above the page) and the PNG is re-encoded as a
// JPEG under the competition's 256 KiB cap. Run: node shots.mjs [--port 8099]
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, readFileSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const shots = JSON.parse(readFileSync(join(here, 'shots.json'), 'utf8'));
const portIndex = process.argv.indexOf('--port');
const port = portIndex === -1 ? 8099 : Number(process.argv[portIndex + 1]);
const WINDOW_CHROME_PX = 87; // headless Chrome's window chrome at scale factor 1
const CAP = 256 * 1024;

mkdirSync(join(here, 'screenshots'), { recursive: true });

const server = spawn(process.execPath, [join(here, 'serve.ts'), '--port', String(port)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));

for (const shot of shots) {
  const { w, h } = shot.viewport;
  const url = `http://localhost:${port}/${shot.query}`;
  const png = `/tmp/shot-${shot.name}.png`;
  execFileSync('google-chrome', [
    '--headless',
    '--no-sandbox',
    '--disable-gpu',
    `--window-size=${w},${h + WINDOW_CHROME_PX}`,
    '--virtual-time-budget=8000',
    '--hide-scrollbars',
    `--screenshot=${png}`,
    url,
  ], { stdio: 'ignore' });

  const jpg = join(here, 'screenshots', shot.name);
  let quality = 90;
  for (;;) {
    execFileSync('convert', [
      png, '-crop', `${w}x${h}+0+0`, '+repage',
      '-quality', String(quality), '-sampling-factor', '4:2:0', jpg,
    ]);
    const size = statSync(jpg).size;
    if (size <= CAP || quality <= 55) {
      console.log(`${shot.name}: ${w}x${h} q${quality} ${(size / 1024).toFixed(0)} KB`);
      break;
    }
    quality -= 5;
  }
  unlinkSync(png);
}

server.kill('SIGTERM');
