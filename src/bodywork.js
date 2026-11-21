// Deform only the painted shell. Running gear, cockpit and glass keep
// their original transforms. Each new run restores the source positions.
export function createBodywork(car) {
  let shell;
  car.traverse(obj=>{if(obj.isMesh && obj.material.clearcoat>0 && !obj.material.transparent)shell=obj;});
  if(!shell) return {dent(){},restore(){}};
  const geo=shell.geometry,points=geo.attributes.position,rest=points.array.slice();
  const normals=geo.attributes.normal.array.slice();
  function dent(amount,speed,side) {
    const end=speed>=0?-1:1,centerX=side*.58,centerZ=end*1.85;
    const depth=Math.min(.18,.036+amount*.005);
    for(let i=0;i<points.count;i++) {
      const x=points.getX(i),y=points.getY(i),z=points.getZ(i);
      const w=Math.exp(-((x-centerX)**2/.30+(z-centerZ)**2/.28+(y-.62)**2/.22));
      if(w<.005)continue;
      points.setXYZ(i,x-side*w*depth*.3,y+w*depth*.28,z-end*w*depth);
    }
    points.needsUpdate=true;geo.computeVertexNormals();
  }
  function restore() {
    points.array.set(rest);points.needsUpdate=true;
    geo.attributes.normal.array.set(normals);geo.attributes.normal.needsUpdate=true;
  }
  return {dent,restore};
}
