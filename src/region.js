import * as T from 'three';
import { REGION_LAND, ROAD_STATIONS, ROAD_HALF, REGIONAL_LOTS, landIndexAt, roadSample } from './map.js';

const SATURATED_GREEN = [0x677c49,0x667e50,0x738557,0x88975e];
const SALT_GRASS = [0x9ba76c,0xabb77d,0xb6b67c,0xabac71];

function terrainMaterial(){
  const m=new T.MeshStandardMaterial({vertexColors:true,roughness:.96});
  m.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vGroundXZ;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvGroundXZ=position.xz;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
      varying vec2 vGroundXZ;
      float groundHash(vec2 p){return fract(sin(mod(dot(p,vec2(127.1,311.7)),6.28318))*4375.5453);}
      float groundNoise(vec2 p){
        vec2 c=floor(p), f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(groundHash(c),groundHash(c+vec2(1,0)),f.x),mix(groundHash(c+vec2(0,1)),groundHash(c+1.),f.x),f.y);
      }`).replace('#include <color_fragment>',`#include <color_fragment>
      float grain=groundNoise(vGroundXZ*14.)-.5;float cover=groundNoise(vGroundXZ*.21)-.5;
      diffuseColor.rgb*=.96+cover*.42+grain*.17+.1*(groundNoise(vGroundXZ*2.)-.5);
      `);
  };
  return m;
}

function drawLand(scene,rnd) {
  const xyz=[],colors=[],indices=[],color=new T.Color();
  function vertex(x,y,z,hex) {
    xyz.push(x,y,z);color.set(hex);colors.push(color.r,color.g,color.b);
    return xyz.length/3-1;
  }
  const ringSize=REGION_LAND.length;
  for(let island=0;island<ringSize;island++){
    const line=REGION_LAND[island],pts=line.map(([x,z])=>new T.Vector2(x,z)),n=line.length;
    const sign=T.ShapeUtils.area(pts)>=0?1:-1;
    const key=island>=1 && island<=4 || island>=13;
    const dry=key?SALT_GRASS:SATURATED_GREEN;
    const top=[],sand=[],bed=[];
    for(let i=0;i<n;i++){
      const [x,z]=line[i],[px,pz]=line[(i+n-1)%n],[nx,nz]=line[(i+1)%n];
      const len=Math.hypot(nx-px,nz-pz);
      const dx=(nz-pz)*sign/len,dz=-(nx-px)*sign/len;
      const margin=key?4.3:1.9;
      const outward=(d)=>[x+dx*d,Math.max(170,z+dz*d)];
      const [bx,bz]=outward(margin*.5),[cx,cz]=outward(margin);
      top.push(vertex(x,.12,z,dry[Math.floor(rnd()*dry.length)]));
      sand.push(vertex(bx,-.02,bz,key?0xd9c99b:0x8f9369));
      bed.push(vertex(cx,-.59,cz,key?0xb8af87:0x777c5d));
    }
    function addUp(i,j,k){
      const ax=xyz[j*3]-xyz[i*3],az=xyz[j*3+2]-xyz[i*3+2],bx=xyz[k*3]-xyz[i*3],bz=xyz[k*3+2]-xyz[i*3+2];
      if(az*bx-ax*bz>0)indices.push(i,j,k);else indices.push(i,k,j);
    }
    for(const [a,b,c] of T.ShapeUtils.triangulateShape(pts,[]))addUp(top[a],top[b],top[c]);
    for(let i=0;i<n;i++){
      const j=(i+1)%n;
      for(const [inner,outer] of [[top,sand],[sand,bed]]){
        addUp(inner[i],outer[i],outer[j]);addUp(inner[i],outer[j],inner[j]);
      }
    }
  }
  const geo=new T.BufferGeometry();
  geo.setAttribute('position',new T.Float32BufferAttribute(xyz,3));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  geo.setIndex(indices);geo.computeVertexNormals();
  const mesh=new T.Mesh(geo,terrainMaterial());mesh.name='Regional shorelines';mesh.receiveShadow=true;scene.add(mesh);
}

function tidalWater(scene) {
  const mat=new T.MeshStandardMaterial({color:0xffffff,metalness:.23,roughness:.31});
  const time={value:0};
  mat.onBeforeCompile=s=>{
    s.uniforms.uTidalTime=time;
    s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vSea;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvSea=(modelMatrix*vec4(position,1.)).xz;');
    s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nuniform float uTidalTime; varying vec2 vSea;')
      .replace('#include <color_fragment>',`#include <color_fragment>
        float tide=.46*sin(.12*vSea.y+.21*vSea.x+uTidalTime*.55);
        float one=sin(vSea.x*1.9+vSea.y*.35+tide+uTidalTime*.91);
        float two=sin(vSea.x*.20+vSea.y*2.88+.65*one-uTidalTime*1.11);
        float marsh=1.-smoothstep(-165.,65.,vSea.x);
        float shoal=.5+.5*sin(vSea.x*.055+vSea.y*.022+2.*sin(vSea.y*.034));
        vec3 salt=mix(vec3(.024,.27,.30),vec3(.096,.48,.435),shoal);
        vec3 fresh=mix(vec3(.068,.168,.125),vec3(.115,.227,.163),shoal);
        diffuseColor.rgb=mix(salt,fresh,marsh)*(.97+.035*one+.026*two)
          + vec3(.32,.32,.24)*pow(max(0.,one*.52+two*.48),13.);
      `);
  };
  const geo=new T.PlaneGeometry(3400,2600);geo.rotateX(-Math.PI/2);
  const water=new T.Mesh(geo,mat);water.position.set(0,-.23,1470);
  water.name='Tidal water';scene.add(water);return time;
}

const point=(s,r,dy=0)=>[s.x+s.nx*r,s.y+dy,s.z+s.nz*r];
function highway(b,m) {
  const road=ROAD_STATIONS;
  function strip(mat,a,c,inner,outer,dy,tile,color){
    b.quad(mat,[point(a,inner,dy),point(a,outer,dy),point(c,outer,dy),point(c,inner,dy)],
      [[inner/tile,a.s/tile],[outer/tile,a.s/tile],[outer/tile,c.s/tile],[inner/tile,c.s/tile]],color);
  }
  for(let i=1;i<road.length;i++){
    const a=road[i-1],c=road[i],bridge=a.bridge||c.bridge;
    const over=bridge?ROAD_HALF+.51:6.25;
    strip(m.flat,a,c,-over,over,-.012,1,bridge?'#aeafa1':'#b5a58a');
    strip(m.asphalt,a,c,-ROAD_HALF,ROAD_HALF,0,4.2,'#efebe6');
    for(const side of [-1,1]){
      strip(m.flat,a,c,side*.16-.047,side*.16+.047,.012,1,'#cda45a');
      strip(m.flat,a,c,side*4.78-.065,side*4.78+.065,.013,1,'#dfd8b9');
      if(bridge){
        const edge=side*(ROAD_HALF+.4);
        b.quad(m.fabric,[point(a,edge),point(c,edge),point(c,edge,-.62),point(a,edge,-.62)],undefined,'#8c9391');
        if(c.s<bridge.waterLo || a.s>bridge.waterHi){
          const footA=point(a,edge+side*2.9),footB=point(c,edge+side*2.9);
          footA[1]=footB[1]=.12;
          b.quad(m.fabric,[point(a,edge,-.20),point(c,edge,-.20),footB,footA],undefined,'#a8a077');
        }
        b.rod(m.chrome,point(a,edge,.86),point(c,edge,.86),.068,'#c0c2b5');
        b.rod(m.chrome,point(a,edge,.50),point(c,edge,.50),.042,'#9ca8a4');
        b.rod(m.stone,point(a,edge,-.07),point(a,edge,.87),.075,'#b9b7a4');
      }
    }
    if(!bridge || c.s<bridge.waterLo||c.s>bridge.waterHi)continue;
    if(Math.floor(a.s/15)!==Math.floor(c.s/15)){
      for(const side of [-1,1]){
        const head=point(c,side*3.45,-.49),foot=head.slice();foot[1]=-1.15;
        b.rod(m.stone,foot,head,.38,'#a0aca1');
      }
      b.rod(m.stone,point(c,-5.25,-.47),point(c,5.25,-.47),.40,'#bcc1ad');
    }
    if(Math.floor(a.s/37)!==Math.floor(c.s/37)){
      b.rod(m.chrome,point(c,5.45,.25),point(c,5.45,5.5),.067,'#829c9c');
      b.rod(m.chrome,point(c,5.45,5.5),point(c,4.07,5.88),.055,'#9ca8a6');
      b.box(m.bulb,...point(c,4.07,5.83),.44,.08,.32,'#ffe1a5');
    }
  }
}

function canopyTexture(canvasTexture,rnd){
  return canvasTexture(384,384,(g,w,h)=>{
    // Individual tapered sprays overlap to form open, light-catching cypress foliage.
    for(let i=0;i<3100;i++){
      const a=rnd()*Math.PI*2,r=Math.sqrt(rnd()),rx=Math.cos(a)*r,ry=Math.sin(a)*r;
      const edge=1+Math.sin(4*a)*.09+Math.cos(a*7.0)*.06;
      if(r>edge*.95)continue;
      const x=w*.5+rx*w*.46,y=h*.52+ry*h*.43;
      const lift=Math.min(1,Math.max(0,(1-rx*.36-ry*.68)*.61));
      const tone=20+Math.round(lift*53+rnd()*27);
      g.strokeStyle='rgb('+Math.round(tone*.95)+','+Math.round(tone*1.19+13)+','+Math.round(tone*.61)+')';
      const len=5+rnd()*13,dir=.45*rx+(rnd()-.5)*.61;
      g.lineWidth=.85+rnd()*1.2;g.beginPath();g.moveTo(x,y);g.lineTo(x+dir*len,y-len);
      for(let j=1;j<=4;j++){
        const t=j*.21,cx=x+dir*len*t,cy=y-len*t,ww=(1-t)*7+1;
        g.moveTo(cx-ww,cy-3);g.lineTo(cx,cy);g.lineTo(cx+ww,cy-3);
      }
      g.stroke();
    }
  });
}

function vegetate(b,m,rnd,blocks,tools){
  const leaf=new T.MeshStandardMaterial({map:canopyTexture(tools.canvasTexture,rnd),side:T.DoubleSide,alphaTest:.30,
    roughness:.91,vertexColors:true,emissive:0x24301a,emissiveIntensity:.32});
  leaf.userData.casts=true;
  const occupied=(x,z,margin=0)=>REGIONAL_LOTS.some(p=>Math.abs(p.x-x)<15+margin&&Math.abs(p.z-z)<15+margin);
  const roadClear=(x,z,margin)=>(roadSample(x,z)?.distance??Infinity)>margin;
  const stem='#827963',wood='#766e58';
  function cluster(x,y,z,rx,ry,angle,tint){
    for(let k=0;k<3;k++){
      const a=angle+k*Math.PI/3,dx=Math.cos(a)*rx,dz=Math.sin(a)*rx;
      b.quad(leaf,[[x-dx,y-ry,z-dz],[x+dx,y-ry,z+dz],[x+dx,y+ry,z+dz],[x-dx,y+ry,z-dz]],undefined,tint);
    }
  }
  function cypress(x,z,h){
    const spread=h*.29;
    b.rod(m.stone,[x,.1,z],[x,h*.63,z],h*.029,stem);
    b.instance('cone',m.stone,[x,h*.14,z],[h*.067,h*.28,h*.067],wood);
    for(let k=0;k<5;k++){
      const a=k*2.4+rnd()*.35,dx=Math.cos(a)*spread*(1-k*.135),dz=Math.sin(a)*spread*(1-k*.135),y=h*(.52+k*.086);
      b.rod(m.stone,[x,y-h*.12,z],[x+dx,y+h*.04,z+dz],.065,wood);
      cluster(x+dx*.72,y+h*.09,z+dz*.72,spread*(1-k*.112),h*(.205-k*.014),a,'#ebedd5');
      if(k%2===0)for(let j=0;j<3;j++){
        const xx=x+dx*.85+(rnd()-.5),zz=z+dz*.85+(rnd()-.5),yy=y+h*.04,l=.6+rnd()*.98;
        b.quad(m.fabric,[[xx-.05,yy,zz],[xx+.065,yy,zz],[xx+.12,yy-l,zz+.04],[xx+.11,yy-l-.08,zz+.04]],undefined,'#979882');
      }
    }
    for(let k=0;k<5;k++){
      const a=rnd()*Math.PI*2,r=.7+rnd()*2.1;
      b.instance('cone',m.stone,[x+r*Math.cos(a),.40,z+r*Math.sin(a)],[.14,.67,.16],'#898369');
    }
  }
  function mangrove(x,z,h){
    const w=h*.52;
    for(let k=0;k<5;k++){
      const a=k*2.38+rnd()*.22,dx=Math.cos(a),dz=Math.sin(a);
      const bend=[x+dx*.35,h*.49,z+dz*.35];
      b.rod(m.stone,[x+dx*w*.74,-.22,z+dz*w*.74],[x+dx*w*.49,h*.30,z+dz*w*.49],.105,wood);
      b.rod(m.stone,[x+dx*w*.49,h*.30,z+dz*w*.49],bend,.105,stem);
      b.rod(m.stone,bend,[x+dx*w*.71,h*.86,z+dz*w*.71],.082,wood);
      cluster(x+dx*w*.70,h*.85,z+dz*w*.70,w*.89,h*.29,a,'#e5e7b1');
    }
  }
  function reeds(x,z,scale){
    const c=['#a7a16a','#929f66','#758d58','#c2af79'];
    for(let i=0;i<14;i++){
      const a=rnd()*6.28,dx=Math.cos(a),dz=Math.sin(a),r=rnd()*scale*.75;
      const xx=x+r*dx,zz=z+r*dz,h=(.55+rnd()*.7)*scale,lean=.22*scale;
      b.quad(m.fabric,[[xx-.038*dz,.015,zz+.038*dx],[xx+.038*dz,.015,zz-.038*dx],
        [xx+lean*dx,h,zz+lean*dz],[xx+lean*dx-.005,h+.028,zz+lean*dz]],undefined,c[i%4]);
    }
  }
  for(let i=0;i<1500;i++){
    const x=-340+rnd()*585,z=175+rnd()*491,land=landIndexAt(x,z);
    if(land<0||occupied(x,z,4)||!roadClear(x,z,10))continue;
    const salt=x>15;const near=roadSample(x,z);
    if(salt){
      if(i%4===0){tools.palm(b,m,rnd,x,z,5.9+rnd()*3.6,rnd()*6.28);}
      else if(i%3===0)mangrove(x,z,2.6+rnd()*1.7);
      else reeds(x,z,1.05+rnd()*.7);
    }else{
      if(i%3===0)cypress(x,z,5.3+rnd()*5.8);
      else if(i%5===0)mangrove(x,z,3.1+rnd()*1.6);
      else reeds(x,z,1.0+rnd()*1.2);
    }
    if(near&&near.distance<18&&i%4===0)blocks.push({x,z,w:.55,d:.55});
  }
  // Edge vegetation outlines the ragged river banks from both road and water.
  for(let i=0;i<REGION_LAND.length;i++){
    const poly=REGION_LAND[i];
    for(let k=2;k<poly.length;k+=5){
      const [x,z]=poly[k];
      if(z<181||occupied(x,z,5)||!roadClear(x,z,10))continue;
      if(x<-60&&k%3===0)mangrove(x,z,2.5+rnd()*1.6);
      else reeds(x,z,.89+rnd()*1.2);
    }
  }
}

function wayfinding(b,m,canvasTexture){
  const sheets=[
    ['SOUTH  8','Pelican Keys','Cypress Junction'],['NORTH  8','Ocean Drive','Marina Keys'],
    ['COUNTY ROAD 16','Sawgrass Glades','Cypress Junction'],['COASTAL HIGHWAY','Pelican Sound','B R I D G E']
  ];
  const tex=canvasTexture(1024,512,(g)=>{
    for(let k=0;k<sheets.length;k++){
      const x=k%2*512,y=Math.floor(k/2)*256;
      g.save();g.translate(x,y);g.fillStyle='#38684f';g.fillRect(0,0,512,256);
      g.strokeStyle='#e5dfb4';g.lineWidth=5;g.strokeRect(9,9,494,238);
      g.fillStyle='#f8efc7';g.font='bold 24px Arial';g.fillText(sheets[k][0],31,56);
      g.font='bold 46px Arial';g.fillText(sheets[k][1],31,125,449);
      g.font='31px Arial';g.fillText(sheets[k][2],31,188,447);g.restore();
    }
  });
  const material=new T.MeshStandardMaterial({map:tex,roughness:.69,side:T.DoubleSide});
  for(const [x,z,id,dir] of [[0,183,0,1],[151,409,1,-1],[-205,250,2,1],[162,437,3,1]]){
    const sample=roadSample(x,z);if(!sample)continue;
    const s=ROAD_STATIONS.reduce((best,v)=>Math.abs(v.s-sample.s)<Math.abs(best.s-sample.s)?v:best);
    const center=point(s,dir*7.7),nx=s.nx*dir,nz=s.nz*dir;
    const coord=(side,h)=>[center[0]+nx*side,s.y+h,center[2]+nz*side];
    for(const side of [-1.35,1.35]){
      b.rod(m.chrome,coord(side,-.19),coord(side,3.6),.062,'#9caa9c');
    }
    const left=(id%2)*.5+.003,right=left+.494,bottom=1-(Math.floor(id/2)+1)*.5+.007,top=bottom+.486;
    b.quad(material,[coord(-1.92,1.68),coord(1.92,1.68),coord(1.92,3.63),coord(-1.92,3.63)],[[left,bottom],[right,bottom],[right,top],[left,top]]);
  }
}

export function buildRegion(scene,b,m,blocks,tools) {
  const rnd=tools.randomGenerator(73851);
  drawLand(scene,rnd);
  const water=tidalWater(scene);
  highway(b,m);
  vegetate(b,m,rnd,blocks,tools);
  wayfinding(b,m,tools.canvasTexture);
  return t=>{water.value=t;};
}
