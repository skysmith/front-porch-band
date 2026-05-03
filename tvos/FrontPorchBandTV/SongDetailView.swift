import CoreImage
import CoreImage.CIFilterBuiltins
import SwiftUI
import UIKit

struct SongDetailView: View {
    private enum FocusTarget: Hashable {
        case favorite
        case spotify
        case transpose
        case capo
        case instrument
        case fontSmaller
        case fontLarger
        case chordShapes
        case page(Int)
    }

    private enum ScrollAnchor {
        static let top = "song-detail-top"
    }

    let song: SongRecord
    let shareBaseURL: URL?

    @EnvironmentObject private var catalogStore: CatalogStore
    @EnvironmentObject private var userState: UserLibraryState
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    @State private var currentPageIndex = 0
    @State private var autoScrollEnabled = false
    @State private var autoScrollInterval = 6.0
    @State private var exitPressArmed = false
    @State private var spotifyAlertMessage: String?
    @FocusState private var focusedTarget: FocusTarget?

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

    private var chartPages: [ChartPage] {
        ChartPage.buildPages(
            from: chartSections,
            preferredLineCount: preferredLineCount
        )
    }

    private var preferredLineCount: Int {
        switch userState.fontScale {
        case ..<0.75:
            return 18
        case ..<0.95:
            return 15
        case ..<1.15:
            return 13
        default:
            return 11
        }
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

    private var phoneShareURL: URL? {
        ShareURLBuilder.songURL(baseURL: shareBaseURL, slug: song.slug)
    }

    private var isReadingMode: Bool {
        switch focusedTarget {
        case .page, .none:
            return true
        default:
            return autoScrollEnabled
        }
    }

    var body: some View {
        ScrollViewReader { proxy in
            HStack(alignment: .top, spacing: isReadingMode ? 0 : 28) {
                leftColumn(proxy: proxy)

                if !isReadingMode {
                    sidePanel(proxy: proxy)
                        .frame(width: 360)
                        .transition(.move(edge: .trailing).combined(with: .opacity))
                }
            }
            .padding(48)
            .animation(.easeInOut(duration: 0.25), value: isReadingMode)
            .onAppear {
                userState.markRecent(song)
                currentPageIndex = 0
                focusedTarget = .page(0)
                exitPressArmed = false
            }
            .onChange(of: userState.fontScale) { _, _ in
                currentPageIndex = min(currentPageIndex, max(chartPages.count - 1, 0))
            }
            .onChange(of: chartPages.count) { _, newValue in
                currentPageIndex = min(currentPageIndex, max(newValue - 1, 0))
            }
            .onChange(of: focusedTarget) { _, newValue in
                guard let newValue else { return }

                switch newValue {
                case .favorite, .spotify, .transpose, .capo, .instrument, .fontSmaller, .fontLarger, .chordShapes:
                    exitPressArmed = false
                    withAnimation(.easeInOut(duration: 0.3)) {
                        proxy.scrollTo(ScrollAnchor.top, anchor: .top)
                    }
                case .page(let index):
                    currentPageIndex = index
                    exitPressArmed = true
                    withAnimation(.easeInOut(duration: 0.3)) {
                        proxy.scrollTo(index, anchor: .top)
                    }
                }
            }
            .onReceive(Timer.publish(every: autoScrollInterval, on: .main, in: .common).autoconnect()) { _ in
                guard autoScrollEnabled else { return }
                guard chartPages.indices.contains(currentPageIndex) else { return }

                let nextPage = min(currentPageIndex + 1, chartPages.count - 1)
                scrollToPage(nextPage, proxy: proxy)

                if nextPage == chartPages.count - 1 {
                    autoScrollEnabled = false
                }
            }
            .onExitCommand {
                handleExitCommand()
            }
        }
        .accessibilityIdentifier("song-detail-view")
        .alert("Could Not Open Spotify", isPresented: spotifyAlertIsPresented) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(spotifyAlertMessage ?? "Spotify is not available on this Apple TV.")
        }
    }

    private func handleExitCommand() {
        if case .page = focusedTarget {
            autoScrollEnabled = false
            focusedTarget = .favorite
            exitPressArmed = true
            return
        }

        if isReadingMode {
            autoScrollEnabled = false
            focusedTarget = .favorite
            exitPressArmed = true
            return
        }

        if exitPressArmed {
            dismiss()
            return
        }

        focusedTarget = .favorite
        exitPressArmed = true
    }

    private func leftColumn(proxy: ScrollViewProxy) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                Color.clear
                    .frame(height: 1)
                    .id(ScrollAnchor.top)

                if !isReadingMode {
                    header
                        .transition(.move(edge: .top).combined(with: .opacity))

                    controlStrip
                        .transition(.move(edge: .top).combined(with: .opacity))

                    if let capoHint {
                        Text(capoHint)
                            .font(.headline)
                            .foregroundStyle(.secondary)
                            .transition(.opacity)
                    }
                }

                chartPagesView
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.trailing, 8)
        }
    }

    private var header: some View {
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
            .focused($focusedTarget, equals: .favorite)

            if song.hasSpotifyLink {
                Button {
                    openInSpotify()
                } label: {
                    Label("Play In Spotify", systemImage: "play.circle.fill")
                }
                .accessibilityIdentifier("spotify-play-button")
                .focused($focusedTarget, equals: .spotify)
            }
        }
    }

    private var controlStrip: some View {
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
                .accessibilityIdentifier("font-smaller")
                .focused($focusedTarget, equals: .fontSmaller)

                Button {
                    userState.adjustFont(by: 0.08)
                } label: {
                    ControlPill(title: "Font +", value: "\(Int(userState.fontScale * 100))%")
                }
                .accessibilityIdentifier("font-larger")
                .focused($focusedTarget, equals: .fontLarger)

                NavigationLink {
                    ChordShapesView(song: song, instrument: currentInstrument)
                } label: {
                    ControlPill(title: "Chord Shapes", value: "\(chordCards.count)")
                }
                .disabled(chordCards.isEmpty)
                .focused($focusedTarget, equals: .chordShapes)
            }
            .padding(.vertical, 4)
        }
    }

    private var chartPagesView: some View {
        VStack(alignment: .leading, spacing: 20) {
            ForEach(Array(chartPages.enumerated()), id: \.offset) { index, page in
                VStack(alignment: .leading, spacing: 18) {
                    Text(page.text)
                        .font(.system(size: 30 * userState.fontScale, weight: .regular, design: .monospaced))
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .padding(28)
                .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 28, style: .continuous))
                .frame(maxWidth: isReadingMode ? .infinity : nil, alignment: .leading)
                .id(index)
                .accessibilityIdentifier("chart-page-\(index)")
                .focusable()
                .focused($focusedTarget, equals: .page(index))
            }
        }
        .accessibilityIdentifier("chart-scroll-view")
    }

    private func sidePanel(proxy: ScrollViewProxy) -> some View {
        VStack(alignment: .leading, spacing: 20) {
            VStack(alignment: .leading, spacing: 14) {
                Text("Scroll")
                    .font(.title3.weight(.bold))

                HStack(spacing: 12) {
                    Button("Up") {
                        scrollToPage(max(currentPageIndex - 1, 0), proxy: proxy)
                    }
                    .disabled(currentPageIndex == 0)
                    .accessibilityIdentifier("scroll-up-button")

                    Button("Down") {
                        scrollToPage(min(currentPageIndex + 1, chartPages.count - 1), proxy: proxy)
                    }
                    .disabled(currentPageIndex >= chartPages.count - 1)
                    .accessibilityIdentifier("scroll-down-button")
                }

                Button("Back To Top") {
                    scrollToPage(0, proxy: proxy)
                }
                .accessibilityIdentifier("scroll-top-button")

                Toggle(isOn: $autoScrollEnabled) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Auto-scroll")
                        Text(autoScrollEnabled ? "Advances page every \(Int(autoScrollInterval))s" : "Off")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                .accessibilityIdentifier("auto-scroll-toggle")

                Picker("Speed", selection: $autoScrollInterval) {
                    Text("4 sec").tag(4.0)
                    Text("6 sec").tag(6.0)
                    Text("8 sec").tag(8.0)
                    Text("10 sec").tag(10.0)
                }
                .pickerStyle(.menu)
                .accessibilityIdentifier("auto-scroll-speed")
            }
            .panelCardStyle()

            VStack(alignment: .leading, spacing: 14) {
                Text("Navigator")
                    .font(.title3.weight(.bold))

                ScrollView {
                    VStack(alignment: .leading, spacing: 10) {
                        ForEach(Array(chartPages.enumerated()), id: \.offset) { index, page in
                            Button {
                                scrollToPage(index, proxy: proxy)
                            } label: {
                                HStack {
                                    Text("Page \(index + 1)")
                                        .lineLimit(2)
                                        .multilineTextAlignment(.leading)
                                    Spacer()
                                }
                            }
                            .buttonStyle(.bordered)
                            .tint(index == currentPageIndex ? .accentColor : nil)
                            .accessibilityIdentifier("page-jump-\(index)")
                        }
                    }
                }
                .frame(maxHeight: 340)
            }
            .panelCardStyle()

            VStack(alignment: .leading, spacing: 14) {
                Text("Song At A Glance")
                    .font(.title3.weight(.bold))

                detailRow(label: "Font", value: "\(Int(userState.fontScale * 100))%")
                detailRow(label: "Pages", value: "\(chartPages.count)")
                detailRow(label: "Chords", value: "\(chordCards.count)")
                detailRow(
                    label: "Instrument",
                    value: catalogStore.instrumentDefinition(for: currentInstrument)?.label ?? currentInstrument.fallbackLabel
                )
            }
            .panelCardStyle()

            VStack(alignment: .leading, spacing: 16) {
                Text("Open On Phone")
                    .font(.title3.weight(.bold))

                if let phoneShareURL {
                    QRCodeCard(url: phoneShareURL)
                        .accessibilityIdentifier("phone-qr-card")
                } else {
                    Text("Set a public songbook URL to generate phone QR codes.")
                        .font(.headline)
                        .foregroundStyle(.secondary)
                }
            }
            .panelCardStyle()
        }
    }

    private func detailRow(label: String, value: String) -> some View {
        HStack {
            Text(label)
                .foregroundStyle(.secondary)
            Spacer()
            Text(value)
        }
        .font(.headline)
    }

    private func scrollToPage(_ index: Int, proxy: ScrollViewProxy) {
        guard chartPages.indices.contains(index) else { return }
        currentPageIndex = index
        withAnimation(.easeInOut(duration: 0.35)) {
            proxy.scrollTo(index, anchor: .top)
        }
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
        .focused($focusedTarget, equals: .transpose)
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
        .focused($focusedTarget, equals: .capo)
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
        .focused($focusedTarget, equals: .instrument)
    }

    private var spotifyAlertIsPresented: Binding<Bool> {
        Binding(
            get: { spotifyAlertMessage != nil },
            set: { isPresented in
                if !isPresented {
                    spotifyAlertMessage = nil
                }
            }
        )
    }

    private func openInSpotify() {
        if let appURL = song.spotifyAppURL, UIApplication.shared.canOpenURL(appURL) {
            openURL(appURL) { accepted in
                if !accepted {
                    openSpotifyFallback()
                }
            }
            return
        }

        openSpotifyFallback()
    }

    private func openSpotifyFallback() {
        guard let fallbackURL = song.spotifyWebURL else {
            spotifyAlertMessage = "This song does not have a Spotify track mapped yet."
            return
        }

        openURL(fallbackURL) { accepted in
            if !accepted {
                spotifyAlertMessage = "Install and sign into Spotify on this Apple TV to launch the mapped track."
            }
        }
    }
}

private enum ShareURLBuilder {
    static func songURL(baseURL: URL?, slug: String) -> URL? {
        guard let baseURL else {
            return nil
        }

        let trimmedSlug = slug.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedSlug.isEmpty else {
            return baseURL
        }

        let baseString = baseURL.absoluteString.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !baseString.isEmpty else {
            return nil
        }

        if baseString.contains("#") {
            return URL(string: baseString + trimmedSlug)
        }

        if baseString.hasSuffix("/") {
            return URL(string: baseString + "#\(trimmedSlug)")
        }

        return URL(string: baseString + "/#\(trimmedSlug)")
    }
}

private struct ChartPage: Identifiable, Hashable {
    let index: Int
    let text: String

    var id: Int { index }

    static func buildPages(from sections: [String], preferredLineCount: Int) -> [ChartPage] {
        var pages: [ChartPage] = []
        var nextIndex = 0

        for (sectionIndex, section) in sections.enumerated() {
            let lines = section.components(separatedBy: .newlines)

            if lines.count <= preferredLineCount {
                pages.append(ChartPage(index: nextIndex, text: section))
                nextIndex += 1
                continue
            }

            for chunkStart in stride(from: 0, to: lines.count, by: preferredLineCount) {
                let chunkEnd = min(chunkStart + preferredLineCount, lines.count)
                let chunk = Array(lines[chunkStart..<chunkEnd])
                let suffix = " (\(chunkStart / preferredLineCount + 1))"
                pages.append(
                    ChartPage(
                        index: nextIndex,
                        text: chunk.joined(separator: "\n")
                    )
                )
                nextIndex += 1
            }
        }

        if pages.isEmpty {
            return [ChartPage(index: 0, text: "")]
        }

        return pages
    }
}

private extension View {
    func panelCardStyle() -> some View {
        self
            .padding(24)
            .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 28, style: .continuous))
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

private struct QRCodeCard: View {
    let url: URL

    private let context = CIContext()
    private let filter = CIFilter.qrCodeGenerator()

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            if let image = qrImage {
                Image(uiImage: image)
                    .interpolation(.none)
                    .resizable()
                    .scaledToFit()
                    .frame(width: 220, height: 220)
                    .frame(maxWidth: .infinity)
                    .padding(16)
                    .background(Color.white, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
            }

            Text(url.absoluteString)
                .font(.caption.monospaced())
                .foregroundStyle(.secondary)
                .lineLimit(3)
        }
    }

    private var qrImage: UIImage? {
        filter.setValue(Data(url.absoluteString.utf8), forKey: "inputMessage")
        filter.correctionLevel = "M"

        guard let outputImage = filter.outputImage else {
            return nil
        }

        let transformed = outputImage.transformed(by: CGAffineTransform(scaleX: 12, y: 12))
        guard let cgImage = context.createCGImage(transformed, from: transformed.extent) else {
            return nil
        }

        return UIImage(cgImage: cgImage)
    }
}
