import XCTest
final class BunnyUI: XCTestCase {
  func testBeschriftungen() throws {
    continueAfterFailure = false
    let env = ProcessInfo.processInfo.environment
    let system = env["BUNNY_UI_SYSTEM"] == "1"
    let app = XCUIApplication(bundleIdentifier: system ? "com.apple.springboard" : "host.exp.Exponent")
    if !system { app.activate() }
    if let text = env["BUNNY_UI_TEXT"] {
      let kurz = env["BUNNY_UI_FELD"] == "kurz"
      let felder = kurz ? app.textFields : app.textViews
      XCTAssertEqual(felder.count, kurz ? 2 : 1)
      felder.element(boundBy: 0).tap()
      felder.element(boundBy: 0).typeText(text)
      print("BUNNY_UI_TEXT \(text)")
    }
    if let label = env["BUNNY_UI_LABEL"] {
      let typ: XCUIElement.ElementType = env["BUNNY_UI_TYP"] == "image" ? .image : .button
      let ziele = app.descendants(matching: typ).matching(NSPredicate(format: "label == %@", label))
      let anzahl = Int(env["BUNNY_UI_ANZAHL"] ?? "1")!
      XCTAssertTrue(ziele.firstMatch.waitForExistence(timeout: 10))
      XCTAssertEqual(ziele.count, anzahl)
      let ziel = ziele.element(boundBy: Int(env["BUNNY_UI_INDEX"] ?? "0")!)
      XCTAssertGreaterThan(ziel.frame.width, 0)
      print("BUNNY_UI_TIPPEN \(label) Treffer \(anzahl) Rahmen \(ziel.frame)")
      ziel.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
    }
    print("BUNNY_UI_BAUM_BEGINN\n" + app.debugDescription + "\nBUNNY_UI_BAUM_ENDE")
  }
}
