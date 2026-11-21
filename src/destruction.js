import * as T from 'three';
import { clearRange, weaponSpecs } from './pulse.js';
import { createRuins } from './ruins.js';

// Closing speed in metres per second. A slow graze can move a plastic bin,
// while anchored railings and steel poles need a much more direct impact.
const resistance={
  shrub:1.6, bin:1.9, chair:2.1, crate:2.6, umbrella:2.8, table:3.4,
  fence:3.8, sign:4.4, bench:4.8, rail:5.4, meter:5.8, gate:7.6,
  bollard:8.2, lamp:8.5, signal:9.5,palm:10.5,tree:9.5,container:10.2,trailer:8.6,fountain:10.3,
  canopy:6.4,boat:9.2
};
const MAX_MOVING=48, unit=new T.Vector3(1,1,1);
const v=()=>new T.Vector3();

// Three.js clears updateRanges after uploading them. Extend the pending range
// in place so a batch outside the camera never accumulates stale update records.
function markChanged(attribute,start,count){
  const range=attribute.updateRanges[0];
  if(range){
    const end=Math.max(range.start+range.count,start+count);
    range.start=Math.min(range.start,start);range.count=end-range.start;
  }else attribute.addUpdateRange(start,count);
  attribute.needsUpdate=true;
}

function capture(part,frames){
  const {mesh}=part;
  let frame=frames.get(mesh);
  if(!frame){
    mesh.updateWorldMatrix(true,false);
    const world=mesh.matrixWorld.clone();
    frame={world,inverse:world.clone().invert()};
    frames.set(mesh,frame);
    if(mesh.isInstancedMesh){
      if(!mesh.boundingSphere)mesh.computeBoundingSphere();
      mesh.boundingSphere.radius+=22;
    }else{
      if(!mesh.geometry.boundingSphere)mesh.geometry.computeBoundingSphere();
      mesh.geometry.boundingSphere.radius+=22;
    }
  }
  const geom=mesh.geometry,samples=[];
  if(mesh.isInstancedMesh){
    const bind=new T.Matrix4();mesh.getMatrixAt(part.index,bind);
    if(!geom.boundingBox)geom.computeBoundingBox();
    const {min,max}=geom.boundingBox;
    const toWorld=new T.Matrix4().multiplyMatrices(frame.world,bind);
    for(const x of [min.x,max.x])for(const y of [min.y,max.y])for(const z of [min.z,max.z]){
      samples.push(new T.Vector3(x,y,z).applyMatrix4(toWorld));
    }
    return {...part,frame,bind,samples};
  }
  const {position,normal}=geom.attributes;
  const start=part.firstVertex*3,end=start+part.vertexCount*3;
  const coords=position.array.slice(start,end),normals=normal?.array.slice(start,end);
  for(let i=0;i<coords.length;i+=3)samples.push(v().fromArray(coords,i).applyMatrix4(frame.world));
  return {...part,frame,coords,normals,samples};
}

function restorePiece(p){
  if(p.bind){
    p.mesh.setMatrixAt(p.index,p.bind);markChanged(p.mesh.instanceMatrix,p.index*16,16);
  }else{
    const {position,normal}=p.mesh.geometry.attributes,start=p.firstVertex*3;
    position.array.set(p.coords,start);markChanged(position,start,p.coords.length);
    if(p.normals){normal.array.set(p.normals,start);markChanged(normal,start,p.normals.length);}
  }
}

function splitPieces(kind,pieces){
  // Timber slats and sections of railing come away separately. Keep bolted
  // assemblies (a sign and its face, an umbrella and its canopy) together.
  const loose=kind==='bench'||kind==='fence'||kind==='rail'||kind==='gate';
  if(!loose||pieces.length===1)return [pieces];
  if(pieces.length<=3)return pieces.map(p=>[p]);
  const groups=[[],[],[]],bounds=new T.Box3().setFromPoints(pieces.flatMap(p=>p.samples));
  const size=bounds.getSize(v()),mid=bounds.getCenter(v()),alongX=size.x>size.z;
  for(const p of pieces){
    const center=new T.Box3().setFromPoints(p.samples).getCenter(v());
    const coord=alongX?(center.x-mid.x)/Math.max(.01,size.x):(center.z-mid.z)/Math.max(.01,size.z);
    const i=kind==='bench'?(center.y<mid.y-.08?0:center.y>mid.y+.08?2:1):
      T.MathUtils.clamp(Math.floor((coord+.5)*3),0,2);
    groups[i].push(p);
  }
  return groups.filter(g=>g.length);
}

// Keep a few extreme contact points instead of checking every bolt and slat
// against the terrain on every physics tick.
function supportHull(points,pivot){
  const support=new Set();
  for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++){
    if(!x&&!y&&!z)continue;
    let best=-Infinity,point;
    for(const p of points){
      const dot=x*p.x+y*p.y+z*p.z;
      if(dot>best){point=p;best=dot;}
    }
    support.add(point);
  }
  return Array.from(support,p=>p.clone().sub(pivot));
}

function makeBody(parts,dx,dz,speed,x,z,variation){
  const points=parts.flatMap(p=>p.samples),bounds=new T.Box3().setFromPoints(points);
  const pivot=bounds.getCenter(v()),size=bounds.getSize(v()),radius=Math.max(.16,size.length()*.5);
  const lateral=Math.sin(variation)*.18*speed;
  const velocity=new T.Vector3(dx*speed-dz*lateral,.55+speed*.31,dz*speed+dx*lateral);
  const lever=dx*(pivot.z-z)-dz*(pivot.x-x);
  const spin=T.MathUtils.clamp((2.6+speed*.54)/Math.sqrt(radius+.35),1.3,9);
  const omega=new T.Vector3(dz*spin,T.MathUtils.clamp(lever/radius,-1,1)*spin*.65+Math.sin(variation)*.9,-dx*spin);
  return {parts,pivot,center:pivot.clone(),support:supportHull(points,pivot),velocity,omega,radius,
    invInertia:2.4/(radius*radius),rotation:new T.Quaternion(),age:0,rest:0};
}

export function createDestruction(scene,blocks,groundHeight,onEffect=()=>{}){
  const active=[],changed=new Map(),frames=new WeakMap();
  const structural=new Map(),ruins=createRuins(scene,groundHeight);
  let time=0;
  const temp=v(),arm=v(),contact=v(),axis=v(),normalVelocity=v();
  const pose=new T.Matrix4(),local=new T.Matrix4(),partMatrix=new T.Matrix4();
  const normalMatrix=new T.Matrix3(),spin=new T.Quaternion();

  function draw(body){
    pose.compose(body.center,body.rotation,unit);
    temp.copy(body.pivot).applyQuaternion(body.rotation).negate().add(body.center);
    pose.setPosition(temp);
    transformParts(body.parts,body.palm);
  }
  function transformParts(parts,foldLeaves=false){
    for(const p of parts){
      local.multiplyMatrices(p.frame.inverse,pose).multiply(p.frame.world);
      if(p.bind){
        partMatrix.multiplyMatrices(local,p.bind);p.mesh.setMatrixAt(p.index,partMatrix);
        markChanged(p.mesh.instanceMatrix,p.index*16,16);
      }else{
        const {position,normal}=p.mesh.geometry.attributes;
        if(p.normals)normalMatrix.getNormalMatrix(local);
        for(let j=0;j<p.vertexCount;j++){
          temp.fromArray(p.coords,j*3).applyMatrix4(local);
          if(foldLeaves&&p.mesh.material.alphaTest>0){
            const floor=groundHeight(temp.x,temp.z)+.055;
            if(temp.y<floor)temp.y=floor;
          }
          position.setXYZ(p.firstVertex+j,temp.x,temp.y,temp.z);
          if(p.normals){
            temp.fromArray(p.normals,j*3).applyNormalMatrix(normalMatrix);
            normal.setXYZ(p.firstVertex+j,temp.x,temp.y,temp.z);
          }
        }
        markChanged(position,p.firstVertex*3,p.coords.length);
        if(p.normals)markChanged(normal,p.firstVertex*3,p.normals.length);
      }
    }
  }

  function contactDepth(b){
    let bottom=Infinity;
    for(const point of b.support){
      temp.copy(point).applyQuaternion(b.rotation);
      if(temp.y<bottom){bottom=temp.y;arm.copy(temp);}
    }
    contact.copy(arm).add(b.center);
    return groundHeight(contact.x,contact.z)+.012-contact.y;
  }

  function stepBody(b,dt){
    if(b.palm){
      b.rate+=dt*15/b.length*Math.sin(Math.max(.12,b.angle));
      b.angle+=b.rate*dt;
      if(b.angle>b.stop){
        b.angle=b.stop;
        b.rate=b.rate>.20?-b.rate*.14:0;
      }
      b.rotation.setFromAxisAngle(b.axis,b.angle);
      return b.angle===b.stop&&b.rate===0;
    }
    b.age+=dt;b.velocity.y-=12.4*dt;
    b.center.addScaledVector(b.velocity,dt);
    const rate=b.omega.length();
    if(rate>1e-6){
      axis.copy(b.omega).multiplyScalar(1/rate);
      b.rotation.premultiply(spin.setFromAxisAngle(axis,rate*dt)).normalize();
    }
    const depth=contactDepth(b);
    if(depth<0){b.rest=0;return false;}
    b.center.y+=depth;
    normalVelocity.crossVectors(b.omega,arm).add(b.velocity);
    if(normalVelocity.y<0){
      const closing=-normalVelocity.y,restitution=closing>1.3?.19:0;
      const j=(1+restitution)*closing/(1+(arm.x*arm.x+arm.z*arm.z)*b.invInertia);
      b.velocity.y+=j;
      b.omega.x-=arm.z*j*b.invInertia;b.omega.z+=arm.x*j*b.invInertia;
    }
    const drag=Math.exp(-3.9*dt);
    b.velocity.x*=drag;b.velocity.z*=drag;b.omega.multiplyScalar(Math.exp(-3.3*dt));
    const still=Math.abs(b.velocity.y)<.28 && Math.hypot(b.velocity.x,b.velocity.z)<.31 && b.omega.length()*b.radius<.50;
    b.rest=still?b.rest+dt:0;
    return b.rest>.18||b.age>5;
  }

  function fallingPalm(block,parts,dx,dz,speed){
    const h=block.breakable,pivot=v().fromArray(h.hinge),axis=v().set(dz,0,-dx);
    const spine=h.spine.map(p=>v().fromArray(p).sub(pivot));
    // The first point of the leaning trunk that touches terrain arrests the
    // hinge. The flexible leaf tips flatten against the ground independently.
    let lo=0,hi=2.12;
    for(let i=0;i<12;i++){
      const angle=(lo+hi)/2;
      const penetrates=spine.some(p=>{
        temp.copy(p).applyAxisAngle(axis,angle).add(pivot);
        return temp.y<groundHeight(temp.x,temp.z)+.17;
      });
      if(penetrates)hi=angle;else lo=angle;
    }
    return {palm:true,parts,pivot,center:pivot.clone(),axis,angle:0,stop:lo,
      length:spine.at(-1).length(),rate:T.MathUtils.clamp(speed*.1,.5,1.55),rotation:new T.Quaternion()};
  }
  function hitStructure(b,speed,dx,dz,x,z){
    const h=b.breakable;
    if(speed<7)return false;
    let s=structural.get(b);
    if(!s){s={damage:0,last:-Infinity,elapsed:0};structural.set(b,s);}
    if(s.parts||time-s.last<.23)return false;
    s.last=time;s.damage+=speed-4;ruins.mark(b,x,z);
    if(s.damage<22+Math.min(60,h.height*1.12))return false;
    h.falling=true;s.parts=h.parts.map(p=>capture(p,frames));changed.set(h,s.parts);
    s.roof=h.height;
    for(const part of s.parts){
      for(const p of part.samples)s.roof=Math.max(s.roof,p.y);
      delete part.samples;
    }
    const len=Math.hypot(dx,dz)||1;
    s.axis=v().set(dz/len,0,-dx/len);if(!s.axis.lengthSq())s.axis.set(1,0,0);
    s.site=ruins.begin(b);
    onEffect('collapse');
    return false; // Standing floors still obstruct the vehicle until they clear.
  }
  function collapse(b,s,dt){
    s.elapsed+=dt;
    const t=Math.min(1,s.elapsed/(1.12+Math.sqrt(b.breakable.height)*.12));
    const drop=t*t;
    spin.setFromAxisAngle(s.axis,Math.min(.21,.31*Math.min(b.w,b.d)/s.roof)*Math.sin(Math.PI*t));
    temp.set(b.x,0,b.z).applyQuaternion(spin).negate();
    temp.x+=b.x;temp.z+=b.z;temp.y-=(s.roof+3)*drop;
    pose.makeRotationFromQuaternion(spin).setPosition(temp);transformParts(s.parts);
    ruins.animate(s.site,b,t);
    if(t===1){b.breakable.broken=true;b.breakable.rubble.broken=false;}
  }
  function hit(block,impactSpeed,vx,vz,x,z){
    const h=block?.breakable;
    if(!h)return false;
    if(h.broken)return true;
    if(h.kind==='building')return hitStructure(block,impactSpeed,vx,vz,x,z);
    if(!h.parts.length||!(impactSpeed>=(resistance[h.kind]??5)))return false;
    const parts=h.parts.map(p=>capture(p,frames));
    h.broken=true;changed.set(h,parts);
    if(h.hinge)onEffect('timber');
    const horizontal=Math.hypot(vx,vz);
    const dx=horizontal>1e-5?vx/horizontal:0,dz=horizontal>1e-5?vz/horizontal:-1;
    const speed=T.MathUtils.clamp(impactSpeed*.39,1.3,9.2);
    for(const [i,group] of splitPieces(h.kind,parts).entries()){
      if(active.length>=MAX_MOVING){
        const old=active.shift();
        if(old.palm)old.rotation.setFromAxisAngle(old.axis,old.stop);
        else old.center.y+=contactDepth(old);
        draw(old);
      }
      const body=h.hinge?fallingPalm(block,group,dx,dz,impactSpeed):
        makeBody(group,dx,dz,speed,x,z,i*2.73+block.x*.29+block.z*.17);
      active.push(body);
    }
    for(const p of parts)delete p.samples;
    return true;
  }

  function strike(x,z,yaw,mode,power=false,canReach){
    const spec=weaponSpecs[mode];
    if(!spec)return 0;
    const range=spec.range*(mode!=='FISTS'&&power?1.45:1);
    const dx=-Math.sin(yaw),dz=-Math.cos(yaw),targets=[];
    const nearby=blocks.filter(b=>!b.breakable?.broken&&Math.abs(b.x-x)<=range+b.w*.5&&Math.abs(b.z-z)<=range+b.d*.5);
    for(const b of nearby){
      if(!b.breakable)continue;
      // Aim at the nearest part of a long section, including its end.
      const along=T.MathUtils.clamp((b.x-x)*dx+(b.z-z)*dz,0,range);
      const aimX=mode==='PULSE'?x+along*dx:x,aimZ=mode==='PULSE'?z+along*dz:z;
      const px=T.MathUtils.clamp(aimX,b.x-b.w/2,b.x+b.w/2),pz=T.MathUtils.clamp(aimZ,b.z-b.d/2,b.z+b.d/2);
      const ax=px-x,az=pz-z,d=Math.hypot(ax,az);
      if(d>range||ax*dx+az*dz<d*spec.cone)continue;
      if(mode==='PULSE'&&Math.abs(ax*dz-az*dx)>.38+.025*d)continue;
      const ux=d>.001?ax/d:dx,uz=d>.001?az/d:dz;
      // Capture all visible targets before the wave removes any cover. Start
      // with the near face of this prop so it cannot occlude its own hit.
      const reach=clearRange(x,z,ux,uz,d,[b]);
      const nx=x+ux*reach,nz=z+uz*reach;
      if(clearRange(x,z,ux,uz,reach,nearby)<reach-.02||canReach&&!canReach(nx,nz))continue;
      targets.push({b,d:reach,ux,uz,nx,nz});
    }
    targets.sort((a,b)=>a.d-b.d);
    let count=0;
    for(const t of targets){
      if(t.b.breakable.broken)continue;
      const impulse=mode==='FISTS'?2.9:(power?18:12)*(1-.25*t.d/range);
      const previous=structural.get(t.b)?.damage??0;
      if(hit(t.b,impulse,t.ux*impulse,t.uz*impulse,t.nx,t.nz)||(structural.get(t.b)?.damage??0)>previous)count++;
      if(mode!=='NOVA')break;
    }
    return count;
  }

  return {hit,strike,
    update(dt){
      if(!(dt>0))return;
      time+=dt;
      for(const [b,s] of structural)if(s.parts&&!b.breakable.broken)collapse(b,s,dt);
      if(!active.length)return;
      const duration=Math.min(dt,.12),steps=Math.ceil(duration/(1/60));
      for(let n=active.length-1;n>=0;n--){
        const body=active[n];let done=false;
        for(let k=0;k<steps&&!done;k++)done=stepBody(body,duration/steps);
        draw(body);if(done)active.splice(n,1);
      }
    },
    reset(){
      active.length=0;
      for(const [handle,parts] of changed){
        for(const p of parts)restorePiece(p);
        handle.broken=false;
      }
      changed.clear();
      for(const b of structural.keys()){b.breakable.rubble.broken=true;b.breakable.falling=false;}
      structural.clear();ruins.reset();time=0;
    }
  };
}
