import test from 'node:test';
import assert from 'node:assert/strict';
import {Scene,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createDistrict} from '../src/district.js';

test('traffic faces its direction of travel after interpolated frames, including loop seams',async t=>{
  // Only the contact shadow needs a canvas. Exercise the actual simulation,
  // Three.js scene graph and quaternion interpolation without a GPU.
  const ctx={translate(){},scale(){},fillRect(){},createRadialGradient(){return {addColorStop(){}};}};
  globalThis.document={createElement:()=>({getContext:()=>ctx})};
  t.after(()=>{delete globalThis.document;});
  t.mock.method(GLTFLoader.prototype,'loadAsync',async()=>null);
  const district=createDistrict(new Scene()),traffic=district.cars.filter(c=>c.path);
  const far=new Vector3(1e5,0,1e5),nose=new Vector3();
  for(const hz of [30,60,144]){
    for(const car of traffic)car.initialOffset=car.length-1;
    district.reset();
    const previous=traffic.map(c=>c.model.mesh.position.clone());
    let debt=0;
    for(let frame=0;frame<hz*3;frame++){
      debt+=1/hz;
      while(debt>=1/60){district.update(1/60,far,false);debt-=1/60;}
      district.render(debt*60);
      traffic.forEach((car,i)=>{
        const mesh=car.model.mesh,dx=mesh.position.x-previous[i].x,dz=mesh.position.z-previous[i].z;
        const moved=Math.hypot(dx,dz);
        if(moved>1e-5){
          nose.set(0,0,-1).applyQuaternion(mesh.quaternion);
          const alignment=(nose.x*dx+nose.z*dz)/(Math.hypot(nose.x,nose.z)*moved);
          assert.ok(alignment>Math.cos(5*Math.PI/180),`car ${i} rotated across its lane at ${hz} Hz`);
        }
        previous[i].copy(mesh.position);
      });
    }
  }
});
