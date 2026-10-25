// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "PandSDK",
    platforms: [.iOS(.v18)],
    products: [
        .library(name: "PandSDK", targets: ["PandSDK"])
    ],
    dependencies: [
        .package(url: "https://github.com/apple/swift-openapi-generator", from: "1.6.0"),
        .package(url: "https://github.com/apple/swift-openapi-runtime", from: "1.7.0"),
        .package(url: "https://github.com/apple/swift-openapi-urlsession", from: "1.0.2")
    ],
    targets: [
        .target(
            name: "PandSDK",
            dependencies: [
                .product(name: "OpenAPIRuntime", package: "swift-openapi-runtime"),
                .product(name: "OpenAPIURLSession", package: "swift-openapi-urlsession")
            ]
        )
    ]
)
