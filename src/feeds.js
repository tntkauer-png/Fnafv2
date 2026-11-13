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
  '5': { name: 'BACKSTAGE' },
  '6': { name: 'MUSIC BOX' }
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
    else if (id === '6') this._roomMusicBox(x);
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

  _roomMusicBox(x) {
    this._wallBase(x, 0, H, '#4b4356');
    // black & white tiled floor in perspective
    this._perspFloor(x, W / 2, 210, 300, '#8f8878', '#1b1916');
    // deep purple wash
    const wash = x.createRadialGradient(W / 2, 250, 20, W / 2, 250, 390);
    wash.addColorStop(0, 'rgba(126,70,180,.24)'); wash.addColorStop(1, 'rgba(30,10,46,.02)');
    x.fillStyle = wash; x.fillRect(0, 0, W, H);
    // shelving on both walls
    for (const side of [-1, 1]) {
      const bx = side < 0 ? 24 : W - 110;
      x.fillStyle = '#241c18'; x.fillRect(bx, 80, 86, 260);
      for (let i = 0; i < 4; i++) {
        x.fillStyle = '#3a2e24'; x.fillRect(bx + 5, 96 + i * 62, 76, 7);
        x.fillStyle = 'rgba(255,220,180,.1)'; x.fillRect(bx + 5, 96 + i * 62, 76, 2);
        for (let j = 0; j < 3; j++) {
          x.fillStyle = ['#4e3d2c', '#5c4a35', '#3b3026'][(i + j) % 3];
          x.fillRect(bx + 12 + j * 23, 72 + i * 62, 15, 24);
        }
      }
    }
    // centre table
    x.fillStyle = 'rgba(0,0,0,.4)';
    x.beginPath(); x.ellipse(W / 2 + 10, 392, 168, 26, 0, 0, 7); x.fill();
    x.fillStyle = '#3d2a1b'; x.fillRect(W / 2 - 150, 332, 300, 18);
    x.fillStyle = '#2a1b11'; x.fillRect(W / 2 - 132, 350, 16, 62); x.fillRect(W / 2 + 116, 350, 16, 62);
    // ornate music box
    const bx = W / 2, by = 330;
    x.fillStyle = '#5b3d22'; x.fillRect(bx - 72, by - 54, 144, 54);
    x.fillStyle = '#7a5230'; x.fillRect(bx - 72, by - 54, 144, 10);
    x.fillStyle = '#3a2614'; x.fillRect(bx - 66, by - 46, 132, 40);
    // gold trim + crank
    x.strokeStyle = '#c39a52'; x.lineWidth = 3; x.strokeRect(bx - 68, by - 50, 136, 46);
    x.strokeStyle = '#d8b066'; x.lineWidth = 2;
    x.beginPath(); x.arc(bx + 82, by - 18, 9, 0, 7); x.stroke();
    x.beginPath(); x.moveTo(bx + 82, by - 9); x.lineTo(bx + 92, by - 2); x.stroke();
    // tiny ballerina on lid
    x.fillStyle = '#e3d3b6';
    x.beginPath(); x.arc(bx - 6, by - 70, 6, 0, 7); x.fill();
    x.fillStyle = '#c9b8e8';
    x.beginPath(); x.moveTo(bx - 6, by - 64); x.lineTo(bx - 20, by - 48); x.lineTo(bx + 8, by - 48); x.fill();
    x.strokeStyle = '#e3d3b6'; x.lineWidth = 2;
    x.beginPath(); x.moveTo(bx - 6, by - 66); x.lineTo(bx - 22, by - 82); x.stroke();
    // purple shaft of light
    const beam = x.createLinearGradient(0, 30, 0, by - 60);
    beam.addColorStop(0, 'rgba(190,140,255,.2)'); beam.addColorStop(1, 'rgba(190,140,255,0)');
    x.fillStyle = beam;
    x.beginPath(); x.moveTo(310, 30); x.lineTo(458, 30); x.lineTo(410, by - 60); x.lineTo(358, by - 60); x.fill();
    // hanging bulb
    x.strokeStyle = '#151016'; x.lineWidth = 2;
    x.beginPath(); x.moveTo(W / 2, 0); x.lineTo(W / 2, 32); x.stroke();
    x.fillStyle = 'rgba(224,192,255,.9)'; x.beginPath(); x.arc(W / 2, 42, 8, 0, 7); x.fill();
    // puppet strings from ceiling
    x.strokeStyle = 'rgba(220,210,230,.18)'; x.lineWidth = 1;
    for (const sx of [-38, -16, 18, 40]) {
      x.beginPath(); x.moveTo(W / 2 + sx * 2.2, 0); x.lineTo(W / 2 + sx, by - 66); x.stroke();
    }
    // dark edge framing
    x.fillStyle = 'rgba(0,0,0,.5)'; x.fillRect(0, 0, 34, H); x.fillRect(W - 34, 0, 34, H);
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
    if (cam === '6') {
      const mb = (game.musicBox ?? 100) / 100;
      if (mb < .62) {
        const rise = Math.min(1, (1 - mb) * 1.35);
        this._puppet(x, rise, .55 + (1 - mb) * .45);
      }
      // winding sparkle while the handle turns
      if (game.windHeld) {
        for (let i = 0; i < 5; i++) {
          const a = this.t * 6 + i * 1.25;
          x.fillStyle = `rgba(220,180,255,${.2 + Math.random() * .4})`;
          x.fillRect(W / 2 + 84 + Math.cos(a) * 22, 300 + Math.sin(a) * 16, 2, 2);
        }
      }
    }
  }

  _puppet(x, rise, alpha) {
    const cx = W / 2, base = 330;
    const headY = base - 58 - rise * 92;
    // long strings
    x.strokeStyle = `rgba(230,225,240,${.24 * alpha})`; x.lineWidth = 1;
    for (const sx of [-54, -20, 22, 56]) {
      x.beginPath(); x.moveTo(cx + sx * 2.4, 0); x.lineTo(cx + sx, headY - 30); x.stroke();
    }
    // body
    x.fillStyle = `rgba(18,14,24,${.94 * alpha})`;
    x.beginPath();
    x.moveTo(cx - 27, headY + 16); x.lineTo(cx + 27, headY + 16);
    x.lineTo(cx + 45, headY + 120); x.lineTo(cx - 45, headY + 120); x.fill();
    // arms
    x.strokeStyle = `rgba(22,17,28,${.95 * alpha})`; x.lineWidth = 9; x.lineCap = 'round';
    x.beginPath(); x.moveTo(cx - 24, headY + 30); x.lineTo(cx - 62, headY + 74); x.lineTo(cx - 50, headY + 128); x.stroke();
    x.beginPath(); x.moveTo(cx + 24, headY + 30); x.lineTo(cx + 62, headY + 74); x.lineTo(cx + 50, headY + 128); x.stroke();
    // white mask face
    x.fillStyle = `rgba(232,228,238,${alpha})`;
    x.beginPath(); x.ellipse(cx, headY, 28, 34, 0, 0, 7); x.fill();
    x.fillStyle = `rgba(180,172,192,${alpha})`;
    x.beginPath(); x.ellipse(cx, headY + 8, 19, 22, 0, 0, 7); x.fill();
    // hollow eyes + tear tracks
    x.fillStyle = `rgba(8,5,12,${alpha})`;
    x.beginPath(); x.ellipse(cx - 10, headY - 5, 6, 8, .1, 0, 7); x.fill();
    x.beginPath(); x.ellipse(cx + 10, headY - 5, 6, 8, -.1, 0, 7); x.fill();
    x.fillStyle = `rgba(126,70,160,${.55 * alpha})`;
    x.fillRect(cx - 12, headY - 2, 4, 16); x.fillRect(cx + 8, headY - 2, 4, 16);
    x.fillStyle = `rgba(8,5,12,${alpha})`;
    x.beginPath(); x.ellipse(cx, headY + 14, 7, 4, 0, 0, 7); x.fill();
    x.lineCap = 'butt';
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

  _char(x, type, sx, sy, s, variant, close = false) {
    const pal = {
      freddy: ['#4b301c', '#2a190d', '#9b7047', '#171310'],
      bonnie: ['#3c3060', '#241c3c', '#7d6ba0', '#8c2b28'],
      chica: ['#b08f32', '#7c621f', '#d3a53c', '#8c2b28'],
      foxy: ['#772b1d', '#4a1a12', '#a85f3e', '#171310']
    }[type];
    if (!pal) return;
    x.save();
    x.translate(sx, sy);
    x.scale(s, s);
    // ground shadow
    x.fillStyle = 'rgba(0,0,0,.5)';
    x.beginPath(); x.ellipse(6, 4, 44, 10, 0, 0, 7); x.fill();
    // rim glow behind
    const glow = x.createRadialGradient(0, -110, 10, 0, -110, 130);
    glow.addColorStop(0, close ? 'rgba(255,150,90,.1)' : 'rgba(255,190,120,.07)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = glow; x.fillRect(-140, -260, 280, 280);

    const body = pal[0], dark = pal[1], muzzle = pal[2], accent = pal[3];
    // legs
    x.fillStyle = dark;
    x.beginPath(); x.ellipse(-14, -28, 11, 32, 0, 0, 7); x.fill();
    x.beginPath(); x.ellipse(14, -28, 11, 32, 0, 0, 7); x.fill();
    x.fillStyle = body;
    x.beginPath(); x.ellipse(-15, -6, 15, 8, 0, 0, 7); x.fill();
    x.beginPath(); x.ellipse(15, -6, 15, 8, 0, 0, 7); x.fill();
    // torso
    x.fillStyle = body;
    x.beginPath(); x.ellipse(0, -92, 38, 52, 0, 0, 7); x.fill();
    // belly
    x.fillStyle = muzzle; x.globalAlpha = .55;
    x.beginPath(); x.ellipse(0, -82, 24, 34, 0, 0, 7); x.fill();
    x.globalAlpha = 1;
    // arms
    x.fillStyle = dark;
    x.save(); x.rotate(.12); x.beginPath(); x.ellipse(-40, -100, 12, 44, 0, 0, 7); x.fill(); x.restore();
    x.save(); x.rotate(-.12); x.beginPath(); x.ellipse(40, -100, 12, 44, 0, 0, 7); x.fill(); x.restore();
    if (type === 'foxy') {
      x.strokeStyle = '#8b877c'; x.lineWidth = 5;
      x.beginPath(); x.arc(48, -55, 10, .4, 4.3); x.stroke();
    }
    // bowtie
    if (type !== 'foxy') {
      x.fillStyle = accent;
      x.beginPath(); x.moveTo(-10, -134); x.lineTo(-2, -129); x.lineTo(-10, -124); x.fill();
      x.beginPath(); x.moveTo(10, -134); x.lineTo(2, -129); x.lineTo(10, -124); x.fill();
    }
    // head
    const hy = -165;
    x.fillStyle = body;
    if (type === 'bonnie') {
      x.beginPath(); x.ellipse(-14, hy - 34, 8, 26, .12, 0, 7); x.fill();
      x.beginPath(); x.ellipse(14, hy - 34, 8, 26, -.12, 0, 7); x.fill();
    } else if (type === 'freddy') {
      x.beginPath(); x.arc(-30, hy - 28, 12, 0, 7); x.fill();
      x.beginPath(); x.arc(30, hy - 28, 12, 0, 7); x.fill();
    } else if (type === 'chica') {
      x.beginPath(); x.moveTo(-14, hy - 26); x.lineTo(-2, hy - 48); x.lineTo(6, hy - 24); x.fill();
    } else {
      x.beginPath(); x.moveTo(-26, hy - 20); x.lineTo(-36, hy - 48); x.lineTo(-12, hy - 30); x.fill();
      x.beginPath(); x.moveTo(26, hy - 20); x.lineTo(36, hy - 48); x.lineTo(12, hy - 30); x.fill();
    }
    x.beginPath(); x.ellipse(0, hy, 32, 30, 0, 0, 7); x.fill();
    // muzzle / beak
    x.fillStyle = type === 'chica' ? '#d98c2c' : muzzle;
    if (type === 'chica') {
      x.beginPath(); x.moveTo(-15, hy + 8); x.lineTo(15, hy + 8); x.lineTo(0, hy + 26); x.fill();
    } else {
      x.beginPath(); x.ellipse(0, hy + 14, 20, 13, 0, 0, 7); x.fill();
      if (type === 'foxy') { x.beginPath(); x.ellipse(0, hy + 16, 16, 13, 0, 0, 7); x.fill(); }
      x.fillStyle = '#241a12';
      x.beginPath(); x.ellipse(0, hy + 6, 5, 3.6, 0, 0, 7); x.fill();
    }
    // eyes — glowing pinpricks
    x.fillStyle = '#e9e2ce';
    x.beginPath(); x.arc(-11, hy - 4, 6.5, 0, 7); x.fill();
    x.beginPath(); x.arc(11, hy - 4, 6.5, 0, 7); x.fill();
    const eyeCol = type === 'chica' ? '#c7a6ff' : type === 'foxy' ? '#ffc95c' : '#e9f0ff';
    x.fillStyle = eyeCol;
    x.shadowColor = eyeCol; x.shadowBlur = 9;
    x.beginPath(); x.arc(-11, hy - 4, 2.6, 0, 7); x.fill();
    x.beginPath(); x.arc(11, hy - 4, 2.6, 0, 7); x.fill();
    x.shadowBlur = 0;
    // teeth
    x.fillStyle = '#ddd3b9';
    for (let i = -2; i <= 2; i++) x.fillRect(i * 5 - 1.5, hy + 18, 3, 4);
    // hat
    if (type === 'freddy') {
      x.fillStyle = '#111010';
      x.fillRect(-16, hy - 50, 32, 20);
      x.beginPath(); x.ellipse(0, hy - 30, 26, 5, 0, 0, 7); x.fill();
    }
    if (type === 'foxy') {
      x.fillStyle = '#0d0b09';
      x.beginPath(); x.ellipse(-11, hy - 3, 8, 7, 0, 0, 7); x.fill();
    }
    // shade/darken lower half
    const shade = x.createLinearGradient(0, -230, 0, 0);
    shade.addColorStop(0, 'rgba(0,0,0,0)'); shade.addColorStop(1, 'rgba(0,0,0,.35)');
    x.fillStyle = shade; x.fillRect(-70, -250, 140, 250);
    x.restore();
  }

  /* ------------------------------------------------------------ fx overlay */
  _overlay(x, game) {
    const t = this.t;
    const sig = game ? game.camSignal : 100;
    // noise specks
    x.globalAlpha = .10 + Math.random() * .03;
    x.drawImage(this.noise, Math.random() * 60, Math.random() * 60, 768, 432);
    x.globalAlpha = 1;
    // degraded signal
    if (sig < 62) {
      const bad = (62 - sig) / 62;
      x.globalAlpha = bad * .5;
      for (let i = 0; i < 14 * bad; i++) {
        x.drawImage(this.noise, Math.random() * 60, Math.random() * 60, 768, 432);
      }
      x.globalAlpha = 1;
      x.fillStyle = `rgba(255,255,255,${bad * .05})`;
      x.fillRect(0, Math.random() * H, W, 2 + Math.random() * 14);
      if (sig < 20 && Math.random() < .3) {
        x.fillStyle = 'rgba(0,0,0,.55)';
        x.fillRect(0, Math.random() * H, W, 8 + Math.random() * 28);
      }
    }
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
    const totalT = Math.floor((game ? game.nightT : 0) * 75);
    const mm = String(Math.floor(totalT / 60) % 60).padStart(2, '0');
    const ss = String(totalT % 60).padStart(2, '0');
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
