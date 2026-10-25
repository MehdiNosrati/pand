import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface StorageClientOptions {
  endpoint?: string;
  publicEndpoint?: string;
  region?: string;
  bucket?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

export interface PresignedUploadInput {
  key: string;
  contentType: string;
  maxBytes?: number;
  expiresInSeconds?: number;
}

export interface PresignedDownloadInput {
  key: string;
  expiresInSeconds?: number;
}

export interface PandStorageClient {
  bucket: string;
  createPresignedUploadUrl: (input: PresignedUploadInput) => Promise<{
    url: string;
    key: string;
    expiresInSeconds: number;
  }>;
  createPresignedDownloadUrl: (input: PresignedDownloadInput) => Promise<{
    url: string;
    key: string;
    expiresInSeconds: number;
  }>;
  deleteObject: (key: string) => Promise<void>;
}

export function createStorageClient(options: StorageClientOptions = {}): PandStorageClient {
  const endpoint = options.endpoint ?? process.env.S3_ENDPOINT ?? "http://localhost:4090";
  const publicEndpoint = options.publicEndpoint ?? process.env.S3_PUBLIC_ENDPOINT ?? endpoint;
  const region = options.region ?? process.env.S3_REGION ?? "garage";
  const bucket = options.bucket ?? process.env.S3_BUCKET ?? "reference-dev";
  const accessKeyId =
    options.accessKeyId ?? process.env.S3_ACCESS_KEY_ID ?? "GKdev00000000000000000000";
  const secretAccessKey =
    options.secretAccessKey ??
    process.env.S3_SECRET_ACCESS_KEY ??
    "0000000000000000000000000000000000000000000000000000000000000000";

  const s3 = new S3Client({
    endpoint: publicEndpoint,
    region,
    forcePathStyle: true,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return {
    bucket,
    async createPresignedUploadUrl({ key, contentType, expiresInSeconds = 300 }) {
      const cmd = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: contentType,
      });
      const url = await getSignedUrl(s3, cmd, { expiresIn: expiresInSeconds });
      return { url, key, expiresInSeconds };
    },

    async createPresignedDownloadUrl({ key, expiresInSeconds = 3600 }) {
      const cmd = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      });
      const url = await getSignedUrl(s3, cmd, { expiresIn: expiresInSeconds });
      return { url, key, expiresInSeconds };
    },

    async deleteObject(key: string) {
      const cmd = new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      });
      await s3.send(cmd);
    },
  };
}
