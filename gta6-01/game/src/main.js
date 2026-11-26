import{AudioEngine}from './audio.js';
import{CombatSystem}from './combat.js';
import{TIME_PRESETS,WEAPONS}from './config.js';
import{CrewManager}from './crew.js';
import{EntityManager}from './entities.js';
import{HudController}from './hud.js';
import{InputManager}from './input.js';
import{MissionManager}from './missions.js';
import{PoliceManager}from './police.js';
import{ProgressionManager}from './progression.js';
import{clamp,createRng,dist2D,wrapAngle}from './random.js';
import{RendererRig}from './render.js';
import{applyShotPreset}from './shots.js';
import{createProceduralTextures}from './textures.js';
import{VehicleManager}from './vehicles.js';
import{CityWorld}from './world.js';

const{abs,sin,cos,max,min,PI}=Math;

export class PalmeraKeysGame{
  constructor(){
    const q=new URLSearchParams(window.location.search);this.seed=parseInt(q.get('seed')||'1',10)||1;this.shotParam=q.get('shot')||null;
    this.rng=createRng(this.seed);this.canvas=document.getElementById('game');this.input=new InputManager(this.canvas);this.audio=new AudioEngine();
    this.renderRig=new RendererRig(this.canvas);this.textures=createProceduralTextures();const sc=this.renderRig.scene;
    this.world=new CityWorld(sc,this.rng,this.textures);this.world.build();
    this.vehicles=new VehicleManager(sc,this.world,this.rng,this.audio);this.entities=new EntityManager(sc,this.world,this.rng,this.audio);
    this.combat=new CombatSystem(sc,this.world,this.entities,this.vehicles,this.audio,this.renderRig);
    this.police=new PoliceManager(sc,this.world,this.vehicles,this.entities,this.rng,this.audio);
    this.missions=new MissionManager(sc,this.world,this.vehicles,this.entities,this.combat,this.police,this.audio);
    this.progression=new ProgressionManager(this.audio);this.crew=new CrewManager(this.audio);
    const parts=this.entities.createPlayerMesh();
    this.player={parts,mesh:parts.group,x:174.5,y:0,z:-51,yaw:-2.35,walkPhase:0,health:100,maxHealth:100,armor:50,maxArmor:100,cash:2500,respect:150,inVehicle:false,vehicle:null,activeWeapon:'pistol',unlockedWeapons:new Set(['fists','pistol','smg','shotgun']),ammo:{fists:0,pistol:96,smg:210,shotgun:48,rpg:6},stats:{carsStolen:0,copsEvaded:0,takedowns:0,totalCashEarned:2500,contractsDone:0,wantedHigh:0},visitedDistricts:new Set(['oceanfront']),contextPrompt:'',hitFlash:0};
    this.player.mesh.position.set(174.5,0,-51);this.player.mesh.rotation.y=-2.35;this.renderRig.orbitYaw=-2.35;this.vehicles.spawnInitialTraffic();this.entities.spawnPedestrians(52);
    this.hud=new HudController(this);this.state='title';this.elapsed=this.todIndex=0;this.todKeys=['golden','dusk','night','dawn'];
    if(this.shotParam)applyShotPreset(this.shotParam,this);else this.hud.setTitleVisible(true);
  }

  startPlay(loadLatest=false){
    this.audio.unlock();this.renderRig.clearShotCamera();this.state='playing';this.hud.setTitleVisible(false);document.activeElement?.blur?.();
    if(loadLatest){const f=this.progression.getSlotsSummary().find(s=>s.exists);if(f)this.progression.loadFromSlot(f.slot,this);}
    this.hud.showBanner('WELCOME TO PALMERA KEYS','STEAL SUPERCARS • CREW TACTICS [Z/X/C] • OUTRUN PKPD AIR-1',4.5);
  }

  step(dt){
    this.elapsed+=dt;
    if(this.shotParam){this.renderRig.render();this.input.endFrame();return;}
    if(this.state==='title'){this.world.update(dt,this.elapsed,this.renderRig.timeOfDay);this.renderRig.updateTitleOrbit(dt,this.elapsed);this.renderRig.render();if(this.input.wasPressed('Enter')||this.input.wasPressed('Space'))this.startPlay(false);this.input.endFrame();return;}
    this._shortcuts();const paused=this.hud.modalOpen||this.hud.wheelOpen;
    if(!paused)this._controls(dt);
    this.world.update(dt,this.elapsed,this.renderRig.timeOfDay);
    if(!paused){this.crew.update(dt);this.vehicles.update(dt,this.input,this.player,this.combat,this.entities,this.police);this.entities.update(dt,this.player,this.combat,this.vehicles,this.police);this.combat.update(dt,this.player,this.police);this.police.update(dt,this.player,this.combat,m=>this.hud.showBanner('PKPD DISPATCH',m,3.5));this.missions.update(dt,this.player,(t,s)=>this.hud.showBanner(t,s,4.2),d=>this.hud.showDialogue(d,10));const dist=this.world.getDistrictAt(this.player.x,this.player.z);if(dist)this.player.visitedDistricts.add(dist.id);if(this.police.wantedLevel>(this.player.stats.wantedHigh||0))this.player.stats.wantedHigh=this.police.wantedLevel;if(this.player.health<=0){if(this.player.inVehicle)this.vehicles.exitVehicle(this.player);Object.assign(this.player,{health:100,armor:50,cash:max(0,this.player.cash-250),x:174.5,z:-51,y:0});this.police.clearWanted(false);this.hud.showBanner('EMERGENCY MEDEVAC','RECOVERED AT CLINIC (-$250)',4);}}
    const mouse=this.input.consumeMouse(),sr=this.player.inVehicle&&this.player.vehicle?clamp(abs(this.player.vehicle.speed)/this.player.vehicle.spec.maxSpeed,0,1.2):0;
    this.renderRig.updateCamera(dt,{targetPos:this.player,targetYaw:this.player.yaw,inVehicle:this.player.inVehicle,speedRatio:sr,aiming:!this.player.inVehicle&&this.input.isMouseDown(2),mouseDX:paused?0:mouse.dx,mouseDY:paused?0:mouse.dy});
    this.audio.update(dt,{inVehicle:this.player.inVehicle,speedRatio:sr,nitro:Boolean(this.player.vehicle?.isNitro),wantedLevel:this.police.wantedLevel});
    this.hud.update(dt);this.renderRig.render();this.input.endFrame();
  }

  _shortcuts(){
    const i=this.input,h=this.hud;
    if(i.wasPressed('Escape')){if(h.modalOpen)h.closeModal();else if(h.wheelOpen)h.toggleWeaponWheel(false);else h.openModal('map');}
    if(i.wasPressed('KeyM')){if(h.modalOpen&&h.activeTab==='map')h.closeModal();else h.openModal('map');}
    if(i.wasPressed('Tab')||i.wasPressed('KeyQ'))h.toggleWeaponWheel();
    if(i.wasPressed('KeyR')){const st=this.audio.cycleRadioStation();h.showBanner(`RADIO // ${st.freq}`,`${st.name} (${st.genre})`,2.2);}
    if(i.wasPressed('KeyT')){this.todIndex=(this.todIndex+1)%4;this.renderRig.setTimeOfDay(TIME_PRESETS[this.todKeys[this.todIndex]]);}
    if(i.wasPressed('KeyN')){const ids=['golden_arrival','boardwalk_shakedown','harbor_manifest','causeway_blitz','neon_raid','palmera_heist'];this.missions.startMission(ids[(this.missions.currentMission?.index||1)%6],(t,s)=>h.showBanner(t,s),d=>h.showDialogue(d));}
    for(const kc of['KeyZ','KeyX','KeyC'])if(i.wasPressed(kc))this.crew.activateByCode(kc,this,(t,s)=>h.showBanner(t,s,2.8));
    for(const w of WEAPONS)if(i.wasPressed(`Digit${w.slot}`)&&this.player.unlockedWeapons.has(w.id))this.player.activeWeapon=w.id;
    const wh=i.consumeWheel();if(wh!==0){const u=WEAPONS.filter(w=>this.player.unlockedWeapons.has(w.id)),nx=u[(u.findIndex(w=>w.id===this.player.activeWeapon)+wh+u.length)%u.length];if(nx)this.player.activeWeapon=nx.id;}
  }

  _controls(dt){
    const{player:p,input:i,hud:h,world:w,vehicles:vh,combat:cb,police:po}=this;p.contextPrompt='';
    const cl=this.progression.getNearestLandmark(p.x,p.z,14),nearLm=cl&&dist2D(p.x,p.z,cl.x,cl.z)<=(cl.radius||11)?cl:null,nearVeh=!p.inVehicle?vh.findNearestVehicle(p.x,p.z,6.2):null;
    if(nearLm){p.contextPrompt=`[E] Enter ${nearLm.name}`;if(i.wasPressed('KeyE')){h.openModal({garage:'garage',armory:'armory',safehouse:'safehouse'}[nearLm.type]||'map');return;}}
    else if(nearVeh)p.contextPrompt=`[F] Hijack ${nearVeh.spec.name} (${nearVeh.spec.category})`;
    if(i.wasPressed('KeyF')){if(p.inVehicle)vh.exitVehicle(p);else if(nearVeh){const cop=nearVeh.driver==='police';vh.enterVehicle(p,nearVeh);if(cop)po.addHeat(1.2,'Grand Theft Cruiser');}}
    if(!p.inVehicle){
      const fwd=(i.isDown('KeyW')||i.isDown('ArrowUp')?1:0)-(i.isDown('KeyS')||i.isDown('ArrowDown')?1:0),turn=(i.isDown('KeyA')||i.isDown('ArrowLeft')?1:0)-(i.isDown('KeyD')||i.isDown('ArrowRight')?1:0);
      if(turn)p.yaw=wrapAngle(p.yaw+turn*2.9*dt);
      if(fwd){const spd=((i.isDown('ShiftLeft')||i.isDown('ShiftRight'))?10.2:6.4)*(fwd>0?1:-.65),nx=p.x+sin(p.yaw)*spd*dt,nz=p.z+cos(p.yaw)*spd*dt;if(!w.isWater(nx,nz)){const col=w.resolveCircleCollision(nx,nz,.65,p.y);p.x=col.x;p.z=col.z;}p.walkPhase+=dt*abs(spd)*2.1;const sw=sin(p.walkPhase)*.55;p.parts.leftLeg.rotation.x=sw;p.parts.rightLeg.rotation.x=-sw;p.parts.leftArm.rotation.x=-sw*.6;}
      else{p.parts.leftLeg.rotation.x=p.parts.rightLeg.rotation.x=0;p.parts.leftArm.rotation.x=p.activeWeapon!=='fists'?-PI*.36:0;}
      p.y=w.getGroundHeight(p.x,p.z);p.mesh.position.set(p.x,p.y,p.z);p.mesh.rotation.y=p.yaw;p.parts.rightArm.rotation.x=-PI*.42;p.parts.gunMesh.visible=p.activeWeapon!=='fists';
    }
    const fire=i.isDown('KeyJ')||(!h.modalOpen&&!h.wheelOpen&&i.isMouseDown(0)&&document.activeElement===document.body);
    if(!p.inVehicle&&(i.isMouseDown(2)||fire)){p.yaw=this.renderRig.orbitYaw;p.mesh.rotation.y=p.yaw;}
    if(fire){this.audio.unlock();cb.firePlayerWeapon(p,po,p.yaw,clamp((.24-this.renderRig.orbitPitch)*1.15,-.55,.75));}
    if(i.wasPressed('KeyE')&&!nearLm)h.openModal(p.inVehicle||nearVeh?'garage':'armory');
  }
}

const game=new PalmeraKeysGame();window.__game=game;let lastTime=performance.now();
function animate(now){const dt=min(.075,(now-lastTime)/1000);lastTime=now;game.step(dt||1/60);requestAnimationFrame(animate);}
requestAnimationFrame(animate);
