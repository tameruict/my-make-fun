import*as T from '../vendor/three.module.min.js';
import{dist2D}from './random.js';

const{sin,atan2,hypot,PI}=Math,st=(t,l,x,z,r,ex={})=>({type:t,label:l,x,z,radius:r,...ex});
const ms=(id,index,title,contact,role,avatarColor,rewardCash,rewardRep,introLine,stages)=>({id,index,title,contact,role,avatarColor,rewardCash,rewardRep,introLine,stages});

export const STORY_MISSIONS=[
  ms('golden_arrival',1,'GOLDEN HOUR ARRIVAL','Elena Reyes','Sunset Customs Fixer','#FF3E7F',1200,120,'Grab the coral Veloce GT on Oceanfront Blvd and bring it to Sunset Customs.',[st('reach','Grab Veloce GT on Oceanfront Strip',176,-54,9),st('reach','Deliver Veloce GT to Sunset Customs',-62,-24,10,{requireVehicle:true})]),
  ms('boardwalk_shakedown',2,'BOARDWALK SHAKEDOWN','Marco Vega','Syndicate Enforcer','#FF9A44',1850,180,'Rival gunmen are shaking down our Oceanfront clubs. Clear them off the strip!',[st('combat','Clear rival crew on Oceanfront Strip',176,36,14,{enemies:[[173,34],[179,39],[175,44]]}),st('reach','Meet at Downtown Spire Plaza',0,-16,10)]),
  ms('harbor_manifest',3,'HARBOR MANIFEST','Elena Reyes','Sunset Customs Fixer','#FF3E7F',2600,250,'Contraband crates just docked under the red gantry cranes at Palmera Harbor. Blow them open!',[st('destroy_crates','Blow 3 crates at Harbor Vault',-125,158,16,{crates:[[-128,160],[-122,162],[-125,154]],enemies:[[-132,158],[-118,160]]}),st('reach','Escape Harbor perimeter',-90,75,11)]),
  ms('causeway_blitz',4,'CAUSEWAY BLITZ','Marco Vega','Syndicate Enforcer','#FF9A44',3200,300,'PKPD locked down Coral Keys Causeway! Punch through at full throttle to Sunset Hills.',[st('reach','Hit Coral Keys Causeway entrance',185,0,11),st('reach','Cross Causeway to Sunset Hills',348,0,12,{wantedOnStart:3})]),
  ms('neon_raid',5,'NEON AUTO RAID','Capt. Solis','Arms Broker','#00F0FF',4200,380,'A rival arms convoy is staged in Neon Auto Row. Wipe the guards and secure Sunset Hills.',[st('combat','Clear arms convoy in Neon Auto Row',-145,-88,14,{enemies:[[-148,-86],[-142,-92],[-150,-94]]}),st('reach','Deliver manifest to Sunset Hills',374,-24,11)]),
  ms('palmera_heist',6,'PALMERA RESERVE HEIST','Elena Reyes','Heist Mastermind','#2CEAA3',8500,650,'Breach Downtown Spire Reserve crates, survive the 4-Star SWAT lockdown, and reach the Island Helipad!',[st('destroy_crates','Breach Downtown Spire Vault',0,48,14,{crates:[[-3,48],[3,48]],enemies:[[-6,52],[6,52],[0,55]],wantedOnStart:4}),st('reach','Reach Sunset Hills Helipad',416,-24,12)]),
];

export const SIDE_ACTIVITIES=[
  ms('street_race',0,'OCEANFRONT SPRINT','Marco Vega','Race Organizer','#2CEAA3',1500,150,'Hit all 3 coastal checkpoints before the turbo cools!',[st('reach','Checkpoint 1/3 — Oceanfront',180,0,11),st('reach','Checkpoint 2/3 — Harbor Turn',90,90,11),st('reach','Finish — Downtown Central',0,0,11)]),
  ms('drop_run',0,'COURIER DROP','Elena Reyes','Fixer','#FF3E7F',1400,140,'Run this ECU package from Sunset Garage across the Causeway!',[st('reach','Grab ECU at Sunset Garage',-62,-24,10),st('reach','Deliver to Sunset Hills Villa',374,-24,11)]),
  ms('vigilante',0,'HARBOR SWEEP','Capt. Solis','Contract Broker','#00F0FF',1750,170,'Smugglers fortified the eastern pier. Clean out the crew!',[st('combat','Clear smugglers at Harbor',-75,165,14,{enemies:[[-78,165],[-72,168],[-75,160]]})]),
];

export class MissionManager{
  constructor(scene,world,vehicles,entities,combat,police,audio){
    this.scene=scene;this.world=world;this.vehicles=vehicles;this.entities=entities;this.combat=combat;this.police=police;this.audio=audio;
    this.root=new T.Group();scene.add(this.root);this.completedMissions=new Set();this.currentMission=null;this.stageIndex=0;this.stageEnemies=[];this.crates=[];this.time=0;
    const g=new T.Group(),p=new T.Mesh(new T.CylinderGeometry(1.3,1.3,28,18,1,true),new T.MeshBasicMaterial({color:0xffb703,transparent:true,opacity:.24,side:T.DoubleSide,depthWrite:false}));
    const r=new T.Mesh(new T.RingGeometry(2.6,3.6,28),new T.MeshBasicMaterial({color:0x00f0ff,side:T.DoubleSide,transparent:true,opacity:.88}));
    p.position.y=14;r.rotation.x=-PI*.5;r.position.y=.14;g.add(p,r);this.root.add(g);this.beacon={group:g,pillar:p,ring:r};
    const sh=new T.Shape();sh.moveTo(0,1.35);sh.lineTo(1.55,-.55);sh.lineTo(1.05,-.95);sh.lineTo(0,.35);sh.lineTo(-1.05,-.95);sh.lineTo(-1.55,-.55);sh.closePath();
    const cG=new T.ShapeGeometry(sh);cG.rotateX(-PI*.5);
    this.chevrons=Array.from({length:14},()=>{const m=new T.Mesh(cG,new T.MeshBasicMaterial({color:0x00f0ff,transparent:true,opacity:.72,side:T.DoubleSide,depthWrite:false}));m.visible=false;this.root.add(m);return m;});
    this.startMission('golden_arrival');
  }

  startMission(id,onBanner=null,onDialogue=null){
    const m=STORY_MISSIONS.find(x=>x.id===id)||SIDE_ACTIVITIES.find(x=>x.id===id);if(!m)return false;
    this._cleanup();this.currentMission=m;this.stageIndex=0;this._setupStage(0);
    onDialogue?.({speaker:m.contact,role:m.role,color:m.avatarColor,text:m.introLine});onBanner?.(`MISSION STARTED // ${m.title}`,m.stages[0].label);return true;
  }

  _cleanup(){this.entities.clearMissionEnemies();this.stageEnemies=[];for(const c of this.crates)if(c.mesh?.parent)c.mesh.parent.remove(c.mesh);this.crates=[];this.combat.setMissionCrates([]);}

  _setupStage(idx){
    this._cleanup();const s=this.currentMission?.stages[idx];if(!s)return;
    this.beacon.group.visible=true;this.beacon.group.position.set(s.x,this.world.getGroundHeight(s.x,s.z),s.z);
    if(s.wantedOnStart)this.police?.setWantedLevel(s.wantedOnStart,`${this.currentMission.title} Alert`);
    if(s.enemies)for(const[ex,ez]of s.enemies)this.stageEnemies.push(this.entities.spawnEnemy(ex,ez,{missionTag:this.currentMission.id,shirtColor:0xdc2626}));
    if(s.crates)this.spawnMissionCrates(s.crates);
  }

  spawnMissionCrates(coords){
    for(const c of this.crates)if(c.mesh?.parent)c.mesh.parent.remove(c.mesh);this.crates=[];
    const cM=new T.MeshStandardMaterial({color:0xf59e0b,emissive:0xff5e3a,emissiveIntensity:.55,roughness:.4}),bM=new T.MeshBasicMaterial({color:0x00f0ff});
    for(const[cx,cz]of coords){const cy=this.world.getGroundHeight(cx,cz),g=new T.Group(),bx=new T.Mesh(new T.BoxGeometry(1.7,1.7,1.7),cM);g.position.set(cx,cy+.85,cz);bx.castShadow=true;g.add(bx,new T.Mesh(new T.BoxGeometry(1.78,.25,1.78),bM));this.root.add(g);this.crates.push({mesh:g,x:cx,y:cy,z:cz,hp:60,destroyed:false});}
    this.combat.setMissionCrates(this.crates);return this.crates;
  }

  getActiveStage(){return this.currentMission?.stages[this.stageIndex]||null;}
  getTargetPoint(){const s=this.getActiveStage();return s?{x:s.x,z:s.z}:{x:-62,z:-24};}

  getObjectiveText(){
    const s=this.getActiveStage();if(!this.currentMission||!s)return{title:'FREE ROAM // PALMERA KEYS',objective:'Explore the city or press [M] for Missions',stageIndex:0,totalStages:1,nextLabel:'Open [M] Map to launch contracts'};
    let extra='';if(s.type==='combat'&&this.stageEnemies.length)extra=` (${this.stageEnemies.filter(e=>e.alive).length} left)`;else if(s.type==='destroy_crates'&&this.crates.length)extra=` (${this.crates.filter(c=>!c.destroyed).length} left)`;
    const total=this.currentMission.stages.length,nx=this.currentMission.stages[this.stageIndex+1];
    return{title:`${this.currentMission.index>0?`MISSION ${this.currentMission.index}/6`:'CONTRACT'} · ${this.currentMission.title}`,objective:`${s.label}${extra}`,stageIndex:this.stageIndex+1,totalStages:total,nextLabel:nx?`NEXT: ${nx.label}`:`REWARD: +$${this.currentMission.rewardCash.toLocaleString()} · +${this.currentMission.rewardRep} RP`};
  }

  updateGpsChevrons(player,overridePath=null){
    const tgt=this.getTargetPoint(),path=overridePath||this.world.computeGpsPath(player.x,player.z,tgt.x,tgt.z),samples=[];let accum=6;
    for(let i=0;i<path.length-1&&samples.length<this.chevrons.length;i++){
      const a=path[i],b=path[i+1],dx=b.x-a.x,dz=b.z-a.z,len=hypot(dx,dz);if(len<.5)continue;
      const yaw=atan2(dx,dz);let d=accum;while(d<=len&&samples.length<this.chevrons.length){const t=d/len;samples.push({x:a.x+dx*t,z:a.z+dz*t,yaw});d+=7.5;}accum=d-len;
    }
    this.chevrons.forEach((m,idx)=>{const sp=samples[idx];if(!sp){m.visible=false;return;}m.visible=true;m.position.set(sp.x,this.world.getGroundHeight(sp.x,sp.z)+.08,sp.z);m.rotation.y=sp.yaw;m.material.opacity=(.5+.4*sin(this.time*5-idx*.65))*(1-idx/(this.chevrons.length+2));m.material.color.setHex(idx%3===0?0xffd166:0x00f0ff);});
  }

  update(dt,player,onBanner=null,onDialogue=null){
    this.time+=dt;if(this.beacon.group.visible){const sc=1+sin(this.time*4)*.14;this.beacon.ring.scale.set(sc,sc,1);this.beacon.pillar.rotation.y+=dt*.8;}
    this.updateGpsChevrons(player);const s=this.getActiveStage();if(!this.currentMission||!s)return;
    const done=s.type==='reach'?dist2D(player.x,player.z,s.x,s.z)<=(s.radius||10)&&(!s.requireVehicle||player.inVehicle):s.type==='combat'?this.stageEnemies.every(e=>!e.alive):this.crates.every(c=>c.destroyed);
    if(!done)return;
    if(++this.stageIndex<this.currentMission.stages.length){this._setupStage(this.stageIndex);this.audio?.playCash();}
    else{
      const m=this.currentMission;this._cleanup();player.cash+=m.rewardCash;player.respect+=m.rewardRep;this.completedMissions.add(m.id);
      if(player.stats){player.stats.totalCashEarned+=m.rewardCash;if(m.index===0)player.stats.contractsDone=(player.stats.contractsDone||0)+1;}
      this.audio?.playMissionBanner();onBanner?.(`MISSION PASSED // ${m.title}`,`+$${m.rewardCash.toLocaleString()}   +${m.rewardRep} REP`);
      const next=STORY_MISSIONS.find(sm=>!this.completedMissions.has(sm.id));
      if(next){this.currentMission=next;this.stageIndex=0;this._setupStage(0);onDialogue?.({speaker:next.contact,role:next.role,color:next.avatarColor,text:next.introLine});}
      else{this.currentMission=null;this.beacon.group.visible=false;}
    }
  }
}
