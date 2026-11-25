(() => {
  'use strict';
  const canvas = document.getElementById('scene');
  const ctx = canvas.getContext('2d', { alpha: false });
  const camCanvas = document.getElementById('camScene');
  const camCtx = camCanvas.getContext('2d');
  const $ = (id) => document.getElementById(id);
  const ui = { clock:$('clock'), power:$('power'), powerBox:document.querySelector('.power'), status:$('systemStatus'), statusText:$('statusText'), bars:$('usageBars').children, hint:$('hint'), camera:$('cameraPanel'), camName:$('camName'), camWarning:$('camWarning'), intro:$('introModal'), end:$('endModal'), endTitle:$('endTitle'), endText:$('endText'), endEyebrow:$('endEyebrow'), endCard:document.querySelector('.end-card'), toast:$('toast') };
  const state = { running:false, ended:false, elapsed:0, duration:210, power:100, leftDoor:false, rightDoor:false, leftLight:false, rightLight:false, camera:false, cam:0, last:0, toastTimer:0, scare:0, shake:0, flicker:0, enemies:[{side:'left',stage:0,attack:0,seed:1},{side:'right',stage:0,attack:0,seed:4}], audio:null, ambience:null };
  let W=1600,H=900,dpr=1,randSeed=84;
  const random=()=>{randSeed=(randSeed*1664525+1013904223)>>>0;return randSeed/4294967296};
  function resize(){const r=canvas.getBoundingClientRect();dpr=Math.min(window.devicePixelRatio||1,2.25);canvas.width=Math.max(1,Math.floor(r.width*dpr));canvas.height=Math.max(1,Math.floor(r.height*dpr));ctx.setTransform(canvas.width/1600,0,0,canvas.height/900,0,0);W=1600;H=900;camCanvas.width=960;camCanvas.height=540;}
  window.addEventListener('resize',resize,{passive:true});resize();
  function rounded(x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}
  function fillRect(x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(x,y,w,h)}
  function gradient(x,y,w,h,top,bottom){const g=ctx.createLinearGradient(x,y,x,y+h);g.addColorStop(0,top);g.addColorStop(1,bottom);return g}
  function line(x1,y1,x2,y2,color,width=1){ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke()}
  function ellipse(x,y,rx,ry,color){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=color;ctx.fill()}
  function text(str,x,y,size,color,font='monospace',align='left'){ctx.font=`${size}px ${font}`;ctx.fillStyle=color;ctx.textAlign=align;ctx.fillText(str,x,y)}
  function wallPanel(x,y,w,h,opacity=.16){fillRect(x,y,w,h,`rgba(119,128,121,${opacity})`);line(x,y+h,x+w,y+h,`rgba(204,200,177,${opacity*.55})`);line(x+w,y,x+w,y+h,`rgba(5,8,8,${opacity*1.6})`)}
  function drawRoom(){
    const shake=state.shake? (random()-.5)*state.shake:0;
    ctx.save();ctx.translate(shake,0);
    // Architectural shell: ceiling, tiled back wall, concrete floor.
    fillRect(0,0,1600,900,gradient(0,0,0,900,'#10181a','#050809'));
    ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(1600,0);ctx.lineTo(1370,160);ctx.lineTo(230,160);ctx.closePath();ctx.fillStyle=gradient(0,0,0,160,'#161d1e','#101718');ctx.fill();
    line(0,0,230,160,'#39403b',2);line(1600,0,1370,160,'#39403b',2);
    for(let i=0;i<8;i++){const x=210+i*170;line(x,0,800+(x-800)*.72,160,'rgba(176,177,157,.08)',1)}
    fillRect(0,160,1600,470,gradient(0,160,0,470,'#202827','#121817'));
    // Back wall panels, seams and old paint variation.
    for(let i=0;i<12;i++){const x=i*140-14;wallPanel(x,171,132,425,.1+(i%3)*.018);}
    for(let y=195;y<600;y+=74)line(0,y,1600,y,'rgba(4,8,8,.21)',2);
    for(let i=0;i<34;i++){const x=random()*1600,y=180+random()*430;ellipse(x,y,random()*1.8+.4,random()*1.5+.4,`rgba(206,194,163,${random()*.08})`)}
    // Recessed exit doors with fixed frames. Sliding leaves are clipped to openings.
    drawDoorBay(78,232,300,382,'left');drawDoorBay(1222,232,300,382,'right');
    // Distant central service opening.
    fillRect(640,244,320,326,'#060a0a');fillRect(650,254,300,316,gradient(0,254,0,316,'#111817','#020404'));
    for(let i=0;i<5;i++){line(676+i*56,267,676+i*56,554,'rgba(126,139,125,.09)',1)}
    fillRect(635,235,330,12,'#51534a');fillRect(635,568,330,8,'#252b28');
    // The barely-lit end of the service corridor.
    const glow=ctx.createRadialGradient(800,390,5,800,400,155);glow.addColorStop(0,'rgba(160,139,92,.14)');glow.addColorStop(1,'rgba(160,139,92,0)');fillRect(640,245,320,320,glow);
    // Floor plane with perspective tiles and scuffed reflections.
    ctx.beginPath();ctx.moveTo(0,630);ctx.lineTo(1600,630);ctx.lineTo(1600,900);ctx.lineTo(0,900);ctx.closePath();ctx.fillStyle=gradient(0,630,0,270,'#252927','#090c0c');ctx.fill();
    for(let i=0;i<=12;i++){const x=i*145;line(x,900,800+(x-800)*.15,630,'rgba(169,171,151,.14)',1)}
    for(let i=1;i<8;i++){const y=630+i*i*4.5;line(0,y,1600,y,'rgba(183,181,160,.12)',1)}
    // Office clutter: wall clock, security plaques, loose wires, desk lamp.
    drawClock(800,204);drawPlaque(470,250,'NIGHT OFFICE');drawPlaque(1080,250,'EMPLOYEES ONLY');
    // Distant shadow that is only briefly visible in the central passage.
    const apparition=Math.max(0,Math.sin(state.elapsed*1.31+1)-.91)*6;
    if(apparition>0.15){ctx.save();ctx.globalAlpha=apparition*.45;drawCreature(800,518,.65,'front',true);ctx.restore()}
    // Hallway lights, sharply contained in the openings; doors are rendered after.
    drawHallLight('left');drawHallLight('right');
    // Door bolts and heavy control frame sit above every moving panel, never overrun the wall.
    drawDoorBay(78,232,300,382,'left',true);drawDoorBay(1222,232,300,382,'right',true);
    // Desk in the near field.
    drawDesk();
    // Dust and subtle analog grain.
    ctx.globalAlpha=.16;for(let i=0;i<130;i++){const x=random()*1600,y=random()*900;fillRect(x,y,random()*2+.3,random()*1.5+.3,random()>.5?'#d7cdb0':'#000')};ctx.globalAlpha=1;
    if(state.flicker>0&&random()<state.flicker){fillRect(0,0,1600,900,'rgba(230,221,184,.08)')}
    ctx.restore();
  }
  function drawDoorBay(x,y,w,h,side,frameOnly=false){
    const shut=side==='left'?state.leftDoor:state.rightDoor;
    const pad=17,ix=x+pad,iy=y+19,iw=w-pad*2,ih=h-35;
    // outer recess and shadow
    fillRect(x,y,w,h,'#090d0d');fillRect(x+5,y+5,w-10,h-10,'#343a34');fillRect(ix,iy,iw,ih,'#030606');
    if(!frameOnly){
      ctx.save();ctx.beginPath();ctx.rect(ix,iy,iw,ih);ctx.clip();
      // Small depth corridor behind the barrier.
      fillRect(ix,iy,iw,ih,gradient(ix,iy,0,ih,'#171e1d','#030505'));
      const vanX=side==='left'?ix+iw*.65:ix+iw*.35;
      for(let i=0;i<5;i++){line(vanX,iy+ih,vanX+(i-2)*iw*.27,iy+20,'rgba(132,143,130,.14)',1)}
      const threat=state.enemies.find(e=>e.side===side);
      if(threat&&threat.stage>=2)drawCreature(vanX,iy+ih*.78,threat.stage===3?.73:.53,side,false);
      // Moving shutter is physically clipped to the opening: the leaf can never cross the frame/wall.
      const slide=shut?0:ih;
      if(slide<ih){
        const gy=iy-slide;
        fillRect(ix,gy,iw,ih,gradient(ix,gy,0,ih,'#61655b','#303732'));
        for(let yy=gy+5;yy<gy+ih;yy+=14){fillRect(ix+2,yy,iw-4,2,'rgba(8,12,11,.46)');line(ix+2,yy+3,ix+iw-2,yy+3,'rgba(203,197,173,.14)',1)}
        fillRect(ix+iw*.12,gy+ih*.36,iw*.76,4,'#898a78');fillRect(ix+iw*.18,gy+ih*.36+4,iw*.64,2,'#161b18');
      }
      ctx.restore();
    }
    // Fixed steel frame and warning lamps are the topmost geometry.
    fillRect(x,y,w,12,'#626458');fillRect(x,y+12,12,h-24,'#43483f');fillRect(x+w-12,y+12,12,h-24,'#3a4039');fillRect(x,y+h-12,w,12,'#303630');
    fillRect(x+13,y+15,5,h-30,'#888879');fillRect(x+w-18,y+15,5,h-30,'#797c70');
    const indicator=open?'#71826a':'#d25f4d';ellipse(side==='left'?x+w-31:x+31,y+33,4,4,indicator);
    fillRect(x+20,y+h-29,w-40,1,'rgba(219,204,165,.3)');
  }
  function drawHallLight(side){const lit=side==='left'?state.leftLight:state.rightLight;if(!lit)return;const x=side==='left'?90:1222;const beam=ctx.createRadialGradient(side==='left'?360:1240,425,5,side==='left'?330:1270,440,280);beam.addColorStop(0,'rgba(222,187,115,.35)');beam.addColorStop(.55,'rgba(212,173,99,.13)');beam.addColorStop(1,'rgba(207,163,84,0)');fillRect(x,230,300,385,beam);const threat=state.enemies.find(e=>e.side===side);if(threat&&threat.stage>=2){const cx=side==='left'?262:1338;ellipse(cx-10,408,4,2,'#edc770');ellipse(cx+10,408,4,2,'#edc770');ellipse(cx-10,408,1,1,'#fff2c3');ellipse(cx+10,408,1,1,'#fff2c3')}}
  function drawCreature(x,y,s,side,far){ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.globalAlpha=far?.52:.92;
    // Original, long-eared maintenance mascot silhouette; rim-lit, not a flat black cutout.
    const dark=ctx.createRadialGradient(-5,-70,8,0,-42,118);dark.addColorStop(0,'#35352f');dark.addColorStop(.58,'#141817');dark.addColorStop(1,'#030505');
    ellipse(0,-82,47,63,dark);ellipse(-28,-133,14,43,dark);ellipse(28,-133,14,43,dark);ellipse(-27,-135,5,25,'#4c4840');ellipse(27,-135,5,25,'#4c4840');
    // torn ear tips
    ctx.beginPath();ctx.moveTo(-39,-159);ctx.lineTo(-45,-197);ctx.lineTo(-18,-171);ctx.closePath();ctx.fillStyle='#080a09';ctx.fill();ctx.beginPath();ctx.moveTo(19,-171);ctx.lineTo(45,-199);ctx.lineTo(38,-158);ctx.closePath();ctx.fill();
    ellipse(-17,-87,8,5,'#c69c58');ellipse(17,-87,8,5,'#c69c58');ellipse(-17,-87,2,4,'#fff1c4');ellipse(17,-87,2,4,'#fff1c4');
    ctx.beginPath();ctx.moveTo(-22,-59);ctx.quadraticCurveTo(0,-72,22,-59);ctx.lineTo(13,-44);ctx.lineTo(-15,-44);ctx.closePath();ctx.fillStyle='#080a09';ctx.fill();
    for(let i=-2;i<=2;i++){ctx.beginPath();ctx.moveTo(i*7,-54);ctx.lineTo(i*7+3,-45);ctx.lineTo(i*7+5,-55);ctx.fillStyle='#c8c0a9';ctx.fill()}
    // shoulders and ragged uniform
    ctx.beginPath();ctx.moveTo(-37,-28);ctx.quadraticCurveTo(-74,-15,-67,48);ctx.lineTo(-48,42);ctx.lineTo(-42,66);ctx.lineTo(-20,54);ctx.lineTo(0,68);ctx.lineTo(22,51);ctx.lineTo(49,60);ctx.lineTo(53,29);ctx.quadraticCurveTo(68,-8,37,-31);ctx.closePath();ctx.fillStyle=dark;ctx.fill();
    line(-31,-5,-22,35,'rgba(183,155,105,.33)',2);line(34,-4,25,30,'rgba(183,155,105,.2)',2);
    if(side==='right'){ctx.scale(-1,1)}ctx.restore();}
  function drawClock(x,y){ellipse(x,y,24,24,'#080c0c');ellipse(x,y,21,21,'#343a35');ellipse(x,y,17,17,'#121716');for(let i=0;i<12;i++){const a=i*Math.PI/6;line(x+Math.sin(a)*13,y-Math.cos(a)*13,x+Math.sin(a)*15,y-Math.cos(a)*15,'#bbb69b',1)}const sec=(state.elapsed*0.8)%60;line(x,y,x+Math.sin(sec*Math.PI/30)*10,y-Math.cos(sec*Math.PI/30)*10,'#c39b61',1);line(x,y,x+4,y-8,'#d1c9aa',1.5);ellipse(x,y,2,2,'#d4c6a0')}
  function drawPlaque(x,y,label){fillRect(x,y,154,29,'#303630');fillRect(x+2,y+2,150,25,'#171d1b');text(label,x+77,y+18,7,'#a4a48e','monospace','center');line(x+7,y+24,x+147,y+24,'rgba(200,190,154,.16)',1)}
  function drawDesk(){ctx.save();ctx.shadowColor='#000';ctx.shadowBlur=27;ctx.shadowOffsetY=12;ctx.beginPath();ctx.moveTo(205,676);ctx.lineTo(1395,676);ctx.lineTo(1510,900);ctx.lineTo(90,900);ctx.closePath();ctx.fillStyle=gradient(0,676,0,224,'#262b28','#111514');ctx.fill();ctx.restore();line(207,677,1393,677,'#56594d',3);line(90,899,1510,899,'rgba(142,140,119,.3)',2);
    // Monitor housing and muted green phosphor display.
    fillRect(620,554,360,138,'#101514');fillRect(629,562,342,112,'#42463b');fillRect(635,568,330,99,gradient(0,568,0,99,'#25352e','#101a17'));ctx.strokeStyle='rgba(141,167,129,.12)';ctx.lineWidth=1;for(let y=575;y<666;y+=6)line(638,y,962,y,'rgba(147,171,132,.13)',1);text('SECURITY  /  04',650,588,8,'#a2b493');text('NO MOVEMENT DETECTED',650,609,7,'#879a83');text('AUX POWER '+Math.max(0,Math.floor(state.power))+'%',650,651,7,'#7f9079');fillRect(684,689,232,11,'#232825');
    // scattered desk objects
    fillRect(442,700,110,15,'#111614');fillRect(450,703,92,3,'#555a4c');fillRect(450,708,63,2,'#393e38');
    fillRect(1080,700,82,30,'#171c19');fillRect(1084,704,72,22,'#363d35');ellipse(1120,716,4,4,'#c9a264');
    // mug, paper, cable
    fillRect(361,715,29,30,'#343a34');ellipse(375,715,14,4,'#787565');ctx.beginPath();ctx.arc(390,728,8,-Math.PI/2,Math.PI/2);ctx.strokeStyle='#575b50';ctx.lineWidth=3;ctx.stroke();
    ctx.beginPath();ctx.moveTo(940,716);ctx.bezierCurveTo(1010,690,1020,742,1065,727);ctx.strokeStyle='#070a09';ctx.lineWidth=4;ctx.stroke();
    fillRect(737,728,151,72,'rgba(174,167,141,.13)');line(748,741,864,741,'rgba(204,195,169,.3)',1);line(748,753,844,753,'rgba(204,195,169,.2)',1);line(748,765,859,765,'rgba(204,195,169,.2)',1);
  }

  const camLabels=['CAM 01 — ENTRY','CAM 02 — DINING ROOM','CAM 03 — WEST HALL','CAM 04 — EAST HALL'];
  function drawCamera(){
    const c=camCtx,w=camCanvas.width,h=camCanvas.height,cam=state.cam;
    const bg=c.createLinearGradient(0,0,0,h);bg.addColorStop(0,'#1c2421');bg.addColorStop(1,'#080c0b');c.fillStyle=bg;c.fillRect(0,0,w,h);
    c.fillStyle='#242b27';c.fillRect(0,0,w,70);c.fillStyle='#30352f';c.fillRect(0,65,w,h-185);
    for(let i=0;i<8;i++){const x=i*138;c.fillStyle=i%2?'#1e2522':'#252b26';c.fillRect(x+5,84,124,290);c.strokeStyle='rgba(174,170,139,.11)';c.strokeRect(x+5,84,124,290)}
    // Lens falloff and abandoned room dressing.
    if(cam===1){for(let i=0;i<3;i++){const x=175+i*285,y=315-i%2*34;c.fillStyle='#333730';c.fillRect(x-95,y,190,20);c.fillRect(x-77,y+20,10,75);c.fillRect(x+68,y+20,10,75);c.fillStyle='#685d48';c.fillRect(x-89,y-7,178,7)}c.fillStyle='#655d4d';c.fillRect(80,125,155,73);c.fillStyle='#171d1a';c.fillRect(87,132,141,59);c.fillStyle='#b7985e';c.font='15px monospace';c.fillText('HAPPY BIRTHDAY',99,165)}
    else if(cam===0){c.fillStyle='#060909';c.fillRect(356,72,248,303);for(let i=0;i<8;i++){c.fillStyle=i%2?'#8a8167':'#292e28';c.fillRect(356+i*31,72,31,42)}c.fillStyle='#5e594a';c.fillRect(340,70,12,310);c.fillRect(608,70,12,310);c.fillStyle='#3b4239';c.fillRect(80,305,155,65);c.fillStyle='#877e65';c.fillRect(92,317,130,6)}
    else{const x=cam===2?125:700;c.fillStyle='#080b0a';c.fillRect(cam===2?0:0,80,w,h-150);c.fillStyle='#1f2824';c.beginPath();c.moveTo(cam===2?0:w,380);c.lineTo(480,115);c.lineTo(cam===2?w:0,380);c.closePath();c.fill();for(let i=0;i<7;i++){const yy=120+i*i*7;c.strokeStyle=`rgba(181,175,144,${.2-i*.02})`;c.beginPath();c.moveTo(0,yy);c.lineTo(w,yy);c.stroke()}c.fillStyle='#46493c';c.fillRect(cam===2?805:104,146,28,193);}
    // Camera-specific mascot location, if it has reached that part of the building.
    const match=state.enemies.find(e=>e.stage>0&&((cam===0&&e.stage===1)||(cam===1&&e.stage===1&&e.side==='right')||(cam===2&&e.side==='left'&&e.stage>=2)||(cam===3&&e.side==='right'&&e.stage>=2)));
    if(match){const cx=cam===0?480:cam===1?690:cam===2?650:315;const cy=cam<2?350:370;cameraCreature(c,cx,cy,match.stage>=3?1.06:.83)}
    const vignette=c.createRadialGradient(w/2,h/2,80,w/2,h/2,w*.68);vignette.addColorStop(0,'rgba(0,0,0,0)');vignette.addColorStop(1,'rgba(0,0,0,.68)');c.fillStyle=vignette;c.fillRect(0,0,w,h);
    c.fillStyle='rgba(8,10,8,.27)';for(let y=0;y<h;y+=4)c.fillRect(0,y,w,1);
    for(let i=0;i<500;i++){const x=random()*w,y=random()*h;c.fillStyle=`rgba(${random()>.5?'220,220,190':'0,0,0'},${random()*.13})`;c.fillRect(x,y,random()*2+1,1)}
  }
  function cameraCreature(c,x,y,s){c.save();c.translate(x,y);c.scale(s,s);c.fillStyle='#070a08';c.beginPath();c.ellipse(0,-80,47,63,0,0,Math.PI*2);c.fill();c.beginPath();c.moveTo(-39,-125);c.lineTo(-42,-205);c.lineTo(-10,-160);c.moveTo(16,-160);c.lineTo(44,-202);c.lineTo(38,-120);c.fill();c.beginPath();c.ellipse(-18,-87,6,3,0,0,Math.PI*2);c.ellipse(18,-87,6,3,0,0,Math.PI*2);c.fillStyle='#d3b36a';c.fill();c.fillStyle='#080a09';c.beginPath();c.moveTo(-53,-28);c.lineTo(53,-28);c.lineTo(73,95);c.lineTo(-73,95);c.fill();c.restore()}

  function updateReadouts(){
    const hour=Math.min(6,Math.floor(state.elapsed/state.duration*6));ui.clock.textContent=hour===0?'12 AM':`${hour} AM`;
    ui.power.innerHTML=`${Math.max(0,Math.ceil(state.power))}<span>%</span>`;ui.powerBox.classList.toggle('low',state.power<20);
    const usage=state.power<=0?0:1+Number(state.leftDoor)+Number(state.rightDoor)+Number(state.leftLight)+Number(state.rightLight)+Number(state.camera);
    [...ui.bars].forEach((bar,i)=>bar.style.opacity=i<Math.min(5,usage)?'1':'.22');
    const danger=state.enemies.some(e=>e.stage>=3);
    ui.status.className='system-status'+(state.power<20||danger?' critical':state.power<45||state.enemies.some(e=>e.stage>=2)?' warning':'');
    ui.statusText.textContent=state.power<=0?'AUXILIARY POWER LOST':danger?'MOVEMENT AT DOORWAY':state.power<20?'POWER RESERVE CRITICAL':state.camera?'CAMERA FEED ACTIVE':'SYSTEMS NOMINAL';
    $('leftDoor').classList.toggle('active',state.leftDoor);$('rightDoor').classList.toggle('active',state.rightDoor);
    $('leftLight').classList.toggle('active',state.leftLight);$('rightLight').classList.toggle('active',state.rightLight);
    $('leftDoorState').textContent=state.leftDoor?'SEALED':'OPEN';$('rightDoorState').textContent=state.rightDoor?'SEALED':'OPEN';
    $('leftLightState').textContent=state.leftLight?'ON':'OFF';$('rightLightState').textContent=state.rightLight?'ON':'OFF';
    ui.hint.textContent=state.power<=0?'POWER FAILURE — MANUAL SYSTEMS OFFLINE':danger?'SOMETHING IS WAITING AT A DOOR.':'KEEP THE LIGHTS LOW. LISTEN FOR MOVEMENT.';
    ui.camera.classList.toggle('open',state.camera);ui.camName.textContent=camLabels[state.cam];
    document.querySelectorAll('.cam-choice').forEach((b,i)=>b.classList.toggle('active',i===state.cam));
    $('monitorToggle').classList.toggle('active',state.camera);
  }
  function showToast(message){ui.toast.textContent=message;ui.toast.classList.add('show');clearTimeout(state.toastTimer);state.toastTimer=setTimeout(()=>ui.toast.classList.remove('show'),1650)}
  function startAudio(){if(state.audio){state.audio.resume?.();return}try{const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;const ac=new AC();state.audio=ac;const gain=ac.createGain();gain.gain.value=.018;gain.connect(ac.destination);const osc=ac.createOscillator();osc.type='triangle';osc.frequency.value=47;const lfo=ac.createOscillator();lfo.frequency.value=.11;const wobble=ac.createGain();wobble.gain.value=5;lfo.connect(wobble);wobble.connect(osc.frequency);osc.connect(gain);osc.start();lfo.start();state.ambience=gain}catch(e){}}
  function sound(type){if(!state.audio)return;const ac=state.audio;try{const o=ac.createOscillator(),g=ac.createGain();o.connect(g);g.connect(ac.destination);const t=ac.currentTime;const freqs=type==='door'?[92,39]:type==='light'?[480,90]:type==='scare'?[170,38]:[240,120];o.type=type==='scare'?'sawtooth':'triangle';o.frequency.setValueAtTime(freqs[0],t);o.frequency.exponentialRampToValueAtTime(freqs[1],t+(type==='scare'?.75:.22));g.gain.setValueAtTime(type==='scare'?.16:.05,t);g.gain.exponentialRampToValueAtTime(.001,t+(type==='scare'?.85:.25));o.start(t);o.stop(t+(type==='scare'?.86:.26))}catch(e){}}
  function action(kind,side){if(!state.running||state.ended)return;if(state.power<=0){showToast('THE BACKUP GENERATOR IS DEAD');return}
    if(kind==='camera'){state.camera=!state.camera;if(state.camera){state.leftLight=false;state.rightLight=false;showToast('CAMERA NETWORK ONLINE')}sound('switch')}
    if(kind==='door'){const key=side+'Door';state[key]=!state[key];if(state[key])state.camera=false;sound('door');if(state[key])showToast(`${side.toUpperCase()} SECURITY DOOR SEALED`)}
    if(kind==='light'){const key=side+'Light';state[key]=!state[key];if(state[key]){state.camera=false;sound('light');const e=state.enemies.find(q=>q.side===side);if(e&&e.stage>=3)showToast('IT IS RIGHT OUTSIDE');else if(e&&e.stage===2)showToast('A SHAPE IN THE HALL')}else sound('switch')}
    updateReadouts();
  }
  function advanceEnemies(dt){if(state.elapsed<7)return;for(const e of state.enemies){
    if(e.stage>=3){e.attack+=dt;const closed=e.side==='left'?state.leftDoor:state.rightDoor;
      if(closed){if(e.attack>4.5){e.stage=1;e.attack=0;showToast('SOMETHING RETREATED DOWN THE HALL');sound('switch')}}
      else if(e.attack>4.4){endGame(false,'You heard the metal scrape. You waited one moment too long.');return}
      continue;
    }
    e.seed+=dt;if(e.seed>5.3){e.seed=0;const progress=state.elapsed/state.duration;const chance=.22+progress*.21+(e.side==='right'?.035:0);if(random()<chance){e.stage=Math.min(3,e.stage+1);if(e.stage===3){e.attack=0;state.flicker=.2;showToast('MOTION DETECTED — CHECK THE HALL');sound('switch')}else if(e.stage===2&&random()<.58){showToast('AUDIO ALERT: MOVEMENT IN THE HALL')}}}
  }}
  function tick(now){requestAnimationFrame(tick);if(!state.last)state.last=now;let dt=Math.min(.06,(now-state.last)/1000);state.last=now;
    if(state.running&&!state.ended){state.elapsed+=dt;
      const load=.021+(state.leftDoor?.245:0)+(state.rightDoor?.245:0)+(state.leftLight?.073:0)+(state.rightLight?.073:0)+(state.camera?.065:0);
      state.power=Math.max(0,state.power-load*dt);
      if(state.power===0){state.leftDoor=false;state.rightDoor=false;state.leftLight=false;state.rightLight=false;state.camera=false;state.flicker=.1}
      advanceEnemies(dt);if(state.elapsed>=state.duration&&!state.ended)endGame(true,'You kept the generator alive and the halls at bay. The morning crew will be here soon.');
      state.flicker=Math.max(0,state.flicker-dt*.24);
      if(state.ambience&&state.power<20)state.ambience.gain.setTargetAtTime(.007,state.audio.currentTime,.4);
      updateReadouts();
    }
    drawRoom();if(state.camera){drawCamera();ui.camWarning.classList.remove('visible');$('camStamp').textContent=`FAIRWATER / ${clockStamp()}`}
  }
  function clockStamp(){const mins=Math.floor(state.elapsed/state.duration*360);const hour=Math.floor(mins/60)%12||12;return `${String(hour).padStart(2,'0')}:${String(mins%60).padStart(2,'0')}:00 AM`}
  function endGame(won,message){if(state.ended)return;state.ended=true;state.running=false;state.camera=false;ui.end.classList.remove('hidden');ui.endCard.classList.toggle('died',!won);ui.endTitle.textContent=won?'6 AM':'SHIFT ENDED';ui.endText.textContent=message;ui.endEyebrow.innerHTML=won?'<span></span> SHIFT COMPLETE':'<span></span> INCIDENT REPORT';if(!won){state.scare=1;state.shake=13;sound('scare');setTimeout(()=>{state.shake=0},900)}else sound('switch');updateReadouts()}
  function begin(){startAudio();state.running=true;state.ended=false;state.last=performance.now();ui.intro.classList.add('hidden');ui.end.classList.add('hidden');showToast('SHIFT STARTED — MIDNIGHT');updateReadouts()}
  function reset(){state.elapsed=0;state.power=100;state.leftDoor=false;state.rightDoor=false;state.leftLight=false;state.rightLight=false;state.camera=false;state.cam=0;state.ended=false;state.running=false;state.scare=0;state.shake=0;state.flicker=0;state.enemies=[{side:'left',stage:0,attack:0,seed:1},{side:'right',stage:0,attack:0,seed:4}];ui.end.classList.add('hidden');ui.intro.classList.remove('hidden');updateReadouts()}
  $('startButton').addEventListener('click',begin);$('restartButton').addEventListener('click',reset);
  $('leftDoor').addEventListener('click',()=>action('door','left'));$('rightDoor').addEventListener('click',()=>action('door','right'));
  $('leftLight').addEventListener('click',()=>action('light','left'));$('rightLight').addEventListener('click',()=>action('light','right'));
  $('monitorToggle').addEventListener('click',()=>action('camera'));
  document.querySelectorAll('.cam-choice').forEach(button=>button.addEventListener('click',()=>{state.cam=Number(button.dataset.cam);drawCamera();updateReadouts();sound('switch')}));
  document.addEventListener('keydown',event=>{if(event.repeat)return;const key=event.key.toLowerCase();if(key===' '){event.preventDefault();action('camera')}else if(key==='q')action('door','left');else if(key==='e')action('door','right');else if(key==='a')action('light','left');else if(key==='d')action('light','right');else if(key==='escape'&&state.camera)action('camera')});
  document.addEventListener('visibilitychange',()=>{state.last=performance.now()});
  updateReadouts();requestAnimationFrame(tick);
})();
