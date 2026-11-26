export const CREW_ABILITIES=[
  {id:'swap_plates',key:'Z',code:'KeyZ',specialist:'Elena Reyes',title:'Swap Plates',desc:'-1★ Heat',cooldown:24,color:'#FF3E7F'},
  {id:'quick_fix',key:'X',code:'KeyX',specialist:'Nico Ortiz',title:'Quick Fix',desc:'+45% Repair',cooldown:20,color:'#00F0FF'},
  {id:'jam_dispatch',key:'C',code:'KeyC',specialist:'Capt. Solis',title:'Jam Dispatch',desc:'6s Scramble',cooldown:28,color:'#FF9A44'},
];

export class CrewManager{
  constructor(audio){
    this.audio=audio;this.reset();
  }

  reset(){
    this.cooldowns={swap_plates:0,quick_fix:0,jam_dispatch:0};
  }

  update(dt){
    for(const k in this.cooldowns)if(this.cooldowns[k]>0)this.cooldowns[k]=Math.max(0,this.cooldowns[k]-dt);
  }

  activate(id,game,onNotify=null){
    const ab=CREW_ABILITIES.find(a=>a.id===id);if(!ab)return false;const rem=this.cooldowns[id]||0;
    if(rem>0){onNotify?.(`${ab.specialist} // ${ab.title}`,`RECHARGING (${Math.ceil(rem)}s)`);return false;}
    const{player,police}=game;
    if(id==='swap_plates'){
      if(police.wantedLevel<=0){onNotify?.('ELENA REYES // SWAP PLATES','NO ACTIVE PKPD HEAT');return false;}
      police.setWantedLevel(Math.max(0,police.wantedLevel-1),'Fresh Plates Applied');if(police.wantedLevel===0)police.clearWanted(true,player);
      this.cooldowns[id]=ab.cooldown;this.audio?.playUiClick();onNotify?.('ELENA REYES // SWAP PLATES','TAGS SWAPPED — WANTED -1★');return true;
    }
    if(id==='quick_fix'){
      if(player.inVehicle&&player.vehicle){const v=player.vehicle;v.hp=Math.min(v.maxHp,v.hp+Math.round(v.maxHp*.45));v.nitroFuel=100;}
      else{player.armor=Math.min(player.maxArmor,player.armor+25);player.health=Math.min(player.maxHealth,player.health+15);}
      this.cooldowns[id]=ab.cooldown;this.audio?.playCash();onNotify?.('NICO ORTIZ // QUICK FIX',player.inVehicle?'CHASSIS +45% & NITRO REFILLED':'ARMOR +25 & MEDKIT');return true;
    }
    police.jamTimer=6;police.evadeTimer=Math.min(police.evadeDuration-.5,police.evadeTimer+4.5);this.cooldowns[id]=ab.cooldown;
    this.audio?.playMissionBanner();onNotify?.('CAPT. SOLIS // JAM DISPATCH','PKPD TELEMETRY SCRAMBLED (6s)');return true;
  }

  activateByCode(code,game,onNotify=null){
    const ab=CREW_ABILITIES.find(a=>a.code===code);return ab?this.activate(ab.id,game,onNotify):false;
  }

  getHudState(){
    return CREW_ABILITIES.map(ab=>{const rem=Math.ceil(this.cooldowns[ab.id]||0);return{...ab,remaining:rem,ready:rem<=0};});
  }

  serialize(){
    return{...this.cooldowns};
  }

  deserialize(d){
    if(d)Object.assign(this.cooldowns,d);
  }
}
