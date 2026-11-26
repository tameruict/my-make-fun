(() => {
'use strict';
const D=document,R=window.RADAR,F=window.RadarFarm,M=window.RadarModel,$=i=>D.getElementById(i),tn=s=>D.createTextNode(s),{round:rd,abs,min,max,log10}=Math;
const isN=v=>typeof v==='number'&&isFinite(v),E='\u2014',MO='Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');
const el=(t,c,x)=>{const e=D.createElement(t);c&&(e.className=c);x!=null&&(e.textContent=x);return e};
const add=(p,...cs)=>{for(const c of cs)c!=null&&p.append(c);return p},td=(m,c,s)=>{const e=el('td',c,m);s!=null&&e.append(el('small',0,s));return e};
const usd=v=>{if(!isN(v))return E;const a=abs(v),s=v<0?'-$':'$';return a>=1e9?s+(a/1e9).toFixed(2)+'B':a>=1e6?s+(a/1e6).toFixed(1)+'M':a>=1e4?s+(a/1e3).toFixed(1)+'K':s+(a>=1e3?rd(a).toLocaleString('en-US'):a.toFixed(2))};
const sUsd=v=>(isN(v)&&v>0?'+':'')+usd(v),pct=(v,d=1)=>isN(v)?(v*100).toFixed(d)+'%':E,fold=v=>isN(v)?'x'+v.toFixed(2):E,f3=v=>isN(v)?v.toFixed(3):E,xf=(v,d=4)=>isN(v)?'x'+v.toFixed(d):E;
const day=s=>{const m=/^(\d{4})-(\d\d)-(\d\d)/.exec(s||'');return m?+m[3]+' '+MO[+m[2]-1]+' '+m[1]:E};
if(!R||!Array.isArray(R.rows)){$('nodata').hidden=!1;$('sub').textContent='No data: window.RADAR absent.';for(const i of['kpis','integrity','ledger'])$(i).hidden=!0;return}
const rows=R.rows,N=rows.length,ev=R.evidence||{},vm=ev.value_model||{},rh=ev.range_honesty||{},to=ev.token_odds||{},fm=ev.farm||{},ig=ev.integrity||{},fc=R.snapshot_facts||{},comps=R.comparables||[];
const thr=isN(fm.verdict_threshold_per_hour)?fm.verdict_threshold_per_hour:25,cnt=f=>rows.reduce((n,r)=>n+(f(r)?1:0),0);
const wlN=cnt(r=>r.is_watchlist),earN=cnt(r=>r.watchlist_tier==='early'),offN=cnt(r=>r.watchlist_tier==='off-list-parent'),wlT=ev.watchlist_total??fc.watchlist_count,totP=ev.total_protocols??fc.total_protocols,cM=fc.clean_comparables_count??ev.comparable_count??comps.length;
$('t-board').textContent=`pre-token (${N})`;$('t-comps').textContent=`tokenized (${comps.length})`;
$('sub').textContent=`Snapshot ${day(R.as_of)} ${E} frozen DefiLlama data. ${N} pre-token protocols ranked by implied = if launches \u00d7 odds \u00d7 parent, of ${totP??E}; floor ${usd(R.floor_usd)} TVL.`;
const kpi=(m,v,n)=>{const b=el('b',0,m);v&&b.append(el('span','vs',' '+v));return add(el('div','kpi'),b,el('i',0,n))};
const fN=fm.worth_farming_count??cnt(r=>r.farm_verdict==='FARM'),robN=fm.robust_count??cnt(r=>r.farm_robust);
const farmCard=kpi(`${fN} of ${N}`,`(${robN} robust)`,`worth farming >= $${thr}/h; ${fm.marginal_count??0} marginal, ${fm.skip_count??0} skip`);
add($('kpis'),
kpi(fold(vm.wf_med_fold),vm.wf_flat_med_fold?'vs flat '+fold(vm.wf_flat_med_fold):'',`WF median miss (geo ${fold(vm.wf_miss_fold)} vs flat ${fold(vm.wf_flat_fold)})`),
kpi(fold(vm.loo_med_fold),vm.loo_flat_med_fold?'vs flat '+fold(vm.loo_flat_med_fold):'',`LOO med (geo ${fold(vm.loo_miss_fold)} vs ${fold(vm.loo_flat_fold)}; 5F ${fold(vm.sz5_geo_fold)})`),
kpi(isN(rh.p25_p75_pct)?`${rd(rh.p25_p75_pct)}% / ${rd(rh.p10_p90_pct)}%`:E,'',`range honesty P25-P75 (${rh.p25_p75_hits}/${rh.eval_n}) & P10-P90 (${rh.p10_p90_hits}/${rh.eval_n})`),
kpi(f3(to.cv10_brier),to.cv10_base_brier?'vs base '+f3(to.cv10_base_brier):'',`odds 10F Brier; WF ${f3(to.wf_brier)} vs base ${f3(to.wf_base_brier)}`),
kpi(isN(vm.terms_kept)?`${vm.terms_kept}/${vm.terms_tested}`:E,isN(to.terms_kept)?`+ odds ${to.terms_kept}/${to.terms_tested}`:'',`terms kept: 3-split value (${cM} comps) + 2-split odds`),
farmCard,kpi(`${wlN}/${wlT??E}`,'',`watchlist covered, + ${earN} early + ${offN} off-list`));
const fnv=M&&M.fnv1aHex?M.fnv1aHex:s=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(16).padStart(8,'0')};
const near=(a,b,t)=>isN(a)&&isN(b)&&abs(a-b)<=t;
function recOk(r){
const pr=r.intercept_multiple*r.size_curve_factor*r.category_effect_factor*r.chains_factor*r.growth_factor;
if(!(abs(r.multiple_used-pr)<=max(1e-3,r.multiple_used*2e-3)&&abs(r.if_launches_usd-rd(r.tvl_usd*r.multiple_used))<=1&&abs(r.implied_value_usd-rd(r.if_launches_usd*r.token_odds*r.parent_factor))<=2&&r.implied_p10_usd<=r.implied_p25_usd&&r.implied_p25_usd<=r.implied_value_usd&&r.implied_value_usd<=r.implied_p75_usd&&r.implied_p75_usd<=r.implied_p90_usd&&r.rank_low>=1&&r.rank_low<=r.rank&&r.rank<=r.rank_high&&r.rank_high<=N))return!1;
if(!F||!F.planRow)return near(r.farm_total_cost_usd,r.farm_gas_usd+r.farm_capital_charge_usd,.02);
const p=F.planRow(r,{as_of:R.as_of,floor_usd:R.floor_usd,skip_tiers:!0});
return near(p.farm_total_cost_usd,r.farm_total_cost_usd,.02)&&near(p.net_usd,r.net_usd,.02)&&near(p.net_p25_usd,r.net_p25_usd,.02)&&p.farm_verdict===r.farm_verdict;
}
const recN=cnt(recOk),rOk=rows.every((r,i)=>r.rank===i+1),mOk=rows.every((r,i)=>!i||rows[i-1].implied_value_usd>=r.implied_value_usd);
const tOk=(!isN(ev.ranked_count)||ev.ranked_count===N)&&(!isN(ig.rows_count)||ig.rows_count===N)&&wlN+earN+offN===N&&(!isN(ev.early_count)||ev.early_count===earN)&&(!isN(ev.off_list_count)||ev.off_list_count===offN);
const sum=fnv(rows.map(r=>`${r.rank}:${r.slug}:${r.implied_value_usd}`).join('|')),grps=(R.ledger&&R.ledger.groups)||[],lSum=grps.reduce((n,x)=>n+(x.count||0),0),lTot=isN(R.ledger&&R.ledger.total)?R.ledger.total:totP;
const chk=(ok,t)=>el('span',ok?'pass':'fail',(ok?'':'FAIL: ')+t);
const iEl=$('integrity');iEl.append(el('b',0,'This table = board.json: '));
[[recN===N,`${recN} of ${N} rows recomputed here`],[rOk,rOk?'ranks in order':'ranks out of order'],[mOk,mOk?'values never rise':'a value rises'],[tOk,tOk?'totals equal':'totals differ'],[!ig.board_checksum||ig.board_checksum===sum,`checksum ${sum}${ig.board_checksum?(ig.board_checksum===sum?' (matches model)':' (model '+ig.board_checksum+')'):''}`],[isN(wlT)&&wlN===wlT,`watchlist ${wlN}/${wlT??E}`],[grps.length&&lSum===lTot,`ledger ${lSum}/${lTot}`]].forEach(([o,t],i)=>iEl.append(i?tn(', '):'',chk(o,t)));
const L=$('ledger');L.append(el('b',0,`${lTot??E} protocols, each in one group: `));
for(const x of grps){const s=el('span'),b=el('i','bar');b.style.width=max(2,(x.share_pct||0)*.55)+'px';s.title=x.description||'';L.append(add(s,b,el('b',0,`${x.label} ${x.count}`),tn(` ${isN(x.share_pct)?x.share_pct.toFixed(1):E}%`)))}
L.append(chk(lSum===lTot,`${lSum}/${lTot} accounted`));
const st={tab:'board',q:'',tier:'all',cat:'',verdict:'',dep:'',hz:'',ds:.05,fp:.1,sk:'rank',sd:1,p:null},cs={sk:'tvl_usd',sd:-1};
let qKey='',qMap=new Map();
function quote(r,dOvr){
const d=isN(dOvr)&&dOvr>0?dOvr:0;if(!d&&!st.dep&&!st.hz&&st.ds===.05&&st.fp===.1)return r;
const k=`${st.dep}|${st.hz}|${st.ds}|${st.fp}`;if(k!==qKey){qKey=k;qMap=new Map()}
if(!d&&qMap.has(r.slug))return qMap.get(r.slug);
const o={as_of:R.as_of,floor_usd:R.floor_usd,drop_share:st.ds,farmer_participation:st.fp,skip_tiers:!0};
d?(o.deposit_usd=d):st.dep&&(o.deposit_usd=+st.dep);st.hz&&(o.horizon_days=+st.hz);
const res=F&&F.planRow?F.planRow(r,o):r;!d&&qMap.set(r.slug,res);return res;
}
function updateFarmKpi(){
let f=0,m=0,s=0,rob=0;for(const r of rows){const q=quote(r);q.farm_verdict==='FARM'?f++:q.farm_verdict==='MARGINAL'?m++:s++;q.farm_robust&&rob++}
farmCard.firstChild.replaceChildren(tn(`${f} of ${N} `),el('span','vs',`(${rob} robust)`));
farmCard.lastChild.textContent=`worth farming >= $${thr}/h; ${m} marginal, ${s} skip (${rd(st.ds*100)}% drop, ${rd(st.fp*100)}% farmers${st.hz?', '+st.hz+'d':''})`;
}
const VO={FARM:0,MARGINAL:1,SKIP:2},sVal=(r,k)=>k==='v'?VO[quote(r).farm_verdict]:k==='net'?quote(r).net_usd:k==='nph'?quote(r).net_per_hour_usd:typeof r[k]==='string'?r[k].toLowerCase():r[k];
const sorter=(s,fn)=>(a,b)=>{const x=fn(a,s.sk),y=fn(b,s.sk),nx=x==null,ny=y==null;return nx||ny?nx-ny:(x<y?-1:x>y?1:0)*s.sd};
const cats=[...new Set(rows.map(r=>r.category).filter(Boolean))].sort(),deps=(F&&F.DEPOSIT_TIERS)||[1e3,5e3,25e3,1e5];
for(const c of cats)$('cat').append(Object.assign(el('option',0,`${c} (${cnt(r=>r.category===c)})`),{value:c}));
for(const d of deps)$('dep').append(Object.assign(el('option',0,usd(d)),{value:String(d)}));
function filtered(){
const q=st.q.toLowerCase();
return rows.filter(r=>{
if(st.tier!=='all'&&!(st.tier==='top10'?r.rank<=10:st.tier==='watchlist'?r.is_watchlist:r.watchlist_tier===st.tier))return!1;
if(st.cat&&r.category!==st.cat)return!1;
if(st.verdict){const f=quote(r);if(st.verdict==='ROBUST'?!f.farm_robust:f.farm_verdict!==st.verdict)return!1}
return!q||[r.name,r.slug,r.category].some(s=>s&&s.toLowerCase().includes(q));
}).sort(sorter(st,sVal));
}
function renderBoard(){
const list=filtered(),fr=D.createDocumentFragment();
for(const r of list){
const f=quote(r),tr=el('tr',r.slug===st.p?'sel':0),v=f.farm_verdict,c7=r.change_7d;
const top=add(el('div'),el('span','nm',r.name),r.is_watchlist?el('span','star','\u2605'):null,r.watchlist_tier!=='watchlist'?el('span','tag'+(r.watchlist_tier==='off-list-parent'?' off':''),r.watchlist_tier):null);
const od=add(el('td','n'),add(el('span','odds'),Object.assign(el('i'),{style:`width:${isN(r.token_odds)?r.token_odds*100:0}%`})),tn(pct(r.token_odds)));
add(tr,td(String(r.rank),0,`${r.rank_low}-${r.rank_high}`),add(el('td'),top,el('small',0,r.slug)),td(r.category||E,0,`n=${r.category_n} comps`),
td(usd(r.tvl_usd),'n'),td(isN(c7)?`${c7>0?'+':''}${c7.toFixed(1)}%`:E,'n '+(c7>0?'up':c7<0?'dn':'')),
od,td(usd(r.if_launches_usd),'n'),td(usd(r.implied_value_usd),'n nm',`${usd(r.implied_p25_usd)} - ${usd(r.implied_p75_usd)}`),
add(el('td'),el('span','v '+v,v),el('small',0,'P25 '+f.verdict_p25)),td(sUsd(f.net_usd),'n '+(f.net_usd>0?'up':f.net_usd<0?'dn':'')),td(sUsd(f.net_per_hour_usd)+'/h','n'));
tr.onclick=()=>openDetail(r.slug===st.p?null:r.slug);fr.append(tr);
}
$('board').tBodies[0].replaceChildren(fr);
$('count').textContent=`showing ${list.length} of ${N} rows${st.sk==='rank'&&st.sd===1?', board.json order':''}`;heads($('board'),st);
}
function heads(t,s){for(const th of t.tHead.rows[0].cells)th.className=(th.classList.contains('n')?'n ':'')+(th.dataset.k===s.sk?'s'+s.sd:'')}
function bindSort(t,s,fn){t.tHead.onclick=e=>{const k=e.target.closest('th')?.dataset.k;if(!k)return;s.sk===k?(s.sd=-s.sd):(s.sk=k,s.sd=['rank','name','category','i','listed_at','v'].includes(k)?1:-1);fn()}}
function renderScatter(){
const sc=$('scatter'),pts=comps.filter(c=>c.mcap_usd>0&&c.fitted_if_launches_usd>0);if(!sc||!pts.length)return;
const lx=pts.map(c=>log10(c.mcap_usd)),ly=pts.map(c=>log10(c.fitted_if_launches_usd)),lo=min(...lx,...ly),hi=max(...lx,...ly),sp=hi-lo||1;
$('scat-sub').textContent=`${pts.length} comps (y=x)`;$('syl').textContent=`Fit (${usd(10**lo)}\u2192${usd(10**hi)})`;$('sxl').textContent=`Cap: ${usd(min(...pts.map(c=>c.mcap_usd)))}\u2192${usd(max(...pts.map(c=>c.mcap_usd)))}`;
const fr=D.createDocumentFragment();
for(const c of pts){const d=el('i','sdot');d.style.left=(((log10(c.mcap_usd)-lo)/sp)*88+6).toFixed(1)+'%';d.style.top=(94-((log10(c.fitted_if_launches_usd)-lo)/sp)*88).toFixed(1)+'%';d.title=`${c.name}: Cap ${usd(c.mcap_usd)}, Fit ${usd(c.fitted_if_launches_usd)}`;fr.append(d)}
sc.append(fr);
}
function kv(pairs){const t=el('table','kv');for(const[k,v,cls]of pairs){const tr=el('tr',cls),c=el('td');v instanceof Node?c.append(v):(c.textContent=v);t.append(add(tr,el('td',0,k),c))}return t}
function openDetail(slug){st.p=slug;$('evpanel')&&($('evpanel').hidden=!!slug);renderDetail();renderBoard();writeHash()}
function renderDetail(){
const P=$('detail'),r=st.p&&rows.find(x=>x.slug===st.p);$('bwrap').classList.toggle('short',!!r);
if(!r){P.hidden=!0;P.replaceChildren();return}
const f=quote(r),h=el('div','dh'),close=el('button',0,'Close (Esc)');close.onclick=()=>openDetail(null);
add(h,add(el('div'),el('h2',0,`#${r.rank}  ${r.name}`),el('span','dim',[r.slug,r.category||'uncategorized',(r.chains||[]).join(', '),`listed ${day(r.listed_at)}${isN(r.age_days)?` (${r.age_days}d, no token recorded)`:''}`,r.watchlist_tier].join('  |  '))),close);
const c1=el('div'),c2=el('div'),c3=el('div'),lo=r.implied_p10_usd,sp=(r.implied_p90_usd-lo)||1,pos=v=>min(100,max(0,((v-lo)/sp)*100))+'%';
add(c1,el('h3',0,'Value, every factor'),kv([
['intercept multiple (baseline)',xf(r.intercept_multiple)],['\u00d7 size-curve factor (log TVL)',xf(r.size_curve_factor)],
[`\u00d7 category effect (ridge, n=${r.category_n})`,xf(r.category_effect_factor)],[`\u00d7 chain-count (${(r.chains||[]).length} chains)`,xf(r.chains_factor)],
['\u00d7 7d TVL momentum (tanh)',xf(r.growth_factor)],['= multiple used (cap / TVL)',xf(r.multiple_used,6),'tot'],
['TVL',usd(r.tvl_usd)],['= if it launches (TVL \u00d7 mult)',usd(r.if_launches_usd),'tot'],
['\u00d7 token odds (peers\' record)',pct(r.token_odds)],['\u00d7 parent factor',xf(r.parent_factor,2)],['= implied value',usd(r.implied_value_usd),'tot']]));
const band=add(el('div','band'),Object.assign(el('i'),{style:'left:0;right:0'}),Object.assign(el('i','in'),{style:`left:${pos(r.implied_p25_usd)};width:calc(${pos(r.implied_p75_usd)} - ${pos(r.implied_p25_usd)})`}),Object.assign(el('b'),{style:`left:${pos(r.implied_value_usd)}`}));
add(c1,el('h3',0,'Range + rank'),band,el('p','note',`Implied P10 ${usd(r.implied_p10_usd)} | P25 ${usd(r.implied_p25_usd)} | P75 ${usd(r.implied_p75_usd)} | P90 ${usd(r.implied_p90_usd)}`),
el('p','note',`If launches P25-P75: ${usd(r.if_launches_p25_usd)} - ${usd(r.if_launches_p75_usd)}. Rank #${r.rank} (${r.rank_low}-${r.rank_high}, ${vm.bootstrap_draws||300} refits).`));
r.watchlist_tier==='off-list-parent'&&c1.append(el('p','note',`Off watchlist: ${String(r.off_list_reason||E).replace(/-/g,' ')} (${r.off_list_sibling?'sibling: '+r.off_list_sibling:'no sibling; 0.5x assumption'}); factor x${r.parent_factor}.`));
add(c2,el('h3',0,`Farm arithmetic, deposit ${usd(f.farm_capital_usd)} (${f.farm_days}d, ${st.dep?'tier':'default'})`),kv([
['deposit capital',usd(f.farm_capital_usd)],[`expected drop (${rd(st.ds*100)}% drop, ${rd(st.fp*100)}% farmers)`,usd(f.farm_expected_drop_usd)],
[`execution gas (${r.farm_chain||E} ${r.farm_gas_tier||E} @ $${(r.farm_per_tx_gas_usd||0).toFixed(2)}/tx)`,'-'+usd(f.farm_pure_gas_usd)],
['protocol / swap / hedge fees','-'+usd(f.farm_fees_usd)],[`capital charge (${f.farm_days}d @ 2%/yr)`,'-'+usd(f.farm_capital_charge_usd)],
['= total cost (gas + fees + charge)','-'+usd(f.farm_total_cost_usd)],['= net (implied)',sUsd(f.net_usd),'tot'],
['work hours',isN(f.farm_hours)?f.farm_hours.toFixed(2)+' h':E],['net per hour',sUsd(f.net_per_hour_usd)+'/h','tot'],
[`verdict (FARM >= $${thr}/h)`,el('span','v '+f.farm_verdict,f.farm_verdict)],[`P25 stress (drop ${usd(f.expected_drop_p25_usd)})`,`${sUsd(f.net_p25_usd)} (${sUsd(f.net_p25_per_hour_usd)}/h) \u00b7 ${f.verdict_p25}`]]));
const qt=el('table','kv');for(const cUsd of deps){const qx=quote(r,cUsd);qt.append(add(el('tr'),el('td',0,usd(cUsd)+' deposit'),el('td',0,`${sUsd(qx.net_usd)}  ${sUsd(qx.net_per_hour_usd)}/h  ${qx.farm_verdict}`)))}
add(c2,el('h3',0,`All deposit quotes (${f.farm_days}d)`),qt,f.farm_summary?el('p','note',f.farm_summary):null);
const ol=el('ol');for(const s of f.farm_steps||[])ol.append(el('li',0,s));
add(c3,el('h3',0,`Farm steps (${(f.farm_steps||[]).length}, ${f.farm_days}d)`),ol,el('h3',0,'Same-category peers, already tokenized'));
const peers=(r.same_cat_peers||[]).filter(p=>p.category===r.category);
if(!peers.length)c3.append(el('p','note',`No clean same-category comp ${E} no cross-category stand-in.`));
else{const pt=el('table','kv');for(const p of peers)pt.append(add(el('tr'),el('td',0,`${p.name} (TVL ${usd(p.tvl_usd)})`),el('td',0,`${usd(p.mcap_usd)}  ${xf(p.ratio,2)}`)));c3.append(pt)}
P.replaceChildren(h,add(el('div','dg'),c1,c2,c3));P.hidden=!1;
requestAnimationFrame(()=>{const s=$('bwrap').querySelector('tr.sel');s&&($('bwrap').scrollTop=s.offsetTop-28)});
}
comps.forEach((c,i)=>{c.i=i+1});
$('comphead').append(el('b',0,`${comps.length} of ${cM} clean comparables ${E} all shown. `),tn('Already tokenized (mcap >= $1M, cap/TVL 0.005x-25x; bridges, liquid staking & CEX excluded): value model fitted on these caps; never ranked on pre-token board.'));
function renderComps(){
const fr=D.createDocumentFragment();
for(const c of comps.slice().sort(sorter(cs,(r,k)=>typeof r[k]==='string'?r[k].toLowerCase():r[k]))){
fr.append(add(el('tr'),td(String(c.i)),add(el('td'),el('span','nm',c.name),el('small',0,c.slug)),td(c.category||E),td(usd(c.tvl_usd),'n'),td(usd(c.mcap_usd),'n'),td(xf(c.ratio,3),'n'),td(usd(c.fitted_if_launches_usd),'n'),td(fold(c.residual_fold),'n'),td(c.listed_at||E)));
}
$('comps').tBodies[0].replaceChildren(fr);heads($('comps'),cs);
}
function table(id,head,data,cells){const t=$(id),hr=el('tr'),tb=el('tbody');for(const h of head)hr.append(el('th',0,h));for(const d of data||[]){const tr=el('tr');for(const[v,c]of cells(d))tr.append(el('td',c,v));tb.append(tr)}add(t,add(el('thead'),hr),tb)}
const et=R.evidence_tables||{};
$('ev-eq').append(el('b',0,'Model: '),tn('if_launches = TVL \u00d7 exp(\u03b2\u2080+\u03b2_tvl\u00b7logTVL+\u03b2_cat+\u03b2_ch\u00b7log1p(ch)) \u00d7 (1+0.08\u00b7tanh(7d/50)) | implied = if_launches\u00d7odds\u00d7parent | net = drop%\u00d7implied\u00d7share - (gas+fees+2%/yr)'));
table('vterms',['#','Term','LOO geo','LOO med','WF geo','WF med','5F med','Dec','Reason'],et.value_terms,d=>[[String(d.step)],[d.term],[fold(d.loo_geo_fold),'n'],[fold(d.loo_med_fold),'n'],[fold(d.wf_geo_fold),'n'],[fold(d.wf_med_fold),'n'],[fold(d.sz5_med_fold),'n'],[d.decision,d.decision],[d.reason]]);
if(vm.lambda_sensitivity&&vm.lambda_sensitivity.length){const ls=vm.lambda_sensitivity,tr=el('tr','dim'),fmt=k=>ls.map(x=>x[k].toFixed(2)).join('/');for(const[v,c]of[['\u03bb'],['Ridge \u03bb_cat (2/6/12)'],[fmt('loo_geo_fold'),'n'],[fmt('loo_med_fold'),'n'],[fmt('wf_geo_fold'),'n'],[fmt('wf_med_fold'),'n'],[fmt('sz5_med_fold'),'n'],['CHECK','CHECK'],['\u03bb=6 balances LOO/WF']])tr.append(el('td',c,v));$('vterms').tBodies[0].append(tr)}
table('oterms',['#','Term','CV10','WF','Dec','Reason'],et.odds_terms,d=>[[String(d.step)],[d.term],[f3(d.cv10_brier),'n'],[f3(d.wf_brier),'n'],[d.decision,d.decision],[d.reason]]);
table('rhon',['Band','Target','Hits / n','Observed'],et.range_honesty_rows,d=>[[d.band],[isN(d.target_pct)?d.target_pct+'%':E,'n'],[`${d.observed_hits} / ${d.eval_n}`,'n'],[isN(d.observed_pct)?d.observed_pct.toFixed(1)+'%':E,'n']]);
const oc=vm.off_list_check;
$('vt-sum').textContent=(isN(vm.terms_kept)?`${vm.terms_kept}/${vm.terms_tested} kept; flat LOO ${fold(vm.loo_flat_fold)}, WF ${fold(vm.wf_flat_fold)}`:'')+(oc?` | off-list n=${oc.prefix_sib_n} med ${oc.prefix_sib_med_fit_act} vs ${oc.standalone_med_fit_act}`:'');
$('ot-sum').textContent=isN(to.pool_n)?`${to.recorded_token_n}/${to.pool_n} tokenized (${pct(to.base_rate)})`:'';$('rh-sum').textContent=`n=${rh.eval_n||E} later-listed`;
const EK=['rank','slug','name','category','watchlist_tier','tvl_usd','change_7d','token_odds','if_launches_usd','implied_value_usd','implied_p25_usd','implied_p75_usd','rank_low','rank_high'],FK=['farm_verdict','verdict_p25','farm_robust','farm_capital_usd','farm_days','net_usd','net_per_hour_usd'],AK=[...EK,...FK];
function exportData(kind){
const list=filtered().map(r=>{const f=quote(r),o={};for(const k of EK)o[k]=r[k];for(const k of FK)o[k]=f[k];return o});
const esc=v=>v==null?'':/[,"\n]/.test(String(v))?'"'+String(v).replace(/"/g,'""')+'"':String(v);
const txt=kind==='json'?JSON.stringify(list,null,2):[AK.join(','),...list.map(r=>AK.map(k=>esc(r[k])).join(','))].join('\n');
const a=el('a'),u=URL.createObjectURL(new Blob([txt],{type:kind==='json'?'application/json':'text/csv'}));a.href=u;a.download='token-radar-v4.'+kind;a.click();setTimeout(()=>URL.revokeObjectURL(u),1e3);
}
function showTab(){for(const b of $('tabs').children)b.classList.toggle('on',b.dataset.tab===st.tab);$('v-board').hidden=st.tab!=='board';$('v-comparables').hidden=st.tab!=='comparables'}
const HK=[['tab','board'],['p',null],['cat',''],['tier','all'],['verdict',''],['dep',''],['hz',''],['q','']];
function writeHash(){const p=new URLSearchParams();for(const[k,d]of HK)st[k]!==d&&st[k]&&p.set(k,st[k]);history.replaceState(null,'','#'+p.toString())}
function readHash(){
const p=new URLSearchParams(location.hash.slice(1));st.tab=p.get('tab')==='comparables'?'comparables':'board';st.cat=cats.includes(p.get('cat'))?p.get('cat'):'';
st.tier=['all','top10','watchlist','early','off-list-parent'].includes(p.get('tier'))?p.get('tier'):'all';
st.verdict=['FARM','MARGINAL','SKIP','ROBUST'].includes(p.get('verdict'))?p.get('verdict'):'';
st.dep=deps.map(String).includes(p.get('dep'))?p.get('dep'):'';st.hz=['30','45','60'].includes(p.get('hz'))?p.get('hz'):'';
st.q=p.get('q')||'';st.p=rows.some(r=>r.slug===p.get('p'))?p.get('p'):null;st.p&&(st.tab='board');$('evpanel')&&($('evpanel').hidden=!!st.p);
for(const k of['cat','tier','verdict','dep','hz','q'])$(k).value=st[k];updateFarmKpi();showTab();renderBoard();renderDetail();
}
$('tabs').onclick=e=>{const b=e.target.closest('button');if(b){st.tab=b.dataset.tab;showTab();writeHash()}};
const bind=(id,key,num,farm)=>{$(id).oninput=()=>{st[key]=num?+$(id).value:$(id).value;farm&&updateFarmKpi();renderBoard();farm&&renderDetail();['cat','tier','verdict','dep','hz','q'].includes(key)&&writeHash()}};
bind('q','q');bind('tier','tier');bind('cat','cat');bind('verdict','verdict');bind('dep','dep',0,1);bind('hz','hz',0,1);bind('ds','ds',1,1);bind('fp','fp',1,1);
bindSort($('board'),st,renderBoard);bindSort($('comps'),cs,renderComps);$('exp-csv').onclick=()=>exportData('csv');$('exp-json').onclick=()=>exportData('json');
D.addEventListener('keydown',e=>{e.key==='Escape'&&st.p&&openDetail(null)});window.addEventListener('hashchange',readHash);
renderScatter();renderComps();readHash();
})();
