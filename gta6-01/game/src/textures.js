import*as T from '../vendor/three.module.min.js';

function makeTex(w,h,fn,rx=1,ry=1){
  const c=document.createElement('canvas');c.width=w;c.height=h;fn(c.getContext('2d'),w,h);
  const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(rx,ry);t.anisotropy=4;return t;
}
const R=(c,f,x,y,w,h)=>{c.fillStyle=f;c.fillRect(x,y,w,h);};

export function makeMarqueeTex(title,sub='',c1='#0f172a',c2='#3b0764',border='#00f0ff',fg='#ffe082'){
  return makeTex(512,128,(c,w,h)=>{
    const g=c.createLinearGradient(0,0,w,h);g.addColorStop(0,c1);g.addColorStop(1,c2);R(c,g,0,0,w,h);
    c.strokeStyle=border;c.lineWidth=7;c.strokeRect(8,8,w-16,h-16);c.fillStyle=fg;c.font='900 42px sans-serif';c.textAlign='center';
    c.fillText(title,w*.5,sub?64:78,w-36);if(sub){c.fillStyle=border;c.font='700 22px sans-serif';c.fillText(sub,w*.5,102,w-36);}
  });
}

function makeAwningTex(c1,c2='#fff9f5'){
  return makeTex(128,64,(c,w,h)=>{for(let x=0;x<w;x+=16)R(c,(x/16)%2?c2:c1,x,0,16,h);R(c,'#0f172a28',0,h-8,w,8);});
}

export function createProceduralTextures(){
  const asphalt=makeTex(256,256,(c,w,h)=>{R(c,'#4c5466',0,0,w,h);for(let i=0;i<1100;i++)R(c,i%2?'#ffffff0d':'#1e293b14',(i*73)%w,(i*139)%h,2,2);R(c,'#f8fafcc7',8,0,5,h);R(c,'#f8fafcc7',w-13,0,5,h);for(let y=10;y<h;y+=44){R(c,'#f59e0b',w*.5-5,y,3.2,25);R(c,'#f59e0b',w*.5+2,y,3.2,25);}});
  const sidewalk=makeTex(128,128,(c,w,h)=>{R(c,'#cbc5bc',0,0,w,h);c.strokeStyle='#64748b44';c.lineWidth=2;for(let p=0;p<=w;p+=32){c.beginPath();c.moveTo(p,0);c.lineTo(p,h);c.stroke();c.beginPath();c.moveTo(0,p);c.lineTo(w,p);c.stroke();}},16,16);
  const sand=makeTex(256,256,(c,w,h)=>{const g=c.createLinearGradient(0,0,w,h);g.addColorStop(0,'#ebd7b7');g.addColorStop(.5,'#f0dec0');g.addColorStop(1,'#e5cfad');R(c,g,0,0,w,h);for(let i=0;i<700;i++)R(c,i%2?'#fffdf53a':'#b4824614',(i*89)%w,(i*53)%h,3,2);},10,24);
  const water=makeTex(256,256,(c,w,h)=>{const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,'#0e9ab8');g.addColorStop(.5,'#22b8cf');g.addColorStop(1,'#38d2e6');R(c,g,0,0,w,h);c.strokeStyle='#e0f7fa6b';c.lineWidth=2.2;for(let y=12;y<h;y+=22){c.beginPath();for(let x=0;x<=w;x+=16){const wy=y+Math.sin((x/w)*Math.PI*4+y)*4;x?c.lineTo(x,wy):c.moveTo(x,wy);}c.stroke();}},36,36);
  const checker=makeTex(128,128,(c,w,h)=>{for(let y=0;y<4;y++)for(let x=0;x<4;x++)R(c,(x+y)%2?'#475569':'#e2e8f0',x*32,y*32,32,32);c.strokeStyle='#00f0ff';c.lineWidth=3;c.strokeRect(2,2,w-4,h-4);},4,4);
  const artDecoFacade=makeTex(256,256,(c,w,h)=>{R(c,'#fff4ec',0,0,w,h);R(c,'#ffd6ca',0,0,20,h);R(c,'#ffd6ca',w-20,0,20,h);for(let y=16;y<h-16;y+=36){R(c,'#ff5e7d',0,y-4,w,3);for(let x=26;x<w-26;x+=34){R(c,(x+y)%68?'#2b3e58':'#fef08a',x,y,22,22);c.strokeStyle='#22d3ee';c.lineWidth=1.5;c.strokeRect(x,y,22,22);}}});
  const artDecoGlow=makeTex(256,256,(c,w,h)=>{R(c,'#000',0,0,w,h);R(c,'#ff3e7f',7,0,5,h);R(c,'#ff3e7f',w-12,0,5,h);for(let y=16;y<h-16;y+=36){R(c,'#00f0ff',0,y-4,w,2);for(let x=26;x<w-26;x+=34)if((x+y*3)%5)R(c,(x+y)%2?'#ff9a44':'#fde68a',x+2,y+2,18,18);}});
  const glassTower=makeTex(256,256,(c,w,h)=>{const g=c.createLinearGradient(0,0,w,h);g.addColorStop(0,'#1e3a5f');g.addColorStop(.5,'#0e7490');g.addColorStop(1,'#1e293b');R(c,g,0,0,w,h);for(let y=8;y<h;y+=20)for(let x=8;x<w;x+=24)R(c,(x*7+y*13)%11>4?'#93c5fd':'#164e63',x,y,18,13);});
  const glassTowerGlow=makeTex(256,256,(c,w,h)=>{R(c,'#000',0,0,w,h);for(let y=8;y<h;y+=20)for(let x=8;x<w;x+=24){const m=(x*7+y*13)%11;if(m>5)R(c,m>8?'#fef3c7':'#38bdf8',x+1,y+1,16,11);}});
  const villaWall=makeTex(128,128,(c,w,h)=>{R(c,'#fff7ed',0,0,w,h);R(c,'#fdba74',0,0,w,12);for(let y=24;y<h-16;y+=44)for(let x=16;x<w-16;x+=36){R(c,'#fde68a',x,y,22,28);c.strokeStyle='#c2410c';c.lineWidth=2;c.strokeRect(x,y,22,28);}});
  const villaGlow=makeTex(128,128,(c,w,h)=>{R(c,'#000',0,0,w,h);for(let y=24;y<h-16;y+=44)for(let x=16;x<w-16;x+=36)R(c,'#fbbf24',x+2,y+2,18,24);});
  const warehouse=makeTex(128,128,(c,w,h)=>{R(c,'#475569',0,0,w,h);for(let x=0;x<w;x+=8)R(c,x%16?'#334155':'#64748b',x,0,4,h);R(c,'#f59e0b',0,h-16,w,10);});
  const container=makeTex(128,64,(c,w,h)=>{R(c,'#fff',0,0,w,h);for(let x=0;x<w;x+=8)R(c,x%16?'#ffffff28':'#0000002e',x,4,4,h-8);c.strokeStyle='#00000059';c.lineWidth=3;c.strokeRect(2,2,w-4,h-4);});
  return{
    asphalt,sidewalk,sand,water,checker,artDecoFacade,artDecoGlow,glassTower,glassTowerGlow,villaWall,villaGlow,warehouse,container,
    awningCoral:makeAwningTex('#ff5e6c'),awningMint:makeAwningTex('#2ceaa3'),
    neonBillboard:makeMarqueeTex('PALMERA KEYS','VELOCE GT // WAVE 98.6 FM','#0f172a','#3b0764','#00f0ff','#ff9a44'),
    hotelMarquees:[makeMarqueeTex('HOTEL CORALINA','OCEANFRONT SUITES','#1e1b4b','#831843','#00f0ff','#fde68a'),makeMarqueeTex('PALMERA SUITES','ROOFTOP LOUNGE','#0f172a','#164e63','#ff3e7f','#f8fafc'),makeMarqueeTex('SOLARIS CLUB','GOLDEN HOUR LIVE','#1e1b4b','#7c2d12','#ffb800','#00f0ff')],
    garageSign:makeMarqueeTex('SUNSET CUSTOMS BAY','RESPRAY • TURBO • KEVLAR','#0f172a','#1e293b','#00f0ff','#ff9a44'),
  };
}
