# Alien Strike 1945 Learnings

This file records project-specific lessons, pitfalls, and repeatable checks.
Update it whenever a bug, QA pass, deployment issue, or design decision teaches
something that should affect future work.

## Standing Rules

- Keep this file current after meaningful bug fixes, QA findings, deployment
  changes, or gameplay tuning.
- Do not treat a successful build as gameplay verification.
- Do not treat desktop keyboard testing as proof that mobile controls work.
- Prefer adding regression checks before fixing behavior bugs.
- Keep all committed learning notes project-specific and actionable.

## Project Paths And Deployment

- Local project path: `C:\Users\eric\.codex\projects\alien-strike-1945`.
- Repository root: `C:\Users\eric\.codex\projects`.
- GitHub repo: `treasureboxnz/codex-arcade`.
- Vercel production URL: `https://alien-strike-1945.vercel.app`.
- Vercel creates `.vercel/`; do not commit it.
- QA screenshots and reports live under `qa/`; this folder is ignored by Git.

## QA Lessons

- Mobile QA must use a touch-enabled mobile viewport, not only a desktop window.
- For this Canvas game, DOM snapshots do not expose bullets, enemies, collisions,
  or joystick behavior. Use screenshots, pixel checks, and interaction flows.
- A useful mobile QA pass should cover:
  - page and Canvas load,
  - left joystick movement,
  - right joystick firing,
  - bomb button,
  - long-run animation,
  - absence of real console errors and page errors,
  - visual confirmation that kills and score can change.
- WebGL `ReadPixels` warnings can appear during automated screenshots. Treat
  them as screenshot/runtime warnings, not gameplay failures, unless they are
  accompanied by real page errors or broken rendering.
- Keep temporary QA artifacts out of commits unless the user asks for a report
  artifact to be saved permanently.

## Bugs Already Hit

- Hidden pooled physics bodies kept colliding after objects were recycled.
  Recycled images and sprites must disable their Arcade body, and spawns must
  re-enable bodies.
- Game Over previously left gameplay moving. Game Over must stop active play,
  clear active objects, disable the player body, and allow a continue path.
- Mobile enemies appeared impossible to kill because the right joystick used the
  full finger vector as bullet direction. Mobile fire must always shoot upward,
  with horizontal drag only steering the angle.
- Enemy bullet density was too high for mobile. Enemy fire cadence, spread, and
  bullet speed must leave visible dodge gaps.

## Gameplay Rules To Preserve

- Player starts and continues with `100` lives.
- Bomb capacity is capped at `5`.
- Right mobile stick fires upward by default and steers only left/right.
- Fuel triggers Overdrive for short stronger firing, speed, and damage.
- Elite Viper and Warden enemies drop Mega Rounds.
- Mega Rounds last `24` seconds and can extend up to `48` seconds.
- Mega Rounds enlarge player bullets and add damage.
- Switching weapon type resets weapon level to `1`.
- Picking up the same weapon upgrades the current weapon.

## Verification Commands

Run from `C:\Users\eric\.codex\projects\alien-strike-1945`:

```powershell
npm test
npm run build
vercel --prod --yes
```

After deployment, verify the production URL directly:

```powershell
$r = Invoke-WebRequest -Uri 'https://alien-strike-1945.vercel.app' -UseBasicParsing -TimeoutSec 30
[string]$r.StatusCode
```

Expected result: `200`.

## Future Work Notes

- If gameplay changes affect mobile controls, run mobile QA before reporting
  completion.
- If enemy or bullet behavior changes, add or update regression checks in
  `scripts/regression-tests.mjs`.
- If a new pickup is added, verify pooled pickup bodies are re-enabled on spawn
  and disabled on recycle.
- If the full 15-stage campaign is implemented, move difficulty tuning into an
  explicit stage configuration instead of scattered timing constants.

