Front Porch Band

Static phone-friendly songbook for the charts in [/Users/sky/.openclaw/workspace/music/charts](/Users/sky/.openclaw/workspace/music/charts).

Usage:

1. Edit charts in `/Users/sky/.openclaw/workspace/music/charts/`.
2. Run `node scripts/sync-charts.mjs` from `/Users/sky/.openclaw/workspace/music/front-porch-band`.
3. Open `index.html` locally or point Vercel at `/Users/sky/.openclaw/workspace/music/front-porch-band`.

Notes:

- The site loads chart text from generated files in `/Users/sky/.openclaw/workspace/music/front-porch-band/charts/`.
- `data/songs.json` is generated from the master chart files.
- `404.html` is regenerated from `index.html` so hash-based routes behave fine on static hosting.
