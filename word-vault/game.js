const WORDS = [
  "crane",
  "orbit",
  "flare",
  "pixel",
  "vault",
  "ghost",
  "rivet",
  "laser",
  "crown",
  "plume",
  "spark",
  "forge",
  "sonic",
  "glint",
  "relay",
  "ember",
  "prism",
  "blaze",
];

const ROWS = 6;
const COLS = 5;
const KEY_ROWS = ["qwertyuiop", "asdfghjkl", "EnterzxcvbnmBackspace"];
const STATUS_RANK = { absent: 1, present: 2, exact: 3 };

const board = document.querySelector("#board");
const keyboard = document.querySelector("#keyboard");
const message = document.querySelector("#message");
const guessCount = document.querySelector("#guessCount");
const signalStatus = document.querySelector("#signalStatus");
const overlay = document.querySelector("#overlay");
const overlayKicker = document.querySelector("#overlayKicker");
const overlayTitle = document.querySelector("#overlayTitle");
const overlayText = document.querySelector("#overlayText");
const newPuzzleButton = document.querySelector("#newPuzzleButton");
const playAgainButton = document.querySelector("#playAgainButton");
const closeOverlayButton = document.querySelector("#closeOverlayButton");

let answer = "";
let currentRow = 0;
let currentGuess = "";
let solved = false;
let over = false;
let keyStatuses = {};
let lastAnswer = "";

function init() {
  buildBoard();
  buildKeyboard();
  startPuzzle();
  window.addEventListener("keydown", handlePhysicalKey);
  newPuzzleButton.addEventListener("click", startPuzzle);
  playAgainButton.addEventListener("click", startPuzzle);
  closeOverlayButton.addEventListener("click", hideOverlay);
}

function buildBoard() {
  board.innerHTML = "";

  for (let rowIndex = 0; rowIndex < ROWS; rowIndex += 1) {
    const row = document.createElement("div");
    row.className = "row";
    row.dataset.row = rowIndex;

    for (let colIndex = 0; colIndex < COLS; colIndex += 1) {
      const tile = document.createElement("div");
      tile.className = "tile";
      tile.setAttribute("aria-label", `Guess ${rowIndex + 1}, letter ${colIndex + 1}`);
      row.append(tile);
    }

    board.append(row);
  }
}

function buildKeyboard() {
  keyboard.innerHTML = "";

  KEY_ROWS.forEach((letters) => {
    const row = document.createElement("div");
    row.className = "key-row";

    for (let index = 0; index < letters.length; index += 1) {
      let label = letters[index];

      if (letters.startsWith("Enter") && index === 0) {
        label = "Enter";
        index += 4;
      } else if (letters.includes("Backspace") && index === letters.length - 9) {
        label = "Backspace";
        index += 8;
      }

      const key = document.createElement("button");
      key.className = label.length > 1 ? "key wide" : "key";
      key.type = "button";
      key.textContent = label === "Backspace" ? "Del" : label;
      key.dataset.key = label;
      key.setAttribute("aria-label", label === "Backspace" ? "Delete letter" : label);
      key.addEventListener("click", () => handleInput(label));
      row.append(key);
    }

    keyboard.append(row);
  });
}

function startPuzzle() {
  const candidates = WORDS.length > 1 ? WORDS.filter((word) => word !== lastAnswer) : WORDS;
  answer = candidates[Math.floor(Math.random() * candidates.length)];

  lastAnswer = answer;
  currentRow = 0;
  currentGuess = "";
  solved = false;
  over = false;
  keyStatuses = {};
  hideOverlay();
  setMessage("Crack the five-letter vault code.");
  updateHud();

  document.querySelectorAll(".tile").forEach((tile) => {
    tile.textContent = "";
    tile.className = "tile";
  });

  document.querySelectorAll(".key").forEach((key) => {
    key.classList.remove("exact", "present", "absent");
  });
}

function handlePhysicalKey(event) {
  if (event.altKey || event.ctrlKey || event.metaKey) return;

  const key = event.key;
  if (key === "Enter" || key === "Backspace" || /^[a-zA-Z]$/.test(key)) {
    event.preventDefault();
    handleInput(key);
  }
}

function handleInput(rawKey) {
  if (over) return;

  const key = rawKey.length === 1 ? rawKey.toLowerCase() : rawKey;

  if (key === "Enter") {
    submitGuess();
    return;
  }

  if (key === "Backspace") {
    removeLetter();
    return;
  }

  if (/^[a-z]$/.test(key)) {
    addLetter(key);
  }
}

function addLetter(letter) {
  if (currentGuess.length >= COLS) return;

  currentGuess += letter;
  paintCurrentGuess();
}

function removeLetter() {
  if (!currentGuess) return;

  currentGuess = currentGuess.slice(0, -1);
  paintCurrentGuess();
}

function paintCurrentGuess() {
  const row = getRow(currentRow);
  const tiles = [...row.children];

  tiles.forEach((tile, index) => {
    const letter = currentGuess[index] || "";
    tile.textContent = letter;
    tile.classList.toggle("filled", Boolean(letter));
  });
}

function submitGuess() {
  if (currentGuess.length !== COLS) {
    rejectGuess("Five letters required.");
    return;
  }

  if (!WORDS.includes(currentGuess)) {
    rejectGuess("That code is not in this vault.");
    return;
  }

  const result = scoreGuess(currentGuess, answer);
  revealRow(result);
  updateKeys(currentGuess, result);

  if (currentGuess === answer) {
    solved = true;
    over = true;
    setMessage("Vault opened.");
    updateHud();
    window.setTimeout(() => showWin(), 900);
    return;
  }

  currentRow += 1;
  currentGuess = "";
  updateHud();

  if (currentRow === ROWS) {
    over = true;
    setMessage(`Vault sealed. Code was ${answer.toUpperCase()}.`);
    window.setTimeout(() => showLoss(), 900);
  } else {
    setMessage("Signal recorded. Try another route.");
  }
}

function rejectGuess(text) {
  const row = getRow(currentRow);
  row.classList.remove("shake");
  void row.offsetWidth;
  row.classList.add("shake");
  setMessage(text);
}

function scoreGuess(guess, target) {
  const result = Array(COLS).fill("absent");
  const remaining = {};

  for (let i = 0; i < COLS; i += 1) {
    if (guess[i] === target[i]) {
      result[i] = "exact";
    } else {
      remaining[target[i]] = (remaining[target[i]] || 0) + 1;
    }
  }

  for (let i = 0; i < COLS; i += 1) {
    if (result[i] === "exact") continue;

    if (remaining[guess[i]]) {
      result[i] = "present";
      remaining[guess[i]] -= 1;
    }
  }

  return result;
}

function revealRow(result) {
  const row = getRow(currentRow);
  const tiles = [...row.children];

  tiles.forEach((tile, index) => {
    window.setTimeout(() => {
      tile.classList.add("reveal", result[index]);
    }, index * 120);
  });
}

function updateKeys(guess, result) {
  [...guess].forEach((letter, index) => {
    const status = result[index];
    const existing = keyStatuses[letter];

    if (!existing || STATUS_RANK[status] > STATUS_RANK[existing]) {
      keyStatuses[letter] = status;
    }
  });

  Object.entries(keyStatuses).forEach(([letter, status]) => {
    const key = keyboard.querySelector(`[data-key="${letter}"]`);
    if (!key) return;

    key.classList.remove("exact", "present", "absent");
    key.classList.add(status);
  });
}

function updateHud() {
  const guessesUsed = solved ? currentRow + 1 : currentRow;
  guessCount.textContent = `${guessesUsed}/${ROWS}`;

  if (solved) {
    signalStatus.textContent = "Unlocked";
  } else if (over) {
    signalStatus.textContent = "Sealed";
  } else {
    signalStatus.textContent = currentRow > 0 ? "Tracing" : "Scanning";
  }
}

function showWin() {
  overlayKicker.textContent = "Vault Opened";
  overlayTitle.textContent = currentRow <= 2 ? "Sharp signal." : "Clean solve.";
  overlayText.textContent = `You unlocked ${answer.toUpperCase()} in ${currentRow + 1} ${currentRow === 0 ? "guess" : "guesses"}.`;
  overlay.classList.remove("hidden");
}

function showLoss() {
  overlayKicker.textContent = "Vault Sealed";
  overlayTitle.textContent = "Code escaped.";
  overlayText.textContent = `The mystery word was ${answer.toUpperCase()}. Spin up a new vault and chase it back.`;
  overlay.classList.remove("hidden");
}

function hideOverlay() {
  overlay.classList.add("hidden");
}

function setMessage(text) {
  message.textContent = text;
}

function getRow(index) {
  return board.querySelector(`[data-row="${index}"]`);
}

init();
