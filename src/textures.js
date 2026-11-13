import * as THREE from '../vendor/three.module.min.js';

let seed = 1337;
export function rand() {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
}
export function resetSeed(s = 1337) { seed = s; }

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
export function finish(c, repeatX = 1, repeatY = 1) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.anisotropy = 4;
  return t;
}
function grime(ctx, w, h, amount = 40, dark = 'rgba(35,28,20,') {
  for (let i = 0; i < amount; i++) {
    const x = rand() * w, y = rand() * h;
    const r = 4 + rand() * 46;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const a = .03 + rand() * .08;
    g.addColorStop(0, dark + a + ')');
    g.addColorStop(1, dark + '0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}
function scratches(ctx, w, h, n = 24, color = 'rgba(255,255,255,.08)') {
  ctx.strokeStyle = color;
  for (let i = 0; i < n; i++) {
    ctx.lineWidth = .4 + rand() * 1.2;
    const x = rand() * w, y = rand() * h;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rand() - .5) * 80, y + (rand() - .5) * 26);
    ctx.stroke();
  }
}

/* ---------------------------------------------------------- walls */
export function wallTexture() {
  const w = 512, h = 512, c = canvas(w, h), x = c.getContext('2d');
  x.fillStyle = '#a79b80';
  x.fillRect(0, 0, w, h);
  // vertical wallpaper stripes
  for (let i = 0; i < w; i += 32) {
    x.fillStyle = i % 64 === 0 ? 'rgba(100,86,60,.13)' : 'rgba(255,246,218,.045)';
    x.fillRect(i, 0, 16, h);
  }
  // fine noise
  const id = x.getImageData(0, 0, w, h);
  for (let i = 0; i < id.data.length; i += 4) {
    const n = (rand() - .5) * 16;
    id.data[i] += n; id.data[i + 1] += n; id.data[i + 2] += n;
  }
  x.putImageData(id, 0, 0);
  // water damage streaks from top
  for (let i = 0; i < 7; i++) {
    const sx = rand() * w, sw = 10 + rand() * 34;
    const g = x.createLinearGradient(sx, 0, sx, h * (.4 + rand() * .6));
    g.addColorStop(0, 'rgba(58,44,26,.20)');
    g.addColorStop(.5, 'rgba(58,44,26,.07)');
    g.addColorStop(1, 'rgba(58,44,26,0)');
    x.fillStyle = g;
    x.fillRect(sx, 0, sw, h);
  }
  grime(x, w, h, 55, 'rgba(40,30,18,');
  scratches(x, w, h, 30, 'rgba(255,250,230,.06)');
  return finish(c, 2, 2);
}

export function wainscotTexture() {
  const w = 512, h = 256, c = canvas(w, h), x = c.getContext('2d');
  x.fillStyle = '#412f20';
  x.fillRect(0, 0, w, h);
  const g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(255,220,170,.13)');
  g.addColorStop(.25, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,.35)');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 8; i++) {
    x.strokeStyle = 'rgba(20,12,8,.35)'; x.lineWidth = 2;
    x.beginPath(); x.moveTo(i * 64 + 32, 0); x.lineTo(i * 64 + 32, h); x.stroke();
    x.strokeStyle = 'rgba(255,230,190,.06)'; x.lineWidth = 1;
    x.beginPath(); x.moveTo(i * 64 + 33, 0); x.lineTo(i * 64 + 33, h); x.stroke();
  }
  x.strokeStyle = 'rgba(20,12,8,.5)'; x.lineWidth = 5;
  x.strokeRect(2, 2, w - 4, h - 4);
  grime(x, w, h, 30, 'rgba(10,6,3,');
  scratches(x, w, h, 40);
  return finish(c, 3, 1);
}

export function ceilingTexture() {
  const w = 256, h = 256, c = canvas(w, h), x = c.getContext('2d');
  x.fillStyle = '#26231d'; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 16; i++) {
    x.fillStyle = `rgba(${120 + rand() * 30},${112 + rand() * 30},${96 + rand() * 20},${.18 + rand() * .22})`;
    x.beginPath();
    x.arc(rand() * w, rand() * h, 2 + rand() * 10, 0, 7);
    x.fill();
  }
  x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = 2;
  for (let i = 0; i < 8; i++) { x.beginPath(); x.moveTo(0, i * 32); x.lineTo(w, i * 32); x.stroke(); }
  return finish(c, 4, 4);
}

export function floorTexture() {
  const w = 512, h = 512, c = canvas(w, h), x = c.getContext('2d');
  const n = 4, s = w / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const dark = (i + j) % 2 === 0;
    x.fillStyle = dark ? '#25221d' : '#b6a98d';
    x.fillRect(i * s, j * s, s, s);
    // tile edge bevel
    x.fillStyle = dark ? 'rgba(255,255,255,.035)' : 'rgba(255,255,255,.12)';
    x.fillRect(i * s, j * s, s, 2);
    x.fillStyle = 'rgba(0,0,0,.16)';
    x.fillRect(i * s, j * s + s - 3, s, 3);
  }
  // grout lines
  x.strokeStyle = 'rgba(20,17,12,.55)'; x.lineWidth = 3;
  for (let i = 0; i <= n; i++) {
    x.beginPath(); x.moveTo(i * s, 0); x.lineTo(i * s, h); x.stroke();
    x.beginPath(); x.moveTo(0, i * s); x.lineTo(w, i * s); x.stroke();
  }
  grime(x, w, h, 80, 'rgba(25,20,12,');
  scratches(x, w, h, 70, 'rgba(255,255,255,.07)');
  // scuff marks
  for (let i = 0; i < 16; i++) {
    x.strokeStyle = `rgba(18,14,9,${.12 + rand() * .2})`;
    x.lineWidth = 1 + rand() * 3;
    x.beginPath();
    const px = rand() * w, py = rand() * h;
    x.arc(px, py, 4 + rand() * 22, rand() * 7, rand() * 7);
    x.stroke();
  }
  return finish(c, 4, 4);
}

/* ---------------------------------------------------------- posters */
function posterBase(x, w, h, color = '#7a241e') {
  x.fillStyle = color; x.fillRect(0, 0, w, h);
  const g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(255,230,180,.12)');
  g.addColorStop(1, 'rgba(0,0,0,.32)');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.strokeStyle = 'rgba(255,240,210,.35)'; x.lineWidth = 4;
  x.strokeRect(10, 10, w - 20, h - 20);
  x.strokeStyle = 'rgba(0,0,0,.4)'; x.lineWidth = 1;
  x.strokeRect(14, 14, w - 28, h - 28);
}
function bearHead(x, cx, cy, s, color = '#6d4527', muzzle = '#b08a5c') {
  x.save();
  x.translate(cx, cy); x.scale(s, s);
  // ears
  x.fillStyle = color;
  for (const sx of [-1, 1]) {
    x.beginPath(); x.arc(sx * 34, -34, 15, 0, 7); x.fill();
    x.fillStyle = '#3b2717';
    x.beginPath(); x.arc(sx * 34, -34, 8, 0, 7); x.fill();
    x.fillStyle = color;
  }
  x.beginPath();
  x.ellipse(0, 0, 40, 36, 0, 0, 7); x.fill();
  x.fillStyle = muzzle;
  x.beginPath(); x.ellipse(0, 12, 25, 19, 0, 0, 7); x.fill();
  // eyes
  x.fillStyle = '#efe4c8';
  for (const sx of [-1, 1]) { x.beginPath(); x.arc(sx * 15, -9, 7, 0, 7); x.fill(); }
  x.fillStyle = '#16110c';
  for (const sx of [-1, 1]) { x.beginPath(); x.arc(sx * 15, -8, 3.2, 0, 7); x.fill(); }
  // nose + mouth
  x.fillStyle = '#241910';
  x.beginPath(); x.ellipse(0, 6, 6, 4.5, 0, 0, 7); x.fill();
  x.strokeStyle = '#241910'; x.lineWidth = 2;
  x.beginPath(); x.moveTo(0, 10); x.lineTo(0, 16); x.stroke();
  x.beginPath(); x.arc(-7, 15, 6, 0, Math.PI); x.stroke();
  x.beginPath(); x.arc(7, 15, 6, 0, Math.PI); x.stroke();
  // hat
  x.fillStyle = '#171310';
  x.fillRect(-20, -56, 40, 20);
  x.beginPath(); x.ellipse(0, -36, 30, 6, 0, 0, 7); x.fill();
  x.restore();
}
function rabbitHead(x, cx, cy, s, color = '#5d4a86', muzzle = '#8d7bb4') {
  x.save(); x.translate(cx, cy); x.scale(s, s);
  x.fillStyle = color;
  for (const sx of [-1, 1]) {
    x.beginPath(); x.ellipse(sx * 15, -52, 10, 30, sx * .18, 0, 7); x.fill();
    x.fillStyle = muzzle;
    x.beginPath(); x.ellipse(sx * 15, -52, 4.5, 21, sx * .18, 0, 7); x.fill();
    x.fillStyle = color;
  }
  x.beginPath(); x.ellipse(0, 0, 34, 33, 0, 0, 7); x.fill();
  x.fillStyle = muzzle;
  x.beginPath(); x.ellipse(0, 14, 19, 15, 0, 0, 7); x.fill();
  x.fillStyle = '#efe4c8';
  for (const sx of [-1, 1]) { x.beginPath(); x.arc(sx * 13, -8, 6.5, 0, 7); x.fill(); }
  x.fillStyle = '#c22e2a';
  for (const sx of [-1, 1]) { x.beginPath(); x.arc(sx * 13, -7, 3, 0, 7); x.fill(); }
  x.fillStyle = '#a13f86';
  x.beginPath(); x.ellipse(0, 8, 6, 4, 0, 0, 7); x.fill();
  x.strokeStyle = '#241a2c'; x.lineWidth = 1.8;
  x.beginPath(); x.moveTo(0, 12); x.lineTo(0, 17); x.stroke();
  x.beginPath(); x.arc(-6, 16, 5, 0, Math.PI); x.stroke();
  x.beginPath(); x.arc(6, 16, 5, 0, Math.PI); x.stroke();
  x.restore();
}
function chickHead(x, cx, cy, s, color = '#d8b84a') {
  x.save(); x.translate(cx, cy); x.scale(s, s);
  x.fillStyle = color;
  x.beginPath(); x.ellipse(0, 0, 34, 34, 0, 0, 7); x.fill();
  // feather tufts
  for (const sx of [-1, 1]) {
    x.beginPath(); x.moveTo(sx * 10, -28); x.quadraticCurveTo(sx * 25, -52, sx * 4, -46); x.quadraticCurveTo(sx * 16, -35, sx * 8, -27); x.fill();
  }
  // beak
  x.fillStyle = '#e88a2e';
  x.beginPath(); x.moveTo(-15, 8); x.lineTo(15, 8); x.lineTo(0, 24); x.closePath(); x.fill();
  x.fillStyle = '#c46c1c';
  x.beginPath(); x.moveTo(-10, 15); x.lineTo(10, 15); x.lineTo(0, 25); x.closePath(); x.fill();
  // eyes
  x.fillStyle = '#efe4c8';
  for (const sx of [-1, 1]) { x.beginPath(); x.arc(sx * 13, -8, 7, 0, 7); x.fill(); }
  x.fillStyle = '#5b3d86';
  for (const sx of [-1, 1]) { x.beginPath(); x.arc(sx * 13, -8, 3.4, 0, 7); x.fill(); }
  x.restore();
}
function foxHead(x, cx, cy, s) {
  x.save(); x.translate(cx, cy); x.scale(s, s);
  x.fillStyle = '#8c3423';
  for (const sx of [-1, 1]) {
    x.beginPath(); x.moveTo(sx * 22, -24); x.lineTo(sx * 40, -52); x.lineTo(sx * 40, -18); x.closePath(); x.fill();
    x.fillStyle = '#c9795f';
    x.beginPath(); x.moveTo(sx * 26, -25); x.lineTo(sx * 36, -44); x.lineTo(sx * 36, -22); x.closePath(); x.fill();
    x.fillStyle = '#8c3423';
  }
  x.beginPath(); x.ellipse(0, 0, 33, 30, 0, 0, 7); x.fill();
  x.fillStyle = '#b8613f';
  x.beginPath(); x.moveTo(-18, 6); x.lineTo(18, 6); x.lineTo(0, 25); x.closePath(); x.fill();
  x.fillStyle = '#efe4c8';
  for (const sx of [-1, 1]) { x.beginPath(); x.arc(sx * 13, -8, 6.5, 0, 7); x.fill(); }
  x.fillStyle = '#1b120b';
  for (const sx of [-1, 1]) { x.beginPath(); x.arc(sx * 13, -7, 3, 0, 7); x.fill(); }
  // eyepatch
  x.strokeStyle = '#17110c'; x.lineWidth = 2.5;
  x.beginPath(); x.moveTo(-26, -16); x.lineTo(24, -22); x.stroke();
  x.fillStyle = '#17110c';
  x.beginPath(); x.ellipse(-13, -7, 9, 8, 0, 0, 7); x.fill();
  x.fillStyle = '#241910';
  x.beginPath(); x.ellipse(0, 4, 7, 5, 0, 0, 7); x.fill();
  x.restore();
}

export function posterTexture(kind = 'main') {
  const w = 384, h = 512, c = canvas(w, h), x = c.getContext('2d');
  if (kind === 'main') {
    posterBase(x, w, h, '#7d2a22');
    x.textAlign = 'center';
    x.fillStyle = '#f5e5c1';
    x.font = 'bold 34px Georgia, serif';
    x.fillText("FREDDY FAZBEAR'S", w / 2, 62);
    x.font = 'bold 22px Georgia, serif';
    x.fillStyle = '#ffce7a';
    x.fillText('P I Z Z A', w / 2, 92);
    bearHead(x, w / 2, 205, 1.55);
    x.fillStyle = '#f5e5c1';
    x.font = 'bold 40px Georgia, serif';
    x.fillText("LET'S PARTY!", w / 2, 358);
    x.font = '16px Georgia, serif';
    x.fillStyle = '#d9b98c';
    x.fillText('OPEN TIL LATE  ·  KIDS EAT FREE', w / 2, 392);
    for (let i = 0; i < 26; i++) {
      x.fillStyle = ['#e6c063', '#c9463a', '#7a9c6a', '#d7d0bb'][i % 4];
      x.beginPath(); x.arc(18 + rand() * (w - 36), 410 + rand() * 80, 2 + rand() * 4, 0, 7); x.fill();
    }
    x.fillStyle = '#f5e5c1'; x.font = 'italic 13px Georgia, serif';
    x.fillText('A magical place for kids and grown-ups alike', w / 2, 486);
  } else if (kind === 'celebrate') {
    posterBase(x, w, h, '#2c3f52');
    x.textAlign = 'center';
    x.fillStyle = '#ffe1a1'; x.font = 'bold 52px Georgia, serif';
    x.fillText('CELEBRATE!', w / 2, 68);
    bearHead(x, w / 2, 175, 1.1);
    foxHead(x, w / 2 - 92, 300, .82);
    chickHead(x, w / 2 + 92, 300, .82);
    x.fillStyle = '#efe2c4'; x.font = 'bold 21px Georgia, serif';
    x.fillText('WITH FREDDY & FRIENDS', w / 2, 400);
    x.font = '13px Georgia, serif'; x.fillStyle = '#a9c2d6';
    x.fillText('BIRTHDAYS  ·  PARTIES  ·  PIZZA', w / 2, 428);
    // confetti
    for (let i = 0; i < 60; i++) {
      x.save(); x.translate(rand() * w, rand() * h); x.rotate(rand() * 7);
      x.fillStyle = ['#e6c063', '#c9463a', '#7a9c6a', '#d7d0bb', '#6b8fd6'][i % 5];
      x.fillRect(-3, -1.5, 6, 3); x.restore();
    }
  } else if (kind === 'safety') {
    posterBase(x, w, h, '#c9b46a');
    x.textAlign = 'center';
    x.fillStyle = '#241f14'; x.font = 'bold 34px Georgia, serif';
    x.fillText('SAFETY FIRST', w / 2, 56);
    x.fillStyle = '#241f14'; x.font = 'bold 17px Georgia, serif';
    x.fillText('EMPLOYEES MUST WASH HANDS', w / 2, 84);
    // cartoon hands under tap
    x.strokeStyle = '#2b2a1e'; x.lineWidth = 6; x.lineCap = 'round';
    x.beginPath(); x.moveTo(110, 130); x.lineTo(110, 215); x.quadraticCurveTo(110, 245, 140, 245); x.stroke();
    x.beginPath(); x.moveTo(82, 160); x.lineTo(140, 160); x.stroke();
    x.fillStyle = '#8da7b5';
    for (let i = 0; i < 4; i++) { x.beginPath(); x.ellipse(112 + i * 10, 230 + (i % 2) * 8, 3, 7, 0, 0, 7); x.fill(); }
    x.fillStyle = '#2b2a1e'; x.font = 'bold 30px Georgia, serif';
    x.fillText('NO FOOD IN THE OFFICE', w / 2, 330);
    x.font = '15px Georgia, serif';
    x.fillText('DO NOT MOLEST THE ANIMATRONICS', w / 2, 366);
    x.fillText('REPORT ANY MALFUNCTIONS', w / 2, 390);
    x.strokeStyle = '#241f14'; x.lineWidth = 2;
    x.strokeRect(24, 412, w - 48, 62);
    x.font = 'bold 15px Georgia, serif';
    x.fillText('FAZBEAR ENTERTAINMENT', w / 2, 438);
    x.font = '11px Georgia, serif';
    x.fillText('IS NOT RESPONSIBLE FOR INJURY OR LOSS', w / 2, 458);
  } else if (kind === 'employee') {
    x.fillStyle = '#171310'; x.fillRect(0, 0, w, h);
    x.strokeStyle = '#a8925e'; x.lineWidth = 6; x.strokeRect(12, 12, w - 24, h - 24);
    x.textAlign = 'center'; x.fillStyle = '#d9c79a'; x.font = 'bold 24px Georgia, serif';
    x.fillText('EMPLOYEE OF', w / 2, 54);
    x.fillText('THE MONTH', w / 2, 82);
    x.fillStyle = '#2b241c'; x.fillRect(58, 112, w - 116, 240);
    // blurry face
    const g = x.createRadialGradient(w / 2, 210, 10, w / 2, 210, 120);
    g.addColorStop(0, '#c5a98a'); g.addColorStop(.5, '#8a715a'); g.addColorStop(1, '#2b241c');
    x.fillStyle = g; x.beginPath(); x.ellipse(w / 2, 220, 74, 94, 0, 0, 7); x.fill();
    x.fillStyle = '#191410';
    x.beginPath(); x.ellipse(w / 2, 158, 76, 54, 0, 0, 7); x.fill();
    for (let i = 0; i < 4; i++) {
      x.fillStyle = `rgba(0,0,0,${.22 + i * .1})`;
      x.fillRect(58, 112 + i * 60, w - 116, 30);
    }
    x.fillStyle = '#e8dcbd'; x.font = 'bold 20px "Courier New", monospace';
    x.fillText('M I K E', w / 2, 400);
    x.fillStyle = '#8a7d60'; x.font = '12px "Courier New", monospace';
    x.fillText('NIGHT SECURITY  ·  OCTOBER', w / 2, 424);
    x.fillStyle = '#b4302a'; x.font = 'bold 13px "Courier New", monospace';
    x.fillText('★  MISSING  ★', w / 2, 462);
  } else if (kind === 'kids') {
    x.fillStyle = '#e6ddc4'; x.fillRect(0, 0, w, h);
    x.strokeStyle = '#8b7f66'; x.lineWidth = 2; x.strokeRect(8, 8, w - 16, h - 16);
    x.lineCap = 'round'; x.lineJoin = 'round';
    // crayon bear
    x.strokeStyle = '#7a4a24'; x.lineWidth = 9;
    x.beginPath(); x.arc(w / 2, 220, 80, 0, 7); x.stroke();
    x.beginPath(); x.arc(w / 2 - 62, 138, 26, 0, 7); x.stroke();
    x.beginPath(); x.arc(w / 2 + 62, 138, 26, 0, 7); x.stroke();
    x.beginPath(); x.ellipse(w / 2, 248, 38, 26, 0, 0, 7); x.stroke();
    x.fillStyle = '#2a2018';
    x.beginPath(); x.arc(w / 2 - 28, 204, 8, 0, 7); x.fill();
    x.beginPath(); x.arc(w / 2 + 28, 204, 8, 0, 7); x.fill();
    x.strokeStyle = '#b4302a'; x.lineWidth = 4;
    x.font = 'bold 30px "Comic Sans MS", cursive';
    x.textAlign = 'center';
    x.fillText('my friend', w / 2, 60);
    x.fillText('freddy :)', w / 2, 380);
    x.strokeStyle = '#4b7ab4'; x.lineWidth = 6;
    x.beginPath(); x.moveTo(60, 340); x.bezierCurveTo(20, 300, 100, 300, 70, 350); x.stroke();
  } else if (kind === 'cove') {
    x.fillStyle = '#d8cba6'; x.fillRect(0, 0, w, h);
    x.strokeStyle = '#3a2c1e'; x.lineWidth = 5; x.strokeRect(10, 10, w - 20, h - 20);
    x.textAlign = 'center';
    x.fillStyle = '#3a2c1e'; x.font = 'bold 42px Georgia, serif';
    x.fillText('OUT OF', w / 2, 150);
    x.fillText('ORDER', w / 2, 200);
    x.fillStyle = '#8c2c22'; x.font = 'bold 64px Georgia, serif';
    x.fillText('!', w / 2, 290);
    x.fillStyle = '#3a2c1e'; x.font = '16px Georgia, serif';
    x.fillText('SORRY FOR THE', w / 2, 360);
    x.fillText('INCONVENIENCE', w / 2, 384);
    // tape corners
    x.save(); x.translate(30, 30); x.rotate(-.3); x.fillStyle = 'rgba(230,225,200,.55)'; x.fillRect(-20, -10, 70, 24); x.restore();
    x.save(); x.translate(w - 30, 30); x.rotate(.3); x.fillStyle = 'rgba(230,225,200,.55)'; x.fillRect(-50, -10, 70, 24); x.restore();
  }
  grime(x, w, h, 26, 'rgba(20,14,8,');
  scratches(x, w, h, 18, 'rgba(255,255,255,.09)');
  // vignette
  const v = x.createRadialGradient(w / 2, h / 2, h * .28, w / 2, h / 2, h * .72);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(30,20,10,.35)');
  x.fillStyle = v; x.fillRect(0, 0, w, h);
  return finish(c, 1, 1);
}

/* ---------------------------------------------------------- props */
export function metalTexture() {
  const w = 256, h = 512, c = canvas(w, h), x = c.getContext('2d');
  x.fillStyle = '#3d3b36'; x.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 26) {
    const g = x.createLinearGradient(0, y, 0, y + 26);
    g.addColorStop(0, '#55524b'); g.addColorStop(.45, '#3c3a35'); g.addColorStop(1, '#262420');
    x.fillStyle = g; x.fillRect(0, y, w, 26);
    x.fillStyle = 'rgba(255,255,255,.09)'; x.fillRect(0, y + 1, w, 1);
    x.fillStyle = 'rgba(0,0,0,.45)'; x.fillRect(0, y + 24, w, 2);
  }
  // bolts
  for (let y = 12; y < h; y += 52) for (let bx of [14, w - 14]) {
    x.fillStyle = '#1d1b17'; x.beginPath(); x.arc(bx, y, 4, 0, 7); x.fill();
    x.fillStyle = 'rgba(255,255,255,.13)'; x.beginPath(); x.arc(bx - 1, y - 1, 2, 0, 7); x.fill();
  }
  grime(x, w, h, 40, 'rgba(80,40,20,');
  scratches(x, w, h, 50, 'rgba(255,255,255,.07)');
  return finish(c, 1, 1);
}

export function deskTexture() {
  const w = 512, h = 256, c = canvas(w, h), x = c.getContext('2d');
  x.fillStyle = '#5a402a'; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 60; i++) {
    x.strokeStyle = `rgba(${20 + rand() * 40},${14 + rand() * 28},${8 + rand() * 18},${.1 + rand() * .2})`;
    x.lineWidth = .5 + rand() * 2;
    x.beginPath();
    const y = rand() * h;
    x.moveTo(0, y);
    x.bezierCurveTo(w * .3, y + (rand() - .5) * 24, w * .6, y + (rand() - .5) * 24, w, y + (rand() - .5) * 12);
    x.stroke();
  }
  grime(x, w, h, 35, 'rgba(15,9,4,');
  scratches(x, w, h, 25, 'rgba(255,220,160,.06)');
  return finish(c, 2, 2);
}

export function screenTexture(mode = 'static') {
  const w = 512, h = 320, c = canvas(w, h), x = c.getContext('2d');
  x.fillStyle = '#06110c'; x.fillRect(0, 0, w, h);
  if (mode === 'static') {
    for (let i = 0; i < 5000; i++) {
      x.fillStyle = `rgba(${120 + rand() * 120},${150 + rand() * 90},${130 + rand() * 90},${.1 + rand() * .5})`;
      x.fillRect(rand() * w, rand() * h, 1 + rand() * 2, 1);
    }
    x.fillStyle = 'rgba(120,240,170,.9)'; x.font = 'bold 26px "Courier New", monospace';
    x.fillText('FAZBEAR OS  v1.987', 30, 60);
    x.font = '16px "Courier New", monospace';
    x.fillStyle = 'rgba(110,230,160,.78)';
    x.fillText('CAM SYSTEM ........ ONLINE', 30, 100);
    x.fillText('DOOR MOTORS ....... READY', 30, 128);
    x.fillText('POWER GRID ........ UNSTABLE', 30, 156);
    x.fillStyle = 'rgba(255,96,72,.9)';
    x.font = 'bold 15px "Courier New", monospace';
    x.fillText('!! DO NOT LEAVE OFFICE AFTER 12AM !!', 30, 208);
    x.fillStyle = 'rgba(60,140,100,.28)';
    for (let y = 0; y < h; y += 4) x.fillRect(0, y, w, 1);
  }
  return finish(c, 1, 1);
}

export function paperTexture(lines = 8) {
  const w = 256, h = 332, c = canvas(w, h), x = c.getContext('2d');
  x.fillStyle = '#d9cfb6'; x.fillRect(0, 0, w, h);
  x.fillStyle = 'rgba(80,60,40,.14)';
  for (let i = 0; i < 16; i++) x.fillRect(0, 20 + i * 18, w, 1);
  x.fillStyle = 'rgba(40,30,20,.6)';
  x.font = '11px "Courier New", monospace';
  const rows = [
    'TO: NIGHT GUARD', 'RE: THE ANIMATRONICS', '', 'They wander at night.', 'The suits are not',
    'supposed to move.', 'If one gets to your door,', 'shut it. Do not let them in.',
    'Power is limited.', 'Keep an eye on the cams.', '', '  — management'
  ];
  rows.slice(0, lines + 4).forEach((t, i) => x.fillText(t, 18, 34 + i * 18));
  grime(x, w, h, 12, 'rgba(50,36,20,');
  return finish(c, 1, 1);
}

export function fanTexture() {
  const s = 256, c = canvas(s, s), x = c.getContext('2d');
  x.fillStyle = 'rgba(0,0,0,0)'; x.clearRect(0, 0, s, s);
  x.translate(s / 2, s / 2);
  x.fillStyle = '#5c5850';
  for (let i = 0; i < 3; i++) {
    x.save();
    x.rotate(i * Math.PI * 2 / 3);
    x.beginPath();
    x.moveTo(0, 0);
    x.bezierCurveTo(18, -18, 82, -44, 100, -12);
    x.bezierCurveTo(112, 16, 46, 34, 0, 0);
    x.fill();
    x.restore();
  }
  x.fillStyle = '#2a2824'; x.beginPath(); x.arc(0, 0, 22, 0, 7); x.fill();
  x.fillStyle = '#6b665c'; x.beginPath(); x.arc(0, 0, 12, 0, 7); x.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function signTexture() {
  const w = 512, h = 256, c = canvas(w, h), x = c.getContext('2d');
  x.fillStyle = '#1b1510'; x.fillRect(0, 0, w, h);
  x.strokeStyle = '#c9a24a'; x.lineWidth = 3; x.strokeRect(8, 8, w - 16, h - 16);
  x.textAlign = 'center';
  x.fillStyle = '#e7c979'; x.font = 'bold 38px Georgia, serif';
  x.fillText("FREDDY FAZBEAR'S", w / 2, 78);
  x.font = 'bold 26px Georgia, serif';
  x.fillStyle = '#c9563f';
  x.fillText('PIZZA', w / 2, 116);
  x.fillStyle = '#d8c9a5'; x.font = '13px Georgia, serif';
  x.fillText('NOW HIRING  ·  NIGHT SECURITY  ·  ASK INSIDE', w / 2, 166);
  x.fillStyle = 'rgba(200,180,140,.4)'; x.font = '11px "Courier New", monospace';
  x.fillText('HOURS 11AM — 12AM (SUBJECT TO CHANGE)', w / 2, 200);
  grime(x, w, h, 14, 'rgba(0,0,0,');
  return finish(c, 1, 1);
}

export function ventTexture() {
  const w = 256, h = 256, c = canvas(w, h), x = c.getContext('2d');
  x.fillStyle = '#242220'; x.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 18) {
    x.fillStyle = '#141210'; x.fillRect(10, y, w - 20, 10);
    x.fillStyle = 'rgba(255,255,255,.09)'; x.fillRect(10, y + 10, w - 20, 2);
  }
  x.strokeStyle = '#544f45'; x.lineWidth = 8; x.strokeRect(4, 4, w - 8, h - 8);
  return finish(c, 1, 1);
}

/* ---------------------------------------------------------- character suits */
const suitCache = new Map();
export function suitTexture(hex) {
  if (suitCache.has(hex)) return suitCache.get(hex);
  const w = 256, h = 256, c = canvas(w, h), x = c.getContext('2d');
  const base = '#' + (hex >>> 0).toString(16).padStart(6, '0');
  x.fillStyle = base; x.fillRect(0, 0, w, h);
  // soft blotches of dirt and wear
  for (let i = 0; i < 46; i++) {
    const gx = rand() * w, gy = rand() * h, r = 6 + rand() * 40;
    const g = x.createRadialGradient(gx, gy, 0, gx, gy, r);
    const dark = rand() > .35;
    g.addColorStop(0, dark ? `rgba(20,14,8,${.05 + rand() * .12})` : `rgba(255,230,190,${.03 + rand() * .06})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(gx - r, gy - r, r * 2, r * 2);
  }
  // fabric noise
  const img = x.getImageData(0, 0, w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rand() - .5) * 17;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  x.putImageData(img, 0, 0);
  // seams
  x.strokeStyle = 'rgba(20,12,6,.22)'; x.lineWidth = 2;
  x.beginPath(); x.moveTo(w * .5, 0); x.lineTo(w * .5, h); x.stroke();
  x.beginPath(); x.moveTo(0, h * .62); x.lineTo(w, h * .62); x.stroke();
  x.strokeStyle = 'rgba(255,225,180,.06)'; x.lineWidth = 1;
  x.beginPath(); x.moveTo(w * .5 + 2, 0); x.lineTo(w * .5 + 2, h); x.stroke();
  scratches(x, w, h, 26, 'rgba(255,240,210,.05)');
  grime(x, w, h, 14, 'rgba(12,8,4,');
  const t = finish(c, 2, 2);
  suitCache.set(hex, t);
  return t;
}

export function lightPanelTexture() {
  const w = 256, h = 128, c = canvas(w, h), x = c.getContext('2d');
  x.fillStyle = '#1a1814'; x.fillRect(0, 0, w, h);
  // housing
  x.fillStyle = '#2a2721'; x.fillRect(8, 8, w - 16, h - 16);
  // two diffused tubes
  for (const ty of [38, 78]) {
    const g = x.createLinearGradient(0, ty - 14, 0, ty + 14);
    g.addColorStop(0, '#4d4a3c'); g.addColorStop(.28, '#fff3ce');
    g.addColorStop(.6, '#f4e2b4'); g.addColorStop(1, '#3a372c');
    x.fillStyle = g; x.fillRect(24, ty - 12, w - 48, 24);
    x.fillStyle = 'rgba(255,255,240,.5)'; x.fillRect(24, ty - 5, w - 48, 3);
  }
  // ribs
  x.strokeStyle = 'rgba(60,54,40,.35)'; x.lineWidth = 2;
  for (let i = 0; i < 12; i++) { x.beginPath(); x.moveTo(24 + i * 18, 16); x.lineTo(24 + i * 18, h - 16); x.stroke(); }
  // grime at edges
  for (let i = 0; i < 18; i++) {
    x.fillStyle = `rgba(20,15,8,${.05 + rand() * .15})`;
    x.beginPath(); x.arc(rand() * w, rand() * h, 2 + rand() * 12, 0, 7); x.fill();
  }
  return finish(c, 1, 1);
}

export function exitTexture() {
  const w = 128, h = 64, c = canvas(w, h), x = c.getContext('2d');
  x.fillStyle = '#1a0705'; x.fillRect(0, 0, w, h);
  x.strokeStyle = '#7a1a12'; x.lineWidth = 4; x.strokeRect(4, 4, w - 8, h - 8);
  x.fillStyle = '#ff4a32'; x.font = 'bold 34px Arial, sans-serif'; x.textAlign = 'center';
  x.fillText('EXIT', w / 2, 45);
  return finish(c, 1, 1);
}

/* ---------------------------------------------------------- PBR helpers */
/* Derives a tangent-space normal map from a canvas texture's luminance.
   Cheap, resolution-preserving and surprisingly convincing on plaster,
   tile grout and suit fabric. */
export function normalFrom(tex, strength = 1.0, repeat = null) {
  const src = tex.image;
  const w = src.width, h = src.height;
  const read = canvas(w, h);
  const rx = read.getContext('2d', { willReadFrequently: true });
  rx.drawImage(src, 0, 0);
  const data = rx.getImageData(0, 0, w, h).data;
  const height = new Float32Array(w * h);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    height[p] = (data[i] * .299 + data[i + 1] * .587 + data[i + 2] * .114) / 255;
  }
  const out = canvas(w, h);
  const ox = out.getContext('2d');
  const img = ox.createImageData(w, h);
  const at = (x, y) => height[((y + h) % h) * w + ((x + w) % w)];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      let nx = -dx, ny = -dy, nz = 1;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      nx /= len; ny /= len; nz /= len;
      const i = (y * w + x) * 4;
      img.data[i] = (nx * .5 + .5) * 255;
      img.data[i + 1] = (ny * .5 + .5) * 255;
      img.data[i + 2] = (nz * .5 + .5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ox.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(out);
  t.colorSpace = THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.copy(repeat || tex.repeat);
  t.anisotropy = 4;
  return t;
}

/* Emissive roughness map: bright pixels = smoother (wet/polished). */
export function roughnessFrom(tex, repeat = null, base = 1) {
  const src = tex.image;
  const w = src.width, h = src.height;
  const c = canvas(w, h), x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(src, 0, 0);
  const d = x.getImageData(0, 0, w, h);
  for (let i = 0; i < d.data.length; i += 4) {
    const l = (d.data[i] * .299 + d.data[i + 1] * .587 + d.data[i + 2] * .114) / 255;
    const v = Math.round(255 * Math.min(1, base * (.55 + l * .55)));
    d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
  }
  x.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.copy(repeat || tex.repeat);
  t.anisotropy = 2;
  return t;
}

/* ---------------------------------------------------------- new surfaces */
export function dropCeilingTexture() {
  const w = 512, h = 512, c = canvas(w, h), x = c.getContext('2d');
  x.fillStyle = '#8d8674'; x.fillRect(0, 0, w, h);
  const cell = 128;
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const px = i * cell, py = j * cell;
    const g = x.createLinearGradient(px, py, px + cell, py + cell);
    g.addColorStop(0, '#a79f8b'); g.addColorStop(.5, '#8b8371'); g.addColorStop(1, '#756e5e');
    x.fillStyle = g; x.fillRect(px + 4, py + 4, cell - 8, cell - 8);
    // stipple
    for (let k = 0; k < 140; k++) {
      x.fillStyle = `rgba(40,35,26,${.04 + rand() * .09})`;
      x.fillRect(px + 6 + rand() * (cell - 12), py + 6 + rand() * (cell - 12), 1 + rand() * 2, 1 + rand() * 2);
    }
    // water stain on a few tiles
    if (rand() > .72) {
      const sx = px + 20 + rand() * 88, sy = py + 20 + rand() * 88;
      const rg = x.createRadialGradient(sx, sy, 2, sx, sy, 16 + rand() * 34);
      rg.addColorStop(0, 'rgba(96,70,36,.26)'); rg.addColorStop(1, 'rgba(96,70,36,0)');
      x.fillStyle = rg; x.beginPath(); x.arc(sx, sy, 50, 0, 7); x.fill();
    }
  }
  // T-bar grid
  x.strokeStyle = '#4c4a42'; x.lineWidth = 10;
  for (let i = 0; i <= 4; i++) {
    x.beginPath(); x.moveTo(i * cell, 0); x.lineTo(i * cell, h); x.stroke();
    x.beginPath(); x.moveTo(0, i * cell); x.lineTo(w, i * cell); x.stroke();
  }
  x.strokeStyle = 'rgba(255,255,255,.12)'; x.lineWidth = 2;
  for (let i = 0; i <= 4; i++) {
    x.beginPath(); x.moveTo(i * cell + 5, 0); x.lineTo(i * cell + 5, h); x.stroke();
    x.beginPath(); x.moveTo(0, i * cell + 5); x.lineTo(w, i * cell + 5); x.stroke();
  }
  grime(x, w, h, 40, 'rgba(30,22,12,');
  return finish(c, 3, 3);
}

export function curtainTexture(deep = '#3b0d11', mid = '#74201d') {
  const w = 512, h = 512, c = canvas(w, h), x = c.getContext('2d');
  x.fillStyle = deep; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 26; i++) {
    const px = i * (w / 26);
    const g = x.createLinearGradient(px, 0, px + w / 26, 0);
    g.addColorStop(0, 'rgba(0,0,0,.58)');
    g.addColorStop(.38, mid);
    g.addColorStop(.55, 'rgba(255,180,150,.12)');
    g.addColorStop(.75, mid);
    g.addColorStop(1, 'rgba(0,0,0,.6)');
    x.fillStyle = g; x.fillRect(px, 0, w / 26 + 1, h);
  }
  // velvet sheen + dust
  x.fillStyle = 'rgba(255,190,140,.05)';
  for (let i = 0; i < 90; i++) x.fillRect(rand() * w, rand() * h, 1 + rand() * 2, 1 + rand() * 7);
  grime(x, w, h, 26, 'rgba(14,6,4,');
  return finish(c, 3, 1.5);
}

export function hazardTexture() {
  const w = 256, h = 64, c = canvas(w, h), x = c.getContext('2d');
  x.fillStyle = '#171410'; x.fillRect(0, 0, w, h);
  for (let i = -h; i < w + h; i += 40) {
    x.fillStyle = '#b9902c';
    x.beginPath();
    x.moveTo(i, h); x.lineTo(i + 20, h); x.lineTo(i + 20 + h, 0); x.lineTo(i + h, 0);
    x.closePath(); x.fill();
  }
  grime(x, w, h, 18, 'rgba(0,0,0,');
  return finish(c, 1, 1);
}

export function glowTexture() {
  const s = 128, c = canvas(s, s), x = c.getContext('2d');
  const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(.22, 'rgba(255,246,225,.8)');
  g.addColorStop(.55, 'rgba(255,220,170,.22)');
  g.addColorStop(1, 'rgba(255,200,140,0)');
  x.fillStyle = g; x.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function beamTexture() {
  const w = 128, h = 256, c = canvas(w, h), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(255,220,160,0)');
  g.addColorStop(.18, 'rgba(255,216,160,.55)');
  g.addColorStop(.72, 'rgba(255,206,150,.18)');
  g.addColorStop(1, 'rgba(255,200,140,0)');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  const hg = x.createLinearGradient(0, 0, w, 0);
  hg.addColorStop(0, 'rgba(0,0,0,1)'); hg.addColorStop(.3, 'rgba(0,0,0,0)');
  hg.addColorStop(.7, 'rgba(0,0,0,0)'); hg.addColorStop(1, 'rgba(0,0,0,1)');
  x.globalCompositeOperation = 'destination-out';
  x.fillStyle = hg; x.fillRect(0, 0, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function marqueeTexture() {
  const w = 1024, h = 256, c = canvas(w, h), x = c.getContext('2d');
  x.fillStyle = '#140f0b'; x.fillRect(0, 0, w, h);
  const g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#2a1c12'); g.addColorStop(1, '#0d0906');
  x.fillStyle = g; x.fillRect(10, 10, w - 20, h - 20);
  x.strokeStyle = '#c8a04a'; x.lineWidth = 5; x.strokeRect(18, 18, w - 36, h - 36);
  x.textAlign = 'center';
  x.fillStyle = '#f4dfa8';
  x.font = 'bold 66px Georgia, serif';
  x.fillText("FREDDY FAZBEAR'S", w / 2, 108);
  x.fillStyle = '#e05a3d';
  x.font = 'bold 64px Georgia, serif';
  x.fillText('PIZZA', w / 2, 186);
  x.fillStyle = 'rgba(220,200,160,.65)';
  x.font = '18px Georgia, serif';
  x.fillText('F A Z B E A R   E N T E R T A I N M E N T', w / 2, 224);
  grime(x, w, h, 24, 'rgba(0,0,0,');
  return finish(c, 1, 1);
}

export function ventGrilleTexture() {
  const w = 256, h = 256, c = canvas(w, h), x = c.getContext('2d');
  x.fillStyle = '#181613'; x.fillRect(0, 0, w, h);
  for (let y = 12; y < h; y += 20) {
    const g = x.createLinearGradient(0, y, 0, y + 12);
    g.addColorStop(0, '#0a0908'); g.addColorStop(.6, '#22201b'); g.addColorStop(1, '#0d0c0a');
    x.fillStyle = g; x.fillRect(16, y, w - 32, 12);
    x.fillStyle = 'rgba(255,240,210,.08)'; x.fillRect(16, y, w - 32, 1);
  }
  x.strokeStyle = '#3a352c'; x.lineWidth = 14; x.strokeRect(8, 8, w - 16, h - 16);
  x.strokeStyle = 'rgba(255,255,255,.08)'; x.lineWidth = 2; x.strokeRect(15, 15, w - 30, h - 30);
  return finish(c, 1, 1);
}

export function cableTexture() {
  const w = 64, h = 256, c = canvas(w, h), x = c.getContext('2d');
  x.fillStyle = '#15120f'; x.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 8) {
    x.fillStyle = 'rgba(255,255,255,.06)'; x.fillRect(0, y, w, 1);
    x.fillStyle = 'rgba(0,0,0,.4)'; x.fillRect(0, y + 4, w, 2);
  }
  return finish(c, 1, 4);
}
