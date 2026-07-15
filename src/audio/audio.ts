// Procedural WebAudio sound synthesis — no external audio assets.
// Every sound is synthesized from oscillators/noise at runtime.

export type SoundId =
  | 'select'
  | 'move'
  | 'attack'
  | 'build'
  | 'buildComplete'
  | 'trainComplete'
  | 'upgrade'
  | 'alert'
  | 'error'
  | 'shot'
  | 'explosion'
  | 'harvest'
  | 'victory'
  | 'defeat'
  | 'click';

export class AudioSystem {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfx: GainNode | null = null;
  private lastPlayed = new Map<SoundId, number>();
  private musicOsc: OscillatorNode | null = null;
  private musicGain: GainNode | null = null;
  private volumes = { master: 0.8, sfx: 0.9, music: 0.5 };

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.sfx = this.ctx.createGain();
      this.sfx.connect(this.master);
      this.applyVolumes();
    } catch {
      return null;
    }
    return this.ctx;
  }

  resume(): void {
    const ctx = this.ensure();
    if (ctx && ctx.state === 'suspended') void ctx.resume();
  }

  setVolumes(master: number, sfx: number, music: number): void {
    this.volumes = { master, sfx, music };
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx || !this.master || !this.sfx) return;
    this.master.gain.value = this.volumes.master;
    this.sfx.gain.value = this.volumes.sfx;
    if (this.musicGain) this.musicGain.gain.value = this.volumes.music * 0.3;
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    gain: number,
    sweepTo?: number,
    delay = 0
  ): void {
    const ctx = this.ensure();
    if (!ctx || !this.sfx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (sweepTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, sweepTo), t0 + dur);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g);
    g.connect(this.sfx);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  private noise(dur: number, gain: number, filterFreq: number, delay = 0): void {
    const ctx = this.ensure();
    if (!ctx || !this.sfx) return;
    const t0 = ctx.currentTime + delay;
    const len = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let seed = 22222;
    for (let i = 0; i < len; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      data[i] = (seed / 0x3fffffff - 1) * (1 - i / len);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfx);
    src.start(t0);
  }

  // rate-limit spammy sounds
  play(id: SoundId, minGapMs = 60): void {
    const now = performance.now();
    const last = this.lastPlayed.get(id) ?? -Infinity;
    if (now - last < minGapMs) return;
    this.lastPlayed.set(id, now);
    switch (id) {
      case 'select':
        this.tone(880, 0.06, 'sine', 0.12, 660);
        break;
      case 'move':
        this.tone(520, 0.07, 'sine', 0.1, 700);
        break;
      case 'attack':
        this.tone(300, 0.09, 'sawtooth', 0.1, 180);
        break;
      case 'build':
        this.tone(440, 0.08, 'square', 0.08, 520);
        this.noise(0.1, 0.05, 2000);
        break;
      case 'buildComplete':
        this.tone(520, 0.12, 'sine', 0.12, 780);
        this.tone(780, 0.16, 'sine', 0.1, 1040, 0.08);
        break;
      case 'trainComplete':
        this.tone(660, 0.1, 'sine', 0.1, 880);
        break;
      case 'upgrade':
        this.tone(440, 0.1, 'sine', 0.1, 660);
        this.tone(660, 0.1, 'sine', 0.1, 880, 0.07);
        this.tone(880, 0.14, 'sine', 0.1, 1100, 0.14);
        break;
      case 'alert':
        this.tone(980, 0.1, 'square', 0.07, 980);
        this.tone(980, 0.1, 'square', 0.07, 980, 0.14);
        break;
      case 'error':
        this.tone(220, 0.12, 'square', 0.08, 160);
        break;
      case 'shot':
        this.noise(0.06, 0.06, 4000);
        break;
      case 'explosion':
        this.noise(0.35, 0.16, 900);
        this.tone(120, 0.3, 'sine', 0.14, 40);
        break;
      case 'harvest':
        this.tone(1200, 0.04, 'sine', 0.05, 900);
        break;
      case 'victory':
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.25, 'sine', 0.12, f, i * 0.15));
        break;
      case 'defeat':
        [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.3, 'sawtooth', 0.08, f * 0.9, i * 0.2));
        break;
      case 'click':
        this.tone(700, 0.03, 'sine', 0.06);
        break;
    }
  }

  startMusic(): void {
    const ctx = this.ensure();
    if (!ctx || this.musicOsc) return;
    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = this.volumes.music * 0.3;
    this.musicGain.connect(ctx.destination);
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 55;
    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.value = 110.3;
    const g2 = ctx.createGain();
    g2.gain.value = 0.4;
    osc.connect(this.musicGain);
    osc2.connect(g2);
    g2.connect(this.musicGain);
    osc.start();
    osc2.start();
    this.musicOsc = osc;
    this.musicOsc2 = osc2;
  }

  private musicOsc2: OscillatorNode | null = null;

  stopMusic(): void {
    for (const osc of [this.musicOsc, this.musicOsc2]) {
      if (osc) {
        try {
          osc.stop();
        } catch {
          /* already stopped */
        }
      }
    }
    this.musicOsc = null;
    this.musicOsc2 = null;
  }
}

export const audio = new AudioSystem();
