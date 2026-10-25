import Foundation

public enum AppTab: String, CaseIterable, Identifiable {
    case home = "Home"
    // pand:ios-tabs

    public var id: String { rawValue }
}
