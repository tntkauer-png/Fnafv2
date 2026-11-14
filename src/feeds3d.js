/* Real 3D security-camera feeds. Every room is a small three.js set built
   from the same materials and animatronic models as the office, rendered to
   the tablet canvas by its own WebGL renderer. The scanlines / grain /
   vignette remain CSS layers on top. */
import * as THREE from '../vendor/three.module.min.js';
import {
  wallTexture, wainscotTexture, ceilingTexture, floorTexture, posterTexture,
  metalTexture, ventTexture, signTexture, hazardTexture, concreteTexture,
  glowTexture, normalTexture, finish, rand, resetSeed
} from './textures.js';
import { makeAnimatronic } from './world.js';

const W = 768, H = 432;

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

function box(w, h, d, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  return m;
}
function plane(w, h, material, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  return m;
}
function cyl(rt, rb, h, seg, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material);
  m.position.set(x, y, z);
  return m;
}

/* ------------------------------------------------------------ textures */
let _curtainCache = {};
function curtainTexture(base, dark, light, stars) {
  const key = base + (stars ? 's' : '');
  if (_curtainCache[key]) return _curtainCache[key];
  const w = 512, h = 512, c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.fillStyle = base; x.fillRect(0, 0, w, h);
  const n = 26, sw = w / n;
  for (let i = 0; i < n; i++) {
    const g = x.createLinearGradient(i * sw, 0, (i + 1) * sw, 0);
    g.addColorStop(0, dark);
    g.addColorStop(.35, light);
    g.addColorStop(.6, base);
    g.addColorStop(1, dark);
    x.fillStyle = g;
    x.fillRect(i * sw, 0, sw + 1, h);
    x.fillStyle = 'rgba(0,0,0,.18)';
    x.fillRect(i * sw, 0, 3, h);
  }
  if (stars) {
    for (let i = 0; i < 26; i++) {
      const sx = 30 + rand() * (w - 60), sy = 20 + rand() * (h - 40), r = 5 + rand() * 7;
      x.save(); x.translate(sx, sy); x.rotate(rand() * .6);
      x.fillStyle = `rgba(232,196,120,${.5 + rand() * .35})`;
      x.beginPath();
      for (let j = 0; j < 10; j++) {
        const a = -Math.PI / 2 + j * Math.PI / 5, rr = j % 2 ? r * .45 : r;
        x[j ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr);
      }
      x.closePath(); x.fill(); x.restore();
    }
  }
  const t = finish(c, 1, 1);
  _curtainCache[key] = t;
  return t;
}

function bannerTexture() {
  const w = 1024, h = 128, c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.clearRect(0, 0, w, h);
  // string
  x.strokeStyle = 'rgba(230,220,190,.55)'; x.lineWidth = 3;
  x.beginPath(); x.moveTo(0, 30); x.quadraticCurveTo(w / 2, 64, w, 30); x.stroke();
  const cols = ['#c9463a', '#e6c063', '#6f9c72', '#d8d0b8'];
  for (let i = 0; i < 22; i++) {
    const px = 22 + i * 46, py = 34 + Math.sin(i / 21 * Math.PI) * 26;
    x.fillStyle = cols[i % 4];
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + 34, py); x.lineTo(px + 17, py + 34); x.closePath(); x.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function partyTextTexture(word = "LET'S PARTY!") {
  const w = 512, h = 96, c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.fillStyle = 'rgba(0,0,0,0)'; x.clearRect(0, 0, w, h);
  x.textAlign = 'center';
  x.font = 'bold 54px Georgia, serif';
  x.shadowColor = '#000'; x.shadowBlur = 6;
  x.fillStyle = '#e8d7ae';
  x.fillText(word, w / 2, 58);
  x.font = '18px Georgia, serif';
  x.fillStyle = 'rgba(232,215,174,.75)';
  x.fillText("FREDDY FAZBEAR'S PIZZA", w / 2, 86);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ================================================================ class */
export class FeedRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.cam = '1A';
    this.t = 0;
    this.ok = false;
    this.rooms = {};
    this.flip = 0;
    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas, antialias: true, powerPreference: 'high-performance', stencil: false
      });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      this.renderer.setSize(W, H, false);
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.0;
      this.ok = true;
    } catch (e) { console.warn('cctv webgl unavailable', e); return; }

    resetSeed(4242);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x030302);
    this.camera = new THREE.PerspectiveCamera(58, W / H, .04, 42);
    this.glowTex = glowTexture();

    this._buildEnv();
    this._buildGlobalLights();
    this._buildStage();
    this._buildDining();
    this._buildCove();
    this._buildHall('2A', -1);
    this._buildHall('4A', 1);
    this._buildCorner('2B', -1);
    this._buildCorner('4B', 1);
    this._buildCloset();
    this._buildBackstage();

    this._buildBurstOverlay();
    this.precompile();
    this.setCam('1A');
  }

  /* small equirect gradient so floor tiles and metal get a believable sheen */
  _buildEnv() {
    const w = 512, h = 256, c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#0a0806');
    g.addColorStop(.42, '#4a3826');
    g.addColorStop(.6, '#6a5438');
    g.addColorStop(.8, '#221a12');
    g.addColorStop(1, '#070605');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    for (const sx of [128, 384]) {
      const rg = x.createRadialGradient(sx, 60, 2, sx, 60, 110);
      rg.addColorStop(0, 'rgba(255,226,176,.8)');
      rg.addColorStop(1, 'rgba(255,190,110,0)');
      x.fillStyle = rg; x.fillRect(sx - 110, 0, 220, 200);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    this.scene.environment = tex;
  }

  _glow(color, size, opacity = .5) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.glowTex, color, transparent: true, opacity,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    s.scale.set(size, size, 1);
    return s;
  }

  _buildGlobalLights() {
    this.scene.add(new THREE.HemisphereLight(0x9a8868, 0x0b0805, .18));
  }

  _room(id, def) {
    const g = new THREE.Group();
    g.visible = false;
    this.scene.add(g);
    const room = { id, def, group: g, actors: {}, extras: [] };
    this.rooms[id] = room;
    return room;
  }

  _shell(room, w, d, h, opts = {}) {
    const g = room.group;
    const wall = new THREE.MeshStandardMaterial({
      map: wallTexture(), normalMap: normalTexture('plaster', 2.0),
      normalScale: new THREE.Vector2(.6, .6), roughness: .94, envMapIntensity: .16
    });
    const wains = new THREE.MeshStandardMaterial({
      map: wainscotTexture(), normalMap: normalTexture('wood', 1.8),
      normalScale: new THREE.Vector2(.55, .55), roughness: .82, envMapIntensity: .22
    });
    const floorM = new THREE.MeshStandardMaterial({
      map: floorTexture(), normalMap: normalTexture('tile', 1.6),
      normalScale: new THREE.Vector2(.8, .8), roughness: .32, metalness: .18, envMapIntensity: .7
    });
    const ceil = new THREE.MeshStandardMaterial({
      map: ceilingTexture(), normalMap: normalTexture('tile', 1.3),
      normalScale: new THREE.Vector2(.7, .7), roughness: 1, envMapIntensity: .08
    });
    const trim = new THREE.MeshStandardMaterial({ color: 0x2a2118, roughness: .7 });
    g.add(plane(w, d, floorM, 0, 0, 0, -Math.PI / 2));
    g.add(plane(w, d, ceil, 0, h, 0, Math.PI / 2));
    // four walls facing inward
    g.add(plane(w, h, wall, 0, h / 2, -d / 2, 0, 0));
    g.add(plane(w, h, wall, 0, h / 2, d / 2, 0, Math.PI));
    g.add(plane(d, h, wall, -w / 2, h / 2, 0, 0, Math.PI / 2));
    g.add(plane(d, h, wall, w / 2, h / 2, 0, 0, -Math.PI / 2));
    // wainscot bands on all four walls
    const wy = .46;
    g.add(plane(w, .92, wains, 0, wy, -d / 2 + .011, 0, 0));
    g.add(plane(w, .92, wains, 0, wy, d / 2 - .011, 0, Math.PI));
    g.add(plane(d - .02, .92, wains, -w / 2 + .011, wy, 0, 0, Math.PI / 2));
    g.add(plane(d - .02, .92, wains, w / 2 - .011, wy, 0, 0, -Math.PI / 2));
    // chair rail + baseboard
    for (const [len, x, z, ry] of [[w, 0, -d / 2 + .02, 0], [w, 0, d / 2 - .02, Math.PI], [d, -w / 2 + .02, 0, Math.PI / 2], [d, w / 2 - .02, 0, -Math.PI / 2]]) {
      g.add(box(len, .06, .05, trim, x, .94, z));
      g.add(box(len, .13, .05, trim, x, .07, z));
    }
    room.mats = { wall, wains, floorM, ceil, trim };
    return room;
  }

  _lightBar(room, x, y, z, len = .8, color = 0xffe8bd, intensity = 5.5, dist = 9) {
    const g = room.group;
    const fixture = box(len, .05, .22, new THREE.MeshStandardMaterial({ color: 0x2a2721, roughness: .6 }), x, y + .045, z);
    const tube = box(len * .82, .03, .15, new THREE.MeshStandardMaterial({
      color: 0x1a1814, emissive: color, emissiveIntensity: 1.6, roughness: .5
    }), x, y, z);
    g.add(fixture, tube);
    const p = new THREE.PointLight(color, intensity, dist, 1.6);
    p.position.set(x, y - .12, z);
    g.add(p);
    const halo = this._glow(color, 1.3, .4);
    halo.position.set(x, y - .08, z);
    g.add(halo);
    return p;
  }

  _poster(room, kind, x, y, z, ry, s = 1) {
    const p = plane(.62 * s, .82 * s, new THREE.MeshStandardMaterial({ map: posterTexture(kind), roughness: .92 }), x, y, z, 0, ry);
    room.group.add(p);
    return p;
  }

  _addActor(room, type, x, y, z, rotY = 0, scale = 1) {
    const a = makeAnimatronic(type);
    a.group.position.set(x, y, z);
    a.group.rotation.y = rotY;
    a.group.scale.setScalar(scale);
    a.group.traverse(o => { if (o.isMesh) o.castShadow = false; });
    a.userData = { baseY: y, baseHeadRX: a.head.rotation.x, baseRotY: rotY };
    room.group.add(a.group);
    room.actors[type] = a;
    return a;
  }

  /* ------------------------------------------------------------ 1A stage */
  _buildStage() {
    const room = this._room('1A', {
      pos: V3(0, 2.5, 3.35), look: V3(0, 1.35, -1.7), fov: 56
    });
    const g = room.group;
    const d = 7.6, w = 10, h = 3.6;
    this._shell(room, w, d, h);

    // raised stage
    const stageM = new THREE.MeshStandardMaterial({ map: floorTexture(), color: 0x6a5238, roughness: .7 });
    g.add(box(8.2, .5, 2.9, stageM, 0, .25, -2.1));
    g.add(box(8.3, .08, .14, new THREE.MeshStandardMaterial({ color: 0x5d1a14, roughness: .55 }), 0, .52, -.72));

    // backdrop curtain + valance
    const curt = new THREE.MeshStandardMaterial({ map: curtainTexture('#5f1a1b', '#2c0c0e', '#8a2a26', true), roughness: .9 });
    g.add(plane(9.4, 3.1, curt, 0, 1.85, -3.4));
    const valMat = new THREE.MeshStandardMaterial({ color: 0x5d1512, roughness: .85 });
    g.add(box(9.6, .5, .2, valMat, 0, 3.34, -3.3));
    for (let i = 0; i < 9; i++) {
      const swag = new THREE.Mesh(new THREE.SphereGeometry(.42, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), valMat);
      swag.position.set(-3.6 + i * .9, 3.1, -3.28);
      swag.scale.set(1, .55, .3);
      g.add(swag);
    }

    // banner + flanking signs that stay clear of the animatronics
    const banner = plane(5.4, .62, new THREE.MeshBasicMaterial({ map: bannerTexture(), transparent: true }), 0, 3.02, -3.05);
    g.add(banner);
    for (const s of [-1, 1]) {
      const word = plane(1.7, .44, new THREE.MeshBasicMaterial({ map: partyTextTexture(s < 0 ? "LET'S" : 'PARTY!'), transparent: true }), s * 3.1, 2.34, -3.2);
      g.add(word);
    }

    // star spotlights (visible housings)
    const metal = new THREE.MeshStandardMaterial({ color: 0x35322c, roughness: .4, metalness: .7 });
    for (const sx of [-2.6, 0, 2.6]) {
      g.add(cyl(.09, .13, .26, 10, metal, sx, 3.28, -2.5));
      const beam = this._glow(0xffd9a6, 1.1, .28);
      beam.position.set(sx, 3.1, -2.3);
      g.add(beam);
    }
    this._lightBar(room, 0, 3.35, -.4, 1.6, 0xffd9a6, 8, 11);
    const warm = new THREE.PointLight(0xffc98d, 7, 9, 1.5);
    warm.position.set(0, 2.4, .2); g.add(warm);
    const red = new THREE.PointLight(0xa3291f, 4.5, 8, 2);
    red.position.set(-3.4, 2.1, -1.4); g.add(red);
    const red2 = new THREE.PointLight(0x8d2418, 3.6, 8, 2);
    red2.position.set(3.4, 2.1, -1.4); g.add(red2);

    // stars glittering on the curtain (glow sprites)
    for (let i = 0; i < 10; i++) {
      const s = this._glow(0xffdf9a, .3 + rand() * .25, .3);
      s.position.set(-3.8 + rand() * 7.6, 1 + rand() * 2, -3.3);
      g.add(s);
      room.extras.push({ obj: s, base: .3, phase: rand() * 7 });
    }

    // stage characters
    this._addActor(room, 'freddy', 0, .5, -2.25, 0, 1.06);
    this._addActor(room, 'bonnie', -1.7, .5, -1.95, .18, 1.0);
    this._addActor(room, 'chica', 1.7, .5, -1.95, -.18, 1.0);
  }

  /* ------------------------------------------------------------ 1B dining */
  _buildDining() {
    const room = this._room('1B', {
      pos: V3(0, 2.7, 3.9), look: V3(0, 1.15, -1.2), fov: 62
    });
    const g = room.group;
    this._shell(room, 11, 8.4, 3.6);

    // stage doorway on the back wall
    g.add(box(2.4, 2.3, .3, new THREE.MeshStandardMaterial({ color: 0x1a1310, roughness: .9 }), 0, 1.15, -3.9));
    const inset = plane(2.0, 2.1, new THREE.MeshStandardMaterial({ map: curtainTexture('#5f1a1b', '#2c0c0e', '#8a2a26'), roughness: .9 }), 0, 1.1, -3.74);
    g.add(inset);
    const stageGlow = this._glow(0xffcf8a, 2.4, .16);
    stageGlow.position.set(0, 1.0, -3.3); g.add(stageGlow);

    // banner + sign
    const banner = plane(7.4, .8, new THREE.MeshBasicMaterial({ map: bannerTexture(), transparent: true }), 0, 3.0, -3.6);
    g.add(banner);
    const sign = plane(2.6, .5, new THREE.MeshStandardMaterial({ map: signTexture(), roughness: .85 }), 3.6, 2.6, -4.14, 0, 0);
    g.add(sign);
    this._poster(room, 'main', -4.2, 1.8, -4.16, 0, .9);
    this._poster(room, 'celebrate', 4.2, 1.8, -4.16, 0, .9);
    this._poster(room, 'kids', -5.46, 1.7, -.8, Math.PI / 2, .8);

    // tables with party hats, plates and chairs
    const tableTop = new THREE.MeshStandardMaterial({ color: 0x8c8070, roughness: .55, metalness: .08 });
    const legM = new THREE.MeshStandardMaterial({ color: 0x33302a, roughness: .6, metalness: .3 });
    const hatCols = [0xc04436, 0xd3ac54, 0x5c7f66];
    const tables = [[-2.6, -.9], [.4, -1.8], [2.8, -.2], [-3.8, 1.4], [1.2, 1.8], [-1.2, 2.6]];
    for (const [tx, tz] of tables) {
      const r = .8;
      const top = cyl(r, r, .06, 20, tableTop, tx, .74, tz);
      g.add(top);
      g.add(cyl(.07, .09, .72, 8, legM, tx, .36, tz));
      g.add(cyl(.3, .36, .04, 14, legM, tx, .02, tz));
      // chairs
      for (let i = 0; i < 3; i++) {
        const a = i * (Math.PI * 2 / 3) + .5;
        const cx = tx + Math.cos(a) * (r + .32), cz = tz + Math.sin(a) * (r + .32);
        g.add(box(.42, .06, .42, legM, cx, .45, cz));
        g.add(box(.42, .5, .06, legM, cx - Math.cos(a) * .18, .72, cz - Math.sin(a) * .18));
        g.add(box(.06, .45, .42, legM, cx - Math.cos(a) * .18, .68, cz));
      }
      // hats & plates on top
      for (let i = 0; i < 3; i++) {
        const hx = tx + (i - 1) * .38, hz = tz + (i % 2 ? .2 : -.15);
        const hat = new THREE.Mesh(new THREE.ConeGeometry(.085, .22, 10), new THREE.MeshStandardMaterial({ color: hatCols[i % 3], roughness: .6 }));
        hat.position.set(hx, .88, hz); g.add(hat);
        if (i === 1) {
          const plate = cyl(.16, .18, .025, 14, new THREE.MeshStandardMaterial({ color: 0xe7dcc4, roughness: .5 }), hx + .45, .78, hz);
          g.add(plate);
        }
      }
      const pool = this._glow(0xffd8a0, 1.5, .1);
      pool.position.set(tx, .5, tz);
      g.add(pool);
    }
    this._lightBar(room, -2.4, 3.35, -.4, 1.4, 0xffe2b0, 6, 10);
    this._lightBar(room, 2.4, 3.35, .6, 1.4, 0xffe2b0, 6, 10);
    const fill = new THREE.PointLight(0xffd0a0, 5, 11, 1.6);
    fill.position.set(0, 2.6, 2.4); g.add(fill);

    // characters in the dining room
    this._addActor(room, 'freddy', 0, 0, -.4, .12, 1.02);
    this._addActor(room, 'bonnie', -2.7, 0, .6, .3, .98);
    this._addActor(room, 'chica', 2.6, 0, 1.0, -.28, .98);
  }

  /* ------------------------------------------------------------ 1C cove */
  _buildCove() {
    const room = this._room('1C', {
      pos: V3(0, 2.35, 2.55), look: V3(0, 1.3, -1.9), fov: 58
    });
    const g = room.group;
    this._shell(room, 7.4, 5.6, 3.3);

    // dark backdrop behind the curtain so the gap reads as a black opening
    g.add(plane(5.9, 3.1, new THREE.MeshStandardMaterial({ color: 0x050403, roughness: 1 }), 0, 1.72, -2.75));

    // low platform
    const platM = new THREE.MeshStandardMaterial({ map: floorTexture(), color: 0x4a3a52, roughness: .75 });
    g.add(box(5.4, .35, 2.2, platM, 0, .175, -1.7));

    // curtains — two sliding panels
    const curtMat = new THREE.MeshStandardMaterial({ map: curtainTexture('#3f2456', '#221231', '#6a4488', true), roughness: .92 });
    const panelW = 3.15;
    this.covePanels = [];
    for (const s of [-1, 1]) {
      const p = plane(panelW, 2.9, curtMat, s * (panelW / 2 + .12), 1.72, -2.35);
      p.userData.side = s;
      g.add(p);
      this.covePanels.push(p);
      // leading edge tieback
      g.add(box(.1, 2.9, .12, new THREE.MeshStandardMaterial({ color: 0x2a1738, roughness: .85 }), s * (panelW / 2 + .12), 1.72, -2.28));
    }
    // valance above
    const valMat = new THREE.MeshStandardMaterial({ color: 0x2a1738, roughness: .85 });
    g.add(box(5.6, .45, .2, valMat, 0, 3.05, -2.3));
    for (let i = 0; i < 6; i++) {
      const swag = new THREE.Mesh(new THREE.SphereGeometry(.36, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), valMat);
      swag.position.set(-2.1 + i * .84, 2.86, -2.28);
      swag.scale.set(1, .5, .3);
      g.add(swag);
    }

    // out-of-order sign mounted on the left wall
    const sign = plane(.92, 1.18, new THREE.MeshStandardMaterial({ map: posterTexture('cove'), roughness: .9 }), -3.66, 1.72, -.5, 0, Math.PI / 2);
    g.add(sign);
    this._poster(room, 'celebrate', 3.2, 1.9, -2.76, 0, .8);

    // rope barrier
    const postM = new THREE.MeshStandardMaterial({ color: 0x8d7d55, roughness: .4, metalness: .5 });
    for (const sx of [-1.9, 1.9]) {
      g.add(cyl(.05, .07, 1.05, 8, postM, sx, .52, .9));
      const ball = new THREE.Mesh(new THREE.SphereGeometry(.08, 10, 8), postM);
      ball.position.set(sx, 1.06, .9); g.add(ball);
    }
    const rope = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      V3(-1.9, 1.0, .9), V3(0, .84, .98), V3(1.9, 1.0, .9)
    ]), 16, .03, 6, false), new THREE.MeshStandardMaterial({ color: 0x6a1a16, roughness: .6 }));
    g.add(rope);

    // hook on the floor (he leaves it behind)
    const hook = new THREE.Mesh(new THREE.TorusGeometry(.09, .022, 6, 16, Math.PI * 1.4), new THREE.MeshStandardMaterial({ color: 0x9b988c, roughness: .3, metalness: .95 }));
    hook.position.set(.25, .06, -1.5);
    hook.rotation.x = -Math.PI / 2.4;
    g.add(hook);
    room.hook = hook;

    this._lightBar(room, 0, 3.05, -.2, .9, 0xc9b8ff, 4.5, 8);
    const purple = new THREE.PointLight(0x7a5aa0, 3.4, 7, 2);
    purple.position.set(0, 2.2, -1.2); g.add(purple);
    const warm = new THREE.PointLight(0xffc890, 2.6, 6, 2);
    warm.position.set(0, 2.0, 1.6); g.add(warm);

    // eyes in the dark glow
    const eyeGlow = this._glow(0xffc45c, .5, 0);
    eyeGlow.position.set(0, 1.62, -2.15);
    g.add(eyeGlow);
    room.eyeGlow = eyeGlow;
    this._addActor(room, 'foxy', 0, .35, -2.15, 0, .95);
    room.actors.foxy.group.visible = false;
    room.coveGap = .24;
  }

  /* ------------------------------------------------------------ halls */
  _buildHall(id, side) {
    const room = this._room(id, {
      pos: V3(side * .12, 2.42, 3.1), look: V3(0, 1.05, -6.5), fov: 66
    });
    const g = room.group;
    const w = 2.6, d = 12.5, h = 2.75;
    this._shell(room, w, d, h);

    // ceiling beams + conduit
    const trim = room.mats.trim;
    for (let i = 0; i < 5; i++) g.add(box(.09, .07, w, trim, 0, h - .045, -5 + i * 2.2));
    const pipeM = new THREE.MeshStandardMaterial({ map: metalTexture(), roughness: .45, metalness: .7 });
    for (const zs of [-.95, .95]) {
      const pipe = cyl(.022, .022, d - .4, 6, pipeM, zs, h - .12, 0);
      pipe.rotation.x = Math.PI / 2;
      g.add(pipe);
    }

    // ceiling lights down the hall
    for (let i = 0; i < 4; i++) {
      this._lightBar(room, 0, h - .06, -1.4 - i * 2.9, .62, 0xffdcae, 3.4 - i * .5, 6.5);
    }

    // posters along the walls
    this._poster(room, 'celebrate', side * -1 * 1.31, 1.55, -2.2, side < 0 ? Math.PI / 2 : -Math.PI / 2, .85);
    this._poster(room, 'safety', side * -1 * 1.31, 1.55, -5.4, side < 0 ? Math.PI / 2 : -Math.PI / 2, .85);
    this._poster(room, 'kids', side * 1.31, 1.5, -3.6, side < 0 ? Math.PI / 2 : -Math.PI / 2, .7);

    // far end: staff door + alarm
    const doorM = new THREE.MeshStandardMaterial({ map: metalTexture(), color: 0x8d8a80, roughness: .55, metalness: .4 });
    g.add(plane(1.05, 1.95, doorM, 0, .98, -d / 2 + .06, 0, 0));
    g.add(box(1.2, .07, .06, trim, 0, 1.99, -d / 2 + .07));
    const handle = cyl(.018, .018, .17, 6, new THREE.MeshStandardMaterial({ color: 0x9a9588, roughness: .3, metalness: .85 }), .34, 1.02, -d / 2 + .13);
    handle.rotation.z = Math.PI / 2;
    g.add(handle);
    const staffSign = plane(.44, .15, new THREE.MeshStandardMaterial({ map: signTexture(), roughness: .85 }), -.3, 1.66, -d / 2 + .07, 0, 0);
    g.add(staffSign);
    const alarm = box(.13, .18, .07, new THREE.MeshStandardMaterial({ color: 0xa8332a, roughness: .5 }), .85, 1.95, -d / 2 + .08);
    g.add(alarm);
    const alarmGlow = this._glow(0xff4a32, .24, .5);
    alarmGlow.position.set(.85, 1.98, -d / 2 + .12);
    g.add(alarmGlow);
    // far-end practical so the hall reads in the dark
    const far = new THREE.PointLight(0x8d7a58, 1.5, 5, 2);
    far.position.set(0, 2.3, -d / 2 + 1); g.add(far);

    // wet floor cone near camera
    const cone = new THREE.Mesh(new THREE.ConeGeometry(.17, .36, 12), new THREE.MeshStandardMaterial({ color: 0xb99a32, roughness: .6 }));
    cone.position.set(-.6, .18, .4);
    g.add(cone);

    // haze along the hall
    for (let i = 0; i < 3; i++) {
      const hz = this._glow(0xc9b18a, 1.4 + i * .5, .05);
      hz.position.set(0, .8 + i * .15, -1 - i * 2.6);
      g.add(hz);
    }

    if (side < 0) {
      this._addActor(room, 'bonnie', .42, 0, -2.9, 0, 1.02);
      this._addActor(room, 'foxy', 0, 0, -8.6, 0, 1.0);
      room.actors.foxy.group.visible = false;
    } else {
      this._addActor(room, 'chica', -.42, 0, -2.7, 0, 1.02);
      this._addActor(room, 'freddy', .1, 0, -5.6, .1, 1.0);
    }
  }

  /* ------------------------------------------------------------ corners */
  _buildCorner(id, side) {
    const room = this._room(id, {
      pos: V3(side * -.7, 2.5, 1.55), look: V3(side * .3, 1.15, -1.15), fov: 60
    });
    const g = room.group;
    this._shell(room, 4.4, 4.6, 2.75);

    // the office doorway on the back wall
    const trim = room.mats.trim;
    const frameM = new THREE.MeshStandardMaterial({ color: 0x3a3126, roughness: .5, metalness: .5 });
    const steelM = new THREE.MeshStandardMaterial({ map: metalTexture(), color: 0x9a968b, roughness: .38, metalness: .75 });
    g.add(box(.16, 2.42, .2, frameM, side * -1.28, 1.21, -1.9));
    g.add(box(.16, 2.42, .2, frameM, side * 1.28, 1.21, -1.9));
    g.add(box(2.72, .2, .2, frameM, 0, 2.5, -1.9));
    // dark hall beyond the open door
    g.add(plane(2.3, 2.34, new THREE.MeshStandardMaterial({ color: 0x0c0a08, roughness: 1 }), 0, 1.17, -2.0, 0, 0));
    // warning light strip above the door
    const strip = box(.8, .05, .05, new THREE.MeshBasicMaterial({ color: 0x52140f }), 0, 2.36, -1.86);
    g.add(strip);
    room.strip = strip;
    const stripGlow = this._glow(0xff3b26, .5, .18);
    stripGlow.position.set(0, 2.34, -1.8);
    g.add(stripGlow);
    room.stripGlow = stripGlow;
    // button panel with a red eye
    const panel = box(.16, .5, .3, new THREE.MeshStandardMaterial({ color: 0x2b2823, roughness: .6, metalness: .3 }), side * 1.52, 1.32, -1.5, 0);
    panel.rotation.y = side * -.5;
    g.add(panel);
    const btn = box(.05, .11, .12, new THREE.MeshStandardMaterial({ color: 0xa8352c, emissive: 0x6a1a10, emissiveIntensity: 1.1, roughness: .4 }), side * 1.48, 1.42, -1.42);
    btn.rotation.y = side * -.5;
    g.add(btn);
    const btnGlow = this._glow(0xff3b26, .3, .5);
    btnGlow.position.set(side * 1.42, 1.44, -1.38);
    g.add(btnGlow);
    // hazard floor stripe in front of the door
    const hz = plane(2.2, .34, new THREE.MeshStandardMaterial({ map: hazardTexture(), roughness: .8 }), 0, .012, -1.55, -Math.PI / 2);
    g.add(hz);

    this._lightBar(room, side * -1.0, 2.55, .2, .7, 0xffdcae, 3.2, 6);
    const red = new THREE.PointLight(0xa3291f, 2.2, 5, 2);
    red.position.set(0, 2.1, -1.2); g.add(red);

    if (side < 0) {
      this._addActor(room, 'bonnie', side * .3, 0, -1.35, side * .45, 1.05);
      this._addActor(room, 'foxy', side * .35, 0, -1.25, side * .45, 1.05);
    } else {
      this._addActor(room, 'chica', side * .3, 0, -1.35, side * .45, 1.05);
      this._addActor(room, 'freddy', side * .3, 0, -1.35, side * .45, 1.02);
    }
    room.actors.foxy && (room.actors.foxy.group.visible = false);
    room.actors.freddy && (room.actors.freddy.group.visible = false);
  }

  /* ------------------------------------------------------------ 3 closet */
  _buildCloset() {
    const room = this._room('3', {
      pos: V3(.95, 1.98, 1.18), look: V3(-.42, .78, -.55), fov: 72
    });
    const g = room.group;
    this._shell(room, 2.6, 2.9, 2.5);

    // shelves along the left and back walls
    const shelfM = new THREE.MeshStandardMaterial({ color: 0x2e241a, roughness: .8 });
    const boxCols = [0x5c4a34, 0x6b5740, 0x3f3426];
    // left wall unit
    for (const sy of [.5, .95, 1.4]) {
      g.add(box(.5, .05, 1.9, shelfM, -.98, sy, -.35));
      for (let i = 0; i < 3; i++) {
        const bw = .22 + rand() * .18, bh = .2 + rand() * .22, bd = .24 + rand() * .14;
        const b = box(bd, bh, bw, new THREE.MeshStandardMaterial({ color: boxCols[(i + Math.round(sy * 3)) % 3], roughness: .85 }),
          -.98 + (rand() - .5) * .1, sy + bh / 2 + .035, -1.1 + i * .6 + (rand() - .5) * .1);
        b.rotation.y = (rand() - .5) * .3;
        g.add(b);
      }
    }
    // back wall shelf
    g.add(box(1.7, .05, .5, shelfM, .1, 1.28, -1.18));
    for (let i = 0; i < 3; i++) {
      const bw = .2 + rand() * .18, bh = .18 + rand() * .2;
      g.add(box(bw, bh, .3, new THREE.MeshStandardMaterial({ color: boxCols[i], roughness: .85 }), -.5 + i * .55, 1.28 + bh / 2 + .03, -1.18));
    }
    // mop + bucket in the near corner
    g.add(cyl(.025, .025, 1.3, 6, new THREE.MeshStandardMaterial({ color: 0x7a6a4d, roughness: .6 }), .82, .65, .85));
    const mopHead = new THREE.Mesh(new THREE.ConeGeometry(.1, .3, 8), new THREE.MeshStandardMaterial({ color: 0x6d6249, roughness: .9 }));
    mopHead.position.set(.82, .12, .85); mopHead.rotation.x = Math.PI;
    g.add(mopHead);
    g.add(box(.4, .3, .3, new THREE.MeshStandardMaterial({ color: 0x3c5d63, roughness: .6 }), .55, .15, .55));
    // rag on the floor
    g.add(box(.3, .02, .22, new THREE.MeshStandardMaterial({ color: 0xb8ab8c, roughness: .95 }), -.2, .012, .5));

    // hanging bulb
    g.add(cyl(.006, .006, .55, 4, new THREE.MeshStandardMaterial({ color: 0x1a1712 }), .1, 2.22, .05));
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(.05, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd8a0 }));
    bulb.position.set(.1, 1.92, .05);
    g.add(bulb);
    const p = new THREE.PointLight(0xffcf96, 5.5, 4.5, 1.5);
    p.position.set(.1, 1.85, .05);
    g.add(p);
    const halo = this._glow(0xffd8a0, .7, .55);
    halo.position.copy(bulb.position);
    g.add(halo);
    room.bulb = halo;
  }

  /* ------------------------------------------------------------ 5 backstage */
  _buildBackstage() {
    const room = this._room('5', {
      pos: V3(-1.5, 2.4, 2.4), look: V3(.4, .95, -1.6), fov: 64
    });
    const g = room.group;
    this._shell(room, 6.2, 5.4, 3.1);

    // workbench along the back
    const benchM = new THREE.MeshStandardMaterial({ map: metalTexture(), color: 0x777466, roughness: .5, metalness: .5 });
    g.add(box(4.6, .08, 1.1, benchM, .4, .86, -1.9));
    for (const lx of [-1.7, .4, 2.5]) g.add(box(.09, .86, .09, benchM, lx, .43, -1.9));
    g.add(box(4.6, .5, .04, new THREE.MeshStandardMaterial({ color: 0x1d150e, roughness: .9 }), .4, .58, -2.36));

    // spare heads on the shelf above the bench
    const shelf = box(4.6, .05, .6, new THREE.MeshStandardMaterial({ color: 0x2b241b, roughness: .85 }), .4, 1.62, -2.1);
    g.add(shelf);
    const types = ['freddy', 'bonnie', 'chica', 'foxy'];
    types.forEach((t, i) => {
      const head = this._spareHead(t);
      head.position.set(-1.3 + i * 1.1, 1.85, -2.1);
      head.rotation.y = (i - 1.5) * .3;
      g.add(head);
    });

    // endoskeleton standing in the corner
    const endo = new THREE.Group();
    const metalM = new THREE.MeshStandardMaterial({ color: 0x8b877c, roughness: .32, metalness: .92 });
    endo.add(cyl(.05, .07, .95, 8, metalM, 0, .48, 0));
    endo.add(cyl(.04, .05, .6, 6, metalM, 0, 1.25, 0));
    const ehead = new THREE.Mesh(new THREE.SphereGeometry(.13, 14, 10), metalM);
    ehead.position.y = 1.62; endo.add(ehead);
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(.022, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffcf6a }));
      eye.position.set(s * .05, 1.64, .11); endo.add(eye);
      endo.add(cyl(.022, .022, .55, 6, metalM, s * .22, 1.2, 0));
      endo.add(cyl(.02, .02, .6, 6, metalM, s * .12, .45, 0));
    }
    endo.position.set(2.2, 0, -1.4);
    endo.rotation.y = -.5;
    g.add(endo);
    const endoGlow = this._glow(0xffcf6a, .5, .35);
    endoGlow.position.set(2.25, 1.66, -1.3);
    g.add(endoGlow);
    room.endoGlow = endoGlow;

    // tools + parts on the bench
    for (let i = 0; i < 6; i++) {
      g.add(box(.1 + rand() * .22, .03 + rand() * .05, .08 + rand() * .1,
        new THREE.MeshStandardMaterial({ color: [0x777266, 0x5d5a50, 0x8a2a22, 0x2a2723][i % 4], roughness: .6 }),
        -.8 + rand() * 2.6, .92, -1.9 + rand() * .5));
    }
    // spare arm propped against the bench
    const arm = cyl(.045, .05, .7, 8, metalM, -1.2, .35, -1.5);
    arm.rotation.z = .5;
    g.add(arm);

    // hanging wires
    const wireM = new THREE.MeshStandardMaterial({ color: 0x14110e, roughness: .8 });
    for (let i = 0; i < 5; i++) {
      const x0 = -2 + i * 1.05;
      const pts = [V3(x0, 3.05, -1.0), V3(x0 - .12, 2.6, -1.05), V3(x0 + .1, 2.3, -1.1), V3(x0 - .05, 2.15, -1.08)];
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, .012, 4, false), wireM));
    }

    this._lightBar(room, .4, 3.0, -1.2, 1.3, 0xffe8c0, 4.2, 8);
    const fill = new THREE.PointLight(0x9db3c9, 1.6, 6, 2);
    fill.position.set(-2, 1.6, .8); g.add(fill);
  }

  _spareHead(type) {
    const palettes = {
      freddy: { main: 0x5a3a20, dark: 0x35200f, muzzle: 0xa87c4e },
      bonnie: { main: 0x4a3a78, dark: 0x2a2148, muzzle: 0x8d7cb0 },
      chica: { main: 0xcaa73f, dark: 0x8d7124, muzzle: 0xe0a83a },
      foxy: { main: 0x8c3323, dark: 0x542015, muzzle: 0xb26743 }
    };
    const p = palettes[type];
    const g = new THREE.Group();
    const mainM = new THREE.MeshStandardMaterial({ color: p.main, roughness: .8 });
    const muzzleM = new THREE.MeshStandardMaterial({ color: p.muzzle, roughness: .74 });
    const darkM = new THREE.MeshStandardMaterial({ color: 0x0c0906, roughness: .6 });
    const skull = new THREE.Mesh(new THREE.SphereGeometry(.2, 18, 14), mainM);
    skull.scale.set(1.06, .98, .94);
    g.add(skull);
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(.12, 14, 10), muzzleM);
    muzzle.scale.set(1.15, .78, 1.05);
    muzzle.position.set(0, -.06, .15);
    g.add(muzzle);
    for (const s of [-1, 1]) {
      const socket = new THREE.Mesh(new THREE.SphereGeometry(.052, 10, 8), darkM);
      socket.scale.set(1, .95, .55);
      socket.position.set(s * .08, .04, .15);
      g.add(socket);
      if (type === 'freddy') {
        const ear = new THREE.Mesh(new THREE.SphereGeometry(.07, 10, 8), mainM);
        ear.scale.set(1, 1, .5);
        ear.position.set(s * .15, .17, 0);
        g.add(ear);
      } else if (type === 'bonnie') {
        const ear = new THREE.Mesh(new THREE.CapsuleGeometry(.045, .2, 4, 8), mainM);
        ear.position.set(s * .09, .28, 0);
        ear.rotation.z = s * .12;
        g.add(ear);
      } else if (type === 'foxy') {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(.055, .15, 4), mainM);
        ear.position.set(s * .12, .19, .01);
        ear.rotation.z = s * .18;
        g.add(ear);
      }
    }
    if (type === 'chica') {
      const beak = new THREE.Mesh(new THREE.ConeGeometry(.075, .12, 5), new THREE.MeshStandardMaterial({ color: 0xe08a2a, roughness: .52 }));
      beak.rotation.x = Math.PI / 2;
      beak.position.set(0, -.05, .24);
      g.add(beak);
    } else if (type === 'foxy') {
      const patch = new THREE.Mesh(new THREE.CircleGeometry(.055, 12), darkM);
      patch.position.set(-.08, .04, .165);
      g.add(patch);
    } else {
      const nose = new THREE.Mesh(new THREE.SphereGeometry(.035, 8, 6), new THREE.MeshStandardMaterial({ color: 0x16110c, roughness: .4 }));
      nose.scale.set(1.2, .8, 1);
      nose.position.set(0, -.03, .27);
      g.add(nose);
    }
    if (type === 'freddy') {
      const felt = new THREE.MeshStandardMaterial({ color: 0x111010, roughness: .72 });
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(.16, .16, .02, 16), felt);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(.1, .115, .2, 16), felt);
      brim.position.y = .2; top.position.y = .3;
      g.add(brim, top);
    }
    return g;
  }

  /* ------------------------------------------------------------ burst fx */
  _buildBurstOverlay() {
    const ov = document.createElement('canvas');
    ov.width = W; ov.height = H;
    ov.className = 'feed-burst';
    ov.setAttribute('aria-hidden', 'true');
    this.canvas.parentNode.appendChild(ov);
    this.burst = ov;
    this.burstCtx = ov.getContext('2d');
    this.burstT = 0;
  }

  drawStaticBurst(amount = 1) {
    if (!this.ok || !this.burstCtx) return;
    const x = this.burstCtx;
    x.clearRect(0, 0, W, H);
    x.globalAlpha = Math.min(.8, .3 + .18 * amount);
    for (let i = 0; i < 26 * amount; i++) {
      const y = Math.random() * H, h = 1 + Math.random() * 3, dx = (Math.random() - .5) * 46;
      x.fillStyle = `rgba(255,255,255,${.25 + Math.random() * .5})`;
      x.fillRect(dx, y, W * (.3 + Math.random() * .7), h);
    }
    x.globalAlpha = 1;
    this.burstT = Math.max(this.burstT, .16 + .05 * amount);
  }

  _updateBurst(dt) {
    if (this.burstT > 0) {
      this.burstT = Math.max(0, this.burstT - dt);
      if (this.burst) this.burst.style.opacity = Math.min(1, this.burstT / .2).toFixed(3);
    } else if (this.burst && this.burst.style.opacity !== '0') {
      this.burst.style.opacity = '0';
    }
  }

  /* ------------------------------------------------------------ switching */
  precompile() {
    if (!this.ok) return;
    for (const id in this.rooms) {
      this._showOnly(id);
      this._placeCamera(id);
      try { this.renderer.compile(this.scene, this.camera); } catch (e) { /* non fatal */ }
    }
    this._showOnly(this.cam);
  }

  _showOnly(id) {
    for (const k in this.rooms) this.rooms[k].group.visible = (k === id);
  }

  setCam(id) {
    if (!this.rooms[id]) return;
    this.cam = id;
    this._showOnly(id);
    this._placeCamera(id);
  }

  _placeCamera(id) {
    const d = this.rooms[id].def;
    this.camera.fov = d.fov;
    this.camera.updateProjectionMatrix();
    this.camera.position.copy(d.pos);
    this.camera.lookAt(d.look);
  }

  /* ------------------------------------------------------------ per-frame */
  draw(game, dt = .016) {
    if (!this.ok) return;
    this.t += dt;
    this._updateBurst(dt);
    const room = this.rooms[this.cam];
    if (!room) return;
    this._updateActors(game, room, dt);
    this._updateRoomFx(room, dt);

    // CCTV sway — a slow drift plus sensor shake
    const d = room.def;
    this.camera.position.copy(d.pos);
    this.camera.position.x += Math.sin(this.t * .47) * .028;
    this.camera.position.y += Math.sin(this.t * .36) * .02;
    this.camera.lookAt(
      d.look.x + Math.sin(this.t * .61) * .05,
      d.look.y + Math.cos(this.t * .52) * .035,
      d.look.z
    );
    this.camera.rotation.z = Math.sin(this.t * .3) * .007;
    this.renderer.render(this.scene, this.camera);
  }

  _idle(a, phase, dt, opts = {}) {
    const t = this.t;
    a.group.position.y = a.userData.baseY + Math.sin(t * 1.1 + phase) * .014;
    a.head.rotation.y = Math.sin(t * .5 + phase) * (opts.headY ?? .07);
    a.head.rotation.x = a.userData.baseHeadRX + Math.sin(t * .9 + phase) * .02;
    if (a.jaw) a.jaw.rotation.x = -.02 - (Math.sin(t * 1.25 + phase) * .5 + .5) * (opts.jaw ?? .05);
    if (a.arms) a.arms.forEach((arm, i) => { arm.rotation.x = Math.sin(t * .8 + phase + i * 1.7) * .045; });
    a.eyeMat.emissiveIntensity = 1.35 + Math.sin(t * 2.1 + phase) * .35;
  }

  _updateActors(game, room, dt) {
    const ai = game && game.ai;
    const posOf = n => (ai && ai[n] ? ai[n].path[ai[n].index] : null);
    const foxy = game ? game.foxy : null;
    const A = room.actors;

    switch (room.id) {
      case '1A': {
        for (const t of ['freddy', 'bonnie', 'chica']) {
          const a = A[t];
          if (!a) continue;
          a.group.visible = posOf(t) === 'stage';
          if (a.group.visible) this._idle(a, t.length * 1.3, dt);
        }
        break;
      }
      case '1B': {
        for (const t of ['freddy', 'bonnie', 'chica']) {
          const a = A[t];
          if (!a) continue;
          a.group.visible = posOf(t) === 'dining';
          if (a.group.visible) this._idle(a, t.length * 1.1, dt);
        }
        break;
      }
      case '1C': {
        const a = A.foxy;
        const stage = foxy ? foxy.stage : 0;
        const running = foxy ? foxy.running : false;
        const gone = stage >= 3 || running;
        if (a) {
          a.group.visible = !gone && stage >= 2;
          if (a.group.visible) {
            this._idle(a, 2.1, dt, { jaw: .12 });
            a.head.rotation.x = .06;
          }
        }
        // curtain opens in stages
        const target = gone ? 2.9 : stage === 2 ? 1.55 : stage === 1 ? .55 : .24;
        room.coveGap += (target - room.coveGap) * Math.min(1, dt * 4.5);
        for (const p of this.covePanels) {
          const s = p.userData.side;
          p.position.x = s * (room.coveGap / 2 + panelWOffset(p));
        }
        if (room.eyeGlow) room.eyeGlow.material.opacity = (!gone && stage === 1) ? .55 + Math.sin(this.t * 3.1) * .2 : 0;
        if (room.hook) room.hook.visible = gone;
        break;
      }
      case '2A': {
        const b = A.bonnie, f = A.foxy;
        if (b) {
          b.group.visible = posOf('bonnie') === 'westHall';
          if (b.group.visible) this._idle(b, 3.3, dt, { headY: .02 });
        }
        if (f) {
          const show = !!(foxy && foxy.running && foxy.runT <= .85);
          f.group.visible = show;
          if (show) this._foxyRun(f, foxy.runT / 1.75, dt);
        }
        break;
      }
      case '2B': {
        const b = A.bonnie, f = A.foxy;
        if (b) {
          b.group.visible = posOf('bonnie') === 'westCorner';
          if (b.group.visible) { this._idle(b, 1.7, dt, { headY: .015 }); b.head.rotation.x = -.16; }
        }
        if (f) {
          const show = !!(foxy && foxy.running && foxy.runT > .85);
          f.group.visible = show;
          if (show) this._foxyRun(f, Math.min(1, (foxy.runT - .85) / .9), dt, true);
        }
        break;
      }
      case '4A': {
        const c = A.chica, fd = A.freddy;
        if (c) {
          c.group.visible = posOf('chica') === 'eastHall';
          if (c.group.visible) this._idle(c, 2.6, dt, { headY: .02 });
        }
        if (fd) {
          fd.group.visible = posOf('freddy') === 'eastHall';
          if (fd.group.visible) this._idle(fd, 4.1, dt, { headY: .02 });
        }
        break;
      }
      case '4B': {
        const c = A.chica, fd = A.freddy;
        if (c) {
          c.group.visible = posOf('chica') === 'eastCorner';
          if (c.group.visible) { this._idle(c, 1.4, dt, { headY: .015 }); c.head.rotation.x = -.16; }
        }
        if (fd) {
          fd.group.visible = posOf('freddy') === 'eastCorner';
          if (fd.group.visible) { this._idle(fd, 2.9, dt, { headY: .015 }); fd.head.rotation.x = -.14; }
        }
        break;
      }
      default:
        break;
    }
  }

  _foxyRun(f, prog, dt, close) {
    const t = this.t;
    const p = Math.max(0, Math.min(1, prog));
    if (close) {
      // bursting through the corner, right up on the lens
      f.group.position.set(-.1, 0, -1.1 + p * .3);
      f.group.scale.setScalar(1.05 + p * .25);
    } else {
      f.group.position.set(.12 + Math.sin(t * 9) * .05, 0, -8.6 + p * 9.4);
      f.group.scale.setScalar(1 + p * .12);
    }
    f.group.rotation.y = Math.PI + Math.sin(t * 7) * .06;
    f.group.rotation.z = Math.sin(t * 11) * .04;
    f.group.position.y = Math.abs(Math.sin(t * 12)) * .045;
    f.head.rotation.x = -.1 + Math.sin(t * 12) * .04;
    if (f.jaw) f.jaw.rotation.x = -.4 - Math.sin(t * 14) * .12;
    if (f.arms) {
      f.arms.forEach((arm, i) => {
        arm.rotation.x = Math.sin(t * 13 + i * Math.PI) * .95 - .35;
        arm.rotation.z = (i ? 1 : -1) * .18;
      });
    }
    f.eyeMat.emissiveIntensity = 2.2 + Math.sin(t * 16) * .5;
  }

  _updateRoomFx(room, dt) {
    const t = this.t;
    if (room.extras) {
      for (const e of room.extras) e.obj.material.opacity = e.base * (.5 + .5 * Math.sin(t * 1.7 + e.phase));
    }
    if (room.bulb) room.bulb.material.opacity = Math.random() < .02 ? .1 : .5 + Math.sin(t * 9) * .08;
    if (room.endoGlow) room.endoGlow.material.opacity = Math.sin(t * .8) > .7 ? .5 : .08;
    if (room.stripGlow) {
      const hot = Math.sin(t * 6.4) > .55;
      room.stripGlow.material.opacity = hot ? .55 : .06;
      room.strip.material.color.setHex(hot ? 0xff3b26 : 0x52140f);
    }
  }
}

/* cove panel helper keeps the leading edge from crossing the middle */
function panelWOffset(p) {
  return 1.575 + .12;
}
