const clamp = (x,min,max) => Math.max(min,Math.min(max,x));
export function resetVehicle(v) {
  Object.assign(v,{x:5.4,z:66,yaw:0,speed:0,steer:0,vx:0,vz:0,damage:0,impactDelay:0});
}
// A bicycle steering model with a separately damped velocity vector allows
// the rear axle to slip under the handbrake and regain grip progressively.
export function drive(v, input, dt, hitTest, onImpact) {
  const handbrake=input.handbrake, abs=Math.abs(v.speed);
  const sand=v.x>18 && Math.abs(v.z+160)>7;
  const steerTarget=input.turn*(0.56/(1+abs*0.037));
  v.steer+=(steerTarget-v.steer)*(1-Math.exp(-6.5*dt));
  let acceleration=0;
  if (input.gas) acceleration+=v.speed < -0.3 ? 17 : 9.3/(1+abs*0.033);
  if (input.brake) acceleration-=v.speed > 0.3 ? 17.5 : 4.8;
  if (Math.abs(acceleration)<0.01 || handbrake || sand) {
    const resistance=1.1+(handbrake?8.2:0)+(sand?4.0:0);
    v.speed=Math.sign(v.speed)*Math.max(0,abs-resistance*dt);
  }
  v.speed=clamp(v.speed+(acceleration-0.0048*v.speed*Math.abs(v.speed))*dt,-7,sand?13:34);
  v.yaw+=v.speed*Math.tan(v.steer)*dt/(handbrake?2.25:2.85);
  const grip=1-Math.exp(-(handbrake?2.2:sand?4.5:8.5)*dt);
  v.vx+=(-Math.sin(v.yaw)*v.speed-v.vx)*grip;
  v.vz+=(-Math.cos(v.yaw)*v.speed-v.vz)*grip;
  const nextX=v.x+v.vx*dt, nextZ=v.z+v.vz*dt;
  const sin=Math.sin(v.yaw),cos=Math.cos(v.yaw);
  const blocked=[-1.24,0,1.24].some(end=>hitTest(nextX-sin*end,nextZ-cos*end,.88));
  v.impactDelay=Math.max(0,v.impactDelay-dt);
  if (blocked) {
    if (abs>2.5 && !v.impactDelay) {
      const damage=Math.min(100-v.damage,Math.max(1,Math.round((abs-2)*1.6)));
      v.damage=Math.min(100,v.damage+damage);onImpact(damage);v.impactDelay=1.0;
    }
    // Undo the part of this step that would rotate the chassis into the wall.
    v.yaw-=v.speed*Math.tan(v.steer)*dt/(handbrake?2.25:2.85);
    v.speed*=-.16;v.vx=0;v.vz=0;
  } else {v.x=nextX;v.z=nextZ;}
}
