import {isTraversable} from './map.js';

// Bucket static footprints once. A probe checks only nearby blocks, even while
// a sliding chassis needs several contact queries in the same simulation tick.
export function createContactQuery(blocks,cars) {
  const cells=new Map(),cell=n=>Math.floor(n/16);
  for(const b of blocks){
    for(let ix=cell(b.x-b.w/2);ix<=cell(b.x+b.w/2);ix++){
      for(let iz=cell(b.z-b.d/2);iz<=cell(b.z+b.d/2);iz++){
        const key=ix+','+iz;
        if(!cells.has(key))cells.set(key,[]);
        cells.get(key).push(b);
      }
    }
  }
  return function hit(x,z,r,out,ignoreCar=null){
    let best=-1;
    function box(dx,dz,w,d,cs,sn,target=null,block=null) {
      // Local X is right, local Z is rearward. Closest-point normals are
      // radial at a corner, and follow the nearest face inside a footprint.
      const lx=dx*cs-dz*sn,lz=dx*sn+dz*cs;
      if(Math.abs(lx)>=w+r||Math.abs(lz)>=d+r)return false;
      let nx=lx-Math.max(-w,Math.min(w,lx)),nz=lz-Math.max(-d,Math.min(d,lz));
      const distance=Math.hypot(nx,nz);
      if(distance>=r)return false;
      let depth=r-distance;
      if(!out)return true;
      if(distance>1e-7){nx/=distance;nz/=distance;}
      else if(w-Math.abs(lx)<d-Math.abs(lz)){nx=lx>=0?1:-1;nz=0;depth=r+w-Math.abs(lx);}
      else{nx=0;nz=lz>=0?1:-1;depth=r+d-Math.abs(lz);}
      if(depth>best){
        best=depth;out.nx=nx*cs+nz*sn;out.nz=-nx*sn+nz*cs;out.depth=depth;
        out.target=target;out.block=block;
        const heading=target?.response?.pathYaw??target?.model.mesh.rotation.y??0;
        const speed=target?.speed||0;
        out.vx=-Math.sin(heading)*speed;out.vz=-Math.cos(heading)*speed;
      }
      return true;
    }
    for(let ix=cell(x-r);ix<=cell(x+r);ix++)for(let iz=cell(z-r);iz<=cell(z+r);iz++){
      const list=cells.get(ix+','+iz);
      if(list)for(const b of list){
        if(b.breakable?.broken)continue;
        if(box(x-b.x,z-b.z,b.w/2,b.d/2,1,0,null,b)&&!out)return true;
      }
    }
    for(const car of cars){
      if(car===ignoreCar)continue;
      const mesh=car.model.mesh,dx=x-mesh.position.x,dz=z-mesh.position.z;
      if(Math.abs(dx)>2.2+r||Math.abs(dz)>2.2+r)continue;
      const yaw=mesh.rotation.y;
      if(box(dx,dz,.85,1.85,Math.cos(yaw),Math.sin(yaw),car)&&!out)return true;
    }
    return best>=0||!isTraversable(x,z,r);
  };
}
