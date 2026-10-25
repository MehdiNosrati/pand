import { describe, expect, it } from "vitest";
import { createStorageClient } from "../src/index.js";

describe("@pands/storage", () => {
  it("generates presigned S3 upload and download URLs for Garage", async () => {
    const storage = createStorageClient({
      publicEndpoint: "https://s3.mahdins.dev",
      bucket: "acme-prod",
    });

    const upload = await storage.createPresignedUploadUrl({
      key: "avatars/u1.png",
      contentType: "image/png",
      expiresInSeconds: 300,
    });
    expect(upload.url).toContain("https://s3.mahdins.dev/acme-prod/avatars/u1.png");
    expect(upload.url).toContain("X-Amz-Signature=");

    const download = await storage.createPresignedDownloadUrl({
      key: "avatars/u1.png",
      expiresInSeconds: 3600,
    });
    expect(download.url).toContain("https://s3.mahdins.dev/acme-prod/avatars/u1.png");
    expect(download.expiresInSeconds).toBe(3600);
  });
});
