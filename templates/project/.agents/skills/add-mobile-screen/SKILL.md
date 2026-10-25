---
name: add-mobile-screen
description: Add or customize native SwiftUI (iOS) and Jetpack Compose (Android) screens.
---

# Add Mobile Screen Runbook

1. **Generate Entity Screen**:
   Run `pand add entity <service> <Entity> --fields "<dsl>" --ios --android`.
2. **Regenerate Mobile SDKs**:
   Run `pand sdk gen` to update `apps/ios/Packages/PandSDK` (`PandAPIClient.swift`) and `apps/android/.../sdk/` (`Models.kt` & `PandApi.kt`).
3. **Customize Views**:
   - iOS (Swift 6 + SwiftUI): `apps/ios/Sources/App/Features/<Entity>/<Entity>ListView.swift`
   - Android (Kotlin + Jetpack Compose): `apps/android/app/src/main/java/dev/mahdins/<snake_project>/features/<entity>/<Entity>Screen.kt`
