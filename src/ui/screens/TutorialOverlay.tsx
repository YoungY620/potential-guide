import type { GameController } from '../../game/controller';

export const TUTORIAL_SEED = 20240701;

interface Step {
  text: string;
  done: (c: GameController) => boolean;
  hint?: string;
}

const STEPS: Step[] = [
  {
    text: '左键点击一名「接续者」，或拖框选中全部接续者',
    done: (c) => c.selection.length > 0,
    hint: '也可以双击一名接续者选中屏幕内所有同类'
  },
  {
    text: '右键点击蓝色的「数据晶片」开始采集',
    done: (c) => {
      for (const id of c.selection) {
        const e = c.world.entities.get(id);
        if (e?.kind === 'unit' && e.orders.some((o) => o.type === 'harvest')) return true;
      }
      for (const e of c.world.entities.values()) {
        if (e.kind === 'unit' && e.team === 'player' && e.orders.some((o) => o.type === 'harvest')) return true;
      }
      return false;
    }
  },
  {
    text: '选中主堡，按 S 或点击「接续者」训练一名新工人',
    done: (c) => {
      let workers = 0;
      for (const e of c.world.entities.values()) {
        if (e.kind === 'unit' && e.team === 'player' && e.defId === 'splicer') workers++;
      }
      return workers >= 7;
    }
  },
  {
    text: '选中工人，按 F 进入放置模式，左键放下「制造厂」',
    done: (c) => {
      for (const e of c.world.entities.values()) {
        if (e.kind === 'building' && e.defId === 'fabricator') return true;
      }
      return false;
    }
  },
  {
    text: '制造厂完工后，训练 2 名「哨卫」（选中制造厂按 A）',
    done: (c) => {
      let n = 0;
      for (const e of c.world.entities.values()) {
        if (e.kind === 'unit' && e.team === 'player' && e.defId === 'sentinel') n++;
      }
      return n >= 2;
    }
  },
  {
    text: '选中哨卫，按 A 再左键点击地图中央进行「攻击移动」',
    done: (c) => {
      for (const e of c.world.entities.values()) {
        if (e.kind === 'unit' && e.team === 'player' && e.defId === 'sentinel' && e.orders.some((o) => o.type === 'attackMove')) return true;
      }
      return false;
    }
  },
  {
    text: '按住 Ctrl+1 将部队编为 1 队；空格键可跳转最新警报',
    done: (c) => (c.controlGroups.get(0)?.length ?? 0) > 0
  },
  {
    text: '准备迎敌：第一波入侵将在 1 分钟后自北路或南路抵达。祝好运！',
    done: (c) => c.world.tick > 20 * 55 || c.world.alerts.some((a) => a.kind === 'wave')
  }
];

export function TutorialOverlay({ controller: c }: { controller: GameController }) {
  const idx = STEPS.findIndex((s) => !s.done(c));
  const finished = idx === -1;
  return (
    <div className="tutorial panel">
      <h3>教学</h3>
      <ol>
        {STEPS.map((s, i) => {
          const state = finished || i < idx ? 'done' : i === idx ? 'active' : 'todo';
          return (
            <li key={i} className={state}>
              {s.text}
              {state === 'active' && s.hint && <em>{s.hint}</em>}
            </li>
          );
        })}
      </ol>
      {finished && (
        <div className="menu-buttons">
          <button className="primary" onClick={() => c.startGame()}>
            开始正式对局
          </button>
          <button onClick={() => c.toMainMenu()}>返回主菜单</button>
        </div>
      )}
      {!finished && (
        <button className="tutorial-skip" onClick={() => c.toMainMenu()}>
          跳过教学
        </button>
      )}
    </div>
  );
}
