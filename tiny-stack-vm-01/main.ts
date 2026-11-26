import*as fs from'node:fs';

const META=new Uint8Array(256);
for(let i=0;i<84;i++){
 const c='0Aq46:;?--------999999959995999-999-------------PTTP0-----------58--------------4414'.charCodeAt(i)-48;
 if(c>=0)META[i]=128|c;
}

function runProg(prog:Uint8Array,inp:Uint8Array):[Uint8Array,number]{
 const stk=new Int32Array(256),ret=new Int32Array(64),mem=new Int32Array(256),out=new Uint8Array(65536),len=prog.length;
 let top=0,rTop=0,outN=0,inAt=0,pc=0,steps=0,code=-1;
 for(;code<0;){
  if(steps===1e6){code=10;break;}
  if(pc<0||pc>=len){code=9;break;}
  const op=prog[pc],m=META[op];
  if(!m){code=5;break;}
  const imm=m>>4&7;
  if(pc+imm>=len){code=9;break;}
  steps++;
  const pops=m>>2&3;
  if(top<pops){code=2;break;}
  if(top-pops+(m&3)>256){code=3;break;}
  const at=pc;pc=at+1+imm;
  if((m&15)===9){
   const b=stk[--top],a=stk[top-1],ua=a>>>0,ub=b>>>0;
   if(op>18&&op<23&&!b){code=4;break;}
   let r=0;
   switch(op){
    case 16:r=a+b;break;case 17:r=a-b;break;case 18:r=Math.imul(a,b);break;
    case 19:r=a/b;break;case 20:r=a%b;break;case 21:r=ua/ub;break;case 22:r=ua%ub;break;
    case 24:r=a&b;break;case 25:r=a|b;break;case 26:r=a^b;break;
    case 28:r=a<<b;break;case 29:r=a>>b;break;case 30:r=a>>>b;break;
    case 32:r=+(a===b);break;case 33:r=+(a<b);break;case 34:r=+(ua<ub);break;
   }
   stk[top-1]=r|0;
   continue;
  }
  const u16=imm>1?prog[at+1]|prog[at+2]<<8:0;
  switch(op){
   case 0:code=0;break;
   case 1:stk[top++]=prog[at+1]<<24>>24;break;
   case 2:stk[top++]=u16|prog[at+3]<<16|prog[at+4]<<24;break;
   case 3:top--;break;
   case 4:case 6:stk[top]=stk[top-(op&2?2:1)];top++;break;
   case 5:{const t=stk[top-1];stk[top-1]=stk[top-2];stk[top-2]=t;break;}
   case 7:{const t=stk[top-3];stk[top-3]=stk[top-2];stk[top-2]=stk[top-1];stk[top-1]=t;break;}
   case 23:case 27:stk[top-1]=op===27?~stk[top-1]:-stk[top-1]|0;break;
   case 48:case 49:case 50:if(op<49||!stk[--top]===(op<50))pc+=u16<<16>>16;break;
   case 51:if(rTop>=64){code=7;break;}ret[rTop++]=pc;pc=u16;break;
   case 52:if(!rTop){code=8;break;}pc=ret[--rTop];break;
   case 64:case 65:{const a=stk[--top];if((a>>>0)>255){code=6;break;}if(op&1)mem[a]=stk[--top];else stk[top++]=mem[a];break;}
   case 80:{const s=String(stk[--top]),n=s.length;if(outN+n>65536){code=11;break;}for(let i=0;i<n;i++)out[outN++]=s.charCodeAt(i);break;}
   case 81:if(outN>=65536){code=11;break;}out[outN++]=stk[--top]&255;break;
   case 82:stk[top++]=inAt<inp.length?inp[inAt++]:-1;break;
   case 83:code=stk[--top]&255;break;
  }
 }
 return [out.subarray(0,outN),code];
}

const {MAKEFUN_INPUT_DIR:I='/input',MAKEFUN_OUTPUT_DIR:O='/output'}=process.env,{mkdirSync:md,readdirSync:rd,readFileSync:rf,writeFileSync:wf}=fs;
for(const id of rd(I,{withFileTypes:true}).filter(d=>d.isDirectory()).map(d=>d.name).sort()){
 const [out,ex]=runProg(rf(`${I}/${id}/program.bin`),rf(`${I}/${id}/input.bin`)),d=`${O}/${id}`;
 md(d,{recursive:true});wf(`${d}/stdout.bin`,out);wf(`${d}/exit.txt`,`${ex}\n`);
}
