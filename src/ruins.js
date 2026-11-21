import * as T from 'three';

// A damaged building owns its decals and one instanced pile. Undamaged
// blocks add no draw calls. All positions here are in world metres.
export function createRuins(scene,ground){
  const sites=new Map(),dummy=new T.Object3D(),tint=new T.Color();
  const stone=new T.MeshStandardMaterial({roughness:.96,flatShading:true});
  stone.onBeforeCompile=s=>{
    s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vStone;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvStone=(instanceMatrix*vec4(position,1.)).xyz;');
    s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vStone;')
      .replace('#include <color_fragment>',`#include <color_fragment>
        float grit=fract(sin(mod(dot(floor(vStone*79.),vec3(19.3,52.7,9.3)),6.28318))*8637.6);
        diffuseColor.rgb*=.78+.14*sin(vStone.y*19.+vStone.x*.6)+.23*mix(grit,.5,smoothstep(.1,1.,length(fwidth(vStone))*79.));
      `);
  };
  // An eight-sided slab with clipped corners, exposed aggregate and an
  // uneven fracture plane. The same geometry scales from chips to floor slabs.
  const outline=[[-.48,-.30],[-.30,-.49],[.27,-.5],[.50,-.24],[.44,.32],[.19,.48],[-.32,.46],[-.50,.15]];
  const vertices=[],indices=[];
  for(let j=0;j<2;j++)outline.forEach(([x,z],i)=>vertices.push(x*(j?.86:1),j?.38+.12*Math.sin(4*i):-.49,z*(j?.91:1)));
  for(let i=0;i<8;i++){
    const n=(i+1)%8;indices.push(i,8+i,n,8+i,8+n,n);
    if(i>0&&i<7)indices.push(8,8+n,8+i,0,i,n);
  }
  const raw=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(vertices,3));
  raw.setIndex(indices);const slab=raw.toNonIndexed();raw.dispose();slab.computeVertexNormals();
  const bar=new T.CylinderGeometry(.024,.027,1,5),rust=new T.MeshStandardMaterial({color:0x705045,roughness:.88});
  const crack=new T.LineBasicMaterial({color:0x382c29,transparent:true,opacity:.85,depthWrite:false});
  let dustMap;
  function cloudMap(){
    if(dustMap)return dustMap;
    const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
    const ctx=canvas.getContext('2d'),g=ctx.createRadialGradient(32,32,0,32,32,32);
    g.addColorStop(0,'rgba(233,205,174,.75)');g.addColorStop(.44,'rgba(211,187,165,.52)');g.addColorStop(1,'rgba(202,178,155,0)');
    ctx.fillStyle=g;ctx.fillRect(0,0,64,64);dustMap=new T.CanvasTexture(canvas);dustMap.colorSpace=T.SRGBColorSpace;return dustMap;
  }
  function mark(b,x,z){
    let site=sites.get(b);
    if(!site){
      const group=new T.Group();scene.add(group);
      site={group,marks:[],clouds:[],pieces:[]};sites.set(b,site);
    }
    if(site.marks.length>=6)return;
    const dx=x-b.x,dz=z-b.z,onX=b.w/2-Math.abs(dx)<b.d/2-Math.abs(dz);
    const side=Math.sign(onX?dx:dz)||1,lines=[];
    const cy=ground(x,z)+1.15+site.marks.length*.13;
    function point(u,v){
      return onX?[b.x+side*(b.w/2+.054),cy+v,T.MathUtils.clamp(z+u,b.z-b.d/2,b.z+b.d/2)]:
        [T.MathUtils.clamp(x+u,b.x-b.w/2,b.x+b.w/2),cy+v,b.z+side*(b.d/2+.054)];
    }
    for(let j=0;j<9;j++){
      const a=j*2.399+site.marks.length*.87,L=.48+(j%4)*.23,u=Math.sin(a)*L,v=Math.cos(a)*L;
      const fork=point(u*.56+.07,v*.52),end=point(u,v);
      lines.push(...point(0,0),...fork,...fork,...end,...fork,...point(u*.85+.16,v*.64-.09));
    }
    const geom=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(lines,3));
    const mesh=new T.LineSegments(geom,crack);site.group.add(mesh);site.marks.push(mesh);
  }
  function begin(b){
    const site=sites.get(b);
    for(const mesh of site.marks)mesh.visible=false;
    const count=Math.min(125,Math.round(30+Math.sqrt(b.w*b.d)*2.7));
    const pile=new T.InstancedMesh(slab,stone,count);pile.castShadow=pile.receiveShadow=true;pile.frustumCulled=false;
    site.group.add(pile);site.pile=pile;
    let seed=(Math.round(b.x*873+b.z*1391)>>>0);
    const rnd=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
    for(let i=0;i<pile.count;i++){
      const a=rnd()*Math.PI*2,r=i===0?0:Math.pow(rnd(),.92)*.48;
      const x=b.x+Math.cos(a)*r*b.w,z=b.z+Math.sin(a)*r*b.d;
      const base=i===0,inner=Math.max(0,1-r/.28),size=Math.min(b.w,b.d);
      const scale=base?[b.w*.33,1.16,b.d*.33]:[.42+rnd()*size*.24,.18+rnd()*.56,.28+rnd()*size*.12];
      site.pieces.push({x,z,y:ground(x,z)+scale[1]*.40+(base?0:inner*(.4+rnd()*1.2)),scale,
        rx:base?0:(rnd()-.5)*.81,rz:base?0:(rnd()-.5)*.73,ry:base?0:rnd()*6.28,
        lift:base?0:.6+rnd()*1.8});
      pile.setColorAt(i,tint.setHex([0xa39689,0x817770,0xada89d,0x846f5e,0x969390][i%5]));
    }
    const steel=new T.InstancedMesh(bar,rust,16);
    steel.position.set(b.x,ground(b.x,b.z),b.z);
    for(let i=0;i<steel.count;i++){
      const a=rnd()*6.28,r=rnd()*.16;
      dummy.position.set(Math.cos(a)*r*b.w,1.10,Math.sin(a)*r*b.d);
      dummy.rotation.set(rnd()*.93,rnd()*6.28,rnd()*.86);dummy.scale.set(1,.9+rnd()*1.5,1);dummy.updateMatrix();
      steel.setMatrixAt(i,dummy.matrix);
    }
    steel.castShadow=true;site.group.add(steel);site.steel=steel;
    const material=new T.SpriteMaterial({map:cloudMap(),transparent:true,depthWrite:false,opacity:0});
    for(let i=0;i<9;i++){
      const a=i*2.399,r=.28+rnd()*.17;
      const sprite=new T.Sprite(material);
      sprite.position.set(b.x+Math.cos(a)*b.w*r,ground(b.x,b.z)+.45,b.z+Math.sin(a)*b.d*r);
      site.group.add(sprite);site.clouds.push(sprite);
    }
    return site;
  }
  function animate(site,b,t){
    const air=Math.sin(Math.PI*t),spread=.69+.31*t;
    site.pieces.forEach((p,i)=>{
      dummy.position.set(b.x+(p.x-b.x)*spread,p.y+p.lift*air,b.z+(p.z-b.z)*spread);
      dummy.rotation.set(p.rx+air*p.lift*.55,p.ry+air*.34,p.rz);
      dummy.scale.set(...p.scale).multiplyScalar(.2+.8*Math.min(1,t*3));dummy.updateMatrix();
      site.pile.setMatrixAt(i,dummy.matrix);
    });
    site.pile.instanceMatrix.needsUpdate=true;
    site.steel.scale.y=Math.min(1,t*2);
    for(const [i,sprite] of site.clouds.entries()){
      const size=Math.min(10,2+Math.sqrt(b.w*b.d)*.36)*(.22+t*(1.2+i%3*.12));
      sprite.scale.set(size,size*.75,1);sprite.position.y=ground(sprite.position.x,sprite.position.z)+size*.25;
    }
    site.clouds[0].material.opacity=.63*Math.sin(Math.PI*Math.sqrt(t));
    if(t>=1){
      site.clouds[0].material.dispose();
      for(const c of site.clouds)site.group.remove(c);
      site.clouds.length=0;site.pile.computeBoundingSphere();site.pile.frustumCulled=true;
    }
  }
  function reset(){
    for(const site of sites.values()){
      for(const m of site.marks)m.geometry.dispose();
      site.clouds[0]?.material.dispose();site.pile?.dispose();site.steel?.dispose();scene.remove(site.group);
    }
    sites.clear();
  }
  return {mark,begin,animate,reset};
}
