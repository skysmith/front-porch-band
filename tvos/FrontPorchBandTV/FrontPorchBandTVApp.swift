import SwiftUI

@main
struct FrontPorchBandTVApp: App {
    private let launchConfiguration = AppLaunchConfiguration.current
    @StateObject private var catalogStore = CatalogStore()
    @StateObject private var userState = UserLibraryState()

    var body: some Scene {
        WindowGroup {
            RootView(launchConfiguration: launchConfiguration)
                .environmentObject(catalogStore)
                .environmentObject(userState)
        }
    }
}
