const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");
const nextCanvas = document.querySelector("#nextCanvas");
const nextCtx = nextCanvas.getContext("2d");
const scoreValue = document.querySelector("#scoreValue");
const bestValue = document.querySelector("#bestValue");
const statusText = document.querySelector("#statusText");
const overlay = document.querySelector("#gameOverlay");
const overlayTitle = document.querySelector("#overlayTitle");
const overlayText = document.querySelector("#overlayText");
const startButton = document.querySelector("#startButton");
const dropButton = document.querySelector("#dropButton");
const restartButton = document.querySelector("#restartButton");
const laneButtons = document.querySelectorAll(".lane-pad button");

const width = canvas.width;
const height = canvas.height;
const dangerLine = 168;
const spawnY = 78;
const leftWall = 34;
const rightWall = width - 34;
const floorY = height - 34;
const bestKey = "orb-orchard-best";

const orbTypes = [
  { name: "Sprout", radius: 24, color: "#35dfff", glow: "#35dfff", points: 8 },
  { name: "Bloom", radius: 31, color: "#4dff8d", glow: "#4dff8d", points: 18 },
  { name: "Pulse", radius: 39, color: "#ffd166", glow: "#ffd166", points: 42 },
  { name: "Flare", radius: 49, color: "#ff7a59", glow: "#ff7a59", points: 90 },
  { name: "Nova", radius: 61, color: "#ff5b91", glow: "#ff5b91", points: 190 },
  { name: "Crown", radius: 75, color: "#a77cff", glow: "#a77cff", points: 420 },
  { name: "Aurora", radius: 92, color: "#e8fbff", glow: "#35dfff", points: 900 },
];

let orbs = [];
let particles = [];
let laneX = width / 2;
let currentLevel = 0;
let nextLevel = 0;
let score = 0;
let best = Number(localStorage.getItem(bestKey) || 0);
let state = "ready";
let canDrop = true;
let lastTime = 0;
let leftPressed = false;
let rightPressed = false;
let mergeSerial = 1;

function resetGame() {
  orbs = [];
  particles = [];
  laneX = width / 2;
  currentLevel = randomSpawnLevel();
  nextLevel = randomSpawnLevel();
  score = 0;
  state = "ready";
  canDrop = true;
  lastTime = 0;
  updateHud("Ready");
  setOverlay(true, "Ready to Drop", "Move with mouse or arrow keys. Space drops the glowing orb.");
  draw();
  drawNext();
}

function startGame() {
  if (state === "playing") return;
  if (state === "gameover") {
    resetGame();
  }
  state = "playing";
  setOverlay(false);
  updateHud("Playing");
  requestAnimationFrame(loop);
}

function dropOrb() {
  if (state !== "playing" || !canDrop) return;
  const type = orbTypes[currentLevel];
  orbs.push({
    x: laneX,
    y: spawnY,
    vx: 0,
    vy: 38,
    radius: type.radius,
    level: currentLevel,
    id: cryptoRandomId(),
    born: performance.now(),
    merging: false,
  });
  currentLevel = nextLevel;
  nextLevel = randomSpawnLevel();
  canDrop = false;
  setTimeout(() => {
    canDrop = state === "playing";
  }, 520);
  drawNext();
}

function loop(time) {
  if (state !== "playing") return;
  const delta = Math.min(32, time - (lastTime || time)) / 1000;
  lastTime = time;
  step(delta);
  draw();
  requestAnimationFrame(loop);
}

function step(delta) {
  moveLane(delta);

  for (const orb of orbs) {
    orb.vy += 1180 * delta;
    orb.vx *= 0.997;
    orb.vy *= 0.999;
    orb.x += orb.vx * delta;
    orb.y += orb.vy * delta;

    if (orb.x - orb.radius < leftWall) {
      orb.x = leftWall + orb.radius;
      orb.vx = Math.abs(orb.vx) * 0.42;
    }
    if (orb.x + orb.radius > rightWall) {
      orb.x = rightWall - orb.radius;
      orb.vx = -Math.abs(orb.vx) * 0.42;
    }
    if (orb.y + orb.radius > floorY) {
      orb.y = floorY - orb.radius;
      orb.vy = -Math.abs(orb.vy) * 0.22;
      orb.vx *= 0.92;
      if (Math.abs(orb.vy) < 20) orb.vy = 0;
    }
  }

  for (let pass = 0; pass < 4; pass += 1) {
    resolveOrbCollisions();
  }

  detectMerges();
  updateParticles(delta);
  checkGameOver();
}

function moveLane(delta) {
  const speed = 520;
  const type = orbTypes[currentLevel];
  if (leftPressed) laneX -= speed * delta;
  if (rightPressed) laneX += speed * delta;
  laneX = clamp(laneX, leftWall + type.radius, rightWall - type.radius);
}

function resolveOrbCollisions() {
  for (let i = 0; i < orbs.length; i += 1) {
    for (let j = i + 1; j < orbs.length; j += 1) {
      const a = orbs[i];
      const b = orbs[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 0.001;
      const minDist = a.radius + b.radius;
      if (dist >= minDist) continue;

      const nx = dx / dist;
      const ny = dy / dist;
      const overlap = minDist - dist;
      const total = a.radius + b.radius;
      const aShare = b.radius / total;
      const bShare = a.radius / total;
      a.x -= nx * overlap * aShare;
      a.y -= ny * overlap * aShare;
      b.x += nx * overlap * bShare;
      b.y += ny * overlap * bShare;

      const relVel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (relVel < 0) {
        const impulse = -(1.18 * relVel) / 2;
        a.vx -= impulse * nx;
        a.vy -= impulse * ny;
        b.vx += impulse * nx;
        b.vy += impulse * ny;
      }
    }
  }
}

function detectMerges() {
  for (let i = 0; i < orbs.length; i += 1) {
    for (let j = i + 1; j < orbs.length; j += 1) {
      const a = orbs[i];
      const b = orbs[j];
      if (a.level !== b.level || a.level >= orbTypes.length - 1 || a.merging || b.merging) continue;
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      if (dist > (a.radius + b.radius) * 0.86) continue;
      mergeOrbs(a, b);
      return;
    }
  }
}

function mergeOrbs(a, b) {
  a.merging = true;
  b.merging = true;
  const newLevel = a.level + 1;
  const type = orbTypes[newLevel];
  const x = clamp((a.x + b.x) / 2, leftWall + type.radius, rightWall - type.radius);
  const y = Math.min((a.y + b.y) / 2, floorY - type.radius);
  const vx = (a.vx + b.vx) * 0.24;
  const vy = Math.min((a.vy + b.vy) * 0.12, 80);

  orbs = orbs.filter((orb) => orb !== a && orb !== b);
  orbs.push({
    x,
    y,
    vx,
    vy,
    radius: type.radius,
    level: newLevel,
    id: cryptoRandomId(),
    born: performance.now(),
    merging: false,
    pop: 1,
  });

  score += type.points;
  if (score > best) {
    best = score;
    localStorage.setItem(bestKey, String(best));
  }
  burst(x, y, type.glow, 18 + newLevel * 3);
  updateHud("Merged");
  mergeSerial += 1;
}

function checkGameOver() {
  const now = performance.now();
  const crowded = orbs.some((orb) => {
    const settledEnough = Math.abs(orb.vy) < 45 && now - orb.born > 1500;
    return settledEnough && orb.y - orb.radius < dangerLine;
  });
  if (!crowded) return;
  state = "gameover";
  canDrop = false;
  updateHud("Game Over");
  setOverlay(true, "Canopy Full", "Your orchard reached the danger line. Restart and chase a brighter harvest.");
}

function draw() {
  drawBoard();
  drawLane();
  for (const orb of orbs) {
    drawOrb(ctx, orb.x, orb.y, orb.level, orb.radius, 1);
  }
  drawParticles();
}

function drawBoard() {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#071222");
  gradient.addColorStop(0.55, "#06101e");
  gradient.addColorStop(1, "#040914");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.strokeStyle = "rgba(84, 226, 255, 0.08)";
  ctx.lineWidth = 1;
  for (let x = leftWall; x <= rightWall; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 48; y < height; y += 48) {
    ctx.beginPath();
    ctx.moveTo(leftWall, y);
    ctx.lineTo(rightWall, y);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(255, 91, 145, 0.72)";
  ctx.setLineDash([14, 12]);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(leftWall, dangerLine);
  ctx.lineTo(rightWall, dangerLine);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(255, 91, 145, 0.9)";
  ctx.font = "800 17px Inter, system-ui, sans-serif";
  ctx.fillText("DANGER LINE", leftWall + 14, dangerLine - 12);

  ctx.strokeStyle = "rgba(84, 226, 255, 0.34)";
  ctx.lineWidth = 4;
  roundedStroke(leftWall, 18, rightWall - leftWall, floorY - 18, 8);
  ctx.restore();
}

function drawLane() {
  if (state === "gameover") return;
  const type = orbTypes[currentLevel];
  ctx.save();
  ctx.strokeStyle = "rgba(53, 223, 255, 0.46)";
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 10]);
  ctx.beginPath();
  ctx.moveTo(laneX, 26);
  ctx.lineTo(laneX, dangerLine - 18);
  ctx.stroke();
  ctx.setLineDash([]);
  drawOrb(ctx, laneX, spawnY, currentLevel, type.radius, state === "playing" && canDrop ? 1 : 0.55);
  ctx.restore();
}

function drawOrb(target, x, y, level, radius, alpha) {
  const type = orbTypes[level];
  target.save();
  target.globalAlpha = alpha;
  target.shadowBlur = 22 + level * 4;
  target.shadowColor = type.glow;
  const gradient = target.createRadialGradient(x - radius * 0.32, y - radius * 0.36, radius * 0.15, x, y, radius);
  gradient.addColorStop(0, "#ffffff");
  gradient.addColorStop(0.18, type.color);
  gradient.addColorStop(1, darken(type.color, level));
  target.fillStyle = gradient;
  target.beginPath();
  target.arc(x, y, radius, 0, Math.PI * 2);
  target.fill();
  target.shadowBlur = 0;
  target.strokeStyle = "rgba(238, 251, 255, 0.72)";
  target.lineWidth = Math.max(2, radius * 0.055);
  target.stroke();
  target.fillStyle = "rgba(255, 255, 255, 0.6)";
  target.beginPath();
  target.arc(x - radius * 0.28, y - radius * 0.32, radius * 0.18, 0, Math.PI * 2);
  target.fill();
  target.restore();
}

function drawNext() {
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  nextCtx.fillStyle = "#091628";
  roundedFill(nextCtx, 10, 10, nextCanvas.width - 20, nextCanvas.height - 20, 8);
  const type = orbTypes[nextLevel];
  drawOrb(nextCtx, nextCanvas.width / 2, nextCanvas.height / 2 + 8, nextLevel, type.radius * 0.78, 1);
}

function burst(x, y, color, count) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 90 + Math.random() * 220;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.5 + Math.random() * 0.35,
      maxLife: 0.85,
      color,
    });
  }
}

function updateParticles(delta) {
  for (const particle of particles) {
    particle.life -= delta;
    particle.x += particle.vx * delta;
    particle.y += particle.vy * delta;
    particle.vy += 260 * delta;
  }
  particles = particles.filter((particle) => particle.life > 0);
}

function drawParticles() {
  ctx.save();
  for (const particle of particles) {
    ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
    ctx.fillStyle = particle.color;
    ctx.shadowBlur = 16;
    ctx.shadowColor = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function randomSpawnLevel() {
  const roll = Math.random();
  if (score > 650 && roll > 0.84) return 2;
  if (score > 180 && roll > 0.72) return 1;
  return 0;
}

function setOverlay(visible, title = "", text = "") {
  overlay.classList.toggle("is-visible", visible);
  if (title) overlayTitle.textContent = title;
  if (text) overlayText.textContent = text;
  startButton.textContent = state === "gameover" ? "Restart" : "Start";
}

function updateHud(status) {
  scoreValue.textContent = score;
  bestValue.textContent = best;
  statusText.textContent = status;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function darken(hex, level) {
  const amount = 0.58 - level * 0.035;
  const raw = hex.replace("#", "");
  const r = Math.max(0, Math.floor(parseInt(raw.slice(0, 2), 16) * amount));
  const g = Math.max(0, Math.floor(parseInt(raw.slice(2, 4), 16) * amount));
  const b = Math.max(0, Math.floor(parseInt(raw.slice(4, 6), 16) * amount));
  return `rgb(${r}, ${g}, ${b})`;
}

function roundedFill(target, x, y, w, h, r) {
  target.beginPath();
  target.roundRect(x, y, w, h, r);
  target.fill();
}

function roundedStroke(x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.stroke();
}

function cryptoRandomId() {
  if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
  return `${Date.now()}-${Math.random()}-${mergeSerial}`;
}

canvas.addEventListener("pointermove", (event) => {
  const rect = canvas.getBoundingClientRect();
  const scale = width / rect.width;
  const x = (event.clientX - rect.left) * scale;
  const type = orbTypes[currentLevel];
  laneX = clamp(x, leftWall + type.radius, rightWall - type.radius);
});

canvas.addEventListener("pointerdown", () => {
  if (state !== "playing") startGame();
  else dropOrb();
});

window.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
    leftPressed = true;
    event.preventDefault();
  }
  if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
    rightPressed = true;
    event.preventDefault();
  }
  if (event.code === "Space" || event.key === "ArrowDown" || event.key.toLowerCase() === "s") {
    if (state !== "playing") startGame();
    else dropOrb();
    event.preventDefault();
  }
  if (event.key.toLowerCase() === "r") {
    resetGame();
    event.preventDefault();
  }
});

window.addEventListener("keyup", (event) => {
  if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") leftPressed = false;
  if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") rightPressed = false;
});

startButton.addEventListener("click", startGame);
dropButton.addEventListener("click", dropOrb);
restartButton.addEventListener("click", resetGame);

laneButtons.forEach((button) => {
  if (button.dataset.drop) {
    button.addEventListener("click", () => {
      if (state !== "playing") startGame();
      else dropOrb();
    });
    return;
  }

  button.addEventListener("pointerdown", () => {
    const direction = Number(button.dataset.move);
    leftPressed = direction < 0;
    rightPressed = direction > 0;
  });
  button.addEventListener("pointerup", () => {
    leftPressed = false;
    rightPressed = false;
  });
  button.addEventListener("pointerleave", () => {
    leftPressed = false;
    rightPressed = false;
  });
});

resetGame();
