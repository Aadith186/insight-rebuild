# Insight verification record

Date: 10 November 2026. Status: **implemented source; acceptance verification incomplete**.

## Executed

| Check                      | Observed result                                                                                                                                                                                                                                          |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci`                   | Dependency installation succeeded from the included lockfile.                                                                                                                                                                                            |
| `npm run check:contracts`  | 45 model exports and 191 unique explicit method/path registrations matched the supplied route catalogue. OpenAPI generated from actual strict Zod request schemas.                                                                                       |
| `npm test`                 | 38 tests passed: schema/index structure, grant isolation, strict request validation, expected versions, immutable-target hashes, secret serialization, encryption tampering, CSV escaping, video-link policy and unauthenticated/origin HTTP boundaries. |
| `npm run build`            | React/Tailwind production bundle built successfully.                                                                                                                                                                                                     |
| `npm run test:integration` | **Skipped**: `TEST_MONGODB_URI` is not configured. No real-database workflow success is claimed.                                                                                                                                                         |

The added tests cover India timezone month boundaries, empty monthly buckets, ledger account/owner selection, strict campaign review requests, campaign cover approval hashing, malformed socket credentials and real Socket.IO transport rejection of anonymous/unapproved-origin clients.

Visual inspection used explicitly labelled fixture records for desktop and a 390px phone viewport: dashboard, chat, custom workspace picker and star selection. This does not establish database persistence or complete portal acceptance.

The unit/HTTP-boundary suite uses no fake database to claim integration success. Its checks do not exercise authenticated persisted business journeys.

## Not verified here

- Real MongoDB replica-set persistence, transaction rollback/retry, unique-index enforcement under concurrency, and restart recovery.
- Full independent-account browser journeys for all four portals and client reviewers, including keyboard interaction, deep navigation and every action form. Only the shared layout fixture was visually checked this run.
- Real video upload/ffprobe validation/private byte-range playback against a running API and durable media volume.
- Docker image/Compose startup. Docker is not available in this authoring environment.
- Email webhook delivery, retry/deduplication and link handling through a real mail service.
- Bank/UPI reconciliation with real incoming/outgoing transfers. This application records verified references; it does not perform transfers.
- Production deployment, backups, secret rotation, gateway/webhook integration or data migration from the former prototype.

## Real database suite included

`server/tests/integration/workflows.test.js` creates an isolated `insight_test_*` database on a supplied replica-set server. It covers campaign publication and pitches, context-linked conversation/message persistence, two-party authenticated Socket.IO delivery/acknowledgement/read cursors and duplicate retry, idempotent offer acceptance, funding/content gates, settlement journal/wallet behavior, concurrent withdrawal protection, rejection reversal, review-derived statistics, missing barter products, and independent agency/client approvals.

This suite is **written but unexecuted** in this environment. Additional database/browser acceptance remains for replacement shipment histories, all revision/extra-consent branches, private media denial/range requests, refund-transfer concurrency, membership revocation and stale target approvals across every screen. The blueprint's 28 acceptance journeys remain the final checklist.

## Completion rule

This archive is newer implemented source, not the earlier prototype with a plan attached. It still must not be described as fully completed, production-ready or comprehensively tested until the missing database and browser acceptance work passes. Any failures found when those services are available need correction and a new verification record.

## Latest refinement checks

38 unit/contract/HTTP/socket-boundary checks passed; the 191-route catalogue and production build passed. Added checks cover composed page filters, numeric amount sorting, calendar-aware chat timestamps, inbox pagination tie-breaks and unauthenticated unread-summary denial. Admin and inbox shared component layouts were inspected at desktop and 390px width. MongoDB integration was invoked and skipped because `TEST_MONGODB_URI` is absent. Authenticated unread persistence, independent-user badge delivery, notification read actions and directory search against real data therefore remain acceptance checks.

## Campaign, verification, profile and settings update

The verification queue and member decision page are separate from the directory. Campaign lists now show authorised application and collaboration counts. Creator engagement supports manual percentages and calculation from self-reported recent post totals. Account preferences and platform settings use separate versioned forms.

The production build, API contract check and 40 automated tests passed. Browser checks used sample data to exercise navigation, campaign layout switching and the engagement form. MongoDB acceptance tests were skipped because a test replica-set URI was unavailable.

## Web and Android workflow audit follow-up

The dashboard now leads with decisions and upcoming work. The Android header
opens the workspace chooser directly and exposes the active agency client.
The shared list controls load all accessible cursor pages when filtering or
sorting. High-volume lists can take longer to search. Campaign discovery and
creator selection use server search. Video review compares cuts and shows the
client sign-off state. Notification preferences apply to in-app delivery.

Browser checks exercised the workspace dialog, skip-link focus and dashboard
queue ordering using sample data. Production builds and APK signature are
checked separately. The local MongoDB replica set could not start in this
environment. Physical-device testing and live backend journeys remain open.
The supplied APK is signed for testing. Set `INSIGHT_ANDROID_BACKEND_ORIGIN`
when building the deployment APK. Native background push is pending.

## Campaign and records interface refresh

The application uses custom, keyboard-operable listboxes for single-choice
fields, filters and content-version controls. Required choices are validated
before submission, including in nested field groups. Campaign briefs place
creative direction, deliverables and usage rights alongside budget and
deadlines. Shared data tables use labeled stacked rows on narrow screens.

Browser fixture checks covered opening and selecting with the keyboard,
filtering collaboration records, and opening and choosing an option at 390px
with no horizontal page overflow. The brief and campaign catalog were also
rendered with sample data. These checks did not use a live database.

## Workspace and mobile polish

Collaboration, offer and client lists now support card and table views using
the same filters and record actions. Creator cards show individual metrics,
verification and comparison controls. Shared dialogs retain the draft when
the user chooses to keep editing. Settings, chat and withdrawal controls
also received focused interaction fixes.

Browser fixture checks covered card/table switching, a narrow navigation
drawer, notification switches, and opening and dismissing a withdrawal
form with sample data. Live payments and physical-device testing were
outside those checks.

## Screen audit
- Pitches and saved campaigns use searchable cards with campaign context from
  published revisions. Shortlisted creators use the same card layout.
- Offer, collaboration and client approval terms share a deliverable, rights
  and payment breakdown. Accepted offers link to the existing collaboration.
- Approval and dispute queues support cards and tables. Custom collection rows
  have shared padding. Chat compacts consecutive messages from the same sender.

Browser fixtures covered the five redesigned creator screens, pitch status
filtering, accepted-offer navigation, and payment layout at 375px. Fixtures
do not exercise live MongoDB or payment processing.

## Cross-panel UI review

Reviewed navigation, lists, detail pages, forms, and shared states for creator,
brand, agency, client reviewer, and platform administrator accounts. Updated
client records, team access and invitations, incoming pitches, client approval
terms, portfolio and completed work, notifications, and finance queues.

Browser smoke checks opened 72 sample route and role combinations. Eleven
narrow layouts were checked for horizontal page overflow, including agency
team access, client approval, creator work, campaign details, and admin funding.
The agency Members and Invitations tabs were also exercised with sample data.
The checks used fixture responses. Live MongoDB, production payment processing,
and installation on a physical Android device were outside this pass.
