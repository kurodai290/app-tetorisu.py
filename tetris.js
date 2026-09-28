
const canvas=document.getElementById('game'),ctx=canvas.getContext('2d');
const W=10,H=20,S=30;
const board=Array.from({length:H},()=>Array(W).fill(0));
const colors=['#000','#0ff','#00f','#f80','#ff0','#0f0','#a0f','#f00'];
const names=['','I','J','L','O','S','T','Z'];
const shapes={
1:[[1,1,1,1]],2:[[2,0,0],[2,2,2]],3:[[0,0,3],[3,3,3]],
4:[[4,4],[4,4]],5:[[0,5,5],[5,5,0]],6:[[0,6,0],[6,6,6]],7:[[7,7,0],[0,7,7]]
};
let score=0,lines=0,level=1;
let hold=null,holdUsed=false;
let bag=[];

function refillBag(){ let a=[1,2,3,4,5,6,7]; for(let i=a.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];} bag.push(...a); }
function nextType(){ if(bag.length<7) refillBag(); return bag.shift(); }

let queue=[nextType(),nextType(),nextType(),nextType(),nextType()];
function newPiece(){
 const t=queue.shift(); queue.push(nextType());
 updateUI();
 return {type:t,m:shapes[t].map(r=>[...r]),x:3,y:0};
}
let p=newPiece();

function updateUI(){
 document.getElementById('score').textContent=score;
 document.getElementById('lines').textContent=lines;
 document.getElementById('level').textContent=level;
 document.getElementById('hold').textContent=hold?names[hold]:'なし';
 document.getElementById('next').textContent=queue.map(x=>names[x]).join(' ');
}

function collide(nx=p.x,ny=p.y,m=p.m){
 for(let y=0;y<m.length;y++)for(let x=0;x<m[y].length;x++)if(m[y][x]){
  let bx=nx+x,by=ny+y;
  if(bx<0||bx>=W||by>=H)return true;
  if(by>=0&&board[by][bx])return true;
 }
 return false;
}

function rotate(){
 const m=p.m[0].map((_,i)=>p.m.map(r=>r[i]).reverse());
 if(!collide(p.x,p.y,m)) p.m=m;
 else if(!collide(p.x-1,p.y,m)){p.x--;p.m=m;}
 else if(!collide(p.x+1,p.y,m)){p.x++;p.m=m;}
}

function holdPiece(){
 if(holdUsed) return;
 let cur=p.type;
 if(hold===null){
   hold=cur;
   p=newPiece();
 }else{
   let temp=hold;
   hold=cur;
   p={type:temp,m:shapes[temp].map(r=>[...r]),x:3,y:0};
 }
 holdUsed=true;
 updateUI();
}

function merge(){
 p.m.forEach((r,y)=>r.forEach((v,x)=>{ if(v) board[p.y+y][p.x+x]=v; }));
 let cleared=0;
 for(let y=H-1;y>=0;y--){
   if(board[y].every(v=>v)){
      board.splice(y,1);
      board.unshift(Array(W).fill(0));
      cleared++;
      y++;
   }
 }
 if(cleared){
   lines+=cleared;
   score+=[0,100,300,500,800][cleared]*level;
   level=Math.floor(lines/10)+1;
 }
 p=newPiece();
 holdUsed=false;
 if(collide()){ alert("ゲームオーバー\nScore:"+score); location.reload(); }
 updateUI();
}

function drawCell(x,y,c){ctx.fillStyle=colors[c];ctx.fillRect(x*S,y*S,S-1,S-1);}

function drawGhost(){
 let gy=p.y;
 while(!collide(p.x,gy+1)) gy++;
 ctx.globalAlpha=0.25;
 p.m.forEach((r,yy)=>r.forEach((v,xx)=>{if(v) drawCell(p.x+xx,gy+yy,v);}));
 ctx.globalAlpha=1;
}

function draw(){
 ctx.clearRect(0,0,canvas.width,canvas.height);
 for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(board[y][x]) drawCell(x,y,board[y][x]);
 drawGhost();
 p.m.forEach((r,yy)=>r.forEach((v,xx)=>{if(v) drawCell(p.x+xx,p.y+yy,v);}));
}

document.addEventListener('keydown',e=>{
 if(e.key==="ArrowLeft"&&!collide(p.x-1,p.y)) p.x--;
 if(e.key==="ArrowRight"&&!collide(p.x+1,p.y)) p.x++;
 if(e.key==="ArrowDown"&&!collide(p.x,p.y+1)){ p.y++; score++;}
 if(e.key==="ArrowUp") rotate();
 if(e.code==="Space"){
   while(!collide(p.x,p.y+1)){ p.y++; score+=2; }
   merge();
 }
 if(e.key==="z"||e.key==="Z") holdPiece();
 draw(); updateUI();
});

let last=Date.now();
function loop(){
 let speed=Math.max(100,800-(level-1)*60);
 if(Date.now()-last>speed){
   if(!collide(p.x,p.y+1)) p.y++;
   else merge();
   last=Date.now();
 }
 draw();
 requestAnimationFrame(loop);
}
updateUI();
loop();
