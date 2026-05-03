const boardEl = document.querySelector("#board");
const scoreEl = document.querySelector("#score");
const bestEl = document.querySelector("#best");
const restartBtn = document.querySelector("#restart");
const overlay = document.querySelector("#overlay");
const overlayTitle = document.querySelector("#overlayTitle");
const overlayText = document.querySelector("#overlayText");
const overlayRestart = document.querySelector("#overlayRestart");
const modeTitle = document.querySelector("#modeTitle");
const modeDescription = document.querySelector("#modeDescription");
const modeButtons = document.querySelectorAll(".mode-tabs button");
const touchButtons = document.querySelectorAll(".touch-grid button");

const size = 4;
const bestKey = "tile-lab-best";
const modes = {
  classic: {
    title: "Classic",
    description: "One new tile appears after each valid move. Reach the largest value you can.",
    drops: 1,
    blocks: 0,
  },
  twin: {
    title: "Twin Drop",
    description: "Two new tiles appear after every valid move. Faster, tighter, and more tactical.",
    drops: 2,
    blocks: 0,
  },
  blocks: {
    title: "Block Run",
    description: "Two locked cells change the board shape. Work around them and keep merging.",
    drops: 1,
    blocks: 2,
  },
};

let mode = "classic";
let grid;
let score;
let best = Number(localStorage.getItem(bestKey) || 0);
let startTouch = null;

function newGame() {
  grid = Array.from({ length: size }, () => Array(size).fill(0));
  score = 0;
  overlay.classList.remove("is-visible");
  placeBlocks();
  addRandomTile();
  addRandomTile();
  render();
}

function placeBlocks() {
  for (let i = 0; i < modes[mode].blocks; i += 1) {
    const empty = emptyCells();
    if (!empty.length) return;
    const cell = empty[Math.floor(Math.random() * empty.length)];
    grid[cell.r][cell.c] = -1;
  }
}

function render() {
  boardEl.innerHTML = "";
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      const value = grid[r][c];
      const cell = document.createElement("div");
      cell.className = value === -1 ? "cell block" : "cell";
      if (value > 0) {
        cell.textContent = value;
        cell.dataset.value = String(value);
      } else if (value === -1) {
        cell.textContent = "X";
      }
      boardEl.append(cell);
    }
  }
  scoreEl.textContent = score;
  bestEl.textContent = Math.max(best, score);
  modeTitle.textContent = modes[mode].title;
  modeDescription.textContent = modes[mode].description;
  modeButtons.forEach((button) => button.classList.toggle("is-active", button.dataset.mode === mode));
}

function move(dir) {
  const before = serialize();
  if (dir === "left") slideRows(false);
  if (dir === "right") slideRows(true);
  if (dir === "up") slideCols(false);
  if (dir === "down") slideCols(true);
  if (serialize() === before) return;

  for (let i = 0; i < modes[mode].drops; i += 1) addRandomTile();
  best = Math.max(best, score);
  localStorage.setItem(bestKey, String(best));
  render();
  if (!hasMoves()) showGameOver();
}

function slideRows(reverse) {
  for (let r = 0; r < size; r += 1) {
    const row = reverse ? [...grid[r]].reverse() : [...grid[r]];
    const merged = mergeLine(row);
    grid[r] = reverse ? merged.reverse() : merged;
  }
}

function slideCols(reverse) {
  for (let c = 0; c < size; c += 1) {
    const col = [];
    for (let r = 0; r < size; r += 1) col.push(grid[r][c]);
    const source = reverse ? col.reverse() : col;
    const merged = mergeLine(source);
    const result = reverse ? merged.reverse() : merged;
    for (let r = 0; r < size; r += 1) grid[r][c] = result[r];
  }
}

function mergeLine(line) {
  const segments = [];
  let current = [];
  line.forEach((value) => {
    if (value === -1) {
      segments.push(current, [-1]);
      current = [];
    } else {
      current.push(value);
    }
  });
  segments.push(current);

  const merged = [];
  segments.forEach((segment) => {
    if (segment.length === 1 && segment[0] === -1) {
      merged.push(-1);
      return;
    }
    const values = segment.filter(Boolean);
    const out = [];
    for (let i = 0; i < values.length; i += 1) {
      if (values[i] === values[i + 1]) {
        const next = values[i] * 2;
        out.push(next);
        score += next;
        i += 1;
      } else {
        out.push(values[i]);
      }
    }
    while (out.length < segment.length) out.push(0);
    merged.push(...out);
  });
  return merged.slice(0, size);
}

function addRandomTile() {
  const empty = emptyCells();
  if (!empty.length) return;
  const cell = empty[Math.floor(Math.random() * empty.length)];
  grid[cell.r][cell.c] = Math.random() < 0.88 ? 2 : 4;
}

function emptyCells() {
  const cells = [];
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (grid[r][c] === 0) cells.push({ r, c });
    }
  }
  return cells;
}

function hasMoves() {
  if (emptyCells().length) return true;
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      const value = grid[r][c];
      if (value <= 0) continue;
      if (grid[r + 1]?.[c] === value || grid[r][c + 1] === value) return true;
    }
  }
  return false;
}

function showGameOver() {
  overlayTitle.textContent = "Board Locked";
  overlayText.textContent = `Final score: ${score}`;
  overlay.classList.add("is-visible");
}

function serialize() {
  return grid.flat().join(",");
}

document.addEventListener("keydown", (event) => {
  const map = {
    ArrowLeft: "left",
    KeyA: "left",
    ArrowRight: "right",
    KeyD: "right",
    ArrowUp: "up",
    KeyW: "up",
    ArrowDown: "down",
    KeyS: "down",
  };
  if (!map[event.code]) return;
  event.preventDefault();
  move(map[event.code]);
});

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    mode = button.dataset.mode;
    newGame();
  });
});

touchButtons.forEach((button) => button.addEventListener("click", () => move(button.dataset.dir)));
restartBtn.addEventListener("click", newGame);
overlayRestart.addEventListener("click", newGame);

boardEl.addEventListener("pointerdown", (event) => {
  startTouch = { x: event.clientX, y: event.clientY };
});

boardEl.addEventListener("pointerup", (event) => {
  if (!startTouch) return;
  const dx = event.clientX - startTouch.x;
  const dy = event.clientY - startTouch.y;
  startTouch = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
  move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
});

newGame();
