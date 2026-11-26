import*as T from '../vendor/three.module.min.js';
import{WEAPON_MAP}from './config.js';
import{dist2D}from './random.js';

const{abs,sin,cos,max,min,random,sqrt,PI}=Math;

export class CombatSystem{
  constructor(scene,world,entities,vehicles,audio,renderRig){
    Object.assign(this,{scene,world,entities,vehicles,audio,renderRig,root:new T.Group(),tracers:[],particles:[],explosions:[],rockets:[],missionCrates:[],cooldown:0});scene.add(this.root);
    this.flashLight=new T.PointLight(0xff7b00,0,34);this.root.add(this.flashLight);
    this.uRng=new T.RingGeometry(.65,1,24);this.uRng.rotateX(-PI*.5);
    const rt=s=>{const c=document.createElement('canvas'),x=c.getContext('2d'),g=x.createRadialGradient(64,64,0,64,64,64);c.width=c.height=128;s.split(' ').forEach((k,i)=>g.addColorStop(i/3,k));x.fillStyle=g;x.fillRect(0,0,128,128);return Object.assign(new T.CanvasTexture(c),{colorSpace:T.SRGBColorSpace});};
    [this.fireTex,this.smokeTex,this.glowTex]=['#fffbe6 #ffb02e #ff550080 #ff550000','#1e293be6 #3341558c #47556933 #47556900','#fff #fffb #fff3 #fff0'].map(rt);
  }
  get foes(){const e=this.entities;return[...e.enemies,...e.pedestrians];}
  setMissionCrates(c){this.missionCrates=c||[];}

  firePlayerWeapon(player,police,aimYaw=null,aimPitch=0){
    if(this.cooldown>0)return false;const w=WEAPON_MAP[player.activeWeapon]||WEAPON_MAP.pistol;
    if(w.id!=='fists'){if((player.ammo[w.id]||0)<=0){if(w.id!=='pistol'&&(player.ammo.pistol||0)>0){player.activeWeapon='pistol';return this.firePlayerWeapon(player,police,aimYaw,aimPitch);}return false;}player.ammo[w.id]--;}
    this.cooldown=w.cooldown;this.audio?.playShot(w.id);this.entities.alertNearbyPedestrians(player.x,player.z,34);
    const yaw=aimYaw??player.yaw,fx=sin(yaw),fz=cos(yaw),rx=-cos(yaw),rz=sin(yaw),mx=player.x+fx*.85+rx*.32,my=player.y+(player.inVehicle?1.25:1.38),mz=player.z+fz*.85+rz*.32;
    if(w.id==='fists'){for(const e of this.foes)if(e.alive&&dist2D(mx,mz,e.x,e.z)<2.5)this.entities.damageEntity(e,w.damage,this,player,police);for(const c of this.missionCrates)if(!c.destroyed&&dist2D(mx,mz,c.x,c.z)<2.8)this._damageCrate(c,w.damage);return true;}
    this.spawnParticle({x:mx,y:my,z:mz,vx:fx*2,vy:.4,vz:fz*2,kind:'fire',color:0xfff3b0,size:.42,life:.08,opacity:.9});
    if(w.explosive){const rm=new T.Mesh(new T.CylinderGeometry(.09,.12,.75,8),new T.MeshBasicMaterial({color:0x2ceaa3}));rm.rotation.set(PI*.5,0,-yaw);rm.position.set(mx,my,mz);this.root.add(rm);this.rockets.push({mesh:rm,x:mx,y:my,z:mz,vx:fx*46,vy:aimPitch*12,vz:fz*46,life:2.2});police?.addHeat(.65,'Heavy Ordinance Fired');return true;}
    const col=new T.Color(w.color).getHex();
    for(let p=0;p<w.pellets;p++){
      const sy=yaw+(random()-.5)*w.spread*2,sp=aimPitch+(random()-.5)*w.spread,hit=this._castRay(mx,my,mz,sin(sy),sp,cos(sy),w.range);
      this.spawnTracer({x:mx,y:my,z:mz},hit.point,col,.11);
      if(hit.type==='enemy'||hit.type==='pedestrian')this.entities.damageEntity(hit.target,w.damage,this,player,police);
      else if(hit.type==='crate')this._damageCrate(hit.target,w.damage);else if(hit.type==='vehicle')this.vehicles.damageVehicle(hit.target,w.damage,this,player,police);
      if(hit.type!=='none')this.spawnImpactSparks(hit.point.x,hit.point.y,hit.point.z,4);
    }
    return true;
  }

  _castRay(ox,oy,oz,dx,dy,dz,maxR){
    const wh=this.world.raycastWorld(ox,oy,oz,dx,dy,dz,maxR);let bD=wh.dist,bT=wh.hit?'world':'none',bObj=null;
    const rs=(cx,cz,r)=>{const fx=cx-ox,fz=cz-oz,pr=fx*dx+fz*dz;if(pr<0)return null;const ps=fx*fx+fz*fz-pr*pr;return ps>r*r?null:max(.1,pr-sqrt(r*r-ps));};
    for(const c of this.missionCrates)if(!c.destroyed){const t=rs(c.x,c.z,1.55);if(t!==null&&t<bD){bD=t;bT='crate';bObj=c;}}
    for(const e of this.foes)if(e.alive){const t=rs(e.x,e.z,.95);if(t!==null&&t<bD&&abs(oy+dy*t-e.y-1)<1.5){bD=t;bT=e.type==='pedestrian'?'pedestrian':'enemy';bObj=e;}}
    for(const v of this.vehicles.vehicles)if(!v.destroyed&&v.driver!=='player'){const t=rs(v.x,v.z,2.1);if(t!==null&&t<bD&&abs(oy+dy*t-v.y-.9)<1.6){bD=t;bT='vehicle';bObj=v;}}
    return{type:bT,target:bObj,dist:bD,point:{x:ox+dx*bD,y:oy+dy*bD,z:oz+dz*bD}};
  }

  _damageCrate(c,amt){if(c&&!c.destroyed&&(c.hp-=amt)<=0){c.destroyed=true;if(c.mesh)c.mesh.visible=false;this.spawnExplosion(c.x,c.y+.8,c.z,1.15);}}

  fireEnemyShot(e,player){
    this.spawnTracer({x:e.x+sin(e.yaw)*.7,y:e.y+1.35,z:e.z+cos(e.yaw)*.7},{x:player.x+(random()-.5)*1.4,y:player.y+1.1,z:player.z+(random()-.5)*1.4},0xff5e3a,.12);
    if(random()<.42){if(player.inVehicle&&player.vehicle)this.vehicles.damageVehicle(player.vehicle,6,this,player,null);else this.entities.damagePlayer(player,5);}
  }

  spawnTracer(start,end,colorHex=0x00f0ff,life=.14){
    const p1=new T.Vector3().copy(start),p2=new T.Vector3().copy(end),geo=new T.CylinderGeometry(.034,.034,max(.2,p1.distanceTo(p2)),6);geo.rotateX(PI*.5);
    const m=new T.Mesh(geo,new T.MeshBasicMaterial({color:colorHex,transparent:true,opacity:.95}));m.position.copy(p1).add(p2).multiplyScalar(.5);m.lookAt(p2);this.root.add(m);this.tracers.push({mesh:m,life,maxLife:life});
  }

  spawnParticle({x,y,z,vx=0,vy=1,vz=0,color=0xff9a44,size=.35,life=.45,opacity=.52,grav=0,kind:k}){
    const c=new T.Color(color),w=c.r>c.b+.2,d=c.r+c.g+c.b<.5,f=(k||(d||min(c.r,c.g,c.b)>.8?'smoke':'fire'))=='fire';size*=k?1:2;
    const m=new T.Sprite(new T.SpriteMaterial({map:d?this.smokeTex:f&&w?this.fireTex:this.glowTex,color:d?0xffffff:f&&w?c.lerp(new T.Color(1,1,1),.4):c,transparent:true,opacity,depthWrite:false,blending:f?T.AdditiveBlending:1}));m.position.set(x,y,z);m.scale.setScalar(size);this.root.add(m);
    this.particles.push({mesh:m,x,y,z,vx,vy,vz,size,baseOp:opacity,life,maxLife:life,grav});
  }

  spawnImpactSparks(x,y,z,count=10){
    const pal=[0xfffbeb,0xfacc15,0xff9a44,0xff5e3a];
    for(let i=0;i<count;i++){const a=(i/max(1,count))*PI*2+random()*.5,spd=4+random()*8;this.spawnParticle({x,y,z,vx:cos(a)*spd,vy:2+random()*4.5,vz:sin(a)*spd,color:pal[i%4],size:.11+random()*.08,life:.32+random()*.2,opacity:.95,grav:14});}
  }

  spawnExplosion(x,y,z,scale=1){
    this.audio?.playExplosion();this.renderRig?.addShake(.65*scale);this.entities.alertNearbyPedestrians(x,z,45);
    const gy=this.world.getGroundHeight(x,z),ring=new T.Mesh(this.uRng,new T.MeshBasicMaterial({color:0xff9a44,side:T.DoubleSide,transparent:true,opacity:.8,depthWrite:false}));
    ring.position.set(x,gy+.12,z);ring.scale.setScalar(1.1*scale);this.root.add(ring);this.explosions.push({ring,scale,age:0,duration:.52});
    this.flashLight.position.set(x,y+1.5,z);this.flashLight.intensity=6*scale;
    const fc=[0xfff3b0,0xffd166,0xff9a44,0xff7a2e],sc=[0x1e293b,0x334155,0x475569];
    for(const[kind,n,da,r0,r1,y0,dy,yr,vs,vy0,vy1,pal,s0,s1,l0,l1,op]of[['fire',6,1.12,.2,.75,.3,.24,.4,.9,1.2,1.4,fc,1.6,1.6,.6,.2,.6],['smoke',7,.95,.3,.9,1.8,.36,.6,.6,1.4,1.2,sc,2,1.6,1.1,.4,.95]])
      for(let i=0;i<n;i++){const a=i*da+(random()-.5)*.6,r=(r0+random()*r1)*scale;this.spawnParticle({x:x+cos(a)*r,y:y+(y0+i*dy+random()*yr)*scale,z:z+sin(a)*r,vx:cos(a)*vs*scale,vy:(vy0+random()*vy1)*scale,vz:sin(a)*vs*scale,kind,color:pal[i%pal.length],size:(s0+random()*s1)*scale,life:l0+random()*l1,opacity:op});}
    this.spawnImpactSparks(x,y+.6,z,14);const rad=8.5*scale;
    for(const c of this.missionCrates)if(!c.destroyed&&dist2D(x,z,c.x,c.z)<rad){c.destroyed=true;if(c.mesh)c.mesh.visible=false;}
    for(const e of this.foes)if(e.alive&&dist2D(x,z,e.x,e.z)<rad)this.entities.damageEntity(e,180*scale,this,null,null);
    for(const v of this.vehicles.vehicles)if(!v.destroyed&&dist2D(x,z,v.x,v.z)<rad*.85)this.vehicles.damageVehicle(v,145*scale,null,null,null);
  }

  update(dt){
    if(this.cooldown>0)this.cooldown=max(0,this.cooldown-dt);
    if(this.flashLight.intensity>0)this.flashLight.intensity=max(0,this.flashLight.intensity-14*dt);
    for(let i=this.rockets.length-1;i>=0;i--){
      const r=this.rockets[i];r.life-=dt;r.x+=r.vx*dt;r.y+=r.vy*dt;r.z+=r.vz*dt;r.mesh.position.set(r.x,r.y,r.z);
      this.spawnParticle({x:r.x,y:r.y,z:r.z,vx:(random()-.5)*1.5,vy:.8,vz:(random()-.5)*1.5,color:0x2ceaa3,size:.25,life:.25});
      const gy=this.world.getGroundHeight(r.x,r.z);
      if(r.y<=gy+.2||this.world.resolveCircleCollision(r.x,r.z,.4,r.y).hit||r.life<=0||this.vehicles.vehicles.some(v=>v.driver!=='player'&&dist2D(r.x,r.z,v.x,v.z)<2.5)||this.missionCrates.some(c=>!c.destroyed&&dist2D(r.x,r.z,c.x,c.z)<2.2)){this.spawnExplosion(r.x,max(gy+.5,r.y),r.z,1.45);this.root.remove(r.mesh);this.rockets.splice(i,1);}
    }
    for(let i=this.tracers.length-1;i>=0;i--){const t=this.tracers[i];if((t.life-=dt)<=0){this.root.remove(t.mesh);this.tracers.splice(i,1);}else t.mesh.material.opacity=.95*t.life/t.maxLife;}
    for(let i=this.particles.length-1;i>=0;i--){const p=this.particles[i];if((p.life-=dt)<=0){this.root.remove(p.mesh);this.particles.splice(i,1);}else{p.vy-=(p.grav||0)*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.mesh.position.set(p.x,p.y,p.z);const r=p.life/p.maxLife;p.mesh.material.opacity=r*p.baseOp;p.mesh.scale.setScalar(p.size*(1.55-r*.6));}}
    for(let i=this.explosions.length-1;i>=0;i--){const ex=this.explosions[i];ex.age+=dt;const t=ex.age/ex.duration;if(t>=1){this.root.remove(ex.ring);this.explosions.splice(i,1);}else{ex.ring.scale.setScalar((1.1+t*6.8)*ex.scale);ex.ring.material.opacity=(1-t)*.8;}}
  }
}
