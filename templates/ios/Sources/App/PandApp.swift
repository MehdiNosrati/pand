import SwiftUI

@main
struct PandApp: App {
    @State private var auth = AuthManager.shared

    var body: some Scene {
        WindowGroup {
            if auth.isAuthenticated {
                TabView {
                    ForEach(AppTab.allCases) { tab in
                        Text(tab.rawValue)
                            .tabItem {
                                Label(tab.rawValue, systemImage: "circle.grid.2x2")
                            }
                    }
                }
            } else {
                VStack(spacing: 16) {
                    Text("Sign In")
                        .font(.title.bold())
                    Button("Continue") {
                        Task { try? await auth.signIn(email: "demo@mahdins.dev", password: "password123") }
                    }
                }
            }
        }
    }
}
