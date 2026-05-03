import Foundation

@MainActor
final class UserLibraryState: ObservableObject {
    private struct Keys {
        let favorites: String
        let recentSongs: String
        let preferredInstrument: String
        let fontScale: String
        let transposeTarget: String
        let showChordsInline: String
    }

    private let defaults: UserDefaults
    private let keys: Keys
    private let maxRecentSongs = 20

    @Published private(set) var favorites: Set<String>
    @Published private(set) var recentSongs: [String]
    @Published var preferredInstrument: InstrumentID {
        didSet { defaults.set(preferredInstrument.rawValue, forKey: keys.preferredInstrument) }
    }
    @Published var fontScale: Double {
        didSet { defaults.set(fontScale, forKey: keys.fontScale) }
    }
    @Published var transposeTarget: TransposeTarget {
        didSet { defaults.set(transposeTarget.rawValue, forKey: keys.transposeTarget) }
    }
    @Published var showChordsInline: Bool {
        didSet { defaults.set(showChordsInline, forKey: keys.showChordsInline) }
    }

    init(defaults: UserDefaults = .standard, keyPrefix: String = "front-porch-band-tv") {
        self.defaults = defaults
        self.keys = Keys(
            favorites: "\(keyPrefix)-favorites",
            recentSongs: "\(keyPrefix)-recent-songs",
            preferredInstrument: "\(keyPrefix)-preferred-instrument",
            fontScale: "\(keyPrefix)-font-scale",
            transposeTarget: "\(keyPrefix)-transpose-target",
            showChordsInline: "\(keyPrefix)-show-chords-inline"
        )
        self.favorites = Set(defaults.stringArray(forKey: keys.favorites) ?? [])
        self.recentSongs = defaults.stringArray(forKey: keys.recentSongs) ?? []
        self.preferredInstrument = InstrumentID(rawValue: defaults.string(forKey: keys.preferredInstrument) ?? "") ?? .guitar

        let savedFontScale = defaults.object(forKey: keys.fontScale) as? Double ?? 1.0
        self.fontScale = min(1.8, max(0.6, savedFontScale))

        let savedTranspose = defaults.string(forKey: keys.transposeTarget) ?? TransposeTarget.original.rawValue
        self.transposeTarget = TransposeTarget(rawValue: savedTranspose)
        self.showChordsInline = defaults.object(forKey: keys.showChordsInline) as? Bool ?? false
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

        defaults.set(Array(favorites).sorted(), forKey: keys.favorites)
    }

    func markRecent(_ song: SongRecord) {
        recentSongs.removeAll(where: { $0 == song.slug })
        recentSongs.insert(song.slug, at: 0)
        recentSongs = Array(recentSongs.prefix(maxRecentSongs))
        defaults.set(recentSongs, forKey: keys.recentSongs)
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
        showChordsInline = false

        defaults.removeObject(forKey: keys.favorites)
        defaults.removeObject(forKey: keys.recentSongs)
        defaults.removeObject(forKey: keys.preferredInstrument)
        defaults.removeObject(forKey: keys.fontScale)
        defaults.removeObject(forKey: keys.transposeTarget)
        defaults.removeObject(forKey: keys.showChordsInline)
    }
}
