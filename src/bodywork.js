const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));

// All panel vertices are in the same chassis space, so a seam, light or
// plate follows the sheet metal below it. Pristine cars need no backup.
export function createBodywork(panels){
  let original;
  function dent({side,front,speed,inwardX,inwardZ}){
    if(speed<=2.5)return;
    original??=panels.map(({geometry:g})=>({
      positions:g.attributes.position.array.slice(),normals:g.attributes.normal.array.slice()
    }));
    const cx=clamp(side,-.96,.96),cz=clamp(-front,-2.14,2.14);
    const ix=inwardX??-cx,iz=inwardZ??-cz,len=Math.hypot(ix,iz)||1;
    const dx=ix/len,dz=iz/len;
    const depth=clamp((speed-2.5)*.022,.018,.43);
    const width=.38+depth*1.25,along=.42+depth*1.18;
    panels.forEach(({geometry:g},panel)=>{
      const {position,normal}=g.attributes,{positions:rest}=original[panel];
      let changed=false;
      for(let i=0;i<position.count;i++){
        const k=i*3,x=rest[k]-cx,z=rest[k+2]-cz,y=rest[k+1]-.56;
        if(Math.abs(x)>2.1||Math.abs(z)>2.1||Math.abs(y)>.78)continue;
        const across=(x*dz-z*dx)/width,inside=(x*dx+z*dz)/along;
        const falloff=Math.exp(-1.55*across*across-inside*inside-y*y/.115);
        if(falloff<.006)continue;
        const w=depth*falloff;
        const wear=g.attributes.wear;
        if(wear)wear.setX(i,Math.min(1,wear.getX(i)+w*(1.8+Math.abs(across)*1.2)));
        // A compressed hood or trunk buckles upwards behind the contact patch.
        const fold=.15+.45*Math.sin(inside*3.6)*Math.abs(dz);
        const a=position.array;
        const ox=a[k]-rest[k]+dx*w,oy=a[k+1]-rest[k+1]+fold*w,oz=a[k+2]-rest[k+2]+dz*w;
        const limit=Math.min(1,.55/Math.max(.001,Math.hypot(ox,oy,oz)));
        position.setXYZ(i,rest[k]+ox*limit,rest[k+1]+oy*limit,rest[k+2]+oz*limit);
        // An inverse-transpose approximation to the compression preserves the
        // original smooth shading across duplicate vertices on shell seams.
        const gx=w*(-3.1*across*dz/width-2*inside*dx/along);
        const gz=w*(3.1*across*dx/width-2*inside*dz/along),gy=-2*y*w/.115;
        const nx=normal.getX(i),ny=normal.getY(i),nz=normal.getZ(i);
        const n=(nx*dx+ny*fold+nz*dz)/Math.max(.42,1+gx*dx+gy*fold+gz*dz)*limit;
        const xx=nx-n*gx,yy=ny-n*gy,zz=nz-n*gz,l=Math.hypot(xx,yy,zz)||1;
        normal.setXYZ(i,xx/l,yy/l,zz/l);changed=true;
      }
      if(changed){position.needsUpdate=true;normal.needsUpdate=true;if(g.attributes.wear)g.attributes.wear.needsUpdate=true;g.computeBoundingSphere();}
    });
  }
  function restore(){
    if(!original)return;
    panels.forEach(({geometry:g},i)=>{
      const {position,normal}=g.attributes;
      position.array.set(original[i].positions);normal.array.set(original[i].normals);
      if(g.attributes.wear){g.attributes.wear.array.fill(0);g.attributes.wear.needsUpdate=true;}
      position.needsUpdate=true;normal.needsUpdate=true;g.computeBoundingSphere();
    });
    original=null;
  }
  return {dent,restore};
}
