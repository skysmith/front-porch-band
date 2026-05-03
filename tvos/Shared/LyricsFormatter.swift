import Foundation

enum LyricsFormatter {
    private static let chordTokenRegex = try! NSRegularExpression(
        pattern: #"^[A-G](?:#|b)?(?:/[A-G](?:#|b)?)?(?:maj7|m7|sus2|sus4|m|6|7)?\*{0,2}$"#,
        options: []
    )

    static func lyricsText(for song: SongRecord, target: TransposeTarget = .original, stripsChordLines: Bool = true) -> String {
        let chartText = ChordEngine.currentChartText(for: song, target: target)
        guard stripsChordLines else {
            return chartText
        }

        let lines = chartText
            .replacingOccurrences(of: "\r", with: "")
            .components(separatedBy: .newlines)

        var filtered: [String] = []
        var previousWasBlank = false

        for line in lines {
            let trimmed = line.trimmingCharacters(in: .whitespaces)

            if trimmed.isEmpty {
                if !previousWasBlank {
                    filtered.append("")
                }
                previousWasBlank = true
                continue
            }

            if isChordOnlyLine(trimmed) {
                continue
            }

            filtered.append(trimmed)
            previousWasBlank = false
        }

        return filtered.joined(separator: "\n").trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func isChordOnlyLine(_ line: String) -> Bool {
        if line.hasPrefix("[") && line.hasSuffix("]") {
            return false
        }

        if line == line.uppercased(), line.rangeOfCharacter(from: .letters) != nil, line.contains(" ") == false {
            return false
        }

        let tokens = line
            .split(whereSeparator: { $0.isWhitespace })
            .map(String.init)
            .map { $0.trimmingCharacters(in: CharacterSet(charactersIn: "|/")) }
            .filter { !$0.isEmpty }

        guard !tokens.isEmpty else {
            return false
        }

        for token in tokens {
            if token == "-" || token == "x" || token == "N.C." || token == "N.C" {
                continue
            }

            let range = NSRange(location: 0, length: token.utf16.count)
            guard chordTokenRegex.firstMatch(in: token, range: range) != nil else {
                return false
            }
        }

        return true
    }
}
