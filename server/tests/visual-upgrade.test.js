import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { io as client } from "socket.io-client";
import { createApp } from "../src/app.js";
import { registered } from "../src/core/http.js";
import {
  attachChat,
  socketIdentity,
} from "../src/modules/messaging/messaging.socket.js";
import {
  makeMonths,
  monthKey,
  sumAccount,
} from "../src/modules/analytics/analytics.service.js";
import { revisionHash } from "../src/modules/campaigns/campaigns.service.js";
createApp();
test("monthly charts use the India month at UTC boundaries and include empty months", () => {
  assert.equal(monthKey("2026-01-31T18:29:59Z"), "2026-01");
  assert.equal(monthKey("2026-01-31T18:30:00Z"), "2026-02");
  const rows = makeMonths("2025-12-31T18:30:00Z", "2026-03-01T00:00:00Z");
  assert.deepEqual(
    rows.map((r) => r.key),
    ["2026-01", "2026-02", "2026-03"],
  );
  assert(rows.every((r) => r.earnedMinor === 0 && r.withdrawnMinor === 0));
  assert.throws(() => makeMonths("2020-01-01", "2026-01-01"), /24 months/);
});
test("ledger reporting selects account side and creator owner without counting other accounts", () => {
  const j = {
    entries: [
      {
        accountCode: "CREATOR_AVAILABLE",
        ownerId: "one",
        creditMinor: 900,
        debitMinor: 0,
      },
      {
        accountCode: "CREATOR_AVAILABLE",
        ownerId: "two",
        creditMinor: 800,
        debitMinor: 0,
      },
      { accountCode: "PLATFORM_REVENUE", creditMinor: 100, debitMinor: 0 },
    ],
  };
  assert.equal(sumAccount(j, "CREATOR_AVAILABLE", "creditMinor", "one"), 900);
  assert.equal(sumAccount(j, "CREATOR_AVAILABLE", "creditMinor"), 1700);
  assert.equal(sumAccount(j, "CREATOR_AVAILABLE", "debitMinor", "one"), 0);
});
test("review request permits campaign experience but refuses forged participant and campaign identities", () => {
  const schema = registered.find(
    (r) =>
      r.method === "POST" &&
      r.path === "/collaborations/:collaborationId/reviews",
  ).schema;
  assert(
    schema.safeParse({
      stars: 5,
      text: "Great collaboration",
      campaignStars: 4,
      campaignFeedback: "Clear brief",
    }).success,
  );
  for (const input of [
    { stars: 0 },
    { stars: 6 },
    { stars: 4.5 },
    { stars: 4, campaignStars: 0 },
    { stars: 4, reviewerUserId: "111111111111111111111111" },
    { stars: 4, campaignId: "111111111111111111111111" },
  ])
    assert.equal(schema.safeParse({ text: "Review", ...input }).success, false);
});
test("campaign cover changes invalidate prior exact-version approval hashes", () => {
  const r = {
    _id: "111111111111111111111111",
    revisionNumber: 1,
    title: "Story",
    brief: "Brief",
  };
  assert.notEqual(
    revisionHash({ ...r, coverAssetId: "222222222222222222222222" }),
    revisionHash({ ...r, coverAssetId: "333333333333333333333333" }),
  );
});
test("socket identity refuses anonymous and malformed cookies before database access", async () => {
  await assert.rejects(socketIdentity(""), (e) => e.code === "AUTH_REQUIRED");
  await assert.rejects(
    socketIdentity("insight_session=%broken"),
    (e) => e.code === "AUTH_REQUIRED",
  );
});
test("real Socket.IO transport rejects anonymous connections and unapproved browser origins", async () => {
  const server = createServer(),
    io = attachChat(server);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = "http://127.0.0.1:" + server.address().port;
  try {
    for (const origin of [undefined, "https://unapproved.example"]) {
      const socket = client(url, {
        transports: ["websocket"],
        reconnection: false,
        timeout: 1500,
        extraHeaders: origin ? { Origin: origin } : {},
      });
      try {
        const error = await new Promise((resolve, reject) => {
          socket.once("connect", () =>
            reject(new Error("Anonymous connection succeeded")),
          );
          socket.once("connect_error", resolve);
        });
        assert(error);
      } finally {
        socket.close();
      }
    }
  } finally {
    io.disposeInsight();
    await new Promise((resolve) => io.close(resolve));
  }
});
