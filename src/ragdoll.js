import * as T from 'three';

// Articulated point masses are sampled in the current animation pose. Torso
// braces preserve its volume; the elbow, knee and ankle chains remain free.
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
function fallback(model, velocity, floor) {
  const root=model.mesh, initial=root.quaternion.clone(), motion=velocity.clone();
  const axis=v().set(motion.z,0,-motion.x).normalize();
  const base=root.position.clone();
  let tilt=0,age=0;
  return {
    center:base,
    get age(){return age;},
    update(dt){
      age+=dt;motion.y-=13*dt;base.addScaledVector(motion,dt);
      tilt=Math.min(1.48,tilt+dt*4);
      const surface=floor(base.x,base.z)+.12;
      if(base.y<surface){base.y=surface;motion.y=0;motion.x*=.8;motion.z*=.8;}
      root.position.copy(base);root.quaternion.setFromAxisAngle(axis,tilt).multiply(initial);
    },
    release(){root.quaternion.copy(initial);root.position.y=floor(base.x,base.z);return null;},
    restore(){root.quaternion.copy(initial);}
  };
}

export function createRagdoll(model, velocity, floor, obstacles=[]) {
  const root=model.mesh, bones={}, skins=[];
  root.traverse(node=>{
    if(node.isBone)bones[node.name.replace(/^mixamorig[:_]?/,'')]=node;
    if(node.isSkinnedMesh)skins.push(node);
  });
  const names=[...new Set(chains.flat())];
  if(names.some(n=>n!=='Crown' && !bones[n]))return fallback(model,velocity,floor);
  // SkinnedMesh caches a bound from the standing pose. While the simulated
  // hips travel outside it that bound would incorrectly cull visible bodies.
  const culling=skins.map(mesh=>mesh.frustumCulled);
  skins.forEach(mesh=>{mesh.frustumCulled=false;});
  root.updateWorldMatrix(true,true);
  const points={};
  for(const name of names){
    const p=(bones[name]||bones.Head).getWorldPosition(v());
    if(name==='Crown')p.y+=.17;
    const suffix=name.replace(/^(Left|Right)/,'');
    const vertical=p.y-root.position.y;
    const factor=.53+Math.min(.89,vertical*.51);
    const incoming=velocity.clone().multiplyScalar(factor);
    // Differing velocities impart angular momentum on contact.
    incoming.y+=Math.max(0,1.32-vertical)*.90;
    if(name.endsWith('Hand'))incoming.y+=name.startsWith('Left')?1.22:-.35;
    if(name.endsWith('Foot'))incoming.y+=name.startsWith('Left')?-.20:.55;
    points[name]={pos:p,previous:p.clone().addScaledVector(incoming,-1/60),radius:radii[suffix],invMass:suffix==='Hips'?.42:suffix==='Head'?.65:1};
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
  for(const s of sides){
    connect(s+'UpLeg',s+'Foot',.42,1.04);
    connect(s+'Arm',s+'Hand',.38,1.04);
    connect(s+'Arm','Crown',.77,1.2);
  }
  const startFrame=torsoFrame(points).invert();
  const initialHipsRotation=bones.Hips.getWorldQuaternion(quaternion());
  const rotations=chains.filter(([name])=> name!=='Hips').map(([name,end])=>({
    bone:bones[name],a:points[name],b:points[end],
    dir:v().subVectors(points[end].pos,points[name].pos).normalize(),
    start:bones[name].getWorldQuaternion(quaternion())
  }));
  const driven=[bones.Hips,...rotations.map(r=>r.bone)];
  const original=driven.map(b=>b.quaternion.clone());
  const originalHips=bones.Hips.position.clone();
  const parentQ=quaternion(),direction=v(),newQ=quaternion(),delta=v();
  function worldRotation(bone,q){
    bone.parent.getWorldQuaternion(parentQ);
    bone.quaternion.copy(parentQ.invert()).multiply(q).normalize();
  }
  const supports=['Head','Hips','LeftArm','RightArm','LeftFoot','RightFoot','LeftHand','RightHand'];
  function applyPose(){
    bones.Hips.position.copy(bones.Hips.parent.worldToLocal(delta.copy(points.Hips.pos)));
    worldRotation(bones.Hips,torsoFrame(points).multiply(startFrame).multiply(initialHipsRotation));
    for(const r of rotations){
      direction.subVectors(r.b.pos,r.a.pos).normalize();
      newQ.setFromUnitVectors(r.dir,direction).multiply(r.start);
      worldRotation(r.bone,newQ);
    }
    let lift=0;
    for(const name of supports){
      bones[name].getWorldPosition(delta);
      lift=Math.max(lift,floor(delta.x,delta.z)+points[name].radius-delta.y);
    }
    if(lift>.003){
      delta.copy(points.Hips.pos);delta.y+=Math.min(.22,lift);
      bones.Hips.position.copy(bones.Hips.parent.worldToLocal(delta));
    }
  }
  function restore(){
    bones.Hips.position.copy(originalHips);
    driven.forEach((b,i)=>b.quaternion.copy(original[i]));
  }
  const particles=Object.values(points);
  let age=0;
  return {
    center:points.Hips.pos,
    get age(){return age;},
    update(dt){
      if(dt<=0)return;
      age+=dt;
      for(const p of particles){
        delta.subVectors(p.pos,p.previous).multiplyScalar(.99);
        p.previous.copy(p.pos);p.pos.add(delta);p.pos.y-=15*dt*dt;
      }
      for(let iteration=0;iteration<6;iteration++){
        for(const {p,q,min,max} of links){
          delta.subVectors(q.pos,p.pos);
          const len=delta.length();
          if(len<.0001 || (len>=min && len<=max))continue;
          const rest=len<min?min:max;
          delta.multiplyScalar((len-rest)/(len*(p.invMass+q.invMass)));
          p.pos.addScaledVector(delta,p.invMass);q.pos.addScaledVector(delta,-q.invMass);
        }
        for(const p of particles){
          const y=floor(p.pos.x,p.pos.z)+p.radius;
          if(p.pos.y>=y)continue;
          p.pos.y=y;
          p.previous.x+=(p.pos.x-p.previous.x)*.17;
          p.previous.z+=(p.pos.z-p.previous.z)*.17;
          p.previous.y=Math.min(y,p.previous.y);
        }
        if(iteration===5)for(const p of particles)for(const wall of obstacles){
          const dx=p.pos.x-wall.x,dz=p.pos.z-wall.z;
          const overlapX=wall.w/2+p.radius-Math.abs(dx),overlapZ=wall.d/2+p.radius-Math.abs(dz);
          if(overlapX<=0 || overlapZ<=0)continue;
          if(overlapX<overlapZ){p.pos.x+=(dx>=0?1:-1)*overlapX;p.previous.x=p.pos.x;}
          else {p.pos.z+=(dz>=0?1:-1)*overlapZ;p.previous.z=p.pos.z;}
        }
      }
      applyPose();
    },
    restore(){restore();skins.forEach((s,i)=>{s.frustumCulled=culling[i];});},
    release(){
      const hip=points.Hips.pos;
      root.position.set(hip.x,floor(hip.x,hip.z),hip.z);
      // Rebase the physics pose around its resting position before blending
      // back to animation, so getting up doesn't slide to the original lane.
      bones.Hips.position.copy(bones.Hips.parent.worldToLocal(delta.copy(hip)));
      const fromHips=bones.Hips.position.clone(),from=driven.map(b=>b.quaternion.clone());
      let blendTime=0;
      function restoreCulling(){skins.forEach((s,i)=>{s.frustumCulled=culling[i];});}
      return {
        restore(){restore();restoreCulling();},
        update(dt){
          blendTime+=dt;
          const t=T.MathUtils.smoothstep(blendTime,0,.75);
          restore();model.update(dt,false);
          bones.Hips.position.lerp(fromHips,1-t);
          driven.forEach((b,i)=>b.quaternion.slerp(from[i],1-t));
          if(t>=1)restoreCulling();
          return t>=1;
        }
      };
    }
  };
}
