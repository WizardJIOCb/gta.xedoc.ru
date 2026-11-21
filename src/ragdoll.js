import * as T from 'three';
import {carContact} from './vehicleContact.js';

// Articulated point masses are sampled in the current animation pose. Torso
// braces preserve its volume while the articulated legs follow the pelvis.
const sides = ['Left', 'Right'];
const chains = [
  ['Hips','Head'], ['Head','Crown'],
  ...sides.flatMap(s => [[s+'UpLeg',s+'Leg'],[s+'Leg',s+'Foot'],[s+'Foot',s+'ToeBase'],
    [s+'Arm',s+'ForeArm'],[s+'ForeArm',s+'Hand']])
];
const radii = {Hips:.17, Head:.13, Crown:.105, UpLeg:.11, Leg:.09, Foot:.08, ToeBase:.055, Arm:.10, ForeArm:.073, Hand:.065};
const v = () => new T.Vector3();
const quaternion = () => new T.Quaternion();
function torsoFrame(points) {
  const x=v().subVectors(points.RightArm.pos,points.LeftArm.pos).normalize();
  const up=v().addVectors(points.LeftArm.pos,points.RightArm.pos).multiplyScalar(.5).sub(points.Hips.pos);
  const z=v().crossVectors(x,up).normalize();
  const y=v().crossVectors(z,x);
  return quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x,y,z));
}

// An asset arriving late keeps falling with the existing fallback mesh.
function fallback(model, velocity, floor, obstacles) {
  const root=model.mesh, initial=root.quaternion.clone(), motion=velocity.clone();
  const axis=v().set(motion.z,0,-motion.x).normalize();
  if(!axis.lengthSq())axis.set(1,0,0);
  const base=root.position.clone();
  let tilt=0,age=0,rest=0;
  const correction=v();
  return {
    center:base,
    get age(){return age;},
    get settled(){return rest>.55 && age>1.45;},
    impulse(velocity){motion.add(velocity).clampLength(0,18);rest=0;},
    update(dt,cars=[]){
      age+=dt;motion.y-=11.3*dt;base.addScaledVector(motion,dt);
      tilt=Math.min(1.48,tilt+dt*4);
      const surface=floor(base.x,base.z)+.12;
      if(base.y<=surface){base.y=surface;motion.y=0;motion.multiplyScalar(Math.exp(-7*dt));}
      let onCar=false;
      for(const car of cars)if(carContact(car,base,.13,correction)){
        base.add(correction);motion.x+=(car.vx-motion.x)*.22;motion.z+=(car.vz-motion.z)*.22;onCar=true;
      }
      for(const wall of obstacles){
        if(wall.breakable?.broken)continue;
        const dx=base.x-wall.x,dz=base.z-wall.z;
        const ox=wall.w/2+.16-Math.abs(dx),oz=wall.d/2+.16-Math.abs(dz);
        if(ox<=0||oz<=0)continue;
        if(ox<oz){base.x+=Math.sign(dx||1)*ox;motion.x=0;}
        else{base.z+=Math.sign(dz||1)*oz;motion.z=0;}
      }
      rest=!onCar&&base.y<=surface+.01&&motion.lengthSq()<.06?rest+dt:0;
      root.position.copy(base);root.quaternion.setFromAxisAngle(axis,tilt).multiply(initial);
    },
    release(){
      const from=root.quaternion.clone();let rising=0;
      return {
        interrupt(){},
        restore(){root.quaternion.copy(initial);},
        update(dt){
          rising+=dt;
          const t=T.MathUtils.smoothstep(rising,0,1.18);
          root.quaternion.slerpQuaternions(from,initial,t);
          root.position.y=floor(base.x,base.z)+.12*(1-t);
          return t>=1;
        }
      };
    },
    restore(){root.quaternion.copy(initial);}
  };
}

export function createRagdoll(model, velocity, floor, obstacles=[], contact=null, walking=null) {
  const root=model.mesh, bones={}, skins=[];
  root.traverse(node=>{
    if(node.isBone)bones[node.name.replace(/^mixamorig[:_]?/,'')]=node;
    if(node.isSkinnedMesh)skins.push(node);
  });
  const names=[...new Set(chains.flat())];
  if(names.some(n=>n!=='Crown' && !bones[n]))return fallback(model,velocity,floor,obstacles);
  // SkinnedMesh caches a bound from the standing pose. While the simulated
  // hips travel outside it that bound would incorrectly cull visible bodies.
  const culling=skins.map(mesh=>mesh.frustumCulled);
  skins.forEach(mesh=>{mesh.frustumCulled=false;});
  root.updateWorldMatrix(true,true);
  const points={};
  const pelvis=bones.Hips.getWorldPosition(v());
  const hit=contact||pelvis.clone().add(new T.Vector3(0,.24,0));
  const spin=v().crossVectors(v().subVectors(hit,pelvis),velocity).multiplyScalar(1.65).clampLength(0,8.5);
  for(const name of names){
    const p=(bones[name]||bones.Head).getWorldPosition(v());
    if(name==='Crown')p.y+=.17;
    const suffix=name.replace(/^(Left|Right)/,'');
    const proximity=Math.exp(-p.distanceToSquared(hit)/.24);
    const incoming=velocity.clone().multiplyScalar(.63+.53*proximity);
    incoming.add(v().crossVectors(spin,v().subVectors(p,pelvis)));
    if(walking)incoming.add(walking);
    points[name]={pos:p,previous:p.clone().addScaledVector(incoming,-1/60),last:p.clone(),display:p.clone(),
      radius:radii[suffix],invMass:suffix==='Hips'?.42:suffix==='Head'?.65:1};
  }
  const links=[];
  function connect(a,b,min=1,max=1){
    const p=points[a],q=points[b],length=p.pos.distanceTo(q.pos);
    links.push({p,q,min:length*min,max:length*max});
  }
  for(const [a,b] of chains)connect(a,b);
  const core=['Hips','LeftArm','RightArm','LeftUpLeg','RightUpLeg','Head'];
  for(let a=0;a<core.length;a++)for(let b=a+1;b<core.length;b++){
    if(core[a]==='Hips' && core[b]==='Head')continue;
    connect(core[a],core[b]);
  }
  function flex(a,b,c,minAngle,maxAngle){
    const p=points[a],q=points[c],u=p.pos.distanceTo(points[b].pos),w=q.pos.distanceTo(points[b].pos);
    const reach=deg=>Math.sqrt(u*u+w*w-2*u*w*Math.cos(deg*Math.PI/180));
    links.push({p,q,min:reach(minAngle),max:reach(maxAngle)});
  }
  for(const s of sides){
    flex(s+'UpLeg',s+'Leg',s+'Foot',48,177);
    flex(s+'Leg',s+'Foot',s+'ToeBase',65,145);
    flex(s+'Arm',s+'ForeArm',s+'Hand',30,172);
    connect(s+'Arm','Crown',.77,1.2);
    for(const [a,b] of [[s+'Hand','Head'],[s+'ForeArm','Hips'],[s+'Foot','Hips']]){
      const p=points[a],q=points[b];
      links.push({p,q,min:p.radius+q.radius,max:Infinity});
    }
  }
  const startFrame=torsoFrame(points).invert();
  const right=v(),up=v(),forward=v(),thigh=v(),axis=v(),pole=v(),target=v();
  function bodyAxes(){
    right.subVectors(points.RightArm.pos,points.LeftArm.pos).normalize();
    up.addVectors(points.RightArm.pos,points.LeftArm.pos).multiplyScalar(.5).sub(points.Hips.pos);
    forward.crossVectors(right,up).normalize();
    up.crossVectors(forward,right).normalize();
  }
  bodyAxes();
  const toeDirection=v();
  for(const s of sides)toeDirection.add(thigh.subVectors(points[s+'ToeBase'].pos,points[s+'Foot'].pos));
  const facing=toeDirection.dot(forward)<0?-1:1;
  const legs=sides.map(s=>({hip:points[s+'UpLeg'].pos,knee:points[s+'Leg'].pos,foot:points[s+'Foot'].pos,
    side:s==='Right'?1:-1,length:points[s+'UpLeg'].pos.distanceTo(points[s+'Leg'].pos)}));
  const chest=v(),away=v();
  const arms=sides.flatMap(s=>[points[s+'ForeArm'],points[s+'Hand']]);
  function limitLimbs(){
    bodyAxes();
    forward.multiplyScalar(facing);
    // Keep wrists and elbows outside the capsule between the hips and chest.
    chest.addVectors(points.LeftArm.pos,points.RightArm.pos).multiplyScalar(.5).sub(points.Hips.pos);
    for(const p of arms){
      away.subVectors(p.pos,points.Hips.pos);
      const t=T.MathUtils.clamp(away.dot(chest)/Math.max(.001,chest.lengthSq()),0,1);
      away.addScaledVector(chest,-t);
      const d=away.length(),clearance=.115+.035*t+p.radius;
      if(d>.0001&&d<clearance)p.pos.addScaledVector(away,(clearance-d)*.78/d);
    }
    for(const {hip,knee,foot,side,length} of legs){
      thigh.subVectors(knee,hip).normalize();
      const pitch=Math.atan2(thigh.dot(forward),-thigh.dot(up));
      const spread=Math.asin(T.MathUtils.clamp(thigh.dot(right)*side,-1,1));
      const bend=T.MathUtils.clamp(pitch,-.63,1.65),out=T.MathUtils.clamp(spread,-.16,.93);
      if(bend!==pitch||out!==spread){
        target.copy(hip).addScaledVector(right,side*length*Math.sin(out))
          .addScaledVector(forward,length*Math.sin(bend)*Math.cos(out))
          .addScaledVector(up,-length*Math.cos(bend)*Math.cos(out));
        knee.lerp(target,.55);
      }
      // Knees flex forward relative to the hip-to-ankle line, including
      // when the entire character has rolled onto their back or side.
      axis.subVectors(foot,hip).normalize();
      pole.copy(forward).addScaledVector(right,side*.15);
      pole.addScaledVector(axis,-pole.dot(axis));
      if(pole.lengthSq()<.04)continue;
      pole.normalize();
      const offset=thigh.subVectors(knee,hip).dot(pole);
      if(offset<0)knee.addScaledVector(pole,-offset*.76);
    }
  }
  const initialHipsRotation=bones.Hips.getWorldQuaternion(quaternion());
  const rotations=chains.filter(([name])=> name!=='Hips').map(([name,end])=>({
    bone:bones[name],a:points[name],b:points[end],
    dir:v().subVectors(points[end].pos,points[name].pos).normalize(),
    start:bones[name].getWorldQuaternion(quaternion())
  }));
  const driven=[bones.Hips,...rotations.map(r=>r.bone)];
  const original=driven.map(b=>b.quaternion.clone());
  const originalHips=bones.Hips.position.clone();
  const parentQ=quaternion(),direction=v(),newQ=quaternion(),delta=v(),torsoTurn=quaternion(),carried=v();
  function worldRotation(bone,q){
    bone.parent.getWorldQuaternion(parentQ);
    bone.quaternion.copy(parentQ.invert()).multiply(q).normalize();
  }
  const supports=['Head','Hips','LeftArm','RightArm','LeftFoot','RightFoot','LeftToeBase','RightToeBase','LeftHand','RightHand'];
  function keepSkinAboveFloor(radiusScale=1){
    let lift=0;
    for(const name of supports){
      bones[name].getWorldPosition(delta);
      lift=Math.max(lift,floor(delta.x,delta.z)+points[name].radius*radiusScale-delta.y);
    }
    if(lift>.002){
      bones.Hips.getWorldPosition(delta);delta.y+=Math.min(.30,lift);
      bones.Hips.position.copy(bones.Hips.parent.worldToLocal(delta));
    }
  }
  const display=Object.fromEntries(Object.entries(points).map(([name,p])=>[name,{pos:p.display}]));
  function applyPose(alpha=1){
    for(const p of particles)p.display.lerpVectors(p.last,p.pos,alpha);
    bones.Hips.position.copy(bones.Hips.parent.worldToLocal(delta.copy(points.Hips.display)));
    torsoTurn.copy(torsoFrame(display)).multiply(startFrame);
    worldRotation(bones.Hips,newQ.copy(torsoTurn).multiply(initialHipsRotation));
    for(const r of rotations){
      direction.subVectors(r.b.display,r.a.display).normalize();
      carried.copy(r.dir).applyQuaternion(torsoTurn);
      newQ.setFromUnitVectors(carried,direction).multiply(torsoTurn).multiply(r.start);
      worldRotation(r.bone,newQ);
    }
    keepSkinAboveFloor();
  }
  function restore(){
    bones.Hips.position.copy(originalHips);
    driven.forEach((b,i)=>b.quaternion.copy(original[i]));
  }
  const particles=Object.values(points);
  let age=0,rest=0,previousDt=1/60;
  let nearbyWalls=[];
  const wallAnchor=v().set(Infinity,0,Infinity);
  const normal=v(),correction=v(),relative=v();
  function project(p,offset,car,h){
    // Shift both samples. A projection out of a deep corner is a correction
    // of position, and should not be turned into a huge launch velocity.
    p.pos.add(offset);p.previous.add(offset);normal.copy(offset).normalize();
    relative.subVectors(p.pos,p.previous).multiplyScalar(1/h);
    if(car){relative.x-=car.vx;relative.z-=car.vz;}
    const inward=relative.dot(normal);
    if(inward<0)relative.addScaledVector(normal,-inward*(1+(inward< -2?.10:0)));
    if(car){relative.x+=car.vx;relative.z+=car.vz;p.onCar=true;}
    p.previous.copy(p.pos).addScaledVector(relative,-h);
  }
  return {
    center:points.Hips.pos,
    get age(){return age;},
    get settled(){return age>1.45 && rest>.55;},
    render:applyPose,
    impulse(velocity,at=points.Hips.pos){
      rest=0;
      for(const p of particles){
        relative.subVectors(p.pos,p.previous).multiplyScalar(1/previousDt);
        relative.addScaledVector(velocity,.46+.62*Math.exp(-p.pos.distanceToSquared(at)/.28)).clampLength(0,20);
        p.previous.copy(p.pos).addScaledVector(relative,-previousDt);
      }
    },
    update(dt,cars=[]){
      if(dt<=0)return;
      age+=dt;
      if(wallAnchor.distanceToSquared(points.Hips.pos)>64){
        wallAnchor.copy(points.Hips.pos);
        nearbyWalls=obstacles.filter(w=>Math.abs(w.x-wallAnchor.x)<w.w/2+14&&Math.abs(w.z-wallAnchor.z)<w.d/2+14);
      }
      for(const p of particles){
        p.last.copy(p.pos);p.ground=false;p.onCar=false;
        delta.subVectors(p.pos,p.previous).multiplyScalar(dt/previousDt*Math.exp(-.27*dt));
        p.previous.copy(p.pos);p.pos.add(delta);p.pos.y-=11.3*dt*dt;
      }
      previousDt=dt;
      for(let iteration=0;iteration<7;iteration++){
        for(const {p,q,min,max} of links){
          delta.subVectors(q.pos,p.pos);
          const len=delta.length();
          if(len<.0001 || (len>=min && len<=max))continue;
          const rest=len<min?min:max;
          delta.multiplyScalar((len-rest)/(len*(p.invMass+q.invMass)));
          p.pos.addScaledVector(delta,p.invMass);q.pos.addScaledVector(delta,-q.invMass);
        }
        limitLimbs();
        for(const p of particles){
          const y=floor(p.pos.x,p.pos.z)+p.radius;
          if(p.pos.y<y){project(p,correction.set(0,y-p.pos.y,0),null,dt);p.ground=true;}
          for(const car of cars)if(carContact(car,p.pos,p.radius,correction))project(p,correction,car,dt);
          for(const wall of nearbyWalls){
            if(wall.breakable?.broken)continue;
            const dx=p.pos.x-wall.x,dz=p.pos.z-wall.z;
            const overlapX=wall.w/2+p.radius-Math.abs(dx),overlapZ=wall.d/2+p.radius-Math.abs(dz);
            if(overlapX<=0 || overlapZ<=0)continue;
            if(overlapX<overlapZ)correction.set((dx>=0?1:-1)*overlapX,0,0);
            else correction.set(0,0,(dz>=0?1:-1)*overlapZ);
            project(p,correction,null,dt);
          }
        }
      }
      let grounded=0,energy=0,onCar=false;
      for(const p of particles){
        if(p.ground){
          grounded++;const friction=1-Math.exp(-9*dt);
          p.previous.x+=(p.pos.x-p.previous.x)*friction;
          p.previous.z+=(p.pos.z-p.previous.z)*friction;
        }
        if(p.onCar)onCar=true;
        energy+=p.pos.distanceToSquared(p.last)/(dt*dt);
      }
      rest=grounded>=3&&!onCar&&energy/particles.length<.085?rest+dt:0;
    },
    restore(){restore();skins.forEach((s,i)=>{s.frustumCulled=culling[i];});},
    release(){
      applyPose();
      const hip=points.Hips.pos;
      root.position.set(hip.x,floor(hip.x,hip.z),hip.z);
      // Rebase the physics pose around its resting position before blending
      // back to animation, so getting up doesn't slide to the original lane.
      bones.Hips.position.copy(bones.Hips.parent.worldToLocal(delta.copy(hip)));
      const fromHips=bones.Hips.position.clone(),from=driven.map(b=>b.quaternion.clone());
      let blendTime=0;
      function restoreCulling(){skins.forEach((s,i)=>{s.frustumCulled=culling[i];});}
      return {
        interrupt:restoreCulling,
        restore(){restore();restoreCulling();},
        update(dt){
          blendTime+=dt;
          const torso=T.MathUtils.smoothstep(blendTime,0,.90);
          const rise=T.MathUtils.smoothstep(blendTime,.22,1.18);
          restore();model.update(dt,false);
          bones.Hips.position.lerp(fromHips,1-rise);
          driven.forEach((bone,i)=>{
            const weight=/Leg|Foot|Toe/.test(bone.name)?rise:torso;
            bone.quaternion.slerp(from[i],1-weight);
          });
          if(rise<1)keepSkinAboveFloor(1-rise);
          else restoreCulling();
          return rise>=1;
        }
      };
    }
  };
}
