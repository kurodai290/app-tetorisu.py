// Tetris Production - T Spin + Mobile Controls

"use strict";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const COLS = 10, ROWS = 20, BLOCK = 30;

const board = Array.from({length: ROWS}, () => Array(COLS).fill(0));

const COLORS = {
  I:"#00e5ff", O:"#ffe000", T:"#b000ff",
  S:"#00d060", Z:"#ff3030", J:"#3080ff", L:"#ff8c20"
};

const SHAPES = {
  I:[[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
  O:[[1,1],[1,1]],
  T:[[0,1,0],[1,1,1],[0,0,0]],
  S:[[0,1,1],[1,1,0],[0,0,0]],
  Z:[[1,1,0],[0,1,1],[0,0,0]],
  J:[[1,0,0],[1,1,1],[0,0,0]],
  L:[[0,0,1],[1,1,1],[0,0,0]]
};

const TYPES = Object.keys(SHAPES);

let current = null;
let nextType = null;
let holdType = null;
let canHold = true;
let bag = [];

let score = 0;
let lines = 0;
let level = 1;
let combo = -1;
let backToBack = false;

let gameOver = false;
let dropInterval = 800;
let lastTime = 0;
let dropCounter = 0;
let lockTimer = 0;
const lockDelay = 450;

// Tスピン判定用
let lastActionWasRotation = false;
let lastRotationKick = 0;

const scoreEl = document.getElementById("score");
const highEl = document.getElementById("high");
const linesEl = document.getElementById("lines");
const levelEl = document.getElementById("level");
const comboEl = document.getElementById("combo");
const holdEl = document.getElementById("hold");
const nextEl = document.getElementById("next");
const statusEl = document.getElementById("status");
const restartBtn = document.getElementById("restart");

let highScore = Number(localStorage.getItem("tetrisHighScore") || 0);

function shuffle(a){
  a=a.slice();
  for(let i=a.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}

function refillBag(){ bag.push(...shuffle(TYPES)); }

function getNextType(){
  if(!bag.length) refillBag();
  return bag.shift();
}

function cloneMatrix(m){ return m.map(r=>r.slice()); }

function getTopEmptyRows(m){
  let n=0;
  for(let y=0;y<m.length;y++){
    if(m[y].some(v=>v)) break;
    n++;
  }
  return n;
}

function createPiece(type){
  const matrix=cloneMatrix(SHAPES[type]);
  return {
    type,
    matrix,
    x:Math.floor((COLS-matrix[0].length)/2),
    y:-getTopEmptyRows(matrix)
  };
}

function spawnPiece(){
  const type=nextType || getNextType();
  nextType=getNextType();
  current=createPiece(type);
  canHold=true;
  dropCounter=0;
  lockTimer=0;
  lastActionWasRotation=false;
  lastRotationKick=0;

  if(collides(current)){
    gameOver=true;
    statusEl.textContent="GAME OVER";
  }
}

function resetGame(){
  for(let y=0;y<ROWS;y++) board[y].fill(0);

  score=0; lines=0; level=1; combo=-1;
  backToBack=false;
  gameOver=false;
  holdType=null; canHold=true;
  bag=[]; nextType=getNextType();

  spawnPiece();
  statusEl.textContent="ゲーム中";
  updateUI();
}

function collides(piece,dx=0,dy=0,matrix=piece.matrix){
  for(let y=0;y<matrix.length;y++){
    for(let x=0;x<matrix[y].length;x++){
      if(!matrix[y][x]) continue;

      const bx=piece.x+x+dx;
      const by=piece.y+y+dy;

      if(bx<0 || bx>=COLS || by>=ROWS) return true;
      if(by>=0 && board[by][bx]) return true;
    }
  }
  return false;
}

function move(dx){
  if(gameOver || !current) return;
  if(!collides(current,dx,0)){
    current.x+=dx;
    lockTimer=0;
    lastActionWasRotation=false;
  }
}

function softDrop(){
  if(gameOver || !current) return;
  if(!collides(current,0,1)){
    current.y++;
    score++;
    dropCounter=0;
    lockTimer=0;
    lastActionWasRotation=false;
  }
}

function hardDrop(){
  if(gameOver || !current) return;
  let d=0;
  while(!collides(current,0,d+1)) d++;
  current.y+=d;
  score+=d*2;
  lockPiece();
}

function rotateMatrix(m){
  const h=m.length,w=m[0].length;
  const r=Array.from({length:w},()=>Array(h).fill(0));
  for(let y=0;y<h;y++) for(let x=0;x<w;x++) r[x][h-1-y]=m[y][x];
  return r;
}

function rotate(){
  if(gameOver || !current) return;

  const rotated=rotateMatrix(current.matrix);
  const oldX=current.x;
  const kicks=[0,-1,1,-2,2];

  for(const kick of kicks){
    current.x=oldX+kick;
    if(!collides(current,0,0,rotated)){
      current.matrix=rotated;
      lastActionWasRotation=true;
      lastRotationKick=kick;
      lockTimer=0;
      return;
    }
  }
  current.x=oldX;
}

function hold(){
  if(gameOver || !current || !canHold) return;

  const old=current.type;

  if(holdType===null){
    holdType=old;
    spawnPiece();
  }else{
    const swap=holdType;
    holdType=old;
    current=createPiece(swap);
    dropCounter=0;
    lockTimer=0;
    lastActionWasRotation=false;

    if(collides(current)){
      gameOver=true;
      statusEl.textContent="GAME OVER";
    }
  }
  canHold=false;
}

function getGhostY(){
  if(!current) return 0;
  let d=0;
  while(!collides(current,0,d+1)) d++;
  return current.y+d;
}

// 盤面外を「埋まっている」としてTスピンの4隅を判定
function isOccupiedForTSpin(x,y){
  if(x<0 || x>=COLS || y<0 || y>=ROWS) return true;
  return board[y][x] !== 0;
}

// Tミノの中心を基準に4隅を確認
function getTSpinInfo(){
  if(!current || current.type!=="T" || !lastActionWasRotation) {
    return {isTSpin:false,isMini:false,corners:0};
  }

  const cx=current.x+1;
  const cy=current.y+1;
  const corners=[
    [cx-1,cy-1],[cx+1,cy-1],
    [cx-1,cy+1],[cx+1,cy+1]
  ];

  const occupied=corners.filter(([x,y])=>isOccupiedForTSpin(x,y)).length;

  if(occupied<3) return {isTSpin:false,isMini:false,corners:occupied};

  // 簡易Tスピンミニ判定:
  // 回転後のTの「前側」2隅のうち1つ以下が埋まっていて、
  // キックなしならMini扱い。その他は通常Tスピン。
  let front;
  switch(current.rotation || 0){
    case 0: front=[[cx-1,cy-1],[cx+1,cy-1]]; break;
    case 1: front=[[cx+1,cy-1],[cx+1,cy+1]]; break;
    case 2: front=[[cx-1,cy+1],[cx+1,cy+1]]; break;
    default: front=[[cx-1,cy-1],[cx-1,cy+1]];
  }

  const frontCount=front.filter(([x,y])=>isOccupiedForTSpin(x,y)).length;
  const mini=(occupied===3 && frontCount<2 && lastRotationKick===0);

  return {isTSpin:true,isMini:mini,corners:occupied};
}

function addScore(base,isSpecial=false){
  let amount=base*level;

  if(isSpecial && backToBack){
    amount=Math.floor(amount*1.5);
  }

  score+=amount;
  return amount;
}

function lockPiece(){
  if(!current) return;

  const tspin=getTSpinInfo();

  for(let y=0;y<current.matrix.length;y++){
    for(let x=0;x<current.matrix[y].length;x++){
      if(!current.matrix[y][x]) continue;

      const bx=current.x+x;
      const by=current.y+y;

      if(by<0){
        gameOver=true;
        statusEl.textContent="GAME OVER";
        updateUI();
        return;
      }

      board[by][bx]=current.type;
    }
  }

  const cleared=clearLines();

  // Tスピン専用ボーナス
  if(tspin.isTSpin){
    if(tspin.isMini){
      if(cleared===0) addScore(100,true);
      else if(cleared===1) addScore(200,true);
      showEvent(cleared ? "Tスピンミニ シングル！" : "Tスピンミニ！");
    }else{
      if(cleared===0) addScore(400,true);
      else if(cleared===1) addScore(800,true);
      else if(cleared===2) addScore(1200,true);
      else if(cleared===3) addScore(1600,true);
      showEvent(cleared ? `Tスピン ${cleared}ライン！` : "Tスピン！");
    }
  }

  // 4ライン消しはテトリス
  if(cleared===4){
    const special=!tspin.isTSpin;
    addScore(800,special);
    showEvent("TETRIS!");
  }

  // コンボ
  if(cleared>0){
    combo++;
    if(combo>=1){
      addScore(50*combo,false);
      showEvent(`${combo} COMBO!`);
    }
  }else{
    combo=-1;
  }

  // バック・トゥ・バック対象
  const difficult = tspin.isTSpin || cleared===4;
  if(difficult){
    backToBack=true;
  }else if(cleared>0){
    backToBack=false;
  }

  // ライン消去でレベル
  level=Math.floor(lines/10)+1;
  dropInterval=Math.max(80,800-(level-1)*65);

  if(score>highScore){
    highScore=score;
    localStorage.setItem("tetrisHighScore",String(highScore));
  }

  spawnPiece();
}

function clearLines(){
  let cleared=0;

  for(let y=ROWS-1;y>=0;y--){
    if(board[y].every(v=>v!==0)){
      board.splice(y,1);
      board.unshift(Array(COLS).fill(0));
      cleared++;
      y++;
    }
  }

  if(cleared){
    const points=[0,100,300,500,800];
    score+=points[cleared]*level;
    lines+=cleared;
  }

  return cleared;
}

let eventTimer=0;
function showEvent(text){
  statusEl.textContent=text;
  eventTimer=1100;
}

function updateUI(){
  scoreEl.textContent=score;
  highEl.textContent=highScore;
  linesEl.textContent=lines;
  levelEl.textContent=level;
  comboEl.textContent=combo<0?0:combo;
  holdEl.textContent=holdType || "なし";
  nextEl.textContent=nextType || "-";

  if(gameOver) statusEl.textContent="GAME OVER";
  else if(eventTimer<=0) statusEl.textContent="ゲーム中";
}

function drawCell(x,y,type,alpha=1){
  if(y<0) return;
  ctx.globalAlpha=alpha;
  ctx.fillStyle=COLORS[type];
  ctx.fillRect(x*BLOCK,y*BLOCK,BLOCK,BLOCK);
  ctx.strokeStyle="rgba(255,255,255,.25)";
  ctx.strokeRect(x*BLOCK+.5,y*BLOCK+.5,BLOCK-1,BLOCK-1);
  ctx.globalAlpha=1;
}

function drawBoard(){
  ctx.clearRect(0,0,canvas.width,canvas.height);

  ctx.strokeStyle="rgba(255,255,255,.06)";
  for(let x=0;x<=COLS;x++){
    ctx.beginPath();ctx.moveTo(x*BLOCK,0);ctx.lineTo(x*BLOCK,ROWS*BLOCK);ctx.stroke();
  }
  for(let y=0;y<=ROWS;y++){
    ctx.beginPath();ctx.moveTo(0,y*BLOCK);ctx.lineTo(COLS*BLOCK,y*BLOCK);ctx.stroke();
  }

  for(let y=0;y<ROWS;y++){
    for(let x=0;x<COLS;x++){
      if(board[y][x]) drawCell(x,y,board[y][x]);
    }
  }

  if(!current) return;

  const ghost=getGhostY();
  for(let y=0;y<current.matrix.length;y++){
    for(let x=0;x<current.matrix[y].length;x++){
      if(current.matrix[y][x]) drawCell(current.x+x,ghost+y,current.type,.18);
    }
  }

  for(let y=0;y<current.matrix.length;y++){
    for(let x=0;x<current.matrix[y].length;x++){
      if(current.matrix[y][x]) drawCell(current.x+x,current.y+y,current.type);
    }
  }

  if(gameOver){
    ctx.fillStyle="rgba(0,0,0,.7)";
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle="#fff";
    ctx.textAlign="center";
    ctx.font="bold 34px sans-serif";
    ctx.fillText("GAME OVER",canvas.width/2,canvas.height/2);
    ctx.font="16px sans-serif";
    ctx.fillText("リスタートで再開",canvas.width/2,canvas.height/2+35);
  }
}

function update(time=0){
  const delta=time-lastTime;
  lastTime=time;

  if(eventTimer>0) eventTimer-=delta;

  if(!gameOver && current){
    dropCounter+=delta;

    if(dropCounter>=dropInterval){
      if(!collides(current,0,1)){
        current.y++;
        lockTimer=0;
        lastActionWasRotation=false;
      }else{
        lockTimer+=dropCounter;
        if(lockTimer>=lockDelay){
          lockPiece();
          dropCounter=0;
        }
      }
      dropCounter=0;
    }else if(collides(current,0,1)){
      lockTimer+=delta;
      if(lockTimer>=lockDelay){
        lockPiece();
        dropCounter=0;
      }
    }else{
      lockTimer=0;
    }
  }

  drawBoard();
  updateUI();
  requestAnimationFrame(update);
}

function action(name){
  if(gameOver) return;
  if(name==="left") move(-1);
  else if(name==="right") move(1);
  else if(name==="down") softDrop();
  else if(name==="rotate") rotate();
  else if(name==="hold") hold();
  else if(name==="drop") hardDrop();
}

// PC操作
document.addEventListener("keydown",e=>{
  if(["ArrowLeft","ArrowRight","ArrowDown","ArrowUp"," "].includes(e.key)) e.preventDefault();

  if(gameOver){
    if(e.key==="Enter") resetGame();
    return;
  }

  if(e.key==="ArrowLeft") move(-1);
  else if(e.key==="ArrowRight") move(1);
  else if(e.key==="ArrowDown") softDrop();
  else if(e.key==="ArrowUp") rotate();
  else if(e.key===" ") hardDrop();
  else if(e.key==="z" || e.key==="Z") hold();
});

// スマホ操作
document.querySelectorAll(".mobile-controls [data-action]").forEach(btn=>{
  const name=btn.dataset.action;

  const press=e=>{
    e.preventDefault();
    action(name);
  };

  btn.addEventListener("pointerdown",press);
  btn.addEventListener("contextmenu",e=>e.preventDefault());
});

// 長押しで左右・下を連続操作
document.querySelectorAll('[data-action="left"],[data-action="right"],[data-action="down"]').forEach(btn=>{
  let timer=null;
  let active=false;
  const name=btn.dataset.action;

  btn.addEventListener("pointerdown",e=>{
    e.preventDefault();
    active=true;
    action(name);
    timer=setInterval(()=>{
      if(active && !gameOver) action(name);
    },90);
  });

  const stop=()=>{
    active=false;
    if(timer){clearInterval(timer);timer=null;}
  };

  btn.addEventListener("pointerup",stop);
  btn.addEventListener("pointercancel",stop);
  btn.addEventListener("pointerleave",stop);
});

restartBtn.addEventListener("click",resetGame);

resetGame();
requestAnimationFrame(update);
