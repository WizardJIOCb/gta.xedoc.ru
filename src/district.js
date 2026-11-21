import * as T from 'three';
import { createCar, createPerson } from './vehicles.js';
import { createRagdoll } from './ragdoll.js';
import { REGION_ROADS, isTraversable } from './map.js';

// Offset loops keep traffic in its own lane through each rounded corner.
function loop(points) {
  const shape = new T.CurvePath();
  const corners = points.map(([x,z], i) => {
    const at = new T.Vector3(x,0,z);
    function inset(j) {
      const p = points[(j + points.length) % points.length];
      const offset=new T.Vector3(p[0]-x,0,p[1]-z);
      const length=offset.length();
      return offset.multiplyScalar(length>0?Math.min(.38,5/length):0).add(at);
    }
    return {at, enter:inset(i-1), exit:inset(i+1)};
  });
  corners.forEach((c,i) => {
    shape.add(new T.QuadraticBezierCurve3(c.enter,c.at,c.exit));
    shape.add(new T.LineCurve3(c.exit,corners[(i+1)%corners.length].enter));
  });
  return shape;
}

function groundHeight(x,z) {
  if(x>=7 && Math.abs(z+160)<7)return .16;
  if(x>=17)return .025;
  const avenue=Math.abs(x-Math.round(x/64)*64);
  const cross=Math.abs(z-(Math.round((z-32)/64)*64+32));
  return avenue<7 || (x<7 && cross<7) ? .025 : .16;
}

export function createDistrict(scene,blocks=[],terrainHeight=groundHeight) {
  const coast=REGION_ROADS[0];
  const circuit=coast.filter((_,i)=>i%4===0||i===coast.length-1);
  const coastLane=circuit.map(([x,z],i)=>{
    const a=circuit[(i+circuit.length-1)%circuit.length],b=circuit[(i+1)%circuit.length];
    const dx=b[0]-a[0],dz=b[1]-a[1],q=Math.hypot(dx,dz);
    return [x-2*dz/q,z+2*dx/q];
  });
  const routes = [
    loop([[3,-163],[-67,-163],[-67,99],[3,99]]),
    loop([[-3,93],[-61,93],[-61,-221],[-3,-221]]),
    loop([[-125,-35],[-67,-35],[-67,-157],[-125,-157]]),
    loop([[-195,163],[-195,-163],[-61,-163],[-61,163]]),
    loop([[-3,-227],[-131,-227],[-131,-419],[-3,-419]]),loop(coastLane)
  ];
  const routeOrder=[0,1,2,0,1,2,3,4,3,4,5,5,5];
  const cars = [0x3c6168,0xd4bd8d,0x475565,0x9b655c,0xd3d5ca,0x857c73,0x9c563f,0x244a4d,0x635a78,0x999184,0x317c80,0xc1a48e,0x854732].map((color,i) => {
    const model = createCar({color});
    const path = routes[routeOrder[i]], length = path.getLength();
    scene.add(model.mesh);
    const initialOffset=[.66,.94,.5,.30,.68,.92,.21,.23,.71,.77,.15,.49,.80][i]*length;
    const pace=6.4+i*.39;
    return {model,path,length,initialOffset,offset:initialOffset,pace,speed:pace,steer:0};
  });
  const pedestrians = [
    [-9.6,78,-1],[11.7,70,1],[-10.3,46,1],[11.2,1,-1],
    [-10.7,-67,-1],[12.2,-102,1],[-10,-137,1],[13,-194,1],[10.9,58,-1],
    [11.8,-318,1],[-10.6,-370,-1],[-181.2,2,-1],[-201.3,73,1],[-246.7,123,-1],[-73.4,-318,1],
    [158,405,-1],[168,422,1],[-205,452,1],[-74,587,-1],[-97,588,1]
  ].map(([x,z,dir],i) => {
    const model = createPerson({color:[0xc88861,0x1c6577,0xd6c8a2,0xa75d63,0x7a9488][i%5]});
    model.mesh.position.set(x,0.16,z);
    scene.add(model.mesh);
    model.mesh.rotation.y=dir>0?Math.PI:0;
    return {model,origin:z,anchorX:x,dir,spawn:{x,z,dir},pace:.83+i%3*.15,
      speed:0,gaitSpeed:0,rag:null,recovery:null,cooldown:0};
  });
  const agents=[...cars,...pedestrians];
  for(const a of agents){
    const mesh=a.model.mesh;
    a.prevPosition=mesh.position.clone();a.position=mesh.position.clone();
    a.prevRotation=mesh.quaternion.clone();a.rotation=mesh.quaternion.clone();
  }
  let rendered=false,simTime=0,lastStep=0,animationTime=0;
  function beginStep(){
    if(!rendered)return;
    for(const a of agents){
      a.model.mesh.position.copy(a.position);a.model.mesh.quaternion.copy(a.rotation);
    }
    rendered=false;
  }
  function update(dt, player, driving) {
    beginStep();simTime+=dt;lastStep=dt;
    for(const a of agents){a.prevPosition.copy(a.position);a.prevRotation.copy(a.rotation);}
    for (const car of cars) {
      const p = car.model.mesh.position, h = car.model.mesh.rotation.y;
      const dx=player.x-p.x, dz=player.z-p.z;
      const forward=-dx*Math.sin(h)-dz*Math.cos(h);
      const yieldToPlayer = forward > -0.3 && forward < (driving?8:6) &&
        Math.abs(dx*Math.cos(h)-dz*Math.sin(h)) < 2.1;
      car.speed=T.MathUtils.damp(car.speed,yieldToPlayer?0:car.pace,yieldToPlayer?4.5:1.6,dt);
      if(yieldToPlayer && (car.speed<.05 || forward<3))car.speed=0;
      const speed=car.speed;
      car.offset = (car.offset + speed*dt)%car.length;
      const t=car.offset/car.length;
      car.path.getPoint(t,p);
      p.y=terrainHeight(p.x,p.z);
      const ahead=car.path.getPoint(((car.offset+0.4)%car.length)/car.length);
      const heading=Math.atan2(p.x-ahead.x,p.z-ahead.z);
      car.model.mesh.rotation.y=heading;
      if(speed>0){
        const future=car.path.getPoint(((car.offset+1.4)%car.length)/car.length);
        const next=Math.atan2(ahead.x-future.x,ahead.z-future.z);
        const bend=Math.atan2(Math.sin(next-heading),Math.cos(next-heading));
        car.steer=T.MathUtils.clamp(Math.atan(2.6*bend/.7)/.44,-1,1);
      }
      car.model.update(dt,speed,car.steer,yieldToPlayer);
    }
    for (const ped of pedestrians) {
      const obj=ped.model.mesh;
      ped.cooldown=Math.max(0,ped.cooldown-dt);
      if(ped.rag){
        ped.rag.update(dt);
        const center=ped.rag.center;
        const clear=(!driving || Math.hypot(center.x-player.x,center.z-player.z)>3) &&
          !allCars.some(({model})=>Math.hypot(center.x-model.mesh.position.x,center.z-model.mesh.position.z)<2.7);
        if(ped.rag.age>=3.5 && clear){
          ped.recovery=ped.rag.release();ped.rag=null;ped.origin=obj.position.z;ped.anchorX=obj.position.x;
          ped.speed=ped.gaitSpeed=0;ped.cooldown=1.4;
        }
        continue;
      }
      if(ped.recovery){
        if(ped.recovery.update(dt))ped.recovery=null;
        continue;
      }
      // Near the end, shorten the stride before turning. Heading is continuous
      // across the reversal and the next stride ramps up as the body aligns.
      const remaining=8-ped.dir*(obj.position.z-ped.origin);
      if(remaining<.18)ped.dir*=-1;
      const desired=ped.dir>0?Math.PI:0;
      const error=Math.atan2(Math.sin(desired-obj.rotation.y),Math.cos(desired-obj.rotation.y));
      obj.rotation.y+=Math.max(-3.4*dt,Math.min(3.4*dt,error));
      const clearance=Math.hypot(obj.position.x-player.x,obj.position.z-player.z);
      const free=T.MathUtils.smoothstep(clearance,1.8,4.3);
      const alignment=Math.max(0,Math.cos(error));
      const target=ped.pace*free*alignment*(.32+.68*T.MathUtils.smoothstep(remaining,0,1.2));
      ped.speed=T.MathUtils.damp(ped.speed,target,4.2,dt);
      const nx=T.MathUtils.damp(obj.position.x,ped.anchorX,.75,dt)-Math.sin(obj.rotation.y)*ped.speed*dt;
      const nz=obj.position.z-Math.cos(obj.rotation.y)*ped.speed*dt;
      if(!isTraversable(nx,nz,.23)||blocks.some(b=>Math.abs(nx-b.x)<b.w/2+.23 && Math.abs(nz-b.z)<b.d/2+.23)){
        if(alignment>.8)ped.dir*=-1;
        ped.gaitSpeed=0;
      }else{
        ped.gaitSpeed=dt?Math.hypot(nx-obj.position.x,nz-obj.position.z)/dt:0;
        obj.position.set(nx,terrainHeight(nx,nz),nz);
      }
    }
    for(const a of agents){
      a.position.copy(a.model.mesh.position);a.rotation.copy(a.model.mesh.quaternion);
      if(!dt){a.prevPosition.copy(a.position);a.prevRotation.copy(a.rotation);}
    }
  }
  function render(alpha){
    alpha=T.MathUtils.clamp(alpha,0,1);
    const at=simTime-(1-alpha)*lastStep;
    const dt=T.MathUtils.clamp(at-animationTime,0,.15);animationTime=at;
    for(const a of agents){
      a.model.mesh.position.lerpVectors(a.prevPosition,a.position,alpha);
      a.model.mesh.quaternion.slerpQuaternions(a.prevRotation,a.rotation,alpha);
    }
    for(const car of cars)car.model.renderWheels(alpha);
    for(const p of pedestrians){
      if(!p.rag && !p.recovery)p.model.update(dt,p.gaitSpeed>.075,p.gaitSpeed);
    }
    rendered=true;
  }
  const parked=[[-5.6,56,0xb37446],[-5.7,48,0x638382],[-5.65,-8,0xc7bda9],
    [-5.65,-66,0x492a2d],[-5.7,-122,0x394b55],[-197.7,71,0x9b8a75],
    [-261.7,-75,0x526e72],[-5.7,-315,0x446071]].map(([x,z,color])=>{
    const model=createCar({color});
    model.mesh.position.set(x,terrainHeight(x,z),z);model.mesh.rotation.y=Math.PI;
    scene.add(model.mesh);
    return {model};
  });
  const allCars=[...cars,...parked];
  function knock(ped,velocity){
    if(ped.rag || ped.recovery || ped.cooldown>0)return 0;
    const p=ped.model.mesh.position;
    const nearby=blocks.filter(b=>Math.abs(p.x-b.x)<b.w/2+20 && Math.abs(p.z-b.z)<b.d/2+20);
    ped.rag=createRagdoll(ped.model,velocity,terrainHeight,nearby);
    return 1;
  }
  function hitVehicle(vehicle){
    const speed=Math.hypot(vehicle.vx,vehicle.vz);
    if(speed<.7)return 0;
    const sin=Math.sin(vehicle.yaw), cos=Math.cos(vehicle.yaw);
    let count=0;
    for(const ped of pedestrians){
      const p=ped.model.mesh.position,dx=p.x-vehicle.x,dz=p.z-vehicle.z;
      const side=dx*cos-dz*sin;
      if(Math.abs(side)>1.19 || Math.abs(dx*sin+dz*cos)>2.40)continue;
      const lateral=Math.sign(side||1)*1.3;
      const shove=Math.min(10,1.3+speed*.40);
      count+=knock(ped,new T.Vector3(vehicle.vx/speed*shove+cos*lateral,
        Math.min(4.5,1.05+speed*.15),vehicle.vz/speed*shove-sin*lateral));
    }
    return count;
  }
  function pulse(x,z,dx,dz,range,canReach,{cone=.79,strength=1,lift=3.4,maxHits=Infinity}={}){
    const length=Math.hypot(dx,dz);
    if(!length || range<=0)return 0;
    const targets=[];
    for(const ped of pedestrians){
      const p=ped.model.mesh.position,ax=p.x-x,az=p.z-z,d=Math.hypot(ax,az);
      const forward=(ax*dx+az*dz)/length;
      if(ped.rag || ped.recovery || ped.cooldown>0 || d>range || forward<d*cone ||
        (canReach && !canReach(p.x,p.z)))continue;
      targets.push({ped,ax,az,d});
    }
    targets.sort((a,b)=>a.d-b.d);
    let count=0;
    for(const {ped,ax,az,d} of targets){
      const push=(4.3+(1-d/range)*3.9)*strength;
      count+=knock(ped,new T.Vector3(d>.001?ax/d*push:dx/length*push,lift,d>.001?az/d*push:dz/length*push));
      if(count>=maxHits)break;
    }
    return count;
  }
  function reset(){
    beginStep();simTime=lastStep=animationTime=0;
    for(const car of cars){car.offset=car.initialOffset;car.steer=0;car.speed=car.pace;}
    for(const ped of pedestrians){
      ped.rag?.restore();ped.recovery?.restore();ped.rag=ped.recovery=null;
      ped.dir=ped.spawn.dir;ped.origin=ped.spawn.z;ped.anchorX=ped.spawn.x;
      ped.cooldown=ped.speed=ped.gaitSpeed=0;
      ped.model.mesh.position.set(ped.spawn.x,terrainHeight(ped.spawn.x,ped.spawn.z),ped.spawn.z);
      ped.model.mesh.rotation.set(0,ped.dir>0?Math.PI:0,0);ped.model.update(0,false);
    }
    update(0,new T.Vector3(1e6,0,1e6),false);
  }
  return {cars:allCars,pedestrians,beginStep,update,render,hitVehicle,pulse,reset};
}
