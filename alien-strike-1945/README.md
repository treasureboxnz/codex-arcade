# Alien Strike 1945

Mobile-first vertical shooter prototype with twin virtual sticks, alien waves,
weapon upgrades, fuel overdrive, bombs, 100 lives, score, kills, and a demo boss.
Elite enemies can drop Mega Rounds, a longer-lasting big-bullet reward.

## Run

```bash
npm install
npm run dev -- --port 4177
```

Open `http://localhost:4177`.

Production: https://alien-strike-1945.vercel.app

## Controls

- Left virtual stick: move.
- Right virtual stick: hold to fire; drag left or right to angle upward shots.
- Upper-right bomb button: bomb strike.
- Fuel pickups trigger a short overdrive burst.
- Enemy bullets are tuned to leave visible dodge gaps.
- Desktop fallback: WASD or arrow keys move, Space fires.

## Current Weapon Rules

- Weapons: Pulse, Pierce, Laser, Homing, Blast, and Wave.
- Picking up the same weapon upgrades it.
- Picking up a different weapon switches weapon type and resets it to level 1.
- Bomb pickups cap at 5 bombs.
- Fuel pickups trigger Overdrive, temporarily strengthening fire rate, damage, and movement.
- Elite Viper and Warden enemies drop Mega Rounds.
- Mega Rounds last 24 seconds, enlarge bullets, and add damage.
