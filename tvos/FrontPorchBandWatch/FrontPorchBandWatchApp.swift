import SwiftUI

@main
struct FrontPorchBandWatchApp: App {
    @StateObject private var catalogStore = CatalogStore()
    @StateObject private var userState = UserLibraryState(keyPrefix: "front-porch-band-watch")

    var body: some Scene {
        WindowGroup {
            WatchRootView()
                .environmentObject(catalogStore)
                .environmentObject(userState)
        }
    }
}
