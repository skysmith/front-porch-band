Importing Songs

Front Porch Band includes a scripted import workflow for rough source files.

What it supports:

- `.md`
- `.txt`
- `.docx`
- `.rtf`

What it does:

- reads files from an inbox folder
- tries to normalize title and artist headers
- writes a chart file into the chart library
- keeps the more complete version if a chart already exists
- archives the original imported file after success

Default repo-local folders:

- inbox: `./private-build/import`
- charts: `./private-charts`
- archive: `./private-build/import-archive`

If you are setting up the repo for the first time, start with:

```bash
node scripts/setup-private-songbook.mjs
```

Basic workflow:

```bash
node scripts/import-inbox.mjs
node scripts/validate-charts.mjs --source ./private-charts
node scripts/sync-charts.mjs --source ./private-charts
```

Custom paths:

```bash
node scripts/import-inbox.mjs \
  --inbox ./my-imports \
  --charts ./my-charts \
  --archive ./my-import-archive
```

You can also use environment variables:

```bash
FRONT_PORCH_IMPORT_INBOX=./my-imports \
FRONT_PORCH_CHARTS_DIR=./my-charts \
FRONT_PORCH_IMPORT_ARCHIVE=./my-import-archive \
node scripts/import-inbox.mjs
```

Folder conventions:

- files inside `originals/` or `tony grove/` are treated as originals
- files inside `covers/` default to `Artist: Cover` unless the importer can infer a better artist
- if a subfolder looks like an artist name, that folder name is used as a fallback artist

Config and mappings:

- title canonicalization and artist hints live in `scripts/lib/import-config.mjs`
- if you want different defaults for your own library, edit that file or replace it with your own config layer

Notes:

- rich text import uses macOS `textutil`
- the importer is conservative about overwriting: if an existing chart looks more complete, it keeps the existing one
- the importer is meant to get files close, not perfect; you should still review imported charts before publishing

Sharing and merging another Front Porch library:

If someone else already has a Front Porch Band library, ask them for their source chart files from `private-charts/`, not the generated `charts/` folder.

Recommended merge flow:

1. Copy the shared library source with the merge helper:

```bash
node scripts/merge-library-folder.mjs --from /path/to/friend-private-charts --name alex
```

That copies the folder into:

```text
./private-charts/from-friends/alex/
```

2. Keep the files in the normal chart format:

```text
Song Title

Artist: Artist Name

G            C
First line of the chart
```

3. Validate and rebuild:

```bash
node scripts/validate-charts.mjs --source ./private-charts
node scripts/sync-charts.mjs --source ./private-charts
```

Why this preserves transposition:

- Front Porch Band detects chord tokens from the source chart body during sync
- those detected chords are written into `data/songs.json`
- the generated site then uses that metadata for transpose helpers and chord diagrams

If the shared files are messy exports, scans, or copied text instead of clean chart sources, put them in the import inbox and run:

```bash
node scripts/import-inbox.mjs
node scripts/validate-charts.mjs --source ./private-charts
node scripts/sync-charts.mjs --source ./private-charts
```

Practical tip:

- keep shared libraries in subfolders like `from-friends/alex/` or `shared-campfire/` so you can tell where songs came from
- if two charts have the same song title but different quality, review them before overwriting; the importer tries to keep the more complete chart, but manual review is still smart
