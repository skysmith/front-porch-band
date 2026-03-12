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
