# Cloudflare R2 CORS Configuration

- Status: Required deployment configuration for v1
- Last updated: 2026-08-28

VidPortal uploads and downloads large R2 objects directly from the browser by using short-lived presigned requests. The private bucket therefore needs an explicit CORS policy. CORS is browser policy, not authentication; bucket privacy, server authorization, and narrowly scoped presigned URLs remain mandatory.

## 1. Required policy

Configure exact origins for every environment that may perform browser transfers. Do not use `*` for production origins and do not allow arbitrary Vercel preview domains.

Use this policy as the v1 baseline, replacing the example hosts with the real fixed origins:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3000",
      "https://staging.vidportal.example",
      "https://app.vidportal.example"
    ],
    "AllowedMethods": [
      "GET",
      "HEAD",
      "PUT"
    ],
    "AllowedHeaders": [
      "content-type",
      "x-amz-checksum-*",
      "x-amz-meta-*"
    ],
    "ExposeHeaders": [
      "ETag"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

If the selected upload client sends an additional request header, add that exact header only after observing it in a browser preflight. Do not add methods or origins speculatively. Header names are case-insensitive, but keeping a consistent lower-case policy makes comparison easier.

`ETag` exposure is required. Multipart upload code needs the `ETag` returned by each successful `UploadPart` request to build the completion request. Without `ExposeHeaders: ["ETag"]`, the transfer can succeed in R2 while browser JavaScript is unable to read the part identifier.

## 2. Why these methods are allowed

- `PUT`: single-part uploads and presigned multipart part uploads.
- `GET`: authorized direct downloads.
- `HEAD`: authorized browser-side metadata checks if used by the client.

The browser calls VidPortal—not R2 directly—to create, list, complete, or abort a multipart upload. Those server-side S3 API operations do not need browser CORS methods such as `POST` or `DELETE`.

## 3. Origin rules

An origin is scheme, host, and port only; it contains no path.

- Local development normally uses `http://localhost:3000`.
- Staging and production use their exact HTTPS origins.
- A different port or subdomain is a different origin and must be deliberately configured.
- Do not include a custom domain until custom domains are actually in scope.
- Do not permit wildcard preview deployments. Use a stable staging hostname for browser/provider acceptance tests.

Keep development, staging, and production buckets separate where practical. If a shared non-production bucket is temporarily necessary, list each fixed non-production origin explicitly.

## 4. Presigned-request rules

R2 remains private. Before issuing any signed request, VidPortal must:

1. Authenticate the server-side session.
2. Resolve the canonical workspace and project.
3. Enforce role, assignment, client association, file policy, and rate limits.
4. Generate the object key on the server.
5. Bind the key and expected metadata to a server-side `UploadSession` or authorized `FileAsset`.
6. Use a short expiry appropriate to the one operation.

A signed request is scoped to the intended method, bucket, key, and expiry. The application must never return R2 access-key credentials to the browser. CORS does not prevent a leaked signed URL from being used by a non-browser client, so signed URLs must not be logged or placed in analytics.

For multipart uploads, the browser receives VidPortal's upload-session identifier. VidPortal resolves the provider upload ID and object key on the server for `sign-part`, `list-parts`, `complete`, and `abort` operations.

## 5. Multipart recovery and lifecycle

V1 recovery includes:

- Automatic retry of failed parts.
- Server-side recovery using `listParts`.
- Cancellation and provider abort.
- Recovery after refresh only after the user reselects the same local file and its filename, size, content type, and other authorized metadata still match.

It does not promise cross-device resume or persistence of a multi-gigabyte browser `File` object without reselection.

Incomplete R2 multipart uploads follow the bucket's provider lifecycle. With the default R2 configuration, they are automatically aborted after seven days. VidPortal `UploadSession` expiry must not exceed that provider lifetime. V1 does not extend an existing provider multipart upload beyond its lifetime; after expiry, VidPortal creates a new multipart upload.

Application reconciliation and cleanup must use the same configured provider lifetime. See [Storage Lifecycle](./storage-lifecycle.md).

## 6. Completion verification

A successful browser response is not enough to publish an asset. After multipart completion or a single-part upload, the server uses `HeadObject` and verifies at least:

- The exact server-authorized bucket and object key.
- The resulting byte size equals the expected byte size.
- The stored content type is permitted and consistent with authorized metadata where provider behavior preserves it.
- The upload session is active, belongs to the same workspace/project/uploader, and has not already completed incompatibly.

Only then may VidPortal mark the corresponding `FileAsset` ready. A mismatch moves the operation to a safe failed/quarantined state for reconciliation; it must not become client-visible.

Do not treat an `ETag` as a whole-file content hash. Multipart ETags are provider composition identifiers and are not generally the MD5 of the complete object.

## 7. Browser verification checklist

Validate CORS from a real supported browser because command-line clients do not enforce browser CORS policy.

- The preflight response allows the exact application origin.
- An unknown origin receives no usable CORS authorization.
- Single-part `PUT` succeeds for an authorized small fixture.
- Each multipart `PUT` exposes a readable `ETag` response header.
- Interruption and automatic part retry work.
- Server `listParts` returns uploaded provider parts for the bound session.
- Refresh plus reselection of the same fixture recovers valid parts.
- Reselecting a different file is rejected or starts a new authorized session.
- Completion succeeds and `HeadObject` verification marks the asset ready.
- Abort prevents later completion through that upload session.
- An expired signed URL and an expired upload session fail safely.
- Authorized `GET` download succeeds; an unauthorized download URL is never issued.

Use small multipart fixtures for the integration suite. Exactly one real upload and download larger than 5 GiB is reserved for staging in the final production-readiness gate.

## 8. Operational checklist

For each environment, record without committing secrets:

- Bucket name and owning Cloudflare account.
- Exact allowed origins and the date verified.
- Multipart provider-lifecycle duration.
- Application upload-session maximum lifetime, which must be no longer.
- Presigned URL lifetimes.
- Credential scope and last rotation date.
- Successful browser test evidence.

Changing an application origin, upload request header, or provider lifetime requires updating and retesting this configuration before release.
