import test from 'node:test';
import assert from 'node:assert/strict';
import {BoxGeometry,InstancedMesh,Matrix4,MeshBasicMaterial,Scene} from 'three';
import {createDestruction} from '../src/destruction.js';
import {createContactQuery} from '../src/collision.js';
import {drive,resetVehicle} from '../src/handling.js';
import {clearRange} from '../src/pulse.js';

test('a palm tips about its break point and restores its original pose',()=>{
  const scene=new Scene(),mesh=new InstancedMesh(new BoxGeometry(.48,6,.48),new MeshBasicMaterial(),1);
  const bind=new Matrix4().makeTranslation(0,3.4,0);mesh.setMatrixAt(0,bind);mesh.getMatrixAt(0,bind);scene.add(mesh);
  const handle={kind:'palm',broken:false,parts:[{mesh,index:0}],hinge:[0,.4,0],spine:[[0,3,0],[0,6.4,0]]};
  const block={x:0,z:0,w:.6,d:.6,breakable:handle},d=createDestruction(scene,[block],()=>0);
  assert.equal(d.hit(block,3,3,0,-.3,0),false);assert.equal(d.hit(block,18,18,0,-.3,0),true);
  for(let i=0;i<240;i++)d.update(1/60);
  const pose=new Matrix4();mesh.getMatrixAt(0,pose);
  assert.ok(pose.elements[12]>2.9&&pose.elements[13]<.6);
  d.reset();mesh.getMatrixAt(0,pose);assert.deepEqual(pose.elements,bind.elements);assert.equal(handle.broken,false);
});

test('successive hits collapse the building once, exchange the solid footprint for rubble, and reset mid-fall',t=>{
  const ctx={fillRect(){},createRadialGradient(){return {addColorStop(){}};}};
  globalThis.document={createElement:()=>({getContext:()=>ctx})};
  t.after(()=>{delete globalThis.document;});
  const scene=new Scene(),mesh=new InstancedMesh(new BoxGeometry(10,7,10),new MeshBasicMaterial(),1);
  const bind=new Matrix4().makeTranslation(0,3.5,0);mesh.setMatrixAt(0,bind);scene.add(mesh);
  const rubble={kind:'rubble',broken:true,parts:[]};
  const handle={kind:'building',height:7,parts:[{mesh,index:0}],broken:false,rubble};
  const b={x:0,z:0,w:10,d:10,breakable:handle},blocks=[b,{x:0,z:0,w:3.2,d:3.2,breakable:rubble}];
  const effects=[],d=createDestruction(scene,blocks,()=>0,e=>effects.push(e)),query=createContactQuery(blocks,[]);
  for(const complete of [false,true]){
    for(let n=0;n<2;n++){
      d.hit(b,18,18,0,-5,0);d.hit(b,18,18,0,-5,0);d.update(.3);
      assert.equal(handle.broken,false);assert.ok(!handle.falling);
    }
    d.hit(b,18,18,0,-5,0);assert.equal(handle.falling,true);assert.equal(query(4,0,.2),true);
    for(let n=0;n<(complete?135:9);n++)d.update(1/60);
    if(complete){assert.ok(handle.broken);assert.equal(query(4,0,.2),false);assert.equal(query(0,0,.2),true);}
    d.reset();const pose=new Matrix4();mesh.getMatrixAt(0,pose);
    assert.deepEqual(pose.elements,bind.elements);assert.equal(query(4,0,.2),true);
    assert.equal(rubble.broken,true);assert.equal(scene.children.length,1);
  }
  assert.deepEqual(effects,['collapse','collapse']);
});

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
