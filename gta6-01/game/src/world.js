import*as T from '../vendor/three.module.min.js';
import{DISTRICTS,LANDMARKS,ROAD_WIDTH,ROAD_X,ROAD_Z}from './config.js';
import{clamp,dist2D,hash2D}from './random.js';

const{abs,sin,cos,atan2,min,max,floor,sqrt,PI}=Math;
const S=(c,o={})=>new T.MeshStandardMaterial({color:c,...o}),SR=(c,r,o={})=>S(c,{roughness:r,...o}),SW=(o={})=>S(0xffffff,o),B=(c,o={})=>new T.MeshBasicMaterial({color:c,...o});
const G=(k,...a)=>new T[k+'Geometry'](...a),gr=(p,x=0,y=0,z=0)=>{const g=new T.Group();g.position.set(x,y,z);p.add(g);return g;};
const ms=(p,g,m,x,y,z,s)=>{const o=new T.Mesh(g,m);o.position.set(x,y,z);if(s)o.castShadow=o.receiveShadow=true;p.add(o);return o;},bx=(p,w,h,d,...a)=>ms(p,G('Box',w,h,d),...a);
const bxs=(p,a)=>a.forEach(b=>bx(p,...b)),pl=(p,w,h,m,x,y,z,s)=>{const o=ms(p,G('Plane',w,h),m,x,y,z);o.rotation.x=-PI/2;o.receiveShadow=!!s;return o;};
const pln=(p,w,h,m,x,y,z,ry=0)=>{const o=ms(p,G('Plane',w,h),m,x,y,z);o.rotation.y=ry;return o;};
const cy=(p,r1,r2,h,sg,...a)=>ms(p,G('Cylinder',r1,r2,h,sg),...a);
const ptL=(p,c,i,d,x,y,z)=>{const l=new T.PointLight(c,i,d);l.position.set(x,y,z);p.add(l);};
const umb=(p,x,z,pG,pM,cG,cM,tM=0)=>{const g=gr(p,x,0,z);ms(g,pG,pM,0,tM?1.15:1.3,0);ms(g,cG,cM,0,tM?2.25:2.55,0).castShadow=true;if(tM)bx(g,1.1,.72,1.1,tM,0,.36,0,1);};
const mCY=B(0x00f0ff),mPK=B(0xff3e7f),mOR=B(0xff9a44),mYL=B(0xfef08a),tB=(map,s=0)=>B(0xffffff,s?{map,side:T.DoubleSide}:{map});

export class CityWorld{
  constructor(scene,rng,textures){
    Object.assign(this,{scene,rng,textures,root:new T.Group(),colliders:[],ramps:[],palmTrees:[],yachts:[],landmarkRings:[],emissiveMats:[]});scene.add(this.root);
  }

  build(){this._ocean();this._roads();this._causeway();this._blocks();this._harbor();this._landmarks();}
  _col(x0,x1,z0,z1,y=20,tag='b'){this.colliders.push({minX:x0,maxX:x1,minZ:z0,maxZ:z1,maxY:y,tag});}

  _ocean(){
    const rt=this.root,tx=this.textures,uC=[0xff3e7f,0x00f0ff,0xff9a44,0x2ceaa3,0xfacc15];
    this.oceanMesh=pl(rt,1600,1600,SR(0x22b8cf,.16,{map:tx.water,metalness:.25}),100,-.65,0,1);
    for(const b of[[460,1.2,470,SR(0xd2ccc3,.85,{map:tx.sidewalk}),-25,-.6,0],[54,.9,470,SR(0xebd7b7,.9,{map:tx.sand}),228,-.58,0],[10,.18,450,SR(0xcbc5bc,.78),198,.05,0]])bx(rt,...b).receiveShadow=true;
    this.surfStrip=bx(rt,4.4,.12,470,B(0xf0fdfe,{transparent:true,opacity:.72}),254.2,-.28,0);
    const lg=gr(rt,216,0,-44),wdM=SR(0xf8fafc,.6);
    for(const[lx,lz]of[[-1.5,-1.5],[1.5,-1.5],[-1.5,1.5],[1.5,1.5]])bx(lg,.28,2.8,.28,wdM,lx,1.4,lz,1);
    bxs(lg,[[3.8,.25,3.8,wdM,0,2.7,0,1],[3.2,2.1,3.2,wdM,0,3.8,0,1],[4.1,.35,4.1,SR(0x0ea5e9,.45),0,5,0,1],[1.2,.15,2.2,S(0xff3e7f),0,1.4,2.2]]);
    const pM=SR(0xf8fafc,.5),pG=G('Cylinder',.08,.08,2.6,6),cG=G('Cone',2.2,.85,8),uM=uC.map(c=>SR(c,.45));
    for(let z=-200;z<=200;z+=18)if(abs(z)>=20)umb(rt,212+(abs(z*13)%22),z,pG,pM,cG,uM[abs(z)%5]);
    for(let z=-208;z<=208;z+=15)if(ROAD_Z.every(r=>abs(z-r)>=12)){this._palm(169.5,z,1.08+(abs(z)%3)*.12);this._palm(191.5,z,1.05+(abs(z*3)%3)*.12);}
    bx(rt,36,.48,12,SR(0x9a6b44,.82),266,.25,62,1);const pilM=SR(0x6b4423,.88);
    for(let px=250;px<=284;px+=6)for(const pz of[57,67])bx(rt,.48,2.4,.48,pilM,px,-.4,pz,1);
    const base=gr(rt,236,0,82),legM=SR(0xe2e8f0,.35,{metalness:.6}),wheel=gr(base,0,20.5,0);
    for(const[lx,rz]of[[-5.5,.24],[5.5,-.24]])for(const lz of[-3.5,3.5])bx(base,.9,22,.9,legM,lx,10.5,lz,1).rotation.z=rz;
    wheel.add(new T.Mesh(G('Torus',15.5,.48,8,36),mPK),new T.Mesh(G('Torus',11.5,.28,6,28),mCY));
    const spG=G('Cylinder',.12,.12,31,6),podG=G('Box',1.7,2.1,1.9);
    for(let i=0;i<12;i++){const a=(i/12)*PI*2;if(i<6){const sp=new T.Mesh(spG,legM);sp.rotation.z=a;wheel.add(sp);}const pod=new T.Mesh(podG,S(uC[i%5],{emissive:uC[i%5],emissiveIntensity:.45}));pod.position.set(cos(a)*15.5,sin(a)*15.5,0);wheel.add(pod);}
    this.skyWheel=wheel;
  }

  _palm(x,z,sc=1){
    if(!this._pm){
      const fG=G('Cone',.52,3.8,4);fG.rotateX(PI*.5);fG.scale(1,.24,1);
      this._pm={tM:SR(0x8b5e3c,.85),fM:[SR(0x1ea84c,.55,{side:T.DoubleSide}),SR(0x2dd45f,.52,{side:T.DoubleSide})],fG,coM:SR(0x5c3a21,.7),coG:G('Sphere',.2,6,6),tr:[[.32,.44,2.8,0,1.4,.04],[.24,.32,2.8,-.12,4.1,.07],[.17,.24,2.6,-.3,6.6,.09]]};
    }
    const pm=this._pm,g=gr(this.root,x,0,z);g.scale.setScalar(sc);
    for(const[r1,r2,h,px,py,rz]of pm.tr)cy(g,r1,r2,h,7,pm.tM,px,py,0,1).rotation.z=rz;
    const cr=gr(g,-.42,7.8,0);
    for(let i=0;i<7;i++){const fr=gr(cr),m=new T.Mesh(pm.fG,pm.fM[i%2]);fr.rotation.y=(i/7)*PI*2;m.position.set(0,-.2,1.75);m.rotation.x=.34;m.castShadow=true;fr.add(m);}
    for(let c=0;c<3;c++)ms(cr,pm.coG,pm.coM,cos(c*2.1)*.25,-.32,sin(c*2.1)*.25);
    this.palmTrees.push({crown:cr,phase:x*.13+z*.09});
  }

  _roads(){
    const rt=this.root,as=this.textures.asphalt,tNS=as.clone(),tEW=as.clone();
    tNS.needsUpdate=true;tNS.repeat.set(1,18);tEW.needsUpdate=true;tEW.rotation=PI/2;tEW.center.set(.5,.5);tEW.repeat.set(1,18);
    const mNS=SW({map:tNS,roughness:.78,metalness:.05}),mEW=SW({map:tEW,roughness:.78,metalness:.05});
    for(const rx of ROAD_X)pl(rt,ROAD_WIDTH,456,mNS,rx,.03,0,1);
    for(const rz of ROAD_Z)pl(rt,418,ROAD_WIDTH,mEW,-20,.035,rz,1);
    const pM=SR(0x334155,.4,{metalness:.5}),bM=B(0xffe4ad),sM=B(0xf8fafc),pG=G('Cylinder',.12,.16,6.6,6);
    for(const rx of ROAD_X)for(const rz of ROAD_Z){for(let s=-6;s<=6;s+=3)for(const dz of[-10.8,10.8])pl(rt,1.4,3.4,sM,rx+s,.045,rz+dz);const lp=gr(rt,rx+11.2,0,rz-11.2),po=new T.Mesh(pG,pM);po.position.y=3.3;lp.add(po);bxs(lp,[[2,.14,.14,pM,-.9,6.5,0],[.65,.18,.35,bM,-1.7,6.4,0]]);}
  }

  _causeway(){
    const rt=this.root,dM=SR(0x4c5466,.72),rM=S(0x00f0ff,{emissive:0x00f0ff,emissiveIntensity:.65}),pM=SR(0x94a3b8,.8);
    for(let i=0;i<14;i++){const x0=189+i*10,xm=x0+5,y0=this._ch(x0),y1=this._ch(x0+10),ym=(y0+y1)*.5,sg=gr(rt,xm,ym,0);sg.rotation.z=atan2(y1-y0,10);bx(sg,i?10.35:10,.55,20,dM,0,-.25,0).receiveShadow=true;bxs(sg,[[i?10.2:10,.75,.45,rM,0,.4,-9.7],[i?10.2:10,.75,.45,rM,0,.4,9.7]]);if(i%2)bx(rt,2.4,ym+2.5,16,pM,xm,(ym-1.2)*.5,0);}
    const archM=SR(0xf8fafc,.35,{metalness:.35}),ag=gr(rt,180,0,58);
    for(const sx of[-11.5,11.5])bxs(ag,[[2.1,18.5,2.4,archM,sx,9.25,0,1],[2.4,18.8,.45,mCY,sx,9.4,-1.25],[1.1,24,1.1,mPK,sx,12,0]]);
    bxs(ag,[[25.4,2.2,2.6,archM,0,18.8,0,1],[25.8,.65,2.9,mCY,0,20.1,0]]);
    const bbM=tB(this.textures.neonBillboard);pln(ag,17.5,4.1,bbM,0,18.8,-1.4,PI);pln(ag,17.5,4.1,bbM,0,18.8,1.4);
    const aM=S(0xf8fafc,{emissive:0xff3e7f,emissiveIntensity:.55});
    for(const ax of[232,278]){const ay=this._ch(ax);bxs(rt,[[2.2,18,2.2,aM,ax,ay+8,-10.5],[2.2,18,2.2,aM,ax,ay+8,10.5],[2.4,1.8,23.2,aM,ax,ay+16.5,0]]);}
    bx(rt,124,1.3,310,SR(0x84a98c,.85,{map:this.textures.sidewalk}),385,-.62,0).receiveShadow=true;
    const irM=SR(0x4c5466,.78);pl(rt,105,18,irM,376,.04,0);pl(rt,18,260,irM,350,.045,0);
    const vM=SW({map:this.textures.villaWall,emissiveMap:this.textures.villaGlow,emissive:0xffb347,emissiveIntensity:.65,roughness:.55});this.emissiveMats.push(vM);
    const sh=gr(rt,388,0,-52);bxs(sh,[[28,16,22,vM,0,8,0,1],[18,7,14,vM,0,19.5,0,1]]);
    const plM=B(0x22d3ee);bx(rt,16,.18,10,plM,388,.08,-32);
    const pad=gr(rt,416,.08,-24);
    cy(pad,9.5,10,.25,24,SR(0x334155,.7),0,0,0);ms(pad,G('Ring',7.2,8,24),B(0xff9a44,{side:T.DoubleSide}),0,.15,0).rotation.x=-PI/2;
    for(const[vx,vz]of[[388,52],[388,102],[388,-104],[334,-75],[334,75]]){bx(rt,20,11,18,vM,vx,5.5,vz,1);this._col(vx-10,vx+10,vz-9,vz+9,12,'villa');bx(rt,10,.14,6,plM,vx,.07,vz+(vz>0?-13:13));this._palm(vx-11,vz,.95);this._palm(vx+11,vz,1);}
  }

  _blocks(){
    const rt=this.root,tx=this.textures,gM=SW({map:tx.glassTower,emissiveMap:tx.glassTowerGlow,emissive:0x38bdf8,emissiveIntensity:.65,roughness:.22,metalness:.55});
    const wM=SW({map:tx.warehouse,roughness:.75,metalness:.22}),adM=SR(0xffe8dc,.45,{map:tx.artDecoFacade,emissiveMap:tx.artDecoGlow,emissive:0xff6b9d,emissiveIntensity:.55}),rfM=SR(0x64748b,.7),gB=B(0x38bdf8);
    this.emissiveMats.push(gM);this._buildOceanfrontHotels(rt,tx,rfM);
    for(let xi=0;xi<4;xi++)for(let zi=0;zi<4;zi++){
      const cx=(ROAD_X[xi]+ROAD_X[xi+1])*.5,cz=(ROAD_Z[zi]+ROAD_Z[zi+1])*.5;if(cx>100||cz>100||(abs(cz+45)<10&&cx<0))continue;
      const dt=abs(cx)<90&&abs(cz)<90;
      for(const[ox,oz]of[[-16,-16],[16,-16],[-16,16],[16,16]]){
        const bx2=cx+ox,bz=cz+oz,hs=hash2D(bx2,bz,99),h=dt?(bx2>40?56+floor(hs*36):34+floor(hs*38)):14+floor(hs*16);
        bxs(rt,[[22,h,22,dt?gM:(hs>.45?adM:wM),bx2,h*.5,bz,1],[22.4,.65,22.4,dt?gB:mOR,bx2,h+.3,bz]]);this._col(bx2-11,bx2+11,bz-11,bz+11,h);
        if(dt&&h>44){bxs(rt,[[13.8,12,13.8,gM,bx2,h+6,bz],[14.2,.55,14.2,mOR,bx2,h+12.1,bz]]);cy(rt,.25,.55,8,6,mCY,bx2,h+16,bz);}
        else bx(rt,5.5,2.2,5.5,rfM,bx2+3,h+1.1,bz-3);
      }
    }
    for(const[px,pz]of[[-12,14],[12,14],[-12,34],[12,34]])this._palm(px,pz,.96);
    const bbM=tB(tx.neonBillboard,1);
    for(const[x,y,z,ry]of[[29,26,-29,PI*.25],[61,24,29,-PI*.25],[146,26,-34,PI*.5]])pln(rt,14,7,bbM,x,y,z,ry);
  }

  _buildOceanfrontHotels(rt,tx,rfM){
    const hM=[0xfff2e8,0xffd7cd,0xd4f7eb,0xfff0c8,0xe8dcff].map(c=>{const m=SR(c,.42,{map:tx.artDecoFacade,emissiveMap:tx.artDecoGlow,emissive:0xff6b9d,emissiveIntensity:.62});this.emissiveMats.push(m);return m;});
    const ne=[mPK,mCY,B(0xffb800),B(0x2ceaa3)],aw=[SW({map:tx.awningCoral,roughness:.5}),SW({map:tx.awningMint,roughness:.5})];
    const pM=SR(0xf8fafc,.4),tM=SR(0xf1f5f9,.5),uM=[0xff5e6c,0x2ceaa3,0x00f0ff,0xffb800].map(c=>SR(c,.45)),pG=G('Cylinder',.06,.06,2.3,6),uG=G('Cone',1.55,.65,8);
    [-163,-141,-118,-70,-47,-24,24,47,70,118,141,163].forEach((hz,i)=>{
      const h=hz===-24?15:19+(i%4)*4,d=19+(i%2)*1.6,xC=147,nM=ne[i%4];
      bxs(rt,[[24,h,d,hM[i%5],xC,h*.5,hz,1],[24.8,.85,d+.8,nM,xC,h+.4,hz],[12,3.6,d*.52,hM[(i+1)%5],xC-1,h+1.8,hz,1],[12.6,.55,d*.55,ne[(i+1)%4],xC-1,h+3.7,hz],[1.3,h+5.5,1.3,nM,159.4,(h+5.5)*.5,hz],[6,2.2,6,rfM,xC+3,h+4.4,hz-3],[.4,.5,d*.9,nM,159.3,4.5,hz]]);
      this._col(xC-12,xC+12,hz-d*.5,hz+d*.5,h,'hotel');bx(rt,4.4,.25,d*.88,aw[i%2],160.8,3.6,hz,1).rotation.z=-.32;
      pln(rt,14.5,3.7,tB(tx.hotelMarquees[i%3],1),159.6,i%2===0?h+2.2:12.2,hz,PI*.5);
      for(const uz of[hz-5.5,hz,hz+5.5])umb(rt,164.6+(uz===hz?1.4:0),uz,pG,pM,uG,uM[(i+(uz>hz?1:0))%4],tM);
    });
  }

  _harbor(){
    const rt=this.root,cM=SR(0xef4444,.42,{metalness:.45});
    for(const cx of[-145,-95,-45]){const cr=gr(rt,cx,0,178);for(const lx of[-6,6])for(const lz of[-5,5])bx(cr,1.4,26,1.4,cM,lx,13,lz,1);bxs(cr,[[16,2.2,34,cM,0,26.5,6,1],[4,3,4,mYL,0,24,14]]);this._col(cx-7,cx+7,172,184,28,'crane');}
    for(const l of[[0xffe0a3,4.5,130,-124,16,150],[0x38bdf8,3.2,120,-116,18,174],[0xffb347,3,110,-138,14,166],[0x00f0ff,2.6,90,-112,12,206]])ptL(rt,...l);
    const whM=SW({map:this.textures.warehouse,roughness:.65,metalness:.25});
    for(const[wx,wz,ww,wd,wh]of[[-158,196,28,18,11],[-104,198,26,16,10.5]]){bxs(rt,[[ww,wh,wd,whM,wx,wh*.5,wz,1],[ww+.6,.7,wd+.6,mCY,wx,wh+.35,wz]]);for(const bo of[-7,0,7])bx(rt,4.4,4.8,.4,mYL,wx+bo,2.4,wz-wd*.5-.15);this._col(wx-ww*.5,wx+ww*.5,wz-wd*.5,wz+wd*.5,wh,'warehouse');}
    const cMats=[0xf97316,0x0284c7,0x16a34a,0xdc2626,0xeab308,0x00f0ff].map(c=>SR(c,.55,{map:this.textures.container}));
    [[-152,144,2],[-152,152,3],[-150,164,2],[-146,176,2],[-104,146,2],[-102,158,3],[-104,170,2],[-86,154,2],[-74,134,2],[-56,148,2],[-36,136,1]].forEach(([cx,cz,lv],i)=>{for(let k=0;k<lv;k++)bx(rt,11,3.6,4.8,cMats[(i+k)%6],cx,1.8+k*3.6,cz,1);this._col(cx-5.5,cx+5.5,cz-2.4,cz+2.4,lv*3.6,'container');});
    bx(rt,8,.45,34,SR(0x9a6b44,.8),-122,.2,224,1);
    const hM=SR(0xf8fafc,.25,{metalness:.2}),gM=S(0x00f0ff,{emissive:0x00f0ff,emissiveIntensity:.75});
    for(const[yx,yz,ry,sc]of[[-112,232,.14,1.35],[-65,246,0,1],[-20,248,.1,1],[35,246,-.08,1],[272,72,PI*.5,1.1],[275,-75,-PI*.5,1]]){const y=gr(rt,yx,-.35,yz);y.rotation.y=ry;y.scale.setScalar(sc);bxs(y,[[5.6,2.2,16,hM,0,1.1,0,1],[4.4,1.8,8.5,hM,0,2.8,-1,1],[4.5,.9,3.5,gM,0,2.9,2.2],[5.8,.25,16.2,gM,0,2.1,0],[4.55,.6,6.2,mYL,0,2.6,-1.2]]);this.yachts.push({mesh:y,baseY:-.35,phase:yx*.1+yz*.07});}
  }

  _landmarks(){
    const rt=this.root,gx=-62,gz=-48,gg=gr(rt,gx,0,gz),wM=SR(0x475569,.42,{metalness:.25}),pM=SR(0xe2e8f0,.35),glM=SR(0x7dd3fc,.15,{transparent:true,opacity:.45,metalness:.4}),gS=tB(this.textures.garageSign,1);
    bxs(gg,[[28,10,1.5,wM,0,5,-11.5],[28,5,1.6,glM,0,5.5,-10.6],[30,1.1,25,pM,0,10.4,0],[30.4,.9,1.1,mCY,0,9.9,12.4],[2,13.5,2,mPK,16,6.75,11.5]]);
    for(const sx of[-13.2,13.2])bxs(gg,[[1.6,10,4,pM,sx,5,-9.5],[1.4,10,4,pM,sx,5,9.5],[1.2,9.5,15,glM,sx,5,0]]);
    pl(gg,26,22,SW({map:this.textures.checker,roughness:.45}),0,.06,0,1);pln(gg,18,4.2,gS,0,12.6,12.4);pln(gg,14.5,3,gS,0,8.1,-9.65);
    cy(gg,3.4,3.55,.14,32,SR(0x1e293b,.35,{metalness:.5}),0,.07,0);ms(gg,G('Ring',3.45,3.68,32),mCY,0,.15,0).rotation.x=-PI/2;
    const yM=SR(0xfacc15,.32,{metalness:.35}),cM=SR(0x1e293b,.45,{metalness:.5});
    for(const lx of[-2.6,2.6])bxs(gg,[[.38,4.1,.42,yM,lx,2.05,0,1],[.75,.14,.75,cM,lx,.07,0,1],[.54,.22,.56,cM,lx,4.15,0,1]]);
    bx(gg,5.6,.2,.32,cM,0,4.15,0,1);const lift=this.garageLift=gr(gg,0,.06,0);
    for(const sx of[-1,1]){bx(lift,.28,.36,.48,cM,sx*2.32,0,0,1);for(const sz of[-1,1]){bx(lift,1.35,.1,.14,wM,sx*1.65,-.05,sz*.85,1).rotation.y=sx*sz*.48;bx(lift,.26,.08,.26,cM,sx*1.05,.02,sz*1.18,1);}}
    this.garageBay={x:gx,z:gz};
    for(const l of[[0xfff5e4,120,44,0,5.2,2.5],[0xffedd5,60,28,-4,2.4,4.5],[0x00f0ff,3.2,42,-6,6.5,12],[0xffb800,3.4,45,8,6.5,14]])ptL(gg,...l);
    this._col(gx-14,gx+14,gz-12.5,gz-9.5,11);this._col(gx-14.5,gx-11.5,gz-12,gz+12,11);this._col(gx+11.5,gx+14.5,gz-12,gz+12,11);
    bxs(rt,[[22,11,18,SR(0x334155,.55),-118,5.5,-48,1],[22.6,1,18.6,mPK,-118,10.8,-48]]);this._col(-129,-107,-57,-39,12,'armory');
    for(const lm of LANDMARKS){const rg=gr(rt,lm.x,.12,lm.z),ring=new T.Mesh(G('Ring',3.2,4.1,28),B(lm.color,{side:T.DoubleSide,transparent:true,opacity:.85})),halo=new T.Mesh(G('Cylinder',3.5,3.5,3.2,20,1,true),B(lm.color,{side:T.DoubleSide,transparent:true,opacity:.18}));ring.rotation.x=-PI/2;halo.position.y=1.6;rg.add(ring,halo);this.landmarkRings.push({mesh:rg,ring,halo,landmark:lm});}
    const rM=SR(0xf59e0b,.5,{emissive:0xff5e3a,emissiveIntensity:.35});
    for(const r of[{x:162,z:-64,w:5.5,l:10,h:2.8,dir:'N'},{x:24,z:46,w:6.5,l:11,h:3,dir:'S'},{x:122,z:0,w:6.5,l:12,h:3.4,dir:'E'}]){this.ramps.push(r);const m=bx(rt,r.w,.4,r.l,rM,r.x,r.h*.5,r.z),p=atan2(r.h,r.l);if(r.dir==='N')m.rotation.x=p;else if(r.dir==='S')m.rotation.x=-p;else{m.rotation.y=PI*.5;m.rotation.x=-p;}}
  }

  _ch(x){return(x<=189||x>=329)?0:sin(((x-189)/140)*PI)*3.6;}
  getGroundHeight(x,z){if(x>=189&&x<=329&&abs(z)<=10.5)return this._ch(x);for(const r of this.ramps){const hw=(r.dir==='E'?r.l:r.w)*.5,hl=(r.dir==='E'?r.w:r.l)*.5;if(abs(x-r.x)<=hw&&abs(z-r.z)<=hl)return clamp(r.dir==='N'?(r.z+hl-z)/(hl*2):r.dir==='S'?(z-(r.z-hl))/(hl*2):(x-(r.x-hw))/(hw*2),0,1)*r.h;}return(x>205&&x<=255&&abs(z)<=235)?-((x-205)/50)*.35:0;}
  isWater(x,z){return!((x>=188&&x<=330&&abs(z)<=10.5)||(x>=323&&x<=447&&abs(z)<=155)||(x>=-255&&x<=253&&abs(z)<=235));}
  getDistrictAt(x,z){return DISTRICTS.find(d=>x>=d.bounds.minX&&x<=d.bounds.maxX&&z>=d.bounds.minZ&&z<=d.bounds.maxZ)||DISTRICTS[2];}

  resolveCircleCollision(x,z,r=1,y=0){
    let cx=x,cz=z,hit=false,normalX=0,normalZ=0;
    for(const c of this.colliders){
      if(y>c.maxY)continue;const nx=clamp(cx,c.minX,c.maxX),nz=clamp(cz,c.minZ,c.maxZ),dx=cx-nx,dz=cz-nz,dSq=dx*dx+dz*dz;
      if(dSq<r*r){hit=true;const d=sqrt(dSq);if(d>1e-4){const p=r-d;cx+=(normalX=dx/d)*p;cz+=(normalZ=dz/d)*p;}else{const s=[[abs(cx-c.minX),c.minX-r,-1,0,1],[abs(c.maxX-cx),c.maxX+r,1,0,1],[abs(cz-c.minZ),c.minZ-r,0,-1,0],[abs(cz-c.maxZ),c.maxZ+r,0,1,0]].sort((a,b)=>a[0]-b[0])[0];if(s[4])cx=s[1];else cz=s[1];normalX=s[2];normalZ=s[3];}}
    }
    return{x:clamp(cx,-250,442),z:clamp(cz,-230,230),hit,normalX,normalZ};
  }

  raycastWorld(ox,oy,oz,dx,dy,dz,maxD=80){
    let bD=maxD,hit=false;const sl=(o,d,a,b,mn,mx)=>{if(abs(d)<1e-6)return o>=a&&o<=b?[mn,mx]:null;let t1=(a-o)/d,t2=(b-o)/d;if(t1>t2)[t1,t2]=[t2,t1];return max(mn,t1)<=min(mx,t2)?[max(mn,t1),min(mx,t2)]:null;};
    for(const c of this.colliders){let r=sl(ox,dx,c.minX,c.maxX,0,bD);if(!r)continue;r=sl(oy,dy,0,c.maxY,r[0],r[1]);if(!r)continue;r=sl(oz,dz,c.minZ,c.maxZ,r[0],r[1]);if(r&&r[0]>0&&r[0]<bD){bD=r[0];hit=true;}}
    return{hit,dist:bD,point:{x:ox+dx*bD,y:oy+dy*bD,z:oz+dz*bD}};
  }

  getNearestRoadPoint(x,z){
    if(x>210)return x<330?{x:clamp(x,189,329),z:0}:{x:350,z:clamp(z,-120,120)};
    const bx2=ROAD_X.reduce((p,c)=>abs(x-c)<abs(x-p)?c:p),bz=ROAD_Z.reduce((p,c)=>abs(z-c)<abs(z-p)?c:p);
    return abs(x-bx2)<abs(z-bz)?{x:bx2,z}:{x,z:bz};
  }

  computeGpsPath(sx,sz,tx,tz){
    const pts=[{x:sx,z:sz}],sI=sx>260,tI=tx>260;
    if(sI!==tI){if(sI)pts.push({x:350,z:sz},{x:350,z:0},{x:180,z:0},{x:180,z:tz});else pts.push({x:this.getNearestRoadPoint(sx,sz).x,z:0},{x:180,z:0},{x:350,z:0},{x:350,z:tz});pts.push({x:tx,z:tz});return pts;}
    const sr=this.getNearestRoadPoint(sx,sz),tr=this.getNearestRoadPoint(tx,tz);
    pts.push(sr);if(dist2D(sr.x,sr.z,tr.x,tr.z)>12)pts.push({x:tr.x,z:sr.z},tr);pts.push({x:tx,z:tz});return pts;
  }

  update(dt,time,tod=.74){
    if(this.oceanMesh&&this.textures.water)this.textures.water.offset.set((time*.018)%1,(time*.012)%1);
    if(this.surfStrip)this.surfStrip.position.x=253.8+sin(time*2.1)*1.1;
    if(this.skyWheel)this.skyWheel.rotation.z+=dt*.16;
    for(const p of this.palmTrees){p.crown.rotation.z=sin(time*1.8+p.phase)*.055;p.crown.rotation.x=cos(time*1.4+p.phase)*.04;}
    for(const y of this.yachts){y.mesh.position.y=y.baseY+sin(time*1.9+y.phase)*.14;y.mesh.rotation.z=sin(time*1.4+y.phase)*.025;}
    this.landmarkRings.forEach((lr,i)=>{const s=1+sin(time*3.2+i)*.08;lr.ring.scale.set(s,s,1);lr.halo.material.opacity=.14+sin(time*3.2+i)*.06;});
    const em=(tod>=.78||tod<.2)?.92:.62;for(const m of this.emissiveMats)m.emissiveIntensity=em;
  }
}
