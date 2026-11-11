import { World } from './world.js';
import { FeedRenderer } from './feeds.js';
import { Game, NIGHT_SUBS } from './game.js';
import { AudioEngine } from './audio.js';

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wait = ms => new Promise(r => setTimeout(r, ms));
const frame = () => new Promise(r => requestAnimationFrame(() => r()));

const els = {
  scene: $('#scene'),
  hud: $('#hud'),
  hudNight: $('#hud-night'),
  hudTime: $('#hud-time'),
  hudHint: $('#hud-hint'),
  viewPrompt: $('#view-prompt'),
  power: $('#power-panel'),
  powerPct: $('#power-pct'),
  powerBars: $$('.power-bars i'),
  usageBars: $$('#usage-bars i'),
  camsBtn: $('#cams-btn'),
  camOverlay: $('#cam-overlay'),
  camsClose: $('#cams-close'),
  camGrid: $('#cam-grid'),
  camHeaderTime: $('#cam-header-time'),
  feedCanvas: $('#feed-canvas'),
  feedLabel: $('#feed-label'),
  feedTime: $('#feed-time'),
  camWarn: $('#cam-warn'),
  muteBtn: $('#mute-btn'),
  menuSound: $('#menu-sound'),
  pauseBtn: $('#pause-btn'),
  boot: $('#boot'),
  bootFill: $('#boot-fill'),
  bootTxt: $('#boot-txt'),
  bootStart: $('#boot-start'),
  menu: $('#menu'),
  nightSelect: $('#night-select'),
  startNight: $('#start-night'),
  intro: $('#intro'),
  introNight: $('#intro-night'),
  introTxt: $('#intro-txt'),
  introGo: $('#intro-go'),
  introSkip: $('#intro-skip'),
  pause: $('#pause'),
  resumeBtn: $('#resume-btn'),
  pauseMenuBtn: $('#pause-menu-btn'),
  gameover: $('#gameover'),
  goSub: $('#go-sub'),
  goNight: $('#go-night'),
  goPower: $('#go-power'),
  goTime: $('#go-time'),
  retryBtn: $('#retry-btn'),
  goMenuBtn: $('#go-menu-btn'),
  win: $('#win'),
  winSub: $('#win-sub'),
  winStars: $('#win-stars'),
  nextNightBtn: $('#next-night-btn'),
  winMenuBtn: $('#win-menu-btn'),
  flash: $('#flash'),
  toast: $('#toast')
};

const audio = new AudioEngine();
let world, feed, game;
let state = 'boot';
let selectedNight = 1;
let last = performance.now();
let feedAcc = 0;
let hintTimer = null;
let toastTimer = null;
let promptTimer = null;
let deathTimer = null;
let winTimer = null;
let fpsAcc = 0, fpsFrames = 0, quality = 1, goodWindows = 0;
let lastHud = { time: '', power: -1, usage: -1, doors: '', lights: '', cam: null, low: null };
let look = { yaw: 0, pitch: 0 };
let drag = null;
const keys = new Set();
const cornerCache = { left: null, right: null };

const INTROS = [
  { t: 'Welcome to your first night. Keep the doors shut when they get close, and don’t waste power.', k: 'Tip: flick the hallway LIGHTS before you close a door.' },
  { t: 'They moved on their own last night. Management says it’s a programming quirk.', k: 'Tip: Pirate Cove gets restless if you ignore the cameras.' },
  { t: 'The suits are walking again. Bonnie favours the west hall. Chica takes the east.', k: 'Tip: check the corner cams often. They only attack when the door is open.' },
  { t: 'Four nights in. You’re starting to recognise the footsteps.', k: 'Tip: power is life. One door at a time is usually enough.' },
  { t: 'Last night. The building feels different tonight. The music box started on its own.', k: 'Tip: at 5 AM, hold on. They get desperate.' }
];

/* ------------------------------------------------------------------ boot */
async function boot() {
  els.bootFill.style.width = '8%';
  await frame();
  await document.fonts.ready;
  await wait(280);
  els.bootTxt.textContent = 'WAKING THE ANIMATRONICS…';
  els.bootFill.style.width = '28%';
  await frame();
  await wait(240);

  world = new World(els.scene);
  world.resize(window.innerWidth, window.innerHeight);
  world.precompile();
  els.bootFill.style.width = '58%';
  els.bootTxt.textContent = 'DUSTING THE OFFICE…';
  await frame();
  await wait(200);

  feed = new FeedRenderer(els.feedCanvas);
  game = new Game(audio, {
    onCams: handleCams,
    onCamSwitch: handleCamSwitch,
    onDeath: handleDeath,
    onWin: handleWin,
    onHour: handleHour,
    onPowerOut: handlePowerOut,
    onCorner: () => {},
    onRetreat: () => {},
    onClearCharacters: () => { world.hideAllCharacters(); cornerCache.left = cornerCache.right = null; },
    onFoxyRun: () => {
      showPrompt('HEAVY FOOTSTEPS IN THE WEST HALL — CLOSE THE LEFT DOOR', 2600);
      feed.drawStaticBurst?.(1);
    },
    onFoxyBlocked: () => {
      showToast('The door buckles. Something heavy hit it.', 'good');
    },
    onFoxyReady: () => showToast('Pirate Cove is empty. Where is he?'),
    onReveal: side => {
      showPrompt(side === 'left' ? 'SOMETHING IS IN THE WEST DOORWAY — CLOSE IT' : 'SOMETHING IS IN THE EAST DOORWAY — CLOSE IT', 2400);
    },
    onMessage: text => showToast(text),
    onMove: () => {
      if (game.camOpen) glitchFeed(1);
    }
  });
  game.loadProgress();
  selectedNight = 1;
  updateNightCards();

  world.setMode('menu');
  els.bootFill.style.width = '100%';
  els.bootTxt.textContent = 'READY.';
  await wait(350);
  els.bootStart.classList.remove('hidden');
  els.bootTxt.textContent = 'FAZBEAR ENTERTAINMENT — NIGHT SHIFT';
  window.__fnf = { world, game, feed, audio, getState: () => state };
}

/* ------------------------------------------------------------------ menu */
function startMenu() {
  audio.init();
  audio.setTension(.15);
  els.boot.classList.add('hidden');
  els.menu.classList.remove('hidden');
  els.hud.classList.add('hidden');
  els.camOverlay.classList.add('hidden');
  els.pause.classList.add('hidden');
  els.gameover.classList.add('hidden');
  els.win.classList.add('hidden');
  els.intro.classList.add('hidden');
  state = 'menu';
  world.setMode('menu');
  game.state = 'idle';
  world.hideAllCharacters();
  updateNightCards();
  updateMuteUI();
}

function updateNightCards() {
  const cards = $$('.night-card');
  cards.forEach(c => {
    const n = +c.dataset.night;
    const locked = n > game.unlocked;
    c.classList.toggle('locked', locked);
    c.classList.toggle('selected', n === selectedNight);
    const sub = c.querySelector('.n-sub');
    sub.textContent = locked ? 'Locked' : NIGHT_SUBS[n - 1];
  });
  els.startNight.textContent = `START NIGHT ${selectedNight}`;
}

$$('.night-card').forEach(card => {
  card.addEventListener('click', () => {
    const n = +card.dataset.night;
    if (n > game.unlocked) {
      showToast('Finish the previous night to unlock this one.');
      audio.ui();
      return;
    }
    selectedNight = n;
    audio.ui();
    updateNightCards();
  });
});
els.startNight.addEventListener('click', () => {
  audio.init();
  audio.click();
  beginNightFlow(selectedNight);
});

/* ------------------------------------------------------------------ night */
function beginNightFlow(n) {
  selectedNight = n;
  clearTimeout(deathTimer); clearTimeout(winTimer);
  els.menu.classList.add('hidden');
  els.gameover.classList.add('hidden');
  els.win.classList.add('hidden');
  els.pause.classList.add('hidden');
  els.camOverlay.classList.add('hidden');
  els.hud.classList.add('hidden');
  els.flash.classList.add('hidden');
  els.toast.classList.add('hidden');
  if (promptTimer) clearTimeout(promptTimer);
  els.viewPrompt.classList.add('hidden');

  world.setMode('office');
  world.reset();
  world.setPower(1);
  world.hideAllCharacters();
  world._foxyRunning = false;
  world.setFoxyRunning(false);
  cornerCache.left = cornerCache.right = null;
  game.startNight(n);
  look = { yaw: 0, pitch: -0.07 };
  world.yaw = world.targetYaw = 0;
  world.pitch = world.targetPitch = -0.07;
  world.lookEnabled = false;

  const intro = INTROS[n - 1] || INTROS[4];
  els.introNight.textContent = `NIGHT ${n}`;
  els.introTxt.innerHTML = `${intro.t}<br><br><span style="color:#8f8269;font-size:11.5px">${intro.k}</span>`;
  els.intro.classList.remove('hidden');
  els.introGo.textContent = n === 1 ? 'BEGIN SHIFT' : 'CLOCK IN';
  state = 'intro';
  audio.setTension(.25);
  updateHud(true);
}

function beginShift() {
  if (state !== 'intro') return;
  els.intro.classList.add('hidden');
  state = 'playing';
  els.hud.classList.remove('hidden');
  requestAnimationFrame(() => els.hud.classList.add('live'));
  world.lookEnabled = true;
  game.state = 'playing';
  world.setPower(game.power / 100);
  audio.setTension(.32);
  showHint(state === 'playing' ? 'Drag to look around · Keep an eye on both doors' : '');
  if (hintTimer) clearTimeout(hintTimer);
  hintTimer = setTimeout(() => els.hudHint.classList.add('fade'), 8000);
  if (selectedNight === 1) {
    setTimeout(() => showToast('Tap LIGHT on either side to check the halls.'), 4500);
  }
}

els.introGo.addEventListener('click', () => { audio.init(); audio.click(); beginShift(); });
els.introSkip.addEventListener('click', () => { audio.init(); audio.click(); beginShift(); });

/* ------------------------------------------------------------------ controls */
function setLook(dx, dy) {
  const sens = 0.0033;
  look.yaw = clamp(look.yaw - dx * sens, -1.52, 1.52);
  look.pitch = clamp(look.pitch - dy * 0.0025, -0.36, 0.28);
  world.targetYaw = look.yaw;
  world.targetPitch = look.pitch;
}

function onPointerDown(e) {
  audio.init();
  if (state !== 'playing' || game.camOpen || e.button === 1) return;
  if (e.target.closest('button') || e.target.closest('.overlay')) return;
  drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
  try { e.target.setPointerCapture(e.pointerId); } catch {}
}
function onPointerMove(e) {
  if (state === 'menu') {
    world.menuPointer = { x: (e.clientX / window.innerWidth - .5) * 2, y: (e.clientY / window.innerHeight - .5) * 2 };
  }
  if (!drag || e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  drag.x = e.clientX; drag.y = e.clientY;
  setLook(dx, dy);
}
function onPointerUp(e) {
  if (drag && e.pointerId === drag.id) drag = null;
}
window.addEventListener('pointerdown', onPointerDown, { passive: true });
window.addEventListener('pointermove', onPointerMove, { passive: true });
window.addEventListener('pointerup', onPointerUp, { passive: true });
window.addEventListener('pointercancel', onPointerUp, { passive: true });
window.addEventListener('contextmenu', e => e.preventDefault());

$$('.ctrl-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (state !== 'playing') return;
    audio.init();
    const a = btn.dataset.action;
    if (a === 'leftDoor') game.toggleDoor('left');
    else if (a === 'rightDoor') game.toggleDoor('right');
    else if (a === 'leftLight') game.toggleLight('left');
    else if (a === 'rightLight') game.toggleLight('right');
    btn.classList.add('busy');
    setTimeout(() => btn.classList.remove('busy'), 260);
    updateHud(true);
  });
});

els.camsBtn.addEventListener('click', () => {
  if (state !== 'playing') return;
  audio.init();
  if (game.camOpen) game.closeCams(); else game.openCams();
});
els.camsClose.addEventListener('click', () => { if (game.camOpen) game.closeCams(); });

$$('.cam-sel').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!game.camOpen) return;
    game.selectCam(btn.dataset.cam);
  });
});

window.addEventListener('keydown', e => {
  if (e.repeat) return;
  keys.add(e.key.toLowerCase());
  if (state === 'playing') {
    if (e.code === 'Space') { e.preventDefault(); game.camOpen ? game.closeCams() : game.openCams(); }
    if (e.key === 'Escape') { if (game.camOpen) game.closeCams(); else pauseGame(); }
    if (e.key === '1') game.toggleDoor('left');
    if (e.key === '2') game.toggleLight('left');
    if (e.key === '3') game.toggleLight('right');
    if (e.key === '4') game.toggleDoor('right');
  } else if (state === 'paused' && e.key === 'Escape') {
    resumeGame();
  }
});
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));

function handleCams(open) {
  if (open) {
    els.camOverlay.classList.remove('hidden');
    els.camsBtn.classList.add('active');
    els.viewPrompt.classList.add('hidden');
    feed.setCam(game.cam);
    updateActiveCam(game.cam);
    glitchFeed(1.4);
    feed.draw(game, 0.016);
    setFeedClock();
  } else {
    els.camOverlay.classList.add('hidden');
    els.camsBtn.classList.remove('active');
    if (state === 'playing') {
      world.lookEnabled = true;
      showHint('Tablet down · Check the doors');
      setTimeout(() => els.hudHint.classList.add('fade'), 2400);
    }
  }
}
function handleCamSwitch(id) {
  updateActiveCam(id);
  glitchFeed(1);
}
function updateActiveCam(id) {
  $$('.cam-sel').forEach(b => b.classList.toggle('active', b.dataset.cam === id));
  const map = {
    '1A': 'SHOW STAGE', '1B': 'DINING AREA', '1C': 'PIRATE COVE',
    '2A': 'WEST HALL', '2B': 'WEST HALL CORNER', '3': 'SUPPLY CLOSET',
    '4A': 'EAST HALL', '4B': 'EAST HALL CORNER', '5': 'BACKSTAGE'
  };
  els.feedLabel.textContent = `CAM ${id} · ${map[id]}`;
}

/* ------------------------------------------------------------------ events */
function handleDeath(by, reason) {
  if (state === 'dead' || state === 'won') return;
  state = 'dead';
  clearTimeout(hintTimer); clearTimeout(deathTimer);
  els.camOverlay.classList.add('hidden');
  els.camsBtn.classList.remove('active');
  els.viewPrompt.classList.add('hidden');
  els.hud.classList.remove('live');
  els.hud.classList.add('hidden');
  audio.scream();
  audio.setTension(.9);
  world.lookEnabled = false;
  world.playJumpscare(by);
  flash('#b4302a', 220);
  document.body.classList.add('shaking');
  setTimeout(() => document.body.classList.remove('shaking'), 850);
  deathTimer = setTimeout(() => {
    els.hud.classList.add('hidden');
    world.stopJumpscare();
    flash('#000', 300);
    const names = { freddy: 'Freddy', bonnie: 'Bonnie', chica: 'Chica', foxy: 'Foxy' };
    els.goSub.textContent = reason === 'blackout' ? 'The power ran out. Something came for you in the dark.' : `${names[by] || 'Something'} reached the office.`;
    els.goNight.textContent = game.night;
    els.goPower.textContent = `${Math.round(game.power)}%`;
    els.goTime.textContent = `${game.displayHour()} AM`;
    world.blackout();
    els.gameover.classList.remove('hidden');
  }, 1550);
}

function handleWin(night) {
  if (state === 'won') return;
  state = 'won';
  clearTimeout(hintTimer); clearTimeout(winTimer);
  els.camOverlay.classList.add('hidden');
  els.camsBtn.classList.remove('active');
  els.viewPrompt.classList.add('hidden');
  els.hud.classList.remove('live');
  world.lookEnabled = false;
  world.stopJumpscare();
  world.cheer();
  audio.chime();
  audio.setTension(.1);
  flash('#fff8e6', 750);
  winTimer = setTimeout(() => {
    els.hud.classList.add('hidden');
    els.winSub.textContent = night >= 5 ? 'You survived the whole week. Nobody else has.' : `You survived Night ${night}.`;
    const stars = game.power > 55 ? 3 : game.power > 22 ? 2 : 1;
    els.winStars.textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    els.winStars.title = `${stars} star shift`;
    const total = (20 + (night - 1) * 2).toFixed(2);
    const payTotal = document.querySelector('.pay-row.total b');
    if (payTotal) payTotal.textContent = `$${total}`;
    const payBase = document.querySelector('.pay-row b');
    if (payBase) payBase.textContent = `$${total}`;
    els.nextNightBtn.classList.toggle('hidden', night >= 5);
    els.nextNightBtn.textContent = `NIGHT ${night + 1}`;
    els.win.classList.remove('hidden');
    game.unlocked = Math.max(game.unlocked, Math.min(5, night + 1));
    updateNightCards();
    selectedNight = Math.min(5, night + 1);
  }, 2100);
}

function handleHour(idx, hour) {
  if (idx === 5) showToast('5 AM. One more hour.', 'good');
  else showToast(`${hour} AM`, 'good');
  flash('#000', 60);
}

function handlePowerOut() {
  world.blackout();
  els.camOverlay.classList.add('hidden');
  els.camsBtn.classList.remove('active');
  world.lookEnabled = false;
  showToast('POWER OUT — the doors are open.');
  audio.setTension(1);
  setTimeout(() => showHint('You shouldn’t have wasted it.'), 1200);
}

function showHint(text) {
  els.hudHint.textContent = text;
  els.hudHint.classList.remove('fade');
}
function showToast(text, kind = '') {
  els.toast.textContent = text;
  els.toast.className = kind;
  els.toast.classList.remove('hidden');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.add('hidden'), 2700);
}
function showPrompt(text, ms = 2200) {
  els.viewPrompt.textContent = text;
  els.viewPrompt.classList.remove('hidden');
  if (promptTimer) clearTimeout(promptTimer);
  promptTimer = setTimeout(() => els.viewPrompt.classList.add('hidden'), ms);
}
function glitchFeed(amount = 1) {
  const g = els.camOverlay.querySelector('.feed-glitch');
  if (!g) return;
  g.classList.remove('on');
  void g.offsetWidth;
  g.classList.add('on');
  feed.drawStaticBurst(amount);
}
function flash(color = '#fff', ms = 140) {
  const f = els.flash;
  f.style.background = color;
  f.classList.remove('hidden');
  const anim = f.animate([{ opacity: .85 }, { opacity: 0 }], { duration: ms, easing: 'ease-out' });
  anim.onfinish = () => f.classList.add('hidden');
}

/* ------------------------------------------------------------------ pause */
function pauseGame() {
  if (state !== 'playing') return;
  state = 'paused';
  els.pause.classList.remove('hidden');
  els.pauseBtn.classList.add('active');
  world.lookEnabled = false;
  if (game.camOpen) game.closeCams();
}
function resumeGame() {
  if (state !== 'paused') return;
  state = 'playing';
  els.pause.classList.add('hidden');
  els.pauseBtn.classList.remove('active');
  world.lookEnabled = !game.camOpen;
  last = performance.now();
}
els.pauseBtn.addEventListener('click', () => state === 'paused' ? resumeGame() : pauseGame());
els.resumeBtn.addEventListener('click', resumeGame);
els.pauseMenuBtn.addEventListener('click', () => {
  els.pause.classList.add('hidden');
  startMenu();
});

/* ------------------------------------------------------------------ game over / win buttons */
els.retryBtn.addEventListener('click', () => {
  audio.init(); audio.click();
  beginNightFlow(game.night);
});
els.goMenuBtn.addEventListener('click', () => { audio.click(); startMenu(); });
els.nextNightBtn.addEventListener('click', () => {
  audio.click();
  beginNightFlow(Math.min(5, selectedNight));
});
els.winMenuBtn.addEventListener('click', () => { audio.click(); startMenu(); });

/* ------------------------------------------------------------------ mute */
function updateMuteUI() {
  els.muteBtn.classList.toggle('off', audio.muted);
  els.menuSound.classList.toggle('off', audio.muted);
  els.muteBtn.textContent = audio.muted ? '♪̶' : '♫';
}
function toggleMute() {
  audio.init();
  audio.setMuted(!audio.muted);
  updateMuteUI();
  audio.ui();
  try { localStorage.setItem('fnf_muted', audio.muted ? '1' : '0'); } catch {}
}
els.muteBtn.addEventListener('click', toggleMute);
els.menuSound.addEventListener('click', toggleMute);

/* ------------------------------------------------------------------ HUD / feed */
function updateHud(force = false) {
  if (!game) return;
  const pct = Math.round(game.getPowerPct());
  const time = game.clockString();
  if (force || time !== lastHud.time) { els.hudTime.textContent = time; lastHud.time = time; }
  if (force || pct !== lastHud.power) {
    els.powerPct.textContent = `${pct}%`;
    const on = Math.ceil(pct / 10);
    els.powerBars.forEach((b, i) => {
      b.className = i < on ? (pct < 12 ? 'crit' : pct < 30 ? 'low' : 'on') : '';
    });
    lastHud.power = pct;
  }
  const low = pct <= 18;
  if (force || low !== lastHud.low) {
    els.power.classList.toggle('critical', low);
    document.body.classList.toggle('power-low', low && state === 'playing');
    lastHud.low = low;
  }
  const usage = Math.round(game.usage * 2) / 2;
  if (force || usage !== lastHud.usage) {
    els.usageBars.forEach((b, i) => {
      const v = i + 1;
      b.className = usage >= v - .2 ? (usage >= 3 ? 'hot' : 'on') : '';
    });
    lastHud.usage = usage;
  }
  const doors = `${game.doors.left ? 1 : 0}${game.doors.right ? 1 : 0}`;
  if (force || doors !== lastHud.doors) {
    document.querySelector('[data-action="leftDoor"]').classList.toggle('on', game.doors.left);
    document.querySelector('[data-action="rightDoor"]').classList.toggle('on', game.doors.right);
    lastHud.doors = doors;
  }
  const lights = `${game.lights.left ? 1 : 0}${game.lights.right ? 1 : 0}`;
  if (force || lights !== lastHud.lights) {
    const l = document.querySelector('[data-action="leftLight"]');
    const r = document.querySelector('[data-action="rightLight"]');
    l.classList.toggle('on', game.lights.left);
    r.classList.toggle('on', game.lights.right);
    l.classList.toggle('light', true);
    r.classList.toggle('light', true);
    lastHud.lights = lights;
  }
  if (force || game.camOpen !== lastHud.cam) {
    els.camsBtn.classList.toggle('active', game.camOpen);
    lastHud.cam = game.camOpen;
  }
}

function setFeedClock() {
  if (!game) return;
  const h = game.displayHour();
  const total = Math.floor(game.nightT * 12.5);
  const mm = String(total % 60).padStart(2, '0');
  const ss = String(Math.floor((game.nightT * 60) % 60)).padStart(2, '0');
  els.feedTime.textContent = `${h}:${mm}:${ss} AM`;
  els.camHeaderTime.textContent = `${h}:${mm} AM · NIGHT ${game.night}`;
  let warn = '';
  for (const k in game.ai) {
    const a = game.ai[k];
    if (game.camMatches(k, a)) { warn = '● MOTION'; break; }
  }
  els.camWarn.textContent = warn;
}

function syncWorldCharacters() {
  if (!game.ai) return;
  for (const side of ['left', 'right']) {
    const a = game.aiAtDoor(side);
    const type = a ? (a.name === 'freddy' ? 'freddy' : a.name) : null;
    if (cornerCache[side] !== type) {
      cornerCache[side] = type;
      world.setCornerCharacter(side, type);
    }
  }
  const f = game.foxy;
  const running = f.running;
  if (world._foxyRunning !== running) {
    world._foxyRunning = running;
    if (!running) world.setFoxyRunning(false);
  }
  if (running) world.setFoxyRunning(true, clamp(f.runT / 1.75, 0, 1));
}

/* ------------------------------------------------------------------ loop */
function tick(now) {
  requestAnimationFrame(tick);
  let dt = (now - last) / 1000;
  last = now;
  if (dt > .1) dt = .1;
  if (dt <= 0) dt = .016;

  // keyboard look
  if (state === 'playing' && !game.camOpen) {
    let kx = 0, ky = 0;
    if (keys.has('arrowleft') || keys.has('a')) kx -= 1;
    if (keys.has('arrowright') || keys.has('d')) kx += 1;
    if (keys.has('arrowup') || keys.has('w')) ky -= 1;
    if (keys.has('arrowdown') || keys.has('s')) ky += 1;
    if (kx || ky) {
      look.yaw = clamp(look.yaw - kx * dt * 1.35, -1.52, 1.52);
      look.pitch = clamp(look.pitch - ky * dt * .75, -.32, .3);
      world.targetYaw = look.yaw;
      world.targetPitch = look.pitch;
    }
  }

  if (state === 'playing') {
    game.update(dt);
    updateHud();
    syncWorldCharacters();
    for (const side of ['left', 'right']) {
      world.setDoor(side, game.doors[side]);
      world.setLight(side, game.lights[side]);
    }
    world.setPower(game.power / 100);
    if (game.camOpen) {
      feedAcc += dt;
      if (feedAcc > .075) {
        feedAcc = 0;
        feed.draw(game, .075);
        setFeedClock();
      }
    }
  } else if (state === 'dead' || state === 'won') {
    world.setPower(game.power / 100);
  }

  world.update(dt);

  // adaptive quality for sustained mobile framerates
  fpsAcc += dt; fpsFrames++;
  if (fpsAcc > 2.2) {
    const fps = fpsFrames / fpsAcc;
    if (fps < 46 && quality > .62) {
      quality = Math.max(.62, quality - .11);
      world.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75) * quality);
      goodWindows = 0;
    } else if (fps > 57 && quality < 1) {
      goodWindows++;
      if (goodWindows >= 3) {
        quality = Math.min(1, quality + .08);
        world.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75) * quality);
        goodWindows = 0;
      }
    }
    fpsAcc = 0; fpsFrames = 0;
  }
}

/* ------------------------------------------------------------------ resize / visibility */
window.addEventListener('resize', () => {
  if (world) world.resize(window.innerWidth, window.innerHeight);
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'playing') pauseGame();
});

/* ------------------------------------------------------------------ init */
(async () => {
  await boot();
  try { if (localStorage.getItem('fnf_muted') === '1') { audio.muted = true; } } catch {}
  updateMuteUI();
  els.bootStart.addEventListener('click', startMenu, { once: true });
  requestAnimationFrame(tick);
})();
