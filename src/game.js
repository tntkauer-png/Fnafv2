/* Night shift simulation: clock, power, animatronic AI. */
export const NIGHT_SECONDS = 264;          // 44s per in-game hour
export const HOUR_SECONDS = NIGHT_SECONDS / 6;

const PATHS = {
  bonnie: ['stage', 'dining', 'westHall', 'westCorner'],
  chica: ['stage', 'dining', 'eastHall', 'eastCorner'],
  freddy: ['stage', 'dining', 'eastHall', 'eastCorner']
};

const DIFFICULTY = [
  { bonnie: 4, chica: 3, freddy: 1, foxy: 1, drain: .9 },
  { bonnie: 7, chica: 6, freddy: 2, foxy: 3, drain: .98 },
  { bonnie: 10, chica: 9, freddy: 5, foxy: 6, drain: 1.02 },
  { bonnie: 13, chica: 12, freddy: 8, foxy: 9, drain: 1.06 },
  { bonnie: 16, chica: 15, freddy: 11, foxy: 13, drain: 1.1 }
];

export const NIGHT_SUBS = [
  'They’re new here.',
  'They brought friends.',
  'They know the halls.',
  'They’re faster now.',
  'No one is coming.',
  'The suits are empty.'
];

export const CAM_ORDER = ['1A', '1B', '1C', '2A', '2B', '3', '4A', '4B', '5'];

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
    this.lureCd = 0;
    this.lureCooldown = 26;
    this.lureCost = 4.5;
    this.lureT = 0;
    this._warned = { twenty: false, ten: false };
  }

  loadProgress() {
    try {
      const n = parseInt(localStorage.getItem('fnf_night_shift_unlocked') || '1', 10);
      this.unlocked = Math.max(1, Math.min(5, isNaN(n) ? 1 : n));
    } catch { this.unlocked = 1; }
    return this.unlocked;
  }
  saveProgress(n) {
    try {
      const next = Math.max(this.unlocked, Math.min(5, n));
      this.unlocked = next;
      localStorage.setItem('fnf_night_shift_unlocked', String(next));
    } catch {}
  }

  startNight(n) {
    this.night = Math.max(1, Math.min(5, n));
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
    this.startDelay = 12;
    this._hour = -1;
    this.foxy = { stage: 0, timer: 17, running: false, runT: 0, side: 'left' };
    this.lureCd = 0;
    this.lureT = 0;
    this._warned = { twenty: false, ten: false };
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
    const total = Math.floor(this.nightT * 12.5);
    const mm = String(total % 60).padStart(2, '0');
    return `${h}:${mm} AM`;
  }
  hourIndex() { return Math.floor(this.nightT / HOUR_SECONDS); }

  toggleDoor(side) {
    if (this.state !== 'playing' || this.blackout) return;
    this.doors[side] = !this.doors[side];
    this.audio.door(this.doors[side], side === 'left' ? -.6 : .6);
    // Closing on something at the door makes it retreat shortly.
    const who = this.aiAtDoor(side);
    if (this.doors[side] && who) {
      who.blockT = Math.max(who.blockT, .65);
    }
  }
  setDoor(side, closed) {
    if (this.blackout) return;
    if (this.doors[side] === closed) return;
    this.toggleDoor(side);
  }
  toggleLight(side) {
    if (this.state !== 'playing' || this.blackout) return;
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
    if (this.lights[side] && this.aiAtDoor(side)) {
      this.events.onReveal?.(side, this.aiAtDoor(side).name);
    }
  }
  aiAtDoor(side) {
    for (const k in this.ai) {
      const a = this.ai[k];
      if (a.atDoor && a.side === side) return a;
    }
    return null;
  }

  /* How much the hour weighs on their aggression — later hours are meaner. */
  timePressure() {
    return 1 + Math.max(0, Math.min(5, this.hourIndex())) * .12;
  }

  camForAI(name, a) {
    if (!a) return null;
    const pos = a.path[a.index];
    if (name === 'bonnie') return pos === 'westHall' ? '2A' : pos === 'westCorner' ? '2B' : pos === 'dining' ? '1B' : '1A';
    if (name === 'chica' || name === 'freddy') return pos === 'eastHall' ? '4A' : pos === 'eastCorner' ? '4B' : pos === 'dining' ? '1B' : '1A';
    return null;
  }

  /* Every camera that currently contains something that moves. */
  motionCams() {
    const out = new Set();
    for (const name in this.ai) {
      const cam = this.camForAI(name, this.ai[name]);
      if (cam) out.add(cam);
    }
    const f = this.foxy;
    if (f.running) {
      out.add(f.runT > .85 ? '2B' : '2A');
    } else if (f.stage >= 1) {
      out.add('1C');
    }
    return out;
  }

  camHasMotion(id) {
    return this.motionCams().has(id);
  }

  lureReady() {
    return this.state === 'playing' && !this.blackout && this.lureCd <= 0;
  }

  /* Audio lure: a cheap distraction that buys a few seconds, but burns power. */
  lure() {
    if (!this.lureReady()) return false;
    this.lureCd = this.lureCooldown;
    this.lureT = 3.2;
    this.power = Math.max(0, this.power - this.lureCost);
    this.audio.lure();
    let pulled = 0;
    for (const name in this.ai) {
      const a = this.ai[name];
      if (a.atDoor) {
        a.atDoor = false;
        a.index = Math.max(1, a.path.length - 3);
        a.cooldown = 8 + Math.random() * 5;
        a.timer = a.interval;
        a.blockT = 0;
        pulled++;
      } else {
        a.timer += 4.5 + Math.random() * 4;
        a.cooldown = Math.max(a.cooldown, 1.1 + Math.random() * 1.6);
      }
    }
    if (this.foxy.stage > 0 && !this.foxy.running) {
      this.foxy.stage = Math.max(0, this.foxy.stage - 1);
      this.foxy.timer = 7 + Math.random() * 5;
      pulled++;
    }
    if (pulled) {
      this.events.onRetreat?.('left', 'lure');
      this.events.onRetreat?.('right', 'lure');
      this.events.onClearCharacters?.();
    }
    this.events.onLure?.(pulled);
    this.events.onMessage?.(pulled ? 'The lure pulled something away from the office.' : 'The lure echoes through the halls. Nothing answers.');
    if (this.power <= 0) this._beginBlackout();
    return true;
  }

  openCams() {
    if (this.state !== 'playing' || this.blackout || this.camOpen) return;
    this.camOpen = true;
    this.lights.left = this.lights.right = false;
    this.audio.camOpen();
    this.events.onCams?.(true);
    this.events.onCamSwitch?.(this.cam);
  }
  closeCams() {
    if (!this.camOpen) return;
    this.camOpen = false;
    this.audio.camClose();
    this.events.onCams?.(false);
  }
  selectCam(id) {
    if (this.cam === id) return;
    this.cam = id;
    this.audio.camSwitch();
    this.events.onCamSwitch?.(id);
  }

  update(dt) {
    if (this.state !== 'playing') return;
    dt = Math.min(dt, .1);
    if (this.lureCd > 0) this.lureCd = Math.max(0, this.lureCd - dt);
    if (this.lureT > 0) this.lureT = Math.max(0, this.lureT - dt);
    const prevHour = this.hourIndex();
    this.nightT += dt;
    if (this.hourIndex() !== prevHour && this.nightT < NIGHT_SECONDS) {
      this.audio.hourBeep();
      this.events.onHour?.(this.hourIndex(), this.displayHour());
    }
    if (this.nightT >= NIGHT_SECONDS) { this.win(); return; }

    if (!this.blackout) {
      this._updatePower(dt);
      if (this.blackout) return;
      this._updateAI(dt);
      this._updateFoxy(dt);
      if (!this._warned.twenty && this.power <= 20) {
        this._warned.twenty = true;
        this.events.onMessage?.('Power at 20%. Start choosing which doors matter.');
        this.events.onPowerWarn?.('twenty');
      }
      if (!this._warned.ten && this.power <= 10) {
        this._warned.ten = true;
        this.events.onMessage?.('Power at 10%. They can hear the doors open.');
        this.events.onPowerWarn?.('ten');
      }
    } else {
      this._updateBlackout(dt);
    }
    // usage
    let u = 1;
    if (this.doors.left) u += 1;
    if (this.doors.right) u += 1;
    if (this.lights.left || this.lights.right) u += .55;
    if (this.camOpen) u += .5;
    if (this.lureT > 0) u += .35;
    this.usage = u;
  }

  _updatePower(dt) {
    const base = .135 * this.levels.drain;
    let drain = base;
    if (this.doors.left) drain += .185;
    if (this.doors.right) drain += .185;
    if (this.lights.left) drain += .12;
    if (this.lights.right) drain += .12;
    if (this.camOpen) drain += .115;
    this.power -= drain * dt;
    if (this.power <= 0) {
      this.power = 0;
      this._beginBlackout();
    }
  }

  _beginBlackout() {
    this.blackout = true;
    this.blackoutT = 0;
    this.doors.left = this.doors.right = false;
    this.lights.left = this.lights.right = false;
    this.camOpen = false;
    this.lureT = 0;
    this.audio.powerDown();
    this.events.onPowerOut?.();
    // Foxy retreats in the dark; Freddy comes for you.
    if (this.foxy.running) { this.foxy.running = false; this.foxy.stage = 0; }
    for (const k in this.ai) { this.ai[k].atDoor = false; this.ai[k].index = Math.max(1, Math.min(2, this.ai[k].index)); }
    this.events.onClearCharacters?.();
  }

  _updateBlackout(dt) {
    this.blackoutT += dt;
    if (this.blackoutT > 2.2 && !this._musicStarted) {
      this._musicStarted = true;
      this.audio.musicBox();
      this.events.onMessage?.('You are out of power.');
    }
    if (this.blackoutT > 11.5 && !this.finished) {
      this.finished = true;
      this.state = 'dead';
      this.stats = { night: this.night, power: 0, time: this.displayHour() + ' AM' };
      this.events.onDeath?.('freddy', 'blackout');
    }
  }

  _updateAI(dt) {
    if (this.startDelay > 0) { this.startDelay -= dt; return; }
    const pressure = this.timePressure();
    for (const name in this.ai) {
      const a = this.ai[name];
      // Freddy is shy — he freezes if you are watching his room.
      const watching = this.camOpen && this.camMatches(name, a) && name === 'freddy';
      if (a.cooldown > 0) { a.cooldown -= dt; continue; }

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
        // breathing at the door
        if (Math.random() < dt * .55) this.audio.breath(a.side === 'left' ? -.75 : .75);
        continue;
      }

      if (watching) continue;
      a.timer -= dt;
      if (a.timer <= 0) {
        a.timer = (a.interval / (.82 + pressure * .18)) * (.82 + Math.random() * .5);
        const chance = Math.min(.82, (a.level / 20) * pressure);
        if (Math.random() < chance) {
          this._advance(a);
        } else if (Math.random() < .13) {
          // restless shuffle
          this.audio.step(a.side === 'left' ? -.65 : .65, 1);
        }
      }
    }
  }

  camMatches(name, a) {
    return this.camForAI(name, a) === this.cam;
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
      // watching keeps him at bay
      if (f.stage === 3) f.timer = Math.max(f.timer, 6);
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
      const chance = Math.min(.8, (this.levels.foxy / 20 + .12) * this.timePressure());
      if (Math.random() < chance) {
        f.stage++;
        f.timer = f.stage >= 3 ? 5.2 : 13.5;
        this.audio.servo(-.6);
        if (f.stage === 3) this.events.onFoxyReady?.();
      } else {
        f.timer = 6 + Math.random() * 5;
      }
    }
  }

  _kill(by) {
    if (this.finished) return;
    this.finished = true;
    this.state = 'dead';
    this.stats = { night: this.night, power: Math.round(this.power), time: this.displayHour() + ' AM' };
    this.events.onDeath?.(by, by === 'foxy' ? 'foxy' : 'attack');
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
}
