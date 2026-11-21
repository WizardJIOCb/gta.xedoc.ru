import * as T from 'three';

const specs={
  FISTS:{range:1.28,cooldown:.39,cone:.55,strength:.45,lift:1.15,maxHits:1},
  PULSE:{range:17,cooldown:.65,cone:.92,strength:1,lift:3.4},
  NOVA:{range:8.5,cooldown:1.3,cone:-1,strength:1.22,lift:4.3}
};
const UP=new T.Vector3(0,1,0);

function devices(scene){
  const pulse=new T.Group(),nova=new T.Group();
  const alloy=new T.MeshStandardMaterial({color:0x283748,metalness:.76,roughness:.25});
  const ceramic=new T.MeshStandardMaterial({color:0xe7d4b2,metalness:.34,roughness:.32});
  const glow=color=>new T.MeshBasicMaterial({color,toneMapped:false});
  const mint=glow(0x69ffdf),violet=glow(0xda85ff),gold=glow(0xffd477);
  function piece(group,geometry,material,x=0,y=0,z=0) {
    const m=new T.Mesh(geometry,material);m.position.set(x,y,z);group.add(m);return m;
  }
  const casing=piece(pulse,new T.CylinderGeometry(.077,.104,.26,8),alloy,0,0,.02);
  casing.rotation.x=Math.PI/2;
  for(let i=0;i<3;i++)piece(pulse,new T.TorusGeometry(.085-i*.006,.012,6,22),mint,0,0,-.10-i*.047);
  for(let i=0;i<3;i++){
    const a=i*2.0944;
    const fin=piece(pulse,new T.BoxGeometry(.052,.043,.31),ceramic,.094*Math.cos(a),.094*Math.sin(a),-.092);
    fin.rotation.z=a;
  }
  // A split circular emitter and floating gyroscope give NOVA a different silhouette.
  const handle=piece(nova,new T.BoxGeometry(.075,.13,.20),alloy,0,-.035,.035);
  handle.rotation.x=-.2;
  const rotor=new T.Group();rotor.position.set(0,.11,-.10);nova.add(rotor);
  for(let i=0;i<3;i++){
    const a=i*Math.PI*2/3;
    const arc=piece(nova,new T.TorusGeometry(.16,.025,7,18,1.43),ceramic,0,.11,-.10);
    arc.rotation.set(Math.PI*.44,0,a);
    const node=piece(nova,new T.OctahedronGeometry(.036),violet,.15*Math.cos(a),.11+.04*Math.sin(a),-.10+.15*Math.sin(a));
    node.rotation.y=a;
  }
  piece(rotor,new T.IcosahedronGeometry(.062,0),gold);
  piece(rotor,new T.TorusGeometry(.10,.009,6,25),violet).rotation.x=.45;
  scene.add(pulse,nova);nova.visible=false;
  return {pulse,nova,rotor};
}

function travellingRings(scene){
  const ring=new T.TorusGeometry(1,.026,6,48),spark=new T.OctahedronGeometry(.14);
  const pool=[];
  for(let i=0;i<3;i++){
    const group=new T.Group();
    const material=new T.MeshBasicMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false});
    for(let n=0;n<3;n++)group.add(new T.Mesh(ring,material));
    for(let n=0;n<9;n++)group.add(new T.Mesh(spark,material));
    group.visible=false;scene.add(group);pool.push({group,material,age:0,range:0,duration:0});
  }
  let index=0;
  return {
    emit(origin,yaw,range,power){
      if(range<.1)return;
      const shot=pool[index++%pool.length];
      shot.age=0;shot.range=range;shot.duration=.16+range/75;
      shot.group.position.copy(origin);shot.group.rotation.y=yaw;shot.group.visible=true;
      shot.material.color.setHex(power?0xff83bd:0x61ffed);
      for(const obj of shot.group.children)obj.scale.setScalar(0);
    },
    update(dt){
      for(const s of pool){
        if(!s.group.visible)continue;
        const t=(s.age+=dt)/s.duration;
        if(t>=1){s.group.visible=false;continue;}
        s.material.opacity=(1-t*t)*.91;
        for(let i=0;i<s.group.children.length;i++){
          const obj=s.group.children[i],progress=Math.max(0,t-i%3*.044),d=progress*s.range;
          const radius=.14+d*.39;
          obj.position.z=-d;
          if(i<3)obj.scale.setScalar(radius*(1-i*.12));
          else{
            const a=i*2.4+progress*.8;
            obj.position.x=Math.cos(a)*radius;obj.position.y=Math.sin(a)*radius;
            obj.scale.set(.43,.43,1.7);
          }
        }
      }
    },
    clear(){for(const s of pool)s.group.visible=false;}
  };
}

// Each segment of the radial shock front samples a separate wall distance.
// Its footprint follows the pavement and visibly stops at a solid facade.
function radialWave(scene,world){
  const segments=72,vertices=new Float32Array(segments*2*6*3);
  const attr=new T.BufferAttribute(vertices,3).setUsage(T.DynamicDrawUsage);
  const geometry=new T.BufferGeometry().setAttribute('position',attr);
  const material=new T.MeshBasicMaterial({color:0xffabff,transparent:true,side:T.DoubleSide,
    opacity:0,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false});
  const mesh=new T.Mesh(geometry,material);mesh.visible=false;mesh.frustumCulled=false;scene.add(mesh);
  const bounds=new Float32Array(segments),ox=new Float32Array(segments),oz=new Float32Array(segments);
  for(let i=0;i<segments;i++){const a=i*2*Math.PI/segments;ox[i]=Math.cos(a);oz[i]=Math.sin(a);}
  let age=0,range=0;
  const height=world.groundHeight || (()=>.12);
  return {
    emit(x,z,r){
      mesh.position.set(x,0,z);range=r;age=0;material.opacity=0;
      for(let i=0;i<segments;i++)bounds[i]=clearRange(x,z,ox[i],oz[i],r,world.blocks);
      mesh.visible=true;
    },
    update(dt){
      if(!mesh.visible)return;
      const t=(age+=dt)/.54;
      if(t>=1){mesh.visible=false;return;}
      const front=range*(1-(1-t)**2);let offset=0;
      for(let band=0;band<2;band++){
        const radius=Math.max(0,front-band*.45),width=.14+.20*(1-t);
        for(let i=0;i<segments;i++){
          const next=(i+1)%segments;
          for(const [k,edge] of [[i,0],[next,0],[i,1],[i,1],[next,0],[next,1]]){
            const d=Math.max(0,Math.min(bounds[k]-.04,radius-width*edge));
            const x=ox[k]*d,z=oz[k]*d;
            vertices[offset++]=x;vertices[offset++]=height(mesh.position.x+x,mesh.position.z+z)+.075+band*.14+edge*.07;
            vertices[offset++]=z;
          }
        }
      }
      attr.needsUpdate=true;material.opacity=(1-t*t)*.86;
    },
    clear(){mesh.visible=false;}
  };
}

export function createArsenal(scene,person,car,district,world){
  const kit=devices(scene),rings=travellingRings(scene),nova=radialWave(scene,world),bones={};
  const fingers=[],curlAxis=new T.Vector3(0,0,1);
  person.ready.then(()=>person.mesh.traverse(n=>{
    if(!n.isBone)return;
    const key=n.name.replace(/^mixamorig[:_]?/,'');bones[key]=n;
    const finger=key.match(/Hand(Index|Middle|Ring|Pinky|Thumb)([123])$/);
    if(!finger)return;
    const angle=finger[1]==='Thumb'?.40:finger[2]==='3'?.82:1.04;
    const folded=n.quaternion.clone().multiply(new T.Quaternion().setFromAxisAngle(curlAxis,angle));
    fingers.push({bone:n,rest:n.quaternion.clone(),folded});
  }));
  const a=new T.Vector3(),b=new T.Vector3(),direction=new T.Vector3(),origin=new T.Vector3();
  const delta=new T.Quaternion(),parentQ=new T.Quaternion();
  let mode='PULSE',cooldown=0,time=0,jabAge=1,jab=0,recoil=0;
  function aimBone(start,end,x,y,z,yaw) {
    const bone=bones[start],child=bones[end];if(!bone||!child)return;
    bone.getWorldPosition(a);child.getWorldPosition(b);b.sub(a).normalize();
    direction.set(x,y,z).normalize().applyAxisAngle(UP,yaw);
    delta.setFromUnitVectors(b,direction);bone.parent.getWorldQuaternion(parentQ);
    delta.multiply(parentQ);parentQ.invert().multiply(delta);
    bone.quaternion.premultiply(parentQ);
  }
  function pose(driving,yaw){
    kit.pulse.visible=mode==='PULSE';kit.nova.visible=mode==='NOVA';
    if(mode==='FISTS'){
      if(driving)return;
      for(const f of fingers)f.bone.quaternion.copy(f.folded);
      const t=T.MathUtils.clamp(jabAge/.36,0,1);
      const extension=t<.35?Math.sin((t/.35)*Math.PI/2):Math.cos((t-.35)/.65*Math.PI/2);
      for(const [side,sign] of [['Right',1],['Left',-1]]){
        const swing=jabAge>=.36||((jab%2===0)!==(side==='Left'))?0:extension;
        const uppercut=jab%3===0;
        aimBone(side+'Arm',side+'ForeArm',sign*(.28-.19*swing),-.80+(uppercut?.54:.82)*swing,-.48-.8*swing,yaw);
        aimBone(side+'ForeArm',side+'Hand',-sign*.24,.92-(uppercut?.32:1.0)*swing,-.40-.99*swing,yaw);
      }
      return;
    }
    if(!driving){
      aimBone('RightArm','RightForeArm',.22,-.63,-.64,yaw);
      aimBone('RightForeArm','RightHand',-.10,.26+recoil*.52,-1,yaw);
    }
    if(driving)car.mesh.localToWorld(origin.set(.56,.88,-1.62));
    else if(bones.RightHand)bones.RightHand.getWorldPosition(origin);
    else person.mesh.localToWorld(origin.set(.26,1.09,-.28));
    const tool=mode==='PULSE'?kit.pulse:kit.nova;
    tool.position.copy(origin);tool.rotation.set(-recoil*.15,yaw,0,'YXZ');tool.scale.setScalar(driving?1.7:1);
    kit.rotor.rotation.set(time*1.1,time*2.75,0);
  }
  function attack({x,z,y,yaw,driving=false,power=false}){
    if(cooldown>0 || (mode==='FISTS'&&driving))return null;
    const spec=specs[mode],boost=power?1.45:1;
    const range=spec.range*(mode==='FISTS'?1:boost),dx=-Math.sin(yaw),dz=-Math.cos(yaw);
    const canReach=(px,pz)=>{
      const ax=px-x,az=pz-z,length=Math.hypot(ax,az);
      return length<.001 || clearRange(x,z,ax/length,az/length,length,world.blocks)>=length-.02;
    };
    const count=district.pulse(x,z,dx,dz,range,canReach,{...spec,strength:spec.strength*boost,lift:spec.lift*boost});
    cooldown=spec.cooldown*(power?.68:1);recoil=1;
    if(mode==='FISTS'){jab++;jabAge=0;}
    if(mode==='NOVA')nova.emit(x,z,range);
    if(mode==='PULSE'){
      pose(driving,yaw);
      const tool=kit.pulse;
      tool.localToWorld(origin.set(0,0,-.21));if(!Number.isFinite(origin.y))origin.set(x,y+1,z);
      const maximum=clearRange(origin.x,origin.z,dx,dz,range,world.blocks);
      rings.emit(origin,yaw,maximum,power);
    }
    return {count,mode};
  }
  function select(next){
    if(!Object.hasOwn(specs,next))return false;
    if(mode==='FISTS'&&next!=='FISTS')for(const f of fingers)f.bone.quaternion.copy(f.rest);
    mode=next;kit.pulse.visible=next==='PULSE';kit.nova.visible=next==='NOVA';jabAge=1;return true;
  }
  return {
    select,attack,pose,
    update(dt){cooldown=Math.max(0,cooldown-dt);jabAge+=dt;time+=dt;recoil=Math.max(0,recoil-dt*6);rings.update(dt);nova.update(dt);},
    reset(){select('PULSE');cooldown=recoil=jab=0;rings.clear();nova.clear();},
    get cooldown(){return cooldown;},get mode(){return mode;}
  };
}
// Intersect the horizontal ray with solid building footprints. This keeps the
// wave and its impulse on the player's side of walls at oblique angles too.
export function clearRange(x,z,dx,dz,limit,blocks) {
  let range=limit;
  for(const b of blocks){
    let near=0,far=range;
    for(const [offset,dir,radius] of [[b.x-x,dx,b.w/2],[b.z-z,dz,b.d/2]]){
      if(Math.abs(dir)<1e-7){if(Math.abs(offset)>radius){far=-1;break;}continue;}
      const a=(offset-radius)/dir,c=(offset+radius)/dir;
      near=Math.max(near,Math.min(a,c));far=Math.min(far,Math.max(a,c));
    }
    if(near<=far)range=near;
  }
  return range;
}
