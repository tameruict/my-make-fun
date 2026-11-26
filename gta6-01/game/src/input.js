export class InputManager{
  constructor(canvas){
    this.canvas=canvas;this.keysDown=new Set();this.keysPressed=new Set();this.mouseDown=new Set();this.mousePressed=new Set();
    this.mouseDeltaX=this.mouseDeltaY=this.wheelDelta=0;this.pointerLocked=this.draggingLook=false;this.lastClientX=this.lastClientY=null;
    this._onKeyDown=e=>{if(!this.keysDown.has(e.code))this.keysPressed.add(e.code);this.keysDown.add(e.code);if(['Tab','Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();};
    this._onKeyUp=e=>this.keysDown.delete(e.code);
    this._onMouseDown=e=>{if(!this.mouseDown.has(e.button))this.mousePressed.add(e.button);this.mouseDown.add(e.button);this.lastClientX=e.clientX;this.lastClientY=e.clientY;if(e.button===2)this.draggingLook=true;};
    this._onMouseUp=e=>{this.mouseDown.delete(e.button);if(!this.mouseDown.has(2))this.draggingLook=false;};
    this._onMouseMove=e=>{if(this.pointerLocked){this.mouseDeltaX+=e.movementX||0;this.mouseDeltaY+=e.movementY||0;}else if(this.draggingLook&&this.lastClientX!==null){this.mouseDeltaX+=e.clientX-this.lastClientX;this.mouseDeltaY+=e.clientY-this.lastClientY;}this.lastClientX=e.clientX;this.lastClientY=e.clientY;};
    this._onWheel=e=>{this.wheelDelta+=Math.sign(e.deltaY);};this._onContextMenu=e=>e.preventDefault();this._onPointerLockChange=()=>{this.pointerLocked=document.pointerLockElement===this.canvas;};
    this._ls=[[window,'keydown',this._onKeyDown],[window,'keyup',this._onKeyUp],[canvas,'mousedown',this._onMouseDown],[window,'mouseup',this._onMouseUp],[window,'mousemove',this._onMouseMove],[canvas,'wheel',this._onWheel,{passive:true}],[canvas,'contextmenu',this._onContextMenu],[document,'pointerlockchange',this._onPointerLockChange]];
    for(const[t,ev,fn,op]of this._ls)t.addEventListener(ev,fn,op);
  }

  requestPointerLock(){try{if(this.canvas?.requestPointerLock&&document.pointerLockElement!==this.canvas)this.canvas.requestPointerLock();}catch{}}
  exitPointerLock(){try{if(document.pointerLockElement)document.exitPointerLock();}catch{}}
  isDown(c){return this.keysDown.has(c);}wasPressed(c){return this.keysPressed.has(c);}
  isMouseDown(b=0){return this.mouseDown.has(b);}wasMousePressed(b=0){return this.mousePressed.has(b);}
  consumeMouse(){const r={dx:this.mouseDeltaX,dy:this.mouseDeltaY};this.mouseDeltaX=this.mouseDeltaY=0;return r;}
  consumeWheel(){const w=this.wheelDelta;this.wheelDelta=0;return w;}
  endFrame(){this.keysPressed.clear();this.mousePressed.clear();this.mouseDeltaX=this.mouseDeltaY=this.wheelDelta=0;}
  destroy(){for(const[t,ev,fn]of this._ls)t.removeEventListener(ev,fn);}
}
