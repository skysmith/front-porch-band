# watchOS App

The Apple Watch app lives in `./tvos/FrontPorchBandTV.xcodeproj` under the `FrontPorchBandWatch` scheme.

## Scope

The watch app is intentionally lyric-first:

- browse, favorites, and recent songs
- title, artist, and key at the top
- chord lines hidden by default for better readability
- optional `Show chords` toggle on each song

This is meant as a quick on-the-go reference, not a performance-first chart reader.

## Refresh Bundled Data

Whenever the song catalog changes, regenerate the native bundle resources:

```bash
node scripts/sync-charts.mjs
```

That refreshes `tvos/Resources/SongCatalog.json`, which the watch app reads offline.

## Build

```bash
xcodebuild \
  -project tvos/FrontPorchBandTV.xcodeproj \
  -scheme FrontPorchBandWatch \
  -configuration Debug \
  -destination 'generic/platform=watchOS' \
  -derivedDataPath /tmp/FrontPorchBandWatchDerived \
  CODE_SIGNING_ALLOWED=NO \
  build
```

## Notes

- The watch app is a standalone watchOS target, not a literal companion to the tvOS app.
- It shares the core songbook models and catalog-loading code with the tvOS target.
