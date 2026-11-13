/* Stylised CCTV feed renderer — 2D art, cheap enough for phones. */
const W = 768, H = 432;

const CAMS = {
  '1A': { name: 'SHOW STAGE' },
  '1B': { name: 'DINING AREA' },
  '1C': { name: 'PIRATE COVE' },
  '2A': { name: 'WEST HALL' },
  '2B': { name: 'WEST HALL CORNER' },
  '3': { name: 'SUPPLY CLOSET' },
  '4A': { name: 'EAST HALL' },
  '4B': { name: 'EAST HALL CORNER' },
  '5': { name: 'BACKSTAGE' }
};

export class FeedRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.cam = '1A';
    this.t = 0;
    this.bgs = {};
    for (const id in CAMS) this.bgs[id] = this._bg(id);
    this.noise = this._noiseTile();
    this.flip = 0;
  }
  setCam(id) { this.cam = id; }
  draw(game, dt) {
    this.t += dt;
    const x = this.ctx;
    const cam = this.cam;
    const bg = this.bgs[cam];
    x.save();
    // slight CCTV sway
    const sway = Math.sin(this.t * .7) * 1.2;
    x.drawImage(bg, sway, Math.sin(this.t * .43) * .8, W, H);
    this._actors(x, game, cam);
    this._overlay(x, game);
    x.restore();
  }

  _noiseTile() {
    const c = document.createElement('canvas'); c.width = 128; c.height = 128;
    const x = c.getContext('2d');
    const img = x.createImageData(128, 128);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 40 + Math.random() * 60;
    }
    x.putImageData(img, 0, 0);
    return c;
  }

  /* ------------------------------------------------------------ rooms */
  _bg(id) {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.fillStyle = '#0b0a08'; x.fillRect(0, 0, W, H);
    if (id === '1A') this._roomStage(x);
    else if (id === '1B') this._roomDining(x);
    else if (id === '1C') this._roomCove(x);
    else if (id === '2A') this._roomHall(x, -1);
    else if (id === '2B') this._roomCorner(x, -1);
    else if (id === '3') this._roomCloset(x);
    else if (id === '4A') this._roomHall(x, 1);
    else if (id === '4B') this._roomCorner(x, 1);
    else if (id === '5') this._roomBackstage(x);
    // generic grime
    for (let i = 0; i < 70; i++) {
      const gx = Math.random() * W, gy = Math.random() * H, gr = 4 + Math.random() * 40;
      const g = x.createRadialGradient(gx, gy, 0, gx, gy, gr);
      g.addColorStop(0, `rgba(0,0,0,${.04 + Math.random() * .08})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
    }
    return c;
  }

  _perspFloor(x, vpx, vpy, y0, color1 = '#b8ab90', color2 = '#211e1a') {
    // checker floor in perspective
    const rows = 9, cols = 10;
    for (let r = 0; r < rows; r++) {
      const t0 = (r / rows) ** 2, t1 = ((r + 1) / rows) ** 2;
      const yA = y0 + (H - y0) * t0, yB = y0 + (H - y0) * t1;
      for (let cI = 0; cI < cols; cI++) {
        const spreadA = .22 + t0 * 1.6, spreadB = .22 + t1 * 1.6;
        const xA0 = vpx + (cI / cols - .5) * W * spreadA;
        const xA1 = vpx + ((cI + 1) / cols - .5) * W * spreadA;
        const xB0 = vpx + (cI / cols - .5) * W * spreadB;
        const xB1 = vpx + ((cI + 1) / cols - .5) * W * spreadB;
        x.fillStyle = (r + cI) % 2 ? color1 : color2;
        x.beginPath(); x.moveTo(xA0, yA); x.lineTo(xA1, yA); x.lineTo(xB1, yB); x.lineTo(xB0, yB); x.closePath(); x.fill();
        // grout
        x.strokeStyle = 'rgba(0,0,0,.18)'; x.lineWidth = .6; x.stroke();
      }
    }
    // grime over floor
    for (let i = 0; i < 40; i++) {
      const gx = Math.random() * W, gy = y0 + Math.random() * (H - y0);
      x.fillStyle = `rgba(15,12,8,${.05 + Math.random() * .12})`;
      x.beginPath(); x.ellipse(gx, gy, 10 + Math.random() * 60, 3 + Math.random() * 14, 0, 0, 7); x.fill();
    }
  }

  _wallBase(x, top = 0, bottom = H, color = '#7f745d') {
    const g = x.createLinearGradient(0, top, 0, bottom);
    g.addColorStop(0, '#2b2620'); g.addColorStop(.4, color); g.addColorStop(1, '#5b5141');
    x.fillStyle = g; x.fillRect(0, top, W, bottom - top);
    // wainscot
    x.fillStyle = '#3b2d21'; x.fillRect(0, bottom - (bottom - top) * .22, W, (bottom - top) * .22);
    x.fillStyle = 'rgba(255,220,160,.08)'; x.fillRect(0, bottom - (bottom - top) * .22, W, 2);
  }

  _roomStage(x) {
    this._wallBase(x, 0, H * .72, '#6e6049');
    // red curtain backdrop
    for (let i = 0; i < 30; i++) {
      const px = i * (W / 30);
      const g = x.createLinearGradient(px, 40, px + W / 30, 40);
      g.addColorStop(0, '#2c0c0e'); g.addColorStop(.5, '#5f1a1b'); g.addColorStop(1, '#1d0708');
      x.fillStyle = g; x.fillRect(px, 40, W / 30 + 1, 250);
    }
    // valance
    x.fillStyle = '#3c0e10'; x.fillRect(0, 24, W, 64);
    x.fillStyle = '#7a2420';
    for (let i = 0; i < 12; i++) { x.beginPath(); x.arc(30 + i * 68, 92, 32, 0, Math.PI); x.fill(); }
    // stars on curtain
    for (let i = 0; i < 16; i++) {
      const sx = 60 + Math.random() * (W - 120), sy = 120 + Math.random() * 150;
      x.fillStyle = 'rgba(230,190,90,.28)';
      x.save(); x.translate(sx, sy); x.rotate(Math.random()); this._star(x, 7); x.restore();
    }
    // stage platform
    const stageY = 300;
    x.fillStyle = '#2a1c12'; x.fillRect(40, stageY, W - 80, 54);
    x.fillStyle = '#4a2a1a'; x.fillRect(40, stageY, W - 80, 8);
    const g2 = x.createLinearGradient(0, stageY + 54, 0, stageY + 100);
    g2.addColorStop(0, '#1a1310'); g2.addColorStop(1, '#080706');
    x.fillStyle = g2; x.fillRect(0, stageY + 54, W, H - stageY - 54);
    this._perspFloor(x, W / 2, stageY + 20, stageY + 60);
    // spotlight pools
    for (const sx of [230, 384, 540]) {
      const g = x.createRadialGradient(sx, stageY + 20, 4, sx, stageY + 25, 110);
      g.addColorStop(0, 'rgba(255,210,140,.18)'); g.addColorStop(1, 'rgba(255,210,140,0)');
      x.fillStyle = g; x.fillRect(sx - 110, stageY - 90, 220, 190);
    }
    // "LET'S PARTY" banner
    x.fillStyle = '#d9c79c'; x.font = 'bold 19px Georgia, serif'; x.textAlign = 'center';
    x.fillText("LET'S PARTY!", W / 2, 54);
    x.fillStyle = 'rgba(255,220,160,.25)'; x.font = '10px Georgia, serif';
    x.fillText('FREDDY FAZBEAR\'S PIZZA — SHOW STAGE', W / 2, 70);
  }

  _roomDining(x) {
    this._wallBase(x, 0, H * .6, '#6d624d');
    // back wall + stage doorway
    x.fillStyle = '#191310'; x.fillRect(0, 0, W, 90);
    x.fillStyle = '#4a1716'; x.fillRect(90, 60, 150, 190);
    x.fillStyle = '#2a0b0b'; x.fillRect(100, 70, 130, 160);
    x.fillStyle = 'rgba(255,210,130,.16)';
    x.beginPath(); x.ellipse(165, 250, 100, 40, 0, 0, 7); x.fill();
    // sign
    x.fillStyle = '#c9b98e'; x.font = 'bold 17px Georgia, serif'; x.textAlign = 'center';
    x.fillText("FREDDY FAZBEAR'S PIZZA", W * .62, 46);
    // party banner
    x.strokeStyle = 'rgba(220,200,160,.18)'; x.lineWidth = 2;
    x.beginPath(); x.moveTo(260, 62); x.quadraticCurveTo(500, 120, 700, 60); x.stroke();
    for (let i = 0; i < 10; i++) {
      x.save(); x.translate(280 + i * 42, 72 + Math.sin(i) * 14); x.rotate((i - 5) * .1);
      x.fillStyle = ['#b84437', '#d3ac54', '#6e8a6e', '#b9b18f'][i % 4];
      x.beginPath(); x.moveTo(-7, 0); x.lineTo(7, 0); x.lineTo(0, 18); x.fill(); x.restore();
    }
    // floor
    this._perspFloor(x, W / 2, 150, 260);
    // tables & chairs
    const tables = [
      [330, 360, 78, 22], [560, 330, 62, 18], [190, 320, 55, 16], [470, 410, 105, 26], [90, 415, 80, 22], [680, 405, 90, 24]
    ];
    for (const [tx, ty, rw, rh] of tables) {
      // shadow
      x.fillStyle = 'rgba(0,0,0,.35)';
      x.beginPath(); x.ellipse(tx + 10, ty + 14, rw * .9, rh * .45, 0, 0, 7); x.fill();
      // chairs
      x.fillStyle = '#241a14';
      for (const a of [-2.3, -.8, .8, 2.3]) {
        x.beginPath(); x.ellipse(tx + Math.cos(a) * rw * .9, ty + Math.sin(a) * rh * 1.5, 12, 6, 0, 0, 7); x.fill();
        x.fillRect(tx + Math.cos(a) * rw * .9 - 2, ty + Math.sin(a) * rh * 1.5 - 22, 4, 24);
      }
      // table top
      const g = x.createLinearGradient(0, ty - rh, 0, ty + rh);
      g.addColorStop(0, '#8c8070'); g.addColorStop(.5, '#5c5346'); g.addColorStop(1, '#332c24');
      x.fillStyle = g;
      x.beginPath(); x.ellipse(tx, ty, rw, rh, 0, 0, 7); x.fill();
      x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 2; x.stroke();
      // party hats & plates
      for (let i = 0; i < 3; i++) {
        const hx = tx - rw * .4 + i * rw * .4, hy = ty - 4 + (i % 2) * 5;
        x.fillStyle = ['#c04436', '#d3ac54', '#5c7f66'][i % 3];
        x.beginPath(); x.moveTo(hx - 6, hy); x.lineTo(hx + 6, hy); x.lineTo(hx, hy - 18); x.fill();
        if (i === 1) { x.fillStyle = '#e7dcc4'; x.beginPath(); x.ellipse(hx + 14, hy + 2, 10, 4, 0, 0, 7); x.fill(); }
      }
    }
  }

  _roomCove(x) {
    this._wallBase(x, 0, H, '#564a38');
    // wooden floor
    x.fillStyle = '#241a11'; x.fillRect(0, 320, W, 112);
    for (let i = 0; i < 8; i++) {
      x.fillStyle = i % 2 ? '#2d2116' : '#251a11';
      x.fillRect(0, 320 + i * 14, W, 14);
    }
    // purple curtain
    for (let i = 0; i < 26; i++) {
      const px = 100 + i * (W - 200) / 26;
      const g = x.createLinearGradient(px, 60, px + (W - 200) / 26, 60);
      g.addColorStop(0, '#1b1026'); g.addColorStop(.5, '#4a2a62'); g.addColorStop(1, '#140b1d');
      x.fillStyle = g; x.fillRect(px, 56, (W - 200) / 26 + 1, 310);
    }
    // star patterns
    for (let i = 0; i < 22; i++) {
      const sx = 120 + Math.random() * (W - 240), sy = 90 + Math.random() * 250;
      x.fillStyle = `rgba(220,180,90,${.16 + Math.random() * .14})`;
      x.save(); x.translate(sx, sy); x.rotate(Math.random() * 2); this._star(x, 6); x.restore();
    }
    // valance
    x.fillStyle = '#2a1738'; x.fillRect(60, 26, W - 120, 52);
    x.fillStyle = '#5e3a7a';
    for (let i = 0; i < 9; i++) { x.beginPath(); x.arc(110 + i * 68, 78, 34, 0, Math.PI); x.fill(); }
    // sign
    x.save(); x.translate(W / 2, 190); x.rotate(-.04);
    x.fillStyle = '#d4c9a8'; x.fillRect(-78, -38, 156, 76);
    x.strokeStyle = '#413321'; x.lineWidth = 3; x.strokeRect(-78, -38, 156, 76);
    x.fillStyle = '#3b2c1e'; x.font = 'bold 20px Georgia, serif'; x.textAlign = 'center';
    x.fillText('OUT OF ORDER', 0, -6);
    x.font = '10px Georgia, serif'; x.fillText('SORRY FOR THE INCONVENIENCE', 0, 14);
    x.restore();
    // rope
    x.strokeStyle = '#6a1a16'; x.lineWidth = 5;
    x.beginPath(); x.moveTo(60, 300); x.quadraticCurveTo(W / 2, 330, W - 60, 300); x.stroke();
    for (const sx of [60, W - 60]) {
      x.fillStyle = '#8d7d55'; x.fillRect(sx - 3, 250, 6, 55);
      x.beginPath(); x.arc(sx, 248, 8, 0, 7); x.fill();
    }
    // stage edge
    x.fillStyle = '#171008'; x.fillRect(0, 366, W, 66);
    x.fillStyle = 'rgba(255,180,90,.12)'; x.fillRect(0, 366, W, 3);
  }

  _roomHall(x, side) {
    // side -1 west, +1 east
    x.fillStyle = '#0a0907'; x.fillRect(0, 0, W, H);
    const vpx = W / 2 + side * 34, vpy = 168;
    // ceiling
    const cg = x.createLinearGradient(0, 0, 0, vpy);
    cg.addColorStop(0, '#0c0a08'); cg.addColorStop(1, '#292319');
    x.fillStyle = cg;
    x.beginPath(); x.moveTo(0, 0); x.lineTo(W, 0); x.lineTo(vpx + 40, vpy); x.lineTo(vpx - 40, vpy); x.fill();
    // floor
    this._perspFloor(x, vpx, vpy, 330);
    // side walls as trapezoids
    for (const s of [-1, 1]) {
      const nearX = s < 0 ? 0 : W;
      const farX = vpx + s * 40;
      const g = x.createLinearGradient(nearX, 0, farX, 0);
      g.addColorStop(0, '#5d5343'); g.addColorStop(1, '#2b251d');
      x.fillStyle = g;
      x.beginPath();
      x.moveTo(nearX, 0); x.lineTo(farX, vpy); x.lineTo(farX, vpy + 210); x.lineTo(nearX, H); x.closePath(); x.fill();
      // wainscot
      x.fillStyle = 'rgba(32,22,15,.7)';
      x.beginPath();
      x.moveTo(nearX, H * .62); x.lineTo(farX, vpy + 150); x.lineTo(farX, vpy + 210); x.lineTo(nearX, H); x.closePath(); x.fill();
      // posters
      x.save(); x.globalAlpha = .65;
      const px = s < 0 ? 110 : W - 190, py = 190;
      x.fillStyle = '#c7b99c'; x.fillRect(px, py, 66, 88);
      x.fillStyle = '#7a3d32'; x.fillRect(px + 6, py + 6, 54, 76);
      x.fillStyle = '#e5d7b4'; x.font = 'bold 8px Georgia, serif'; x.textAlign = 'center';
      x.fillText('CELEBRATE!', px + 33, py + 44);
      x.restore();
      // door on far wall side
    }
    // far wall
    x.fillStyle = '#17130f'; x.fillRect(vpx - 40, vpy, 80, 210);
    x.fillStyle = '#2b1b12'; x.fillRect(vpx - 34, vpy + 40, 68, 170);
    x.strokeStyle = 'rgba(220,200,160,.1)'; x.lineWidth = 2; x.strokeRect(vpx - 34, vpy + 40, 68, 170);
    // ceiling lights
    for (let i = 0; i < 4; i++) {
      const t = i / 4;
      const ly = 26 + t * t * 110;
      const lw = 90 - t * 58;
      x.fillStyle = `rgba(255,214,150,${.5 - t * .3})`;
      x.fillRect(vpx - lw / 2, ly, lw, 5 + (1 - t) * 3);
      const g = x.createRadialGradient(vpx, ly + 4, 1, vpx, ly + 4, 70 * (1 - t) + 20);
      g.addColorStop(0, `rgba(255,200,120,${.18 - t * .12})`); g.addColorStop(1, 'rgba(255,200,120,0)');
      x.fillStyle = g; x.beginPath(); x.ellipse(vpx, ly + 8, 70 * (1 - t) + 20, 46 * (1 - t) + 10, 0, 0, 7); x.fill();
    }
    // floor reflections
    x.fillStyle = 'rgba(255,190,110,.06)';
    x.beginPath(); x.ellipse(vpx, H - 40, 90, 26, 0, 0, 7); x.fill();
    // wet floor sign in foreground
    x.save(); x.translate(side < 0 ? 250 : W - 250, 380);
    x.fillStyle = '#b99a32'; x.beginPath(); x.moveTo(-20, 26); x.lineTo(20, 26); x.lineTo(0, -24); x.fill();
    x.fillStyle = '#3a2e10'; x.font = 'bold 7px sans-serif'; x.textAlign = 'center'; x.fillText('WET', 0, 10); x.fillText('FLOOR', 0, 18);
    x.restore();
  }

  _roomCorner(x, side) {
    // close-up of the hallway corner — office door at the side
    this._roomHall(x, side);
    // darken edges
    const g = x.createRadialGradient(W / 2, H / 2, 80, W / 2, H / 2, 480);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.6)');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    // Office door frame in foreground right/left
    x.fillStyle = '#0f0d0a';
    if (side < 0) x.fillRect(W - 210, 30, 210, H - 30);
    else x.fillRect(0, 30, 210, H - 30);
    x.strokeStyle = 'rgba(200,180,150,.18)'; x.lineWidth = 3;
    if (side < 0) x.strokeRect(W - 210, 30, 210, H - 30); else x.strokeRect(0, 30, 210, H - 30);
    // button panel glow
    x.fillStyle = 'rgba(220,60,40,.35)';
    if (side < 0) x.fillRect(W - 235, 150, 25, 30); else x.fillRect(210, 150, 25, 30);
  }

  _roomCloset(x) {
    this._wallBase(x, 0, H, '#51483a');
    // tight room, shelves
    for (const sy of [130, 230, 320]) {
      x.fillStyle = '#2e241a'; x.fillRect(60, sy, W - 120, 12);
      x.fillStyle = 'rgba(255,220,170,.06)'; x.fillRect(60, sy, W - 120, 2);
      for (let i = 0; i < 4; i++) {
        const bx = 80 + i * 160 + Math.random() * 40, bw = 50 + Math.random() * 50, bh = 26 + Math.random() * 30;
        x.fillStyle = ['#5c4a34', '#6b5740', '#3f3426'][i % 3];
        x.fillRect(bx, sy - bh, bw, bh);
        x.fillStyle = 'rgba(230,220,200,.18)'; x.fillRect(bx + bw / 2 - 14, sy - bh + 8, 28, 4);
      }
    }
    // mop & bucket
    x.strokeStyle = '#7a6a4d'; x.lineWidth = 6;
    x.beginPath(); x.moveTo(610, 390); x.lineTo(690, 220); x.stroke();
    x.fillStyle = '#6d6249'; x.beginPath(); x.ellipse(690, 210, 18, 26, .2, 0, 7); x.fill();
    x.fillStyle = '#3c5d63'; x.fillRect(580, 380, 58, 46);
    x.fillStyle = '#2c464b'; x.fillRect(580, 380, 58, 8);
    // hanging bulb
    x.strokeStyle = '#1a1712'; x.lineWidth = 2; x.beginPath(); x.moveTo(384, 0); x.lineTo(384, 90); x.stroke();
    x.fillStyle = 'rgba(255,205,130,.85)'; x.beginPath(); x.arc(384, 100, 9, 0, 7); x.fill();
    const g = x.createRadialGradient(384, 100, 4, 384, 100, 220);
    g.addColorStop(0, 'rgba(255,200,120,.22)'); g.addColorStop(1, 'rgba(255,200,120,0)');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    // door shadow
    x.fillStyle = 'rgba(0,0,0,.45)'; x.fillRect(0, 0, 40, H); x.fillRect(W - 40, 0, 40, H);
  }

  _roomBackstage(x) {
    this._wallBase(x, 0, H, '#5c5140');
    // workbench
    x.fillStyle = '#34261a'; x.fillRect(0, 300, W, 26);
    x.fillStyle = '#1d150e'; x.fillRect(0, 326, W, 106);
    // shelf of spare heads
    x.fillStyle = '#2b241b'; x.fillRect(40, 90, W - 80, 12);
    x.fillStyle = '#2b241b'; x.fillRect(40, 200, W - 80, 12);
    const heads = ['freddy', 'bonnie', 'chica', 'foxy', 'freddy'];
    heads.forEach((type, i) => {
      const hx = 110 + i * 135, hy = i < 3 ? 90 : 200;
      if (i === 3) { x.save(); x.translate(hx + 160, hy); drawHead(x, type, 0, 0, 1, 0); x.restore(); }
      else drawHead(x, type, hx, hy, .85, 0);
    });
    // endoskeleton in corner
    x.strokeStyle = '#8b877c'; x.lineWidth = 4; x.globalAlpha = .55;
    for (let i = 0; i < 5; i++) {
      x.beginPath(); x.moveTo(640, 300 - i * 34); x.lineTo(660 - i * 6, 300 - i * 34 - 30); x.stroke();
    }
    x.beginPath(); x.arc(660, 130, 22, 0, 7); x.stroke();
    x.globalAlpha = 1;
    // tools on table
    x.fillStyle = '#777266'; x.fillRect(120, 286, 60, 8);
    x.fillStyle = '#5d5a50'; x.fillRect(300, 290, 42, 10);
    x.fillStyle = '#8a2a22'; x.fillRect(480, 286, 20, 14);
    // hanging wires
    x.strokeStyle = '#14110e'; x.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      x.beginPath(); x.moveTo(100 + i * 150, 0); x.bezierCurveTo(80 + i * 150, 60, 160 + i * 150, 80, 140 + i * 150, 120); x.stroke();
    }
  }

  _star(x, r) {
    x.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5;
      const rad = i % 2 ? r * .42 : r;
      x[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rad, Math.sin(a) * rad);
    }
    x.closePath(); x.fill();
  }

  /* ------------------------------------------------------------ actors */
  _actors(x, game, cam) {
    if (!game || !game.ai) return;
    const ai = game.ai;
    const foxy = game.foxy || { stage: 0 };
    const posOf = a => (ai[a] ? ai[a].path[ai[a].index] : null);
    const on = (a, pos) => posOf(a) === pos;

    if (cam === '1A') {
      let spots = [];
      if (on('freddy', 'stage')) spots.push(['freddy', 384, 312, .95]);
      if (on('bonnie', 'stage')) spots.push(['bonnie', 258, 315, .9]);
      if (on('chica', 'stage')) spots.push(['chica', 512, 315, .9]);
      if (!spots.length) {
        // empty stage, curtains slightly parted
        x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(300, 100, 168, 210);
      }
      for (const [type, sx, sy, s] of spots) this._char(x, type, sx, sy, s, 1);
    }
    if (cam === '1B') {
      const actors = [];
      if (on('freddy', 'dining')) actors.push(['freddy', 420, 330, .62]);
      if (on('bonnie', 'dining')) actors.push(['bonnie', 300, 300, .58]);
      if (on('chica', 'dining')) actors.push(['chica', 560, 345, .62]);
      for (const [type, sx, sy, s] of actors) this._char(x, type, sx, sy, s, 0);
    }
    if (cam === '1C') {
      const st = foxy.stage ?? 0;
      this._coveFoxy(x, st);
    }
    if (cam === '2A') {
      if (on('bonnie', 'westHall')) this._char(x, 'bonnie', 350, 330, .8, 0);
      if (game.foxy && game.foxy.running) this._char(x, 'foxy', 300 + Math.min(180, game.foxy.runT * 260), 340, .9, 0);
      if (on('bonnie', 'westCorner')) {
        // not here
      }
    }
    if (cam === '2B') {
      if (on('bonnie', 'westCorner')) this._char(x, 'bonnie', 320, 400, 1.4, 0, true);
      else if (game.foxy && game.foxy.running) this._char(x, 'foxy', 250 + Math.min(220, game.foxy.runT * 300), 410, 1.5, 0, true);
    }
    if (cam === '4A') {
      if (on('chica', 'eastHall')) this._char(x, 'chica', 430, 330, .8, 0);
      if (on('freddy', 'eastHall')) this._char(x, 'freddy', 360, 320, .82, 0);
    }
    if (cam === '4B') {
      if (on('chica', 'eastCorner')) this._char(x, 'chica', 430, 400, 1.4, 0, true);
      else if (on('freddy', 'eastCorner')) this._char(x, 'freddy', 400, 405, 1.45, 0, true);
    }
    if (cam === '5') {
      // eyes in the dark
      if (ai.freddy && ai.freddy.pos === 'stage' && Math.sin(this.t * .7) > .6) {
        x.fillStyle = 'rgba(255,220,150,.8)';
        x.beginPath(); x.arc(620, 170, 3, 0, 7); x.fill();
        x.beginPath(); x.arc(640, 170, 3, 0, 7); x.fill();
      }
    }
    if (cam === '3' && Math.sin(this.t * .33) > .93) {
      x.fillStyle = 'rgba(255,230,190,.75)';
      x.beginPath(); x.arc(500, 250, 2.5, 0, 7); x.fill();
      x.beginPath(); x.arc(516, 250, 2.5, 0, 7); x.fill();
    }
  }

  _coveFoxy(x, stage) {
    const cx = W / 2, cy = 340;
    if (stage <= 0) {
      // closed curtain seam
      x.strokeStyle = 'rgba(0,0,0,.6)'; x.lineWidth = 4;
      x.beginPath(); x.moveTo(cx, 70); x.lineTo(cx, 360); x.stroke();
      return;
    }
    const gap = stage === 1 ? 14 : stage === 2 ? 70 : 170;
    // parted curtain
    x.fillStyle = '#050403';
    x.beginPath(); x.moveTo(cx - gap, 70); x.lineTo(cx + gap, 70); x.lineTo(cx + gap * .8, 370); x.lineTo(cx - gap * .8, 370); x.fill();
    // curtain edges
    for (const s of [-1, 1]) {
      const g = x.createLinearGradient(cx + s * gap, 0, cx + s * (gap + 40), 0);
      g.addColorStop(0, '#22122e'); g.addColorStop(1, '#4a2a62');
      x.fillStyle = g;
      x.beginPath();
      x.moveTo(cx + s * gap, 70); x.lineTo(cx + s * (gap + 46), 70);
      x.quadraticCurveTo(cx + s * (gap + 20), 220, cx + s * (gap + 40), 370);
      x.lineTo(cx + s * gap * .8, 370); x.fill();
    }
    if (stage === 1) {
      // eyes in the gap
      x.fillStyle = 'rgba(255,196,90,.9)';
      x.beginPath(); x.arc(cx - 4, 200, 2.2, 0, 7); x.fill();
      x.beginPath(); x.arc(cx + 4, 200, 2.2, 0, 7); x.fill();
    } else if (stage === 2) {
      this._char(x, 'foxy', cx, 400, 1.45, 2, true);
    } else {
      // gone — hook on the floor + open curtain
      x.fillStyle = 'rgba(0,0,0,.75)'; x.fillRect(cx - 80, 80, 160, 300);
      x.strokeStyle = '#8c887c'; x.lineWidth = 4;
      x.beginPath(); x.arc(cx + 12, 355, 14, .4, 4.2); x.stroke();
      x.fillStyle = 'rgba(230,215,185,.5)'; x.font = 'bold 10px "Courier New", monospace'; x.textAlign = 'center';
      x.fillText('IT\'S ME', cx, 150);
    }
  }

  _char(x, type, sx, sy, s, variant = 0, close = false) {
    const pal = {
      freddy: ['#4b301c', '#7a5330', '#2a190d', '#9b7047', '#8f2b2a', '#e6efff'],
      bonnie: ['#3c3060', '#61508c', '#241c3c', '#7d6ba0', '#8c2b28', '#e4d6ff'],
      chica: ['#b08f32', '#d8b64c', '#7c621f', '#d3a53c', '#b5473a', '#d8c6ff'],
      foxy: ['#772b1d', '#a85f3e', '#4a1a12', '#b26743', '#171310', '#ffc95c']
    }[type];
    if (!pal) return;
    const [body, light, dark, muzzle, accent, eyeCol] = pal;
    const bob = Math.sin(this.t * 1.35 + sx * .031 + sy * .017) * (close ? 1.4 : 3.2);
    x.save();
    x.translate(sx, sy + bob);
    x.scale(s, s);

    // ground shadow
    x.fillStyle = 'rgba(0,0,0,.55)';
    x.beginPath(); x.ellipse(4, 2, 46, 10, 0, 0, 7); x.fill();
    // rim haze behind the silhouette
    const glow = x.createRadialGradient(0, -120, 8, 0, -120, 150);
    glow.addColorStop(0, close ? 'rgba(255,140,80,.14)' : 'rgba(255,190,120,.09)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = glow; x.fillRect(-150, -270, 300, 290);

    // ---- legs
    x.fillStyle = dark;
    x.beginPath(); x.roundRect(-25, -62, 19, 52, 8); x.fill();
    x.beginPath(); x.roundRect(6, -62, 19, 52, 8); x.fill();
    x.fillStyle = '#1c1a16';
    for (const lx of [-22, 9]) {
      x.beginPath(); x.ellipse(lx + 6, -58, 7, 6, 0, 0, 7); x.fill();
      x.beginPath(); x.ellipse(lx + 6, -34, 6, 5, 0, 0, 7); x.fill();
    }
    x.fillStyle = body;
    x.beginPath(); x.ellipse(-16, -4, 17, 9, 0, 0, 7); x.fill();
    x.beginPath(); x.ellipse(18, -4, 17, 9, 0, 0, 7); x.fill();
    x.fillStyle = 'rgba(0,0,0,.25)';
    x.beginPath(); x.ellipse(-16, -1, 16, 5, 0, 0, 7); x.fill();
    x.beginPath(); x.ellipse(18, -1, 16, 5, 0, 0, 7); x.fill();

    // ---- arms
    for (const side of [-1, 1]) {
      x.save();
      x.translate(side * 39, -116);
      x.rotate(side * (.1 + Math.sin(this.t * .9 + sx * .02) * .018));
      const ag = x.createLinearGradient(-12, 0, 12, 0);
      ag.addColorStop(0, light); ag.addColorStop(.55, body); ag.addColorStop(1, dark);
      x.fillStyle = ag;
      x.beginPath(); x.roundRect(-11, 0, 22, 55, 10); x.fill();
      x.fillStyle = '#22201b';
      x.beginPath(); x.arc(0, 54, 8, 0, 7); x.fill();
      x.fillStyle = body;
      x.beginPath(); x.roundRect(-9, 56, 18, 34, 8); x.fill();
      if (type === 'foxy' && side > 0) {
        x.strokeStyle = '#9b988c'; x.lineWidth = 4;
        x.beginPath(); x.arc(0, 96, 11, .3, 4.5); x.stroke();
      } else {
        x.fillStyle = dark;
        x.beginPath(); x.ellipse(0, 96, 10, 9, 0, 0, 7); x.fill();
        // fingers
        x.fillStyle = body;
        for (let f = 0; f < 3; f++) {
          x.beginPath(); x.roundRect(-8 + f * 6, 98, 5, 13, 2.5); x.fill();
        }
      }
      x.restore();
    }

    // ---- torso
    const tg = x.createLinearGradient(-42, -140, 42, -62);
    tg.addColorStop(0, light);
    tg.addColorStop(.4, body);
    tg.addColorStop(1, dark);
    x.fillStyle = tg;
    x.beginPath();
    x.moveTo(-37, -128);
    x.bezierCurveTo(-46, -103, -38, -75, -25, -60);
    x.lineTo(25, -60);
    x.bezierCurveTo(38, -75, 46, -103, 37, -128);
    x.bezierCurveTo(26, -142, -26, -142, -37, -128);
    x.closePath();
    x.fill();
    // shoulder caps
    x.fillStyle = dark;
    x.beginPath(); x.ellipse(-38, -125, 12, 14, -.2, 0, 7); x.fill();
    x.beginPath(); x.ellipse(38, -125, 12, 14, .2, 0, 7); x.fill();
    // belly plate
    const bg = x.createLinearGradient(0, -125, 0, -66);
    bg.addColorStop(0, light); bg.addColorStop(.5, muzzle); bg.addColorStop(1, dark);
    x.fillStyle = bg;
    x.beginPath(); x.ellipse(0, -93, 24, 33, 0, 0, 7); x.fill();
    x.strokeStyle = 'rgba(255,240,210,.16)'; x.lineWidth = 1.5;
    x.beginPath(); x.ellipse(0, -93, 24, 33, 0, 0, 7); x.stroke();
    // torso seam
    x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 1.5;
    x.beginPath(); x.moveTo(-27, -118); x.quadraticCurveTo(0, -108, 27, -118); x.stroke();
    // bow tie
    if (type !== 'foxy') {
      x.fillStyle = accent;
      for (const side of [-1, 1]) {
        x.beginPath();
        x.moveTo(side * 2, -130); x.lineTo(side * 17, -137); x.lineTo(side * 17, -123); x.closePath(); x.fill();
      }
      x.beginPath(); x.arc(0, -130, 4, 0, 7); x.fill();
    }
    // buttons
    x.fillStyle = 'rgba(20,16,12,.7)';
    x.beginPath(); x.arc(0, -112, 2.4, 0, 7); x.fill();
    x.beginPath(); x.arc(0, -103, 2.4, 0, 7); x.fill();

    // ---- head (ears/hat behind skull)
    const hy = -172;
    if (type === 'freddy') {
      x.fillStyle = body;
      for (const side of [-1, 1]) {
        x.beginPath(); x.arc(side * 28, hy - 20, 12, 0, 7); x.fill();
        x.fillStyle = dark;
        x.beginPath(); x.arc(side * 28, hy - 20, 6, 0, 7); x.fill();
        x.fillStyle = body;
      }
      x.fillStyle = '#111010';
      x.fillRect(-17, hy - 47, 34, 19);
      x.beginPath(); x.ellipse(0, hy - 28, 27, 5.5, 0, 0, 7); x.fill();
      x.fillStyle = '#6e1f18';
      x.fillRect(-16, hy - 35, 32, 4);
    } else if (type === 'bonnie') {
      x.fillStyle = body;
      for (const side of [-1, 1]) {
        x.save(); x.translate(side * 15, hy - 35); x.rotate(side * .12);
        x.beginPath(); x.ellipse(0, -12, 8, 30, 0, 0, 7); x.fill();
        x.fillStyle = muzzle;
        x.beginPath(); x.ellipse(0, -10, 3.5, 20, 0, 0, 7); x.fill();
        x.restore();
        x.fillStyle = body;
      }
    } else if (type === 'chica') {
      x.fillStyle = body;
      x.beginPath(); x.moveTo(-10, hy - 23); x.quadraticCurveTo(-4, hy - 55, 6, hy - 30); x.fill();
      x.beginPath(); x.moveTo(10, hy - 23); x.quadraticCurveTo(16, hy - 48, 22, hy - 25); x.fill();
    } else {
      x.fillStyle = body;
      for (const side of [-1, 1]) {
        x.beginPath(); x.moveTo(side * 18, hy - 12); x.lineTo(side * 34, hy - 46); x.lineTo(side * 36, hy - 12); x.closePath(); x.fill();
        x.fillStyle = dark;
        x.beginPath(); x.moveTo(side * 24, hy - 17); x.lineTo(side * 32, hy - 39); x.lineTo(side * 32, hy - 17); x.closePath(); x.fill();
        x.fillStyle = body;
      }
    }

    // skull
    const hg = x.createRadialGradient(-10, hy - 8, 4, 0, hy, 42);
    hg.addColorStop(0, light); hg.addColorStop(.52, body); hg.addColorStop(1, dark);
    x.fillStyle = hg;
    x.beginPath(); x.ellipse(0, hy, 33, 31, 0, 0, 7); x.fill();
    // side shading
    const shade = x.createLinearGradient(14, hy - 30, 34, hy + 20);
    shade.addColorStop(0, 'rgba(0,0,0,0)'); shade.addColorStop(1, 'rgba(0,0,0,.45)');
    x.fillStyle = shade;
    x.beginPath(); x.ellipse(0, hy, 33, 31, 0, 0, 7); x.fill();

    // muzzle / beak
    if (type === 'chica') {
      const bkg = x.createLinearGradient(0, hy + 4, 0, hy + 28);
      bkg.addColorStop(0, '#f0a23a'); bkg.addColorStop(1, '#b86a18');
      x.fillStyle = bkg;
      x.beginPath(); x.moveTo(-16, hy + 7); x.lineTo(16, hy + 7); x.lineTo(0, hy + 29); x.closePath(); x.fill();
      x.strokeStyle = 'rgba(90,50,10,.7)'; x.lineWidth = 1.5; x.stroke();
    } else {
      const mg = x.createLinearGradient(0, hy - 2, 0, hy + 24);
      mg.addColorStop(0, muzzle); mg.addColorStop(1, dark);
      x.fillStyle = mg;
      x.beginPath(); x.ellipse(0, hy + 13, 21, 13, 0, 0, 7); x.fill();
      if (type === 'foxy') {
        x.beginPath(); x.ellipse(0, hy + 15, 16, 14, 0, 0, 7); x.fill();
      }
      // nose
      x.fillStyle = '#1c1410';
      x.beginPath(); x.ellipse(0, hy + 4, 5.5, 4, 0, 0, 7); x.fill();
    }

    // mouth / jaw
    const jawOpen = close ? 8 : 2 + Math.sin(this.t * 1.5 + sx) * 1.2;
    x.fillStyle = '#0b0605';
    x.beginPath(); x.ellipse(0, hy + 18 + jawOpen * .3, 15, 5 + jawOpen * .35, 0, 0, 7); x.fill();
    // teeth
    x.fillStyle = '#ddd3b9';
    for (let i = -2; i <= 2; i++) {
      x.fillRect(i * 5 - 1.4, hy + 13 + jawOpen * .2, 3, 4.5);
      x.fillRect(i * 5 - 1.4, hy + 22 + jawOpen * .55, 3, 4);
    }

    // eyes — sunken sockets, bright irises
    for (const side of [-1, 1]) {
      x.fillStyle = '#1a140f';
      x.beginPath(); x.ellipse(side * 12, hy - 5, 9.5, 8.5, 0, 0, 7); x.fill();
      x.fillStyle = type === 'foxy' ? '#efe5cd' : '#e8e0cc';
      x.beginPath(); x.ellipse(side * 12, hy - 5, 7, 6.3, 0, 0, 7); x.fill();
      x.fillStyle = eyeCol;
      x.shadowColor = eyeCol; x.shadowBlur = close ? 16 : 10;
      x.beginPath(); x.arc(side * 12, hy - 5, close ? 3.6 : 3, 0, 7); x.fill();
      x.shadowBlur = 0;
      x.fillStyle = '#080605';
      x.beginPath(); x.arc(side * 12, hy - 5, 1.5, 0, 7); x.fill();
      x.fillStyle = 'rgba(255,250,235,.85)';
      x.beginPath(); x.arc(side * 12 - 1.2, hy - 6.6, .9, 0, 7); x.fill();
      // angry brow
      x.strokeStyle = 'rgba(15,10,7,.85)'; x.lineWidth = 2.6;
      x.beginPath();
      x.moveTo(side * 18, hy - 17); x.lineTo(side * 6, hy - 12);
      x.stroke();
    }
    // Foxy eyepatch
    if (type === 'foxy') {
      x.fillStyle = '#0d0b09';
      x.beginPath(); x.ellipse(-12, hy - 5, 9, 8, 0, 0, 7); x.fill();
      x.strokeStyle = '#0d0b09'; x.lineWidth = 2;
      x.beginPath(); x.moveTo(-24, hy - 14); x.lineTo(24, hy - 20); x.stroke();
    }
    // Chica bib
    if (type === 'chica') {
      x.fillStyle = '#ece4d0';
      x.beginPath(); x.ellipse(0, -132, 17, 12, -.1, 0, 7); x.fill();
      x.fillStyle = '#b5473a'; x.font = 'bold 6px Georgia, serif'; x.textAlign = 'center';
      x.fillText('LET\'S EAT', 0, -130);
    }
    // cheek highlights
    x.fillStyle = 'rgba(255,240,210,.08)';
    x.beginPath(); x.ellipse(-18, hy - 16, 8, 12, -.3, 0, 7); x.fill();

    // overall lower-body shade for depth
    const lower = x.createLinearGradient(0, -150, 0, 0);
    lower.addColorStop(0, 'rgba(0,0,0,0)');
    lower.addColorStop(.7, 'rgba(0,0,0,.18)');
    lower.addColorStop(1, 'rgba(0,0,0,.42)');
    x.fillStyle = lower;
    x.fillRect(-50, -155, 100, 158);

    x.restore();
  }

  /* ------------------------------------------------------------ fx overlay */
  _overlay(x, game) {
    const t = this.t;
    // noise specks
    x.globalAlpha = .10 + Math.random() * .03;
    x.drawImage(this.noise, Math.random() * 60, Math.random() * 60, 768, 432);
    x.globalAlpha = 1;
    // static bands
    if (Math.random() < .15) {
      const by = Math.random() * H, bh = 2 + Math.random() * 10;
      x.fillStyle = `rgba(255,255,255,${.02 + Math.random() * .05})`;
      x.fillRect(0, by, W, bh);
    }
    // rolling shutter bar
    const ry = (t * 90) % (H + 80) - 40;
    const rg = x.createLinearGradient(0, ry, 0, ry + 50);
    rg.addColorStop(0, 'rgba(255,255,255,0)');
    rg.addColorStop(.5, 'rgba(255,250,235,.028)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = rg; x.fillRect(0, ry, W, 50);
    // scanlines
    x.fillStyle = 'rgba(0,0,0,.13)';
    for (let y = 0; y < H; y += 3) x.fillRect(0, y, W, 1);
    // vignette
    const v = x.createRadialGradient(W / 2, H / 2, H * .25, W / 2, H / 2, W * .65);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(.75, 'rgba(0,0,0,.18)'); v.addColorStop(1, 'rgba(0,0,0,.65)');
    x.fillStyle = v; x.fillRect(0, 0, W, H);
    // cam text
    x.fillStyle = 'rgba(238,228,204,.75)';
    x.font = '12px "Courier New", monospace';
    x.textAlign = 'left';
    // timestamp bottom
    const hour = game ? game.displayHour() : '12';
    const mm = String(Math.floor((game ? game.nightT : 0) * 7.2) % 60).padStart(2, '0');
    const ss = String(Math.floor((game ? game.nightT : 0) * 13.7) % 60).padStart(2, '0');
    x.fillStyle = 'rgba(240,230,205,.55)';
    x.font = '10px "Courier New", monospace';
    x.fillText(`NIGHT ${game ? game.night : 1}  ${hour}:${mm}:${ss} AM`, 20, H - 18);
    x.textAlign = 'right';
    x.fillStyle = 'rgba(240,230,205,.35)';
    x.fillText('FAZBEAR SECURITY — CH 04', W - 20, H - 18);
    x.textAlign = 'left';
  }

  /* quick glitch draw used by main on switch */
  drawStaticBurst(amount = 1) {
    const x = this.ctx;
    x.fillStyle = `rgba(210,220,205,${.08 * amount})`;
    x.fillRect(0, 0, W, H);
    for (let i = 0; i < 40 * amount; i++) {
      x.fillStyle = `rgba(255,255,255,${Math.random() * .15})`;
      x.fillRect(Math.random() * W, Math.random() * H, Math.random() * 180, 1 + Math.random() * 2);
    }
  }
}

function drawHead(x, type, hx, hy, s, alpha) {
  const pal = {
    freddy: ['#4b301c', '#9b7047', '#111010'],
    bonnie: ['#3c3060', '#7d6ba0', '#3c3060'],
    chica: ['#b08f32', '#d98c2c', '#b08f32'],
    foxy: ['#772b1d', '#a85f3e', '#772b1d']
  }[type];
  if (!pal) return;
  x.save(); x.translate(hx, hy); x.scale(s, s); x.globalAlpha = .9;
  x.fillStyle = pal[0];
  if (type === 'bonnie') {
    x.beginPath(); x.ellipse(-13, -27, 7, 20, .1, 0, 7); x.fill();
    x.beginPath(); x.ellipse(13, -27, 7, 20, -.1, 0, 7); x.fill();
  } else if (type === 'freddy') {
    x.beginPath(); x.arc(-24, -22, 9, 0, 7); x.fill();
    x.beginPath(); x.arc(24, -22, 9, 0, 7); x.fill();
  } else if (type === 'foxy') {
    x.beginPath(); x.moveTo(-22, -16); x.lineTo(-30, -38); x.lineTo(-10, -24); x.fill();
    x.beginPath(); x.moveTo(22, -16); x.lineTo(30, -38); x.lineTo(10, -24); x.fill();
  }
  x.beginPath(); x.ellipse(0, 0, 26, 24, 0, 0, 7); x.fill();
  x.fillStyle = pal[1];
  x.beginPath(); x.ellipse(0, 12, 15, 9, 0, 0, 7); x.fill();
  x.fillStyle = '#120d09';
  x.beginPath(); x.arc(-9, -5, 4.5, 0, 7); x.fill();
  x.beginPath(); x.arc(9, -5, 4.5, 0, 7); x.fill();
  if (type === 'freddy') { x.fillStyle = pal[2]; x.fillRect(-13, -38, 26, 16); x.beginPath(); x.ellipse(0, -22, 21, 4, 0, 0, 7); x.fill(); }
  x.restore();
}
