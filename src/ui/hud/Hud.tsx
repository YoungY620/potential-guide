import type { RefObject } from 'react';
import type { GameController } from '../../game/controller';
import type { Building, Unit } from '../../game/types';
import { unitDef } from '../../game/data/units';
import { buildingDef } from '../../game/data/buildings';
import { ABILITIES } from '../../game/data/abilities';
import { validateCast } from '../../game/commands';
import { buildCommandCard } from '../commandCard';
import { paletteFor } from '../palette';
import { Icon } from '../Icon';
import { MinimapPanel } from './MinimapPanel';

function fmtTime(tick: number): string {
  const s = Math.floor(tick / 20);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

const THREAT_LABELS = ['平静', '低威胁', '威胁逼近', '高危', '灭顶之灾'];

export function Hud({
  controller: c,
  minimapCanvasRef,
  onOpenSettings,
  onOpenKeys
}: {
  controller: GameController;
  minimapCanvasRef: RefObject<HTMLCanvasElement | null>;
  onOpenSettings: () => void;
  onOpenKeys: () => void;
}) {
  const world = c.world;
  const ps = world.players.player;
  const pal = paletteFor(c.settings.colorblind);
  const scale = c.settings.uiScale;
  const card = buildCommandCard(c);
  const threat = world.threatLevel;
  const invalidFresh = c.lastInvalidReason && performance.now() - c.lastInvalidAt < 2200;

  return (
    <div className="hud" style={{ fontSize: `${13 * scale}px` }}>
      {/* top bar */}
      <div className="topbar panel">
        <span className="res" title="数据晶片">
          <Icon id="res:shards" size={16 * scale} /> {Math.floor(ps.resources.shards)}
        </span>
        <span className="res" title="流能">
          <Icon id="res:flux" size={16 * scale} /> {Math.floor(ps.resources.flux)}
        </span>
        <span className="res" title="机体容量">
          <Icon id="supply" size={16 * scale} /> {ps.supplyUsed}/{ps.supplyCap}
          {ps.supplyUsed >= ps.supplyCap && <em className="warn">（已满）</em>}
        </span>
        <span className="threat" title="威胁等级">
          威胁：
          <b style={{ color: threat >= 3 ? pal.hpBad : threat >= 2 ? pal.hpWarn : pal.hpGood }}>
            {THREAT_LABELS[threat]}
          </b>
          {world.nextWaveEta !== Infinity && (
            <span className="eta">下一波 {Math.ceil(world.nextWaveEta / 20)}s</span>
          )}
        </span>
        <span className="gametime">{fmtTime(world.tick)}</span>
        <span className="fps">{Math.round(c.fps)} FPS</span>
        <span className="topbtns">
          <button onClick={() => c.setPaused(!c.paused)}>{c.paused ? '继续' : '暂停'}</button>
          <button onClick={() => c.setPaused(true)}>菜单</button>
          <button onClick={onOpenSettings} title="设置">设</button>
          <button onClick={onOpenKeys} title="快捷键">键</button>
        </span>
      </div>

      {/* alerts */}
      <div className="alerts">
        {world.alerts.slice(-4).map((a) => (
          <div
            key={a.id}
            className={`alert alert-${a.kind}`}
            onClick={() => {
              c.camera.x = a.pos.x;
              c.camera.y = a.pos.y;
            }}
          >
            {a.message}
          </div>
        ))}
      </div>

      {invalidFresh && <div className="invalid-toast">{c.lastInvalidReason}</div>}

      {/* bottom panel */}
      <div className="bottombar">
        <MinimapPanel controller={c} canvasRef={minimapCanvasRef} />
        <SelectionPanel controller={c} />
        <div className="commandcard panel">
          {card.length === 0 && <div className="card-hint">选择单位或建筑以查看命令</div>}
          {card.map((b) => (
            <button
              key={b.id}
              className={`cardbtn ${b.disabled ? 'disabled' : ''}`}
              title={b.disabled ? `${b.label}：${b.reason}` : `${b.label}${b.hotkey ? ` (${b.hotkey})` : ''}`}
              onClick={() => {
                if (b.disabled) {
                  c.flagInvalid(b.reason ?? '不可用');
                  return;
                }
                b.onClick();
              }}
            >
              <Icon id={b.icon} size={26 * scale} />
              <span className="card-label">{b.label}</span>
              {b.hotkey && <span className="card-key">{b.hotkey}</span>}
              {b.count !== undefined && <span className="card-count">{b.count}</span>}
              {b.progress !== undefined && (
                <span className="card-progress">
                  <i style={{ width: `${Math.round(b.progress * 100)}%` }} />
                </span>
              )}
            </button>
          ))}
        </div>
        <AbilityPanel controller={c} />
      </div>
    </div>
  );
}

function AbilityPanel({ controller: c }: { controller: GameController }) {
  return (
    <div className="abilitypanel panel">
      <div className="ability-title">战术技能</div>
      {Object.values(ABILITIES).map((ab) => {
        const cd = c.world.abilityCooldowns[ab.id] ?? 0;
        const frac = cd > 0 ? cd / ab.cooldown : 0;
        const probe = validateCast(c.world, ab.id, { x: 0, y: 0 });
        const disabled = cd > 0 || (!probe.ok && !probe.reason.includes('视野'));
        const reason = cd > 0 ? '冷却中' : !probe.ok && !probe.reason.includes('视野') ? probe.reason : undefined;
        return (
          <button
            key={ab.id}
            className={`cardbtn ability ${disabled ? 'disabled' : ''}`}
            title={`${ab.name} (${ab.hotkey})：${ab.desc} 花费 ${ab.cost.flux} 流能${reason ? ` — ${reason}` : ''}`}
            onClick={() => {
              if (disabled) {
                c.flagInvalid(reason ?? '不可用');
                return;
              }
              c.pendingAction = { kind: 'ability', abilityId: ab.id };
            }}
          >
            <Icon id={'ability:' + ab.id} size={26} />
            <span className="card-label">{ab.name}</span>
            <span className="card-key">{ab.hotkey}</span>
            {frac > 0 && (
              <span className="card-progress cooldown">
                <i style={{ width: `${Math.round(frac * 100)}%` }} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function SelectionPanel({ controller: c }: { controller: GameController }) {
  const sel = c.selection
    .map((id) => c.world.entities.get(id))
    .filter((e): e is Unit | Building => !!e && (e.kind === 'unit' || e.kind === 'building'));
  if (sel.length === 0) {
    return (
      <div className="selection panel">
        <div className="card-hint">左键选择 · 拖框多选 · 右键下达命令</div>
      </div>
    );
  }
  if (sel.length === 1) {
    const e = sel[0];
    const name = e.kind === 'unit' ? unitDef(e.defId).name : buildingDef(e.defId).name;
    const desc = e.kind === 'unit' ? unitDef(e.defId).desc : buildingDef(e.defId).desc;
    const icon = e.kind === 'unit' ? 'u:' + e.defId : 'b:' + e.defId;
    const atk = e.kind === 'unit' ? unitDef(e.defId).attack : buildingDef(e.defId).attack;
    return (
      <div className="selection panel">
        <div className="sel-head">
          <Icon id={icon} size={34} />
          <div>
            <div className="sel-name">{name}</div>
            <div className="sel-hp">
              <span className="hpbar">
                <i style={{ width: `${Math.round((e.hp / e.maxHp) * 100)}%` }} />
              </span>
              {Math.ceil(e.hp)}/{e.maxHp}
            </div>
          </div>
        </div>
        <div className="sel-desc">{desc}</div>
        {atk && (
          <div className="sel-stats">
            攻击 {atk.damage} · 射程 {Math.round(atk.range)} · 间隔 {(atk.cooldown / 20).toFixed(1)}s
          </div>
        )}
        {e.kind === 'unit' && (e.cargoShards > 0 || e.cargoFlux > 0) && (
          <div className="sel-stats">
            载运：晶片 {e.cargoShards} 流能 {e.cargoFlux}
          </div>
        )}
        {e.kind === 'building' && e.productionQueue.length > 0 && (
          <div className="sel-queue">
            {e.productionQueue.map((p, i) => (
              <span key={i} className="queue-chip" onClick={() => c.cmd({ type: 'cancelTrain', buildingId: e.id, index: i })} title="点击取消（返还剩余资源）">
                {unitDef(p.defId).name}
                {i === 0 && <i className="qprog"><i style={{ width: `${100 - Math.round((p.remaining / p.total) * 100)}%` }} /></i>}
                ✕
              </span>
            ))}
          </div>
        )}
        {e.kind === 'building' && e.research && (
          <div className="sel-stats">
            研究中：{Math.round((1 - e.research.remaining / e.research.total) * 100)}%
          </div>
        )}
      </div>
    );
  }
  // multi-select cards
  return (
    <div className="selection panel multi">
      {sel.slice(0, 24).map((e) => {
        const icon = e.kind === 'unit' ? 'u:' + e.defId : 'b:' + e.defId;
        const name = e.kind === 'unit' ? unitDef(e.defId).name : buildingDef(e.defId).name;
        return (
          <div
            key={e.id}
            className="multibox"
            title={name}
            onClick={() => {
              c.selection = [e.id];
            }}
          >
            <Icon id={icon} size={24} />
            <span className="hpbar small">
              <i style={{ width: `${Math.round((e.hp / e.maxHp) * 100)}%` }} />
            </span>
          </div>
        );
      })}
      {sel.length > 24 && <div className="multimore">+{sel.length - 24}</div>}
    </div>
  );
}
