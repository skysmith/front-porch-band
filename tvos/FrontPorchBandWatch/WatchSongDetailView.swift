import SwiftUI

struct WatchSongDetailView: View {
    let song: SongRecord

    @EnvironmentObject private var userState: UserLibraryState

    private var displayedText: String {
        LyricsFormatter.lyricsText(
            for: song,
            target: userState.transposeTarget,
            stripsChordLines: !userState.showChordsInline
        )
    }

    private var keyLabel: String {
        let key = ChordEngine.extractBaseKey(for: song)
        return key.isEmpty ? "Key unknown" : "Key \(key)"
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 10) {
                Text(song.title)
                    .font(.headline)

                Text(song.artist)
                    .font(.caption)
                    .foregroundStyle(.secondary)

                Text(keyLabel)
                    .font(.caption2)
                    .foregroundStyle(.secondary)

                Toggle("Show chords", isOn: $userState.showChordsInline)
                    .toggleStyle(.switch)
                    .padding(.vertical, 4)

                Text(displayedText)
                    .font(userState.showChordsInline ? .system(.footnote, design: .monospaced) : .footnote)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.horizontal, 6)
            .padding(.bottom, 12)
        }
        .navigationTitle(song.title)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    userState.toggleFavorite(song)
                } label: {
                    Image(systemName: userState.isFavorite(song) ? "star.fill" : "star")
                }
            }
        }
        .onAppear {
            userState.markRecent(song)
        }
    }
}
