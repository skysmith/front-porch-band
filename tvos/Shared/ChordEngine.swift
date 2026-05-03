import Foundation

enum ChordEngine {
    static let noteNames = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]
    static let capoShapes = ["G", "C", "D", "A", "E"]

    private static let noteIndex: [String: Int] = [
        "C": 0,
        "B#": 0,
        "C#": 1,
        "Db": 1,
        "D": 2,
        "D#": 3,
        "Eb": 3,
        "E": 4,
        "Fb": 4,
        "F": 5,
        "E#": 5,
        "F#": 6,
        "Gb": 6,
        "G": 7,
        "G#": 8,
        "Ab": 8,
        "A": 9,
        "A#": 10,
        "Bb": 10,
        "B": 11,
        "Cb": 11,
    ]

    private static let chordTokenRegex = try! NSRegularExpression(
        pattern: #"\b[A-G](?:#|b)?(?:\/[A-G](?:#|b)?)?(?:maj7|m7|sus2|sus4|m|6|7)?\b"#,
        options: []
    )

    private static let chordTokenExtractionRegex = try! NSRegularExpression(
        pattern: #"\b[A-G](?:#|b)?(?:\/[A-G](?:#|b)?)?(?:maj7|m7|sus2|sus4|m|6|7)?\*{0,2}\b"#,
        options: []
    )

    private static let chordRootRegex = try! NSRegularExpression(
        pattern: #"^([A-G](?:#|b)?)(.*)$"#,
        options: []
    )

    static func transposeRoot(_ root: String, steps: Int) -> String {
        guard let index = noteIndex[root] else {
            return root
        }

        return noteNames[(index + steps + 120) % 12]
    }

    static func transposeChordToken(_ token: String, steps: Int) -> String {
        guard steps != 0 else {
            return token
        }

        let parts = token.split(separator: "/", maxSplits: 1).map(String.init)
        guard let main = parts.first, let parsedMain = parseChordToken(main) else {
            return token
        }

        let transposedMain = transposeRoot(parsedMain.root, steps: steps) + parsedMain.suffix
        guard parts.count > 1, let bass = parts.last, let parsedBass = parseChordToken(bass) else {
            return transposedMain
        }

        return transposedMain + "/" + transposeRoot(parsedBass.root, steps: steps)
    }

    static func transposeChartText(_ text: String, steps: Int) -> String {
        guard steps != 0 else {
            return text
        }

        let nsText = text as NSString
        let matches = chordTokenRegex.matches(in: text, range: NSRange(location: 0, length: nsText.length))
        let mutable = NSMutableString(string: text)

        for match in matches.reversed() {
            let token = nsText.substring(with: match.range)
            mutable.replaceCharacters(in: match.range, with: transposeChordToken(token, steps: steps))
        }

        return mutable as String
    }

    static func splitChartSections(_ text: String) -> [String] {
        text
            .replacingOccurrences(of: "\r", with: "")
            .replacingOccurrences(of: #"\n{2,}"#, with: "\u{1F}", options: .regularExpression)
            .components(separatedBy: "\u{1F}")
            .map { $0.trimmingCharacters(in: .newlines) }
            .filter { !$0.isEmpty }
    }

    static func extractBaseKey(for song: SongRecord) -> String {
        if let parsedBase = parseChordToken(song.baseKey)?.root {
            return parsedBase
        }

        let nsText = song.chartText as NSString
        guard let match = chordTokenRegex.firstMatch(in: song.chartText, range: NSRange(location: 0, length: nsText.length)) else {
            return ""
        }

        return parseChordToken(nsText.substring(with: match.range))?.root ?? ""
    }

    static func transposeSteps(for song: SongRecord, target: TransposeTarget) -> Int {
        let baseKey = extractBaseKey(for: song)
        let resolved = resolveTransposeTarget(baseKey: baseKey, target: target)
        guard let baseIndex = noteIndex[baseKey], let targetIndex = noteIndex[resolved.key] else {
            return 0
        }

        return targetIndex - baseIndex
    }

    static func resolveTransposeTarget(baseKey: String, target: TransposeTarget) -> ResolvedCapoTarget {
        guard !baseKey.isEmpty, target != .original else {
            return ResolvedCapoTarget(key: "", label: "", fret: nil, shapeKey: nil)
        }

        if let instrument = target.instrumentTranspose {
            switch instrument {
            case .bbInstrument:
                return ResolvedCapoTarget(key: transposeRoot(baseKey, steps: 2), label: instrument.label, fret: nil, shapeKey: nil)
            case .ebInstrument:
                return ResolvedCapoTarget(key: transposeRoot(baseKey, steps: 9), label: instrument.label, fret: nil, shapeKey: nil)
            case .fInstrument:
                return ResolvedCapoTarget(key: transposeRoot(baseKey, steps: 7), label: instrument.label, fret: nil, shapeKey: nil)
            }
        }

        if let shapeKey = target.capoShapeKey {
            let fret = capoFret(baseKey: baseKey, shapeKey: shapeKey)
            return ResolvedCapoTarget(
                key: shapeKey,
                label: fret.map { "\(shapeKey) shapes (capo \($0))" } ?? shapeKey,
                fret: fret,
                shapeKey: shapeKey
            )
        }

        return ResolvedCapoTarget(key: target.rawValue, label: "Key \(target.rawValue)", fret: nil, shapeKey: nil)
    }

    static func capoFret(baseKey: String, shapeKey: String) -> Int? {
        guard let baseIndex = noteIndex[baseKey], let shapeIndex = noteIndex[shapeKey] else {
            return nil
        }

        return (baseIndex - shapeIndex + 12) % 12
    }

    static func currentChartText(for song: SongRecord, target: TransposeTarget) -> String {
        transposeChartText(song.chartText, steps: transposeSteps(for: song, target: target))
    }

    static func extractChordTokens(chartText: String, aliases: [String: String]) -> [String] {
        let nsText = chartText as NSString
        let matches = chordTokenExtractionRegex.matches(in: chartText, range: NSRange(location: 0, length: nsText.length))
        var seen = Set<String>()

        return matches.compactMap { match in
            let token = nsText.substring(with: match.range)
            let normalized = aliases[token] ?? token
            guard !seen.contains(normalized) else {
                return nil
            }
            seen.insert(normalized)
            return normalized
        }
    }

    static func resolveChordCards(
        song: SongRecord,
        target: TransposeTarget,
        instrument: InstrumentID,
        chordLibrary: ChordLibraryData
    ) -> [ResolvedChordCard] {
        guard let instrumentDefinition = chordLibrary.instruments[instrument.rawValue] else {
            return []
        }

        let chartText = currentChartText(for: song, target: target)
        let requestedChords = extractChordTokens(chartText: chartText, aliases: chordLibrary.aliases)
        var seen = Set<String>()

        return requestedChords.compactMap { requestedChord in
            let resolvedChord = resolveChordName(
                requestedChord,
                instrumentId: instrument,
                chordLibrary: chordLibrary
            )

            guard !seen.contains(resolvedChord) else {
                return nil
            }
            seen.insert(resolvedChord)

            return ResolvedChordCard(
                requestedChord: requestedChord,
                resolvedChord: resolvedChord,
                shape: instrumentDefinition.shapes[resolvedChord],
                instrumentLabel: instrumentDefinition.label
            )
        }
    }

    static func resolveChordName(
        _ chordName: String,
        instrumentId: InstrumentID,
        chordLibrary: ChordLibraryData
    ) -> String {
        guard let instrument = chordLibrary.instruments[instrumentId.rawValue] else {
            return chordName
        }

        let normalized = chordLibrary.aliases[chordName] ?? chordName
        let main = normalized.split(separator: "/", maxSplits: 1).first.map(String.init) ?? normalized
        let candidates = (
            [normalized, main, swapEnharmonicRoot(normalized), swapEnharmonicRoot(main)] +
            buildRelaxedCandidates(normalized) +
            buildRelaxedCandidates(main)
        ).filter { !$0.isEmpty }

        for candidate in candidates {
            if instrument.shapes[candidate] != nil {
                return candidate
            }
        }

        return normalized
    }

    static func controlLabel(for target: TransposeTarget, song: SongRecord) -> String {
        let baseKey = extractBaseKey(for: song)

        if target == .original {
            return baseKey.isEmpty ? "Original" : "Orig (\(baseKey))"
        }

        if let instrument = target.instrumentTranspose {
            return instrument.label
        }

        if let shapeKey = target.capoShapeKey {
            let fret = capoFret(baseKey: baseKey, shapeKey: shapeKey)
            return fret.map { "\(shapeKey) shapes (\($0))" } ?? shapeKey
        }

        return "Key \(target.rawValue)"
    }

    private static func parseChordToken(_ token: String) -> (root: String, suffix: String)? {
        let nsToken = token as NSString
        let range = NSRange(location: 0, length: nsToken.length)
        guard let match = chordRootRegex.firstMatch(in: token, range: range), match.numberOfRanges == 3 else {
            return nil
        }

        let root = nsToken.substring(with: match.range(at: 1))
        let suffix = nsToken.substring(with: match.range(at: 2))
        return (root, suffix)
    }

    private static func swapEnharmonicRoot(_ chordName: String) -> String {
        guard let parsed = parseChordToken(chordName) else {
            return chordName
        }

        let swappedRoot: String
        switch parsed.root {
        case "C#": swappedRoot = "Db"
        case "Db": swappedRoot = "C#"
        case "D#": swappedRoot = "Eb"
        case "Eb": swappedRoot = "D#"
        case "F#": swappedRoot = "Gb"
        case "Gb": swappedRoot = "F#"
        case "G#": swappedRoot = "Ab"
        case "Ab": swappedRoot = "G#"
        case "A#": swappedRoot = "Bb"
        case "Bb": swappedRoot = "A#"
        default: swappedRoot = parsed.root
        }

        return swappedRoot + parsed.suffix
    }

    private static func buildRelaxedCandidates(_ chordName: String) -> [String] {
        guard let parsed = parseChordToken(chordName) else {
            return []
        }

        let suffix = parsed.suffix
        guard !suffix.isEmpty else {
            return []
        }

        let relaxedSuffixes: [String]
        switch suffix {
        case "maj7":
            relaxedSuffixes = ["7", ""]
        case "m7":
            relaxedSuffixes = ["m", ""]
        case "sus2", "sus4":
            relaxedSuffixes = [""]
        case "6", "7":
            relaxedSuffixes = [""]
        default:
            relaxedSuffixes = []
        }

        return relaxedSuffixes.map { parsed.root + $0 }
    }
}
