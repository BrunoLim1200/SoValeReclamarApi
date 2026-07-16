# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Backend API for "Só Vale Reclamar", a mobile app (Ionic client) where users file complaints
against entities (places, movies, companies, products) and "corroborate" (endorse) each other's
complaints. Built as AWS Lambda functions behind an HTTP API Gateway, deployed with the Serverless
Framework, backed by a PostgreSQL database (Neon) accessed through Drizzle ORM.

Code comments and user-facing error messages are in **Portuguese** — keep new ones consistent.

## Commands

```bash
npm run dev          # serverless offline — run the API locally
npm test             # jest
npm run test:watch   # jest --watchAll

# Deploy (Serverless Framework v4; requires SERVERLESS_ACCESS_KEY for org "svrtech")
npx serverless deploy --stage dev
npx serverless deploy --stage prod

# Database schema (Drizzle Kit — needs DATABASE_URL in env)
npx drizzle-kit push       # sync src/db/schema.ts straight to the DB (workflow in use)
npx drizzle-kit generate   # (optional) emit a SQL migration file into drizzle/
```

The live database is managed with `drizzle-kit push`, not `migrate`: there is no
`__drizzle_migrations` tracking table, and the DB is already ahead of the committed migrations
(e.g. `complaints.title` exists in the DB and `schema.ts` but not in `drizzle/0000_*.sql`). Treat
`src/db/schema.ts` as the source of truth; the files in `drizzle/` are stale — don't run
`drizzle-kit migrate` against this DB (it would try to recreate existing tables).

Tests live under `test/` and mirror `src/functions/` (one `*.test.ts` per handler). Jest is
configured in `jest.config.cjs` and transpiles TypeScript with a tiny esbuild transformer
(`test/esbuild-transformer.cjs`) — no ts-jest/babel dependency. Run `npm test` (or
`npm run test:coverage`). Handlers are tested as pure units: the `db` (Drizzle) layer is replaced
by a chainable mock (`test/helpers/dbMock.ts`) and events are built with `test/helpers/event.ts`,
so no real database or AWS access is needed. NOTE: because the esbuild transformer does not hoist
`jest.mock` the way babel-jest would, each test registers its mocks and then loads the handler with
`require(...)` (not a top-level `import`) so the mock is in place first.

## Architecture

**Lambda-per-endpoint.** Every route maps to one handler file under `src/functions/<domain>/`,
registered in `serverless.yml` under `functions:` with its `httpApi` path/method. To add an
endpoint, create the handler and add a matching entry in `serverless.yml` — the two must stay in
sync. Handlers export `handler` typed as `(event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>`
and follow a consistent shape: validate input → read Cognito claims → run a Drizzle query →
return `{ statusCode, body: JSON.stringify(...) }`, all wrapped in try/catch returning 500.

**Auth (Cognito JWT).** `serverless.yml` defines a `cognitoAuth` JWT authorizer tied to a Cognito
User Pool provisioned in the same stack (`resources:`). Protected routes attach `authorizer: cognitoAuth`;
handlers read the authenticated user id from `event.requestContext.authorizer?.jwt?.claims?.sub`.
That `sub` is used directly as `users.id` / `author_id` — the Cognito user id **is** the DB user id.
Search/list/feed routes are intentionally public (no authorizer).

**Database (Drizzle + postgres-js).** `src/db/index.ts` creates a single shared `db` instance with
`postgres(connectionString, { prepare: false })` — prepared statements are disabled because they
are unsupported on serverless/Neon connection pooling. `src/db/schema.ts` is the single source of
truth for tables (`users`, `entities`, `complaints`, `corroborations`); the SQL files in `drizzle/`
are stale (see the schema-management note above — the DB is kept in sync via `drizzle-kit push`).

**PostgreSQL extensions matter.** Entity search (`entities/search.ts`) and the entity name index
rely on the `pg_trgm` extension: fuzzy matching via the `%` operator and ranking via the `<->`
trigram-distance operator. The feed (`feed/list.ts`) ranks complaints with a time-decay relevance
score computed in raw SQL: `(corroboration_count + 1) / POWER(hours_since_created + 2, 1.5)`. These
raw-SQL fragments are written with Drizzle's `sql` template tag.

**Concurrency / idempotency.** `corroborations` has a composite primary key `(complaint_id, user_id)`
so a user cannot endorse the same complaint twice. `engagement/corroborate.ts` inserts the
corroboration and increments `complaints.corroboration_count` inside a single `db.transaction`, and
maps the Postgres unique-violation code `23505` to an HTTP 409.

**Uploads.** `uploads/generate-url.ts` returns a short-lived (60s) S3 pre-signed PUT URL plus the
final public `mediaUrl`; the client uploads directly to the `UploadsBucket` (provisioned in
`serverless.yml`), then passes `mediaUrl` when creating a complaint. Only JPEG/PNG/WebP are allowed.

## Conventions & gotchas

- **Pagination is inconsistent by design:** `/feed` uses page/offset with a `metadata.hasMore`
  flag for infinite scroll; `/entities/{id}/complaints` returns a fixed top-20 with no pagination.
- Bundling uses `serverless-esbuild`, so handlers can import TypeScript directly; there is no
  separate build step for deploys.
- Environment: `DATABASE_URL` (falls back to SSM `/sovalereclamar/prod/database-url` in deploy),
  `BUCKET_NAME`, `AWS_REGION`. Local dev reads `.env` (gitignored).
