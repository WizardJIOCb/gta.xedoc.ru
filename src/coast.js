import * as T from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { BOUNDS } from './map.js';

// Render a low-resolution mirror under shallow pools. The rough asphalt
// stays visible through the water and breaks up reflections along each edge.
export function addWetRoad(scene) {
  const shader={
    ...Reflector.ReflectorShader,
    vertexShader:`
      uniform mat4 textureMatrix;
      varying vec4 proj;
      varying vec3 wp;
      void main(){
        wp=(modelMatrix*vec4(position,1.)).xyz;
        proj=textureMatrix*vec4(position,1.);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
      }`,
    fragmentShader:`
      uniform sampler2D tDiffuse;
      varying vec4 proj;
      varying vec3 wp;
      float hash(vec2 p){return fract(sin(mod(dot(p,vec2(127.1,311.7)),6.28318))*4375.5453);}
      float noise(vec2 p){
        vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);
      }
      void main(){
        vec2 st=wp.xz;
        float gutter=abs(abs(mod(st.x+32.,64.)-32.)-5.15);
        float pools=noise(st*vec2(.55,.29))*.4+noise(st*vec2(.13,.12))*.4+noise(st*1.7)*.14+noise(st*6.)*.06;
        float depth=smoothstep(.45,.63,pools-.08*min(gutter,2.2));
        if(depth<.01) discard;
        vec2 uv=proj.xy/proj.w;
        float grain=noise(st*24.)-.5;
        uv+=vec2(grain*.0014,grain*.0019);
        vec3 reflected=texture2D(tDiffuse,uv).rgb;
        float angle=1.-normalize(cameraPosition-wp).y;
        gl_FragColor=vec4(reflected*vec3(.78,.85,.86),depth*(.14+.49*pow(clamp(angle,0.,1.),2.6)));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  };
  const roadEast=7.1;
  const wet=new Reflector(new T.PlaneGeometry(roadEast-BOUNDS.minX,BOUNDS.maxZ-BOUNDS.minZ),{
    textureWidth:480,textureHeight:300,clipBias:.003,multisample:0,shader
  });
  wet.rotation.x=-Math.PI/2;
  wet.position.set((BOUNDS.minX+roadEast)/2,.012,(BOUNDS.minZ+BOUNDS.maxZ)/2);
  wet.material.transparent=true;wet.material.depthWrite=false;
  scene.add(wet);
  return wet;
}

export function addGulls(scene) {
  const count=9,vertices=new Float32Array(count*18);
  const geom=new T.BufferGeometry();
  const attr=new T.BufferAttribute(vertices,3).setUsage(T.DynamicDrawUsage);
  geom.setAttribute('position',attr);
  const birds=new T.Mesh(geom,new T.MeshBasicMaterial({color:0x666464,side:T.DoubleSide}));
  birds.frustumCulled=false;scene.add(birds);
  return function updateGulls(t){
    for(let i=0;i<count;i++){
      const angle=t*.08+i*.49,x=35+i*2.3+Math.cos(angle)*13;
      const z=-107+i*3.3+Math.sin(angle)*13,y=13+i*.53+Math.sin(t*.5+i)*.55;
      const flap=Math.sin(t*3.4+i)*.20,span=.63;
      const sideX=Math.cos(angle),sideZ=Math.sin(angle);
      const coords=[x,y,z,x+sideX*span,y+flap,z+sideZ*span,x+sideZ*.28,y-.04,z-sideX*.28,
        x,y,z,x+sideZ*.28,y-.04,z-sideX*.28,x-sideX*span,y+flap,z-sideZ*span];
      vertices.set(coords,i*18);
    }
    attr.needsUpdate=true;
  };
}
