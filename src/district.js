import * as T from 'three';
import { createCar, createPerson } from './vehicles.js';

// Offset loops keep traffic in its own lane through each rounded corner.
function loop(points) {
  const shape = new T.CurvePath();
  const corners = points.map(([x,z], i) => {
    const at = new T.Vector3(x,0,z);
    function inset(j) {
      const p = points[(j + points.length) % points.length];
      return new T.Vector3(p[0]-x,0,p[1]-z).normalize().multiplyScalar(5).add(at);
    }
    return {at, enter:inset(i-1), exit:inset(i+1)};
  });
  corners.forEach((c,i) => {
    shape.add(new T.QuadraticBezierCurve3(c.enter,c.at,c.exit));
    shape.add(new T.LineCurve3(c.exit,corners[(i+1)%corners.length].enter));
  });
  return shape;
}

export function createDistrict(scene) {
  const routes = [
    loop([[3,-163],[-67,-163],[-67,99],[3,99]]),
    loop([[-3,93],[-61,93],[-61,-221],[-3,-221]]),
    loop([[-125,-35],[-67,-35],[-67,-157],[-125,-157]])
  ];
  const cars = [0x3c6168,0xd4bd8d,0x475565,0x9b655c,0xd3d5ca,0x857c73].map((color,i) => {
    const model = createCar({color});
    const path = routes[i % routes.length], length = path.getLength();
    scene.add(model.mesh);
    return {model,path,length,offset:[.66,.94,.5,.30,.68,.92][i]*length,pace:6.4+i*0.47};
  });
  const pedestrians = [
    [-9.6,78,-1],[11.7,70,1],[-10.3,46,1],[11.2,1,-1],
    [-10.7,-67,-1],[12.2,-102,1],[-10,-137,1],[13,-194,1]
  ].map(([x,z,dir],i) => {
    const model = createPerson({color:[0xc88861,0x1c6577,0xd6c8a2,0xa75d63,0x7a9488][i%5]});
    model.mesh.position.set(x,0.16,z);
    scene.add(model.mesh);
    return {model,origin:z,dir,pace:0.65+i%3*.13};
  });
  function update(dt, player, driving) {
    for (const car of cars) {
      const p = car.model.mesh.position, h = car.model.mesh.rotation.y;
      const dx=player.x-p.x, dz=player.z-p.z;
      const forward=-dx*Math.sin(h)-dz*Math.cos(h);
      const yieldToPlayer = forward > -0.3 && forward < (driving?8:6) &&
        Math.abs(dx*Math.cos(h)-dz*Math.sin(h)) < 2.1;
      const speed = yieldToPlayer ? 0 : car.pace;
      car.offset = (car.offset + speed*dt)%car.length;
      const t=car.offset/car.length;
      car.path.getPoint(t,p);
      const ahead=car.path.getPoint(((car.offset+0.4)%car.length)/car.length);
      car.model.mesh.rotation.y=Math.atan2(p.x-ahead.x,p.z-ahead.z);
      car.model.update(dt,speed,0,yieldToPlayer);
    }
    for (const ped of pedestrians) {
      const obj=ped.model.mesh;
      const waiting=obj.position.distanceToSquared(player)<9;
      if (!waiting) {
        obj.position.z+=dt*ped.dir*ped.pace;
        if (Math.abs(obj.position.z-ped.origin)>8) ped.dir=-Math.sign(obj.position.z-ped.origin);
      }
      obj.rotation.y=ped.dir>0?Math.PI:0;
      ped.model.update(dt,!waiting);
    }
  }
  const parked=[[-5.6,56,0xb37446],[-5.7,48,0x638382],[-5.65,-8,0xc7bda9],
    [-5.65,-66,0x492a2d],[-5.7,-122,0x394b55]].map(([x,z,color])=>{
    const model=createCar({color});
    model.mesh.position.set(x,.015,z);model.mesh.rotation.y=Math.PI;
    scene.add(model.mesh);
    return {model};
  });
  return {cars:[...cars,...parked],pedestrians,update};
}
