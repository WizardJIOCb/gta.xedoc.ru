import * as THREE from 'three';
import { createGait } from './gait.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';

const skinMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .75 });
const detailMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: .32, roughness: .39 });
const chromeMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: .92, roughness: .19 });
const lampMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
const glazing = new THREE.MeshPhysicalMaterial({
  color: 0xa7dbdf, metalness: .22, roughness: .1, transparent: true,
  opacity: .36, side: THREE.DoubleSide, depthWrite: false
});
const unitBox = new THREE.BoxGeometry(), unitBall = new THREE.SphereGeometry(1, 16, 12);
const mat4 = new THREE.Matrix4(), quaternion = new THREE.Quaternion();
const up = new THREE.Vector3(0, 1, 0);
const vec = xyz => new THREE.Vector3(...xyz);

// Batch rigid trim pieces so a door seam or a wheel spoke doesn't cost a draw.
class Parts {
  constructor() { this.list = []; }
  add(geom, color = 0xffffff, pos = [0,0,0], scale = [1,1,1], rot = [0,0,0]) {
    const g = geom.index ? geom.toNonIndexed() : geom.clone();
    g.deleteAttribute('uv');
    quaternion.setFromEuler(new THREE.Euler(...rot));
    g.applyMatrix4(mat4.compose(vec(pos), quaternion, vec(scale)));
    const c = new THREE.Color(color), rgb = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < rgb.length; i += 3) { rgb[i] = c.r; rgb[i + 1] = c.g; rgb[i + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(rgb, 3));
    this.list.push(g);
  }
  box(c, pos, size, rot) { this.add(unitBox, c, pos, size, rot); }
  ball(c, pos, radii, rot) { this.add(unitBall, c, pos, radii, rot); }
  rod(c, from, to, r1, r2 = r1, sides = 8) {
    const a = vec(from), b = vec(to), delta = b.clone().sub(a);
    const g = new THREE.CylinderGeometry(r2, r1, delta.length(), sides);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, delta.normalize()));
    this.add(g, c, a.lerp(b, .5).toArray());
    g.dispose();
  }
  line(c, coords, radius = .01) {
    const curve = new THREE.CatmullRomCurve3(coords.map(vec));
    const g = new THREE.TubeGeometry(curve, Math.max(6, coords.length * 3), radius, 5, false);
    this.add(g, c); g.dispose();
  }
  mesh(material, into) {
    const g = mergeGeometries(this.list);
    this.list.forEach(part => part.dispose());
    this.list.length = 0;
    const mesh = new THREE.Mesh(g, material);
    mesh.castShadow = mesh.receiveShadow = true;
    into.add(mesh);
    return mesh;
  }
}

function surface(rows) {
  const positions = [], indices = [];
  rows.forEach(r => r.forEach(p => positions.push(...p)));
  const n = rows[0].length;
  for (let j = 0; j < rows.length - 1; j++) {
    for (let i = 0; i < n - 1; i++) {
      const a = j*n + i, b = a+n;
      indices.push(a,b,a+1,b,b+1,a+1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices); g.computeVertexNormals();
  return g;
}

// Longitudinal sections: distance, half width, shoulder, deck centre height,
// cockpit cutout half-width. Dense sections around axles model actual arches.
const sections = [
  [-2.22,.68,.51,.52,0],[-2.15,.81,.60,.59,0],[-1.95,.91,.72,.65,0],
  [-1.62,.965,.83,.69,0],[-1.32,.968,.87,.71,0],[-.92,.92,.82,.77,0],
  [-.72,.9,.82,.835,0],[-.64,.892,.825,.83,.57],[-.43,.89,.83,.82,.66],
  [.40,.91,.84,.83,.68],[.71,.94,.865,.855,.63],[.87,.955,.885,.865,.49],
  [.96,.965,.896,.875,0],[1.32,.985,.91,.87,0],[1.71,.967,.86,.84,0],
  [2.03,.92,.82,.80,0],[2.20,.84,.75,.75,0],[2.24,.80,.70,.71,0]
];
const axles = [-1.34, 1.36];
function section(z) {
  let i = 1;
  while (i < sections.length-1 && sections[i][0] < z) i++;
  const a = sections[i-1], b = sections[i], t = (z-a[0])/(b[0]-a[0]);
  return a.slice(1).map((v,k) => THREE.MathUtils.lerp(v,b[k+1],t));
}
function roundEnd(x,z) {
  const front = THREE.MathUtils.smoothstep(-z,1.88,2.22);
  const back = THREE.MathUtils.smoothstep(z,1.92,2.24);
  return z+(.142*front-.13*back)*Math.pow(Math.abs(x)/.82,3);
}
function halfHull(sign) {
  const rows = [];
  const samples = new Set(sections.map(s => s[0]));
  for (let z=-2.18;z<2.24;z+=.045) samples.add(z);
  for (const z of [...samples].sort((a,b)=>a-b)) {
    const [w,h,deck,cut] = section(z);
    const d = Math.min(...axles.map(a=>Math.abs(a-z)));
    const sill = d < .385 ? .335 + Math.sqrt(.385**2-d**2) : .195;
    const shoulder = Math.max(h-.095,sill+.033);
    const x = v => sign*v;
    const contour = [
      [x(cut),deck+.01,z], [x(cut+(w-cut)*.42),deck+.011,z],
      [x(w*.85+cut*.05),h+.012,z], [x(w*.963),h-.018,z],
      [x(w),shoulder,z], [x(w*.993),THREE.MathUtils.lerp(shoulder,sill,.66),z],
      [x(w*.975),sill,z], [x(w*.9),sill-.009,z]
    ];
    for(const point of contour)point[2]=roundEnd(point[0],z);
    rows.push(sign===1 ? contour : contour.reverse());
  }
  return surface(rows);
}
function bumperCap(rear) {
  const z=rear?2.24:-2.22, w=rear?.8:.68;
  const rows=[];
  for(let i=0;i<=32;i++){
    const n=i/16-1, a=Math.abs(n), x=n*w, end=roundEnd(x,z);
    const deck=(rear?.717:.524)-.024*Math.pow(a,4);
    const bottom=.21+.108*Math.pow(1-a,1.7);
    rows.push([[x,deck,end-.004],[x,.52+(rear?.13:0)-.105*a*a,end-.016],
      [x*.994,.373,end+.004],[x*.982,bottom+.055,end-.012],[x*.975,bottom,end-(rear?.042:-.018)]]);
  }
  return surface(rows);
}

let shadowTexture, plateTexture;
function canvasTexture(w,h,paint) {
  const canvas = document.createElement('canvas');
  canvas.width=w; canvas.height=h;
  paint(canvas.getContext('2d'),w,h);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
function shadow(mesh) {
  shadowTexture ||= canvasTexture(128,256,(ctx,w,h) => {
    ctx.translate(w/2,h/2); ctx.scale(w*.5,h*.5);
    const g=ctx.createRadialGradient(0,0,0,0,0,1);
    g.addColorStop(0,'rgba(10,9,15,0.7)');g.addColorStop(.65,'rgba(11,10,16,0.58)');
    g.addColorStop(1,'rgba(12,11,15,0)');
    ctx.fillStyle=g;ctx.fillRect(-1,-1,2,2);
  });
  const s = new THREE.Mesh(new THREE.PlaneGeometry(2.75,5.65),
    new THREE.MeshBasicMaterial({map:shadowTexture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}));
  s.rotation.x=-Math.PI/2; s.position.y=.018; mesh.add(s);
}
function licensePlate(group) {
  plateTexture ||= canvasTexture(256,112,(ctx,w,h) => {
    ctx.fillStyle='#e6e4cf';ctx.fillRect(0,0,w,h);
    ctx.strokeStyle='#364b4c';ctx.lineWidth=5;ctx.strokeRect(5,5,w-10,h-10);
    ctx.textAlign='center';ctx.fillStyle='#a44532';ctx.font='bold 18px Georgia';ctx.fillText('Palm Coast',128,26);
    ctx.fillStyle='#244245';ctx.font='bold 51px monospace';ctx.fillText('VCE  86',128,78);
    ctx.fillStyle='#366056';ctx.font='11px sans-serif';ctx.fillText('SUNSHINE COUNTY',128,98);
  });
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(.39,.17),
    new THREE.MeshStandardMaterial({map:plateTexture,roughness:.44}));
  plate.position.set(0,.432,2.247);group.add(plate);
}

const wheelGeometry = {};
function makeWheel(hero) {
  const key = hero ? 'hero' : 'traffic';
  if (!wheelGeometry[key]) {
    const p = new Parts();
    const ring = (c,r,t,x,segments=40)=>{
      const g=new THREE.TorusGeometry(r,t,8,segments);
      p.add(g,c,[x,0,0],[1,1,1],[0,Math.PI/2,0]);g.dispose();
    };
    const disc = (c,r,thick,x)=>{
      const g = new THREE.CylinderGeometry(r,r,thick,hero?40:20);
      p.add(g,c,[x,0,0],[1,1,1],[0,0,Math.PI/2]);g.dispose();
    };
    disc(0x222329,.318,.224,0);
    for(const side of [-1,1]){
      const s = v => v*side;
      ring(0x28282a,.275,.055,s(.080),hero?40:20);
      disc(0x272c34,.226,.016,s(.116));
      ring(0xb3aaa0,.222,.014,s(.127),hero?40:20);
      if(hero) {
        disc(0x71757a,.174,.01,s(.126));
        p.box(0xb73422,[s(.134),.028,-.142],[.026,.115,.048]);
      }
      for(let i=0;i<(hero?10:5);i++){
        const a=i*2*Math.PI/(hero?10:5);
        const a2=a+.145;
        p.rod(0xafa498,[s(.15),.052*Math.cos(a),.052*Math.sin(a)],
          [s(.125),.21*Math.cos(a2),.21*Math.sin(a2)],hero?.013:.023,hero?.014:.026,5);
      }
      disc(0x555663,.051,.023,s(.152));
      if(hero) for(let i=0;i<5;i++){
        let a=i*Math.PI*.4;p.ball(0xc7c9c5,[s(.168),.031*Math.cos(a),.031*Math.sin(a)],[.006,.006,.006]);
      }
    }
    wheelGeometry[key]=mergeGeometries(p.list);
    p.list.forEach(g=>g.dispose());
  }
  return wheelGeometry[key];
}

function windshield(mesh, paint, bright, detail) {
  const rows=[];
  for(let i=0;i<=12;i++){
    const x=i/6-1, curve=x*x;
    rows.push([[x*.79,.852+curve*.012,-.63+curve*.08],[x*.67,1.255-curve*.038,-.23+curve*.075]]);
  }
  const windshield=new THREE.Mesh(surface(rows),glazing);mesh.add(windshield);
  for(const side of [-1,1]){
    paint.rod(0xffffff,[side*.79,.84,-.55],[side*.67,1.217,-.155],.029,.024);
    bright.rod(0xb7b0a3,[side*.79,.865,-.552],[side*.67,1.217,-.159],.011,.009);
  }
  detail.line(0x25252a,rows.map(r=>r[1]),.025);
  detail.line(0x242829,rows.map(r=>r[0]),.019);
  detail.rod(0x27292c,[0,1.247,-.217],[0,1.196,-.172],.009);
  detail.ball(0x333337,[0,1.174,-.156],[.094,.029,.024]);
}

function interior(detail, bright) {
  const saddle=0xb47a4e;
  detail.box(0x28282d,[0,.484,.06],[1.58,.26,1.73]);
  detail.box(0x393638,[0,.69,.756],[1.52,.31,.20]);
  detail.ball(0x333037,[0,.785,-.541],[.776,.10,.195]);
  for(const s of [-1,1]){
    detail.ball(saddle,[s*.395,.619,.191],[.236,.11,.325]);
    detail.ball(saddle,[s*.395,.788,.435],[.22,.261,.09],[-.17,0,0]);
    detail.ball(0x996748,[s*.395,.975,.478],[.128,.131,.082]);
    detail.ball(saddle,[s*.395,1.006,.474],[.127,.112,.079]);
    for(const u of [-1,1]) detail.ball(0x8a593c,[s*.395+u*.19,.76,.383],[.046,.185,.091],[-.25,0,0]);
    detail.ball(0x333438,[s*.721,.749,.12],[.077,.12,.57]);
    detail.box(0x403734,[s*.728,.65,.04],[.088,.29,1.43]);
    detail.line(0xa58468,[[s*.675,.764,-.51],[s*.675,.735,-.16],
      [s*.675,.748,.18],[s*.675,.78,.53]],.012);
    for(const u of [-1,1])detail.line(0xaa7150,[[s*.395+u*.115,.68,.493],
      [s*.395+u*.135,.771,.526],[s*.395+u*.112,.93,.541]],.007);
    bright.line(0x8d8c88,[[s*.612,.872,.772],[s*.601,1.033,.776],
      [s*.50,1.076,.775],[s*.30,1.055,.775],[s*.275,.875,.77]],.025);
  }
  detail.box(0x494243,[0,.652,.06],[.162,.19,.72]);
  detail.ball(0x24262b,[0,.764,-.10],[.03,.035,.03]);
  const g = new THREE.TorusGeometry(.14,.018,8,32);
  detail.add(g,0x302a2b,[-.391,.895,-.345],[1,1,1],[-.24,0,0]);g.dispose();
  for(const a of [0,Math.PI,-Math.PI/2]){
    detail.rod(0x494444,[-.391,.895,-.345],[-.391+.128*Math.cos(a),.895+.128*Math.sin(a),-.345],.009,.013);
  }
}

function driver(into) {
  const seat=new THREE.Group();into.add(seat);
  const p=new Parts(), skin=0xa96044, shirt=0x2c5662;
  p.ball(shirt,[-.391,.845,.19],[.176,.194,.113],[-.12,0,0]);
  p.rod(skin,[-.39,.982,.17],[-.39,1.073,.143],.051);
  p.ball(skin,[-.39,1.127,.134],[.096,.125,.10]);
  p.ball(0x2a2424,[-.39,1.183,.15],[.098,.077,.101],[-.22,0,0]);
  for(const s of [-1,1]){
    p.ball(skin,[-.39+s*.093,1.124,.14],[.019,.032,.02]);
    const a=[-.39+s*.145,.93,.153], b=[-.39+s*.178,.797,-.026], c=[-.39+s*.106,.936,-.299];
    p.rod(shirt,a,b,.06,.047);p.rod(skin,b,c,.039,.029);p.ball(skin,c,[.038,.035,.04]);
  }
  const fallback=p.mesh(skinMaterial,seat);
  loadPerson('andre').then(asset=>{
    if(!asset)return;
    const actor=cloneSkeleton(asset.scene);
    actor.rotation.y=Math.PI;actor.scale.setScalar(.94);
    const mixer=new THREE.AnimationMixer(actor);
    mixer.clipAction(THREE.AnimationClip.findByName(asset.animations,'Idle')).play();
    mixer.update(0);
    const bones={};
    actor.traverse(node=>{
      if(node.isBone)bones[node.name.replace(/^mixamorig[:_]?/,'')]=node;
      if(node.isMesh)node.castShadow=node.receiveShadow=true;
    });
    const position=bone=>bone.getWorldPosition(new THREE.Vector3());
    actor.position.copy(vec([-.392,.485,.19]).sub(position(bones.Hips)));
    // Rotate each bone in parent space so elbows and knees remain connected
    // while the wrists land near the rim and both heels stay in the footwell.
    function aim(start,end,target) {
      const bone=bones[start], joint=position(bone);
      const direction=position(bones[end]).sub(joint).normalize();
      const change=new THREE.Quaternion().setFromUnitVectors(direction,vec(target).sub(joint).normalize());
      const parentRotation=bone.parent.getWorldQuaternion(new THREE.Quaternion());
      bone.quaternion.premultiply(parentRotation.clone().invert().multiply(change).multiply(parentRotation));
    }
    for(const [side,s] of [['Left',-1],['Right',1]]) {
      const reach=(a,b,x,y,z)=>aim(side+a,side+b,[-.392+s*x,y,z]);
      reach('UpLeg','Leg',.10,.50,-.22);
      reach('Leg','Foot',.11,.20,-.52);
      reach('Arm','ForeArm',.235,.795,-.035);
      reach('ForeArm','Hand',.112,.922,-.306);
    }
    seat.add(actor);seat.remove(fallback);fallback.geometry.dispose();
  });
  return seat;
}

function rearAndNose(p, trim, chrome, lamps, brakes, hero) {
  p.add(bumperCap(true));p.add(bumperCap(false));
  p.ball(0xffffff,[0,.486,2.086],[.893,.26,.154]);
  p.ball(0xffffff,[0,.434,-2.077],[.852,.178,.145]);
  trim.ball(0x242529,[0,.48,-2.154],[.714,.105,.086]);
  trim.ball(0x23252b,[0,.368,2.075],[.784,.135,.15]);
  const bar=[[-.81,.70,2.10],[-.67,.698,2.175],[-.33,.681,2.24],[0,.679,2.25],
    [.33,.681,2.24],[.67,.698,2.175],[.81,.70,2.10]];
  trim.line(0x28262a,bar.map(([x,y,z])=>[x,y,z-.017]),.035);
  lamps.line(0xe54539,bar.map(([x,y,z])=>[x,y,z+.018]),hero?.012:.018);
  for(const s of [-1,1]){
    brakes.line(0xff5438,[[s*.49,.685,2.228],[s*.68,.699,2.19],[s*.80,.709,2.129],[s*.85,.711,2.056]],.022);
    trim.ball(0x343942,[s*.68,.676,-1.996],[.196,.051,.119],[.27,0,s*.08]);
    lamps.line(0xffe8bb,[[s*.49,.69,-2.051],[s*.66,.702,-2.088],[s*.796,.706,-2.051]],.013);
    if(hero){
      lamps.line(0xffe7bf,[[s*.528,.675,-2.077],[s*.678,.684,-2.09],[s*.75,.689,-2.08]],.006);
      chrome.ball(0xaaa9a7,[s*.645,.31,2.168],[.097,.052,.077]);
      trim.ball(0x17191b,[s*.645,.312,2.201],[.076,.038,.057]);
    }
  }
  if(!hero)return;
  const diffuser=[];
  for(let i=0;i<=30;i++){
    const n=i/15-1, x=n*.77, end=roundEnd(x,2.24);
    const lip=.353+.038*Math.cos(n*Math.PI)+.036*n*n;
    diffuser.push([[x*.96,.274,end-.008],[x*.99,lip-.023,end+.013],[x,lip,end+.009]]);
  }
  trim.add(surface(diffuser),0x303138);
  for(const s of [-1,1]){
    for(let i=0;i<3;i++){
      const y=.459+i*.023;
      trim.line(0x403b3b,[[s*.455,y,2.23],[s*.58,y+.003,2.211],[s*.714,y+.012,2.174]],.008);
    }
  }
  for(let i=0;i<4;i++) trim.box(0x4b4748,[0,.414+i*.034,-2.219],[1.12,.009,.012]);
  for(let i=-3;i<=3;i++) trim.box(0x1e2022,[i*.14,.285,2.122],[.018,.075,.17],[.15,0,0]);
  chrome.line(0xa89781,[[-.08,.638,2.234],[0,.623,2.244],[.08,.638,2.234]],.008);
  for(let i=0;i<7;i++){
    const z=1.013+i*.050;
    trim.line(0x363237,[[-.37,.889,z],[-.17,.893,z],[.17,.893,z],[.37,.889,z]],.008);
  }
}

function doorsAndHood(p, trim, bright) {
  for(const s of [-1,1]){
    trim.line(0x503830,[[s*.901,.802,-.626],[s*.897,.61,-.599],[s*.905,.357,-.475],
      [s*.922,.339,.48],[s*.932,.43,.663],[s*.947,.813,.712]],.006);
    trim.ball(0x5a453a,[s*.938,.788,.47],[.017,.021,.081]);
    bright.ball(0xa9a196,[s*.946,.791,.482],[.014,.009,.064]);
    trim.rod(0x28282c,[s*.849,.847,-.420],[s*1.009,.943,-.397],.027,.022);
    p.ball(0xffffff,[s*1.04,.958,-.40],[.10,.052,.078],[-.16,0,0]);
    bright.ball(0xb9c3c1,[s*1.047,.959,-.347],[.074,.035,.014]);
    trim.line(0x695448,[[s*.46,.626,-2.054],[s*.60,.713,-1.61],
      [s*.616,.739,-1.22],[s*.642,.823,-.74]],.004);
    trim.line(0x2e292a,[[s*.857,.719,1.99],[s*.732,.811,1.876],
      [s*.464,.854,1.824]],.005);
    trim.line(0x413a37,[[s*.897,.238,-.932],[s*.903,.217,-.59],
      [s*.916,.223,.414],[s*.943,.285,.934]],.024);
  }
}

let trafficIndex=0;
export function createCar({hero=false,color=0xd46e48}={}) {
  const mesh=new THREE.Group(), body=new THREE.Group();mesh.add(body);
  const p=new Parts(), trim=new Parts(), metal=new Parts(), lamps=new Parts(), brakes=new Parts();
  for(const s of [-1,1]) p.add(halfHull(s));
  trim.box(0x25252a,[0,.31,0],[1.64,.19,3.91]);
  rearAndNose(p,trim,metal,lamps,brakes,hero);
  let occupant=null;
  if(hero){
    windshield(body,p,metal,trim);interior(trim,metal);doorsAndHood(p,trim,metal);
    occupant=driver(body);licensePlate(body);
  } else {
    const variant=trafficIndex++%3, height=[.46,.55,.38][variant];
    const roofZ=[.15,.27,.03][variant],length=[.92,1.03,.82][variant];
    trim.ball(0x32454d,[0,.825,roofZ],[.793,height,length]);
    p.ball(0xffffff,[0,.832+height*.81,roofZ+.055],[.625,height*.22,length*.59]);
    for(const s of [-1,1]){
      trim.rod(0x26292b,[s*.782,.843,roofZ-.1],[s*.597,.831+height*.86,roofZ-.077],.021);
      p.rod(0xffffff,[s*.74,.84,roofZ+length*.76],[s*.55,.83+height*.83,roofZ+length*.42],.046);
    }
  }
  const paint=new THREE.MeshPhysicalMaterial({color,vertexColors:true,metalness:.56,roughness:.285,
    clearcoat:hero?.92:.55,clearcoatRoughness:.14,side:THREE.DoubleSide});
  p.mesh(paint,body);trim.mesh(detailMaterial,body);
  if(metal.list.length)metal.mesh(chromeMaterial,body);
  lamps.mesh(lampMaterial,body);
  const brakeMaterial=new THREE.MeshBasicMaterial({vertexColors:true,color:0xa56155,toneMapped:false});
  brakes.mesh(brakeMaterial,body);shadow(mesh);
  const wheels=new THREE.InstancedMesh(makeWheel(hero),detailMaterial,4);
  wheels.name='Road wheels';wheels.castShadow=true;mesh.add(wheels);
  wheels.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const wheelFrame=new THREE.Object3D();wheelFrame.rotation.order='YXZ';
  let roll=0,lastSteer=0,previousRoll=0,previousSteer=0;
  function placeWheels(steer,angle=roll) {
    let i=0;
    for(const z of axles)for(const side of [-1,1]){
      wheelFrame.position.set(side*.857,.333,z);
      wheelFrame.rotation.x=angle;wheelFrame.rotation.y=z<0?steer*.44:0;
      wheelFrame.updateMatrix();wheels.setMatrixAt(i++,wheelFrame.matrix);
    }
    wheels.instanceMatrix.needsUpdate=true;
  }
  placeWheels(0);
  return {
    mesh, setDriverVisible(visible){if(occupant)occupant.visible=visible;},
    renderWheels(alpha){
      if(previousRoll!==roll || previousSteer!==lastSteer)
        placeWheels(THREE.MathUtils.lerp(previousSteer,lastSteer,alpha),THREE.MathUtils.lerp(previousRoll,roll,alpha));
    },
    update(dt,speed=0,steer=0,braking=false){
      const travel=speed*dt;
      previousRoll=roll;previousSteer=lastSteer;
      if(travel!==0 || steer!==lastSteer){
        roll-=travel/.333;
        placeWheels(steer);lastSteer=steer;
      }
      body.rotation.z=THREE.MathUtils.damp(body.rotation.z,-steer*Math.min(Math.abs(speed)/17,1)*.028,7,dt);
      brakeMaterial.color.setHex(braking?0xffeeee:0xa56155);
    }
  };
}

const skinTones=[0x975b43,0xb57a59,0x774836,0xdba47d,0x9a6348];
const hairColors=[0x2d2423,0x46332a,0x272325,0x836647];
const trouserColors=[0x48535b,0x655954,0x323a46,0xb1a28b];
let personIndex=0;
const localPeople=['andre','emma','carlos'];
const peopleLoader=new GLTFLoader(), peopleFiles=new Map();
function loadPerson(name) {
  if(!peopleFiles.has(name)) {
    peopleFiles.set(name,peopleLoader.loadAsync(`./vehicles/${name}.glb`).catch(()=>null));
  }
  return peopleFiles.get(name);
}
export function createPerson({color=0x458687}={}) {
  const index=personIndex++, skin=skinTones[index%skinTones.length], hair=hairColors[index%hairColors.length];
  const pants=trouserColors[index%trouserColors.length], mesh=new THREE.Group(), skeleton=new THREE.Group();
  mesh.add(skeleton);
  const head=new Parts();
  head.ball(color,[0,1.166,.005],[.202,.291,.123],[-.044,0,0]);
  head.ball(pants,[0,.906,.013],[.173,.125,.122]);
  head.rod(skin,[0,1.38,0],[0,1.497,-.007],.063,.061);
  head.ball(skin,[0,1.56,-.011],[.103,.145,.108]);
  head.ball(hair,[0,1.639,.007],[.106,.079,.113],[-.1,0,0]);
  head.ball(skin,[0,1.558,-.111],[.026,.038,.028]);
  for(const s of [-1,1])head.ball(skin,[s*.1,1.56,-.001],[.019,.033,.023]);
  if(index%3===0)head.ball(hair,[0,1.6,.103],[.055,.06,.051]);
  head.mesh(skinMaterial,skeleton);
  const limbs=[];
  for(const s of [-1,1]){
    const hip=new THREE.Group();hip.position.set(s*.092,.915,.01);skeleton.add(hip);
    const leg=new Parts();
    leg.rod(pants,[0,-.007,0],[s*.015,-.413,.012],.095,.071);
    leg.rod(pants,[s*.015,-.413,.012],[s*.014,-.795,.02],.069,.045);
    leg.ball(0x393739,[s*.014,-.84,-.033],[.061,.057,.126]);
    leg.mesh(skinMaterial,hip);
    const shoulder=new THREE.Group();shoulder.position.set(s*.163,1.33,0);skeleton.add(shoulder);
    const arm=new Parts();
    arm.rod(color,[0,.006,0],[s*.041,-.161,.006],.063,.056);
    arm.rod(skin,[s*.041,-.161,.006],[s*.056,-.263,.015],.048,.039);
    arm.rod(skin,[s*.056,-.263,.015],[s*.062,-.457,-.041],.040,.029);
    arm.ball(skin,[s*.063,-.48,-.045],[.036,.058,.03]);
    arm.mesh(skinMaterial,shoulder);limbs.push({s,hip,shoulder});
  }
  mesh.scale.setScalar(.97+(index%4)*.018);
  let phase=index*1.6, amplitude=0;
  let mixer, idle, walk, wasWalking=false, gait, loadedActor, loadedClips;
  const ready=loadPerson(localPeople[index%localPeople.length]).then(asset=>{
    if(!asset)return false;
    const actor=cloneSkeleton(asset.scene);
    actor.rotation.y=Math.PI;
    actor.traverse(part=>{
      if(!part.isMesh)return;
      part.castShadow=part.receiveShadow=true;
      if(part.name==='Outfit_original' && index>=localPeople.length) {
        part.material=part.material.clone();
        part.material.color.lerp(new THREE.Color(color),.13);
      }
    });
    mixer=new THREE.AnimationMixer(actor);
    idle=mixer.clipAction(THREE.AnimationClip.findByName(asset.animations,'Idle'));
    walk=mixer.clipAction(THREE.AnimationClip.findByName(asset.animations,'Walk'));
    idle.play();idle.time=(index*1.13)%idle.getClip().duration;
    walk.play();walk.time=(index*.27)%walk.getClip().duration;
    idle.setEffectiveWeight(wasWalking?0:1);walk.setEffectiveWeight(wasWalking?1:0);
    mixer.update(0);
    mesh.add(actor);mesh.remove(skeleton);
    loadedActor=actor;loadedClips=asset.animations;
    if(gait)gait.bind(actor,mixer,idle,walk,loadedClips);
    skeleton.traverse(part=>{if(part.isMesh)part.geometry.dispose();});
    return true;
  });
  return {mesh,ready,updateGait(dt,distance,running,airborne=false,verticalSpeed=0){
    if(!gait){
      gait=createGait(mesh);
      if(loadedActor)gait.bind(loadedActor,mixer,idle,walk,loadedClips);
    }
    const contacts=gait.update(dt,distance,running,airborne,verticalSpeed);
    if(!mixer){
      const step=Math.cos(gait.phase*Math.PI*2)*gait.moveWeight*(running?.74:.45);
      for(const {s,hip,shoulder} of limbs){
        hip.rotation.x=airborne?s*.36:s*step;
        shoulder.rotation.x=airborne?-s*.55:-s*step;
      }
    }
    return contacts;
  },update(dt,walking,walkSpeed=1.16){
    wasWalking=Boolean(walking);
    const gait=Math.max(.27,Math.min(1.9,walkSpeed/1.16));
    amplitude=THREE.MathUtils.damp(amplitude,walking?1:0,9,dt);
    if(mixer) {
      walk.setEffectiveTimeScale(gait);walk.setEffectiveWeight(amplitude);
      idle.setEffectiveWeight(1-amplitude);
      mixer.update(dt);return;
    }
    phase+=dt*6.8*gait;
    const step=Math.sin(phase)*amplitude;
    for(const {s,hip,shoulder} of limbs){hip.rotation.x=s*step*.39;shoulder.rotation.x=-s*step*.33;}
    skeleton.position.y=Math.abs(Math.cos(phase))*amplitude*.022;
  }};
}
