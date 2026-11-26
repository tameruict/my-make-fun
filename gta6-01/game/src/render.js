import*as T from '../vendor/three.module.min.js';
import{clamp,damp,lerp,wrapAngle}from './random.js';

const{abs,sin,cos,min,max}=Math;
const SKY_V=`varying vec3 vW;void main(){vW=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vW,1.);}`;
const SKY_F=`uniform vec3 uZ,uM,uH,uS,uD;uniform float uT;varying vec3 vW;
float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h2(i),h2(i+vec2(1,0)),f.x),mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),f.x),f.y);}
void main(){vec3 d=normalize(vW);float h=clamp(d.y,0.,1.),s=max(dot(d,normalize(uD)),0.);
vec3 sky=mix(mix(uH,uM,smoothstep(0.,.16,h)),uZ,smoothstep(.11,.44,h));
float g=exp(-abs(d.y)*8.5)*pow(max(dot(normalize(vec3(d.x,0.,d.z)),normalize(vec3(uD.x,0.,uD.z))),0.),2.2);
vec2 uv=d.xz/(max(.16,d.y)+.18)*1.45+vec2(uT*.015,uT*.007);
float cl=smoothstep(.5,.78,n2(uv)*.55+n2(uv*2.1)*.3+n2(uv*4.3)*.15)*smoothstep(.05,.28,d.y)*(1.-smoothstep(.58,.92,d.y));
vec3 cc=mix(vec3(1.,.95,.9),uS*1.12,pow(s,2.));
sky=mix(sky,cc,cl*.42)+uS*pow(s,14.)*.36+vec3(1.,.96,.85)*smoothstep(.9965,.9994,s)*1.5+uS*g*.28;gl_FragColor=vec4(sky,1.);}`;

const TOD_PRESETS={
  golden:[0x4a78c2,0xd88ea2,0xffd2a0,0xffe6b8,2.75,0xfff0db,0x70788f,1.32,0x9ad8ff,.78,0xebc2b4,.0009,[.76,.31,.42]],
  sunlit:[0x3c76cc,0xe4a4b8,0xffe0b2,0xfff2d1,2.85,0xfff6e5,0x768096,1.42,0x9ad8ff,.82,0xdec6bc,.0008,[.62,.46,-.52]],
  dusk:[0x1b275c,0x7b428c,0xe86c9a,0xffb8cf,2.1,0xd4e2ff,0x4f5f82,1.48,0x7dd3fc,1.05,0x624e82,.0009,[.74,.28,-.52]],
  night:[0x0c1638,0x1e3a6e,0x38bdf8,0xbae6fd,1.4,0x93c5fd,0x384664,1.15,0x60a5fa,.72,0x17254a,.001,[-.5,.55,.45]],
  dawn:[0x3a7bd5,0xe89eb2,0xffdca8,0xfff0c8,2.6,0xfff4e0,0x767c8f,1.4,0x93c5fd,.8,0xdec0b0,.0009,[.65,.42,.45]],
};

export class RendererRig{
  constructor(canvas){
    this.canvas=canvas;const r=this.renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:true});
    r.setPixelRatio(min(window.devicePixelRatio||1,2));r.setSize(window.innerWidth,window.innerHeight,false);
    r.toneMapping=T.ACESFilmicToneMapping;r.toneMappingExposure=1.22;r.outputColorSpace=T.SRGBColorSpace;r.shadowMap.enabled=true;r.shadowMap.type=T.PCFSoftShadowMap;
    this.scene=new T.Scene();this.scene.fog=new T.FogExp2(0xebc2b4,.0009);
    this.camera=new T.PerspectiveCamera(58,window.innerWidth/max(1,window.innerHeight),.4,980);this.camera.position.set(170,8,-40);
    this.skyUniforms={uZ:{value:new T.Color(0x4a78c2)},uM:{value:new T.Color(0xd88ea2)},uH:{value:new T.Color(0xffd2a0)},uS:{value:new T.Color(0xffe6b8)},uD:{value:new T.Vector3(.76,.31,.42).normalize()},uT:{value:0}};
    this.skyDome=new T.Mesh(new T.SphereGeometry(720,32,20),new T.ShaderMaterial({vertexShader:SKY_V,fragmentShader:SKY_F,uniforms:this.skyUniforms,side:T.BackSide,depthWrite:false}));
    this.hemiLight=new T.HemisphereLight(0xfff0db,0x70788f,1.32);this.sunLight=new T.DirectionalLight(0xffe6b8,2.75);this.sunLight.castShadow=true;this.sunLight.shadow.mapSize.set(2048,2048);
    this.sunLight.shadow.camera.near=10;this.sunLight.shadow.camera.far=360;Object.assign(this.sunLight.shadow.camera,{left:-95,right:95,top:95,bottom:-95});this.sunLight.shadow.bias=-.0004;
    this.fillLight=new T.DirectionalLight(0x9ad8ff,.78);this.scene.add(this.skyDome,this.hemiLight,this.sunLight,this.sunLight.target,this.fillLight,this.fillLight.target);
    this.timeOfDay=.74;this.camPos=new T.Vector3(170,7,-40);this.camLook=new T.Vector3(170,2,-20);this.orbitYaw=0;this.orbitPitch=.24;this.manualTimer=this.shakeAmt=0;this.shotCameraLock=false;
    this.setTimeOfDay(.74);this._onResize=()=>this.resize();window.addEventListener('resize',this._onResize);
  }

  setTimeOfDay(t){
    const d=this.timeOfDay=((t%1)+1)%1,key=d>=.7&&d<.8?'golden':d>=.6&&d<.7?'sunlit':d>=.8&&d<.91?'dusk':(d>=.91||d<.18)?'night':'dawn',p=TOD_PRESETS[key];
    this.skyUniforms.uZ.value.setHex(p[0]);this.skyUniforms.uM.value.setHex(p[1]);this.skyUniforms.uH.value.setHex(p[2]);this.skyUniforms.uS.value.setHex(p[3]);
    this.sunDir=new T.Vector3(...p[12]).normalize();this.skyUniforms.uD.value.copy(this.sunDir);this.sunLight.color.setHex(p[3]);this.sunLight.intensity=p[4];
    this.hemiLight.color.setHex(p[5]);this.hemiLight.groundColor.setHex(p[6]);this.hemiLight.intensity=p[7];this.fillLight.color.setHex(p[8]);this.fillLight.intensity=p[9];
    this.scene.fog.color.setHex(p[10]);this.scene.fog.density=p[11];
  }

  addShake(a){this.shakeAmt=min(1.6,this.shakeAmt+a);}
  _syncLights(tx,tz){this.sunLight.target.position.set(tx,0,tz);this.sunLight.position.copy(this.sunLight.target.position).addScaledVector(this.sunDir,150);this.fillLight.target.position.set(tx,0,tz);this.fillLight.position.set(tx-this.sunDir.x*120,80,tz-this.sunDir.z*120);}
  setShotCamera(pos,lookAt,fov=56){this.shotCameraLock=true;this.camera.fov=fov;this.camera.updateProjectionMatrix();this.camera.position.set(...pos);this.camera.lookAt(...lookAt);this.camPos.copy(this.camera.position);this.camLook.set(...lookAt);this.skyDome.position.copy(this.camera.position);this._syncLights(lookAt[0],lookAt[2]);}
  clearShotCamera(){this.shotCameraLock=false;}

  updateTitleOrbit(dt,time){
    if(this.shotCameraLock)return;this.skyUniforms.uT.value=time;const a=time*.14+.6;
    this.camera.position.set(135+cos(a)*78,26+sin(time*.3)*4,-20+sin(a)*78);this.camera.lookAt(165,6,10);this.skyDome.position.copy(this.camera.position);this._syncLights(165,10);
  }

  updateCamera(dt,{targetPos,targetYaw,inVehicle,speedRatio=0,aiming=false,mouseDX=0,mouseDY=0}){
    if(this.shotCameraLock)return;this.skyUniforms.uT.value+=dt;
    if(abs(mouseDX)>.01||abs(mouseDY)>.01){this.orbitYaw-=mouseDX*.0042;this.orbitPitch=clamp(this.orbitPitch+mouseDY*.0032,.06,.78);this.manualTimer=1.6;}
    else if(this.manualTimer>0)this.manualTimer=max(0,this.manualTimer-dt);
    else{this.orbitYaw=wrapAngle(this.orbitYaw+wrapAngle(targetYaw-this.orbitYaw)*min(1,dt*(inVehicle?5.2:6.5)));this.orbitPitch=damp(this.orbitPitch,inVehicle?.23:.26,4,dt);}
    const yaw=aiming?targetYaw:this.orbitYaw,fx=sin(yaw),fz=cos(yaw),rx=-cos(yaw),rz=sin(yaw);
    const dist=inVehicle?lerp(8.6,10.8,speedRatio):aiming?3.2:5.6,h=inVehicle?lerp(3.1,3.8,this.orbitPitch):aiming?1.85:lerp(2.1,3.8,this.orbitPitch),so=aiming?.85:0,st=aiming?18:inVehicle?11:13,la=inVehicle?5.5+speedRatio*5:aiming?18:3.5;
    this.camPos.set(damp(this.camPos.x,targetPos.x-fx*dist+rx*so,st,dt),damp(this.camPos.y,max(1.1,targetPos.y+h),st,dt),damp(this.camPos.z,targetPos.z-fz*dist+rz*so,st,dt));
    this.camLook.set(damp(this.camLook.x,targetPos.x+fx*la+rx*(aiming?.45:0),16,dt),damp(this.camLook.y,targetPos.y+(inVehicle?1.35:aiming?1.55-(this.orbitPitch-.24)*8:1.45),16,dt),damp(this.camLook.z,targetPos.z+fz*la+rz*(aiming?.45:0),16,dt));
    let sx=0,sy=0,sz=0;if(this.shakeAmt>.001){const n=performance.now();sx=sin(n*.07)*.5*this.shakeAmt;sy=cos(n*.09)*.4*this.shakeAmt;sz=sin(n*.05)*.5*this.shakeAmt;this.shakeAmt=max(0,this.shakeAmt-dt*2.8);}
    this.camera.position.set(this.camPos.x+sx,this.camPos.y+sy,this.camPos.z+sz);this.camera.lookAt(this.camLook);
    const tf=inVehicle?58+speedRatio*11:aiming?46:58;if(abs(this.camera.fov-tf)>.1){this.camera.fov=damp(this.camera.fov,tf,8,dt);this.camera.updateProjectionMatrix();}
    this.skyDome.position.copy(this.camera.position);this._syncLights(targetPos.x,targetPos.z);
  }

  resize(){const w=window.innerWidth||1280,h=max(1,window.innerHeight||720);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h,false);}
  render(){this.renderer.render(this.scene,this.camera);}
}
