// Deform only the painted shell. Running gear, cockpit and glass keep
// their original transforms. Each new run restores the source positions.
export function createBodywork(car) {
  let shell;
  car.traverse(obj=>{if(obj.isMesh && obj.material.clearcoat>0 && !obj.material.transparent)shell=obj;});
  if(!shell) return {dent(){},restore(){}};
  const geo=shell.geometry,points=geo.attributes.position,rest=points.array.slice();
  const normals=geo.attributes.normal.array.slice();
  function dent(amount,{side,front}) {
    const centerX=Math.max(-.91,Math.min(.91,side)),centerZ=Math.max(-1.94,Math.min(1.94,-front));
    const length=Math.max(.1,Math.hypot(centerX,centerZ));
    const depth=Math.min(.18,.036+amount*.005);
    for(let i=0;i<points.count;i++) {
      const x=points.getX(i),y=points.getY(i),z=points.getZ(i);
      const w=Math.exp(-((x-centerX)**2/.30+(z-centerZ)**2/.28+(y-.62)**2/.22));
      if(w<.005)continue;
      points.setXYZ(i,x-centerX/length*w*depth,y+w*depth*.23,z-centerZ/length*w*depth);
    }
    points.needsUpdate=true;geo.computeVertexNormals();
  }
  function restore() {
    points.array.set(rest);points.needsUpdate=true;
    geo.attributes.normal.array.set(normals);geo.attributes.normal.needsUpdate=true;
  }
  return {dent,restore};
}
