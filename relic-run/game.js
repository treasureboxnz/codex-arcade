const cardLibrary = {
  strike: {
    id: "strike",
    name: "Strike",
    cost: 1,
    type: "Attack",
    tone: "attack",
    text: "Deal 7 damage.",
    play: (state) => damageEnemy(state, state.mods.strikeDamage),
  },
  guard: {
    id: "guard",
    name: "Guard",
    cost: 1,
    type: "Skill",
    tone: "skill",
    text: "Gain 6 block.",
    play: (state) => gainBlock(state, state.mods.guardBlock),
  },
  spark: {
    id: "spark",
    name: "Spark",
    cost: 0,
    type: "Power",
    tone: "power",
    text: "Deal 3 damage. Draw 1.",
    play: (state) => {
      damageEnemy(state, state.mods.sparkDamage);
      drawCards(state, 1);
    },
  },
  repair: {
    id: "repair",
    name: "Repair",
    cost: 1,
    type: "Skill",
    tone: "skill",
    text: "Heal 5 HP.",
    play: (state) => healPlayer(state, state.mods.repairHeal),
  },
};

const enemies = [
  {
    name: "Rust Acolyte",
    maxHp: 32,
    intents: [
      { label: "Strike 7", damage: 7 },
      { label: "Brace + Strike 5", damage: 5, block: 5 },
    ],
  },
  {
    name: "Glass Marauder",
    maxHp: 42,
    intents: [
      { label: "Twin Cut 10", damage: 10 },
      { label: "Charge 13", damage: 13 },
      { label: "Ward 8", block: 8 },
    ],
  },
  {
    name: "Vault Engine",
    maxHp: 56,
    intents: [
      { label: "Crush 14", damage: 14 },
      { label: "Overload 9", damage: 9, drawBurn: true },
      { label: "Armor 10", block: 10 },
    ],
  },
];

const relicPool = [
  {
    name: "Copper Heart",
    text: "Raise max HP by 8 and heal 8.",
    apply: (state) => {
      state.player.maxHp += 8;
      healPlayer(state, 8);
    },
  },
  {
    name: "Kinetic Coil",
    text: "Start each turn with 4 energy.",
    apply: (state) => {
      state.player.maxEnergy = 4;
    },
  },
  {
    name: "Sharpened Lens",
    text: "Strike deals 10 damage.",
    apply: (state) => {
      state.mods.strikeDamage = 10;
      cardLibrary.strike.text = "Deal 10 damage.";
    },
  },
  {
    name: "Mirror Plating",
    text: "Guard gives 9 block.",
    apply: (state) => {
      state.mods.guardBlock = 9;
      cardLibrary.guard.text = "Gain 9 block.";
    },
  },
  {
    name: "Bright Fuse",
    text: "Spark deals 5 damage.",
    apply: (state) => {
      state.mods.sparkDamage = 5;
      cardLibrary.spark.text = "Deal 5 damage. Draw 1.";
    },
  },
  {
    name: "Soft Wrench",
    text: "Repair heals 8 HP.",
    apply: (state) => {
      state.mods.repairHeal = 8;
      cardLibrary.repair.text = "Heal 8 HP.";
    },
  },
];

const els = {
  runStatus: document.querySelector("#runStatus"),
  playerHp: document.querySelector("#playerHp"),
  playerHpMeter: document.querySelector("#playerHpMeter"),
  energyText: document.querySelector("#energyText"),
  blockText: document.querySelector("#blockText"),
  roomTrack: document.querySelector("#roomTrack"),
  enemyName: document.querySelector("#enemyName"),
  enemyIntent: document.querySelector("#enemyIntent"),
  enemyHp: document.querySelector("#enemyHp"),
  enemyHpMeter: document.querySelector("#enemyHpMeter"),
  enemyArt: document.querySelector("#enemyArt"),
  drawCount: document.querySelector("#drawCount"),
  discardCount: document.querySelector("#discardCount"),
  relicList: document.querySelector("#relicList"),
  battleLog: document.querySelector("#battleLog"),
  turnText: document.querySelector("#turnText"),
  hand: document.querySelector("#hand"),
  endTurnBtn: document.querySelector("#endTurnBtn"),
  choiceOverlay: document.querySelector("#choiceOverlay"),
  choiceGrid: document.querySelector("#choiceGrid"),
  resultOverlay: document.querySelector("#resultOverlay"),
  resultLabel: document.querySelector("#resultLabel"),
  resultTitle: document.querySelector("#resultTitle"),
  resultText: document.querySelector("#resultText"),
  restartBtn: document.querySelector("#restartBtn"),
};

let state;

function freshState() {
  return {
    room: 0,
    player: {
      hp: 48,
      maxHp: 48,
      energy: 3,
      maxEnergy: 3,
      block: 0,
    },
    enemy: null,
    intentIndex: 0,
    drawPile: [],
    discardPile: [],
    hand: [],
    relics: [],
    log: [],
    phase: "player",
    mods: {
      strikeDamage: 7,
      guardBlock: 6,
      sparkDamage: 3,
      repairHeal: 5,
    },
  };
}

function startRun() {
  cardLibrary.strike.text = "Deal 7 damage.";
  cardLibrary.guard.text = "Gain 6 block.";
  cardLibrary.spark.text = "Deal 3 damage. Draw 1.";
  cardLibrary.repair.text = "Heal 5 HP.";
  state = freshState();
  els.resultOverlay.classList.remove("is-visible");
  els.resultOverlay.setAttribute("aria-hidden", "true");
  els.choiceOverlay.classList.remove("is-visible");
  els.choiceOverlay.setAttribute("aria-hidden", "true");
  startRoom();
}

function startRoom() {
  const template = enemies[state.room];
  state.enemy = {
    name: template.name,
    hp: template.maxHp,
    maxHp: template.maxHp,
    block: 0,
    intents: template.intents,
  };
  state.intentIndex = 0;
  state.phase = "player";
  state.player.block = 0;
  state.drawPile = shuffle([
    "strike",
    "strike",
    "strike",
    "guard",
    "guard",
    "spark",
    "spark",
    "repair",
  ]);
  state.discardPile = [];
  state.hand = [];
  state.log = [`Entered room ${state.room + 1}: ${state.enemy.name}.`];
  startPlayerTurn();
}

function startPlayerTurn() {
  state.phase = "player";
  state.player.energy = state.player.maxEnergy;
  state.player.block = 0;
  drawCards(state, 5 - state.hand.length);
  log(`Drew to ${state.hand.length} cards.`);
  render();
}

function drawCards(runState, count) {
  for (let i = 0; i < count; i += 1) {
    if (runState.drawPile.length === 0) {
      if (runState.discardPile.length === 0) return;
      runState.drawPile = shuffle(runState.discardPile);
      runState.discardPile = [];
      log("Shuffled discard into draw pile.");
    }
    runState.hand.push(runState.drawPile.pop());
  }
}

function playCard(index) {
  if (state.phase !== "player") return;
  const cardId = state.hand[index];
  const card = cardLibrary[cardId];
  if (!card || state.player.energy < card.cost) return;

  state.player.energy -= card.cost;
  state.hand.splice(index, 1);
  state.discardPile.push(cardId);
  log(`Played ${card.name}.`);
  card.play(state);

  if (state.enemy.hp <= 0) {
    clearRoom();
    return;
  }

  render();
}

function damageEnemy(runState, amount) {
  const blocked = Math.min(runState.enemy.block || 0, amount);
  runState.enemy.block = Math.max(0, (runState.enemy.block || 0) - amount);
  const dealt = amount - blocked;
  runState.enemy.hp = Math.max(0, runState.enemy.hp - dealt);
  log(blocked ? `Enemy block absorbed ${blocked}; dealt ${dealt}.` : `Dealt ${dealt} damage.`);
}

function gainBlock(runState, amount) {
  runState.player.block += amount;
  log(`Gained ${amount} block.`);
}

function healPlayer(runState, amount) {
  const before = runState.player.hp;
  runState.player.hp = Math.min(runState.player.maxHp, runState.player.hp + amount);
  log(`Repaired ${runState.player.hp - before} HP.`);
}

function endTurn() {
  if (state.phase !== "player") return;
  state.phase = "enemy";
  state.discardPile.push(...state.hand);
  state.hand = [];
  resolveEnemyTurn();
}

function resolveEnemyTurn() {
  const intent = currentIntent();
  if (intent.block) {
    state.enemy.block = (state.enemy.block || 0) + intent.block;
    log(`${state.enemy.name} gains ${intent.block} block.`);
  }
  if (intent.damage) {
    const absorbed = Math.min(state.player.block, intent.damage);
    const taken = intent.damage - absorbed;
    state.player.block -= absorbed;
    state.player.hp = Math.max(0, state.player.hp - taken);
    log(`${state.enemy.name} attacks for ${intent.damage}; ${taken} gets through.`);
  }
  if (intent.drawBurn) {
    const burned = state.drawPile.pop();
    if (burned) {
      state.discardPile.push(burned);
      log("Vault heat singes the top card.");
    }
  }

  if (state.player.hp <= 0) {
    finishRun(false);
    return;
  }

  state.intentIndex = (state.intentIndex + 1) % state.enemy.intents.length;
  startPlayerTurn();
}

function currentIntent() {
  return state.enemy.intents[state.intentIndex];
}

function clearRoom() {
  log(`${state.enemy.name} defeated.`);
  state.discardPile.push(...state.hand);
  state.hand = [];
  if (state.room === enemies.length - 1) {
    finishRun(true);
    return;
  }
  showRelicChoices();
  render();
}

function showRelicChoices() {
  state.phase = "choice";
  const remaining = relicPool.filter((relic) => !state.relics.includes(relic.name));
  const choices = shuffle(remaining).slice(0, 3);
  els.choiceGrid.innerHTML = "";
  choices.forEach((relic) => {
    const button = document.createElement("button");
    button.className = "choice-card";
    button.type = "button";
    button.innerHTML = `<strong>${relic.name}</strong><span>${relic.text}</span>`;
    button.addEventListener("click", () => takeRelic(relic));
    els.choiceGrid.append(button);
  });
  els.choiceOverlay.classList.add("is-visible");
  els.choiceOverlay.setAttribute("aria-hidden", "false");
}

function takeRelic(relic) {
  state.relics.push(relic.name);
  relic.apply(state);
  state.room += 1;
  els.choiceOverlay.classList.remove("is-visible");
  els.choiceOverlay.setAttribute("aria-hidden", "true");
  startRoom();
}

function finishRun(won) {
  state.phase = "done";
  render();
  els.resultLabel.textContent = won ? "Run Complete" : "Run Lost";
  els.resultTitle.textContent = won ? "Victory" : "Defeat";
  els.resultText.textContent = won
    ? "The vault opens and the last relic hums in your pack."
    : "The dungeon seals itself. Tune the deck and run it back.";
  els.resultOverlay.classList.add("is-visible");
  els.resultOverlay.setAttribute("aria-hidden", "false");
}

function render() {
  renderTrack();
  renderStats();
  renderEnemy();
  renderRelics();
  renderLog();
  renderHand();
}

function renderTrack() {
  els.runStatus.textContent = `Room ${Math.min(state.room + 1, 3)} / 3`;
  els.roomTrack.innerHTML = "";
  enemies.forEach((_, index) => {
    const node = document.createElement("div");
    node.className = "room-node";
    if (index < state.room) node.classList.add("is-cleared");
    if (index === state.room && state.phase !== "done") node.classList.add("is-current");
    node.textContent = `Room ${index + 1}`;
    els.roomTrack.append(node);
  });
}

function renderStats() {
  els.playerHp.textContent = `${state.player.hp} / ${state.player.maxHp}`;
  els.playerHpMeter.max = state.player.maxHp;
  els.playerHpMeter.value = state.player.hp;
  els.energyText.textContent = `${state.player.energy} / ${state.player.maxEnergy}`;
  els.blockText.textContent = state.player.block;
  els.drawCount.textContent = state.drawPile.length;
  els.discardCount.textContent = state.discardPile.length;
  els.turnText.textContent =
    state.phase === "player" ? "Your Turn" : state.phase === "choice" ? "Choose Relic" : "Enemy Turn";
  els.endTurnBtn.disabled = state.phase !== "player";
}

function renderEnemy() {
  const intent = currentIntent();
  els.enemyName.textContent = state.enemy.name;
  els.enemyIntent.textContent = `Intent: ${intent.label}`;
  els.enemyHp.textContent = `${state.enemy.hp} / ${state.enemy.maxHp} HP${state.enemy.block ? `, ${state.enemy.block} Block` : ""}`;
  els.enemyHpMeter.max = state.enemy.maxHp;
  els.enemyHpMeter.value = state.enemy.hp;
  els.enemyArt.style.setProperty("--enemy-shift", `${state.room * 40}deg`);
}

function renderRelics() {
  els.relicList.innerHTML = "";
  if (state.relics.length === 0) {
    const empty = document.createElement("span");
    empty.className = "relic-chip";
    empty.textContent = "None yet";
    els.relicList.append(empty);
    return;
  }
  state.relics.forEach((name) => {
    const relic = document.createElement("span");
    relic.className = "relic-chip";
    relic.textContent = name;
    els.relicList.append(relic);
  });
}

function renderLog() {
  els.battleLog.innerHTML = "";
  state.log.slice(-5).forEach((entry) => {
    const line = document.createElement("div");
    line.textContent = entry;
    els.battleLog.append(line);
  });
}

function renderHand() {
  els.hand.innerHTML = "";
  state.hand.forEach((cardId, index) => {
    const card = cardLibrary[cardId];
    const button = document.createElement("button");
    button.type = "button";
    button.className = `card ${card.tone}`;
    button.disabled = state.phase !== "player" || state.player.energy < card.cost;
    button.innerHTML = `
      <div class="card-top">
        <span class="card-cost">${card.cost}</span>
        <span class="card-type">${card.type}</span>
      </div>
      <h3>${card.name}</h3>
      <p>${card.text}</p>
      <span class="card-type">Play</span>
    `;
    button.addEventListener("click", () => playCard(index));
    els.hand.append(button);
  });
}

function log(message) {
  if (!state) return;
  state.log.push(message);
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

els.endTurnBtn.addEventListener("click", endTurn);
els.restartBtn.addEventListener("click", startRun);

startRun();
