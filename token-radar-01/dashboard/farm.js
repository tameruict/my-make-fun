(function(R){
'use strict';
const TH=25,DT=[1e3,5e3,25e3,1e5],FP=.1,DS=.05,CR=.02,N=Number.isFinite,P=Date.parse,RD=Math.round;
const GP='4A:Ethereum|3.5sA:Bitcoin|.12B:Arbitrum,Manta,Morph|.08B:Base,Mantle,Ink,Robinhood Chain,Reya Network,RISE|.1B:Fluent,Plume Mainnet|.04B:Polygon|.15B:Starknet,BSquared,Mezo|.18B:zkSync Era|.05B:World Chain|.25B:RSK|.01sC:Solana,Stellar,Algorand,Ripple|.02C:Hyperliquid L1,Plasma,Ronin|.02sC:Sui,Aptos,Proton,Qubic|.1C:Binance|.25C:Avalanche|.2sC:Tron|.03C:Monad,Flare,Klaytn,Tempo,Stable|.03sC:XION|.05C:Arc,Kava,Bifrost Network|.05sC:Bittensor,Provenance,Noble,Canton|.15C:Stacks|.04C:Pharos,Strato|.08C:Berachain';
const ST=new Set(),CGS=Object.create(null);
for(const g of GP.split('|')){const[m,l]=g.split(':'),v={perTx:parseFloat(m),tier:m.slice(-1)};for(const c of l.split(','))m.includes('s')&&ST.add(c),CGS[c]=v;}Object.freeze(CGS);
const bps=c=>/^(Pred|Dex)/.test(c)?20:/^(Basis|Liq|Lev|OTC)/.test(c)?15:/^(RWA|Der|CDP$|Dual|Cro|Ind|Int)/.test(c)?10:/^(Risk|Col|Onc|Yie|Stak|Res|Unc|Ins)/.test(c)?0:5;
const r2=v=>RD((v+Number.EPSILON)*100)/100,f2=v=>v.toFixed(2),fI=v=>'$'+RD(v).toLocaleString('en-US'),nu=(v,d,z)=>N(v)&&(z?v>=0:v>0)?v:d,cl=(v,a,b)=>v<a?a:v>b?b:v,mk=(k,v,p='')=>Object.fromEntries(k.split(',').map((x,i)=>[p+x,v[i]]));
const rGas=r=>{let cs=(r?.chains||[]).filter(Boolean),c=cs[0]||r?.chain||'Ethereum',e=CGS[c];return{chain:c,secondaryChain:cs[1]||null,chainCount:cs.length||1,perTxGas:e?e.perTx:.25,gasTier:e?e.tier:'C',source:e?'chain-schedule':'fallback-assumption',singleTxEntry:ST.has(c)};};
const dUsd=t=>(t=nu(+t,0),t>=5e8?cl(RD(t*2.5e-5/500)*500,2e4,25e3):t>=5e7?cl(RD(t*4e-5/250)*250,2500,2e4):cl(RD(t*5e-5/50)*50,500,2500));
function core(r={},o={}){
 let a=o.as_of||'2026-11-14',t=nu(+r.tvl_usd,0),m=nu(+r.implied_value_usd,0),m2=nu(+r.implied_p25_usd,m),ds=nu(o.drop_share,DS,1),fp=nu(o.farmer_participation,FP),cr=nu(o.capital_charge_rate,CR,1),dp=nu(o.deposit_usd,0)?r2(o.deposit_usd):dUsd(t),ci=rGas(r),pt=ci.perTxGas,ch=ci.chain,iA=ci.gasTier=='A',L1=iA&&t<25e6,bH=t>=1e8?45:30,hz=RD(nu(o.horizon_days,bH)),dn=nu(o.season_days,bH),dx=(P(a)-P(r.listed_at))/864e5,ag=nu(r.age_days,N(dx)&&dx>=0?dx|0:null,1);ag!=null&&(ag|=0);
 let wk=iA?2:t>=1e9||t>=25e7&&(ag==null||ag>=90)||t>=1e8&&ag>=730?4:3,c7=N(r.change_7d)?r.change_7d:null,[w0,w1]=c7>=5?[.55,.3]:c7<=-5?[.35,.35]:[.45,.3],x1=L1?RD(dp*.65):RD(dp*w0),x2=L1?0:RD(dp*w1),x3=r2(dp-x1-x2),ct=r.category||'DeFi',fr=bps(ct)*1e-4,nm=r.name||r.slug||'Protocol',fn=c7!=null?`; 7d ${c7.toFixed(1)}%`:'',pn=r.parent_factor<1?`; ${r.off_list_sibling||r.parent_factor+'x'}`:'',d=(L1?[0,14,21,30]:[0,14,21,30,45]).map(x=>RD(x*hz/(L1?30:45))),t2=iA?1:2,pg=0,fe=0,mn=0,dd=0,sp=[],sd=[];
 const st=(lb,d0,cp,tx,fb,u)=>{
  let i=sp.length,dd0=!cp&&tx?RD(hz*.5):hz-d[i],g=tx?r2(tx*pt):0,f=tx&&fr?r2(fb*fr):0,s=`${lb}: ${d0} in ${nm} (${ct}) on ${ch} (${tx?`${tx} tx x $${f2(pt)} = $${f2(g)} gas${f>0?` + $${f2(f)} fee`:''}`:'0 tx = $0.00 gas, $0.00 fee'}; ${u}m).`;
  pg=r2(pg+g);fe=r2(fe+f);mn+=u;cp&&(dd=r2(dd+r2(cp*dd0)));sd.push(dd0);sp.push(s.length>600?s.slice(0,597)+'...':s);
 };
 st(`Day 0 ${a}`,`deposit ${fI(x1)}${ag!=null?`; ${ag}d`:''}`,x1,ci.singleTxEntry||iA?1:2,x1*.6,16);
 L1||st(`Days 1-${d[1]}`,`add ${fI(x2)}${ci.secondaryChain?` (${ci.secondaryChain})`:''}${fn}`,x2,t2,x2*.25,12);
 st(`Weekly x${wk} ${d[sp.length]}-${d[sp.length+1]-1}d`,`${wk}x checks +${fI(x3)}`,x3,L1?wk:wk+1,x3*.35+dp*.08*wk*.2,wk*5+6);
 st(`Days ${d[sp.length]}-${hz-1} (Hold)`,`hold ${fI(dp)}${c7<=-5?fn:''}${pn}`,0,0,0,8);
 st(`Day ${hz}`,`exit 50% retaining ${fI(dp*.5)}`,0,t2,dp*.1,12);
 let hr=r2(mn/60),cc=r2(dd*cr/365),gs=r2(pg+fe),cs=r2(gs+cc),sh=t>0?dd/(fp*t*dn):0,ev=v=>{let dr=r2(ds*v*sh),nt=r2(dr-cs),nh=hr>0?r2(nt/hr):0;return[dr,nt,nh,nh>=TH?'FARM':nt>0?'MARGINAL':'SKIP'];},[dr,nt,nh,v]=ev(m),[d2,n2,h2,v2]=ev(m2),sg=nt>0?'+':'',sm=`${v}|${fI(dp)}|${ch}|$${f2(cs)}|$${f2(dr)} drop|${sg}$${f2(nt)}(${sg}$${f2(nh)}/h)|P25 ${v2}|${hz}d`;
 return[dp,pg,fe,cc,cs,dr,hr,v,hz,sp,gs,n2>0,nt,nh,d2,n2,h2,v2,sd,sd[sd.length-1],sm,dd,ch,ci.gasTier,pt,ci.source,+sh.toFixed(10),!1];
}
const plan=(r,o)=>mk('depositUsd,pureGasUsd,feesUsd,capitalChargeUsd,totalCostUsd,expectedDropUsd,farmHours,verdict,horizonDays,steps,gasUsd,farmRobust,netUsd,netPerHourUsd,expectedDropP25Usd,netP25Usd,netP25PerHourUsd,verdictP25,stepDays,exitDaysDeployed',core(r,o));
const tiers=(r,o)=>DT.map(c=>{const a=core(r,{...o,deposit_usd:c});return mk('capital_usd,gas_usd,fees_usd,capital_charge_usd,total_cost_usd,expected_drop_usd,hours,verdict,net_usd,net_per_hour_usd',[...a.slice(0,8),a[12],a[13]]);});
const row=(r,o)=>{const a=core(r,o);return{...mk('capital_usd,pure_gas_usd,fees_usd,capital_charge_usd,total_cost_usd,expected_drop_usd,hours,verdict,days,steps,gas_usd,robust',a,'farm_'),...mk('summary,counted_dollar_days,chain,gas_tier,per_tx_gas_usd,gas_source,dollar_days_share,placeholder',a.slice(20),'farm_'),...mk('net_usd,net_per_hour_usd,expected_drop_p25_usd,net_p25_usd,net_p25_per_hour_usd,verdict_p25',a.slice(12)),farm_deposit_tiers:o?.deposit_usd||o?.skip_tiers?[]:tiers(r,o)};};
const F={ENGINE_VERSION:'4.1.0',IS_PLACEHOLDER:!1,VERDICT_THRESHOLD_PER_HOUR:TH,DEPOSIT_TIERS:DT,HORIZON_TIERS:[30,45,60],FARMER_PARTICIPATION:FP,DROP_SHARE:DS,CAPITAL_CHARGE_RATE:CR,DEFAULT_FALLBACK_GAS_USD:.25,CHAIN_GAS_SCHEDULE:CGS,resolveChainGas:rGas,computeDefaultDepositUsd:dUsd,computeFarmPlan:plan,precomputeDepositTiers:tiers,planRow:row};
R&&(R.RadarFarm=F);typeof module<'u'&&module.exports&&(module.exports=F);
})(typeof globalThis<'u'?globalThis:typeof window<'u'?window:this);
