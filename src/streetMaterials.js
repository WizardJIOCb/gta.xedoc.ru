import * as T from 'three';

// Keep a metre of weathering the same size on a column, a warehouse and a
// rotated dock. Ground quads already carry metre-scaled UVs from the builder.
export function scannedSurface(name,roughness,relief,boxTile=0){
  const loader=new T.TextureLoader();
  function texture(suffix){
    const map=loader.load('/surface/'+name+suffix+'.webp');
    map.wrapS=map.wrapT=T.RepeatWrapping;map.anisotropy=8;
    if(!suffix)map.colorSpace=T.SRGBColorSpace;
    return map;
  }
  const mat=new T.MeshStandardMaterial({map:texture(''),normalMap:texture('-normal'),roughness,
    normalScale:new T.Vector2(relief,relief),vertexColors:!boxTile});
  if(boxTile){
    mat.onBeforeCompile=shader=>{
      shader.uniforms.tileMetres={value:boxTile};
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float tileMetres;')
        .replace('#include <uv_vertex>',`#include <uv_vertex>
          #ifdef USE_INSTANCING
          vec3 size=vec3(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz),length(instanceMatrix[2].xyz));
          vec2 extent=abs(normal.x)>.5?size.zy:(abs(normal.y)>.5?size.xz:size.xy);
          vMapUv=uv*extent/tileMetres+fract(instanceMatrix[3].xz*.173);
          vNormalMapUv=vMapUv;
          #endif`);
    };
  }
  return mat;
}
