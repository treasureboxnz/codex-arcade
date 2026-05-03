const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const ui = {
  score: document.getElementById("score"),
  time: document.getElementById("time"),
  gate: document.getElementById("gate"),
  best: document.getElementById("best"),
  driftLabel: document.getElementById("driftLabel"),
  driftMeter: document.getElementById("driftMeter"),
  nearMiss: document.getElementById("nearMiss"),
  speed: document.getElementById("speed"),
  overlay: document.getElementById("overlay"),
  overlayTitle: document.getElementById("overlayTitle"),
  overlayText: document.getElementById("overlayText"),
  startBtn: document.getElementById("startBtn"),
  pauseBtn: document.getElementById("pauseBtn"),
  restartBtn: document.getElementById("restartBtn"),
};

const W = canvas.width;
const H = canvas.height;
const track = {
  outer: { x: 44, y: 44, w: 872, h: 552, r: 92 },
  inner: { x: 290, y: 178, w: 380, h: 284, r: 76 },
};

const gates = [
  { x1: 468, y1: 472, x2: 468, y2: 590 },
  { x1: 704, y1: 438, x2: 790, y2: 520 },
  { x1: 850, y1: 288, x2: 912, y2: 288 },
  { x1: 730, y1: 84, x2: 806, y2: 158 },
  { x1: 494, y1: 48, x2: 494, y2: 166 },
  { x1: 192, y1: 92, x2: 250, y2: 194 },
  { x1: 54, y1: 310, x2: 172, y2: 310 },
  { x1: 184, y1: 506, x2: 252, y2: 414 },
  { x1: 402, y1: 462, x2: 402, y2: 356 },
  { x1: 608, y1: 462, x2: 608, y2: 356 },
  { x1: 676, y1: 314, x2: 792, y2: 314 },
  { x1: 480, y1: 174, x2: 480, y2: 284 },
];

const keys = new Set();
const particles = [];
const skidMarks = [];
let lastTime = 0;
let animationId = 0;
let best = Number(localStorage.getItem("driftLogicBest") || 0);

let state;

function resetState() {
  state = {
    running: false,
    paused: false,
    ended: false,
    score: 0,
    nearMisses: 0,
    timeLeft: 75,
    gateIndex: 0,
    driftChain: 0,
    driftHeat: 0,
    hitFlash: 0,
    car: {
      x: 462,
      y: 536,
      angle: -Math.PI / 2,
      vx: 0,
      vy: 0,
      radius: 12,
    },
  };
  particles.length = 0;
  skidMarks.length = 0;
  ui.pauseBtn.textContent = "Pause";
  updateHud();
}

function roundedRectDistance(x, y, rect) {
  const cx = clamp(x, rect.x + rect.r, rect.x + rect.w - rect.r);
  const cy = clamp(y, rect.y + rect.r, rect.y + rect.h - rect.r);
  const inCore = (
    (x >= rect.x + rect.r && x <= rect.x + rect.w - rect.r && y >= rect.y && y <= rect.y + rect.h) ||
    (y >= rect.y + rect.r && y <= rect.y + rect.h - rect.r && x >= rect.x && x <= rect.x + rect.w)
  );

  if (inCore) {
    const edgeX = Math.min(Math.abs(x - rect.x), Math.abs(x - (rect.x + rect.w)));
    const edgeY = Math.min(Math.abs(y - rect.y), Math.abs(y - (rect.y + rect.h)));
    return -Math.min(edgeX, edgeY);
  }

  return Math.hypot(x - cx, y - cy) - rect.r;
}

function onTrack(x, y, radius = 0) {
  return roundedRectDistance(x, y, track.outer) <= -radius && roundedRectDistance(x, y, track.inner) >= radius;
}

function wallGap(x, y) {
  return Math.min(Math.abs(roundedRectDistance(x, y, track.outer)), Math.abs(roundedRectDistance(x, y, track.inner)));
}

function startRun() {
  resetState();
  state.running = true;
  state.ended = false;
  ui.overlay.classList.remove("is-visible");
  ui.startBtn.textContent = "Resume";
}

function endRun(title, text) {
  state.running = false;
  state.ended = true;
  best = Math.max(best, Math.floor(state.score));
  localStorage.setItem("driftLogicBest", String(best));
  ui.overlayTitle.textContent = title;
  ui.overlayText.textContent = text;
  ui.startBtn.textContent = "Run Again";
  ui.overlay.classList.add("is-visible");
  updateHud();
}

function togglePause() {
  if (!state.running || state.ended) return;
  state.paused = !state.paused;
  ui.pauseBtn.textContent = state.paused ? "Resume" : "Pause";
  ui.overlayTitle.textContent = "Paused";
  ui.overlayText.textContent = "Take a breath, then return to the racing line.";
  ui.startBtn.textContent = "Resume";
  ui.overlay.classList.toggle("is-visible", state.paused);
}

function update(dt) {
  if (!state.running || state.paused || state.ended) return;

  const car = state.car;
  const accelerating = keys.has("ArrowUp") || keys.has("KeyW");
  const braking = keys.has("ArrowDown") || keys.has("KeyS");
  const left = keys.has("ArrowLeft") || keys.has("KeyA");
  const right = keys.has("ArrowRight") || keys.has("KeyD");
  const speed = Math.hypot(car.vx, car.vy);
  const steerPower = 2.55 * (0.34 + Math.min(speed / 5.6, 1));

  if (left) car.angle -= steerPower * dt;
  if (right) car.angle += steerPower * dt;

  const thrust = accelerating ? 285 : 0;
  const brake = braking ? 225 : 0;
  car.vx += Math.cos(car.angle) * thrust * dt;
  car.vy += Math.sin(car.angle) * thrust * dt;
  car.vx -= Math.cos(car.angle) * brake * dt;
  car.vy -= Math.sin(car.angle) * brake * dt;

  const forward = Math.cos(car.angle) * car.vx + Math.sin(car.angle) * car.vy;
  const lateral = -Math.sin(car.angle) * car.vx + Math.cos(car.angle) * car.vy;
  const grip = accelerating ? 0.965 : 0.948;
  const nextLateral = lateral * Math.pow(grip, dt * 60);
  car.vx = Math.cos(car.angle) * forward - Math.sin(car.angle) * nextLateral;
  car.vy = Math.sin(car.angle) * forward + Math.cos(car.angle) * nextLateral;

  const drag = braking ? 0.975 : 0.992;
  car.vx *= Math.pow(drag, dt * 60);
  car.vy *= Math.pow(drag, dt * 60);

  const maxSpeed = 430;
  const nowSpeed = Math.hypot(car.vx, car.vy);
  if (nowSpeed > maxSpeed) {
    car.vx = (car.vx / nowSpeed) * maxSpeed;
    car.vy = (car.vy / nowSpeed) * maxSpeed;
  }

  const prevX = car.x;
  const prevY = car.y;
  car.x += car.vx * dt;
  car.y += car.vy * dt;

  const slide = Math.abs(nextLateral);
  const drifting = slide > 70 && nowSpeed > 115;
  if (drifting) {
    state.driftChain += (slide * 0.028 + nowSpeed * 0.006) * dt * 60;
    state.driftHeat = Math.min(100, state.driftHeat + 42 * dt);
    state.score += (slide * 0.025 + nowSpeed * 0.004) * dt * 60;
    if (skidMarks.length < 180) {
      skidMarks.push({ x: car.x, y: car.y, angle: car.angle, life: 1 });
    }
  } else {
    state.driftHeat = Math.max(0, state.driftHeat - 30 * dt);
    state.driftChain = Math.max(0, state.driftChain - 22 * dt);
  }

  const gap = wallGap(car.x, car.y);
  if (gap < 28 && nowSpeed > 160 && onTrack(car.x, car.y, car.radius)) {
    state.score += (30 - gap) * dt * 3.2;
    state.nearMisses += dt * 0.65;
    spawnSpark(car.x - Math.cos(car.angle) * 16, car.y - Math.sin(car.angle) * 16, "#44e2ff");
  }

  if (!onTrack(car.x, car.y, car.radius)) {
    car.x = prevX;
    car.y = prevY;
    car.vx *= -0.32;
    car.vy *= -0.32;
    state.driftChain = 0;
    state.hitFlash = 1;
    state.score = Math.max(0, state.score - 45);
    for (let i = 0; i < 12; i += 1) spawnSpark(car.x, car.y, "#ff4d6d");
  }

  checkGate(prevX, prevY, car.x, car.y);

  state.timeLeft -= dt;
  if (state.timeLeft <= 0) {
    state.timeLeft = 0;
    endRun("Time Expired", "Hit Restart for another run. Clean gates and longer slides build the biggest score.");
  }

  state.hitFlash = Math.max(0, state.hitFlash - dt * 3.2);
  updateParticles(dt);
  updateHud();
}

function checkGate(px, py, x, y) {
  const gate = gates[state.gateIndex];
  if (!gate) return;
  if (!segmentsIntersect(px, py, x, y, gate.x1, gate.y1, gate.x2, gate.y2)) return;

  const chainBonus = Math.floor(state.driftChain * 5);
  const timeBonus = Math.floor(100 + state.timeLeft * 2);
  state.score += 500 + chainBonus + timeBonus;
  state.timeLeft += 4.5;
  for (let i = 0; i < 22; i += 1) {
    const t = i / 21;
    spawnSpark(lerp(gate.x1, gate.x2, t), lerp(gate.y1, gate.y2, t), i % 2 ? "#ffd166" : "#52ffa8");
  }
  state.gateIndex += 1;

  if (state.gateIndex >= gates.length) {
    state.score += Math.floor(state.timeLeft * 80) + 2500;
    endRun("Circuit Solved", "Every gate cleared. Restart to chase a sharper line and a louder score.");
  }
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  drawBackdrop();
  drawTrack();
  drawSkids();
  drawGates();
  drawParticles();
  drawCar();
  if (state.hitFlash > 0) {
    ctx.fillStyle = `rgba(255, 77, 109, ${state.hitFlash * 0.16})`;
    ctx.fillRect(0, 0, W, H);
  }
}

function drawBackdrop() {
  const gradient = ctx.createLinearGradient(0, 0, W, H);
  gradient.addColorStop(0, "#040814");
  gradient.addColorStop(0.48, "#071326");
  gradient.addColorStop(1, "#050711");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "rgba(68, 226, 255, 0.055)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 32) line(x, 0, x, H);
  for (let y = 0; y <= H; y += 32) line(0, y, W, y);
}

function drawTrack() {
  ctx.save();
  ctx.beginPath();
  roundedRectPath(track.outer);
  roundedRectPath(track.inner, true);
  ctx.fillStyle = "#101827";
  ctx.fill("evenodd");
  ctx.shadowBlur = 20;
  ctx.shadowColor = "rgba(68, 226, 255, 0.45)";
  ctx.strokeStyle = "rgba(68, 226, 255, 0.72)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  roundedRectPath(track.outer);
  ctx.stroke();
  ctx.shadowColor = "rgba(255, 79, 216, 0.35)";
  ctx.strokeStyle = "rgba(255, 79, 216, 0.62)";
  ctx.beginPath();
  roundedRectPath(track.inner);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  roundedRectPath({ x: 88, y: 88, w: 784, h: 464, r: 64 });
  roundedRectPath({ x: 250, y: 142, w: 460, h: 356, r: 92 }, true);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
  ctx.setLineDash([18, 18]);
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
}

function drawGates() {
  gates.forEach((gate, index) => {
    const active = index === state.gateIndex;
    const done = index < state.gateIndex;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineWidth = active ? 11 : 6;
    ctx.shadowBlur = active ? 24 : 10;
    ctx.shadowColor = active ? "rgba(255, 209, 102, 0.9)" : "rgba(82, 255, 168, 0.35)";
    ctx.strokeStyle = done ? "rgba(82, 255, 168, 0.22)" : active ? "#ffd166" : "rgba(68, 226, 255, 0.35)";
    line(gate.x1, gate.y1, gate.x2, gate.y2);

    if (active) {
      const mx = (gate.x1 + gate.x2) / 2;
      const my = (gate.y1 + gate.y2) / 2;
      ctx.fillStyle = "#03111a";
      ctx.strokeStyle = "rgba(255, 209, 102, 0.78)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(mx, my, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#ffd166";
      ctx.font = "800 12px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(index + 1), mx, my + 1);
    }
    ctx.restore();
  });
}

function drawSkids() {
  ctx.save();
  ctx.lineCap = "round";
  skidMarks.forEach((mark) => {
    mark.life *= 0.994;
    ctx.globalAlpha = Math.max(0, mark.life) * 0.32;
    ctx.strokeStyle = "#ff4fd8";
    ctx.lineWidth = 3;
    const dx = Math.cos(mark.angle + Math.PI / 2) * 8;
    const dy = Math.sin(mark.angle + Math.PI / 2) * 8;
    line(mark.x - dx, mark.y - dy, mark.x + dx, mark.y + dy);
  });
  while (skidMarks.length && skidMarks[0].life < 0.08) skidMarks.shift();
  ctx.restore();
}

function drawCar() {
  const car = state.car;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);

  ctx.shadowBlur = 18;
  ctx.shadowColor = "rgba(68, 226, 255, 0.75)";
  ctx.fillStyle = "#06121f";
  roundedCar(-20, -11, 40, 22, 6);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#44e2ff";
  ctx.stroke();

  ctx.shadowBlur = 12;
  ctx.shadowColor = "rgba(255, 79, 216, 0.8)";
  ctx.fillStyle = "#ff4fd8";
  ctx.fillRect(-5, -8, 17, 16);
  ctx.fillStyle = "#52ffa8";
  ctx.fillRect(10, -5, 10, 10);

  ctx.shadowBlur = 16;
  ctx.shadowColor = "rgba(255, 209, 102, 0.9)";
  ctx.fillStyle = "#ffd166";
  ctx.fillRect(17, -7, 4, 5);
  ctx.fillRect(17, 2, 4, 5);
  ctx.restore();
}

function drawParticles() {
  particles.forEach((p) => {
    ctx.save();
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.shadowBlur = 12;
    ctx.shadowColor = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt * 1.8;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function spawnSpark(x, y, color) {
  if (particles.length > 180) return;
  const angle = Math.random() * Math.PI * 2;
  const speed = 30 + Math.random() * 90;
  particles.push({
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    size: 1.8 + Math.random() * 2.8,
    life: 0.35 + Math.random() * 0.5,
    color,
  });
}

function updateHud() {
  ui.score.textContent = String(Math.floor(state.score));
  ui.time.textContent = state.timeLeft.toFixed(1);
  ui.gate.textContent = `${Math.min(state.gateIndex + 1, gates.length)}/${gates.length}`;
  ui.best.textContent = String(best);
  ui.driftLabel.textContent = String(Math.floor(state.driftChain));
  ui.driftMeter.style.width = `${Math.min(100, state.driftHeat)}%`;
  ui.nearMiss.textContent = String(Math.floor(state.nearMisses));
  ui.speed.textContent = String(Math.floor(Math.hypot(state.car.vx, state.car.vy) / 4));
}

function loop(time) {
  const dt = Math.min(0.033, (time - lastTime) / 1000 || 0);
  lastTime = time;
  update(dt);
  draw();
  animationId = requestAnimationFrame(loop);
}

function line(x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function roundedRectPath(rect, reverse = false) {
  const { x, y, w, h, r } = rect;
  if (reverse) {
    ctx.moveTo(x + r, y);
    ctx.arcTo(x, y, x, y + r, r);
    ctx.arcTo(x, y + h, x + r, y + h, r);
    ctx.arcTo(x + w, y + h, x + w, y + h - r, r);
    ctx.arcTo(x + w, y, x + w - r, y, r);
  } else {
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.arcTo(x, y, x + r, y, r);
  }
  ctx.closePath();
}

function roundedCar(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
  const d1 = direction(cx, cy, dx, dy, ax, ay);
  const d2 = direction(cx, cy, dx, dy, bx, by);
  const d3 = direction(ax, ay, bx, by, cx, cy);
  const d4 = direction(ax, ay, bx, by, dx, dy);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

function direction(ax, ay, bx, by, cx, cy) {
  return (cx - ax) * (by - ay) - (cy - ay) * (bx - ax);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

window.addEventListener("keydown", (event) => {
  const drivingKey = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyW", "KeyA", "KeyS", "KeyD"].includes(event.code);
  if (drivingKey) {
    event.preventDefault();
    keys.add(event.code);
  }
  if (event.code === "Space") {
    event.preventDefault();
    togglePause();
  }
  if (event.code === "Enter" && (!state.running || state.paused || state.ended)) {
    event.preventDefault();
    state.paused ? togglePause() : startRun();
  }
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

ui.startBtn.addEventListener("click", () => {
  if (state.paused) {
    togglePause();
  } else {
    startRun();
  }
});

ui.pauseBtn.addEventListener("click", togglePause);
ui.restartBtn.addEventListener("click", startRun);

document.querySelectorAll("[data-key]").forEach((button) => {
  const code = button.dataset.key;
  const press = (event) => {
    event.preventDefault();
    keys.add(code);
  };
  const release = (event) => {
    event.preventDefault();
    keys.delete(code);
  };
  button.addEventListener("pointerdown", press);
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("pointerleave", release);
});

resetState();
ui.best.textContent = String(best);
animationId = requestAnimationFrame(loop);

window.addEventListener("beforeunload", () => cancelAnimationFrame(animationId));
