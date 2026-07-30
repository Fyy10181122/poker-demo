/** audio.js —— WebAudio 合成音效（无外部素材） */
const SFX = {
  ctx: null,
  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },
  beep(freq, dur, type, vol, when) {
    this.ensure();
    if (!this.ctx) return;
    const t = this.ctx.currentTime + (when || 0);
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol || 0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + dur);
  },
  click() { this.beep(600, 0.06, 'square', 0.05); },
  deal()  { this.beep(880, 0.05, 'triangle', 0.06); this.beep(1100, 0.05, 'triangle', 0.06, 0.07); },
  chip()  { this.beep(1500, 0.04, 'sine', 0.07); this.beep(1800, 0.05, 'sine', 0.06, 0.05); },
  fold()  { this.beep(300, 0.15, 'sawtooth', 0.04); },
  win()   { [523, 659, 784, 1047].forEach((f, i) => this.beep(f, 0.15, 'square', 0.06, i * 0.12)); },
  lose()  { [400, 350, 300].forEach((f, i) => this.beep(f, 0.18, 'sawtooth', 0.04, i * 0.15)); }
};
// 首次触摸解锁音频（移动端要求）
window.addEventListener('pointerdown', () => SFX.ensure(), { once: true });
