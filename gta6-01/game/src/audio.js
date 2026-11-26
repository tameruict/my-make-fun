import{RADIO_STATIONS}from './config.js';

export class AudioEngine{
  constructor(){this.ctx=this.master=this.engineOsc=this.engineGain=this.sirenOsc=this.sirenGain=null;this.unlocked=false;this.stationIndex=this.stepTimer=this.stepIndex=this.sirenPhase=0;}

  unlock(){
    if(this.unlocked)return;
    try{
      const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
      this.ctx=new AC();if(this.ctx.state==='suspended')this.ctx.resume();
      this.master=this.ctx.createGain();this.master.gain.value=.22;this.master.connect(this.ctx.destination);
      const mk=(t,f,d)=>{const o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=t;o.frequency.value=f;g.gain.value=.0001;o.connect(d||g);if(d)d.connect(g);g.connect(this.master);o.start();return[o,g];};
      const f=this.ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=260;
      [this.engineOsc,this.engineGain]=mk('sawtooth',55,f);[this.sirenOsc,this.sirenGain]=mk('triangle',640,null);this.unlocked=true;
    }catch{}
  }

  setRadioStation(i){this.stationIndex=((i%RADIO_STATIONS.length)+RADIO_STATIONS.length)%RADIO_STATIONS.length;this.playUiClick();return RADIO_STATIONS[this.stationIndex];}
  cycleRadioStation(){return this.setRadioStation(this.stationIndex+1);}
  getCurrentStation(){return RADIO_STATIONS[this.stationIndex]||RADIO_STATIONS[0];}

  update(dt,{inVehicle=false,speedRatio=0,nitro=false,wantedLevel=0}={}){
    if(!this.unlocked||!this.ctx)return;
    const now=this.ctx.currentTime,gr=(speedRatio*3.2)%1;
    this.engineOsc.frequency.setTargetAtTime(inVehicle?48+speedRatio*120+gr*38+(nitro?42:0):35,now,.05);
    this.engineGain.gain.setTargetAtTime(inVehicle?.09+speedRatio*.09:.0001,now,.08);
    this.sirenPhase+=dt*3.8;this.sirenOsc.frequency.setTargetAtTime(620+Math.sin(this.sirenPhase)*240,now,.04);
    this.sirenGain.gain.setTargetAtTime(wantedLevel>0?.035+Math.min(wantedLevel,5)*.01:.0001,now,.08);
    const st=this.getCurrentStation();
    if(inVehicle&&st?.bpm>0){const sd=60/st.bpm/2;this.stepTimer+=dt;if(this.stepTimer>=sd){this.stepTimer-=sd;const fq=st.root*Math.pow(2,st.notes[this.stepIndex%st.notes.length]/12);this._tone(fq,sd*.85,'triangle',.045);if(this.stepIndex%2===0)this._tone(fq*2,sd*.35,'sine',.025);this.stepIndex++;}}
  }

  _tone(freq,dur,type='sine',vol=.1,endFreq=null){
    if(!this.unlocked||!this.ctx)return;
    try{const now=this.ctx.currentTime,o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=type;o.frequency.setValueAtTime(freq,now);if(endFreq!==null)o.frequency.exponentialRampToValueAtTime(Math.max(20,endFreq),now+dur);g.gain.setValueAtTime(vol,now);g.gain.exponentialRampToValueAtTime(.0001,now+dur);o.connect(g);g.connect(this.master);o.start(now);o.stop(now+dur+.02);}catch{}
  }

  playShot(id='pistol'){const[f,d,t,v,e]=({fists:[130,.09,'triangle',.14,55],shotgun:[160,.22,'sawtooth',.22,42],rpg:[210,.38,'sawtooth',.24,50],smg:[340,.075,'square',.12,110]})[id]||[260,.12,'sawtooth',.15,85];this._tone(f,d,t,v,e);}
  playExplosion(){this._tone(110,.55,'sawtooth',.32,24);this._tone(68,.65,'triangle',.28,20);}
  playCrash(i=1){this._tone(150,.18,'sawtooth',Math.min(.26,.08+i*.14),45);}
  playCarDoor(){this._tone(190,.09,'triangle',.14,95);}
  playCash(){this._tone(587.33,.09,'sine',.12);setTimeout(()=>this._tone(880,.16,'sine',.14),70);}
  playMissionBanner(){this._tone(440,.14,'triangle',.15);setTimeout(()=>this._tone(554.37,.14,'triangle',.15),110);setTimeout(()=>this._tone(659.25,.28,'triangle',.18),220);}
  playUiClick(){this._tone(520,.045,'sine',.07,660);}
}
