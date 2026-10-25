import Foundation
import Observation

@MainActor
@Observable
public final class AuthManager {
    public static let shared = AuthManager()
    public var isAuthenticated: Bool = KeychainTokenStore.loadToken() != nil

    public func signIn(email: String, password: String) async throws {
        KeychainTokenStore.saveToken("session-\(email)")
        isAuthenticated = true
    }

    public func signOut() {
        KeychainTokenStore.clearToken()
        isAuthenticated = false
    }
}
