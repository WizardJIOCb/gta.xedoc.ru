import * as T from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import {addWetRoad,addGulls} from './coast.js';
import {createBodywork} from './bodywork.js';
import { createWorld } from './world.js';
import { createCar, createPerson } from './vehicles.js';
import { createHUD } from './hud.js';
import { createAudio } from './audio.js';
import { createDistrict } from './district.js';
import { drive, resetVehicle } from './handling.js';

const goal = {x:38,z:-160};
const view = document.querySelector('#view');
const loading = document.querySelector('#loading');
const clamp = T.MathUtils.clamp;
const damp = T.MathUtils.damp;
const angleDiff = (a,b) => Math.atan2(Math.sin(a-b), Math.cos(a-b));

async function start() {
  const renderer = new T.WebGLRenderer({canvas:view,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.55));
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=T.PCFSoftShadowMap;
  renderer.toneMapping=T.ACESFilmicToneMapping;
  renderer.toneMappingExposure=0.86;
  const scene = new T.Scene();
  scene.background = new T.Color(0xf0bda0);
  scene.fog = new T.FogExp2(0xe2bbb0,.0035);
  const camera=new T.PerspectiveCamera(56,1,.12,950);
  const resize=()=>{renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();};
  addEventListener('resize',resize);resize();
  const sun=new T.DirectionalLight(0xffb678,3.2);
  const sunOffset=new T.Vector3(50,24,-56);
  sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);
  Object.assign(sun.shadow.camera,{left:-68,right:68,top:68,bottom:-68,near:.5,far:195});
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias=-.00025;sun.shadow.normalBias=.032;
  scene.add(sun,sun.target,new T.HemisphereLight(0xffddcc,0x8a829b,0.5));
  const world=createWorld(scene);
  const gulls=addGulls(scene);
  const hero=createCar({hero:true,color:0xa82e24});
  const bodywork=createBodywork(hero.mesh);
  const person=createPerson({color:0x28796f});
  scene.add(hero.mesh,person.mesh);
  const district=createDistrict(scene), audio=createAudio(), keys=new Set();
  const mechanic=createPerson({color:0x996237});
  scene.add(mechanic.mesh);
  const vehicle={},foot={x:0,z:0,yaw:0}, pos=new T.Vector3();
  const cameraTarget=new T.Vector3(), cameraEnd=new T.Vector3();
  let phase,paused,muted=false,elapsed,time=0,toast='',toastTime=0,look=0,pitch=0,cameraYaw=0,inspection=0;
  let pointer=null,previousX=0,previousY=0,returnDelay=0,walking=false,loaded=false;
  const state={},carPos=()=>Math.hypot(vehicle.x-foot.x,vehicle.z-foot.z);
  const goalDist=()=>Math.hypot(vehicle.x-goal.x,vehicle.z-goal.z);
  function say(message,seconds=2.7) {toast=message;toastTime=seconds;}
  function reset() {
    resetVehicle(vehicle);
    bodywork.restore();
    Object.assign(foot,{x:7.45,z:67.4,yaw:.85});
    phase='foot';paused=false;elapsed=0;look=.6;cameraYaw=.6;pitch=0;returnDelay=2;inspection=0;
    mechanic.mesh.position.set(42,.16,-155.8);mechanic.mesh.rotation.y=1.1;
    keys.clear();walking=false;toast='';toastTime=0;
    person.mesh.visible=true;hero.setDriverVisible(false);
    updateActors(0);updateCamera(1,true);
  }
  function onAction(action) {
    audio.wake();
    if (action==='audio') {muted=!muted;audio.mute(muted);return;}
    if (action==='restart' && (phase==='done'||paused)) {reset();return;}
    if (phase==='done') return;
    if (action==='pause' || action==='resume') {
      paused=action==='resume'?false:!paused;keys.clear();return;
    }
    if (paused || inspection>0 || action!=='interact') return;
    if (phase==='foot' && carPos()<3.6) {
      phase='drive';person.mesh.visible=false;hero.setDriverVisible(true);look=0;
      say('До пирса прямо. У мастерской поверни направо.',4.2);
    } else if (phase==='drive' && goalDist()<7) {
      if (Math.abs(vehicle.speed)>1.6) {say('Притормози у ворот.');return;}
      vehicle.speed=0;vehicle.vx=vehicle.vz=0;keys.clear();inspection=.001;
      say('Механик осматривает кузов…',3.2);
    }
  }
  function onKey(code,down) {
    if (down) {audio.wake();if (!paused && phase!=='done') keys.add(code);}
    else keys.delete(code);
  }
  const hud=createHUD({onAction,onKey});
  const keyActions={KeyE:'interact',Escape:'pause',KeyM:'audio',KeyR:'restart'};
  const controls=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ArrowDown','ArrowRight','Space','ShiftLeft','ShiftRight']);
  addEventListener('keydown',e=>{
    if (e.metaKey||e.ctrlKey||e.altKey) return;
    if (keyActions[e.code]) {e.preventDefault();if(!e.repeat)onAction(keyActions[e.code]);}
    else if(controls.has(e.code)) {
      if (e.code==='Space' && e.target.closest?.('button')) return;
      e.preventDefault();if(!e.repeat)onKey(e.code,true);
    }
  });
  addEventListener('keyup',e=>onKey(e.code,false));
  function suspend() {keys.clear();if(loaded && phase!=='done')paused=true;audio.update(0,false,false,true);}
  addEventListener('blur',suspend);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)suspend();});
  view.addEventListener('pointerdown',e=>{
    if(paused||phase==='done')return;audio.wake();pointer=e.pointerId;
    previousX=e.clientX;previousY=e.clientY;view.setPointerCapture(pointer);
  });
  view.addEventListener('pointermove',e=>{
    if(e.pointerId!==pointer)return;
    look-=(e.clientX-previousX)*.005;pitch=clamp(pitch+(e.clientY-previousY)*.008,-1.1,2.8);
    returnDelay=1.6;previousX=e.clientX;previousY=e.clientY;
  });
  for(const event of ['pointerup','pointercancel','lostpointercapture'])view.addEventListener(event,()=>{pointer=null;});
  const down=(...codes)=>codes.some(code=>keys.has(code));
  function hit(x,z,r,car=false) {
    if (x-r < -138 || x+r>54 || z-r< -232 || z+r>106) return true;
    for (const b of world.blocks)
      if (Math.abs(x-b.x)<b.w/2+r && Math.abs(z-b.z)<b.d/2+r) return true;
    for (const traffic of district.cars) {
      const p=traffic.model.mesh.position;
      if (Math.abs(x-p.x)>3.5 || Math.abs(z-p.z)>3.5) continue;
      const h=traffic.model.mesh.rotation.y, dx=x-p.x, dz=z-p.z;
      if (Math.abs(dx*Math.cos(h)-dz*Math.sin(h))<.85+r && Math.abs(dx*Math.sin(h)+dz*Math.cos(h))<1.85+r) return true;
    }
    if(car)for(const ped of district.pedestrians) {
      const p=ped.model.mesh.position;if(Math.hypot(x-p.x,z-p.z)<r+.27)return true;
    }
    return false;
  }
  function step(dt) {
    time+=dt;toastTime-=dt;if(toastTime<=0)toast='';
    const gas=down('KeyW','ArrowUp'), brake=down('KeyS','ArrowDown');
    const turn=Number(down('KeyA','ArrowLeft'))-Number(down('KeyD','ArrowRight'));
    const forward=Number(gas)-Number(brake);
    if(inspection>0) {
      inspection+=dt;
      const a=vehicle.yaw+1.6+Math.min(1,inspection/3)*2.6;
      const destX=vehicle.x+Math.sin(a)*2.8,destZ=vehicle.z+Math.cos(a)*2.8;
      const p=mechanic.mesh.position;
      const dx=destX-p.x,dz=destZ-p.z,len=Math.hypot(dx,dz),stride=Math.min(len,2.7*dt);
      p.x+=dx*stride/Math.max(len,.001);p.z+=dz*stride/Math.max(len,.001);
      mechanic.mesh.rotation.y=Math.atan2(-dx,-dz);mechanic.update(dt,true);
      look=damp(look,1.12,1.7,dt);
      if(inspection>=3.3){phase='done';inspection=0;}
    } else if(phase==='foot') {
      walking=!!(turn||forward);
      if(walking) {
        const dx=-turn*Math.cos(look)-forward*Math.sin(look), dz=turn*Math.sin(look)-forward*Math.cos(look);
        const length=Math.hypot(dx,dz), pace=down('ShiftLeft','ShiftRight')?5.3:3;
        const nx=foot.x+dx*dt*pace/length,nz=foot.z+dz*dt*pace/length;
        function canWalk(x,z) {
          const nearBody=Math.abs(x-vehicle.x)<1.05 && Math.abs(z-vehicle.z)<2.23;
          return !nearBody && !hit(x,z,.28);
        }
        if(canWalk(nx,foot.z))foot.x=nx;
        if(canWalk(foot.x,nz))foot.z=nz;
        foot.yaw+=angleDiff(Math.atan2(-dx,-dz),foot.yaw)*(1-Math.exp(-11*dt));
      }
    } else if(phase==='drive') {
      elapsed+=dt;
      drive(vehicle,{gas,brake,turn,handbrake:down('Space')},dt,(x,z,r)=>hit(x,z,r,true),damage=>{
        bodywork.dent(damage,vehicle.speed,turn || (Math.sin(time)>0?1:-1));
        audio.impact();say(damage?'Удар по кузову  ·  минус $'+damage*8:'Удар по кузову');
      });
      if(!pointer && (returnDelay-=dt)<=0 && Math.abs(vehicle.speed)>1)
        {look=damp(look,0,2,dt);pitch=damp(pitch,0,2,dt);}
    }
    updateActors(dt);
    district.update(dt,pos,phase==='drive');world.update(dt,time);gulls(time);
  }
  function updateActors(dt) {
    const elevation=(x,z)=>Math.abs(z+160)<7 && x>7 ? .16 : x>7 && x<17 ? .12 : .018;
    hero.mesh.position.set(vehicle.x,elevation(vehicle.x,vehicle.z),vehicle.z);
    hero.mesh.rotation.y=vehicle.yaw;
    hero.update(dt,vehicle.speed,vehicle.steer/.55,down('KeyS','ArrowDown','Space'));
    person.mesh.position.set(foot.x,elevation(foot.x,foot.z),foot.z);person.mesh.rotation.y=foot.yaw;
    person.update(dt,walking && phase==='foot');
    pos.copy(phase==='foot'?person.mesh.position:hero.mesh.position);
  }
  function updateCamera(dt,snap=false) {
    const car=phase!=='foot',targetYaw=car?vehicle.yaw+look:look;
    cameraYaw+=angleDiff(targetYaw,cameraYaw)*(snap?1:1-Math.exp(-5.2*dt));
    const sx=Math.sin(cameraYaw),cz=Math.cos(cameraYaw),v=Math.abs(vehicle.speed);
    const distance=car?6.55+v*.056:5.35;
    cameraEnd.set(pos.x+sx*distance,pos.y+(car?2.75:2.25)+pitch,pos.z+cz*distance);
    const nearDistance=car?1.1:.6;
    for(let offset=.65;offset<distance;offset+=.45){
      const x=pos.x+sx*offset,z=pos.z+cz*offset;
      if(world.blocks.some(b=>b.w>2.8 && b.d>2.8 && Math.abs(x-b.x)<b.w/2+.18 && Math.abs(z-b.z)<b.d/2+.18)) {
        const safe=Math.max(nearDistance,offset-.45);
        cameraEnd.x=pos.x+sx*safe;cameraEnd.z=pos.z+cz*safe;break;
      }
    }
    if (snap)camera.position.copy(cameraEnd);
    else camera.position.lerp(cameraEnd,1-Math.exp(-(car?10:12)*dt));
    cameraTarget.set(pos.x-sx*(car?5:2.7),pos.y+(car?1.1:1.25),pos.z-cz*(car?5:2.7));
    camera.lookAt(cameraTarget);
    const fov=(innerWidth<innerHeight?66:56)+(car?Math.min(6,v*.195):0);
    if(Math.abs(fov-camera.fov)>.04){camera.fov=damp(camera.fov,fov,5,dt);camera.updateProjectionMatrix();}
    sun.target.position.set(Math.round(pos.x/2)*2,0,Math.round(pos.z/2)*2-11);
    sun.position.copy(sun.target.position).add(sunOffset);
  }
  function syncHUD() {
    const footMode=phase==='foot';
    Object.assign(state,{phase,paused,muted,x:pos.x,z:pos.z,yaw:footMode?foot.yaw:vehicle.yaw,
      speed:Math.abs(vehicle.speed)*3.6,damage:vehicle.damage,elapsed,payout:1000-vehicle.damage*8,
      nearCar:carPos()<3.6,nearGoal:goalDist()<7 && inspection===0,carX:vehicle.x,carZ:vehicle.z,goalX:goal.x,goalZ:goal.z,
      distance:footMode?carPos():goalDist(),toast,title:'Ocean Drive'});
    hud.update(state);
  }
  // Parking box painted on the approach to the garage.
  const corners=[];
  for(const sx of [-1,1])for(const sz of [-1,1]){
    const x=goal.x+sx*3.5,z=goal.z+sz*2.65;
    corners.push(x-sx,.182,z,x,.182,z,x,.182,z,x,.182,z-sz);
  }
  const park=new T.LineSegments(new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(corners,3)),
    new T.LineBasicMaterial({color:0xffd483,transparent:true,opacity:.85,toneMapped:false}));
  scene.add(park);
  reset();district.update(0,pos,false);
  const [sky]=await Promise.all([new HDRLoader().loadAsync('/sky/coast.hdr'),person.ready]);
  sky.mapping=T.EquirectangularReflectionMapping;
  scene.environment=scene.background=sky;scene.backgroundIntensity=.62;
  scene.environmentIntensity=.49;
  scene.backgroundRotation.y=scene.environmentRotation.y=1.57;
  // Bake the boulevard, palms and sky into the convertible's glossy paint once.
  const probeTarget=new T.WebGLCubeRenderTarget(128,{type:T.HalfFloatType});
  const probe=new T.CubeCamera(.3,600,probeTarget);probe.position.set(vehicle.x,1.1,vehicle.z);
  hero.mesh.visible=false;person.mesh.visible=false;probe.update(renderer,scene);
  hero.mesh.visible=true;person.mesh.visible=true;
  const pmrem=new T.PMREMGenerator(renderer), reflections=pmrem.fromCubemap(probeTarget.texture);
  hero.mesh.traverse(o=>{if(o.material?.clearcoat>0 && !o.material.transparent){
    o.material.envMap=reflections.texture;o.material.envMapIntensity=1.05;
  }});
  pmrem.dispose();probeTarget.dispose();
  addWetRoad(scene);
  syncHUD();renderer.render(scene,camera);
  let previous=performance.now(),debt=0;
  loaded=true;loading.hidden=true;
  renderer.setAnimationLoop(now=>{
    const dt=Math.min(.12,Math.max(0,(now-previous)/1000));previous=now;
    if(!paused && phase!=='done') {
      debt+=dt;while(debt>=1/60){step(1/60);debt-=1/60;}
      updateCamera(dt);
    } else debt=0;
    audio.update(vehicle.speed,down('KeyW','ArrowUp'),phase==='drive',paused);
    syncHUD();renderer.render(scene,camera);
  });
}
start().catch(error=>{
  console.error(error);
  loading.hidden=false;
  loading.querySelector('span').textContent='Не удалось открыть 3D-сцену. Проверьте WebGL 2 и перезагрузите страницу.';
});
