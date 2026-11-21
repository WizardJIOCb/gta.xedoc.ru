import * as T from 'three';

const signs=[
  ['#cfad76','#273d3e','LAST CAST','BAIT  /  ICE  /  TACKLE'],
  ['#214d56','#f7d798','PELICAN MARINE','BOAT REPAIR     •     FUEL DOCK'],
  ['#3d5140','#efe5b9','WET PRAIRIE','FIELD STATION  07'],
  ['#df8052','#263d43','GAS  ·  OIL','MARINA SERVICE']
];

function lettering(){
  const sheet=document.createElement('canvas');sheet.width=1024;sheet.height=512;
  const g=sheet.getContext('2d');
  signs.forEach(([background,ink,title,small],i)=>{
    const x=(i%2)*512,y=Math.floor(i/2)*256;
    g.save();g.translate(x,y);g.fillStyle=background;g.fillRect(0,0,512,256);
    g.strokeStyle=ink;g.lineWidth=3;g.strokeRect(14,13,484,230);
    g.beginPath();g.moveTo(35,179);g.lineTo(477,179);g.stroke();
    g.fillStyle=ink;g.textAlign='center';g.textBaseline='middle';
    g.font=i===2?'bold 53px Georgia':'bold 62px Arial';g.fillText(title,256,111,449);
    g.font='bold 18px Arial';g.fillText(small,256,206,445);
    g.beginPath();g.moveTo(224,43);g.lineTo(252,34);g.lineTo(283,43);g.lineTo(252,40);g.closePath();g.fill();
    // Worn enamel with paint loss concentrated at the edges.
    for(let n=0;n<160;n++){
      const tx=(n*239+53)%510,ty=n%4<2?(n*7)%10:248+(n*3)%8;
      g.fillStyle=n%2?'#9d8871':'#a88e76';g.fillRect(tx,ty,1+n%11,1+n%4);
    }
    g.restore();
  });
  const map=new T.CanvasTexture(sheet);map.colorSpace=T.SRGBColorSpace;map.anisotropy=4;
  return new T.MeshStandardMaterial({map,roughness:.78,metalness:.11});
}

// Positions are small site-local coordinates. Bake the site transform into
// each instance so a whole region reuses the world's existing draw batches.
function site(b,m,blocks,p,atlas){
  const yaw=p.yaw||0,h=p.y||0,c=Math.cos(yaw),s=Math.sin(yaw);
  const heading=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),yaw);
  const rotate=(x,y,z)=>[p.x+c*x+s*z,h+y,p.z-s*x+c*z];
  function part(type,mat,x,y,z,w,hh,d,col,rx=0,ry=0,rz=0){
    const q=heading.clone().multiply(new T.Quaternion().setFromEuler(new T.Euler(rx,ry,rz)));
    b.instance(type,mat,rotate(x,y,z),[w,hh,d],col,undefined,q);
  }
  function box(mat,x,y,z,w,hh,d,col,rot=0){b.box(mat,...rotate(x,y,z),w,hh,d,col,yaw+rot);}
  function bar(a,e,r,col,mat=m.chrome){b.rod(mat,rotate(...a),rotate(...e),r,col);}
  function quad(coords,col,mat=m.fabric,uv){b.quad(mat,coords.map(a=>rotate(...a)),uv,col);}
  function solid(x,z,w,d){
    const [wx,,wz]=rotate(x,0,z);
    blocks.push({x:wx,z:wz,w:Math.abs(c)*w+Math.abs(s)*d,d:Math.abs(s)*w+Math.abs(c)*d});
  }
  function loose(kind,x,z,w,d,build){
    const [wx,,wz]=rotate(x,0,z);
    return b.breakable(kind,wx,wz,Math.abs(c)*w+Math.abs(s)*d,Math.abs(s)*w+Math.abs(c)*d,build);
  }
  function sign(id,x,cy,z,w,hh){
    box(m.trim,x,cy,z,w+.09,hh+.09,.10,'#655c4d');
    const u=(id%2)/2,v=1-Math.floor(id/2)/2,us=.5;
    quad([[x+w/2,cy-hh/2,z-.06],[x-w/2,cy-hh/2,z-.06],[x-w/2,cy+hh/2,z-.06],[x+w/2,cy+hh/2,z-.06]],
      '#ffffff',atlas,[[u+.002,v-us+.002],[u+us-.002,v-us+.002],[u+us-.002,v-.002],[u+.002,v-.002]]);
  }
  return {m,box,bar,part,quad,solid,sign,loose};
}

function windowFront(S,x,y,z,w,h,shutters=false){
  const {m,box}=S;
  box(m.trim,x,y,z,w+.16,h+.16,.12,'#e5d4ba');
  box(m.glass,x,y,z-.08,w,h,.055,'#354e50');
  box(m.chrome,x,y,z-.125,w,.043,.04,'#adb1a4');
  box(m.chrome,x,y,z-.13,.046,h,.04,'#c4bfb1');
  if(shutters)for(const side of [-1,1]){
    const sx=x+side*(w*.5+.23);
    box(m.trim,sx,y,z-.02,.36,h+.10,.11,'#758677');
    for(let j=0;j<7;j++)box(m.stone,sx,y-h*.4+j*h*.13,z-.10,.30,.025,.045,'#9ba495');
  }
}
function roof(S,x,z,w,d,eaves,rise,tint){
  const {m,part,bar}=S,half=d/2,angle=Math.atan2(rise,half);
  for(const side of [-1,1]){
    part('box',m.trim,x,eaves+rise*.5,z+side*d*.25,w,.085,Math.hypot(half,rise),tint,side*angle);
    for(let dx=-w/2+.15;dx<w/2;dx+=.47)
      bar([x+dx,eaves+.075,z+side*half],[x+dx,eaves+rise+.075,z],.018,'#ab9e8b');
  }
  bar([x-w/2,eaves+rise+.09,z],[x+w/2,eaves+rise+.09,z],.075,'#b1aa94');
}
function timber(S,x,y,z,w,h,d,col){
  const {m,box}=S;box(m.stone,x,y,z,w,h,d,col);
  for(let k=1;k<h/.34;k++){
    const by=y-h*.5+k*.34;
    box(m.trim,x,by,z-d*.5-.025,w,.026,.040,'#817969');
  }
}
function porch(S,x,z,w,d,y,roofY){
  const {m,box,bar}=S;
  for(let i=0;i<Math.ceil(d/.24);i++)box(m.stone,x,y,z-d*.5+.12+i*.24,w,.12,.225,i%3?'#a99272':'#b19b79');
  for(const side of [-1,1])for(const end of [-1,1]){
    const px=x+side*(w*.5-.13),pz=z+end*(d/2-.13);
    box(m.stone,px,roofY/2,pz,.18,roofY,.18,'#8c816c');
  }
  for(const side of [-1,1])bar([x+side*(w/2-.13),y+.84,z-d/2+.10],[x+side*(w/2-.13),y+.84,z+d/2-.10],.044,'#bcae91');
  box(m.trim,x,roofY,z,w+.36,.14,d+.35,'#77928a');
}
function fishCrate(S,x,z,stack=0){
  const {box,m}=S,y=stack*.42;
  box(m.stone,x,.19+y,z,1.02,.36,.70,'#997952');
  for(let j=0;j<3;j++)box(m.trim,x,.08+j*.115+y,z-.36,.96,.025,.017,'#715635');
  for(const side of [-1,1])box(m.trim,x+.40*side,.19+y,z-.382,.07,.37,.05,'#b1946d');
}
function outpost(S){
  const {m,box,bar,part,solid,sign}=S;
  // Weathered bait shack with flyscreen door and a corrugated tin awning.
  const cx=-5.2,cz=3.2;
  timber(S,cx,1.79,cz,6.7,2.9,4.2,'#bec3a0');solid(cx,cz,6.8,4.4);
  box(m.stone,cx,.20,cz,6.82,.38,4.32,'#908978');
  roof(S,cx,cz,7.24,4.76,3.31,.92,'#76887e');
  porch(S,cx,-.17,6.98,2.44,.37,2.92);
  windowFront(S,-5.68,1.85,1.07,2.03,1.07,true);
  box(m.trim,-2.98,1.36,1.025,1.13,2.00,.12,'#4b6c66');
  box(m.glass,-2.97,1.57,.945,.80,1.22,.04,'#647d74');
  sign(0,cx,2.86,-1.52,4,.92);
  for(const x of [-8.8,-7.7]){
    S.loose('crate',x,-1.35,1.02,.76,()=>{
      fishCrate(S,x,-1.35);fishCrate(S,x,-1.35,1);
    });
  }
  // Painted travel trailer with chamfered ends, steel hitch and two axles.
  const tx=5.0,tz=1.52;
  box(m.chrome,tx,.68,tz,7.8,.19,2.78,'#615f56');
  box(m.stone,tx,1.88,tz,7.62,2.22,2.66,'#e1d6b8');
  for(const side of [-1,1]){
    part('oval',m.trim,tx+side*3.74,1.90,tz,.40,1.06,1.30,'#d3cbb6');
    for(let j=0;j<2;j++)part('disc',m.trim,tx-.68+j*1.28,.59,tz+side*1.30,.43,.20,.43,'#393b38',Math.PI*.5);
  }
  part('oval',m.trim,tx,3.00,tz,3.91,.24,1.37,'#dad3c2');
  box(m.trim,tx,1.52,tz-1.345,7.37,.22,.04,'#9e7459');
  for(const dx of [-2.48,.07,2.42])windowFront(S,tx+dx,2.23,tz-1.35,1.19,.73);
  for(let i=0;i<6;i++)box(m.chrome,tx-1.24,.96+i*.10,tz-1.35,1.23,.014,.035,'#b1aa98');
  bar([8.78,.85,.41],[10.25,.65,1.52],.069,'#939187');bar([8.78,.85,2.66],[10.25,.65,1.52],.069,'#939187');
  solid(tx,tz,8.10,2.9);
  box(m.trim,tx+.2,3.25,tz,1.27,.34,.80,'#b8b4a7');
  // Hanging net, colourful floats and roadside ice locker.
  S.loose('fence',5.5,-3.85,6.35,.18,()=>{
    for(const x of [2.4,8.6])bar([x,.02,-3.85],[x,2.11,-3.85],.075,'#857051',m.stone);
    for(let j=0;j<3;j++)bar([2.42,.85+j*.41,-3.85],[8.58,.85+j*.41,-3.85],.012,'#8a977e');
    for(let i=0;i<15;i++){
      const x=2.5+i*.41;
      bar([x,.85,-3.85],[x+.32,1.68,-3.85],.010,'#8a977e');
      if(i%3===0)part('oval',m.trim,x,1.74,-3.85,.067,.12,.067,i%2?'#d39149':'#d5c9a5');
    }
  });
  S.loose('crate',-9.9,-2.53,1.5,.92,()=>{
    box(m.trim,-9.9,.68,-2.53,1.5,1.32,.87,'#d3d4bc');
    for(const sx of [-10.24,-9.56])box(m.trim,sx,.73,-2.98,.61,.95,.04,'#a6bdb7');
    box(m.chrome,-9.82,.76,-3.03,.034,.24,.05,'#586f71');
  });
}

// Skiff hull built from continuous keel/chine/gunwale sections rather than
// stacked boxes. The same sections support the airboat's flat deck.
function hull(S,x,z,width,length,keel,paint){
  const rings=[[-.50,.035,.53],[-.39,.61,.37],[-.18,.95,.28],[.25,1,.24],[.49,.88,.24]];
  const point=(i,side,tier)=>{
    const [f,w,lift]=rings[i];
    const beam=tier===0?.025:tier===1?.73:1;
    return [x+side*width*.5*w*beam,keel+(tier===0?0:tier===1?.18:lift+.32),z+length*f];
  };
  for(const side of [-1,1])for(let i=0;i<rings.length-1;i++){
    S.quad([point(i,side,0),point(i+1,side,0),point(i+1,side,1),point(i,side,1)],'#656e65');
    S.quad([point(i,side,1),point(i+1,side,1),point(i+1,side,2),point(i,side,2)],paint);
    S.bar(point(i,side,2),point(i+1,side,2),.034,'#d9d2b9');
  }
  for(let i=0;i<rings.length-1;i++)S.quad([point(i,-1,2),point(i,1,2),point(i+1,1,2),point(i+1,-1,2)],'#adad94');
  const end=rings.length-1;
  S.quad([point(end,-1,1),point(end,1,1),point(end,1,2),point(end,-1,2)],paint);
}
function keys(S){
  const {m,box,part,bar,sign,solid}=S;
  const cx=-4.5,cz=3.4;
  box(m.stone,cx,2.25,cz,9.6,4.34,5.98,'#c7c6b1');solid(cx,cz,9.6,6);
  roof(S,cx,cz,10.12,6.6,4.42,.89,'#7a9a9b');
  box(m.chrome,cx-.64,1.78,.375,5.0,3.32,.12,'#7d9593');
  for(let j=0;j<16;j++)box(m.trim,cx-.64,.20+j*.204,.290,4.98,.031,.05,'#a8b0a2');
  windowFront(S,-.85,2.19,.34,1.20,.92);
  for(let j=0;j<14;j++)box(m.chrome,-9.33,2.27,.55+j*.42,.07,4.1,.035,'#9ca59b');
  sign(1,cx,4.00,-.06,7.1,.99);
  S.loose('sign',-8.62,-3.98,.32,.30,()=>{
    box(m.stone,-8.62,1.92,-3.98,.18,3.84,.18,'#a3a693');
    sign(3,-8.62,3.29,-4.05,2.26,1.08);
  });
  // Fuel pumps, shaded gauges, hanging hose loops and zinc canopy.
  for(const x of [-5.95,-2.85]){
    S.loose('meter',x,-4.35,1.25,.96,()=>{
      box(m.stone,x,.15,-4.35,1.24,.24,.96,'#ada891');
      box(m.trim,x,.84,-4.35,.72,1.22,.54,'#c47250');
      box(m.stone,x,1.65,-4.35,.84,.65,.64,'#e4dbc4');
      box(m.glass,x,1.70,-4.69,.53,.25,.028,'#344742');
      for(let j=0;j<4;j++)box(m.trim,x-.17+j*.11,1.71,-4.71,.068,.113,.018,'#c2cbb3');
      bar([x+.41,1.56,-4.41],[x+.67,.47,-4.46],.033,'#383735');
      bar([x+.67,.47,-4.46],[x+.81,.56,-4.46],.033,'#383735');
      bar([x+.81,.56,-4.46],[x+.48,1.31,-4.46],.035,'#383735');
    });
  }
  for(const x of [-7.17,-1.75])bar([x,.07,-4.30],[x,3.1,-4.30],.078,'#88928b');
  box(m.trim,-4.46,3.15,-4.30,6.43,.14,2.7,'#b8beb0');
  box(m.trim,-4.46,3.09,-5.65,6.46,.16,.09,'#b4674b');
  const bx=5.80,bz=.44;
  hull(S,bx,bz,3.10,7.88,.94,'#4f8389');solid(bx,bz,3.52,7.92);
  for(const z of [-1.63,2.47])for(const side of [-1,1]){
    box(m.stone,bx+side*.97,.13,z,1.19,.19,.80,'#8f795f');
    bar([bx+side*1.38,.18,z],[bx+side*.80,1.44,z],.082,'#766f61');
  }
  box(m.stone,bx,1.97,bz-.16,1.03,.79,.71,'#ded3b4');
  box(m.glass,bx,2.55,bz-.34,.95,.39,.12,'#71999c');
  for(const side of [-1,1])bar([bx+side*.94,1.51,bz+.10],[bx+side*.94,3.12,bz+.10],.036,'#bfc5b7');
  box(m.trim,bx,3.15,bz+.16,2.4,.08,1.65,'#c4c8ab');
  box(m.chrome,bx,1.39,bz+4.13,.52,.83,.4,'#52595b');
  // Travel hoist columns, lifting chain and slings above the hauled boat.
  for(const side of [-1,1]){
    box(m.trim,bx+side*2.61,.23,bz+.85,.63,.32,3.31,'#638783');
    box(m.trim,bx+side*2.61,2.55,bz+.83,.28,4.68,.37,'#648c8b');
    bar([bx+side*2.61,.39,bz+2.22],[bx+side*2.61,2.34,bz+.83],.10,'#638783');
  }
  box(m.trim,bx,4.96,bz+.83,5.65,.32,.40,'#67918c');
  for(const side of [-1,1])bar([bx+side*1.64,4.83,bz+.83],[bx+side*1.46,1.45,bz+.83],.020,'#695d48');
  for(let i=0;i<3;i++)part('disc',m.trim,9.15,.39,2.0+i*.92,.38,.77,.38,i%2?'#c37a50':'#879a95');
}
function glades(S){
  const {m,box,bar,part,solid,sign}=S;
  const cx=-4.6,cz=2.9;
  for(const side of [-1,1])for(const end of [-1,1]){
    box(m.stone,cx+side*3.12,.78,cz+end*2.10,.23,1.53,.23,'#776957');
    bar([cx-3.1,.24,cz+end*2.1],[cx+3.1,1.37,cz+end*2.10],.061,'#89795f',m.stone);
  }
  timber(S,cx,2.84,cz,6.54,2.83,4.57,'#82917a');solid(cx,cz,6.6,4.6);
  roof(S,cx,cz,7.39,5.27,4.28,1.08,'#77694f');
  porch(S,cx,-.64,7.17,2.13,1.44,3.76);
  windowFront(S,cx-1.4,2.86,.59,1.71,.97,true);
  box(m.stone,cx+1.45,2.48,.56,1.18,2.03,.13,'#a69b7d');
  box(m.glass,cx+1.45,2.93,.47,.71,.72,.05,'#607575');
  sign(2,cx,3.34,-1.98,4.19,.78);
  for(let i=0;i<7;i++)box(m.stone,cx+2.35,1.34-i*.191,-1.93-i*.32,1.39,.15,.36,'#a18b6f');
  for(const side of [-1,1])bar([cx+2.35+side*.68,2.19,-1.86],[cx+2.35+side*.68,.87,-4.12],.049,'#8f7f66');
  // An airboat's pusher cage, rudders and tandem high seats.
  const x=5.47,z=.04;hull(S,x,z,2.73,5.80,.20,'#799080');solid(x,z,2.83,5.86);
  const fanZ=z+1.46,fanY=1.89,r=1.17;
  for(const dz of [-.24,.25]){
    for(let i=0;i<16;i++){
      const a=i*Math.PI/8,b=(i+1)*Math.PI/8;
      const v=angle=>[x+Math.cos(angle)*r,fanY+Math.sin(angle)*r,fanZ+dz];
      bar(v(a),v(b),.040,'#acb1a0');
      if(i%2===0)bar([x,fanY,fanZ+dz],v(a),.018,'#68786e');
      if(dz<0 && i%2===0)bar(v(a),[x+Math.cos(a)*r,fanY+Math.sin(a)*r,fanZ+.25],.035,'#a3a998');
    }
  }
  for(let i=0;i<4;i++){
    const angle=i*Math.PI/2+.35;
    part('oval',m.trim,x+Math.cos(angle)*.47,fanY+Math.sin(angle)*.47,fanZ,.54,.106,.047,'#745f49',0,0,angle);
  }
  part('oval',m.chrome,x,fanY,fanZ,.14,.14,.16,'#9fa390');
  for(const side of [-1,1]){
    box(m.trim,x+side*.36,1.64,fanZ+.50,.12,1.29,.52,'#798b74');
    bar([x+side*.81,.82,z+.57],[x+side*.52,fanY,fanZ],.065,'#5c7064');
  }
  for(let i=0;i<2;i++){
    const py=1.10+i*.30,pz=z-.99+i*1.11;
    box(m.trim,x,py,pz,.58,.11,.43,'#776e53');box(m.trim,x,py+.22,pz+.21,.57,.48,.10,'#918368');
    for(const side of [-1,1])bar([x+side*.22,.78,pz],[x+side*.22,py,pz],.028,'#a6ae9c');
  }
  // Egrets with bent necks and spear-shaped bills above the marsh grass.
  for(const [bx,bz] of [[9.56,3.3],[10.48,4.62],[-9.45,4.1]]){
    for(const side of [-1,1])bar([bx+side*.05,.02,bz+.04],[bx+side*.05,.41,bz],.013,'#626456');
    part('oval',m.stone,bx,.47,bz,.115,.15,.26,'#dddfce');
    bar([bx,.52,bz-.12],[bx,.66,bz-.27],.040,'#d9ddcd');
    bar([bx,.66,bz-.27],[bx,.80,bz-.23],.032,'#e0e3d5');
    part('oval',m.stone,bx,.82,bz-.25,.056,.053,.10,'#e5e7db');
    bar([bx,.82,bz-.33],[bx,.812,bz-.46],.015,'#d6ac60');
  }
}

export function addRegionalProps(builder,materials,blocks,placements){
  const atlas=lettering(), types={outpost,keys,glades};
  for(const place of placements){
    const kind=(place.id||place.type||'').toLowerCase();
    if(types[kind])types[kind](site(builder,materials,blocks,place,atlas));
  }
}
