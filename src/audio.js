/* Tiny procedural audio engine — no external assets. */
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.started = false;
    this.nodes = {};
    this._noise = null;
    this._tension = 0;
  }
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.72;
    // gentle limiter
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 24; comp.ratio.value = 5;
    comp.attack.value = .008; comp.release.value = .25;
    this.master.connect(comp).connect(this.ctx.destination);
    this._noise = this._makeNoise(2.4);
    this._buildAmbience();
    this.started = true;
  }
  _makeNoise(seconds = 2) {
    const sr = this.ctx.sampleRate;
    const b = this.ctx.createBuffer(2, Math.floor(sr * seconds), sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      let last = 0;
      for (let i = 0; i < d.length; i++) {
        const w = Math.random() * 2 - 1;
        last = last * .92 + w * .08;
        d[i] = last * 3.2;
      }
    }
    return b;
  }
  _gain(v = 1) { const g = this.ctx.createGain(); g.gain.value = v; return g; }
  _pan(p = 0) {
    if (this.ctx.createStereoPanner) {
      const n = this.ctx.createStereoPanner(); n.pan.value = Math.max(-1, Math.min(1, p)); return n;
    }
    return this._gain(1);
  }
  _play(buffer, { rate = 1, gain = 1, pan = 0, loop = false, filter = null, when = 0 } = {}) {
    if (!this.ctx) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer; src.playbackRate.value = rate; src.loop = loop;
    let node = src;
    if (filter) {
      const f = this.ctx.createBiquadFilter();
      f.type = filter.type || 'lowpass'; f.frequency.value = filter.freq || 800; f.Q.value = filter.q || .7;
      node.connect(f); node = f;
    }
    const g = this._gain(gain);
    const p = this._pan(pan);
    node.connect(g).connect(p).connect(this.master);
    src.start(this.ctx.currentTime + when);
    return { src, gain: g };
  }
  _tone({ f = 220, f2 = null, type = 'sine', gain = .2, dur = .3, pan = 0, delay = 0, attack = .005, filter = null }) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(f, t0);
    if (f2 !== null) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t0 + dur);
    const g = this._gain(0);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
    let node = o;
    if (filter) {
      const fl = this.ctx.createBiquadFilter(); fl.type = filter.type || 'lowpass';
      fl.frequency.value = filter.freq || 900; fl.Q.value = filter.q || 1;
      node.connect(fl); node = fl;
    }
    node.connect(g).connect(this._pan(pan)).connect(this.master);
    o.start(t0); o.stop(t0 + dur + .05);
  }
  _buildAmbience() {
    const ctx = this.ctx;
    // fan hum
    const fanGain = ctx.createGain(); fanGain.gain.value = .11;
    const fanFilter = ctx.createBiquadFilter(); fanFilter.type = 'lowpass'; fanFilter.frequency.value = 420;
    const fanNoise = ctx.createBufferSource(); fanNoise.buffer = this._noise; fanNoise.loop = true;
    fanNoise.connect(fanFilter).connect(fanGain).connect(this.master);
    fanNoise.start();
    const hum = ctx.createOscillator(); hum.type = 'sine'; hum.frequency.value = 59;
    const humGain = ctx.createGain(); humGain.gain.value = .022;
    hum.connect(humGain).connect(this.master); hum.start();
    // deep room rumble
    const rum = ctx.createBufferSource(); rum.buffer = this._noise; rum.loop = true;
    const rumF = ctx.createBiquadFilter(); rumF.type = 'lowpass'; rumF.frequency.value = 90;
    const rumG = ctx.createGain(); rumG.gain.value = .16;
    rum.connect(rumF).connect(rumG).connect(this.master); rum.start();
    this.nodes = { fanGain, fanFilter, hum, humGain, rumG };
    this._ambTimer = setInterval(() => this._ambientEvent(), 11000);
  }
  _ambientEvent() {
    if (!this.ctx || this.muted || document.hidden) return;
    const r = Math.random();
    if (r < .38) {
      // wood creak
      const f = 90 + Math.random() * 130;
      this._tone({ f, f2: f * (.7 + Math.random() * .5), type: 'sawtooth', gain: .018, dur: 1.2 + Math.random(), pan: Math.random() * 2 - 1, filter: { type: 'bandpass', freq: 700, q: 7 } });
    } else if (r < .7) {
      // distant thud
      this.thud({ gain: .05, pan: Math.random() * 2 - 1, low: true });
    } else if (r < .9) {
      // metal tick
      this._tone({ f: 1800 + Math.random() * 1600, f2: 900, type: 'square', gain: .008, dur: .18, pan: Math.random() * 2 - 1 });
    }
  }
  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : .72, this.ctx.currentTime, .05);
  }
  setTension(t) {
    if (!this.ctx) return;
    this._tension = t;
    const f = this.nodes.fanGain, h = this.nodes.humGain;
    if (f) f.gain.setTargetAtTime(.10 + t * .03, this.ctx.currentTime, .8);
    if (h) h.gain.setTargetAtTime(.02 + t * .025, this.ctx.currentTime, 1.2);
  }
  click() { this._tone({ f: 1500, f2: 500, type: 'square', gain: .035, dur: .05 }); }
  ui() { this._tone({ f: 340, f2: 280, type: 'triangle', gain: .05, dur: .09 }); }
  door(closing = true, pan = 0) {
    if (!this.ctx) return;
    this._play(this._noise, { rate: .8, gain: .28, pan, filter: { type: 'lowpass', freq: 1200 } });
    this._tone({ f: closing ? 240 : 180, f2: closing ? 55 : 100, type: 'sawtooth', gain: .16, dur: .45, pan, filter: { type: 'lowpass', freq: 700 } });
    this._tone({ f: closing ? 90 : 70, f2: 40, type: 'sine', gain: .3, dur: .35, pan });
    if (closing) {
      this._tone({ f: 1300, f2: 500, type: 'square', gain: .035, dur: .12, pan, delay: .3 });
      this._play(this._noise, { rate: 1.4, gain: .14, pan, delay: 0, filter: { type: 'bandpass', freq: 2600, q: 2 } });
    }
  }
  light(on, pan = 0) {
    if (!this.ctx) return;
    if (on) {
      this._play(this._noise, { rate: 1.2, gain: .05, pan, filter: { type: 'bandpass', freq: 3400, q: 2 } });
      this._tone({ f: 120, type: 'sawtooth', gain: .03, dur: .22, pan, filter: { type: 'lowpass', freq: 600 } });
      this._tone({ f: 2400, f2: 1600, type: 'square', gain: .012, dur: .1, pan });
    } else {
      this._tone({ f: 900, f2: 300, type: 'square', gain: .02, dur: .06, pan });
    }
  }
  camOpen() {
    this._tone({ f: 900, f2: 1400, type: 'square', gain: .03, dur: .08 });
    this._play(this._noise, { rate: 1.1, gain: .08, filter: { type: 'highpass', freq: 900 } });
    this._tone({ f: 70, f2: 50, type: 'sine', gain: .2, dur: .2 });
  }
  camClose() {
    this._tone({ f: 1400, f2: 600, type: 'square', gain: .03, dur: .07 });
    this._tone({ f: 60, f2: 40, type: 'sine', gain: .18, dur: .18 });
  }
  camSwitch() {
    this._play(this._noise, { rate: 1.5, gain: .14, filter: { type: 'highpass', freq: 1200 } });
    this._tone({ f: 2200, f2: 700, type: 'square', gain: .018, dur: .06 });
  }
  staticBurst(amount = .12) {
    this._play(this._noise, { rate: 1.3, gain: amount, filter: { type: 'highpass', freq: 800 } });
  }
  step(pan = 0, heavy = 1) {
    this._tone({ f: 95 * heavy, f2: 42, type: 'sine', gain: .12, dur: .16, pan });
    this._play(this._noise, { rate: .8, gain: .06 * heavy, pan, filter: { type: 'lowpass', freq: 700 } });
    // metallic suit clank
    this._tone({ f: 320 * heavy, f2: 260, type: 'square', gain: .012, dur: .1, pan, delay: .04, filter: { type: 'bandpass', freq: 900 } });
  }
  thud({ gain = .12, pan = 0, low = false } = {}) {
    this._tone({ f: low ? 60 : 80, f2: low ? 28 : 40, type: 'sine', gain, dur: low ? .5 : .3, pan });
    this._play(this._noise, { rate: .7, gain: gain * .5, pan, filter: { type: 'lowpass', freq: 500 } });
  }
  knock(pan = 0) {
    for (let i = 0; i < 3; i++) {
      this._tone({ f: 120, f2: 60, type: 'sine', gain: .16, dur: .12, pan, delay: i * .19 });
      this._tone({ f: 600, f2: 300, type: 'square', gain: .02, dur: .08, pan, delay: i * .19, filter: { type: 'bandpass', freq: 800 } });
    }
  }
  breath(pan = 0) {
    if (!this.ctx) return;
    for (let i = 0; i < 2; i++) {
      this._play(this._noise, { rate: .45, gain: .075, pan, filter: { type: 'bandpass', freq: 520 + i * 180, q: 1.2 }, when: i * .62 });
    }
  }
  servo(pan = 0) {
    this._tone({ f: 700, f2: 1300, type: 'sawtooth', gain: .014, dur: .4, pan, filter: { type: 'bandpass', freq: 1200, q: 4 } });
  }
  laugh() {
    if (!this.ctx) return;
    const base = 105;
    for (let i = 0; i < 5; i++) {
      this._tone({ f: base * (1 + i * .045), f2: base * .82, type: 'sawtooth', gain: .05, dur: .13, delay: i * .19, pan: (i % 2 ? .4 : -.4), filter: { type: 'lowpass', freq: 900 } });
    }
  }
  foxyRun(pan = -1) {
    if (!this.ctx) return;
    for (let i = 0; i < 9; i++) {
      this._tone({ f: 90 - i * 3, f2: 36, type: 'sine', gain: .13, dur: .12, delay: i * .13, pan });
      this._play(this._noise, { rate: .9, gain: .05, pan, filter: { type: 'lowpass', freq: 600 }, when: i * .13 });
    }
  }
  scream() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // distorted noise
    this._play(this._noise, { rate: 1.7, gain: .5, filter: { type: 'bandpass', freq: 1500, q: .6 } });
    const shaper = this.ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      const x = i / 512 - 1;
      curve[i] = Math.tanh(x * 6);
    }
    shaper.curve = curve;
    for (let i = 0; i < 5; i++) {
      const o = this.ctx.createOscillator();
      const g = this._gain(.22);
      o.type = i % 2 ? 'sawtooth' : 'square';
      o.frequency.setValueAtTime(500 + i * 170 + Math.random() * 200, t);
      o.frequency.exponentialRampToValueAtTime(70 + i * 22, t + .8);
      o.connect(shaper).connect(g).connect(this.master);
      o.start(t); o.stop(t + .95);
    }
    const o2 = this.ctx.createOscillator();
    const g2 = this._gain(.35);
    o2.type = 'sine';
    o2.frequency.setValueAtTime(80, t);
    o2.frequency.exponentialRampToValueAtTime(26, t + 1.1);
    o2.connect(g2).connect(this.master);
    o2.start(t); o2.stop(t + 1.15);
  }
  powerDown() {
    this._tone({ f: 130, f2: 24, type: 'sawtooth', gain: .18, dur: 2.2, filter: { type: 'lowpass', freq: 500 } });
    this._tone({ f: 60, f2: 20, type: 'sine', gain: .25, dur: 2.6 });
    this._play(this._noise, { rate: .5, gain: .1, filter: { type: 'lowpass', freq: 300 } });
  }
  musicBox() {
    if (!this.ctx) return;
    const notes = [659.25, 587.33, 493.88, 587.33, 659.25, 783.99, 659.25, 587.33, 493.88, 392, 440, 493.88, 587.33, 523.25, 493.88, 440];
    notes.forEach((f, i) => {
      this._tone({ f, type: 'sine', gain: .055, dur: 1.6, delay: i * .42, pan: (i % 3 - 1) * .25, attack: .01 });
      this._tone({ f: f * 2.01, type: 'sine', gain: .012, dur: 1.1, delay: i * .42, pan: 0, attack: .01 });
    });
  }
  chime() {
    const bells = [523.25, 659.25, 783.99, 1046.5];
    bells.forEach((f, i) => {
      this._tone({ f, type: 'sine', gain: .12, dur: 2.6, delay: i * .16, attack: .005 });
      this._tone({ f: f * 2, type: 'sine', gain: .03, dur: 2, delay: i * .16 });
    });
    this._play(this._noise, { rate: .5, gain: .16, filter: { type: 'bandpass', freq: 1200, q: .4 }, when: .3 });
    this._play(this._noise, { rate: .4, gain: .1, filter: { type: 'bandpass', freq: 2400, q: .4 }, when: 1 });
    for (let i = 0; i < 18; i++) {
      this._tone({ f: 900 + Math.random() * 1300, type: 'sine', gain: .01, dur: .5, delay: Math.random() * 2.5 });
    }
  }
  hourBeep() {
    this._tone({ f: 880, type: 'sine', gain: .05, dur: .18 });
    this._tone({ f: 1320, type: 'sine', gain: .03, dur: .22, delay: .09 });
  }
}
