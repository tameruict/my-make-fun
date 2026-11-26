import*as T from '../vendor/three.module.min.js';
import{ROAD_X}from './config.js';
import{clamp,dist2D,wrapAngle}from './random.js';

const{abs,sin,cos,atan2,max,min,random,PI}=Math;
const OUTFITS=[[0xff3e7f,0xf8fafc,0x00f0ff],[0x00f0ff,0x1e293b,0xff9a44],[0xff9a44,0x334155,0xfef08a],[0x2ceaa3,0x0f172a,0x38bdf8],[0xfacc15,0x1e293b,0xff3e7f],[0xf8fafc,0x0ea5e9,0xff5e3a]];
const std=(c,o={})=>new T.MeshStandardMaterial({color:c,...o});
const addP=(p,geo,m,x=0,y=0,z=0,s=null,cs=0)=>{const o=new T.Mesh(geo,m);o.position.set(x,y,z);if(s)o.scale.set(...s);if(cs)o.castShadow=true;p.add(o);return o;};

export class EntityManager{
  constructor(scene,world,rng,audio){
    this.scene=scene;this.world=world;this.rng=rng;this.audio=audio;this.root=new T.Group();scene.add(this.root);
    this.pedestrians=[];this.enemies=[];this.pickups=[];this.nextId=1;this.shGeo=new T.CircleGeometry(.46,16);this.shGeo.rotateX(-PI*.5);
    this.shMat=new T.MeshBasicMaterial({color:0x090d16,transparent:true,opacity:.44,depthWrite:false});
    this.geos={torso:new T.CylinderGeometry(.24,.2,.68,12),belt:new T.CylinderGeometry(.25,.25,.11,12),head:new T.SphereGeometry(.22,12,10),neck:new T.CylinderGeometry(.075,.085,.14,8),hair:new T.SphereGeometry(.232,12,8,0,PI*2,0,PI*.56),shades:new T.CylinderGeometry(.228,.228,.085,12,1,false,-PI*.34,PI*.68),shoulder:new T.SphereGeometry(.11,8,8),arm:new T.CylinderGeometry(.08,.07,.52,10),hand:new T.SphereGeometry(.07,8,6),leg:new T.CylinderGeometry(.102,.086,.62,10),shoe:new T.SphereGeometry(.105,8,6),gun:new T.BoxGeometry(.09,.14,.48),marker:new T.OctahedronGeometry(.16,0)};
  }

  createHumanoidMesh({shirtColor=0xff5e3a,pantsColor=0x1e293b,skinColor=0xe8b48b,accentColor=0x00f0ff,hasGun=false,hasHelmet=false,markerColor=null}={}){
    const g=new T.Group(),gs=this.geos,sM=std(shirtColor,{roughness:.55}),pM=std(pantsColor,{roughness:.72}),skM=std(skinColor,{roughness:.58}),aM=std(accentColor,{emissive:accentColor,emissiveIntensity:.28}),dM=std(0x0f172a,{roughness:.4}),hM=hasHelmet?dM:std(0x1c1917,{roughness:.65});
    for(const b of[[this.shGeo,this.shMat,0,.03,0,[1,1,.82]],[gs.torso,sM,0,1.12,0,[1.12,1,.72],1],[gs.belt,aM,0,1.24,0,[1.14,1,.75]],[gs.neck,skM,0,1.5,0],[gs.head,skM,0,1.72,0,null,1],[gs.hair,hM,0,1.74,0,hasHelmet?[1.06,1.08,1.06]:[1.02,.96,1.02]],[gs.shades,dM,0,1.74,.01]])addP(g,...b);
    if(markerColor)addP(g,gs.marker,new T.MeshBasicMaterial({color:markerColor}),0,2.35,0);
    const mkA=(sx,gun)=>{const ag=new T.Group();ag.position.set(sx*.34,1.38,0);addP(ag,gs.shoulder,sM,0,0,0,null,1);addP(ag,gs.arm,sM,0,-.26,0,null,1);addP(ag,gs.hand,skM,0,-.53,0);const gm=gun?addP(ag,gs.gun,std(0x1e293b,{metalness:.75,roughness:.25}),0,-.53,.2):null;if(gm)gm.visible=Boolean(hasGun);g.add(ag);return{arm:ag,gunMesh:gm};};
    const la=mkA(-1,0),ra=mkA(1,1);if(hasGun){la.arm.rotation.x=-PI*.36;la.arm.rotation.z=.22;}
    const mkL=lx=>{const lg=new T.Group();lg.position.set(lx,.74,0);addP(lg,gs.leg,pM,0,-.31,0,null,1);addP(lg,gs.shoe,dM,0,-.66,.04,[.95,.55,1.45]);g.add(lg);return lg;};
    return{group:g,leftArm:la.arm,rightArm:ra.arm,leftLeg:mkL(-.14),rightLeg:mkL(.14),gunMesh:ra.gunMesh};
  }

  createPlayerMesh(){const p=this.createHumanoidMesh({shirtColor:0xff5e3a,pantsColor:0x0f172a,accentColor:0x00f0ff,hasGun:true});this.scene.add(p.group);return p;}

  spawnPedestrianAt(x,z,yaw=0,outfitIdx=0,walkPhase=0){
    const[s,p,a]=OUTFITS[outfitIdx%OUTFITS.length],parts=this.createHumanoidMesh({shirtColor:s,pantsColor:p,accentColor:a}),y=this.world.getGroundHeight(x,z),sw=sin(walkPhase)*.45;
    parts.group.position.set(x,y,z);parts.group.rotation.y=yaw;parts.leftLeg.rotation.x=sw;parts.rightLeg.rotation.x=-sw;parts.leftArm.rotation.x=-sw*.7;parts.rightArm.rotation.x=sw*.7;this.root.add(parts.group);
    const ped={id:this.nextId++,type:'pedestrian',parts,mesh:parts.group,x,y,z,yaw,speed:2.3+(outfitIdx%3)*.35,hp:55,alive:true,panicTimer:0,walkPhase};
    this.pedestrians.push(ped);return ped;
  }

  spawnPedestrians(count=52){
    for(let i=0;i<count;i++){const x=i%3===0?194+(i%4)*2.5:i%3===1?165.5+(i%3)*1.4:ROAD_X[i%ROAD_X.length]+(i%2===0?11.2:-11.2);this.spawnPedestrianAt(x,-195+((i*31)%390),i%2===0?0:PI,i,i*.7);}
  }

  spawnEnemy(x,z,opts={}){
    const swat=opts.faction==='swat',cop=opts.faction==='police'||swat,parts=this.createHumanoidMesh({shirtColor:swat?0x1e293b:cop?0x1d4ed8:(opts.shirtColor||0xb91c1c),pantsColor:0x0f172a,accentColor:cop?0x38bdf8:0xff9a44,hasGun:true,hasHelmet:swat,markerColor:cop?null:0xff3e7f});
    parts.rightArm.rotation.x=-PI*.46;const y=this.world.getGroundHeight(x,z),yaw=opts.yaw??0;parts.group.position.set(x,y,z);parts.group.rotation.y=yaw;this.root.add(parts.group);
    const hp=opts.hp||(swat?130:cop?90:85),e={id:this.nextId++,type:cop?'police':'enemy',faction:opts.faction||'syndicate',parts,mesh:parts.group,x,y,z,yaw,hp,maxHp:hp,alive:true,shootCooldown:.4+random()*.6,missionTag:opts.missionTag||null,walkPhase:random()*6};
    this.enemies.push(e);return e;
  }

  spawnPoliceOfficer(x,z,isSwat=false){return this.spawnEnemy(x,z,{faction:isSwat?'swat':'police',hp:isSwat?135:95});}
  clearMissionEnemies(tag=null){for(let i=this.enemies.length-1;i>=0;i--){const e=this.enemies[i];if(tag?e.missionTag===tag:e.missionTag!==null){this.root.remove(e.mesh);this.enemies.splice(i,1);}}}

  spawnPickup(x,z,kind='cash',amount=120){
    const col={cash:0x2ceaa3,health:0xff3e7f,armor:0x00f0ff,ammo:0xff9a44}[kind]||0x2ceaa3,mesh=new T.Mesh(new T.OctahedronGeometry(.45,0),std(col,{emissive:col,emissiveIntensity:.7,roughness:.2})),y=this.world.getGroundHeight(x,z)+.75;
    mesh.position.set(x,y,z);this.root.add(mesh);this.pickups.push({mesh,x,y,z,kind,amount,phase:random()*6});
  }

  alertNearbyPedestrians(x,z,r=32){for(const p of this.pedestrians)if(p.alive&&dist2D(x,z,p.x,p.z)<r){p.panicTimer=8;p.yaw=atan2(p.x-x,p.z-z);}}
  damagePlayer(player,amt){if(player.armor>0){const a=min(player.armor,amt*.72);player.armor=max(0,player.armor-a);amt-=a;}player.health=max(0,player.health-amt);player.hitFlash=.35;}

  damageEntity(e,amt,combat,player,police){
    if(!e||!e.alive)return;e.hp-=amt;combat?.spawnParticle({x:e.x,y:e.y+1.2,z:e.z,vx:(random()-.5)*3,vy:1.5+random()*2,vz:(random()-.5)*3,color:0xff3e7f,size:.22,life:.32});
    if(e.hp<=0){
      e.alive=false;e.mesh.rotation.x=-PI*.48;e.mesh.position.y=e.y+.22;if(player?.stats&&e.type!=='pedestrian')player.stats.takedowns++;
      this.spawnPickup(e.x+.4,e.z,'cash',e.type==='pedestrian'?45:140);if(e.type!=='pedestrian'&&random()<.55)this.spawnPickup(e.x-.4,e.z+.3,'ammo',24);
      if(police){if(e.type==='police')police.addHeat(1.15,'Officer Down');else if(e.type==='pedestrian')police.addHeat(.75,'Civilian Assault');}
      setTimeout(()=>{if(e.mesh?.parent)e.mesh.parent.remove(e.mesh);},4500);
    }
  }

  checkVehicleImpacts(v,combat,player,police){for(const e of[...this.pedestrians,...this.enemies])if(e.alive&&dist2D(v.x,v.z,e.x,e.z)<2.15&&abs(v.y-e.y)<1.8){this.damageEntity(e,120,combat,player,police);if(v.driver==='player')this.audio?.playCrash(.45);}}

  update(dt,player,combat,vehicles){
    for(const p of this.pedestrians){
      if(!p.alive)continue;let spd=p.speed;if(p.panicTimer>0){p.panicTimer-=dt;spd*=2.4;}
      p.x+=sin(p.yaw)*spd*dt;p.z+=cos(p.yaw)*spd*dt;if(p.z>210||p.z<-210||p.x>240||p.x<-210||this.world.isWater(p.x,p.z)){p.yaw=wrapAngle(p.yaw+PI);p.x=clamp(p.x,-210,238);p.z=clamp(p.z,-210,210);}
      p.y=this.world.getGroundHeight(p.x,p.z);p.mesh.position.set(p.x,p.y,p.z);p.mesh.rotation.y=p.yaw;p.walkPhase+=dt*spd*3.2;const sw=sin(p.walkPhase)*.45;p.parts.leftLeg.rotation.x=sw;p.parts.rightLeg.rotation.x=-sw;p.parts.leftArm.rotation.x=-sw*.7;p.parts.rightArm.rotation.x=sw*.7;
    }
    for(const e of this.enemies){
      if(!e.alive)continue;const d=dist2D(e.x,e.z,player.x,player.z);
      if(d<52){
        e.yaw=atan2(player.x-e.x,player.z-e.z);e.parts.rightArm.rotation.x=-PI*.46;
        if(d>15){const ms=e.type==='police'?4.8:4.2,col=this.world.resolveCircleCollision(e.x+sin(e.yaw)*ms*dt,e.z+cos(e.yaw)*ms*dt,.65,e.y);e.x=col.x;e.z=col.z;e.walkPhase+=dt*11;const sw=sin(e.walkPhase)*.5;e.parts.leftLeg.rotation.x=sw;e.parts.rightLeg.rotation.x=-sw;}
        if((e.shootCooldown-=dt)<=0&&d<42&&combat){e.shootCooldown=e.faction==='swat'?.55:.85+random()*.45;combat.fireEnemyShot(e,player,vehicles);}
      }
      e.y=this.world.getGroundHeight(e.x,e.z);e.mesh.position.set(e.x,e.y,e.z);e.mesh.rotation.y=e.yaw;
    }
    for(let i=this.pickups.length-1;i>=0;i--){
      const pk=this.pickups[i];pk.phase+=dt*3.5;pk.mesh.rotation.y+=dt*2.4;pk.mesh.position.y=pk.y+sin(pk.phase)*.14;
      if(dist2D(pk.x,pk.z,player.x,player.z)<2.5){
        if(pk.kind==='cash'){player.cash+=pk.amount;if(player.stats)player.stats.totalCashEarned+=pk.amount;}else if(pk.kind==='health')player.health=min(player.maxHealth,player.health+pk.amount);else if(pk.kind==='armor')player.armor=min(player.maxArmor,player.armor+pk.amount);else{const w=player.activeWeapon==='fists'?'smg':player.activeWeapon;player.ammo[w]=(player.ammo[w]||0)+pk.amount;}
        this.audio?.playCash();this.root.remove(pk.mesh);this.pickups.splice(i,1);
      }
    }
  }
}
