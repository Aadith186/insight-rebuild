import test from "node:test";
import assert from "node:assert/strict";
import { presentRows, chatTime } from "../../web/src/components/listing.js";
import { activityWindow } from "../src/modules/messaging/messaging.service.js";
test("page search and status filters compose without mutating API records", () => {
  const data = [
    { id: "1", name: "Riya", state: "SENT", createdAt: "2026-11-01" },
    { id: "2", name: "Meera", state: "DRAFT", createdAt: "2026-11-02" },
    { id: "3", name: "Riya second", state: "DRAFT", createdAt: "2026-11-03" },
  ];
  assert.deepEqual(
    presentRows(data, { search: "riya", state: "DRAFT" }).map((x) => x.id),
    ["3"],
  );
  assert.deepEqual(
    data.map((x) => x.id),
    ["1", "2", "3"],
  );
  assert.deepEqual(
    presentRows(data, { sort: "oldest" }).map((x) => x.id),
    ["1", "2", "3"],
  );
});
test("amount sorting uses numeric minor units rather than formatted text", () => {
  assert.deepEqual(
    presentRows(
      [
        { id: "low", amountMinor: 9900 },
        { id: "high", grossMinor: 120000 },
      ],
      { sort: "amount" },
    ).map((x) => x.id),
    ["high", "low"],
  );
});
test("chat timestamps distinguish today, yesterday and older activity across month boundaries", () => {
  const now = new Date(2026, 10, 1, 13, 0);
  assert.equal(chatTime(new Date(2026, 9, 31, 14), now), "Yesterday");
  assert.match(chatTime(new Date(2026, 9, 1), now), /Oct/);
  assert.match(chatTime(new Date(2026, 10, 1, 11, 30), now), /11:30/);
  assert.equal(chatTime(null, now), "");
});
test("inbox pagination preserves the activity timestamp and ID tie breaker", () => {
  const row = { _id: "123", lastMessageAt: new Date("2026-11-01T12:00:00Z") };
  assert.deepEqual(activityWindow(row), {
    $or: [
      { lastMessageAt: { $lt: row.lastMessageAt } },
      { lastMessageAt: row.lastMessageAt, _id: { $lt: "123" } },
    ],
  });
});

import request from "supertest";
import { createApp } from "../src/app.js";
test("unread totals are private and cannot be read without a session", async () => {
  await request(createApp()).get("/api/v1/inbox/summary").expect(401);
});
