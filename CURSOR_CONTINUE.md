# Continue and run in Cursor

Open this folder in Cursor. Start with README.md, docs/VERIFICATION.md, docs/FEATURE_TRACEABILITY.md and the supplied blueprint. This archive contains implemented models, services, routes and React screens; it is not the previous prototype-plus-plan package.

Run the application using the README's Docker or Node instructions. Do not claim that database tests ran if TEST_MONGODB_URI is absent. The real API is the default; there is no browser-demo data backend.

Paste into Cursor Agent:

> Continue the Insight implementation in this folder. Read docs/UI_AUDIT.md, README.md, docs/VERIFICATION.md, docs/FEATURE_TRACEABILITY.md, docs/Insight_Complete_Application_Blueprint.md and reference/Mingle_Panel_Feature_Document.pdf first. Preserve React/Tailwind JavaScript and Express/Mongoose JavaScript; Insight primary #003b59 and secondary #ffb118. Inspect the actual source and existing tests before changing it. Configure a local MongoDB replica set with the included Compose file or use my test URI. Run npm ci, npm run check:contracts, npm test, npm run build and the real MongoDB integration suite. Exercise every blueprint acceptance journey with separate authenticated users through the browser, expand meaningful tests for uncovered branches, and fix all failures. Do not substitute memory storage or seed data for missing backend behavior. Audit every PDF requirement against the actual model/service/API/screen flow. Keep a precise progress and verification report and make no completion claim until the real database and browser journeys pass. Never commit .env, generated passwords, uploads or dependency directories. Bank transfers remain manual reconciliations unless a real provider is separately configured.

The current source includes the UI/chart/review and Socket.IO upgrade. Exercise the written authenticated socket journey against MongoDB; the 38 unit/contract/transport-boundary tests are distinct from this integration suite. Do not mistake tests/visual fixture data for the real product.
