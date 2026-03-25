import Foundation

@MainActor
final class CatalogStore: ObservableObject {
    @Published private(set) var catalog: SongCatalog
    @Published private(set) var chordLibrary: ChordLibraryData
    @Published private(set) var loadingError: String?

    init(bundle: Bundle = .main) {
        do {
            self.catalog = try CatalogStore.load(SongCatalog.self, named: "SongCatalog", bundle: bundle)
            self.chordLibrary = try CatalogStore.load(ChordLibraryData.self, named: "ChordLibrary", bundle: bundle)
            self.loadingError = nil
        } catch {
            self.catalog = .empty
            self.chordLibrary = .empty
            self.loadingError = error.localizedDescription
        }
    }

    private static func load<T: Decodable>(_ type: T.Type, named name: String, bundle: Bundle) throws -> T {
        guard let url = bundle.url(forResource: name, withExtension: "json") else {
            throw NSError(
                domain: "FrontPorchBandTV",
                code: 1,
                userInfo: [NSLocalizedDescriptionKey: "Missing bundled resource \(name).json."]
            )
        }

        let data = try Data(contentsOf: url)
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode(type, from: data)
    }

    var supportedInstrumentChoices: [InstrumentID] {
        InstrumentID.allCases.filter { instrument in
            guard let definition = chordLibrary.instruments[instrument.rawValue] else {
                return false
            }

            return !definition.shapes.isEmpty && instrument != .bouzouki
        }
    }

    func instrumentDefinition(for instrument: InstrumentID) -> InstrumentDefinition? {
        chordLibrary.instruments[instrument.rawValue]
    }

    func groupedSongs(
        library: LibraryID,
        chordFilter: ChordFilterOption,
        query: String
    ) -> [ArtistSection] {
        let filteredSongs = songs(library: library, chordFilter: chordFilter, query: query)
        var groups: [String: [SongRecord]] = [:]

        for song in filteredSongs {
            for artist in song.artistAliases.isEmpty ? [song.artist] : song.artistAliases {
                groups[artist, default: []].append(song)
            }
        }

        return groups
            .map { artist, songs in
                ArtistSection(
                    artist: artist,
                    songs: songs
                        .unique(on: \.slug)
                        .sorted { lhs, rhs in
                            if lhs.sortTitle == rhs.sortTitle {
                                return lhs.slug < rhs.slug
                            }
                            return lhs.sortTitle < rhs.sortTitle
                        }
                )
            }
            .sorted { lhs, rhs in
                lhs.artist.localizedCaseInsensitiveCompare(rhs.artist) == .orderedAscending
            }
    }

    func songs(
        library: LibraryID,
        chordFilter: ChordFilterOption,
        query: String
    ) -> [SongRecord] {
        let normalizedQuery = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()

        return catalog.songs.filter { song in
            guard song.library == library else {
                return false
            }

            switch chordFilter {
            case .all:
                break
            case .withChords:
                guard song.hasChords else { return false }
            case .withoutChords:
                guard !song.hasChords else { return false }
            }

            guard !normalizedQuery.isEmpty else {
                return true
            }

            let haystack = "\(song.title) \(song.artist) \(song.artistAliases.joined(separator: " "))".lowercased()
            return haystack.contains(normalizedQuery)
        }
    }

    func favoriteSongs(using userState: UserLibraryState) -> [SongRecord] {
        catalog.songs
            .filter { userState.favorites.contains($0.slug) }
            .sorted { lhs, rhs in
                if lhs.sortArtist == rhs.sortArtist {
                    return lhs.sortTitle < rhs.sortTitle
                }
                return lhs.sortArtist < rhs.sortArtist
            }
    }

    func recentSongs(using userState: UserLibraryState) -> [SongRecord] {
        userState.recentSongs.compactMap { slug in
            catalog.songs.first(where: { $0.slug == slug })
        }
    }

    func song(slug: String) -> SongRecord? {
        catalog.songs.first(where: { $0.slug == slug })
    }
}

private extension Array {
    func unique<Value: Hashable>(on keyPath: KeyPath<Element, Value>) -> [Element] {
        var seen = Set<Value>()
        return filter { element in
            let value = element[keyPath: keyPath]
            guard !seen.contains(value) else { return false }
            seen.insert(value)
            return true
        }
    }
}
