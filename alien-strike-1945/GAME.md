# Alien Strike 1945 Game Document

## Overview

Alien Strike 1945 is a mobile-first vertical arcade shooter inspired by classic
1945-style plane games, but rebuilt around an alien invasion setting. The player
pilots a compact strike fighter through colorful alien waves, ground monsters,
weapon drops, bomb pickups, fuel overdrive, score growth, kill tracking, and a
boss-style encounter.

Current status: playable prototype.

## Target Experience

- Session style: refined arcade shooter, not a sandbox game.
- Campaign target: 15 stages in the full version.
- Full clear target: about 2 hours.
- Theme: alien battlefield with airborne enemies and ground monsters.
- Lives: 10 lives per run, with a continue flow after game over.
- Platform: web game built with Phaser and Vite, friendly for desktop and phone.

## Controls

- Mobile movement: left virtual joystick.
- Mobile fire and aim: smaller right virtual joystick.
- Bomb: separate upper-right bomb button.
- Desktop movement: arrow keys or WASD.
- Desktop fire: Space.

## Core Loop

1. Move through vertical alien attack waves.
2. Destroy air enemies and ground monsters.
3. Collect score, weapon pickups, bombs, and fuel.
4. Upgrade the current weapon or switch to a new weapon type.
5. Use bombs for screen-clearing damage.
6. Use fuel overdrive for short bursts of stronger fire rate, damage, and speed.
7. Survive until the stage or boss wave is cleared.

## Weapon System

The prototype currently includes six weapon families. The full design target is
20 weapon variants, built by extending these families with more firing patterns,
visual effects, and stage-specific drops.

| Weapon | Prototype Behavior |
| --- | --- |
| Pulse | Balanced forward shot with steady upgrade scaling. |
| Pierce | Piercing bullet that can pass through multiple enemies. |
| Laser | Fast direct beam-like shot with higher straight-line pressure. |
| Homing | Tracks the closest visible enemy after launch. |
| Blast | Explosive bullet with area damage around impact. |
| Wave | Sine-wave bullet path for wide lane coverage. |

Weapon pickup rules:

- Same weapon pickup: upgrades the weapon level.
- Different weapon pickup: switches weapon type and resets the weapon to level 1.
- Fuel pickup: starts overdrive instead of being treated as a permanent weapon.

## Bombs And Fuel

- Bomb type: one standard bomb type.
- Bomb capacity: maximum 5 bombs.
- Bomb effect: large strike damage against visible enemies and ground targets.
- Fuel effect: temporary overdrive that increases weapon power, fire rate, and
  player movement speed.

## Enemy Roster

Air enemies:

- Saucer scout.
- Fang striker.
- Orbiter drone.
- Stingray attacker.
- Cruiser heavy unit.

Ground enemies:

- Ground beast.
- Ground turret.
- Ground crawler.

Enemy design direction:

- Later stages should increase projectile density, attack paths, health, and
  coordination between air and ground enemies.
- Ground enemies should encourage bomb usage without forcing the player to stop
  focusing on air threats.

## Scoring And HUD

The game tracks:

- Score.
- Kill count.
- Lives.
- Bomb count.
- Current weapon.
- Weapon level.
- Overdrive state.

Score feedback should keep moving and updating quickly so each kill feels
visible and rewarding.

## Technical Notes

- Engine: Phaser 3.
- Build tool: Vite.
- Language: TypeScript.
- Deployment target: Vercel static web deployment.
- Local run command: `npm run dev -- --port 4177`.
- Production build command: `npm run build`.
- Regression check command: `npm test`.

## Deployment

Production URL: https://alien-strike-1945.vercel.app
