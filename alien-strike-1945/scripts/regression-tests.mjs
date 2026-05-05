import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(here, "../src/main.ts"), "utf8");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function groupConfig(name) {
  const match = source.match(new RegExp(`this\\.${name}\\s*=\\s*this\\.physics\\.add\\.group\\(\\{([\\s\\S]*?)\\}\\);`));
  return match?.[1] ?? "";
}

for (const name of ["bullets", "enemyBullets", "pickups"]) {
  assert(
    groupConfig(name).includes("classType: Phaser.Physics.Arcade.Image"),
    `${name} must create Arcade.Image objects so Image-based collision handlers can process them.`,
  );
}

assert(
  !source.includes("private makeBombButton(x: number, y: number): BombButton"),
  "Action buttons should use the shared ActionButton type.",
);

assert(
  /private recycleImage[\s\S]*?image\.body\.enable = false[\s\S]*?private recycleSprite/.test(source),
  "recycleImage must disable the Arcade body so hidden bullets and pickups stop colliding.",
);

assert(
  /private recycleSprite[\s\S]*?sprite\.body\.enable = false[\s\S]*?private spark/.test(source),
  "recycleSprite must disable the Arcade body so hidden enemies stop colliding.",
);

for (const method of ["spawnBullet", "spawnEnemy", "spawnGroundBeast", "spawnBoss", "enemyShoot", "maybeDropPickup"]) {
  const match = source.match(new RegExp(`private ${method}\\([\\s\\S]*?\\n  \\}`));
  assert(match?.[0].includes("body.enable = true"), `${method} must re-enable bodies when pooled objects are reused.`);
}

assert(
  source.includes("private gameOver = false") &&
    source.includes("private enterGameOver") &&
    source.includes("private continueGame"),
  "Game over must stop play and provide a continue path.",
);

assert(
  /update\(time: number, delta: number\): void \{[\s\S]*?if \(this\.gameOver\)/.test(source),
  "update must stop movement, spawning, firing, and collisions while game over is active.",
);

for (const weapon of ["pulse", "pierce", "laser", "homing", "explosive", "wave"]) {
  assert(source.includes(`"${weapon}"`), `Weapon type ${weapon} must exist.`);
}

assert(
  source.includes("private currentWeapon") && source.includes("private applyWeaponPickup"),
  "Weapon pickups must be routed through a dedicated weapon pickup handler.",
);

assert(
  /private applyWeaponPickup[\s\S]*?this\.weaponLevel = 1/.test(source),
  "Picking up a different weapon must reset weapon level to 1.",
);

assert(
  source.includes("BOMB_MAX = 5") && /this\.bombs = clamp\(this\.bombs \+ 1, 0, BOMB_MAX\)/.test(source),
  "Bomb pickups must cap bombs at exactly 5.",
);

for (const behavior of ["pierceRemaining", "findClosestEnemy", "blastRadius", "wavePhase"]) {
  assert(source.includes(behavior), `Bullet behavior ${behavior} must be implemented.`);
}

assert(
  source.includes("private startOverdrive") && source.includes("OVERDRIVE"),
  "Fuel pickups must clearly trigger the overdrive special function.",
);

for (const enemyTexture of ["enemyOrbiter", "enemyStingray", "enemyCruiser", "groundTurret", "groundCrawler"]) {
  assert(source.includes(`"${enemyTexture}"`), `Enemy variety texture ${enemyTexture} must exist.`);
}

console.log("Regression checks passed.");
