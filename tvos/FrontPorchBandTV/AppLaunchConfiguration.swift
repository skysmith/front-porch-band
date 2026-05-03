import Foundation

struct AppLaunchConfiguration: Equatable {
    enum Tab: String {
        case browse
        case favorites
        case recent
        case settings
    }

    let resetState: Bool
    let initialTab: Tab
    let initialLibrary: LibraryID
    let initialChordFilter: ChordFilterOption
    let initialQuery: String
    let initialSongSlug: String?
    let preferredInstrument: InstrumentID?
    let transposeTarget: TransposeTarget?
    let fontScale: Double?
    let shareBaseURL: URL?

    static let `default` = AppLaunchConfiguration(
        resetState: false,
        initialTab: .browse,
        initialLibrary: .frontPorch,
        initialChordFilter: .all,
        initialQuery: "",
        initialSongSlug: nil,
        preferredInstrument: nil,
        transposeTarget: nil,
        fontScale: nil,
        shareBaseURL: URL(string: "https://skysmith.github.io/front-porch-band/")
    )

    static var current: AppLaunchConfiguration {
        let arguments = ProcessInfo.processInfo.arguments

        return AppLaunchConfiguration(
            resetState: arguments.contains("-FrontPorchResetState") || arguments.contains("-uiTesting"),
            initialTab: value(after: "-FrontPorchTab", in: arguments).flatMap(Tab.init(rawValue:)) ?? .browse,
            initialLibrary: value(after: "-FrontPorchLibrary", in: arguments).flatMap(LibraryID.init(rawValue:)) ?? .frontPorch,
            initialChordFilter: value(after: "-FrontPorchChordFilter", in: arguments).flatMap(ChordFilterOption.init(rawValue:)) ?? .all,
            initialQuery: value(after: "-FrontPorchQuery", in: arguments) ?? "",
            initialSongSlug: value(after: "-FrontPorchSongSlug", in: arguments),
            preferredInstrument: value(after: "-FrontPorchInstrument", in: arguments).flatMap(InstrumentID.init(rawValue:)),
            transposeTarget: value(after: "-FrontPorchTranspose", in: arguments).map(TransposeTarget.init(rawValue:)),
            fontScale: value(after: "-FrontPorchFontScale", in: arguments).flatMap(Double.init),
            shareBaseURL: value(after: "-FrontPorchShareBaseURL", in: arguments).flatMap(URL.init(string:))
                ?? AppLaunchConfiguration.default.shareBaseURL
        )
    }

    private static func value(after flag: String, in arguments: [String]) -> String? {
        guard let index = arguments.firstIndex(of: flag) else {
            return nil
        }

        let nextIndex = arguments.index(after: index)
        guard nextIndex < arguments.endIndex else {
            return nil
        }

        let value = arguments[nextIndex]
        guard !value.hasPrefix("-") else {
            return nil
        }

        return value
    }
}
