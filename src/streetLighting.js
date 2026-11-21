import * as T from 'three';

// Relight the glazing in the photographed facade, keeping stone piers,
// mullions and the silhouettes of curtains visible at both times of day.
export function officeLighting(material){
  const night={value:0};
  material.onBeforeCompile=s=>{
    s.uniforms.uNight=night;
    s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vFacade;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvFacade=vec2(abs(normal.x)>.5?position.z:position.x,position.y);');
    s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vFacade;uniform float uNight;')
      .replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
        vec3 pane=diffuseColor.rgb;
        float glass=smoothstep(.004,.054,pane.b-pane.r)* (1.-smoothstep(.24,.48,pane.g));
        vec2 room=floor(vFacade/vec2(2.85,2.9));
        float tenant=fract(sin(mod(dot(room,vec2(39.17,71.43)),6.28318))*18437.18);
        vec3 lamp=mix(vec3(.95,.49,.19),vec3(.85,.80,.58),tenant);
        totalEmissiveRadiance+=glass*uNight*smoothstep(.34,.46,tenant)*lamp*(.24+2.2*pane.g);
        roughnessFactor=mix(roughnessFactor,.22,glass);
      `);
  };
  return night;
}

export function streetLamps(scene,blocks){
  const posts=blocks.filter(b=>b.breakable?.kind==='lamp');
  const group=new T.Group();group.visible=false;scene.add(group);
  const lights=Array.from({length:4},()=>{const l=new T.PointLight(0xffca8b,0,22,2);group.add(l);return l;});
  return {group,update(x,z){
    if(!group.visible)return;
    const near=[];
    for(const b of posts){
      if(b.breakable.broken)continue;
      const bx=b.breakable.lightX??b.x,dist=(bx-x)**2+(b.z-z)**2;
      if(dist>55*55)continue;
      near.push({b,bx,dist});
    }
    near.sort((a,b)=>a.dist-b.dist);
    lights.forEach((l,i)=>{
      const p=near[i];l.intensity=p?115:0;
      if(p)l.position.set(p.bx,5.95,p.b.z);
    });
  }};
}
