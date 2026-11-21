import test from 'node:test';
import assert from 'node:assert/strict';
import {BoxGeometry,InstancedMesh,Matrix4,MeshBasicMaterial,Scene} from 'three';
import {createDestruction} from '../src/destruction.js';
import {createContactQuery} from '../src/collision.js';
import {drive,resetVehicle} from '../src/handling.js';
import {clearRange} from '../src/pulse.js';

test('a breached railing opens only the struck section and restores on restart',()=>{
  const scene=new Scene(),mesh=new InstancedMesh(new BoxGeometry(.19,.82,6),new MeshBasicMaterial(),2);
  scene.add(mesh);
  const blocks=[60,66].map((z,index)=>{
    mesh.setMatrixAt(index,new Matrix4().makeTranslation(17,.51,z));
    return {x:17,z,w:.19,d:6,breakable:{kind:'rail',broken:false,parts:[{mesh,index}]}};
  });
  const destruction=createDestruction(scene,blocks,()=>0),query=createContactQuery(blocks,[]);
  const original=new Matrix4();mesh.getMatrixAt(0,original);
  const vehicle={};resetVehicle(vehicle);
  Object.assign(vehicle,{x:11,z:60,yaw:-Math.PI/2,speed:14,vx:14,vz:0});
  assert.equal(destruction.hit(blocks[0],.9,1,0,17,60),false);
  for(let i=0;i<60;i++){
    drive(vehicle,{turn:0,breakProp:destruction.hit},1/60,query,()=>{});
    destruction.update(1/60);
  }
  assert.ok(vehicle.x>20);
  assert.equal(query(17,60,.2),false);
  assert.equal(query(17,66,.2),true);
  assert.equal(clearRange(11,60,1,0,12,blocks),12);
  const pose=new Matrix4();
  mesh.getMatrixAt(0,pose);
  assert.notDeepEqual(pose.elements,original.elements);
  destruction.reset();
  assert.equal(query(17,60,.2),true);
  mesh.getMatrixAt(0,pose);
  assert.deepEqual(pose.elements,original.elements);
});
