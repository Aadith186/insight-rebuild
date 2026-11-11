# Insight interface and workflow upgrade

Comparison: supplied HTML prototype, mobile photograph-led reference and desktop KPI/chart reference. Colors remain #003b59 and #ffb118. JavaScript throughout.

| Gap in prior interface | Implemented change | Source |
| --- | --- | --- |
| Native dashboard/account dropdowns | Searchable custom workspace dialog, agency client cards, role-specific mobile navigation | WorkspacePicker.jsx, App.jsx |
| Plain campaign/creator lists | Image-led campaign and creator grids, profile photograph banner, avatars, niche chips, compensation/engagement summaries | CatalogCards.jsx, Media.jsx, Profiles.jsx, Campaigns.jsx |
| Campaign covers missing from data | Private cover upload, typed draft/revision reference, exact approval hash, publish visibility and retirement checks | media and campaigns modules |
| Sparse dashboard and finance reporting | KPI cards, monthly funding/releases, earnings/withdrawals, status and format donuts, campaign budget/commitment comparisons, period controls | Charts.jsx, DashboardHome.jsx, analytics module |
| Tabular campaign reports only | Delivery distribution and agreed-compensation bar charts, full CSV retained | Campaigns.jsx Report |
| Reviews hard to find | Reviews navigation, eligible settled-work cards, mutual star/text reviews, optional creator campaign-experience rating, rating distributions on profiles/campaigns | Reviews.jsx, disputes/reviews.service.js |
| Revision workflow hard to discover | Review journey, version player, timestamp comments in seconds, included/extra rounds, request-and-activate controls, additional-round consent, client-signoff guidance | Collaborations.jsx ReviewRoom |
| Basic polling message interface | WhatsApp-style inbox/thread, phone back navigation, contextual campaign/work title, attachments, delivery ack, read receipts, live typing and reconnect state | Messaging.jsx, realtime.jsx |
| No socket transport | Authenticated Socket.IO, fresh scope checks for joins/sends/delivery, database transaction before broadcast, stable message IDs and monotonic read cursors | messaging.socket.js, realtime-bus.js |
| Native images/video cannot send workspace headers | Media URLs carry workspace selection; content-only GET handler validates it and applies normal live access policy | api/http.js, core/http.js |

Charts use posted ledger entries and actual authorized work. Empty accounts show zeros and empty states. No invented growth percentages. Current held/available balances are labelled separately from period activity. Agreement reports show commitments rather than recognized earnings. Social-account reach/engagement remains self-reported; there is no connected social analytics provider.

Reviews require completed settled work and are unique per collaboration side. The server chooses author, target and campaign. Creators rate the brand and may rate the campaign experience; commissioning teams rate the creator. Agency service reviews as a distinct public review category are not implemented.

The chat transport currently runs in one Node process. Multiple API instances require a shared transport adapter/event delivery layer before scaling. All private data delivery is checked against current sessions and grants. HTTP and socket writes use the same persisted service. Offline drafts are retained in the mounted composer; offline delivery is never reported as sent.

## Visual checks

Browser inspection completed for the desktop dashboard/chat, the custom workspace dialog, star selection, and a 390px iframe viewport for the mobile dashboard/chat. `tests/visual/index.html` is a separately labelled layout fixture with sample data, not part of the production build. It exists solely to inspect shared components when the API database is unavailable. It does not prove an authenticated backend journey. Production entry is root `index.html`, never the visual fixture.

## Remaining acceptance

Run real replica-set database tests and independent-account browser journeys, including socket persistence/reconnect/revoked grants, uploads/private playback, independent client approvals, every extra-revision branch and chart totals against posted journals. Docker, external email and real transfer reconciliation have not been verified here. See VERIFICATION.md.

## Operations and unread inbox refinement — 10 November 2026

- Admin command centre now has a queue total, four KPI cards, and six dedicated action cards. Member types use tabs; a server search matches account names/email and creator names/location. Avatars, joining dates, verification badges and a compact account-action menu replace the old action-heavy row.
- Shared table listings have a consistent title, record count, search, status filtering, sort, density switch, empty state and pagination footer. These shared controls explicitly apply to the loaded page. The member-directory search and chat search operate across their authorized server results.
- Campaign moderation lists include campaign thumbnails; funding/withdrawal/refund lists use financial record styling. Offers and collaborations now show actual counterpart names, avatars, campaign titles, and agreement amounts rather than only truncated IDs.
- Chat inbox now sorts by last message activity with timestamp/ID pagination, server-side unread/context filtering and search over counterpart/campaign/latest-message preview. It includes bold unread previews, per-thread unread counts, today/yesterday timestamps, sent-message checks, real filter buttons and load-more.
- `GET /inbox/summary` counts unread incoming messages, unread threads and authorized notifications. The owner oversight role is excluded from participant message counts. `inbox:watch` subscribes the signed-in workspace to authorized `inbox:changed` hints, including conversations not currently open. No message contents are included in those hints. Every hint rechecks live session and conversation access.
- Navigation and mobile chat badges use the stored unread summary. The notification bell opens a preview with read actions; the full activity screen has All/Unread filtering. Other notification events are refreshed every 30 seconds and on visibility/account/activity changes; message/read events also refresh via socket. These are in-app notices, not browser push notifications.
- Additional protections: delayed message-history responses are discarded after changing conversation/workspace; current grants still gate inbox rows/counts and delivery. Indexes support recent-activity lookup by brand and creator.

Visual inspection used `tests/visual/operations.html` and a 390px iframe at `operations-mobile.html`: shared admin cards, inbox rows/filters and table components with clearly labelled sample records. No real-database acceptance success is claimed. Written MongoDB tests additionally cover an inbox watcher, summary isolation, unread search and clearing after a read cursor.
