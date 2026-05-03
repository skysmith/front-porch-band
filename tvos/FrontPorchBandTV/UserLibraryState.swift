import Foundation

@MainActor
final class UserLibraryState: ObservableObject {
    private enum Keys {
        static let favorites = "front-porch-band-tv-favorites"
        static let recentSongs = "front-porch-band-tv-recent-songs"
        static let preferredInstrument = "front-porch-band-tv-preferred-instrument"
        static let fontScale = "front-porch-band-tv-font-scale"
        static let transposeTarget = "front-porch-band-tv-transpose-target"
    }

    private let defaults: UserDefaults
    private let maxRecentSongs = 20

    @Published private(set) var favorites: Set<String>
    @Published private(set) var recentSongs: [String]
    @Published var preferredInstrument: InstrumentID {
        didSet { defaults.set(preferredInstrument.rawValue, forKey: Keys.preferredInstrument) }
    }
    @Published var fontScale: Double {
        didSet { defaults.set(fontScale, forKey: Keys.fontScale) }
    }
    @Published var transposeTarget: TransposeTarget {
        didSet { defaults.set(transposeTarget.rawValue, forKey: Keys.transposeTarget) }
    }

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        self.favorites = Set(defaults.stringArray(forKey: Keys.favorites) ?? [])
        self.recentSongs = defaults.stringArray(forKey: Keys.recentSongs) ?? []
        self.preferredInstrument = InstrumentID(rawValue: defaults.string(forKey: Keys.preferredInstrument) ?? "") ?? .guitar

        let savedFontScale = defaults.object(forKey: Keys.fontScale) as? Double ?? 1.0
        self.fontScale = min(1.8, max(0.6, savedFontScale))

        let savedTranspose = defaults.string(forKey: Keys.transposeTarget) ?? TransposeTarget.original.rawValue
        self.transposeTarget = TransposeTarget(rawValue: savedTranspose)
    }

    func isFavorite(_ song: SongRecord) -> Bool {
        favorites.contains(song.slug)
    }

    func toggleFavorite(_ song: SongRecord) {
        if favorites.contains(song.slug) {
            favorites.remove(song.slug)
        } else {
            favorites.insert(song.slug)
        }

        defaults.set(Array(favorites).sorted(), forKey: Keys.favorites)
    }

    func markRecent(_ song: SongRecord) {
        recentSongs.removeAll(where: { $0 == song.slug })
        recentSongs.insert(song.slug, at: 0)
        recentSongs = Array(recentSongs.prefix(maxRecentSongs))
        defaults.set(recentSongs, forKey: Keys.recentSongs)
    }

    func adjustFont(by delta: Double) {
        fontScale = min(1.8, max(0.6, fontScale + delta))
    }

    func resetPreferences() {
        favorites = []
        recentSongs = []
        preferredInstrument = .guitar
        fontScale = 1.0
        transposeTarget = .original

        defaults.removeObject(forKey: Keys.favorites)
        defaults.removeObject(forKey: Keys.recentSongs)
        defaults.removeObject(forKey: Keys.preferredInstrument)
        defaults.removeObject(forKey: Keys.fontScale)
        defaults.removeObject(forKey: Keys.transposeTarget)
    }
}
