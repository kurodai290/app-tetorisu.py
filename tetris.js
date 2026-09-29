// Tetris Production
// 実装:
// ・7種類のミノ
// ・7バッグ
// ・自動落下
// ・左右移動 / ソフトドロップ / ハードドロップ
// ・回転
// ・ホールド
// ・次ミノ
// ・ゴーストピース
// ・ライン消去
// ・レベル / スコア
// ・ハイスコア(localStorage)
// ・簡易ロックディレイ
// ・ゲームオーバー / リスタート

"use strict";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));

const COLORS = {
  I: "#00e5ff",
  O: "#ffe000",
  T: "#b000ff",
  S: "#00d060",
  Z: "#ff3030",
  J: "#3080ff",
  L: "#ff8c20"
};

const SHAPES = {
  I: [
    [0,0,0,0],
    [1,1,1,1],
    [0,0,0,0],
    [0,0,0,0]
  ],
  O: [
    [1,1],
    [1,1]
  ],
  T: [
    [0,1,0],
    [1,1,1],
    [0,0,0]
  ],
  S: [
    [0,1,1],
    [1,1,0],
    [0,0,0]
  ],
  Z: [
    [1,1,0],
    [0,1,1],
    [0,0,0]
  ],
  J: [
    [1,0,0],
    [1,1,1],
    [0,0,0]
  ],
  L: [
    [0,0,1],
    [1,1,1],
    [0,0,0]
  ]
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
let gameOver = false;

let dropInterval = 800;
let lastTime = 0;
let dropCounter = 0;

let lockTimer = 0;
let lockDelay = 450;

let highScore = Number(localStorage.getItem("tetrisHighScore") || 0);

const scoreEl = document.getElementById("score");
const highEl = document.getElementById("high");
const linesEl = document.getElementById("lines");
const levelEl = document.getElementById("level");
const holdEl = document.getElementById("hold");
const nextEl = document.getElementById("next");
const statusEl = document.getElementById("status");
const restartBtn = document.getElementById("restart");

function shuffle(array) {
  const a = array.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function refillBag() {
  bag.push(...shuffle(TYPES));
}

function getNextType() {
  if (bag.length < 1) refillBag();
  return bag.shift();
}

function cloneMatrix(matrix) {
  return matrix.map(row => row.slice());
}

function createPiece(type) {
  const matrix = cloneMatrix(SHAPES[type]);
  return {
    type,
    matrix,
    x: Math.floor((COLS - matrix[0].length) / 2),
    y: -getTopEmptyRows(matrix)
  };
}

function getTopEmptyRows(matrix) {
  let n = 0;
  for (let y = 0; y < matrix.length; y++) {
    if (matrix[y].some(v => v)) break;
    n++;
  }
  return n;
}

function spawnPiece() {
  const type = nextType || getNextType();
  nextType = getNextType();
  current = createPiece(type);
  canHold = true;
  dropCounter = 0;
  lockTimer = 0;

  if (collides(current)) {
    gameOver = true;
    statusEl.textContent = "GAME OVER";
  }
}

function resetGame() {
  for (let y = 0; y < ROWS; y++) {
    board[y].fill(0);
  }

  score = 0;
  lines = 0;
  level = 1;
  dropInterval = 800;
  gameOver = false;
  holdType = null;
  canHold = true;
  bag = [];
  nextType = getNextType();

  spawnPiece();
  statusEl.textContent = "ゲーム中";
  updateUI();
}

function collides(piece, dx = 0, dy = 0, matrix = piece.matrix) {
  for (let y = 0; y < matrix.length; y++) {
    for (let x = 0; x < matrix[y].length; x++) {
      if (!matrix[y][x]) continue;

      const bx = piece.x + x + dx;
      const by = piece.y + y + dy;

      if (bx < 0 || bx >= COLS || by >= ROWS) {
        return true;
      }

      if (by >= 0 && board[by][bx]) {
        return true;
      }
    }
  }
  return false;
}

function move(dx) {
  if (gameOver || !current) return;

  if (!collides(current, dx, 0)) {
    current.x += dx;
    lockTimer = 0;
  }
}

function softDrop() {
  if (gameOver || !current) return;

  if (!collides(current, 0, 1)) {
    current.y++;
    score += 1;
    dropCounter = 0;
    lockTimer = 0;
  }
}

function hardDrop() {
  if (gameOver || !current) return;

  let distance = 0;
  while (!collides(current, 0, 1)) {
    current.y++;
    distance++;
  }

  score += distance * 2;
  lockPiece();
}

function rotateMatrix(matrix) {
  const h = matrix.length;
  const w = matrix[0].length;
  const rotated = Array.from({ length: w }, () => Array(h).fill(0));

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      rotated[x][h - 1 - y] = matrix[y][x];
    }
  }

  return rotated;
}

function rotate() {
  if (gameOver || !current) return;

  const rotated = rotateMatrix(current.matrix);
  const oldX = current.x;

  // 簡易ウォールキック
  const kicks = [0, -1, 1, -2, 2];

  for (const kick of kicks) {
    current.x = oldX + kick;
    if (!collides(current, 0, 0, rotated)) {
      current.matrix = rotated;
      lockTimer = 0;
      return;
    }
  }

  current.x = oldX;
}

function hold() {
  if (gameOver || !current || !canHold) return;

  const oldType = current.type;

  if (holdType === null) {
    holdType = oldType;
    spawnPiece();
  } else {
    const swap = holdType;
    holdType = oldType;
    current = createPiece(swap);
    dropCounter = 0;
    lockTimer = 0;

    if (collides(current)) {
      gameOver = true;
      statusEl.textContent = "GAME OVER";
    }
  }

  canHold = false;
}

function getGhostY() {
  if (!current) return 0;

  let dy = 0;
  while (!collides(current, 0, dy + 1)) {
    dy++;
  }
  return current.y + dy;
}

function lockPiece() {
  if (!current) return;

  for (let y = 0; y < current.matrix.length; y++) {
    for (let x = 0; x < current.matrix[y].length; x++) {
      if (!current.matrix[y][x]) continue;

      const bx = current.x + x;
      const by = current.y + y;

      if (by < 0) {
        gameOver = true;
        statusEl.textContent = "GAME OVER";
        updateUI();
        return;
      }

      board[by][bx] = current.type;
    }
  }

  clearLines();
  spawnPiece();
}

function clearLines() {
  let cleared = 0;

  for (let y = ROWS - 1; y >= 0; y--) {
    if (board[y].every(cell => cell !== 0)) {
      board.splice(y, 1);
      board.unshift(Array(COLS).fill(0));
      cleared++;
      y++;
    }
  }

  if (cleared > 0) {
    const points = [0, 100, 300, 500, 800];
    score += points[cleared] * level;
    lines += cleared;

    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(80, 800 - (level - 1) * 65);
  }

  if (score > highScore) {
    highScore = score;
    localStorage.setItem("tetrisHighScore", String(highScore));
  }

  updateUI();
}

function updateUI() {
  scoreEl.textContent = score;
  highEl.textContent = highScore;
  linesEl.textContent = lines;
  levelEl.textContent = level;
  holdEl.textContent = holdType || "なし";
  nextEl.textContent = nextType || "-";
}

function drawCell(x, y, type, alpha = 1) {
  if (y < 0) return;

  ctx.globalAlpha = alpha;
  ctx.fillStyle = COLORS[type];
  ctx.fillRect(x * BLOCK, y * BLOCK, BLOCK, BLOCK);

  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.strokeRect(x * BLOCK + 0.5, y * BLOCK + 0.5, BLOCK - 1, BLOCK - 1);

  ctx.globalAlpha = 1;
}

function drawBoard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 背景グリッド
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  for (let x = 0; x <= COLS; x++) {
    ctx.beginPath();
    ctx.moveTo(x * BLOCK, 0);
    ctx.lineTo(x * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let y = 0; y <= ROWS; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * BLOCK);
    ctx.lineTo(COLS * BLOCK, y * BLOCK);
    ctx.stroke();
  }

  // 固定済みミノ
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (board[y][x]) {
        drawCell(x, y, board[y][x]);
      }
    }
  }

  if (!current) return;

  // ゴースト
  const ghostY = getGhostY();
  for (let y = 0; y < current.matrix.length; y++) {
    for (let x = 0; x < current.matrix[y].length; x++) {
      if (current.matrix[y][x]) {
        drawCell(current.x + x, ghostY + y, current.type, 0.18);
      }
    }
  }

  // 操作中のミノ
  for (let y = 0; y < current.matrix.length; y++) {
    for (let x = 0; x < current.matrix[y].length; x++) {
      if (current.matrix[y][x]) {
        drawCell(current.x + x, current.y + y, current.type);
      }
    }
  }

  if (gameOver) {
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.font = "bold 34px sans-serif";
    ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2);
    ctx.font = "16px sans-serif";
    ctx.fillText("リスタートで再開", canvas.width / 2, canvas.height / 2 + 35);
  }
}

function update(time = 0) {
  const delta = time - lastTime;
  lastTime = time;

  if (!gameOver && current) {
    dropCounter += delta;

    if (dropCounter >= dropInterval) {
      if (!collides(current, 0, 1)) {
        current.y++;
        lockTimer = 0;
      } else {
        lockTimer += dropCounter;
        if (lockTimer >= lockDelay) {
          lockPiece();
        }
      }
      dropCounter = 0;
    } else if (collides(current, 0, 1)) {
      lockTimer += delta;
      if (lockTimer >= lockDelay) {
        lockPiece();
        dropCounter = 0;
      }
    } else {
      lockTimer = 0;
    }
  }

  drawBoard();
  updateUI();
  requestAnimationFrame(update);
}

document.addEventListener("keydown", (e) => {
  if (["ArrowLeft","ArrowRight","ArrowDown","ArrowUp"," "].includes(e.key)) {
    e.preventDefault();
  }

  if (gameOver) {
    if (e.key === "Enter") resetGame();
    return;
  }

  switch (e.key) {
    case "ArrowLeft":
      move(-1);
      break;
    case "ArrowRight":
      move(1);
      break;
    case "ArrowDown":
      softDrop();
      break;
    case "ArrowUp":
      rotate();
      break;
    case " ":
      hardDrop();
      break;
    case "z":
    case "Z":
      hold();
      break;
  }
});

restartBtn.addEventListener("click", resetGame);

resetGame();
requestAnimationFrame(update);
