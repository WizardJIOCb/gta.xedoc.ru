import * as THREE from 'three';
import { AVENUES, CROSS_STREETS, CITY_BOUNDS as BOUNDS, regionGroundHeight, REGIONAL_LOTS, canalDeck, onCanalBridge } from './map.js';
import { buildRegion } from './region.js';
import { buildCityEdge } from './cityEdge.js';
import { addRegionalProps } from './regionalProps.js';

const ORIGINAL_ROWS = [-192,-128,-64,0,64];
const HOTELS = [
  ['SOLANA', 'Ocean apartments', '#efd8b8', '#a3dad4'],
  ['TROPICO', 'Supper club', '#e9b6ab', '#d46f71'],
  ['PALM ROYALE', 'Private suites', '#d2d8c5', '#5d9b9d'],
  ['THE MERIDIAN', 'Rooms by the sea', '#eee0c8', '#e48b76'],
  ['MARLIN', 'Hotel & pool', '#d6e3de', '#83b6b5'],
  ['SUNDIAL', 'Beach club', '#e8c5aa', '#83b2a7'],
  ['CASABLANCA', 'Oceanfront hotel', '#eee4d3', '#d0a089'],
  ['LIDO', 'Cocktail lounge', '#f1ccbe', '#80afa9'],
  ['OCEAN HOUSE', 'Palm Coast', '#e7ddc3', '#aab4cb'],
  ['VISTA PALMS', 'South beach hotel', '#ddc4ae', '#61aaa6'],
  ['CORAL REEF', 'Resort & cabanas', '#efb7a4', '#a1b4a4'],
  ['HOTEL MIRAMAR', 'Guest suites', '#eddbb8', '#d28075'],
];

function randomGenerator(seed) {
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function canvasTexture(w, h, draw, repeat = false) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function streetTexture() {
  const rnd = randomGenerator(91);
  return canvasTexture(512, 512, (g, w, h) => {
    const im = g.createImageData(w, h);
    for (let i = 0; i < im.data.length; i += 4) {
      const n = (rnd() + rnd() - 1) * 32 + (rnd() > .985 ? 35 : 0);
      im.data.set([73 + n, 72 + n, 74 + n, 255], i);
    }
    g.putImageData(im, 0, 0);
    for (let i = 0; i < 75; i++) {
      const x = rnd()*w, y = rnd()*h, r = 4+rnd()*56;
      const haze = g.createRadialGradient(x,y,0,x,y,r);
      haze.addColorStop(0, 'rgba(20,25,39,.15)'); haze.addColorStop(1,'rgba(24,27,31,0)');
      g.fillStyle = haze; g.fillRect(x-r,y-r,r*2,r*2);
    }
    for (let i=0;i<8;i++) {
      let x=rnd()*w,y=rnd()*h;
      g.strokeStyle='rgba(20,24,28,.36)'; g.lineWidth=.45+rnd()*.7;
      g.beginPath(); g.moveTo(x,y);
      for(let k=0;k<8;k++) { x+=rnd()*9-2; y+=rnd()*13-3; g.lineTo(x,y); }
      g.stroke();
    }
  }, true);
}

function sidewalkTexture() {
  const rnd=randomGenerator(40);
  return canvasTexture(256,256,(g,w,h)=>{
    g.fillStyle='#cfc3b5';g.fillRect(0,0,w,h);
    for(let i=0;i<6000;i++){
      g.fillStyle=rnd()<.5?'rgba(72,64,57,.08)':'rgba(255,250,239,.19)';
      g.fillRect(rnd()*w,rnd()*h,1+rnd()*2,1);
    }
    for(let a=0;a<=256;a+=128) {
      g.fillStyle='rgba(62,57,51,.28)';g.fillRect(a,0,1,h);g.fillRect(0,a,w,1);
      g.fillStyle='rgba(255,246,228,.4)';g.fillRect(a+1,0,1,h);g.fillRect(0,a+1,w,1);
    }
  },true);
}

// Each facade in the atlas contains its own glass reflections, curtains, plaster and shop interior.
function facadeAtlas() {
  const rnd=randomGenerator(202);
  const cw=512,ch=512;
  return canvasTexture(cw*4,ch*3,(g)=>{
    HOTELS.forEach((hotel,n)=>{
      const fx=(n%4)*cw, fy=Math.floor(n/4)*ch;
      g.save();g.translate(fx,fy); g.beginPath();g.rect(0,0,cw,ch);g.clip();
      g.fillStyle=hotel[2];g.fillRect(0,0,cw,ch);
      for(let k=0;k<34000;k++){
        g.fillStyle=k%2?'rgba(95,69,50,.027)':'rgba(255,255,240,.085)';
        g.fillRect(rnd()*cw,rnd()*ch,1+rnd()*3,1+rnd()*2);
      }
      const rows=3+n%3,cols=4+n%4,top=15, bottom=399,rh=(bottom-top)/rows;
      const gap=cw/cols;
      for(let j=0;j<rows;j++) {
        const y=top+j*rh;
        g.fillStyle='rgba(66,65,62,.14)';g.fillRect(0,y-3,cw,2);
        g.fillStyle='rgba(255,251,228,.46)';g.fillRect(0,y-6,cw,3);
        for(let i=0;i<cols;i++){
          const ww=gap*(n%4===1?.77:.63),wh=rh*.65,x=i*gap+(gap-ww)/2,wy=y+(rh-wh)*.35;
          g.fillStyle='rgba(56,48,48,.25)';g.fillRect(x-2,wy-1,ww+5,wh+6);
          g.fillStyle='#e5ddd0';g.fillRect(x-2,wy-3,ww+4,wh+6);
          let glass=g.createLinearGradient(0,wy,0,wy+wh);
          const lights=rnd()<.27;
          glass.addColorStop(0,lights?'#d5bb97':'#5f8091');glass.addColorStop(.55,lights?'#b99a83':'#778e98');
          glass.addColorStop(1,lights?'#b2785c':'#344c55');
          g.fillStyle=glass;g.fillRect(x,wy,ww,wh);
          const curtain = ww*(.06+rnd()*.32);
          g.fillStyle=lights?'rgba(244,229,197,.75)':'rgba(206,208,198,.6)';
          g.fillRect(x,wy,curtain,wh);if(rnd()<.7)g.fillRect(x+ww-curtain*.68,wy,curtain*.68,wh);
          g.fillStyle='rgba(35,50,56,.18)';
          for(let v=1;v<curtain;v+=5)g.fillRect(x+v,wy,1,wh);
          g.fillStyle='rgba(247,235,214,.76)';g.fillRect(x+ww*.52,wy,2,wh);
          if(n%3!==1)g.fillRect(x,wy+wh*.45,ww,2);
          g.fillStyle='rgba(31,36,40,.33)';g.fillRect(x,wy,ww,3);
          g.fillStyle='rgba(252,240,214,.85)';g.fillRect(x-4,wy+wh,ww+8,3);
        }
      }
      g.fillStyle='#c5c3b1';g.fillRect(0,401,cw,111);
      for(let i=0;i<4;i++){
        const x=10+i*127, ww=109;
        const shop=g.createLinearGradient(0,407,0,506);
        shop.addColorStop(0,'#374a4e');shop.addColorStop(.59,'#7c8880');shop.addColorStop(1,'#394846');
        g.fillStyle=shop;g.fillRect(x,412,ww,93);
        g.fillStyle='rgba(244,168,100,.68)';g.fillRect(x+6,421,ww-12,3);
        for(let k=0;k<8;k++){
          g.fillStyle=['#778982','#d6aa80','#5f7477','#b98672'][k%4];
          g.fillRect(x+8+k*12,461+rnd()*11,4+rnd()*7,14+rnd()*14);
        }
        g.fillStyle='#cfc6b2';g.fillRect(x+ww*.5,412,2,94);g.fillRect(x,442,ww,2);
        g.fillStyle='rgba(220,227,219,.14)';g.beginPath();g.moveTo(x+5,414);g.lineTo(x+44,414);g.lineTo(x+20,504);g.lineTo(x+2,504);g.fill();
      }
      g.restore();
    });
  });
}

function signAtlas() {
  const names=[...HOTELS.map(h=>[h[0],h[1]]),['PIER 9','MARINE & AUTO'],['PALM COAST','ATLANTIC BOULEVARD'],['MARINA KEYS','YACHT BASIN'],['LA HABANA','PLAZA DEL SOL']];
  return canvasTexture(2048,1024,(g)=>{
    names.forEach(([name,sub],i)=>{
      const x=(i%4)*512,y=Math.floor(i/4)*256;
      g.save();g.translate(x,y);g.fillStyle=['#224951','#9e625a','#4b6f6a','#685869'][i%4];g.fillRect(0,0,512,256);
      g.lineWidth=2;g.strokeStyle='#e6bc8c';g.strokeRect(8,8,496,240);g.strokeRect(13,14,486,228);
      const gradient=g.createLinearGradient(0,20,0,240); gradient.addColorStop(0,'rgba(255,255,240,.13)');gradient.addColorStop(1,'rgba(48,22,27,.26)');
      g.fillStyle=gradient;g.fillRect(0,0,512,256);
      g.textAlign='center';g.textBaseline='middle';g.shadowColor='#e6bd98';g.shadowBlur=6;
      g.fillStyle='#fff0cd';g.font=['italic 64px Georgia','700 64px Arial','600 55px Georgia','italic 63px Georgia'][i%4];g.fillText(name,256,112,451);
      g.shadowBlur=0;g.fillStyle='#f3cf9d';g.font='24px Arial';g.fillText(sub.toUpperCase().split('').join(' '),256,174,425);
      for(let j=0;j<3;j++){g.fillRect(95+j*12,60-j*4,322-j*24,2);}
      g.restore();
    });
  });
}

// Store the top faces the level builder marks as walkable. Queries share the
// coordinates used to render each surface, including overlapping curb lips.
class GroundField {
  constructor(){this.cells=new Map();}
  add(x0,z0,x1,z1,top,circle=null) {
    const patch={x0,z0,x1,z1,top,circle};
    for(let ix=Math.floor(x0/16);ix<=Math.floor(x1/16);ix++){
      for(let iz=Math.floor(z0/16);iz<=Math.floor(z1/16);iz++){
        const key=ix+','+iz;
        if(!this.cells.has(key))this.cells.set(key,[]);
        this.cells.get(key).push(patch);
      }
    }
  }
  height(x,z) {
    let y=0;
    const patches=this.cells.get(Math.floor(x/16)+','+Math.floor(z/16));
    if(!patches)return y;
    for(const p of patches) {
      if(p.top<=y || x<p.x0 || x>p.x1 || z<p.z0 || z>p.z1)continue;
      if(p.circle && (x-p.circle.x)**2+(z-p.circle.z)**2>p.circle.r2)continue;
      y=p.top;
    }
    return y;
  }
}

class StaticWorld {
  constructor(scene,floor=null,blocks=null) {
    this.scene=scene;this.floor=floor;this.geometry=new Map();this.batches=new Map();this.surfaces=new Map();
    this.blocks=blocks;this.fixture=null;
    this.dummy=new THREE.Object3D();this.col=new THREE.Color();
  }
  breakable(kind,x,z,w,d,build){
    const handle={kind,parts:[],broken:false};
    this.blocks.push({x,z,w,d,breakable:handle});
    this.fixture=handle;
    build();
    this.fixture=null;
    return handle;
  }
  railBetween(a,c,build){
    // A box around an entire diagonal rail would obstruct the driving lane.
    // Short footprints follow the metalwork and all release the same panel.
    const dx=c[0]-a[0],dz=c[2]-a[2];
    const n=Math.max(1,Math.ceil(Math.min(Math.abs(dx),Math.abs(dz))/.70));
    const w=Math.abs(dx)/n+.16,d=Math.abs(dz)/n+.16;
    const handle=this.breakable('rail',a[0]+dx/(2*n),a[2]+dz/(2*n),w,d,build);
    for(let i=1;i<n;i++)this.blocks.push({x:a[0]+dx*(i+.5)/n,z:a[2]+dz*(i+.5)/n,w,d,breakable:handle});
  }
  instance(type, mat, xyz, size, color, rot=[0,0,0], quaternion=null) {
    const key=type+mat.uuid;
    if(!this.batches.has(key))this.batches.set(key,{type,mat,list:[]});
    this.dummy.position.set(...xyz);this.dummy.scale.set(...size);
    if(quaternion)this.dummy.quaternion.copy(quaternion);else this.dummy.rotation.set(...rot);
    this.dummy.updateMatrix();this.batches.get(key).list.push([this.dummy.matrix.clone(),color,this.fixture]);
  }
  box(mat,x,y,z,w,h,d,color,rot=0) {this.instance('box',mat,[x,y,z],[w,h,d],color,[0,rot,0]);}
  walkableBox(mat,x,y,z,w,h,d,color) {
    this.box(mat,x,y,z,w,h,d,color);
    this.floor.add(x-w/2,z-d/2,x+w/2,z+d/2,y+h/2);
  }
  walkableDisc(mat,x,y,z,r,h,color) {
    this.instance('disc',mat,[x,y,z],[r,h,r],color);
    this.floor.add(x-r,z-r,x+r,z+r,y+h/2,{x,z,r2:r*r});
  }
  rod(mat,a,b,r,color,type='rod') {
    const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),dir=end.clone().sub(start);
    if(dir.lengthSq()<.000001)return;
    const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),dir.clone().normalize());
    const pos=start.add(end).multiplyScalar(.5);
    this.instance(type,mat,pos.toArray(),[r,dir.length(),r],color,undefined,q);
  }
  quad(mat,points,uv=[[0,0],[1,0],[1,1],[0,1]],color='#ffffff') {
    if(!this.surfaces.has(mat))this.surfaces.set(mat,{pos:[],uv:[],indices:[],colors:[],fixtures:[]});
    const s=this.surfaces.get(mat),base=s.pos.length/3;this.col.set(color);
    if(this.fixture)s.fixtures.push([this.fixture,base]);
    for(let i=0;i<4;i++){s.pos.push(...points[i]);s.uv.push(...uv[i]);s.colors.push(this.col.r,this.col.g,this.col.b);}
    s.indices.push(base,base+1,base+2,base,base+2,base+3);
  }
  finish() {
    const geos={box:new THREE.BoxGeometry(1,1,1),rod:new THREE.CylinderGeometry(1,1,1,7),
      disc:new THREE.CylinderGeometry(1,1,1,20), cone:new THREE.ConeGeometry(1,1,12),
      oval:new THREE.SphereGeometry(1,10,7)};
    for(const {type,mat,list} of this.batches.values()){
      const mesh=new THREE.InstancedMesh(geos[type],mat,list.length);
      list.forEach(([matrix,col,fixture],i)=>{
        mesh.setMatrixAt(i,matrix);mesh.setColorAt(i,this.col.set(col));
        if(fixture)fixture.parts.push({mesh,index:i});
      });
      mesh.computeBoundingSphere();mesh.receiveShadow=true;mesh.castShadow=true;this.scene.add(mesh);
    }
    for(const [mat,s] of this.surfaces){
      const geo=new THREE.BufferGeometry();
      geo.setAttribute('position',new THREE.Float32BufferAttribute(s.pos,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(s.uv,2));
      geo.setAttribute('color',new THREE.Float32BufferAttribute(s.colors,3));geo.setIndex(s.indices);geo.computeVertexNormals();
      const mesh=new THREE.Mesh(geo,mat);mesh.receiveShadow=true;mesh.castShadow=mat.userData.casts===true;this.scene.add(mesh);
      for(const [fixture,firstVertex] of s.fixtures)fixture.parts.push({mesh,firstVertex,vertexCount:4});
    }
  }
}

// World XZ quad. The winding keeps its normal upward.
function ground(b,mat,x0,z0,x1,z1,y,tile=1,color='#ffffff') {
  b.quad(mat,[[x0,y,z1],[x1,y,z1],[x1,y,z0],[x0,y,z0]],
    [[x0/tile,-z1/tile],[x1/tile,-z1/tile],[x1/tile,-z0/tile],[x0/tile,-z0/tile]],color);
  b.floor.add(x0,z0,x1,z1,y);
}

function atlasUV(i,cols,rows) {
  const x=i%cols,y=Math.floor(i/cols),a=(x+.003)/cols,b=(x+.997)/cols,c=1-(y+.997)/rows,d=1-(y+.003)/rows;
  return [[a,c],[b,c],[b,d],[a,d]];
}

function eastFace(b,mat,x,y,z,w,h,id,rows) {
  b.quad(mat,[[x,y,z+w/2],[x,y,z-w/2],[x,y+h,z-w/2],[x,y+h,z+w/2]],atlasUV(id,4,rows));
}
function northFace(b,mat,x,y,z,w,h,id,rows,north) {
  const left=north?x+w/2:x-w/2,right=north?x-w/2:x+w/2;
  b.quad(mat,[[left,y,z],[right,y,z],[right,y+h,z],[left,y+h,z]],atlasUV(id,4,rows));
}

function featherTexture() {
  const rnd=randomGenerator(959);
  return canvasTexture(512,128,(g)=>{
    for(let side of [-1,1]) {
      for(let i=0;i<56;i++) {
        const t=i/58, root=4+t*490, span=(10+48*Math.sin(Math.PI*(t*.86+.07)))*(1-t*.4)*(0.78+rnd()*.24);
        const tipX=Math.min(511,root+12+(1-t)*44+rnd()*11);
        const tipY=64+side*span;
        const light=61+Math.floor(rnd()*53);
        const grad=g.createLinearGradient(root,64,tipX,tipY);
        grad.addColorStop(0,'rgb('+light+','+(light+37)+','+Math.round(light*.47)+')');
        grad.addColorStop(.58,'rgb('+(light+29)+','+(light+47)+','+Math.round(light*.54)+')');
        grad.addColorStop(1,'rgb('+(light-18)+','+(light+13)+','+Math.round(light*.41)+')');
        g.fillStyle=grad;
        g.beginPath();g.moveTo(root-2,64);g.quadraticCurveTo(root+11,64+side*span*.65,tipX,tipY);
        g.quadraticCurveTo(root+17,64+side*span*.42,root+5,64);g.fill();
        g.strokeStyle='rgba(193,186,106,.35)';g.lineWidth=.8;g.beginPath();g.moveTo(root,64);g.quadraticCurveTo(root+12,64+side*span*.5,tipX,tipY);g.stroke();
      }
    }
    g.strokeStyle='#919052';g.lineWidth=2.8;g.beginPath();g.moveTo(0,64);g.lineTo(510,64);g.stroke();
  });
}

function palm(b,m,rnd,x,z,height,heading) {
  const bx=x,bz=z,lean=.4+rnd()*1.2;
  const groundY=x>17?.026:.15;
  const bend=t=>[bx+Math.cos(heading)*lean*t*t+Math.sin(heading)*.35*Math.sin(t*Math.PI),
    groundY+height*t,bz+Math.sin(heading)*lean*t*t];
  const ringCount=14, sides=8;
  for(let i=0;i<ringCount;i++) {
    const ta=i/ringCount,tb=(i+1)/ringCount,ca=bend(ta),cb=bend(tb);
    const ra=.29*(1-.47*ta)+(i===0?.07:0),rb=.29*(1-.47*tb);
    const colors=['#eee7db','#e7dfd0','#ece2d5','#e8dfd1','#e9e2d5'];
    for(let s=0;s<sides;s++) {
      const a=s/sides*Math.PI*2,c=(s+1)/sides*Math.PI*2;
      const point=(center,ang,r)=>[center[0]+Math.cos(ang)*r,center[1],center[2]+Math.sin(ang)*r];
      b.quad(m.bark,[point(ca,c,ra),point(ca,a,ra),point(cb,a,rb),point(cb,c,rb)],
        [[(s+1)/sides,ta*4],[s/sides,ta*4],[s/sides,tb*4],[(s+1)/sides,tb*4]],colors[i%5]);
    }
  }
  const top=bend(1),scale=height/8;
  for(let j=0;j<21;j++) {
    const ang=j*2.39996+heading+rnd()*.27,dx=Math.cos(ang),dz=Math.sin(ang);
    const lower=j<12,len=(lower?3.5+rnd()*1.25:1.6+rnd()*1.5)*scale;
    const lift=(lower?.85+rnd()*.9:1.6+rnd()*1.2)*scale;
    const sag=(lower?1.0+rnd()*1.3:.15+rnd()*.8)*scale;
    const width=(lower?.67:.49)*scale;
    const widthAt=t=>width*(.70+.30*Math.sin(Math.PI*t));
    const p=(t,side)=>[top[0]+dx*len*t-dz*widthAt(t)*side,
      top[1]+lift*Math.sin(Math.PI*t*.88)-sag*t*t-.22*scale*Math.abs(side),
      top[2]+dz*len*t+dx*widthAt(t)*side];
    const tint=lower?['#f1ebc0','#f3f3d5','#dde7bb','#eee6a6'][j%4]:'#f0e2a9';
    for(let k=0;k<5;k++){
      const ta=k/5,tb=(k+1)/5;
      b.quad(m.leaf,[p(ta,-1),p(ta,1),p(tb,1),p(tb,-1)],[[ta,0],[ta,1],[tb,1],[tb,0]],tint);
    }
  }
  for(let k=0;k<3;k++) b.instance('oval',m.stone,[top[0]+Math.sin(k*2.1)*.18,top[1]-.25,top[2]+Math.cos(k*2.1)*.18],[.18,.28,.18],'#7e7844');
}

function decoHotel(b,m,rnd,blocks,x,z,w,d,h,id,iconic) {
  // X measures footprint depth, Z is the length of the Ocean Drive frontage.
  const hotel=HOTELS[id],front=x+w/2,base=.19,roof=base+h;
  const plaster=hotel[2],accent=hotel[3];
  b.box(m.stone,x,base+h/2,z,w,h,d,plaster);
  blocks.push({x,z,w,d});
  eastFace(b,m.facade,front+.012,base,z,d,h,id,3);
  northFace(b,m.facade,x,base,z-d/2-.012,w,h,id,3,true);
  northFace(b,m.facade,x,base,z+d/2+.012,w,h,id,3,false);
  const shelf=(y,over,hh,tint)=>b.box(m.stone,x+.08,y,z,w+over,hh,d+over,tint);
  shelf(roof-.12,.4,.34,plaster);shelf(roof-.45,.23,.10,accent);
  b.box(m.stone,x,roof+.12,z,w-.50,.22,d-.50,'#9c9283');
  for(const edge of [-1,1]) {
    b.box(m.stone,x+w/2*edge,roof+.32,z,.27,.58,d+.2,plaster);
    b.box(m.stone,x,roof+.32,z+d/2*edge,w,.58,.25,plaster);
  }
  const floorCount=3+id%3,groundH=h*.22;
  b.box(m.stone,front+.12,base+groundH+.15,z,.72,.36,d+.33,plaster);
  b.box(m.stone,front+.48,base+groundH+.1,z,.08,.13,d+.45,accent);
  if(id%3===0 || iconic){
    // Recessed central tower, speed stripes and a raised crown.
    const fz=z+d*.15,tw=Math.min(4.8,d*.27);
    b.box(m.stone,front+.23,h*.60,fz,.95,h*1.18,tw,plaster);
    for(let k=-1;k<=1;k++) {
      const hh=h*(1.16-.055*Math.abs(k));
      b.box(m.stone,front+.78,hh*.5+.16,fz+k*.57,.34,hh,.21,accent);
      b.box(m.trim,front+.962,hh*.56,fz+k*.57,.02,hh*.84,.063,'#f9d2ad');
    }
    b.box(m.stone,front-1.1,roof+1.0,fz,3.3,2.15,tw,plaster);
    b.box(m.stone,front-1.25,roof+2.2,fz,2.7,.32,tw*.65,accent);
  }else if(id%3===1){
    for(let j=1;j<=floorCount;j++){
      const y=groundH+(h-groundH)*j/floorCount;
      b.box(m.stone,front+.30,y,z,.8,.18,d+.58,plaster);
      b.box(m.stone,front+.73,y-.04,z,.07,.055,d+.50,accent);
      for(let side of [-1,1]) b.box(m.stone,front-1.3,y,z+side*d*.5,3.8,.16,.60,plaster);
    }
  }else{
    for(const zoff of [-.34,0,.34]) {
      b.box(m.stone,front+.14,roof*.54,z+zoff*d,.45,h*.92,.31,plaster);
      b.box(m.trim,front+.39,roof*.57,z+zoff*d,.04,h*.81,.09,'#eae7ca');
    }
  }
  // Street-level glazing is split into real shop-width bays even when the upper facade is shared.
  for(let k=0;k<2;k++){
    eastFace(b,m.store,front+.028,base+.035,z+(k-.5)*d*.5,d*.489,Math.max(2.5,groundH)-.08,(id+k*3)%12,3);
  }
  // Overhanging, striped canvas shades over shop windows.
  const bays=id%4===1?0:id%4===2?2:3;
  for(let j=0;j<bays;j++) {
    const aw=d/bays-.22,az=z-d/2+(j+.5)*d/bays,ay=Math.min(3.02,groundH-.14);
    for(let stripe=0;stripe<7;stripe++) {
      const qz=az-aw/2+(stripe+.5)*aw/7, col=stripe%2===0?accent:'#f0dec0';
      b.instance('box',m.stone,[front+.65,ay,qz],[1.28,.10,aw/7+.012],col,[0,0,-.16]);
      b.box(m.stone,front+1.25,ay-.21,qz,.09,.24,aw/7+.015,col);
    }
  }
  const signW=Math.min(d*(id%2?.54:.74),11.4),signH=Math.min(id%2?1.63:2.0,h*.19);
  const sy=groundH+.43;
  b.box(m.stone,front+.70,sy+signH/2,z,.61,signH+.11,signW+.16,accent);
  eastFace(b,m.sign,front+1.016,sy,z,signW,signH,id,4);
  // Furnished porte-cochere on selected corner hotels.
  if(iconic || id%4===2) {
    const zz=z+d*.3;
    b.box(m.stone,front+1.85,2.64,zz,3.8,.30,d*.28,plaster);
    b.box(m.trim,front+3.77,2.65,zz,.08,.13,d*.28+.10,'#edb6a4');
    for(let ds of [-1,1]) b.rod(m.chrome,[front+3.2,.23,zz+ds*d*.115],[front+3.2,2.5,zz+ds*d*.115],.075,'#a9a497');
  }
  for(let k=0;k<2+Math.floor(rnd()*3);k++){
    const ax=x+(rnd()-.5)*w*.66,az=z+(rnd()-.5)*d*.65;
    b.box(m.stone,ax,roof+.72,az,1.6,.95,1.12,'#b7b7a9');
    for(let j=0;j<4;j++)b.box(m.chrome,ax+.811,roof+.44+j*.13,az,.025,.05,.96,'#66726e');
  }
}

function tower(b,m,rnd,x,z,w,d,h,id,solid,blocks) {
  const colors=['#c4c6c2','#d5c6b9','#bbccd1','#cccec4','#e0d2c2','#b6bec1'];
  const walls=colors[id%colors.length],glass=['#728e96','#78898d','#8ba7ad','#879c9c'][id%4];
  const podium=Math.min(5,h*.2),towerH=h-podium;
  b.box(m.stone,x,podium/2+.2,z,w+2,podium,d+2,walls);
  if(solid) blocks.push({x,z,w:w+2,d:d+2});
  b.box(m.glass,x,podium+towerH/2,z,w,towerH,d,glass);
  const sheets=Math.max(1,Math.round(towerH/18));
  for(let f=0;f<sheets;f++){
    const bY=podium+f*towerH/sheets,sh=towerH/sheets;
    eastFace(b,m.office,x+w/2+.012,bY,z,d,sh,id%8,2);
    northFace(b,m.office,x,bY,z-d/2-.012,w,sh,id%8,2,true);
    northFace(b,m.office,x,bY,z+d/2+.012,w,sh,id%8,2,false);
  }
  const floors=Math.max(3,Math.round(towerH/2.9));
  for(let j=0;j<=floors;j++) {
    const y=podium+towerH*j/floors;
    if(j%2===0 || id%3===0)b.box(m.stone,x,y,z,w+.55,.20,d+.55,walls);
    if(id%3===0 || j%3===0)b.box(m.chrome,x,y+.26,z,w+.39,.12,d+.39,'#a0a9a6');
  }
  const columns=Math.floor(d/3);
  for(let j=0;j<=columns;j++){
    const dz=z-d/2+d*j/columns;
    for(let side of [-1,1])b.box(m.stone,x+w*.5*side,podium+towerH*.5,dz,.26,towerH,.24,walls);
  }
  for(let j=0;j<=Math.floor(w/3);j++){
    const dx=x-w/2+w*j/Math.floor(w/3);
    for(let side of [-1,1])b.box(m.chrome,dx,podium+towerH*.5,z+d*.5*side,.14,towerH,.15,'#a5afb0');
  }
  b.box(m.stone,x,h+.96,z,w*.55,1.92,d*.60,walls);
  if(id%3===0){
    const crown=3.2+h*.12;
    b.box(m.glass,x,h+crown/2,z,w*.74,crown,d*.66,glass);
    for(let j=0;j<4;j++)b.box(m.stone,x,h+j*crown*.26,z,w*.77,.23,d*.70,walls);
    b.box(m.stone,x,h+crown+.66,z,w*.45,1.32,d*.43,walls);
  }else if(id%3===1){
    for(let side of [-1,1])b.box(m.stone,x+w*.39*side,h*.53,z,.42,h*1.06,d+.75,walls);
  }
  if(rnd()>.5)b.rod(m.chrome,[x,h+2.5,z],[x,h+5.9,z],.06,'#8d9999');
}

// Small fixtures provide scale, with geometry shared across the entire boulevard.
function streetLight(b,m,x,z,dir) {
  b.breakable('lamp',x,z,.44,.44,()=>{
    const base=.2;
    b.instance('disc',m.chrome,[x,base+.2,z],[.25,.4,.25],'#807e77');
    b.rod(m.chrome,[x,base,z],[x,6.1,z],.095,'#858b87');
    b.rod(m.chrome,[x,6.1,z],[x+dir*.52,6.62,z],.083,'#909792');
    b.rod(m.chrome,[x+dir*.52,6.62,z],[x+dir*2.1,6.7,z],.067,'#9c9d96');
    b.instance('oval',m.chrome,[x+dir*2.15,6.63,z],[.48,.13,.17],'#6c7978');
    b.box(m.bulb,x+dir*2.15,6.55,z,.68,.045,.23,'#ffe4a7');
  });
}

function bench(b,m,x,z,dir=1) {
  b.breakable('bench',x-.05*dir,z,.64,1.75,()=>{
    for(let j=0;j<4;j++) b.box(m.stone,x+(j-1.5)*.11,.65,z,.09,.07,1.65,'#a98462');
    for(let j=0;j<3;j++) b.box(m.stone,x-.26*dir,.83+j*.12,z,.065,.09,1.7,'#a98462');
    for(let j of [-.56,.56]){
      b.box(m.chrome,x,.42,z+j,.38,.38,.065,'#50625e');
      b.box(m.chrome,x-.26*dir,.79,z+j,.06,.68,.065,'#50625e');
    }
  });
}

function signal(b,m,x,z,dir) {
  b.breakable('signal',x,z,.25,.25,()=>{
    b.rod(m.chrome,[x,.20,z],[x,5.35,z],.10,'#8c9392');
    b.rod(m.chrome,[x,4.68,z],[x+dir*1.4,5.38,z],.075,'#889491');
    b.rod(m.chrome,[x,5.38,z],[x+dir*6,5.38,z],.075,'#889491');
    for(let n of [2.1,5.45]){
      const xx=x+dir*n;
      b.box(m.chrome,xx,4.92,z,.41,.93,.31,'#b79543');
      b.box(m.stone,xx,4.92,z+.162,.32,.85,.015,'#344241');
      for(let j=0;j<3;j++){
        b.instance('oval',j===2?m.bulb:m.glass,[xx,5.19-j*.27,z+.20],[.092,.092,.04],['#573f39','#5b5038','#73bc8b'][j]);
        b.box(m.chrome,xx,5.29-j*.27,z+.22,.23,.035,.17,'#424742');
      }
    }
  });
}

function makeMaterials() {
  const std=props=>new THREE.MeshStandardMaterial(props);
  const textured=(map,props={})=>std({map,vertexColors:true,roughness:.86,...props});
  const barkMap=new THREE.TextureLoader().load('/world/palm-bark.jpg');
  barkMap.wrapS=barkMap.wrapT=THREE.RepeatWrapping;
  barkMap.colorSpace=THREE.SRGBColorSpace;barkMap.anisotropy=8;
  const sandMap=canvasTexture(256,256,(g,w,h)=>{
    const rnd=randomGenerator(54);
    g.fillStyle='#e4cfac';g.fillRect(0,0,w,h);
    for(let j=0;j<29000;j++){g.fillStyle=rnd()<.45?'rgba(109,79,47,.11)':'rgba(255,246,231,.22)';g.fillRect(rnd()*w,rnd()*h,1+rnd()*2,1);}
  },true);
  const materials={
    stone:std({roughness:.82}),chrome:std({roughness:.4,metalness:.39}),trim:std({roughness:.44,metalness:.15}),
    glass:std({roughness:.22,metalness:.50}),bulb:new THREE.MeshBasicMaterial({toneMapped:false}),
    facade:textured(facadeAtlas(),{roughness:.66}), sign:textured(signAtlas(),{roughness:.54,emissive:0x302424,emissiveIntensity:.6}),
    leaf:textured(featherTexture(),{side:THREE.DoubleSide,alphaTest:.23,roughness:.9}),
    bark:textured(barkMap,{side:THREE.DoubleSide}),asphalt:textured(streetTexture(),{roughness:.66,metalness:.07}),
    pavement:textured(sidewalkTexture()),sand:textured(sandMap),
    flat:std({vertexColors:true,roughness:.82}),stripe:std({vertexColors:true,roughness:.86}),
    fabric:std({side:THREE.DoubleSide,vertexColors:true,roughness:.87})
  };
  for(const [name,file] of [['store','stores'],['office','office']]){
    const texture=new THREE.TextureLoader().load('/world/'+file+'.jpg');
    texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;
    materials[name]=textured(texture,{roughness:name==='office'?.39:.64,metalness:name==='office'?.21:.04});
  }
  materials.blade=textured(bladeAtlas(),{roughness:.49,emissive:0x392c2a,emissiveIntensity:.55});
  // The source scan is wet sand. Lift dry grains to limestone tones, keeping
  // photographic relief and a narrow, darker band at the tide line.
  materials.sand.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vBeach;')
      .replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvBeach=(modelMatrix*vec4(transformed,1.)).xyz;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vBeach;')
      .replace('#include <map_fragment>',`#include <map_fragment>
        float grain=dot(diffuseColor.rgb,vec3(.3,.58,.12));
        float shore=60.+1.35*sin(.09*vBeach.z);
        float wet=smoothstep(shore-8.,shore+1.,vBeach.x+sin(.37*vBeach.z)*.6);
        float ripple=sin(vBeach.x*14.+2.3*sin(vBeach.z*.56)+sin(vBeach.x*1.7-vBeach.z*.21));
        float detail=clamp((grain-.09)*3.8,-.28,.30);
        vec3 dry=vec3(.70,.545,.34)*(.90+detail+ripple*.034);
        diffuseColor.rgb=mix(dry,dry*vec3(.52,.58,.61),wet);
      `);
  };
  materials.bush=textured(shrubTexture(),{side:THREE.DoubleSide,alphaTest:.33,roughness:.91});
  materials.harbor=textured(harborSheet(),{roughness:.78,metalness:.11});
  materials.bush.userData.casts=true;
  materials.leaf.alphaToCoverage=true;
  materials.leaf.emissive.setHex(0x223316);materials.leaf.emissiveIntensity=.31;
  const breeze={value:0};
  materials.leaf.userData.breeze=breeze;
  materials.leaf.onBeforeCompile=shader=>{
    shader.uniforms.uBreeze=breeze;
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float uBreeze;')
      .replace('#include <begin_vertex>',`#include <begin_vertex>
        float bend=uv.x*uv.x;
        float gust=sin(position.z*.18+position.x*.09+uBreeze*1.43);
        transformed.x+=bend*(gust*.14+.052*sin(uBreeze*2.7+position.y));
        transformed.y+=bend*gust*.08;
      `);
  };
  materials.leaf.userData.casts=true;materials.bark.userData.casts=true;
  // Local image files enhance fine contact details; the seeded maps render immediately.
  const loader=new THREE.TextureLoader();
  for(const [name,url,kind] of [['asphalt','asphalt.jpg','map'],['asphalt','asphalt-normal.jpg','normalMap'],['sand','sand.jpg','map']]){
    loader.load('/surface/'+url,texture=>{
      texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
      texture.anisotropy=8;
      if(kind==='map')texture.colorSpace=THREE.SRGBColorSpace;
      if(kind==='normalMap')materials[name].normalScale.set(.45,.45);
      materials[name][kind]?.dispose();
      materials[name][kind]=texture;
      materials[name].needsUpdate=true;
    },undefined,()=>{});
  }
  return materials;
}

function streets(b,m,rnd) {
  // A continuous asphalt sheet leaves the intersections physically flush.
  ground(b,m.asphalt,AVENUES[0]-7.3,CROSS_STREETS[0]-7.3,18,BOUNDS.maxZ,0,4.2);
  for(const x of AVENUES){
    for(let z=CROSS_STREETS[0];z<BOUNDS.maxZ;z+=5.4){
      if(CROSS_STREETS.some(c=>Math.abs(c-z)<9.6))continue;
      ground(b,m.stripe,x-.19,z,x-.10,z+4.9,.018,1,'#c9a768');
      ground(b,m.stripe,x+.10,z,x+.19,z+4.9,.018,1,'#d8b56d');
      for(let k of [-1,1]){
        ground(b,m.stripe,x+6.65*k-.05,z,x+6.65*k+.05,z+4.9,.019,1,'#c4bfb1');
        if(z%2!==0)ground(b,m.stripe,x+3.55*k-.055,z,x+3.55*k+.055,z+1.75,.020,1,'#c8c4b7');
      }
    }
  }
  for(const z of CROSS_STREETS){
    for(let x=AVENUES[0];x<-7;x+=4.12) {
      if(AVENUES.some(a=>Math.abs(a-x)<9.3))continue;
      ground(b,m.stripe,x,z-.13,x+2.5,z+.13,.018,1,'#c6a767');
    }
    for(const x of AVENUES) {
      for(let face of [-1,1]){
        for(let j=-6;j<7;j++)ground(b,m.stripe,x+j*1.02-.26,z+face*8-.76,x+j*1.02+.26,z+face*8+.76,.025,1,'#d2ccba');
        const laneX=face>0?x+3.5:x-3.5;
        ground(b,m.stripe,laneX-3.18,z+face*10.1-.14,laneX+3.18,z+face*10.1+.14,.021,1,'#c4c0b4');
      }
    }
  }
  for(const avenue of AVENUES.slice(0,-1)) for(const cross of CROSS_STREETS.slice(0,-1)){
    const x=avenue+32,z=cross+32;
    b.walkableBox(m.stone,x,.07,z,49.4,.15,49.4,'#a39e92');
    ground(b,m.pavement,x-24.72,z-24.72,x+24.72,z+24.72,.154,2.4);
  }
  for(let i=0;i<CROSS_STREETS.length-1;i++){
    const z=(CROSS_STREETS[i]+CROSS_STREETS[i+1])*.5;
    for(const x of [-7.65,7.65]){
      b.walkableBox(m.stone,x,.083,z,.20,.164,48.5,'#c9bda7');
      if(x>0)ground(b,m.pavement,x-.07,z-24.2,17.1,z+24.2,.15,2.4);
    }
  }
  // Storm drains and manholes.
  for(let z=BOUNDS.minZ;z<=BOUNDS.maxZ;z+=14.5){
    if(CROSS_STREETS.some(c=>Math.abs(c-z)<9))continue;
    for(let x of [-6.7,6.7]){
      b.walkableBox(m.chrome,x,.026,z,.42,.026,.94,'#514f4b');
      for(let j=0;j<6;j++) b.walkableBox(m.chrome,x,.043,z-.32+j*.12,.32,.009,.035,'#272d2b');
    }
    if(rnd()>.54)b.walkableDisc(m.chrome,2.2,.015,z+1,.31,.027,'#53524c');
  }
}

function umbrella(b,m,x,z,shade,scale=1) {
  b.breakable('umbrella',x,z,.32,.32,()=>{
    const y=.18,high=2.24*scale,r=1.30*scale;
    b.rod(m.stone,[x,y,z],[x,y+high,z],.039,'#b59c71');
    for(let i=0;i<12;i++){
      const a=i/12*Math.PI*2,t=(i+1)/12*Math.PI*2;
      const p=(theta,rr,hh)=>[x+rr*Math.cos(theta),y+hh,z+rr*Math.sin(theta)];
      const tone=i%2===0?shade:'#f2dec3';
      b.quad(m.fabric,[p(a,.01,high),p(a,r*.61,high-.21),p(t,r*.61,high-.21),p(t,.01,high)],undefined,tone);
      b.quad(m.fabric,[p(a,r*.61,high-.21),p(a,r,high-.52),p(t,r,high-.52),p(t,r*.61,high-.21)],undefined,tone);
    }
  });
}

function boardwalk(b,m,rnd,blocks) {
  ground(b,m.sand,16,BOUNDS.minZ-160,96,BOUNDS.maxZ,.025,4.8);
  ground(b,m.pavement,7.1,BOUNDS.minZ-30,16.8,BOUNDS.maxZ,.12,2.4);
  for(let z=BOUNDS.minZ;z<BOUNDS.maxZ;z+=6) {
    if(Math.abs(z+160)<6)continue;
    const span=Math.abs(z+160)>10?Math.min(6,BOUNDS.maxZ-z):0;
    b.breakable('rail',17,z+span/2,.19,span+.19,()=>{
      b.rod(m.stone,[17,.10,z],[17,.95,z],.095,'#b4a38a');
      if(span)b.rod(m.chrome,[17,.72,z],[17,.72,z+span],.035,'#8b9994');
    });
  }
  for(let z=-236;z<BOUNDS.maxZ;z+=13) {
    if(Math.abs(z+160)<13)continue;
    const px=29+rnd()*20,pz=z+rnd()*4;
    umbrella(b,m,px,pz,['#db9079','#96b7b6','#d9b36d','#a9bbb0'][Math.floor(rnd()*4)]);
    for(let side of [-1,1]){
      b.breakable('chair',px+side*.83,pz+1.12,.59,1.72,()=>{
        b.instance('box',m.stone,[px+side*.83,.33,pz+1.35],[.57,.12,1.26],'#e7d3ae');
        b.instance('box',m.stone,[px+side*.83,.55,pz+.51],[.57,.13,.64],'#e6c39f',[-.57,0,0]);
      });
    }
  }
  for(let z=-210;z<155;z+=5+rnd()*8){
    if(Math.abs(z+160)<12)continue;
    const xx=20+rnd()*7;
    for(let j=0;j<9;j++){
      const x=xx+(rnd()-.5)*2.2,zz=z+(rnd()-.5)*2.8;
      const h=.35+rnd()*.65,lean=.08+rnd()*.28;
      b.quad(m.fabric,[[x-.025,.04,zz],[x+.025,.04,zz],[x+lean,h,zz+.18],[x+lean-.01,h,zz+.18]],undefined,['#c7b587','#b0a872','#b5ae82'][j%3]);
      b.quad(m.fabric,[[x+lean-.015,h-.08,zz+.18],[x+lean+.02,h-.12,zz+.18],[x+lean+.105,h+.125,zz+.23],[x+lean+.08,h+.15,zz+.23]],undefined,'#c8af77');
    }
  }
  // A painted lifeguard cabin sits high enough to read from the boulevard.
  for(let z of [-207,-76,55]){
    const x=30,deckY=2.16;
    for(let dx of [-1.4,1.4])for(let dz of [-1.1,1.1])b.rod(m.stone,[x+dx,.1,z+dz],[x+dx,deckY,z+dz],.106,'#a88c70');
    b.walkableBox(m.stone,x,deckY,z,4.25,.22,3.4,'#d9bf94');
    b.box(m.stone,x,deckY+1.0,z,2.85,1.8,2.3,'#a7cdc1');
    for(let j of [-1,0,1])b.box(m.glass,x-1.44,deckY+1.28,z+j*.69,.04,.60,.56,'#628e93');
    b.box(m.stone,x,deckY+2.04,z,3.71,.22,2.97,'#ce8876');
    for(let step=0;step<7;step++)b.walkableBox(m.stone,x-1.25-step*.28,deckY-step*.26,z,.40,.11,.82,'#c9aa85');
    b.rod(m.chrome,[x+1.36,deckY,z],[x+1.36,5.9,z],.032,'#a7a39b');
    b.quad(m.fabric,[[x+1.36,5.8,z],[x+1.36,5.8,z+.95],[x+1.36,5.47,z+.77],[x+1.36,5.38,z]],undefined,'#d9705e');
    blocks.push({x,z,w:4.2,d:3.3});
  }
  // Pier garage: the apron west of the hangar is clear across the target.
  ground(b,m.asphalt,6,-166.9,46,-153.1,.16,4.2);
  for(let x=18;x<46;x+=2.4)for(let side of [-1,1])b.walkableBox(m.stone,x,.28,-160+side*6.9,2.26,.45,.31,'#cfc5a6');
  const gx=50,gz=-160;
  b.box(m.stone,gx,2.13,gz,9.6,4.0,12.9,'#dcd1b7');
  blocks.push({x:gx,z:gz,w:9.6,d:12.9});
  b.box(m.stone,gx,4.38,gz,10.64,.57,14.0,'#7e9c95');
  for(let j of [-1,1]){
    const doorZ=gz+j*3.1;
    b.box(m.chrome,gx-4.83,1.8,doorZ,.08,3.1,5.27,'#889b96');
    for(let k=0;k<10;k++)b.box(m.chrome,gx-4.90,.40+k*.29,doorZ,.07,.035,5.26,'#a4b0a9');
  }
  b.quad(m.sign,[[gx-4.89,3.66,gz-3.7],[gx-4.89,3.66,gz+3.7],[gx-4.89,5.02,gz+3.7],[gx-4.89,5.02,gz-3.7]],atlasUV(12,4,4));
  northFace(b,m.sign,gx,2.60,gz+6.48,7.6,1.45,12,4,false);
  northFace(b,m.sign,gx,2.60,gz-6.48,7.6,1.45,12,4,true);
  for(let x=52;x<94;x+=3.18) {
    b.walkableBox(m.stone,x,.37,gz,3.12,.58,4.8,'#ad977b');
    for(const dz of [-2.28,2.28]){
      b.breakable('rail',x,gz+dz,3.23,.15,()=>{
        b.box(m.stone,x,.9,gz+dz,.13,1.65,.13,'#907e68');
        b.box(m.stone,x,1.51,gz+dz,3.23,.12,.12,'#c2ac8e');
      });
    }
  }
}

function ocean(scene) {
  const geo=new THREE.PlaneGeometry(2100,2200,1,1);
  geo.rotateX(-Math.PI*.5);
  const mat=new THREE.MeshStandardMaterial({color:'#729c9c',roughness:.32,metalness:.19});
  const time={value:0};
  mat.onBeforeCompile=shader=>{
    shader.uniforms.uSurfTime=time;
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWaterWorld;').replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvWaterWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float uSurfTime;varying vec3 vWaterWorld;')
      .replace('#include <color_fragment>',`#include <color_fragment>
        vec2 p=vWaterWorld.xz;
        float sh=60.0+1.35*sin(.09*p.y)+.66*sin(.24*p.y+.85*uSurfTime);
        if(p.x<sh || p.y>170.)discard;
        float d=p.x-sh;
        float swell=sin(.73*d+.13*sin(p.y*.67)+uSurfTime*1.12)+.55*sin(.44*d-.19*p.y+uSurfTime*.81);
        float cap=sin(d*1.31+.6*sin(.31*p.y)+.3*sin(.84*p.y)+uSurfTime*1.55);
        float chop=sin(3.7*d+.34*p.y+swell*1.75+uSurfTime*1.69);
        float glint=pow(max(0.0,chop),18.)*(.32+.68*smoothstep(-.45,.88,swell));
        float surf=(1.-smoothstep(.1,.95,d))+.76*pow(max(0.,cap),7.)*exp(-d*.115);
        float lacing=.5+.5*sin(5.3*p.y+2.*sin(p.x*1.9)+uSurfTime*.72);
        vec3 sea=mix(vec3(.16,.56,.49),vec3(.027,.205,.265),smoothstep(2.,115.,d));
        diffuseColor.rgb=mix(sea*(.93+.11*swell)+vec3(.24,.23,.17)*glint,vec3(.83,.88,.79),clamp(surf*(.68+.3*lacing),0.,1.));
      `);
  };
  const water=new THREE.Mesh(geo,mat);water.position.set(1090,.065,0);scene.add(water);
  return time;
}

function shrubTexture() {
  const rnd=randomGenerator(814);
  return canvasTexture(256,256,(g)=>{
    const shoot=(x,y,ang,len,depth)=>{
      const ex=x+Math.sin(ang)*len,ey=y-Math.cos(ang)*len;
      g.strokeStyle=depth>1?'#6c7650':'#a5a46b';g.lineWidth=depth+1;
      g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x+(ex-x)*.3,ey+len*.3,ex,ey);g.stroke();
      for(let k=1;k<=8;k++){
        const t=k/9,px=x+(ex-x)*t,py=y+(ey-y)*t,side=k%2?1:-1;
        g.save();g.translate(px,py);g.rotate(ang+side*(.7+rnd()*.5));g.beginPath();
        g.moveTo(0,0);g.quadraticCurveTo(-5,-10,0,-18-rnd()*6);g.quadraticCurveTo(6,-11,0,0);
        g.fillStyle=['#5b814c','#729749','#8caa62','#456e43','#96a75c'][Math.floor(rnd()*5)];g.fill();g.restore();
      }
      if(depth>0)for(const dir of [-1,1])shoot(ex,ey,ang+dir*(.26+rnd()*.53),len*(.61+rnd()*.1),depth-1);
    };
    for(let j=0;j<9;j++)shoot(126+(rnd()-.5)*29,254,(j-4)*.22,73+rnd()*20,2);
  });
}

function shrub(b,m,rnd,x,z,scale) {
  b.breakable('shrub',x,z,.65*scale,.65*scale,()=>{
    for(let j=0;j<3;j++){
      const a=j*Math.PI/3+rnd()*.18,dx=Math.cos(a)*scale*1.25,dz=Math.sin(a)*scale*1.25;
      const y=x>17?.028:.22,h=1.58*scale;
      b.quad(m.bush,[[x-dx,y,z-dz],[x+dx,y,z+dz],[x+dx,y+h,z+dz],[x-dx,y+h,z-dz]]);
    }
  });
}

function addStreetDetails(b,m,rnd,blocks) {
  for(let i=0;i<CROSS_STREETS.length-1;i++){
    const mid=(CROSS_STREETS[i]+CROSS_STREETS[i+1])*.5;
    for(const side of [-1,1]) {
      for(let j=0;j<3;j++){
        const zz=mid+(j-1)*16.8+(rnd()-.5)*2,x=side*(side<0?8.8:9.45);
        b.walkableDisc(m.stone,x,.167,zz,.66,.03,'#807c6c');
        for(let bar=0;bar<9;bar++){
          const off=(bar-4)*.12,length=2*Math.sqrt(.64*.64-off*off);
          b.walkableBox(m.chrome,x+off,.191,zz,.037,.026,length,'#64675e');
        }
        palm(b,m,rnd,x,zz,6.6+rnd()*2.6,rnd()*6.28);
        blocks.push({x,z:zz,w:.6,d:.6});
      }
      streetLight(b,m,side*7.9,mid+side*9,-side);
      for(const zz of [mid-20,mid+8]) {
        const xx=side>0?14.4:-9.66;
        bench(b,m,xx,zz,side);
        b.breakable('bin',xx,zz+1.45,.58,.58,()=>{
          b.instance('disc',m.chrome,[xx, .69,zz+1.45],[.27,.97,.27],'#5e746e');
          b.instance('disc',m.chrome,[xx,1.16,zz+1.45],[.29,.13,.29],'#536a65');
        });
      }
      if(side<0) {
        const xx=-11.4,zz=mid+1;
        b.walkableBox(m.stone,xx,.46,zz,1.35,.57,2.49,'#baa58d');
        shrub(b,m,rnd,xx,zz,.92);
      }
    }
    for(let k=0;k<3;k++){
      const z=mid+(k-1)*15+(rnd()-.5)*6,x=21+rnd()*4;
      palm(b,m,rnd,x,z,5.8+rnd()*3,rnd()*6.28);
      if(k===1){shrub(b,m,rnd,x-.88,z,1.08);shrub(b,m,rnd,x+1.24,z-.86,.68);}
    }
    for(const xx of [-64,-128])for(const dir of [-1,1]){
      if(dir===1 || i%2===0)palm(b,m,rnd,xx+dir*8.7,mid+dir*9,6+rnd()*2.2,rnd()*6.28);
      streetLight(b,m,xx+dir*7.85,mid-dir*11,-dir);
    }
  }
  for(let i=0;i<CROSS_STREETS.length;i++){
    const z=CROSS_STREETS[i];
    signal(b,m,-8.05,z-7.12,1);
    if(i>0 && i<CROSS_STREETS.length-1)signal(b,m,8.05,z+7.12,-1);
  }
}

function havanaBlock(b,m,rnd,blocks,x,z,plaza) {
  const paint=['#d48b76','#edca7a','#84b8ab','#dca8a0','#d7c9a7'];
  const wall=(cx,cz,w,d,h,shade)=>{
    b.box(m.stone,cx,.18+h/2,cz,w,h,d,shade);
    b.box(m.stone,cx,h+.33,cz,w+.45,.30,d+.45,'#f3e0b6');
    b.box(m.trim,cx,h+.52,cz,w+.28,.09,d+.28,'#a87158');
    blocks.push({x:cx,z:cz,w,d});
  };
  for(const dz of [-13,12]){
    const cx=x-13,cz=z+dz,h=4.9+rnd()*3.5,w=13,d=20;
    wall(cx,cz,w,d,h,paint[Math.floor(rnd()*paint.length)]);
    eastFace(b,m.store,cx+w/2+.02,.22,cz,d-.8,3,Math.floor(rnd()*12),3);
    northFace(b,m.facade,cx,.21,cz+d/2+.012,w-.3,h-.19,Math.floor(rnd()*12),3,false);
    northFace(b,m.facade,cx,.21,cz-d/2-.012,w-.3,h-.19,Math.floor(rnd()*12),3,true);
    const faceX=cx-w/2-.018;
    b.quad(m.facade,[[faceX,.22,cz-d/2],[faceX,.22,cz+d/2],[faceX,h+.16,cz+d/2],[faceX,h+.16,cz-d/2]],
      atlasUV(Math.abs(Math.round((cx+cz)/11))%12,4,3));
    b.box(m.trim,faceX-.41,2.8,cz-2,.88,.17,4.4,'#588b82');
    for(let n=-2;n<=2;n++){
      b.box(m.stone,cx+8.65,1.78,cz+n*4.35,.3,3.2,.32,'#f4dbb4');
      b.box(m.stone,cx+8.65,3.28,cz+n*4.35,.52,.38,.57,'#edd0a3');
      if(n!==2){
        const wz=cz+(n+.5)*4.35;
        b.box(m.glass,cx+6.53,h-1.31,wz,.11,1.43,1.56,'#49666a');
        for(const side of [-1,1])b.box(m.trim,cx+6.62,h-1.3,wz+side*.99,.09,1.55,.41,'#548881');
      }
    }
    b.box(m.stone,cx+7.6,3.58,cz,2.83,.25,d+.5,'#f0ce9c');
  }
  if(plaza) {
    const px=x+10;
    ground(b,m.flat,px-9,z-16,px+10,z+16,.17,1,'#c58f74');
    for(let i=-4;i<=4;i++)ground(b,m.flat,px-9,z+i*3.2-.1,px+10,z+i*3.2+.1,.18,1,'#f3d7a7');
    b.instance('disc',m.stone,[px,.47,z],[3.45,.61,3.45],'#e4c897');
    b.instance('disc',m.glass,[px,.79,z],[3.11,.06,3.11],'#5fc0b2');
    b.instance('disc',m.stone,[px,1.23,z],[.55,1.1,.55],'#d9b984');
    b.instance('disc',m.stone,[px,1.84,z],[1.61,.24,1.61],'#f2d3a0');
    for(let i=0;i<12;i++){
      const a=i*Math.PI/6,dx=Math.cos(a),dz=Math.sin(a);
      b.rod(m.glass,[px+.4*dx,1.93,z+.4*dz],[px+.96*dx,2.33,z+.96*dz],.046,'#a7e3db');
      b.rod(m.glass,[px+.96*dx,2.33,z+.96*dz],[px+1.87*dx,.86,z+1.87*dz],.036,'#b4dfd8');
    }
    blocks.push({x:px,z,w:6.4,d:6.4});
    for(const dz of [-11,11]){bench(b,m,px-5.4,z+dz,1);palm(b,m,rnd,px+6.4,z+dz,6.7+rnd(),rnd()*6);}
    for(const dz of [-16.4,16.4])b.rod(m.chrome,[px-8,.2,z+dz],[px-8,6.2,z+dz],.065,'#71756b');
    for(let j=0;j<14;j++) {
      const a=z-16.4+j*2.34, yy=6.02-.8*Math.sin(Math.PI*j/14);
      b.rod(m.chrome,[px-8,yy,a],[px-8,6.02-.8*Math.sin(Math.PI*(j+1)/14),a+2.34],.019,'#635b4d');
      b.quad(m.fabric,[[px-8,yy,a],[px-8,yy,a+1.55],[px-7.82,yy-1,a+.84],[px-7.82,yy-1,a+.82]],undefined,['#df725e','#f6cf74','#73aeb7','#f0b395'][j%4]);
    }
    b.box(m.stone,px-7.9,3.67,z, .26,1.5,8.8,'#b27e61');
    eastFace(b,m.sign,px-7.73,2.97,z,8.7,1.42,15,4);
  } else {
    const cx=x+13,h=6+rnd()*4.5;
    wall(cx,z,14,31,h,paint[Math.floor(rnd()*paint.length)]);
    eastFace(b,m.facade,cx+7.02,.23,z,30.8,h-.12,Math.floor(rnd()*12),3);
    northFace(b,m.store,cx,.22,z+15.53,13.75,3.2,Math.floor(rnd()*12),3,false);
    for(const side of [-1,1]){palm(b,m,rnd,x+4,z+side*17,6.4+rnd()*2,rnd()*6);shrub(b,m,rnd,x+15,z+side*19,.92);}
  }
  streetLight(b,m,x+23.2,z+14,-1);
}

function harborSheet(){
  const rnd=randomGenerator(719);
  return canvasTexture(1024,512,(g,w,h)=>{
    g.fillStyle='#a9bfbd';g.fillRect(0,0,w,h);
    for(let x=0;x<w;x+=16){
      g.fillStyle='rgba(38,61,61,.18)';g.fillRect(x,0,4,h);g.fillStyle='rgba(249,239,203,.32)';g.fillRect(x+4,0,3,h);
      for(let j=0;j<3;j++){const y=22+j*226;g.fillStyle='#677977';g.fillRect(x+5,y,2,3);}
    }
    const wash=g.createLinearGradient(0,0,0,h);wash.addColorStop(0,'rgba(242,224,194,.05)');wash.addColorStop(.6,'rgba(125,103,80,.04)');wash.addColorStop(1,'rgba(79,74,64,.5)');
    g.fillStyle=wash;g.fillRect(0,0,w,h);
    for(let i=0;i<3600;i++){
      const x=rnd()*w,y=rnd()*h;
      g.fillStyle=rnd()>.45?'rgba(93,73,53,.09)':'rgba(243,229,199,.15)';
      g.fillRect(x,y,.7+rnd()*1.7,2+rnd()*22);
    }
    g.fillStyle='#2f6267';g.fillRect(0,48,w,12);g.fillStyle='#ddad71';g.fillRect(0,61,w,4);
    g.globalAlpha=.85;g.font='bold 97px Arial';g.fillStyle='#355d61';g.fillText('MARINA KEYS',72,252,876);
    g.font='bold 29px Arial';g.fillText('B O A T W O R K S   /   P A L M   C O A S T',81,303,850);
  });
}

function portBlock(b,m,rnd,blocks,x,z,gantry) {
  const shopX=x-9,shopZ=z+1,w=23,d=34,h=7.8;
  b.box(m.stone,shopX,h/2+.18,shopZ,w,h,d,'#bdc5b6');
  b.box(m.trim,shopX,h+.41,shopZ,w+1.15,.48,d+1.2,'#588b8d');
  for(const side of [-1,1]){
    const zz=shopZ+side*(d*.5+.04),left=shopX-side*w*.5,right=shopX+side*w*.5;
    b.quad(m.harbor,[[left,.19,zz],[right,.19,zz],[right,h+.16,zz],[left,h+.16,zz]]);
  }
  blocks.push({x:shopX,z:shopZ,w,d});
  for(let k=-1;k<=1;k++){
    const doorZ=shopZ+k*10;
    b.box(m.chrome,shopX+w/2+.06,3,doorZ,.10,5.5,7.8,'#638a8c');
    for(let i=0;i<6;i++)b.box(m.trim,shopX+w/2+.13,.95+i*.82,doorZ,.08,.07,7.8,'#93afaa');
    for(let sign of [-1,1])b.rod(m.chrome,[shopX+w/2+.77,.19,doorZ+sign*4.35],[shopX+w/2+.77,1.15,doorZ+sign*4.35],.085,'#e0ab53');
  }
  for(let i=-4;i<=4;i++){
    b.box(m.stone,shopX+(w*.097*i),h+.12,shopZ, .16,.21,d,'#d4d6c9');
    b.box(m.chrome,shopX+(w*.097*i),h*.51,shopZ+d*.5+.025,.09,h*.97,.07,'#879e9b');
  }
  eastFace(b,m.sign,shopX+w/2+.16,6.15,shopZ,13.5,1.55,14,4);
  const colors=['#b96651','#487b82','#d8a64c','#6b9090','#8c9c7e'];
  for(let j=0;j<3;j++){
    const cx=x+12.8,cz=z+(j-1)*11.2,stack=gantry&&j===1?2:1+Math.floor(rnd()*2);
    blocks.push({x:cx,z:cz,w:4.3,d:9.8});
    for(let level=0;level<stack;level++){
      const base=.23+level*3.32,shade=colors[Math.floor(rnd()*colors.length)];
      b.box(m.stone,cx,base+1.64,cz,4.3,3.26,9.8,shade);
      for(let rib=0;rib<9;rib++)b.box(m.trim,cx+2.17,base+1.64,cz-4.31+rib*1.08,.072,3.07,.13,shade);
      for(let side of [-1,1])b.rod(m.chrome,[cx+side*1.17,base+.17,cz+4.94],[cx+side*1.17,base+3.05,cz+4.94],.05,'#c8bca4');
    }
  }
  if(gantry){
    for(const side of [-1,1]){
      b.rod(m.stone,[x+8,.20,z+side*14],[x+13,14.7,z+side*11],.37,'#e6a75d');
      b.rod(m.stone,[x+21,.20,z+side*14],[x+16.7,14.7,z+side*11],.37,'#e6a75d');
      b.rod(m.chrome,[x+8,2.2,z+side*14],[x+16.7,13.8,z+side*11],.12,'#a86f4e');
    }
    for(const cx of [x+13,x+16.6])b.box(m.stone,cx,14.6,z,.65,.92,29,'#d18c4a');
    b.box(m.chrome,x+14.8,14.7,z,5.4,1.35,3,'#526c70');
    b.rod(m.chrome,[x+14.8,14.1,z],[x+14.8,8.1,z],.075,'#555d58');
    b.box(m.stone,x+14.8,8.15,z,3.15,.37,1.12,'#ddad56');
  }
  streetLight(b,m,x+23.2,z-16,-1);
}

function marinaSlips(b,m,rnd) {
  // Finger piers and moored boats sit past the swash line.
  for(let z=-400;z<-228;z+=32){
    b.walkableBox(m.stone,60,.45,z,26,.60,2.1,'#a78564');
    b.walkableBox(m.stone,72.4,.45,z+6.4,1.45,.60,14.5,'#c29b74');
    for(let k=0;k<11;k++)b.walkableBox(m.stone,47.7+k*2.38,.77,z,.065,.035,2.02,'#795f4b');
    for(let xx of [48,60,72])b.rod(m.stone,[xx,-.2,z+1.1],[xx,1.39,z+1.1],.14,'#826c58');
    const bx=67,bz=z+8;
    b.instance('oval',m.stone,[bx,.46,bz],[2.23,.77,5.37],'#eaeadf');
    b.instance('oval',m.trim,[bx,.77,bz],[2.16,.24,5.00],'#598193');
    b.box(m.stone,bx,1.36,bz+.6,2.7,1.12,4.15,'#f5e6c8');
    b.box(m.glass,bx,1.69,bz+.6,2.74,.45,3.72,'#56797c');
    b.box(m.stone,bx,1.99,bz+.6,2.9,.17,3.9,'#ece5d5');
    b.rod(m.chrome,[bx,.85,bz-1.7],[bx,8.2+rnd(),bz-1.7],.054,'#ede8dc');
    b.rod(m.chrome,[bx,7.8,bz-1.7],[bx,.85,bz+4.3],.022,'#b0b4aa');
  }
}

function coastalWheel(scene,b,m,blocks) {
  const x=44,z=-60,r=12.8,hub=14.65;
  for(const side of [-1,1])for(const dir of [-1,1]){
    b.rod(m.stone,[x+side*4.45,.19,z+dir*7],[x+side*1.9,hub,z],.27,'#aad4cb');
    b.rod(m.chrome,[x+side*4.45,.19,z+dir*7],[x+side*3.4,6.2,z-dir*4.05],.13,'#e7b48c');
  }
  b.walkableBox(m.stone,x,.34,z,10,.57,16,'#c29678');
  blocks.push({x,z,w:10,d:16});
  b.rod(m.chrome,[x-2.8,hub,z],[x+2.8,hub,z],.27,'#c4c8b6');
  const wheel=new THREE.Group();scene.add(wheel);wheel.position.set(x,hub,z);
  const rig=new StaticWorld(wheel),n=36,point=(a,r,side)=>[side,Math.cos(a)*r,Math.sin(a)*r];
  for(let i=0;i<n;i++){
    const a=2*Math.PI*i/n,aa=2*Math.PI*(i+1)/n;
    for(const side of [-1.28,1.28]){
      rig.rod(m.stone,point(a,r,side),point(aa,r,side),.108,'#f3e8d3');
      rig.rod(m.trim,point(a,r-.82,side),point(aa,r-.82,side),.084,'#8cc0b9');
      rig.rod(m.chrome,point(a,r-.82,side),point(aa,r,side),.047,'#d3a885');
      if(i%2===0)rig.rod(m.chrome,point(a,.88,side*.78),point(a,r-.82,side),.052,'#a9bfc1');
    }
    rig.rod(m.trim,point(a,r,-1.28),point(a,r,1.28),.061,'#c59c7d');
  }
  rig.rod(m.stone,[-1.55,0,0],[1.55,0,0],.88,'#e4ac77');
  rig.finish();
  const nCars=12,geo=new THREE.BoxGeometry(1,1,1);
  const shell=new THREE.InstancedMesh(geo,m.stone,nCars), canopy=new THREE.InstancedMesh(geo,m.trim,nCars);
  const pane=new THREE.InstancedMesh(geo,m.glass,nCars),dummy=new THREE.Object3D();
  const layers=[[shell,-1.12,[2.22,.75,1.39]],[pane,-.49,[2.03,.55,1.27]],[canopy,-.18,[2.32,.13,1.51]]];
  for(const [mesh] of layers){mesh.frustumCulled=false;mesh.castShadow=true;scene.add(mesh);}
  for(let i=0;i<nCars;i++){
    shell.setColorAt(i,new THREE.Color(['#e3886f','#7baaa7','#e5bb75','#a99cb2'][i%4]));
    canopy.setColorAt(i,new THREE.Color('#f6d6a1'));pane.setColorAt(i,new THREE.Color('#547f84'));
  }
  return time=>{
    const spin=time*.064;wheel.rotation.x=spin;
    for(let j=0;j<nCars;j++){
      const a=2*Math.PI*j/nCars+spin;
      for(const [mesh,dy,size] of layers){
        dummy.position.set(x,hub+r*Math.cos(a)+dy,z+r*Math.sin(a));
        dummy.scale.set(...size);dummy.updateMatrix();mesh.setMatrixAt(j,dummy.matrix);
      }
    }
    for(const [mesh] of layers)mesh.instanceMatrix.needsUpdate=true;
  };
}

export function createWorld(scene) {
  const blocks=[],floor=new GroundField(),b=new StaticWorld(scene,floor,blocks),m=makeMaterials(),rnd=randomGenerator(54634);
  streets(b,m,rnd);
  boardwalk(b,m,rnd,blocks);
  marinaSlips(b,m,rnd);
  const spinWheel=coastalWheel(scene,b,m,blocks);
  spinWheel(0);
  for(let i=0;i<5;i++){
    const center=ORIGINAL_ROWS[i];
    // Ocean Drive's compact historic district, with residential towers behind it.
    for(let j=0;j<3;j++){
      const id=(i*3+j+8)%HOTELS.length,zz=center+(j-1)*16.03;
      const width=14.1+rnd()*2.15,front=-14.2+(rnd()-.5)*1.1;
      const h=[15.6,8.25,17.3,10.0,13.7,9.2][(i+j)%6];
      decoHotel(b,m,rnd,blocks,front-width/2,zz,width,15.12+rnd()*.36,h,id,i===4&&j===1);
    }
    for(let j=0;j<2;j++){
      tower(b,m,rnd,-44+(.5-rnd())*2,center+(j===0?-12:12),12+rnd()*3,14+rnd()*5,
        16+rnd()*24,(i*2+j)%8,true,blocks);
    }
    for(const x of [-78,-109]){
      for(let j of [-1,1]){
        tower(b,m,rnd,x,center+j*12,14+rnd()*1.7,14+rnd()*4.4,12+rnd()*39,(i*4+j+10)%11,true,blocks);
      }
    }
  }
  const edge=new StaticWorld(scene,floor,blocks);
  for(let i=0;i<19;i++){
    const zz=-527-rnd()*160,xx=-245+rnd()*260;
    tower(edge,m,rnd,xx,zz,7+rnd()*11,9+rnd()*14,17+rnd()*58,i,false,blocks);
  }
  for(let i=0;i<10;i++)
    tower(edge,m,rnd,-387-rnd()*100,-450+rnd()*595,13+rnd()*10,15+rnd()*12,21+rnd()*76,i,false,blocks);
  const updateCanal=buildCityEdge(edge,m,blocks,{ground,palm,shrub,streetLight,bench,eastFace,canvasTexture,randomGenerator});
  edge.finish();
  addStreetDetails(b,m,rnd,blocks);
  sidewalkLife(b,m,rnd);
  for(const startZ of CROSS_STREETS.slice(0,-1)){
    const newBlocks=new StaticWorld(scene,floor,blocks);
    for(const west of AVENUES.slice(0,-1)){
      const x=west+32,z=startZ+32;
      if(ORIGINAL_ROWS.includes(z)&&x>-128)continue;
      if(z<-224)portBlock(newBlocks,m,rnd,blocks,x,z,Math.abs(west/64+Math.round(startZ/64))%2===1);
      else havanaBlock(newBlocks,m,rnd,blocks,x,z,Math.abs(Math.round(z/64)+west/64)%2===0);
    }
    newBlocks.finish();
  }
  for(let j=0;j<5;j++){
    const x=92+rnd()*76,z=-245+j*75+rnd()*30;
    b.instance('oval',m.stone,[x,.41,z],[1.0,.50,3.35],'#ddd5bf',[0,j*.8,0]);
    b.rod(m.chrome,[x,.85,z],[x,8.15,z],.031,'#c7c8b6');
    b.quad(m.fabric,[[x,.95,z],[x,.95,z+2.9],[x,7.94,z+.18],[x,7.94,z+.12]],undefined,j%2?'#e0bf98':'#dfddd2');
  }
  b.finish();
  const waterTime=ocean(scene);
  const regional=new StaticWorld(scene,floor,blocks);
  const updateRegion=buildRegion(scene,regional,m,blocks,{palm,shrub,randomGenerator,canvasTexture});
  addRegionalProps(regional,m,blocks,REGIONAL_LOTS);
  regional.finish();
  return {blocks,groundHeight:(x,z)=>Math.max(floor.height(x,z),z>=160?regionGroundHeight(x,z):0,onCanalBridge(x,z)?canalDeck(x):0),update(dt,time){
    waterTime.value=Number.isFinite(time)?time:waterTime.value+dt;
    updateCanal(waterTime.value);
    m.leaf.userData.breeze.value=waterTime.value;
    spinWheel(waterTime.value);
    updateRegion(waterTime.value);
  }};
}

function bladeAtlas() {
  return canvasTexture(768,768,(g)=>{
    const signs=['HOTEL','LIDO','PALMS','MARLIN'];
    signs.forEach((label,i)=>{
      const w=192,x=i*w,color=['#de8571','#dca64f','#77bab6','#bc927d'][i];
      g.save();g.translate(x,0);
      const side=g.createLinearGradient(0,0,w,0);side.addColorStop(0,'#514949');side.addColorStop(.12,color);
      side.addColorStop(.17,'#3c4548');side.addColorStop(.83,'#42494a');side.addColorStop(.89,color);side.addColorStop(1,'#5f5256');
      g.fillStyle=side;g.fillRect(0,0,w,768);g.strokeStyle='#e6bd88';g.lineWidth=2;g.strokeRect(22,14,w-44,740);
      g.shadowBlur=8;g.shadowColor=color;g.strokeStyle=color;g.lineWidth=3;
      g.beginPath();g.arc(96,90,31,0,Math.PI*2);g.stroke();
      for(let ray=0;ray<12;ray++){const a=ray*Math.PI/6;g.beginPath();g.moveTo(96+Math.cos(a)*38,90+Math.sin(a)*38);g.lineTo(96+Math.cos(a)*45,90+Math.sin(a)*45);g.stroke();}
      g.textAlign='center';g.textBaseline='middle';g.font='800 88px Arial';g.strokeStyle='#fed8aa';g.fillStyle=color;
      label.split('').forEach((c,j)=>{const y=172+(j+.5)*(530/label.length);g.fillText(c,96,y);g.strokeText(c,96,y);});
      g.restore();
    });
  });
}

function bladeSign(b,m,x,z,y,id) {
  const w=1.38,h=4.8;
  b.box(m.chrome,x+w*.5,y+h*.5,z,w,h,.24,'#7f7364');
  const uv=atlasUV(id,4,1);
  b.quad(m.blade,[[x,y,z+.132],[x+w,y,z+.132],[x+w,y+h,z+.132],[x,y+h,z+.132]],uv);
  b.quad(m.blade,[[x+w,y,z-.132],[x,y,z-.132],[x,y+h,z-.132],[x+w,y+h,z-.132]],uv);
  for(let offset of [.2,h-.25])b.box(m.chrome,x-.44,y+offset,z,.96,.09,.095,'#66716c');
}

function planting(b,m,rnd,x,z,size) {
  // Long lobed leaves are folded on their midribs with lit and shaded halves.
  for(let j=0;j<13;j++){
    const a=j*2.4+rnd()*.34, dx=Math.cos(a), dz=Math.sin(a);
    const length=size*(.50+rnd()*.68), height=size*(.48+rnd()*.80), width=size*(.065+rnd()*.07);
    const p=(t,side)=>{
      const bell=Math.sin(t*Math.PI);
      return [x+dx*length*t+dz*bell*width*side,.28+height*t+.35*bell*size-Math.abs(side)*bell*.11,
        z+dz*length*t-dx*bell*width*side];
    };
    const main=['#547c59','#6c9059','#92a15b','#7e9d70'][j%4];
    const edge=['#476c4f','#5e7c49','#798951','#648462'][j%4];
    for(let k=0;k<4;k++){
      const t=k*.25,q=t+.25;
      b.quad(m.fabric,[p(t,0),p(q,0),p(q,1),p(t,1)],undefined,main);
      b.quad(m.fabric,[p(t,-1),p(q,-1),p(q,0),p(t,0)],undefined,edge);
    }
  }
}

function sidewalkLife(b,m,rnd) {
  for(let i=0;i<5;i++){
    const center=ORIGINAL_ROWS[i];
    for(let group=0;group<3;group++){
      const z=center+(group-1)*15+.9;
      // Plant islands on promenade are continuously staggered with maintained walking gaps.
      const px=13.35+(group%2)*1.85;
      b.walkableBox(m.stone,px,.225,z,2.3,.25,5.2,'#b2ac97');
      ground(b,m.flat,px-1.09,z-2.50,px+1.09,z+2.50,.358,1,'#716b4e');
      for(const [n,dd] of [-1.82,-.68,.56,1.78].entries()){
        const sx=px+(rnd()-.5)*.84,scale=.73+rnd()*.45;
        if((group+n+i)%3===0)planting(b,m,rnd,sx,z+dd,scale);
        else shrub(b,m,rnd,sx,z+dd,scale*.76);
      }
      const tx=-11.65, tz=z+2.2;
      if((i+group)%3!==2) {
        umbrella(b,m,tx,tz,['#bb7769','#649693','#d0a877'][(i+group)%3],.85);
        b.breakable('table',tx,tz,1.06,1.06,()=>{
          b.instance('disc',m.stone,[tx,1.00,tz],[.53,.075,.53],'#d8bc93');
          b.rod(m.chrome,[tx,.17,tz],[tx,.99,tz],.07,'#697971');
        });
        for(let j=0;j<3;j++){
          const a=j*2.094+.48,xx=tx+Math.sin(a)*.79,zz=tz+Math.cos(a)*.79;
          b.breakable('chair',xx,zz,.52,.52,()=>{
            b.instance('disc',m.stone,[xx,.59,zz],[.24,.09,.24],'#887357');
            for(let k of [-1,1]) b.rod(m.chrome,[xx-.11,.17,zz+k*.15],[xx+.09,.61,zz+k*.15],.023,'#697971');
            b.box(m.stone,xx+.23*Math.sin(a),.82,zz+.23*Math.cos(a),.34,.30,.06,'#a78b67',a);
          });
        }
      }else{
        const post=tx+1.68;
        b.breakable('meter',post,tz,.62,.52,()=>{
          b.box(m.stone,post,.74,tz,.53,1.05,.43,'#657d77');
          b.box(m.chrome,post+.02,1.24,tz,.62,.13,.52,'#4e6d70');
          b.box(m.glass,post+.276,.94,tz,.02,.26,.29,'#849a9c');
        });
      }
    }
    for(let k=0;k<5;k++){
      const zz=center+(k-2)*10,xx=19.0+(rnd()-.5)*1.5;
      if((i+k)%3===1)planting(b,m,rnd,xx,zz,1.06);
      else shrub(b,m,rnd,xx,zz,1.05+rnd()*.35);
      shrub(b,m,rnd,xx+1.1,zz+1,.69);
    }
    for(let j=0;j<3;j++){
      const z=center+(j-1)*16.0;
      if((i+j)%2===0)bladeSign(b,m,-13.0,z+5.6,3.35,(i+j)%4);
    }
  }
}
