import*as T from '../vendor/three.module.min.js';
import{ROAD_X,TRAFFIC_POOL,VEHICLE_SPECS}from './config.js';
import{clamp,dist2D,lerp,wrapAngle}from './random.js';

const{abs,sin,cos,atan2,hypot,min,max,sqrt,random,round,PI}=Math;
const std=(c,r=.4,m=.4)=>new T.MeshStandardMaterial({color:c,roughness:r,metalness:m}),bas=(c,o={})=>new T.MeshBasicMaterial({color:c,...o}),G=(k,...a)=>new T[k+'Geometry'](...a);
const trB=(c,o)=>bas(c,{transparent:true,opacity:o,side:T.DoubleSide,depthWrite:false});

function extrudeSide(pts,w,bev=.045){
  const s=new T.Shape();s.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)s.lineTo(pts[i][0],pts[i][1]);s.closePath();
  const g=new T.ExtrudeGeometry(s,{depth:w,bevelEnabled:bev>0,bevelSize:bev,bevelThickness:bev,bevelSegments:2});
  g.translate(0,0,-w*.5);g.rotateY(-PI*.5);return g;
}

const addM=(p,geo,m,x=0,y=0,z=0,cs=0,rx=0)=>{const o=new T.Mesh(geo,m);o.position.set(x,y,z);if(rx)o.rotation.x=rx;if(cs)o.castShadow=o.receiveShadow=true;p.add(o);return o;};

/** Orient cruiser window officer toward target (tx, tz) and return muzzle world position. */
export function orientCruiserShooter(u,tx,tz){
  const cy=cos(u.yaw),sy=sin(u.yaw),s=((tx-u.x)*cy-(tz-u.z)*sy)>=0?1:-1,lx=s*u.spec.width*.5,ly=u.spec.height*.44+.34,lz=u.spec.length*.06,gx=lx+s*.42,gz=lz+.18;
  if(u.shooterGroup){u.shooterGroup.position.set(lx,ly,lz);u.shooterGroup.rotation.y=s*PI*.38;}
  return{x:u.x+cy*gx+sy*gz,y:u.y+ly+.24,z:u.z-sy*gx+cy*gz};
}

export class VehicleManager{
  constructor(scene,world,rng,audio){
    this.scene=scene;this.world=world;this.rng=rng;this.audio=audio;
    this.root=new T.Group();scene.add(this.root);this.vehicles=[];this.nextId=1;this.geoCache=new Map();
  }

  _getGeos(sp){
    if(this.geoCache.has(sp.id))return this.geoCache.get(sp.id);
    const{width:w,length:l,height:h,roof}=sp,hl=l*.5,big=roof==='suv'||roof==='armored',y0=big?.34:.24,belt=y0+h*.44,top=y0+h;
    const bPts=roof==='muscle'?[[hl-.04,y0],[hl+.03,y0+.34],[hl-.1,belt+.01],[hl*.24,belt+.06],[-hl*.96,belt+.06],[-hl,y0+.18],[-hl*.92,y0]]
      :big?[[hl-.04,y0],[hl+.02,y0+.36],[hl-.12,belt-.02],[hl*.36,belt+.04],[-hl*.96,belt+.04],[-hl,y0+.2],[-hl*.92,y0]]
      :roof==='sedan'||roof==='police'?[[hl-.04,y0],[hl+.02,y0+.3],[hl-.12,y0+.42],[hl*.32,belt+.04],[-hl*.96,belt+.04],[-hl,y0+.2],[-hl*.92,y0]]
      :[[hl-.05,y0],[hl+.03,y0+.2],[hl-.18,y0+.37],[hl*.36,belt+.04],[-hl*.56,belt+.06],[-hl*.96,belt+.01],[-hl,y0+.16],[-hl*.9,y0]];
    const[wf,rf,rr,wr]=roof==='coupe'?[hl*.36,hl*.04,-hl*.36,-hl*.86]:roof==='muscle'?[hl*.24,0,-hl*.38,-hl*.8]:big?[hl*.36,hl*.12,-hl*.78,-hl*.94]:[hl*.32,hl*.04,-hl*.42,-hl*.76];
    const bodyGeo=extrudeSide(bPts,w*.88,.05),glassGeo=roof==='open'?extrudeSide([[hl*.24,belt],[hl*.08,top-.06],[hl*.02,top-.06],[hl*.18,belt]],w*.74,.01):extrudeSide([[wf,belt],[rf,top-.03],[rr,top-.03],[wr,belt]],w*.76,.02);
    const roofGeo=roof==='open'?null:extrudeSide([[rf+.04,top-.08],[rf-.01,top+.02],[rr+.01,top+.02],[rr-.04,top-.08]],w*.78,.02);
    const wR=big?.44:.36,archGeo=G('Cylinder',wR+.11,wR+.11,.16,12,1,false,0,PI);archGeo.rotateZ(PI*.5);archGeo.rotateX(PI*.5);
    const geos={bodyGeo,glassGeo,roofGeo,archGeo,y0,belt,top,hl,wR,wf,rf,rr,wr};this.geoCache.set(sp.id,geos);return geos;
  }

  buildVehicleMesh(specId,customColor=null,customAccent=null){
    const sp=VEHICLE_SPECS[specId]||VEHICLE_SPECS.veloce_gt,g=new T.Group(),cop=sp.roof==='police';
    const bM=std(customColor??sp.color,.2,.65),aM=std(customAccent??sp.accent,.25,.45),dM=std(0x111827,.68,.25),gM=std(0x0b162a,.08,.9),chM=std(0xe2e8f0,.15,.9),cabM=cop?aM:bM;
    const{width:w,length:l,roof}=sp,gs=this._getGeos(sp),{hl,y0,belt,top,wR,wf,rf,rr,wr}=gs;
    addM(g,gs.bodyGeo,bM,0,0,0,1);addM(g,gs.glassGeo,gM);if(gs.roofGeo)addM(g,gs.roofGeo,cabM,0,0,0,1);
    const pts=[[w*.98,.08,l*.95,dM,0,y0-.01,0],[w*.9,.09,.16,aM,0,y0+.04,hl+.01],[w*.84,.11,.07,bas(0xff1e42),0,belt-.08,-hl-.02],[w*.88,.14,.08,dM,0,y0+.05,-hl-.01]];
    for(const sx of[-w*.47,w*.47])pts.push([.09,.1,l*.56,dM,sx,y0+.02,0],[.16,.08,.13,bM,sx,belt+.06,hl*.24]);
    for(const dx of[-w*.18,0,w*.18])pts.push([.05,.12,.09,dM,dx,y0+.04,-hl-.02]);
    if(cop)pts.push([w*.96,belt-y0-.04,l*.36,aM,0,(y0+belt)*.5+.01,0,1]);
    if(roof==='coupe'||roof==='open')pts.push([w*.28,.03,l*.3,aM,0,belt+.07,hl*.56]);
    if(sp.scoop)pts.push([w*.34,.18,l*.22,dM,0,belt+.13,hl*.44]);
    if(sp.spoiler){pts.push([w*.96,.06,.34,aM,0,belt+.26,-hl+.18,1]);for(const px of[-w*.3,w*.3])pts.push([.07,.22,.18,dM,px,belt+.14,-hl+.18]);}
    if(roof!=='open'){const pH=top-belt;for(const sx of[-w*.39,w*.39])pts.push([.06,hypot(rf-wf,pH),.09,cabM,sx,belt+pH*.5,(wf+rf)*.5,0,atan2(rf-wf,pH)],[.06,hypot(rr-wr,pH),.11,cabM,sx,belt+pH*.5,(rr+wr)*.5,0,atan2(rr-wr,pH)]);}
    else{pts.push([w*.72,.12,l*.34,dM,0,belt+.02,-l*.06]);const rhG=G('Torus',.16,.045,6,10,PI);for(const sx of[-w*.22,w*.22])addM(g,rhG,chM,sx,belt+.06,-l*.16);}
    for(const[pw,ph,pd,pm,px,py,pz,cs,rx]of pts)addM(g,G('Box',pw,ph,pd),pm,px,py,pz,cs,rx);
    const hM=bas(0xffeaa7),bG=G('Cone',.88,4.8,10,1,true);bG.rotateX(-PI*.5);const bMat=trB(0xfff3c4,.1);
    for(const hx of[-w*.32,w*.32]){addM(g,G('Box',w*.22,.1,.07),hM,hx,y0+.24,hl+.02);addM(g,bG,bMat,hx,y0+.22,hl+2.4);}
    const exR=G('Ring',.055,.088,12).rotateY(PI),exB=G('Ring',.085,.105,12).rotateY(PI),stG=G('Plane',.18,2.2).rotateX(-PI*.5),stI=G('Plane',.08,1.5).rotateX(-PI*.5),nG=new T.Group();nG.visible=false;
    for(const ex of[-w*.26,w*.26]){addM(g,exB,dM,ex,y0+.07,-hl-.03);addM(g,exR,bas(0xff9a44,{side:T.DoubleSide}),ex,y0+.07,-hl-.032);addM(nG,exR,trB(0x00f0ff,.85),ex,y0+.07,-hl-.04);addM(nG,stG,trB(0x00f0ff,.42),ex,.07,-hl-1.15);addM(nG,stI,trB(0xf0fdfa,.68),ex,.08,-hl-.8);}
    g.add(nG);
    const wheels=[],wG=G('Cylinder',wR,wR,.28,14).rotateZ(PI*.5),rG=G('Cylinder',wR*.58,wR*.58,.3,10).rotateZ(PI*.5),rimG=G('Torus',wR*.66,.025,6,14).rotateY(PI*.5);
    for(const[wx,wz,fr]of[[-w*.46,l*.31,1],[w*.46,l*.31,1],[-w*.46,-l*.31,0],[w*.46,-l*.31,0]]){addM(g,gs.archGeo,dM,wx*.96,wR,wz);const wg=new T.Group(),rr2=new T.Mesh(rimG,chM);wg.position.set(wx,wR,wz);rr2.position.x=wx<0?-.145:.145;wg.add(new T.Mesh(wG,dM),new T.Mesh(rG,chM),rr2);g.add(wg);wheels.push({mesh:wg,front:Boolean(fr)});}
    let sirenRed=null,sirenBlue=null,sirenLight=null,shooterGroup=null;
    if(sp.siren){
      const bY=top+.05,dG=G('Cylinder',.13,.15,.18,10),hG=G('Sphere',.55,10,10);addM(g,G('Box',w*.6,.08,.26),dM,0,bY,-.08);
      sirenRed=addM(g,dG,bas(0xff1e42),-w*.18,bY+.1,-.08);sirenBlue=addM(g,dG,bas(0x00f0ff),w*.18,bY+.1,-.08);
      for(const[m,c]of[[sirenRed,0xff1e42],[sirenBlue,0x00f0ff]]){const hl2=new T.Mesh(hG,bas(c,{transparent:true,opacity:.4,depthWrite:false}));hl2.position.copy(m.position);g.add(hl2);}
      sirenLight=new T.PointLight(0xff1e42,0,24);sirenLight.position.set(0,bY+.65,-.08);g.add(sirenLight);
      shooterGroup=new T.Group();shooterGroup.position.set(w*.48,belt+.05,hl*.12);shooterGroup.visible=false;
      addM(shooterGroup,G('Box',.24,.34,.22),std(0x1d4ed8),0,.15,0);addM(shooterGroup,G('Sphere',.14,8,8),std(0xe8b48b),0,.4,0);addM(shooterGroup,G('Box',.1,.1,.42),dM,.08,.24,.28);g.add(shooterGroup);
    }
    return{group:g,bodyMat:bM,accentMat:aM,wheels,nitroFlame:nG,sirenRed,sirenBlue,sirenLight,shooterGroup};
  }

  spawnVehicle(specId,x,z,yaw=0,opts={}){
    const spec=VEHICLE_SPECS[specId]||VEHICLE_SPECS.veloce_gt,parts=this.buildVehicleMesh(specId,opts.color??null,opts.accent??null),y=this.world.getGroundHeight(x,z),sirenOn=Boolean(opts.sirenOn);
    parts.group.position.set(x,y,z);parts.group.rotation.y=yaw;this.root.add(parts.group);if(parts.sirenLight&&sirenOn)parts.sirenLight.intensity=3.2;
    const v={id:this.nextId++,specId:spec.id,spec,mesh:parts.group,...parts,x,y,z,vy:0,yaw,speed:opts.speed||0,steerAngle:0,hp:spec.maxHp,maxHp:spec.maxHp,destroyed:false,burningTimer:0,driver:opts.driver||null,sirenOn,sirenTimer:0,isDrifting:false,isNitro:false,nitroFuel:100,colorHex:opts.color??spec.color,upgrades:{engine:0,turbo:0,armor:0},aiAxis:opts.aiAxis||'Z',aiDir:opts.aiDir||1,smokeTimer:0};
    this.vehicles.push(v);return v;
  }

  spawnInitialTraffic(){
    for(const s of[['veloce_gt',176,-54,0,0xff5e3a,0x00f0ff],['corsa_spider',176,22,PI,0x00f0ff,0xff3e7f],['toro_v8',-54,-22,PI*.5,0xffb800,0x111827],['apex_nomad',364,-22,PI*.5,0x2ceaa3,0x0f172a],['veloce_gt',-12,12,0,0x00f0ff,0xff3e7f]])this.spawnVehicle(s[0],s[1],s[2],s[3],{color:s[4],accent:s[5]});
    let idx=0;
    for(const rx of ROAD_X)for(const z of[-145,-45,55,145]){const d=idx%2===0?1:-1;if(!(rx===180&&z===-45))this.spawnVehicle(TRAFFIC_POOL[idx%5],rx+(d>0?4.2:-4.2),z,d>0?0:PI,{driver:'traffic',speed:13+(idx%4)*2,aiAxis:'Z',aiDir:d});idx++;}
    for(const rz of[-90,0,90])for(const x of[-135,45]){const d=idx%2===0?1:-1;this.spawnVehicle(TRAFFIC_POOL[idx++%5],x,rz+(d>0?-4.2:4.2),d>0?PI*.5:-PI*.5,{driver:'traffic',speed:13,aiAxis:'X',aiDir:d});}
  }

  findNearestVehicle(x,z,maxD=6.5){let best=null,bestD=maxD;for(const v of this.vehicles)if(!v.destroyed){const d=dist2D(x,z,v.x,v.z);if(d<bestD){bestD=d;best=v;}}return best;}

  enterVehicle(p,v){
    if(!v||v.destroyed)return false;const un=v.driver!=='player';v.driver='player';p.vehicle=v;p.inVehicle=true;p.mesh.visible=false;if(un&&p.stats)p.stats.carsStolen++;
    Object.assign(p,{x:v.x,y:v.y,z:v.z,yaw:v.yaw});this.audio?.playCarDoor();return true;
  }

  exitVehicle(p){
    const v=p.vehicle;if(!v)return false;v.driver=null;v.isDrifting=v.isNitro=false;if(v.nitroFlame)v.nitroFlame.visible=false;
    const col=this.world.resolveCircleCollision(v.x+cos(v.yaw)*2.45,v.z-sin(v.yaw)*2.45,.75,v.y);
    Object.assign(p,{x:col.x,z:col.z,y:this.world.getGroundHeight(col.x,col.z),yaw:v.yaw,inVehicle:false,vehicle:null});
    p.mesh.visible=true;p.mesh.position.set(p.x,p.y,p.z);p.mesh.rotation.y=p.yaw;this.audio?.playCarDoor();return true;
  }

  repairAndRespray(v,col,acc=null){if(!v)return;v.hp=v.maxHp;v.destroyed=false;v.colorHex=col;v.bodyMat.color.setHex(col);if(acc!==null)v.accentMat.color.setHex(acc);}
  applyUpgrade(v,type,lvl){if(!v)return;v.upgrades[type]=lvl;if(type==='armor'){v.maxHp=round(v.spec.maxHp*(1+lvl*.25));v.hp=v.maxHp;}}

  damageVehicle(v,amt,combat=null,player=null,police=null){
    if(!v||v.destroyed)return;
    if((v.hp=max(0,v.hp-amt))<=0){v.destroyed=true;v.speed*=.25;v.bodyMat.color.setHex(0x1f242d);v.accentMat.color.setHex(0x374151);if(v.nitroFlame)v.nitroFlame.visible=false;if(v.driver==='player'&&player){this.exitVehicle(player);player.health=max(20,player.health-28);}else v.driver=null;combat?.spawnExplosion(v.x,v.y+1,v.z,1.35);police?.addHeat(1.2,'Vehicle Destroyed');}
  }

  update(dt,input,player,combat,entities,police){
    for(const v of this.vehicles){
      if(v.destroyed){v.speed=lerp(v.speed,0,min(1,dt*4));if(combat&&(v.burningTimer+=dt)>.14){v.burningTimer=0;combat.spawnParticle({x:v.x+(random()-.5)*1.2,y:v.y+1.1,z:v.z+(random()-.5)*1.2,vx:(random()-.5)*1.2,vy:2.8+random()*1.8,vz:(random()-.5)*1.2,color:random()>.4?0x475569:0xff5e3a,size:.48,life:.75,opacity:.6});}continue;}
      if(v.driver==='player')this._drive(dt,v,input,player,combat);else if(v.driver==='traffic')this._traffic(dt,v,player);
      if(v.sirenRed&&v.sirenBlue){if(v.sirenOn){v.sirenTimer+=dt*11;const rp=sin(v.sirenTimer)>0;v.sirenRed.material.color.setHex(rp?0xff1744:0x6b0f1a);v.sirenBlue.material.color.setHex(rp?0x0c4a6e:0x00f0ff);if(v.sirenLight){v.sirenLight.intensity=3.2;v.sirenLight.color.setHex(rp?0xff1744:0x00f0ff);}}else if(v.sirenLight)v.sirenLight.intensity=0;}
      for(const w of v.wheels){w.mesh.children[0].rotation.x+=v.speed*dt*1.8;w.mesh.children[1].rotation.x+=v.speed*dt*1.8;if(w.front)w.mesh.rotation.y=v.steerAngle*.55;}
      v.mesh.position.set(v.x,v.y,v.z);v.mesh.rotation.y=v.yaw;
    }
    for(let i=0;i<this.vehicles.length;i++)for(let j=i+1;j<this.vehicles.length;j++){const a=this.vehicles[i],b=this.vehicles[j],dx=b.x-a.x,dz=b.z-a.z,dSq=dx*dx+dz*dz;if(dSq>.0001&&dSq<9.61&&abs(a.y-b.y)<2.2){const d=sqrt(dSq),nx=dx/d,nz=dz/d,p=(3.1-d)*.5;a.x-=nx*p;a.z-=nz*p;b.x+=nx*p;b.z+=nz*p;const rel=abs(a.speed-b.speed);if(rel>12){a.speed*=.78;b.speed*=.78;combat?.spawnImpactSparks((a.x+b.x)*.5,max(a.y,b.y)+.7,(a.z+b.z)*.5,8);if(a.driver==='player'||b.driver==='player')this.audio?.playCrash(rel/40);}}}
    if(entities)for(const v of this.vehicles)if(abs(v.speed)>=11)entities.checkVehicleImpacts(v,combat,player,police);
  }

  _drive(dt,v,input,player,combat){
    const th=(input.isDown('KeyW')||input.isDown('ArrowUp')?1:0)-(input.isDown('KeyS')||input.isDown('ArrowDown')?1:0),st=(input.isDown('KeyA')||input.isDown('ArrowLeft')?1:0)-(input.isDown('KeyD')||input.isDown('ArrowRight')?1:0),hb=input.isDown('Space'),ni=(input.isDown('ShiftLeft')||input.isDown('ShiftRight'))&&th>0;
    const eM=1+(v.upgrades.engine||0)*.12,maxS=v.spec.maxSpeed*eM*(ni?1.28+(v.upgrades.turbo||0)*.1:1),acc=v.spec.accel*eM*(ni?1.45:1);
    if(th>0)v.speed=min(maxS,v.speed+acc*dt);else if(th<0)v.speed=v.speed>2?max(0,v.speed-v.spec.brake*dt):max(-maxS*.38,v.speed-v.spec.accel*.7*dt);else v.speed=lerp(v.speed,0,min(1,dt*1.9));
    if(hb)v.speed=lerp(v.speed,0,min(1,dt*2.8));v.isDrifting=hb&&abs(v.speed)>12;v.isNitro=ni&&v.speed>10;
    if(v.nitroFlame){v.nitroFlame.visible=v.isNitro;if(v.isNitro)v.nitroFlame.scale.set(1,1,.92+random()*.25);}
    v.steerAngle=lerp(v.steerAngle,st,min(1,dt*10));v.yaw=wrapAngle(v.yaw+v.steerAngle*v.spec.turnRate*(v.isDrifting?1.42:1)*clamp(abs(v.speed)/14,0,1.15)*(v.speed>=-.2?1:-1)*dt);
    const fx=sin(v.yaw),fz=cos(v.yaw),rx=-cos(v.yaw),rz=sin(v.yaw),sl=v.isDrifting?-v.steerAngle*5.2:0,nx=v.x+(fx*v.speed+rx*sl)*dt,nz=v.z+(fz*v.speed+rz*sl)*dt,gy=this.world.getGroundHeight(nx,nz);
    if(gy>v.y+.06&&v.speed>20)v.vy=max(v.vy,(gy-v.y)*14);
    v.y+=v.vy*dt;if(v.y>gy){v.vy-=26*dt;if(v.y<gy){v.y=gy;v.vy=0;}}else{v.y=gy;v.vy=0;}
    if(this.world.isWater(nx,nz)&&v.y<=.1)v.speed=-v.speed*.45;else{const col=this.world.resolveCircleCollision(nx,nz,1.75,v.y);v.x=col.x;v.z=col.z;if(col.hit&&abs(v.speed)>10){this.audio?.playCrash(abs(v.speed)/45);combat?.spawnImpactSparks(v.x,v.y+.7,v.z,9);v.speed*=.45;}}
    if(combat&&v.isDrifting&&(v.smokeTimer+=dt)>.05){v.smokeTimer=0;const bx=v.x-fx*v.spec.length*.38,bz=v.z-fz*v.spec.length*.38;for(const s of[-.82,.82])combat.spawnParticle({x:bx+rx*s,y:v.y+.24,z:bz+rz*s,vx:-fx*1.8+(random()-.5)*1.2,vy:.7+random()*.6,vz:-fz*1.8+(random()-.5)*1.2,color:0xf1f5f9,size:.3,life:.42,opacity:.34});}
    Object.assign(player,{x:v.x,y:v.y,z:v.z,yaw:v.yaw});
  }

  _traffic(dt,v,player){
    const fx=sin(v.yaw),fz=cos(v.yaw),px=v.x+fx*7.5,pz=v.z+fz*7.5,blk=dist2D(px,pz,player.x,player.z)<4.5||this.vehicles.some(o=>o!==v&&dist2D(px,pz,o.x,o.z)<4.5);
    v.speed=lerp(v.speed,blk?0:14,min(1,dt*4));v.x+=fx*v.speed*dt;v.z+=fz*v.speed*dt;v.y=this.world.getGroundHeight(v.x,v.z);
    if(v.aiAxis==='Z'){if(v.z>205){v.z=205;v.aiDir=-1;v.yaw=PI;v.x-=8.4;}else if(v.z<-205){v.z=-205;v.aiDir=1;v.yaw=0;v.x+=8.4;}}
    else{if(v.x>180){v.x=180;v.aiDir=-1;v.yaw=-PI*.5;v.z+=8.4;}else if(v.x<-195){v.x=-195;v.aiDir=1;v.yaw=PI*.5;v.z-=8.4;}}
  }
}
