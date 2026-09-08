# Deploying VidPortal to Netlify

The MVP uses Netlify, Neon PostgreSQL, and a private Cloudflare R2 bucket. Stream and Resend are not required by the current runtime. No deployment or database mutation is performed by this document.

## Build configuration

Use the canonical repository root containing `package.json` and `netlify.toml` as the base directory. The committed configuration selects Node.js 22, build command `npm run build`, and publish directory `.next`. Keep Netlify's Next.js integration enabled: this application needs server functions and cannot be deployed as a static export.

Install with the lockfile using `npm ci`. The `postinstall` hook generates Prisma Client; do not disable install scripts. Local build verification alone does not verify Netlify's adapter or function packaging, especially the generated Prisma WASM loader. Validate the Netlify build and database-backed routes on a fixed staging origin before production.

Provider references: [Next.js build settings](https://docs.netlify.com/snippets/frameworks/nextjs-config-values/), [runtime environment configuration](https://docs.netlify.com/build/frameworks/use-environment-variables-with-frameworks/).

## Environment variables

Set these through the hosting provider's environment settings, available to builds and server functions. Never commit their values or give them `NEXT_PUBLIC_` prefixes.

| Required name | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon pooled PostgreSQL runtime connection with TLS |
| `DIRECT_URL` | Direct connection to the same database for Prisma CLI; also required by the runtime environment validator |
| `BETTER_AUTH_SECRET` | Unique production secret of at least 32 random characters |
| `BETTER_AUTH_URL` | Exact canonical HTTPS application origin, without a path, query, or fragment |
| `CLOUDFLARE_ACCOUNT_ID` | Account owning the R2 bucket |
| `R2_BUCKET_NAME` | Dedicated private production bucket |
| `R2_ACCESS_KEY_ID` | Bucket-scoped access key |
| `R2_SECRET_ACCESS_KEY` | Corresponding secret key |

Optional tuning: `R2_PRESIGNED_URL_TTL_SECONDS` (default 900), `R2_STORAGE_QUOTA_BYTES` (default 8000000000), and `LOG_LEVEL`. Test-only variables are `TEST_DATABASE_URL` and `PLAYWRIGHT_BASE_URL`; production does not need them. Stream variables (`CLOUDFLARE_STREAM_API_TOKEN`, `CLOUDFLARE_STREAM_CUSTOMER_CODE`, `CLOUDFLARE_STREAM_WEBHOOK_SECRET`, `STREAM_TOKEN_TTL_SECONDS`) and email variables (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_REPLY_TO_EMAIL`) are reserved for optional future integrations.

The environment template contains placeholders. Copying it does not configure production. Use separate database, bucket, and auth credentials for staging and production. Do not give arbitrary preview deployments production credentials.

## Production URLs and authentication

Record the actual canonical HTTPS origin in the deployment settings and set `BETTER_AUTH_URL` to it. Localhost values are for local development only and must never be used in staging or production. Configure DNS and HTTPS and redirect alternate domains to the canonical origin.

Better Auth uses `BETTER_AUTH_URL` for its base URL and sole trusted origin. The browser auth client uses the current origin. Auth requests are handled under `/api/auth/*`; email/password login is the only configured method. There is no OAuth provider or provider callback URL to register for this MVP. After successful login/registration the UI navigates to `/`. Changing the hostname requires updating the auth origin and R2 CORS together and redeploying. Use a fixed staging hostname with its own auth URL; wildcard preview origins are not currently supported by the auth configuration.

## Database release gate

Prisma 6 uses the schema's `directUrl` for administrative commands and `DATABASE_URL` for runtime. `prisma.config.ts` also records the direct endpoint. Set both to the intended environment before invoking commands.

Read-only verification:

```powershell
npm run db:validate
npx prisma migrate status
```

There are four migrations. The workspace-model migration dated `20260830090000` drops prototype tables and is explicitly reset-only for the old model. The auth migration also removes old password hashes. Do not apply this chain to populated legacy databases. Such databases require a separately reviewed data/auth migration and a verified backup/restore plan.

For a confirmed empty new database, or an existing canonical database whose pending migrations have been reviewed and backed up, the release operator may run:

```powershell
npx prisma migrate deploy
npx prisma migrate status
```

This is a manual database-changing step, never part of the Netlify build. Do not use `migrate dev`, `migrate reset`, `db push`, or the demo seed in production. The known shared demo password in the README is public and must never be deployed as a production account credential. Use `/register` for initial owner onboarding after staging verification.

Migration status checks migration history; it does not establish absence of schema drift or identify whether the connected database is the intended production database. Confirm the target explicitly before applying any migration.

## External service checks

R2 uses the S3 endpoint derived from `CLOUDFLARE_ACCOUNT_ID`, region `auto`, and bucket-scoped credentials. Keep bucket-scoped credentials least-privilege: they may allow object access while denying administrative reads, so AccessDenied on CORS or lifecycle settings does not prove those settings are absent or incorrect.

An operator with Cloudflare settings access must verify bucket privacy (including public development URL/custom-domain exposure), credential scope, and the policy in [R2 CORS](r2-cors.md): exact HTTPS production origin, GET/HEAD/PUT, required request headers, and exposed ETag. Verify incomplete multipart upload cleanup and the application expiry relationship. Do not broaden the application's credential permissions solely to inspect administrative settings.

## Release verification

1. Select and review the release files. Before release, ensure the Prisma compatibility changes, generated-client configuration, and deployment configuration are included in the release commit. Do not include local exports or `.env`.
2. Configure hosting secrets, fixed staging/production origins, HTTPS, database, and R2 settings.
3. Verify migrations on the actual target using the gate above.
4. Build from a clean checkout with `npm ci` and `npm run build`, then verify Netlify's adapter build and function packaging on staging.
5. Check `/api/health`, login/logout and secure session cookies, workspace onboarding, and authenticated database reads. Health alone is not sufficient evidence that external services work.
6. In staging, exercise single-part and multipart upload, ETag handling, review playback, final download, and client access boundaries from a browser. Follow the larger-file acceptance gate in the R2 documentation before claiming full large-file readiness.
7. Verify no demo credentials exist in production, record release evidence, then promote the tested release. Retain the previous deployment and a database backup; reverting application code does not undo database changes.

## Known limitations

A local production build passes with a warning about overly broad file matching in Prisma's generated WASM loader. Netlify function behavior and production browser flows remain unverified. Local toolchains may differ from the Node.js 22 version pinned for CI and hosting, so the hosted build remains an acceptance gate.

Only `.env.example` is tracked among environment files. Repository review found no targeted credential-pattern matches in tracked deployment configuration; this is a limited check, not proof that all possible secrets are absent. `.env`, backups, and uploaded files are ignored. Never publish `.next` or repository archives outside the hosting workflow without checking their contents.
