import {AVENUES,CROSS_STREETS,BOUNDS,CITY_BOUNDS,REGION_ROADS,REGION_LAND,REGION_PLACES} from './map.js';

const grid=[];
for(let i=0;i<AVENUES.length;i++)for(let j=0;j<CROSS_STREETS.length;j++){
  const x=AVENUES[i],z=CROSS_STREETS[j];
  if(i)grid.push([[x,z],[AVENUES[i-1],z]]);
  if(j)grid.push([[x,z],[x,CROSS_STREETS[j-1]]]);
}
const pier=[[0,-160],[38,-160]];
const paths=[...grid,pier,...REGION_ROADS];
const nodes=[],vertices=new Map(),edges=[];
function node(x,z){
  const key=x+','+z;
  if(!vertices.has(key)){vertices.set(key,nodes.length);nodes.push({x,z,links:[]});}
  return vertices.get(key);
}
for(const road of paths)for(let i=1;i<road.length;i++){
  const [ax,az]=road[i-1],[bx,bz]=road[i],dx=bx-ax,dz=bz-az;
  const a=node(ax,az),b=node(bx,bz),length=Math.hypot(dx,dz);
  if(!length)continue;
  nodes[a].links.push([b,length]);nodes[b].links.push([a,length]);
  edges.push({a,b,ax,az,dx,dz,length});
}
function project(x,z){
  let best=Infinity,result;
  for(const e of edges){
    const t=Math.max(0,Math.min(1,((x-e.ax)*e.dx+(z-e.az)*e.dz)/(e.length*e.length)));
    const px=e.ax+e.dx*t,pz=e.az+e.dz*t,delta=(x-px)**2+(z-pz)**2;
    if(delta<best){best=delta;result={edge:e,t,xy:[px,pz]};}
  }
  return result;
}
export function roadRoute(x,z,tx,tz){
  const start=project(x,z),end=project(tx,tz);
  if(start.edge===end.edge)return [[x,z],start.xy,end.xy,[tx,tz]];
  const previous=new Int32Array(nodes.length).fill(-1),visited=new Uint8Array(nodes.length);
  const distances=new Float64Array(nodes.length).fill(Infinity);
  distances[start.edge.a]=start.t*start.edge.length;distances[start.edge.b]=(1-start.t)*start.edge.length;
  for(;;){
    let current=-1,shortest=Infinity;
    for(let n=0;n<nodes.length;n++)if(!visited[n]&&distances[n]<shortest){shortest=distances[n];current=n;}
    if(current<0)break;
    visited[current]=1;
    if(visited[end.edge.a]&&visited[end.edge.b])break;
    for(const [n,cost] of nodes[current].links){
      if(shortest+cost<distances[n]){distances[n]=shortest+cost;previous[n]=current;}
    }
  }
  const a=distances[end.edge.a]+end.t*end.edge.length,b=distances[end.edge.b]+(1-end.t)*end.edge.length;
  if(!Number.isFinite(Math.min(a,b)))return [[x,z],start.xy];
  const via=[];
  for(let n=a<b?end.edge.a:end.edge.b;n>=0;n=previous[n])via.push([nodes[n].x,nodes[n].z]);
  return [[x,z],start.xy,...via.reverse(),end.xy,[tx,tz]];
}

export const destinations=[{id:'mission',name:'Мастерская',x:38,z:-160},...REGION_PLACES,
  {id:'HAVANA',name:'Little Havana',x:-190,z:12},{id:'MARINA',name:'Marina Keys',x:3,z:-332}];

export function drawCoastMap(canvas,s,overview=false){
  const r=canvas.getBoundingClientRect(),w=Math.round(r.width),h=Math.round(r.height);
  if(!w||!h)return;
  const ratio=Math.min(devicePixelRatio,2),width=Math.round(w*ratio),height=Math.round(h*ratio);
  if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
  const ctx=canvas.getContext('2d');
  const scale=overview?Math.min((w-38)/(BOUNDS.maxX-BOUNDS.minX),(h-30)/(BOUNDS.maxZ-BOUNDS.minZ)):w/180;
  const cx=overview?(BOUNDS.minX+BOUNDS.maxX)/2:s.x,cz=overview?(BOUNDS.minZ+BOUNDS.maxZ)/2:s.z;
  const px=x=>w*(overview?.5:.47)+(x-cx)*scale,py=z=>h*(overview?.5:.65)+(z-cz)*scale;
  ctx.setTransform(ratio,0,0,ratio,0,0);ctx.fillStyle='#30525d';ctx.fillRect(0,0,w,h);
  function shape(points,fill,color,weight) {
    if(!points.length)return;
    ctx.beginPath();points.forEach(([x,z],i)=>{if(i)ctx.lineTo(px(x),py(z));else ctx.moveTo(px(x),py(z));});
    if(fill){ctx.closePath();ctx.fillStyle=fill;ctx.fill();}
    if(color){ctx.lineWidth=weight;ctx.strokeStyle=color;ctx.stroke();}
  }
  function rect(x,z,ww,hh,fill){ctx.fillStyle=fill;ctx.fillRect(px(x),py(z),ww*scale,hh*scale);}
  ctx.lineJoin=ctx.lineCap='round';
  if(overview)for(const polygon of REGION_LAND){
    shape([...polygon,polygon[0]],null,'#396269',Math.max(3,21*scale));
    shape([...polygon,polygon[0]],null,'#48736e',Math.max(2,9*scale));
  }
  rect(CITY_BOUNDS.minX,CITY_BOUNDS.minZ,CITY_BOUNDS.maxX-CITY_BOUNDS.minX,CITY_BOUNDS.maxZ-CITY_BOUNDS.minZ,'#424f49');
  rect(17,CITY_BOUNDS.minZ,37,CITY_BOUNDS.maxZ-CITY_BOUNDS.minZ,'#9e9477');
  for(const polygon of REGION_LAND)shape(polygon,'#586953','#798975',overview?.8:1.2);
  for(let z=-400;z< -228;z+=32){rect(47,z-1,26,2,'#b2aa90');rect(72,z-1,1.5,14,'#b2aa90');}
  for(const x of AVENUES.slice(0,-1))for(const z of CROSS_STREETS.slice(0,-1)){
    if(!overview&&(Math.abs(x-cx)>200||Math.abs(z-cz)>170))continue;
    rect(x+9,z+10,20,16,'#5b675b');rect(x+33,z+9,18,28,'#53605a');rect(x+11,z+37,40,15,'#616b5e');
  }
  ctx.lineJoin=ctx.lineCap='round';
  for(const road of [...grid,pier])shape(road,null,'#acafa0',Math.max(1.2,4.6*scale));
  for(const road of REGION_ROADS){shape(road,null,'#253d40',Math.max(3,10*scale));shape(road,null,'#e1cba8',Math.max(1.5,5.2*scale));}
  const path=s.route||[];
  if(path.length){shape(path,null,'#67373c',overview?4.2:4.8);shape(path,null,'#ff9e83',overview?2.4:2.8);}
  for(const place of destinations){
    const x=px(place.x),y=py(place.z);
    if(x<3||x>w-3||y<3||y>h-3)continue;
    ctx.fillStyle='#f5d4a6';ctx.fillRect(x-2,y-2,4,4);
    if(overview){
      ctx.font='600 11px Segoe UI,sans-serif';ctx.textAlign=x>w*.68?'right':'left';
      ctx.lineWidth=3;ctx.strokeStyle='#29393d';const lx=x+(ctx.textAlign==='right'?-7:7);
      ctx.strokeText(place.name,lx,y-4);ctx.fillStyle='#f2ecdb';ctx.fillText(place.name,lx,y-4);
    }
  }
  if(path.length){
    const [x,z]=path.at(-1);ctx.save();ctx.translate(Math.max(7,Math.min(w-7,px(x))),Math.max(7,Math.min(h-7,py(z))));
    ctx.rotate(Math.PI/4);ctx.fillStyle='#ffa087';ctx.fillRect(-3.5,-3.5,7,7);ctx.restore();
  }
  ctx.save();ctx.translate(px(s.x),py(s.z));ctx.rotate(-s.yaw);ctx.beginPath();
  ctx.moveTo(0,-7);ctx.lineTo(5.5,5.7);ctx.lineTo(0,3);ctx.lineTo(-5.5,5.7);ctx.closePath();
  ctx.strokeStyle='#203438';ctx.lineWidth=2.3;ctx.stroke();ctx.fillStyle='#fcf4de';ctx.fill();ctx.restore();
}

export function createAtlas(onToggle,onDestination){
  const dialog=document.createElement('dialog');dialog.className='pc-console pc-atlas';
  dialog.setAttribute('aria-label','Карта побережья');
  dialog.innerHTML='<header><div><small>PALM COAST</small><h2>Карта побережья</h2></div><button aria-label="Закрыть карту">×</button></header><div class="pc-atlas-body"><canvas aria-label="Дороги и острова"></canvas><nav aria-label="Куда проложить маршрут"><b>Маршрут</b></nav></div>';
  const nav=dialog.querySelector('nav'),canvas=dialog.querySelector('canvas');
  for(const d of destinations){
    const button=document.createElement('button');button.type='button';button.textContent=d.name;
    button.onclick=()=>{onDestination(d);dialog.close();};nav.append(button);
  }
  dialog.addEventListener('keydown',e=>{
    if(e.key!=='ArrowUp'&&e.key!=='ArrowDown')return;
    e.preventDefault();
    const buttons=[...nav.querySelectorAll('button')],i=buttons.indexOf(document.activeElement);
    const next=i<0?0:(i+(e.key==='ArrowUp'?-1:1)+buttons.length)%buttons.length;
    buttons[next].focus();
  });
  document.body.append(dialog);dialog.querySelector('header button').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>onToggle(false));
  let latest;
  new ResizeObserver(()=>{if(dialog.open&&latest)drawCoastMap(canvas,latest,true);}).observe(canvas);
  return {toggle(state){
    if(dialog.open){dialog.close();return;}
    latest=state;onToggle(true);dialog.showModal();drawCoastMap(canvas,state,true);
  }};
}
