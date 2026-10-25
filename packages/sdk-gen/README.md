# @pands/sdk-gen

> OpenAPI 3.1 merger and multi-platform client SDK code generator (TypeScript, Swift, Kotlin) for the **Pand Application Platform**.

[![npm version](https://img.shields.io/npm/v/@pands/sdk-gen.svg)](https://www.npmjs.com/package/@pands/sdk-gen)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

`@pands/sdk-gen` introspects microservice schemas, merges individual OpenAPI specifications into a unified schema, and generates strongly-typed client libraries for Web, iOS (SwiftUI), and Android (Jetpack Compose).

---

## Installation

```bash
pnpm add @pands/sdk-gen
# or with npm:
npm install @pands/sdk-gen
```

---

## Usage

```typescript
import { 
  generateTypeScriptSdk, 
  generateSwiftSdk, 
  generateKotlinSdk 
} from "@pands/sdk-gen";

// Generate TypeScript client wrapper & types
await generateTypeScriptSdk({
  openApiSpec: mergedSpec,
  outDir: "./packages/sdk",
});

// Generate Swift client SDK
await generateSwiftSdk({
  openApiSpec: mergedSpec,
  outFile: "./apps/ios/Shared/PandSDK.swift",
});

// Generate Kotlin client SDK
await generateKotlinSdk({
  openApiSpec: mergedSpec,
  outFile: "./apps/android/app/src/main/java/dev/pand/sdk/PandSDK.kt",
});
```

---

## License

MIT © [Mehdi Nosrati](https://github.com/MehdiNosrati)
