# tvOS App

The native Apple TV app lives in `./tvos/FrontPorchBandTV.xcodeproj`.

## Refresh Bundled Data

Whenever the song catalog changes, regenerate the tvOS bundle resources:

```bash
node scripts/sync-charts.mjs
```

That rebuilds the web data and also refreshes:

- `tvos/Resources/SongCatalog.json`
- `tvos/Resources/ChordLibrary.json`

## Open And Build

Open the project in Xcode:

```bash
open /Users/sky/Documents/codex/personal/music/front-porch-band/tvos/FrontPorchBandTV.xcodeproj
```

Or do a command-line build:

```bash
xcodebuild \
  -project tvos/FrontPorchBandTV.xcodeproj \
  -scheme FrontPorchBandTV \
  -configuration Debug \
  -destination 'generic/platform=tvOS' \
  -derivedDataPath /tmp/FrontPorchBandTVDerived \
  CODE_SIGNING_ALLOWED=NO \
  build
```

## Useful Launch Arguments

These are handy in Xcode scheme arguments before visual debugging:

- `-FrontPorchResetState`
- `-FrontPorchTab browse|favorites|recent|settings`
- `-FrontPorchLibrary front-porch|american-songbag`
- `-FrontPorchChordFilter all|with-chords|without-chords`
- `-FrontPorchQuery rain`
- `-FrontPorchSongSlug a-hard-rain-s-a-gonna-fall`
- `-FrontPorchInstrument guitar|mandolin|ukulele|banjo`
- `-FrontPorchTranspose original|bb-instrument|eb-instrument|f-instrument|A|capo:G`
- `-FrontPorchFontScale 1.2`
- `-FrontPorchShareBaseURL https://your-songbook-host.example/`

Example:

```text
-FrontPorchResetState
-FrontPorchSongSlug a-hard-rain-s-a-gonna-fall
-FrontPorchInstrument mandolin
-FrontPorchTranspose capo:G
-FrontPorchShareBaseURL https://skysmith.github.io/front-porch-band/
```

If you do not set `-FrontPorchShareBaseURL`, the tvOS app currently defaults to:

```text
https://skysmith.github.io/front-porch-band/
```

Song QR codes append the current song slug as a hash route, for example:

```text
https://skysmith.github.io/front-porch-band/#a-hard-rain-s-a-gonna-fall
```

## Spotify Handoff

The tvOS song detail screen can hand a mapped song off to Spotify on Apple TV. This is an app-to-app launch, not embedded playback inside `Front Porch Band`.

To enable it for a song, add either field to the source song record in `data/songs.json`:

```json
{
  "spotifyTrackId": "4uLU6hMCjMI75M1A2tKUQC"
}
```

Or:

```json
{
  "spotifyUrl": "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC"
}
```

Then refresh the bundled tvOS resources:

```bash
node scripts/export-tvos-data.mjs
```

If Spotify is installed and the Apple TV user is signed in, the app will try to open the mapped track there.

## First Visual Pass Checklist

- Confirm `Browse` lands with clear initial focus.
- Open a long chart and verify vertical scrolling stays reachable after moving through the control row.
- Switch instrument and transpose target, then check chord cards update.
- Favorite a song and confirm it appears in `Favorites`.
- Open a few songs and confirm ordering in `Recent`.
- Switch Apple TV users and verify favorites/recents stay separate.
