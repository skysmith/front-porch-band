Chart Format

Front Porch Band uses a deliberately simple chart format so songs stay easy to edit in any text editor and preserve monospace spacing on phones.

Required structure:

```text
Song Title

Artist: Artist Name

chart body here
```

Rules:

- The first line is the chart title.
- The `Artist:` line is required.
- Leave one blank line between the title, artist, and chart body.
- Keep the chart body plain text so chord alignment survives.

Recommended style:

- Put chord names directly above the lyric word where they land.
- Use section labels sparingly and only when they help.
- Prefer readable shorthand over dense tablature for the main chart.
- If a song has multiple arrangements, make the default one clear in the chart body.

Example:

```text
Wagon Wheel

Artist: Old Crow Medicine Show

C                   G
Heading down south to the land of the pines
Am                      F
I'm thumbing my way into North Caroline
```

Validation:

Run:

```bash
node scripts/validate-charts.mjs
```

Custom chart source directory:

```bash
FRONT_PORCH_CHARTS_DIR=../my-private-charts node scripts/validate-charts.mjs
FRONT_PORCH_CHARTS_DIR=../my-private-charts node scripts/sync-charts.mjs
```

or:

```bash
node scripts/validate-charts.mjs --source ../my-private-charts
node scripts/sync-charts.mjs --source ../my-private-charts
```
