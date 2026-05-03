const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const stageEl = document.querySelector("#stage");
const hpEl = document.querySelector("#hp");
const chargeEl = document.querySelector("#charge");
const scoreEl = document.querySelector("#score");
const overlay = document.querySelector("#overlay");
const overlayTitle = document.querySelector("#overlayTitle");
const overlayText = document.querySelector("#overlayText");
const startBtn = document.querySelector("#start");
const touchButtons = document.querySelectorAll(".touch button");

const W = canvas.width;
const H = canvas.height;
const floorY = 410;
const keys = new Set();

const stages = [
  { name: "Metro Station", color: "#35dfff", boss: "Rail Bruiser", waves: [["runner", "runner"], ["guard", "runner"], ["guard", "guard", "drone"]] },
  { name: "Rooftop Relay", color: "#54ffa3", boss: "Signal Breaker", waves: [["drone", "runner"], ["drone", "guard"], ["runner", "runner", "drone"]] },
  { name: "Harbor Lock", color: "#ffd166", boss: "Dock Enforcer", waves: [["guard", "guard"], ["runner", "guard", "drone"], ["guard", "guard", "runner"]] },
  { name: "Data Core", color: "#a977ff", boss: "Core Sentinel", waves: [["drone", "drone"], ["guard", "drone", "runner"], ["guard", "guard", "drone"]] },
  { name: "Magline Terminal", color: "#ff4d6d", boss: "Terminal Titan", waves: [["runner", "guard", "drone"], ["guard", "guard", "drone"], ["guard", "guard", "runner", "drone"]] },
];

let player;
let enemies;
let particles;
let stageIndex;
let waveIndex;
let score;
let running;
let paused;
let lastTime;
let cameraX;
let messageTimer;
let attackPressed;

function resetGame() {
  player = {
    x: 120,
    y: floorY,
    z: 0,
    vx: 0,
    vy: 0,
    w: 44,
    h: 82,
    hp: 120,
    charge: 0,
    facing: 1,
    attackCd: 0,
    dashCd: 0,
    specialCd: 0,
    invuln: 0,
    combo: 0,
  };
  enemies = [];
  particles = [];
  stageIndex = 0;
  waveIndex = 0;
  score = 0;
  running = false;
  paused = false;
  cameraX = 0;
  messageTimer = 0;
  attackPressed = false;
  spawnWave();
  updateHud();
  draw();
  showOverlay("Metro Brawl", "Clear five modern city zones. J attacks, K jumps, L dashes, I uses shock burst.", "Start Patrol");
}

function startGame() {
  if (!running) {
    overlay.classList.remove("is-visible");
    running = true;
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }
}

function loop(now) {
  if (!running || paused) return;
  const dt = Math.min((now - lastTime) / 1000, 0.033);
  lastTime = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

function update(dt) {
  updatePlayer(dt);
  updateEnemies(dt);
  updateParticles(dt);
  checkWaveClear();
  messageTimer = Math.max(0, messageTimer - dt);
  updateHud();
}

function updatePlayer(dt) {
  const moveSpeed = 220;
  let dx = 0;
  let dy = 0;
  if (keys.has("left")) dx -= 1;
  if (keys.has("right")) dx += 1;
  if (keys.has("up")) dy -= 1;
  if (keys.has("down")) dy += 1;
  const mag = Math.hypot(dx, dy) || 1;
  player.x = clamp(player.x + (dx / mag) * moveSpeed * dt, 30, W - 30);
  player.y = clamp(player.y + (dy / mag) * moveSpeed * 0.55 * dt, floorY - 72, floorY + 38);
  if (dx !== 0) player.facing = Math.sign(dx);

  player.z += player.vy * dt;
  player.vy -= 900 * dt;
  if (player.z <= 0) {
    player.z = 0;
    player.vy = 0;
  }

  player.attackCd = Math.max(0, player.attackCd - dt);
  player.dashCd = Math.max(0, player.dashCd - dt);
  player.specialCd = Math.max(0, player.specialCd - dt);
  player.invuln = Math.max(0, player.invuln - dt);

  if (keys.has("jump") && player.z === 0) {
    player.vy = 520;
    keys.delete("jump");
  }
  if (keys.has("dash") && player.dashCd <= 0) {
    player.x = clamp(player.x + player.facing * 116, 30, W - 30);
    player.dashCd = 0.55;
    player.invuln = 0.22;
    burst(player.x, player.y - player.z, "#35dfff", 14);
    keys.delete("dash");
  }
  if (keys.has("attack") && player.attackCd <= 0 && !attackPressed) {
    attackPressed = true;
    punch();
  }
  if (!keys.has("attack")) attackPressed = false;
  if (keys.has("special") && player.charge >= 100 && player.specialCd <= 0) {
    shockBurst();
    keys.delete("special");
  }
}

function punch() {
  player.attackCd = 0.22;
  player.combo = (player.combo % 3) + 1;
  const range = player.combo === 3 ? 92 : 70;
  const damage = player.combo === 3 ? 20 : 12;
  const hitX = player.x + player.facing * 46;
  enemies.forEach((enemy) => {
    if (enemy.dead) return;
    const close = Math.abs(enemy.x - hitX) < range && Math.abs(enemy.y - player.y) < 58 && Math.abs(enemy.z - player.z) < 60;
    if (close) hitEnemy(enemy, damage, player.facing * (player.combo === 3 ? 150 : 80));
  });
  burst(hitX, player.y - player.z - 34, "#54ffa3", player.combo === 3 ? 12 : 7);
}

function shockBurst() {
  player.charge = 0;
  player.specialCd = 1.5;
  enemies.forEach((enemy) => {
    if (Math.hypot(enemy.x - player.x, enemy.y - player.y) < 190) hitEnemy(enemy, 42, Math.sign(enemy.x - player.x || 1) * 210);
  });
  burst(player.x, player.y - player.z - 20, "#ffd166", 42);
}

function updateEnemies(dt) {
  enemies.forEach((enemy) => {
    if (enemy.dead) return;
    enemy.hitCd = Math.max(0, enemy.hitCd - dt);
    enemy.attackCd = Math.max(0, enemy.attackCd - dt);
    enemy.x += enemy.vx * dt;
    enemy.vx *= 0.86;
    enemy.z += enemy.vz * dt;
    enemy.vz -= 820 * dt;
    if (enemy.z <= 0) {
      enemy.z = 0;
      enemy.vz = 0;
    }
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (enemy.hitCd <= 0) {
      if (dist > enemy.range) {
        enemy.x += (dx / dist) * enemy.speed * dt;
        enemy.y += (dy / dist) * enemy.speed * 0.45 * dt;
      } else if (enemy.attackCd <= 0 && player.invuln <= 0) {
        damagePlayer(enemy.damage);
        enemy.attackCd = enemy.cooldown;
        burst(player.x, player.y - player.z - 36, "#ff4d6d", 10);
      }
    }
  });
  enemies = enemies.filter((enemy) => !enemy.dead || enemy.fade > 0);
  enemies.forEach((enemy) => {
    if (enemy.dead) enemy.fade -= dt;
  });
}

function hitEnemy(enemy, damage, knockback) {
  enemy.hp -= damage;
  enemy.vx = knockback;
  enemy.vz = 160;
  enemy.hitCd = 0.22;
  player.charge = Math.min(100, player.charge + 8);
  score += damage * 4;
  burst(enemy.x, enemy.y - enemy.z - 40, currentStage().color, 12);
  if (enemy.hp <= 0) {
    enemy.dead = true;
    enemy.fade = 0.45;
    score += enemy.kind === "boss" ? 1200 : 180;
    player.charge = Math.min(100, player.charge + 14);
  }
}

function damagePlayer(amount) {
  player.hp -= amount;
  player.invuln = 0.65;
  if (player.hp <= 0) {
    running = false;
    showOverlay("Patrol Down", "Restart and clear the city route.", "Restart");
  }
}

function spawnWave() {
  const stage = currentStage();
  const list = stage.waves[waveIndex] || ["guard"];
  enemies = list.map((type, index) => makeEnemy(type, W + 80 + index * 70, floorY - 40 + (index % 3) * 32));
  if (waveIndex >= stage.waves.length) enemies = [makeEnemy("boss", W - 160, floorY)];
  messageTimer = 1.8;
}

function makeEnemy(type, x, y) {
  const data = {
    runner: { hp: 34, speed: 105, range: 44, damage: 8, cooldown: 0.9, color: "#ff4d6d", w: 38, h: 68 },
    guard: { hp: 56, speed: 75, range: 50, damage: 12, cooldown: 1.15, color: "#ffd166", w: 46, h: 76 },
    drone: { hp: 28, speed: 120, range: 72, damage: 7, cooldown: 0.7, color: "#a977ff", w: 42, h: 42 },
    boss: { hp: 180 + stageIndex * 55, speed: 62, range: 66, damage: 18 + stageIndex * 2, cooldown: 1, color: currentStage().color, w: 78, h: 98 },
  }[type];
  return { kind: type, x, y, z: type === "drone" ? 60 : 0, vx: 0, vz: 0, hitCd: 0, attackCd: 0.6, fade: 1, dead: false, ...data };
}

function checkWaveClear() {
  if (enemies.some((enemy) => !enemy.dead)) return;
  if (waveIndex < currentStage().waves.length) {
    waveIndex += 1;
    spawnWave();
    return;
  }
  if (stageIndex < stages.length - 1) {
    stageIndex += 1;
    waveIndex = 0;
    player.hp = Math.min(120, player.hp + 28);
    player.x = 120;
    player.y = floorY;
    spawnWave();
    return;
  }
  running = false;
  showOverlay("City Secured", "All five zones are clear. Restart for a cleaner score run.", "Restart");
}

function updateParticles(dt) {
  particles.forEach((p) => {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
  });
  particles = particles.filter((p) => p.life > 0);
}

function draw() {
  drawBackdrop();
  drawCharacters();
  drawParticles();
  drawMessage();
}

function drawBackdrop() {
  const stage = currentStage();
  const gradient = ctx.createLinearGradient(0, 0, 0, H);
  gradient.addColorStop(0, "#07111f");
  gradient.addColorStop(0.55, "#0b1628");
  gradient.addColorStop(1, "#090a11");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = hexToRgba(stage.color, 0.18);
  ctx.lineWidth = 2;
  for (let x = 0; x < W; x += 80) {
    ctx.beginPath();
    ctx.moveTo(x, 80);
    ctx.lineTo(x + 120, 220);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(3, 8, 16, 0.84)";
  ctx.fillRect(0, floorY + 70, W, H - floorY);
  ctx.strokeStyle = stage.color;
  ctx.globalAlpha = 0.45;
  ctx.beginPath();
  ctx.moveTo(0, floorY + 70);
  ctx.lineTo(W, floorY + 70);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = hexToRgba(stage.color, 0.12);
  ctx.fillRect(0, 120, W, 84);
  ctx.fillStyle = "#effbff";
  ctx.font = "900 24px system-ui";
  ctx.fillText(stage.name, 30, 70);
}

function drawCharacters() {
  const actors = [player, ...enemies].sort((a, b) => a.y - b.y);
  actors.forEach((actor) => {
    if (actor.dead && actor.fade <= 0) return;
    ctx.save();
    ctx.globalAlpha = actor.dead ? Math.max(0, actor.fade / 0.45) : 1;
    if (actor === player) drawPlayer();
    else drawEnemy(actor);
    ctx.restore();
  });
}

function drawPlayer() {
  const x = player.x;
  const y = player.y - player.z;
  ctx.fillStyle = player.invuln > 0 ? "#ffffff" : "#35dfff";
  ctx.shadowColor = "#35dfff";
  ctx.shadowBlur = 18;
  roundedRect(x - 22, y - 82, 44, 82, 12);
  ctx.fill();
  ctx.fillStyle = "#07101d";
  ctx.fillRect(x - 10, y - 58, 20, 25);
  ctx.fillStyle = "#54ffa3";
  ctx.fillRect(x + player.facing * 18 - 8, y - 48, 16, 42);
  ctx.shadowBlur = 0;
}

function drawEnemy(enemy) {
  const x = enemy.x;
  const y = enemy.y - enemy.z;
  ctx.fillStyle = enemy.color;
  ctx.shadowColor = enemy.color;
  ctx.shadowBlur = 14;
  if (enemy.kind === "drone") {
    ctx.beginPath();
    ctx.arc(x, y - 42, enemy.w / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    roundedRect(x - enemy.w / 2, y - enemy.h, enemy.w, enemy.h, enemy.kind === "boss" ? 16 : 10);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fillRect(x - enemy.w / 2, y - enemy.h - 12, enemy.w, 5);
  ctx.fillStyle = "#54ffa3";
  ctx.fillRect(x - enemy.w / 2, y - enemy.h - 12, enemy.w * Math.max(0, enemy.hp) / (enemy.kind === "boss" ? 180 + stageIndex * 55 : enemy.kind === "guard" ? 56 : enemy.kind === "runner" ? 34 : 28), 5);
}

function drawParticles() {
  particles.forEach((p) => {
    ctx.globalAlpha = Math.max(0, p.life * 2);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

function drawMessage() {
  if (messageTimer <= 0) return;
  const stage = currentStage();
  ctx.fillStyle = "rgba(3, 8, 16, 0.72)";
  roundedRect(W / 2 - 220, 96, 440, 66, 8);
  ctx.fill();
  ctx.fillStyle = stage.color;
  ctx.font = "900 24px system-ui";
  const label = waveIndex >= stage.waves.length ? `${stage.boss}` : `${stage.name} · Wave ${waveIndex + 1}`;
  ctx.fillText(label, W / 2 - ctx.measureText(label).width / 2, 137);
}

function burst(x, y, color, count) {
  for (let i = 0; i < count; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const speed = 60 + Math.random() * 180;
    particles.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, color, life: 0.25 + Math.random() * 0.4 });
  }
}

function updateHud() {
  stageEl.textContent = `${stageIndex + 1} / 5`;
  hpEl.textContent = Math.max(0, Math.round(player.hp));
  chargeEl.textContent = Math.round(player.charge);
  scoreEl.textContent = score;
}

function showOverlay(title, text, button) {
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  startBtn.textContent = button;
  overlay.classList.add("is-visible");
}

function currentStage() {
  return stages[stageIndex];
}

function roundedRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function hexToRgba(hex, alpha) {
  const value = hex.replace("#", "");
  return `rgba(${parseInt(value.slice(0, 2), 16)}, ${parseInt(value.slice(2, 4), 16)}, ${parseInt(value.slice(4, 6), 16)}, ${alpha})`;
}

const keyMap = {
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
  ArrowUp: "up",
  KeyW: "up",
  ArrowDown: "down",
  KeyS: "down",
  KeyJ: "attack",
  KeyK: "jump",
  KeyL: "dash",
  KeyI: "special",
};

document.addEventListener("keydown", (event) => {
  const key = keyMap[event.code];
  if (!key) return;
  event.preventDefault();
  keys.add(key);
});

document.addEventListener("keyup", (event) => {
  const key = keyMap[event.code];
  if (key) keys.delete(key);
});

touchButtons.forEach((button) => {
  const key = button.dataset.key;
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    keys.add(key);
  });
  button.addEventListener("pointerup", () => keys.delete(key));
  button.addEventListener("pointerleave", () => keys.delete(key));
  button.addEventListener("pointercancel", () => keys.delete(key));
});

startBtn.addEventListener("click", () => {
  if (!running && player.hp <= 0) resetGame();
  if (!running && stageIndex === stages.length - 1 && enemies.every((enemy) => enemy.dead)) resetGame();
  startGame();
});

resetGame();
