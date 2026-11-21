import * as THREE from 'three';

const CROSS_STREETS = [-224, -160, -96, -32, 32, 96];
const AVENUES = [-128, -64, 0];
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
  const names=[...HOTELS.map(h=>[h[0],h[1]]),['PIER 9','MARINE & AUTO'],['PALM COAST','ATLANTIC BOULEVARD']];
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

class StaticWorld {
  constructor(scene) {
    this.scene=scene;this.geometry=new Map();this.batches=new Map();this.surfaces=new Map();
    this.dummy=new THREE.Object3D();this.col=new THREE.Color();
  }
  instance(type, mat, xyz, size, color, rot=[0,0,0], quaternion=null) {
    const key=type+mat.uuid;
    if(!this.batches.has(key))this.batches.set(key,{type,mat,list:[]});
    this.dummy.position.set(...xyz);this.dummy.scale.set(...size);
    if(quaternion)this.dummy.quaternion.copy(quaternion);else this.dummy.rotation.set(...rot);
    this.dummy.updateMatrix();this.batches.get(key).list.push([this.dummy.matrix.clone(),color]);
  }
  box(mat,x,y,z,w,h,d,color,rot=0) {this.instance('box',mat,[x,y,z],[w,h,d],color,[0,rot,0]);}
  rod(mat,a,b,r,color,type='rod') {
    const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),dir=end.clone().sub(start);
    if(dir.lengthSq()<.000001)return;
    const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),dir.clone().normalize());
    const pos=start.add(end).multiplyScalar(.5);
    this.instance(type,mat,pos.toArray(),[r,dir.length(),r],color,undefined,q);
  }
  quad(mat,points,uv=[[0,0],[1,0],[1,1],[0,1]],color='#ffffff') {
    if(!this.surfaces.has(mat))this.surfaces.set(mat,{pos:[],uv:[],indices:[],colors:[]});
    const s=this.surfaces.get(mat),base=s.pos.length/3;this.col.set(color);
    for(let i=0;i<4;i++){s.pos.push(...points[i]);s.uv.push(...uv[i]);s.colors.push(this.col.r,this.col.g,this.col.b);}
    s.indices.push(base,base+1,base+2,base,base+2,base+3);
  }
  finish() {
    const geos={box:new THREE.BoxGeometry(1,1,1),rod:new THREE.CylinderGeometry(1,1,1,7),
      disc:new THREE.CylinderGeometry(1,1,1,20), cone:new THREE.ConeGeometry(1,1,12),
      oval:new THREE.SphereGeometry(1,10,7)};
    for(const {type,mat,list} of this.batches.values()){
      const mesh=new THREE.InstancedMesh(geos[type],mat,list.length);
      list.forEach(([matrix,col],i)=>{mesh.setMatrixAt(i,matrix);mesh.setColorAt(i,this.col.set(col));});
      mesh.computeBoundingSphere();mesh.receiveShadow=true;mesh.castShadow=true;this.scene.add(mesh);
    }
    for(const [mat,s] of this.surfaces){
      const geo=new THREE.BufferGeometry();
      geo.setAttribute('position',new THREE.Float32BufferAttribute(s.pos,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(s.uv,2));
      geo.setAttribute('color',new THREE.Float32BufferAttribute(s.colors,3));geo.setIndex(s.indices);geo.computeVertexNormals();
      const mesh=new THREE.Mesh(geo,mat);mesh.receiveShadow=true;mesh.castShadow=mat.userData.casts===true;this.scene.add(mesh);
    }
  }
}

// World XZ quad. The winding keeps its normal upward.
function ground(b,mat,x0,z0,x1,z1,y,tile=1,color='#ffffff') {
  b.quad(mat,[[x0,y,z1],[x1,y,z1],[x1,y,z0],[x0,y,z0]],
    [[x0/tile,-z1/tile],[x1/tile,-z1/tile],[x1/tile,-z0/tile],[x0/tile,-z0/tile]],color);
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
        const light=32+Math.floor(rnd()*52);
        g.fillStyle='rgb('+light+','+Math.floor(light*1.2+20)+','+Math.floor(light*.55+5)+')';
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
  const bend=t=>[bx+Math.cos(heading)*lean*t*t+Math.sin(heading)*.35*Math.sin(t*Math.PI),
    .2+height*t,bz+Math.sin(heading)*lean*t*t];
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
    const tint=lower?['#d9ce99','#d1d5a9','#b9bd8c','#dae0ae'][j%4]:'#e1e1ad';
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
  const base=.2;
  b.instance('disc',m.chrome,[x,base+.2,z],[.25,.4,.25],'#807e77');
  b.rod(m.chrome,[x,base,z],[x,6.1,z],.095,'#858b87');
  b.rod(m.chrome,[x,6.1,z],[x+dir*.52,6.62,z],.083,'#909792');
  b.rod(m.chrome,[x+dir*.52,6.62,z],[x+dir*2.1,6.7,z],.067,'#9c9d96');
  b.instance('oval',m.chrome,[x+dir*2.15,6.63,z],[.48,.13,.17],'#6c7978');
  b.box(m.bulb,x+dir*2.15,6.55,z,.68,.045,.23,'#ffe4a7');
}

function bench(b,m,x,z,dir=1) {
  for(let j=0;j<4;j++) b.box(m.stone,x+(j-1.5)*.11,.65,z,.09,.07,1.65,'#a98462');
  for(let j=0;j<3;j++) b.box(m.stone,x-.26*dir,.83+j*.12,z,.065,.09,1.7,'#a98462');
  for(let j of [-.56,.56]){
    b.box(m.chrome,x,.42,z+j,.38,.38,.065,'#50625e');
    b.box(m.chrome,x-.26*dir,.79,z+j,.06,.68,.065,'#50625e');
  }
}

function signal(b,m,x,z,dir) {
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
  ground(b,m.asphalt,-206,-266,18,144,0,4.2);
  for(const x of [-192,...AVENUES]){
    for(let z=-260;z<140;z+=5.4){
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
    for(let x=-194;x<-7;x+=4.12) {
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
  for(let x of [-160,-96,-32]) for(let z of [-192,-128,-64,0,64]){
    b.box(m.stone,x,.07,z,49.4,.15,49.4,'#a39e92');
    ground(b,m.pavement,x-24.72,z-24.72,x+24.72,z+24.72,.154,2.4);
  }
  for(let i=0;i<5;i++){
    const z=(CROSS_STREETS[i]+CROSS_STREETS[i+1])*.5;
    for(const x of [-7.65,7.65]){
      b.box(m.stone,x,.083,z,.20,.164,48.5,'#c9bda7');
      if(x>0)ground(b,m.pavement,x-.07,z-24.2,17.1,z+24.2,.15,2.4);
    }
  }
  // Storm drains and manholes.
  for(let z=-245;z<=116;z+=14.5){
    if(CROSS_STREETS.some(c=>Math.abs(c-z)<9))continue;
    for(let x of [-6.7,6.7]){
      b.box(m.chrome,x,.026,z,.42,.026,.94,'#514f4b');
      for(let j=0;j<6;j++) b.box(m.chrome,x,.043,z-.32+j*.12,.32,.009,.035,'#272d2b');
    }
    if(rnd()>.54)b.instance('disc',m.chrome,[2.2,.015,z+1],[.31,.027,.31],'#53524c');
  }
}

function umbrella(b,m,x,z,shade,scale=1) {
  const y=.18,high=2.24*scale,r=1.30*scale;
  b.rod(m.stone,[x,y,z],[x,y+high,z],.039,'#b59c71');
  for(let i=0;i<12;i++){
    const a=i/12*Math.PI*2,t=(i+1)/12*Math.PI*2;
    const p=(theta,rr,hh)=>[x+rr*Math.cos(theta),y+hh,z+rr*Math.sin(theta)];
    const tone=i%2===0?shade:'#f2dec3';
    b.quad(m.fabric,[p(a,.01,high),p(a,r*.61,high-.21),p(t,r*.61,high-.21),p(t,.01,high)],undefined,tone);
    b.quad(m.fabric,[p(a,r*.61,high-.21),p(a,r,high-.52),p(t,r,high-.52),p(t,r*.61,high-.21)],undefined,tone);
  }
}

function boardwalk(b,m,rnd,blocks) {
  ground(b,m.sand,16,-400,96,240,.025,4.8);
  ground(b,m.pavement,7.1,-266,16.8,144,.12,2.4);
  for(let z=-256;z<138;z+=6) {
    if(Math.abs(z+160)<6)continue;
    b.rod(m.stone,[17.0,.10,z],[17.0,.95,z],.095,'#b4a38a');
    if(Math.abs(z+160)>10)b.rod(m.chrome,[17.0,.72,z],[17.0,.72,z+6],.035,'#8b9994');
  }
  for(let z=-240;z<120;z+=13) {
    if(Math.abs(z+160)<13)continue;
    const px=29+rnd()*20,pz=z+rnd()*4;
    umbrella(b,m,px,pz,['#db9079','#96b7b6','#d9b36d','#a9bbb0'][Math.floor(rnd()*4)]);
    for(let side of [-1,1]){
      b.instance('box',m.stone,[px+side*.83,.33,pz+1.35],[.57,.12,1.26],'#e7d3ae');
      b.instance('box',m.stone,[px+side*.83,.55,pz+.51],[.57,.13,.64],'#e6c39f',[-.57,0,0]);
    }
  }
  // A painted lifeguard cabin sits high enough to read from the boulevard.
  for(let z of [-207,-76,55]){
    const x=30,deckY=2.16;
    for(let dx of [-1.4,1.4])for(let dz of [-1.1,1.1])b.rod(m.stone,[x+dx,.1,z+dz],[x+dx,deckY,z+dz],.106,'#a88c70');
    b.box(m.stone,x,deckY,z,4.25,.22,3.4,'#d9bf94');
    b.box(m.stone,x,deckY+1.0,z,2.85,1.8,2.3,'#a7cdc1');
    for(let j of [-1,0,1])b.box(m.glass,x-1.44,deckY+1.28,z+j*.69,.04,.60,.56,'#628e93');
    b.box(m.stone,x,deckY+2.04,z,3.71,.22,2.97,'#ce8876');
    for(let step=0;step<7;step++)b.box(m.stone,x-1.25-step*.28,deckY-step*.26,z,.40,.11,.82,'#c9aa85');
    b.rod(m.chrome,[x+1.36,deckY,z],[x+1.36,5.9,z],.032,'#a7a39b');
    b.quad(m.fabric,[[x+1.36,5.8,z],[x+1.36,5.8,z+.95],[x+1.36,5.47,z+.77],[x+1.36,5.38,z]],undefined,'#d9705e');
    blocks.push({x,z,w:4.2,d:3.3});
  }
  // Pier garage: the apron west of the hangar is clear across the target.
  ground(b,m.asphalt,6,-166.9,46,-153.1,.16,4.2);
  for(let x=18;x<46;x+=2.4)for(let side of [-1,1])b.box(m.stone,x,.28,-160+side*6.9,2.26,.45,.31,'#cfc5a6');
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
  for(let x=52;x<94;x+=3.18) {
    b.box(m.stone,x,.37,gz,3.12,.58,4.8,'#ad977b');
    for(const dz of [-2.28,2.28]){
      b.box(m.stone,x,.9,gz+dz,.13,1.65,.13,'#907e68');
      b.box(m.stone,x,1.51,gz+dz,3.23,.12,.12,'#c2ac8e');
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
        if(p.x<sh)discard;
        float swell=sin(.62*p.x+.13*p.y-uSurfTime*1.06)+.48*sin(.37*p.x-.34*p.y-uSurfTime*.83);
        float glint=pow(max(0.0,sin(2.88*p.x+.28*p.y+swell*1.48-uSurfTime*1.69)),15.0);
        float edge=max(0.0,1.0-(p.x-sh)/3.8)*(0.42+0.58*smoothstep(-.3,.5,swell));
        diffuseColor.rgb=mix(vec3(.24,.49,.45),vec3(.095,.28,.32),smoothstep(61.0,145.0,p.x));
        diffuseColor.rgb+=.042*swell+glint*vec3(.24,.20,.14)*(.55+.45*sin(.13*p.y)) + edge*vec3(.57,.52,.43);
      `);
  };
  const water=new THREE.Mesh(geo,mat);water.position.set(1090,.065,0);scene.add(water);
  return time;
}

function shrub(b,m,rnd,x,z,scale) {
  for(let k=0;k<8;k++){
    const ox=(rnd()-.5)*1.8*scale,oz=(rnd()-.5)*1.1*scale;
    b.instance('oval',m.stone,[x+ox,.40+scale*.26,z+oz],[scale*(.35+rnd()*.31),scale*(.3+rnd()*.34),scale*(.30+rnd()*.3)],
      ['#79865c','#828b63','#839672','#9da274','#829366'][k%5]);
  }
}

function addStreetDetails(b,m,rnd,blocks) {
  for(let i=0;i<CROSS_STREETS.length-1;i++){
    const mid=(CROSS_STREETS[i]+CROSS_STREETS[i+1])*.5;
    for(const side of [-1,1]) {
      for(let j=0;j<3;j++){
        const zz=mid+(j-1)*16.8+(rnd()-.5)*2,x=side*(side<0?8.8:9.45);
        b.instance('disc',m.stone,[x,.167,zz],[.66,.03,.66],'#807c6c');
        for(let bar=0;bar<9;bar++){
          const off=(bar-4)*.12,length=2*Math.sqrt(.64*.64-off*off);
          b.box(m.chrome,x+off,.191,zz,.037,.026,length,'#64675e');
        }
        palm(b,m,rnd,x,zz,6.6+rnd()*2.6,rnd()*6.28);
        blocks.push({x,z:zz,w:.6,d:.6});
      }
      streetLight(b,m,side*7.9,mid+side*9,-side);
      for(const zz of [mid-20,mid+8]) {
        const xx=side>0?14.4:-9.66;
        bench(b,m,xx,zz,side);
        b.instance('disc',m.chrome,[xx, .69,zz+1.45],[.27,.97,.27],'#5e746e');
        b.instance('disc',m.chrome,[xx,1.16,zz+1.45],[.29,.13,.29],'#536a65');
      }
      if(side<0) {
        const xx=-11.4,zz=mid+1;
        b.box(m.stone,xx,.46,zz,1.35,.57,2.49,'#baa58d');
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
    if(i>0 && i<5)signal(b,m,8.05,z+7.12,-1);
  }
}

export function createWorld(scene) {
  const b=new StaticWorld(scene),m=makeMaterials(),rnd=randomGenerator(54634),blocks=[];
  streets(b,m,rnd);
  boardwalk(b,m,rnd,blocks);
  for(let i=0;i<5;i++){
    const center=(CROSS_STREETS[i]+CROSS_STREETS[i+1])*.5;
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
    for(const x of [-78,-109,-153,-178]){
      for(let j of [-1,1]){
        const w=x===-178?10:14;
        tower(b,m,rnd,x,center+j*12,w+rnd()*1.7,14+rnd()*4.4,12+rnd()*39,(i*4+j+10)%11,true,blocks);
      }
    }
  }
  for(let i=0;i<19;i++){
    const zz=-262-rnd()*160,xx=-170+rnd()*205;
    tower(b,m,rnd,xx,zz,7+rnd()*11,9+rnd()*14,17+rnd()*58,i,false,blocks);
  }
  for(let i=0;i<10;i++)
    tower(b,m,rnd,-210-rnd()*100,-330+rnd()*470,13+rnd()*10,15+rnd()*12,21+rnd()*76,i,false,blocks);
  addStreetDetails(b,m,rnd,blocks);
  sidewalkLife(b,m,rnd);
  for(let j=0;j<5;j++){
    const x=92+rnd()*76,z=-245+j*75+rnd()*30;
    b.instance('oval',m.stone,[x,.41,z],[1.0,.50,3.35],'#ddd5bf',[0,j*.8,0]);
    b.rod(m.chrome,[x,.85,z],[x,8.15,z],.031,'#c7c8b6');
    b.quad(m.fabric,[[x,.95,z],[x,.95,z+2.9],[x,7.94,z+.18],[x,7.94,z+.12]],undefined,j%2?'#e0bf98':'#dfddd2');
  }
  b.finish();
  const waterTime=ocean(scene);
  return {blocks,update(dt,time){waterTime.value=Number.isFinite(time)?time:waterTime.value+dt;}};
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
    const center=(CROSS_STREETS[i]+CROSS_STREETS[i+1])*.5;
    for(let group=0;group<3;group++){
      const z=center+(group-1)*15+.9;
      // Plant islands on promenade are continuously staggered with maintained walking gaps.
      const px=13.35+(group%2)*1.85;
      b.box(m.stone,px,.225,z,2.3,.25,5.2,'#b2ac97');
      ground(b,m.flat,px-1.09,z-2.50,px+1.09,z+2.50,.358,1,'#716b4e');
      for(const dd of [-1.82,-.68,.56,1.78])planting(b,m,rnd,px+(rnd()-.5)*.84,z+dd,.73+rnd()*.45);
      const tx=-11.65, tz=z+2.2;
      if((i+group)%3!==2) {
        umbrella(b,m,tx,tz,['#bb7769','#649693','#d0a877'][(i+group)%3],.85);
        b.instance('disc',m.stone,[tx,1.00,tz],[.53,.075,.53],'#d8bc93');
        for(let j=0;j<3;j++){
          const a=j*2.094+.48,xx=tx+Math.sin(a)*.79,zz=tz+Math.cos(a)*.79;
          b.instance('disc',m.stone,[xx,.59,zz],[.24,.09,.24],'#887357');
          for(let k of [-1,1]) b.rod(m.chrome,[xx-.11,.17,zz+k*.15],[xx+.09,.61,zz+k*.15],.023,'#697971');
          b.box(m.stone,xx+.23*Math.sin(a),.82,zz+.23*Math.cos(a),.34,.30,.06,'#a78b67',a);
        }
      }else{
        const post=tx+1.68;
        b.box(m.stone,post,.74,tz,.53,1.05,.43,'#657d77');
        b.box(m.chrome,post+.02,1.24,tz,.62,.13,.52,'#4e6d70');
        b.box(m.glass,post+.276,.94,tz,.02,.26,.29,'#849a9c');
      }
    }
    for(let k=0;k<5;k++){
      const zz=center+(k-2)*10,xx=19.0+(rnd()-.5)*1.5;
      planting(b,m,rnd,xx,zz,1.2);planting(b,m,rnd,xx+1.1,zz+1,.89);
    }
    for(let j=0;j<3;j++){
      const z=center+(j-1)*16.0;
      if((i+j)%2===0)bladeSign(b,m,-13.0,z+5.6,3.35,(i+j)%4);
    }
  }
}
