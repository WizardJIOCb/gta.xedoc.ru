import {CITY_BOUNDS,isRegionalRoad} from './map.js';
import {TRAFFIC_INV_MASS,TRAFFIC_INV_INERTIA} from './trafficResponse.js';

const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
const FRONT_AXLE=1.25, REAR_AXLE=1.44, WHEELBASE=FRONT_AXLE+REAR_AXLE;
const YAW_INERTIA=2.16; // moment of inertia divided by vehicle mass, m²
const HULL_RADIUS=.87, HULL_PROBES=[1.27,-1.24,0];

export function settleVehicle(v) {
  Object.assign(v,{speed:0,vx:0,vz:0,steer:0,yawRate:0,bodyPitch:0,bodyRoll:0,
    pitchRate:0,rollRate:0,tireSlip:0,handbrakeAmount:0,impactDelay:0,
    frontWheelSpeed:0,rearWheelSpeed:0});
}
export function resetVehicle(v) {
  Object.assign(v,{x:5.4,z:66,yaw:0,damage:0});
  settleVehicle(v);
}

// The signed distance field isn't available at irregular shorelines. Estimate
// the local normal from the free arc around the blocked hull sample.
const searchDirections=Array.from({length:12},(_,i)=>{
  const a=i*Math.PI/6;
  return [Math.cos(a),Math.sin(a)];
});
function boundaryContact(x,z,r,hitTest,out) {
  for(const reach of [.04,.16,.55,1.3,3]){
    let dx=0,dz=0;
    for(const [cx,cz] of searchDirections){
      if(!hitTest(x+reach*cx,z+reach*cz,r)){dx+=cx;dz+=cz;}
    }
    const len=Math.hypot(dx,dz);
    if(len<.01)continue;
    out.nx=dx/len;out.nz=dz/len;
    let lo=0,hi=reach*1.4;
    for(let i=0;i<8;i++){
      const mid=(lo+hi)*.5;
      if(hitTest(x+out.nx*mid,z+out.nz*mid,r))lo=mid;else hi=mid;
    }
    out.depth=hi;
    return true;
  }
  return false;
}

function deepestContact(x,z,yaw,hitTest,out) {
  const sx=Math.sin(yaw),cz=Math.cos(yaw);
  let deepest=-1;
  const query={};
  for(const offset of HULL_PROBES){
    const px=x-sx*offset,pz=z-cz*offset;
    query.nx=0;query.nz=0;query.depth=0;query.vx=0;query.vz=0;query.target=null;
    if(!hitTest(px,pz,HULL_RADIUS,query))continue;
    if(!query.nx&&!query.nz&&!boundaryContact(px,pz,HULL_RADIUS,hitTest,query)){
      out.depth=Infinity;return true;
    }
    if(query.depth<=deepest)continue;
    deepest=query.depth;
    Object.assign(out,query);
    out.rx=px-x-HULL_RADIUS*query.nx;
    out.rz=pz-z-HULL_RADIUS*query.nz;
  }
  return deepest>=0;
}

function moveChassis(v,dt,hitTest,onImpact) {
  let x=v.x+v.vx*dt,z=v.z+v.vz*dt;
  const yaw=v.yaw+v.yawRate*dt,hit={};
  for(let pass=0;pass<5;pass++){
    if(!deepestContact(x,z,yaw,hitTest,hit)){
      v.x=x;v.z=z;v.yaw=yaw;return;
    }
    if(!Number.isFinite(hit.depth))break;
    // Normal impulse at the contact point also rotates a clipped fender.
    const {nx,nz,rx,rz}=hit;
    const other=hit.target?.response;
    const bx=other?x+rx-hit.target.model.mesh.position.x:0;
    const bz=other?z+rz-hit.target.model.mesh.position.z:0;
    const dx=v.vx+v.yawRate*rz-hit.vx-(other?other.vx+other.yawRate*bz:0);
    const dz=v.vz-v.yawRate*rx-hit.vz-(other?other.vz-other.yawRate*bx:0);
    const closing=-(dx*nx+dz*nz);
    if(closing>0){
      const arm=rz*nx-rx*nz;
      const rebound=closing>3?.13:0;
      const otherArm=bz*nx-bx*nz;
      const otherMass=other?TRAFFIC_INV_MASS+otherArm*otherArm*TRAFFIC_INV_INERTIA:0;
      const impulse=(1+rebound)*closing/(1+arm*arm/YAW_INERTIA+otherMass);
      const tx=-nz,tz=nx,tarm=rz*tx-rx*tz;
      const otherTarm=bz*tx-bx*tz;
      const tangentMass=other?TRAFFIC_INV_MASS+otherTarm*otherTarm*TRAFFIC_INV_INERTIA:0;
      const tangent=clamp(-(dx*tx+dz*tz)/(1+tarm*tarm/YAW_INERTIA+tangentMass),-.18*impulse,.18*impulse);
      const ix=nx*impulse+tx*tangent,iz=nz*impulse+tz*tangent;
      v.vx+=ix;v.vz+=iz;
      v.yawRate=clamp(v.yawRate+(arm*impulse+tarm*tangent)/YAW_INERTIA,-2.6,2.6);
      if(other)other.kick(-ix,-iz,bx,bz);
      if(closing>2.5 && !v.impactDelay){
        const damage=Math.min(100-v.damage,Math.max(1,Math.round((closing-2)*1.65)));
        v.damage+=damage;v.impactDelay=.45;
        onImpact(damage,{front:-rx*Math.sin(yaw)-rz*Math.cos(yaw),
          side:rx*Math.cos(yaw)-rz*Math.sin(yaw),speed:closing});
      }
    }
    x+=nx*(hit.depth+.001);z+=nz*(hit.depth+.001);
  }
  // A wedged hull retains the last valid pose, not an unresolved overlap.
  v.yawRate=0;
}

function integrate(v,input,dt,sand,hitTest,onImpact) {
  const sin=Math.sin(v.yaw),cos=Math.cos(v.yaw);
  const forward=-sin*v.vx-cos*v.vz,left=-cos*v.vx+sin*v.vz;
  const speed=Math.hypot(v.vx,v.vz);
  const steerTarget=input.turn*(.55/(1+.042*speed));
  v.steer+=(steerTarget-v.steer)*(1-Math.exp(-7.8*dt));
  v.handbrakeAmount+=(Number(!!input.handbrake)-v.handbrakeAmount)*
    (1-Math.exp(-(input.handbrake?15:4.5)*dt));

  // Longitudinal force and weight transfer. Braking and cornering share the
  // same available tire grip, with the rear losing most of it under handbrake.
  let driveForce=0;
  if(input.gas)driveForce+=forward<-.35?16:(input.nitro?22:9.6)/(1+.033*speed);
  if(input.brake)driveForce-=forward>.35?17:4.8;
  if((forward>0&&driveForce>0&&speed>(input.nitro?54:34))||(forward< -7&&driveForce<0))driveForce=0;
  if(sand && forward>12 && driveForce>0)driveForce*=.2;
  const rolling=(sand?3.8:.75)+v.handbrakeAmount*7.9;
  const drag=Math.sign(forward)*Math.min(Math.abs(forward)/dt,rolling+(input.nitro?.002:.0048)*forward*forward);
  const grade=input.grade || 0;
  let longitudinal=driveForce-drag-9.81*grade/Math.hypot(1,grade);
  if(input.handbrake && !input.gas && !input.brake && Math.abs(forward)<.08)longitudinal=-forward/dt;
  const friction=sand?6.4:12.4;
  const frontWeight=clamp(REAR_AXLE/WHEELBASE-longitudinal*.013,.36,.73);
  const frontGrip=friction*frontWeight*(input.brake&&forward>.35?.79:1);
  const rearGrip=friction*(1-frontWeight)*(1-v.handbrakeAmount*.83);
  const wheelSin=Math.sin(v.steer),wheelCos=Math.cos(v.steer);
  const atFront=left+v.yawRate*FRONT_AXLE;
  const frontSlip=Math.atan2(atFront*wheelCos-forward*wheelSin,
    Math.max(2.9,Math.abs(forward*wheelCos+atFront*wheelSin)));
  const rearSlip=Math.atan2(left-v.yawRate*REAR_AXLE,Math.max(2.9,Math.abs(forward)));
  const frontForce=-frontGrip*Math.tanh(frontSlip*8.1);
  const rearForce=-rearGrip*Math.tanh(rearSlip*9.2);
  longitudinal-=frontForce*wheelSin;
  const lateral=frontForce*wheelCos+rearForce;
  v.yawRate+=((FRONT_AXLE*frontForce*wheelCos-REAR_AXLE*rearForce)/YAW_INERTIA
    -(.27+1.4/(1+speed))*v.yawRate)*dt;
  const oldVx=v.vx,oldVz=v.vz;
  v.vx+=(-sin*longitudinal-cos*lateral)*dt;
  v.vz+=(-cos*longitudinal+sin*lateral)*dt;
  if(!input.gas&&!input.brake&&Math.abs(grade)<.03&&Math.hypot(v.vx,v.vz)<.035){
    v.vx=0;v.vz=0;v.yawRate=0;
  }
  v.impactDelay=Math.max(0,v.impactDelay-dt);
  moveChassis(v,dt,hitTest,onImpact);

  // Sprung-body motion follows actual acceleration, including impact pulses.
  const ax=(v.vx-oldVx)/dt,az=(v.vz-oldVz)/dt;
  const pitch=clamp((-sin*ax-cos*az)*.006,-.105,.078);
  const roll=clamp(-(-cos*ax+sin*az)*.012,-.14,.14);
  v.pitchRate+=(100*(pitch-v.bodyPitch)-13*v.pitchRate)*dt;
  v.rollRate+=(76*(roll-v.bodyRoll)-11*v.rollRate)*dt;
  v.bodyPitch+=v.pitchRate*dt;v.bodyRoll+=v.rollRate*dt;
  const slip=Math.min(1,Math.max(Math.abs(frontSlip),Math.abs(rearSlip))/.51)*Math.min(1,speed/4);
  v.tireSlip+=(slip-v.tireSlip)*(1-Math.exp(-9*dt));
  const finalSin=Math.sin(v.yaw),finalCos=Math.cos(v.yaw);
  const motion=-v.vx*finalSin-v.vz*finalCos;
  const lateralAtFront=-v.vx*finalCos+v.vz*finalSin+FRONT_AXLE*v.yawRate;
  v.frontWheelSpeed=motion*wheelCos+lateralAtFront*wheelSin;
  v.rearWheelSpeed=motion*(1-v.handbrakeAmount);
  const actual=Math.hypot(v.vx,v.vz);
  v.speed=(motion<0?-1:1)*actual;
}

export function drive(v,input,dt,hitTest,onImpact) {
  if(!(dt>0))return;
  const sand=v.z>CITY_BOUNDS.maxZ?!isRegionalRoad(v.x,v.z):v.x>18&&Math.abs(v.z+160)>7;
  // Short steps keep fast impacts and saturated axle forces stable at variable
  // frame rates; at a 60 Hz world tick this is two half-steps.
  const steps=Math.ceil(dt*100-1e-9);
  for(let i=0;i<steps;i++)integrate(v,input,dt/steps,sand,hitTest,onImpact);
}
