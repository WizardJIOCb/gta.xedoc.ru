import {MathUtils} from 'three';

// Collision envelope shared by the initial bumper strike and the falling limbs.
// Local +z is the back of the vehicle. The deck slopes up from either bumper.
export function setCarVolume(out,x,y,z,yaw,vx,vz,open=false) {
  Object.assign(out,{x,y,z,vx,vz,open,sin:Math.sin(yaw),cos:Math.cos(yaw)});
  return out;
}
export function carContact(volume,p,r,out) {
  const dx=p.x-volume.x,dz=p.z-volume.z;
  const side=dx*volume.cos-dz*volume.sin,along=dx*volume.sin+dz*volume.cos;
  const roundSide=MathUtils.clamp(side/.94,-1,1);
  const bevel=MathUtils.clamp(p.y-volume.y-.25,0,.50);
  const depth=2.19+r-Math.abs(along)-.20*roundSide*roundSide-.38*bevel;
  const corner=MathUtils.smoothstep(Math.abs(along),1.65,2.25);
  const width=.94-.14*corner+r-Math.abs(side);
  if(width<=0||depth<=0)return false;
  const cabin=1-MathUtils.smoothstep(Math.abs(along-.06),.50,1.12);
  const top=volume.y+.84-.22*corner+(volume.open?.15:.43)*cabin;
  const height=top+r-p.y;
  if(height<=0 || p.y+r<volume.y+.14)return false;
  if(height<Math.min(width,depth)){
    out.set(0,height,0);
  }else if(width<depth){
    const a=width*(side<0?-1:1);
    out.set(volume.cos*a,0,-volume.sin*a);
  }else{
    const lateral=.40*roundSide/.94,vertical=bevel>0&&bevel<.50?.38:0,axial=along<0?-1:1;
    out.set(lateral*volume.cos+axial*volume.sin,vertical,axial*volume.cos-lateral*volume.sin)
      .multiplyScalar(depth/(1+lateral*lateral+vertical*vertical));
  }
  return true;
}
