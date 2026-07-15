import { useEffect } from 'react';
import type { GameController } from '../../game/controller';
import { audio } from '../../audio/audio';

export function EndScreen({ controller: c }: { controller: GameController }) {
  const victory = c.screen === 'victory';
  useEffect(() => {
    audio.play(victory ? 'victory' : 'defeat');
  }, [victory]);
  const t = Math.floor(c.world.tick / 20);
  return (
    <div className="screen overlay">
      <div className={`dialog panel ${victory ? 'win' : 'lose'}`}>
        <h2>{victory ? '胜利' : '战败'}</h2>
        <p>{victory ? '入侵核心已被摧毁，网络安全无虞。' : '核心主堡已被吞噬，网络沦陷。'}</p>
        <p className="endstats">
          对局时长 {String(Math.floor(t / 60)).padStart(2, '0')}:{String(t % 60).padStart(2, '0')} · 种子{' '}
          {c.world.seed}
        </p>
        <div className="menu-buttons">
          <button className="primary" onClick={() => c.restart()}>
            再来一局（同种子）
          </button>
          <button onClick={() => c.startGame()}>新的一局</button>
          <button onClick={() => c.toMainMenu()}>返回主菜单</button>
        </div>
      </div>
    </div>
  );
}
