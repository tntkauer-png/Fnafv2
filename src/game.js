/* Night shift simulation: clock, power, animatronic AI, camera signal,
   music box / Puppet, audio lures and the aux-power recovery window. */
export const NIGHT_SECONDS = 288;          // 48s per in-game hour
export const HOUR_SECONDS = NIGHT_SECONDS / 6;

const PATHS = {
  bonnie: ['stage', 'dining', 'westHall', 'westCorner'],
  chica: ['stage', 'dining', 'eastHall', 'eastCorner'],
  freddy: ['stage', 'dining', 'eastHall', 'eastCorner']
};

const DIFFICULTY = [
  { bonnie: 4, chica: 3, freddy: 1, foxy: 1, drain: .86, box: .50 },
  { bonnie: 7, chica: 6, freddy: 2, foxy: 3, drain: .94, box: .57 },
  { bonnie: 10, chica: 9, freddy: 5, foxy: 6, drain: 1.00, box: .65 },
  { bonnie: 13, chica: 12, freddy: 8, foxy: 9, drain: 1.06, box: .73 },
  { bonnie: 16, chica: 15, freddy: 11, foxy: 13, drain: 1.12, box: .82 },
  { bonnie: 18, chica: 17, freddy: 14, foxy: 15, drain: 1.18, box: .94 },
  { bonnie: 20, chica: 20, freddy: 20, foxy: 20, drain: 1.24, box: 1.04 }
];

export const NIGHT_SUBS = [
  'They’re new here.',
  'They brought friends.',
  'They know the halls.',
  'They’re faster now.',
  'No one is coming.',
  'The suits are empty.',
  'They remember you.'
];

export class Game {
  constructor(audio, events = {}) {
    this.audio = audio;
    this.events = events;
    this.night = 1;
    this.state = 'idle';
    this.nightT = 0;
    this.power = 100;
    this.doors = { left: false, right: false };
    this.lights = { left: false, right: false };
    this.camOpen = false;
    this.cam = '1A';
    this.ai = {};
    this.foxy = { stage: 0, timer: 16, running: false, runT: 0, side: 'left' };
    this.levels = DIFFICULTY[0];
    this.usage = 1;
    this._acc = 0;
    this._hour = -1;
    this.blackout = false;
    this.blackoutT = 0;
    this.finished = false;
    this.startDelay = 0;
    this.unlocked = 1;
    this.stats = null;

    // camera system
    this.camSignal = 100;
    this.camOffline = false;
    this.camRebootT = 0;
    this.camGlitch = 0;

    // music box / puppet
    this.musicBox = 100;
    this.musicBoxRate = 1;
    this.puppetT = 0;
    this.puppetWarned = 0;
    this.windHeld = false;

    // audio lure
    this.lureCooldown = 0;

    // aux power recovery
    this.auxUsed = false;
    this.auxActive = false;
    this.auxT = 0;
    this.auxSuccess = false;

    this._shots = [];
  }

  loadProgress() {
    try {
      const n = parseInt(localStorage.getItem('fnf_night_shift_unlocked') || '1', 10);
      this.unlocked = Math.max(1, Math.min(7, isNaN(n) ? 1 : n));
    } catch { this.unlocked = 1; }
    return this.unlocked;
  }
  saveProgress(n) {
    try {
      const next = Math.max(this.unlocked, Math.min(7, n));
      this.unlocked = next;
      localStorage.setItem('fnf_night_shift_unlocked', String(next));
    } catch {}
  }

  startNight(n) {
    this.night = Math.max(1, Math.min(7, n));
    this.levels = DIFFICULTY[this.night - 1];
    this.state = 'playing';
    this.nightT = 0;
    this.power = 100;
    this.doors = { left: false, right: false };
    this.lights = { left: false, right: false };
    this.camOpen = false;
    this.cam = '1A';
    this.finished = false;
    this.blackout = false;
    this.blackoutT = 0;
    this.startDelay = this.night >= 6 ? 7 : 10;
    this._hour = -1;
    this._musicStarted = false;
    this.foxy = { stage: 0, timer: 17, running: false, runT: 0, side: 'left' };
    this.ai = {
      bonnie: this._makeAI('bonnie', 6.0, 6.4),
      chica: this._makeAI('chica', 5.0, 6.4),
      freddy: this._makeAI('freddy', 16.0, 8.0)
    };
    // Freddy arrives late
    this.ai.freddy.timer = 26;
    this.ai.bonnie.timer = 16 + Math.random() * 6;
    this.ai.chica.timer = 20 + Math.random() * 7;
    this.stats = null;

    this.camSignal = 100;
    this.camOffline = false;
    this.camRebootT = 0;
    this.camGlitch = 0;
    this.musicBox = 100;
    this.musicBoxRate = this.levels.box;
    this.puppetT = 0;
    this.puppetWarned = 0;
    this.windHeld = false;
    this.lureCooldown = 0;
    this.auxUsed = false;
    this.auxActive = false;
    this.auxT = 0;
    this.auxSuccess = false;
  }

  _makeAI(name, timer, interval) {
    return {
      name,
      path: PATHS[name],
      index: 0,
      timer,
      interval,
      atDoor: false,
      attackT: 0,
      blockT: 0,
      cooldown: 0,
      distractT: 0,
      side: name === 'bonnie' ? 'left' : 'right',
      level: this.levels[name]
    };
  }

  displayHour() {
    const h = Math.min(5, Math.floor(this.nightT / HOUR_SECONDS));
    return h === 0 ? '12' : String(h);
  }
  clockString() {
    const h = this.displayHour();
    const total = Math.floor(this.nightT * 75); // 48s per hour = 1.25 game-min/s
    const mm = String(Math.floor(total / 60) % 60).padStart(2, '0');
    return `${h}:${mm} AM`;
  }
  hourIndex() { return Math.floor(this.nightT / HOUR_SECONDS); }

  toggleDoor(side) {
    if (this.state !== 'playing' || this.blackout || this.auxActive) return;
    this.doors[side] = !this.doors[side];
    this.audio.door(this.doors[side], side === 'left' ? -.6 : .6);
    const who = this.aiAtDoor(side);
    if (this.doors[side] && who) {
      who.blockT = Math.max(who.blockT, .65);
      this._shot('door', `SLAMMED ON ${who.name.toUpperCase()}`);
    }
  }
  setDoor(side, closed) {
    if (this.blackout) return;
    if (this.doors[side] === closed) return;
    this.toggleDoor(side);
  }
  toggleLight(side) {
    if (this.state !== 'playing' || this.blackout || this.auxActive) return;
    if (this.camOpen) {
      this.audio.ui();
      return;
    }
    this.lights[side] = !this.lights[side];
    if (this.lights[side]) {
      const other = side === 'left' ? 'right' : 'left';
      this.lights[other] = false;
    }
    this.audio.light(this.lights[side], side === 'left' ? -.6 : .6);
    const who = this.aiAtDoor(side);
    if (this.lights[side] && who) {
      this.events.onReveal?.(side, who.name);
    }
  }
  aiAtDoor(side) {
    for (const k in this.ai) {
      const a = this.ai[k];
      if (a.atDoor && a.side === side) return a;
    }
    return null;
  }

  /* ------------------------------------------------------------ cameras */
  openCams() {
    if (this.state !== 'playing' || this.blackout || this.auxActive || this.camOpen) return false;
    if (this.camRebootT > 0) {
      this.events.onMessage?.('Camera system is rebooting…');
      return false;
    }
    this.camOpen = true;
    this.lights.left = this.lights.right = false;
    this.audio.camOpen();
    this.events.onCams?.(true);
    this.events.onCamSwitch?.(this.cam);
    return true;
  }
  closeCams() {
    if (!this.camOpen) return;
    this.camOpen = false;
    this.windHeld = false;
    this.audio.camClose();
    this.events.onCams?.(false);
  }
  selectCam(id) {
    if (!this.camOpen || this.cam === id) return;
    this.cam = id;
    this.audio.camSwitch();
    this.events.onCamSwitch?.(id);
  }

  rebootCams() {
    if (this.camRebootT > 0) return;
    this.closeCams();
    this.camRebootT = 2.4;
    this.camOffline = false;
    this.camSignal = 100;
    this.audio.camSwitch();
    this.events.onMessage?.('Rebooting the camera bus…');
  }

  /* ------------------------------------------------------------ new tools */
  lure() {
    if (this.state !== 'playing' || !this.camOpen || this.auxActive) return { ok: false, reason: 'closed' };
    if (this.lureCooldown > 0) return { ok: false, reason: 'cooldown', t: this.lureCooldown };
    if (this.cam === '6') return { ok: false, reason: 'empty' };
    this.lureCooldown = 19;
    this.power = Math.max(0, this.power - 1.6);
    let hit = null;
    for (const name in this.ai) {
      const a = this.ai[name];
      if (this.camMatches(name, a) && !a.atDoor) {
        a.distractT = Math.max(a.distractT, 8.5);
        a.timer = Math.max(a.timer, a.interval * .7);
        hit = name;
      }
    }
    if (this.cam === '1C' && !this.foxy.running) {
      this.foxy.timer = Math.max(this.foxy.timer, 11);
      hit = hit || 'foxy';
    }
    if (this.cam === '1A' && !hit) {
      // empty stage noise still buys a little time on the shared timers
      for (const name in this.ai) {
        const a = this.ai[name];
        if (a.index === 0) a.timer = Math.max(a.timer, a.interval * .55);
      }
    }
    this.audio.servo(-.2);
    this.audio.thud({ gain: .09, pan: (Math.random() - .5) * .8 });
    this.events.onLure?.(this.cam, hit);
    return { ok: true, hit };
  }

  windMusicBox(dt) {
    if (!this.camOpen || this.cam !== '6' || this.auxActive) return 0;
    const amount = 34 * dt;
    this.musicBox = Math.min(100, this.musicBox + amount);
    this.power = Math.max(0, this.power - .055 * dt);
    if (this.musicBox > 14) this.puppetT = 0;
    return amount;
  }

  resolveAux(success) {
    if (!this.auxActive) return;
    this.auxActive = false;
    this.auxT = 0;
    if (success) {
      this.auxSuccess = true;
      this.power = 24;
      this.blackout = false;
      this.events.onAux?.(false, 'success');
      this.events.onMessage?.('AUX POWER ONLINE — doors are live again.');
      this.audio.hourBeep();
    } else {
      this._beginBlackout();
      this.events.onAux?.(false, 'fail');
    }
  }

  /* ------------------------------------------------------------ update */
  update(dt) {
    if (this.state !== 'playing') return;
    dt = Math.min(dt, .1);
    if (this.auxActive) {
      this.auxT += dt;
      if (this.auxT > 8.2) this.resolveAux(false);
      return;
    }
    const prevHour = this.hourIndex();
    this.nightT += dt;
    if (this.hourIndex() !== prevHour && this.nightT < NIGHT_SECONDS) {
      this.audio.hourBeep();
      this.events.onHour?.(this.hourIndex(), this.displayHour());
    }
    if (this.nightT >= NIGHT_SECONDS) { this.win(); return; }

    if (this.camRebootT > 0) {
      this.camRebootT = Math.max(0, this.camRebootT - dt);
      if (this.camRebootT === 0) {
        this.camSignal = 100;
        this.camOffline = false;
        this.events.onMessage?.('Cameras back online.');
      }
    }
    if (this.lureCooldown > 0) this.lureCooldown = Math.max(0, this.lureCooldown - dt);

    if (!this.blackout) {
      this._updatePower(dt);
      if (this.blackout) return;
      this._updateSignal(dt);
      this._updateMusicBox(dt);
      this._updateAI(dt);
      this._updateFoxy(dt);
    } else {
      this._updateBlackout(dt);
    }

    let u = 1;
    if (this.doors.left) u += 1;
    if (this.doors.right) u += 1;
    if (this.lights.left || this.lights.right) u += .55;
    if (this.camOpen) u += .5;
    if (this.windHeld && this.cam === '6') u += .35;
    this.usage = u;
  }

  _updatePower(dt) {
    const base = .132 * this.levels.drain;
    let drain = base;
    if (this.doors.left) drain += .18;
    if (this.doors.right) drain += .18;
    if (this.lights.left) drain += .115;
    if (this.lights.right) drain += .115;
    if (this.camOpen) drain += .10;
    if (this.windHeld && this.cam === '6') drain += .045;
    this.power -= drain * dt;
    if (this.power <= 0) {
      this.power = 0;
      this._beginAux();
    }
  }

  _beginAux() {
    if (this.auxUsed) { this._beginBlackout(); return; }
    this.auxUsed = true;
    this.auxActive = true;
    this.auxT = 0;
    this.camOpen = false;
    this.windHeld = false;
    this.doors.left = this.doors.right = false;
    this.lights.left = this.lights.right = false;
    this.audio.powerDown();
    this.events.onAux?.(true);
  }

  _beginBlackout() {
    this.blackout = true;
    this.blackoutT = 0;
    this.auxActive = false;
    this.doors.left = this.doors.right = false;
    this.lights.left = this.lights.right = false;
    this.camOpen = false;
    this.windHeld = false;
    this.audio.powerDown();
    this.events.onPowerOut?.();
    if (this.foxy.running) { this.foxy.running = false; this.foxy.stage = 0; }
    for (const k in this.ai) { this.ai[k].atDoor = false; this.ai[k].index = Math.max(1, Math.min(2, this.ai[k].index)); }
    this.events.onClearCharacters?.();
  }

  _updateBlackout(dt) {
    this.blackoutT += dt;
    if (this.blackoutT > 2.0 && !this._musicStarted) {
      this._musicStarted = true;
      this.audio.musicBox();
      this.events.onMessage?.('You are out of power.');
    }
    if (this.blackoutT > 10.5 && !this.finished) {
      this.finished = true;
      this.state = 'dead';
      this.stats = { night: this.night, power: 0, time: this.displayHour() + ' AM' };
      this.events.onDeath?.('freddy', 'blackout');
    }
  }

  _updateSignal(dt) {
    if (this.camOpen) {
      this.camSignal -= dt * (.62 + (6 - Math.min(6, this.night)) * .035);
      this.camGlitch = Math.max(0, this.camGlitch - dt * 2.4);
      if (Math.random() < dt * .35) this.camGlitch = Math.min(1, this.camGlitch + .25);
      if (this.camSignal <= 0) {
        this.camSignal = 0;
        this.closeCams();
        this.camOffline = true;
        this.camRebootT = 6.0;
        this.audio.staticBurst(.25);
        this.events.onMessage?.('CAMERA SIGNAL LOST — rebooting. Use the halls.');
      }
    } else {
      this.camSignal = Math.min(100, this.camSignal + dt * 11);
    }
  }

  _updateMusicBox(dt) {
    if (this.musicBox > 0) {
      this.musicBox = Math.max(0, this.musicBox - this.musicBoxRate * dt);
      if (this.musicBox <= 0) {
        this.events.onMusicBox?.(0);
        this.audio.musicBox();
      }
      return;
    }
    this.puppetT += dt;
    if (this.puppetT > 1 && this.puppetWarned < 1) {
      this.puppetWarned = 1;
      this.events.onPuppet?.(1);
    }
    if (this.puppetT > 6.5 && this.puppetWarned < 2) {
      this.puppetWarned = 2;
      this.events.onPuppet?.(2);
    }
    if (this.puppetT > 10.5) { this._kill('puppet', 'musicbox'); }
  }

  _updateAI(dt) {
    if (this.startDelay > 0) { this.startDelay -= dt; return; }
    const hour = Math.min(5, this.hourIndex());
    const ramp = 1 + hour * .045;
    for (const name in this.ai) {
      const a = this.ai[name];
      const watching = this.camOpen && this.camMatches(name, a) && name === 'freddy';
      if (a.cooldown > 0) { a.cooldown -= dt; continue; }
      if (a.distractT > 0) {
        a.distractT -= dt;
        if (Math.random() < dt * .5) this.audio.servo(a.side === 'left' ? -.4 : .4);
        continue;
      }

      if (a.atDoor) {
        if (this.doors[a.side]) {
          a.blockT -= dt;
          if (a.blockT <= 0) this._retreat(a);
          continue;
        }
        a.attackT -= dt;
        if (a.attackT <= 0) {
          this._kill(name);
          return;
        }
        if (Math.random() < dt * .55) this.audio.breath(a.side === 'left' ? -.75 : .75);
        continue;
      }

      if (watching) continue;
      a.timer -= dt;
      if (a.timer <= 0) {
        a.timer = a.interval * (.82 + Math.random() * .5);
        const chance = Math.min(.82, (a.level * ramp) / 22);
        if (Math.random() < chance) {
          this._advance(a);
        } else if (Math.random() < .13) {
          this.audio.step(a.side === 'left' ? -.65 : .65, 1);
        }
      }
    }
  }

  camMatches(name, a) {
    const pos = a.path[a.index];
    if (name === 'bonnie') return pos === 'westHall' ? this.cam === '2A' : pos === 'westCorner' ? this.cam === '2B' : pos === 'dining' ? this.cam === '1B' : this.cam === '1A';
    if (name === 'chica') return pos === 'eastHall' ? this.cam === '4A' : pos === 'eastCorner' ? this.cam === '4B' : pos === 'dining' ? this.cam === '1B' : this.cam === '1A';
    if (name === 'freddy') return pos === 'eastHall' ? this.cam === '4A' : pos === 'eastCorner' ? this.cam === '4B' : pos === 'dining' ? this.cam === '1B' : this.cam === '1A';
    return false;
  }

  _advance(a) {
    a.index++;
    const pos = a.path[a.index];
    if (a.index >= a.path.length - 1) {
      a.atDoor = true;
      a.attackT = a.name === 'freddy' ? 10.5 : 7.2;
      a.blockT = .8;
      this.audio.knock(a.side === 'left' ? -.8 : .8);
      this.audio.step(a.side === 'left' ? -.7 : .7, 1.15);
      if (a.name === 'freddy') this.audio.laugh();
      this.events.onCorner?.(a.side, a.name);
      this._shot('call', `${a.name.toUpperCase()} AT THE ${a.side.toUpperCase()} DOOR`);
      return;
    }
    if (pos === 'dining') this.audio.step(a.side === 'left' ? -.4 : .4, .85);
    else if (pos.includes('Hall')) this.audio.step(a.side === 'left' ? -.72 : .72, 1);
    else this.audio.servo(a.side === 'left' ? -.3 : .3);
    this.events.onMove?.(a.name, pos);
  }

  _retreat(a) {
    a.atDoor = false;
    a.index = Math.max(1, a.path.length - 3);
    a.cooldown = 9 + Math.random() * 7;
    a.timer = a.interval;
    a.blockT = 0;
    this.audio.thud({ gain: .18, pan: a.side === 'left' ? -.8 : .8 });
    this.audio.door(false, a.side === 'left' ? -.65 : .65);
    this.events.onRetreat?.(a.side, a.name);
  }

  _updateFoxy(dt) {
    const f = this.foxy;
    if (f.running) {
      f.runT += dt;
      if (f.runT > 1.75) {
        if (this.doors.left) {
          f.running = false;
          f.stage = 0;
          f.timer = 18;
          this.audio.thud({ gain: .32, pan: -.8, low: true });
          this.audio.door(false, -.8);
          this.audio.knock(-.8);
          this.events.onFoxyBlocked?.();
        } else {
          this._kill('foxy');
        }
      }
      return;
    }
    if (this.camOpen && this.cam === '1C') {
      f.timer = Math.max(f.timer, 9);
      if (f.stage === 3) f.timer = Math.max(f.timer, 5);
    }
    if (f.stage >= 3) {
      f.timer -= dt;
      if (f.timer <= 0) {
        f.running = true;
        f.runT = 0;
        this.audio.foxyRun(-.9);
        this.events.onFoxyRun?.();
      }
      return;
    }
    f.timer -= dt;
    if (f.timer <= 0) {
      const chance = this.levels.foxy / 20;
      if (Math.random() < chance + .12) {
        f.stage++;
        f.timer = f.stage >= 3 ? 5.2 : 13.5;
        this.audio.servo(-.6);
        if (f.stage === 3) this.events.onFoxyReady?.();
      } else {
        f.timer = 6 + Math.random() * 5;
      }
    }
  }

  _shot(icon, text) {
    this._shots.unshift({ icon, text, t: 0 });
    if (this._shots.length > 3) this._shots.length = 3;
  }
  getShots(dt) {
    for (const s of this._shots) s.t += dt;
    this._shots = this._shots.filter(s => s.t < 3.6);
    return this._shots;
  }

  _kill(by, reason = 'attack') {
    if (this.finished) return;
    this.finished = true;
    this.state = 'dead';
    this.stats = { night: this.night, power: Math.round(this.power), time: this.displayHour() + ' AM' };
    this.events.onDeath?.(by, by === 'puppet' ? reason : by === 'foxy' ? 'foxy' : reason);
  }

  win() {
    if (this.finished) return;
    this.finished = true;
    this.state = 'won';
    this.camOpen = false;
    this.stats = { night: this.night, power: Math.round(this.power), time: '6 AM' };
    this.saveProgress(this.night + 1);
    this.events.onWin?.(this.night);
  }

  getPowerPct() { return Math.max(0, Math.min(100, this.power)); }
  getSignalPct() { return Math.max(0, Math.min(100, this.camSignal)); }
  getMusicBoxPct() { return Math.max(0, Math.min(100, this.musicBox)); }
}
