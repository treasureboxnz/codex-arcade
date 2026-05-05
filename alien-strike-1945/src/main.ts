import Phaser from "phaser";
import "./styles.css";

const GAME_WIDTH = 540;
const GAME_HEIGHT = 960;
const BOMB_MAX = 5;

const clamp = Phaser.Math.Clamp;

type WeaponType = "pulse" | "pierce" | "laser" | "homing" | "explosive" | "wave";
type PickupKind = "weapon" | "fuel" | "bomb";
type ArcadeOverlapObject =
  | Phaser.Types.Physics.Arcade.GameObjectWithBody
  | Phaser.Physics.Arcade.Body
  | Phaser.Physics.Arcade.StaticBody
  | Phaser.Tilemaps.Tile;

interface Star {
  dot: Phaser.GameObjects.Arc;
  speed: number;
}

interface VirtualJoystick {
  side: "left" | "right";
  halo: Phaser.GameObjects.Arc;
  base: Phaser.GameObjects.Arc;
  inner: Phaser.GameObjects.Arc;
  thumb: Phaser.GameObjects.Arc;
  shine: Phaser.GameObjects.Arc;
  center: Phaser.Math.Vector2;
  vector: Phaser.Math.Vector2;
  radius: number;
  pointerId: number | null;
  active: boolean;
  outerRelease: boolean;
}

interface ActionButton {
  base: Phaser.GameObjects.Arc;
  inner: Phaser.GameObjects.Arc;
  icon: Phaser.GameObjects.Image;
  pointerId: number | null;
  center: Phaser.Math.Vector2;
  radius: number;
}

class AlienStrikeScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;

  private bullets!: Phaser.Physics.Arcade.Group;
  private enemies!: Phaser.Physics.Arcade.Group;
  private enemyBullets!: Phaser.Physics.Arcade.Group;
  private pickups!: Phaser.Physics.Arcade.Group;

  private stars: Star[] = [];
  private leftStick!: VirtualJoystick;
  private rightStick!: VirtualJoystick;
  private bombButton!: ActionButton;

  private score = 0;
  private shownScore = 0;
  private kills = 0;
  private lives = 10;
  private continues = 0;
  private bombs = 3;
  private currentWeapon: WeaponType = "pulse";
  private weaponLevel = 1;
  private overdriveUntil = 0;
  private invulnerableUntil = 0;
  private stageStart = 0;
  private gameOver = false;
  private bossSpawned = false;
  private bossDefeated = false;

  private nextShotAt = 0;
  private nextEnemyAt = 0;
  private nextGroundAt = 0;
  private nextTrailAt = 0;
  private nextEnemyUid = 1;

  private scoreText!: Phaser.GameObjects.Text;
  private killsText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;
  private weaponText!: Phaser.GameObjects.Text;
  private bombsText!: Phaser.GameObjects.Text;
  private fuelText!: Phaser.GameObjects.Text;
  private progressText!: Phaser.GameObjects.Text;
  private fuelBar!: Phaser.GameObjects.Rectangle;
  private fuelBarBack!: Phaser.GameObjects.Rectangle;
  private gameOverLayer!: Phaser.GameObjects.Container;

  constructor() {
    super("alien-strike");
  }

  preload(): void {
    this.load.setPath("/");
  }

  create(): void {
    this.input.addPointer(4);
    this.physics.world.setBounds(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.createTextures();
    this.createBackground();
    this.createPlayer();
    this.createGroups();
    this.createHud();
    this.createJoysticks();
    this.registerInput();

    this.stageStart = this.time.now;
    this.nextEnemyAt = this.time.now + 700;
    this.nextGroundAt = this.time.now + 2500;

    this.physics.add.overlap(this.bullets, this.enemies, this.onBulletHitsEnemy, undefined, this);
    this.physics.add.overlap(this.player, this.enemyBullets, this.onPlayerHit, undefined, this);
    this.physics.add.overlap(this.player, this.enemies, this.onPlayerHit, undefined, this);
    this.physics.add.overlap(this.player, this.pickups, this.onPickup, undefined, this);
  }

  update(time: number, delta: number): void {
    const dt = delta / 1000;
    this.updateStars(dt);

    if (this.gameOver) {
      this.updateHud(time, dt);
      return;
    }

    this.updatePlayer(time, dt);
    this.updateFiring(time);
    this.updateSpawns(time);
    this.updateEnemies(time, dt);
    this.updateEnemyBullets();
    this.updateBullets(time, dt);
    this.updatePickups();
    this.updateHud(time, dt);
  }

  private createTextures(): void {
    const g = this.add.graphics();

    g.clear();
    g.fillStyle(0x29fbff, 0.16);
    g.fillEllipse(48, 63, 90, 104);
    g.fillStyle(0xff4fec, 0.12);
    g.fillEllipse(48, 78, 72, 72);
    g.fillGradientStyle(0x9cffff, 0x32caff, 0x38fff2, 0x7b4dff, 1, 1, 1, 1);
    g.beginPath();
    g.moveTo(48, 2);
    g.lineTo(61, 40);
    g.lineTo(88, 96);
    g.lineTo(61, 81);
    g.lineTo(54, 114);
    g.lineTo(48, 99);
    g.lineTo(42, 114);
    g.lineTo(35, 81);
    g.lineTo(8, 96);
    g.lineTo(35, 40);
    g.closePath();
    g.fillPath();
    g.lineStyle(3, 0xeaffff, 1);
    g.strokePath();
    g.fillStyle(0x7df7ff, 0.82);
    g.beginPath();
    g.moveTo(34, 42);
    g.lineTo(17, 85);
    g.lineTo(36, 74);
    g.lineTo(42, 94);
    g.lineTo(44, 61);
    g.closePath();
    g.fillPath();
    g.beginPath();
    g.moveTo(62, 42);
    g.lineTo(79, 85);
    g.lineTo(60, 74);
    g.lineTo(54, 94);
    g.lineTo(52, 61);
    g.closePath();
    g.fillPath();
    g.fillStyle(0xff63ef, 0.72);
    g.fillTriangle(24, 88, 36, 78, 35, 101);
    g.fillTriangle(72, 88, 60, 78, 61, 101);
    g.fillStyle(0xffffff, 0.45);
    g.fillTriangle(48, 5, 54, 42, 48, 34);
    g.fillTriangle(48, 5, 42, 42, 48, 34);
    g.fillGradientStyle(0x2b6fff, 0x143b93, 0x27f4ff, 0x904eff, 0.9, 0.95, 0.9, 0.9);
    g.beginPath();
    g.moveTo(48, 8);
    g.lineTo(59, 72);
    g.lineTo(48, 103);
    g.lineTo(37, 72);
    g.closePath();
    g.fillPath();
    g.lineStyle(2, 0x8ff7ff, 0.85);
    g.strokePath();
    g.fillGradientStyle(0xffff9a, 0xffffff, 0x58fbff, 0x35b8ff, 1, 1, 1, 1);
    g.fillEllipse(48, 35, 21, 39);
    g.lineStyle(2, 0xffffff, 0.9);
    g.strokeEllipse(48, 35, 21, 39);
    g.fillStyle(0xffffff, 0.58);
    g.fillEllipse(44, 25, 6, 14);
    g.lineStyle(2, 0x1af7ff, 0.78);
    g.lineBetween(31, 53, 16, 90);
    g.lineBetween(65, 53, 80, 90);
    g.lineBetween(39, 74, 48, 100);
    g.lineBetween(57, 74, 48, 100);
    g.fillStyle(0xff4fe8, 1);
    g.fillTriangle(28, 91, 39, 82, 39, 109);
    g.fillTriangle(68, 91, 57, 82, 57, 109);
    g.fillStyle(0x5cffff, 1);
    g.fillCircle(48, 77, 7);
    g.lineStyle(2, 0xffffff, 0.85);
    g.strokeCircle(48, 77, 10);
    g.fillGradientStyle(0xff4fec, 0xffb347, 0x5cffff, 0xff4fec, 1, 1, 0.9, 0.95);
    g.fillTriangle(36, 105, 44, 105, 40, 119);
    g.fillTriangle(60, 105, 52, 105, 56, 119);
    g.generateTexture("playerShip", 96, 120);

    g.clear();
    g.fillStyle(0xff4fed, 0.16);
    g.fillEllipse(44, 36, 84, 56);
    g.fillGradientStyle(0xff6dec, 0x7d4dff, 0x5f27d6, 0x25105f, 1, 1, 1, 1);
    g.fillEllipse(44, 36, 78, 40);
    g.lineStyle(3, 0xffb3f4, 1);
    g.strokeEllipse(44, 36, 78, 40);
    g.fillGradientStyle(0x78ffff, 0xb7ffff, 0x1fc7ff, 0x613fff, 1, 1, 1, 1);
    g.fillEllipse(44, 25, 29, 22);
    g.lineStyle(2, 0xffffff, 0.85);
    g.strokeEllipse(44, 25, 29, 22);
    g.fillStyle(0xfff06a, 1);
    g.fillTriangle(8, 42, 22, 59, 27, 36);
    g.fillTriangle(80, 42, 66, 59, 61, 36);
    g.fillStyle(0x30ffbd, 1);
    g.fillCircle(22, 39, 5);
    g.fillCircle(44, 42, 6);
    g.fillCircle(66, 39, 5);
    g.lineStyle(2, 0x30ffbd, 0.65);
    g.lineBetween(22, 49, 18, 65);
    g.lineBetween(44, 52, 44, 68);
    g.lineBetween(66, 49, 70, 65);
    g.generateTexture("enemySaucer", 88, 72);

    g.clear();
    g.fillStyle(0xff7b39, 0.18);
    g.fillEllipse(40, 45, 74, 82);
    g.fillGradientStyle(0xffaa43, 0xff4266, 0x8d20ff, 0x1a1048, 1, 1, 1, 1);
    g.beginPath();
    g.moveTo(40, 0);
    g.lineTo(74, 48);
    g.lineTo(55, 86);
    g.lineTo(40, 65);
    g.lineTo(25, 86);
    g.lineTo(6, 48);
    g.closePath();
    g.fillPath();
    g.lineStyle(3, 0xfff0a3, 1);
    g.strokePath();
    g.fillStyle(0x1dffe6, 1);
    g.fillCircle(40, 40, 11);
    g.lineStyle(2, 0xffffff, 0.8);
    g.strokeCircle(40, 40, 15);
    g.lineStyle(2, 0xfff173, 0.7);
    g.lineBetween(21, 45, 8, 52);
    g.lineBetween(59, 45, 72, 52);
    g.fillStyle(0xff4fec, 1);
    g.fillTriangle(28, 74, 35, 92, 40, 67);
    g.fillTriangle(52, 74, 45, 92, 40, 67);
    g.generateTexture("enemyFang", 80, 96);

    g.clear();
    g.fillStyle(0x5cffff, 0.14);
    g.fillCircle(38, 38, 36);
    g.fillGradientStyle(0x39ffff, 0x2b6fff, 0xff4fec, 0x1a1048, 1, 1, 1, 1);
    g.fillCircle(38, 38, 27);
    g.lineStyle(4, 0xffffff, 0.8);
    g.strokeCircle(38, 38, 22);
    g.lineStyle(3, 0xfff173, 0.9);
    g.strokeCircle(38, 38, 10);
    g.fillStyle(0x06111d, 0.9);
    g.fillCircle(38, 38, 6);
    g.generateTexture("enemyOrbiter", 76, 76);

    g.clear();
    g.fillStyle(0xff4fec, 0.12);
    g.fillEllipse(48, 45, 92, 72);
    g.fillGradientStyle(0xff5fc8, 0xfff173, 0x34e7ff, 0x7b4dff, 1, 1, 1, 1);
    g.beginPath();
    g.moveTo(48, 8);
    g.lineTo(92, 50);
    g.lineTo(61, 58);
    g.lineTo(48, 84);
    g.lineTo(35, 58);
    g.lineTo(4, 50);
    g.closePath();
    g.fillPath();
    g.lineStyle(3, 0xffffff, 0.82);
    g.strokePath();
    g.fillStyle(0x07111f, 0.72);
    g.fillEllipse(48, 43, 27, 17);
    g.generateTexture("enemyStingray", 96, 92);

    g.clear();
    g.fillStyle(0xfff173, 0.14);
    g.fillEllipse(56, 48, 105, 82);
    g.fillGradientStyle(0x9d73ff, 0xff4fec, 0x1fe3ff, 0x11265c, 1, 1, 1, 1);
    g.fillRoundedRect(12, 18, 88, 58, 20);
    g.lineStyle(4, 0xfff173, 0.85);
    g.strokeRoundedRect(12, 18, 88, 58, 20);
    g.fillStyle(0x06111d, 0.86);
    g.fillRoundedRect(27, 31, 58, 22, 8);
    g.fillStyle(0x30ffbd, 1);
    g.fillCircle(37, 42, 5);
    g.fillCircle(56, 42, 5);
    g.fillCircle(75, 42, 5);
    g.fillStyle(0xff4fec, 1);
    g.fillTriangle(18, 69, 30, 92, 43, 69);
    g.fillTriangle(70, 69, 83, 92, 95, 69);
    g.generateTexture("enemyCruiser", 112, 100);

    g.clear();
    g.fillStyle(0x22ff91, 0.16);
    g.fillEllipse(46, 50, 86, 70);
    g.fillGradientStyle(0x54ffb1, 0x27d986, 0x115c56, 0x2b1659, 1, 1, 1, 1);
    g.fillRoundedRect(8, 18, 76, 58, 24);
    g.lineStyle(4, 0xff3df2, 1);
    g.strokeRoundedRect(8, 18, 76, 58, 24);
    g.fillStyle(0x07111f, 1);
    g.fillCircle(31, 42, 8);
    g.fillCircle(61, 42, 8);
    g.fillStyle(0xf8ff7c, 1);
    g.fillCircle(31, 42, 3);
    g.fillCircle(61, 42, 3);
    g.fillStyle(0xff3df2, 1);
    g.fillTriangle(16, 69, 24, 92, 34, 70);
    g.fillTriangle(39, 73, 46, 93, 53, 73);
    g.fillTriangle(58, 70, 68, 92, 76, 69);
    g.lineStyle(2, 0xa7ffdd, 0.75);
    g.lineBetween(22, 27, 70, 27);
    g.lineBetween(18, 58, 74, 58);
    g.generateTexture("groundBeast", 92, 96);

    g.clear();
    g.fillStyle(0xfff173, 0.12);
    g.fillEllipse(46, 54, 88, 76);
    g.fillGradientStyle(0xfff173, 0xff7b39, 0xff4f70, 0x4a174f, 1, 1, 1, 1);
    g.fillRoundedRect(10, 32, 72, 36, 16);
    g.fillStyle(0x06111d, 0.86);
    g.fillRoundedRect(22, 41, 48, 12, 6);
    g.lineStyle(4, 0xfff173, 0.9);
    g.lineBetween(46, 34, 46, 6);
    g.strokeCircle(46, 24, 12);
    g.fillStyle(0x30ffbd, 1);
    g.fillCircle(46, 24, 5);
    g.lineStyle(3, 0xffffff, 0.65);
    g.strokeRoundedRect(10, 32, 72, 36, 16);
    g.generateTexture("groundTurret", 92, 84);

    g.clear();
    g.fillStyle(0x30ffbd, 0.12);
    g.fillEllipse(52, 53, 100, 62);
    g.fillGradientStyle(0x30ffbd, 0x5cffff, 0x854cff, 0xff4fec, 1, 1, 1, 1);
    g.fillEllipse(24, 50, 32, 32);
    g.fillEllipse(51, 48, 38, 36);
    g.fillEllipse(78, 51, 32, 31);
    g.lineStyle(3, 0xffffff, 0.7);
    g.strokeEllipse(51, 48, 72, 36);
    g.fillStyle(0x07111f, 0.92);
    g.fillCircle(39, 44, 5);
    g.fillCircle(63, 44, 5);
    g.fillStyle(0xfff173, 1);
    g.fillTriangle(20, 68, 29, 88, 37, 68);
    g.fillTriangle(66, 68, 75, 88, 84, 68);
    g.generateTexture("groundCrawler", 104, 92);

    g.clear();
    g.fillStyle(0x5dffff, 0.18);
    g.fillRoundedRect(4, 0, 24, 56, 12);
    g.fillGradientStyle(0xffffff, 0xa9ffff, 0x38f5ff, 0x247cff, 1, 1, 0.95, 0.95);
    g.fillRoundedRect(11, 2, 10, 48, 5);
    g.lineStyle(2, 0xcaffff, 0.85);
    g.strokeRoundedRect(7, 10, 18, 34, 8);
    g.generateTexture("playerBullet", 32, 56);

    g.clear();
    g.fillStyle(0x30ffbd, 0.16);
    g.fillRoundedRect(3, 0, 22, 62, 10);
    g.fillGradientStyle(0xefffff, 0x30ffbd, 0x30ffbd, 0x066f5b, 1, 1, 1, 1);
    g.fillTriangle(14, 0, 27, 49, 14, 64);
    g.fillTriangle(14, 0, 1, 49, 14, 64);
    g.lineStyle(2, 0xffffff, 0.82);
    g.strokeTriangle(14, 0, 27, 49, 14, 64);
    g.strokeTriangle(14, 0, 1, 49, 14, 64);
    g.generateTexture("pierceBullet", 28, 66);

    g.clear();
    g.fillStyle(0x74ffff, 0.16);
    g.fillRoundedRect(6, 0, 18, 92, 9);
    g.fillGradientStyle(0xffffff, 0x9fffff, 0x5cffff, 0x2b6fff, 1, 1, 0.95, 0.95);
    g.fillRoundedRect(11, 0, 8, 92, 4);
    g.lineStyle(2, 0xffffff, 0.75);
    g.strokeRoundedRect(7, 9, 16, 74, 7);
    g.generateTexture("laserBullet", 30, 96);

    g.clear();
    g.fillStyle(0xfff173, 0.15);
    g.fillEllipse(16, 25, 30, 48);
    g.fillGradientStyle(0xfff173, 0xff7b39, 0xff4fec, 0x7b4dff, 1, 1, 1, 1);
    g.fillTriangle(16, 0, 30, 42, 16, 53);
    g.fillTriangle(16, 0, 2, 42, 16, 53);
    g.fillStyle(0x5cffff, 1);
    g.fillCircle(16, 26, 5);
    g.lineStyle(2, 0xffffff, 0.85);
    g.strokeCircle(16, 26, 9);
    g.generateTexture("homingBullet", 32, 58);

    g.clear();
    g.fillStyle(0xff7b39, 0.16);
    g.fillCircle(22, 22, 21);
    g.fillGradientStyle(0xfff173, 0xff7b39, 0xff4f70, 0xff4fec, 1, 1, 1, 1);
    g.fillCircle(22, 22, 12);
    g.lineStyle(3, 0xffffff, 0.8);
    g.strokeCircle(22, 22, 18);
    g.lineStyle(2, 0xfff173, 0.8);
    g.lineBetween(6, 22, 38, 22);
    g.lineBetween(22, 6, 22, 38);
    g.generateTexture("explosiveBullet", 44, 44);

    g.clear();
    g.fillStyle(0xff4fec, 0.13);
    g.fillEllipse(18, 25, 34, 50);
    g.fillGradientStyle(0xffb3f4, 0xff4fec, 0x7b4dff, 0x39ffff, 1, 1, 1, 1);
    g.fillRoundedRect(11, 1, 14, 48, 7);
    g.lineStyle(3, 0xffffff, 0.75);
    g.beginPath();
    g.arc(18, 25, 15, -1.2, 1.2);
    g.strokePath();
    g.generateTexture("waveBullet", 36, 54);

    g.clear();
    g.fillStyle(0xffe66b, 0.18);
    g.fillCircle(16, 16, 15);
    g.fillStyle(0xffe66b, 1);
    g.fillCircle(16, 16, 9);
    g.fillStyle(0xff3d8d, 0.9);
    g.fillCircle(16, 16, 5);
    g.lineStyle(2, 0xffffff, 0.8);
    g.strokeCircle(16, 16, 12);
    g.generateTexture("enemyBullet", 32, 32);

    g.clear();
    g.fillStyle(0xfff173, 1);
    g.fillTriangle(14, 0, 28, 32, 14, 46);
    g.fillTriangle(18, 0, 4, 32, 18, 46);
    g.lineStyle(2, 0xffffff, 1);
    g.strokeCircle(16, 24, 17);
    g.generateTexture("pickupWeapon", 32, 48);

    g.clear();
    g.fillStyle(0x30ffbd, 1);
    g.fillRoundedRect(7, 4, 18, 38, 7);
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(11, 9, 10, 20, 4);
    g.lineStyle(2, 0x30ffbd, 1);
    g.strokeCircle(16, 24, 21);
    g.generateTexture("pickupFuel", 32, 48);

    g.clear();
    g.fillStyle(0xff4f70, 1);
    g.fillEllipse(16, 23, 22, 38);
    g.fillStyle(0xfff173, 1);
    g.fillTriangle(16, 4, 7, 20, 25, 20);
    g.lineStyle(2, 0xffffff, 1);
    g.strokeCircle(16, 24, 21);
    g.generateTexture("pickupBomb", 32, 48);

    g.clear();
    g.fillStyle(0xfff173, 0.18);
    g.fillCircle(28, 28, 27);
    g.fillGradientStyle(0xfff173, 0xffaa43, 0xff4f70, 0x7b4dff, 1, 1, 1, 1);
    g.fillEllipse(28, 32, 24, 34);
    g.fillStyle(0x06111d, 0.55);
    g.fillEllipse(28, 32, 12, 18);
    g.fillStyle(0xffffff, 0.86);
    g.fillTriangle(28, 5, 16, 25, 40, 25);
    g.lineStyle(3, 0xffffff, 0.85);
    g.strokeCircle(28, 29, 22);
    g.lineStyle(2, 0xfff173, 0.8);
    g.lineBetween(16, 10, 40, 46);
    g.lineBetween(40, 10, 16, 46);
    g.generateTexture("bombButtonIcon", 56, 56);

    g.destroy();
  }

  private createBackground(): void {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x050914);

    const nebula = this.add.graphics();
    nebula.fillGradientStyle(0x0a2d4a, 0x35105a, 0x061824, 0x601354, 0.98, 0.9, 0.95, 0.82);
    nebula.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    nebula.fillStyle(0x29fbff, 0.08);
    nebula.fillEllipse(88, 172, 260, 210);
    nebula.fillStyle(0xff4fec, 0.1);
    nebula.fillEllipse(450, 270, 310, 240);
    nebula.fillStyle(0xfff173, 0.06);
    nebula.fillEllipse(292, 685, 350, 180);
    nebula.lineStyle(1, 0x66ffff, 0.12);
    for (let i = 0; i < 8; i += 1) {
      nebula.lineBetween(-120, 142 + i * 108, GAME_WIDTH + 110, 58 + i * 124);
    }
    nebula.setDepth(0);

    const planet = this.add.circle(GAME_WIDTH - 58, 118, 56, 0x5f2cc8, 0.34).setDepth(1);
    planet.setStrokeStyle(2, 0x9fffff, 0.18);
    this.add.circle(GAME_WIDTH - 74, 103, 18, 0x30ffbd, 0.18).setDepth(1);
    this.add.circle(58, 712, 42, 0xff4fec, 0.12).setDepth(1);

    for (let i = 0; i < 95; i += 1) {
      const size = Phaser.Math.FloatBetween(1.1, 4.2);
      const dot = this.add.circle(
        Phaser.Math.Between(6, GAME_WIDTH - 6),
        Phaser.Math.Between(0, GAME_HEIGHT),
        size,
        Phaser.Math.RND.pick([0x7be8ff, 0xfaf7bd, 0xff8df5, 0xffffff, 0x30ffbd]),
        Phaser.Math.FloatBetween(0.32, 0.98),
      );
      dot.setDepth(1);
      this.stars.push({ dot, speed: Phaser.Math.FloatBetween(40, 185) });
    }

    for (let i = 0; i < 8; i += 1) {
      const y = 80 + i * 135;
      this.add
        .rectangle(GAME_WIDTH / 2, y, GAME_WIDTH * 0.92, 2, 0x51ffff, 0.08)
        .setDepth(1);
      this.add
        .rectangle(GAME_WIDTH / 2, y + 1, GAME_WIDTH * 0.62, 1, 0xff4fec, 0.08)
        .setDepth(1);
    }
  }

  private createPlayer(): void {
    this.player = this.physics.add.sprite(GAME_WIDTH / 2, GAME_HEIGHT - 185, "playerShip");
    this.player.setDepth(20);
    this.player.setScale(0.9);
    this.player.setBlendMode(Phaser.BlendModes.NORMAL);
    this.player.setCircle(31, 29, 24);
    this.player.setCollideWorldBounds(true);
  }

  private createGroups(): void {
    this.bullets = this.physics.add.group({ classType: Phaser.Physics.Arcade.Image, maxSize: 90 });
    this.enemies = this.physics.add.group({ maxSize: 64 });
    this.enemyBullets = this.physics.add.group({ classType: Phaser.Physics.Arcade.Image, maxSize: 90 });
    this.pickups = this.physics.add.group({ classType: Phaser.Physics.Arcade.Image, maxSize: 24 });
  }

  private createHud(): void {
    const hudStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: "Inter, Arial, sans-serif",
      fontSize: "17px",
      color: "#e8fbff",
      stroke: "#06111d",
      strokeThickness: 4,
    };
    const smallStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      ...hudStyle,
      fontSize: "14px",
      color: "#aef7ff",
    };

    this.add.rectangle(GAME_WIDTH / 2, 49, GAME_WIDTH - 26, 82, 0x07111f, 0.32).setDepth(76);
    this.add.rectangle(GAME_WIDTH / 2, 89, GAME_WIDTH - 42, 2, 0x5cffff, 0.18).setDepth(77);
    this.add.rectangle(97, 59, 158, 2, 0xff4fec, 0.16).setDepth(77);
    this.add.rectangle(GAME_WIDTH - 97, 59, 158, 2, 0x30ffbd, 0.16).setDepth(77);

    this.scoreText = this.add.text(20, 16, "SCORE 0000000", hudStyle).setDepth(80);
    this.killsText = this.add.text(20, 42, "KILLS 0", smallStyle).setDepth(80);
    this.livesText = this.add.text(GAME_WIDTH - 20, 16, "LIVES 10", hudStyle).setOrigin(1, 0).setDepth(80);
    this.weaponText = this.add.text(GAME_WIDTH - 20, 42, "PULSE 1", smallStyle).setOrigin(1, 0).setDepth(80);
    this.bombsText = this.add.text(GAME_WIDTH - 20, 68, "BOMBS 3", smallStyle).setOrigin(1, 0).setDepth(80);
    this.progressText = this.add.text(GAME_WIDTH / 2, 18, "WAVE 1", smallStyle).setOrigin(0.5, 0).setDepth(80);

    this.fuelBarBack = this.add.rectangle(20, 78, 154, 10, 0x163445, 0.95).setOrigin(0, 0).setDepth(80);
    this.fuelBar = this.add.rectangle(20, 78, 1, 10, 0x31ffbd, 1).setOrigin(0, 0).setDepth(81);
    this.fuelText = this.add.text(20, 91, "FUEL READY ON PICKUP", {
      ...smallStyle,
      fontSize: "11px",
      color: "#80ffc9",
    }).setDepth(80);

    const panel = this.add.rectangle(0, 0, 360, 190, 0x06111d, 0.82);
    panel.setStrokeStyle(2, 0xff5fc8, 0.85);
    const title = this.add.text(0, -48, "GAME OVER", {
      fontFamily: "Inter, Arial, sans-serif",
      fontSize: "34px",
      color: "#ffffff",
      stroke: "#25051d",
      strokeThickness: 6,
    }).setOrigin(0.5);
    const prompt = this.add.text(0, 12, "TAP TO CONTINUE", {
      fontFamily: "Inter, Arial, sans-serif",
      fontSize: "18px",
      color: "#80ffc9",
      stroke: "#06111d",
      strokeThickness: 4,
    }).setOrigin(0.5);
    const note = this.add.text(0, 52, "10 lives restored", {
      fontFamily: "Inter, Arial, sans-serif",
      fontSize: "13px",
      color: "#b8d7e8",
      stroke: "#06111d",
      strokeThickness: 3,
    }).setOrigin(0.5);
    this.gameOverLayer = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT * 0.42, [panel, title, prompt, note]);
    this.gameOverLayer.setDepth(130).setVisible(false);
  }

  private createJoysticks(): void {
    this.leftStick = this.makeJoystick("left", 118, GAME_HEIGHT - 122);
    this.rightStick = this.makeJoystick("right", GAME_WIDTH - 124, GAME_HEIGHT - 118);
    this.bombButton = this.makeBombButton(GAME_WIDTH - 66, GAME_HEIGHT - 236);
  }

  private makeJoystick(side: "left" | "right", x: number, y: number): VirtualJoystick {
    const baseColor = side === "left" ? 0x6ee7ff : 0xff5fc8;
    const scale = side === "right" ? 0.74 : 1;
    const halo = this.add.circle(x, y, 88 * scale, baseColor, 0.06);
    halo.setDepth(89);
    const base = this.add.circle(x, y, 76 * scale, baseColor, 0.13);
    base.setStrokeStyle(4, baseColor, 0.42).setDepth(90);
    const inner = this.add.circle(x, y, 43 * scale, baseColor, 0.08);
    inner.setStrokeStyle(2, baseColor, 0.26).setDepth(91);
    const thumb = this.add.circle(x, y, 28 * scale, baseColor, 0.48);
    thumb.setStrokeStyle(2, 0xffffff, 0.72).setDepth(92);
    const shine = this.add.circle(x, y, 16 * scale, 0xffffff, 0.08);
    shine.setDepth(93);

    return {
      side,
      halo,
      base,
      inner,
      thumb,
      shine,
      center: new Phaser.Math.Vector2(x, y),
      vector: new Phaser.Math.Vector2(0, 0),
      radius: 66 * scale,
      pointerId: null,
      active: false,
      outerRelease: false,
    };
  }

  private makeBombButton(x: number, y: number): ActionButton {
    const base = this.add.circle(x, y, 45, 0xfff173, 0.1);
    base.setStrokeStyle(3, 0xfff173, 0.55).setDepth(92);
    const inner = this.add.circle(x, y, 29, 0xff4f70, 0.22);
    inner.setStrokeStyle(2, 0xffffff, 0.35).setDepth(93);
    const icon = this.add.image(x, y, "bombButtonIcon");
    icon.setDepth(94).setScale(0.82).setAlpha(0.9);

    return {
      base,
      inner,
      icon,
      pointerId: null,
      center: new Phaser.Math.Vector2(x, y),
      radius: 51,
    };
  }

  private registerInput(): void {
    this.input.on("pointerdown", this.handlePointerDown, this);
    this.input.on("pointermove", this.handlePointerMove, this);
    this.input.on("pointerup", this.handlePointerUp, this);
    this.input.on("pointerupoutside", this.handlePointerUp, this);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = this.input.keyboard!.addKeys("W,A,S,D,SPACE,SHIFT") as Record<string, Phaser.Input.Keyboard.Key>;
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.gameOver) {
      this.continueGame();
      return;
    }

    if (this.isBombPointer(pointer)) {
      this.bombButton.pointerId = pointer.id;
      this.pressBombButton();
      return;
    }

    const side = pointer.x < GAME_WIDTH / 2 ? this.leftStick : this.rightStick;
    if (side.pointerId !== null) {
      return;
    }
    side.pointerId = pointer.id;
    side.active = true;
    side.center.set(pointer.x, pointer.y);
    side.halo.setPosition(pointer.x, pointer.y).setAlpha(1);
    side.base.setPosition(pointer.x, pointer.y).setAlpha(0.95);
    side.inner.setPosition(pointer.x, pointer.y).setAlpha(0.9);
    side.thumb.setPosition(pointer.x, pointer.y).setAlpha(1);
    side.shine.setPosition(pointer.x, pointer.y).setAlpha(1);
    this.updateJoystick(side, pointer);
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.leftStick.pointerId === pointer.id) {
      this.updateJoystick(this.leftStick, pointer);
    }
    if (this.rightStick.pointerId === pointer.id) {
      this.updateJoystick(this.rightStick, pointer);
    }
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer): void {
    if (this.bombButton.pointerId === pointer.id) {
      this.releaseBombButton();
      return;
    }

    if (this.leftStick.pointerId === pointer.id) {
      this.releaseJoystick(this.leftStick);
    }
    if (this.rightStick.pointerId === pointer.id) {
      this.releaseJoystick(this.rightStick);
    }
  }

  private isBombPointer(pointer: Phaser.Input.Pointer): boolean {
    if (this.bombButton.pointerId !== null || pointer.x < GAME_WIDTH / 2) {
      return false;
    }

    return Phaser.Math.Distance.Between(
      pointer.x,
      pointer.y,
      this.bombButton.center.x,
      this.bombButton.center.y,
    ) <= this.bombButton.radius;
  }

  private pressBombButton(): void {
    this.bombButton.base.setScale(1.12).setAlpha(1);
    this.bombButton.inner.setScale(1.08).setAlpha(1);
    this.bombButton.icon.setScale(0.92).setAlpha(1);
    this.dropBomb();
  }

  private releaseBombButton(): void {
    this.bombButton.pointerId = null;
    this.bombButton.base.setScale(1).setAlpha(1);
    this.bombButton.inner.setScale(1).setAlpha(1);
    this.bombButton.icon.setScale(0.82).setAlpha(0.9);
  }

  private updateJoystick(stick: VirtualJoystick, pointer: Phaser.Input.Pointer): void {
    const dx = pointer.x - stick.center.x;
    const dy = pointer.y - stick.center.y;
    const distance = Math.min(Math.sqrt(dx * dx + dy * dy), stick.radius);
    const angle = Math.atan2(dy, dx);
    const thumbX = stick.center.x + Math.cos(angle) * distance;
    const thumbY = stick.center.y + Math.sin(angle) * distance;

    stick.vector.set(Math.cos(angle) * (distance / stick.radius), Math.sin(angle) * (distance / stick.radius));
    if (distance < 8) {
      stick.vector.set(0, 0);
    }
    stick.thumb.setPosition(thumbX, thumbY);
    stick.shine.setPosition(thumbX - 7, thumbY - 7);
    stick.outerRelease = false;

    const alpha = stick.active ? 0.7 : 0.45;
    stick.thumb.setAlpha(alpha);
    stick.base.setScale(1);
    stick.halo.setScale(1);
  }

  private releaseJoystick(stick: VirtualJoystick): void {
    stick.pointerId = null;
    stick.active = false;
    stick.outerRelease = false;
    stick.vector.set(0, 0);

    const homeX = stick.side === "left" ? 118 : GAME_WIDTH - 124;
    const homeY = stick.side === "left" ? GAME_HEIGHT - 122 : GAME_HEIGHT - 118;
    stick.center.set(homeX, homeY);
    stick.halo.setPosition(homeX, homeY).setAlpha(1).setScale(1);
    stick.base.setPosition(homeX, homeY).setAlpha(1).setScale(1);
    stick.inner.setPosition(homeX, homeY).setAlpha(1);
    stick.thumb.setPosition(homeX, homeY).setAlpha(0.45);
    stick.shine.setPosition(homeX, homeY).setAlpha(0.75);
  }

  private updateStars(dt: number): void {
    for (const star of this.stars) {
      star.dot.y += star.speed * dt;
      if (star.dot.y > GAME_HEIGHT + 10) {
        star.dot.y = -10;
        star.dot.x = Phaser.Math.Between(6, GAME_WIDTH - 6);
      }
    }
  }

  private updatePlayer(time: number, dt: number): void {
    const keyboardVector = new Phaser.Math.Vector2(0, 0);
    if (this.cursors.left?.isDown || this.keys.A.isDown) keyboardVector.x -= 1;
    if (this.cursors.right?.isDown || this.keys.D.isDown) keyboardVector.x += 1;
    if (this.cursors.up?.isDown || this.keys.W.isDown) keyboardVector.y -= 1;
    if (this.cursors.down?.isDown || this.keys.S.isDown) keyboardVector.y += 1;
    if (keyboardVector.lengthSq() > 0) {
      keyboardVector.normalize();
    }

    const vector = this.leftStick.active ? this.leftStick.vector : keyboardVector;
    const speed = this.isOverdrive(time) ? 375 : 315;
    this.player.x = clamp(this.player.x + vector.x * speed * dt, 32, GAME_WIDTH - 32);
    this.player.y = clamp(this.player.y + vector.y * speed * dt, 94, GAME_HEIGHT - 110);
    this.player.setVelocity(0, 0);

    const tilt = clamp(vector.x * 12, -12, 12);
    this.player.setAngle(tilt);
    if (this.isOverdrive(time)) {
      this.player.setTint(0xcfffff);
    } else {
      this.player.clearTint();
    }
    this.player.setAlpha(time < this.invulnerableUntil && Math.floor(time / 85) % 2 === 0 ? 0.35 : 1);
    if (time > this.nextTrailAt) {
      this.nextTrailAt = time + (this.isOverdrive(time) ? 28 : 48);
      this.emitEngineTrail(this.isOverdrive(time));
    }
  }

  private emitEngineTrail(overdrive: boolean): void {
    const colors = overdrive ? [0x30ffbd, 0x5cffff, 0xfff173] : [0xff4fec, 0x5cffff];
    for (let i = 0; i < (overdrive ? 4 : 2); i += 1) {
      const x = this.player.x + Phaser.Math.Between(-18, 18);
      const y = this.player.y + Phaser.Math.Between(33, 45);
      const flare = this.add.circle(
        x,
        y,
        Phaser.Math.FloatBetween(4, overdrive ? 9 : 7),
        Phaser.Math.RND.pick(colors),
        overdrive ? 0.62 : 0.42,
      );
      flare.setDepth(13);
      flare.setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: flare,
        y: y + Phaser.Math.Between(28, 52),
        x: x + Phaser.Math.Between(-10, 10),
        alpha: 0,
        scale: 0.25,
        duration: overdrive ? 300 : 420,
        ease: "Sine.easeOut",
        onComplete: () => flare.destroy(),
      });
    }
  }

  private weaponLabel(weapon: WeaponType = this.currentWeapon): string {
    const labels: Record<WeaponType, string> = {
      pulse: "PULSE",
      pierce: "PIERCE",
      laser: "LASER",
      homing: "HOMING",
      explosive: "BLAST",
      wave: "WAVE",
    };
    return labels[weapon];
  }

  private weaponTexture(weapon: WeaponType): string {
    const textures: Record<WeaponType, string> = {
      pulse: "playerBullet",
      pierce: "pierceBullet",
      laser: "laserBullet",
      homing: "homingBullet",
      explosive: "explosiveBullet",
      wave: "waveBullet",
    };
    return textures[weapon];
  }

  private randomWeaponType(): WeaponType {
    return Phaser.Math.RND.pick<WeaponType>(["pulse", "pierce", "laser", "homing", "explosive", "wave"]);
  }

  private applyWeaponPickup(nextWeapon: WeaponType): void {
    if (nextWeapon === this.currentWeapon) {
      this.weaponLevel = clamp(this.weaponLevel + 1, 1, 6);
      this.flashBanner(`${this.weaponLabel()} LV ${this.weaponLevel}`);
      return;
    }

    this.currentWeapon = nextWeapon;
    this.weaponLevel = 1;
    this.flashBanner(`${this.weaponLabel()} READY`);
  }

  private startOverdrive(): void {
    this.overdriveUntil = this.time.now + 8500;
    this.score += 750;
    this.flashBanner("OVERDRIVE");
    this.cameras.main.flash(110, 48, 255, 189, false);
  }

  private updateFiring(time: number): void {
    const keyboardFiring = this.keys.SPACE.isDown;
    const isFiring = this.rightStick.active || keyboardFiring;
    if (!isFiring || time < this.nextShotAt) {
      return;
    }

    const overdrive = this.isOverdrive(time);
    const weaponDelay: Record<WeaponType, number> = {
      pulse: 150,
      pierce: 170,
      laser: 118,
      homing: 235,
      explosive: 260,
      wave: 135,
    };
    const interval = overdrive ? Math.max(58, weaponDelay[this.currentWeapon] * 0.52) : Math.max(78, weaponDelay[this.currentWeapon] - this.weaponLevel * 12);
    this.nextShotAt = time + interval;

    const aim = this.rightStick.active && this.rightStick.vector.lengthSq() > 0.05
      ? this.rightStick.vector.clone().normalize()
      : new Phaser.Math.Vector2(0, -1);

    if (aim.y > 0.35) {
      aim.y = -0.45;
      aim.normalize();
    }

    const level = overdrive ? Math.min(6, this.weaponLevel + 2) : this.weaponLevel;
    this.firePattern(aim, level, overdrive);
  }

  private firePattern(direction: Phaser.Math.Vector2, level: number, overdrive: boolean): void {
    const damageBoost = overdrive ? 1 : 0;

    if (this.currentWeapon === "pulse") {
      const spread = level >= 4 ? 0.26 : level >= 2 ? 0.16 : 0.08;
      const shots = level >= 5 ? [-2, -1, 0, 1, 2] : level >= 3 ? [-1, 0, 1] : [-0.55, 0.55];
      const offsets = shots.length === 2 ? [-12, 12] : shots.map((_, index) => (index - (shots.length - 1) / 2) * 13);
      shots.forEach((shot, index) => {
        this.spawnBullet(this.player.x + offsets[index], this.player.y - 32, direction.clone().rotate(shot * spread), 1 + damageBoost, "pulse");
      });
      return;
    }

    if (this.currentWeapon === "pierce") {
      const shots = level >= 5 ? [-1, 0, 1] : level >= 3 ? [-0.7, 0.7] : [0];
      shots.forEach((shot, index) => {
        this.spawnBullet(this.player.x + (index - (shots.length - 1) / 2) * 18, this.player.y - 35, direction.clone().rotate(shot * 0.12), 2 + damageBoost, "pierce", {
          pierceRemaining: 1 + Math.floor(level / 2) + (overdrive ? 1 : 0),
          speed: 760,
        });
      });
      return;
    }

    if (this.currentWeapon === "laser") {
      const offsets = level >= 4 ? [-18, 0, 18] : level >= 2 ? [-12, 12] : [0];
      offsets.forEach((offset) => {
        this.spawnBullet(this.player.x + offset, this.player.y - 46, direction.clone(), 1 + damageBoost, "laser", {
          speed: 920,
          pierceRemaining: overdrive ? 2 : 1,
          heavy: true,
        });
      });
      return;
    }

    if (this.currentWeapon === "homing") {
      const count = Math.min(4, 1 + Math.floor(level / 2) + (overdrive ? 1 : 0));
      for (let i = 0; i < count; i += 1) {
        const offset = (i - (count - 1) / 2) * 20;
        this.spawnBullet(this.player.x + offset, this.player.y - 30, direction.clone().rotate(offset * 0.006), 2 + damageBoost, "homing", {
          speed: 520,
        });
      }
      return;
    }

    if (this.currentWeapon === "explosive") {
      const shots = level >= 5 ? [-0.7, 0, 0.7] : level >= 3 ? [-0.45, 0.45] : [0];
      shots.forEach((shot, index) => {
        this.spawnBullet(this.player.x + (index - (shots.length - 1) / 2) * 16, this.player.y - 34, direction.clone().rotate(shot * 0.2), 2 + damageBoost, "explosive", {
          speed: 470,
          blastRadius: 54 + level * 8 + (overdrive ? 24 : 0),
          heavy: true,
        });
      });
      return;
    }

    const shots = level >= 4 ? [-2, -1, 0, 1, 2] : level >= 2 ? [-1, 0, 1] : [-0.5, 0.5];
    shots.forEach((shot, index) => {
      this.spawnBullet(this.player.x + (index - (shots.length - 1) / 2) * 12, this.player.y - 32, direction.clone().rotate(shot * 0.1), 1 + damageBoost, "wave", {
        speed: 620,
        wavePhase: shot * 1.7,
      });
    });
  }

  private spawnBullet(
    x: number,
    y: number,
    direction: Phaser.Math.Vector2,
    damage: number,
    weapon: WeaponType = this.currentWeapon,
    options: {
      heavy?: boolean;
      speed?: number;
      pierceRemaining?: number;
      blastRadius?: number;
      wavePhase?: number;
    } = {},
  ): void {
    const bullet = this.bullets.get(x, y, this.weaponTexture(weapon)) as Phaser.Physics.Arcade.Image | null;
    if (!bullet) return;

    bullet.setActive(true).setVisible(true).setPosition(x, y).setDepth(18);
    bullet.setTexture(this.weaponTexture(weapon));
    bullet.setScale(options.heavy ? 1.28 : weapon === "laser" ? 1.12 : weapon === "explosive" ? 0.95 : 1);
    bullet.setBlendMode(Phaser.BlendModes.ADD);
    bullet.setAngle(Phaser.Math.RadToDeg(direction.angle()) + 90);
    bullet.setData("damage", damage);
    bullet.setData("weapon", weapon);
    bullet.setData("pierceRemaining", options.pierceRemaining ?? 0);
    bullet.setData("blastRadius", options.blastRadius ?? 0);
    bullet.setData("wavePhase", options.wavePhase ?? 0);
    bullet.setData("baseX", x);
    bullet.setData("born", this.time.now);
    if (bullet.body) {
      bullet.body.enable = true;
      bullet.body.reset(x, y);
    }
    const speed = options.speed ?? 680;
    bullet.setVelocity(direction.x * speed, direction.y * speed);
  }

  private updateSpawns(time: number): void {
    const elapsed = time - this.stageStart;
    const difficulty = clamp(elapsed / 90000, 0, 1);

    if (time > this.nextEnemyAt && !this.bossDefeated) {
      this.spawnEnemy(difficulty);
      this.nextEnemyAt = time + Phaser.Math.Between(520, Math.max(860, 1320 - difficulty * 550));
    }

    if (time > this.nextGroundAt && !this.bossDefeated) {
      this.spawnGroundBeast(difficulty);
      this.nextGroundAt = time + Phaser.Math.Between(2400, Math.max(3200, 4400 - difficulty * 900));
    }

    if (!this.bossSpawned && elapsed > 68000) {
      this.bossSpawned = true;
      this.spawnBoss();
    }
  }

  private spawnEnemy(difficulty: number): void {
    const key = Phaser.Math.RND.pick(["enemySaucer", "enemyFang", "enemyOrbiter", "enemyStingray", "enemyCruiser"]);
    const enemy = this.enemies.get(Phaser.Math.Between(44, GAME_WIDTH - 44), -60, key) as Phaser.Physics.Arcade.Sprite | null;
    if (!enemy) return;

    const hpByType: Record<string, number> = {
      enemySaucer: 3 + difficulty * 4,
      enemyFang: 5 + difficulty * 5,
      enemyOrbiter: 4 + difficulty * 5,
      enemyStingray: 6 + difficulty * 6,
      enemyCruiser: 12 + difficulty * 10,
    };
    const pointsByType: Record<string, number> = {
      enemySaucer: 120,
      enemyFang: 180,
      enemyOrbiter: 160,
      enemyStingray: 240,
      enemyCruiser: 420,
    };
    const hp = hpByType[key];
    enemy.setActive(true).setVisible(true).setTexture(key).setDepth(14);
    enemy.setScale(key === "enemyCruiser" ? 0.86 : key === "enemyFang" ? 0.82 : 0.9);
    if (enemy.body) {
      enemy.body.enable = true;
      enemy.body.reset(enemy.x, -60);
    }
    if (key === "enemyFang") {
      enemy.setCircle(29, 11, 17);
    } else if (key === "enemyStingray") {
      enemy.setCircle(34, 14, 18);
    } else if (key === "enemyCruiser") {
      enemy.setCircle(40, 16, 14);
    } else if (key === "enemyOrbiter") {
      enemy.setCircle(26, 12, 12);
    } else {
      enemy.setCircle(29, 15, 8);
    }
    enemy.setData({
      hp,
      maxHp: hp,
      points: pointsByType[key],
      speed: Phaser.Math.Between(78, key === "enemyCruiser" ? 112 : 152) + difficulty * 46,
      drift: Phaser.Math.FloatBetween(-1.7, 1.7),
      born: this.time.now,
      shootAt: this.time.now + Phaser.Math.Between(900, 1700),
      kind: "air",
      pattern: key,
    });
  }

  private spawnGroundBeast(difficulty: number): void {
    const key = Phaser.Math.RND.pick(["groundBeast", "groundTurret", "groundCrawler"]);
    const beast = this.enemies.get(Phaser.Math.Between(52, GAME_WIDTH - 52), -70, key) as Phaser.Physics.Arcade.Sprite | null;
    if (!beast) return;

    const hp = key === "groundTurret" ? 12 + difficulty * 14 : key === "groundCrawler" ? 14 + difficulty * 14 : 10 + difficulty * 12;
    beast.setActive(true).setVisible(true).setTexture(key).setDepth(12);
    beast.setScale(key === "groundCrawler" ? 0.9 : 0.95);
    if (beast.body) {
      beast.body.enable = true;
      beast.body.reset(beast.x, -70);
    }
    if (key === "groundTurret") {
      beast.setCircle(31, 15, 13);
    } else if (key === "groundCrawler") {
      beast.setCircle(36, 16, 16);
    } else {
      beast.setCircle(35, 11, 15);
    }
    beast.setData({
      hp,
      maxHp: hp,
      points: key === "groundTurret" ? 360 : key === "groundCrawler" ? 420 : 320,
      speed: 62 + difficulty * 32,
      drift: Phaser.Math.FloatBetween(-0.55, 0.55),
      born: this.time.now,
      shootAt: this.time.now + Phaser.Math.Between(1200, 2100),
      kind: "ground",
      pattern: key,
    });
  }

  private spawnBoss(): void {
    const boss = this.enemies.get(GAME_WIDTH / 2, -120, "enemySaucer") as Phaser.Physics.Arcade.Sprite | null;
    if (!boss) return;

    boss.setActive(true).setVisible(true).setTexture("enemySaucer").setDepth(15);
    boss.setScale(2.35);
    if (boss.body) {
      boss.body.enable = true;
      boss.body.reset(GAME_WIDTH / 2, -120);
    }
    boss.setCircle(30, 14, 7);
    boss.setData({
      hp: 420,
      maxHp: 420,
      points: 6000,
      speed: 38,
      drift: 1,
      born: this.time.now,
      shootAt: this.time.now + 600,
      kind: "boss",
    });

    this.flashBanner("MOTHERSHIP BREACH");
  }

  private updateEnemies(time: number, dt: number): void {
    this.enemies.children.each((child) => {
      const enemy = child as Phaser.Physics.Arcade.Sprite;
      if (!enemy.active) return true;

      const kind = enemy.getData("kind") as string;
      const speed = Number(enemy.getData("speed"));
      const drift = Number(enemy.getData("drift"));
      const born = Number(enemy.getData("born"));

      if (kind === "boss") {
        const targetY = 132;
        if (enemy.y < targetY) {
          enemy.y += speed * 2.2 * dt;
        }
        enemy.x = GAME_WIDTH / 2 + Math.sin((time - born) / 900) * 145;
        enemy.setAngle(Math.sin((time - born) / 600) * 4);
      } else {
        enemy.y += speed * dt;
        enemy.x += Math.sin((time - born) / 420) * drift;
        enemy.setAngle(Math.sin((time - born) / 300) * 7);
      }

      if (time > Number(enemy.getData("shootAt"))) {
        this.enemyShoot(enemy, kind);
        enemy.setData("shootAt", time + (kind === "boss" ? 420 : Phaser.Math.Between(1050, 2100)));
      }

      if (enemy.y > GAME_HEIGHT + 95) {
        this.recycleSprite(enemy);
      }
      return true;
    });
  }

  private enemyShoot(enemy: Phaser.Physics.Arcade.Sprite, kind: string): void {
    const aim = new Phaser.Math.Vector2(this.player.x - enemy.x, this.player.y - enemy.y).normalize();
    const pattern = (enemy.getData("pattern") as string | undefined) ?? kind;
    const shots =
      kind === "boss" ? [-0.45, -0.22, 0, 0.22, 0.45] :
      pattern === "enemyCruiser" ? [-0.34, 0, 0.34] :
      pattern === "enemyStingray" ? [-0.22, 0.22] :
      pattern === "enemyOrbiter" ? [-0.14, 0.14] :
      pattern === "groundTurret" ? [-0.3, 0, 0.3] :
      pattern === "groundCrawler" ? [-0.18, 0.18] :
      kind === "ground" ? [-0.18, 0.18] :
      [0];

    for (const rotation of shots) {
      const direction = aim.clone().rotate(rotation);
      const bullet = this.enemyBullets.get(enemy.x, enemy.y + 24, "enemyBullet") as Phaser.Physics.Arcade.Image | null;
      if (!bullet) continue;
      bullet.setActive(true).setVisible(true).setTexture("enemyBullet").setDepth(17);
      if (bullet.body) {
        bullet.body.enable = true;
        bullet.body.reset(enemy.x, enemy.y + 24);
      }
      bullet.setScale(kind === "boss" || pattern === "enemyCruiser" ? 1.2 : pattern === "enemyOrbiter" ? 0.82 : 0.95);
      bullet.setBlendMode(Phaser.BlendModes.ADD);
      const speed = pattern === "enemyOrbiter" ? 285 : pattern === "groundTurret" ? 255 : 235;
      bullet.setVelocity(direction.x * speed, direction.y * speed);
    }
  }

  private updateEnemyBullets(): void {
    this.enemyBullets.children.each((child) => {
      const bullet = child as Phaser.Physics.Arcade.Image;
      if (!bullet.active) return true;
      if (bullet.x < -40 || bullet.x > GAME_WIDTH + 40 || bullet.y < -50 || bullet.y > GAME_HEIGHT + 55) {
        this.recycleImage(bullet);
      }
      return true;
    });
  }

  private updateBullets(time: number, dt: number): void {
    this.bullets.children.each((child) => {
      const bullet = child as Phaser.Physics.Arcade.Image;
      if (!bullet.active) return true;
      const weapon = bullet.getData("weapon") as WeaponType | undefined;
      if (weapon === "homing") {
        const target = this.findClosestEnemy(bullet.x, bullet.y, 380);
        if (target) {
          const desired = new Phaser.Math.Vector2(target.x - bullet.x, target.y - bullet.y).normalize().scale(560);
          bullet.setVelocity(
            Phaser.Math.Linear(bullet.body!.velocity.x, desired.x, clamp(dt * 4.5, 0, 1)),
            Phaser.Math.Linear(bullet.body!.velocity.y, desired.y, clamp(dt * 4.5, 0, 1)),
          );
          bullet.setAngle(Phaser.Math.RadToDeg(Math.atan2(bullet.body!.velocity.y, bullet.body!.velocity.x)) + 90);
        }
      }
      if (weapon === "wave") {
        const born = Number(bullet.getData("born") ?? time);
        const phase = Number(bullet.getData("wavePhase") ?? 0);
        const baseX = Number(bullet.getData("baseX") ?? bullet.x);
        bullet.x = baseX + Math.sin((time - born) / 130 + phase) * 42;
      }
      if (bullet.x < -40 || bullet.x > GAME_WIDTH + 40 || bullet.y < -70 || bullet.y > GAME_HEIGHT + 70) {
        this.recycleImage(bullet);
      }
      return true;
    });
  }

  private findClosestEnemy(x: number, y: number, maxDistance = 420): Phaser.Physics.Arcade.Sprite | null {
    let closest: Phaser.Physics.Arcade.Sprite | null = null;
    let closestDistance = maxDistance;
    this.enemies.children.each((child) => {
      const enemy = child as Phaser.Physics.Arcade.Sprite;
      if (!enemy.active) return true;
      const distance = Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y);
      if (distance < closestDistance) {
        closestDistance = distance;
        closest = enemy;
      }
      return true;
    });
    return closest;
  }

  private updatePickups(): void {
    this.pickups.children.each((child) => {
      const pickup = child as Phaser.Physics.Arcade.Image;
      if (!pickup.active) return true;
      pickup.angle += 3;
      if (pickup.y > GAME_HEIGHT + 40) {
        this.recycleImage(pickup);
      }
      return true;
    });
  }

  private onBulletHitsEnemy(
    bulletObj: ArcadeOverlapObject,
    enemyObj: ArcadeOverlapObject,
  ): void {
    if (!(bulletObj instanceof Phaser.Physics.Arcade.Image) || !(enemyObj instanceof Phaser.Physics.Arcade.Sprite)) {
      return;
    }
    if (!bulletObj.active || !enemyObj.active || this.gameOver) {
      return;
    }

    const weapon = (bulletObj.getData("weapon") as WeaponType | undefined) ?? "pulse";
    const damage = Number(bulletObj.getData("damage") ?? 1);
    const nextHp = Number(enemyObj.getData("hp")) - damage;
    enemyObj.setData("hp", nextHp);
    const hitColor = weapon === "pierce" ? 0x30ffbd : weapon === "laser" ? 0x9fffff : weapon === "homing" ? 0xfff173 : weapon === "explosive" ? 0xff7b39 : weapon === "wave" ? 0xff4fec : 0x9fffff;
    this.spark(enemyObj.x, enemyObj.y, hitColor, 0.75);

    if (nextHp <= 0) {
      this.destroyEnemy(enemyObj);
    } else {
      enemyObj.setTint(0xffffff);
      this.time.delayedCall(50, () => enemyObj.clearTint());
    }

    if (weapon === "explosive") {
      this.applyBlastDamage(enemyObj.x, enemyObj.y, Number(bulletObj.getData("blastRadius") ?? 58), damage);
      this.recycleImage(bulletObj);
      return;
    }

    const pierceRemaining = Number(bulletObj.getData("pierceRemaining") ?? 0);
    if (pierceRemaining > 0) {
      bulletObj.setData("pierceRemaining", pierceRemaining - 1);
      return;
    }

    this.recycleImage(bulletObj);
  }

  private applyBlastDamage(x: number, y: number, blastRadius: number, baseDamage: number): void {
    this.explosion(x, y, 0xff7b39, 0.78);
    this.enemies.children.each((child) => {
      const enemy = child as Phaser.Physics.Arcade.Sprite;
      if (!enemy.active) return true;
      const distance = Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y);
      if (distance > blastRadius) return true;
      enemy.setData("hp", Number(enemy.getData("hp")) - Math.max(1, baseDamage * 0.75));
      if (Number(enemy.getData("hp")) <= 0) {
        this.destroyEnemy(enemy);
      } else {
        enemy.setTint(0xfff173);
        this.time.delayedCall(70, () => enemy.clearTint());
      }
      return true;
    });
  }

  private onPlayerHit(
    playerObj: ArcadeOverlapObject,
    threatObj: ArcadeOverlapObject,
  ): void {
    if (!(playerObj instanceof Phaser.Physics.Arcade.Sprite)) return;
    if (this.gameOver || this.time.now < this.invulnerableUntil) return;

    if (threatObj instanceof Phaser.Physics.Arcade.Image) {
      this.recycleImage(threatObj);
    }
    if (threatObj instanceof Phaser.Physics.Arcade.Sprite && threatObj !== this.player) {
      this.destroyEnemy(threatObj, false);
    }

    this.lives -= 1;
    this.invulnerableUntil = this.time.now + 1800;
    this.cameras.main.shake(180, 0.01);
    this.explosion(this.player.x, this.player.y, 0xff4f70, 1.2);

    if (this.lives <= 0) {
      this.enterGameOver();
    }
  }

  private onPickup(
    playerObj: ArcadeOverlapObject,
    pickupObj: ArcadeOverlapObject,
  ): void {
    if (!(playerObj instanceof Phaser.Physics.Arcade.Sprite) || !(pickupObj instanceof Phaser.Physics.Arcade.Image)) {
      return;
    }

    const kind = pickupObj.getData("kind") as PickupKind;
    this.recycleImage(pickupObj);
    this.spark(playerObj.x, playerObj.y, kind === "fuel" ? 0x30ffbd : 0xfff173, 1.4);

    if (kind === "weapon") {
      this.applyWeaponPickup((pickupObj.getData("weaponType") as WeaponType | undefined) ?? this.randomWeaponType());
      this.score += 500;
    }
    if (kind === "bomb") {
      this.bombs = clamp(this.bombs + 1, 0, BOMB_MAX);
      this.score += 300;
    }
    if (kind === "fuel") {
      this.startOverdrive();
    }
  }

  private destroyEnemy(enemy: Phaser.Physics.Arcade.Sprite, award = true): void {
    if (!enemy.active) {
      return;
    }

    const points = Number(enemy.getData("points") ?? 100);
    const kind = enemy.getData("kind") as string;
    this.explosion(enemy.x, enemy.y, kind === "ground" ? 0x30ffbd : 0xff60db, kind === "boss" ? 2.4 : 1);

    if (award) {
      this.score += points;
      this.kills += 1;
      this.maybeDropPickup(enemy.x, enemy.y, kind);
    }

    if (kind === "boss" && !this.bossDefeated) {
      this.bossDefeated = true;
      this.score += 12000;
      this.flashBanner("PROTOTYPE CLEAR");
      this.time.delayedCall(2500, () => {
        this.bossSpawned = false;
        this.bossDefeated = false;
        this.stageStart = this.time.now;
      });
    }

    this.recycleSprite(enemy);
  }

  private maybeDropPickup(x: number, y: number, kind: string): void {
    const roll = Math.random();
    let pickupKind: PickupKind | null = null;
    if (kind === "boss") {
      pickupKind = "weapon";
    } else if (roll < 0.09) {
      pickupKind = "fuel";
    } else if (roll < 0.16) {
      pickupKind = "weapon";
    } else if (roll < 0.21) {
      pickupKind = "bomb";
    }
    if (!pickupKind) return;

    const texture = pickupKind === "fuel" ? "pickupFuel" : pickupKind === "weapon" ? "pickupWeapon" : "pickupBomb";
    const pickup = this.pickups.get(x, y, texture) as Phaser.Physics.Arcade.Image | null;
    if (!pickup) return;
    pickup.setActive(true).setVisible(true).setTexture(texture).setDepth(19).setData("kind", pickupKind);
    pickup.setData("weaponType", pickupKind === "weapon" ? this.randomWeaponType() : null);
    if (pickup.body) {
      pickup.body.enable = true;
      pickup.body.reset(x, y);
    }
    pickup.setVelocity(0, 115);
  }

  private dropBomb(): void {
    if (this.bombs <= 0 || this.gameOver) {
      this.cameras.main.shake(80, 0.004);
      return;
    }
    this.bombs -= 1;
    this.cameras.main.shake(260, 0.018);

    const groundTargets = this.enemies.children.entries.filter((child) => {
      const enemy = child as Phaser.Physics.Arcade.Sprite;
      return enemy.active && enemy.getData("kind") === "ground";
    }) as Phaser.Physics.Arcade.Sprite[];

    const targets = groundTargets.length > 0 ? groundTargets : (this.enemies.children.entries.filter((child) => {
      const enemy = child as Phaser.Physics.Arcade.Sprite;
      return enemy.active;
    }) as Phaser.Physics.Arcade.Sprite[]);

    const selected = targets.slice(0, 5);
    selected.forEach((enemy, index) => {
      this.time.delayedCall(index * 70, () => {
        if (!enemy.active || this.gameOver) {
          return;
        }
        this.explosion(enemy.x, enemy.y, 0xfff173, 1.65);
        enemy.setData("hp", Number(enemy.getData("hp")) - 26);
        if (Number(enemy.getData("hp")) <= 0) {
          this.destroyEnemy(enemy);
        }
      });
    });

    if (selected.length === 0) {
      this.explosion(this.player.x, this.player.y - 210, 0xfff173, 2.2);
    }

    this.enemyBullets.children.each((child) => {
      const bullet = child as Phaser.Physics.Arcade.Image;
      this.recycleImage(bullet);
      return true;
    });
  }

  private enterGameOver(): void {
    if (this.gameOver) {
      return;
    }

    this.gameOver = true;
    this.lives = 0;
    this.overdriveUntil = 0;
    this.invulnerableUntil = Number.POSITIVE_INFINITY;
    this.player.setVelocity(0, 0).setAlpha(0.45).setAngle(0);
    if (this.player.body) {
      this.player.body.enable = false;
      this.player.body.stop();
    }

    this.clearActiveObjects();
    this.releaseJoystick(this.leftStick);
    this.releaseJoystick(this.rightStick);
    this.gameOverLayer.setVisible(true);
    this.cameras.main.shake(260, 0.012);
  }

  private continueGame(): void {
    if (!this.gameOver) {
      return;
    }

    this.gameOver = false;
    this.continues += 1;
    this.lives = 10;
    this.score = Math.max(0, this.score - 1500);
    this.player.setActive(true).setVisible(true).setAlpha(1).setPosition(GAME_WIDTH / 2, GAME_HEIGHT - 185);
    if (this.player.body) {
      this.player.body.enable = true;
      this.player.body.reset(this.player.x, this.player.y);
    }
    this.invulnerableUntil = this.time.now + 2400;
    this.nextEnemyAt = this.time.now + 900;
    this.nextGroundAt = this.time.now + 2600;
    this.nextShotAt = this.time.now + 250;
    this.gameOverLayer.setVisible(false);
    this.flashBanner("CONTINUE " + this.continues);
  }

  private clearActiveObjects(): void {
    this.bullets.children.each((child) => {
      this.recycleImage(child as Phaser.Physics.Arcade.Image);
      return true;
    });
    this.enemyBullets.children.each((child) => {
      this.recycleImage(child as Phaser.Physics.Arcade.Image);
      return true;
    });
    this.pickups.children.each((child) => {
      this.recycleImage(child as Phaser.Physics.Arcade.Image);
      return true;
    });
    this.enemies.children.each((child) => {
      this.recycleSprite(child as Phaser.Physics.Arcade.Sprite);
      return true;
    });
  }

  private updateHud(time: number, dt: number): void {
    this.shownScore += (this.score - this.shownScore) * clamp(dt * 8, 0, 1);
    const scoreValue = Math.round(this.shownScore).toString().padStart(7, "0");
    this.scoreText.setText(`SCORE ${scoreValue}`);
    this.killsText.setText(`KILLS ${this.kills}`);
    this.livesText.setText(`LIVES ${this.lives}`);
    this.weaponText.setText(`${this.weaponLabel()} ${this.weaponLevel}`);
    this.bombsText.setText(`BOMBS ${this.bombs}`);

    const overdriveLeft = Math.max(0, this.overdriveUntil - time);
    const fuelWidth = overdriveLeft > 0 ? (overdriveLeft / 8500) * 154 : 0;
    this.fuelBar.width = fuelWidth;
    this.fuelBar.fillColor = overdriveLeft > 0 ? 0x31ffbd : 0x18394a;
    this.fuelText.setText(overdriveLeft > 0 ? "OVERDRIVE " + (overdriveLeft / 1000).toFixed(1) : "FUEL PICKUP ARMS BOOST");

    const elapsed = time - this.stageStart;
    if (this.bossDefeated) {
      this.progressText.setText("CLEAR");
    } else if (this.bossSpawned) {
      this.progressText.setText("BOSS");
    } else {
      this.progressText.setText(`WAVE ${clamp(Math.floor(elapsed / 17000) + 1, 1, 4)}`);
    }

    this.rightStick.thumb.fillColor = 0xff5fc8;
    this.rightStick.base.strokeColor = 0xff5fc8;

    const bombReadyAlpha = this.bombs > 0 ? 1 : 0.34;
    this.bombButton.base.setAlpha(this.bombButton.pointerId === null ? bombReadyAlpha : 1);
    this.bombButton.inner.setAlpha(this.bombButton.pointerId === null ? bombReadyAlpha : 1);
    this.bombButton.icon.setAlpha(this.bombButton.pointerId === null ? 0.9 * bombReadyAlpha : 1);
  }

  private isOverdrive(time: number): boolean {
    return time < this.overdriveUntil;
  }

  private recycleImage(image: Phaser.Physics.Arcade.Image): void {
    image.setActive(false).setVisible(false);
    image.setVelocity(0, 0);
    image.setPosition(-9999, -9999);
    if (image.body) {
      image.body.stop();
      image.body.enable = false;
    }
  }

  private recycleSprite(sprite: Phaser.Physics.Arcade.Sprite): void {
    sprite.setActive(false).setVisible(false);
    sprite.setVelocity(0, 0);
    sprite.setPosition(-9999, -9999);
    if (sprite.body) {
      sprite.body.stop();
      sprite.body.enable = false;
    }
  }

  private spark(x: number, y: number, color: number, scale: number): void {
    const particleCount = Math.max(4, Math.min(10, Math.round(5 * scale)));
    for (let i = 0; i < particleCount; i += 1) {
      const angle = (Math.PI * 2 * i) / particleCount + Phaser.Math.FloatBetween(-0.22, 0.22);
      const dot = this.add.circle(x, y, Phaser.Math.FloatBetween(2, 6) * scale, color, 0.9).setDepth(35);
      dot.setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: dot,
        x: x + Math.cos(angle) * Phaser.Math.Between(24, 68) * scale,
        y: y + Math.sin(angle) * Phaser.Math.Between(24, 68) * scale,
        alpha: 0,
        scale: 0.2,
        duration: Phaser.Math.Between(260, 520),
        ease: "Sine.easeOut",
        onComplete: () => dot.destroy(),
      });
    }
  }

  private explosion(x: number, y: number, color: number, scale: number): void {
    const flash = this.add.circle(x, y, 18 * scale, 0xffffff, 0.62).setDepth(36);
    flash.setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: flash,
      radius: 44 * scale,
      alpha: 0,
      duration: 180,
      ease: "Quad.easeOut",
      onComplete: () => flash.destroy(),
    });

    const ring = this.add.circle(x, y, 12 * scale, color, 0.22).setDepth(34);
    ring.setStrokeStyle(4, color, 0.92);
    ring.setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: ring,
      radius: 62 * scale,
      alpha: 0,
      duration: 360,
      ease: "Cubic.easeOut",
      onComplete: () => ring.destroy(),
    });
    const outer = this.add.circle(x, y, 24 * scale, 0xfff173, 0.08).setDepth(33);
    outer.setStrokeStyle(2, 0xffffff, 0.35);
    outer.setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: outer,
      radius: 92 * scale,
      alpha: 0,
      duration: 520,
      ease: "Cubic.easeOut",
      onComplete: () => outer.destroy(),
    });
    this.spark(x, y, color, scale);
  }

  private flashBanner(text: string): void {
    const banner = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.28, text, {
      fontFamily: "Inter, Arial, sans-serif",
      fontSize: "30px",
      color: "#ffffff",
      stroke: "#06111d",
      strokeThickness: 6,
    }).setOrigin(0.5).setDepth(100);

    this.tweens.add({
      targets: banner,
      y: banner.y - 22,
      alpha: 0,
      duration: 1200,
      ease: "Sine.easeOut",
      onComplete: () => banner.destroy(),
    });
  }
}

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game-root",
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: "#07111f",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: {
    activePointers: 5,
  },
  physics: {
    default: "arcade",
    arcade: {
      debug: false,
    },
  },
  scene: AlienStrikeScene,
};

window.addEventListener("contextmenu", (event) => event.preventDefault());
window.addEventListener(
  "touchmove",
  (event) => {
    event.preventDefault();
  },
  { passive: false },
);

new Phaser.Game(config);
