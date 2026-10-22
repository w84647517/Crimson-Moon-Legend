import { U } from './util.js';

// 纯 WebAudio 合成音效，无外部音频资源
export const AUDIO = {
  ac: null,
  master: null,
  enabled: true,
  ready: false,

  init() {
    if (this.ac) {
      if (this.ac.state === 'suspended') this.ac.resume().catch(() => {});
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ac = new AC();
      this.master = this.ac.createGain();
      this.master.gain.value = 0.32;
      this.master.connect(this.ac.destination);
      this.ready = true;
    } catch (e) {
      this.ready = false;
    }
  },

  resume() {
    if (this.ac && this.ac.state === 'suspended') this.ac.resume().catch(() => {});
  },

  setEnabled(on) {
    this.enabled = !!on;
    if (this.master) this.master.gain.value = on ? 0.32 : 0;
  },

  tone({ freq = 440, freq2 = null, type = 'sine', dur = 0.15, gain = 0.2, attack = 0.005, delay = 0, curve = 'exp' }) {
    if (!this.ready || !this.enabled) return;
    const ac = this.ac;
    const t0 = ac.currentTime + delay;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freq2 != null) {
      if (curve === 'exp') osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq2), t0 + dur);
      else osc.frequency.linearRampToValueAtTime(Math.max(20, freq2), t0 + dur);
    }
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  },

  noise({ dur = 0.12, gain = 0.15, freq = 1200, q = 1, type = 'lowpass', delay = 0 }) {
    if (!this.ready || !this.enabled) return;
    const ac = this.ac;
    const t0 = ac.currentTime + delay;
    const len = Math.max(1, Math.floor(ac.sampleRate * dur));
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource();
    src.buffer = buf;
    const filter = ac.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const g = ac.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter).connect(g).connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  },

  play(name) {
    if (!this.ready || !this.enabled) return;
    switch (name) {
      case 'hit':
        this.tone({ freq: 220, freq2: 90, type: 'square', dur: 0.08, gain: 0.12 });
        this.noise({ dur: 0.06, gain: 0.1, freq: 2200 });
        break;
      case 'crit':
        this.tone({ freq: 330, freq2: 110, type: 'sawtooth', dur: 0.16, gain: 0.2 });
        this.noise({ dur: 0.12, gain: 0.16, freq: 3200 });
        break;
      case 'hurt':
        this.tone({ freq: 110, freq2: 60, type: 'sine', dur: 0.2, gain: 0.22 });
        this.noise({ dur: 0.1, gain: 0.08, freq: 700 });
        break;
      case 'kill':
        this.tone({ freq: 180, freq2: 50, type: 'triangle', dur: 0.22, gain: 0.16 });
        this.noise({ dur: 0.18, gain: 0.1, freq: 900 });
        break;
      case 'pickup':
        this.tone({ freq: 720, type: 'sine', dur: 0.08, gain: 0.12 });
        this.tone({ freq: 1080, type: 'sine', dur: 0.1, gain: 0.1, delay: 0.05 });
        break;
      case 'coin':
        this.tone({ freq: 980, type: 'square', dur: 0.05, gain: 0.07 });
        this.tone({ freq: 1320, type: 'square', dur: 0.08, gain: 0.06, delay: 0.035 });
        break;
      case 'level':
        [523, 659, 784, 1046].forEach((f, i) => {
          this.tone({ freq: f, type: 'triangle', dur: 0.24, gain: 0.14, delay: i * 0.09 });
        });
        this.noise({ dur: 0.5, gain: 0.05, freq: 4000, type: 'highpass' });
        break;
      case 'skill':
        this.noise({ dur: 0.18, gain: 0.13, freq: 1800 });
        this.tone({ freq: 420, freq2: 180, type: 'sawtooth', dur: 0.2, gain: 0.1 });
        break;
      case 'fire':
        this.noise({ dur: 0.28, gain: 0.16, freq: 900 });
        this.tone({ freq: 160, freq2: 60, type: 'sawtooth', dur: 0.25, gain: 0.08 });
        break;
      case 'ice':
        this.tone({ freq: 1400, freq2: 2400, type: 'sine', dur: 0.22, gain: 0.08 });
        this.noise({ dur: 0.22, gain: 0.06, freq: 5000, type: 'highpass' });
        break;
      case 'heal':
        this.tone({ freq: 520, freq2: 880, type: 'sine', dur: 0.4, gain: 0.1 });
        break;
      case 'ui':
        this.tone({ freq: 520, type: 'square', dur: 0.05, gain: 0.05 });
        break;
      case 'upgrade':
        this.tone({ freq: 660, type: 'triangle', dur: 0.1, gain: 0.12 });
        this.tone({ freq: 880, type: 'triangle', dur: 0.16, gain: 0.12, delay: 0.07 });
        this.noise({ dur: 0.2, gain: 0.05, freq: 5000, type: 'highpass' });
        break;
      case 'fail':
        this.tone({ freq: 260, freq2: 130, type: 'sawtooth', dur: 0.3, gain: 0.12 });
        break;
      case 'death':
        this.tone({ freq: 220, freq2: 55, type: 'sawtooth', dur: 1.1, gain: 0.16 });
        this.noise({ dur: 0.9, gain: 0.06, freq: 500 });
        break;
      case 'boss':
        this.tone({ freq: 70, freq2: 42, type: 'sine', dur: 0.9, gain: 0.24 });
        this.noise({ dur: 0.6, gain: 0.08, freq: 300 });
        break;
      case 'teleport':
        [330, 440, 554, 740].forEach((f, i) => this.tone({ freq: f, type: 'sine', dur: 0.22, gain: 0.07, delay: i * 0.05 }));
        break;
      default:
        break;
    }
  },
};
