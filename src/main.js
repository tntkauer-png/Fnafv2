import * as THREE from 'three';
import './style.css';

const $ = (id) => document.getElementById(id);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#090d10');
scene.fog = new THREE.FogExp2('#090d10', 0.018);
const renderer = new THREE.WebGLRenderer({ canvas: $('scene'), antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const officeCamera = new THREE.PerspectiveCamera(54, innerWidth / innerHeight, 0.1, 120);
const camera = officeCamera;
officeCamera.position.set(0, 2.05, 9.3);
officeCamera.lookAt(0, 1.65, -1.9);
scene.add(new THREE.HemisphereLight('#bbc1c6', '#1b1715', 0.48));
const ambient = new THREE.AmbientLight('#92a4b2', 0.26); scene.add(ambient);
const mainLamp = new THREE.PointLight('#ffd4a2', 28, 23, 1.7); mainLamp.position.set(0, 3.35, 2.5); scene.add(mainLamp);
const redEmergency = new THREE.PointLight('#c54a37', 12, 12, 2); redEmergency.position.set(-5.4, 2.9, -1.4); scene.add(redEmergency);

const mat = (color, roughness = 0.78, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const mats = {
  wall: mat('#343436'), trim: mat('#615546'), dark: mat('#13191b', .82), floor: mat('#30302c', .86),
  rust: mat('#a95231', .48, .4), gold: mat('#d2974e', .42, .55), blue: mat('#426d75', .5, .42),
  ivory: mat('#d6cbb2', .73), black: mat('#171a19', .45, .35), red: new THREE.MeshStandardMaterial({ color: '#fc7850', emissive: '#fc3a19', emissiveIntensity: 2.5 }),
  green: new THREE.MeshStandardMaterial({ color: '#9ac78b', emissive: '#62a860', emissiveIntensity: 1.3 }),
  screen: new THREE.MeshStandardMaterial({ color: '#71918a', emissive: '#3d6c5a', emissiveIntensity: .65, roughness: .4 }),
};
function box(parent, name, size, position, material, options = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.name = name; mesh.position.set(...position); mesh.castShadow = options.castShadow !== false; mesh.receiveShadow = options.receiveShadow !== false;
  if (options.rotation) mesh.rotation.set(...options.rotation);
  parent.add(mesh); return mesh;
}
function sphere(parent, size, position, material, segments = 20) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(size, segments, Math.max(10, Math.floor(segments * .65))), material);
  mesh.position.set(...position); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function cylinder(parent, radiusTop, radiusBottom, height, position, material, segments = 16, rotation) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), material);
  mesh.position.set(...position); if (rotation) mesh.rotation.set(...rotation); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function makeCanvasTexture(draw, width = 512, height = 512) {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d'); draw(context, width, height);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4; return texture;
}
const tileTexture = makeCanvasTexture((c, w, h) => {
  c.fillStyle = '#34332e'; c.fillRect(0, 0, w, h);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    c.fillStyle = (x + y) % 2 ? '#373630' : '#414039'; c.fillRect(x * w / 8 + 1, y * h / 8 + 1, w / 8 - 2, h / 8 - 2);
    c.fillStyle = '#827965'; c.globalAlpha = .15; c.fillRect(x * w / 8 + 2, y * h / 8 + 2, 1, h / 8 - 4); c.globalAlpha = 1;
  }
  c.globalAlpha = .15; for (let i=0;i<800;i++){c.fillStyle=i%2?'#b9a789':'#171817';c.fillRect(Math.random()*w,Math.random()*h,1+Math.random()*4,1)} c.globalAlpha=1;
});
const floorMaterial = new THREE.MeshStandardMaterial({ map: tileTexture, color: '#c4b8a0', roughness: .8 });
function floor(parent, width, depth, position = [0, 0, 0], material = floorMaterial) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), material);
  mesh.rotation.x = -Math.PI / 2; mesh.position.set(...position); mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function labelTexture(title, subtitle, color = '#d69462') {
  return makeCanvasTexture((c, w, h) => {
    c.fillStyle = '#151817'; c.fillRect(0,0,w,h); c.strokeStyle = color; c.lineWidth=7; c.strokeRect(12,12,w-24,h-24);
    c.fillStyle=color; c.font='bold 43px sans-serif'; c.textAlign='center'; c.fillText(title,w/2,h*.50);
    c.fillStyle='#b8b2a1'; c.font='19px monospace'; c.fillText(subtitle,w/2,h*.76);
  }, 512, 220);
}
function addSign(parent, title, subtitle, pos, size = [3.1, 1.35], color) {
  const texture=labelTexture(title,subtitle,color); const material=new THREE.MeshBasicMaterial({map:texture, side:THREE.DoubleSide});
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(...size),material); sign.position.set(...pos); parent.add(sign); return sign;
}

// The security office is built entirely from lit, shadow-casting Three.js geometry.
const office = new THREE.Group(); scene.add(office);
floor(office, 12, 14, [0, .02, .5]);
box(office, 'rear wall', [12, 4.3, .35], [0, 2.15, -6.5], mats.wall);
box(office, 'rear lower panel', [12, 1.1, .18], [0, .55, -6.28], mats.dark);
box(office, 'rear top trim', [12, .13, .22], [0, 3.48, -6.27], mats.trim);
box(office, 'left wall front', [.34, 4.3, 5], [-6, 2.15, 4.8], mats.wall);
box(office, 'left wall rear', [.34, 4.3, 4.6], [-6, 2.15, -4.1], mats.wall);
box(office, 'right wall front', [.34, 4.3, 5], [6, 2.15, 4.8], mats.wall);
box(office, 'right wall rear', [.34, 4.3, 4.6], [6, 2.15, -4.1], mats.wall);
box(office, 'left lintel', [.38, .45, 2.7], [-6, 3.95, .4], mats.trim);
box(office, 'right lintel', [.38, .45, 2.7], [6, 3.95, .4], mats.trim);
box(office, 'left wall rail', [.08, .12, 10.1], [-5.78, 2.95, -.4], mats.trim);
box(office, 'right wall rail', [.08, .12, 10.1], [5.78, 2.95, -.4], mats.trim);
addSign(office, 'FABLEWOOD', 'SECURITY OFFICE  •  EST. 1987', [0, 2.85, -6.28], [4.1, 1.22], '#d89967');
// Aging wall trim, rivets, and safety lamps add readable detail to the small room.
for (const side of [-1,1]) {
  const x = side*5.77;
  for (let i=0;i<7;i++) sphere(office,.045,[x, .35+i*.45, -5.8],mats.gold,8);
  const lampMat = new THREE.MeshStandardMaterial({color:'#e99562',emissive:'#d34d28',emissiveIntensity:.7});
  box(office,'safety lamp',[.11,.22,.52],[side*5.73,3.55,-4.8],lampMat,{castShadow:false});
}
// Security shutters slide into view when the matching door control is toggled.
const doors = {};
for (const side of ['left','right']) {
  const sign = side === 'left' ? -1 : 1;
  const door = new THREE.Group(); door.position.set(sign*5.7,0,.4); office.add(door);
  const panel = box(door, `${side} shutter`, [.18,3.5,2.4],[sign*.22,5,0],mats.black);
  for (let i=0;i<9;i++) box(door,'shutter slat',[.22,.075,2.34],[sign*.22,3.35+i*.31,0],i%2?mats.wall:mats.trim,{castShadow:false});
  box(door,'door warning strip',[.24,.12,2.35],[sign*.22,.72,0],mats.gold,{castShadow:false});
  doors[side] = { group:door, panel, targetY:5, closed:false };
}
// Desk, terminal, papers, rotary fan, and coffee cup.
const desk = new THREE.Group(); desk.position.set(0,0,3.05); office.add(desk);
box(desk,'desk top',[4.9,.2,2.05],[0,1.12,0],mats.trim);
box(desk,'desk inset',[4.55,.09,1.72],[0,1.24,-.02],mats.dark);
for (const x of [-2,2]) for (const z of [-.7,.7]) box(desk,'desk leg',[.14,1.12,.14],[x,.54,z],mats.black);
box(desk,'keyboard',[1.25,.06,.36],[0,1.32,-.51],mats.wall);
for (let i=0;i<3;i++) box(desk,'scattered paper',[.65,.018,.42],[-1.42+i*.18,1.31,-.42+i*.08],i===1?mats.ivory:mats.gold,{rotation:[0,0,(i-1)*.025],castShadow:false});
cylinder(desk,.1,.13,.22,[1.78,1.39,-.18],mats.dark,16);
cylinder(desk,.07,.07,.035,[1.78,1.52,-.18],mats.rust,16);
const terminal = new THREE.Group(); terminal.position.set(0,0,-.8); desk.add(terminal);
box(terminal,'monitor body',[1.72,1.18,.18],[0,2.04,-.95],mats.black);
box(terminal,'monitor screen',[1.49,.92,.035],[0,2.06,-.845],mats.screen);
box(terminal,'monitor stand',[.2,.53,.2],[0,1.52,-.96],mats.black);
box(terminal,'monitor base',[.68,.07,.38],[0,1.29,-.88],mats.black);
for(let i=0;i<6;i++) box(terminal,'terminal glow',[.13,.018,.02],[-.48+i*.19,2.05,-.82],i<2?mats.green:mats.trim,{castShadow:false});
// A small animated fan makes the otherwise still office feel alive.
const fan = new THREE.Group(); fan.position.set(1.12,1.48,-.4); desk.add(fan);
cylinder(fan,.36,.4,.15,[0,0,0],mats.black,20,[Math.PI/2,0,0]);
sphere(fan,.17,[0,0,.11],mats.gold,16);
const fanBlades = new THREE.Group(); fanBlades.position.z=.13; fan.add(fanBlades);
for(let i=0;i<4;i++){const blade=box(fanBlades,'fan blade',[.12,.61,.045],[0,.36,0],mats.blue);blade.rotation.z=i*Math.PI/2;blade.position.x=Math.sin(i*Math.PI/2)*.36;blade.position.y=Math.cos(i*Math.PI/2)*.36;}
cylinder(fan,.035,.045,.58,[0,-.48,0],mats.black,12);

// Camera-room staging. Each feed is its own complete miniature set.
const roomSpecs = [
  {id:'stage', n:'01', name:'SHOW STAGE', center:[0,0,-21], subtitle:'PARTY  •  STAGE', color:'#b87049', props:'stage'},
  {id:'dining',n:'02', name:'DINING ROOM',center:[-17,0,-14],subtitle:'DINING  •  EAST',color:'#b87049',props:'dining'},
  {id:'west',n:'03',name:'WEST HALL',center:[-17,0,1],subtitle:'WEST  •  HALLWAY',color:'#76a29b',props:'hall'},
  {id:'storage',n:'04',name:'BACK STORAGE',center:[17,0,-14],subtitle:'SERVICE  •  STORAGE',color:'#a08a60',props:'storage'},
  {id:'east',n:'05',name:'EAST HALL',center:[17,0,1],subtitle:'EAST  •  HALLWAY',color:'#76a29b',props:'hall'},
];
const roomById = Object.fromEntries(roomSpecs.map(r=>[r.id,r]));
const cameraViews = {};
const warmLamp = new THREE.PointLight('#e5a56d',17,17,1.7); warmLamp.position.set(0,3.3,2); // cloned and placed per room
function makeRoom(spec){
  const [cx,cy,cz]=spec.center; const root=new THREE.Group(); root.position.set(cx,cy,cz); scene.add(root);
  floor(root,11,11,[0,.015,0]);
  const wallMat=spec.props==='hall'?mat('#393b38'):mat('#383536');
  box(root,'back wall',[11,4.2,.28],[0,2.1,-5.5],wallMat);
  box(root,'left wall',[.28,4.2,11],[-5.5,2.1,0],wallMat);
  box(root,'right wall',[.28,4.2,11],[5.5,2.1,0],wallMat);
  box(root,'ceiling beam',[11,.18,.3],[0,3.8,-5.25],mats.trim);
  box(root,'wall skirting',[10.7,.3,.13],[0,.18,-5.28],mats.dark);
  addSign(root,spec.subtitle,`CAM ${spec.n}   •   FABLEWOOD`,[0,2.85,-5.3],[3.3,1.08],spec.color);
  const lamp=warmLamp.clone(); lamp.position.set(0,3.3,1.2); root.add(lamp);
  for(let i=0;i<6;i++){
    const x=-4.5+i*1.8;
    box(root,'ceiling cable', [.035,.035,3],[x,3.62,-2.8],mats.black,{castShadow:false});
    const bulb=new THREE.Mesh(new THREE.SphereGeometry(.09,10,8),new THREE.MeshBasicMaterial({color:i%2?'#f2c788':'#d29a6d'})); bulb.position.set(x,3.48,-1.4); root.add(bulb);
  }
  if(spec.props==='stage'){
    box(root,'raised stage',[8,.42,2.45],[0,.2,-3.45],mats.trim);
    box(root,'stage curtain',[8,2.7,.15],[0,2.0,-4.7],mat('#56302b'));
    for(let i=0;i<12;i++) box(root,'curtain fold',[.13,2.6,.18],[-3.8+i*.69,2,-4.58],mat(i%2?'#6a3830':'#482923'));
    for(const x of [-2.7,0,2.7]){cylinder(root,.09,.13,2.3,[x,1.48,-3.4],mats.gold,16);sphere(root,.38,[x,2.94,-3.4],mats.rust,18);sphere(root,.13,[x-.16,2.97,-3.11],mats.ivory,12);sphere(root,.13,[x+.16,2.97,-3.11],mats.ivory,12);}
    for(let i=0;i<7;i++) box(root,'stage light',[.52,.08,.28],[-3+i,3.55,-4],i%2?mats.gold:mats.red,{castShadow:false});
  } else if(spec.props==='dining'){
    for(const [x,z] of [[-2.8,-2.8],[2.5,-2.5],[-2.2,1.5],[2.8,1.3]]){
      cylinder(root,.7,.74,.15,[x,.83,z],mats.rust,24);
      cylinder(root,.09,.13,1.55,[x,.1,z],mats.black,12);
      for(const s of [-1,1]){box(root,'dining chair seat',[.78,.13,.62],[x+s*1.18,.55,z],mats.blue);box(root,'dining chair back',[.78,.85,.12],[x+s*1.18,.96,z-.26],mats.blue);}
      cylinder(root,.1,.13,.24,[x-.18,.99,z],mats.ivory,12);cylinder(root,.1,.13,.24,[x+.18,.99,z],mats.gold,12);
    }
  } else if(spec.props==='storage'){
    for(const x of [-3.8,-1.3,1.3,3.8]){
      box(root,'storage shelf',[.22,2.8,1.6],[x,1.45,-3.1],mats.black);
      for(let y=.4;y<3;y+=.82){box(root,'shelf board',[1.3,.09,1.9],[x,y,-3.1],mats.trim);for(let n=0;n<3;n++)box(root,'shelf crate',[.34,.4,.39],[x-.4+n*.4,y+.25,-3.12],n%2?mats.wall:mats.rust);}
    }
    box(root,'utility cart',[2,.13,1.3],[0,.74,1.9],mats.blue);for(const x of [-.8,.8])cylinder(root,.16,.16,.16,[x,.2,2.25],mats.black,12,[Math.PI/2,0,0]);
  } else {
    for(let i=0;i<5;i++){
      const x=-3.6+i*1.8;
      box(root,'hall wall panel',[1.25,2.3,.12],[x,1.45,-5.25],i%2?mats.dark:mats.wall);
      box(root,'sconce',[.22,.48,.12],[x,2.55,-5.12],new THREE.MeshStandardMaterial({color:'#e29b5f',emissive:'#ab4d27',emissiveIntensity:.8}),{castShadow:false});
      box(root,'floor runner',[.16,.025,9],[x*.45,.04,0],i%2?mats.rust:mats.trim,{castShadow:false});
    }
    for(let i=0;i<5;i++) cylinder(root,.055,.055,10,[-4+i*2,3.38,-.2],mats.black,8,[0,0,Math.PI/2]);
  }
  const cam=new THREE.PerspectiveCamera(58,1,.1,80); cam.position.set(cx,cy+3.0,cz+5.15); cam.lookAt(cx,cy+1.15,cz-.7); cameraViews[spec.id]=cam;
  return root;
}
for(const r of roomSpecs) makeRoom(r);

// A soft key light gives the office and its props readable depth without washing out the night.
const keyLight = new THREE.DirectionalLight('#b9c9d1', 1.15);
keyLight.position.set(-4, 8, 6);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
keyLight.shadow.camera.left = -12;
keyLight.shadow.camera.right = 12;
keyLight.shadow.camera.top = 10;
keyLight.shadow.camera.bottom = -8;
keyLight.shadow.bias = -0.0004;
scene.add(keyLight);

// Two original, hand-built animatronics patrol distinct camera routes.
function makeAnimatronic(kind){
  const root=new THREE.Group(); const owl=kind==='owl'; const fur=owl?mats.rust:mats.blue; const face=owl?mats.gold:mats.ivory;
  const body=new THREE.Group();root.add(body);root.userData.body=body;
  sphere(body,.65,[0,1.22,0],fur,24);sphere(body,.44,[0,2.08,.04],fur,24);
  box(body,'animatronic muzzle',[.48,.29,.43],[0,1.98,.36],face);
  for(const x of [-.2,.2]){sphere(body,.11,[x,2.12,.39],mats.black,14);sphere(body,.052,[x,2.12,.48],mats.red,12);}
  box(body,'jaw',[.46,.11,.32],[0,1.79,.38],mats.black);
  for(let i=0;i<5;i++)box(body,'metal teeth',[.045,.08,.04],[-.17+i*.085,1.79,.56],mats.ivory,{castShadow:false});
  if(owl){for(const x of [-.3,.3]){const e=sphere(body,.24,[x,2.57,.02],fur,16);e.scale.set(.55,1.55,.55);}}
  else {for(const x of [-.26,.26]){const e=sphere(body,.19,[x,2.64,.01],fur,16);e.scale.set(.62,2.3,.55);}}
  for(const x of [-.34,.34]){
    sphere(body,.22,[x,1.32,.08],fur,16);cylinder(body,.15,.18,.72,[x,.68,.08],face,12);
    sphere(body,.22,[x*.95,.28,.13],mats.black,14);
  }
  const arms=[];
  for(const x of [-.76,.76]){const arm=new THREE.Group();arm.position.set(x,1.55,0);body.add(arm);sphere(arm,.22,[0,-.3,0],fur,16);cylinder(arm,.16,.13,.62,[0,-.64,.02],face,12);sphere(arm,.2,[0,-.98,.12],mats.black,14);arms.push(arm);}
  root.userData.arms=arms;
  if(owl){cylinder(body,.13,.2,.4,[0,1.5,.57],mats.gold,12);for(let i=0;i<3;i++)box(body,'chest plate',[.15,.16,.09],[-.17+i*.17,1.35,.59],mats.ivory);}
  else{sphere(body,.24,[0,2.46,.06],mats.rust,14);box(body,'bow tie',[.5,.16,.08],[0,1.58,.53],mats.rust);}
  return root;
}
const owlModel=makeAnimatronic('owl');scene.add(owlModel);
const foxModel=makeAnimatronic('fox');scene.add(foxModel);
const leftHallLamp=new THREE.PointLight('#ffd094',0,13,1.8);leftHallLamp.position.set(-5.3,2.2,.3);scene.add(leftHallLamp);
const rightHallLamp=new THREE.PointLight('#ffd094',0,13,1.8);rightHallLamp.position.set(5.3,2.2,.3);scene.add(rightHallLamp);
const cameraSpecs=[...roomSpecs];
const enemies=[
  {name:'Marlow',model:owlModel,route:['stage','dining','west','leftDoor'],side:'left',step:0,next:64},
  {name:'Pip',model:foxModel,route:['stage','storage','east','rightDoor'],side:'right',step:0,next:91},
];
function setEnemyPosition(enemy){
  const id=enemy.route[enemy.step];
  if(id==='leftDoor')enemy.model.position.set(-7.2,0,-.12);
  else if(id==='rightDoor')enemy.model.position.set(7.2,0,-.12);
  else {const r=roomById[id];enemy.model.position.set(r.center[0],0,r.center[2]+.35);}
}
for(const enemy of enemies)setEnemyPosition(enemy);

const state={running:false,ended:false,elapsed:0,realElapsed:0,power:100,monitor:false,cam:'stage',doors:{left:false,right:false},lights:{left:false,right:false},blackout:0,toastUntil:0,mouseX:0,mouseY:0};
let lastFrame=performance.now();
const NIGHT_MINUTES=360;
function timeText(elapsedMinutes){
  const minute=Math.max(0,Math.min(NIGHT_MINUTES,Math.floor(elapsedMinutes)));
  const hourIndex=Math.floor(minute/60); const hour=hourIndex===0?12:hourIndex;
  const mins=minute%60;
  return `${String(hour).padStart(2,'0')}<span>:</span>${String(mins).padStart(2,'0')}<span class="meridiem">AM</span>`;
}
function showToast(message,duration=2400){const toast=$('toast');toast.textContent=message;toast.classList.remove('hidden');state.toastUntil=performance.now()+duration;}
function currentUsage(){return 1+(state.monitor?1:0)+(state.doors.left?1:0)+(state.doors.right?1:0)+(state.lights.left?1:0)+(state.lights.right?1:0);}
function updatePowerUI(){
  const p=Math.max(0,state.power);$('power-value').innerHTML=`${Math.ceil(p)}<span>%</span>`;
  const fill=$('power-fill');fill.style.width=`${p}%`;fill.style.background=p<20?'#dd5b4f':p<45?'#d8a15c':'#a5b66e';
  const usage=currentUsage();$('usage-text').textContent=usage<3?'LOW':usage<5?'MED':'HIGH';
  [...$('usage-meter').children].forEach((el,i)=>el.classList.toggle('active',i<Math.min(usage,4)));
}
function setDoor(side,closed){
  if(!state.running||state.ended||state.power<=0)return;
  state.doors[side]=closed;doors[side].closed=closed;doors[side].targetY=closed?.1:5;
  const button=$(`${side}-door`);button.classList.toggle('active',closed);button.querySelector('.control-state').textContent=closed?'CLOSED':'OPEN';
  updatePowerUI();
}
function setLight(side,on){
  if(!state.running||state.ended||state.power<=0)return;
  state.lights[side]=on;const button=$(`${side}-light`);button.classList.toggle('active',on);
  (side==='left'?leftHallLamp:rightHallLamp).intensity=on?75:0;
  updatePowerUI();
}
function buildCameraTabs(){
  const host=$('camera-tabs');host.innerHTML='';
  for(const spec of cameraSpecs){const button=document.createElement('button');button.className='cam-tab';button.dataset.cam=spec.id;button.innerHTML=`<span>CAM ${spec.n}</span>${spec.name}`;button.addEventListener('click',()=>selectCamera(spec.id));host.append(button);}
}
function selectCamera(id){
  if(!state.monitor||state.power<=0)return;
  state.cam=id;activeCamera=cameraViews[id];const spec=roomById[id];
  $('camera-name').textContent=spec.name;$('monitor-room-name').textContent=spec.name;
  [...$('camera-tabs').children].forEach(button=>button.classList.toggle('selected',button.dataset.cam===id));
  $('signal-status').textContent=Math.random()<.14?'NOISY':'STABLE';
}
let activeCamera=officeCamera;
function setMonitor(open){
  if(!state.running||state.ended)return;
  if(open&&state.power<=0){showToast('NO POWER — CAMERA SYSTEM OFFLINE');return;}
  state.monitor=open;activeCamera=open?cameraViews[state.cam]:officeCamera;
  $('monitor-panel').classList.toggle('hidden',!open);$('camera-label').classList.toggle('hidden',!open);
  $('monitor-button').classList.toggle('hidden',open);
  if(open)selectCamera(state.cam);
  updatePowerUI();
}
function updateClock(){ $('clock').innerHTML=timeText(Math.min(NIGHT_MINUTES,state.elapsed)); }
function endGame(won,enemy){
  if(state.ended)return;state.ended=true;state.running=false;state.monitor=false;
  $('hud').classList.add('hidden');$('end-screen').classList.remove('hidden');
  $('end-kicker').textContent=won?'SHIFT COMPLETE':'SIGNAL LOST';$('end-symbol').textContent=won?'06:00':'NO SIGNAL';
  $('end-title').textContent=won?'YOU MADE IT.':'THEY FOUND YOU.';
  $('end-copy').textContent=won?'The morning crew is here. Time to clock out.':`${enemy?.name||'Something'} got into the office. The night shift is over.`;
  $('end-stats').innerHTML=`<div>TIME SURVIVED<strong>${timeText(state.elapsed).replace(/<[^>]*>/g,'')}</strong></div><div>POWER LEFT<strong>${Math.ceil(state.power)}%</strong></div>`;
}
function advanceEnemy(enemy){
  const next=enemy.step+1;
  if(next>=enemy.route.length){
    if(state.doors[enemy.side]){
      enemy.step=Math.max(1,enemy.step-1);setEnemyPosition(enemy);showToast(`THUD — ${enemy.side.toUpperCase()} DOOR HELD`,2300);enemy.next=30+Math.random()*20;
    }else{showToast(`MOVEMENT DETECTED — ${enemy.side.toUpperCase()} DOOR`,3000);enemy.next=10;enemy.attackPending=true;}
  }else{
    enemy.step=next;setEnemyPosition(enemy);const room=enemy.route[enemy.step];
    if(room==='leftDoor'||room==='rightDoor'){enemy.next=10;enemy.attackPending=true;showToast(`MOVEMENT DETECTED — ${enemy.side.toUpperCase()} DOOR`,3000);}
    else{showToast(`CAMERA MOVEMENT — ${enemy.name.toUpperCase()} IS IN ${roomById[room].name}`,2100);enemy.next=Math.max(36,67-state.realElapsed*.075)+Math.random()*23;}
  }
}
function updateEnemies(dt){
  for(const enemy of enemies){
    if(enemy.attackPending){
      if(state.doors[enemy.side]){enemy.attackPending=false;enemy.step=Math.max(1,enemy.step-1);setEnemyPosition(enemy);enemy.next=30+Math.random()*22;showToast(`THUD — ${enemy.side.toUpperCase()} DOOR HELD`,2400);}
      else{enemy.next-=dt;if(enemy.next<=0){endGame(false,enemy);return;}}
    }else{enemy.next-=dt;if(enemy.next<=0)advanceEnemy(enemy);}
  }
}
function resetGame(){
  state.running=false;state.ended=false;state.elapsed=0;state.realElapsed=0;state.power=100;state.monitor=false;state.cam='stage';state.blackout=0;
  state.doors.left=false;state.doors.right=false;state.lights.left=false;state.lights.right=false;
  for(const side of ['left','right']){doors[side].closed=false;doors[side].targetY=5;$(`${side}-door`).classList.remove('active');$(`${side}-door`).querySelector('.control-state').textContent='OPEN';$(`${side}-light`).classList.remove('active');}
  leftHallLamp.intensity=0;rightHallLamp.intensity=0;mainLamp.intensity=28;ambient.intensity=.26;
  enemies[0].step=0;enemies[0].next=64;enemies[0].attackPending=false;enemies[1].step=0;enemies[1].next=91;enemies[1].attackPending=false;
  for(const e of enemies)setEnemyPosition(e);
  $('clock').innerHTML=timeText(0);$('status-text').textContent='SYSTEMS ONLINE';
  $('title-screen').classList.add('hidden');$('end-screen').classList.add('hidden');$('hud').classList.remove('hidden');
  $('monitor-panel').classList.add('hidden');$('monitor-button').classList.remove('hidden');$('camera-label').classList.add('hidden');$('toast').classList.add('hidden');
  activeCamera=officeCamera;updatePowerUI();lastFrame=performance.now();state.running=true;
}
buildCameraTabs();
$('start-button').addEventListener('click',resetGame);$('restart-button').addEventListener('click',resetGame);
$('left-door').addEventListener('click',()=>setDoor('left',!state.doors.left));$('right-door').addEventListener('click',()=>setDoor('right',!state.doors.right));
$('left-light').addEventListener('click',()=>setLight('left',!state.lights.left));$('right-light').addEventListener('click',()=>setLight('right',!state.lights.right));
$('monitor-button').addEventListener('click',()=>setMonitor(true));$('close-monitor').addEventListener('click',()=>setMonitor(false));
window.addEventListener('keydown',e=>{
  if(['Space','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code))e.preventDefault();
  if(!state.running||state.ended)return;
  const key=e.key.toLowerCase();
  if(key==='q')setDoor('left',!state.doors.left);else if(key==='e')setDoor('right',!state.doors.right);
  else if(key==='a')setLight('left',!state.lights.left);else if(key==='d')setLight('right',!state.lights.right);
  else if(e.code==='Space'){if(state.monitor)setMonitor(false);else setMonitor(true);}
  else if(e.code==='Escape'&&state.monitor)setMonitor(false);
  else if(state.monitor&&/^[1-5]$/.test(key))selectCamera(cameraSpecs[Number(key)-1].id);
  else if(e.code==='ArrowLeft')state.mouseX=Math.max(-1,state.mouseX-.13);
  else if(e.code==='ArrowRight')state.mouseX=Math.min(1,state.mouseX+.13);
});
window.addEventListener('pointermove',e=>{
  if(e.pointerType==='touch'||state.monitor)return;
  const normalized=(e.clientX/innerWidth-.5)*2;state.mouseX=THREE.MathUtils.clamp(normalized,-1,1);
  state.mouseY=THREE.MathUtils.clamp((e.clientY/innerHeight-.5)*2,-.7,.7);
});
document.addEventListener('visibilitychange',()=>{lastFrame=performance.now();});
window.addEventListener('resize',()=>{
  renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.8));
  officeCamera.aspect=innerWidth/innerHeight;officeCamera.updateProjectionMatrix();
  for(const cam of Object.values(cameraViews)){cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix();}
});

function animate(now){
  requestAnimationFrame(animate);
  const frameSeconds=Math.max(0,(now-lastFrame)/1000);const dt=Math.min(.05,frameSeconds);lastFrame=now;
  fanBlades.rotation.z-=dt*5.2;
  for(const side of ['left','right']){
    const door=doors[side];door.group.position.y=THREE.MathUtils.damp(door.group.position.y,door.targetY,8,dt);
  }
  const officeYaw=state.mouseX*.22;
  const target=new THREE.Vector3(Math.sin(officeYaw)*4.7,1.65-state.mouseY*.55,-1.9-Math.cos(officeYaw)*.35);
  if(!state.monitor){const look=officeCamera.userData.look||new THREE.Vector3();look.lerp(target,1-Math.exp(-dt*5));officeCamera.userData.look=look;officeCamera.lookAt(look);}
  for(const enemy of enemies){
    const body=enemy.model.userData.body;const pulse=Math.sin(now*.004+(enemy===owlModel?0:2));
    body.position.y=Math.sin(now*.0026+(enemy===owlModel?0:1))*0.035;
    body.rotation.y=Math.sin(now*.0017+(enemy===owlModel?0:2))*.08;
    enemy.model.userData.arms.forEach((arm,i)=>{arm.rotation.z=Math.sin(now*.003+i*Math.PI)*.08;});
    enemy.model.visible=state.running&&state.monitor&&enemy.route[enemy.step]===state.cam;
  }
  if(state.running&&!state.ended){
    state.realElapsed+=frameSeconds;state.elapsed+=frameSeconds*60;updateClock();
    const drain=(.105+currentUsage()*.075)*dt;state.power=Math.max(0,state.power-drain);
    if(state.power<=0&&state.blackout===0){
      state.blackout=1;state.monitor=false;state.doors.left=false;state.doors.right=false;state.lights.left=false;state.lights.right=false;
      for(const side of ['left','right']){doors[side].closed=false;doors[side].targetY=5;$(`${side}-door`).classList.remove('active');$(`${side}-door`).querySelector('.control-state').textContent='OPEN';$(`${side}-light`).classList.remove('active');}
      leftHallLamp.intensity=0;rightHallLamp.intensity=0;mainLamp.intensity=0;ambient.intensity=.035;
      $('monitor-panel').classList.add('hidden');$('monitor-button').classList.add('hidden');$('camera-label').classList.add('hidden');$('status-text').textContent='POWER FAILURE';
      showToast('POWER DEPLETED — SECURITY SYSTEMS OFFLINE',4000);
    }
    updatePowerUI();
    if(state.blackout){state.blackout+=dt;if(state.blackout>2.5)redEmergency.intensity=3+Math.sin(now*.012)*2;}
    if(state.toastUntil&&now>state.toastUntil){$('toast').classList.add('hidden');state.toastUntil=0;}
    updateEnemies(dt);
    if(state.elapsed>=NIGHT_MINUTES&&!state.ended)endGame(true);
  }
  renderer.render(scene,activeCamera);
}
requestAnimationFrame(animate);
