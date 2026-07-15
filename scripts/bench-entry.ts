// Benchmark entry (bundled by scripts/bench.mjs).
// Scenario: large player army attack-moving into a large enemy force across the
// map — exercises pathing, separation, targeting, projectiles and death churn.
import { createWorld, spawnUnit } from '../src/game/world';
import { step } from '../src/game/sim';

function buildScenario(playerCount: number, enemyCount: number) {
  const w = createWorld(999);
  for (let i = 0; i < playerCount; i++) {
    const def = ['sentinel', 'bulwark', 'arccaster', 'patchwright'][i % 4];
    const u = spawnUnit(w, def, 'player', {
      x: 600 + (i % 20) * 40,
      y: 3400 + Math.floor(i / 20) * 44
    });
    u.orders = [{ type: 'attackMove', targetPos: { x: 3400, y: 600 } }];
  }
  for (let i = 0; i < enemyCount; i++) {
    const def = ['mite', 'spitter', 'leech', 'carrier', 'ravager'][i % 5];
    const u = spawnUnit(w, def, 'enemy', {
      x: 2800 + (i % 20) * 40,
      y: 800 + Math.floor(i / 20) * 44
    });
    u.orders = [{ type: 'attackMove', targetPos: { x: 600, y: 3400 } }];
  }
  return w;
}

function bench(name: string, playerCount: number, enemyCount: number, ticks: number): void {
  const w = buildScenario(playerCount, enemyCount);
  // warmup
  for (let i = 0; i < 100; i++) step(w, []);
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < ticks; i++) step(w, []);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  const perTick = ms / ticks;
  let units = 0;
  for (const e of w.entities.values()) if (e.kind === 'unit') units++;
  console.log(
    `${name}: ${ticks} ticks in ${ms.toFixed(0)}ms → ${perTick.toFixed(3)} ms/tick ` +
      `(≈${(perTick * 20).toFixed(1)}ms sim per second; units left: ${units})`
  );
  if (perTick > 8) {
    console.error(`FAIL: ${name} exceeds 8ms/tick budget`);
    process.exitCode = 1;
  }
}

bench('100 units (50v50)', 50, 50, 2000);
bench('200 units (100v100)', 100, 100, 2000);

// soak: 24000 ticks (20 min game time) with continuous combat; watch heap
{
  const w = buildScenario(60, 80);
  const mem0 = process.memoryUsage().heapUsed;
  for (let i = 0; i < 24000; i++) {
    step(w, []);
    // keep the fight going: reinforce both sides every 30s
    if (i % 600 === 599) {
      for (let k = 0; k < 10; k++) {
        const a = spawnUnit(w, 'sentinel', 'player', { x: 700 + k * 30, y: 3300 });
        a.orders = [{ type: 'attackMove', targetPos: { x: 3200, y: 800 } }];
        const b = spawnUnit(w, 'mite', 'enemy', { x: 3000 + k * 30, y: 900 });
        b.orders = [{ type: 'attackMove', targetPos: { x: 700, y: 3300 } }];
      }
    }
    if (i % 4000 === 3999) global.gc?.();
  }
  const mem1 = process.memoryUsage().heapUsed;
  const delta = (mem1 - mem0) / 1048576;
  console.log(`soak (24000 ticks): heap Δ = ${delta.toFixed(1)} MB`);
  if (delta > 50) {
    console.error('FAIL: heap grew more than 50MB during soak');
    process.exitCode = 1;
  }
}
console.log('bench OK');
