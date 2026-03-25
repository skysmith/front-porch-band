import XCTest

final class FrontPorchBandTVUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    func testFavoriteFlowAddsSongToFavoritesTab() throws {
        let app = XCUIApplication()
        app.launchArguments += ["-uiTesting"]
        app.launch()

        XCTAssertTrue(app.staticTexts["Browse"].waitForExistence(timeout: 5))

        let songRow = app.buttons["song-row-a-hard-rain-s-a-gonna-fall"]
        XCTAssertTrue(songRow.waitForExistence(timeout: 5))
        select(songRow, in: app)

        let favoriteButton = app.buttons["favorite-toggle"]
        XCTAssertTrue(favoriteButton.waitForExistence(timeout: 5))
        select(favoriteButton, in: app)

        select(app.tabBars.buttons["Favorites"], in: app)
        XCTAssertTrue(app.buttons["song-row-a-hard-rain-s-a-gonna-fall"].waitForExistence(timeout: 5))
    }

    func testOpenedSongAppearsInRecentTab() throws {
        let app = XCUIApplication()
        app.launchArguments += ["-uiTesting"]
        app.launch()

        let songRow = app.buttons["song-row-a-hard-rain-s-a-gonna-fall"]
        XCTAssertTrue(songRow.waitForExistence(timeout: 5))
        select(songRow, in: app)

        select(app.tabBars.buttons["Recent"], in: app)
        XCTAssertTrue(app.buttons["song-row-a-hard-rain-s-a-gonna-fall"].waitForExistence(timeout: 5))
    }

    private func select(
        _ element: XCUIElement,
        in app: XCUIApplication,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        moveFocus(to: element, in: app, file: file, line: line)
        XCUIRemote.shared.press(.select)
    }

    private func moveFocus(
        to target: XCUIElement,
        in app: XCUIApplication,
        maxSteps: Int = 30,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        XCTAssertTrue(target.waitForExistence(timeout: 5), file: file, line: line)

        for _ in 0..<maxSteps {
            if target.hasFocus {
                return
            }

            let current = focusedElement(in: app)
            if current.exists && !current.frame.isEmpty {
                let dx = target.frame.midX - current.frame.midX
                let dy = target.frame.midY - current.frame.midY

                if abs(dx) > abs(dy) {
                    XCUIRemote.shared.press(dx >= 0 ? .right : .left)
                } else {
                    XCUIRemote.shared.press(dy >= 0 ? .down : .up)
                }
            } else {
                XCUIRemote.shared.press(.down)
            }
        }

        XCTFail("Could not move focus to \(target.identifier)", file: file, line: line)
    }

    private func focusedElement(in app: XCUIApplication) -> XCUIElement {
        let focusedPredicate = NSPredicate(format: "hasFocus == true")
        return app.descendants(matching: .any).matching(focusedPredicate).firstMatch
    }
}
