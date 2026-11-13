import * as THREE from '../vendor/three.module.min.js';
import {
  wallTexture, wainscotTexture, ceilingTexture, floorTexture, posterTexture,
  metalTexture, deskTexture, screenTexture, paperTexture, fanTexture, signTexture,
  ventTexture, suitTexture, lightPanelTexture, exitTexture, finish, rand, resetSeed,
  normalFrom, roughnessFrom, dropCeilingTexture, curtainTexture, hazardTexture,
  glowTexture, beamTexture, marqueeTexture, ventGrilleTexture, cableTexture
} from './textures.js';
import { PostFX } from './postfx.js';

const OFFICE = { w: 2.86, front: -2.9, back: 3.6, h: 3.05, doorZ: -0.58, doorW: 1.32, doorH: 2.42 };
const EYE_Y = 1.63;

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
function cyl(rt, rb, h, material, seg = 16) {
  return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material);
}
function sph(r, material, sx = 1, sy = 1, sz = 1, seg = 18) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(8, seg - 4)), material);
  m.scale.set(sx, sy, sz);
  return m;
}
function shadowify(o, cast = true, receive = true) {
  o.traverse(n => { if (n.isMesh) { n.castShadow = cast; n.receiveShadow = receive; } });
  return o;
}
function cloneRepeat(tex, x, y) {
  const t = tex.clone();
  t.needsUpdate = true;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(x, y);
  return t;
}

export class World {
  constructor(container) {
    this.container = container;
    this.mode = 'menu';
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
    this.blackedOut = false;
    this._cheer = 0;
    this._lowPower = 0;
    resetSeed(9182);
    this._initRenderer();
    this._buildEnvironment();
    this._buildOffice();
    this._buildMenu();
    this._buildScares();
    this.resize(window.innerWidth, window.innerHeight);
  }

  /* ============================================================ CORE */
  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: false, alpha: false, powerPreference: 'high-performance',
      stencil: false, preserveDrawingBuffer: false
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050403);
    this.scene.fog = new THREE.FogExp2(0x070504, 0.038);
    this.camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.05, 70);
    this.camera.rotation.order = 'YXZ';
    this.camera.position.set(0, EYE_Y, 3.0);
    this.scene.add(this.camera);
    this.cameraBase = new THREE.Vector3(0, EYE_Y, 3.0);
    this.menuCamera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.05, 90);
    this.menuCamera.position.set(0, 2.5, -55.1);

    this.postfx = new PostFX(this.renderer);
    this.fx = { exposure: 1.0, bloom: .4, vignette: .72, grain: .026, aberration: .16, damage: 0, desat: 0, dark: 1 };
    this.postfx.resize(window.innerWidth, window.innerHeight, this.renderer.getPixelRatio());
    this._applyFX();
  }

  _applyFX() {
    if (!this.postfx || !this.postfx.ok) return;
    this.postfx.setParams(this.fx);
  }

  setFX(partial) {
    Object.assign(this.fx, partial);
    this._applyFX();
  }

  _buildEnvironment() {
    try {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      const env = new THREE.Scene();
      env.background = new THREE.Color(0x0a0806);
      const shell = new THREE.Mesh(
        new THREE.BoxGeometry(14, 8, 14),
        new THREE.MeshBasicMaterial({ color: 0x17110c, side: THREE.BackSide })
      );
      env.add(shell);
      const panel = (color, x, y, z, w, h, ry = 0, rx = 0) => {
        const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color }));
        p.position.set(x, y, z); p.rotation.set(rx, ry, 0); env.add(p);
      };
      panel(0xffd9a0, 0, 3.9, 1.2, 4.4, 2.2, 0, Math.PI / 2);
      panel(0xff6a3a, -6.5, 1.9, 0, 1.5, 4.5, Math.PI / 2);
      panel(0x6c88b8, 6.5, 1.4, -2, 1.2, 3, -Math.PI / 2);
      panel(0xffb070, 0, 0.6, -6.5, 3, 1, 0);
      const rt = pmrem.fromScene(env, 0.09);
      this.scene.environment = rt.texture;
      this.envRT = rt;
      pmrem.dispose();
    } catch (e) { /* optional */ }
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

  resize(w, h) {
    this.renderer.setSize(w, h);
    const a = w / h;
    const portrait = a < .78;
    this.camera.aspect = a;
    this.camera.fov = portrait ? 88 : 68;
    this.camera.updateProjectionMatrix();
    this.cameraBase.z = portrait ? 3.18 : 3.0;
    this.menuCamera.aspect = a;
    this.menuCamera.fov = portrait ? 58 : 46;
    this.menuCamera.updateProjectionMatrix();
    this.postfx.resize(w, h, this.renderer.getPixelRatio());
  }
  setPixelRatio(r) {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, r));
    this.postfx.resize(window.innerWidth, window.innerHeight, this.renderer.getPixelRatio());
  }

  /* ============================================================ MATERIALS */
  _materials() {
    const wallTex = wallTexture();
    const wainsTex = wainscotTexture();
    const floorTex = floorTexture();
    const ceilTex = dropCeilingTexture();
    const metalTex = metalTexture();
    const deskTex = deskTexture();

    const wallMap = cloneRepeat(wallTex, 2, 1.4);
    const wainsMap = cloneRepeat(wainsTex, 2, 1);
    const floorMap = cloneRepeat(floorTex, 5, 5);
    const ceilMap = cloneRepeat(ceilTex, 3, 3);
    const metalMap = cloneRepeat(metalTex, 1, 1);
    const deskMap = cloneRepeat(deskTex, 1.5, 1);

    const m = {
      wall: mat({ map: wallMap, normalMap: normalFrom(wallMap, 1.3, wallMap.repeat), roughnessMap: roughnessFrom(wallMap, null, 1), roughness: .93, metalness: .02, envMapIntensity: .28 }),
      wains: mat({ map: wainsMap, normalMap: normalFrom(wainsMap, 1.8, wainsMap.repeat), roughness: .72, metalness: .04, envMapIntensity: .4 }),
      floor: mat({ map: floorMap, normalMap: normalFrom(floorMap, 1.5, floorMap.repeat), roughnessMap: roughnessFrom(floorMap, null, .9), roughness: .34, metalness: .22, envMapIntensity: .9 }),
      ceiling: mat({ map: ceilMap, normalMap: normalFrom(ceilMap, 1.1, ceilMap.repeat), roughness: .95, metalness: .02, envMapIntensity: .15 }),
      metal: mat({ map: metalMap, normalMap: normalFrom(metalMap, 2.4, metalMap.repeat), roughness: .42, metalness: .78, envMapIntensity: 1.1 }),
      desk: mat({ map: deskMap, normalMap: normalFrom(deskMap, .9, deskMap.repeat), roughness: .52, metalness: .04, envMapIntensity: .35 }),
      trim: mat({ color: 0x2a2118, roughness: .62, metalness: .1 }),
      dark: mat({ color: 0x1b1611, roughness: .8 }),
      frame: mat({ color: 0x302a22, roughness: .44, metalness: .55, envMapIntensity: .8 }),
      steel: mat({ color: 0x413e37, roughness: .34, metalness: .85, envMapIntensity: 1.2 }),
      paper: mat({ map: paperTexture(9), roughness: .96 }),
      hazard: mat({ map: hazardTexture(), roughness: .7, metalness: .1 })
    };
    return m;
  }

  /* ============================================================ OFFICE */
  _buildOffice() {
    const s = this.scene;
    this.office = new THREE.Group();
    s.add(this.office);
    const M = this.M = this._materials();

    // floor + ceiling
    const floor = plane(OFFICE.w * 2 + .5, OFFICE.back - OFFICE.front + .5, M.floor, 0, 0, (OFFICE.back + OFFICE.front) / 2, -Math.PI / 2);
    floor.receiveShadow = true;
    this.office.add(floor);
    const ceiling = plane(OFFICE.w * 2 + .5, OFFICE.back - OFFICE.front + .5, M.ceiling, 0, OFFICE.h, (OFFICE.back + OFFICE.front) / 2, Math.PI / 2);
    ceiling.receiveShadow = true;
    this.office.add(ceiling);
    // checker floor border
    this.office.add(box(OFFICE.w * 2, .02, .1, M.trim, 0, .012, OFFICE.front + .05));
    this.office.add(box(OFFICE.w * 2, .02, .1, M.trim, 0, .012, OFFICE.back - .05));

    // Build a wall slice: wainscot + wallpaper + rails
    const wallSlice = (w, h = OFFICE.h, wallMat = M.wall) => {
      const g = new THREE.Group();
      const lowH = .96;
      const lower = box(w, lowH, .09, M.wains, 0, lowH / 2, 0);
      lower.castShadow = false; lower.receiveShadow = true;
      g.add(lower);
      const upperH = h - lowH;
      const upper = plane(w, upperH, wallMat, 0, lowH + upperH / 2, .047);
      upper.receiveShadow = true;
      g.add(upper);
      g.add(box(w, .075, .15, M.trim, 0, lowH + .01, .045));
      g.add(box(w, .15, .12, M.trim, 0, .075, .045));
      g.add(box(w, .07, .11, M.trim, 0, h - .035, .045));
      // panel seams
      const seams = Math.max(1, Math.round(w / .9));
      for (let i = 1; i < seams; i++) {
        g.add(box(.012, lowH - .12, .012, mat({ color: 0x241b12, roughness: .8 }), -w / 2 + i * (w / seams), lowH / 2, .052));
      }
      return g;
    };

    // front wall (behind the desk) and back wall
    const fw = wallSlice(OFFICE.w * 2);
    fw.position.set(0, 0, OFFICE.front);
    this.office.add(fw);
    const bw = wallSlice(OFFICE.w * 2);
    bw.position.set(0, 0, OFFICE.back);
    bw.rotation.y = Math.PI;
    this.office.add(bw);

    // side walls with doorway openings
    const zA = OFFICE.front, zB = OFFICE.doorZ - OFFICE.doorW / 2;
    const zC = OFFICE.doorZ + OFFICE.doorW / 2, zD = OFFICE.back;
    const upperH = OFFICE.h - .96;
    for (const side of [-1, 1]) {
      const x = side * OFFICE.w;
      const ry = side < 0 ? Math.PI / 2 : -Math.PI / 2;
      for (const [za, zb] of [[zA, zB], [zC, zD]]) {
        const len = Math.abs(zb - za), cz = (za + zb) / 2;
        const lower = plane(len, .96, M.wains, x, .48, cz, 0, ry);
        lower.receiveShadow = true;
        const upper = plane(len, upperH, M.wall, x, .96 + upperH / 2, cz, 0, ry);
        upper.receiveShadow = true;
        this.office.add(lower, upper);
        this.office.add(box(.12, .075, len, M.trim, x, .965, cz));
        this.office.add(box(.12, .15, len, M.trim, x, .075, cz));
        this.office.add(box(.1, .07, len, M.trim, x, OFFICE.h - .035, cz));
      }
      const headerH = OFFICE.h - OFFICE.doorH;
      const header = plane(OFFICE.doorW, headerH, M.wall, x, OFFICE.doorH + headerH / 2, OFFICE.doorZ, 0, ry);
      header.receiveShadow = true;
      this.office.add(header);
      this.office.add(box(.12, .12, OFFICE.doorW + .24, M.trim, x, OFFICE.doorH + headerH - .06, OFFICE.doorZ));

      this._buildDoorway(side, side < 0 ? 'left' : 'right');
      this._buildHall(side, side < 0 ? 'left' : 'right');
    }

    // crown / ceiling trim
    this.office.add(box(OFFICE.w * 2, .1, .1, M.trim, 0, OFFICE.h - .05, OFFICE.front + .05));
    this.office.add(box(OFFICE.w * 2, .1, .1, M.trim, 0, OFFICE.h - .05, OFFICE.back - .05));

    this._buildCeilingDetail();
    this._buildLights();
    this._buildDesk();
    this._buildFrontWall();
    this._buildBackWall();
    this._buildSideProps();
    this._buildDust();
  }

  _buildDoorway(side, key) {
    const M = this.M;
    const frame = new THREE.Group();
    frame.position.set(side * OFFICE.w, 0, OFFICE.doorZ);
    frame.rotation.y = side * Math.PI / 2;
    // jambs
    frame.add(box(.15, OFFICE.doorH + .1, .14, M.frame, 0, OFFICE.doorH / 2, -OFFICE.doorW / 2 - .07));
    frame.add(box(.15, OFFICE.doorH + .1, .14, M.frame, 0, OFFICE.doorH / 2, OFFICE.doorW / 2 + .07));
    frame.add(box(.15, .16, OFFICE.doorW + .34, M.frame, 0, OFFICE.doorH + .06, 0));
    // hydraulic rail
    frame.add(box(.11, .1, OFFICE.doorW + .2, M.steel, 0, OFFICE.doorH + .15, 0));
    frame.add(cyl(.03, .03, OFFICE.doorW * .58, M.steel, 8).rotateX(Math.PI / 2));
    this.office.add(frame);

    // shutter
    const shutter = box(.11, OFFICE.doorH + .08, OFFICE.doorW + .06, M.metal, 0, 0, 0);
    shutter.castShadow = true; shutter.receiveShadow = true;
    const shutterGroup = new THREE.Group();
    shutterGroup.position.set(side * OFFICE.w, 0, OFFICE.doorZ);
    shutterGroup.rotation.y = side * Math.PI / 2;
    shutter.position.y = OFFICE.doorH / 2 + 2.55;
    shutterGroup.add(shutter);
    // ribs on shutter (children of the moving panel)
    const ribMat = mat({ color: 0x24221e, roughness: .5, metalness: .7 });
    const ribs = [];
    for (let i = 0; i < 5; i++) {
      const rib = box(.125, .038, OFFICE.doorW + .07, ribMat, 0, -.92 + i * .46, 0);
      shutter.add(rib);
      ribs.push(rib);
    }
    // door warning strip
    const strip = box(.045, .045, OFFICE.doorW * .82, new THREE.MeshBasicMaterial({ color: 0x52140f, transparent: true, opacity: .8 }), 0, OFFICE.doorH + .26, 0);
    shutterGroup.add(strip);
    this.office.add(shutterGroup);

    // button panel inside the office
    const panel = new THREE.Group();
    panel.add(box(.055, .6, .34, M.dark, 0, 0, 0));
    panel.add(box(.02, .5, .26, mat({ color: 0x37342d, roughness: .4, metalness: .6 }), -.035, 0, 0));
    const b1 = box(.03, .11, .12, mat({ color: 0xa8352c, emissive: 0x320704, emissiveIntensity: .6, roughness: .3 }), -.06, .14, 0);
    const b2 = box(.03, .11, .12, mat({ color: 0xd0a04a, emissive: 0x2a1a02, emissiveIntensity: .5, roughness: .3 }), -.06, -.14, 0);
    panel.add(b1, b2);
    panel.position.set(side * (OFFICE.w - .16), 1.35, OFFICE.doorZ + 1.0);
    panel.rotation.y = -side * Math.PI / 2;
    this.office.add(panel);

    this.doors = this.doors || {};
    this.doors[key] = { shutter, shutterGroup, strip, b1, b2, ribs };

    // red exit strip above door (outside)
    const exit = plane(.44, .2, new THREE.MeshBasicMaterial({ map: exitTexture(), transparent: true, color: 0xffffff }), side * (OFFICE.w - .055), OFFICE.doorH + .44, OFFICE.doorZ);
    exit.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    this.office.add(exit);

    // corner cables and grime
    const cableMat = mat({ color: 0x12100d, roughness: .8 });
    for (let i = 0; i < 2; i++) {
      const c = cyl(.018, .018, 2.1, cableMat, 6);
      c.position.set(side * (OFFICE.w - .06), 1.35, OFFICE.doorZ + (i ? .45 : .6));
      this.office.add(c);
    }
  }

  _buildHall(side, key) {
    const M = this.M;
    const g = new THREE.Group();
    const len = 5.8, width = 2.5;
    const hallX = side * (OFFICE.w + len / 2);
    const z0 = OFFICE.doorZ;
    const floor = plane(len, width, M.floor, hallX, .002, z0, -Math.PI / 2);
    floor.receiveShadow = true;
    g.add(floor);
    const ceil = plane(len, width, M.ceiling, hallX, 2.72, z0, Math.PI / 2);
    ceil.receiveShadow = true;
    g.add(ceil);

    // hall side walls
    for (const zs of [-1, 1]) {
      const wg = new THREE.Group();
      wg.add(box(len, .88, .08, M.wains, 0, .44, 0));
      wg.add(plane(len, 1.8, M.wall, 0, .88 + .9, .045));
      wg.add(box(len, .07, .13, M.trim, 0, .9, .04));
      wg.add(box(len, .14, .1, M.trim, 0, .07, .04));
      wg.add(box(len, .06, .1, M.trim, 0, 2.68, .04));
      wg.position.set(hallX, 0, z0 + zs * width / 2);
      wg.rotation.y = zs < 0 ? 0 : Math.PI;
      g.add(wg);
    }
    // end wall + locked exit door
    const end = new THREE.Group();
    end.add(box(.1, 2.72, width, M.wall, 0, 1.36, 0));
    end.position.set(side * (OFFICE.w + len), 0, z0);
    g.add(end);
    const endDoor = box(.06, 2.0, .82, mat({ color: 0x2a2017, roughness: .55, metalness: .2 }), side * (OFFICE.w + len - .08), 1.0, z0 + .05);
    g.add(endDoor);
    g.add(box(.09, .06, .1, M.steel, side * (OFFICE.w + len - .15), 1.02, z0 + .4));
    // hall chairs / boxes
    const crate = box(.62, .52, .48, mat({ color: 0x3d2c1c, roughness: .85 }), side * (OFFICE.w + len - .9), .26, z0 - width / 2 + .42);
    crate.rotation.y = .2; shadowify(crate); g.add(crate);
    const crate2 = box(.44, .36, .4, mat({ color: 0x4a3522, roughness: .85 }), side * (OFFICE.w + len - 1.3), .18, z0 - width / 2 + .38);
    crate2.rotation.y = -.15; g.add(crate2);

    // ceiling light fixtures with glow
    const lampMat = new THREE.MeshStandardMaterial({
      map: lightPanelTexture(), emissiveMap: lightPanelTexture(), emissive: 0xfff0c0,
      emissiveIntensity: 1.4, roughness: .5, metalness: .1
    });
    const lampGroups = [];
    for (const d of [1.35, 3.7]) {
      const lx = side * (OFFICE.w + d);
      g.add(box(.86, .05, .22, M.steel, lx, 2.68, z0));
      const lamp = box(.74, .025, .16, lampMat, lx, 2.64, z0);
      g.add(lamp);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTexture(), color: 0xffd9a0, transparent: true, opacity: .34,
        blending: THREE.AdditiveBlending, depthWrite: false
      }));
      glow.scale.set(1.5, 1.5, 1);
      glow.position.set(lx, 2.58, z0);
      g.add(glow);
      const pl = new THREE.PointLight(0xffcf98, 4.2, 5.4, 2);
      pl.position.set(lx, 2.4, z0);
      g.add(pl);
      lampGroups.push({ lamp, pl, glow, base: 4.2 });
    }

    // posters along hall
    const posterData = [
      { kind: 'celebrate', d: 2.2, z: -1, s: .9 },
      { kind: 'safety', d: 4.0, z: 1, s: .75 },
      { kind: 'kids', d: 1.2, z: 1, s: .6 }
    ];
    for (const p of posterData) {
      const pm = mat({ map: posterTexture(p.kind), roughness: .92, metalness: 0 });
      const pl = plane(.52 * p.s, .68 * p.s, pm, side * (OFFICE.w + p.d), 1.58, z0 + (p.z > 0 ? width / 2 - .055 : -width / 2 + .055));
      pl.rotation.y = p.z > 0 ? Math.PI : 0;
      g.add(pl);
    }

    // puddle reflection
    const puddle = new THREE.Mesh(new THREE.CircleGeometry(.7, 24), new THREE.MeshStandardMaterial({
      color: 0x2d3b42, roughness: .06, metalness: .92, transparent: true, opacity: .62, envMapIntensity: 1.4
    }));
    puddle.rotation.x = -Math.PI / 2;
    puddle.position.set(side * (OFFICE.w + 2.3), .013, z0 + .9);
    puddle.scale.set(1.3, .55, 1);
    g.add(puddle);

    // wet floor cone
    const cone = new THREE.Mesh(new THREE.ConeGeometry(.19, .42, 14), mat({ color: 0xc2a133, roughness: .6 }));
    cone.position.set(side * (OFFICE.w + 1.8), .21, z0 + .5);
    shadowify(cone); g.add(cone);
    const coneStripe = cyl(.1, .13, .03, mat({ color: 0x1a1710, roughness: .7 }), 14);
    coneStripe.position.set(side * (OFFICE.w + 1.8), .14, z0 + .5);
    g.add(coneStripe);

    // hanging cable
    const curvePts = [];
    for (let i = 0; i < 5; i++) curvePts.push(new THREE.Vector3(side * (OFFICE.w + .4 + i * 1.2), 2.62 - Math.sin(i) * .1, z0 + .5));
    const cable = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(curvePts), 30, .016, 4, false), mat({ color: 0x15120e, roughness: .8 }));
    g.add(cable);

    // door light spotlight
    const light = new THREE.SpotLight(0xffb56a, 0, 10, Math.PI / 4.2, .6, 1.3);
    light.position.set(side * (OFFICE.w + .42), 2.5, z0);
    light.target.position.set(side * (OFFICE.w + 3.4), .2, z0);
    g.add(light, light.target);
    light.castShadow = false;

    // fake volumetric shaft
    const beam = new THREE.Mesh(
      new THREE.PlaneGeometry(1.7, 3.0),
      new THREE.MeshBasicMaterial({
        map: beamTexture(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
        depthWrite: false, side: THREE.DoubleSide, color: 0xffcf96
      })
    );
    beam.position.set(side * (OFFICE.w + 2.1), 1.3, z0);
    beam.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    g.add(beam);

    this.scene.add(g);
    this.doors[key].hall = g;
    this.doors[key].light = light;
    this.doors[key].lightTarget = light.target;
    this.doors[key].beam = beam;
    this.doors[key].lamps = lampGroups;
    this.doors[key].lampMat = lampMat;
  }

  _buildCeilingDetail() {
    const M = this.M;
    // exposed ducts and pipes
    const ductMat = mat({ color: 0x3a3833, roughness: .55, metalness: .5, envMapIntensity: .8 });
    const duct = box(4.6, .34, .46, ductMat, 0, OFFICE.h - .28, 2.4);
    duct.castShadow = true;
    this.office.add(duct);
    for (let i = 0; i < 7; i++) {
      this.office.add(box(.05, .38, .5, M.steel, -2.1 + i * .7, OFFICE.h - .28, 2.4));
    }
    const pipeMat = mat({ color: 0x4a4237, roughness: .38, metalness: .82, envMapIntensity: 1.1 });
    for (const z of [1.75, 1.6]) {
      const p = cyl(.055, .055, 5.7, pipeMat, 12);
      p.rotation.z = Math.PI / 2;
      p.position.set(0, OFFICE.h - .12, z);
      this.office.add(p);
    }
    for (let i = 0; i < 4; i++) {
      const bracket = box(.05, .18, .05, M.steel, -2.1 + i * 1.4, OFFICE.h - .17, 1.75);
      this.office.add(bracket);
    }
    // fluorescent fixture housing
    this.office.add(box(1.8, .06, .62, mat({ color: 0x2b2923, roughness: .5, metalness: .45 }), 0, OFFICE.h - .07, .35));
    const lpTex = lightPanelTexture();
    const panelMat = new THREE.MeshStandardMaterial({
      map: lpTex, emissiveMap: lpTex, emissive: 0xfff0c6, emissiveIntensity: 1.55, roughness: .45, metalness: .08
    });
    this.lightPanel = box(1.62, .04, .5, panelMat, 0, OFFICE.h - .1, .35);
    this.office.add(this.lightPanel);
    this.lightPanelMat = panelMat;
    // warning lamp over each door
    for (const side of [-1, 1]) {
      const lamp = cyl(.045, .06, .09, mat({ color: 0x5a1411, emissive: 0x3a0704, emissiveIntensity: 1, roughness: .4 }), 10);
      lamp.position.set(side * (OFFICE.w - .38), OFFICE.h - .22, OFFICE.doorZ + .65);
      this.office.add(lamp);
    }
    // hanging industrial shade over the desk
    const shade = new THREE.Mesh(new THREE.ConeGeometry(.34, .26, 24, 1, true), new THREE.MeshStandardMaterial({
      color: 0x3e3a32, roughness: .4, metalness: .55, side: THREE.DoubleSide, envMapIntensity: 1.1
    }));
    shade.position.set(.28, 2.62, .78);
    this.office.add(shade);
    const shadeBulb = sph(.075, new THREE.MeshBasicMaterial({ color: 0xffe0b0 }), 1, 1, 1, 12);
    shadeBulb.position.set(.28, 2.54, .78);
    this.office.add(shadeBulb);
    this.office.add(cyl(.012, .012, .34, M.steel, 6).translateX(.28).translateY(2.9).translateZ(.78));

    // sprinkler pipes, tiny details
    for (let i = 0; i < 8; i++) {
      this.office.add(box(.03, .03, .03, M.steel, -2.3 + i * .65, OFFICE.h - .02, -1.9));
    }
  }

  _buildLights() {
    this.officeLight = new THREE.PointLight(0xffd2a0, 5.2, 12, 1.35);
    this.officeLight.position.set(0, 2.7, .35);
    this.scene.add(this.officeLight);

    // shadow-casting key light over the desk, motivated by the hanging lamp
    this.keySpot = new THREE.SpotLight(0xffd7a8, 26, 9, 1.0, .82, 1.5);
    this.keySpot.position.set(.28, 2.78, .78);
    this.keySpot.target.position.set(0, .58, 1.35);
    this.keySpot.castShadow = true;
    this.keySpot.shadow.mapSize.set(1024, 1024);
    this.keySpot.shadow.bias = -0.002;
    this.keySpot.shadow.camera.near = .2;
    this.keySpot.shadow.camera.far = 10;
    this.scene.add(this.keySpot, this.keySpot.target);

    // hidden under-desk practical gives the front panel some shape
    this.deskFill = new THREE.PointLight(0xffa860, 1.4, 2.6, 2);
    this.deskFill.position.set(0, .45, 1.55);
    this.scene.add(this.deskFill);

    this.frontFill = new THREE.PointLight(0xffc994, 1.25, 7, 1.5);
    this.frontFill.position.set(0, 2.2, -2.0);
    this.office.add(this.frontFill);

    this.monitorLight = new THREE.PointLight(0x6fa98c, 2.2, 2.9, 2);
    this.monitorLight.position.set(1.0, 1.25, .7);
    this.office.add(this.monitorLight);

    this.redWash = new THREE.PointLight(0xa3291f, .7, 4.5, 2);
    this.redWash.position.set(0, 2.25, 2.2);
    this.office.add(this.redWash);

    this.deskLight = new THREE.PointLight(0xffc07a, 3.2, 3.4, 2);
    this.deskLight.position.set(-1.9, 1.3, .7);
    this.office.add(this.deskLight);

    this.ambient = new THREE.HemisphereLight(0x8f7c5e, 0x17110c, .2);
    this.scene.add(this.ambient);

    // subtle cool bounce from the hall doors
    this.coolFill = new THREE.PointLight(0x6b7d8a, .4, 9, 2);
    this.coolFill.position.set(0, 1.4, 3.0);
    this.scene.add(this.coolFill);
  }

  _buildDesk() {
    const M = this.M;
    const g = new THREE.Group();
    const dark = mat({ color: 0x241b13, roughness: .78 });
    const metal = mat({ color: 0x36332d, roughness: .4, metalness: .75, envMapIntensity: 1 });
    const top = box(3.95, .1, 1.32, M.desk, 0, .82, 1.45);
    top.castShadow = true; top.receiveShadow = true;
    g.add(top);
    // edge trim
    g.add(box(3.98, .035, .05, dark, 0, .87, .81));
    g.add(box(3.98, .035, .05, dark, 0, .87, 2.09));
    for (const x of [-1.76, 1.76]) for (const z of [.88, 2.02]) {
      const leg = box(.1, .8, .1, metal, x, .4, z);
      g.add(leg);
    }
    // modesty panel + drawers
    g.add(box(3.68, .66, .06, M.desk, 0, .47, 2.08));
    for (const dx of [-1.2, 0, 1.2]) {
      g.add(box(1.05, .42, .03, mat({ color: 0x3b2a1b, roughness: .6, metalness: .08 }), dx, .52, 2.12));
      g.add(box(1.08, .02, .02, dark, dx, .68, 2.14));
      g.add(box(.26, .028, .035, metal, dx, .56, 2.15));
    }
    // taped warning note
    const note = plane(.36, .28, M.paper, -.62, .95, 2.09, 0, 0, .04);
    g.add(note);

    // papers
    const p1 = plane(.44, .58, M.paper, -.58, .875, 1.26, -Math.PI / 2, 0, .16);
    const p2 = plane(.38, .5, M.paper, .3, .875, 1.78, -Math.PI / 2, 0, -.2);
    g.add(p1, p2);
    // pen
    const pen = cyl(.007, .007, .16, mat({ color: 0x1a2430, roughness: .4, metalness: .5 }), 6);
    pen.rotation.z = Math.PI / 2; pen.rotation.y = .35;
    pen.position.set(.13, .884, 1.2);
    g.add(pen);

    // keyboard
    const kb = box(.66, .04, .21, mat({ color: 0x2e2b26, roughness: .62, metalness: .15 }), .52, .88, 1.05);
    g.add(kb);
    for (let i = 0; i < 20; i++) {
      g.add(box(.026, .014, .026, mat({ color: 0x4a463e, roughness: .55 }), .24 + (i % 10) * .058, .902, .99 + Math.floor(i / 10) * .075));
    }
    const mouse = sph(.045, mat({ color: 0x2b2924, roughness: .5 }), 1, .6, 1.4, 10);
    mouse.position.set(1.0, .89, 1.08);
    g.add(mouse);

    // CRT monitor
    const mon = new THREE.Group();
    mon.position.set(1.16, .87, 1.32);
    mon.scale.setScalar(.94);
    mon.rotation.y = -.08;
    const body = box(1.02, .8, .32, mat({ color: 0x2a2824, roughness: .58, metalness: .25 }), 0, .43, 0);
    body.castShadow = true;
    mon.add(body);
    mon.add(box(.94, .7, .02, mat({ color: 0x12110f, roughness: .3, metalness: .2 }), 0, .45, .17));
    const screenTex = screenTexture('static');
    this.screenMat = new THREE.MeshStandardMaterial({
      map: screenTex, emissiveMap: screenTex, emissive: 0xffffff,
      emissiveIntensity: 1.75, roughness: .26, metalness: .05
    });
    mon.add(plane(.84, .6, this.screenMat, 0, .46, .182));
    mon.add(box(.24, .1, .22, mat({ color: 0x1c1a17, roughness: .8 }), 0, .02, 0));
    // power led
    const led = sph(.011, new THREE.MeshBasicMaterial({ color: 0x6cff94 }), 1, 1, 1, 8);
    led.position.set(.4, .08, .17); mon.add(led);
    g.add(mon);

    // desk phone
    const ph = new THREE.Group();
    ph.position.set(-.58, .88, 1.98);
    ph.add(box(.32, .13, .24, mat({ color: 0x171512, roughness: .45, metalness: .15 }), 0, .065, 0));
    ph.add(box(.36, .075, .09, mat({ color: 0x201d19, roughness: .4 }), 0, .17, 0));
    for (let i = 0; i < 9; i++) {
      ph.add(box(.035, .008, .026, mat({ color: 0x4a453d, roughness: .5 }), -.11 + (i % 3) * .045, .14, .065 - Math.floor(i / 3) * .038));
    }
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(.13, .05, -.09), new THREE.Vector3(.32, .03, -.21),
      new THREE.Vector3(.19, .02, -.34), new THREE.Vector3(-.1, .03, -.3)
    ]);
    ph.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 16, .012, 5, false), mat({ color: 0x11100e, roughness: .7 })));
    g.add(ph);

    // soda cup
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(.058, .043, .2, 16), mat({ color: 0xa43a2d, roughness: .5 }));
    cup.position.set(1.63, .97, 1.92);
    cup.castShadow = true;
    g.add(cup);
    const lid = cyl(.061, .061, .018, mat({ color: 0xd8cfbc, roughness: .55 }), 16);
    lid.position.set(1.63, 1.075, 1.92); g.add(lid);
    const straw = cyl(.009, .009, .27, mat({ color: 0xd6cfbc, roughness: .4 }), 6);
    straw.position.set(1.67, 1.13, 1.92); straw.rotation.z = .25;
    g.add(straw);

    // cupcake
    const cupcake = new THREE.Group();
    cupcake.position.set(-1.44, .87, 1.8);
    cupcake.add(cyl(.072, .052, .085, mat({ color: 0xc46a8c, roughness: .6 }), 16));
    const frosting = sph(.078, mat({ color: 0xe7c9d8, roughness: .48 }), 1, .82, 1, 16);
    frosting.position.y = .075; cupcake.add(frosting);
    const cherry = sph(.023, mat({ color: 0xa52a21, roughness: .26 }), 1, 1, 1, 10);
    cherry.position.y = .145; cupcake.add(cherry);
    const candle = cyl(.007, .007, .1, mat({ color: 0xe3d7b8, roughness: .7 }), 6);
    candle.position.y = .2; cupcake.add(candle);
    const flame = sph(.014, new THREE.MeshBasicMaterial({ color: 0xffb347 }), 1, 1.45, 1, 8);
    flame.position.y = .27; cupcake.add(flame);
    shadowify(cupcake); g.add(cupcake);
    this.flame = flame;

    // pizza box stack
    const pizzaMat = mat({ map: paperTexture(3), roughness: .9, color: 0xc9b18a });
    for (let i = 0; i < 2; i++) {
      const pb = box(.62, .065, .62, pizzaMat, -2.35 + i * .02, .875 + i * .07, 1.34);
      pb.rotation.y = -.12 + i * .05;
      pb.castShadow = true;
      g.add(pb);
    }

    // desk fan
    const fan = new THREE.Group();
    fan.position.set(-1.58, .87, 1.13);
    fan.add(cyl(.15, .19, .05, metal, 22));
    const fPole = cyl(.022, .022, .3, metal, 10); fPole.position.y = .18; fan.add(fPole);
    const cage = new THREE.Group(); cage.position.y = .46;
    const cageMat = mat({ color: 0x6a655a, roughness: .34, metalness: .85, envMapIntensity: 1.2 });
    cage.add(new THREE.Mesh(new THREE.TorusGeometry(.27, .012, 6, 40), cageMat));
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(.22, .009, 6, 36), cageMat); ring2.position.z = -.035; cage.add(ring2);
    const ring3 = new THREE.Mesh(new THREE.TorusGeometry(.1, .008, 6, 24), cageMat); ring3.position.z = -.02; cage.add(ring3);
    for (let i = 0; i < 10; i++) {
      const spoke = cyl(.004, .004, .53, cageMat, 4);
      spoke.rotation.z = i * Math.PI / 5;
      cage.add(spoke);
    }
    const bladeTex = fanTexture();
    const bladeMat = new THREE.MeshStandardMaterial({ map: bladeTex, transparent: true, alphaTest: .2, side: THREE.DoubleSide, roughness: .55, metalness: .3 });
    this.fanBlades = new THREE.Mesh(new THREE.PlaneGeometry(.52, .52), bladeMat);
    this.fanBlades.position.z = .005;
    cage.add(this.fanBlades);
    const hub = sph(.055, mat({ color: 0x2b2924, roughness: .35, metalness: .65 }), 1, 1, 1, 14);
    hub.position.z = .02; cage.add(hub);
    fan.add(cage);
    const fMotor = cyl(.075, .075, .16, metal, 16);
    fMotor.rotation.x = Math.PI / 2; fMotor.position.set(0, .46, -.1); fan.add(fMotor);
    shadowify(fan); g.add(fan);

    // desk lamp
    const lamp = new THREE.Group(); lamp.position.set(-1.98, .87, .96);
    lamp.add(cyl(.1, .13, .035, metal, 16));
    const arm = cyl(.018, .018, .5, metal, 8);
    arm.position.set(.02, .25, 0); arm.rotation.z = -.16; lamp.add(arm);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(.16, .16, 18, 1, true), mat({ color: 0x7b2a21, roughness: .45, metalness: .25, side: THREE.DoubleSide }));
    shade.position.set(.08, .5, 0); shade.rotation.z = .5; lamp.add(shade);
    const bulb = sph(.045, new THREE.MeshBasicMaterial({ color: 0xffd8a0 }), 1, 1, 1, 10);
    bulb.position.set(.1, .45, 0); lamp.add(bulb);
    g.add(lamp);

    // taped photo
    const photo = plane(.22, .28, mat({ map: posterTexture('employee'), roughness: .95 }), -2.2, .9, 1.2, -Math.PI / 2, 0, -.12);
    g.add(photo);

    // tape recorder
    const rec = box(.3, .09, .22, mat({ color: 0x1e1b17, roughness: .5, metalness: .25 }), -.16, .92, 2.0);
    rec.rotation.y = .2; g.add(rec);
    for (const dx of [-.08, .02]) {
      const reel = cyl(.038, .038, .012, mat({ color: 0x0e0d0b, roughness: .4 }), 14);
      reel.rotation.x = Math.PI / 2; reel.position.set(-.16 + dx, .97, 2.0); g.add(reel);
    }

    g.position.z = -1.05;
    this.office.add(g);
    this.desk = g;
  }

  _buildFrontWall() {
    const M = this.M;
    const g = new THREE.Group();
    g.position.set(0, 0, OFFICE.front + .06);
    // marquee-ish sign
    const sign = plane(1.8, .86, new THREE.MeshStandardMaterial({ map: signTexture(), roughness: .82, metalness: .08 }), .55, 2.06, .012);
    g.add(sign);
    // posters
    g.add(plane(.66, .9, mat({ map: posterTexture('main'), roughness: .9 }), -1.62, 1.88, .014));
    g.add(plane(.6, .82, mat({ map: posterTexture('safety'), roughness: .9 }), 2.58, 1.92, .014));
    const kids = plane(.52, .7, mat({ map: posterTexture('kids'), roughness: .94 }), -2.88, 1.6, .014);
    kids.rotation.z = .05; g.add(kids);
    // vent high on wall
    g.add(plane(.82, .54, mat({ map: ventGrilleTexture(), roughness: .6, metalness: .45 }), -2.62, .42, .014));
    // child drawings / tape
    for (let i = 0; i < 3; i++) {
      const d = plane(.18, .22, mat({ map: paperTexture(2), roughness: .96, color: 0xd7c7a2 }), .0 + i * .24, 2.72, .014);
      d.rotation.z = (i - 1) * .12;
      g.add(d);
    }
    // broken wall clock
    const clock = new THREE.Group(); clock.position.set(0, 2.62, .03);
    clock.add(new THREE.Mesh(new THREE.CircleGeometry(.21, 32), mat({ color: 0xd8cdb2, roughness: .6 })));
    clock.add(new THREE.Mesh(new THREE.TorusGeometry(.21, .02, 8, 36), mat({ color: 0x2a231a, roughness: .4, metalness: .4 })));
    const h1 = box(.014, .14, .006, mat({ color: 0x171310, roughness: .5 }), 0, .05, .008);
    h1.rotation.z = .9; clock.add(h1);
    const h2 = box(.012, .11, .006, mat({ color: 0x171310, roughness: .5 }), .03, .02, .008);
    h2.rotation.z = -2.4; clock.add(h2);
    clock.add(sph(.012, new THREE.MeshBasicMaterial({ color: 0xd33a2a }), 1, 1, 1, 8).translateZ(.01));
    g.add(clock);
    // cables
    const cableMat = mat({ color: 0x12100d, roughness: .8 });
    for (let i = 0; i < 3; i++) {
      const pts = [];
      for (let j = 0; j <= 7; j++) pts.push(new THREE.Vector3(-1.95 + j * .56, 2.93 - Math.sin(j * 1.2 + i) * .11 - i * .03, .04));
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 34, .014, 5, false), cableMat));
    }
    // wall sconce glow
    const sconce = sph(.035, new THREE.MeshBasicMaterial({ color: 0xffc47a }), 1, 1.3, 1, 8);
    sconce.position.set(1.7, 2.7, .03); g.add(sconce);
    this.office.add(g);
  }

  _buildBackWall() {
    const M = this.M;
    const g = new THREE.Group();
    g.position.set(0, 0, OFFICE.back - .06);
    g.rotation.y = Math.PI;
    // cork noticeboard
    g.add(box(1.55, 1.0, .06, mat({ color: 0x3a2b1d, roughness: .95 }), -1.0, 1.8, .012));
    g.add(plane(1.4, .86, mat({ color: 0x6b4d2f, roughness: 1 }), -1.0, 1.8, .048));
    ['kids', 'employee', 'celebrate'].forEach((k, i) => {
      const p = plane(.4, .52, mat({ map: posterTexture(k), roughness: .95 }), -1.44 + i * .44, 1.8 + (i % 2 ? .04 : -.03), .062);
      p.rotation.z = (i - 1) * .07; g.add(p);
    });
    // missing posters
    for (let i = 0; i < 3; i++) {
      const p = plane(.34, .44, mat({ map: paperTexture(2), roughness: .97, color: 0xd6c6a2 }), .3 + i * .38, 1.92 - i * .06, .052);
      p.rotation.z = (i - 1) * .08; g.add(p);
    }
    // vent
    g.add(plane(.92, .62, mat({ map: ventGrilleTexture(), roughness: .62, metalness: .45 }), 2.7, .48, .03));
    // shelf with security tapes
    g.add(box(1.4, .06, .32, mat({ color: 0x34271b, roughness: .9 }), 2.36, 1.62, .18));
    for (let i = 0; i < 7; i++) {
      const tape = box(.062, .2, .13, mat({ color: 0x1a1712, roughness: .65 }), 1.86 + i * .17, 1.75, .18);
      g.add(tape);
      g.add(box(.042, .075, .132, mat({ color: 0x8d8066, roughness: .9 }), 1.86 + i * .17, 1.77, .181));
    }
    // filing cabinet
    const cab = new THREE.Group();
    cab.position.set(2.5, .0, .55);
    const cabMat = mat({ color: 0x4a4a45, roughness: .45, metalness: .65, envMapIntensity: .9 });
    cab.add(box(.78, 1.32, .62, cabMat, 0, .66, 0));
    for (let i = 0; i < 3; i++) {
      cab.add(box(.72, .36, .02, mat({ color: 0x3b3b37, roughness: .5, metalness: .5 }), 0, .3 + i * .42, .315));
      cab.add(box(.2, .025, .04, mat({ color: 0x8b8b82, roughness: .3, metalness: .8 }), 0, .3 + i * .42, .34));
    }
    shadowify(cab); g.add(cab);
    // stack of old boxes
    const boxMat = mat({ color: 0x5a4430, roughness: .9 });
    const bx = box(.52, .38, .44, boxMat, -2.5, .2, .7); bx.rotation.y = .16; g.add(bx);
    const bx2 = box(.4, .3, .36, boxMat, -2.48, .54, .72); bx2.rotation.y = -.1; g.add(bx2);
    // wall grime streaks
    for (let i = 0; i < 5; i++) {
      const streak = plane(.09 + rand() * .16, 1.2 + rand() * .9, new THREE.MeshBasicMaterial({ color: 0x140f09, transparent: true, opacity: .14 }), -2 + i * 1.05, 1.6, .045);
      g.add(streak);
    }
    this.office.add(g);
  }

  _buildSideProps() {
    const M = this.M;
    // contact shadows ground the furniture
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .3, depthWrite: false });
    const sh = plane(4.05, 1.5, shadowMat, 0, .006, .55, -Math.PI / 2);
    this.office.add(sh);
    const sh2 = plane(5.7, .6, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .22, depthWrite: false }), 0, .005, OFFICE.front + .35, -Math.PI / 2);
    this.office.add(sh2);
    const sh3 = plane(5.7, .5, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .18, depthWrite: false }), 0, .005, OFFICE.back - .3, -Math.PI / 2);
    this.office.add(sh3);

    // wall decor on the side walls (breaks up the long blank runs)
    for (const side of [-1, 1]) {
      const x = side * (OFFICE.w - .045);
      const ry = side < 0 ? Math.PI / 2 : -Math.PI / 2;
      const zc = 1.55;
      // framed safety notice
      const frame = box(.05, .78, .58, M.trim, x, 1.72, zc);
      this.office.add(frame);
      const notice = plane(.5, .7, mat({ map: posterTexture('safety'), roughness: .9 }), x - side * .03, 1.72, zc, 0, ry);
      this.office.add(notice);
      // calendar
      const cal = plane(.34, .46, mat({ map: paperTexture(6), roughness: .96, color: 0xe1d6bb }), x - side * .028, 1.72, zc + .92, 0, ry);
      this.office.add(cal);
      this.office.add(box(.04, .06, .4, M.steel, x - side * .02, 1.98, zc + .92));
      // small security camera aimed at the desk
      const cam = new THREE.Group();
      cam.position.set(side * (OFFICE.w - .32), 2.82, 2.35);
      cam.rotation.y = side < 0 ? .8 : -.8;
      const body = box(.17, .14, .26, mat({ color: 0x1f1d1a, roughness: .4, metalness: .45 }), 0, 0, 0);
      cam.add(body);
      const lens = cyl(.055, .055, .06, mat({ color: 0x0a0908, roughness: .15, metalness: .6, envMapIntensity: 1.2 }), 14);
      lens.rotation.x = Math.PI / 2; lens.position.z = .15; cam.add(lens);
      const led = sph(.012, new THREE.MeshBasicMaterial({ color: 0xff3120 }), 1, 1, 1, 8);
      led.position.set(.06, .05, .13); cam.add(led);
      this.office.add(cam);
    }

    // coat rack silhouette in back corner
    const rack = new THREE.Group();
    rack.position.set(-2.6, 0, 3.1);
    rack.add(cyl(.03, .035, 1.85, M.steel, 8));
    for (let i = 0; i < 4; i++) {
      const arm = box(.34, .025, .025, M.steel, 0, 1.55, 0);
      arm.rotation.y = i * Math.PI / 2;
      arm.position.x = Math.cos(i * Math.PI / 2) * .16;
      arm.position.z = Math.sin(i * Math.PI / 2) * .16;
      rack.add(arm);
    }
    // hanging jacket
    const jacket = new THREE.Mesh(new THREE.CapsuleGeometry(.16, .62, 4, 10), mat({ color: 0x2b2a2a, roughness: .95 }));
    jacket.position.set(0, 1.18, 0); jacket.scale.set(1.1, 1, .6);
    rack.add(jacket);
    shadowify(rack);
    this.office.add(rack);
    // safety helmet on floor
    const helmet = sph(.16, mat({ color: 0xb7902c, roughness: .6 }), 1, .62, 1, 16);
    helmet.position.set(-2.35, .1, 2.7); this.office.add(helmet);
    // cardboard box office supplies
    const b = box(.5, .36, .42, mat({ color: 0x5d472f, roughness: .93 }), 2.5, .18, 2.9);
    b.rotation.y = -.3; this.office.add(b);
  }

  _buildDust() {
    const count = 340;
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - .5) * 8.6;
      pos[i * 3 + 1] = .12 + Math.random() * 2.8;
      pos[i * 3 + 2] = OFFICE.front + Math.random() * 7;
      vel[i] = .008 + Math.random() * .03;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({
      color: 0xffe6bd, size: .02, transparent: true, opacity: .38,
      map: glowTexture(), depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true
    });
    this.dust = new THREE.Points(geo, m);
    this.dustVel = vel;
    this.office.add(this.dust);
  }

  /* ============================================================ MENU */
  _buildMenu() {
    const M = this.M;
    const g = new THREE.Group();
    g.position.set(0, 0, -60);
    this.menuGroup = g;
    this.scene.add(g);

    const floor = plane(19, 16, M.floor, 0, -.001, 2.2, -Math.PI / 2);
    floor.receiveShadow = true; g.add(floor);
    // checkerboard inlay
    const stageMat = mat({ color: 0x1b1410, roughness: .55, metalness: .12 });
    const stage = box(12.6, .46, 4.4, stageMat, 0, .23, -.3);
    stage.receiveShadow = true; g.add(stage);
    g.add(box(12.62, .08, 4.42, mat({ color: 0x6b1c17, emissive: 0x2c0805, emissiveIntensity: .9, roughness: .5 }), 0, .49, -.3));
    // gold stage lip
    g.add(box(12.7, .035, .06, mat({ color: 0xb08a3f, roughness: .34, metalness: .75 }), 0, .52, 1.9));

    // curtain wall
    const curtainMat = new THREE.MeshStandardMaterial({ map: curtainTexture(), roughness: .92, metalness: .02 });
    const curtain = plane(15.5, 7.6, curtainMat, 0, 3.7, -7.4);
    g.add(curtain);
    // geometric curtain folds
    for (let i = 0; i < 14; i++) {
      const fold = cyl(.18, .28, 6.8, mat({ color: i % 2 ? 0x3f1014 : 0x55151a, roughness: .9 }), 8);
      fold.position.set(-7.2 + i * 1.1, 3.4, -7.28);
      fold.scale.z = .4;
      g.add(fold);
    }
    // valance
    const valMat = mat({ color: 0x5d1512, roughness: .75 });
    g.add(box(15.6, 1.0, .2, valMat, 0, 6.6, -7.2));
    for (let i = 0; i < 12; i++) {
      const swag = sph(.6, valMat, 1, .5, .3, 12);
      swag.position.set(-7.2 + i * 1.31, 6.1, -7.15);
      g.add(swag);
    }
    // side walls
    for (const s of [-1, 1]) {
      g.add(plane(15, 6.9, M.wall, s * 9.0, 3.45, .2, 0, s * Math.PI / 2));
    }
    g.add(plane(19, 16, M.ceiling, 0, 7.0, 2.2, Math.PI / 2));

    // marquee sign
    const marquee = plane(6.4, 1.6, new THREE.MeshStandardMaterial({
      map: marqueeTexture(), emissiveMap: marqueeTexture(), emissive: 0xffffff, emissiveIntensity: .72,
      roughness: .55, metalness: .05
    }), 0, 5.55, -6.9);
    g.add(marquee);
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffd28a });
    for (let i = 0; i < 22; i++) {
      const bx = -3.15 + i * .3;
      const b = sph(.035, bulbMat, 1, 1, 1, 8);
      b.position.set(bx, 6.44, -6.86); g.add(b);
      const b2 = sph(.035, bulbMat, 1, 1, 1, 8);
      b2.position.set(bx, 4.66, -6.86); g.add(b2);
    }
    // spotlights
    const spot = new THREE.SpotLight(0xffd9a6, 120, 32, .42, .55, 1.25);
    spot.position.set(0, 6.3, 5.4);
    spot.target.position.set(0, 1.55, -1.4);
    spot.castShadow = true;
    spot.shadow.mapSize.set(1024, 1024);
    spot.shadow.bias = -0.0012;
    g.add(spot, spot.target);
    const spot2 = new THREE.SpotLight(0xff9a5a, 55, 26, .34, .6, 1.4);
    spot2.position.set(-4.2, 5.6, 4.2);
    spot2.target.position.set(-3.2, 1.4, -1.4);
    g.add(spot2, spot2.target);
    const spot3 = new THREE.SpotLight(0x8fa6d0, 45, 26, .34, .6, 1.4);
    spot3.position.set(4.2, 5.6, 4.2);
    spot3.target.position.set(3.2, 1.4, -1.4);
    g.add(spot3, spot3.target);
    const red = new THREE.PointLight(0xa32a1c, 11, 18, 2);
    red.position.set(-5.4, 2.2, -1.8); g.add(red);
    const red2 = new THREE.PointLight(0x7a2418, 9, 16, 2);
    red2.position.set(5.6, 2.0, -2.6); g.add(red2);
    const rim = new THREE.PointLight(0x5b6e8d, 4, 13, 2);
    rim.position.set(0, 3.4, -5.8); g.add(rim);
    const frontFill = new THREE.PointLight(0xffd2a0, 16, 15, 1.7);
    frontFill.position.set(0, 3.0, 3.8); g.add(frontFill);
    g.add(new THREE.HemisphereLight(0x6b5b43, 0x080604, .16));

    // stage props: table + balloons at foreground
    const table = new THREE.Group();
    table.position.set(-5.6, 0, 2.6);
    table.add(cyl(.06, .06, .72, M.steel, 8));
    const ttop = cyl(.7, .7, .05, mat({ color: 0x7a2a22, roughness: .6 }), 24);
    ttop.position.y = .74; table.add(ttop);
    for (let i = 0; i < 3; i++) {
      const hat = new THREE.Mesh(new THREE.ConeGeometry(.11, .2, 4), mat({ color: [0xd3ac54, 0xc04436, 0x5c7f66][i], roughness: .7 }));
      hat.position.set(-.2 + i * .2, .82, 0); hat.rotation.z = (i - 1) * .16; table.add(hat);
    }
    shadowify(table); g.add(table);
    for (let i = 0; i < 6; i++) {
      const balloon = sph(.18, mat({ color: [0xb84437, 0xd3ac54, 0x6e8a6e][i % 3], roughness: .5 }), 1, 1.2, 1, 14);
      balloon.position.set(-7 + i * .42, 2.5 + (i % 3) * .35, 3.4 + (i % 2) * .4);
      g.add(balloon);
      const string = cyl(.004, .004, 1.4, mat({ color: 0x2a2520, roughness: .8 }), 4);
      string.position.set(balloon.position.x, balloon.position.y - .8, balloon.position.z);
      g.add(string);
    }

    // title stage animatronics
    this.menuChars = {};
    const specs = [
      { type: 'bonnie', x: -3.5, z: -1.75, rot: .18, scale: 1.0, props: true },
      { type: 'chica', x: 3.5, z: -1.75, rot: -.18, scale: 1.0, props: true },
      { type: 'freddy', x: 0, z: -.45, rot: 0, scale: 1.03, props: true }
    ];
    for (const sp of specs) {
      const a = makeAnimatronic(sp.type, false, sp.props);
      a.group.position.set(sp.x, .47, sp.z);
      a.group.rotation.y = sp.rot;
      a.group.scale.setScalar(sp.scale);
      a.group.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      a.eyeMat.emissiveIntensity = 2.2;
      a.seed = sp.x * .3;
      g.add(a.group);
      this.menuChars[sp.type] = a;
    }
    // foxy peeking behind the curtain
    const foxy = makeAnimatronic('foxy', false, false);
    foxy.group.position.set(-6.3, 1.4, -6.2);
    foxy.group.rotation.y = .6;
    foxy.group.scale.setScalar(.9);
    foxy.group.traverse(o => { if (o.isMesh) o.castShadow = true; });
    foxy.group.visible = false;
    this.menuFoxy = foxy;
    g.add(foxy.group);

    // floating haze / dust
    const geo = new THREE.BufferGeometry();
    const n = 220, arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = (Math.random() - .5) * 17; arr[i * 3 + 1] = Math.random() * 6; arr[i * 3 + 2] = -6 + Math.random() * 13; }
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    g.add(new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xffdcaa, size: .03, map: glowTexture(), transparent: true, opacity: .34,
      depthWrite: false, blending: THREE.AdditiveBlending
    })));
    for (let i = 0; i < 4; i++) {
      const haze = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTexture(), color: 0xffc68a, transparent: true, opacity: .05,
        blending: THREE.AdditiveBlending, depthWrite: false
      }));
      haze.scale.set(8, 4, 1);
      haze.position.set(-4 + i * 3, 3.2, -3.5);
      g.add(haze);
    }
    // string lights
    for (let i = 0; i < 16; i++) {
      const bulb = sph(.035, new THREE.MeshBasicMaterial({ color: i % 3 ? 0xffc47a : 0xff6d4a }), 1, 1, 1, 8);
      bulb.position.set(-7.2 + i * .96, 6.1 - Math.sin(i * .6) * .35, -5.2);
      g.add(bulb);
    }
  }

  /* ============================================================ CHARACTERS */
  createOfficeCharacter(type, x, z, rot, scale = 1) {
    const a = makeAnimatronic(type);
    a.group.position.set(x, 0, z);
    a.group.rotation.y = rot;
    a.group.scale.setScalar(scale);
    a.group.visible = false;
    a.group.traverse(o => { if (o.isMesh) { o.castShadow = false; } });
    this.office.add(a.group);
    return a;
  }

  ensureOfficeCharacters() {
    if (this._officeChars) return;
    this._officeChars = {
      bonnie: this.createOfficeCharacter('bonnie', -4.35, OFFICE.doorZ, Math.PI / 2, 1.02),
      chica: this.createOfficeCharacter('chica', 4.35, OFFICE.doorZ, -Math.PI / 2, 1.0),
      freddy: this.createOfficeCharacter('freddy', 5.75, OFFICE.doorZ, -Math.PI / 2, 1.04),
      foxy: this.createOfficeCharacter('foxy', -8.2, OFFICE.doorZ, Math.PI / 2, 1.02),
      puppet: this.createOfficeCharacter('puppet', 4.65, OFFICE.doorZ, -Math.PI / 2, 1.06)
    };
    for (const k in this._officeChars) {
      const c = this._officeChars[k];
      c.eyeMat.emissiveIntensity = k === 'puppet' ? 2.4 : 1.6;
      c.seed = k.length * 1.7;
    }
  }

  setCornerCharacter(side, type) {
    this.ensureOfficeCharacters();
    this.cornerPresence[side] = type;
    const left = this.cornerPresence.left;
    const right = this.cornerPresence.right;
    const visible = new Set([left, right].filter(Boolean));
    for (const k in this._officeChars) {
      if (k === 'foxy') continue;
      this._officeChars[k].group.visible = visible.has(k);
    }
    // if a side is empty but the other has a character, ensure the other stays visible
    if (!left && right === 'bonnie') this._officeChars.bonnie.group.visible = false;
    if (!right && left === 'chica') this._officeChars.chica.group.visible = false;
  }

  setFoxyRunning(active, prog = 0) {
    this.ensureOfficeCharacters();
    const f = this._officeChars.foxy;
    f.group.visible = active;
    if (active) {
      f.group.position.x = -8.3 + prog * 4.7;
      f.group.position.z = OFFICE.doorZ;
      f.group.position.y = Math.abs(Math.sin(prog * 26)) * .05;
      f.head.rotation.y = 0;
      f.arms[0].rotation.x = Math.sin(prog * 26) * .7;
      f.arms[1].rotation.x = -Math.sin(prog * 26) * .7;
    }
  }

  hideAllCharacters() {
    if (!this._officeChars) return;
    for (const k in this._officeChars) {
      this._officeChars[k].group.visible = false;
      this._officeChars[k].group.position.y = 0;
    }
    this.cornerPresence = { left: null, right: null };
  }

  /* ============================================================ SCARES */
  _buildScares() {
    this.scareGroup = new THREE.Group();
    this.scareGroup.position.set(0, -.05, 0);
    this.scareGroup.visible = false;
    this.camera.add(this.scareGroup);
    this.scareModels = {};
    for (const t of ['freddy', 'bonnie', 'chica', 'foxy', 'puppet']) {
      const a = makeAnimatronic(t, true);
      a.group.scale.setScalar(.9);
      a.group.position.set(0, 0, -1.6);
      a.group.visible = false;
      a.group.traverse(o => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
      this.scareGroup.add(a.group);
      this.scareModels[t] = a;
    }
    const scL = new THREE.PointLight(0xff5a3c, 0, 4.2, 2);
    scL.position.set(0, .9, -.5);
    this.scareGroup.add(scL);
    this.scareLight = scL;
  }

  playJumpscare(type) {
    const model = this.scareModels[type] || this.scareModels.freddy;
    for (const k in this.scareModels) this.scareModels[k].group.visible = false;
    model.group.visible = true;
    model.eyeMat.emissiveIntensity = 4;
    if (model.jaw) model.jaw.rotation.x = .42;
    this.scareGroup.visible = true;
    this.scareLight.intensity = 16;
    this.scare = { t: 0, dur: 1.55, model, type };
    this.setFX({ damage: 1, aberration: 1.7, grain: .07, dark: .92, exposure: .92 });
    this.postfx.flash(.5);
    this.flash = 1;
  }
  stopJumpscare() {
    this.scare = null;
    this.scareGroup.visible = false;
    this.scareLight.intensity = 0;
    if (this.scareModels) {
      for (const k in this.scareModels) {
        this.scareModels[k].group.visible = false;
        if (this.scareModels[k].jaw) this.scareModels[k].jaw.rotation.x = 0;
      }
    }
    this.setFX({ damage: 0, aberration: .16, grain: .026, exposure: 1.0 });
  }

  /* ============================================================ MODES */
  setMode(mode) {
    this.mode = mode;
    this.office.visible = mode === 'office';
    this.menuGroup.visible = mode === 'menu';
    this.lookEnabled = mode === 'office';
    if (mode === 'office') {
      this.camera.position.copy(this.cameraBase);
      this.yaw = this.targetYaw = 0; this.pitch = this.targetPitch = -.06;
      this.officeLight.intensity = 5.2;
      this.keySpot.intensity = 26;
      this.deskFill.intensity = 1.4;
      this.ambient.intensity = .2;
      this.setFX({ exposure: 1.0, bloom: .4, vignette: .72, grain: .026, aberration: .16, damage: 0, desat: 0, dark: 1 });
    } else {
      this.setFX({ exposure: 1.0, bloom: .45, vignette: .74, grain: .03, aberration: .1, damage: 0, desat: 0, dark: 1 });
    }
  }

  setPower(p) { this.powerLevel = Math.max(0, Math.min(1, p)); }
  setDoor(side, closed) { this.doorTarget[side] = closed ? 1 : 0; }
  setLight(side, on) { this.lightTarget[side] = on ? 1 : 0; }
  isDoorClosed(side) { return this.door[side] > .92; }
  addFlicker(v) { this.flicker = Math.max(this.flicker, v); }

  blackout() {
    this.officeLight.intensity = 0;
    this.keySpot.intensity = 0;
    this.deskFill.intensity = 0;
    this.deskLight.intensity = 0;
    this.monitorLight.intensity = 0;
    this.ambient.intensity = .03;
    this.redWash.intensity = .015;
    this.coolFill.intensity = .1;
    if (this.lightPanelMat) this.lightPanelMat.emissiveIntensity = 0;
    this.setDoor('left', false); this.setDoor('right', false);
    this.setLight('left', false); this.setLight('right', false);
    this.doorTarget.left = 0; this.doorTarget.right = 0;
    this.blackedOut = true;
    this.setFX({ dark: .2, desat: .4, exposure: .82, bloom: .26, grain: .055, aberration: .5 });
  }
  unblackout() {
    this.blackedOut = false;
    this.officeLight.intensity = 9;
    this.deskLight.intensity = 2.8;
    this.monitorLight.intensity = 1.9;
    this.ambient.intensity = .2;
    this.redWash.intensity = .7;
    this.coolFill.intensity = .4;
    if (this.lightPanelMat) this.lightPanelMat.emissiveIntensity = 1.35;
    this.setFX({ dark: 1, desat: 0, exposure: 1.0, bloom: .4, grain: .026, aberration: .16 });
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
    if (this.menuFoxy) this.menuFoxy.group.visible = false;
  }

  cheer(seconds = 2.4) { this._cheer = 1; this._cheerTime = seconds; }

  /* ============================================================ UPDATE */
  update(dt) {
    this.time += dt;
    const t = this.time;

    if (this.office.visible) {
      if (this.lookEnabled) {
        this.yaw += (this.targetYaw - this.yaw) * Math.min(1, dt * 11);
        this.pitch += (this.targetPitch - this.pitch) * Math.min(1, dt * 11);
        const breath = Math.sin(t * 1.35) * .004 + Math.sin(t * .51) * .007;
        this.camera.position.set(
          this.cameraBase.x + Math.sin(t * .35) * .014 - this.yaw * .008,
          this.cameraBase.y + breath,
          this.cameraBase.z
        );
        this.camera.rotation.set(
          this.pitch + Math.sin(t * .68) * .0018,
          this.yaw + Math.sin(t * .21) * .0009,
          Math.sin(t * .31) * .0022
        );
      } else {
        this.camera.rotation.set(this.pitch, this.yaw, 0);
      }

      const low = 1 - this.powerLevel;
      // doors + lights
      for (const side of ['left', 'right']) {
        const target = this.doorTarget[side];
        if (this.door[side] !== target) {
          const step = dt * 5.4;
          this.door[side] += Math.sign(target - this.door[side]) * step;
          this.door[side] = Math.max(0, Math.min(1, this.door[side]));
        }
        const d = this.doors[side];
        const closed = this.door[side];
        d.shutter.position.y = OFFICE.doorH / 2 + 2.55 - closed * 2.55;
        d.strip.material.color.setHex(closed > .08 ? 0xff3b26 : 0x52140f);
        d.strip.material.opacity = closed > .08 ? .95 : .5;
        d.b1.material.emissive.setHex(closed > .5 ? 0x8a2018 : 0x320704);
        d.b1.material.emissiveIntensity = closed > .5 ? 1.4 : .5;
        d.b2.material.emissiveIntensity = this.lightTarget[side] ? 1.2 : .4;

        this.light[side] += (this.lightTarget[side] - this.light[side]) * Math.min(1, dt * 8.5);
        const jitter = this.lightTarget[side] ? .92 + Math.random() * .16 : 0;
        d.light.intensity = this.light[side] * (this.blackedOut ? 0 : 13) * jitter;
        d.beam.material.opacity = this.light[side] * .26 * (this.blackedOut ? 0 : 1) * jitter;
        // hall lamps flicker harder as power drops
        const flick = (!this.blackedOut && Math.random() > .985) ? .25 : 1;
        for (const lg of d.lamps) {
          lg.pl.intensity = lg.base * (this.blackedOut ? 0 : (1 - low * .55)) * flick;
          lg.glow.material.opacity = (this.blackedOut ? 0 : .16 + .2 * this.light[side]) * flick;
        }
        d.lampMat.emissiveIntensity = this.blackedOut ? 0 : 1.4 * (1 - low * .55) * flick;
      }

      // office light flicker
      const powerDip = this.powerLevel < .22 ? (1 - this.powerLevel) * .55 : 0;
      const f = this.flicker + (Math.random() < .0035 ? .3 + Math.random() * .4 : 0) + powerDip * (Math.random() < .05 ? .4 : 0);
      this.flicker = Math.max(0, this.flicker - dt * 3.1);
      if (!this.blackedOut) {
        const dim = 1 - Math.min(.82, f);
        this.officeLight.intensity = 5.2 * dim + Math.sin(t * 2.6) * .07;
        this.keySpot.intensity = 26 * dim;
        this.deskFill.intensity = 1.4 * (1 - f * .5);
        this.lightPanelMat.emissiveIntensity = 1.25 * dim;
        this.deskLight.intensity = 3.3 * (1 - f * .65);
        this.frontFill.intensity = 1.25 * dim;
        this.monitorLight.intensity = 1.9 * (1 + Math.sin(t * 2.7) * .04);
        this.officeLight.position.x = Math.sin(t * 1.05) * .06;
        this.coolFill.intensity = .4 * dim;
      }
      if (this.screenMat) {
        this.screenMat.emissiveIntensity = 1.45 + Math.random() * .3 + Math.sin(t * 9) * .05;
      }
      if (this.fanBlades) this.fanBlades.rotation.z -= dt * (this.blackedOut ? 1.1 : 18);
      if (this.flame) {
        this.flame.position.y = .27 + Math.sin(t * 7) * .004;
        this.flame.scale.set(1 + Math.sin(t * 11) * .16, 1.45 + Math.sin(t * 9) * .2, 1);
      }
      if (this.dust) {
        const p = this.dust.geometry.attributes.position;
        for (let i = 0; i < p.count; i++) {
          p.array[i * 3 + 1] += this.dustVel[i] * dt;
          p.array[i * 3] += Math.sin(t * .6 + i) * dt * .012;
          if (p.array[i * 3 + 1] > 2.95) p.array[i * 3 + 1] = .08;
        }
        p.needsUpdate = true;
      }

      // idle characters (office doorway presences)
      if (this._officeChars) {
        for (const k in this._officeChars) {
          const c = this._officeChars[k];
          if (!c.group.visible) continue;
          const s = c.seed || 0;
          if (k === 'foxy') continue;
          c.group.position.y = Math.sin(t * 1.05 + s) * .012;
          c.group.rotation.z = Math.sin(t * .62 + s) * .006;
          c.head.rotation.y = Math.sin(t * .42 + s) * .07;
          c.head.rotation.x = .02 + Math.sin(t * .8 + s) * .02;
          if (c.jaw) c.jaw.rotation.x = .03 + Math.max(0, Math.sin(t * .55 + s)) * .05;
          if (c.lids) {
            const b = ((t * .31 + s * .37) % 1);
            const blink = b < .035 ? Math.sin((b / .035) * Math.PI) : 0;
            for (const lid of c.lids) lid.position.y = lid.userData.baseY - blink * .055;
          }
          c.eyeMat.emissiveIntensity = (k === 'puppet' ? 2.2 : 1.35) + Math.sin(t * 1.9 + s) * .45;
        }
      }

      // jumpscare
      if (this.scare) {
        const s = this.scare;
        s.t += dt;
        const k = Math.min(1, s.t / s.dur);
        const z = -1.6 + k * 1.12;
        const shake = (1 - k) * .06 + .009;
        const sc = .9 + k * .36;
        s.model.group.scale.setScalar(sc);
        s.model.group.position.set(
          (Math.random() - .5) * shake,
          .18 - 1.55 * sc + (Math.random() - .5) * shake,
          z
        );
        s.model.group.rotation.z = Math.sin(s.t * 54) * .08 * (1 - k * .3);
        s.model.group.rotation.y = Math.sin(s.t * 33) * .08;
        s.model.head.rotation.x = .1 + Math.sin(s.t * 46) * .09;
        if (s.model.jaw) s.model.jaw.rotation.x = .5 + Math.sin(s.t * 39) * .18;
        s.model.eyeMat.emissiveIntensity = 4 + Math.random() * 2;
        this.scareLight.intensity = 8 + Math.random() * 8;
        this.scareLight.position.set((Math.random() - .5) * .7, .75, -.5);
        this.officeLight.intensity *= .1;
        this.keySpot.intensity *= .06;
        this.deskFill.intensity *= .1;
        this.deskLight.intensity *= .15;
        this.monitorLight.intensity *= .08;
        this.redWash.intensity = .03;
        this.ambient.intensity = .04;
        this.lightPanelMat.emissiveIntensity *= .06;
        this.setFX({ damage: .55 + Math.random() * .35, aberration: 1.2 + Math.random() * .8, exposure: .86 });
      }

      // victory bloom
      if (this._cheer > 0) {
        this._cheer = Math.max(0, this._cheer - dt * .2);
        this.officeLight.intensity = Math.max(this.officeLight.intensity, 5.2 + this._cheer * 34);
        this.lightPanelMat.emissiveIntensity = Math.max(this.lightPanelMat.emissiveIntensity, 1.25 + this._cheer * 7);
        this.ambient.intensity = .2 + this._cheer * 1.5;
      }

      // dynamic grade based on power
      if (!this.scare) {
        const lowN = Math.max(0, 1 - this.powerLevel);
        this.setFX({
          desat: this.blackedOut ? .4 : lowN * .32,
          aberration: this.blackedOut ? .5 : .16 + lowN * .45,
          bloom: this.blackedOut ? .26 : .4 - lowN * .12,
          exposure: this.blackedOut ? .82 : 1.0 - lowN * .12,
          grain: this.blackedOut ? .055 : .026 + lowN * .02,
          dark: this.blackedOut ? .2 : 1
        });
      }
    } else if (this.menuGroup.visible) {
      const mx = (this.menuPointer?.x || 0), my = (this.menuPointer?.y || 0);
      const sway = Math.sin(t * .16) * .55;
      this.menuCamera.position.x = sway + mx * .5;
      this.menuCamera.position.y = 2.5 + Math.sin(t * .24) * .05 + my * .17;
      this.menuCamera.position.z = -55.1 + Math.sin(t * .11) * .18;
      this.menuCamera.lookAt(sway * .24, 1.45 + my * .07, -60.9);
      this.menuCamera.rotation.z = Math.sin(t * .11) * .004;

      let i = 0;
      for (const k in (this.menuChars || {})) {
        const c = this.menuChars[k];
        animateCharacter(c, t, { baseY: .47, speed: .85, seed: c.seed || i });
        i++;
      }
      // foxy peeks through the curtain every ~12s
      if (this.menuFoxy) {
        const cycle = (t % 14) / 14;
        const peek = cycle > .42 && cycle < .62;
        this.menuFoxy.group.visible = peek;
        if (peek) {
          const k = (cycle - .42) / .2;
          this.menuFoxy.group.position.y = 1.35 + Math.sin(k * Math.PI) * .22;
          this.menuFoxy.head.rotation.y = -.35 + Math.sin(k * Math.PI) * .25;
          this.menuFoxy.eyeMat.emissiveIntensity = 2.4;
        }
      }
      this.setFX({
        exposure: 1.0 + Math.sin(t * .3) * .008,
        bloom: .45,
        vignette: .74,
        grain: .03,
        aberration: .1,
        damage: 0, desat: 0, dark: 1
      });
    }

    this.postfx.render(this.scene, this.mode === 'menu' ? this.menuCamera : this.camera, dt);
  }
}

/* ============================================================== builder */
const SUIT_CACHE = new Map();
function suitAssets(hex, rough = .72) {
  const key = hex + ':' + rough;
  if (SUIT_CACHE.has(key)) return SUIT_CACHE.get(key);
  const map = suitTexture(hex);
  const normal = normalFrom(map, 1.15, map.repeat);
  const set = {
    main: new THREE.MeshStandardMaterial({ map, normalMap: normal, roughness: rough, metalness: .04, envMapIntensity: .5 }),
    rough: new THREE.MeshStandardMaterial({ map, normalMap: normal, roughness: .9, metalness: .02, envMapIntensity: .35 })
  };
  SUIT_CACHE.set(key, set);
  return set;
}

export function makeAnimatronic(type, scare = false, props = false) {
  const g = new THREE.Group();
  const palettes = {
    freddy: { main: 0x5a3a20, dark: 0x35200f, muzzle: 0xa87c4e, accent: 0x8f2b2a, eye: 0xdfe8ff },
    bonnie: { main: 0x4a3a78, dark: 0x2a2148, muzzle: 0x8d7cb0, accent: 0x8f2b2a, eye: 0xe8d8ff },
    chica: { main: 0xcaa73f, dark: 0x8d7124, muzzle: 0xe0a83a, accent: 0x8f2b2a, eye: 0xd8c6ff },
    foxy: { main: 0x8c3323, dark: 0x542015, muzzle: 0xb26743, accent: 0x1c1712, eye: 0xffcf6a },
    puppet: { main: 0x171219, dark: 0x09070b, muzzle: 0xe9e2d6, accent: 0x5a2476, eye: 0xffffff }
  };
  const p = palettes[type] || palettes.freddy;
  const suit = suitAssets(p.main, type === 'puppet' ? .55 : .74);
  const mainMat = suit.main;
  const darkMat = suitAssets(p.dark, .84).main;
  const muzzleMat = suitAssets(p.muzzle, .66).main;
  const accentMat = new THREE.MeshStandardMaterial({ color: p.accent, roughness: .58, metalness: .12, envMapIntensity: .6 });
  const blackMat = new THREE.MeshStandardMaterial({ color: 0x0b0806, roughness: .62, metalness: .2 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x8f8b80, roughness: .28, metalness: .92, envMapIntensity: 1.4 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x080605, emissive: p.eye, emissiveIntensity: 1.6, roughness: .2, metalness: .1 });
  const pupilMat = new THREE.MeshStandardMaterial({ color: 0x050403, roughness: .18, metalness: .1 });
  const scleraMat = new THREE.MeshStandardMaterial({ color: type === 'puppet' ? 0x090709 : 0xb9ad93, roughness: .35 });

  const arms = [];
  const lids = [];
  const group = g;

  if (type === 'puppet') {
    // slender marionette build
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.2, .5, 5, 16), mainMat);
    torso.position.y = 1.22; torso.scale.set(1.12, 1, .78);
    g.add(torso);
    const ribcage = new THREE.Mesh(new THREE.CapsuleGeometry(.15, .3, 4, 12), darkMat);
    ribcage.position.set(0, 1.2, .08); ribcage.scale.set(1.2, 1, .6);
    g.add(ribcage);
    for (const s of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(s * .3, 1.5, 0);
      const up = new THREE.Mesh(new THREE.CapsuleGeometry(.055, .36, 4, 10), mainMat);
      up.position.y = -.2; arm.add(up);
      const elbow = new THREE.Mesh(new THREE.SphereGeometry(.06, 10, 8), darkMat);
      elbow.position.y = -.42; arm.add(elbow);
      const fore = new THREE.Mesh(new THREE.CapsuleGeometry(.048, .34, 4, 10), mainMat);
      fore.position.y = -.63; fore.rotation.x = -.08; arm.add(fore);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(.07, 10, 8), muzzleMat);
      hand.scale.set(1, 1.15, .8); hand.position.y = -.85; arm.add(hand);
      for (let f = 0; f < 3; f++) {
        const finger = new THREE.Mesh(new THREE.CapsuleGeometry(.016, .13, 3, 6), muzzleMat);
        finger.position.set((f - 1) * .032, -.96, .02); finger.rotation.x = -.15; arm.add(finger);
      }
      g.add(arm); arms.push(arm);
    }
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(.07, .44, 4, 10), darkMat);
      leg.position.set(s * .13, .48, 0); g.add(leg);
      const foot = new THREE.Mesh(new THREE.SphereGeometry(.085, 10, 8), muzzleMat);
      foot.scale.set(1, .55, 1.5); foot.position.set(s * .13, .12, .05); g.add(foot);
    }
    // white mask head
    const head = new THREE.Group();
    head.position.y = 1.8;
    g.add(head);
    const mask = new THREE.Mesh(new THREE.SphereGeometry(.25, 24, 18), muzzleMat);
    mask.scale.set(.98, 1.12, .72);
    head.add(mask);
    // black eye sockets + tear streaks
    for (const s of [-1, 1]) {
      const socket = new THREE.Mesh(new THREE.SphereGeometry(.062, 14, 12), blackMat);
      socket.scale.set(1, 1.25, .55); socket.position.set(s * .085, .035, .18);
      head.add(socket);
      const iris = new THREE.Mesh(new THREE.SphereGeometry(.021, 10, 8), eyeMat);
      iris.position.set(s * .085, .035, .225); head.add(iris);
      const tear = box(.018, .14 + Math.random() * .04, .012, new THREE.MeshStandardMaterial({ color: 0x5a2476, roughness: .6 }), s * .085, -.09, .205);
      tear.rotation.z = s * .08; head.add(tear);
      const cheek = new THREE.Mesh(new THREE.CircleGeometry(.035, 12), new THREE.MeshBasicMaterial({ color: 0xb02a3a }));
      cheek.position.set(s * .13, -.055, .212); head.add(cheek);
    }
    // thin smile
    const smile = new THREE.Mesh(new THREE.TorusGeometry(.08, .012, 5, 18, Math.PI), blackMat);
    smile.position.set(0, -.12, .205); smile.rotation.z = Math.PI; head.add(smile);
    // small black bow / ruffle
    const ruffle = new THREE.Mesh(new THREE.ConeGeometry(.09, .06, 6), accentMat);
    ruffle.position.set(0, 1.48, .19); ruffle.rotation.x = Math.PI / 2; ruffle.scale.z = .5; g.add(ruffle);
    g.traverse(o => { if (o.isMesh) { o.castShadow = !scare; o.receiveShadow = false; } });
    return { group, head, jaw: null, lids, eyeMat, type, arms, seed: 0 };
  }

  // torso
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.32, .44, 6, 20), mainMat);
  torso.position.y = 1.15; torso.scale.set(1.16, 1, .84);
  torso.castShadow = !scare;
  g.add(torso);
  // belly plate
  const belly = new THREE.Mesh(new THREE.SphereGeometry(.27, 22, 16), muzzleMat);
  belly.scale.set(1, 1.32, .56); belly.position.set(0, 1.1, .205);
  g.add(belly);
  // chest seam
  const seam = new THREE.Mesh(new THREE.TorusGeometry(.3, .008, 4, 26), darkMat);
  seam.position.set(0, 1.35, .18); seam.rotation.x = Math.PI / 2; seam.scale.set(1.1, .7, 1);
  g.add(seam);
  // buttons
  for (const y of [1.21, 1.06]) {
    const btn = new THREE.Mesh(new THREE.SphereGeometry(.038, 10, 8), blackMat);
    btn.position.set(0, y, .335); btn.scale.set(1, 1, .6); g.add(btn);
  }
  // bow tie
  if (type !== 'foxy') {
    for (const s of [-1, 1]) {
      const bw = new THREE.Mesh(new THREE.ConeGeometry(.08, .11, 3), accentMat);
      bw.position.set(s * .08, 1.44, .28); bw.rotation.z = s * Math.PI / 2; bw.rotation.x = Math.PI / 2;
      g.add(bw);
    }
    const knot = new THREE.Mesh(new THREE.SphereGeometry(.036, 10, 8), accentMat);
    knot.position.set(0, 1.44, .295); g.add(knot);
  }

  // arms
  for (const s of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(s * .42, 1.48, 0);
    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(.135, 14, 12), mainMat);
    shoulder.scale.set(.9, .9, .9); arm.add(shoulder);
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(.108, .28, 5, 14), mainMat);
    upper.position.y = -.2; arm.add(upper);
    const elbow = new THREE.Mesh(new THREE.SphereGeometry(.1, 12, 10), darkMat);
    elbow.position.y = -.4; arm.add(elbow);
    const fore = new THREE.Mesh(new THREE.CapsuleGeometry(.092, .26, 5, 14), mainMat);
    fore.position.set(0, -.58, .035); fore.rotation.x = -.12; arm.add(fore);
    const wrist = new THREE.Mesh(new THREE.SphereGeometry(.075, 10, 8), metalMat);
    wrist.scale.set(.9, .7, .9); wrist.position.set(0, -.73, .06); arm.add(wrist);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(.105, 12, 10), mainMat);
    hand.scale.set(1, 1.1, .78); hand.position.set(0, -.83, .08); arm.add(hand);
    for (let f = 0; f < 3; f++) {
      const finger = new THREE.Mesh(new THREE.CapsuleGeometry(.024, .12, 3, 8), mainMat);
      finger.position.set((f - 1) * .048, -.95, .11);
      finger.rotation.x = -.18;
      arm.add(finger);
    }
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(.026, .09, 3, 8), mainMat);
    thumb.position.set(s * -.075, -.88, .11); thumb.rotation.z = s * .7; arm.add(thumb);
    if (type === 'foxy' && s > 0) {
      const hook = new THREE.Mesh(new THREE.TorusGeometry(.075, .02, 6, 16, Math.PI * 1.45), metalMat);
      hook.position.set(0, -.96, .1); hook.rotation.z = .55; hook.rotation.y = .4;
      arm.add(hook);
    }
    g.add(arm); arms.push(arm);
  }

  // legs
  for (const s of [-1, 1]) {
    const hip = new THREE.Mesh(new THREE.SphereGeometry(.14, 12, 10), darkMat);
    hip.position.set(s * .16, .62, 0); g.add(hip);
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(.13, .26, 4, 12), mainMat);
    thigh.position.set(s * .16, .47, 0); g.add(thigh);
    const knee = new THREE.Mesh(new THREE.SphereGeometry(.115, 12, 10), darkMat);
    knee.position.set(s * .16, .29, .01); g.add(knee);
    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(.105, .24, 4, 12), darkMat);
    shin.position.set(s * .16, .16, 0); g.add(shin);
    const foot = new THREE.Mesh(new THREE.SphereGeometry(.135, 14, 10), mainMat);
    foot.scale.set(1, .56, 1.45); foot.position.set(s * .16, .085, .08);
    g.add(foot);
    const sole = new THREE.Mesh(new THREE.BoxGeometry(.2, .035, .3), blackMat);
    sole.position.set(s * .16, .035, .08); g.add(sole);
  }

  // head
  const head = new THREE.Group();
  head.position.y = 1.8;
  g.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(.285, 26, 20), mainMat);
  skull.scale.set(1.02, 1, .94);
  head.add(skull);
  // muzzle
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(.168, 20, 16), muzzleMat);
  muzzle.scale.set(1.15, .82, 1.14);
  muzzle.position.set(0, -.075, .205);
  head.add(muzzle);
  if (type === 'foxy') {
    muzzle.scale.set(.9, .62, 1.55); muzzle.position.set(0, -.09, .27);
  }
  // nose / beak
  if (type === 'chica') {
    const beak = new THREE.Mesh(new THREE.ConeGeometry(.11, .17, 4), new THREE.MeshStandardMaterial({ color: 0xe08a2a, roughness: .5, metalness: .05 }));
    beak.rotation.x = Math.PI / 2; beak.rotation.y = Math.PI / 4;
    beak.position.set(0, -.075, .3); head.add(beak);
  } else {
    const nose = new THREE.Mesh(new THREE.SphereGeometry(.056, 12, 10), new THREE.MeshStandardMaterial({ color: 0x16110c, roughness: .4, metalness: .1 }));
    nose.scale.set(1.3, .8, 1); nose.position.set(0, -.015, .37);
    head.add(nose);
  }
  // mouth cavity
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(.105, 16, 12), new THREE.MeshStandardMaterial({ color: 0x090505, roughness: .9 }));
  mouth.scale.set(1.52, .5, .36); mouth.position.set(0, -.15, .305);
  head.add(mouth);
  // upper teeth
  const toothMat = new THREE.MeshStandardMaterial({ color: 0xdcd4bb, roughness: .32, metalness: .05 });
  for (let i = -2; i <= 2; i++) {
    const tth = box(.03, .05, .016, toothMat, i * .038, -.18, .367);
    head.add(tth);
  }
  // jaw
  const jaw = new THREE.Group();
  jaw.position.set(0, -.16, .1);
  head.add(jaw);
  const chin = new THREE.Mesh(new THREE.SphereGeometry(.15, 16, 12), muzzleMat);
  chin.scale.set(1.2, .43, 1.0); chin.position.set(0, -.055, .17);
  jaw.add(chin);
  if (type === 'chica') {
    const lowerBeak = new THREE.Mesh(new THREE.ConeGeometry(.09, .13, 4), new THREE.MeshStandardMaterial({ color: 0xd0741d, roughness: .55 }));
    lowerBeak.rotation.x = Math.PI / 2; lowerBeak.rotation.y = Math.PI / 4;
    lowerBeak.position.set(0, -.06, .28); jaw.add(lowerBeak);
  }
  for (let i = -2; i <= 2; i++) {
    const tth = box(.028, .042, .014, toothMat, i * .036, -.015, .265);
    tth.rotation.z = i * .03;
    jaw.add(tth);
  }

  // eyes
  for (const s of [-1, 1]) {
    const socket = new THREE.Mesh(new THREE.SphereGeometry(scare ? .06 : .067, 16, 12), scleraMat);
    socket.scale.set(1, 1, .72);
    socket.position.set(s * .108, .055, .205);
    head.add(socket);
    const iris = new THREE.Mesh(new THREE.SphereGeometry(scare ? .027 : .031, 12, 10), eyeMat);
    iris.position.set(s * .108, .05, .245);
    head.add(iris);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(scare ? .012 : .014, 10, 8), pupilMat);
    pupil.position.set(s * .108, .05, .262);
    head.add(pupil);
    if (!scare) {
      const glow = new THREE.Mesh(new THREE.SphereGeometry(.008, 8, 6), new THREE.MeshBasicMaterial({ color: p.eye }));
      glow.position.set(s * .108, .05, .272);
      head.add(glow);
      // upper eyelid
      const lid = new THREE.Mesh(new THREE.SphereGeometry(.069, 14, 10, 0, Math.PI * 2, 0, Math.PI * .55), mainMat);
      lid.scale.set(1.03, .72, 1.0);
      lid.position.set(s * .108, .085, .207);
      lid.userData.baseY = .085;
      head.add(lid);
      lids.push(lid);
    }
    // brow ridge
    const brow = box(.14, .028, .045, darkMat, s * .108, .135, .22);
    brow.rotation.z = s * -.24;
    head.add(brow);
  }

  // ears / hats / tufts
  if (type === 'freddy') {
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(.095, 14, 12), mainMat);
      ear.scale.set(1, 1, .55); ear.position.set(s * .21, .23, -.02); head.add(ear);
      const inner = new THREE.Mesh(new THREE.SphereGeometry(.052, 10, 8), muzzleMat);
      inner.scale.set(1, 1, .4); inner.position.set(s * .215, .235, .032); head.add(inner);
    }
    const hat = new THREE.Group();
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(.225, .225, .026, 28), new THREE.MeshStandardMaterial({ color: 0x0f0e0d, roughness: .58, metalness: .05 }));
    const top = new THREE.Mesh(new THREE.CylinderGeometry(.14, .155, .3, 28), new THREE.MeshStandardMaterial({ color: 0x11100f, roughness: .58 }));
    top.position.y = .15;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(.157, .157, .048, 28), new THREE.MeshStandardMaterial({ color: 0x7a231c, roughness: .55 }));
    band.position.y = .035;
    hat.add(brim, top, band);
    hat.position.set(0, .26, -.01); hat.rotation.z = .04;
    head.add(hat);
  } else if (type === 'bonnie') {
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.CapsuleGeometry(.068, .32, 5, 12), mainMat);
      ear.position.set(s * .135, .35, -.015); ear.rotation.z = s * .12; head.add(ear);
      const inner = new THREE.Mesh(new THREE.CapsuleGeometry(.034, .22, 4, 10), muzzleMat);
      inner.position.set(s * .135, .35, .028); inner.rotation.z = s * .12; head.add(inner);
    }
  } else if (type === 'chica') {
    const tuft = new THREE.Mesh(new THREE.ConeGeometry(.075, .26, 5), mainMat);
    tuft.position.set(0, .36, 0); head.add(tuft);
    for (const s of [-1, 1]) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(.048, .18, 4), mainMat);
      f.position.set(s * .085, .32, 0); f.rotation.z = s * .38; head.add(f);
    }
    // bib
    const bib = new THREE.Mesh(new THREE.CircleGeometry(.21, 22), new THREE.MeshStandardMaterial({ color: 0xe8e0ca, roughness: .88 }));
    bib.position.set(0, 1.34, .285); bib.scale.set(1.1, .9, 1); bib.rotation.x = -.12;
    g.add(bib);
    const bibTrim = new THREE.Mesh(new THREE.TorusGeometry(.205, .012, 4, 24), accentMat);
    bibTrim.position.set(0, 1.34, .3); bibTrim.rotation.x = -.12; bibTrim.scale.set(1.1, .9, 1); g.add(bibTrim);
  } else if (type === 'foxy') {
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(.078, .22, 4), mainMat);
      ear.position.set(s * .17, .26, .015); ear.rotation.z = s * .2; head.add(ear);
    }
    const patch = new THREE.Mesh(new THREE.CircleGeometry(.078, 16), new THREE.MeshStandardMaterial({ color: 0x0c0a08, roughness: .8 }));
    patch.position.set(-.108, .055, .276); head.add(patch);
    const strap = new THREE.Mesh(new THREE.TorusGeometry(.29, .011, 5, 30, Math.PI), new THREE.MeshStandardMaterial({ color: 0x0c0a08, roughness: .8 }));
    strap.position.y = .1; strap.rotation.x = .1; head.add(strap);
  }

  // extra scare detail: exposed jaw hinge and extra teeth
  if (scare) {
    for (let i = -3; i <= 3; i++) {
      const tth = box(.028, .05, .014, toothMat, i * .03, -.21, .33);
      tth.rotation.z = i * .05; head.add(tth);
    }
    for (const s of [-1, 1]) {
      const hinge = new THREE.Mesh(new THREE.CylinderGeometry(.028, .028, .07, 10), metalMat);
      hinge.rotation.z = Math.PI / 2; hinge.position.set(s * .17, -.15, .04); head.add(hinge);
    }
  }

  if (props) addCharacterProps(type, g, arms, muzzleMat, accentMat, blackMat);

  g.traverse(o => { if (o.isMesh) { o.castShadow = !scare; o.receiveShadow = false; } });
  return { group, head, jaw, lids, eyeMat, type, arms, seed: 0 };
}

function addCharacterProps(type, g, arms, muzzleMat, accentMat, blackMat) {
  if (type === 'freddy') {
    const arm = arms[1];
    const mic = new THREE.Group();
    mic.position.set(0, -.9, .12);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(.028, .036, .22, 10), new THREE.MeshStandardMaterial({ color: 0x1b1917, roughness: .35, metalness: .5 }));
    mic.add(handle);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(.075, 14, 10), new THREE.MeshStandardMaterial({ color: 0x6f6b60, roughness: .25, metalness: .85, envMapIntensity: 1.3 }));
    ball.position.y = .15; mic.add(ball);
    mic.rotation.x = -.4;
    arm.add(mic);
  } else if (type === 'bonnie') {
    const guitar = new THREE.Group();
    guitar.position.set(.5, .95, .3);
    guitar.rotation.set(.15, -.35, -.9);
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(.24, .28, 5, 12), new THREE.MeshStandardMaterial({ color: 0x8f2622, roughness: .45, metalness: .15 }));
    body.scale.set(1, 1.1, .32); guitar.add(body);
    const neck = new THREE.Mesh(new THREE.BoxGeometry(.07, .95, .05), new THREE.MeshStandardMaterial({ color: 0x2a1c12, roughness: .6 }));
    neck.position.y = .55; guitar.add(neck);
    const headstock = new THREE.Mesh(new THREE.BoxGeometry(.13, .18, .06), new THREE.MeshStandardMaterial({ color: 0x1a1210, roughness: .5 }));
    headstock.position.y = 1.06; guitar.add(headstock);
    for (let i = 0; i < 4; i++) {
      const str = new THREE.Mesh(new THREE.BoxGeometry(.003, 1.2, .003), new THREE.MeshBasicMaterial({ color: 0xd8d2c0 }));
      str.position.set(-.02 + i * .013, .35, .03); guitar.add(str);
    }
    g.add(guitar);
  } else if (type === 'chica') {
    const cup = new THREE.Group();
    cup.position.set(-.78, .95, .2);
    const wrap = new THREE.Mesh(new THREE.CylinderGeometry(.07, .05, .085, 14), new THREE.MeshStandardMaterial({ color: 0xc46a8c, roughness: .6 }));
    wrap.position.y = .04; cup.add(wrap);
    const frost = new THREE.Mesh(new THREE.SphereGeometry(.075, 14, 10), new THREE.MeshStandardMaterial({ color: 0xe7c9d8, roughness: .45 }));
    frost.scale.y = .8; frost.position.y = .11; cup.add(frost);
    const cherry = new THREE.Mesh(new THREE.SphereGeometry(.022, 10, 8), new THREE.MeshStandardMaterial({ color: 0xa52a21, roughness: .26 }));
    cherry.position.y = .18; cup.add(cherry);
    g.add(cup);
  }
}

export function animateCharacter(c, t, opts = {}) {
  const baseY = opts.baseY ?? 0;
  const speed = opts.speed ?? 1;
  const seed = opts.seed ?? c.seed ?? 0;
  c.group.position.y = baseY + Math.sin(t * .9 * speed + seed) * .012;
  c.group.rotation.z = Math.sin(t * .48 * speed + seed) * .007;
  if (c.head) {
    c.head.rotation.y = Math.sin(t * .37 * speed + seed) * .085;
    c.head.rotation.x = .012 + Math.sin(t * .61 * speed + seed) * .026;
  }
  if (c.jaw) c.jaw.rotation.x = .03 + Math.max(0, Math.sin(t * .52 * speed + seed)) * .055;
  if (c.arms) {
    c.arms[0].rotation.x = Math.sin(t * .55 * speed + seed) * .06;
    c.arms[1].rotation.x = -Math.sin(t * .55 * speed + seed) * .06;
    c.arms[0].rotation.z = .03 + Math.sin(t * .33 + seed) * .02;
    c.arms[1].rotation.z = -.03 - Math.sin(t * .33 + seed) * .02;
  }
  if (c.lids) {
    const ph = ((t * .28 * speed + seed * .41) % 1);
    const blink = ph < .045 ? Math.sin((ph / .045) * Math.PI) : 0;
    for (const lid of c.lids) lid.position.y = lid.userData.baseY - blink * .058;
  }
  c.eyeMat.emissiveIntensity = 1.55 + Math.sin(t * 1.7 + seed) * .5;
}
