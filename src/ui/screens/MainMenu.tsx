import type { GameController } from '../../game/controller';
import { audio } from '../../audio/audio';

export function MainMenu({
  controller: c,
  onOpenSettings,
  onOpenKeys
}: {
  controller: GameController;
  onOpenSettings: () => void;
  onOpenKeys: () => void;
}) {
  return (
    <div className="screen mainmenu">
      <div className="title-block">
        <h1>AI DEFENSE RTS</h1>
        <p className="subtitle">守望机群 · 网络防线</p>
        <p className="tagline">指挥防御型 AI 机体，抵御自适应入侵体对网络的吞噬。</p>
      </div>
      <div className="menu-buttons">
        <button
          className="primary"
          onClick={() => {
            audio.resume();
            audio.startMusic();
            c.startGame();
          }}
        >
          开始游戏
        </button>
        <button
          onClick={() => {
            audio.resume();
            c.startGame(20240701);
            c.screen = 'tutorial';
          }}
        >
          教学
        </button>
        <button onClick={onOpenSettings}>设置</button>
        <button onClick={onOpenKeys}>快捷键</button>
      </div>
      <div className="menu-footer">
        <p>左键选择 / 右键命令 · A 攻击移动 · Shift 追加命令 · Ctrl+数字 编队</p>
        <p>完全离线 · 原创美术与音效</p>
      </div>
    </div>
  );
}
