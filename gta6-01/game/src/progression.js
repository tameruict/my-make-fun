import{LANDMARKS,RESPRAY_COLORS,UPGRADE_COSTS,WEAPON_MAP}from './config.js';
import{clamp,dist2D}from './random.js';

const PFX='palmera_keys_slot_',RANKS=[[0,'RUNNER'],[300,'ENFORCER'],[700,'WHEELMAN'],[1200,'FIXER'],[1900,'SHOT CALLER'],[2800,'KINGPIN']];
const STORY_IDS=new Set(['golden_arrival','boardwalk_shakedown','harbor_manifest','causeway_blitz','neon_raid','palmera_heist']);

export function getSyndicateRank(respect=0){
  let idx=0;for(let i=0;i<RANKS.length;i++)if(respect>=RANKS[i][0])idx=i;
  const curMin=RANKS[idx][0],nextRp=idx+1<RANKS.length?RANKS[idx+1][0]:curMin+1000;
  return{level:idx+1,title:RANKS[idx][1],label:`RANK ${idx+1} · ${RANKS[idx][1]}`,rp:respect,nextRp,nextTitle:idx+1<RANKS.length?RANKS[idx+1][1]:'MAX TIER',progress:clamp((respect-curMin)/Math.max(1,nextRp-curMin),0,1)};
}

export function getCareerCompletion(player,missions){
  let storyDone=0;for(const id of(missions?.completedMissions||[]))if(STORY_IDS.has(id))storyDone++;
  const contractsDone=player?.stats?.contractsDone||0,distCount=player?.visitedDistricts?.size||Math.min(6,1+Math.floor((player?.respect||0)/350));
  const pct=Math.round((storyDone/6)*50+clamp(contractsDone/3,0,1)*15+clamp((player?.respect||0)/2800,0,1)*20+clamp(distCount/6,0,1)*15);
  return{pct:clamp(pct,0,100),storyDone,contractsDone,distCount};
}

export class ProgressionManager{
  constructor(audio){this.audio=audio;}
  getSlotKey(i){return `${PFX}${i}`;}
  getSlotsSummary(){return[0,1,2].map(slot=>{let data=null;try{const r=localStorage.getItem(this.getSlotKey(slot));if(r)data=JSON.parse(r);}catch{}return{slot,exists:Boolean(data),data};});}
  hasAnySave(){return this.getSlotsSummary().some(s=>s.exists);}

  saveToSlot(slotIdx,{player:p,missions:m,renderRig:rr,crew}){
    const payload={savedAt:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}),cash:p.cash,respect:p.respect,health:p.health,armor:p.armor,completion:getCareerCompletion(p,m).pct,activeWeapon:p.activeWeapon,unlockedWeapons:Array.from(p.unlockedWeapons),ammo:{...p.ammo},stats:{...(p.stats||{})},visitedDistricts:Array.from(p.visitedDistricts||['oceanfront']),crewCooldowns:crew?crew.serialize():{},x:Math.round(p.x),z:Math.round(p.z),timeOfDay:rr?rr.timeOfDay:.74,currentMissionId:m?.currentMission?m.currentMission.id:'golden_arrival',completedMissions:m?Array.from(m.completedMissions):[]};
    try{localStorage.setItem(this.getSlotKey(slotIdx),JSON.stringify(payload));}catch{}
    this.audio?.playCash();return payload;
  }

  loadFromSlot(slotIdx,{player:p,missions:m,renderRig:rr,vehicles:v,police:po,crew}){
    let d=null;try{const r=localStorage.getItem(this.getSlotKey(slotIdx));if(r)d=JSON.parse(r);}catch{}
    if(!d)return false;if(p.inVehicle)v.exitVehicle(p);
    Object.assign(p,{cash:d.cash??1500,respect:d.respect??100,health:d.health??100,armor:d.armor??50,activeWeapon:d.activeWeapon||'pistol',unlockedWeapons:new Set(d.unlockedWeapons||['fists','pistol','smg']),ammo:{...p.ammo,...(d.ammo||{})},stats:{carsStolen:0,copsEvaded:0,takedowns:0,totalCashEarned:0,contractsDone:0,wantedHigh:0,...(d.stats||{})},visitedDistricts:new Set(d.visitedDistricts||['oceanfront']),x:d.x??172,z:d.z??-50});
    if(crew){crew.reset();crew.deserialize(d.crewCooldowns);}if(rr&&typeof d.timeOfDay==='number')rr.setTimeOfDay(d.timeOfDay);
    po?.clearWanted(false);if(m){m.completedMissions=new Set(d.completedMissions||[]);if(d.currentMissionId)m.startMission(d.currentMissionId);}
    this.audio?.playMissionBanner();return true;
  }

  buyWeapon(p,id){const w=WEAPON_MAP[id];if(!w)return{ok:false,msg:'Unknown weapon'};if(p.unlockedWeapons.has(id))return this.buyAmmo(p,id);if(p.cash<w.price)return{ok:false,msg:`Need $${w.price}`};p.cash-=w.price;p.unlockedWeapons.add(id);p.ammo[id]=(p.ammo[id]||0)+w.defaultAmmo;p.activeWeapon=id;this.audio?.playCash();return{ok:true,msg:`Equipped ${w.name}`};}
  buyAmmo(p,id){const w=WEAPON_MAP[id];if(!w||w.id==='fists')return{ok:false,msg:'No ammo needed'};if(p.cash<w.ammoCost)return{ok:false,msg:`Need $${w.ammoCost}`};p.cash-=w.ammoCost;p.unlockedWeapons.add(id);p.ammo[id]=(p.ammo[id]||0)+w.clipSize;this.audio?.playCash();return{ok:true,msg:`+${w.clipSize} ${w.short} Ammo`};}
  buyArmor(p){if(p.armor>=p.maxArmor)return{ok:false,msg:'Armor at 100%'};if(p.cash<300)return{ok:false,msg:'Need $300'};p.cash-=300;p.armor=p.maxArmor;p.health=p.maxHealth;this.audio?.playCash();return{ok:true,msg:'Kevlar & Health Restored'};}

  garageRespray(p,vehicles,police,colorId,clearHeat=true){
    const sw=RESPRAY_COLORS.find(c=>c.id===colorId)||RESPRAY_COLORS[0],cost=clearHeat&&police?.wantedLevel>0?200:120;
    if(p.cash<cost)return{ok:false,msg:`Need $${cost}`};const veh=p.vehicle||vehicles.findNearestVehicle(p.x,p.z,14);if(!veh)return{ok:false,msg:'No vehicle in bay'};
    p.cash-=cost;vehicles.repairAndRespray(veh,sw.value,sw.accent);if(clearHeat)police?.clearWanted(false);this.audio?.playCash();return{ok:true,msg:`Resprayed ${sw.name} & Repaired 100%`};
  }

  garageUpgrade(p,vehicles,type){
    const tiers=UPGRADE_COSTS[type];if(!tiers)return{ok:false,msg:'Invalid upgrade'};const veh=p.vehicle||vehicles.findNearestVehicle(p.x,p.z,14);if(!veh)return{ok:false,msg:'No vehicle in bay'};
    const cur=veh.upgrades[type]||0;if(cur>=tiers.length)return{ok:false,msg:`${type.toUpperCase()} MAXED`};const cost=tiers[cur];if(p.cash<cost)return{ok:false,msg:`Need $${cost}`};
    p.cash-=cost;vehicles.applyUpgrade(veh,type,cur+1);this.audio?.playCash();return{ok:true,msg:`Installed Stage ${cur+1} ${type.toUpperCase()}`};
  }

  safehouseRest(p,police,renderRig){p.health=p.maxHealth;p.armor=p.maxArmor;police?.clearWanted(false);renderRig?.setTimeOfDay(.74);this.audio?.playMissionBanner();return{ok:true,msg:'Rested until Golden Hour — 100% HP/AR'};}
  getNearestLandmark(x,z,maxD=9.5){let best=null,bestD=maxD;for(const lm of LANDMARKS){const d=dist2D(x,z,lm.x,lm.z);if(d<bestD){bestD=d;best=lm;}}return best;}
}
