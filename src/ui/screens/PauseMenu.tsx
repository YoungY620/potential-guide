import type { GameController } from '../../game/controller';

export function PauseMenu({
  controller: c,
  onOpenSettings,
  onOpenKeys,
  onClose
}: {
  controller: GameController;
  onOpenSettings: () => void;
  onOpenKeys: () => void;
  onClose: () => void;
}) {
  return (
    <div className="screen overlay">
      <div className="dialog panel">
        <h2>已暂停</h2>
        <div className="menu-buttons">
          <button className="primary" onClick={onClose}>
            继续游戏
          </button>
          <button
            onClick={() => {
              if (window.confirm('确定要重新开始本局吗？')) c.restart();
            }}
          >
            重新开始
          </button>
          <button onClick={onOpenSettings}>设置</button>
          <button onClick={onOpenKeys}>快捷键</button>
          <button
            onClick={() => {
              if (window.confirm('放弃当前对局并返回主菜单？')) c.toMainMenu();
            }}
          >
            返回主菜单
          </button>
        </div>
      </div>
    </div>
  );
}
