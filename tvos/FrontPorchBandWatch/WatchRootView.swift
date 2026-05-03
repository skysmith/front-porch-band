import SwiftUI

struct WatchRootView: View {
    @EnvironmentObject private var catalogStore: CatalogStore
    @EnvironmentObject private var userState: UserLibraryState
    @State private var browseQuery = ""

    private var filteredSongs: [SongRecord] {
        let query = browseQuery.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !query.isEmpty else {
            return catalogStore.allSongsSorted
        }

        return catalogStore.allSongsSorted.filter { song in
            let haystack = "\(song.title) \(song.artist) \(song.artistAliases.joined(separator: " "))".lowercased()
            return haystack.contains(query)
        }
    }

    var body: some View {
        TabView {
            songList(
                title: "Browse",
                songs: filteredSongs,
                emptyMessage: "No songs match that search."
            )
            .searchable(text: $browseQuery, prompt: "Search songs")

            songList(
                title: "Favorites",
                songs: catalogStore.favoriteSongs(using: userState),
                emptyMessage: "Star songs to keep them close."
            )

            songList(
                title: "Recent",
                songs: catalogStore.recentSongs(using: userState),
                emptyMessage: "Songs you open will show up here."
            )
        }
    }

    private func songList(title: String, songs: [SongRecord], emptyMessage: String) -> some View {
        NavigationStack {
            List {
                if songs.isEmpty {
                    Text(emptyMessage)
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(songs) { song in
                        NavigationLink(value: song) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(song.title)
                                    .font(.headline)
                                    .lineLimit(2)
                                Text(song.artist)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                    .lineLimit(1)
                            }
                        }
                    }
                }
            }
            .navigationTitle(title)
            .navigationDestination(for: SongRecord.self) { song in
                WatchSongDetailView(song: song)
            }
        }
    }
}
