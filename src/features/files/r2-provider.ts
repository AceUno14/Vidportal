import "server-only";

import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListPartsCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import type {
  FileStorageProvider,
  UploadedPart,
} from "@/features/files/provider";
import { getR2Environment } from "@/lib/env/server";

let provider: FileStorageProvider | undefined;

function downloadDisposition(filename: string) {
  const fallback = filename.replace(/[^a-zA-Z0-9._ -]/g, "_");
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export function getR2StorageProvider(): FileStorageProvider {
  if (provider) return provider;

  const environment = getR2Environment();
  const bucket = environment.R2_BUCKET_NAME;
  const expiresIn = environment.R2_PRESIGNED_URL_TTL_SECONDS;
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${environment.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    requestChecksumCalculation: "WHEN_REQUIRED",
    credentials: {
      accessKeyId: environment.R2_ACCESS_KEY_ID,
      secretAccessKey: environment.R2_SECRET_ACCESS_KEY,
    },
  });

  const expiration = () => new Date(Date.now() + expiresIn * 1_000);

  provider = {
    async signSinglePartUpload({ key, contentType }) {
      const url = await getSignedUrl(
        client,
        new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }),
        { expiresIn },
      );
      return { url, expiresAt: expiration() };
    },

    async createMultipartUpload({ key, contentType }) {
      const result = await client.send(
        new CreateMultipartUploadCommand({
          Bucket: bucket,
          Key: key,
          ContentType: contentType,
        }),
      );

      if (!result.UploadId) {
        throw new Error("R2 did not return a multipart upload identifier.");
      }

      return { providerUploadId: result.UploadId };
    },

    async signMultipartPart({ key, providerUploadId, partNumber }) {
      const url = await getSignedUrl(
        client,
        new UploadPartCommand({
          Bucket: bucket,
          Key: key,
          UploadId: providerUploadId,
          PartNumber: partNumber,
        }),
        { expiresIn },
      );
      return { url, expiresAt: expiration() };
    },

    async listMultipartParts({ key, providerUploadId }) {
      const parts: UploadedPart[] = [];
      let partNumberMarker: string | undefined;

      do {
        const page = await client.send(
          new ListPartsCommand({
            Bucket: bucket,
            Key: key,
            UploadId: providerUploadId,
            PartNumberMarker: partNumberMarker,
          }),
        );

        for (const part of page.Parts ?? []) {
          if (part.PartNumber && part.ETag && typeof part.Size === "number") {
            parts.push({
              partNumber: part.PartNumber,
              etag: part.ETag,
              size: part.Size,
            });
          }
        }

        partNumberMarker = page.IsTruncated
          ? page.NextPartNumberMarker
          : undefined;
      } while (partNumberMarker);

      return parts.sort((a, b) => a.partNumber - b.partNumber);
    },

    async completeMultipartUpload({ key, providerUploadId, parts }) {
      await client.send(
        new CompleteMultipartUploadCommand({
          Bucket: bucket,
          Key: key,
          UploadId: providerUploadId,
          MultipartUpload: {
            Parts: parts.map((part) => ({
              ETag: part.etag,
              PartNumber: part.partNumber,
            })),
          },
        }),
      );
    },

    async abortMultipartUpload({ key, providerUploadId }) {
      await client.send(
        new AbortMultipartUploadCommand({
          Bucket: bucket,
          Key: key,
          UploadId: providerUploadId,
        }),
      );
    },

    async headObject(key) {
      const result = await client.send(
        new HeadObjectCommand({ Bucket: bucket, Key: key }),
      );
      return {
        byteSize: result.ContentLength ?? -1,
        contentType: result.ContentType?.toLowerCase() ?? null,
      };
    },

    async signDownload({ key, filename }) {
      const url = await getSignedUrl(
        client,
        new GetObjectCommand({
          Bucket: bucket,
          Key: key,
          ResponseContentDisposition: downloadDisposition(filename),
        }),
        { expiresIn },
      );
      return { url, expiresAt: expiration() };
    },
  };

  return provider;
}
