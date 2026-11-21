import * as T from 'three';
import { AVENUES, CROSS_STREETS, CITY_BOUNDS, CANAL_BANK, OPPOSITE_BANK, PORT_FENCE, PORT_BACK,
  CANAL_ROAD,CANAL_BRIDGES,TOWPATH_WALL,BRIDGE_START,BRIDGE_END,BRIDGE_HALF_WIDTH,canalDeck } from './map.js';

// The boulevard ends at a working canal. A second, built-up bank carries the
// distant skyline; the north side of town meets the fenced freight terminal.
export function buildCityEdge(b,m,blocks,tools){
  const {ground,palm,shrub,streetLight,bench,eastFace,canvasTexture}=tools;
  const rnd=tools.randomGenerator(48531), south=CITY_BOUNDS.maxZ;
  const westRoad=AVENUES[0]-7.3, northRoad=CROSS_STREETS[0]-7.3;
  const deck=.155, stone='#b6b1a0', iron='#567572';
  function backfill(x0,z0,x1,z1,top,color){
    b.box(m.stone,(x0+x1)/2,top-2,(z0+z1)/2,x1-x0,4,z1-z0,color);
  }
  backfill(-1250,-1220,57,PORT_FENCE-.9,.02,'#8e9985');
  backfill(-1250,PORT_FENCE-.9,OPPOSITE_BANK,south,-.10,'#9b9d87');
  backfill(56,-1210,72,northRoad,-.06,'#bbaa86');
  // Vertical faces reach below the waterline, including at the canal head.
  b.box(m.stone,CANAL_BANK+.30,-.62,(south+PORT_FENCE)/2,.60,1.5,south-PORT_FENCE,stone);
  b.box(m.stone,OPPOSITE_BANK-.30,-.70,(south+PORT_FENCE)/2,.60,1.5,south-PORT_FENCE,'#8c9483');
  b.box(m.stone,(OPPOSITE_BANK+CANAL_BANK)/2,-.6,PORT_FENCE-1,CANAL_BANK-OPPOSITE_BANK,1.6,2,'#9d9c87');
  const sluice=(OPPOSITE_BANK+CANAL_BANK)/2;
  b.box(m.stone,sluice,.18,south-.35,CANAL_BANK-OPPOSITE_BANK+1,2.25,1.4,'#a19c83');
  b.box(m.trim,sluice,2.42,south-.5,21,.36,1.52,'#66857d');
  for(const offset of [-6,0,6]){
    b.box(m.chrome,sluice+offset,.35,south-1.08,4.45,1.98,.14,'#415953');
    for(let n=-2;n<=2;n++)b.box(m.stone,sluice+offset+n*.70,.25,south-1.2,.13,1.8,.18,'#858b7b');
    b.rod(m.chrome,[sluice+offset,.75,south-1.18],[sluice+offset,2.57,south-1.18],.13,'#a69d7f');
  }
  const time={value:0};
  const water=new T.MeshStandardMaterial({color:0x507b75,roughness:.28,metalness:.33,vertexColors:true});
  water.onBeforeCompile=shader=>{
    shader.uniforms.canalTime=time;
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float canalTime;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float ripple=sin(vCanal.x*3.4+vCanal.y*.66+canalTime*1.7+sin(vCanal.y*.7));
      float wave=sin(vCanal.y*2.8+vCanal.x*.52+canalTime*.82);
      diffuseColor.rgb *= .92 + .11*ripple + .075*wave;
      diffuseColor.rgb += vec3(.09,.084,.061)*pow(max(0.,ripple*wave),8.);
    `);
    shader.vertexShader='varying vec2 vCanal;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n vCanal=position.xz;');
    shader.fragmentShader='varying vec2 vCanal;\n'+shader.fragmentShader;
  };
  b.quad(water,[[OPPOSITE_BANK,-.78,south],[CANAL_BANK,-.78,south],[CANAL_BANK,-.78,PORT_FENCE],[OPPOSITE_BANK,-.78,PORT_FENCE]]);
  // Cut openings through the quays and their physical rails at both crossings.
  let lastZ=PORT_FENCE;
  for(const nextZ of [...CANAL_BRIDGES.map(z=>z-BRIDGE_HALF_WIDTH-.35),south]){
    ground(b,m.pavement,CANAL_BANK,lastZ,westRoad,nextZ,deck,2.7,'#e4dbbf');
    ground(b,m.pavement,BRIDGE_START,lastZ,OPPOSITE_BANK,nextZ,deck,2.7,'#cbcab1');
    for(const x of [CANAL_BANK+.55,OPPOSITE_BANK-.55]){
      for(let start=lastZ;start<nextZ;start+=3.6){
        const length=Math.min(3.6,nextZ-start),center=start+length/2;
        b.breakable('rail',x,center,.19,length,()=>{
          for(const y of [.58,1.16])b.box(m.chrome,x,y,center,.07,.075,length,iron);
          b.box(m.chrome,x,.69,start+Math.min(.5,length/2),.10,1.12,.10,iron);
        });
      }
    }
    lastZ=nextZ+2*(BRIDGE_HALF_WIDTH+.35);
  }
  ground(b,m.pavement,westRoad,PORT_FENCE,54,northRoad,deck,2.7,'#cbc9bd');
  ground(b,m.asphalt,CANAL_ROAD-4.5,PORT_FENCE,BRIDGE_START,south,.014,4.2);
  ground(b,m.pavement,TOWPATH_WALL,PORT_FENCE,CANAL_ROAD-4.5,south,deck,2.5);
  b.box(m.masonry,TOWPATH_WALL,.91,(PORT_FENCE+south)/2,.4,1.8,south-PORT_FENCE,'#aaac94');
  blocks.push({x:TOWPATH_WALL,z:(PORT_FENCE+south)/2,w:.4,d:south-PORT_FENCE});
  for(let z=PORT_FENCE+3;z<south-3;z+=7){
    if(CANAL_BRIDGES.some(at=>Math.abs(z-at)<8))continue;
    ground(b,m.stripe,CANAL_ROAD-.09,z,CANAL_ROAD+.09,z+3,.031,1,'#d7c99c');
  }
  for(const z of CANAL_BRIDGES){
    const half=BRIDGE_HALF_WIDTH;
    for(let i=0;i<24;i++){
      const x0=BRIDGE_START+(BRIDGE_END-BRIDGE_START)*i/24,x1=BRIDGE_START+(BRIDGE_END-BRIDGE_START)*(i+1)/24;
      const h0=canalDeck(x0),h1=canalDeck(x1);
      const top=(mat,a,c,y,color,tile)=>b.quad(mat,[[x0,h0+y,z+c],[x1,h1+y,z+c],[x1,h1+y,z+a],[x0,h0+y,z+a]],
        [[x0/tile,-(z+c)/tile],[x1/tile,-(z+c)/tile],[x1/tile,-(z+a)/tile],[x0/tile,-(z+a)/tile]],color);
      top(m.asphalt,-half,half,0,'#c7c5ae',4.2);
      if(i%3!==0)top(m.stripe,-.093,.093,.012,'#ede0a4',1);
      for(const side of [-1,1]){
        const zz=z+side*(half-.12);
        b.quad(m.fabric,[[x0,h0-.26,zz],[x1,h1-.26,zz],[x1,h1,zz],[x0,h0,zz]],undefined,stone);
        b.rod(m.stone,[x0,h0-.10,zz],[x1,h1-.10,zz],.21,stone);
        b.breakable('rail',(x0+x1)/2,zz,x1-x0,.22,()=>{
          b.rod(m.chrome,[x0,h0+.95,zz],[x1,h1+.95,zz],.065,iron);
          b.rod(m.chrome,[x0,h0+.53,zz],[x1,h1+.53,zz],.04,iron);
          if(i%2===0)b.rod(m.stone,[x0,h0,zz],[x0,h0+1,zz],.10,'#c1bb9e');
        });
      }
    }
    for(const x of [CANAL_BANK-3,OPPOSITE_BANK+3])for(const side of [-1,1]){
      b.rod(m.stone,[x,-1.15,z+side*3.9],[x,canalDeck(x)-.13,z+side*3.9],.34,stone);
    }
  }
  for(const cross of CROSS_STREETS){
    if(cross===CROSS_STREETS.at(-1))break;
    const mid=cross+32;
    // The overlook opposite each intersection stays open to pedestrians.
    ground(b,m.flat,westRoad-5.5,mid-20,westRoad-1.2,mid+20,deck+.012,1,'#80936a');
    for(const dz of [-13,12]){
      const x=westRoad-3.25,z=mid+dz;
      palm(b,m,rnd,x,z,6.6+rnd()*2.4,rnd()*6.28);
      shrub(b,m,rnd,x+1.1,z+2.8,.70);
    }
    bench(b,m,CANAL_BANK+4.4,mid,-1);streetLight(b,m,westRoad-1.15,mid+6,1);
    if(cross>-230){
      b.box(m.trim,CANAL_BANK+5.1,3.15,mid+4,4.6,.22,6.8,'#668c84');
      for(const dz of [1.2,6.8])for(const dx of [3.25,6.95])
        b.rod(m.chrome,[CANAL_BANK+dx,deck,mid+dz],[CANAL_BANK+dx,3.1,mid+dz],.074,iron);
    }
  }
  // Each block has frontage on the towpath. Windows and balconies face the
  // player across the water, and the roofs hide the far edge of the terrain.
  const facades=['#d3ac86','#d6c2a2','#b5c1b3','#cb9989','#aeb9aa'];
  for(let j=0;j<15;j++){
    const z=PORT_FENCE+20+j*39,front=CANAL_ROAD-10-rnd()*2;
    const levels=2+(j%4),h=levels*2.9,d=24+rnd()*8,w=12+rnd()*5;
    b.building(front-w/2,z,w,d,h,()=>{
      b.box(m.masonry,front-w/2,h/2+.05,z,w,h,d,facades[j%5]);
      for(let k=0;k<2;k++)eastFace(b,m.facade,front+.025,.10,z+(k-.5)*d/2,d*.497,h-.10,j%12,3);
      b.box(m.trim,front-w/2,h+.16,z,w+.65,.30,d+.6,'#dacfb9');
      if(j%3===0){
        for(let level=1;level<levels;level++){
          const y=level*2.9;b.box(m.stone,front+.55,y,z,1.45,.18,d*.72,'#e3d8c5');
          b.box(m.chrome,front+1.19,y+.77,z,.055,.07,d*.72,iron);
          for(let dz=-d*.35;dz<d*.36;dz+=2.2)b.box(m.chrome,front+1.19,y+.39,z+dz,.045,.78,.045,iron);
        }
      }
    });
    const nearBridge=CANAL_BRIDGES.some(at=>Math.abs(z+10-at)<8);
    if(!nearBridge){
      palm(b,m,rnd,OPPOSITE_BANK-3,z+10,5.8+rnd()*2,rnd()*6.28);
    }
    if(j%2===1){
      b.box(m.wood,OPPOSITE_BANK+1.75,-.18,z-8,3.9,.26,8,'#ad8e65');
      for(const dz of [-11,-5])b.rod(m.stone,[OPPOSITE_BANK+3.3,-1.2,z+dz],[OPPOSITE_BANK+3.3,.32,z+dz],.13,'#876e54');
    }
  }

  const signTexture=canvasTexture(768,176,g=>{
    g.fillStyle='#254f52';g.fillRect(0,0,768,176);g.strokeStyle='#cab783';g.lineWidth=6;g.strokeRect(9,9,750,158);
    g.fillStyle='#fff0cf';g.font='bold 57px Arial';g.fillText('PORT AUTHORITY',36,81);
    g.font='28px Arial';g.fillText('FREIGHT TERMINAL     /     GATE 04',38,132);
  });
  const sign=new T.MeshStandardMaterial({map:signTexture,side:T.DoubleSide,roughness:.68});
  const fenceZ=PORT_FENCE+.32, fenceLeft=TOWPATH_WALL,fenceRight=54;
  const yardWidth=fenceRight-fenceLeft,middle=(fenceLeft+fenceRight)/2;
  ground(b,m.asphalt,fenceLeft,PORT_BACK,fenceRight,PORT_FENCE,.043,4.2,'#d3d4bf');
  function retainingWall(x,z,w,d){
    b.box(m.stone,x,.92,z,w,1.76,d,'#919989');
    b.box(m.trim,x,1.84,z,w+.06,.15,d+.06,'#b8bbab');
    blocks.push({x,z,w,d});
  }
  retainingWall(middle,PORT_BACK+.30,yardWidth,.60);
  for(const x of [fenceLeft+.3,fenceRight-.3])retainingWall(x,(PORT_BACK+PORT_FENCE)/2,.6,PORT_FENCE-PORT_BACK);
  function panels(start,end){
    for(let lo=start;lo<end;lo+=5.1){
      const hi=Math.min(end,lo+5.1),x=(lo+hi)/2,length=hi-lo;
      if(length<.02)continue;
      b.breakable('fence',x,fenceZ,length,.42,()=>{
        b.box(m.stone,x,.43,fenceZ,length,.62,.42,'#acaa98');
        for(const y of [.88,2.02])b.box(m.chrome,x,y,fenceZ,length,.08,.08,iron);
        for(let picket=lo+.18;picket<hi;picket+=.85)b.box(m.chrome,picket,1.43,fenceZ,.048,1.43,.052,iron);
      });
    }
  }
  let from=fenceLeft;
  for(const x of AVENUES){
    panels(from,x-4.3);from=x+4.3;
    for(const side of [-1,1]){
      b.breakable('bollard',x+side*4.3,fenceZ,.52,.56,()=>{
        b.box(m.stone,x+side*4.3,1.32,fenceZ,.52,2.62,.56,stone);
      });
    }
    b.breakable('gate',x,fenceZ,8.1,.20,()=>{
      for(const y of [.38,1.96])b.box(m.chrome,x,y,fenceZ,8.1,.12,.12,iron);
      for(let i=-4;i<=4;i++)b.box(m.chrome,x+i*.88,1.17,fenceZ,.065,1.64,.065,iron);
      b.rod(m.chrome,[x-4,.38,fenceZ],[x+4,1.96,fenceZ],.055,iron);
      if(x===-128||x===0)
        b.quad(sign,[[x-3,.65,fenceZ+.12],[x+3,.65,fenceZ+.12],[x+3,2.02,fenceZ+.12],[x-3,2.02,fenceZ+.12]]);
    });
    if(x===-128||x===0){
      b.building(x+7.8,fenceZ-2,4.85,4,3.4,()=>{
        b.box(m.masonry,x+7.8,1.61,fenceZ-2,4.85,3.2,4,'#e7d6ba');
        b.box(m.glass,x+7.8,2.03,fenceZ+.05,4.15,1.12,.1,'#4e7078');
        b.box(m.trim,x+7.8,3.30,fenceZ-2,5.3,.23,4.5,iron);
      });
    }
  }
  panels(from,fenceRight);
  for(let j=0;j<6;j++){
    const x=-251+j*49,z=PORT_FENCE-25-(j%2)*7,w=32+rnd()*6,d=24,h=6.3+rnd()*3.2;
    b.building(x,z,w,d,h,()=>{
      b.box(m.ribbed,x,h/2,z,w,h,d,'#c5c8bb');
      const front=z+d/2+.015;
      b.quad(m.harbor,[[x-w/2,.08,front],[x+w/2,.08,front],[x+w/2,h,front],[x-w/2,h,front]]);
      b.box(m.trim,x,h+.22,z,w+1,.41,d+1,'#769093');
      for(let k=-1;k<=1;k++){
        const xx=x+k*9,zDoor=z+d/2+.05;
        b.box(m.chrome,xx,2.2,zDoor,5.7,4.42,.11,'#798988');
        for(let n=0;n<6;n++)b.box(m.stone,xx,.52+n*.62,zDoor+.067,5.65,.06,.04,'#a5aea2');
      }
      for(let k=0;k<3;k++)b.box(m.stone,x-10+k*8,h+.66,z+2,3.1,.9,2.3,'#a7ad9d');
    });
    streetLight(b,m,x+20,z+14,1);
  }
  for(let j=0;j<4;j++){
    const x=-209+j*7.4,z=PORT_FENCE-61;
    b.instance('disc',m.chrome,[x,7.5,z],[3.3,15,3.3],'#afbbb3');
    b.instance('cone',m.stone,[x,15.83,z],[3.45,1.66,3.45],'#a8a99a');
    b.rod(m.chrome,[x,14.5,z],[x,18.5,z],.12,iron);
  }
  // Where the street grid meets the Keys, trailheads and parking gardens
  // frame the two open highway connections and allow access to the wetlands.
  for(const [a,c] of [[CANAL_BANK,-199],[-185,-7],[7,17]]){
    ground(b,m.pavement,a,167.3,c,170,deck,2.6);
  }
  for(const x of [-230,-159,-101,-35]){
    bench(b,m,x+5,168.1);palm(b,m,rnd,x-10,169,6.4,rnd()*6.28);
    shrub(b,m,rnd,x-6,169,.76);streetLight(b,m,x+11,168,-1);
  }
  const parkMap=canvasTexture(384,224,g=>{
    g.fillStyle='#e2d9b1';g.fillRect(0,0,384,224);g.fillStyle='#36574c';g.fillRect(0,0,384,52);
    g.fillStyle='#fcf3da';g.font='bold 28px Arial';g.fillText('SAWGRASS TRAIL',15,36);
    g.fillStyle='#7fa493';g.fillRect(20,69,230,132);g.strokeStyle='#dbc991';g.lineWidth=12;
    g.beginPath();g.moveTo(31,181);g.bezierCurveTo(104,153,72,114,171,123);g.lineTo(221,84);g.stroke();
    g.fillStyle='#37584a';g.font='bold 16px Arial';g.fillText('TRAILHEAD',260,94);g.fillText('0.0 mi',260,119);
    g.fillStyle='#c36548';g.beginPath();g.arc(36,180,8,0,Math.PI*2);g.fill();
  });
  const board=new T.MeshStandardMaterial({map:parkMap,roughness:.85,side:T.DoubleSide});
  for(const x of [-128,-64]){
    const z=172.1;
    ground(b,m.pavement,x-2.3,170,x+2.3,181,.146,2.5,'#cfc8a6');
    for(const side of [-1,1]){
      b.breakable('bollard',x+side*1.85,169.7,.32,.32,()=>{
        b.rod(m.stone,[x+side*1.85,.14,169.7],[x+side*1.85,.92,169.7],.16,'#88725a');
      });
    }
    b.breakable('sign',x-4.5,z,2.6,.25,()=>{
      b.box(m.trim,x-4.5,2.29,z,3.1,.16,.95,'#47736a');
      for(const dx of [-5.63,-3.37])b.box(m.stone,x+dx,1.18,z,.15,2.12,.16,'#8b785a');
      b.quad(board,[[x-3.22,.9,z-.10],[x-5.78,.9,z-.10],[x-5.78,2.15,z-.10],[x-3.22,2.15,z-.10]]);
    });
  }
  return t=>{time.value=t;};
}
