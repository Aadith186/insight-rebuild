# Insight — JavaScript source rebuild

React + Tailwind CSS; Node.js + Express + Mongoose. Product name **Insight**. Primary **#003b59**; secondary **#ffb118**. No TypeScript, aggregate Marketplace model, generic business-action API, browser seed import or localStorage business-data backend.

This is the reconstructed modular source, not the earlier demo ZIP. It contains 45 dedicated typed models and 191 explicit endpoint registrations (the blueprint’s 186 plus five review, reporting and inbox endpoints). Portal screens use the real API by default. A successful build and contract test do not establish complete production readiness. Read **docs/VERIFICATION.md** before relying on completion claims.

## Quick start in Cursor

1. Extract this archive and open the `insight-rebuild` folder in Cursor.
2. Install **Node.js 24** and **Docker Desktop**. For development without Docker's API container, also install **ffprobe** (included with FFmpeg).
3. Open Cursor's terminal in this folder:

```bash
npm ci
node scripts/setup-env.js
```

Save the generated development owner password printed by setup. `.env` is generated locally and never included in this archive. Change the bootstrap owner email/password before seeding if needed. Never change `DATA_ENCRYPTION_KEY` after storing encrypted payout details without a deliberate re-encryption migration.

### Option A — everything in Docker

```bash
docker compose up --build
```

Open **http://localhost:4000**. The API image includes ffprobe. Compose initializes a persistent single-node MongoDB replica set and seeds platform formats/settings plus the configured owner. Login using the credentials from setup. Ordinary creators, brands and agencies can register on the login screen. No paid campaigns, reviews or bank transfers are fabricated by the seed.

Local Compose uses HTTP and development cookies. For public hosting, configure HTTPS, the exact origin, `NODE_ENV=production`, correct proxy settings, a protected database and durable private media storage. This Compose setup is local development configuration. It has not been container-tested in the authoring environment.

Stop with `docker compose down`. Do not add `--volumes` unless intentionally deleting development data and uploads.

### Option B — run the API and React separately

Start the database only:

```bash
docker compose up -d mongo mongo-init
npm run seed
```

The default `.env` uses a direct local replica-set connection. Terminal 1:

```bash
npm run server
```

Terminal 2:

```bash
npm run dev
```

Open **http://localhost:5173**. The Vite proxy forwards `/api` and Socket.IO HTTP/WebSocket traffic at `/socket.io` to port 4000. `APP_ORIGIN` must match the actual browser origin. Do not mix localhost and 127.0.0.1 browser URLs.

If using an existing MongoDB/Atlas database, set `MONGODB_URI` to that **replica-set** database and skip Docker database setup. Transactions are required; a standalone mongod is deliberately rejected. Run `npm run seed` once to initialize formats/settings and the configured owner. Existing users/passwords are preserved.

For a built frontend served by Express, set `APP_ORIGIN=http://localhost:4000`, then:

```bash
npm run build
npm start
```

### Optional development accounts

Set `SEED_DEMO=true` in a development `.env`, then run `npm run seed`. This creates only missing creator/brand/agency accounts, printing a generated password once for each. It never seeds invented financial history, campaigns, review scores or completed projects. Public registration is also available.

## Email and invitations

Configure a real HTTPS `EMAIL_WEBHOOK_URL`, authenticated with `EMAIL_WEBHOOK_SECRET`, and run `npm run worker` (or `docker compose --profile email up --build`). The webhook must deliver the specified template and URL to the recipient, use the supplied event Idempotency-Key to deduplicate, and return 2xx only after accepting delivery. Worker envelopes store one-time payloads encrypted, wipe them after delivery, and retry failures. Verification/reset endpoints return 503 if delivery is unconfigured; they do not pretend an email was sent.

Invitations can be manually shared using the one-time link shown in Team. The recipient registers/signs in with that email, verifies it, then accepts without losing other memberships. The development seed marks its explicitly generated users verified; live registrations require verification. Team access is limited by client and campaign grants. Client reviewers must be different human users from preparers.

## Working flows

- Creator profile/social metrics/audience/portfolio; creator discovery and comparison; client-specific shortlists and saved campaigns.
- Draft campaign → versioned client approval for agency work → owner moderation → publication → pitches/decisions/closure.
- Direct/linked proposal → exact client approval for agency work → send → creator decision → immutable agreement and collaboration.
- Verified paid funding and product receipt gates; private media upload; timestamp comments; included/extra revision rounds; final approval.
- Publishing/handover → completion check/correction → payment release or barter closeout → mutual reviews and derived statistics.
- Context-bound messages; per-human notifications; client/campaign permissions and assignments; agency overview and reports.
- Balanced integer-paise journals; withdrawal reservations and operator processing; dispute release/refund obligations and actual refund transfers; separate agency charges.
- Owner account verification/suspension/restoration, campaign moderation, financial queues, settings/formats and audit evidence.

Forms and tabs consolidate the blueprint's named views. The current route/view mapping and remaining validation gaps are documented in `docs/FEATURE_TRACEABILITY.md`. Do not infer 111 independently tested pages from the specification count.

## Payment operating mode

The operator reconciles real external bank/UPI transfers. Funding verification, payout completion and refund completion require actual references. This software does not initiate bank transfers or implement a gateway. Enter verified funding instructions in Owner → Settings. Creator gross includes the platform fee; agency charges are separate; product retail values do not become cash balances.

## Tests and API contracts

```bash
npm test
npm run check:contracts
npm run build
```

The unit/HTTP-boundary suite does not substitute a memory database for persistence testing. To run actual database journeys, use an isolated test MongoDB replica-set server:

macOS/Linux:

```bash
TEST_MONGODB_URI='mongodb://127.0.0.1:27017/?replicaSet=rs0&directConnection=true' npm run test:integration
```

Windows PowerShell:

```powershell
$env:TEST_MONGODB_URI="mongodb://127.0.0.1:27017/?replicaSet=rs0&directConnection=true"
npm run test:integration
Remove-Item Env:TEST_MONGODB_URI
```

The integration suite creates a unique `insight_test_*` database and drops only that database afterward. Use a dedicated test server where that is permitted. Without this variable, the suite reports **SKIPPED**, not a successful database verification.

`docs/openapi.json` is generated from registered routes and actual Zod request schemas. API base `/api/v1`; cookie sessions; live membership checks; strict DTOs; version checks; Idempotency-Key on financial commands and acceptance/settlement; cursor lists; request IDs and structured errors.

## Source map

- `server/src/modules/`: dedicated model files, feature services and explicit routes.
- `server/src/core/`: typed subdocuments, database primitives, shared policies, request validation, transactions/idempotency, crypto, audit/outbox and CSV handling.
- `web/src/features/`: actual React portal pages and action forms, split by feature.
- `web/src/components/`: accessible form/dialog/list/layout/media components.
- `server/tests/`: executable contract, permission, schema, crypto and HTTP-boundary checks; separate real-database acceptance journeys.
- `reference/`: original feature PDF and HTML visual reference, retained as source material under its original filename.

This is a clean deployment. Prototype aggregate records and unverifiable approvals/bank references are not automatically migrated. Preserve the original database and do not point the new seed at it as a migration substitute. Migration of existing production records needs an explicit source export and reconciliation.

## Troubleshooting

- Blank/error data views: run the API and MongoDB; the UI deliberately does not fall back to fabricated business records.
- Replica-set error: use initialized Compose MongoDB or a replica-set/Atlas URI.
- 403 on writes: match `APP_ORIGIN` to the browser URL and verify your active organization/client context.
- Version conflict: refresh the record and review the latest state before retrying.
- Video rejection: install ffprobe and use a playable MP4/WebM up to 150 MB. File headers and metadata are checked server-side.
- Unknown password: setup prints the bootstrap password; development seeds print generated passwords only when creating new accounts. Seeding never resets existing users.
- Invitation rejected: match the invited email, verify it, and check that the invitation has not expired or been revoked.

## Interface and realtime upgrade

Read `docs/UI_AUDIT.md` for the comparison with the supplied prototype and design references. This version includes custom workspace/client pickers, image-led cards and profiles, campaign cover uploads, earnings/dashboard/campaign charts, visible verified reviews and campaign feedback, an explicit video change-request flow, and a WhatsApp-style Socket.IO messenger.

Chat authenticates using the same HttpOnly session cookie as the API. Set `APP_ORIGIN` to the exact browser origin. A reverse proxy must forward `/socket.io/` with WebSocket upgrade support as well as normal polling requests. Run one API instance with this version; horizontal deployments need a shared adapter and event distribution. The server commits messages in MongoDB before acknowledging or broadcasting. Reconnection and duplicate message retries use the same client message ID.

No social network analytics integration or automated bank payment provider is included. Reach metrics are labelled self-reported; financial charts use actual posted ledger records. Optional campaign-experience feedback is linked to a creator’s completed collaboration, not an unrelated public rating.

To inspect the component layout separately during local development, visit `/tests/visual/index.html` or `/tests/visual/mobile.html` on the Vite port. These **labelled test fixtures** use sample records and are excluded from the production bundle; their action buttons do not save records. Use the root app to run real flows.

## Admin lists and unread inbox

The latest refinement adds the admin action centre, member directory tabs/search, consistent listing controls, richer work rows, a notification preview and activity filters. Inbox filters/search and recent-activity pagination are backed by `/conversations`; stored unread totals come from `/inbox/summary`. Navigation badges update on authenticated socket hints, on account activity/visibility changes and on a 30-second refresh. Shared table filters are labelled as page-local; directory and inbox search are server-side.

Optional visual QA entries: `/tests/visual/operations.html` and `/tests/visual/operations-mobile.html`. These labelled fixtures use sample records and are excluded from the production build. For real persisted behavior open the root application and configure MongoDB as above.

## Insight Android

See [android/README.md](android/README.md) for server setup, APK signing and build instructions.
