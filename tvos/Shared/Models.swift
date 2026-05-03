import Foundation

enum LibraryID: String, Codable, CaseIterable, Identifiable {
    case frontPorch = "front-porch"
    case americanSongbag = "american-songbag"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .frontPorch:
            return "Front Porch"
        case .americanSongbag:
            return "American Songbag"
        }
    }
}

enum ChordFilterOption: String, CaseIterable, Identifiable {
    case all
    case withChords = "with-chords"
    case withoutChords = "without-chords"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .all:
            return "All songs"
        case .withChords:
            return "Chords detected"
        case .withoutChords:
            return "No chords detected"
        }
    }
}

enum InstrumentID: String, Codable, CaseIterable, Identifiable {
    case guitar
    case mandolin
    case bouzouki
    case ukulele
    case banjo

    var id: String { rawValue }

    var fallbackLabel: String {
        switch self {
        case .guitar:
            return "Guitar"
        case .mandolin:
            return "Mandolin"
        case .bouzouki:
            return "Bouzouki"
        case .ukulele:
            return "Ukulele"
        case .banjo:
            return "Banjo"
        }
    }
}

enum InstrumentTranspose: String, CaseIterable, Identifiable {
    case bbInstrument = "bb-instrument"
    case ebInstrument = "eb-instrument"
    case fInstrument = "f-instrument"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .bbInstrument:
            return "Bb instrument"
        case .ebInstrument:
            return "Eb instrument"
        case .fInstrument:
            return "F instrument"
        }
    }
}

struct TransposeTarget: RawRepresentable, Codable, Hashable {
    let rawValue: String

    init(rawValue: String) {
        self.rawValue = rawValue
    }

    static let original = TransposeTarget(rawValue: "original")

    static func instrument(_ instrument: InstrumentTranspose) -> TransposeTarget {
        TransposeTarget(rawValue: instrument.rawValue)
    }

    static func capo(shapeKey: String) -> TransposeTarget {
        TransposeTarget(rawValue: "capo:\(shapeKey)")
    }

    static func custom(key: String) -> TransposeTarget {
        TransposeTarget(rawValue: key)
    }

    var isInstrumentTranspose: Bool {
        InstrumentTranspose.allCases.contains(where: { $0.rawValue == rawValue })
    }

    var isCapoTarget: Bool {
        rawValue.hasPrefix("capo:")
    }

    var capoShapeKey: String? {
        guard isCapoTarget else { return nil }
        return rawValue.split(separator: ":", maxSplits: 1).last.map(String.init)
    }

    var instrumentTranspose: InstrumentTranspose? {
        InstrumentTranspose(rawValue: rawValue)
    }
}

struct SongCatalog: Codable {
    let version: Int
    let generatedAt: Date
    let songs: [SongRecord]

    static let empty = SongCatalog(
        version: 1,
        generatedAt: Date(timeIntervalSince1970: 0),
        songs: []
    )
}

struct SongRecord: Codable, Identifiable, Hashable {
    let slug: String
    let title: String
    let artist: String
    let artistAliases: [String]
    let libraryId: String
    let baseKey: String
    let hasChords: Bool
    let chartText: String
    let chordTokens: [String]
    let sortTitle: String
    let sortArtist: String
    let spotifyTrackID: String?
    let spotifyURLString: String?

    var id: String { slug }

    var library: LibraryID {
        LibraryID(rawValue: libraryId) ?? .frontPorch
    }

    var spotifyAppURL: URL? {
        guard let spotifyTrackID else { return nil }

        let trimmedTrackID = spotifyTrackID.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedTrackID.isEmpty else { return nil }

        return URL(string: "spotify:track:\(trimmedTrackID)")
    }

    var spotifyWebURL: URL? {
        if let spotifyURLString {
            let trimmedURL = spotifyURLString.trimmingCharacters(in: .whitespacesAndNewlines)
            if !trimmedURL.isEmpty, let url = URL(string: trimmedURL) {
                return url
            }
        }

        guard let spotifyTrackID else { return nil }

        let trimmedTrackID = spotifyTrackID.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedTrackID.isEmpty else { return nil }

        return URL(string: "https://open.spotify.com/track/\(trimmedTrackID)")
    }

    var hasSpotifyLink: Bool {
        spotifyAppURL != nil || spotifyWebURL != nil
    }
}

struct ChordLibraryData: Codable {
    let version: Int
    let generatedAt: Date
    let instruments: [String: InstrumentDefinition]
    let aliases: [String: String]

    static let empty = ChordLibraryData(
        version: 1,
        generatedAt: Date(timeIntervalSince1970: 0),
        instruments: [:],
        aliases: [:]
    )
}

struct InstrumentDefinition: Codable, Hashable {
    let id: String
    let label: String
    let strings: [String]
    let shapes: [String: ChordShape]
}

struct ChordShape: Codable, Hashable {
    let frets: [String]
    let fingers: [Int]
    let baseFret: Int
    let aliasOf: String
    let barre: BarreShape?
}

struct BarreShape: Codable, Hashable {
    let fret: Int
    let fromString: Int
    let toString: Int
}

struct ArtistSection: Identifiable, Hashable {
    let artist: String
    let songs: [SongRecord]

    var id: String { artist }
}

struct ResolvedCapoTarget: Hashable {
    let key: String
    let label: String
    let fret: Int?
    let shapeKey: String?
}

struct ResolvedChordCard: Identifiable, Hashable {
    let requestedChord: String
    let resolvedChord: String
    let shape: ChordShape?
    let instrumentLabel: String

    var id: String { requestedChord }
}
