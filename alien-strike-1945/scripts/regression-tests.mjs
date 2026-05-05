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

for (const method of ["spawnBullet", "spawnEnemy", "spawnGroundBeast", "spawnBoss", "enemyShoot", "maybeDropPickup", "dropMegaPickup"]) {
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

assert(
  source.includes("PLAYER_LIVES = 100") &&
    /private lives = PLAYER_LIVES/.test(source) &&
    /this\.lives = PLAYER_LIVES/.test(source),
  "Player must start and continue with 100 lives.",
);

assert(
  source.includes("ENEMY_BULLET_SPEED_DEFAULT = 165") &&
    source.includes("ENEMY_BOSS_FIRE_DELAY = 900") &&
    /kind === "boss" \? \[-0\.28, 0, 0\.28\]/.test(source),
  "Enemy bullets must be slower and boss spreads must leave dodge gaps.",
);

assert(
  /enemy\.setData\("shootAt", time \+ this\.enemyFireDelay\(kind\)\)/.test(source) &&
    source.includes("private enemyFireDelay(kind: string): number"),
  "Enemy fire cadence must use a slower difficulty-tuned delay helper.",
);

assert(
  source.includes("private getFireDirection(): Phaser.Math.Vector2") &&
    /const aim = this\.getFireDirection\(\);/.test(source),
  "Mobile firing must use a dedicated fire-direction helper.",
);

assert(
  source.includes("MOBILE_FIRE_X_WEIGHT = 0.7") &&
    source.includes("new Phaser.Math.Vector2(horizontal * MOBILE_FIRE_X_WEIGHT, -1).normalize()") &&
    !source.includes("this.rightStick.vector.clone().normalize()"),
  "Mobile right-stick fire must always shoot upward, with horizontal drag only steering the angle.",
);

for (const behavior of ["pierceRemaining", "findClosestEnemy", "blastRadius", "wavePhase"]) {
  assert(source.includes(behavior), `Bullet behavior ${behavior} must be implemented.`);
}

assert(
  source.includes("private startOverdrive") && source.includes("OVERDRIVE"),
  "Fuel pickups must clearly trigger the overdrive special function.",
);

assert(
  source.includes('type PickupKind = "weapon" | "fuel" | "bomb" | "mega"') &&
    source.includes("MEGA_ROUNDS_DURATION = 24000") &&
    source.includes("MEGA_ROUNDS_SCALE = 1.55") &&
    source.includes("MEGA_ROUNDS_DAMAGE_BONUS = 1"),
  "Elite rewards must add a long-duration mega-rounds pickup that makes bullets bigger and stronger.",
);

assert(
  source.includes("private megaRoundsUntil = 0") &&
    source.includes("private startMegaRounds") &&
    source.includes("private isMegaRounds(time: number): boolean"),
  "Mega rounds must have a dedicated timed state.",
);

assert(
    source.includes('"enemyViper"') &&
    source.includes('"enemyWarden"') &&
    source.includes('"pickupMega"') &&
    source.includes('kind: elite ? "elite" : "air"') &&
    /this\.dropMegaPickup\(enemy\.x, enemy\.y\)/.test(source),
  "Elite small monsters must exist and drop guaranteed mega-round rewards when killed.",
);

assert(
  /const megaRounds = this\.isMegaRounds\(this\.time\.now\)/.test(source) &&
    source.includes("damage + MEGA_ROUNDS_DAMAGE_BONUS") &&
    source.includes("MEGA_ROUNDS_SCALE") &&
    source.includes('this.flashBanner("MEGA ROUNDS")'),
  "Mega rounds must visibly enlarge bullets and increase their damage while active.",
);

for (const enemyTexture of ["enemyOrbiter", "enemyStingray", "enemyCruiser", "enemyViper", "enemyWarden", "groundTurret", "groundCrawler"]) {
  assert(source.includes(`"${enemyTexture}"`), `Enemy variety texture ${enemyTexture} must exist.`);
}

console.log("Regression checks passed.");
