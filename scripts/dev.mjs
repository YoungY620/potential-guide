// Dev launcher: vite dev server + esbuild electron main + electron process.
import { spawn } from 'node:child_process';
import { build } from 'esbuild';
import http from 'node:http';

const PORT = 5173;
const DEV_URL = `http://localhost:${PORT}`;

function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) reject(new Error('vite dev server timeout'));
        else setTimeout(tryOnce, 200);
      });
    };
    tryOnce();
  });
}

await build({
  entryPoints: ['electron/main.ts', 'electron/preload.ts'],
  outdir: 'dist-electron',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['electron'],
  sourcemap: true
});

const vite = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { stdio: 'inherit' });
await waitForServer(DEV_URL);

const electron = spawn('npx', ['electron', '.'], {
  stdio: 'inherit',
  env: { ...process.env, VITE_DEV_SERVER_URL: DEV_URL }
});

electron.on('close', () => {
  vite.kill();
  process.exit(0);
});
