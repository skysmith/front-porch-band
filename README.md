Front Porch Band

Front Porch Band is a static, phone-friendly songbook for jam sessions. It keeps charts readable on mobile, supports per-device transposition and instrument views, and stays easy to host on any static platform.

What it does:

- groups songs by artist in a collapsible sidebar
- keeps charts in monospace, strum-along-friendly layouts
- lets each visitor transpose on their own device
- shows chord diagrams for guitar, mandolin, ukulele, and banjo
- generates a shareable QR code for the current chart
- includes a moderation-only suggestion box for pasted charts
- works as a simple static site with no build step

Why this repo is useful beyond one songbook:

- the app can point at any compatible chart folder
- chart files stay simple and editable
- the generated site is static and cheap to host
- the content pipeline is scriptable and validation-friendly

Quick start

1. Pick a chart source folder.
2. Validate the charts.
3. Sync the generated site data.
4. Open `index.html` locally or deploy the repo as a static site.

```bash
node scripts/validate-charts.mjs
node scripts/sync-charts.mjs
```

By default, both scripts read from `../charts` relative to this repo.

You can also point the app at a different chart directory:

```bash
FRONT_PORCH_CHARTS_DIR=../my-private-charts node scripts/validate-charts.mjs
FRONT_PORCH_CHARTS_DIR=../my-private-charts node scripts/sync-charts.mjs
```

or:

```bash
node scripts/validate-charts.mjs --source ../my-private-charts
node scripts/sync-charts.mjs --source ../my-private-charts
```

Project structure

```text
front-porch-band/
  index.html
  404.html
  app.js
  styles.css
  chord-library.js
  chord-diagrams.js
  charts/              generated chart text
  data/songs.json      generated index
  docs/                project docs
  scripts/             sync, validate, and import helpers
```

Chart format

Each chart file is a Markdown/plain-text document with a small header:

```text
Song Title

Artist: Artist Name

G            C
First line of the chart
```

See [docs/CHART_FORMAT.md](./docs/CHART_FORMAT.md) for the full format.

Importing rough files

If you have rough charts in `.txt`, `.md`, `.docx`, or `.rtf`, there is a scripted import path. See [docs/IMPORTING.md](./docs/IMPORTING.md).

Default import flow:

```bash
node scripts/import-inbox.mjs
node scripts/validate-charts.mjs --source ./private-charts
node scripts/sync-charts.mjs --source ./private-charts
```

Deployment

This repo is meant for static hosting.

- local: open `index.html`
- Vercel: point it at the repo root
- any static host: serve the folder as-is

Because the app is hash-routed, `404.html` mirrors `index.html` to make direct links friendlier on static hosts.

Suggestion inbox

The home screen includes a suggestion box that posts pasted charts to `/api/suggestions` for manual review.

Recommended setup: GitHub Issues

Set these env vars in your host:

```bash
FRONT_PORCH_GITHUB_REPO=owner/repo
FRONT_PORCH_GITHUB_TOKEN=github_pat_or_fine_grained_token
FRONT_PORCH_GITHUB_LABELS=song-suggestion
```

Then each suggestion becomes an open labeled issue in that repo.

Fallback behavior:

- local/self-hosted without GitHub env vars: suggestions are written to `private-build/suggestions`
- custom local path: set `FRONT_PORCH_SUGGESTIONS_DIR=/absolute/path`
- Vercel without GitHub env vars or a durable local directory: submissions fall back to an ephemeral temp folder, which is only useful for testing

Reviewing GitHub suggestions

Use the GitHub review helper to inspect or approve submitted charts:

```bash
node scripts/review-github-suggestions.mjs list
node scripts/review-github-suggestions.mjs show 123
node scripts/review-github-suggestions.mjs approve 123 --charts ../charts
node scripts/review-github-suggestions.mjs reject 123
```

What approval does:

- fetches the issue body
- converts it into a chart file
- writes it into your chart library
- comments on the issue
- closes the issue

What rejection does:

- comments on the issue
- closes the issue without importing

Local review inbox

If you are running without GitHub issues, there is still a local file-based review helper:

```bash
node scripts/review-suggestions.mjs list
node scripts/review-suggestions.mjs show <filename>
node scripts/review-suggestions.mjs approve <filename> --charts ./private-charts
node scripts/review-suggestions.mjs reject <filename>
```

Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

Publishing

See [docs/PUBLISHING.md](./docs/PUBLISHING.md) for the recommended split between:

- public app code
- private real-world chart libraries
- public sample/demo content

Open-source note

The app code is straightforward to open source. Song content is a separate question. If you publish the repo publicly, it is safer to:

- keep personal or copyrighted charts in a private source folder outside the repo
- include only original songs, public-domain material, or explicit sample/demo charts in the public repository

Good next steps before a broader public launch:

- choose a license for the code
- decide what sample content, if any, belongs in the public repo
- add screenshots to this README
- consider a small sample chart set for first-time contributors

There is a starter sample chart here:

- [examples/sample-chart.md](./examples/sample-chart.md)
- [examples/sample-songbook/welcome-to-the-porch.md](./examples/sample-songbook/welcome-to-the-porch.md)
