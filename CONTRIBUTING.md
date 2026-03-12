Contributing to Front Porch Band

Front Porch Band is a static, phone-friendly songbook for quick jam sessions. The app is intentionally small and dependency-light, so contributions that keep it simple and easy to host are the best fit.

What helps most:

- improvements to the shared UI and mobile reading experience
- better chord-shape coverage and transpose behavior
- chart validation and import tooling
- docs that make it easier to run, deploy, and contribute

What to avoid:

- adding a framework unless there is a strong reason
- baking private or copyrighted song content into the repo without permission
- adding features that make local hosting or static deployment harder

Local workflow:

1. Keep editable charts in a source folder.
2. Run `node scripts/validate-charts.mjs`.
3. Run `node scripts/sync-charts.mjs`.
4. Open `index.html` locally, or deploy the repo as a static site.

Chart format:

- line 1: plain-text title
- blank line
- `Artist: Name`
- blank line
- chart body in fixed-width-friendly text

Example:

```text
Sample Song

Artist: Front Porch Band

G            C
Hello from the porch tonight
D            G
Everybody sing along
```

Contributor notes:

- `scripts/sync-charts.mjs` and `scripts/validate-charts.mjs` both support a custom source folder via `FRONT_PORCH_CHARTS_DIR` or `--source`.
- `404.html` mirrors `index.html` for static hosts that need a same-app fallback page.
- `charts/` and `data/songs.json` are generated output.

Before opening a PR:

- validate the charts
- regenerate the site data
- keep changes focused and easy to review

Open-source hygiene:

- code can be public
- song content should be limited to material you own, have permission to share, or intentionally keep as sample/demo content
