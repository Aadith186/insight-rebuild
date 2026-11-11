import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import mongoose from "mongoose";
import request from "supertest";
import { createApp } from "../src/app.js";
import { registered } from "../src/core/http.js";
import * as M from "../src/models.js";
import { hasScope, filter, party } from "../src/core/policy.js";
import { expected, get } from "../src/core/db.js";
import { terms, brief } from "../src/core/validation.js";
import { encrypt, decrypt, hash } from "../src/core/crypto.js";
import { csv } from "../src/core/csv.js";
import { videoURL } from "../src/modules/content/content.service.js";
import { offerHash } from "../src/modules/offers/offers.service.js";
import { contentHash } from "../src/modules/approvals/approvals.service.js";
const app = createApp(),
  id = () => new mongoose.Types.ObjectId();
test("45 dedicated models, no Mixed business state", () => {
  assert.equal(Object.keys(M).length, 45);
  for (const Model of Object.values(M)) {
    assert.equal(Model.schema.options.strict, "throw");
    Model.schema.eachPath((path, s) =>
      assert.notEqual(s.instance, "Mixed", Model.modelName + "." + path),
    );
  }
});
test("191 unique explicit route registrations match authoritative specification", () => {
  const specs = JSON.parse(fs.readFileSync("docs/route-catalogue.json"));
  const actual = new Set(registered.map((r) => r.method + " " + r.path));
  assert.equal(actual.size, 191);
  assert.equal(registered.length, 191);
  for (const s of specs) assert(actual.has(s.method + " " + s.path));
  assert(![...actual].some((r) => r.includes("/actions/")));
});
test("human email and normalized shortlist indexes are unique", () => {
  assert(
    M.User.schema.indexes().some(([i, o]) => i.emailNormalized && o.unique),
  );
  assert(
    M.ShortlistEntry.schema
      .indexes()
      .some(
        ([i, o]) =>
          i.ownerOrganizationId &&
          i.clientBrandOrganizationId &&
          i.creatorProfileId &&
          o.unique,
      ),
  );
});
test("one agreement per offer and one collaboration per agreement", () => {
  assert(M.Agreement.schema.indexes().some(([i, o]) => i.offerId && o.unique));
  assert(
    M.Collaboration.schema
      .indexes()
      .some(([i, o]) => i.agreementId && o.unique),
  );
});
test("one review per party and unique journal source", () => {
  assert(
    M.Review.schema
      .indexes()
      .some(([i, o]) => i.collaborationId && i.reviewingParty && o.unique),
  );
  assert(
    M.LedgerTransaction.schema
      .indexes()
      .some(([i, o]) => i.kind && i.sourceId && o.unique),
  );
});
test("campaign grants do not imply sibling or direct-work access", () => {
  const brand = id(),
    a = id(),
    b = id(),
    work = id(),
    m = {
      role: "CAMPAIGN_MANAGER",
      clientScopes: [
        {
          clientBrandId: brand,
          allCampaigns: false,
          campaignIds: [a],
          directCollaborationIds: [],
        },
      ],
    };
  assert(hasScope(m, brand, a));
  assert(!hasScope(m, brand, b));
  assert(!hasScope(m, brand, null, work));
  assert(!hasScope(m, id(), a));
});
test("explicit direct-work grants authorize only their work", () => {
  const brand = id(),
    work = id(),
    m = {
      role: "CAMPAIGN_MANAGER",
      clientScopes: [
        {
          clientBrandId: brand,
          allCampaigns: false,
          campaignIds: [],
          directCollaborationIds: [work],
        },
      ],
    };
  assert(hasScope(m, brand, null, work));
  assert(!hasScope(m, brand, null, id()));
});
test("all-work grants stay within their client", () => {
  const brand = id(),
    m = {
      role: "CLIENT_REVIEWER",
      clientScopes: [
        {
          clientBrandId: brand,
          allCampaigns: true,
          campaignIds: [],
          directCollaborationIds: [],
        },
      ],
    };
  assert(hasScope(m, brand, id()));
  assert(!hasScope(m, id(), id()));
});
test("creator read scope is identity-bound and selected org excludes creator discovery", () => {
  const cp = id(),
    user = { platformRole: "USER" },
    c = { user, creator: { _id: cp }, memberships: [], organizations: [] };
  assert.deepEqual(filter(c), { $or: [{ creatorProfileId: cp }] });
  assert.deepEqual(filter({ ...c, organizationId: String(id()) }), { $or: [] });
});
test("owner cannot use creative mutations without a commissioning membership", async () => {
  await assert.rejects(
    () =>
      party(
        { user: { platformRole: "OWNER" }, memberships: [] },
        { brandOrganizationId: id() },
        { write: true, commissioner: true },
      ),
    (e) => e.status === 404,
  );
});
test("expected version detects stale form and missing version", () => {
  assert.throws(
    () => expected({ __v: 2 }, {}),
    (e) => e.status === 422,
  );
  assert.throws(
    () => expected({ __v: 2 }, { expectedVersion: 1 }),
    (e) => e.status === 409,
  );
  expected({ __v: 2 }, { expectedVersion: 2 });
});
test("public registration cannot promote owner or forge author", () => {
  const schema = registered.find((r) => r.path === "/auth/register").schema;
  const b = {
    email: "a@example.com",
    password: "a-long-valid-password",
    name: "A",
    accountType: "CREATOR",
  };
  assert(schema.safeParse(b).success);
  assert(!schema.safeParse({ ...b, platformRole: "OWNER" }).success);
  assert(!schema.safeParse({ ...b, accountType: "OWNER" }).success);
});
test("offer request rejects browser-supplied fees and actor identities", () => {
  const schema = registered.find(
    (r) => r.path === "/offers" && r.method === "POST",
  ).schema;
  const b = {
    brandOrganizationId: String(id()),
    creatorProfileId: String(id()),
    formatId: String(id()),
    amountMinor: 10000,
    dueAt: "2099-01-01T00:00:00Z",
    deliverables: [{ kind: "REEL", quantity: 1, description: "A reel" }],
    usageRights: { channels: ["SOCIAL"], durationDays: 90 },
    includedRevisions: 2,
    products: [],
  };
  assert(schema.safeParse(b).success);
  for (const key of [
    "feeMinor",
    "commissionBps",
    "acceptedByUserId",
    "approved",
  ])
    assert(!schema.safeParse({ ...b, [key]: 1 }).success, key);
});
test("money and quantities reject negative, fractional and zero product values", () => {
  const schema = registered.find(
    (r) => r.path === "/offers" && r.method === "POST",
  ).schema;
  const b = {
    brandOrganizationId: String(id()),
    creatorProfileId: String(id()),
    formatId: String(id()),
    amountMinor: 10000,
    dueAt: "2099-01-01T00:00:00Z",
    deliverables: [{ kind: "REEL", quantity: 1, description: "A reel" }],
    usageRights: { channels: ["SOCIAL"], durationDays: 90 },
    includedRevisions: 2,
    products: [{ name: "Product", quantity: 1, retailValueMinor: 0 }],
  };
  assert(!schema.safeParse(b).success);
  assert(!schema.safeParse({ ...b, products: [], amountMinor: 0.5 }).success);
});
test("client approval request refuses fabricated reviewer identity fields", () => {
  const schema = registered.find(
    (r) => r.path === "/client-approvals" && r.method === "POST",
  ).schema;
  assert(
    !schema.safeParse({
      targetType: "CONTENT_VERSION",
      targetId: String(id()),
      reviewerUserIds: [String(id())],
      approvedByUserId: String(id()),
    }).success,
  );
});
test("agreement fee stays a snapshot rather than mutable profile data", () => {
  const o = {
    _id: id(),
    revisionNumber: 1,
    revisions: [{ revisionNumber: 1, amountMinor: 10000, feeMinor: 1000 }],
  };
  const a = offerHash(o);
  o.revisions[0].feeMinor = 2000;
  assert.notEqual(offerHash(o), a);
});
test("content approval hash changes with version identity and media", () => {
  const v = { _id: id(), sequence: 1, assetId: id(), title: "Cut", note: "" },
    a = contentHash(v);
  assert.notEqual(contentHash({ ...v, assetId: id() }), a);
  assert.notEqual(contentHash({ ...v, sequence: 2 }), a);
});
test("sensitive model fields never serialize as secrets", () => {
  const u = new M.User({
    emailNormalized: "a@b.com",
    passwordHash: "secret",
    name: "A",
  });
  assert(!JSON.stringify(u).includes("secret"));
  const s = new M.Session({ refreshTokenHash: "refresh-secret" });
  assert(!JSON.stringify(s).includes("refresh-secret"));
});
test("business version and optimistic record version stay distinct", () => {
  const f = new M.CollaborationFormat({ key: "TEST", version: 3 });
  f.__v = 7;
  assert.equal(f.toJSON().version, 3);
  assert.equal(f.toJSON().recordVersion, 7);
});
test("bank destination encryption authenticates ciphertext", () => {
  process.env.DATA_ENCRYPTION_KEY = "11".repeat(32);
  const d = { type: "BANK", accountNumber: "1234567890", ifsc: "ABCD0123456" },
    encrypted = encrypt(d);
  assert(!encrypted.includes(d.accountNumber));
  assert.deepEqual(decrypt(encrypted), d);
  const b = Buffer.from(encrypted, "base64");
  b[b.length - 1] ^= 1;
  assert.throws(() => decrypt(b.toString("base64")));
});
test("CSV protects spreadsheet formula injection and escapes quotes", () => {
  const s = csv([{ name: '=HYPERLINK("x")', note: "a,b" }]);
  assert(s.includes("'=HYPERLINK"));
  assert(s.includes('"a,b"'));
});
test("supported video URLs prohibit javascript and non-video arbitrary sites", () => {
  assert(videoURL("https://youtu.be/abc123456"));
  assert(videoURL("https://example.com/cut.mp4"));
  assert(!videoURL("javascript:alert(1)"));
  assert(!videoURL("https://example.com/page"));
});
test("health/live is process-only and ready returns 503 when disconnected", async () => {
  const live = await request(app).get("/api/v1/health/live");
  assert.equal(live.status, 200);
  const ready = await request(app).get("/api/v1/health/ready");
  assert.equal(ready.status, 503);
});
test("private resources require authentication; unknown API is a real 404", async () => {
  assert.equal((await request(app).get("/api/v1/collaborations")).status, 401);
  assert.equal(
    (await request(app).get("/api/v1/no-such-resource")).status,
    404,
  );
});
test("cross-origin financial mutations are rejected before database access", async () => {
  const r = await request(app)
    .post("/api/v1/me/withdrawals")
    .set("Origin", "https://unrelated.example")
    .send({ amountMinor: 100 });
  assert.equal(r.status, 403);
});

test("idempotency and approval hashing is independent of object key order", () => {
  assert.equal(
    hash({ amount: 100, terms: { rights: ["SOCIAL"], rounds: 2 } }),
    hash({ terms: { rounds: 2, rights: ["SOCIAL"] }, amount: 100 }),
  );
});

test("undefined internal references cannot broaden a database lookup", async () => {
  await assert.rejects(
    () => get(M.Collaboration, undefined),
    (e) => e.status === 422,
  );
  await assert.rejects(
    () => get(M.Collaboration, "not-an-id"),
    (e) => e.status === 422,
  );
});

test("social metrics accept legacy manual rates and valid post samples", async () => {
  const { sampleEngagementBps } = await import("../src/modules/creators/creators.service.js");
  const { schema } = registered.find(route => route.method === "POST" && route.path === "/me/social-accounts");
  const channel = { platform: "INSTAGRAM", handle: "studio", profileUrl: "https://instagram.com/studio", followers: 10000 };
  const engagementSample = { posts: 10, likes: 3100, comments: 400 };
  assert.equal(schema.safeParse({ ...channel, engagementBps: 0 }).success, true);
  assert.equal(schema.safeParse({ ...channel, engagementSample }).success, true);
  assert.equal(schema.safeParse({ ...channel, followers: 0, engagementSample }).success, false);
  assert.equal(schema.safeParse(channel).success, false);
  assert.equal(sampleEngagementBps(engagementSample, channel.followers), 350);
  assert.throws(() => sampleEngagementBps({ posts: 1, likes: 11000, comments: 0 }, 10000), /exceeds 100%/);
});

test("platform settings allow versioned edits to one section", () => {
  const { schema } = registered.find(route => route.method === "PUT" && route.path === "/owner/settings");
  assert.equal(schema.safeParse({ expectedVersion: 1, commissionBps: 0 }).success, true);
  assert.equal(schema.safeParse({ expectedVersion: 1, fundingInstructions: { upiId: "example@bank" } }).success, true);
  assert.equal(schema.safeParse({ expectedVersion: 1, supportContact: {} }).success, true);
  assert.equal(schema.safeParse({ expectedVersion: 1 }).success, false);
  assert.equal(schema.safeParse({ commissionBps: 500 }).success, false);
});

test("Android rejects platform-owner sessions before creating credentials", async () => {
  const { session } = await import("../src/modules/identity/identity.service.js");
  const android = { req: { get: name => name === "X-Insight-Client" ? "android" : undefined } };
  await assert.rejects(session(android, { platformRole: "OWNER" }), {
    status: 403,
    code: "ANDROID_ROLE_UNAVAILABLE",
  });
});
