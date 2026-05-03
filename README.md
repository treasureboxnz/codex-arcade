# Codex Arcade

Original browser games built as static web projects.

## Games

- `snake-game/` - Neon Snake, a keyboard and touch controlled snake game.
- `sky-forge/` - Sky Forge, a vertical shooter with power-ups, boss fights, and continue.
- `word-vault/` - Word Vault, a 5-letter word deduction puzzle.
- `orb-orchard/` - Orb Orchard, a merge/drop orb game.
- `cell-rush/` - Cell Rush, an arena growth game.
- `relic-run/` - Relic Run, a compact turn-based card combat run.
- `drift-logic/` - Drift Logic, a top-down neon drift racer.
- `tile-lab/` - Tile Lab, multiple 2048-style modes including Twin Drop.

## Run locally

From this folder:

```powershell
python -m http.server 4190 --bind 127.0.0.1
```

Open:

```text
http://127.0.0.1:4190/
```

## GitHub setup

When you are ready to publish:

```powershell
git init
git branch -M main
git add .
git commit -m "Add Codex Arcade game portal"
git remote add origin https://github.com/<your-user>/<your-repo>.git
git push -u origin main
```

After that, the same repository can be hosted with GitHub Pages, Vercel, Netlify, or copied to a server.
