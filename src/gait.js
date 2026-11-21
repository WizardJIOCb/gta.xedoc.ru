import * as T from 'three';

// Distance fraction -> source clip phase. The grounded portion is measured
// from the toe's travel backwards on Andre's retargeted skeleton. During the
// airborne portion of the run time advances independently of that toe.
const walkPhases = [.80,.86,.92,.98,1.025,1.075,1.12,1.17,1.215,1.257,1.30,
  1.35,1.40,1.45,1.50,1.55,1.60,1.65,1.70,1.75,1.80];
const runPhases = [.042,.071,.102,.131,.16,.189,.233,.309,.387,.465,.546,
  .575,.606,.637,.666,.695,.740,.818,.896,.974,1.042];
const mix = T.MathUtils.lerp;
const smooth = T.MathUtils.smoothstep;
function clipPhase(table, phase) {
  const index = (phase % 1) * (table.length - 1);
  const low = Math.floor(index);
  return mix(table[low], table[low+1], index-low) % 1;
}

// A small two-link IK correction keeps the supporting toe planted through
// turns, acceleration and blend transitions. The captured foot orientation
// is restored after solving the hip and knee to preserve the heel roll.
function plantLeg(actor, side) {
  const bone = key => actor.getObjectByName('mixamorig'+side+key);
  const hip=bone('UpLeg'), knee=bone('Leg'), ankle=bone('Foot'), toe=bone('ToeBase');
  if (!hip || !knee || !ankle || !toe) return null;
  const anchor=new T.Vector3(), toePos=new T.Vector3(), h=new T.Vector3(), k=new T.Vector3(), a=new T.Vector3();
  const d=new T.Vector3(), axis=new T.Vector3(), pole=new T.Vector3(), aim=new T.Vector3(), target=new T.Vector3();
  const v1=new T.Vector3(),v2=new T.Vector3(), r=new T.Quaternion(), parentQ=new T.Quaternion(),linearQ=new T.Quaternion();
  const footQ=new T.Quaternion(), originals=[hip,knee,ankle].map(()=>new T.Quaternion());
  let planted=false, corrected=false;
  function rotate(bone, origin, from, to) {
    v1.subVectors(from,origin).normalize();v2.subVectors(to,origin).normalize();
    r.setFromUnitVectors(v1,v2);
    bone.getWorldQuaternion(linearQ);
    bone.parent.getWorldQuaternion(parentQ).invert();
    bone.quaternion.copy(parentQ.multiply(r).multiply(linearQ));
    bone.updateWorldMatrix(false,true);
  }
  return {
    restore() {
      if(!corrected)return;
      hip.quaternion.copy(originals[0]);knee.quaternion.copy(originals[1]);ankle.quaternion.copy(originals[2]);
      corrected=false;
    },
    apply(active, weight, floor) {
      if(!active){planted=false;return;}
      toe.getWorldPosition(toePos);
      if(!planted){anchor.copy(toePos);anchor.y=T.MathUtils.clamp(anchor.y,floor+.008,floor+.030);planted=true;}
      d.subVectors(anchor,toePos).clampLength(0,.14).multiplyScalar(weight);
      if(d.lengthSq()<.000001)return;
      hip.getWorldPosition(h);knee.getWorldPosition(k);ankle.getWorldPosition(a);
      const upper=k.distanceTo(h),lower=a.distanceTo(k);
      target.copy(a).add(d);
      axis.subVectors(target,h);
      const span=T.MathUtils.clamp(axis.length(),Math.abs(upper-lower)+.001,upper+lower-.0002);
      axis.normalize();target.copy(h).addScaledVector(axis,span);
      pole.subVectors(k,h);pole.addScaledVector(axis,-pole.dot(axis));
      if(pole.lengthSq()<1e-7)return;
      pole.normalize();
      const along=(upper*upper-lower*lower+span*span)/(2*span);
      aim.copy(h).addScaledVector(axis,along).addScaledVector(pole,Math.sqrt(Math.max(0,upper*upper-along*along)));
      [hip,knee,ankle].forEach((b,i)=>originals[i].copy(b.quaternion));
      ankle.getWorldQuaternion(footQ);
      rotate(hip,h,k,aim);
      knee.getWorldPosition(k);ankle.getWorldPosition(a);
      rotate(knee,k,a,target);
      ankle.parent.getWorldQuaternion(parentQ).invert();ankle.quaternion.copy(parentQ.multiply(footQ));
      corrected=true;
    }
  };
}

export function createGait(mesh) {
  let actor, mixer, idle, walk, run, air;
  let cycle=.2, moveWeight=0, runWeight=0, airWeight=0, legs=[];
  return {
    bind(rig, animator, idleAction, walkAction, clips) {
      actor=rig;mixer=animator;idle=idleAction;walk=walkAction;
      walk.paused=true;
      const runClip=T.AnimationClip.findByName(clips,'Run'),airClip=T.AnimationClip.findByName(clips,'Air');
      if(runClip){run=mixer.clipAction(runClip);run.play();run.paused=true;}
      if(airClip){air=mixer.clipAction(airClip);air.play();air.paused=true;}
      legs=['Left','Right'].map(side=>plantLeg(rig,side));
    },
    update(dt,distance,running,airborne=false,verticalSpeed=0){
      legs.forEach(leg=>leg?.restore());
      const speed=dt>0?distance/dt:0;
      const moving=distance>.00001 && dt>0;
      const targetRun=running?smooth(speed,1.4,3.6):smooth(speed,2.2,3.8);
      runWeight=T.MathUtils.damp(runWeight,targetRun,12,dt);
      moveWeight=T.MathUtils.damp(moveWeight,moving?1:0,moving?18:12,dt);
      airWeight=airborne?Math.min(1,airWeight+dt*9):Math.max(0,airWeight-dt*8);
      const previous=cycle;
      if(moving && !airborne)cycle+=distance/(mesh.scale.x*mix(1.22,3.16,runWeight));
      const contacts=Math.floor(cycle*2)-Math.floor(previous*2);
      cycle%=1;
      if(mixer){
        const movingBlend=moveWeight*(1-(air?airWeight:0));
        idle.setEffectiveWeight((1-moveWeight)*(1-(air?airWeight:0)));
        walk.time=clipPhase(walkPhases,cycle)*walk.getClip().duration;
        walk.setEffectiveWeight(movingBlend*(run?1-runWeight:1));
        if(run){run.time=clipPhase(runPhases,cycle)*run.getClip().duration;run.setEffectiveWeight(movingBlend*runWeight);}
        if(air){
          const progress=1-smooth(verticalSpeed,-5.5,5.5);
          air.time=(.14+.61*progress)*air.getClip().duration;
          air.setEffectiveWeight(airWeight);
        }
        mixer.update(dt);
        const support=mix(.48,.255,runWeight);
        const floor=mesh.position.y;
        legs.forEach((leg,i)=>{
          const p=(cycle+1-i*.5)%1;
          const blend=moveWeight*(1-smooth(p,support-.04,support));
          leg?.apply(moving && !airborne && airWeight<.1 && moveWeight>.68 && p<support,blend,floor);
        });
      }
      return contacts;
    },
    get phase(){return cycle;},
    get moveWeight(){return moveWeight;}
  };
}
