# @pands/storage

> S3-compatible object storage client with presigned uploads and memory adapter for the **Pand Application Platform**.

[![npm version](https://img.shields.io/npm/v/@pands/storage.svg)](https://www.npmjs.com/package/@pands/storage)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

`@pands/storage` provides unified object storage with presigned URLs for direct browser-to-storage uploads, secure downloads, and memory driver support for zero-dependency unit tests.

---

## Installation

```bash
pnpm add @pands/storage
# or with npm:
npm install @pands/storage
```

---

## Usage

```typescript
import { createStorageClient } from "@pands/storage";

const storage = createStorageClient({
  driver: "s3",
  endpoint: process.env.S3_ENDPOINT || "http://localhost:3090",
  bucket: "user-uploads",
  accessKeyId: process.env.S3_ACCESS_KEY || "garage",
  secretAccessKey: process.env.S3_SECRET_KEY || "garage-secret",
});

// Upload an object directly
await storage.putObject("avatars/user-1.png", buffer, "image/png");

// Generate presigned upload URL for frontend direct upload
const { uploadUrl, fileKey } = await storage.presignUpload("invoices/inv-123.pdf", {
  expiresInSeconds: 300,
});

// Generate presigned download URL
const downloadUrl = await storage.presignDownload("invoices/inv-123.pdf", {
  expiresInSeconds: 60,
});
```

---

## License

MIT © [Mehdi Nosrati](https://github.com/MehdiNosrati)
