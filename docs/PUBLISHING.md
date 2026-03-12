Publishing Front Porch Band

There are two clean ways to use this project:

1. Public code, private chart library
2. Public code, public sample/demo charts only

Recommended setup

If you feel even slightly nervous about publishing a real song library, treat the app and the charts as separate things:

- keep the app repo public
- keep your real charts outside the repo
- generate the site from your private chart folder when you deploy for friends and family

That looks like this:

```bash
FRONT_PORCH_CHARTS_DIR=../my-private-charts node scripts/validate-charts.mjs
FRONT_PORCH_CHARTS_DIR=../my-private-charts node scripts/sync-charts.mjs
```

Safer public GitHub posture

For a public repo, prefer committing:

- app code
- docs
- a tiny sample songbook
- no copyrighted or uncertain third-party charts

This repo includes a starter sample songbook here:

- `examples/sample-songbook/`

Build the public demo from it:

```bash
node scripts/validate-charts.mjs --source ./examples/sample-songbook
node scripts/sync-charts.mjs --source ./examples/sample-songbook
```

Then the public site demonstrates the app without exposing your full library.

Friends-and-family deployment

If the goal is just sharing with people you know, you still do not need to publish the full chart set in the source repository. The cleaner route is:

- public GitHub repo for the app
- private local chart folder or private repo for your real charts
- private or low-profile deploy generated from that real chart folder

What this does not solve

This is a practical publishing pattern, not legal advice. If a chart is copyrighted, a public or semi-public deployment can still matter even if you are not promoting it.

The safest boundary is:

- open-source the engine
- keep the real library private unless you are sure you want it public
