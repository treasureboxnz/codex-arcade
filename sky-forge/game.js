const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");

const scoreEl = document.querySelector("#score");
const bestEl = document.querySelector("#best");
const livesEl = document.querySelector("#lives");
const weaponEl = document.querySelector("#weapon");
const weaponLabelEl = document.querySelector("#weaponLabel");
const overlay = document.querySelector("#overlay");
const startBtn = document.querySelector("#startBtn");
const pauseBtn = document.querySelector("#pauseBtn");
const restartBtn = document.querySelector("#restartBtn");
const bossPanel = document.querySelector("#bossPanel");
const bossMeter = document.querySelector("#bossMeter");
const touchButtons = document.querySelectorAll(".touch-pad button");

const W = canvas.width;
const H = canvas.height;
const bestKey = "sky-forge-best";
const keys = new Set();

let player;
let bullets;
let enemyBullets;
let enemies;
let particles;
let powerups;
let stars;
let score;
let best = Number(localStorage.getItem(bestKey) || 0);
let lives;
let weapon;
let weaponLevel;
let weaponTimer;
let fireCooldown;
let enemyTimer;
let powerTimer;
let boss;
let bossSpawned;
let loopLevel;
let stageIndex;
let nextBossAt;
let running;
let paused;
let gameOver;
let awaitingContinue;
let lastTime;
let distance;
let animationId;

const weaponNames = {
  pulse: "Pulse",
  spread: "Spread",
  beam: "Beam",
  burst: "Burst",
  homing: "Homing",
  lance: "Lance",
};

const stages = [
  {
    name: "Nebula Gate",
    boss: "Overseer",
    colors: ["#07112a", "#081828", "#040813"],
    accent: "#45e8ff",
    enemyBias: { wing: 0.18, turret: 0.42 },
    spawn: 0,
    bossHp: 1,
  },
  {
    name: "Crimson Rift",
    boss: "Rift Warden",
    colors: ["#1a0712", "#210a1d", "#080510"],
    accent: "#ff4d6d",
    enemyBias: { wing: 0.34, turret: 0.52 },
    spawn: 0.08,
    bossHp: 1.18,
  },
  {
    name: "Ion Foundry",
    boss: "Forge Titan",
    colors: ["#101006", "#1d1a08", "#080806"],
    accent: "#ffd166",
    enemyBias: { wing: 0.2, turret: 0.68 },
    spawn: 0.12,
    bossHp: 1.35,
  },
  {
    name: "Eclipse Core",
    boss: "Eclipse Prime",
    colors: ["#07071a", "#120b24", "#04050d"],
    accent: "#a977ff",
    enemyBias: { wing: 0.44, turret: 0.7 },
    spawn: 0.18,
    bossHp: 1.55,
  },
];

function resetGame() {
  player = { x: W / 2, y: H - 120, w: 54, h: 70, invincible: 0 };
  bullets = [];
  enemyBullets = [];
  enemies = [];
  particles = [];
  powerups = [];
  stars = makeStars();
  score = 0;
  lives = 3;
  weapon = "pulse";
  weaponLevel = 1;
  weaponTimer = 0;
  fireCooldown = 0;
  enemyTimer = 0;
  powerTimer = 2.2;
  boss = null;
  bossSpawned = false;
  loopLevel = 1;
  stageIndex = 0;
  nextBossAt = 55;
  running = false;
  paused = false;
  gameOver = false;
  awaitingContinue = false;
  lastTime = 0;
  distance = 0;
  updateHud();
  draw(0);
  showOverlay("Launch Ready", "Collect weapon cores: spread, beam, burst, homing, and lance.", "Start Mission");
}

function startGame() {
  if (awaitingContinue) {
    continueGame();
    return;
  }
  if (gameOver) resetGame();
  if (running) return;
  running = true;
  paused = false;
  overlay.classList.remove("is-visible");
  lastTime = performance.now();
  animationId = requestAnimationFrame(loop);
}

function togglePause() {
  if (!running || gameOver) return;
  paused = !paused;
  if (paused) {
    showOverlay("Paused", "Take a breath, then return to the storm.", "Resume");
  } else {
    overlay.classList.remove("is-visible");
    lastTime = performance.now();
    animationId = requestAnimationFrame(loop);
  }
}

function loop(now) {
  if (!running || paused) return;
  const dt = Math.min((now - lastTime) / 1000, 0.033);
  lastTime = now;
  update(dt);
  draw(dt);
  animationId = requestAnimationFrame(loop);
}

function update(dt) {
  distance += dt;
  updatePlayer(dt);
  updateStars(dt);
  updateBullets(dt);
  updateEnemies(dt);
  updatePowerups(dt);
  updateParticles(dt);
  spawnWaves(dt);
  checkCollisions();
  updateHud();
}

function updatePlayer(dt) {
  const speed = 360;
  let dx = 0;
  let dy = 0;
  if (keys.has("ArrowLeft") || keys.has("KeyA")) dx -= 1;
  if (keys.has("ArrowRight") || keys.has("KeyD")) dx += 1;
  if (keys.has("ArrowUp") || keys.has("KeyW")) dy -= 1;
  if (keys.has("ArrowDown") || keys.has("KeyS")) dy += 1;
  const mag = Math.hypot(dx, dy) || 1;
  player.x = clamp(player.x + (dx / mag) * speed * dt, 32, W - 32);
  player.y = clamp(player.y + (dy / mag) * speed * dt, 58, H - 42);
  player.invincible = Math.max(0, player.invincible - dt);

  fireCooldown -= dt;
  if (keys.has("Space") || keys.has("KeyJ") || keys.has("KeyK")) fire();
  if (weaponTimer > 0) {
    weaponTimer -= dt;
    if (weaponTimer <= 0) {
      weapon = "pulse";
      weaponLevel = 1;
    }
  }
}

function fire() {
  if (fireCooldown > 0) return;
  if (weapon === "spread") {
    const angles = weaponLevel >= 3 ? [-260, -130, 0, 130, 260] : weaponLevel >= 2 ? [-190, -65, 65, 190] : [-160, 0, 160];
    angles.forEach((vx, index) => addBullet(player.x + (index - (angles.length - 1) / 2) * 8, player.y - 36, vx === 0 ? -560 : -440, vx, 9, "#45e8ff", 1 + weaponLevel * 0.18));
    fireCooldown = weaponLevel >= 3 ? 0.12 : 0.16;
  } else if (weapon === "beam") {
    addBullet(player.x - 12, player.y - 40, -760, 0, 7, "#a977ff", 2 + weaponLevel * 0.42, weaponLevel >= 3 ? "pierce" : "normal");
    addBullet(player.x + 12, player.y - 40, -760, 0, 7, "#a977ff", 2 + weaponLevel * 0.42, weaponLevel >= 3 ? "pierce" : "normal");
    if (weaponLevel >= 2) addBullet(player.x, player.y - 52, -820, 0, 8, "#d8c4ff", 1.8, weaponLevel >= 3 ? "pierce" : "normal");
    fireCooldown = weaponLevel >= 3 ? 0.06 : 0.08;
  } else if (weapon === "burst") {
    const width = weaponLevel >= 3 ? 3 : 2;
    for (let i = -width; i <= width; i += 1) addBullet(player.x + i * 10, player.y - 35, -620, i * (weaponLevel >= 3 ? 70 : 58), 8 + weaponLevel, "#ffd166", 1.25 + weaponLevel * 0.35);
    fireCooldown = weaponLevel >= 3 ? 0.18 : 0.22;
  } else if (weapon === "homing") {
    const count = weaponLevel + 1;
    for (let i = 0; i < count; i += 1) {
      const offset = (i - (count - 1) / 2) * 18;
      addBullet(player.x + offset, player.y - 34, -430, offset * 3, 8, "#ff7ad9", 1.05 + weaponLevel * 0.24, "homing");
    }
    fireCooldown = weaponLevel >= 3 ? 0.15 : 0.2;
  } else if (weapon === "lance") {
    addBullet(player.x, player.y - 48, -900, 0, 13 + weaponLevel * 2, "#ffffff", 3.4 + weaponLevel * 1.1, "pierce");
    addBullet(player.x, player.y - 24, -650, 0, 7, "#45e8ff", 1.4 + weaponLevel * 0.45, "pierce");
    if (weaponLevel >= 2) {
      addBullet(player.x - 24, player.y - 32, -780, -28, 9, "#ffffff", 2.4, "pierce");
      addBullet(player.x + 24, player.y - 32, -780, 28, 9, "#ffffff", 2.4, "pierce");
    }
    fireCooldown = weaponLevel >= 3 ? 0.2 : 0.26;
  } else {
    addBullet(player.x, player.y - 40, -560, 0, 8, "#54ffa3", 1);
    fireCooldown = 0.13;
  }
}

function addBullet(x, y, vy, vx, r, color, damage, kind = "normal") {
  bullets.push({ x, y, vx, vy, r, color, damage, kind });
}

function updateBullets(dt) {
  bullets.forEach((b) => {
    if (b.kind === "homing") {
      const target = nearestEnemy(b);
      if (target) {
        const desired = Math.atan2(target.y - b.y, target.x - b.x);
        b.vx += Math.cos(desired) * 680 * dt;
        b.vy += Math.sin(desired) * 680 * dt;
        const speed = Math.hypot(b.vx, b.vy) || 1;
        b.vx = (b.vx / speed) * 520;
        b.vy = (b.vy / speed) * 520;
      }
    }
    b.x += b.vx * dt;
    b.y += b.vy * dt;
  });
  enemyBullets.forEach((b) => {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
  });
  bullets = bullets.filter((b) => b.y > -40 && b.x > -60 && b.x < W + 60);
  enemyBullets = enemyBullets.filter((b) => b.y < H + 60 && b.x > -60 && b.x < W + 60);
}

function spawnWaves(dt) {
  const stage = currentStage();
  enemyTimer -= dt;
  powerTimer -= dt;
  if (enemyTimer <= 0 && !boss) {
    const roll = Math.random();
    const type = roll < stage.enemyBias.wing ? "wing" : roll < stage.enemyBias.turret ? "turret" : "drone";
    spawnEnemy(type);
    enemyTimer = Math.max(0.2, 0.9 - distance * 0.008 - loopLevel * 0.055 - stage.spawn);
  }
  if (powerTimer <= 0) {
    spawnPowerup();
    powerTimer = 4 + Math.random() * 3;
  }
  if (distance > nextBossAt && !bossSpawned) spawnBoss();
}

function spawnEnemy(type) {
  const x = 48 + Math.random() * (W - 96);
  const stats = {
    drone: { hp: 2, speed: 120, score: 80 },
    wing: { hp: 1, speed: 180, score: 60 },
    turret: { hp: 4, speed: 78, score: 150 },
  }[type];
  enemies.push({
    type,
    x,
    y: -50,
    w: 52,
    h: 42,
    shoot: Math.max(0.62, 1.4 + Math.random() - loopLevel * 0.08),
    phase: Math.random() * 8,
    ...stats,
    hp: stats.hp + Math.floor((loopLevel - 1) * 0.65),
    speed: stats.speed + loopLevel * 8,
    score: stats.score + (loopLevel - 1) * 18,
  });
}

function spawnBoss() {
  const stage = currentStage();
  bossSpawned = true;
  const hp = Math.round((110 + (loopLevel - 1) * 55) * stage.bossHp);
  boss = { type: "boss", x: W / 2, y: -105, w: 210, h: 120, hp, maxHp: hp, shoot: 0.4, phase: 0, score: 2000 + (loopLevel - 1) * 600 };
  enemies.push(boss);
  bossPanel.classList.add("is-visible");
}

function updateEnemies(dt) {
  enemies.forEach((e) => {
    e.phase += dt;
    if (e.type === "boss") {
      e.y = Math.min(116, e.y + 70 * dt);
      e.x = W / 2 + Math.sin(e.phase * 1.4) * 120;
      e.shoot -= dt;
      if (e.shoot <= 0) {
        for (let i = -2; i <= 2; i += 1) enemyBullets.push({ x: e.x, y: e.y + 55, vx: i * 70, vy: 250, r: 8, color: "#ff4d6d" });
        e.shoot = Math.max(0.26, 0.48 - loopLevel * 0.025);
      }
      bossMeter.value = Math.max(0, e.hp / e.maxHp);
      return;
    }
    e.y += e.speed * dt;
    if (e.type === "wing") e.x += Math.sin(e.phase * 6) * 115 * dt;
    if (e.type === "turret") {
      e.shoot -= dt;
      if (e.shoot <= 0) {
        enemyBullets.push({ x: e.x, y: e.y + 22, vx: 0, vy: 260, r: 7, color: "#ff4d6d" });
        e.shoot = 1.25;
      }
    }
  });
  enemies = enemies.filter((e) => e.y < H + 80 && e.hp > 0);
  if (boss && boss.hp <= 0) winGame();
}

function spawnPowerup() {
  const modes = ["spread", "beam", "burst", "homing", "lance"];
  powerups.push({ x: 50 + Math.random() * (W - 100), y: -30, r: 17, type: modes[Math.floor(Math.random() * modes.length)], vy: 92 });
}

function updatePowerups(dt) {
  powerups.forEach((p) => {
    p.y += p.vy * dt;
    p.x += Math.sin((p.y + p.r) * 0.02) * 34 * dt;
  });
  powerups = powerups.filter((p) => p.y < H + 40);
}

function checkCollisions() {
  enemies.forEach((enemy) => {
    bullets.forEach((bullet) => {
      if (!bullet.dead && rectCircle(enemy, bullet)) {
        if (bullet.kind !== "pierce") bullet.dead = true;
        enemy.hp -= bullet.damage;
        burst(bullet.x, bullet.y, bullet.color, 4);
        if (enemy.hp <= 0) {
          score += enemy.score;
          burst(enemy.x, enemy.y, "#ffd166", enemy.type === "boss" ? 40 : 16);
        }
      }
    });
    if (player.invincible <= 0 && rectsOverlap(player, enemy)) damagePlayer();
  });
  bullets = bullets.filter((b) => !b.dead);

  enemyBullets.forEach((b) => {
    if (!b.dead && player.invincible <= 0 && circleRect(b, player)) {
      b.dead = true;
      damagePlayer();
    }
  });
  enemyBullets = enemyBullets.filter((b) => !b.dead);

  powerups.forEach((p) => {
    if (!p.dead && circleRect(p, player)) {
      p.dead = true;
      collectWeapon(p.type);
      score += 120;
      burst(p.x, p.y, colorForWeapon(p.type), 18);
    }
  });
  powerups = powerups.filter((p) => !p.dead);
}

function damagePlayer() {
  lives -= 1;
  player.invincible = 1.8;
  burst(player.x, player.y, "#45e8ff", 24);
  if (lives <= 0) offerContinue();
}

function winGame() {
  score += 3000 + loopLevel * 500 + stageIndex * 350;
  stageIndex = (stageIndex + 1) % stages.length;
  if (stageIndex === 0) loopLevel += 1;
  nextBossAt = distance + 45;
  bossSpawned = false;
  boss = null;
  enemyBullets = [];
  enemies = enemies.filter((enemy) => enemy.type !== "boss");
  powerTimer = Math.min(powerTimer, 1.5);
  burst(W / 2, 120, "#ffd166", 46);
  updateHud();
}

function offerContinue() {
  awaitingContinue = true;
  running = false;
  cancelAnimationFrame(animationId);
  best = Math.max(best, score);
  localStorage.setItem(bestKey, String(best));
  keys.clear();
  updateHud();
  showOverlay("Continue?", "Refit instantly and keep your score, weapon, and mission progress.", "Continue");
}

function continueGame() {
  awaitingContinue = false;
  gameOver = false;
  running = true;
  paused = false;
  lives = 3;
  player.x = W / 2;
  player.y = H - 120;
  player.invincible = 2.6;
  enemyBullets = [];
  bullets = [];
  powerups = [];
  burst(player.x, player.y, "#54ffa3", 28);
  overlay.classList.remove("is-visible");
  updateHud();
  lastTime = performance.now();
  animationId = requestAnimationFrame(loop);
}

function finish(title, message) {
  gameOver = true;
  running = false;
  cancelAnimationFrame(animationId);
  best = Math.max(best, score);
  localStorage.setItem(bestKey, String(best));
  updateHud();
  showOverlay(title, message, "Restart");
}

function updateStars(dt) {
  stars.forEach((s) => {
    s.y += s.speed * dt;
    if (s.y > H) {
      s.y = -5;
      s.x = Math.random() * W;
    }
  });
}

function updateParticles(dt) {
  particles.forEach((p) => {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
  });
  particles = particles.filter((p) => p.life > 0);
}

function burst(x, y, color, count) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 60 + Math.random() * 180;
    particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, color, life: 0.28 + Math.random() * 0.4 });
  }
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  drawSpace();
  drawPowerups();
  drawBullets();
  drawEnemies();
  drawPlayer();
  drawParticles();
}

function drawSpace() {
  const stage = currentStage();
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, stage.colors[0]);
  sky.addColorStop(0.52, stage.colors[1]);
  sky.addColorStop(1, stage.colors[2]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  stars.forEach((s) => {
    ctx.fillStyle = s.color;
    ctx.globalAlpha = s.alpha;
    ctx.fillRect(s.x, s.y, s.size, s.size * 2.4);
  });
  ctx.globalAlpha = 1;
  for (let y = (distance * 80) % 80; y < H; y += 80) {
    ctx.strokeStyle = hexToRgba(stage.accent, 0.06);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
}

function drawPlayer() {
  const flicker = player.invincible > 0 && Math.floor(player.invincible * 18) % 2 === 0;
  if (flicker) ctx.globalAlpha = 0.45;
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.fillStyle = "#45e8ff";
  ctx.shadowColor = "#45e8ff";
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.moveTo(0, -44);
  ctx.lineTo(27, 24);
  ctx.lineTo(9, 18);
  ctx.lineTo(0, 38);
  ctx.lineTo(-9, 18);
  ctx.lineTo(-27, 24);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#e9fbff";
  ctx.fillRect(-7, -18, 14, 24);
  ctx.fillStyle = "#54ffa3";
  ctx.fillRect(-10, 36, 20, 12);
  ctx.restore();
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

function drawEnemies() {
  enemies.forEach((e) => {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.shadowBlur = 14;
    ctx.shadowColor = e.type === "boss" ? "#ff4d6d" : "#a977ff";
    ctx.fillStyle = e.type === "boss" ? "#92304a" : e.type === "turret" ? "#a977ff" : "#ff4d6d";
    if (e.type === "boss") {
      roundedRect(-e.w / 2, -e.h / 2, e.w, e.h, 18);
      ctx.fill();
      ctx.fillStyle = "#ffd166";
      ctx.fillRect(-74, 8, 148, 14);
    } else {
      ctx.beginPath();
      ctx.moveTo(0, 28);
      ctx.lineTo(e.w / 2, -14);
      ctx.lineTo(0, -28);
      ctx.lineTo(-e.w / 2, -14);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#07112a";
      ctx.fillRect(-8, -10, 16, 20);
    }
    ctx.restore();
    ctx.shadowBlur = 0;
  });
}

function drawBullets() {
  bullets.forEach((b) => drawOrb(b.x, b.y, b.r, b.color));
  enemyBullets.forEach((b) => drawOrb(b.x, b.y, b.r, b.color));
}

function drawPowerups() {
  powerups.forEach((p) => {
    drawOrb(p.x, p.y, p.r, colorForWeapon(p.type));
    ctx.strokeStyle = "#e9fbff";
    ctx.strokeRect(p.x - 11, p.y - 11, 22, 22);
  });
}

function drawParticles() {
  particles.forEach((p) => {
    ctx.globalAlpha = Math.max(0, p.life * 2);
    drawOrb(p.x, p.y, 3, p.color);
  });
  ctx.globalAlpha = 1;
}

function drawOrb(x, y, r, color) {
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function makeStars() {
  return Array.from({ length: 110 }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    speed: 55 + Math.random() * 220,
    size: 1 + Math.random() * 2,
    alpha: 0.22 + Math.random() * 0.7,
    color: Math.random() > 0.75 ? "#45e8ff" : "#e9fbff",
  }));
}

function updateHud() {
  scoreEl.textContent = score;
  bestEl.textContent = Math.max(best, score);
  livesEl.textContent = lives;
  weaponLabelEl.textContent = `Stage ${stageIndex + 1}`;
  weaponEl.textContent = weapon === "pulse" ? weaponNames[weapon] : `${weaponNames[weapon]} L${weaponLevel}`;
  bossPanel.classList.toggle("is-visible", Boolean(boss && boss.hp > 0));
  bossPanel.querySelector("span").textContent = `${currentStage().boss} ${loopLevel}`;
}

function showOverlay(title, message, button) {
  overlay.classList.add("is-visible");
  overlay.querySelector("strong").textContent = title;
  overlay.querySelector("span").textContent = message;
  startBtn.textContent = button;
}

function colorForWeapon(type) {
  return { spread: "#45e8ff", beam: "#a977ff", burst: "#ffd166", homing: "#ff7ad9", lance: "#ffffff" }[type] || "#54ffa3";
}

function nearestEnemy(point) {
  let bestTarget = null;
  let bestDistance = Infinity;
  enemies.forEach((enemy) => {
    if (enemy.hp <= 0) return;
    const distanceToEnemy = Math.hypot(enemy.x - point.x, enemy.y - point.y);
    if (distanceToEnemy < bestDistance) {
      bestDistance = distanceToEnemy;
      bestTarget = enemy;
    }
  });
  return bestTarget;
}

function collectWeapon(type) {
  if (weapon === type) {
    weaponLevel = Math.min(3, weaponLevel + 1);
    weaponTimer = Math.min(22, weaponTimer + 8);
  } else {
    weapon = type;
    weaponLevel = 1;
    weaponTimer = 16;
  }
}

function currentStage() {
  return stages[stageIndex];
}

function hexToRgba(hex, alpha) {
  const value = hex.replace("#", "");
  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function rectsOverlap(a, b) {
  return Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.y - b.y) < (a.h + b.h) / 2;
}

function circleRect(circle, rect) {
  const cx = clamp(circle.x, rect.x - rect.w / 2, rect.x + rect.w / 2);
  const cy = clamp(circle.y, rect.y - rect.h / 2, rect.y + rect.h / 2);
  return Math.hypot(circle.x - cx, circle.y - cy) < circle.r;
}

function rectCircle(rect, circle) {
  return circleRect(circle, rect);
}

function roundedRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

document.addEventListener("keydown", (event) => {
  const allowed = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "KeyW", "KeyA", "KeyS", "KeyD", "KeyJ", "KeyK"];
  if (!allowed.includes(event.code)) return;
  event.preventDefault();
  keys.add(event.code);
  if (!running && !paused && !gameOver) startGame();
});

document.addEventListener("keyup", (event) => keys.delete(event.code));

touchButtons.forEach((button) => {
  const code = button.dataset.key;
  const hold = (event) => {
    event.preventDefault();
    keys.add(code);
    if (!running && !paused && !gameOver) startGame();
  };
  const release = () => keys.delete(code);
  button.addEventListener("pointerdown", hold);
  button.addEventListener("pointerup", release);
  button.addEventListener("pointerleave", release);
  button.addEventListener("pointercancel", release);
});

startBtn.addEventListener("click", () => {
  if (paused) togglePause();
  else if (awaitingContinue) continueGame();
  else startGame();
});
pauseBtn.addEventListener("click", togglePause);
restartBtn.addEventListener("click", () => {
  cancelAnimationFrame(animationId);
  keys.clear();
  resetGame();
});

resetGame();
