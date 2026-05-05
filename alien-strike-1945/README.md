# Alien Strike 1945

Mobile-first vertical shooter prototype with twin virtual sticks, alien waves,
weapon upgrades, fuel overdrive, bombs, lives, score, kills, and a demo boss.

## Run

```bash
npm install
npm run dev -- --port 4177
```

Open `http://localhost:4177`.

Production: https://alien-strike-1945.vercel.app

## Controls

- Left virtual stick: move.
- Right virtual stick: hold to fire and aim.
- Upper-right bomb button: bomb strike.
- Fuel pickups trigger a short overdrive burst.
- Desktop fallback: WASD or arrow keys move, Space fires.

## Current Weapon Rules

- Weapons: Pulse, Pierce, Laser, Homing, Blast, and Wave.
- Picking up the same weapon upgrades it.
- Picking up a different weapon switches weapon type and resets it to level 1.
- Bomb pickups cap at 5 bombs.
- Fuel pickups trigger Overdrive, temporarily strengthening fire rate, damage, and movement.
