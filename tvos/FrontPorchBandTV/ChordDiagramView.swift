import SwiftUI

struct ChordShapeCardView: View {
    let card: ResolvedChordCard
    let instrumentDefinition: InstrumentDefinition?

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            VStack(alignment: .leading, spacing: 6) {
                Text(card.requestedChord)
                    .font(.title3.weight(.semibold))

                if card.requestedChord != card.resolvedChord {
                    Text("Using \(card.resolvedChord)")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }

            if let shape = card.shape, let instrumentDefinition {
                ChordDiagramView(
                    chordName: card.resolvedChord,
                    instrument: instrumentDefinition,
                    shape: shape
                )
            } else {
                VStack(alignment: .leading, spacing: 10) {
                    Image(systemName: "music.note")
                        .font(.system(size: 38))
                    Text("No saved \(card.instrumentLabel.lowercased()) shape yet.")
                        .font(.headline)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, minHeight: 250, alignment: .leading)
            }
        }
        .padding(24)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 28, style: .continuous))
    }
}

struct ChordDiagramView: View {
    let chordName: String
    let instrument: InstrumentDefinition
    let shape: ChordShape

    var body: some View {
        GeometryReader { geometry in
            let size = geometry.size
            let topY = size.height * 0.20
            let leftX = size.width * 0.14
            let gridWidth = size.width * 0.72
            let fretGap = size.height * 0.15
            let stringGap = instrument.strings.count > 1 ? gridWidth / CGFloat(instrument.strings.count - 1) : 0
            let stringEntries = instrument.strings.enumerated().map { item in
                StringLayoutEntry(
                    id: item.offset,
                    label: item.element,
                    fretValue: shape.frets[safe: item.offset] ?? "x",
                    x: leftX + CGFloat(item.offset) * stringGap,
                    openLabelY: topY - 20,
                    stringLabelY: topY + fretGap * 4 + 22
                )
            }
            let fretDots = shape.frets.enumerated().compactMap { item -> FretDotEntry? in
                guard let fret = Int(item.element), fret > 0 else {
                    return nil
                }

                let isCoveredByBarre = shape.barre.map { barre in
                    fret == barre.fret &&
                    item.offset >= barre.fromString &&
                    item.offset <= barre.toString
                } ?? false

                guard !isCoveredByBarre else {
                    return nil
                }

                return FretDotEntry(
                    id: item.offset,
                    x: leftX + CGFloat(item.offset) * stringGap,
                    y: topY + (CGFloat(fret - shape.baseFret) + 0.5) * fretGap,
                    finger: shape.fingers[safe: item.offset] ?? 0
                )
            }

            ZStack {
                Canvas { context, _ in
                    var grid = Path()

                    for stringIndex in instrument.strings.indices {
                        let x = leftX + CGFloat(stringIndex) * stringGap
                        grid.move(to: CGPoint(x: x, y: topY))
                        grid.addLine(to: CGPoint(x: x, y: topY + fretGap * 4))
                    }

                    for fretIndex in 0...4 {
                        let y = topY + CGFloat(fretIndex) * fretGap
                        grid.move(to: CGPoint(x: leftX, y: y))
                        grid.addLine(to: CGPoint(x: leftX + gridWidth, y: y))
                    }

                    context.stroke(grid, with: .color(.white.opacity(0.7)), lineWidth: 2.5)

                    if let barre = shape.barre {
                        let x1 = leftX + CGFloat(barre.fromString) * stringGap
                        let x2 = leftX + CGFloat(barre.toString) * stringGap
                        let y = topY + (CGFloat(barre.fret - shape.baseFret) + 0.5) * fretGap
                        let rect = CGRect(x: x1 - 10, y: y - 10, width: max(24, x2 - x1 + 20), height: 20)
                        context.fill(
                            Path(roundedRect: rect, cornerRadius: 10),
                            with: .color(.accentColor)
                        )
                    }
                }

                Text(chordName)
                    .font(.title2.weight(.bold))
                    .position(x: size.width / 2, y: size.height * 0.08)

                if shape.baseFret > 1 {
                    Text("\(shape.baseFret)fr")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .position(x: leftX * 0.45, y: topY + fretGap * 0.5)
                }

                ForEach(stringEntries) { entry in
                    Text(openStringLabel(for: entry.fretValue))
                        .font(.headline)
                        .foregroundStyle(.secondary)
                        .position(x: entry.x, y: entry.openLabelY)

                    Text(entry.label)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(.secondary)
                        .position(x: entry.x, y: entry.stringLabelY)
                }

                ForEach(fretDots) { dot in
                    Circle()
                        .fill(Color.accentColor)
                        .frame(width: 24, height: 24)
                        .position(x: dot.x, y: dot.y)

                    if dot.finger > 0 {
                        Text("\(dot.finger)")
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(.white)
                            .position(x: dot.x, y: dot.y)
                    }
                }
            }
        }
        .frame(height: 280)
    }

    private func openStringLabel(for value: String) -> String {
        value == "x" ? "x" : "o"
    }
}

private extension Array {
    subscript(safe index: Int) -> Element? {
        guard indices.contains(index) else {
            return nil
        }
        return self[index]
    }
}

private struct StringLayoutEntry: Identifiable {
    let id: Int
    let label: String
    let fretValue: String
    let x: CGFloat
    let openLabelY: CGFloat
    let stringLabelY: CGFloat
}

private struct FretDotEntry: Identifiable {
    let id: Int
    let x: CGFloat
    let y: CGFloat
    let finger: Int
}
