import*as T from '../vendor/three.module.min.js';
import{clamp,dist2D,wrapAngle}from './random.js';
import{orientCruiserShooter}from './vehicles.js';

const{sin,cos,atan2,max,min,floor,random,round,PI}=Math;
const CS=['VIPER-14','CORAL-22','MARLIN-08','TAC-09','AEGIS-04','REEF-11','SIERRA-07'];
const mk=(g,geo,m,x=0,y=0,z=0,s=null,rx=0)=>{const o=new T.Mesh(geo,m);o.position.set(x,y,z);if(s)o.scale.set(...s);if(rx)o.rotation.x=rx;g.add(o);return o;};

export class PoliceManager{
  constructor(scene,world,vehicles,entities,rng,audio){
    this.scene=scene;this.world=world;this.vehicles=vehicles;this.entities=entities;this.rng=rng;this.audio=audio;
    this.root=new T.Group();scene.add(this.root);this.wantedLevel=this.heatScore=this.evadeTimer=this.spawnTimer=this.jamTimer=this.callsignIdx=0;
    this.evadeDuration=16;this.lastCrime='';this.inSight=true;this.units=[];this.roadblocks=[];this.heli=this._buildHeli();this.heli.group.visible=false;this.root.add(this.heli.group);
  }

  _buildHeli(){
    const g=new T.Group(),nv=new T.MeshStandardMaterial({color:0x0f2a42,roughness:.28,metalness:.55}),wh=new T.MeshStandardMaterial({color:0xf8fafc,roughness:.3}),tl=new T.MeshBasicMaterial({color:0x00f0ff}),gl=new T.MeshStandardMaterial({color:0x93c5fd,emissive:0x0284c7,emissiveIntensity:.5,roughness:.08,metalness:.65});
    mk(g,new T.SphereGeometry(1.55,16,12),wh,0,.22,0,[.92,.68,2.25]).castShadow=true;
    for(const a of[[new T.SphereGeometry(1.5,16,12),nv,0,-.18,.05,[.94,.55,2.15]],[new T.BoxGeometry(2.65,.22,3.8),tl,0,.05,-.1],[new T.SphereGeometry(1.24,14,10),gl,0,.22,1.55,[.88,.65,1.45]],[new T.CylinderGeometry(.22,.38,6.2,8),wh,0,.35,-4.8,null,PI*.5],[new T.BoxGeometry(.24,1.85,1.2),nv,0,1,-7.6],[new T.BoxGeometry(.26,.55,1.25),tl,0,1.55,-7.6]])mk(g,...a);
    for(const sx of[-1.15,1.15])mk(g,new T.CylinderGeometry(.08,.08,4.8,6),nv,sx,-1.42,.4,null,PI*.5);
    const mr=new T.Group();mr.position.set(0,1.38,.15);mk(mr,new T.BoxGeometry(12.2,.08,.38),nv);mk(mr,new T.BoxGeometry(.38,.08,12.2),nv);
    mk(mr,new T.CylinderGeometry(5.9,5.9,.04,24),new T.MeshBasicMaterial({color:0xe2e8f0,transparent:true,opacity:.24,depthWrite:false}));
    g.add(mr);const tr=mk(g,new T.BoxGeometry(.12,1.95,.24),tl,.3,1.02,-7.6);
    for(const[sx,col]of[[-.95,0xff1744],[.95,0x00f0ff]])mk(g,new T.SphereGeometry(.28,8,8),new T.MeshBasicMaterial({color:col}),sx,-.92,1.45);
    const cG=new T.ConeGeometry(6.8,36,22,1,true);cG.translate(0,-18,0);cG.rotateX(PI*.5);const bp=new T.Group();bp.position.set(0,-.95,2.3);
    const bm=mk(bp,cG,new T.MeshBasicMaterial({color:0xfef3c7,transparent:true,opacity:.085,side:T.DoubleSide,depthWrite:false}));
    g.add(bp);g.scale.setScalar(1.18);return{group:g,mainRotor:mr,tailRotor:tr,beamPivot:bp,beamMesh:bm,x:170,y:26,z:-30,orbitAngle:0};
  }

  setWantedLevel(stars,crime='PKPD Dispatch Alert'){this.wantedLevel=clamp(round(stars),0,5);this.heatScore=this.wantedLevel;this.lastCrime=crime;this.evadeTimer=0;if(this.wantedLevel<3&&this.heli)this.heli.group.visible=false;}
  addHeat(amt,crime='Code 10-31 Violation'){this.heatScore=clamp(this.heatScore+amt,0,5.5);const n=min(5,max(1,floor(this.heatScore+.35)));if(n>this.wantedLevel)this.wantedLevel=n;this.lastCrime=crime;this.evadeTimer=0;}

  clearWanted(reward=false,player=null,onNotify=null){
    const had=this.wantedLevel;this.wantedLevel=this.heatScore=this.evadeTimer=this.jamTimer=0;this.lastCrime='';
    if(this.heli)this.heli.group.visible=false;for(const u of this.units){u.sirenOn=false;u.driver='traffic';if(u.shooterGroup)u.shooterGroup.visible=false;}this.units.length=0;
    if(reward&&had>0&&player){const cb=200*had,rb=40*had;player.cash+=cb;player.respect+=rb;if(player.stats){player.stats.copsEvaded++;player.stats.totalCashEarned+=cb;}onNotify?.(`PKPD EVADED! +$${cb} +${rb} REP`);}
  }

  spawnPursuitUnit(x,z,yaw=0,swat=false,callsign=null){
    const v=this.vehicles.spawnVehicle(swat?'aegis_armored':'pkpd_interceptor',x,z,yaw,{driver:'police',sirenOn:true,speed:22});
    v.callsign=callsign||CS[this.callsignIdx++%CS.length];v.flankSign=this.units.length%2===0?1:-1;v.aiRole='IN PURSUIT';v.shootCd=.8+random()*.8;this.units.push(v);return v;
  }

  spawnRoadblock(x,z,yaw=0,swat=true){
    const rx=-cos(yaw),rz=sin(yaw),fx=sin(yaw),fz=cos(yaw),v1=this.spawnPursuitUnit(x-rx*3.6,z-rz*3.6,yaw+PI*.38,swat,'AEGIS-04'),v2=this.spawnPursuitUnit(x+rx*3.6,z+rz*3.6,yaw-PI*.38,swat,'TAC-09');
    v1.speed=v2.speed=0;v1.isRoadblock=v2.isRoadblock=true;v1.aiRole=v2.aiRole='ROADBLOCK';
    const c1=this.entities.spawnPoliceOfficer(x-rx*2.2-fx*2.2,z-rz*2.2-fz*2.2,swat),c2=this.entities.spawnPoliceOfficer(x+rx*2.2-fx*2.2,z+rz*2.2-fz*2.2,swat);
    c1.yaw=c2.yaw=yaw;this.roadblocks.push({x,z,v1,v2,c1,c2});return{v1,v2,c1,c2};
  }

  spawnHelicopterNear(x,z,y=26,tx=null,tz=null,roll=.22,pitch=.14){
    Object.assign(this.heli,{x,y,z});this.heli.group.visible=true;this.heli.group.position.set(x,y,z);
    const lx=tx??x,lz=tz??z+15;this.heli.group.rotation.set(pitch,atan2(lx-x,lz-z),roll);this.heli.beamPivot.lookAt(lx,.5,lz);return this.heli;
  }

  getDispatchTelemetry(player){
    const active=[];if(this.heli?.group.visible)active.push({callsign:'AIR-1',badge:'SPOTLIGHT',distance:round(dist2D(this.heli.x,this.heli.z,player.x,player.z)),color:'#00F0FF'});
    for(const u of this.units){if(u.destroyed)continue;const d=round(dist2D(u.x,u.z,player.x,player.z)),badge=u.isRoadblock?'ROADBLOCK':d<22?'RAMMING':(u.aiRole==='FLANKING'?'FLANKING':'IN PURSUIT');active.push({callsign:u.callsign||'PKPD-01',badge,distance:d,color:badge==='RAMMING'?'#FF3E7F':badge==='ROADBLOCK'?'#F59E0B':badge==='FLANKING'?'#FF9A44':'#38BDF8'});}
    active.sort((a,b)=>(a.badge==='SPOTLIGHT'?-1:b.badge==='SPOTLIGHT'?1:a.distance-b.distance));
    return{codeLabel:this.jamTimer>0?`JAMMED (${Math.ceil(this.jamTimer)}s)`:this.wantedLevel>=4?'CODE 3 // LOCKDOWN':'CODE 3 // PURSUIT',inSight:this.inSight&&this.jamTimer<=0,totalCount:active.length,roadblockAhead:active.some(u=>u.badge==='ROADBLOCK'),units:active.slice(0,4)};
  }

  update(dt,player,combat,onNotify=null){
    if(this.wantedLevel<=0)return;if(this.jamTimer>0)this.jamTimer=max(0,this.jamTimer-dt);this.spawnTimer-=dt;
    if(this.jamTimer<=0&&this.units.filter(u=>!u.destroyed&&!u.isRoadblock).length<min(4,this.wantedLevel+1)&&this.spawnTimer<=0){
      this.spawnTimer=4.5;const ang=player.yaw+PI+(random()-.5)*1.4,sx=clamp(player.x+sin(ang)*44,-200,390),sz=clamp(player.z+cos(ang)*44,-200,200);
      if(!this.world.isWater(sx,sz))this.spawnPursuitUnit(sx,sz,atan2(player.x-sx,player.z-sz),this.wantedLevel>=4&&random()<.5);
    }
    let close=false;
    for(let i=this.units.length-1;i>=0;i--){
      const u=this.units[i];if(u.destroyed||u.driver==='player'){this.units.splice(i,1);continue;}
      const d=dist2D(u.x,u.z,player.x,player.z);if(d<55)close=true;if(u.isRoadblock){u.aiRole='ROADBLOCK';continue;}if(this.jamTimer>0){u.speed=max(4,u.speed-10*dt);continue;}
      const flank=d>=22&&d<65&&u.flankSign;u.aiRole=d<22?'RAMMING':flank?'FLANKING':'IN PURSUIT';
      u.steerAngle=clamp(wrapAngle(atan2(player.x-u.x,player.z-u.z)+(flank?u.flankSign*.45:0)-u.yaw)*1.8,-1,1);
      u.yaw=wrapAngle(u.yaw+u.steerAngle*2.4*dt);u.speed+=((d>10?29+this.wantedLevel*2.5:18)-u.speed)*min(1,dt*3.5);
      const nx=u.x+sin(u.yaw)*u.speed*dt,nz=u.z+cos(u.yaw)*u.speed*dt;
      if(!this.world.isWater(nx,nz)){const col=this.world.resolveCircleCollision(nx,nz,1.75,u.y);u.x=col.x;u.z=col.z;u.y=this.world.getGroundHeight(u.x,u.z);}
      if(u.shooterGroup){const fire=this.wantedLevel>=3&&d<32;u.shooterGroup.visible=fire;if(fire){const mz=orientCruiserShooter(u,player.x,player.z);if(combat&&(u.shootCd-=dt)<=0){u.shootCd=1.2+random()*.8;combat.spawnTracer(mz,{x:player.x+(random()-.5)*2,y:player.y+1,z:player.z+(random()-.5)*2},0xff9a44,.12);}}}
    }
    if(this.wantedLevel>=3||this.heli.group.visible){
      this.heli.group.visible=true;this.heli.mainRotor.rotation.y+=dt*22;this.heli.tailRotor.rotation.x+=dt*26;this.heli.orbitAngle+=dt*.55;
      if(this.jamTimer<=0){this.heli.x+=(player.x+cos(this.heli.orbitAngle)*18-this.heli.x)*min(1,dt*2.2);this.heli.z+=(player.z+sin(this.heli.orbitAngle)*18-this.heli.z)*min(1,dt*2.2);this.heli.y=24+sin(this.heli.orbitAngle*2)*1.5;this.heli.group.position.set(this.heli.x,this.heli.y,this.heli.z);this.heli.group.rotation.set(.12,atan2(player.x-this.heli.x,player.z-this.heli.z),sin(this.heli.orbitAngle)*.22);this.heli.beamPivot.lookAt(player.x,player.y+.5,player.z);close=true;}
    }
    this.inSight=close;if(!close||this.jamTimer>0){if((this.evadeTimer+=dt)>=this.evadeDuration)this.clearWanted(true,player,onNotify);}else this.evadeTimer=max(0,this.evadeTimer-dt*.5);
  }
}
