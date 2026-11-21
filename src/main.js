import * as T from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import {addWetRoad,addGulls} from './coast.js';
import {createBodywork} from './bodywork.js';
import { createWorld } from './world.js';
import { createCar, createPerson } from './vehicles.js';
import { createHUD } from './hud.js';
import { createAudio } from './audio.js';
import { createDistrict } from './district.js';
import { drive, resetVehicle, settleVehicle } from './handling.js';
import { createSkidMarks } from './skidMarks.js';
import { createDestruction } from './destruction.js';
import { CITY_BOUNDS, REGION_PLACES, districtName,onCanalBridge } from './map.js';
import { createAtlas,roadRoute } from './navigation.js';
import { createArsenal, clearRange } from './pulse.js';
import { createConsole } from './sandbox.js';

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
  const resize=()=>{renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.fov=innerWidth<innerHeight?66:56;camera.updateProjectionMatrix();};
  addEventListener('resize',resize);resize();
  const sun=new T.DirectionalLight(0xffb678,3.2);
  const sunOffset=new T.Vector3(50,24,-56);
  const lightRight=new T.Vector3().crossVectors(new T.Vector3(0,1,0),sunOffset).normalize();
  const lightUp=new T.Vector3().crossVectors(sunOffset,lightRight).normalize();
  sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);
  Object.assign(sun.shadow.camera,{left:-68,right:68,top:68,bottom:-68,near:.5,far:195});
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias=-.00025;sun.shadow.normalBias=.032;
  scene.add(sun,sun.target,new T.HemisphereLight(0xffddcc,0x8a829b,0.5));
  const world=createWorld(scene);
  const destruction=createDestruction(scene,world.blocks,world.groundHeight);
  const skidMarks=createSkidMarks(scene,world.groundHeight);
  const gulls=addGulls(scene);
  const hero=createCar({hero:true,color:0xa82e24});
  const bodywork=createBodywork(hero.mesh);
  const person=createPerson({color:0x28796f});
  scene.add(hero.mesh,person.mesh);
  const district=createDistrict(scene,world.blocks,world.groundHeight), audio=createAudio(), keys=new Set();
  const hit=district.hit;
  const arsenal=createArsenal(scene,person,hero,district,world);
  const cameraBlocks=world.blocks.filter(b=>b.w>2.8 && b.d>2.8).map(b=>({...b,w:b.w+.36,d:b.d+.36}));
  const lights=new T.Group();
  for(const side of [-1,1]){
    const lamp=new T.SpotLight(0xffe5bb,55,42,.36,.66,1.1);
    lamp.position.set(side*.68,.64,-1.86);lamp.target.position.set(side*1.9,0,-16);
    lights.add(lamp,lamp.target);
  }
  lights.visible=false;hero.mesh.add(lights);
  const mechanic=createPerson({color:0x996237});
  scene.add(mechanic.mesh);
  const vehicle={},foot={x:0,z:0,yaw:0}, pos=new T.Vector3();
  const cameraTarget=new T.Vector3(), cameraEnd=new T.Vector3();
  const prevVehicle={},prevFoot={};
  const savePose=(a,b)=>{a.x=b.x;a.z=b.z;a.yaw=b.yaw;a.y=b.y||0;a.bodyRoll=b.bodyRoll||0;a.bodyPitch=b.bodyPitch||0;};
  let settledArm=6,frameDebt=0,lastFootX=0,lastFootZ=0;
  let nitro=false,overcharge=false,slowmo=false,night=false,consoleOpen=false,mapOpen=false;
  let waypoint=null,nextRoute=0,route=[],remaining=0;
  const slotNames={FISTS:'Кулаки',PULSE:'Прибой',NOVA:'Нова'};
  let phase,paused,muted=false,elapsed,time=0,toast='',toastTime=0,look=0,pitch=0,cameraYaw=0,inspection=0;
  let lastBreakSound=-Infinity;
  let pointer=null,previousX=0,previousY=0,returnDelay=0,walking=false,loaded=false;
  const state={},carPos=()=>Math.hypot(vehicle.x-foot.x,vehicle.z-foot.z);
  const goalDist=()=>Math.hypot(vehicle.x-goal.x,vehicle.z-goal.z);
  function say(message,seconds=2.7) {toast=message;toastTime=seconds;}
  function setNight(value) {
    night=value;lights.visible=value;
    scene.backgroundIntensity=value?.055:.62;scene.environmentIntensity=value?.18:.49;
    scene.fog.color.setHex(value?0x303153:0xe2bbb0);
    sun.color.setHex(value?0x97abff:0xffb678);sun.intensity=value?.74:3.2;
    renderer.toneMappingExposure=value?.94:.86;
  }
  function syncPose() {
    skidMarks.lift();
    if(foot.grounded)foot.y=standingHeight(foot.x,foot.z,foot.yaw);
    savePose(prevVehicle,vehicle);savePose(prevFoot,foot);frameDebt=0;
    lastFootX=foot.x;lastFootZ=foot.z;
    nextRoute=0;
    renderActors(1,0);updateCamera(1,true);
  }
  function reset() {
    destruction.reset();lastBreakSound=-Infinity;
    skidMarks.reset();
    resetVehicle(vehicle);
    bodywork.restore();
    const start=REGION_PLACES.find(p=>p.id==='KEYS');
    Object.assign(vehicle,{x:start.x,z:start.z,yaw:start.yaw});
    Object.assign(foot,{x:start.x+2.1,z:start.z+1,yaw:1.04,y:0,vy:0,vx:0,vz:0,grounded:true});
    phase='foot';paused=false;elapsed=0;look=start.yaw+.35;cameraYaw=look;pitch=0;returnDelay=2;inspection=0;waypoint=null;
    mechanic.mesh.position.set(42,.16,-155.8);mechanic.mesh.rotation.y=1.1;
    keys.clear();walking=false;toast='';toastTime=0;
    person.mesh.visible=true;hero.setDriverVisible(false);
    nitro=overcharge=slowmo=false;setNight(false);district.reset();arsenal.reset();syncPose();
  }
  function cheat(code) {
    switch(code){
      case 'FIX':vehicle.damage=0;bodywork.restore();return 'Кузов восстановлен';
      case 'NITRO':nitro=!nitro;return nitro?'Форсаж включён':'Форсаж выключен';
      case 'OVERCHARGE':overcharge=!overcharge;return overcharge?'Усиление включено':'Обычный заряд';
      case 'SLOWMO':slowmo=!slowmo;return slowmo?'Время ×0,45':'Обычная скорость времени';
      case 'MIDNIGHT':case 'SUNSET':setNight(code==='MIDNIGHT');return night?'Полночь':'Закат';
      case 'RADIO':return audio.nextStation();
      case 'STATS':return districtName(pos.x,pos.z)+' · '+Math.round(pos.x)+', '+Math.round(pos.z)+' · кузов '+(100-vehicle.damage)+'% · '+slotNames[arsenal.mode];
      case 'KEYS':case 'GLADES':case 'OUTPOST':case 'MARINA':case 'HAVANA':case 'CANAL':case 'HOME':{
        const place=REGION_PLACES.find(p=>p.id===code);
        const [x,z,yaw]=place?[place.x,place.z,place.yaw]:{MARINA:[3,-332,.45],HAVANA:[-190,12,1.13],CANAL:[-253,70,.15],HOME:[5.4,66,0]}[code];
        settleVehicle(vehicle);Object.assign(vehicle,{x,z,yaw});
        Object.assign(foot,{x:x+2.1,z:z+1,y:0,yaw,vy:0,vx:0,vz:0,grounded:true});
        inspection=0;look=phase==='foot'?yaw:0;cameraYaw=yaw;toast='';toastTime=0;syncPose();
        return districtName(x,z);
      }
    }
  }
  const terminal=createConsole(cheat,open=>{consoleOpen=open;keys.clear();pointer=null;});
  const atlas=createAtlas(open=>{mapOpen=open;keys.clear();pointer=null;},place=>{
    waypoint=place;nextRoute=0;say('Маршрут: '+place.name);
  });
  function fire(yaw) {
    if(paused||consoleOpen||mapOpen||phase==='done'||inspection)return;
    if(!Number.isFinite(yaw))yaw=cameraYaw;
    if(phase==='foot')foot.yaw=yaw;
    const actor=phase==='foot'?foot:vehicle;
    const result=arsenal.attack({x:actor.x,z:actor.z,y:pos.y,yaw,driving:phase==='drive',power:overcharge});
    if(result){
      if(result.mode==='FISTS')audio.bump();else audio.pulse();
      if(destruction.strike(actor.x,actor.z,yaw,result.mode,overcharge))soundBreak();
    }
  }
  function soundBreak(){
    if(time-lastBreakSound<.12)return;
    lastBreakSound=time;audio.breakage();
  }
  function breakProp(block,speed,vx,vz,x,z){
    if(!destruction.hit(block,speed,vx,vz,x,z))return false;
    soundBreak();return true;
  }
  function jump(){
    if(phase==='foot' && foot.grounded && !paused && !consoleOpen&&!mapOpen){
      foot.grounded=false;foot.vy=5.25;
    }
  }
  function onAction(action) {
    audio.wake();
    if(action==='console'){if(!paused && !mapOpen && phase!=='done'&&!inspection)terminal.toggle();return;}
    if(action==='map'){
      if(!paused && !consoleOpen && phase!=='done'&&!inspection){
        const route=phase==='foot'&&!waypoint?roadRoute(vehicle.x,vehicle.z,goal.x,goal.z):state.route;
        atlas.toggle({...state,route});
      }
      return;
    }
    if(consoleOpen||mapOpen)return;
    if (action==='audio') {muted=!muted;audio.mute(muted);return;}
    if (action==='restart' && (phase==='done'||paused)) {reset();return;}
    if (phase==='done') return;
    if (action==='pause' || action==='resume') {
      paused=action==='resume'?false:!paused;keys.clear();return;
    }
    if (paused || inspection>0) return;
    if(action==='fire'){fire();return;}
    if(action==='jump'){jump();return;}
    if(action==='radio'){say(audio.nextStation());return;}
    const slots=['FISTS','PULSE','NOVA'];
    if(slots.includes(action)||action==='nextWeapon'){
      let mode=action==='nextWeapon'?slots[(slots.indexOf(arsenal.mode)+1)%slots.length]:action;
      if(mode==='FISTS'&&phase==='drive'){if(action==='nextWeapon')mode='PULSE';else{say('Кулаки доступны пешком');return;}}
      arsenal.select(mode);return;
    }
    if (action==='interact' && phase==='foot' && carPos()<3.6 && foot.grounded) {
      phase='drive';person.mesh.visible=false;hero.setDriverVisible(true);look=0;
      if(arsenal.mode==='FISTS')arsenal.select('PULSE');
      walking=false;keys.clear();syncPose();
      say('Ключи ждут у городского пирса. Маршрут на карте.',3.8);
    } else if(action==='interact' && phase==='drive'){
      if(Math.abs(vehicle.speed)>1.6){say('Остановись, чтобы выйти');return;}
      const c=Math.cos(vehicle.yaw),s=Math.sin(vehicle.yaw);
      for(const [side,back] of [[-1.55,0],[1.55,0],[0,2.8],[0,-2.8]]){
        const x=vehicle.x+c*side+s*back,z=vehicle.z-s*side+c*back;
        if(hit(x,z,.30))continue;
        Object.assign(foot,{x,z,y:0,yaw:vehicle.yaw,vx:0,vz:0,vy:0,grounded:true});
        settleVehicle(vehicle);phase='foot';look=vehicle.yaw;
        person.mesh.visible=true;hero.setDriverVisible(false);walking=false;keys.clear();syncPose();return;
      }
      say('Рядом нет места. Припаркуйся чуть дальше.');
    } else if (action==='deliver' && phase==='drive' && goalDist()<7) {
      if (Math.abs(vehicle.speed)>1.6) {say('Притормози у ворот.');return;}
      settleVehicle(vehicle);keys.clear();inspection=.001;
      say('Механик осматривает кузов…',3.2);
    }
  }
  function onKey(code,down) {
    if (down) {audio.wake();if (!paused && !consoleOpen&&!mapOpen && phase!=='done'){
      keys.add(code);if(code==='Space')jump();
    }}
    else keys.delete(code);
  }
  const hud=createHUD({onAction,onKey});
  const keyActions={KeyE:'interact',Enter:'deliver',Escape:'pause',KeyM:'audio',KeyR:'restart',KeyF:'fire',KeyV:'radio',
    Digit1:'FISTS',Digit2:'PULSE',Digit3:'NOVA'};
  const controls=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ArrowDown','ArrowRight','Space','ShiftLeft','ShiftRight']);
  addEventListener('keydown',e=>{
    if (e.metaKey||e.ctrlKey||e.altKey) return;
    if(e.code==='Backquote'){e.preventDefault();if(!e.repeat)onAction('console');return;}
    if(e.code==='Tab' && !consoleOpen && !paused && phase!=='done'){e.preventDefault();if(!e.repeat)onAction('map');return;}
    if(consoleOpen||mapOpen)return;
    if(e.code==='Enter' && e.target.closest?.('button') && (paused||phase==='done'))return;
    if (keyActions[e.code]) {e.preventDefault();if(!e.repeat)onAction(keyActions[e.code]);}
    else if(controls.has(e.code)) {
      if (e.code==='Space' && e.target.closest?.('button')) return;
      e.preventDefault();if(!e.repeat)onKey(e.code,true);
    }
  });
  addEventListener('keyup',e=>onKey(e.code,false));
  function suspend() {keys.clear();pointer=null;if(loaded && phase!=='done'&&!consoleOpen&&!mapOpen)paused=true;audio.update(0,false,false,true);}
  addEventListener('blur',suspend);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)suspend();});
  const ray=new T.Raycaster(),cursor=new T.Vector2(),aimPlane=new T.Plane(new T.Vector3(0,1,0),0),aimPoint=new T.Vector3();
  document.addEventListener('contextmenu',e=>e.preventDefault());
  view.addEventListener('pointerdown',e=>{
    if(paused||consoleOpen||mapOpen||phase==='done')return;audio.wake();
    if(e.pointerType==='mouse' && e.button===0){
      cursor.set(e.clientX/innerWidth*2-1,1-e.clientY/innerHeight*2);
      ray.setFromCamera(cursor,camera);aimPlane.constant=-(pos.y+.9);
      const point=ray.ray.intersectPlane(aimPlane,aimPoint);
      fire(point?Math.atan2(pos.x-point.x,pos.z-point.z):Math.atan2(-ray.ray.direction.x,-ray.ray.direction.z));return;
    }
    if(e.pointerType==='mouse'&&e.button!==2)return;
    e.preventDefault();pointer=e.pointerId;
    previousX=e.clientX;previousY=e.clientY;view.setPointerCapture(pointer);
  });
  view.addEventListener('pointermove',e=>{
    if(e.pointerId!==pointer)return;
    look-=(e.clientX-previousX)*.005;pitch=clamp(pitch+(e.clientY-previousY)*.008,-1.1,2.8);
    returnDelay=1.6;previousX=e.clientX;previousY=e.clientY;
  });
  for(const event of ['pointerup','pointercancel','lostpointercapture'])view.addEventListener(event,()=>{pointer=null;});
  const down=(...codes)=>codes.some(code=>keys.has(code));
  function roadGrade(x,z,yaw){
    if(z<=CITY_BOUNDS.maxZ&&!onCanalBridge(x,z,1.4))return 0;
    const dx=Math.sin(yaw)*1.25,dz=Math.cos(yaw)*1.25;
    return (world.groundHeight(x-dx,z-dz)-world.groundHeight(x+dx,z+dz))/2.5;
  }
  function standingHeight(x,z,yaw){
    const center=world.groundHeight(x,z),dx=.15*Math.cos(yaw),dz=-.15*Math.sin(yaw);
    // Support both shoe soles on a curb edge without snapping to high props.
    const sides=Math.max(world.groundHeight(x+dx,z+dz),world.groundHeight(x-dx,z-dz));
    return Math.max(center,sides-center<=.22?sides:center);
  }
  function chassisHeight(x,z){
    const h=world.groundHeight(x,z);
    return h<.035?.015:h;
  }
  function step(dt) {
    district.beginStep();savePose(prevVehicle,vehicle);savePose(prevFoot,foot);
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
      {
        const dx=-turn*Math.cos(look)-forward*Math.sin(look), dz=turn*Math.sin(look)-forward*Math.cos(look);
        const length=Math.max(1,Math.hypot(dx,dz)), pace=down('ShiftLeft','ShiftRight')?4.35:1.55;
        const response=foot.grounded?12:3;
        foot.vx=damp(foot.vx,dx*pace/length,response,dt);foot.vz=damp(foot.vz,dz*pace/length,response,dt);
        const nx=foot.x+foot.vx*dt,nz=foot.z+foot.vz*dt;
        function canWalk(x,z) {
          const c=Math.cos(vehicle.yaw),s=Math.sin(vehicle.yaw),ax=x-vehicle.x,az=z-vehicle.z;
          const nearBody=Math.abs(ax*c-az*s)<1.05 && Math.abs(ax*s+az*c)<2.23;
          return !nearBody && !hit(x,z,.28) && world.groundHeight(x,z)<=foot.y+.27;
        }
        if(canWalk(nx,foot.z))foot.x=nx;
        if(canWalk(foot.x,nz))foot.z=nz;
        const travel=Math.hypot(foot.x-prevFoot.x,foot.z-prevFoot.z);
        walking=travel>dt*.04;
        if(walking)foot.yaw+=angleDiff(Math.atan2(prevFoot.x-foot.x,prevFoot.z-foot.z),foot.yaw)*(1-Math.exp(-13*dt));
        const ground=standingHeight(foot.x,foot.z,foot.yaw);
        if(foot.grounded && foot.y-ground>.30)foot.grounded=false;
        if(foot.grounded)foot.y=ground;
        else{
          foot.vy-=14.2*dt;foot.y+=foot.vy*dt;
          if(foot.y<=ground){foot.y=ground;foot.grounded=true;foot.vy=0;audio.footstep(false,foot.x,foot.z);}
        }
      }
    } else if(phase==='drive') {
      elapsed+=dt;
      drive(vehicle,{gas,brake,turn,handbrake:down('Space'),nitro,breakProp,grade:roadGrade(vehicle.x,vehicle.z,vehicle.yaw)},dt,hit,(damage,contact)=>{
        bodywork.dent(damage,contact);
        audio.impact();say(damage?'Удар по кузову  ·  минус $'+damage*8:'Удар по кузову');
      });
      skidMarks.update(vehicle);
      if(district.hitVehicle(vehicle))audio.bump();
      if(!pointer && (returnDelay-=dt)<=0 && Math.abs(vehicle.speed)>1)
        {look=damp(look,0,2,dt);pitch=damp(pitch,0,2,dt);}
    }
    hero.update(dt,vehicle.speed,vehicle.steer/.55,down('KeyS','ArrowDown','Space'),vehicle.frontWheelSpeed,vehicle.rearWheelSpeed);
    pos.set(phase==='foot'?foot.x:vehicle.x,phase==='foot'?foot.y:0,phase==='foot'?foot.z:vehicle.z);
    district.update(dt,pos,phase==='drive',vehicle);world.update(dt,time);gulls(time);
    arsenal.update(dt);destruction.update(dt);
  }
  function renderActors(alpha,dt) {
    const mix=(a,b)=>a+(b-a)*alpha;
    const carX=mix(prevVehicle.x,vehicle.x),carZ=mix(prevVehicle.z,vehicle.z);
    hero.mesh.position.set(carX,chassisHeight(carX,carZ),carZ);
    hero.mesh.rotation.y=prevVehicle.yaw+angleDiff(vehicle.yaw,prevVehicle.yaw)*alpha;
    hero.mesh.rotation.order='YXZ';
    hero.mesh.rotation.x=Math.atan(roadGrade(carX,carZ,hero.mesh.rotation.y));
    hero.setSuspension(mix(prevVehicle.bodyPitch,vehicle.bodyPitch,alpha),mix(prevVehicle.bodyRoll,vehicle.bodyRoll,alpha));
    hero.renderWheels(alpha);
    const x=mix(prevFoot.x,foot.x),z=mix(prevFoot.z,foot.z);
    person.mesh.rotation.y=prevFoot.yaw+angleDiff(foot.yaw,prevFoot.yaw)*alpha;
    const surface=standingHeight(x,z,person.mesh.rotation.y);
    person.mesh.position.set(x,Math.max(surface,mix(prevFoot.y,foot.y)),z);
    if(phase==='foot'){
      const stride=Math.hypot(x-lastFootX,z-lastFootZ);
      const contacts=person.updateGait(dt,stride,down('ShiftLeft','ShiftRight'),!foot.grounded,foot.vy);
      if(contacts && foot.grounded)audio.footstep(down('ShiftLeft','ShiftRight'),x,z);
    }
    lastFootX=x;lastFootZ=z;
    pos.copy(phase==='foot'?person.mesh.position:hero.mesh.position);
    arsenal.pose(phase!=='foot',phase==='foot'?person.mesh.rotation.y:hero.mesh.rotation.y);
  }
  function updateCamera(dt,snap=false) {
    const car=phase!=='foot',targetYaw=car?hero.mesh.rotation.y+look:look;
    cameraYaw+=angleDiff(targetYaw,cameraYaw)*(snap?1:1-Math.exp(-5.2*dt));
    const sx=Math.sin(cameraYaw),cz=Math.cos(cameraYaw);
    const clearance=clearRange(pos.x,pos.z,sx,cz,car?6.8:5.5,cameraBlocks);
    const reach=Math.max(car?1.1:.6,clearance-.15);
    settledArm=snap||reach<settledArm?reach:damp(settledArm,reach,5,dt);
    cameraEnd.set(pos.x+sx*settledArm,pos.y+(car?2.75:2.25)+pitch,pos.z+cz*settledArm);
    camera.position.copy(cameraEnd);
    cameraTarget.set(pos.x-sx*(car?5:2.7),pos.y+(car?1.1:1.25),pos.z-cz*(car?5:2.7));
    camera.lookAt(cameraTarget);
    sun.target.position.set(pos.x,0,pos.z-11);
    // Align the directional shadow projection to its texels as the car moves.
    const texel=136/sun.shadow.mapSize.x;
    for(const axis of [lightRight,lightUp]){
      const distance=sun.target.position.dot(axis);
      sun.target.position.addScaledVector(axis,Math.round(distance/texel)*texel-distance);
    }
    sun.position.copy(sun.target.position).add(sunOffset);
  }
  function syncHUD() {
    const footMode=phase==='foot';
    const now=performance.now();
    if(now>=nextRoute){
      if(waypoint&&Math.hypot(pos.x-waypoint.x,pos.z-waypoint.z)<6){
        say('Вы на месте: '+waypoint.name);waypoint=null;
      }
      const dest=waypoint||(footMode?vehicle:goal);
      route=footMode&&!waypoint?[[pos.x,pos.z],[dest.x,dest.z]]:roadRoute(pos.x,pos.z,dest.x,dest.z);
      remaining=0;
      for(let i=1;i<route.length;i++)remaining+=Math.hypot(route[i][0]-route[i-1][0],route[i][1]-route[i-1][1]);
      nextRoute=now+180;
    }
    Object.assign(state,{phase,paused,muted,x:pos.x,z:pos.z,yaw:footMode?foot.yaw:vehicle.yaw,
      speed:Math.abs(vehicle.speed)*3.6,damage:vehicle.damage,elapsed,payout:1000-vehicle.damage*8,
      nearCar:carPos()<3.6,nearGoal:goalDist()<7 && inspection===0,carX:vehicle.x,carZ:vehicle.z,goalX:goal.x,goalZ:goal.z,
      distance:remaining,route,toast,title:districtName(pos.x,pos.z),
      weapon:slotNames[arsenal.mode],station:audio.station(),inspecting:inspection>0});
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
  reset();
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
  let previous=performance.now();
  loaded=true;loading.hidden=true;
  renderer.setAnimationLoop(now=>{
    const dt=Math.min(.12,Math.max(0,(now-previous)/1000));previous=now;
    if(!paused && !consoleOpen&&!mapOpen && phase!=='done') {
      const simDt=slowmo?dt*.45:dt;
      frameDebt+=simDt;while(frameDebt>=1/60){step(1/60);frameDebt-=1/60;}
      district.render(frameDebt*60);renderActors(frameDebt*60,simDt);
      updateCamera(dt);
    }
    audio.update(vehicle.speed,down('KeyW','ArrowUp'),phase==='drive',paused||consoleOpen||mapOpen||phase==='done',{
      walking:phase==='foot'&&walking&&foot.grounded,running:down('ShiftLeft','ShiftRight'),handbrake:down('Space'),
      steer:vehicle.steer,tireSlip:vehicle.tireSlip,x:pos.x,z:pos.z,nitro:nitro&&down('KeyW','ArrowUp'),gaitSynced:true});
    syncHUD();renderer.render(scene,camera);
  });
}
start().catch(error=>{
  console.error(error);
  loading.hidden=false;
  loading.querySelector('span').textContent='Не удалось открыть 3D-сцену. Проверьте WebGL 2 и перезагрузите страницу.';
});
