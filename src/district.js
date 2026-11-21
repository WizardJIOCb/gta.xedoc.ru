import * as T from 'three';
import { createCar, createPerson } from './vehicles.js';
import { TrafficResponse,trafficFootprintClear } from './trafficResponse.js';
import { createContactQuery } from './collision.js';
import { createRagdoll } from './ragdoll.js';
import { setCarVolume } from './vehicleContact.js';
import { REGION_ROADS, CITY_BOUNDS, onCanalBridge } from './map.js';

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

// Distance-indexed corner speeds. Propagate braking distances backwards so
// drivers start slowing on the straight, including across the loop seam.
function cornerSpeeds(path) {
  const length=path.getLength(),count=Math.ceil(length/2),spacing=length/count;
  const points=Array.from({length:count},(_,i)=>path.getPoint(i/count));
  const speeds=new Float32Array(count);
  for(let i=0;i<count;i++){
    const a=points[(i+count-1)%count],b=points[i],c=points[(i+1)%count];
    const ax=b.x-a.x,az=b.z-a.z,bx=c.x-b.x,bz=c.z-b.z;
    const bend=Math.abs(Math.atan2(ax*bz-az*bx,ax*bx+az*bz));
    speeds[i]=Math.min(16,Math.sqrt(3.4*spacing/Math.max(.001,bend)));
  }
  for(let j=2*count-1;j>=0;j--){
    const i=j%count,next=speeds[(i+1)%count];
    speeds[i]=Math.min(speeds[i],Math.sqrt(next*next+2*3.5*spacing));
  }
  return distance=>{
    const t=distance/spacing,i=Math.floor(t);
    return T.MathUtils.lerp(speeds[i%count],speeds[(i+1)%count],t-i);
  };
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
    loop([[-3,-227],[-131,-227],[-131,-419],[-3,-419]]),loop(coastLane),
    loop([[-258,-158],[-319,-158],[-319,94],[-258,94]])
  ];
  const routeOrder=[0,1,2,0,1,2,3,4,3,4,5,5,5,6];
  const limits=routes.map(cornerSpeeds);
  const cars = [0x3c6168,0xd4bd8d,0x475565,0x9b655c,0xd3d5ca,0x857c73,0x9c563f,0x244a4d,0x635a78,0x999184,0x317c80,0xc1a48e,0x854732,0xd6c08f].map((color,i) => {
    const model = createCar({color});
    const path = routes[routeOrder[i]], length = path.getLength();
    scene.add(model.mesh);
    const initialOffset=[.66,.94,.5,.30,.68,.92,.21,.23,.71,.77,.15,.49,.80,.24][i]*length;
    const pace=6.4+i*.39;
    return {model,path,length,cornerSpeed:limits[routeOrder[i]],initialOffset,offset:initialOffset,pace,speed:pace,steer:0,response:new TrafficResponse()};
  });
  const pedestrians = [
    [-9.6,78,-1],[11.7,70,1],[-10.3,46,1],[11.2,1,-1],
    [-10.7,-67,-1],[12.2,-102,1],[-10,-137,1],[13,-194,1],[10.9,58,-1],
    [11.8,-318,1],[-10.6,-370,-1],[-181.2,2,-1],[-201.3,73,1],[-246.7,123,-1],[-73.4,-318,1],
    [158,405,-1],[168,422,1],[-205,452,1],[-74,587,-1],[-97,588,1],[-313,53,-1],[-271,23,1]
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
    // Quaternions are interpolated for rendering. In YXZ, reading yaw back
    // also stays valid for headings facing south (beyond +/- 90 degrees).
    mesh.rotation.order='YXZ';
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
  function update(dt, player, driving, playerVehicle) {
    beginStep();simTime+=dt;lastStep=dt;
    if(playerVehicle&&!driving)setCarVolume(heroVolume,playerVehicle.x,terrainHeight(playerVehicle.x,playerVehicle.z),
      playerVehicle.z,playerVehicle.yaw,0,0,true);
    for(const a of agents){a.prevPosition.copy(a.position);a.prevRotation.copy(a.rotation);}
    for (const car of cars) {
      const p = car.model.mesh.position, h = car.response.lastYaw;
      const dx=player.x-p.x, dz=player.z-p.z;
      const forward=-dx*Math.sin(h)-dz*Math.cos(h);
      const gap=forward-(driving?4.9:3.0);
      const yieldToPlayer=forward>-.3&&forward<24&&Math.abs(dx*Math.cos(h)-dz*Math.sin(h))<2.1;
      const target=Math.min(car.pace,car.cornerSpeed(car.offset),yieldToPlayer?Math.sqrt(7*Math.max(0,gap)):Infinity);
      car.speed+=T.MathUtils.clamp(target-car.speed,-4.2*dt,2.25*dt);
      if(car.response.blocked)car.speed=0;
      if(dt>0&&yieldToPlayer)car.speed=Math.min(car.speed,Math.max(0,gap)/dt);
      const speed=car.speed;
      car.offset = (car.offset + speed*dt)%car.length;
      const t=car.offset/car.length;
      car.path.getPoint(t,p);
      const ahead=car.path.getPoint(((car.offset+1.3)%car.length)/car.length);
      const back=car.path.getPoint(((car.offset-1.3+car.length)%car.length)/car.length);
      const heading=Math.atan2(back.x-ahead.x,back.z-ahead.z);
      if(speed>0){
        const frontYaw=Math.atan2(p.x-ahead.x,p.z-ahead.z),rearYaw=Math.atan2(back.x-p.x,back.z-p.z);
        const bend=Math.atan2(Math.sin(frontYaw-rearYaw),Math.cos(frontYaw-rearYaw));
        car.steer=T.MathUtils.clamp(Math.atan(2.6*bend/1.3)/.44,-1,1);
      }
      const yaw=car.response.pose(dt,p,heading,speed,(x,z,h)=>
        trafficFootprintClear(x,z,h,car,hit,player,driving,playerVehicle?.yaw||0,pedestrians));
      let grade=0;
      if(p.z>CITY_BOUNDS.maxZ||onCanalBridge(p.x,p.z,1.4)){
        const sx=Math.sin(yaw)*1.3,sz=Math.cos(yaw)*1.3;
        grade=Math.atan2(terrainHeight(p.x-sx,p.z-sz)-terrainHeight(p.x+sx,p.z+sz),2.6);
      }
      car.model.mesh.rotation.set(grade,yaw,0,'YXZ');p.y=terrainHeight(p.x,p.z);
      setCarVolume(car.volume,p.x,p.y,p.z,yaw,car.response.worldVX,car.response.worldVZ);
      car.model.update(dt,car.response.wheelSpeed,car.steer,car.speed>target+.1||(yieldToPlayer&&gap<1)||car.response.blocked);
    }
    for (const ped of pedestrians) {
      const obj=ped.model.mesh;
      ped.cooldown=Math.max(0,ped.cooldown-dt);
      if(dt>0 && !ped.rag&&!ped.cooldown){
        for(const car of cars)if(strike(ped,car.volume))break;
      }
      if(ped.rag){
        const center=ped.rag.center;
        const nearby=volumes.filter(car=>Math.abs(car.x-center.x)<4 && Math.abs(car.z-center.z)<4);
        if((driving||playerVehicle)&&Math.abs(heroVolume.x-center.x)<4&&Math.abs(heroVolume.z-center.z)<4)nearby.push(heroVolume);
        ped.rag.update(dt,nearby);
        const clear=!nearby.some(car=>{
          const dx=center.x-car.x,dz=center.z-car.z;
          return Math.abs(dx*car.cos-dz*car.sin)<1.34&&Math.abs(dx*car.sin+dz*car.cos)<2.57;
        });
        if(ped.rag.settled && clear){
          ped.recovery=ped.rag.release();ped.rag=null;ped.origin=obj.position.z;ped.anchorX=obj.position.x;
          ped.prevPosition.copy(obj.position);
          ped.speed=ped.gaitSpeed=0;ped.cooldown=.2;
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
      if(hit(nx,nz,.23)){
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
      if(p.rag)p.rag.render?.(alpha);
      else if(!p.recovery)p.model.update(dt,p.gaitSpeed>.075,p.gaitSpeed);
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
  const hit=createContactQuery(blocks,allCars);
  const volumes=allCars.map(car=>{
    const {position:p,rotation}=car.model.mesh;
    car.volume=setCarVolume({},p.x,p.y,p.z,rotation.y,0,0);return car.volume;
  });
  const heroVolume=setCarVolume({},Infinity,0,Infinity,0,0,0,true);
  function knock(ped,velocity,contact){
    if(ped.cooldown>0)return 0;
    if(ped.rag){ped.rag.impulse(velocity,contact);ped.cooldown=.32;return 1;}
    if(ped.recovery){ped.recovery.interrupt();ped.recovery=null;}
    const heading=ped.model.mesh.rotation.y;
    const walking=new T.Vector3(-Math.sin(heading)*ped.speed,0,-Math.cos(heading)*ped.speed);
    ped.rag=createRagdoll(ped.model,velocity,terrainHeight,blocks,contact,walking);ped.cooldown=.32;
    return 1;
  }
  function strike(ped,car){
    if(ped.rag||ped.cooldown>0)return 0;
    const p=ped.model.mesh.position,dx=p.x-car.x,dz=p.z-car.z;
    if(Math.abs(dx)>2.7||Math.abs(dz)>2.7||Math.abs(p.y-car.y)>.85)return 0;
    const speed=Math.hypot(car.vx,car.vz);
    if(speed<1)return 0;
    const side=dx*car.cos-dz*car.sin,along=dx*car.sin+dz*car.cos;
    const localX=T.MathUtils.clamp(side,-.90,.90),localZ=T.MathUtils.clamp(along,-2.13,2.13);
    const gap=Math.hypot(side-localX,along-localZ);
    if(gap>.27)return 0;
    const worldX=car.x+localX*car.cos+localZ*car.sin,worldZ=car.z-localX*car.sin+localZ*car.cos;
    const nx=gap>.001?(p.x-worldX)/gap:car.vx/speed,nz=gap>.001?(p.z-worldZ)/gap:car.vz/speed;
    const approach=nx*car.vx+nz*car.vz;
    if(approach<-.3)return 0;
    const normalSpeed=Math.min(9,.55*Math.max(approach,0));
    const carry=Math.min(.30,5/speed);
    const lift=Math.min(3.4,.26+Math.max(approach,0)*.13);
    const impulse=new T.Vector3(car.vx*carry+nx*normalSpeed,lift,car.vz*carry+nz*normalSpeed);
    // At walking speed the pedestrian can turn a shoulder and stumble aside.
    const sidestep=(Math.sign(side)||ped.dir)*1.35*(1-T.MathUtils.smoothstep(speed,2,7));
    impulse.x+=car.cos*sidestep;impulse.z-=car.sin*sidestep;
    const point=new T.Vector3(p.x-.18*nx,car.y+.53,p.z-.18*nz);
    return knock(ped,impulse,point);
  }
  function hitVehicle(vehicle){
    setCarVolume(heroVolume,vehicle.x,terrainHeight(vehicle.x,vehicle.z),vehicle.z,vehicle.yaw,vehicle.vx,vehicle.vz,true);
    let count=0;for(const ped of pedestrians)count+=strike(ped,heroVolume);return count;
  }
  function pulse(x,z,dx,dz,range,canReach,{cone=.79,strength=1,lift=3.4,maxHits=Infinity}={}){
    const length=Math.hypot(dx,dz);
    if(!length || range<=0)return 0;
    const targets=[];
    for(const ped of pedestrians){
      const p=ped.rag?.center||ped.model.mesh.position,ax=p.x-x,az=p.z-z,d=Math.hypot(ax,az);
      const forward=(ax*dx+az*dz)/length;
      if(ped.cooldown>0 || d>range || forward<d*cone ||
        (canReach && !canReach(p.x,p.z)))continue;
      targets.push({ped,ax,az,d});
    }
    targets.sort((a,b)=>a.d-b.d);
    let count=0;
    for(const {ped,ax,az,d} of targets){
      const push=(4.3+(1-d/range)*3.9)*strength;
      const pushX=d>.001?ax/d:dx/length,pushZ=d>.001?az/d:dz/length;
      const p=ped.rag?.center||ped.model.mesh.position;
      const point=new T.Vector3(p.x-.12*pushX,p.y+(ped.rag ? .05 : 1.20),p.z-.12*pushZ);
      count+=knock(ped,new T.Vector3(pushX*push,lift,pushZ*push),point);
      if(count>=maxHits)break;
    }
    return count;
  }
  function reset(){
    heroVolume.x=heroVolume.z=Infinity;
    beginStep();simTime=lastStep=animationTime=0;
    for(const car of cars){car.offset=car.initialOffset;car.steer=0;car.speed=Math.min(car.pace,car.cornerSpeed(car.offset));car.response.reset();}
    for(const ped of pedestrians){
      ped.rag?.restore();ped.recovery?.restore();ped.rag=ped.recovery=null;
      ped.dir=ped.spawn.dir;ped.origin=ped.spawn.z;ped.anchorX=ped.spawn.x;
      ped.cooldown=ped.speed=ped.gaitSpeed=0;
      ped.model.mesh.position.set(ped.spawn.x,terrainHeight(ped.spawn.x,ped.spawn.z),ped.spawn.z);
      ped.model.mesh.rotation.set(0,ped.dir>0?Math.PI:0,0);ped.model.update(0,false);
    }
    update(0,new T.Vector3(1e6,0,1e6),false);
  }
  return {cars:allCars,pedestrians,beginStep,update,render,hit,hitVehicle,pulse,reset};
}
