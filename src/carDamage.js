import * as T from 'three';

export function paintWear(shell){
  const wear=new T.Float32BufferAttribute(new Float32Array(shell.geometry.attributes.position.count),1);
  shell.geometry.setAttribute('wear',wear);
  shell.material.onBeforeCompile=s=>{
    s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nattribute float wear; varying float vWear; varying vec3 vPanel;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvWear=wear;vPanel=position;');
    s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying float vWear; varying vec3 vPanel;')
      .replace('#include <color_fragment>',`#include <color_fragment>
        float track=41.*vPanel.y+2.7*vPanel.x+2.1*sin(vPanel.z*3.+vPanel.x);
        float edge=abs(fract(track)-.5);
        float scratch=(1.-smoothstep(.04,.09+min(.30,fwidth(track)),edge))*smoothstep(.09,.55,vWear);
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.28,.25,.23),scratch*.90);
        diffuseColor.rgb*=1.-.29*vWear;
      `).replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=min(1.,roughnessFactor+vWear*.49);');
  };
}

export function fittingDamage(body,lamps,brakes,screenPoint){
  const lights=[lamps,brakes],original=lights.map(m=>m.geometry.attributes.color.array.slice());
  const condition=[1,1,1,1],cracks=[null,null];
  function chipGlass(side,strength){
    const segments=[],cx=side*.45,cy=.43;
    const point=(u,v)=>screenPoint(T.MathUtils.clamp(u,-.95,.95),T.MathUtils.clamp(v,.06,.94));
    for(let j=0;j<11;j++){
      const a=j*2.40+side*.61,scale=(.43+.32*(j%4))*strength;
      const dx=.32*Math.cos(a)*scale,dy=.46*Math.sin(a)*scale;
      const mid=point(cx+dx*.52+.014,cy+dy*.46),end=point(cx+dx,cy+dy);
      segments.push(...point(cx,cy),...mid,...mid,...end);
      if(j%2===0)segments.push(...mid,...point(cx+dx*.77+.052,cy+dy*.83-.048));
    }
    const geo=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(segments,3));
    const line=new T.LineSegments(geo,new T.LineBasicMaterial({color:0xdae9e7,transparent:true,opacity:.75,depthWrite:false}));
    body.add(line);return line;
  }
  function remove(line){if(line){body.remove(line);line.geometry.dispose();line.material.dispose();}}
  return {condition,
    hit({side,front,speed}){
      if(speed<6)return;
      const rear=front<0,group=rear?1:0;
      const mesh=lights[group],{position,color}=mesh.geometry.attributes,z=rear?2.13:-2.08;
      for(const [j,sign] of [-1,1].entries()){
        const index=group*2+j;
        const distance=Math.hypot((side-sign*.68)*1.15,front+z);
        if(distance>=1.22)continue;
        condition[index]=Math.max(.04,condition[index]-(1-distance/1.22)*(speed-5)*.092);
        for(let n=0;n<position.count;n++){
          if(position.getX(n)*sign<0||position.getZ(n)*z<1)continue;
          const k=n*3,level=condition[index];
          color.setXYZ(n,original[group][k]*level,original[group][k+1]*level,original[group][k+2]*level);
        }
        color.needsUpdate=true;
      }
      if(front>.65&&speed>10){
        const j=side>0?1:0;
        remove(cracks[j]);cracks[j]=chipGlass(j?1:-1,Math.min(1.55,.60+(speed-10)*.055+(1-condition[j])*.28));
      }
    },
    restore(){
      if(condition.every(c=>c===1)&&cracks.every(c=>!c))return;
      lights.forEach((m,i)=>{const c=m.geometry.attributes.color;c.array.set(original[i]);c.needsUpdate=true;});
      cracks.forEach(remove);cracks.fill(null);condition.fill(1);
    }
  };
}
