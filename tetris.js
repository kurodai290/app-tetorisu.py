
const canvas=document.getElementById('game'),ctx=canvas.getContext('2d');
const COLS=10,ROWS=20,S=30;
const board=Array.from({length:ROWS},()=>Array(COLS).fill(0));
const colors=['#000','#0ff','#00f','#f80','#ff0','#0f0','#a0f','#f00'];
const pieces=[[],[[1,1,1,1]],[[2,0,0],[2,2,2]],[[0,0,3],[3,3,3]],[[4,4],[4,4]],[[0,5,5],[5,5,0]],[[0,6,0],[6,6,6]],[[7,7,0],[0,7,7]]];
let score=0,lines=0;
function newPiece(){let t=1+Math.floor(Math.random()*7);return{m:pieces[t].map(r=>[...r]),x:3,y:0};}
let p=newPiece();
function drawCell(x,y,c){ctx.fillStyle=colors[c];ctx.fillRect(x*S,y*S,S-1,S-1);}
function draw(){ctx.clearRect(0,0,canvas.width,canvas.height);
for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)if(board[y][x])drawCell(x,y,board[y][x]);
p.m.forEach((r,yy)=>r.forEach((v,xx)=>{if(v)drawCell(p.x+xx,p.y+yy,v)}));
}
function collide(nx=p.x,ny=p.y,m=p.m){
for(let y=0;y<m.length;y++)for(let x=0;x<m[y].length;x++)if(m[y][x]){
let bx=nx+x,by=ny+y;
if(bx<0||bx>=COLS||by>=ROWS)return true;
if(by>=0&&board[by][bx])return true;
}
return false;
}
function merge(){
p.m.forEach((r,y)=>r.forEach((v,x)=>{if(v)board[p.y+y][p.x+x]=v;}));
for(let y=ROWS-1;y>=0;y--){
if(board[y].every(v=>v)){
board.splice(y,1);board.unshift(Array(COLS).fill(0));
score+=100;lines++;y++;
}
}
document.getElementById('score').textContent=score;
document.getElementById('lines').textContent=lines;
p=newPiece();
if(collide()){alert('Game Over');location.reload();}
}
function rotate(){
let m=p.m[0].map((_,i)=>p.m.map(r=>r[i]).reverse());
if(!collide(p.x,p.y,m))p.m=m;
}
document.addEventListener('keydown',e=>{
if(e.key==='ArrowLeft'&&!collide(p.x-1,p.y))p.x--;
if(e.key==='ArrowRight'&&!collide(p.x+1,p.y))p.x++;
if(e.key==='ArrowDown'&&!collide(p.x,p.y+1))p.y++;
if(e.key==='ArrowUp')rotate();
if(e.code==='Space'){while(!collide(p.x,p.y+1))p.y++;merge();}
if(e.key==='z'||e.key==='Z')alert('ホールドはZIP簡易版では未実装');
draw();
});
setInterval(()=>{if(!collide(p.x,p.y+1))p.y++;else merge();draw();},500);
draw();
