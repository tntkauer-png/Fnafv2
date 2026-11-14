import * as THREE from '../vendor/three.module.min.js';
import {
  wallTexture, wainscotTexture, ceilingTexture, floorTexture, posterTexture,
  metalTexture, deskTexture, screenTexture, paperTexture, fanTexture, signTexture,
  ventTexture, suitTexture, lightPanelTexture, exitTexture, finish, rand, resetSeed,
  glowTexture, blobTexture, hazardTexture, concreteTexture, neonSignTexture,
  normalTexture, shutterTexture, shutterNormalTexture
} from './textures.js';

const OFFICE = { w: 2.6, front: -2.6, back: 3.5, h: 3.0, doorZ: -0.62, doorW: 1.28, doorH: 2.34 };
const EYE_Y = 1.66;

function mat(opts = {}) { return new THREE.MeshStandardMaterial(opts); }
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

export class World {
  constructor(container) {
    this.container = container;
    this.mode = 'menu';
    this.clock = new THREE.Clock();
    this.yaw = 0; this.pitch = 0;
    this.targetYaw = 0; this.targetPitch = 0;
    this.lookEnabled = false;
    this.time = 0;
    this.door = { left: 0, right: 0 };
    this.doorTarget = { left: 0, right: 0 };
    this.light = { left: 0, right: 0 };
    this.lightTarget = { left: 0, right: 0 };
    this.powerLevel = 1;
    this.flicker = 0;
    this.scare = null;
    this.cornerPresence = { left: null, right: null };
    this.footstepClock = 0;
    this.quality = 1;
    resetSeed(9182);
    this._initRenderer();
    this._buildEnvironment();
    this._buildOffice();
    this._buildMenu();
    this._buildScares();
  }

  precompile() {
    try {
      this.office.visible = true; this.menuGroup.visible = false;
      this.renderer.compile(this.scene, this.camera);
      this.office.visible = false; this.menuGroup.visible = true;
      this.renderer.compile(this.scene, this.menuCamera);
      this.menuGroup.visible = false;
    } catch (e) { /* non fatal */ }
  }

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true, alpha: false, powerPreference: 'high-performance',
      stencil: false, preserveDrawingBuffer: false
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050403);
    this.scene.fog = new THREE.FogExp2(0x080706, 0.038);
    this.glowTex = glowTexture();
    this.blobTex = blobTexture();
    this.camera = new THREE.PerspectiveCamera(67, window.innerWidth / window.innerHeight, 0.06, 60);
    this.camera.rotation.order = 'YXZ';
    this.camera.position.set(0, EYE_Y, 2.75);
    this.scene.add(this.camera);
    this.cameraBase = new THREE.Vector3(0, EYE_Y, 2.75);
    this.menuCamera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.05, 80);
    this.menuCamera.position.set(0, 2.55, -55.4);
  }

  /* A tiny procedural reflection environment. Gives the tile and metal a
     believable sheen without loading an HDR asset. */
  _buildEnvironment() {
    const w = 1024, h = 512, c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    // vertical gradient: dark floor, warm walls, dark ceiling
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#0b0907');
    g.addColorStop(.32, '#3a2a1c');
    g.addColorStop(.55, '#5a4530');
    g.addColorStop(.72, '#241c14');
    g.addColorStop(1, '#080706');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    // warm ceiling strip lights
    for (const sx of [170, 512, 854]) {
      const rg = x.createRadialGradient(sx, 105, 2, sx, 105, 150);
      rg.addColorStop(0, 'rgba(255,226,176,.9)');
      rg.addColorStop(.4, 'rgba(255,190,110,.22)');
      rg.addColorStop(1, 'rgba(255,190,110,0)');
      x.fillStyle = rg; x.fillRect(sx - 150, 0, 300, 240);
    }
    // red practicals left/right
    for (const sx of [80, 944]) {
      const rg = x.createRadialGradient(sx, 300, 4, sx, 300, 160);
      rg.addColorStop(0, 'rgba(190,50,35,.5)');
      rg.addColorStop(1, 'rgba(190,50,35,0)');
      x.fillStyle = rg; x.fillRect(sx - 160, 140, 320, 320);
    }
    // cool monitor bounce
    const cg = x.createRadialGradient(512, 330, 4, 512, 330, 190);
    cg.addColorStop(0, 'rgba(80,130,115,.32)');
    cg.addColorStop(1, 'rgba(80,130,115,0)');
    x.fillStyle = cg; x.fillRect(320, 140, 384, 384);
    const tex = new THREE.CanvasTexture(c);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    this.scene.environment = tex;
  }

  _glow(color, size, opacity = .55) {
    const m = new THREE.SpriteMaterial({
      map: this.glowTex, color, transparent: true, opacity,
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true
    });
    const s = new THREE.Sprite(m);
    s.scale.set(size, size, 1);
    return s;
  }

  _contactShadow(w, d, opacity = .5) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshBasicMaterial({ map: this.blobTex, color: 0x000000, transparent: true, opacity, depthWrite: false })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.y = .006;
    return m;
  }

  resize(w, h) {
    this.renderer.setSize(w, h);
    const a = w / h;
    const portrait = a < .78;
    this.camera.aspect = a;
    this.camera.fov = portrait ? 86 : 67;
    this.camera.updateProjectionMatrix();
    this.cameraBase.z = portrait ? 2.96 : 2.75;
    this.menuCamera.aspect = a;
    this.menuCamera.fov = portrait ? 60 : 48;
    this.menuCamera.updateProjectionMatrix();
  }
  setPixelRatio(r) {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, r));
  }

  /* ============================================================ OFFICE */
  _buildOffice() {
    const s = this.scene;
    this.office = new THREE.Group();
    s.add(this.office);

    // materials — colour + generated tangent-space normals for crisp highlights
    const ns = (s) => new THREE.Vector2(s, s);
    const wall = new THREE.MeshStandardMaterial({
      map: wallTexture(), normalMap: normalTexture('plaster', 2.2), normalScale: ns(.72),
      roughness: .92, envMapIntensity: .24
    });
    const wains = new THREE.MeshStandardMaterial({
      map: wainscotTexture(), normalMap: normalTexture('wood', 2.0), normalScale: ns(.66),
      roughness: .8, envMapIntensity: .3
    });
    const ceil = new THREE.MeshStandardMaterial({
      map: ceilingTexture(), normalMap: normalTexture('tile', 1.4), normalScale: ns(.8),
      roughness: 1, envMapIntensity: .1
    });
    const floorM = new THREE.MeshStandardMaterial({
      map: floorTexture(), normalMap: normalTexture('tile', 1.8), normalScale: ns(.9),
      roughness: .3, metalness: .2, envMapIntensity: .8
    });
    const trim = new THREE.MeshStandardMaterial({
      color: 0x2a2118, normalMap: normalTexture('wood', 1.6), normalScale: ns(.5),
      roughness: .66, envMapIntensity: .22
    });
    const shutterM = new THREE.MeshStandardMaterial({
      map: shutterTexture(), normalMap: shutterNormalTexture(2.8), normalScale: ns(1),
      color: 0xe4e0d4, roughness: .44, metalness: .58, envMapIntensity: .9
    });

    // floor + ceiling
    const floor = plane(OFFICE.w * 2 + .4, OFFICE.back - OFFICE.front + .4, floorM, 0, 0, (OFFICE.back + OFFICE.front) / 2, -Math.PI / 2);
    floor.receiveShadow = true;
    this.office.add(floor);
    const ceiling = plane(OFFICE.w * 2 + .4, OFFICE.back - OFFICE.front + .4, ceil, 0, OFFICE.h, (OFFICE.back + OFFICE.front) / 2, Math.PI / 2);
    this.office.add(ceiling);

    // helper for wall section with upper paper + lower wainscot
    const buildWall = (w, wallH = OFFICE.h) => {
      const g = new THREE.Group();
      const lower = box(w, .92, .08, wains, 0, .46, 0);
      lower.receiveShadow = true;
      g.add(lower);
      const upperH = wallH - .92;
      const upper = plane(w, upperH, wall, 0, .92 + upperH / 2, .041);
      g.add(upper);
      const rail = box(w, .07, .13, trim, 0, .94, .04);
      g.add(rail);
      const base = box(w, .14, .1, trim, 0, .07, .04);
      g.add(base);
      return g;
    };

    // front wall (behind desk) at z = front
    const fw = buildWall(OFFICE.w * 2);
    fw.position.set(0, 0, OFFICE.front);
    this.office.add(fw);

    // back wall (behind player)
    const bw = buildWall(OFFICE.w * 2);
    bw.position.set(0, 0, OFFICE.back);
    bw.rotation.y = Math.PI;
    this.office.add(bw);

    // side walls with door openings
    const zA = OFFICE.front, zB = OFFICE.doorZ - OFFICE.doorW / 2;
    const zC = OFFICE.doorZ + OFFICE.doorW / 2, zD = OFFICE.back;
    const upperH = OFFICE.h - .92;
    for (const side of [-1, 1]) {
      const x = side * OFFICE.w;
      const ry = side < 0 ? Math.PI / 2 : -Math.PI / 2;
      const segs = [[zA, zB], [zC, zD]];
      for (const [za, zb] of segs) {
        const len = Math.abs(zb - za), cz = (za + zb) / 2;
        const lower = plane(len, .92, wains, x, .46, cz, 0, ry);
        lower.receiveShadow = true;
        const upper = plane(len, upperH, wall, x, .92 + upperH / 2, cz, 0, ry);
        upper.receiveShadow = true;
        this.office.add(lower, upper);
        this.office.add(box(.1, .07, len, trim, x, .945, cz));
        this.office.add(box(.1, .15, len, trim, x, .075, cz));
      }
      // header above the doorway
      const headerH = OFFICE.h - OFFICE.doorH;
      this.office.add(plane(OFFICE.doorW, headerH, wall, x, OFFICE.doorH + headerH / 2, OFFICE.doorZ, 0, ry));
      this.office.add(box(.1, .1, OFFICE.doorW + .2, trim, x, OFFICE.doorH + headerH - .05, OFFICE.doorZ));
    }

    // Door frames, steel shutters and the halls beyond them.
    for (const side of [-1, 1]) {
      const key = side < 0 ? 'left' : 'right';
      const doorX = side * OFFICE.w;
      const faceX = -side; // +1 points into the office
      const frameM = new THREE.MeshStandardMaterial({
        color: 0x3a3126, normalMap: normalTexture('metal', 1.8), normalScale: ns(.55),
        roughness: .46, metalness: .55, envMapIntensity: .55
      });
      const steelM = new THREE.MeshStandardMaterial({
        color: 0x777268, normalMap: normalTexture('metal', 2.2), normalScale: ns(.7),
        roughness: .36, metalness: .78, envMapIntensity: .95
      });
      const rubberM = mat({ color: 0x141210, roughness: .95 });

      // The opening runs along Z. Build the frame unrotated so the posts sit
      // on the wall rather than poking through it.
      const frame = new THREE.Group();
      frame.position.set(doorX, 0, OFFICE.doorZ);
      frame.add(box(.22, OFFICE.doorH + .12, .18, frameM, 0, (OFFICE.doorH + .12) / 2, -(OFFICE.doorW / 2 + .09)));
      frame.add(box(.22, OFFICE.doorH + .12, .18, frameM, 0, (OFFICE.doorH + .12) / 2, OFFICE.doorW / 2 + .09));
      frame.add(box(.22, .18, OFFICE.doorW + .36, frameM, 0, OFFICE.doorH + .09, 0));
      // bright inner lip catches the hall light
      frame.add(box(.06, OFFICE.doorH, .05, steelM, faceX * .09, OFFICE.doorH / 2, -(OFFICE.doorW / 2 + .015)));
      frame.add(box(.06, OFFICE.doorH, .05, steelM, faceX * .09, OFFICE.doorH / 2, OFFICE.doorW / 2 + .015));
      frame.add(box(.06, .05, OFFICE.doorW + .02, steelM, faceX * .09, OFFICE.doorH - .025, 0));
      // rubber bumpers
      frame.add(box(.035, OFFICE.doorH - .04, .035, rubberM, faceX * .08, OFFICE.doorH / 2, -(OFFICE.doorW / 2 - .032)));
      frame.add(box(.035, OFFICE.doorH - .04, .035, rubberM, faceX * .08, OFFICE.doorH / 2, OFFICE.doorW / 2 - .032));
      this.office.add(frame);

      // hazard threshold plate
      const hazardMat = new THREE.MeshStandardMaterial({ map: hazardTexture(), roughness: .82 });
      const threshold = plane(.16, OFFICE.doorW + .1, hazardMat, doorX + faceX * .02, .013, OFFICE.doorZ, -Math.PI / 2);
      this.office.add(threshold);
      const warning = plane(.42, .1, new THREE.MeshStandardMaterial({ map: hazardTexture(), roughness: .8 }), doorX + faceX * .045, OFFICE.doorH + .3, OFFICE.doorZ, 0, side < 0 ? Math.PI / 2 : -Math.PI / 2);
      this.office.add(warning);

      // Shutter — a single steel panel that slides straight up on Z-aligned rails.
      const sg = new THREE.Group();
      sg.position.set(doorX, 0, OFFICE.doorZ);
      this.office.add(sg);
      const shutter = box(.09, OFFICE.doorH + .06, OFFICE.doorW + .02, shutterM, faceX * .05, OFFICE.doorH / 2 + 2.4, 0);
      shutter.castShadow = true; shutter.receiveShadow = true;
      sg.add(shutter);
      for (const zs of [-1, 1]) {
        sg.add(box(.08, OFFICE.doorH + .16, .07, steelM, faceX * .105, OFFICE.doorH / 2, zs * (OFFICE.doorW / 2 + .045)));
      }
      // roller drum + housing above the opening
      sg.add(box(.34, .2, OFFICE.doorW + .3, frameM, faceX * .01, OFFICE.doorH + .21, 0));
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(.1, .1, OFFICE.doorW + .17, 18), steelM);
      drum.rotation.x = Math.PI / 2;
      drum.position.set(faceX * .01, OFFICE.doorH + .19, 0);
      drum.castShadow = true;
      sg.add(drum);
      // warning light strip + halo on the roller housing
      const strip = box(.045, .035, OFFICE.doorW * .78, new THREE.MeshBasicMaterial({ color: 0x52140f, transparent: true, opacity: .9 }), faceX * .19, OFFICE.doorH + .2, 0);
      sg.add(strip);
      const stripGlow = this._glow(0xff3b26, .62, .01);
      stripGlow.position.set(faceX * .26, OFFICE.doorH + .2, 0);
      sg.add(stripGlow);

      // button panel (visual only)
      const panel = new THREE.Group();
      const pm = mat({ color: 0x2b2823, roughness: .6, metalness: .3 });
      panel.add(box(.05, .54, .3, pm, 0, 0, 0));
      const b1 = box(.03, .1, .11, mat({ color: 0xa8352c, emissive: 0x320704, emissiveIntensity: .5, roughness: .4 }), faceX * .04, .11, 0);
      const b2 = box(.03, .1, .11, mat({ color: 0xd0a04a, emissive: 0x2a1a02, emissiveIntensity: .4, roughness: .4 }), faceX * .04, -.11, 0);
      panel.add(b1, b2);
      panel.position.set(doorX + faceX * .17, 1.34, OFFICE.doorZ + .92);
      this.office.add(panel);
      this.doors = this.doors || {};
      this.doors[key] = { shutter, group: sg, strip, stripGlow, b1, b2, frame };

      // hall
      this._buildHall(side, key, floorM, wall, wains, trim, ceil);
    }

    // baseboards/ceiling strip
    this.office.add(box(OFFICE.w * 2, .08, .08, trim, 0, OFFICE.h - .04, OFFICE.front + .04));
    this.office.add(box(OFFICE.w * 2, .08, .08, trim, 0, OFFICE.h - .04, OFFICE.back - .04));

    this._buildLights();
    this._buildDesk();
    this._buildFrontWall();
    this._buildBackWall();
    this._buildDust();
    this._buildOfficeDetails();

    // ambient artificial light
    this.ambient = new THREE.HemisphereLight(0x8f7c5e, 0x17110c, .36);
    this.scene.add(this.ambient);
  }

  _buildHall(side, key, floorM, wall, wains, trim, ceil) {
    const g = new THREE.Group();
    const len = 5.4;
    const width = 2.35;
    const hallX = side * (OFFICE.w + len / 2);
    const floor = plane(len, width, floorM, hallX, .001, OFFICE.doorZ, -Math.PI / 2);
    floor.receiveShadow = true;
    g.add(floor);
    g.add(plane(len, width, ceil, hallX, 2.62, OFFICE.doorZ, Math.PI / 2));
    // hallway side walls (parallel to x axis)
    for (const zs of [-1, 1]) {
      const wg = new THREE.Group();
      const lower = box(len, .85, .06, wains, 0, .425, 0);
      const upper = plane(len, 1.72, wall, 0, .85 + .86, .031);
      wg.add(lower, upper);
      wg.add(box(len, .06, .1, trim, 0, .86, .03));
      wg.position.set(hallX, 0, OFFICE.doorZ + zs * width / 2);
      if (zs < 0) wg.rotation.y = 0; else wg.rotation.y = Math.PI;
      g.add(wg);
    }
    // end wall
    const eg = new THREE.Group();
    eg.add(box(.08, 2.62, width, wall, 0, 1.31, 0));
    eg.position.set(side * (OFFICE.w + len), 0, OFFICE.doorZ);
    g.add(eg);
    // ceiling lamps
    const lampMat = new THREE.MeshBasicMaterial({ color: 0x312a1c });
    const lampGlows = [];
    for (const d of [1.3, 3.6]) {
      const lamp = box(.7, .04, .16, lampMat, side * (OFFICE.w + d), 2.56, OFFICE.doorZ);
      g.add(lamp);
      const glow = this._glow(0xffc98d, .95, .32);
      glow.position.set(side * (OFFICE.w + d), 2.5, OFFICE.doorZ);
      g.add(glow);
      lampGlows.push(glow);
    }
    this.doors[key].lampGlows = lampGlows;
    // shallow ceiling beams
    for (const d of [1.9, 2.9, 4.1]) {
      g.add(box(.08, .07, width, trim, side * (OFFICE.w + d), 2.585, OFFICE.doorZ));
    }
    // conduit running the length of the hall
    for (const zs of [-.92, .92]) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, len - .2, 6), new THREE.MeshStandardMaterial({ map: metalTexture(), roughness: .45, metalness: .7 }));
      pipe.rotation.z = Math.PI / 2;
      pipe.position.set(hallX, 2.5, OFFICE.doorZ + zs);
      g.add(pipe);
    }
    // fire alarm + staff door at the end
    const alarm = box(.13, .18, .07, mat({ color: 0xa8332a, roughness: .5 }), side * (OFFICE.w + 2.35), 1.95, OFFICE.doorZ + width / 2 - .08);
    g.add(alarm);
    const alarmGlow = this._glow(0xff4a32, .22, .5);
    alarmGlow.position.set(side * (OFFICE.w + 2.35), 1.98, OFFICE.doorZ + width / 2 - .12);
    g.add(alarmGlow);
    const endDoor = plane(1.02, 1.94, new THREE.MeshStandardMaterial({ map: metalTexture(), color: 0x8d8a80, roughness: .58, metalness: .42 }), side * (OFFICE.w + len - .05), .98, OFFICE.doorZ + .02, 0, side < 0 ? Math.PI / 2 : -Math.PI / 2);
    g.add(endDoor);
    g.add(box(1.16, .06, .05, trim, side * (OFFICE.w + len - .06), 1.99, OFFICE.doorZ + .02));
    g.add(box(1.12, .1, .05, trim, side * (OFFICE.w + len - .06), .05, OFFICE.doorZ + .02));
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, .16, 6), new THREE.MeshStandardMaterial({ color: 0x9a9588, roughness: .3, metalness: .85 }));
    handle.rotation.z = Math.PI / 2;
    handle.position.set(side * (OFFICE.w + len - .13), 1.02, OFFICE.doorZ + .34);
    g.add(handle);
    const staffSign = plane(.42, .14, new THREE.MeshStandardMaterial({ map: signTexture(), roughness: .85 }), side * (OFFICE.w + len - .12), 1.65, OFFICE.doorZ + .34, 0, side < 0 ? Math.PI / 2 : -Math.PI / 2);
    g.add(staffSign);
    // hazard threshold at the office door
    const hazard = plane(.06, .7, new THREE.MeshStandardMaterial({ map: hazardTexture(), roughness: .8 }), side * (OFFICE.w + .28), .012, OFFICE.doorZ + width / 2 - .07, -Math.PI / 2);
    g.add(hazard);
    // low haze
    for (let i = 0; i < 3; i++) {
      const haze = this._glow(0xc9b18a, 1.5 + i * .6, .045);
      haze.position.set(side * (OFFICE.w + 1.2 + i * 1.6), .75 + i * .12, OFFICE.doorZ);
      g.add(haze);
    }
    // red EXIT sign just outside the office door
    const exitSign = plane(.34, .17, new THREE.MeshBasicMaterial({ map: exitTexture(), transparent: true }), side * (OFFICE.w + .06), 2.06, OFFICE.doorZ + 1.02);
    exitSign.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    g.add(exitSign);
    const exitGlow = new THREE.PointLight(0xff2a18, 1.6, 3.4, 2);
    exitGlow.position.set(side * (OFFICE.w + .28), 2.0, OFFICE.doorZ + 1.02);
    g.add(exitGlow);
    // dim far-end practical light so the hall reads in the dark
    const farGlow = new THREE.PointLight(0x8d7a58, 1.1, 5.5, 2);
    farGlow.position.set(side * (OFFICE.w + len - .7), 2.35, OFFICE.doorZ);
    g.add(farGlow);

    // posters
    const posterSpots = [
      { kind: 'celebrate', d: 2.0, z: 0.55, s: .8 },
      { kind: 'safety', d: 3.6, z: -1.5, s: .7 },
      { kind: 'kids', d: 1.1, z: -1.7, s: .55 }
    ];
    for (const p of posterSpots) {
      const pm = new THREE.MeshStandardMaterial({ map: posterTexture(p.kind), roughness: .9 });
      const pl = plane(.62 * p.s / .62, .82 * p.s / .62, pm, side * (OFFICE.w + p.d), 1.5, OFFICE.doorZ + p.z * .7);
      pl.scale.set(p.s, p.s, 1);
      pl.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
      // Put against side wall instead
      pl.position.z = OFFICE.doorZ + (p.z > 0 ? width / 2 - .05 : -width / 2 + .05);
      pl.rotation.y = p.z > 0 ? Math.PI : 0;
      g.add(pl);
    }
    // floor scuffs and a "wet floor" cone
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(.18, .38, 14),
      mat({ color: 0xb99a32, roughness: .65 })
    );
    cone.position.set(side * (OFFICE.w + 1.6), .19, OFFICE.doorZ + .45);
    g.add(cone);
    this.scene.add(g);
    this.doors[key].hall = g;

    // door light source — mounted just inside the office, aimed into the hall
    const light = new THREE.SpotLight(0xffb56a, 0, 9, Math.PI / 4.2, .5, 1.5);
    light.position.set(side * (OFFICE.w + .22), 2.5, OFFICE.doorZ);
    light.target.position.set(side * (OFFICE.w + 3.4), .35, OFFICE.doorZ - .1);
    this.scene.add(light, light.target);
    light.castShadow = false;
    this.doors[key].light = light;
    this.doors[key].lightTarget = light.target;

    // Low fill on the office side so whoever is in the doorway reads clearly
    // when the hall light is switched on.
    const reveal = new THREE.PointLight(0xffc08a, 0, 3.8, 2);
    reveal.position.set(side * (OFFICE.w - .3), 1.78, OFFICE.doorZ + .52);
    this.scene.add(reveal);
    this.doors[key].revealLight = reveal;

    // fake volumetric cone — apex at the door, spreading down the hall
    const coneGeo = new THREE.ConeGeometry(1.5, 3.4, 18, 1, true);
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0xffb060, transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide, depthWrite: false
    });
    const vol = new THREE.Mesh(coneGeo, coneMat);
    vol.rotation.set(0, 0, side * Math.PI / 2);
    vol.position.set(side * (OFFICE.w + 1.7), 1.55, OFFICE.doorZ);
    g.add(vol);
    this.doors[key].volume = vol;
    this.doors[key].volumeBase = coneMat;
  }

  _buildLights() {
    this.officeLight = new THREE.PointLight(0xffd0a0, 9.5, 13, 1.25);
    this.officeLight.position.set(0, 2.66, .3);
    this.officeLight.castShadow = true;
    this.officeLight.shadow.mapSize.set(2048, 2048);
    this.officeLight.shadow.bias = -0.0016;
    this.officeLight.shadow.camera.near = .2;
    this.officeLight.shadow.camera.far = 14;
    this.scene.add(this.officeLight);

    // soft fill that keeps the wall art readable without flattening the room
    this.frontFill = new THREE.PointLight(0xffc994, 2.2, 7.5, 1.5);
    this.frontFill.position.set(0, 2.15, -1.75);
    this.office.add(this.frontFill);

    // cool bounce from the back wall — separates the silhouette from the wall
    this.rimLight = new THREE.PointLight(0x6c88a8, 2.4, 6.5, 2);
    this.rimLight.position.set(0, 1.95, 3.1);
    this.office.add(this.rimLight);

    // fluorescent panel
    const lpTex = lightPanelTexture();
    const panelMat = new THREE.MeshStandardMaterial({
      map: lpTex, emissiveMap: lpTex, emissive: 0xfff0c6, emissiveIntensity: 1.55, roughness: .5, metalness: .1
    });
    this.lightPanel = box(1.55, .035, .5, panelMat, 0, OFFICE.h - .035, .2);
    this.office.add(this.lightPanel);
    this.office.add(box(1.68, .03, .62, mat({ color: 0x24211c, roughness: .6, metalness: .4 }), 0, OFFICE.h - .01, .2));
    // warm glow strip on the ceiling around the panel
    this.office.add(box(1.9, .012, .84, new THREE.MeshBasicMaterial({ color: 0x3b2c1a }), 0, OFFICE.h - .008, .2));

    // desk monitor glow
    this.monitorLight = new THREE.PointLight(0x6fa98c, 1.8, 2.8, 2);
    this.monitorLight.position.set(1.05, 1.22, .45);
    this.office.add(this.monitorLight);

    // red door warning wash
    this.redWash = new THREE.PointLight(0xa3291f, .75, 4, 2);
    this.redWash.position.set(0, 2.2, 2.0);
    this.office.add(this.redWash);

    // desk lamp glow
    this.deskLight = new THREE.PointLight(0xffc07a, 2.8, 3.1, 2);
    this.deskLight.position.set(-1.9, 1.25, .55);
    this.office.add(this.deskLight);
  }

  _buildDesk() {
    const g = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({
      map: deskTexture(), normalMap: normalTexture('wood', 2.0), normalScale: new THREE.Vector2(.7, .7),
      roughness: .48, metalness: .07, envMapIntensity: .36
    });
    const dark = mat({ color: 0x241b13, roughness: .8 });
    const metal = mat({ color: 0x36332d, roughness: .45, metalness: .7 });
    const top = box(3.7, .09, 1.25, wood, 0, .79, 1.45);
    top.castShadow = true; top.receiveShadow = true;
    g.add(top);
    g.add(box(3.7, .06, .08, dark, 0, .74, .85));
    g.add(box(3.7, .06, .08, dark, 0, .74, 2.05));
    // legs
    for (const x of [-1.72, 1.72]) for (const z of [.88, 2.02]) {
      g.add(box(.09, .78, .09, metal, x, .39, z));
    }
    // modesty panel
    const panel = box(3.55, .64, .05, wood, 0, .44, 2.06);
    g.add(panel);
    for (const dx of [-1.15, 0, 1.15]) {
      g.add(box(1.0, .3, .02, mat({ map: deskTexture(), roughness: .62 }), dx, .5, 2.092));
      g.add(box(.22, .028, .03, metal, dx, .62, 2.11));
      g.add(box(1.0, .02, .02, mat({ color: 0x1a120b, roughness: .8 }), dx, .34, 2.095));
    }
    // taped warning note on the desk front
    const note = plane(.34, .26, new THREE.MeshStandardMaterial({ map: paperTexture(4), roughness: .95 }), -.6, .92, 2.07, 0, 0, .04);
    g.add(note);

    // papers
    const paperMat = new THREE.MeshStandardMaterial({ map: paperTexture(7), roughness: .95 });
    const p1 = plane(.42, .55, paperMat, -.55, .845, 1.28, -Math.PI / 2, 0, .16);
    const p2 = plane(.36, .48, paperMat, .3, .845, 1.75, -Math.PI / 2, 0, -.2);
    g.add(p1, p2);

    // keyboard
    const kb = box(.62, .035, .19, mat({ color: 0x2e2b26, roughness: .7 }), .55, .855, 1.05);
    g.add(kb);
    for (let i = 0; i < 18; i++) g.add(box(.024, .012, .024, mat({ color: 0x4a463e, roughness: .6 }), .27 + (i % 9) * .06, .877, .99 + Math.floor(i / 9) * .07));

    // CRT monitor
    const mon = new THREE.Group();
    mon.position.set(1.18, .84, 1.3);
    mon.scale.setScalar(.88);
    mon.rotation.y = -.08;
    const body = box(1.0, .78, .3, mat({ color: 0x2a2824, roughness: .65, metalness: .2 }), 0, .42, 0);
    body.castShadow = true;
    mon.add(body);
    mon.add(box(.9, .68, .02, mat({ color: 0x12110f, roughness: .4 }), 0, .44, .16));
    const screenTex = screenTexture('static');
    this.screenMat = new THREE.MeshStandardMaterial({
      map: screenTex, emissiveMap: screenTex, emissive: 0xffffff,
      emissiveIntensity: 1.45, roughness: .3, metalness: .05
    });
    const scr = plane(.8, .58, this.screenMat, 0, .44, .172);
    mon.add(scr);
    mon.add(box(.22, .1, .2, mat({ color: 0x1c1a17, roughness: .8 }), 0, .03, 0));
    g.add(mon);

    // desk phone
    const ph = new THREE.Group();
    ph.position.set(-.6, .84, 1.95);
    const base = box(.3, .12, .22, mat({ color: 0x171512, roughness: .5 }), 0, .06, 0);
    const handset = box(.34, .07, .08, mat({ color: 0x1f1c18, roughness: .45 }), 0, .16, 0);
    ph.add(base, handset);
    // coiled-ish cord
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(.12, .05, -.08), new THREE.Vector3(.3, .03, -.2),
      new THREE.Vector3(.18, .02, -.32), new THREE.Vector3(-.1, .03, -.28)
    ]);
    ph.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 14, .012, 5, false), mat({ color: 0x11100e, roughness: .7 })));
    g.add(ph);

    // soda cup
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(.055, .042, .19, 16), mat({ color: 0xa43a2d, roughness: .55 }));
    cup.position.set(1.62, .94, 1.9);
    g.add(cup);
    const straw = new THREE.Mesh(new THREE.CylinderGeometry(.009, .009, .25, 6), mat({ color: 0xd6cfbc, roughness: .4 }));
    straw.position.set(1.66, 1.09, 1.9); straw.rotation.z = .25;
    g.add(straw);

    // cupcake (Chica's)
    const cupcake = new THREE.Group();
    cupcake.position.set(-1.42, .84, 1.78);
    const wrapper = new THREE.Mesh(new THREE.CylinderGeometry(.07, .05, .08, 16), mat({ color: 0xc46a8c, roughness: .6 }));
    wrapper.position.y = .04;
    const frosting = new THREE.Mesh(new THREE.SphereGeometry(.075, 16, 12), mat({ color: 0xe7c9d8, roughness: .5 }));
    frosting.scale.y = .8; frosting.position.y = .11;
    const cherry = new THREE.Mesh(new THREE.SphereGeometry(.022, 10, 8), mat({ color: 0xa52a21, roughness: .3 }));
    cherry.position.y = .18;
    const candle = new THREE.Mesh(new THREE.CylinderGeometry(.007, .007, .1, 6), mat({ color: 0xe3d7b8, roughness: .7 }));
    candle.position.y = .23;
    const flame = new THREE.Mesh(new THREE.SphereGeometry(.013, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffb347 }));
    flame.position.y = .29;
    cupcake.add(wrapper, frosting, cherry, candle, flame);
    cupcake.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.add(cupcake);
    this.flame = flame;

    // desk fan
    const fan = new THREE.Group();
    fan.position.set(-1.55, .84, 1.16);
    const fBase = new THREE.Mesh(new THREE.CylinderGeometry(.15, .19, .05, 22), metal);
    fBase.position.y = .025; fan.add(fBase);
    const fPole = new THREE.Mesh(new THREE.CylinderGeometry(.022, .022, .28, 10), metal);
    fPole.position.y = .17; fan.add(fPole);
    const cage = new THREE.Group(); cage.position.y = .44;
    const cageMat = mat({ color: 0x6a655a, roughness: .4, metalness: .8 });
    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(.27, .012, 6, 40), cageMat);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(.22, .009, 6, 36), cageMat);
    ring2.position.z = -.035;
    const ring3 = new THREE.Mesh(new THREE.TorusGeometry(.1, .008, 6, 24), cageMat);
    ring3.position.z = -.02;
    cage.add(ring1, ring2, ring3);
    for (let i = 0; i < 10; i++) {
      const spoke = new THREE.Mesh(new THREE.CylinderGeometry(.004, .004, .53, 4), cageMat);
      spoke.rotation.z = i * Math.PI / 5;
      cage.add(spoke);
    }
    const bladeTex = fanTexture();
    const bladeMat = new THREE.MeshStandardMaterial({ map: bladeTex, transparent: true, alphaTest: .2, side: THREE.DoubleSide, roughness: .6, metalness: .3 });
    this.fanBlades = new THREE.Mesh(new THREE.PlaneGeometry(.52, .52), bladeMat);
    this.fanBlades.position.z = .005;
    cage.add(this.fanBlades);
    const hub = new THREE.Mesh(new THREE.SphereGeometry(.055, 14, 10), mat({ color: 0x2b2924, roughness: .4, metalness: .6 }));
    hub.position.z = .02; cage.add(hub);
    fan.add(cage);
    const fMotor = new THREE.Mesh(new THREE.CylinderGeometry(.075, .075, .16, 16), metal);
    fMotor.rotation.x = Math.PI / 2; fMotor.position.set(0, .44, -.1); fan.add(fMotor);
    fan.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.add(fan);

    // desk lamp
    const lamp = new THREE.Group(); lamp.position.set(-1.95, .84, .96);
    const lBase = new THREE.Mesh(new THREE.CylinderGeometry(.1, .13, .035, 16), metal); lamp.add(lBase);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, .48, 8), metal);
    arm.position.set(.02, .24, 0); arm.rotation.z = -.16; lamp.add(arm);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(.16, .15, 18, 1, true), mat({ color: 0x7b2a21, roughness: .5, side: THREE.DoubleSide }));
    shade.position.set(.08, .49, 0); shade.rotation.z = .5; lamp.add(shade);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(.045, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd8a0 }));
    bulb.position.set(.1, .44, 0); lamp.add(bulb);
    g.add(lamp);

    // taped photo
    const photo = plane(.2, .26, new THREE.MeshStandardMaterial({ map: posterTexture('employee'), roughness: .95 }), -2.15, .86, 1.15, -Math.PI / 2, 0, -.12);
    g.add(photo);

    g.position.z = -0.9;
    this.office.add(g);
    this.desk = g;
  }

  _buildFrontWall() {
    const g = new THREE.Group();
    g.position.set(0, 0, OFFICE.front + .045);
    // big sign above desk
    const sign = plane(1.65, .8, new THREE.MeshStandardMaterial({ map: signTexture(), roughness: .85 }), .6, 2.05, .01);
    g.add(sign);
    // posters
    const p1 = plane(.64, .86, new THREE.MeshStandardMaterial({ map: posterTexture('main'), roughness: .9 }), -1.55, 1.85, .012);
    g.add(p1);
    const p2 = plane(.6, .8, new THREE.MeshStandardMaterial({ map: posterTexture('safety'), roughness: .9 }), 2.55, 1.9, .012);
    g.add(p2);
    const p3 = plane(.5, .66, new THREE.MeshStandardMaterial({ map: posterTexture('kids'), roughness: .95 }), -2.85, 1.55, .012);
    p3.rotation.z = .05; g.add(p3);
    // vent
    const vent = plane(.78, .5, new THREE.MeshStandardMaterial({ map: ventTexture(), roughness: .7, metalness: .4 }), -2.6, .38, .012);
    g.add(vent);
    // toddler drawings / crayon
    // cables
    const cableMat = mat({ color: 0x12100d, roughness: .75 });
    for (let i = 0; i < 3; i++) {
      const pts = [];
      for (let j = 0; j <= 6; j++) pts.push(new THREE.Vector3(-1.9 + j * .55, 2.92 - Math.sin(j * 1.2 + i) * .12 - i * .04, .03));
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, .014, 5, false), cableMat);
      g.add(tube);
    }
    // wall clock (broken)
    const clock = new THREE.Group(); clock.position.set(0, 2.55, .02);
    const face = new THREE.Mesh(new THREE.CircleGeometry(.2, 28), mat({ color: 0xd8cdb2, roughness: .7 }));
    clock.add(face);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(.2, .018, 6, 30), mat({ color: 0x2a231a, roughness: .5 }));
    clock.add(rim);
    const hand1 = box(.012, .13, .004, mat({ color: 0x171310, roughness: .5 }), 0, .05, .006);
    hand1.rotation.z = .9; clock.add(hand1);
    const hand2 = box(.01, .1, .004, mat({ color: 0x171310, roughness: .5 }), .03, .02, .006);
    hand2.rotation.z = -2.4; clock.add(hand2);
    g.add(clock);
    this.office.add(g);
  }

  _buildBackWall() {
    const g = new THREE.Group();
    g.position.set(0, 0, OFFICE.back - .045);
    g.rotation.y = Math.PI;
    // noticeboard with missing posters
    g.add(box(1.5, .95, .05, mat({ color: 0x3a2b1d, roughness: .95 }), -.9, 1.78, .01));
    const cork = plane(1.36, .82, mat({ color: 0x6b4d2f, roughness: 1 }), -.9, 1.78, .04);
    g.add(cork);
    const kinds = ['kids', 'employee', 'celebrate'];
    kinds.forEach((k, i) => {
      const p = plane(.38, .5, new THREE.MeshStandardMaterial({ map: posterTexture(k), roughness: .95 }), -1.32 + i * .42, 1.78 + (i % 2 ? .04 : -.03), .05);
      p.rotation.z = (i - 1) * .07;
      g.add(p);
    });
    // newspaper clipping "FIVE MISSING"
    for (let i = 0; i < 2; i++) {
      const p = plane(.46, .3, new THREE.MeshStandardMaterial({ map: paperTexture(2), roughness: .98 }), .55 + i * .52, 1.95 - i * .2, .05);
      p.rotation.z = (i ? -.12 : .08);
      g.add(p);
    }
    // small fan / vent
    const vent = plane(.9, .6, new THREE.MeshStandardMaterial({ map: ventTexture(), roughness: .7, metalness: .4 }), 2.7, .5, .02);
    g.add(vent);
    // shelf with tapes
    g.add(box(1.3, .05, .3, mat({ color: 0x34271b, roughness: .9 }), 2.3, 1.6, .16));
    for (let i = 0; i < 6; i++) {
      const tape = box(.06, .18, .12, mat({ color: 0x1a1712, roughness: .7 }), 1.85 + i * .16, 1.72, .16);
      g.add(tape);
      const lbl = box(.04, .07, .122, mat({ color: 0x8d8066, roughness: .9 }), 1.85 + i * .16, 1.74, .161);
      g.add(lbl);
    }
    this.office.add(g);
  }

  _buildDust() {
    const count = 320;
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - .5) * 8.2;
      pos[i * 3 + 1] = .15 + Math.random() * 2.7;
      pos[i * 3 + 2] = OFFICE.front + Math.random() * 6.8;
      vel[i] = .01 + Math.random() * .035;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({
      color: 0xffe6bd, size: .014, transparent: true, opacity: .38,
      depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true
    });
    this.dust = new THREE.Points(geo, m);
    this.dustVel = vel;
    this.office.add(this.dust);
  }

  /* Extra set dressing: ceiling grid, pipes, practicals, a generator,
     desk clutter and glow halos. Cheap meshes, big visual payoff. */
  _buildOfficeDetails() {
    const g = new THREE.Group();
    this.office.add(g);
    const trimM = mat({ color: 0x1f1a14, roughness: .65, metalness: .25 });
    const pipeM = new THREE.MeshStandardMaterial({ map: metalTexture(), roughness: .42, metalness: .72, color: 0x8a857a });
    const darkMetal = mat({ color: 0x2d2a24, roughness: .48, metalness: .55 });

    // ---- ceiling grid and vents
    for (const z of [-2.1, -.2, 1.7]) {
      const beam = box(OFFICE.w * 2, .07, .1, trimM, 0, OFFICE.h - .045, z);
      beam.castShadow = true; g.add(beam);
    }
    const vent1 = plane(.72, .4, new THREE.MeshStandardMaterial({ map: ventTexture(), roughness: .55, metalness: .5 }), -1.8, OFFICE.h - .018, -1.6, Math.PI / 2);
    const vent2 = plane(.6, .34, vent1.material, 1.95, OFFICE.h - .018, 2.2, Math.PI / 2);
    g.add(vent1, vent2);

    // ---- ceiling conduit + junction boxes
    for (const x of [-1.28, 1.28]) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(.032, .032, 5.8, 8), pipeM);
      pipe.rotation.x = Math.PI / 2;
      pipe.position.set(x, OFFICE.h - .11, .45);
      pipe.castShadow = true; g.add(pipe);
    }
    for (const [x, z] of [[-1.28, -1.2], [1.28, 1.9]]) {
      g.add(box(.22, .12, .26, darkMetal, x, OFFICE.h - .16, z));
    }

    // ---- pipes along the back wall
    for (const [y, r] of [[2.58, .028], [2.42, .02]]) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(r, r, OFFICE.w * 2 - .3, 8), pipeM);
      pipe.rotation.z = Math.PI / 2;
      pipe.position.set(0, y, OFFICE.back - .075);
      g.add(pipe);
    }
    for (let i = -1; i <= 1; i++) {
      g.add(box(.06, .2, .06, darkMetal, i * 1.6, 2.5, OFFICE.back - .09));
    }

    // ---- warm practical halos (fake bloom)
    const panelGlow = this._glow(0xffd39a, 1.6, .38);
    panelGlow.position.set(0, OFFICE.h - .12, .2);
    g.add(panelGlow);
    this.panelGlow = panelGlow;
    const monGlow = this._glow(0x7fd0a8, .72, .5);
    monGlow.position.set(1.18, 1.28, .4);
    g.add(monGlow);
    this.monGlow = monGlow;
    const lampGlow = this._glow(0xffb46a, .52, .55);
    lampGlow.position.set(-1.86, 1.3, .08);
    g.add(lampGlow);
    this.lampGlow = lampGlow;

    // ---- soft volumetric shaft under the ceiling tube
    const shaft = new THREE.Mesh(
      new THREE.ConeGeometry(1.05, 2.72, 22, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xffd6a0, transparent: true, opacity: .022,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false
      })
    );
    shaft.position.set(0, 1.58, .2);
    g.add(shaft);
    this.lightShaft = shaft;

    // ---- wall camera in the back corner
    const cam = new THREE.Group();
    cam.position.set(-2.42, 2.6, 2.82);
    cam.rotation.y = .55;
    cam.add(box(.14, .12, .22, darkMetal, 0, 0, 0));
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(.045, .055, .09, 12), mat({ color: 0x090807, roughness: .25, metalness: .5 }));
    lens.rotation.x = Math.PI / 2; lens.position.z = .13; cam.add(lens);
    const camLed = this._glow(0xff3324, .16, .8);
    camLed.position.set(.05, .05, .1); cam.add(camLed);
    const camArm = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, .42, 6), darkMetal);
    camArm.position.set(0, .26, -.12); camArm.rotation.x = .35; cam.add(camArm);
    g.add(cam);
    this.wallCam = cam;

    // ---- keypad + radio on the back wall
    const pad = box(.2, .32, .06, darkMetal, 1.95, 1.4, OFFICE.back - .04);
    g.add(pad);
    for (let i = 0; i < 6; i++) {
      g.add(box(.035, .025, .012, mat({ color: 0x8c8676, roughness: .5 }), 1.88 + (i % 3) * .07, 1.5 - Math.floor(i / 3) * .055, OFFICE.back - .075));
    }
    const padLed = this._glow(0x5cff9a, .12, .65); padLed.position.set(1.95, 1.55, OFFICE.back - .09); g.add(padLed);

    // ---- generator in the back-left corner
    const gen = new THREE.Group();
    gen.position.set(-2.02, 0, 2.9);
    gen.add(box(.78, .86, .52, new THREE.MeshStandardMaterial({ color: 0x5a5a4e, roughness: .55, metalness: .45 }), 0, .43, 0));
    gen.add(box(.7, .18, .03, new THREE.MeshStandardMaterial({ map: hazardTexture(), roughness: .7 }), 0, .28, .27));
    const grille = new THREE.Mesh(new THREE.PlaneGeometry(.52, .3), new THREE.MeshStandardMaterial({ map: ventTexture(), roughness: .6, metalness: .5 }));
    grille.position.set(0, .62, .266); gen.add(grille);
    for (let i = 0; i < 4; i++) gen.add(box(.06, .06, .03, mat({ color: 0x252520, roughness: .5 }), -.22 + i * .14, .78, .27));
    const genLed = this._glow(0x5eff86, .13, .7); genLed.position.set(.24, .72, .3); gen.add(genLed);
    gen.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.add(gen);
    const cable = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      new THREE.Vector3(-1.66, .05, 2.9), new THREE.Vector3(-1.3, .02, 3.2), new THREE.Vector3(-1.0, .03, 3.0), new THREE.Vector3(-.8, .05, 2.8)
    ]), 18, .018, 5, false), mat({ color: 0x0e0c09, roughness: .8 }));
    g.add(cable);

    // ---- trash bin, boxes, mop
    const bin = new THREE.Mesh(new THREE.CylinderGeometry(.22, .18, .5, 14, 1, true), new THREE.MeshStandardMaterial({ color: 0x3b3a34, roughness: .7, metalness: .3, side: THREE.DoubleSide }));
    bin.position.set(2.14, .25, 2.72); bin.castShadow = true; g.add(bin);
    for (let i = 0; i < 3; i++) {
      const paper = new THREE.Mesh(new THREE.IcosahedronGeometry(.07, 0), mat({ color: 0xd4cab1, roughness: .95 }));
      paper.position.set(2.14 + (Math.random() - .5) * .18, .42 + Math.random() * .12, 2.72 + (Math.random() - .5) * .18);
      g.add(paper);
    }
    const boxMat = new THREE.MeshStandardMaterial({ map: deskTexture(), color: 0xb9a488, roughness: .94 });
    for (let i = 0; i < 3; i++) {
      const b = box(.46 - i * .06, .36 - i * .04, .4, boxMat, 2.18 + i * .06, .18 + i * .18, 3.2 - i * .03);
      b.rotation.y = (i - 1) * .15; b.castShadow = true; g.add(b);
    }

    // ---- pencil cup + mug + radio on the desk
    const cupMat = mat({ color: 0x6a6252, roughness: .55, metalness: .2 });
    const pencilCup = new THREE.Mesh(new THREE.CylinderGeometry(.055, .045, .13, 12), cupMat);
    pencilCup.position.set(1.73, .92, .68); pencilCup.castShadow = true; g.add(pencilCup);
    for (let i = 0; i < 4; i++) {
      const pencil = new THREE.Mesh(new THREE.CylinderGeometry(.006, .006, .21, 5), mat({ color: i % 2 ? 0xd4b44a : 0x8a3a2c, roughness: .6 }));
      pencil.position.set(1.73 + (Math.random() - .5) * .04, 1.03, .68 + (Math.random() - .5) * .04);
      pencil.rotation.set((Math.random() - .5) * .2, 0, (Math.random() - .5) * .2);
      g.add(pencil);
    }
    const mug = new THREE.Mesh(new THREE.CylinderGeometry(.055, .05, .1, 14, 1, true), mat({ color: 0x243b36, roughness: .45, metalness: .1, side: THREE.DoubleSide }));
    mug.position.set(-.08, .9, .35); mug.castShadow = true; g.add(mug);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(.037, .009, 6, 14, Math.PI), mat({ color: 0x243b36, roughness: .45 }));
    handle.position.set(.07, .9, .35); handle.rotation.y = Math.PI / 2; g.add(handle);
    const radio = box(.34, .12, .19, mat({ color: 0x24221e, roughness: .5, metalness: .35 }), -.14, .86, 1.22);
    radio.castShadow = true; g.add(radio);
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(.005, .005, .3, 5), mat({ color: 0x8d887c, roughness: .35, metalness: .8 }));
    ant.position.set(-.02, 1.05, 1.13); ant.rotation.x = .35; g.add(ant);
    const radioGlow = this._glow(0xff7a3c, .12, .5); radioGlow.position.set(.02, .9, 1.14); g.add(radioGlow);

    // ---- contact shadows
    const deskShadow = this._contactShadow(4.2, 1.7, .5); deskShadow.position.set(0, .007, .55); g.add(deskShadow);
    const genShadow = this._contactShadow(1.1, .9, .55); genShadow.position.set(-2.02, .007, 2.9); g.add(genShadow);
    const binShadow = this._contactShadow(.6, .6, .5); binShadow.position.set(2.14, .007, 2.72); g.add(binShadow);

    // ---- dangling ceiling cables
    for (let i = 0; i < 4; i++) {
      const pts = [];
      const sx = -1.9 + i * 1.25;
      for (let j = 0; j <= 4; j++) {
        pts.push(new THREE.Vector3(sx + Math.sin(j * 1.7 + i) * .09, OFFICE.h - .03 - j * .1, -1.9 + i * 1.1 + Math.cos(j) * .05));
      }
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, .007, 4, false), mat({ color: 0x0e0c09, roughness: .85 })));
    }

    // ---- fire extinguisher
    const ext = new THREE.Group(); ext.position.set(2.42, 0, 3.28);
    ext.add(new THREE.Mesh(new THREE.CylinderGeometry(.1, .11, .46, 14), mat({ color: 0x8f241c, roughness: .45, metalness: .2 })));
    ext.children[0].position.y = .55;
    const extTop = new THREE.Mesh(new THREE.CylinderGeometry(.045, .06, .1, 10), mat({ color: 0x2a2925, roughness: .4, metalness: .6 }));
    extTop.position.y = .83; ext.add(extTop);
    const extHose = new THREE.Mesh(new THREE.TorusGeometry(.07, .012, 5, 12, Math.PI * 1.4), mat({ color: 0x11100e, roughness: .7 }));
    extHose.position.set(.08, .78, 0); extHose.rotation.y = .4; ext.add(extHose);
    ext.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.add(ext);
  }

  /* ============================================================ MENU */
  _buildMenu() {
    const g = new THREE.Group();
    g.position.set(0, 0, -60);
    this.menuGroup = g;
    this.scene.add(g);

    const floorM = new THREE.MeshStandardMaterial({
      map: floorTexture(), normalMap: normalTexture('tile', 1.8), normalScale: new THREE.Vector2(.9, .9),
      roughness: .26, metalness: .24, envMapIntensity: .8
    });
    const floor = plane(17, 15, floorM, 0, -0.001, 2.2, -Math.PI / 2);
    floor.receiveShadow = true; g.add(floor);

    // back curtain wall (behind the band)
    const curtainTex = this._menuCurtain();
    const curtain = plane(14, 7, new THREE.MeshStandardMaterial({ map: curtainTex, normalMap: normalTexture('fabric', 2.2), normalScale: new THREE.Vector2(.8, .8), roughness: .95 }), 0, 3.5, -7.2);
    g.add(curtain);
    // red valance
    const valMat = mat({ color: 0x5d1512, roughness: .8 });
    g.add(box(14, .9, .18, valMat, 0, 6.2, -7.05));
    for (let i = 0; i < 11; i++) {
      const swag = new THREE.Mesh(new THREE.SphereGeometry(.55, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), valMat);
      swag.position.set(-6 + i * 1.2, 5.7, -7.0);
      swag.scale.set(1, .55, .25);
      g.add(swag);
    }
    // side walls
    for (const s of [-1, 1]) {
      const w = plane(14, 6.6, new THREE.MeshStandardMaterial({ map: wallTexture(), normalMap: normalTexture('plaster', 2.2), normalScale: new THREE.Vector2(.7, .7), roughness: .95 }), s * 8.5, 3.3, .0, 0, s * Math.PI / 2);
      g.add(w);
    }
    g.add(plane(17, 15, new THREE.MeshStandardMaterial({ map: ceilingTexture(), normalMap: normalTexture('tile', 1.4), normalScale: new THREE.Vector2(.8, .8), roughness: 1 }), 0, 6.6, 2.2, Math.PI / 2));
    // neon marquee
    const signTex = neonSignTexture();
    const sign = plane(7.4, 1.6, new THREE.MeshBasicMaterial({ map: signTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), 0, 6.18, -7.1);
    g.add(sign);
    const signGlow = this._glow(0xffb25a, 4.6, .22);
    signGlow.position.set(0, 6.1, -6.9); g.add(signGlow);
    this.menuSign = sign;
    this.menuSignGlow = signGlow;

    // stage truss
    const trussM = mat({ color: 0x2b2823, roughness: .45, metalness: .7, envMapIntensity: .8 });
    g.add(box(12.4, .2, .2, trussM, 0, 6.05, -4.9));
    g.add(box(12.4, .2, .2, trussM, 0, 5.35, -4.9));
    for (let i = 0; i < 12; i++) {
      g.add(box(.06, .7, .06, trussM, -6.05 + i * 1.1, 5.7, -4.9));
    }
    for (const s of [-1, 1]) {
      g.add(box(.16, 6.1, .16, trussM, s * 6.1, 3.05, -4.9));
      g.add(box(.16, .16, 5.0, trussM, s * 6.1, 6.05, -2.5));
    }

    // speaker stacks + amp
    for (const s of [-1, 1]) {
      const sp = new THREE.Group();
      sp.position.set(s * 5.4, .55, -1.4);
      sp.add(box(1.1, 1.9, .9, mat({ color: 0x17140f, roughness: .8 }), 0, .95, 0));
      for (let i = 0; i < 2; i++) {
        const cone = new THREE.Mesh(new THREE.CylinderGeometry(.23, .29, .07, 20), mat({ color: 0x0d0b09, roughness: .9 }));
        cone.rotation.x = Math.PI / 2; cone.position.set(0, .65 + i * .75, .47); sp.add(cone);
        const cone2 = new THREE.Mesh(new THREE.CylinderGeometry(.09, .12, .06, 16), mat({ color: 0x3a352e, roughness: .7 }));
        cone2.rotation.x = Math.PI / 2; cone2.position.set(0, .65 + i * .75, .51); sp.add(cone2);
      }
      sp.traverse(o => { if (o.isMesh) o.castShadow = true; });
      g.add(sp);
    }

    // stage
    g.add(box(11.5, .5, 3.6, mat({ color: 0x1b1410, roughness: .8 }), 0, .25, 0));
    const stageEdge = box(11.5, .07, 3.7, mat({ color: 0x6b1c17, emissive: 0x220604, emissiveIntensity: .6, roughness: .6 }), 0, .53, 0);
    g.add(stageEdge);
    // spotlights
    const spot = new THREE.SpotLight(0xffd9a6, 250, 30, .4, .55, 1.25);
    spot.position.set(0, 5.9, 5.2);
    spot.target.position.set(0, 1.7, -1.4);
    spot.castShadow = true;
    spot.shadow.mapSize.set(1024, 1024);
    spot.shadow.bias = -0.001;
    g.add(spot, spot.target);
    const red = new THREE.PointLight(0xa32a1c, 9, 16, 2);
    red.position.set(-4.5, 2.4, -1.6);
    g.add(red);
    const red2 = new THREE.PointLight(0x7a2418, 7, 15, 2);
    red2.position.set(4.8, 2.2, -2.4);
    g.add(red2);
    const rim = new THREE.PointLight(0x5b6e8d, 3.5, 12, 2);
    rim.position.set(0, 3.2, -5.4);
    g.add(rim);
    const fill = new THREE.HemisphereLight(0x6b5b43, 0x080604, .2);
    g.add(fill);
    const frontFill = new THREE.PointLight(0xffd2a0, 26, 14, 1.7);
    frontFill.position.set(0, 3.1, 3.4);
    g.add(frontFill);
    const rimLight = new THREE.PointLight(0xff7a4a, 34, 12, 1.8);
    rimLight.position.set(0, 2.2, -4.4);
    g.add(rimLight);

    // visible spotlight beams
    this.menuBeams = [];
    const beamDefs = [[-4.1, 4.9], [0, 5.9], [4.1, 4.9]];
    for (const [bx, by] of beamDefs) {
      const beam = new THREE.Mesh(
        new THREE.ConeGeometry(1.5, 5.8, 22, 1, true),
        new THREE.MeshBasicMaterial({
          color: 0xffd6a0, transparent: true, opacity: .05,
          blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false
        })
      );
      beam.position.set(bx * .5, by - 2.1, -2.0);
      beam.rotation.z = bx * -.035;
      g.add(beam);
      this.menuBeams.push(beam);
      const source = this._glow(0xfff0cc, 1.1, .55);
      source.position.set(bx, by, -4.9);
      g.add(source);
    }
    // hot stage edge bulbs
    for (let i = 0; i < 13; i++) {
      const b = this._glow(0xffc46a, .3, .7);
      b.position.set(-5.6 + i * .93, .62, 1.72);
      g.add(b);
    }
    // low stage haze
    for (let i = 0; i < 5; i++) {
      const haze = this._glow(0xd8b98c, 2.0 + i * .5, .05);
      haze.position.set(-4 + i * 2, 1.0, -1.4 + (i % 2) * .8);
      g.add(haze);
    }
    // stage front panels
    for (let i = 0; i < 7; i++) {
      g.add(box(1.55, .4, .08, mat({ color: i % 2 ? 0x2a0d0b : 0x3a1210, roughness: .8 }), -.0 + (i - 3) * 1.62, .28, 1.78));
    }
    // contact shadows
    for (const [sx, sz, sw, sd] of [[-3.3, -1.7, 2.2, 1.5], [3.25, -1.7, 2.2, 1.5], [0, -.75, 2.6, 1.8]]) {
      const sh = this._contactShadow(sw, sd, .6); sh.position.set(sx, .012, sz); g.add(sh);
    }

    // title-stage animatronics
    this.menuChars = {};
    const specs = [
      { type: 'bonnie', x: -3.3, z: -1.7, rot: .2, scale: 1.02 },
      { type: 'chica', x: 3.25, z: -1.7, rot: -.2, scale: 1.02 },
      { type: 'freddy', x: 0, z: -.75, rot: 0, scale: 1.1 }
    ];
    for (const sp of specs) {
      const a = makeAnimatronic(sp.type);
      a.group.position.set(sp.x, .5, sp.z);
      a.group.rotation.y = sp.rot;
      a.group.scale.setScalar(sp.scale);
      a.group.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      a.eyeMat.emissiveIntensity = 1.9;
      g.add(a.group);
      this.menuChars[sp.type] = a;
    }
    // floating dust
    const geo = new THREE.BufferGeometry();
    const n = 150, arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = (Math.random() - .5) * 14; arr[i * 3 + 1] = Math.random() * 5; arr[i * 3 + 2] = -6 + Math.random() * 12; }
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    g.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffdcaa, size: .02, transparent: true, opacity: .28, depthWrite: false, blending: THREE.AdditiveBlending })));

  }

  _menuCurtain() {
    const w = 512, h = 512, c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    x.fillStyle = '#3a1114'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 64; i++) {
      const px = (i / 64) * w;
      const g = x.createLinearGradient(px - 10, 0, px + 10, 0);
      g.addColorStop(0, 'rgba(0,0,0,.45)');
      g.addColorStop(.5, 'rgba(140,45,40,.22)');
      g.addColorStop(1, 'rgba(0,0,0,.45)');
      x.fillStyle = g; x.fillRect(px - 10, 0, 20, h);
    }
    x.fillStyle = 'rgba(255,210,150,.08)';
    for (let i = 0; i < 60; i++) x.beginPath(), x.arc(rand() * w, rand() * h, 1 + rand() * 3, 0, 7), x.fill();
    return finish(c, 1.5, 1);
  }

  /* ============================================================ CHARACTERS */
  _buildOfficeCharacters() {
    // called after copy of materials to avoid shared-material edits
  }

  createOfficeCharacter(type, x, z, rot, scale = 1) {
    const a = makeAnimatronic(type);
    a.group.position.set(x, 0, z);
    a.group.rotation.y = rot;
    a.group.scale.setScalar(scale);
    a.group.visible = false;
    a.group.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
    this.office.add(a.group);
    return a;
  }

  ensureOfficeCharacters() {
    if (this._officeChars) return;
    // Stand just beyond the threshold, angled toward the player's chair so a
    // lit doorway frames the face instead of a sliver of shoulder.
    const x = OFFICE.w + .5;
    const z = OFFICE.doorZ - .34;
    this._officeChars = {
      bonnie: this.createOfficeCharacter('bonnie', -x, z, .7, .98),
      chica: this.createOfficeCharacter('chica', x, z, -.7, .98),
      freddy: this.createOfficeCharacter('freddy', x, z, -.7, .96),
      foxy: this.createOfficeCharacter('foxy', -x, z, .7, .98)
    };
    for (const k in this._officeChars) {
      this._officeChars[k].eyeMat.emissiveIntensity = 1.4;
    }
  }

  setCornerCharacter(side, type) {
    this.ensureOfficeCharacters();
    this.cornerPresence[side] = type;
    const active = new Set([this.cornerPresence.left, this.cornerPresence.right].filter(Boolean));
    for (const k in this._officeChars) {
      if (k === 'foxy') continue;
      this._officeChars[k].group.visible = active.has(k);
    }
  }
  setFoxyRunning(active, prog = 0) {
    this.ensureOfficeCharacters();
    const f = this._officeChars.foxy;
    f.group.visible = active;
    if (active) {
      const p = Math.min(1, Math.max(0, prog));
      f.group.position.x = -7.4 + p * 4.3;
      f.group.position.z = OFFICE.doorZ - .34;
      f.group.rotation.y = Math.PI / 2 + (.7 - Math.PI / 2) * Math.min(1, p * 1.35);
      f.head.rotation.y = 0;
    }
  }
  hideAllCharacters() {
    if (!this._officeChars) return;
    for (const k in this._officeChars) this._officeChars[k].group.visible = false;
    this.cornerPresence = { left: null, right: null };
  }

  /* ============================================================ SCARES */
  _buildScares() {
    this.scareGroup = new THREE.Group();
    this.scareGroup.position.set(0, -.06, 0);
    this.scareGroup.visible = false;
    this.camera.add(this.scareGroup);
    this.scareModels = {};
    for (const t of ['freddy', 'bonnie', 'chica', 'foxy']) {
      const a = makeAnimatronic(t, true);
      a.group.scale.setScalar(.92);
      a.group.position.set(0, .58, -1.5);
      a.group.visible = false;
      a.group.traverse(o => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
      this.scareGroup.add(a.group);
      this.scareModels[t] = a;
    }
    const scL = new THREE.PointLight(0xff5a3c, 0, 3.5, 2);
    scL.position.set(0, .9, -.6);
    this.scareGroup.add(scL);
    this.scareLight = scL;
  }

  playJumpscare(type) {
    const model = this.scareModels[type] || this.scareModels.freddy;
    for (const k in this.scareModels) this.scareModels[k].group.visible = false;
    model.group.visible = true;
    model.eyeMat.emissiveIntensity = 3;
    this.scareGroup.visible = true;
    this.scareLight.intensity = 12;
    this.scare = { t: 0, dur: 1.5, model, type };
    model.group.position.set(0, .2 - 1.72 * .88, -2.05);
    model.group.scale.setScalar(.88);
    model.head.rotation.x = .12;
    if (model.jaw) model.jaw.rotation.x = -.3;
    if (model.arms) model.arms.forEach((a, i) => { a.rotation.x = -.5; a.rotation.z = (i ? 1 : -1) * .2; });
    this.flash = 1;
  }
  stopJumpscare() {
    this.scare = null;
    this.scareGroup.visible = false;
    this.scareLight.intensity = 0;
    if (this.scareModels) for (const k in this.scareModels) this.scareModels[k].group.visible = false;
  }

  setMode(mode) {
    this.mode = mode;
    this.office.visible = mode === 'office';
    this.menuGroup.visible = mode === 'menu';
    this.lookEnabled = mode === 'office';
    if (mode === 'office') {
      this.camera.position.copy(this.cameraBase);
      this.yaw = this.targetYaw = 0; this.pitch = this.targetPitch = -0.07;
      this.officeLight.intensity = 10;
      this.ambient.intensity = .38;
    }
  }

  setPower(p) { this.powerLevel = p; }
  setDoor(side, closed) { this.doorTarget[side] = closed ? 1 : 0; }
  setLight(side, on) { this.lightTarget[side] = on ? 1 : 0; }
  isDoorClosed(side) { return this.door[side] > .92; }

  blackout() {
    this.officeLight.intensity = 0;
    this.deskLight.intensity = 0;
    this.monitorLight.intensity = 0;
    if (this.rimLight) this.rimLight.intensity = 0;
    this.ambient.intensity = .045;
    this.redWash.intensity = .02;
    this.lightPanel.material.emissiveIntensity = 0;
    this.setDoor('left', false); this.setDoor('right', false);
    this.setLight('left', false); this.setLight('right', false);
    this.doorTarget.left = 0; this.doorTarget.right = 0;
    this.blackedOut = true;
  }
  unblackout() {
    this.blackedOut = false;
    this.officeLight.intensity = 10;
    this.deskLight.intensity = 2.6;
    this.monitorLight.intensity = 1.6;
    if (this.rimLight) this.rimLight.intensity = 2.4;
    this.ambient.intensity = .38;
    this.redWash.intensity = .6;
    this.lightPanel.material.emissiveIntensity = 2.2;
  }

  reset() {
    this.stopJumpscare();
    this.hideAllCharacters();
    this.setDoor('left', false); this.setDoor('right', false);
    this.setLight('left', false); this.setLight('right', false);
    this.door.left = this.door.right = 0;
    this.doorTarget.left = this.doorTarget.right = 0;
    this.unblackout();
    this.flicker = 0;
    this._cheer = 0;
  }

  addFlicker(v) { this.flicker = Math.max(this.flicker, v); }

  /* ============================================================ UPDATE */
  update(dt, opts = {}) {
    this.time += dt;
    const t = this.time;

    if (this.office.visible) {
      // look smoothing
      if (this.lookEnabled) {
        this.yaw += (this.targetYaw - this.yaw) * Math.min(1, dt * 12);
        this.pitch += (this.targetPitch - this.pitch) * Math.min(1, dt * 12);
        const breath = Math.sin(t * 1.4) * .004 + Math.sin(t * .53) * .006;
        this.camera.position.set(
          this.cameraBase.x + Math.sin(t * .37) * .012 - this.yaw * .006,
          this.cameraBase.y + breath,
          this.cameraBase.z
        );
        this.camera.rotation.set(this.pitch + Math.sin(t * .7) * .0015, this.yaw, Math.sin(t * .31) * .002);
      } else {
        this.camera.rotation.set(this.pitch, this.yaw, 0);
      }

      // doors
      for (const side of ['left', 'right']) {
        const target = this.doorTarget[side];
        if (this.door[side] !== target) {
          this.door[side] += Math.sign(target - this.door[side]) * dt * 5.2;
          this.door[side] = Math.max(0, Math.min(1, this.door[side]));
        }
        const d = this.doors[side];
        const closed = this.door[side];
        d.shutter.position.y = OFFICE.doorH / 2 + 2.4 - closed * 2.4;
        d.strip.material.color.setHex(closed > .1 ? 0xff3b26 : 0x52140f);
        d.strip.material.opacity = closed > .1 ? .95 : .55;
        if (d.stripGlow) {
          d.stripGlow.material.opacity = this.blackedOut ? 0 : (closed > .1 ? .5 + Math.sin(t * 7) * .08 : .025);
        }
        d.b1.material.emissive.setHex(closed > .5 ? 0x8a2018 : 0x320704);
        d.b1.material.emissiveIntensity = closed > .5 ? 1.1 : .4;

        // lights
        const lt = this.lightTarget[side];
        this.light[side] += (lt - this.light[side]) * Math.min(1, dt * 9);
        d.light.intensity = this.light[side] * (this.blackedOut ? 0 : 12);
        if (d.revealLight) d.revealLight.intensity = this.light[side] * (this.blackedOut ? 0 : 3.2);
        d.volumeBase.opacity = this.light[side] * .045 * (this.blackedOut ? 0 : 1);
        if (this.light[side] > .02) d.light.color.setHex(0xffb56a);
      }

      // office flicker
      const powerDip = this.powerLevel < .2 ? (1 - this.powerLevel) * .5 : 0;
      const f = this.flicker + (Math.random() < .004 ? .35 + Math.random() * .4 : 0) + powerDip * (Math.random() < .05 ? .4 : 0);
      this.flicker = Math.max(0, this.flicker - dt * 3.2);
      if (!this.blackedOut) {
        const dim = 1 - Math.min(.8, f);
        this.officeLight.intensity = 12 * dim;
        this.lightPanel.material.emissiveIntensity = 2.2 * dim;
        this.deskLight.intensity = 2.8 * (1 - f * .7);
        if (this.frontFill) this.frontFill.intensity = 2.2 * dim;
        const hb = 1 + Math.sin(t * 2.7) * .04 + Math.sin(t * 8.3) * .02;
        this.monitorLight.intensity = 1.6 * hb;
        this.officeLight.position.x = Math.sin(t * 1.1) * .05;
        this.monitorLight.intensity *= .9 + Math.random() * .2;
        if (this.panelGlow) this.panelGlow.material.opacity = .38 * dim * (0.85 + hb * .18);
        if (this.monGlow) this.monGlow.material.opacity = .46 * (0.8 + Math.random() * .35);
        if (this.lampGlow) this.lampGlow.material.opacity = .5 * (0.85 + Math.sin(t * 6.2) * .1);
        if (this.lightShaft) this.lightShaft.material.opacity = .021 * dim;
        if (this.rimLight) this.rimLight.intensity = 2.4 * dim;
      } else {
        if (this.panelGlow) this.panelGlow.material.opacity = 0;
        if (this.monGlow) this.monGlow.material.opacity = 0;
        if (this.lampGlow) this.lampGlow.material.opacity = 0;
        if (this.lightShaft) this.lightShaft.material.opacity = 0;
      }
      if (this.doors) {
        for (const side of ['left', 'right']) {
          const d = this.doors[side];
          if (d.lampGlows) {
            const fl = Math.sin(t * 13 + (side === 'left' ? 0 : 2)) > .96 ? .25 : 1;
            const base = this.blackedOut ? 0 : (this.light[side] > .5 ? .45 : .3);
            d.lampGlows.forEach((gl, i) => { gl.material.opacity = base * fl * (i ? .8 : 1); });
          }
        }
      }
      // screen flicker
      if (this.screenMat) {
        this.screenMat.emissiveIntensity = 1.22 + Math.random() * .35 + Math.sin(t * 9) * .05;
      }
      // fan spin
      if (this.fanBlades) this.fanBlades.rotation.z -= dt * (this.blackedOut ? 1.2 : 17);
      if (this.flame) {
        this.flame.position.y = .29 + Math.sin(t * 7) * .004;
        this.flame.scale.setScalar(1 + Math.sin(t * 11) * .15);
      }
      // dust
      if (this.dust) {
        const p = this.dust.geometry.attributes.position;
        for (let i = 0; i < p.count; i++) {
          p.array[i * 3 + 1] += this.dustVel[i] * dt;
          p.array[i * 3] += Math.sin(t * .6 + i) * dt * .01;
          if (p.array[i * 3 + 1] > 2.9) p.array[i * 3 + 1] = .1;
        }
        p.needsUpdate = true;
      }
      // characters idle
      if (this._officeChars) {
        for (const k in this._officeChars) {
          const c = this._officeChars[k];
          if (!c.group.visible) continue;
          c.group.position.y = Math.sin(t * 1.1 + k.length) * .012;
          c.group.rotation.z = Math.sin(t * .7 + k.length) * .008;
          c.head.rotation.y = Math.sin(t * .5 + k.length) * .06;
          c.head.rotation.x = .02 + Math.sin(t * .9 + k.length) * .018;
          if (c.jaw) c.jaw.rotation.x = -.02 - (Math.sin(t * 1.25 + k.length) * .5 + .5) * .045;
          if (c.arms) c.arms.forEach((a, i) => { a.rotation.x = Math.sin(t * .8 + k.length + i * 1.7) * .035; });
          c.eyeMat.emissiveIntensity = 1.2 + Math.sin(t * 2 + k.length) * .4;
        }
      }
      // foxy sprint updates handled externally via setFoxyRunning
      // scare animation
      if (this.scare) {
        const s = this.scare;
        s.t += dt;
        const k = Math.min(1, s.t / s.dur);
        const z = -2.05 + k * .98;
        const shake = (1 - k) * .055 + .008;
        const sc = .88 + k * .34;
        s.model.group.scale.setScalar(sc);
        s.model.group.position.set(
          (Math.random() - .5) * shake,
          .2 - 1.72 * sc + (Math.random() - .5) * shake,
          z
        );
        s.model.group.rotation.z = Math.sin(s.t * 55) * .07 * (1 - k * .3);
        s.model.group.rotation.y = Math.sin(s.t * 31) * .07;
        s.model.head.rotation.x = .12 + Math.sin(s.t * 44) * .08;
        if (s.model.jaw) s.model.jaw.rotation.x = -.28 - k * .34 + Math.sin(s.t * 41) * .06;
        if (s.model.arms) {
          s.model.arms.forEach((a, i) => {
            a.rotation.x = -.5 - k * .75 + Math.sin(s.t * 37 + i * 2) * .12;
            a.rotation.z = (i ? 1 : -1) * (.2 + k * .28);
          });
        }
        this.scareLight.intensity = 6 + Math.random() * 6;
        this.scareLight.position.set((Math.random() - .5) * .6, .7, -.5);
        s.model.eyeMat.emissiveIntensity = 4;
        this.officeLight.intensity *= .12;
        this.deskLight.intensity *= .18;
        this.monitorLight.intensity *= .1;
        this.redWash.intensity = .04;
        this.ambient.intensity = .06;
        this.lightPanel.material.emissiveIntensity *= .08;
        if (s.t >= s.dur && s.onDone) { const cb = s.onDone; s.onDone = null; cb(); }
      }
      // win cheer: brighten
      if (this._cheer > 0) {
        this._cheer = Math.max(0, this._cheer - dt * .22);
        this.officeLight.intensity = Math.max(this.officeLight.intensity, 10 + this._cheer * 34);
        this.lightPanel.material.emissiveIntensity = Math.max(this.lightPanel.material.emissiveIntensity, 2.2 + this._cheer * 7);
        this.ambient.intensity = .38 + this._cheer * 1.5;
      }
    } else if (this.menuGroup.visible) {
      // menu camera drift
      const mx = (this.menuPointer?.x || 0), my = (this.menuPointer?.y || 0);
      const sway = Math.sin(t * .18) * .5;
      this.menuCamera.position.x = sway + mx * .45;
      this.menuCamera.position.y = 2.55 + Math.sin(t * .27) * .045 + my * .16;
      this.menuCamera.position.z = -55.4;
      this.menuCamera.lookAt(sway * .22, 1.52 + my * .06, -60.8);
      this.menuCamera.rotation.z = Math.sin(t * .13) * .004;
      const chars = this.menuChars;
      if (chars) {
        let i = 0;
        for (const k in chars) {
          const c = chars[k];
          c.group.position.y = .5 + Math.sin(t * .8 + i) * .008;
          c.head.rotation.y = Math.sin(t * .35 + i * 2) * .05;
          c.head.rotation.x = .02 + Math.sin(t * .6 + i) * .02;
          if (c.jaw) c.jaw.rotation.x = -.025 - (Math.sin(t * 1.1 + i) * .5 + .5) * .05;
          if (c.arms) c.arms.forEach((a, j) => { a.rotation.x = Math.sin(t * .7 + i + j * 2) * .03; });
          c.eyeMat.emissiveIntensity = 1.5 + Math.sin(t * 1.7 + i) * .45;
          i++;
        }
      }
      // stage red pulse
      if (this.menuGroup.children[0]) { /* noop */ }
      if (this.menuBeams) {
        this.menuBeams.forEach((b, i) => {
          b.material.opacity = .038 + Math.sin(t * .9 + i * 1.7) * .014;
          b.rotation.y = Math.sin(t * .22 + i) * .05;
          b.rotation.z = (i - 1) * -.03 + Math.sin(t * .31 + i) * .012;
        });
      }
      if (this.menuSignGlow) this.menuSignGlow.material.opacity = .18 + Math.sin(t * 1.8) * .04;
    }

    // menu characters visible only when menu
    if (this.menuGroup.visible) {
      for (const k in (this.menuChars || {})) this.menuChars[k].group.visible = true;
    }

    this.renderer.render(this.scene, this.mode === 'menu' ? this.menuCamera : this.camera);
  }

  cheer(seconds = 2.4) { this._cheer = 1; this._cheerTime = seconds; }
}

/* ============================================================== builder */
function headerFix(head, wallMat) {
  // header is currently box using wallpaper material — acceptable, tiny
}

export function makeAnimatronic(type, scare = false) {
  const g = new THREE.Group();
  const palettes = {
    freddy: { main: 0x5a3a20, dark: 0x35200f, muzzle: 0xa87c4e, accent: 0x1c1712, eye: 0xdfe8ff },
    bonnie: { main: 0x4a3a78, dark: 0x2a2148, muzzle: 0x8d7cb0, accent: 0x8f2b2a, eye: 0xe8d8ff },
    chica: { main: 0xcaa73f, dark: 0x8d7124, muzzle: 0xe0a83a, accent: 0x8f2b2a, eye: 0xd8c6ff },
    foxy: { main: 0x8c3323, dark: 0x542015, muzzle: 0xb26743, accent: 0x1c1712, eye: 0xffcf6a }
  };
  const p = palettes[type] || palettes.freddy;
  const suitNormal = normalTexture('fabric', 1.7);
  const mainMat = new THREE.MeshStandardMaterial({
    map: suitTexture(p.main), normalMap: suitNormal, normalScale: new THREE.Vector2(.55, .55),
    color: 0xffffff, roughness: .8, metalness: .03, envMapIntensity: .3
  });
  const darkMat = new THREE.MeshStandardMaterial({
    map: suitTexture(p.dark), normalMap: suitNormal, normalScale: new THREE.Vector2(.45, .45),
    color: 0xffffff, roughness: .86, metalness: .02, envMapIntensity: .22
  });
  const muzzleMat = new THREE.MeshStandardMaterial({
    map: suitTexture(p.muzzle), normalMap: suitNormal, normalScale: new THREE.Vector2(.6, .6),
    color: 0xffffff, roughness: .74, metalness: .02, envMapIntensity: .28
  });
  const accentMat = new THREE.MeshStandardMaterial({ color: p.accent, roughness: .62, metalness: .12, envMapIntensity: .3 });
  const endoMat = new THREE.MeshStandardMaterial({ color: 0x302d27, roughness: .34, metalness: .86, envMapIntensity: .95 });
  const toothMat = new THREE.MeshStandardMaterial({ color: 0xe4dbc2, roughness: .32, metalness: .02, envMapIntensity: .5 });
  const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xd9d3c0, roughness: .25, metalness: .05, envMapIntensity: .55 });
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0x0a0806, emissive: p.eye, emissiveIntensity: scare ? 2.4 : 1.55, roughness: .18, metalness: .05
  });
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x050403 });
  const glintMat = new THREE.MeshBasicMaterial({ color: 0xfff6e4 });

  const M = (geo, material, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    return m;
  };

  // ---- hips / torso
  const hips = M(new THREE.SphereGeometry(.26, 20, 14), darkMat, 0, .9, 0);
  hips.scale.set(1.28, .7, .9);
  g.add(hips);
  const torso = M(new THREE.CapsuleGeometry(.31, .52, 8, 20), mainMat, 0, 1.18, 0);
  torso.scale.set(1.12, 1, .84);
  g.add(torso);
  const chest = M(new THREE.SphereGeometry(.28, 20, 14), mainMat, 0, 1.3, .19);
  chest.scale.set(1.08, .92, .5);
  g.add(chest);
  const belly = M(new THREE.SphereGeometry(.26, 20, 14), muzzleMat, 0, 1.06, .195);
  belly.scale.set(1.02, 1.26, .52);
  g.add(belly);
  // belly seams and buttons
  const seamMat = new THREE.MeshStandardMaterial({ color: 0x17130f, roughness: .85 });
  for (const y of [1.02, 1.19]) {
    const seam = M(new THREE.TorusGeometry(.235, .007, 4, 20), seamMat, 0, y, .25);
    seam.rotation.x = Math.PI / 2;
    seam.scale.set(1.1, .7, 1);
    g.add(seam);
  }
  for (const y of [1.26, 1.16]) {
    g.add(M(new THREE.SphereGeometry(.032, 10, 8), accentMat, 0, y, .35));
  }
  const neck = M(new THREE.CylinderGeometry(.115, .13, .16, 14), endoMat, 0, 1.58, 0);
  g.add(neck);
  const collar = M(new THREE.TorusGeometry(.175, .022, 6, 22), darkMat, 0, 1.54, 0);
  collar.rotation.x = Math.PI / 2;
  g.add(collar);

  // ---- arms
  const arms = [];
  for (const s of [-1, 1]) {
    const shoulder = M(new THREE.SphereGeometry(.155, 16, 12), mainMat, s * .4, 1.47, 0);
    shoulder.scale.set(1, .95, .95);
    g.add(shoulder);
    const arm = new THREE.Group();
    arm.position.set(s * .42, 1.44, 0);
    arm.rotation.z = s * .045;
    g.add(arm);
    arms.push(arm);
    const upper = M(new THREE.CapsuleGeometry(.098, .28, 5, 12), mainMat, 0, -.19, 0);
    arm.add(upper);
    const elbow = M(new THREE.SphereGeometry(.093, 12, 10), endoMat, 0, -.37, 0);
    arm.add(elbow);
    const fore = M(new THREE.CapsuleGeometry(.085, .25, 5, 12), mainMat, 0, -.53, .018);
    fore.rotation.x = -.07;
    if (type === 'foxy' && s < 0) fore.material = endoMat;
    arm.add(fore);
    const wrist = M(new THREE.TorusGeometry(.078, .014, 5, 14), endoMat, 0, -.68, .025);
    wrist.rotation.x = Math.PI / 2;
    arm.add(wrist);
    if (type === 'foxy' && s > 0) {
      const hook = M(new THREE.TorusGeometry(.075, .018, 6, 18, Math.PI * 1.45), new THREE.MeshStandardMaterial({ color: 0x9b988c, roughness: .28, metalness: .95, envMapIntensity: 1 }), 0, -.79, .05);
      hook.rotation.z = .4;
      hook.rotation.x = .2;
      arm.add(hook);
      const cuff = M(new THREE.CylinderGeometry(.09, .1, .09, 12), darkMat, 0, -.69, .02);
      arm.add(cuff);
    } else {
      const hand = M(new THREE.SphereGeometry(.092, 14, 10), darkMat, 0, -.75, .06);
      hand.scale.set(1, .82, 1.18);
      arm.add(hand);
      for (let f = 0; f < 3; f++) {
        const finger = M(new THREE.CapsuleGeometry(.019, .075, 3, 6), mainMat, (f - 1) * .045, -.83, .1);
        finger.rotation.x = -.35 + f * .2;
        arm.add(finger);
      }
      const thumb = M(new THREE.CapsuleGeometry(.024, .05, 3, 6), mainMat, s * .085, -.77, .1);
      thumb.rotation.z = s * .7;
      arm.add(thumb);
    }
    // bolts at the shoulder seam
    g.add(M(new THREE.SphereGeometry(.028, 8, 6), endoMat, s * .31, 1.53, .11));
    if (type === 'freddy' && s > 0) {
      // microphone
      const mic = new THREE.Group();
      mic.position.set(0, -.8, .16);
      mic.rotation.x = -.35;
      mic.add(M(new THREE.CylinderGeometry(.032, .038, .16, 12), new THREE.MeshStandardMaterial({ color: 0x27241f, roughness: .45, metalness: .5 }), 0, 0, 0));
      const head = M(new THREE.SphereGeometry(.052, 12, 10), new THREE.MeshStandardMaterial({ color: 0x5a564c, roughness: .5, metalness: .45 }), 0, .105, 0);
      mic.add(head);
      arm.add(mic);
    }
  }

  // ---- legs
  for (const s of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(s * .17, .9, 0);
    leg.rotation.z = s * .018;
    g.add(leg);
    const thigh = M(new THREE.CapsuleGeometry(.12, .28, 5, 12), mainMat, 0, -.16, 0);
    leg.add(thigh);
    const knee = M(new THREE.SphereGeometry(.104, 12, 10), endoMat, 0, -.34, .02);
    leg.add(knee);
    const shin = M(new THREE.CapsuleGeometry(.095, .24, 5, 12), darkMat, 0, -.5, .01);
    leg.add(shin);
    const ankle = M(new THREE.SphereGeometry(.085, 10, 8), endoMat, 0, -.65, .01);
    leg.add(ankle);
    const foot = M(new THREE.SphereGeometry(.13, 14, 10), mainMat, 0, -.82, .1);
    foot.scale.set(1, .58, 1.55);
    leg.add(foot);
    const toe = M(new THREE.SphereGeometry(.07, 10, 8), darkMat, 0, -.84, .25);
    toe.scale.set(1.2, .5, 1.1);
    leg.add(toe);
  }

  // ---- head
  const head = new THREE.Group();
  head.position.y = 1.82;
  head.rotation.x = .02;
  g.add(head);
  const skull = M(new THREE.SphereGeometry(.275, 28, 20), mainMat, 0, 0, 0);
  skull.scale.set(1.07, .99, .93);
  head.add(skull);
  // cheek/jaw mass at the sides
  for (const s of [-1, 1]) {
    const cheek = M(new THREE.SphereGeometry(.09, 12, 10), mainMat, s * .175, -.08, .12);
    cheek.scale.set(1, .9, .9);
    head.add(cheek);
  }
  // muzzle
  const muzzle = M(new THREE.SphereGeometry(.16, 20, 14), muzzleMat, 0, -.08, .205);
  muzzle.scale.set(1.16, .82, 1.12);
  head.add(muzzle);
  if (type === 'foxy') {
    muzzle.scale.set(1.02, .66, 1.62);
    muzzle.position.set(0, -.1, .255);
  }
  // brow ridge
  const browMat = type === 'foxy' ? darkMat : mainMat;
  for (const s of [-1, 1]) {
    const brow = M(new THREE.SphereGeometry(.105, 12, 8), browMat, s * .105, .115, .19);
    brow.scale.set(1.1, .42, .6);
    head.add(brow);
  }
  // eye sockets / eyes
  for (const s of [-1, 1]) {
    const socket = M(new THREE.SphereGeometry(.072, 14, 12), new THREE.MeshStandardMaterial({ color: 0x17120d, roughness: .5 }), s * .105, .048, .202);
    socket.scale.set(1, .95, .55);
    head.add(socket);
    const white = M(new THREE.SphereGeometry(.058, 16, 12), eyeWhiteMat, s * .105, .048, .222);
    white.scale.set(1, 1, .78);
    head.add(white);
    const iris = M(new THREE.SphereGeometry(.03, 14, 10), eyeMat, s * .105, .046, .263);
    iris.scale.set(1, 1, .7);
    head.add(iris);
    const pupil = M(new THREE.SphereGeometry(.013, 10, 8), pupilMat, s * .105, .045, .281);
    pupil.scale.set(1, 1, .6);
    head.add(pupil);
    const glint = M(new THREE.SphereGeometry(.008, 8, 6), glintMat, s * .098, .062, .287);
    head.add(glint);
    // upper eyelid
    const lid = M(new THREE.SphereGeometry(.074, 12, 8), browMat, s * .105, .105, .21);
    lid.scale.set(1.05, .42, .62);
    lid.rotation.z = s * -.16;
    head.add(lid);
  }
  // nose / beak
  if (type === 'chica') {
    const beak = M(new THREE.ConeGeometry(.105, .17, 5), new THREE.MeshStandardMaterial({ color: 0xe08a2a, roughness: .52, envMapIntensity: .4 }), 0, -.075, .31);
    beak.rotation.x = Math.PI / 2;
    beak.rotation.y = Math.PI / 4;
    head.add(beak);
    const beakLow = M(new THREE.ConeGeometry(.075, .1, 5), new THREE.MeshStandardMaterial({ color: 0xc46c1c, roughness: .55 }), 0, -.16, .3);
    beakLow.rotation.x = Math.PI / 2;
    beakLow.rotation.y = Math.PI / 4;
    head.add(beakLow);
  } else {
    const nose = M(new THREE.SphereGeometry(.058, 12, 8), new THREE.MeshStandardMaterial({ color: 0x16110c, roughness: .38, metalness: .1, envMapIntensity: .55 }), 0, -.015, .365);
    nose.scale.set(1.25, .8, 1);
    head.add(nose);
    // nostrils
    for (const s of [-1, 1]) head.add(M(new THREE.SphereGeometry(.012, 6, 4), pupilMat, s * .022, -.02, .405));
  }
  // mouth cavity
  const cavity = M(new THREE.SphereGeometry(.125, 16, 12), new THREE.MeshStandardMaterial({ color: 0x080504, roughness: .95 }), 0, -.125, .27);
  cavity.scale.set(1.55, scare ? 1.1 : .62, .42);
  head.add(cavity);
  // upper teeth
  for (let i = -2; i <= 2; i++) {
    const t = M(new THREE.BoxGeometry(.031, .052, .016), toothMat, i * .037, -.115, .345);
    t.rotation.z = i * .035;
    head.add(t);
  }
  // jaw group
  const jaw = new THREE.Group();
  jaw.position.set(0, -.19, .1);
  head.add(jaw);
  const jawMass = M(new THREE.SphereGeometry(.145, 18, 12), muzzleMat, 0, -.045, .075);
  jawMass.scale.set(1.12, .52, 1.02);
  jaw.add(jawMass);
  const jawLip = M(new THREE.SphereGeometry(.13, 16, 10), darkMat, 0, -.075, .1);
  jawLip.scale.set(1.1, .35, .85);
  jaw.add(jawLip);
  for (let i = -2; i <= 2; i++) {
    const t = M(new THREE.BoxGeometry(.029, .046, .014), toothMat, i * .034, .008, .19);
    t.rotation.z = -i * .03;
    jaw.add(t);
  }
  if (scare) {
    for (let i = -3; i <= 3; i++) {
      const t = M(new THREE.BoxGeometry(.032, .06, .015), toothMat, i * .032, -.03, .2);
      jaw.add(t);
      const up = M(new THREE.BoxGeometry(.03, .058, .015), toothMat, i * .031, -.155, .35);
      head.add(up);
    }
  }
  // jaw hinges
  for (const s of [-1, 1]) {
    head.add(M(new THREE.CylinderGeometry(.028, .028, .035, 8), endoMat, s * .18, -.13, .15));
  }

  // ears / hat / hair
  if (type === 'freddy') {
    for (const s of [-1, 1]) {
      const ear = M(new THREE.SphereGeometry(.098, 14, 12), mainMat, s * .205, .225, -.015);
      ear.scale.set(1, 1, .52);
      head.add(ear);
      const inner = M(new THREE.SphereGeometry(.052, 10, 8), muzzleMat, s * .213, .232, .028);
      inner.scale.set(1, 1, .38);
      head.add(inner);
    }
    const hat = new THREE.Group();
    const felt = new THREE.MeshStandardMaterial({ color: 0x111010, roughness: .72, envMapIntensity: .2 });
    const brim = M(new THREE.CylinderGeometry(.215, .215, .028, 24), felt, 0, 0, 0);
    const top = M(new THREE.CylinderGeometry(.132, .152, .28, 24), felt, 0, .15, 0);
    const band = M(new THREE.CylinderGeometry(.154, .154, .045, 24), new THREE.MeshStandardMaterial({ color: 0x6e1f18, roughness: .6 }), 0, .035, 0);
    hat.add(brim, top, band);
    hat.position.set(0, .285, 0);
    hat.rotation.z = .035;
    head.add(hat);
  } else if (type === 'bonnie') {
    for (const s of [-1, 1]) {
      const ear = M(new THREE.CapsuleGeometry(.062, .3, 5, 12), mainMat, s * .125, .385, -.02);
      ear.rotation.z = s * .13;
      head.add(ear);
      const inner = M(new THREE.CapsuleGeometry(.03, .2, 4, 8), muzzleMat, s * .128, .39, .026);
      inner.rotation.z = s * .13;
      head.add(inner);
      head.add(M(new THREE.SphereGeometry(.026, 8, 6), endoMat, s * .125, .23, -.03));
    }
  } else if (type === 'chica') {
    const tuft = M(new THREE.ConeGeometry(.075, .26, 5), mainMat, 0, .35, -.01);
    tuft.rotation.z = .08;
    head.add(tuft);
    for (const s of [-1, 1]) {
      const f = M(new THREE.ConeGeometry(.046, .17, 4), mainMat, s * .085, .315, 0);
      f.rotation.z = s * .38;
      head.add(f);
    }
    // bib
    const bib = M(new THREE.CircleGeometry(.2, 22), new THREE.MeshStandardMaterial({ color: 0xece4d0, roughness: .9 }), 0, 1.31, .27);
    bib.scale.set(1.15, .9, 1);
    bib.rotation.x = -.12;
    g.add(bib);
    const bibText = M(new THREE.CircleGeometry(.08, 16), new THREE.MeshStandardMaterial({ color: 0xb5473a, roughness: .85 }), 0, 1.3, .276);
    bibText.scale.set(1.4, .65, 1);
    bibText.rotation.x = -.12;
    g.add(bibText);
  } else if (type === 'foxy') {
    for (const s of [-1, 1]) {
      const ear = M(new THREE.ConeGeometry(.078, .21, 4), mainMat, s * .17, .25, .015);
      ear.rotation.z = s * .2;
      head.add(ear);
      const inner = M(new THREE.ConeGeometry(.04, .12, 4), darkMat, s * .17, .25, .045);
      inner.rotation.z = s * .2;
      head.add(inner);
    }
    const patch = M(new THREE.CircleGeometry(.077, 16), new THREE.MeshStandardMaterial({ color: 0x0d0b09, roughness: .82 }), -.105, .05, .28);
    head.add(patch);
    const strap = M(new THREE.TorusGeometry(.265, .012, 5, 30, Math.PI), new THREE.MeshStandardMaterial({ color: 0x0d0b09, roughness: .82 }), 0, .03, .02);
    strap.rotation.x = .1;
    head.add(strap);
    // torn ear notch
    const notch = M(new THREE.BoxGeometry(.06, .06, .06), darkMat, -.2, .33, .01);
    head.add(notch);
  }

  // bow tie
  if (type !== 'foxy') {
    for (const s of [-1, 1]) {
      const bw = M(new THREE.ConeGeometry(.078, .105, 3), accentMat, s * .073, 1.47, .25);
      bw.rotation.z = s * Math.PI / 2;
      bw.rotation.x = Math.PI / 2;
      g.add(bw);
    }
    g.add(M(new THREE.SphereGeometry(.036, 10, 8), accentMat, 0, 1.47, .272));
  }

  if (scare) {
    // heavy brow + stretched grin for the jumpscare model
    for (const s of [-1, 1]) {
      const b = M(new THREE.BoxGeometry(.14, .036, .05), darkMat, s * .105, .145, .245);
      b.rotation.z = s * -.34;
      head.add(b);
    }
    const grin = M(new THREE.TorusGeometry(.14, .012, 5, 24, Math.PI), new THREE.MeshStandardMaterial({ color: 0x3a0b08, roughness: .8 }), 0, -.08, .33);
    grin.rotation.x = Math.PI;
    head.add(grin);
  }

  // subtle endoskeleton glimpses at the joints
  for (const s of [-1, 1]) {
    g.add(M(new THREE.TorusGeometry(.115, .014, 5, 16), endoMat, s * .17, .56, 0));
  }

  head.rotation.x = scare ? .05 : .02;
  jaw.rotation.x = scare ? -.16 : -.01;
  g.traverse(o => { if (o.isMesh) { o.castShadow = !scare; o.receiveShadow = false; } });

  return { group: g, head, jaw, eyeMat, type, arms };
}
