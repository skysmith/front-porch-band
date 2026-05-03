import XCTest
@testable import FrontPorchBandTV

final class FrontPorchBandTVTests: XCTestCase {
    func testSongCatalogFixtureDecodes() throws {
        let catalog = try loadFixture(SongCatalog.self, named: "SongCatalog")

        XCTAssertGreaterThan(catalog.songs.count, 0)
        XCTAssertTrue(catalog.songs.contains(where: { $0.library == .frontPorch }))
        XCTAssertTrue(catalog.songs.contains(where: { $0.library == .americanSongbag }))
        XCTAssertTrue(catalog.songs.contains(where: { !$0.chartText.isEmpty }))
    }

    func testChordLibraryFixtureDecodes() throws {
        let chordLibrary = try loadFixture(ChordLibraryData.self, named: "ChordLibrary")

        XCTAssertNotNil(chordLibrary.instruments[InstrumentID.guitar.rawValue])
        XCTAssertEqual(chordLibrary.aliases["A7"], "A")
    }

    func testTranspositionParityAcrossCommonCases() {
        let song = makeSong(
            title: "Test Song",
            artist: "The Porch",
            baseKey: "G",
            chartText: "G D Em C\nG/B D/F# Em7 C"
        )

        XCTAssertEqual(
            ChordEngine.currentChartText(for: song, target: .custom(key: "A")),
            "A E F#m D\nA/Db E/Gb F#m7 D"
        )

        XCTAssertEqual(
            ChordEngine.currentChartText(for: song, target: .instrument(.bbInstrument)),
            "A E F#m D\nA/Db E/Gb F#m7 D"
        )

        XCTAssertEqual(
            ChordEngine.currentChartText(for: song, target: .capo(shapeKey: "E")),
            "E B C#m A\nE/G# B/D# C#m7 A"
        )

        let lyricOnlySong = makeSong(
            title: "Lyric Only",
            artist: "The Porch",
            baseKey: "",
            chartText: "Just lyrics\nAnd another line"
        )
        XCTAssertEqual(
            ChordEngine.currentChartText(for: lyricOnlySong, target: .custom(key: "C")),
            "Just lyrics\nAnd another line"
        )
    }

    func testChordAliasAndRelaxedFallback() throws {
        let chordLibrary = try loadFixture(ChordLibraryData.self, named: "ChordLibrary")

        XCTAssertEqual(
            ChordEngine.resolveChordName("A7", instrumentId: .guitar, chordLibrary: chordLibrary),
            "A"
        )

        XCTAssertEqual(
            ChordEngine.resolveChordName("F#m7", instrumentId: .guitar, chordLibrary: chordLibrary),
            "F#m"
        )

        XCTAssertEqual(
            ChordEngine.resolveChordName("G/B", instrumentId: .guitar, chordLibrary: chordLibrary),
            "G"
        )
    }

    func testSpotifyURLsPreferTrackIDAndFallbackToExplicitURL() {
        let mappedSong = makeSong(
            title: "Mapped Song",
            artist: "The Porch",
            baseKey: "G",
            chartText: "G D Em C",
            spotifyTrackID: "4uLU6hMCjMI75M1A2tKUQC"
        )

        XCTAssertEqual(mappedSong.spotifyAppURL?.absoluteString, "spotify:track:4uLU6hMCjMI75M1A2tKUQC")
        XCTAssertEqual(
            mappedSong.spotifyWebURL?.absoluteString,
            "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC"
        )

        let explicitURLSong = makeSong(
            title: "Explicit URL",
            artist: "The Porch",
            baseKey: "C",
            chartText: "C F G",
            spotifyURLString: "https://open.spotify.com/track/example"
        )

        XCTAssertNil(explicitURLSong.spotifyAppURL)
        XCTAssertEqual(explicitURLSong.spotifyWebURL?.absoluteString, "https://open.spotify.com/track/example")
    }

    private func makeSong(
        title: String,
        artist: String,
        baseKey: String,
        chartText: String,
        spotifyTrackID: String? = nil,
        spotifyURLString: String? = nil
    ) -> SongRecord {
        SongRecord(
            slug: title.lowercased().replacingOccurrences(of: " ", with: "-"),
            title: title,
            artist: artist,
            artistAliases: [artist],
            libraryId: LibraryID.frontPorch.rawValue,
            baseKey: baseKey,
            hasChords: true,
            chartText: chartText,
            chordTokens: ChordEngine.extractChordTokens(chartText: chartText, aliases: [:]),
            sortTitle: title.lowercased(),
            sortArtist: artist.lowercased(),
            spotifyTrackID: spotifyTrackID,
            spotifyURLString: spotifyURLString
        )
    }

    private func loadFixture<T: Decodable>(_ type: T.Type, named name: String) throws -> T {
        let bundle = Bundle(for: Self.self)
        guard let url = bundle.url(forResource: name, withExtension: "json") else {
            XCTFail("Missing fixture \(name).json")
            throw NSError(domain: "FrontPorchBandTVTests", code: 1)
        }

        let data = try Data(contentsOf: url)
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode(type, from: data)
    }
}
