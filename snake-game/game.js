const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");
const scoreValue = document.querySelector("#scoreValue");
const bestValue = document.querySelector("#bestValue");
const statusText = document.querySelector("#statusText");
const startOverlay = document.querySelector("#startOverlay");
const startButton = document.querySelector("#startButton");
const pauseButton = document.querySelector("#pauseButton");
const restartButton = document.querySelector("#restartButton");
const speedSelect = document.querySelector("#speedSelect");
const dpadButtons = document.querySelectorAll(".dpad button");

const gridSize = 24;
const tileSize = canvas.width / gridSize;
const bestKey = "neon-snake-best";

let snake;
let apple;
let direction;
let queuedDirection;
let score;
let best = Number(localStorage.getItem(bestKey) || 0);
let timer = null;
let running = false;
let paused = false;
let gameOver = false;
let awaitingContinue = false;

const directions = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

function resetGame() {
  snake = [
    { x: 10, y: 12 },
    { x: 9, y: 12 },
    { x: 8, y: 12 },
  ];
  direction = directions.right;
  queuedDirection = directions.right;
  score = 0;
  paused = false;
  gameOver = false;
  awaitingContinue = false;
  apple = createApple();
  updateHud("Ready");
  draw();
}

function startGame() {
  if (awaitingContinue) {
    continueGame();
    return;
  }
  if (running && !gameOver) return;
  running = true;
  paused = false;
  gameOver = false;
  startOverlay.classList.remove("is-visible");
  updateHud("Playing");
  clearInterval(timer);
  timer = setInterval(step, Number(speedSelect.value));
}

function pauseGame() {
  if (!running || gameOver) return;
  paused = !paused;
  updateHud(paused ? "Paused" : "Playing");
  startOverlay.classList.toggle("is-visible", paused);
  startOverlay.querySelector("strong").textContent = paused ? "Paused" : "Press Start";
  startOverlay.querySelector("span").textContent = paused ? "Press Space to continue." : "Eat apples, grow longer, avoid walls and yourself.";
}

function restartGame() {
  clearInterval(timer);
  timer = null;
  running = false;
  awaitingContinue = false;
  resetGame();
  startOverlay.classList.add("is-visible");
  startOverlay.querySelector("strong").textContent = "Press Start";
  startOverlay.querySelector("span").textContent = "Eat apples, grow longer, avoid walls and yourself.";
  startButton.textContent = "Start";
}

function step() {
  if (paused || gameOver) return;
  direction = queuedDirection;

  const head = snake[0];
  const next = { x: head.x + direction.x, y: head.y + direction.y };

  if (isWallHit(next) || isSnakeHit(next)) {
    endGame();
    return;
  }

  snake.unshift(next);

  if (next.x === apple.x && next.y === apple.y) {
    score += 10;
    if (score > best) {
      best = score;
      localStorage.setItem(bestKey, String(best));
    }
    apple = createApple();
  } else {
    snake.pop();
  }

  updateHud("Playing");
  draw();
}

function endGame() {
  running = false;
  gameOver = true;
  awaitingContinue = true;
  clearInterval(timer);
  timer = null;
  updateHud("Continue?");
  startOverlay.classList.add("is-visible");
  startOverlay.querySelector("strong").textContent = "Continue?";
  startOverlay.querySelector("span").textContent = "Keep your score and respawn from a safe lane.";
  startButton.textContent = "Continue";
}

function continueGame() {
  snake = [
    { x: 10, y: 12 },
    { x: 9, y: 12 },
    { x: 8, y: 12 },
  ];
  direction = directions.right;
  queuedDirection = directions.right;
  apple = createApple();
  awaitingContinue = false;
  gameOver = false;
  running = true;
  paused = false;
  startButton.textContent = "Start";
  startOverlay.classList.remove("is-visible");
  updateHud("Playing");
  draw();
  clearInterval(timer);
  timer = setInterval(step, Number(speedSelect.value));
}

function createApple() {
  let spot;
  do {
    spot = {
      x: Math.floor(Math.random() * gridSize),
      y: Math.floor(Math.random() * gridSize),
    };
  } while (snake.some((part) => part.x === spot.x && part.y === spot.y));
  return spot;
}

function setDirection(nextDirection) {
  const next = directions[nextDirection];
  if (!next) return;
  const isOpposite = next.x + direction.x === 0 && next.y + direction.y === 0;
  if (!isOpposite) queuedDirection = next;
}

function isWallHit(point) {
  return point.x < 0 || point.x >= gridSize || point.y < 0 || point.y >= gridSize;
}

function isSnakeHit(point) {
  return snake.some((part) => part.x === point.x && part.y === point.y);
}

function updateHud(status) {
  scoreValue.textContent = score;
  bestValue.textContent = best;
  statusText.textContent = status;
}

function draw() {
  ctx.fillStyle = "#07110f";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  drawApple();
  drawSnake();
}

function drawGrid() {
  ctx.strokeStyle = "rgba(57, 255, 145, 0.08)";
  ctx.lineWidth = 1;
  for (let i = 1; i < gridSize; i += 1) {
    const pos = i * tileSize;
    ctx.beginPath();
    ctx.moveTo(pos, 0);
    ctx.lineTo(pos, canvas.height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, pos);
    ctx.lineTo(canvas.width, pos);
    ctx.stroke();
  }
}

function drawSnake() {
  snake.forEach((part, index) => {
    const inset = index === 0 ? 3 : 5;
    const x = part.x * tileSize + inset;
    const y = part.y * tileSize + inset;
    const size = tileSize - inset * 2;
    ctx.fillStyle = index === 0 ? "#39ff91" : "#1dd579";
    ctx.shadowBlur = index === 0 ? 18 : 10;
    ctx.shadowColor = "#39ff91";
    roundedRect(x, y, size, size, 7);
    ctx.fill();
  });
  ctx.shadowBlur = 0;
}

function drawApple() {
  const centerX = apple.x * tileSize + tileSize / 2;
  const centerY = apple.y * tileSize + tileSize / 2;
  ctx.fillStyle = "#ff4c5f";
  ctx.shadowBlur = 18;
  ctx.shadowColor = "#ff4c5f";
  ctx.beginPath();
  ctx.arc(centerX, centerY, tileSize * 0.34, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function roundedRect(x, y, width, height, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

document.addEventListener("keydown", (event) => {
  const keyMap = {
    ArrowUp: "up",
    w: "up",
    W: "up",
    ArrowDown: "down",
    s: "down",
    S: "down",
    ArrowLeft: "left",
    a: "left",
    A: "left",
    ArrowRight: "right",
    d: "right",
    D: "right",
  };

  if (event.code === "Space") {
    event.preventDefault();
    if (awaitingContinue) {
      continueGame();
      return;
    }
    pauseGame();
    return;
  }

  if (keyMap[event.key]) {
    event.preventDefault();
    setDirection(keyMap[event.key]);
    if (!running && (!gameOver || awaitingContinue)) startGame();
  }
});

startButton.addEventListener("click", startGame);
pauseButton.addEventListener("click", pauseGame);
restartButton.addEventListener("click", restartGame);
speedSelect.addEventListener("change", () => {
  if (running && !paused) {
    clearInterval(timer);
    timer = setInterval(step, Number(speedSelect.value));
  }
});

dpadButtons.forEach((button) => {
  const press = (event) => {
    event.preventDefault();
    setDirection(button.dataset.dir);
    if (!running && (!gameOver || awaitingContinue)) startGame();
  };
  button.addEventListener("pointerdown", press);
});

resetGame();
