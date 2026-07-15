import type { GameController } from '../../game/controller';
import { audio } from '../../audio/audio';

export function SettingsScreen({
  controller: c,
  onClose
}: {
  controller: GameController;
  onClose: () => void;
}) {
  const s = c.settings;
  return (
    <div className="screen overlay">
      <div className="dialog panel settings">
        <h2>设置</h2>
        <label className="row">
          主音量
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(s.masterVolume * 100)}
            onChange={(e) => {
              c.updateSettings({ masterVolume: Number(e.target.value) / 100 });
              audio.setVolumes(c.settings.masterVolume, c.settings.sfxVolume, c.settings.musicVolume);
            }}
          />
        </label>
        <label className="row">
          音效音量
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(s.sfxVolume * 100)}
            onChange={(e) => {
              c.updateSettings({ sfxVolume: Number(e.target.value) / 100 });
              audio.setVolumes(c.settings.masterVolume, c.settings.sfxVolume, c.settings.musicVolume);
              audio.play('click');
            }}
          />
        </label>
        <label className="row">
          音乐音量
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(s.musicVolume * 100)}
            onChange={(e) => {
              c.updateSettings({ musicVolume: Number(e.target.value) / 100 });
              audio.setVolumes(c.settings.masterVolume, c.settings.sfxVolume, c.settings.musicVolume);
            }}
          />
        </label>
        <label className="row">
          UI 缩放
          <input
            type="range"
            min={80}
            max={140}
            value={Math.round(s.uiScale * 100)}
            onChange={(e) => c.updateSettings({ uiScale: Number(e.target.value) / 100 })}
          />
        </label>
        <label className="row">
          色觉方案
          <select
            value={s.colorblind}
            onChange={(e) => c.updateSettings({ colorblind: e.target.value as typeof s.colorblind })}
          >
            <option value="none">默认</option>
            <option value="deuteranopia">绿色弱（Deuteranopia）</option>
            <option value="protanopia">红色弱（Protanopia）</option>
            <option value="tritanopia">蓝色弱（Tritanopia）</option>
          </select>
        </label>
        <label className="row check">
          <input
            type="checkbox"
            checked={s.edgeScroll}
            onChange={(e) => c.updateSettings({ edgeScroll: e.target.checked })}
          />
          边缘滚屏
        </label>
        <label className="row check">
          <input
            type="checkbox"
            checked={s.reduceShake}
            onChange={(e) => c.updateSettings({ reduceShake: e.target.checked })}
          />
          减少屏幕震动
        </label>
        <div className="menu-buttons">
          <button className="primary" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
