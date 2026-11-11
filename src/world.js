import * as THREE from '../vendor/three.module.min.js';
import {
  wallTexture, wainscotTexture, ceilingTexture, floorTexture, posterTexture,
  metalTexture, deskTexture, screenTexture, paperTexture, fanTexture, signTexture,
  ventTexture, suitTexture, lightPanelTexture, exitTexture, finish, rand, resetSeed
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
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050403);
    this.scene.fog = new THREE.FogExp2(0x060504, 0.047);
    this.camera = new THREE.PerspectiveCamera(67, window.innerWidth / window.innerHeight, 0.06, 60);
    this.camera.rotation.order = 'YXZ';
    this.camera.position.set(0, EYE_Y, 2.75);
    this.scene.add(this.camera);
    this.cameraBase = new THREE.Vector3(0, EYE_Y, 2.75);
    this.menuCamera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.05, 80);
    this.menuCamera.position.set(0, 2.55, -55.4);
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

    // materials
    const wall = new THREE.MeshStandardMaterial({ map: wallTexture(), roughness: .93 });
    const wains = new THREE.MeshStandardMaterial({ map: wainscotTexture(), roughness: .85 });
    const ceil = new THREE.MeshStandardMaterial({ map: ceilingTexture(), roughness: 1 });
    const floorM = new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: .42, metalness: .14 });
    const trim = mat({ color: 0x2a2118, roughness: .7 });
    const metal = new THREE.MeshStandardMaterial({ map: metalTexture(), roughness: .55, metalness: .55 });

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

    // door frames + shutters + hall
    for (const side of [-1, 1]) {
      const key = side < 0 ? 'left' : 'right';
      // frame
      const frameM = mat({ color: 0x3a3126, roughness: .5, metalness: .5 });
      const frame = new THREE.Group();
      frame.add(box(.13, OFFICE.doorH + .08, .12, frameM, 0, OFFICE.doorH / 2, -OFFICE.doorW / 2 - .05));
      frame.add(box(.13, OFFICE.doorH + .08, .12, frameM, 0, OFFICE.doorH / 2, OFFICE.doorW / 2 + .05));
      frame.add(box(.13, .14, OFFICE.doorW + .22, frameM, 0, OFFICE.doorH + .04, 0));
      frame.position.set(side * OFFICE.w, 0, OFFICE.doorZ);
      frame.rotation.y = side * Math.PI / 2;
      this.office.add(frame);

      // shutter — slides in Y
      const shutter = box(.1, OFFICE.doorH + .06, OFFICE.doorW + .04, metal, 0, OFFICE.doorH / 2, 0);
      shutter.castShadow = true; shutter.receiveShadow = true;
      const sg = new THREE.Group();
      sg.position.set(side * OFFICE.w, 0, OFFICE.doorZ);
      sg.rotation.y = side * Math.PI / 2;
      sg.add(shutter);
      shutter.position.y = OFFICE.doorH / 2 + 2.4;
      this.office.add(sg);
      // warning light strip above door
      const strip = box(.05, .035, OFFICE.doorW * .8, new THREE.MeshBasicMaterial({ color: 0x52140f, transparent: true, opacity: .9 }), 0, OFFICE.doorH + .13, 0);
      sg.add(strip);

      // button panel (visual only)
      const panel = new THREE.Group();
      const pm = mat({ color: 0x2b2823, roughness: .6, metalness: .3 });
      panel.add(box(.05, .54, .3, pm, 0, 0, 0));
      const b1 = box(.03, .1, .11, mat({ color: 0xa8352c, emissive: 0x320704, emissiveIntensity: .5, roughness: .4 }), -.03, .11, 0);
      const b2 = box(.03, .1, .11, mat({ color: 0xd0a04a, emissive: 0x2a1a02, emissiveIntensity: .4, roughness: .4 }), -.03, -.11, 0);
      panel.add(b1, b2);
      panel.position.set(side * (OFFICE.w - .17), 1.34, OFFICE.doorZ + .92);
      panel.rotation.y = -side * Math.PI / 2;
      this.office.add(panel);
      this.doors = this.doors || {};
      this.doors[key] = { shutter, group: sg, strip, b1, b2 };

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
    for (const d of [1.3, 3.6]) {
      const lamp = box(.7, .04, .16, lampMat, side * (OFFICE.w + d), 2.56, OFFICE.doorZ);
      g.add(lamp);
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

    // door light source
    const light = new THREE.SpotLight(0xffb56a, 0, 9, Math.PI / 4.5, .55, 1.5);
    light.position.set(side * (OFFICE.w + .35), 2.45, OFFICE.doorZ);
    light.target.position.set(side * (OFFICE.w + 3.4), .3, OFFICE.doorZ);
    this.scene.add(light, light.target);
    light.castShadow = false;
    this.doors[key].light = light;
    this.doors[key].lightTarget = light.target;

    // fake volumetric cone
    const coneGeo = new THREE.ConeGeometry(1.5, 3.4, 18, 1, true);
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0xffb060, transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide, depthWrite: false
    });
    const vol = new THREE.Mesh(coneGeo, coneMat);
    vol.position.set(side * (OFFICE.w + 1.9), 1.8, OFFICE.doorZ);
    vol.rotation.z = side * Math.PI / 2;
    vol.rotation.x = 0;
    // orient cone to point along hall (from ceiling to floor): rotate so tip up
    vol.rotation.set(0, 0, side < 0 ? Math.PI / 2 : -Math.PI / 2);
    vol.position.set(side * (OFFICE.w + 1.7), 1.55, OFFICE.doorZ);
    g.add(vol);
    this.doors[key].volume = vol;
    this.doors[key].volumeBase = coneMat;
  }

  _buildLights() {
    this.officeLight = new THREE.PointLight(0xffd2a0, 8.5, 13, 1.25);
    this.officeLight.position.set(0, 2.66, .3);
    this.officeLight.castShadow = true;
    this.officeLight.shadow.mapSize.set(1024, 1024);
    this.officeLight.shadow.bias = -0.0018;
    this.officeLight.shadow.camera.near = .2;
    this.officeLight.shadow.camera.far = 14;
    this.scene.add(this.officeLight);

    // soft fill that keeps the wall art readable without flattening the room
    this.frontFill = new THREE.PointLight(0xffc994, 2.2, 7.5, 1.5);
    this.frontFill.position.set(0, 2.15, -1.75);
    this.office.add(this.frontFill);

    // fluorescent panel
    const lpTex = lightPanelTexture();
    const panelMat = new THREE.MeshStandardMaterial({
      map: lpTex, emissiveMap: lpTex, emissive: 0xfff0c6, emissiveIntensity: 1.25, roughness: .5, metalness: .1
    });
    this.lightPanel = box(1.55, .035, .5, panelMat, 0, OFFICE.h - .035, .2);
    this.office.add(this.lightPanel);
    this.office.add(box(1.68, .03, .62, mat({ color: 0x24211c, roughness: .6, metalness: .4 }), 0, OFFICE.h - .01, .2));
    // warm glow strip on the ceiling around the panel
    this.office.add(box(1.9, .012, .84, new THREE.MeshBasicMaterial({ color: 0x3b2c1a }), 0, OFFICE.h - .008, .2));

    // desk monitor glow
    this.monitorLight = new THREE.PointLight(0x6fa98c, 1.6, 2.6, 2);
    this.monitorLight.position.set(1.05, 1.22, .45);
    this.office.add(this.monitorLight);

    // red door warning wash
    this.redWash = new THREE.PointLight(0xa3291f, .6, 4, 2);
    this.redWash.position.set(0, 2.2, 2.0);
    this.office.add(this.redWash);

    // desk lamp glow
    this.deskLight = new THREE.PointLight(0xffc07a, 2.6, 3.1, 2);
    this.deskLight.position.set(-1.9, 1.25, .55);
    this.office.add(this.deskLight);
  }

  _buildDesk() {
    const g = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ map: deskTexture(), roughness: .55, metalness: .05 });
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
    const count = 260;
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
      color: 0xffe6bd, size: .014, transparent: true, opacity: .42,
      depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true
    });
    this.dust = new THREE.Points(geo, m);
    this.dustVel = vel;
    this.office.add(this.dust);
  }

  /* ============================================================ MENU */
  _buildMenu() {
    const g = new THREE.Group();
    g.position.set(0, 0, -60);
    this.menuGroup = g;
    this.scene.add(g);

    const floorM = new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: .3, metalness: .2 });
    const floor = plane(17, 15, floorM, 0, -0.001, 2.2, -Math.PI / 2);
    floor.receiveShadow = true; g.add(floor);

    // back curtain wall (behind the band)
    const curtainTex = this._menuCurtain();
    const curtain = plane(14, 7, new THREE.MeshStandardMaterial({ map: curtainTex, roughness: .95 }), 0, 3.5, -7.2);
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
      const w = plane(14, 6.6, new THREE.MeshStandardMaterial({ map: wallTexture(), roughness: .95 }), s * 8.5, 3.3, .0, 0, s * Math.PI / 2);
      g.add(w);
    }
    g.add(plane(17, 15, new THREE.MeshStandardMaterial({ map: ceilingTexture(), roughness: 1 }), 0, 6.6, 2.2, Math.PI / 2));
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
    this._officeChars = {
      bonnie: this.createOfficeCharacter('bonnie', -3.95, OFFICE.doorZ, Math.PI / 2, 1.02),
      chica: this.createOfficeCharacter('chica', 3.95, OFFICE.doorZ, -Math.PI / 2, 1),
      freddy: this.createOfficeCharacter('freddy', 5.45, OFFICE.doorZ, -Math.PI / 2, 1.04),
      foxy: this.createOfficeCharacter('foxy', -6.9, OFFICE.doorZ, Math.PI / 2, 1.02)
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
      f.group.position.x = -7.2 + prog * 3.2;
      f.group.position.z = OFFICE.doorZ;
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
        d.b1.material.emissive.setHex(closed > .5 ? 0x8a2018 : 0x320704);
        d.b1.material.emissiveIntensity = closed > .5 ? 1.1 : .4;

        // lights
        const lt = this.lightTarget[side];
        this.light[side] += (lt - this.light[side]) * Math.min(1, dt * 9);
        d.light.intensity = this.light[side] * (this.blackedOut ? 0 : 12);
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
          c.eyeMat.emissiveIntensity = 1.5 + Math.sin(t * 1.7 + i) * .45;
          i++;
        }
      }
      // stage red pulse
      if (this.menuGroup.children[0]) { /* noop */ }
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
  const p = palettes[type];
  const mainMat = mat({ map: suitTexture(p.main), color: 0xffffff, roughness: .78, metalness: .03 });
  const darkMat = mat({ map: suitTexture(p.dark), color: 0xffffff, roughness: .84 });
  const muzzleMat = mat({ map: suitTexture(p.muzzle), color: 0xffffff, roughness: .72 });
  const accentMat = mat({ color: p.accent, roughness: .65 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x0a0806, emissive: p.eye, emissiveIntensity: 1.4, roughness: .25 });
  const eyeGlowMat = new THREE.MeshBasicMaterial({ color: p.eye });

  // torso
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.31, .52, 6, 18), mainMat);
  torso.position.y = 1.06; torso.scale.set(1.12, 1, .82);
  g.add(torso);
  // belly plate
  const belly = new THREE.Mesh(new THREE.SphereGeometry(.27, 20, 14), muzzleMat);
  belly.scale.set(1, 1.25, .55);
  belly.position.set(0, 1.02, .19);
  g.add(belly);
  // shoulders / arms
  const arms = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(s * .37, 1.42, 0);
    const up = new THREE.Mesh(new THREE.CapsuleGeometry(.105, .36, 5, 12), mainMat);
    up.position.y = -.19; arm.add(up);
    const fore = new THREE.Mesh(new THREE.CapsuleGeometry(.092, .3, 5, 12), mainMat);
    fore.position.set(0, -.5, .04); fore.rotation.x = -.16; arm.add(fore);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(.1, 12, 10), darkMat);
    hand.position.set(0, -.7, .1); arm.add(hand);
    if (type === 'foxy' && s > 0) {
      const hook = new THREE.Mesh(new THREE.TorusGeometry(.07, .018, 6, 16, Math.PI * 1.4), mat({ color: 0x9b988c, roughness: .3, metalness: .9 }));
      hook.position.set(0, -.74, .12); hook.rotation.z = .7; arm.add(hook);
    }
    g.add(arm); arms.push(arm);
  }
  // legs
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(.115, .42, 5, 12), darkMat);
    leg.position.set(s * .15, .42, 0);
    g.add(leg);
    const foot = new THREE.Mesh(new THREE.SphereGeometry(.14, 12, 10), mainMat);
    foot.scale.set(1, .6, 1.4); foot.position.set(s * .15, .13, .08);
    g.add(foot);
  }
  // bow tie
  if (type !== 'foxy') {
    for (const s of [-1, 1]) {
      const bw = new THREE.Mesh(new THREE.ConeGeometry(.075, .1, 3), accentMat);
      bw.position.set(s * .075, 1.38, .23); bw.rotation.z = s * Math.PI / 2; bw.rotation.x = Math.PI / 2;
      g.add(bw);
    }
    const knot = new THREE.Mesh(new THREE.SphereGeometry(.035, 8, 6), accentMat);
    knot.position.set(0, 1.38, .245); g.add(knot);
  }

  // head group
  const head = new THREE.Group();
  head.position.y = 1.72;
  g.add(head);

  const skull = new THREE.Mesh(new THREE.SphereGeometry(.27, 24, 18), mainMat);
  skull.scale.set(1.04, .98, .92);
  head.add(skull);
  // muzzle
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(.16, 18, 14), muzzleMat);
  muzzle.scale.set(1.15, .8, 1.15);
  muzzle.position.set(0, -.08, .2);
  head.add(muzzle);
  // snout for foxy
  if (type === 'foxy') {
    muzzle.scale.set(.95, .62, 1.6); muzzle.position.set(0, -.1, .26);
  }
  // eyes
  for (const s of [-1, 1]) {
    const socket = new THREE.Mesh(
      new THREE.SphereGeometry(scare ? .052 : .064, 14, 12),
      mat({ color: scare ? 0x211b14 : 0xbdb198, roughness: .35 })
    );
    socket.position.set(s * .105, .055, .2);
    socket.scale.set(1, 1, .7);
    head.add(socket);
    const iris = new THREE.Mesh(new THREE.SphereGeometry(scare ? .021 : .031, 12, 10), eyeMat);
    iris.position.set(s * .105, .05, scare ? .248 : .25);
    head.add(iris);
    if (!scare) {
      const glow = new THREE.Mesh(new THREE.SphereGeometry(.013, 8, 6), eyeGlowMat);
      glow.position.set(s * .105, .05, .268);
      head.add(glow);
    }
  }
  // nose / beak
  if (type === 'chica') {
    const beak = new THREE.Mesh(new THREE.ConeGeometry(.105, .16, 4), mat({ color: 0xe08a2a, roughness: .55 }));
    beak.rotation.x = Math.PI / 2; beak.rotation.y = Math.PI / 4;
    beak.position.set(0, -.08, .29);
    head.add(beak);
  } else {
    const nose = new THREE.Mesh(new THREE.SphereGeometry(.055, 10, 8), mat({ color: 0x16110c, roughness: .45 }));
    nose.scale.set(1.25, .8, 1); nose.position.set(0, -.02, .36);
    head.add(nose);
  }
  // teeth
  const toothMat = mat({ color: 0xded6bd, roughness: .35 });
  for (let i = -2; i <= 2; i++) {
    const tth = box(.028, .046, .014, toothMat, i * .036, -.115, .352);
    if (type === 'chica') tth.position.set(i * .032, -.135, .33);
    head.add(tth);
  }
  // mouth cavity (all variants — makes the smile read as a jaw, not a sticker)
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(.105, 14, 10), mat({ color: 0x0a0605, roughness: .92 }));
  mouth.scale.set(1.5, scare ? 1 : .55, .35);
  mouth.position.set(0, scare ? -.13 : -.122, scare ? .29 : .315);
  head.add(mouth);

  if (scare) {
    // gaping mouth cavity and extra teeth
    const cavity = new THREE.Mesh(new THREE.SphereGeometry(.12, 16, 12), mat({ color: 0x0a0605, roughness: .9 }));
    cavity.scale.set(1.25, .95, .55);
    cavity.position.set(0, -.13, .29);
    head.add(cavity);
    for (let i = -3; i <= 3; i++) {
      const tth = box(.03, .055, .015, toothMat, i * .032, -.055, .374);
      tth.rotation.z = i * .06;
      head.add(tth);
      const low = box(.026, .045, .013, toothMat, i * .033, -.205, .35);
      low.rotation.z = -i * .05;
      head.add(low);
    }
    // heavy brow
    for (const s of [-1, 1]) {
      const brow = box(.15, .035, .05, darkMat, s * .105, .125, .235);
      brow.rotation.z = s * -.3;
      head.add(brow);
    }
  }

  // ears / hat
  if (type === 'freddy') {
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(.095, 14, 12), mainMat);
      ear.scale.set(1, 1, .55); ear.position.set(s * .2, .22, -.02);
      head.add(ear);
      const inner = new THREE.Mesh(new THREE.SphereGeometry(.052, 10, 8), muzzleMat);
      inner.scale.set(1, 1, .4); inner.position.set(s * .21, .23, .03);
      head.add(inner);
    }
    const hat = new THREE.Group();
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(.21, .21, .025, 24), mat({ color: 0x121010, roughness: .6 }));
    const top = new THREE.Mesh(new THREE.CylinderGeometry(.135, .15, .28, 24), mat({ color: 0x121010, roughness: .6 }));
    top.position.y = .14;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(.152, .152, .045, 24), mat({ color: 0x6e1f18, roughness: .6 }));
    band.position.y = .03;
    hat.add(brim, top, band); hat.position.set(0, .26, 0); hat.rotation.z = .04;
    head.add(hat);
  } else if (type === 'bonnie') {
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.CapsuleGeometry(.065, .3, 5, 12), mainMat);
      ear.position.set(s * .13, .35, -.02); ear.rotation.z = s * .12;
      head.add(ear);
      const inner = new THREE.Mesh(new THREE.CapsuleGeometry(.032, .2, 4, 8), muzzleMat);
      inner.position.set(s * .13, .35, .025); inner.rotation.z = s * .12;
      head.add(inner);
    }
  } else if (type === 'chica') {
    const tuft = new THREE.Mesh(new THREE.ConeGeometry(.07, .24, 5), mainMat);
    tuft.position.set(0, .34, 0); head.add(tuft);
    for (const s of [-1, 1]) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(.045, .16, 4), mainMat);
      f.position.set(s * .08, .31, 0); f.rotation.z = s * .35; head.add(f);
    }
  } else if (type === 'foxy') {
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(.075, .2, 4), mainMat);
      ear.position.set(s * .17, .25, .02); ear.rotation.z = s * .2;
      head.add(ear);
    }
    const patch = new THREE.Mesh(new THREE.CircleGeometry(.075, 14), mat({ color: 0x0d0b09, roughness: .8 }));
    patch.position.set(-.105, .05, .272); head.add(patch);
    const band = new THREE.Mesh(new THREE.TorusGeometry(.29, .012, 5, 30, Math.PI), mat({ color: 0x0d0b09, roughness: .8 }));
    band.rotation.z = 0; band.position.y = .1; band.rotation.x = .1; head.add(band);
  }
  // Chica bib
  if (type === 'chica') {
    const bib = new THREE.Mesh(new THREE.CircleGeometry(.2, 20), mat({ color: 0xece4d0, roughness: .9 }));
    bib.position.set(0, 1.3, .255); bib.scale.set(1.15, .9, 1); bib.rotation.x = -.12;
    g.add(bib);
  }

  // slight hunch
  head.rotation.x = .02;
  g.traverse(o => { if (o.isMesh) { o.castShadow = !scare; o.receiveShadow = false; } });

  return { group: g, head, eyeMat, type };
}
