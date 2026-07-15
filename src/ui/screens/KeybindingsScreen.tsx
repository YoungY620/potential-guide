import type { GameController } from '../../game/controller';
import { detectConflicts, GLOBAL_ACTION_LABELS, type GlobalAction } from '../../input/keymap';
import { activeDataHotkeys } from '../commandCard';
import { ABILITIES } from '../../game/data/abilities';

export function KeybindingsScreen({
  controller: c,
  onClose,
  rebinder,
  setRebinder
}: {
  controller: GameController;
  onClose: () => void;
  rebinder: ((key: string) => void) | null;
  setRebinder: (fn: ((key: string) => void) | null) => void;
}) {
  const extras = [
    ...activeDataHotkeys(c),
    ...Object.values(ABILITIES).map((a) => ({ name: a.name, key: a.hotkey }))
  ];
  const conflicts = detectConflicts(c.bindings, extras);

  return (
    <div className="screen overlay">
      <div className="dialog panel keybindings">
        <h2>快捷键</h2>
        {conflicts.length > 0 && (
          <div className="conflicts">
            {conflicts.map((cf) => (
              <div key={cf.key} className="conflict">
                冲突 <b>{cf.key}</b>：{cf.actions.join(' / ')}
              </div>
            ))}
          </div>
        )}
        <div className="keys-list">
          {(Object.keys(GLOBAL_ACTION_LABELS) as GlobalAction[]).map((action) => (
            <div className="keyrow" key={action}>
              <span>{GLOBAL_ACTION_LABELS[action]}</span>
              <button
                className={rebinder ? 'listening' : ''}
                onClick={() =>
                  setRebinder(() => (key: string) => {
                    c.updateBinding(action, key);
                  })
                }
              >
                {c.bindings[action] ?? '—'}
              </button>
            </div>
          ))}
          <div className="keyrow fixed">
            <span>编队 1–0（Ctrl 创建 / Shift 追加 / 双击定位）</span>
            <button disabled>数字键</button>
          </div>
        </div>
        <p className="hint">
          {rebinder ? '按下新按键完成绑定，Esc 取消。' : '点击按键按钮后按下新键。数据卡快捷键来自单位/建筑定义，不可在此修改。'}
        </p>
        <div className="menu-buttons">
          <button onClick={() => c.resetBindings()}>恢复默认</button>
          <button className="primary" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
