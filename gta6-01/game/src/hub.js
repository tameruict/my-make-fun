import{LANDMARKS,RESPRAY_COLORS,ROAD_X,ROAD_Z,UPGRADE_COSTS,WEAPONS,WORLD_BOUNDS}from './config.js';
import{SIDE_ACTIVITIES,STORY_MISSIONS}from './missions.js';
import{getCareerCompletion,getSyndicateRank}from './progression.js';
import{clamp,dist2D}from './random.js';

const{abs,sin,cos,round,max,PI}=Math,$=id=>document.getElementById(id);
export const LANDMARK_CODES={garage:'G',armory:'A',heist:'H',safehouse:'V',activity:'R'};
const sub=t=>`<span class="sub">${t}</span>`,row=(l,r)=>`<div class="ar row"><div>${l}</div>${r}</div>`,sec=t=>`<div class="st">${t}</div>`,btn=(a,t)=>`<button class="act-btn" ${a}>${t}</button>`;
const dv=(c,b)=>`<div class="${c}">${b}</div>`,card=(t,b)=>dv('hc col',sec(t)+b);
const bar=r=>`<div class="ckt"><div class="ckf" style="width:${round(r*100)}%"></div></div>`,MAP_CV='<canvas id="fullmap-canvas" width="560" height="350"></canvas>';
const ZONES=[[-255,-235,120,115,'#14b8a655','NEON AUTO ROW',-72,-140],[-65,-115,120,115,'#eab3084d','DOWNTOWN SPIRE',28,-48],[-255,115,120,235,'#38bdf84d','PALMERA HARBOR',-35,168],[120,-235,204,235,'#f43f5e4d','OCEANFRONT',156,72],[325,-155,444,155,'#22c55e66','SUNSET HILLS',385,-72]];

/** Draw detailed city sub-blocks, parks, boardwalk, beach, and marina docks. */
export function drawCityBlockBackdrop(ctx,mx,my){
  const r=(x0,z0,x1,z1,col,st)=>{const x=mx(x0),y=my(z0),w=mx(x1)-x,h=my(z1)-y;ctx.fillStyle=col;ctx.fillRect(x,y,w,h);if(st)ctx.strokeRect(x,y,w,h);};
  r(-255,-235,204,235,'#e2e8f0');r(325,-155,444,155,'#dcfce7');ctx.strokeStyle='#1e293b55';ctx.lineWidth=1.2;
  for(const[x0,z0,x1,z1,col]of ZONES)r(x0,z0,x1,z1,col,1);
  for(let xi=0;xi<4;xi++)for(let zi=0;zi<4;zi++){
    const x0=ROAD_X[xi]+12,x1=ROAD_X[xi+1]-12,z0=ROAD_Z[zi]+12,z1=ROAD_Z[zi+1]-12,mX=(x0+x1)*.5,mZ=(z0+z1)*.5,base=mZ>110?'#f9731655':(mX>-60&&mX<120&&mZ>-110&&mZ<110)?'#eab3084d':mX>110?'#f43f5e4d':'#14b8a655';
    for(const[a,b,c,d]of[[x0,z0,mX-2,mZ-2],[mX+2,z0,x1,mZ-2],[x0,mZ+2,mX-2,z1],[mX+2,mZ+2,x1,z1]])r(a,b,c,d,((xi===2&&zi===1&&a<mX)||(xi===3&&zi===2&&b>mZ))?'#22c55e66':base);
  }
  for(const b of[[191,-235,204,235,'#fda4af88'],[204,-235,253,235,'#f1dfc0'],[250,-235,255,235,'#38bdf888'],[332,-135,434,135,'#22c55e66'],[341,-125,359,125,'#1e293b'],[324,-9,430,9,'#1e293b'],[189,-10,329,10,'#0284c7']])r(...b);
  for(const dx of[-135,-80,-25,30])r(dx,215,dx+8,252,'#b45309');
  for(let cx=-165;cx<=-55;cx+=26){r(cx,126,cx+14,135,'#f97316');r(cx+4,148,cx+18,157,'#f97316');}
  for(const rx of ROAD_X)r(rx-11,-225,rx+11,225,'#1e293b');for(const rz of ROAD_Z)r(-225,rz-11,190,rz+11,'#1e293b');
  for(const rx of ROAD_X)r(rx-8,-225,rx+8,225,'#f1f5f9');for(const rz of ROAD_Z)r(-225,rz-8,190,rz+8,'#f1f5f9');
  r(344,-122,356,122,'#f1f5f9');r(326,-6,428,6,'#f1f5f9');r(189,-7,329,7,'#f1f5f9');r(189,-10,329,10,'#0000',1);
}

/** Draw shared GPS route, landmark badges, and objective ring on strategic or mini map. */
export function drawMapOverlay(ctx,mx,my,path,tgt,full=false){
  ctx.lineCap='round';
  for(const[col,lw]of(full?[['#00f0ff55',7],['#00f0ff',3.2],['#ffd166',1.2]]:[['#00F0FF',3.2],['#ffd166',1.2]])){ctx.strokeStyle=col;ctx.lineWidth=lw;ctx.beginPath();path.forEach((pt,i)=>i?ctx.lineTo(mx(pt.x),my(pt.z)):ctx.moveTo(mx(pt.x),my(pt.z)));ctx.stroke();}
  ctx.font=full?'900 10px sans-serif':'bold 8px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
  for(const lm of LANDMARKS){const lx=mx(lm.x),ly=my(lm.z);ctx.fillStyle=lm.color;ctx.beginPath();ctx.arc(lx,ly,full?9:5.5,0,PI*2);ctx.fill();if(full){ctx.strokeStyle='#08101c';ctx.lineWidth=2;ctx.stroke();}ctx.fillStyle='#08101c';ctx.fillText(LANDMARK_CODES[lm.type]||'•',lx,ly+.5);}
  ctx.beginPath();ctx.arc(mx(tgt.x),my(tgt.z),full?12:5,0,PI*2);
  if(full){ctx.strokeStyle='#FF9A44';ctx.lineWidth=2.5;ctx.stroke();}else{ctx.fillStyle='#FF9A44';ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.stroke();}
}

/** Draw player position arrow on map canvas. */
export function drawPlayerArrow(ctx,x,y,yaw,s=1,ring=false){
  ctx.save();ctx.translate(x,y);if(ring){ctx.strokeStyle='#00f0ff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,11,0,PI*2);ctx.stroke();}
  ctx.rotate(-yaw+PI);ctx.fillStyle='#fff';ctx.strokeStyle='#0a0f1e';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.moveTo(0,-8*s);ctx.lineTo(6.5*s,7*s);ctx.lineTo(0,3.5*s);ctx.lineTo(-6.5*s,7*s);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
}

export class HubModalController{
  constructor(game,hud){this.game=game;this.hud=hud;this.activeTab='garage';this.modalOpen=false;}
  getCareerCompletion(p,m){return getCareerCompletion(p,m);}

  openModal(tab='map',msg=''){
    this.activeTab=tab;this.modalOpen=true;document.body.classList.add('modal-open');document.body.classList.toggle('customs-dock',tab==='garage');
    this.hud.el['modal-panel'].classList.remove('hidden');this.hud.el['m-st'].textContent=msg;document.querySelectorAll('.tab-btn').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
    if(tab==='garage'&&!this.game.shotParam){const{player:p,vehicles:vh,world:w,renderRig:rr}=this.game,v=p.vehicle||vh.findNearestVehicle(p.x,p.z,15),tx=v?v.x:-62,ty=v?v.y:0,tz=v?v.z:-48,yw=v?v.yaw:.62,ib=abs(tx+62)<14&&abs(tz+48)<14;if(ib&&w.garageLift)w.garageLift.position.y=.88;rr.setShotCamera(ib?[clamp(tx-6.4,-73,-50),ty+2.7,tz+10.5]:[tx-sin(yw+.65)*8.5,ty+2.8,tz-cos(yw+.65)*8.5],[tx+2.4,ty+1.1,tz-1],52);}
    else if(!this.game.shotParam){if(this.game.world.garageLift)this.game.world.garageLift.position.y=.06;this.game.renderRig.clearShotCamera();}
    this.render();
  }

  closeModal(){this.modalOpen=false;document.body.classList.remove('modal-open','customs-dock');this.hud.el['modal-panel'].classList.add('hidden');if(!this.game.shotParam){if(this.game.world.garageLift)this.game.world.garageLift.position.y=.06;this.game.renderRig.clearShotCamera();}document.activeElement?.blur?.();}

  render(){
    const{player:p,missions:ms}=this.game,mc=this.hud.el['m-ct'],st=this.hud.el['m-st'],rk=getSyndicateRank(p.respect),comp=this.getCareerCompletion(p,ms);
    this.hud.el['m-cash'].textContent=`$${p.cash.toLocaleString()}`;this.hud.el['m-rank'].textContent=`${rk.label} (${comp.pct}%)`;
    this[({map:'renderMapHub',garage:'renderCustomsTab',armory:'renderArmoryTab',safehouse:'renderSavesTab'})[this.activeTab]](mc,st,rk,comp);
    this._bind(mc,'[data-sv]',b=>{this.game.progression.saveToSlot(+b.dataset.sv,this.game);st.textContent=`Saved Slot ${+b.dataset.sv+1}`;this.render();});
    this._bind(mc,'[data-ld]',b=>{this.game.progression.loadFromSlot(+b.dataset.ld,this.game);st.textContent=`Loaded Slot ${+b.dataset.ld+1}`;this.render();});
  }

  _bind(mc,sel,fn){mc.querySelectorAll(sel).forEach(b=>{b.onclick=()=>fn(b);});}

  _slotsHtml(){return this.game.progression.getSlotsSummary().map(s=>row(`<b>SLOT ${s.slot+1}</b> ${s.exists?`<span class="ts">${s.data.completion??0}%</span>`:''}<br>`+sub(s.exists?`$${s.data.cash.toLocaleString()} • ${s.data.savedAt}`:'Empty'),dv('row g4',btn(`data-sv="${s.slot}"`,'SAVE')+(s.exists?btn(`data-ld="${s.slot}"`,'LOAD'):'')))).join('');}

  renderMapHub(mc,stEl,rk,comp){
    const{player:p,police:po,missions:ms}=this.game,st=p.stats||{},ci='<circle cx="55" cy="55" r="42" fill="none" stroke-width="9"';
    const gauge=`<svg class="rsvg" viewBox="0 0 110 110">${ci} stroke="#ffffff1c"/>${ci} stroke="#00F0FF" stroke-linecap="round" stroke-dasharray="264" stroke-dashoffset="${round(264*(1-comp.pct/100))}" transform="rotate(-90 55 55)"/><g text-anchor="middle" font-weight="900"><text x="55" y="53" fill="#fff" font-size="22">${comp.pct}%</text><text x="55" y="68" fill="#94a3b8" font-size="8.5">COMPLETE</text></g></svg>`;
    const sm=STORY_MISSIONS.map(m=>dv('mp',`<span><b>${m.index}.</b> ${m.title}</span>${ms.completedMissions.has(m.id)?'<span class="tdn">DONE</span>':ms.currentMission?.id===m.id?'<span class="tac">ACTIVE</span>':btn(`data-m="${m.id}"`,'LAUNCH')}`)).join('');
    const ln={garage:'Customs',armory:'Armory',safehouse:'Villa',heist:'Vault',activity:'Sprint'},leg=LANDMARKS.map(l=>`<span><i style="background:${l.color}">${LANDMARK_CODES[l.type]||'•'}</i>${ln[l.type]||l.name}</span>`).join('')+'<span><i style="background:#00F0FF">━</i>GPS Route</span><span><i style="background:#fff">▲</i>You</span>';
    const left=dv('col g4',card('STRATEGIC CITY MAP // PALMERA KEYS',`${MAP_CV}<div class="leg">${leg}</div>`)+card('CAREER & STORY PROGRESS',`<div class="rw">${gauge}${dv('col g4',`<b>STORY ${comp.storyDone}/6 · CONTRACTS ${comp.contractsDone}/3</b>${sub(`${comp.distCount}/6 Districts`)}${bar(comp.pct/100)}`)}</div><div class="st2">${sm}</div>`));
    const kpi=`<div class="k2"><div class="stb">CASH<b class="kval tdn">$${p.cash.toLocaleString()}</b></div><div class="stb">${rk.label}<b class="kval ts">${rk.rp}/${rk.nextRp} RP</b>${bar(rk.progress)}</div></div>`;
    const ct=SIDE_ACTIVITIES.map(a=>dv('mp',`<span>${a.title}</span>${btn(`data-m="${a.id}"`,'START')}`)).join('');
    const right=dv('col g4',card('SYNDICATE OPS BRIEF',kpi+`<div class="stg">${[['Cars Stolen',st.carsStolen||0],['PKPD Evaded',st.copsEvaded||0],['Takedowns',st.takedowns||0],['Wanted High',`${max(st.wantedHigh||0,po.wantedLevel)}★`]].map(([k,v])=>`<div class="stb">${k}<b>${v}</b></div>`).join('')}</div>${sec('QUICK CONTRACTS')}${dv('col g4',ct)}${btn('id="btn-open-garage"','OPEN SUNSET CUSTOMS')}`)+card('SAVE SLOTS (1-3)',dv('ul col',this._slotsHtml())));
    mc.innerHTML=dv('hg',left+right);this._bind(mc,'[data-m]',b=>{ms.startMission(b.dataset.m,(t,s)=>this.hud.showBanner(t,s),d=>this.hud.showDialogue(d));stEl.textContent=`Launched: ${b.dataset.m}`;this.render();});
    $('btn-open-garage').onclick=()=>this.openModal('garage','Sunset Customs ready');
    $('fullmap-canvas').onclick=ev=>{const r=ev.target.getBoundingClientRect(),wx=WORLD_BOUNDS.minX+((ev.clientX-r.left)/r.width)*700,wz=WORLD_BOUNDS.minZ+((ev.clientY-r.top)/r.height)*470,lm=LANDMARKS.find(l=>dist2D(wx,wz,l.x,l.z)<35);stEl.textContent=lm?`${lm.name}: ${lm.desc}`:`GPS Pin: ${round(wx)}, ${round(wz)}`;};
    this.drawStrategicCityMap();
  }

  renderCustomsTab(mc,stEl){
    const{player:p,vehicles:vh,police:po,progression:pr}=this.game,veh=p.vehicle||vh.findNearestVehicle(p.x,p.z,15);
    const sw=RESPRAY_COLORS.map(s=>`<button class="swatch-btn${s.light?' light':''}" data-c="${s.id}" style="background:${s.hex}">${s.name}</button>`).join('');
    const up=['engine','turbo','armor'].map(k=>{const lvl=veh?(veh.upgrades[k]||0):0,c=UPGRADE_COSTS[k][lvl]||null;return row(`<b>${k.toUpperCase()} STG ${lvl}/3</b> ${sub(c?`$${c}`:'MAX')}`,btn(`data-u="${k}"`,c?`INSTALL $${c}`:'MAX'));}).join('');
    mc.innerHTML=card(`SUNSET CUSTOMS // ${(veh?veh.spec.name:'Veloce GT').toUpperCase()}`,`<div class="swg">${sw}</div>${sec('UPGRADES')}${dv('ul col',up)}<button id="btn-back-street" class="bp" style="width:100%;margin-top:6px">BACK TO STREET [ESC]</button>`);
    this._bind(mc,'[data-c]',b=>{stEl.textContent=pr.garageRespray(p,vh,po,b.dataset.c,true).msg;this.render();});this._bind(mc,'[data-u]',b=>{stEl.textContent=pr.garageUpgrade(p,vh,b.dataset.u).msg;this.render();});$('btn-back-street').onclick=()=>this.closeModal();
  }

  renderArmoryTab(mc,stEl){const{player:p,progression:pr}=this.game,ls=WEAPONS.filter(w=>w.id!=='fists').map(w=>row(`<b>${w.name}</b> ${sub(`(${p.ammo[w.id]||0})`)}`,btn(`data-w="${w.id}"`,p.unlockedWeapons.has(w.id)?`+${w.clipSize} $${w.ammoCost}`:`BUY $${w.price}`))).join('');mc.innerHTML=card('COASTAL ARMORY',dv('ul col',row('<b>Kevlar Armor (100%)</b> <span style="color:#00F0FF">$300</span>',btn('id="btn-buy-armor"','EQUIP $300'))+ls));$('btn-buy-armor').onclick=()=>{stEl.textContent=pr.buyArmor(p).msg;this.render();};this._bind(mc,'[data-w]',b=>{stEl.textContent=pr.buyWeapon(p,b.dataset.w).msg;this.render();});}

  renderSavesTab(mc,stEl){const{player:p,police:po,progression:pr,renderRig:rr}=this.game;mc.innerHTML=card('PENTHOUSE SAVES',dv('ul col',this._slotsHtml()+row(`<b>Suite Rest</b><br>${sub('100% HP/AR & clear heat')}`,btn('id="btn-rest"','REST'))));$('btn-rest').onclick=()=>{stEl.textContent=pr.safehouseRest(p,po,rr).msg;this.render();};}

  drawStrategicCityMap(){
    const c=$('fullmap-canvas');if(!c)return;const ctx=c.getContext('2d'),w=c.width,h=c.height,mx=x=>((x-WORLD_BOUNDS.minX)/700)*w,my=z=>((z-WORLD_BOUNDS.minZ)/470)*h,og=ctx.createLinearGradient(0,0,w,h);
    og.addColorStop(0,'#0284c7');og.addColorStop(1,'#0ea5e9');ctx.fillStyle=og;ctx.fillRect(0,0,w,h);drawCityBlockBackdrop(ctx,mx,my);
    const dl=(t,x,y,col)=>{ctx.strokeText(t,x,y);ctx.fillStyle=col;ctx.fillText(t,x,y);};ctx.font='900 10.5px sans-serif';ctx.textAlign='center';ctx.lineJoin='round';ctx.strokeStyle='#0f172aee';ctx.lineWidth=3.5;
    for(const[,,,,,lb,lx,lz]of ZONES)if(lb)dl(lb,mx(lx),my(lz),'#fff');dl('CORAL',mx(282),my(-40),'#e0f2fe');dl('CAUSEWAY',mx(282),my(-22),'#e0f2fe');
    const tgt=this.game.missions.getTargetPoint(),p=this.game.player;drawMapOverlay(ctx,mx,my,this.game.world.computeGpsPath(p.x,p.z,tgt.x,tgt.z),tgt,true);drawPlayerArrow(ctx,mx(p.x),my(p.z),p.yaw,1,true);
  }
}
