import test from 'node:test';
import assert from 'node:assert/strict';
import {createCar} from '../src/vehicles.js';
import {drive,resetVehicle} from '../src/handling.js';
import {createContactQuery} from '../src/collision.js';

test('opposite corner collisions dent both cars locally and repair restores the original meshes and alignment',t=>{
  const ctx={translate(){},scale(){},fillRect(){},createRadialGradient(){return {addColorStop(){}};}};
  globalThis.document={createElement:()=>({getContext:()=>ctx})};
  t.after(()=>{delete globalThis.document;});
  const car=createCar(),parked=createCar(),hit=createContactQuery([],[{model:parked}]);
  const paint=model=>model.mesh.children[0].children.find(o=>o.material?.clearcoat>0).geometry;
  const geo=paint(car),other=paint(parked),v={};
  const before=geo.attributes.position.array.slice(),normal=geo.attributes.normal.array.slice();
  const parkedBefore=other.attributes.position.array.slice();
  for(const side of [-1,1]){
    resetVehicle(v);Object.assign(v,{x:side*1.39,z:9,yaw:0,speed:19,vz:-19});
    for(let k=0;k<42;k++)drive(v,{turn:0},1/60,hit,(_,c)=>car.dent(c));
    assert.ok(v.damage>0);
    const peaks=[0,0],now=geo.attributes.position.array;
    for(let i=0;i<now.length;i+=3){
      const half=Math.sign(before[i])===side?0:1;
      peaks[half]=Math.max(peaks[half],Math.hypot(now[i]-before[i],now[i+1]-before[i+1],now[i+2]-before[i+2]));
    }
    assert.ok(peaks[1]>.10 && peaks[1]>peaks[0]*1.5);
    assert.ok(Math.sign(car.steeringBias)===side);
    assert.ok(other.attributes.position.array.some((x,i)=>Math.abs(x-parkedBefore[i])>.04));
    assert.ok(geo.attributes.wear.array.some(w=>w>.10));
    const struck=side>0?0:1;
    assert.ok(car.headlightStrength(struck)<car.headlightStrength(1-struck));
    car.restore();parked.restore();
    assert.equal(car.headlightStrength(struck),1);assert.ok(geo.attributes.wear.array.every(w=>w===0));
    assert.deepEqual(now,before);assert.deepEqual(geo.attributes.normal.array,normal);
    assert.deepEqual(other.attributes.position.array,parkedBefore);assert.equal(car.steeringBias,0);
  }
});
