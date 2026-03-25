import SwiftUI

struct SongDetailView: View {
    let song: SongRecord

    @EnvironmentObject private var catalogStore: CatalogStore
    @EnvironmentObject private var userState: UserLibraryState

    private var currentInstrument: InstrumentID {
        let supported = Set(catalogStore.supportedInstrumentChoices)
        return supported.contains(userState.preferredInstrument) ? userState.preferredInstrument : .guitar
    }

    private var currentChartText: String {
        ChordEngine.currentChartText(for: song, target: userState.transposeTarget)
    }

    private var chartSections: [String] {
        ChordEngine.splitChartSections(currentChartText)
    }

    private var capoHint: String? {
        let baseKey = ChordEngine.extractBaseKey(for: song)
        let resolved = ChordEngine.resolveTransposeTarget(baseKey: baseKey, target: userState.transposeTarget)
        guard let fret = resolved.fret, let shapeKey = resolved.shapeKey, !baseKey.isEmpty else {
            return nil
        }

        return "Capo \(fret). Play \(shapeKey) shapes to sound in \(baseKey)."
    }

    private var chordCards: [ResolvedChordCard] {
        ChordEngine.resolveChordCards(
            song: song,
            target: userState.transposeTarget,
            instrument: currentInstrument,
            chordLibrary: catalogStore.chordLibrary
        )
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(song.title)
                            .font(.system(size: 54, weight: .bold, design: .rounded))
                        Text(song.artist)
                            .font(.title2)
                            .foregroundStyle(.secondary)
                        Text(song.library.label)
                            .font(.headline)
                            .foregroundStyle(.tertiary)
                    }

                    Spacer()

                    Button {
                        userState.toggleFavorite(song)
                    } label: {
                        Label(
                            userState.isFavorite(song) ? "Favorited" : "Favorite",
                            systemImage: userState.isFavorite(song) ? "star.fill" : "star"
                        )
                    }
                    .accessibilityIdentifier("favorite-toggle")
                }

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 18) {
                        transposeMenu
                        capoMenu
                        instrumentMenu

                        Button {
                            userState.adjustFont(by: -0.08)
                        } label: {
                            ControlPill(title: "Font -", value: "\(Int(userState.fontScale * 100))%")
                        }

                        Button {
                            userState.adjustFont(by: 0.08)
                        } label: {
                            ControlPill(title: "Font +", value: "\(Int(userState.fontScale * 100))%")
                        }

                        NavigationLink {
                            ChordShapesView(song: song, instrument: currentInstrument)
                        } label: {
                            ControlPill(title: "Chord Shapes", value: "\(chordCards.count)")
                        }
                        .disabled(chordCards.isEmpty)
                    }
                    .padding(.vertical, 4)
                }

                if let capoHint {
                    Text(capoHint)
                        .font(.headline)
                        .foregroundStyle(.secondary)
                }

                VStack(alignment: .leading, spacing: 18) {
                    ForEach(Array(chartSections.enumerated()), id: \.offset) { item in
                        Text(item.element)
                            .font(.system(size: 30 * userState.fontScale, weight: .regular, design: .monospaced))
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(28)
                            .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 28, style: .continuous))
                    }
                }
            }
            .padding(48)
        }
        .onAppear {
            userState.markRecent(song)
        }
        .accessibilityIdentifier("song-detail-view")
    }

    private var transposeMenu: some View {
        Menu {
            Button(ChordEngine.controlLabel(for: .original, song: song)) {
                userState.transposeTarget = .original
            }

            Divider()

            ForEach(InstrumentTranspose.allCases) { instrument in
                Button(instrument.label) {
                    userState.transposeTarget = .instrument(instrument)
                }
            }

            Divider()

            Menu("Chromatic") {
                ForEach(ChordEngine.noteNames, id: \.self) { note in
                    Button(note) {
                        userState.transposeTarget = .custom(key: note)
                    }
                }
            }
        } label: {
            ControlPill(title: "Transpose", value: ChordEngine.controlLabel(for: userState.transposeTarget, song: song))
        }
        .disabled(ChordEngine.extractBaseKey(for: song).isEmpty)
        .accessibilityIdentifier("transpose-menu")
    }

    private var capoMenu: some View {
        Menu {
            Button("Original shapes") {
                userState.transposeTarget = .original
            }

            let baseKey = ChordEngine.extractBaseKey(for: song)
            ForEach(ChordEngine.capoShapes, id: \.self) { shapeKey in
                if let fret = ChordEngine.capoFret(baseKey: baseKey, shapeKey: shapeKey), fret > 0 {
                    Button("\(shapeKey) shapes (capo \(fret))") {
                        userState.transposeTarget = .capo(shapeKey: shapeKey)
                    }
                }
            }
        } label: {
            ControlPill(
                title: "Capo Shapes",
                value: userState.transposeTarget.capoShapeKey.map { shape in
                    let fret = ChordEngine.capoFret(baseKey: ChordEngine.extractBaseKey(for: song), shapeKey: shape) ?? 0
                    return "\(shape) (\(fret))"
                } ?? "Original"
            )
        }
        .disabled(ChordEngine.extractBaseKey(for: song).isEmpty)
        .accessibilityIdentifier("capo-menu")
    }

    private var instrumentMenu: some View {
        Menu {
            ForEach(catalogStore.supportedInstrumentChoices) { instrument in
                Button(catalogStore.instrumentDefinition(for: instrument)?.label ?? instrument.fallbackLabel) {
                    userState.preferredInstrument = instrument
                }
            }
        } label: {
            ControlPill(
                title: "Instrument",
                value: catalogStore.instrumentDefinition(for: currentInstrument)?.label ?? currentInstrument.fallbackLabel
            )
        }
        .accessibilityIdentifier("instrument-menu")
    }
}

struct ChordShapesView: View {
    let song: SongRecord
    let instrument: InstrumentID

    @EnvironmentObject private var catalogStore: CatalogStore
    @EnvironmentObject private var userState: UserLibraryState

    private var cards: [ResolvedChordCard] {
        ChordEngine.resolveChordCards(
            song: song,
            target: userState.transposeTarget,
            instrument: instrument,
            chordLibrary: catalogStore.chordLibrary
        )
    }

    var body: some View {
        ScrollView {
            LazyVGrid(
                columns: [GridItem(.adaptive(minimum: 320), spacing: 24)],
                spacing: 24
            ) {
                ForEach(cards) { card in
                    ChordShapeCardView(
                        card: card,
                        instrumentDefinition: catalogStore.instrumentDefinition(for: instrument)
                    )
                }
            }
            .padding(48)
        }
        .navigationTitle("Chord Shapes")
        .accessibilityIdentifier("chord-shapes-view")
    }
}

struct ControlPill: View {
    let title: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)

            Text(value)
                .font(.headline.weight(.semibold))
                .lineLimit(1)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 14)
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
    }
}
