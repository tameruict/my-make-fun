import{TIME_PRESETS,WEAPONS}from './config.js';
import{drawCityBlockBackdrop,drawMapOverlay,drawPlayerArrow,HubModalController}from './hub.js';
import{getSyndicateRank}from './progression.js';
import{clamp,dist2D}from './random.js';

const{abs,sin,round,floor,min,max,PI}=Math,$=id=>document.getElementById(id),ns=(t,a)=>{const e=document.createElementNS('http://www.w3.org/2000/svg',t);for(const[k,v]of Object.entries(a))e.setAttribute(k,v);return e;};
const STAR_PATH='M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z';
const W_SVG={fists:'<rect x="7" y="5" width="22" height="7" rx="3"/><circle cx="11" cy="5" r="2"/><circle cx="16" cy="4" r="2"/><circle cx="21" cy="4" r="2"/><circle cx="26" cy="5" r="2"/>',pistol:'<path d="M5 4h22v4H15l-2 6H8l2-6H5z"/>',smg:'<path d="M4 5h23v4h-6v5h-4V9h-4v4h-3V9H4zm23 1h5v2h-5z"/>',shotgun:'<path d="M2 6h30v3H16l-3 5H8l2-5H2z"/>',rpg:'<path d="M3 6h24v4H3zm24-1l6 3-6 3zM12 10h4v4h-4z"/>'};

function portraitSvg(sp='',c='#FF3E7F'){
  const s=sp.toLowerCase(),h=s.includes('elena')?'#2a1629':s.includes('solis')?'#1e293b':'#111827',sk=s.includes('solis')?'#c68b59':'#f1c29b';
  const locks=s.includes('elena')?'<path d="M11 17c-1 6 1 11 3 13l2-11zm22 0c1 6-1 11-3 13l-2-11z" fill="#2a1629"/>':'';
  const eyes=(s.includes('solis')||s.includes('marco'))?'<rect x="14" y="16" width="7" height="4" rx="1" fill="#0f172a"/><rect x="23" y="16" width="7" height="4" rx="1" fill="#0f172a"/><path d="M21 17h2" stroke="#00F0FF" stroke-width="1.4"/>':'<circle cx="18" cy="18" r="1.4" fill="#0f172a"/><circle cx="26" cy="18" r="1.4" fill="#0f172a"/>';
  return `<svg viewBox="0 0 44 44"><rect width="44" height="44" rx="10" fill="${c}" fill-opacity=".24"/><path d="M6 44c2-10 9-14 16-14s14 4 16 14" fill="${c}"/><circle cx="22" cy="18" r="9.5" fill="${sk}"/><path d="M12 17c0-7 4-11 10-11s10 4 10 11c-2-3-5-4-10-4s-8 1-10 4z" fill="${h}"/>${locks}${eyes}<path d="M19 23c2 1.4 4 1.4 6 0" stroke="#7c2d12" stroke-width="1.4" fill="none" stroke-linecap="round"/></svg>`;
}

export class HudController{
  constructor(game){
    this.game=game;this.hub=new HubModalController(game,this);this.wheelOpen=false;this.bannerTimer=0;this.dialogueTimer=0;this.flashPhase=0;
    const ids='title-overlay hud-layer status crosshair h-tod m-ti m-di s-bar m-ob m-nx d-card d-hd d-cd d-ls d-ft r-nm w-st w-alt h-ca h-rp h-rpt b-rp b-hp v-hp b-ar v-ar mission-banner b-ti b-sb mm-c d-nm d-tg ctx-p dlg-c d-av d-sp d-rl d-tx sp-c sp-m sp-g vh-f sp-v tg-d tg-n w-strip c-stk modal-panel m-cash m-rank m-st m-ct weapon-wheel w-gd'.split(' ');
    const e=this.el=Object.fromEntries(ids.map(k=>[k,$(k)]));
    this.elTitle=e['title-overlay'];this.elHud=e['hud-layer'];this.elDialogue=e['dlg-c'];this.minimapCtx=e['mm-c'].getContext('2d');e['w-st'].innerHTML='';
    this.starEls=Array.from({length:5},()=>{const s=ns('svg',{viewBox:'0 0 24 24',class:'star-svg'});s.appendChild(ns('path',{d:STAR_PATH}));e['w-st'].appendChild(s);return s;});
    e['w-strip'].innerHTML=WEAPONS.map(w=>`<div class="w-slot" data-wid="${w.id}"><svg viewBox="0 0 36 16">${W_SVG[w.id]||''}</svg><span>${w.short}</span><span class="wa" data-wam="${w.id}">0</span></div>`).join('');
    e['c-stk'].innerHTML=game.crew.getHudState().map(c=>`<button class="crew-btn" data-crew="${c.id}"><span class="ck" style="background:${c.color}">[${c.key}]</span><span class="ct">${c.title}</span><span class="ccd" data-ccd="${c.id}" style="color:${c.color}">READY</span></button>`).join('');
    e['c-stk'].querySelectorAll('[data-crew]').forEach(b=>{b.onclick=()=>{document.activeElement?.blur?.();game.crew.activate(b.dataset.crew,game,(t,s)=>this.showBanner(t,s,2.8));};});
    $('btn-play').onclick=()=>game.startPlay();$('btn-continue').onclick=()=>game.startPlay(true);$('btn-close-modal').onclick=()=>this.closeModal();
    document.querySelectorAll('.tod-btn').forEach(b=>{b.onclick=()=>{document.activeElement?.blur?.();document.querySelectorAll('.tod-btn').forEach(x=>x.classList.remove('active'));b.classList.add('active');const tod=parseFloat(b.dataset.tod||'.74'),idx=game.todKeys?.findIndex(k=>abs(TIME_PRESETS[k]-tod)<.02);game.renderRig.setTimeOfDay(tod);if(idx>=0)game.todIndex=idx;};});
    document.querySelectorAll('.tab-btn').forEach(b=>{b.onclick=()=>{document.activeElement?.blur?.();this.openModal(b.dataset.tab);};});
  }

  get modalOpen(){return this.hub.modalOpen;}
  get activeTab(){return this.hub.activeTab;}
  setTitleVisible(v){this.elTitle.classList.toggle('hidden',!v);this.elHud.classList.toggle('hidden',v);}
  showBanner(t,s='',d=4){const e=this.el;e['b-ti'].textContent=t;e['b-sb'].textContent=s;e['mission-banner'].classList.remove('hidden');this.bannerTimer=d;}
  showDialogue({speaker,role,color='#FF3E7F',text},dur=11){const e=this.el;e['d-av'].innerHTML=portraitSvg(speaker,color);e['d-sp'].textContent=speaker;e['d-rl'].textContent=`• ${role}`;e['d-tx'].textContent=text;this.elDialogue.classList.remove('hidden');this.dialogueTimer=dur;}

  toggleWeaponWheel(force=null){
    this.wheelOpen=force!==null?force:!this.wheelOpen;this.el['weapon-wheel'].classList.toggle('hidden',!this.wheelOpen);
    if(!this.wheelOpen){document.activeElement?.blur?.();return;}
    const p=this.game.player,gd=this.el['w-gd'];gd.innerHTML='';
    for(const w of WEAPONS){const unl=p.unlockedWeapons.has(w.id),c=document.createElement('button');c.className='act-btn';c.style.padding='10px';c.style.borderColor=p.activeWeapon===w.id?'#FF9A44':'#fff3';c.innerHTML=`<div><b>[${w.slot}] ${w.name}</b></div><span class="sub">${unl?(w.id==='fists'?'∞':`${p.ammo[w.id]||0} RDS`):`LOCKED ($${w.price})`}</span>`;c.onclick=()=>{if(unl){p.activeWeapon=w.id;this.toggleWeaponWheel(false);}};gd.appendChild(c);}
  }

  openModal(tab='map',msg=''){this.hub.openModal(tab,msg);}
  closeModal(){this.hub.closeModal();}

  update(dt){
    const{player:p,world:w,police:po,missions:ms,audio:au,renderRig:rr,crew}=this.game,e=this.el,tx=(k,v)=>{if(e[k])e[k].textContent=v;},sh=(k,v)=>e[k]?.classList.toggle('hidden',!v);
    this.flashPhase+=dt*9;if(this.bannerTimer>0&&(this.bannerTimer-=dt)<=0)sh('mission-banner',0);
    if(this.dialogueTimer>0&&(this.dialogueTimer-=dt)<=0)sh('dlg-c',0);
    sh('crosshair',!p.inVehicle);
    const tod=rr.timeOfDay;if(e['h-tod'])tx('h-tod',tod>=.7&&tod<.8?'GOLDEN HOUR':tod>=.8&&tod<.91?'NEON DUSK':(tod>=.91||tod<.18)?'MIDNIGHT':tod>=.6?'LATE SUN':'TROPICAL DAWN');
    const obj=ms.getObjectiveText(),tgt=ms.getTargetPoint(),st=au.getCurrentStation();
    tx('m-ti',obj.title);tx('m-ob',obj.objective);tx('m-nx',obj.nextLabel);tx('m-di',`${round(dist2D(p.x,p.z,tgt.x,tgt.z))}m`);
    let sb='';for(let i=1;i<=obj.totalStages;i++)sb+=`<div class="ss ${i<obj.stageIndex?'done':i===obj.stageIndex?'cur':''}"></div>`;
    e['s-bar'].innerHTML=`${sb}<span class="sl">STAGE ${obj.stageIndex}/${obj.totalStages}</span>`;tx('r-nm',`${st.name} — ${st.genre}`);
    const bf=sin(this.flashPhase)>0;this.starEls.forEach((s,i)=>{const a=i<po.wantedLevel;s.classList.toggle('on',a);s.classList.toggle('pulse',a&&bf);});
    if(po.wantedLevel>0){
      const tel=po.getDispatchTelemetry(p),ep=round((po.evadeTimer/po.evadeDuration)*100);
      tx('w-alt',po.jamTimer>0?`JAMMED (${Math.ceil(po.jamTimer)}s)`:po.heli?.group.visible?'AIR-1 LOCK':ep>15?`EVADE ${ep}%`:`${po.wantedLevel}★ CODE 3`);
      e['w-alt'].style.color=bf?'#00F0FF':'#FF3E7F';sh('d-card',1);
      tx('d-hd',`PKPD RESPONSE · ${tel.totalCount} UNITS`);tx('d-cd',tel.codeLabel);
      e['d-ls'].innerHTML=tel.units.map(u=>`<div class="dr"><span class="dcs">${u.callsign}</span><span class="db" style="background:${u.color};color:#080e1d">${u.badge}</span><span class="dd">${u.distance}m</span></div>`).join('');
      const ex=max(0,tel.totalCount-tel.units.length);tx('d-ft',`${ex?`+${ex} more · `:''}${tel.roadblockAhead?'Roadblock ahead':po.heli?.group.visible?'AIR-1 Spotlight Lock':'Units converging'}`);
    }else{tx('w-alt','CLEAR');e['w-alt'].style.color='#94a3b8';sh('d-card',0);}
    const rk=getSyndicateRank(p.respect);tx('h-ca',`$${p.cash.toLocaleString()}`);tx('h-rp',rk.label);tx('h-rpt',`${rk.rp}/${rk.nextRp}`);
    e['b-rp'].style.width=`${round(rk.progress*100)}%`;const hp=clamp(round(p.health),0,100),ar=clamp(round(p.armor),0,100);
    e['b-hp'].style.width=`${hp}%`;tx('v-hp',`${hp}`);e['b-ar'].style.width=`${ar}%`;tx('v-ar',`${ar}`);
    e['w-strip'].querySelectorAll('.w-slot').forEach(s=>{const wid=s.dataset.wid;s.classList.toggle('active',wid===p.activeWeapon);const am=s.querySelector(`[data-wam="${wid}"]`);if(am)am.textContent=wid==='fists'?'∞':`${p.ammo[wid]||0}`;});
    for(const c of crew.getHudState()){const cdEl=e['c-stk'].querySelector(`[data-ccd="${c.id}"]`);if(cdEl){cdEl.textContent=c.ready?'READY':`${c.remaining}s`;cdEl.closest('.crew-btn')?.classList.toggle('cd',!c.ready);}}
    const dist=w.getDistrictAt(p.x,p.z);tx('d-nm',dist.name);tx('d-tg',dist.tagline);this._drawMinimap();
    if(p.inVehicle&&p.vehicle){const v=p.vehicle,kmh=round(abs(v.speed)*4.8);sh('sp-c',1);tx('sp-m',`${kmh}`);tx('sp-g',v.speed<-.5?'REV':`G${min(6,max(1,floor(kmh/38)+1))}`);tx('sp-v',v.spec.name);e['vh-f'].style.width=`${clamp(round((v.hp/v.maxHp)*100),0,100)}%`;e['tg-d'].classList.toggle('on-drift',Boolean(v.isDrifting));e['tg-n'].classList.toggle('on-nitro',Boolean(v.isNitro));}
    else sh('sp-c',0);
    tx('ctx-p',p.contextPrompt||'');sh('ctx-p',p.contextPrompt);
    tx('status',`${dist.name} | Cash $${p.cash} | Wanted ${po.wantedLevel} stars | ${obj.title}: ${obj.objective}`);
  }

  _drawMinimap(){
    const ctx=this.minimapCtx,{player:p,world:w,vehicles:vh,entities:en2,police:po,missions:ms}=this.game,sz=168,hf=84,sc=.54;
    const mx=x=>hf+(x-p.x)*sc,my=z=>hf+(z-p.z)*sc,dot=(x,y,r,c)=>{ctx.fillStyle=c;ctx.beginPath();ctx.arc(x,y,r,0,PI*2);ctx.fill();};
    ctx.save();ctx.clearRect(0,0,sz,sz);ctx.beginPath();ctx.arc(hf,hf,hf,0,PI*2);ctx.clip();ctx.fillStyle='#0284c7';ctx.fillRect(0,0,sz,sz);
    drawCityBlockBackdrop(ctx,mx,my);
    const tgt=ms.getTargetPoint();drawMapOverlay(ctx,mx,my,w.computeGpsPath(p.x,p.z,tgt.x,tgt.z),tgt,false);
    for(const v of vh.vehicles){if(v.destroyed||v.driver==='player')continue;const vx=mx(v.x),vy=my(v.z);if(vx>=0&&vx<=sz&&vy>=0&&vy<=sz)dot(vx,vy,v.driver==='police'?3.8:2.1,v.driver==='police'?(sin(this.flashPhase)>0?'#ff1744':'#00e5ff'):'#94a3b8');}
    for(const en of en2.enemies)if(en.alive)dot(mx(en.x),my(en.z),2.8,'#ff3e7f');
    if(po.heli?.group.visible){ctx.save();ctx.setLineDash([3,3]);ctx.strokeStyle='#00F0FF';ctx.lineWidth=1.6;ctx.beginPath();ctx.arc(mx(po.heli.x),my(po.heli.z),12,0,PI*2);ctx.stroke();ctx.restore();}
    drawPlayerArrow(ctx,hf,hf,p.yaw,.86,false);ctx.restore();
  }
}
