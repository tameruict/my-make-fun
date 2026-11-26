export const GAME_TITLE='PALMERA KEYS: GOLDEN HOUR';
export const GAME_SUBTITLE='SUN-SOAKED COASTAL OPEN-WORLD ACTION & HEIST SANDBOX';
export const ROAD_X=[-180,-90,0,90,180],ROAD_Z=[-180,-90,0,90,180],ROAD_WIDTH=18,SIDEWALK_WIDTH=4.5;
export const WORLD_BOUNDS={minX:-255,maxX:445,minZ:-235,maxZ:235},TIME_PRESETS={dawn:.24,golden:.74,dusk:.84,night:.96};
const D=(id,name,tagline,color,minX,maxX,minZ,maxZ)=>({id,name,tagline,color,bounds:{minX,maxX,minZ,maxZ}});
export const DISTRICTS=[
  D('causeway','Coral Keys Causeway','Overwater Suspension Bridge','#00F0FF',192,325,-36,36),
  D('sunset_hills','Sunset Hills & Villas','Private Island Estates & Helipad','#FF9A44',320,445,-170,170),
  D('oceanfront','Oceanfront Strip','Art-Deco Hotels & Palm Boardwalk','#FF3E7F',120,255,-235,235),
  D('harbor','Palmera Harbor & Marina','Gantry Cranes & Vaults','#F59E0B',-255,120,115,235),
  D('downtown','Downtown Spire','Glass Towers & Stunt Plazas','#38BDF8',-65,120,-115,115),
  D('auto_row','Neon Auto Row','Sunset Customs & Armory','#2CEAA3',-255,120,-235,115),
];
const L=(id,name,type,x,z,radius,color,icon,desc)=>({id,name,type,x,z,radius,color,icon,desc});
export const LANDMARKS=[
  L('garage','Sunset Customs Garage','garage',-62,-40,13,'#00F0FF','wrench','Respray, clear heat & upgrades'),
  L('armory','Coastal Tactics Armory','armory',-118,-24,7.5,'#FF3E7F','shield','Firearms & tactical kevlar'),
  L('safehouse','Sunset Hills Penthouse','safehouse',374,-24,8,'#FF9A44','home','3-slot save & island helipad'),
  L('harbor_vault','Palmera Harbor Vault','heist',-125,158,8.5,'#F59E0B','anchor','Container terminal & convoy yard'),
  L('race_start','Oceanfront Sprint Meet','activity',180,-90,8,'#2CEAA3','flag','Street races & courier runs'),
];
const V=(id,name,category,maxSpeed,accel,brake,turnRate,driftGrip,maxHp,mass,width,length,height,color,accent,spoiler,roof,ex={})=>({id,name,category,maxSpeed,accel,brake,turnRate,driftGrip,maxHp,mass,width,length,height,color,accent,spoiler:Boolean(spoiler),roof,...ex});
export const VEHICLE_SPECS={
  veloce_gt:V('veloce_gt','Veloce GT','Supercar',50,34,38,2.6,.87,260,1.25,2.15,4.78,1.26,0xff5e3a,0x00f0ff,1,'coupe'),
  corsa_spider:V('corsa_spider','Corsa Spider','Roadster',47,32,35,2.75,.85,225,1.15,2.08,4.55,1.2,0x00f0ff,0xff3e7f,1,'open'),
  toro_v8:V('toro_v8','Toro V8','Muscle',44,30,31,2.4,.78,300,1.52,2.22,4.88,1.36,0xffb800,0x111827,0,'muscle',{scoop:true}),
  brava_coupe:V('brava_coupe','Brava Coupe','Street',37,24,29,2.45,.9,230,1.32,2.06,4.52,1.4,0x38bdf8,0xe2e8f0,0,'sedan'),
  apex_nomad:V('apex_nomad','Apex Nomad','Coastal SUV',35,23,28,2.2,.92,350,1.85,2.34,4.98,1.76,0x2ceaa3,0x0f172a,0,'suv'),
  pkpd_interceptor:V('pkpd_interceptor','PKPD Interceptor','Emergency',48,33,36,2.55,.89,310,1.55,2.18,4.82,1.42,0x0f172a,0xf8fafc,0,'police',{siren:true}),
  aegis_armored:V('aegis_armored','Aegis Armored','Tactical SWAT',34,22,30,2,.94,580,2.65,2.52,5.55,2.24,0x1e293b,0x38bdf8,0,'armored',{siren:true}),
};
export const TRAFFIC_POOL=['brava_coupe','apex_nomad','toro_v8','corsa_spider','veloce_gt'];
const W=(id,slot,name,short,damage,cooldown,range,spread,pellets,price,ammoCost,clipSize,defaultAmmo,color,auto,explosive=0)=>({id,slot,name,short,damage,cooldown,range,spread,pellets,price,ammoCost,clipSize,defaultAmmo,color,auto:Boolean(auto),...(explosive?{explosive:true}:{})});
export const WEAPONS=[
  W('fists',1,'Brass Knuckles','MELEE',36,.34,3.3,0,1,0,0,0,0,'#F8FAFC',0),
  W('pistol',2,'Solis 9mm Combat','9MM',36,.21,70,.016,1,250,60,36,96,'#FF9A44',0),
  W('smg',3,'Viper-X Neon SMG','SMG',25,.082,62,.038,1,650,110,60,210,'#00F0FF',1),
  W('shotgun',4,'Breacher-12 Gauge','12G',23,.56,34,.105,7,1100,150,24,56,'#FF3E7F',0),
  W('rpg',5,'Helios RPG Launcher','RPG',300,1.2,98,.008,1,2400,320,4,8,'#2CEAA3',0,1),
];
export const WEAPON_MAP=Object.fromEntries(WEAPONS.map(w=>[w.id,w]));
const R=(id,name,genre,freq,color,bpm,root,notes)=>({id,name,genre,freq,color,bpm,root,notes});
export const RADIO_STATIONS=[
  R('wave','Wave 98.6 FM','Golden Hour Synthwave','98.6 FM','#FF3E7F',118,55,[0,3,7,10,12,10,7,3]),
  R('groove','Palmera Groove','Tropical Coastal Bass','104.2 FM','#FF9A44',124,65.41,[0,4,7,9,12,9,7,4]),
  R('pulse','Harbor Pulse','Midnight Electro Drive','107.9 FM','#00F0FF',132,49,[0,7,10,12,15,12,10,7]),
  R('off','Radio Off','Pure V8 & Coastal Wind','OFF','#94A3B8',0,0,[0]),
];
const C=(id,name,hex,value,accent,light=0)=>({id,name,hex,value,accent,light:Boolean(light)});
export const RESPRAY_COLORS=[
  C('coral','Sunset Coral','#FF5E3A',0xff5e3a,0x00f0ff),C('cyan','Miami Cyan','#00F0FF',0x00f0ff,0xff3e7f,1),
  C('magenta','Neon Hibiscus','#FF3E7F',0xff3e7f,0x00f0ff),C('gold','Solar Gold','#FFB800',0xffb800,0x111827,1),
  C('mint','Emerald Key','#2CEAA3',0x2ceaa3,0x0f172a,1),C('azure','Ocean Azure','#38BDF8',0x38bdf8,0xf8fafc,1),
  C('pearl','Deco Pearl','#F8FAFC',0xf8fafc,0xff3e7f,1),C('obsidian','Midnight Stealth','#1E293B',0x1e293b,0x00f0ff),
];
export const UPGRADE_COSTS={engine:[450,950,1600],turbo:[500,1100,1800],armor:[400,900,1500]};
