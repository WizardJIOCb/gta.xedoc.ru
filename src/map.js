export const CANAL_BANK = -278, OPPOSITE_BANK = -307, PORT_FENCE = -435;
export const CANAL_ROAD = -321, CANAL_BRIDGES = [-160,96], TOWPATH_WALL = -343;
export const BRIDGE_START = CANAL_ROAD+4.5, BRIDGE_END = -263.3, BRIDGE_HALF_WIDTH = 5;
export function canalDeck(x){
  const t=Math.max(0,Math.min(1,(x-BRIDGE_START)/(BRIDGE_END-BRIDGE_START)));
  return .021+1.35*Math.sin(Math.PI*t)**2;
}
export function onCanalBridge(x,z,r=0){
  return x>=BRIDGE_START-r&&x<=BRIDGE_END+r&&CANAL_BRIDGES.some(at=>Math.abs(z-at)<=BRIDGE_HALF_WIDTH+r);
}
export const CITY_BOUNDS = Object.freeze({minX:CANAL_BANK,maxX:54,minZ:PORT_FENCE-.6,maxZ:170});
export const BOUNDS = Object.freeze({minX:-348,maxX:247,minZ:CITY_BOUNDS.minZ,maxZ:676});
export const AVENUES = [-256,-192,-128,-64,0];
export const CROSS_STREETS = [-416,-352,-288,-224,-160,-96,-32,32,96,160];
export const ROAD_HALF = 5.1;
const SHOULDER_HALF = 6.25;
const clamp = (n,lo,hi)=>Math.max(lo,Math.min(hi,n));
const smooth = t=>t*t*(3-2*t);

function coast(points) {
  // Two corner-cutting passes turn a surveyed outline into bays and capes.
  for(let pass=0;pass<2;pass++){
    const next=[];
    points.forEach(([x,z],i)=>{
      const [xx,zz]=points[(i+1)%points.length];
      next.push([x*.75+xx*.25,z*.75+zz*.25],[x*.25+xx*.75,z*.25+zz*.75]);
    });
    points=next;
  }
  return points;
}
function cay(x,z,rx,rz,angle,seed) {
  const pts=[];
  for(let i=0;i<18;i++){
    const a=i/18*Math.PI*2,size=1+.12*Math.sin(3*a+seed)+.09*Math.sin(5*a-seed);
    const dx=rx*Math.cos(a)*size,dz=rz*Math.sin(a)*size;
    pts.push([x+dx*Math.cos(angle)-dz*Math.sin(angle),z+dx*Math.sin(angle)+dz*Math.cos(angle)]);
  }
  return coast(pts);
}

// Land polygons double as the coastlines of the overhead navigation chart.
// Their gaps form the tidal channels; there is no hidden rectangular floor.
export const REGION_LAND=[
  coast([[-344,170],[-280,170],[-230,170],[-192,170],[-124,170],[-55,170],[0,170],[30,170],[61,170],
    [63,197],[44,220],[72,246],[65,270],[43,278],[12,250],[-12,221],[-40,232],[-68,262],
    [-100,248],[-93,215],[-124,220],[-134,260],[-169,274],[-141,289],[-112,294],[-124,317],
    [-157,325],[-183,294],[-210,286],[-218,320],[-202,349],[-222,375],[-247,345],[-251,316],
    [-275,334],[-281,379],[-314,372],[-339,322],[-350,229]]),
  cay(94,319,27,39,-.44,4),
  cay(157,406,31,52,-.32,7),
  cay(227,496,24,40,.29,9),
  cay(147,563,26,31,.68,2),
  coast([[-307,518],[-276,491],[-254,513],[-216,533],[-188,511],[-150,526],[-120,555],[-77,545],
    [-54,554],[-26,545],[7,572],[45,570],[86,585],[99,610],[63,631],[8,626],[-25,659],
    [-80,673],[-131,659],[-164,633],[-197,647],[-255,650],[-300,612],[-327,559]]),
  coast([[-257,397],[-218,384],[-189,400],[-180,432],[-166,447],[-164,475],[-186,481],[-204,505],
    [-230,507],[-265,473],[-276,436]]),
  cay(-131,380,37,19,-.42,3),cay(-70,454,42,15,.23,6),
  cay(-21,326,25,12,-.24,4),cay(-41,391,28,18,-.83,9),cay(-307,441,19,36,.19,1),
  cay(-100,308,15,8,-.64,2),cay(46,402,14,9,.26,2),cay(62,500,20,11,-.26,6),
  cay(218,352,11,21,.36,7),cay(214,579,15,11,-.2,5)
];
const landIndex=REGION_LAND.map(points=>{
  const xs=points.map(p=>p[0]),zs=points.map(p=>p[1]);
  return {points,minX:Math.min(...xs),maxX:Math.max(...xs),minZ:Math.min(...zs),maxZ:Math.max(...zs)};
});
export function landIndexAt(x,z) {
  return landIndex.findIndex(poly=>{
    if(x<poly.minX||x>poly.maxX||z<poly.minZ||z>poly.maxZ)return false;
    let inside=false;
    for(let i=0,j=poly.points.length-1;i<poly.points.length;j=i++){
      const [a,b]=poly.points[i],[c,d]=poly.points[j];
      if((b>z)!==(d>z)&&x<(c-a)*(z-b)/(d-b)+a)inside=!inside;
    }
    return inside;
  });
}

const routeGuide=[[0,160],[0,180],[9,205],[24,232],[52,263],[77,288],[94,319],
  [111,348],[132,375],[150,408],[170,450],[183,491],[174,524],[150,563],[113,586],[65,605],
  [24,605],[-25,590],[-84,578],[-132,574],[-164,551],[-187,526],[-209,491],[-218,460],
  [-224,425],[-223,395],[-232,362],[-239,325],[-235,301],[-216,270],[-197,229],[-191,191],[-192,160]];
function smoothRoad(guide){
  const road=[];
  for(let i=0;i<guide.length-1;i++){
    const a=guide[Math.max(0,i-1)],b=guide[i],c=guide[i+1],d=guide[Math.min(i+2,guide.length-1)];
    const n=Math.ceil(Math.hypot(c[0]-b[0],c[1]-b[1])/4);
    for(let k=0;k<n;k++){
      const t=k/n;
      road.push(b.map((v,j)=>.5*(2*v+(-a[j]+c[j])*t+(2*a[j]-5*v+4*c[j]-d[j])*t*t+(-a[j]+3*v-3*c[j]+d[j])*t*t*t)));
    }
  }
  road.push(guide.at(-1).slice());
  return road;
}
export const REGION_ROADS=[smoothRoad(routeGuide)];
const route=REGION_ROADS[0], distances=[0];
for(let i=1;i<route.length;i++)distances[i]=distances[i-1]+Math.hypot(route[i][0]-route[i-1][0],route[i][1]-route[i-1][1]);
// A bridge spans each continuous gap between islands. The road grades away
// from the shoreline on both banks, with identical heights for render/physics.
export const BRIDGES=[];
for(let i=0;i<route.length;i++){
  if(route[i][1]<=170||landIndexAt(...route[i])>=0)continue;
  const first=i;
  while(i+1<route.length&&route[i+1][1]>170&&landIndexAt(...route[i+1])<0)i++;
  const lo=distances[Math.max(0,first-1)],hi=distances[Math.min(route.length-1,i+1)];
  BRIDGES.push({lo:lo-18,hi:hi+18,waterLo:lo,waterHi:hi,lift:Math.min(4.35,1.4+(hi-lo)*.035)});
}
export const ROAD_STATIONS=route.map(([x,z],i)=>{
  const a=route[Math.max(0,i-1)],b=route[Math.min(route.length-1,i+1)],dx=b[0]-a[0],dz=b[1]-a[1],q=Math.hypot(dx,dz),s=distances[i];
  const bridge=BRIDGES.find(span=>s>=span.lo&&s<=span.hi);
  const base=.031+.119*smooth(clamp((z-160)/9,0,1));
  const ramp=bridge?22+bridge.lift*7:1;
  const rise=bridge?bridge.lift*Math.min(smooth(clamp((s-bridge.lo)/ramp,0,1)),smooth(clamp((bridge.hi-s)/ramp,0,1))):0;
  return {x,z,s,y:base+rise,nx:-dz/q,nz:dx/q,bridge};
});
const roadCells=new Map();
for(let i=1;i<ROAD_STATIONS.length;i++){
  const a=ROAD_STATIONS[i-1],b=ROAD_STATIONS[i];
  for(let ix=Math.floor((Math.min(a.x,b.x)-8)/24);ix<=Math.floor((Math.max(a.x,b.x)+8)/24);ix++)
    for(let iz=Math.floor((Math.min(a.z,b.z)-8)/24);iz<=Math.floor((Math.max(a.z,b.z)+8)/24);iz++){
      const key=ix+','+iz;if(!roadCells.has(key))roadCells.set(key,[]);
      roadCells.get(key).push(i);
    }
}
export function roadSample(x,z) {
  let best=null,bestD2=Infinity;
  const candidates=roadCells.get(Math.floor(x/24)+','+Math.floor(z/24));
  if(!candidates)return null;
  for(const i of candidates) {
    const a=ROAD_STATIONS[i-1],b=ROAD_STATIONS[i],dx=b.x-a.x,dz=b.z-a.z;
    const t=clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz),0,1);
    const d2=(x-a.x-t*dx)**2+(z-a.z-t*dz)**2;
    if(d2>=bestD2)continue;
    bestD2=d2;
    best={distance:Math.sqrt(d2),height:a.y+(b.y-a.y)*t,s:a.s+(b.s-a.s)*t,bridge:a.bridge||b.bridge};
  }
  return best;
}
export function isRegionalRoad(x,z) {return (roadSample(x,z)?.distance??Infinity)<=SHOULDER_HALF;}
function onSolid(x,z) {
  if(z>=CITY_BOUNDS.minZ&&z<=CITY_BOUNDS.maxZ){
    if(x>=TOWPATH_WALL&&x<=OPPOSITE_BANK||onCanalBridge(x,z))return true;
    if(x>CITY_BOUNDS.maxX&&x<=60+1.35*Math.sin(.09*z))return true;
  }
  if(x>=CITY_BOUNDS.minX&&x<=CITY_BOUNDS.maxX&&z>=CITY_BOUNDS.minZ&&z<=CITY_BOUNDS.maxZ)return true;
  if(z<170)return false;
  const sample=roadSample(x,z);
  if(sample && sample.distance<=(sample.bridge?ROAD_HALF+.30:SHOULDER_HALF))return true;
  return landIndexAt(x,z)>=0;
}
export function isTraversable(x,z,r=0) {
  if(x-r<BOUNDS.minX||x+r>BOUNDS.maxX||z-r<BOUNDS.minZ||z+r>BOUNDS.maxZ||!onSolid(x,z))return false;
  return r<=0 || (onSolid(x-r,z)&&onSolid(x+r,z)&&onSolid(x,z-r)&&onSolid(x,z+r));
}
export function regionGroundHeight(x,z) {
  const sample=roadSample(x,z);
  if(sample && sample.distance<=(sample.bridge?ROAD_HALF+.55:SHOULDER_HALF))return sample.height;
  return z>=170 && landIndexAt(x,z)>=0?.12:0;
}
export const REGIONAL_LOTS=[
  {id:'KEYS',x:170,z:408,y:.12,yaw:Math.PI/2},
  {id:'GLADES',x:-196,z:460,y:.12,yaw:Math.PI/2},
  {id:'OUTPOST',x:-84,z:599,y:.12,yaw:0}
];
export const REGION_PLACES=[
  {id:'KEYS',name:'Pelican Keys',x:164.2,z:430.2,yaw:.45},
  {id:'GLADES',name:'Sawgrass Glades',x:-218,z:460,yaw:-2.43},
  {id:'OUTPOST',name:'Cypress Junction',x:-84,z:578,yaw:-2.19}
];
export function districtName(x,z) {
  if(z>170){
    if(x>20)return 'Pelican Keys';
    if(z>528)return 'Cypress Junction';
    return 'Sawgrass Glades';
  }
  if(z< -224)return 'Marina Keys';
  if(x< -132||z>96)return 'Little Havana';
  return x< -32?'Downtown':'Ocean Drive';
}
