import SwiftUI

struct RootView: View {
    let launchConfiguration: AppLaunchConfiguration

    @EnvironmentObject private var catalogStore: CatalogStore
    @EnvironmentObject private var userState: UserLibraryState

    @State private var selectedTab: AppLaunchConfiguration.Tab
    @State private var browsePath: [SongRecord] = []
    @State private var didApplyLaunchConfiguration = false

    init(launchConfiguration: AppLaunchConfiguration = .default) {
        self.launchConfiguration = launchConfiguration
        _selectedTab = State(initialValue: launchConfiguration.initialTab)
    }

    var body: some View {
        if let loadingError = catalogStore.loadingError {
            VStack(alignment: .leading, spacing: 16) {
                Text("Could not load the song catalog.")
                    .font(.largeTitle.weight(.bold))
                Text(loadingError)
                    .font(.title3)
                    .foregroundStyle(.secondary)
            }
            .padding(48)
        } else {
            TabView(selection: $selectedTab) {
                NavigationStack(path: $browsePath) {
                    BrowseView(
                        initialLibrary: launchConfiguration.initialLibrary,
                        initialChordFilter: launchConfiguration.initialChordFilter,
                        initialQuery: launchConfiguration.initialQuery
                    )
                    .navigationDestination(for: SongRecord.self) { song in
                        SongDetailView(song: song)
                    }
                }
                .tabItem {
                    Label("Browse", systemImage: "music.note.house")
                }
                .tag(AppLaunchConfiguration.Tab.browse)

                NavigationStack {
                    FavoritesView()
                        .navigationDestination(for: SongRecord.self) { song in
                            SongDetailView(song: song)
                        }
                }
                .tabItem {
                    Label("Favorites", systemImage: "star.fill")
                }
                .tag(AppLaunchConfiguration.Tab.favorites)

                NavigationStack {
                    RecentView()
                        .navigationDestination(for: SongRecord.self) { song in
                            SongDetailView(song: song)
                        }
                }
                .tabItem {
                    Label("Recent", systemImage: "clock.fill")
                }
                .tag(AppLaunchConfiguration.Tab.recent)

                NavigationStack {
                    SettingsView()
                }
                .tabItem {
                    Label("Settings", systemImage: "gearshape.fill")
                }
                .tag(AppLaunchConfiguration.Tab.settings)
            }
            .onAppear(perform: applyLaunchConfigurationIfNeeded)
        }
    }

    private func applyLaunchConfigurationIfNeeded() {
        guard !didApplyLaunchConfiguration else {
            return
        }

        didApplyLaunchConfiguration = true

        if launchConfiguration.resetState {
            userState.resetPreferences()
        }

        if let preferredInstrument = launchConfiguration.preferredInstrument {
            userState.preferredInstrument = preferredInstrument
        }

        if let transposeTarget = launchConfiguration.transposeTarget {
            userState.transposeTarget = transposeTarget
        }

        if let fontScale = launchConfiguration.fontScale {
            userState.fontScale = min(1.8, max(0.85, fontScale))
        }

        selectedTab = launchConfiguration.initialTab

        if let songSlug = launchConfiguration.initialSongSlug,
           let song = catalogStore.song(slug: songSlug) {
            selectedTab = .browse
            browsePath = [song]
        }
    }
}

struct BrowseView: View {
    @EnvironmentObject private var catalogStore: CatalogStore
    @State private var selectedLibrary: LibraryID
    @State private var chordFilter: ChordFilterOption
    @State private var query: String

    init(
        initialLibrary: LibraryID = .frontPorch,
        initialChordFilter: ChordFilterOption = .all,
        initialQuery: String = ""
    ) {
        _selectedLibrary = State(initialValue: initialLibrary)
        _chordFilter = State(initialValue: initialChordFilter)
        _query = State(initialValue: initialQuery)
    }

    private var sections: [ArtistSection] {
        catalogStore.groupedSongs(
            library: selectedLibrary,
            chordFilter: chordFilter,
            query: query
        )
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 28) {
            Text("Browse")
                .font(.largeTitle.weight(.bold))

            HStack(alignment: .bottom, spacing: 20) {
                FilterPicker(title: "Library", selection: $selectedLibrary) {
                    ForEach(LibraryID.allCases) { library in
                        Text(library.label).tag(library)
                    }
                }
                .accessibilityIdentifier("browse-library-picker")

                FilterPicker(title: "Chord filter", selection: $chordFilter) {
                    ForEach(ChordFilterOption.allCases) { filter in
                        Text(filter.label).tag(filter)
                    }
                }
                .accessibilityIdentifier("browse-chord-filter-picker")

                VStack(alignment: .leading, spacing: 8) {
                    Text("Search")
                        .font(.headline)
                        .foregroundStyle(.secondary)
                    TextField("Search title or artist", text: $query)
                        .padding(.horizontal, 18)
                        .padding(.vertical, 14)
                        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                        .frame(minWidth: 520)
                        .accessibilityIdentifier("browse-search-field")
                }
            }

            SongSectionListView(
                sections: sections,
                emptyTitle: "No matching songs",
                emptyMessage: "Try a different library, search term, or chord filter.",
                listIdentifier: "browse-song-list"
            )
        }
        .padding(48)
    }
}

struct FavoritesView: View {
    @EnvironmentObject private var catalogStore: CatalogStore
    @EnvironmentObject private var userState: UserLibraryState

    var body: some View {
        SongCollectionView(
            title: "Favorites",
            subtitle: "Pinned songs stay close for quick set changes.",
            songs: catalogStore.favoriteSongs(using: userState),
            emptyTitle: "No favorites yet",
            emptyMessage: "Open a song and star it to keep it in your living-room set list.",
            listIdentifier: "favorites-song-list"
        )
    }
}

struct RecentView: View {
    @EnvironmentObject private var catalogStore: CatalogStore
    @EnvironmentObject private var userState: UserLibraryState

    var body: some View {
        SongCollectionView(
            title: "Recent",
            subtitle: "The last songs you opened on this Apple TV user profile.",
            songs: catalogStore.recentSongs(using: userState),
            emptyTitle: "No recent songs yet",
            emptyMessage: "Open a chart from Browse and it will show up here.",
            listIdentifier: "recent-song-list"
        )
    }
}

struct SettingsView: View {
    @EnvironmentObject private var catalogStore: CatalogStore
    @EnvironmentObject private var userState: UserLibraryState

    var body: some View {
        List {
            Section("Defaults") {
                Picker("Instrument", selection: $userState.preferredInstrument) {
                    ForEach(catalogStore.supportedInstrumentChoices) { instrument in
                        Text(catalogStore.instrumentDefinition(for: instrument)?.label ?? instrument.fallbackLabel)
                            .tag(instrument)
                    }
                }
                .accessibilityIdentifier("settings-instrument-picker")

                HStack {
                    Text("Chart size")
                    Spacer()
                    Text("\(Int(userState.fontScale * 100))%")
                        .foregroundStyle(.secondary)
                }

                HStack(spacing: 20) {
                    Button("Smaller") {
                        userState.adjustFont(by: -0.08)
                    }
                    .accessibilityIdentifier("settings-font-smaller")

                    Button("Larger") {
                        userState.adjustFont(by: 0.08)
                    }
                    .accessibilityIdentifier("settings-font-larger")
                }
            }

            Section("Library Data") {
                HStack {
                    Text("Songs")
                    Spacer()
                    Text("\(catalogStore.catalog.songs.count)")
                        .foregroundStyle(.secondary)
                }

                HStack {
                    Text("Catalog generated")
                    Spacer()
                    Text(catalogStore.catalog.generatedAt.formatted(date: .abbreviated, time: .shortened))
                        .foregroundStyle(.secondary)
                }
            }

            Section("Reset") {
                Button("Clear favorites, recents, and view settings", role: .destructive) {
                    userState.resetPreferences()
                }
                .accessibilityIdentifier("settings-reset-button")
            }
        }
        .navigationTitle("Settings")
    }
}

struct SongSectionListView: View {
    let sections: [ArtistSection]
    let emptyTitle: String
    let emptyMessage: String
    let listIdentifier: String

    var body: some View {
        if sections.isEmpty {
            EmptyLibraryStateView(title: emptyTitle, message: emptyMessage)
        } else {
            List {
                ForEach(sections) { section in
                    Section(section.artist) {
                        ForEach(section.songs) { song in
                            SongNavigationRow(song: song)
                        }
                    }
                }
            }
            .listStyle(.plain)
            .accessibilityIdentifier(listIdentifier)
        }
    }
}

struct SongCollectionView: View {
    let title: String
    let subtitle: String
    let songs: [SongRecord]
    let emptyTitle: String
    let emptyMessage: String
    let listIdentifier: String

    var body: some View {
        VStack(alignment: .leading, spacing: 28) {
            VStack(alignment: .leading, spacing: 6) {
                Text(title)
                    .font(.largeTitle.weight(.bold))
                Text(subtitle)
                    .font(.title3)
                    .foregroundStyle(.secondary)
            }

            if songs.isEmpty {
                EmptyLibraryStateView(title: emptyTitle, message: emptyMessage)
            } else {
                List(songs) { song in
                    SongNavigationRow(song: song)
                }
                .listStyle(.plain)
                .accessibilityIdentifier(listIdentifier)
            }
        }
        .padding(48)
    }
}

struct SongNavigationRow: View {
    let song: SongRecord

    var body: some View {
        NavigationLink(value: song) {
            HStack {
                VStack(alignment: .leading, spacing: 6) {
                    Text(song.title)
                        .font(.title3.weight(.semibold))
                    Text(song.artist)
                        .font(.headline)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                if song.hasChords {
                    Label("Chords", systemImage: "music.note")
                        .labelStyle(.titleAndIcon)
                        .foregroundStyle(.secondary)
                }
            }
            .padding(.vertical, 10)
        }
        .accessibilityIdentifier("song-row-\(song.slug)")
    }
}

struct EmptyLibraryStateView: View {
    let title: String
    let message: String

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(.title.weight(.semibold))
            Text(message)
                .font(.title3)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .padding(32)
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 28, style: .continuous))
    }
}

struct FilterPicker<Content: View, SelectionValue: Hashable>: View {
    let title: String
    @Binding var selection: SelectionValue
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.headline)
                .foregroundStyle(.secondary)
            Picker(title, selection: $selection) {
                content()
            }
            .pickerStyle(.menu)
            .frame(minWidth: 240)
        }
    }
}
