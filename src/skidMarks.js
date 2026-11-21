import * as T from 'three';

// Keep a bounded strip for each rear tyre. Positions are sampled in world
// space from the same ground field used by the four wheels.
export function createSkidMarks(scene,groundHeight){
  const capacity=480,positions=new Float32Array(capacity*18);
  const geometry=new T.BufferGeometry(),attr=new T.BufferAttribute(positions,3);
  attr.setUsage(T.DynamicDrawUsage);geometry.setAttribute('position',attr);
  const rubber=new T.MeshBasicMaterial({color:0x352d27,transparent:true,opacity:.43,depthWrite:false,side:T.DoubleSide,
    polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-1});
  const marks=new T.Mesh(geometry,rubber);marks.frustumCulled=false;marks.renderOrder=3;scene.add(marks);
  geometry.setDrawRange(0,0);
  const previous=[],current=[];
  let slot=0,count=0;
  return {
    lift(){previous.length=0;},
    reset(){previous.length=0;slot=count=0;geometry.setDrawRange(0,0);},
    update(v){
      if(Math.abs(v.speed)<3||Math.max(v.tireSlip,v.handbrakeAmount)<.53){previous.length=0;return;}
      const sin=Math.sin(v.yaw),cos=Math.cos(v.yaw);
      for(let n=0;n<4;n++){
        const xSide=(n<2?-.857:.857)+(n%2?.082:-.082);
        const x=v.x+xSide*cos+1.36*sin,z=v.z-xSide*sin+1.36*cos;
        current[n*3]=x;current[n*3+1]=groundHeight(x,z)+.029;current[n*3+2]=z;
      }
      if(previous.length){
        const d=Math.hypot(current[0]-previous[0],current[2]-previous[2]);
        if(d<.20)return;
        if(d<3.5)for(const start of [0,6]){
          let at=slot*18;
          for(const [pts,index] of [[previous,start],[previous,start+3],[current,start+3],[previous,start],[current,start+3],[current,start]]){
            for(let axis=0;axis<3;axis++)positions[at++]=pts[index+axis];
          }
          slot=(slot+1)%capacity;count=Math.min(capacity,count+1);
          attr.needsUpdate=true;geometry.setDrawRange(0,count*6);
        }
      }
      for(let i=0;i<12;i++)previous[i]=current[i];
    }
  };
}
