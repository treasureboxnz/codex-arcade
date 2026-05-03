const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreText = document.getElementById("scoreText");
const massText = document.getElementById("massText");
const threatText = document.getElementById("threatText");
const startOverlay = document.getElementById("startOverlay");
const gameOverOverlay = document.getElementById("gameOverOverlay");
const finalText = document.getElementById("finalText");
const startButton = document.getElementById("startButton");
const againButton = document.getElementById("againButton");
const restartButton = document.getElementById("restartButton");

const world = { width: 2600, height: 1800 };
const camera = { x: 0, y: 0 };
const pointer = { x: 0, y: 0, active: false };
const keys = new Set();

let width = 1;
let height = 1;
let dpr = 1;
let running = false;
let gameOver = false;
let lastTime = 0;
let score = 0;
let energy = [];
let hunters = [];
let pulses = [];

const player = {
  x: world.width / 2,
  y: world.height / 2,
  vx: 0,
  vy: 0,
  mass: 18,
  hue: 178
};

const palette = {
  bg: "#06101e",
  grid: "rgba(84, 226, 255, 0.08)",
  cyan: "#35dfff",
  green: "#4dff8d",
  blue: "#32a9ff",
  danger: "#ff4d6d",
  gold: "#ffd166",
  text: "#eefbff"
};

function radiusForMass(mass) {
  return 10 + Math.sqrt(mass) * 2.35;
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function resetGame() {
  player.x = world.width / 2;
  player.y = world.height / 2;
  player.vx = 0;
  player.vy = 0;
  player.mass = 18;
  score = 0;
  gameOver = false;
  running = true;
  lastTime = performance.now();
  energy = [];
  hunters = [];
  pulses = [];

  for (let i = 0; i < 150; i += 1) {
    spawnEnergy();
  }

  for (let i = 0; i < 14; i += 1) {
    spawnHunter(i);
  }

  startOverlay.classList.add("hidden");
  gameOverOverlay.classList.add("hidden");
  updateHud();
}

function spawnEnergy() {
  const rare = Math.random() > 0.88;
  energy.push({
    x: randomBetween(42, world.width - 42),
    y: randomBetween(42, world.height - 42),
    value: rare ? 4 : 1,
    radius: rare ? randomBetween(5.2, 7.6) : randomBetween(3.2, 5.4),
    hue: rare ? randomBetween(42, 54) : randomBetween(150, 194),
    wobble: randomBetween(0, Math.PI * 2)
  });
}

function spawnHunter(index = 0) {
  const side = Math.floor(Math.random() * 4);
  const margin = 120;
  const x = side === 0 ? margin : side === 1 ? world.width - margin : randomBetween(margin, world.width - margin);
  const y = side === 2 ? margin : side === 3 ? world.height - margin : randomBetween(margin, world.height - margin);
  const mass = randomBetween(12, 55) + index * 1.8 + score * 0.002;
  const angle = randomBetween(0, Math.PI * 2);

  hunters.push({
    x,
    y,
    vx: Math.cos(angle) * randomBetween(20, 70),
    vy: Math.sin(angle) * randomBetween(20, 70),
    mass,
    mood: Math.random(),
    turn: randomBetween(0.6, 1.6),
    hue: Math.random() > 0.48 ? 344 : 205
  });
}

function toWorld(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: clientX - rect.left + camera.x,
    y: clientY - rect.top + camera.y
  };
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = Math.max(1, Math.floor(rect.width));
  height = Math.max(1, Math.floor(rect.height));
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  pointer.x = width / 2 + camera.x;
  pointer.y = height / 2 + camera.y;
}

function updateHud() {
  const larger = hunters.filter((hunter) => hunter.mass > player.mass * 1.08).length;
  scoreText.textContent = Math.floor(score).toLocaleString();
  massText.textContent = Math.floor(player.mass).toLocaleString();
  threatText.textContent = larger > 8 ? "High" : larger > 3 ? "Rising" : "Low";
}

function steerPlayer(dt) {
  let tx = pointer.active ? pointer.x : player.x;
  let ty = pointer.active ? pointer.y : player.y;

  const keyVector = { x: 0, y: 0 };
  if (keys.has("arrowup") || keys.has("w")) keyVector.y -= 1;
  if (keys.has("arrowdown") || keys.has("s")) keyVector.y += 1;
  if (keys.has("arrowleft") || keys.has("a")) keyVector.x -= 1;
  if (keys.has("arrowright") || keys.has("d")) keyVector.x += 1;

  if (keyVector.x || keyVector.y) {
    const length = Math.hypot(keyVector.x, keyVector.y) || 1;
    tx = player.x + (keyVector.x / length) * 240;
    ty = player.y + (keyVector.y / length) * 240;
  }

  const angle = Math.atan2(ty - player.y, tx - player.x);
  const desire = Math.min(1, Math.hypot(tx - player.x, ty - player.y) / 190);
  const maxSpeed = clamp(245 - player.mass * 1.12, 88, 220);
  player.vx += Math.cos(angle) * maxSpeed * desire * dt * 5.5;
  player.vy += Math.sin(angle) * maxSpeed * desire * dt * 5.5;
  player.vx *= Math.pow(0.18, dt);
  player.vy *= Math.pow(0.18, dt);
  player.x = clamp(player.x + player.vx * dt, radiusForMass(player.mass), world.width - radiusForMass(player.mass));
  player.y = clamp(player.y + player.vy * dt, radiusForMass(player.mass), world.height - radiusForMass(player.mass));
}

function updateEnergy(dt) {
  const playerRadius = radiusForMass(player.mass);

  for (let i = energy.length - 1; i >= 0; i -= 1) {
    const dot = energy[i];
    dot.wobble += dt * 3;

    if (distance(player, dot) < playerRadius + dot.radius + 2) {
      player.mass += dot.value * 0.55;
      score += dot.value * 12;
      pulses.push({ x: dot.x, y: dot.y, radius: 4, life: 0.34, color: dot.value > 1 ? palette.gold : palette.green });
      energy.splice(i, 1);
      spawnEnergy();
    }
  }
}

function updateHunters(dt) {
  const playerRadius = radiusForMass(player.mass);

  for (let i = hunters.length - 1; i >= 0; i -= 1) {
    const hunter = hunters[i];
    const hunterRadius = radiusForMass(hunter.mass);
    const canEatPlayer = hunter.mass > player.mass * 1.08;
    const edible = player.mass > hunter.mass * 1.12;
    const dx = player.x - hunter.x;
    const dy = player.y - hunter.y;
    const dist = Math.hypot(dx, dy) || 1;
    const dir = canEatPlayer ? 1 : edible ? -1 : hunter.mood > 0.5 ? 0.45 : -0.25;
    const speed = clamp(170 - hunter.mass * 0.9, 62, 150);

    hunter.vx += (dx / dist) * speed * dir * hunter.turn * dt;
    hunter.vy += (dy / dist) * speed * dir * hunter.turn * dt;
    hunter.vx += Math.sin(performance.now() * 0.001 + i) * 18 * dt;
    hunter.vy += Math.cos(performance.now() * 0.0013 + i) * 18 * dt;
    hunter.vx *= Math.pow(0.32, dt);
    hunter.vy *= Math.pow(0.32, dt);
    hunter.x += hunter.vx * dt;
    hunter.y += hunter.vy * dt;

    if (hunter.x < hunterRadius || hunter.x > world.width - hunterRadius) hunter.vx *= -1;
    if (hunter.y < hunterRadius || hunter.y > world.height - hunterRadius) hunter.vy *= -1;
    hunter.x = clamp(hunter.x, hunterRadius, world.width - hunterRadius);
    hunter.y = clamp(hunter.y, hunterRadius, world.height - hunterRadius);

    if (dist < playerRadius + hunterRadius * 0.72) {
      if (edible) {
        player.mass += hunter.mass * 0.26;
        score += Math.floor(hunter.mass * 35);
        pulses.push({ x: hunter.x, y: hunter.y, radius: hunterRadius, life: 0.55, color: palette.cyan });
        hunters.splice(i, 1);
        spawnHunter();
      } else if (canEatPlayer) {
        endGame();
        return;
      }
    }
  }

  const targetCount = clamp(12 + Math.floor(score / 850), 12, 26);
  while (hunters.length < targetCount) spawnHunter();
}

function updatePulses(dt) {
  for (let i = pulses.length - 1; i >= 0; i -= 1) {
    pulses[i].life -= dt;
    pulses[i].radius += dt * 96;
    if (pulses[i].life <= 0) pulses.splice(i, 1);
  }
}

function update(dt) {
  if (!running || gameOver) return;
  player.mass += dt * 0.28;
  score += dt * (4 + player.mass * 0.08);
  steerPlayer(dt);
  updateEnergy(dt);
  updateHunters(dt);
  updatePulses(dt);
  camera.x = clamp(player.x - width / 2, 0, Math.max(0, world.width - width));
  camera.y = clamp(player.y - height / 2, 0, Math.max(0, world.height - height));
  updateHud();
}

function drawGrid() {
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, width, height);

  const grid = 80;
  const startX = -camera.x % grid;
  const startY = -camera.y % grid;
  ctx.strokeStyle = palette.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = startX; x < width; x += grid) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  for (let y = startY; y < height; y += grid) {
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();

  const glow = ctx.createRadialGradient(width * 0.5, height * 0.5, 0, width * 0.5, height * 0.5, Math.max(width, height) * 0.7);
  glow.addColorStop(0, "rgba(53, 223, 255, 0.08)");
  glow.addColorStop(1, "rgba(5, 10, 20, 0.36)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
}

function drawBlob(entity, options) {
  const x = entity.x - camera.x;
  const y = entity.y - camera.y;
  const radius = radiusForMass(entity.mass);
  const fill = options.fill;
  const stroke = options.stroke;
  const phase = performance.now() * 0.004 + entity.x * 0.01;

  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  for (let i = 0; i < 28; i += 1) {
    const angle = (i / 28) * Math.PI * 2;
    const wobble = Math.sin(angle * 3 + phase) * 0.055 + Math.cos(angle * 5 - phase) * 0.035;
    const r = radius * (1 + wobble);
    const px = Math.cos(angle) * r;
    const py = Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();

  const gradient = ctx.createRadialGradient(-radius * 0.32, -radius * 0.36, radius * 0.2, 0, 0, radius * 1.15);
  gradient.addColorStop(0, options.highlight);
  gradient.addColorStop(0.55, fill);
  gradient.addColorStop(1, options.shadow);
  ctx.fillStyle = gradient;
  ctx.shadowColor = stroke;
  ctx.shadowBlur = options.glow;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = Math.max(2, radius * 0.08);
  ctx.strokeStyle = stroke;
  ctx.stroke();

  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.arc(-radius * 0.26, -radius * 0.28, radius * 0.22, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(238, 251, 255, 0.55)";
  ctx.fill();
  ctx.restore();
}

function drawEnergy() {
  for (const dot of energy) {
    const x = dot.x - camera.x;
    const y = dot.y - camera.y;
    if (x < -30 || x > width + 30 || y < -30 || y > height + 30) continue;
    const pulse = Math.sin(dot.wobble) * 0.8;
    ctx.beginPath();
    ctx.arc(x, y, dot.radius + pulse, 0, Math.PI * 2);
    ctx.fillStyle = `hsl(${dot.hue} 100% 62%)`;
    ctx.shadowColor = dot.value > 1 ? palette.gold : palette.green;
    ctx.shadowBlur = dot.value > 1 ? 18 : 12;
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

function drawHunters() {
  for (const hunter of hunters) {
    const edible = player.mass > hunter.mass * 1.12;
    const larger = hunter.mass > player.mass * 1.08;
    const color = edible ? palette.blue : larger ? palette.danger : palette.gold;
    drawBlob(hunter, {
      fill: edible ? "#1f88ff" : larger ? "#a91f45" : "#b9851d",
      highlight: edible ? "#9ddcff" : larger ? "#ff9ab0" : "#ffe39b",
      shadow: edible ? "#09355d" : larger ? "#430717" : "#493109",
      stroke: color,
      glow: larger ? 24 : 16
    });
  }
}

function drawPulses() {
  for (const pulse of pulses) {
    ctx.globalAlpha = clamp(pulse.life * 2, 0, 1);
    ctx.beginPath();
    ctx.arc(pulse.x - camera.x, pulse.y - camera.y, pulse.radius, 0, Math.PI * 2);
    ctx.strokeStyle = pulse.color;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function drawBoundaries() {
  ctx.strokeStyle = "rgba(84, 226, 255, 0.34)";
  ctx.lineWidth = 4;
  ctx.strokeRect(-camera.x, -camera.y, world.width, world.height);
}

function draw() {
  drawGrid();
  drawBoundaries();
  drawEnergy();
  drawHunters();
  drawPulses();
  drawBlob(player, {
    fill: "#0bd3d3",
    highlight: "#adfff4",
    shadow: "#053f56",
    stroke: palette.green,
    glow: 28
  });
}

function loop(now) {
  const dt = Math.min(0.033, (now - lastTime) / 1000 || 0);
  lastTime = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

function endGame() {
  gameOver = true;
  running = false;
  finalText.textContent = `Score ${Math.floor(score).toLocaleString()} · Mass ${Math.floor(player.mass).toLocaleString()}`;
  gameOverOverlay.classList.remove("hidden");
}

canvas.addEventListener("pointermove", (event) => {
  pointer.active = true;
  Object.assign(pointer, toWorld(event.clientX, event.clientY));
});

canvas.addEventListener("pointerdown", (event) => {
  pointer.active = true;
  canvas.setPointerCapture(event.pointerId);
  Object.assign(pointer, toWorld(event.clientX, event.clientY));
  if (!running && !gameOver) resetGame();
});

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  keys.add(key);
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) {
    event.preventDefault();
  }
  if (key === "r") resetGame();
  if ((key === "enter" || key === " ") && (!running || gameOver)) resetGame();
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key.toLowerCase());
});

window.addEventListener("resize", resize);
startButton.addEventListener("click", resetGame);
againButton.addEventListener("click", resetGame);
restartButton.addEventListener("click", resetGame);

resize();
resetGame();
running = false;
startOverlay.classList.remove("hidden");
draw();
requestAnimationFrame(loop);
