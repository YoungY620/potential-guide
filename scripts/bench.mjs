// Headless performance benchmark: sim cost per tick with heavy combat,
// plus a long soak run to detect memory leaks in the simulation.
import { build } from 'esbuild';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const outfile = join(mkdtempSync(join(tmpdir(), 'aidrts-bench-')), 'bench.mjs');
await build({
  entryPoints: ['scripts/bench-entry.ts'],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  sourcemap: false
});
await import(pathToFileURL(outfile).href);
writeFileSync('/dev/null', '');
