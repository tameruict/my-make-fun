import{STORY_MISSIONS}from './missions.js';
import{orientCruiserShooter}from './vehicles.js';

const{abs,PI}=Math;

export function applyShotPreset(shotName,game){
  const{player:p,world:w,vehicles:vh,entities:en,combat:cb,police:po,missions:ms,renderRig:rr,hud,audio}=game;
  const sv=(...a)=>vh.spawnVehicle(...a),sp=o=>cb.spawnParticle(o),st=(a,b,c)=>cb.spawnTracer(a,b,c,5),cam=(...a)=>rr.setShotCamera(...a),dlg=(s,r,c,t)=>hud.showDialogue({speaker:s,role:r,color:c,text:t},30);
  const clr=(x0,x1,z0,z1)=>{for(let i=en.pedestrians.length-1;i>=0;i--){const pd=en.pedestrians[i];if(pd.x>x0&&pd.x<x1&&pd.z>z0&&pd.z<z1){en.root.remove(pd.mesh);en.pedestrians.splice(i,1);}}};
  game.state='playing';hud.setTitleVisible(false);hud.closeModal();hud.toggleWeaponWheel(false);
  if(shotName==='cover'){
    rr.setTimeOfDay(.74);audio.setRadioStation(0);clr(162,198,-35,20);
    for(const v of vh.vehicles)if(v.driver==='traffic'&&abs(v.x-180)<15&&v.z>-45&&v.z<10){v.mesh.visible=false;v.z=-180;}
    const hero=sv('veloce_gt',180,-12.8,.34,{color:0xff5e3a,accent:0x00f0ff,speed:45.8});
    vh.enterVehicle(p,hero);hero.speed=45.8;hero.isDrifting=hero.isNitro=true;hero.steerAngle=-.45;if(hero.nitroFlame)hero.nitroFlame.visible=true;
    for(let i=0;i<6;i++){const k=Math.floor(i/2);sp({x:179.5+(i%2?.92:-.92)-k*.28,y:.18+k*.04,z:-15-k*.55,vx:-.3,vy:.18,vz:-.6,color:0xe2e8f0,size:.22+k*.05,life:5,opacity:.2});}
    const c1=po.spawnPursuitUnit(174.1,-15.8,.30,false,'VIPER-14'),c2=po.spawnPursuitUnit(186.1,-15.6,-.22,false,'CORAL-22');
    c1.speed=41;c1.aiRole='RAMMING';c2.speed=40;c2.aiRole='FLANKING';for(const c of[c1,c2])if(c.shooterGroup)c.shooterGroup.visible=true;
    const m1=orientCruiserShooter(c1,hero.x,hero.z),m2=orientCruiserShooter(c2,hero.x,hero.z);
    cb.spawnImpactSparks(180.4,.85,-14.4,14);
    for(const[mz,tx,tz]of[[m1,179.3,-13.1],[m2,180.7,-12.6]]){sp({x:mz.x,y:mz.y,z:mz.z,kind:'fire',color:0xffcf70,size:1.35,life:5,opacity:.95});st(mz,{x:tx,y:1,z:tz},0xff9a44);}
    po.setWantedLevel(4,'Oceanfront Pursuit');po.spawnHelicopterNear(187,16,20.8,171,4,.22,.1);
    sv('corsa_spider',175.5,11,PI,{color:0x00f0ff,accent:0xff3e7f,speed:18});sv('toro_v8',184.2,20,0,{color:0xffb800,accent:0x111827,speed:22});
    [[165.4,-12,.2],[167.2,-7,2.8],[164.8,-2,.4],[167.6,4,3],[165.8,11,.1],[192.6,-15,.1],[195.8,-10,3],[193.4,-4,.2],[199.5,2,2.8],[193,12,.1]].forEach(([px,pz,py],i)=>en.spawnPedestrianAt(px,pz,py,i%6,i*.8));
    Object.assign(p,{cash:14850,respect:840,health:96,armor:85,activeWeapon:'smg'});ms.currentMission=STORY_MISSIONS[3];ms.stageIndex=0;ms.beacon.group.visible=true;ms.beacon.group.position.set(185,0,0);
    ms.updateGpsChevrons(p,[{x:180,z:-10},{x:180,z:-1},{x:188,z:0},{x:225,z:0}]);dlg('Marco Vega','Syndicate Enforcer','#FF9A44','PKPD Air-1 has a spotlight on your Veloce GT! Drift past the Oceanfront palms and hit the Causeway!');cam([176.0,5.1,-27.8],[180.4,2.5,16],58);
  }else if(shotName==='onfoot'){
    rr.setTimeOfDay(.72);if(p.inVehicle)vh.exitVehicle(p);clr(-18,18,-5,35);
    Object.assign(p,{x:1.4,z:9.2,y:0,yaw:.09,activeWeapon:'smg',cash:9420,respect:420,health:88,armor:72});p.ammo.smg=184;p.mesh.visible=!0;p.mesh.position.set(1.4,0,9.2);p.mesh.rotation.y=.09;
    const q=p.parts,l=q.leftArm,g=q.gunMesh,mz={x:1.14,y:1.46,z:10.07},se=(x,z,y,c=0xdc2626)=>en.spawnEnemy(x,z,{yaw:y,shirtColor:c});l.add(g);l.rotation.set(-PI*.48,0,0);q.rightArm.rotation.set(-PI*.38,0,-.32);g.position.set(0,-.58,.12);g.rotation.x=PI*.48;
    sv('corsa_spider',-2.4,11.8,.35,{color:0x00f0ff,accent:0xff3e7f});p.contextPrompt='[F] Hijack Corsa Spider (Roadster)';sv('brava_coupe',6.4,21.5,.9,{color:0x334155}).destroyed=!0;cb.spawnExplosion(6.4,1.1,21.5,1.25);const e1=se(2.2,22,PI),e2=se(7.2,23.5,PI-.3,0xf97316),e3=se(-1.4,20.5,PI+.25);e1.mesh.rotation.x=-.26;cb.spawnImpactSparks(2.2,1.28,22,12);
    po.spawnPursuitUnit(-4.8,25.5,2.75,0,'MARLIN-08');en.spawnPoliceOfficer(-2.5,23.2);for(let i=0;i<2;i++)sp({...mz,vx:0,vy:0,vz:0,kind:'fire',color:i?0x38bdf8:0xffcf70,size:i?1.3:.85,life:5,opacity:i?.78:.95});for(let i=0;i<5;i++)sp({x:-4.8+(i%2?.4:-.4),y:1.6+i*.6,z:25.5+i*.3,vx:-.2,vy:1.6,vz:.2,kind:'smoke',color:i%2?0x334155:0x1e293b,size:2+i*.45,life:5,opacity:1});st(mz,{x:2.2,y:1.28,z:22},0x00f0ff);st({x:7.2,y:1.35,z:23.5},{x:4.6,y:1.88,z:11.8},0xff5e3a);
    po.setWantedLevel(2,'Downtown Firefight');ms.currentMission=STORY_MISSIONS[1];ms.stageIndex=0;ms.stageEnemies=[e1,e2,e3];dlg('Capt. Solis','Arms Broker','#00F0FF','Viper-X Neon SMG shreds through rival armor! Clear the intersection and hijack that cyan Corsa Spider!');cam([-.85,2.15,5.6],[2.5,1.35,20.5],50);
  }else if(shotName==='map'){
    rr.setTimeOfDay(.82);if(p.inVehicle)vh.exitVehicle(p);Object.assign(p,{x:148,z:-36,y:0,yaw:.45,cash:34500,respect:1680,health:100,armor:100});p.mesh.visible=true;p.mesh.position.set(148,0,-36);
    p.unlockedWeapons=new Set(['fists','pistol','smg','shotgun','rpg']);p.visitedDistricts=new Set(['oceanfront','downtown','auto_row','harbor','causeway']);p.stats={carsStolen:14,copsEvaded:7,takedowns:28,totalCashEarned:46200,contractsDone:2,wantedHigh:4};
    ms.completedMissions=new Set(['golden_arrival','boardwalk_shakedown','causeway_blitz']);ms.currentMission=STORY_MISSIONS[2];ms.stageIndex=0;po.clearWanted(false);
    try{[['17:42',34500,1680,60],['16:15',18900,920,41],['14:08',6400,340,18]].forEach(([t,c,r,cp],i)=>localStorage.setItem(`palmera_keys_slot_${i}`,JSON.stringify({savedAt:t,cash:c,respect:r,completion:cp})));}catch{}
    hud.openModal('map','SYNDICATE OPS READY • ROUTE PLOTTED TO PALMERA HARBOR VAULT');hud.elDialogue.classList.add('hidden');cam([194,24,-64],[85,10,14],56);
  }else if(shotName==='customs'){
    rr.setTimeOfDay(.7);if(p.inVehicle)vh.exitVehicle(p);const hero=sv('veloce_gt',-62,-48,.54,{color:0xff5e3a,accent:0x00f0ff});
    hero.upgrades={engine:2,turbo:1,armor:1};hero.y=.72;hero.mesh.position.set(-62,.72,-48);hero.steerAngle=-.35;for(const wh of hero.wheels)if(wh.front)wh.mesh.rotation.y=hero.steerAngle*.55;
    if(w.garageLift)w.garageLift.position.y=.88;if(w.landmarkRings[0])w.landmarkRings[0].mesh.visible=false;
    p.vehicle=hero;p.inVehicle=true;p.mesh.visible=false;Object.assign(p,{x:-62,y:.72,z:-48,cash:28600,respect:1320,health:100,armor:100});
    hud.openModal('garage','Sunset Customs // Stage 2 Engine & Aero Ready');hud.elDialogue.classList.add('hidden');cam([-66.2,2.15,-39.6],[-59.9,1.22,-47.0],48);
  }
  w.update(.016,4.2,rr.timeOfDay);cb.update(.14);hud.update(.016);rr.render();window.__shotReady=true;
}
