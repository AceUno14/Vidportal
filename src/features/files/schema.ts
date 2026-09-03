import { z } from "zod";

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024 * 1024;
export const SINGLE_PART_MAX_BYTES = 100 * 1024 * 1024;
export const MIN_MULTIPART_PART_BYTES = 64 * 1024 * 1024;
export const MAX_MULTIPART_PARTS = 10_000;

const supportedContentType = z
  .string()
  .trim()
  .min(1)
  .max(150)
  .transform((value) => value.toLowerCase())
  .refine(
    (value) =>
      /^(video|audio|image|text)\/[a-z0-9.+-]+$/.test(value) ||
      [
        "application/octet-stream",
        "application/pdf",
        "application/zip",
        "application/x-7z-compressed",
        "application/vnd.rar",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ].includes(value),
    "This file type is not supported.",
  );

export const uploadPurposeSchema = z.enum([
  "SOURCE",
  "REFERENCE",
  "ATTACHMENT",
]);

export const initiateUploadRequestSchema = z.object({
  filename: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .refine(
      (value) => !/[\\/\u0000-\u001f\u007f]/.test(value),
      "Use a filename without slashes or control characters.",
    ),
  byteSize: z.number().int().positive().max(MAX_FILE_SIZE_BYTES),
  contentType: supportedContentType,
  purpose: uploadPurposeSchema,
});

export const signUploadPartRequestSchema = z.object({
  partNumber: z.number().int().min(1).max(MAX_MULTIPART_PARTS),
});

export type InitiateUploadInput = z.infer<typeof initiateUploadRequestSchema>;
export type UploadPurpose = z.infer<typeof uploadPurposeSchema>;

export function kindFromContentType(contentType: string) {
  if (contentType.startsWith("video/")) return "VIDEO" as const;
  if (contentType.startsWith("audio/")) return "AUDIO" as const;
  if (contentType.startsWith("image/")) return "IMAGE" as const;
  if (
    contentType === "application/zip" ||
    contentType === "application/x-7z-compressed" ||
    contentType === "application/vnd.rar"
  ) {
    return "ARCHIVE" as const;
  }
  if (
    contentType.startsWith("text/") ||
    contentType === "application/pdf" ||
    contentType.includes("document") ||
    contentType.includes("sheet") ||
    contentType === "application/msword" ||
    contentType === "application/vnd.ms-excel"
  ) {
    return "DOCUMENT" as const;
  }
  return "OTHER" as const;
}

export function uploadTypeForSize(byteSize: number) {
  return byteSize <= SINGLE_PART_MAX_BYTES
    ? ("SINGLE_PART" as const)
    : ("MULTIPART" as const);
}

export function multipartPartSize(byteSize: number) {
  const minimumForPartLimit = Math.ceil(byteSize / MAX_MULTIPART_PARTS);
  const mebibyte = 1024 * 1024;
  return Math.ceil(
    Math.max(MIN_MULTIPART_PART_BYTES, minimumForPartLimit) / mebibyte,
  ) * mebibyte;
}

export function maximumPartNumber(byteSize: number, partSize: number) {
  return Math.ceil(byteSize / partSize);
}
