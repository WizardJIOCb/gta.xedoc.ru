const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));

// A traffic vehicle retains its driver's route while the chassis can translate
// and yaw around it after a collision. Impulses use the player's mass as a unit.
export const TRAFFIC_INV_MASS=.82;
export const TRAFFIC_INV_INERTIA=TRAFFIC_INV_MASS/2.45;

// Three overlapping circles cover the car. cityHit includes the map boundary,
// obstacles and the other traffic cars, and skips the car being tested.
export function trafficFootprintClear(x,z,yaw,car,cityHit,player,driving,playerYaw,pedestrians) {
  const sin=Math.sin(yaw),cos=Math.cos(yaw);
  const heroSin=Math.sin(playerYaw),heroCos=Math.cos(playerYaw);
  for(const end of [-1.21,0,1.25]){
    const px=x-end*sin,pz=z-end*cos;
    if(cityHit(px,pz,.86,null,car))return false;
    const dx=px-player.x,dz=pz-player.z;
    if(driving){
      const sx=Math.max(0,Math.abs(dx*heroCos-dz*heroSin)-.83);
      const sz=Math.max(0,Math.abs(dx*heroSin+dz*heroCos)-1.84);
      if(sx*sx+sz*sz<.86*.86)return false;
    }else if(dx*dx+dz*dz<1.11*1.11)return false;
    for(const ped of pedestrians){
      const pos=ped.rag?.center || ped.model.mesh.position;
      if((px-pos.x)**2+(pz-pos.z)**2<1.09*1.09)return false;
    }
  }
  return true;
}

export class TrafficResponse {
  constructor(){this.reset();}
  reset(){
    Object.assign(this,{dx:0,dz:0,angle:0,vx:0,vz:0,yawRate:0,active:false,blocked:false,
      pathYaw:0,lastX:NaN,lastZ:NaN,lastYaw:0,wheelSpeed:0,worldVX:0,worldVZ:0});
  }
  kick(ix,iz,rx,rz){
    this.vx+=ix*TRAFFIC_INV_MASS;this.vz+=iz*TRAFFIC_INV_MASS;
    this.yawRate=clamp(this.yawRate+(rz*ix-rx*iz)*TRAFFIC_INV_INERTIA,-2.2,2.2);
    const speed=Math.hypot(this.vx,this.vz);
    if(speed>9){this.vx*=9/speed;this.vz*=9/speed;}
    this.active=true;
  }
  pose(dt,p,heading,routeSpeed,canOccupy){
    const pathX=p.x,pathZ=p.z;
    this.pathYaw=heading;this.blocked=false;
    let yaw=heading;
    if(this.active&&dt>0&&Number.isFinite(this.lastX)){
      this.vx+=(-3.8*this.dx-2.65*this.vx)*dt;
      this.vz+=(-3.8*this.dz-2.65*this.vz)*dt;
      this.yawRate+=(-8*this.angle-3.7*this.yawRate)*dt;
      let dx=this.dx+this.vx*dt,dz=this.dz+this.vz*dt;
      const distance=Math.hypot(dx,dz);
      if(distance>3.1){dx*=3.1/distance;dz*=3.1/distance;}
      this.angle=clamp(this.angle+this.yawRate*dt,-.52,.52);
      const wantX=pathX+dx,wantZ=pathZ+dz;
      yaw+=this.angle;
      if(canOccupy(wantX,wantZ,yaw)){
        p.x=wantX;p.z=wantZ;
      }else{
        // Keep the last valid footprint or slide along an unobstructed axis.
        // The caller yields route progress while something physically blocks it.
        this.blocked=true;yaw=this.lastYaw;this.yawRate=0;
        p.x=this.lastX;p.z=this.lastZ;
        if(canOccupy(wantX,p.z,yaw))p.x=wantX;else this.vx=0;
        if(canOccupy(p.x,wantZ,yaw))p.z=wantZ;else this.vz=0;
        this.angle=Math.atan2(Math.sin(yaw-heading),Math.cos(yaw-heading));
      }
      this.dx=p.x-pathX;this.dz=p.z-pathZ;
      if(!this.blocked && Math.hypot(this.dx,this.dz)<.008 && Math.hypot(this.vx,this.vz)<.018 &&
          Math.abs(this.angle)<.003 && Math.abs(this.yawRate)<.008){
        this.dx=this.dz=this.angle=this.vx=this.vz=this.yawRate=0;
        this.active=false;p.x=pathX;p.z=pathZ;yaw=heading;
      }
    }
    if(dt>0&&Number.isFinite(this.lastX)){
      this.worldVX=(p.x-this.lastX)/dt;this.worldVZ=(p.z-this.lastZ)/dt;
      this.wheelSpeed=-this.worldVX*Math.sin(yaw)-this.worldVZ*Math.cos(yaw);
    }else{
      this.worldVX=-Math.sin(heading)*routeSpeed;this.worldVZ=-Math.cos(heading)*routeSpeed;this.wheelSpeed=routeSpeed;
    }
    this.lastX=p.x;this.lastZ=p.z;this.lastYaw=yaw;
    return yaw;
  }
}
