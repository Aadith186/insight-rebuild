import test from "node:test";
import { createServer } from "node:http";
import { io as socketClient } from "socket.io-client";
import { attachChat } from "../../src/modules/messaging/messaging.socket.js";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import request from "supertest";
import { createApp } from "../../src/app.js";
import * as M from "../../src/models.js";
const uri = process.env.TEST_MONGODB_URI;
test(
  "real MongoDB replica-set acceptance journeys",
  { skip: !uri, timeout: 180000 },
  async (t) => {
    const dbName =
      "insight_test_" + Date.now() + "_" + Math.random().toString(16).slice(2);
    await mongoose.connect(uri, { dbName });
    try {
      const hello = await mongoose.connection.db.admin().command({ hello: 1 });
      assert(
        hello.setName || hello.msg === "isdbgrid",
        "A replica set is required",
      );
      for (const model of Object.values(M)) await model.init();
      process.env.DATA_ENCRYPTION_KEY = "22".repeat(32);
      const app = createApp(),
        brand = request.agent(app),
        creator = request.agent(app),
        owner = request.agent(app),
        agency = request.agent(app),
        reviewer = request.agent(app),
        manager = request.agent(app);
      const post = (agent, path, body, org, key) => {
        let r = agent
          .post("/api/v1" + path)
          .set(
            "Idempotency-Key",
            key || new mongoose.Types.ObjectId().toString(),
          );
        if (org) r = r.set("X-Organization-Id", org);
        return r.send(body || {});
      };
      const read = (agent, path, org) => {
        let r = agent.get("/api/v1" + path);
        return org ? r.set("X-Organization-Id", org) : r;
      };
      const ok = (r, status) => {
        assert.equal(r.status, status || 200, JSON.stringify(r.body));
        return r.body.data;
      };
      const reg = async (agent, email, type) =>
        ok(
          await post(agent, "/auth/register", {
            email,
            password: "integration-password-123",
            name: email.split("@")[0],
            accountType: type,
          }),
          201,
        );
      const b = await reg(brand, "brand@test.example", "BRAND"),
        cr = await reg(creator, "creator@test.example", "CREATOR"),
        ag = await reg(agency, "agency@test.example", "AGENCY"),
        rv = await reg(reviewer, "reviewer@test.example", "CREATOR"),
        mg = await reg(manager, "manager@test.example", "CREATOR");
      const brandId = String(b.organizations[0]._id),
        agencyId = String(ag.organizations[0]._id),
        creatorId = String(cr.creator._id),
        reviewerId = String(rv.user._id);
      await M.User.updateMany({}, { $set: { emailVerifiedAt: new Date() } });
      await M.User.create({
        email: "owner@test.example",
        emailNormalized: "owner@test.example",
        name: "Owner",
        platformRole: "OWNER",
        passwordHash: await bcrypt.hash("integration-password-123", 12),
        emailVerifiedAt: new Date(),
      });
      ok(
        await post(owner, "/auth/login", {
          email: "owner@test.example",
          password: "integration-password-123",
        }),
      );
      const paid = await M.CollaborationFormat.create({
          key: "PAID_VIDEO",
          label: "Paid video",
          compensationPolicy: "REQUIRED",
          productPolicy: "OPTIONAL",
          completionMode: "PUBLISH",
          version: 1,
        }),
        barter = await M.CollaborationFormat.create({
          key: "BARTER",
          label: "Product exchange",
          compensationPolicy: "ZERO",
          productPolicy: "REQUIRED",
          completionMode: "PUBLISH",
          version: 1,
        });
      await M.PlatformSettings.create({
        version: 1,
        commissionBps: 1000,
        effectiveAt: new Date(),
      });
      const terms = {
        formatId: String(paid._id),
        amountMinor: 50000,
        currency: "INR",
        dueAt: "2099-02-01T00:00:00Z",
        deliverables: [
          { kind: "REEL", quantity: 1, description: "A product story" },
        ],
        usageRights: {
          channels: ["ORGANIC_SOCIAL"],
          durationDays: 90,
          paidAdvertisingAllowed: false,
        },
        includedRevisions: 1,
        products: [],
      };
      const brief = {
        title: "A thoughtful product story",
        brief: "Show the product clearly in daylight.",
        niche: "Lifestyle",
        formatId: String(paid._id),
        budgetPerCreatorMinor: 50000,
        spots: 2,
        applicationDeadline: "2099-01-01T00:00:00Z",
        deadline: "2099-02-01T00:00:00Z",
        deliverables: terms.deliverables,
        usageRights: terms.usageRights,
        includedRevisions: 1,
        compensationBudgetMinor: 100000,
        serviceChargeMinor: 0,
      };
      let campaignId, collaborationId;
      await t.test(
        "brand campaign moderation, pitch and contextual conversation",
        async () => {
          const c = ok(
            await post(
              brand,
              "/campaigns",
              { brandOrganizationId: brandId, ...brief },
              brandId,
            ),
            201,
          );
          campaignId = c.id;
          ok(
            await post(
              brand,
              "/campaigns/" + c.id + "/submit",
              { expectedVersion: c.version },
              brandId,
            ),
          );
          const submitted = ok(await read(owner, "/campaigns/" + c.id));
          ok(
            await post(
              owner,
              "/owner/campaign-reviews/" +
                submitted.reviewRevisionId +
                "/decisions",
              {
                decision: "APPROVE",
                reason: "Brief meets requirements.",
                expectedVersion: submitted.version,
              },
            ),
          );
          const discovery = ok(await read(creator, "/campaigns"));
          assert(discovery.some((c) => c.id === campaignId));
          ok(
            await post(creator, "/campaigns/" + campaignId + "/applications", {
              pitch: "An honest morning routine.",
              proposedRateMinor: 50000,
            }),
          );
          const x = ok(
              await post(creator, "/conversations", {
                contextType: "CAMPAIGN",
                contextId: campaignId,
              }),
            ),
            y = ok(
              await post(creator, "/conversations", {
                contextType: "CAMPAIGN",
                contextId: campaignId,
              }),
            );
          assert.equal(x.id, y.id);
          assert.equal(x.campaignId, campaignId);
          const httpServer = createServer(app),
            realtime = attachChat(httpServer);
          await new Promise((resolve) =>
            httpServer.listen(0, "127.0.0.1", resolve),
          );
          const socketUrl = "http://127.0.0.1:" + httpServer.address().port;
          const sockets = [];
          try {
            for (const email of [
              "creator@test.example",
              "brand@test.example",
            ]) {
              const login = await request(app)
                .post("/api/v1/auth/login")
                .send({ email, password: "integration-password-123" });
              ok(login);
              const cookie = login.headers["set-cookie"]
                .map((c) => c.split(";")[0])
                .join("; ");
              const socket = socketClient(socketUrl, {
                transports: ["websocket"],
                extraHeaders: { Cookie: cookie },
                reconnection: false,
                timeout: 3000,
              });
              sockets.push(socket);
              await new Promise((resolve, reject) => {
                socket.once("connect", resolve);
                socket.once("connect_error", reject);
              });
            }
            const ack = (socket, event, body) =>
              new Promise((resolve, reject) =>
                socket
                  .timeout(5000)
                  .emit(event, body, (error, response) =>
                    error ? reject(error) : resolve(response),
                  ),
              );
            assert(
              (
                await ack(sockets[0], "conversation:join", {
                  conversationId: x.id,
                })
              ).ok,
            );
            assert(
              (
                await ack(sockets[1], "conversation:join", {
                  conversationId: x.id,
                  organizationId: brandId,
                })
              ).ok,
            );
            assert(
              (
                await ack(sockets[1], "inbox:watch", {
                  organizationId: brandId,
                })
              ).ok,
            );
            const inboxChanged = new Promise((resolve, reject) => {
              const timer = setTimeout(
                () => reject(new Error("Inbox watcher missed update")),
                5000,
              );
              sockets[1].once("inbox:changed", (e) => {
                clearTimeout(timer);
                resolve(e);
              });
            });
            const delivered = new Promise((resolve, reject) => {
              const timer = setTimeout(
                () => reject(new Error("No committed socket message")),
                5000,
              );
              sockets[1].once("message:new", (event) => {
                clearTimeout(timer);
                resolve(event);
              });
            });
            const socketBody = {
              conversationId: x.id,
              text: "A real persisted socket message",
              clientMessageId: "socket-journey-1",
              attachmentAssetIds: [],
            };
            assert((await ack(sockets[0], "message:send", socketBody)).ok);
            const received = await delivered;
            assert.equal(received.message.text, socketBody.text);
            assert.equal((await inboxChanged).conversationId, x.id);
            const unreadBefore = ok(
              await read(brand, "/inbox/summary", brandId),
            );
            assert.equal(unreadBefore.messages, 1);
            assert.equal(unreadBefore.conversations, 1);
            assert.equal(
              ok(await read(agency, "/inbox/summary", agencyId)).messages,
              0,
            );
            const filtered = ok(
              await read(
                brand,
                "/conversations?unread=true&search=persisted",
                brandId,
              ),
            );
            assert.equal(filtered.length, 1);
            assert.equal(filtered[0].id, x.id);

            assert.equal(
              await M.Message.countDocuments({
                conversationId: x.id,
                clientMessageId: "socket-journey-1",
              }),
              1,
            );
            assert((await ack(sockets[0], "message:send", socketBody)).ok);
            assert.equal(
              await M.Message.countDocuments({
                conversationId: x.id,
                clientMessageId: "socket-journey-1",
              }),
              1,
            );
            assert(
              (
                await ack(sockets[1], "conversation:read", {
                  conversationId: x.id,
                  organizationId: brandId,
                  lastMessageId: received.message.id || received.message._id,
                })
              ).ok,
            );
            assert.equal(
              ok(await read(brand, "/inbox/summary", brandId)).messages,
              0,
            );
            assert.equal(
              ok(await read(brand, "/conversations?unread=true", brandId))
                .length,
              0,
            );
          } finally {
            for (const socket of sockets) socket.close();
            realtime.disposeInsight();
            await new Promise((resolve) => realtime.close(resolve));
          }

          const msg = ok(
            await post(creator, "/conversations/" + x.id + "/messages", {
              text: "Can I film outside?",
              clientMessageId: "question-1",
              attachmentAssetIds: [],
            }),
          );
          assert.equal(msg.senderUserId, String(cr.user._id));
          ok(
            await post(creator, "/conversations/" + x.id + "/messages", {
              text: "Can I film outside?",
              clientMessageId: "question-1",
              attachmentAssetIds: [],
            }),
          );
          assert.equal(
            await M.Message.countDocuments({ conversationId: x.id }),
            2,
          );
        },
      );
      await t.test(
        "offer acceptance is idempotent and accepted terms are immutable",
        async () => {
          let o = ok(
            await post(
              brand,
              "/offers",
              {
                brandOrganizationId: brandId,
                creatorProfileId: creatorId,
                campaignId,
                ...terms,
              },
              brandId,
            ),
            201,
          );
          o = ok(
            await post(
              brand,
              "/offers/" + o.id + "/send",
              { expectedVersion: o.version },
              brandId,
            ),
          );
          const body = { expectedVersion: o.version },
            a = ok(
              await post(
                creator,
                "/offers/" + o.id + "/accept",
                body,
                null,
                "accept-once",
              ),
            );
          const again = ok(
            await post(
              creator,
              "/offers/" + o.id + "/accept",
              body,
              null,
              "accept-once",
            ),
          );
          assert.equal(a.agreement.id, again.agreement.id);
          assert.equal(a.agreement.feeMinor, 5000);
          assert.equal(a.agreement.creatorNetMinor, 45000);
          assert.equal(await M.Agreement.countDocuments({ offerId: o.id }), 1);
          collaborationId = a.collaboration.id;
          const conversation = ok(
            await post(
              brand,
              "/conversations",
              { contextType: "COLLABORATION", contextId: collaborationId },
              brandId,
            ),
          );
          assert.equal(conversation.collaborationId, collaborationId);
        },
      );
      await t.test(
        "paid content gate, funding reconciliation, completion and one settlement",
        async () => {
          let d = ok(await read(creator, "/collaborations/" + collaborationId));
          let r = await post(
            creator,
            "/collaborations/" + collaborationId + "/content-versions",
            {
              expectedVersion: d.version,
              title: "First cut",
              externalUrl: "https://example.com/cut.mp4",
            },
          );
          assert.equal(r.status, 409);
          const f = ok(
            await post(
              brand,
              "/collaborations/" + collaborationId + "/fundings",
              {
                amountMinor: 50000,
                rail: "UPI",
                externalReference: "TEST-REAL-REF-01",
              },
              brandId,
            ),
          );
          ok(
            await post(owner, "/owner/fundings/" + f.id + "/verify", {
              expectedVersion: f.version,
              verificationReference: "RECONCILIATION-01",
            }),
          );
          d = ok(await read(creator, "/collaborations/" + collaborationId));
          let v = ok(
            await post(
              creator,
              "/collaborations/" + collaborationId + "/content-versions",
              {
                expectedVersion: d.version,
                title: "First cut",
                externalUrl: "https://example.com/cut.mp4",
              },
            ),
          );
          ok(
            await post(
              brand,
              "/content-versions/" + v.id + "/approve",
              { expectedVersion: v.version },
              brandId,
            ),
          );
          d = ok(await read(creator, "/collaborations/" + collaborationId));
          const completion = ok(
            await post(
              creator,
              "/collaborations/" + collaborationId + "/completion-submissions",
              {
                mode: "PUBLISHED",
                platform: "Instagram",
                url: "https://example.com/live-post",
                completedAt: new Date().toISOString(),
                approvedContentVersionId: d.approvedContentVersionId,
              },
            ),
          );
          ok(
            await post(
              brand,
              "/completion-submissions/" + completion.id + "/verify",
              {
                expectedVersion: completion.version,
                confirmationNote: "Checked against agreed delivery.",
              },
              brandId,
            ),
          );
          d = ok(
            await read(brand, "/collaborations/" + collaborationId, brandId),
          );
          ok(
            await post(
              brand,
              "/collaborations/" + collaborationId + "/settlements",
              { expectedVersion: d.version },
              brandId,
              "settle-once",
            ),
          );
          ok(
            await post(
              brand,
              "/collaborations/" + collaborationId + "/settlements",
              { expectedVersion: d.version },
              brandId,
              "settle-once",
            ),
          );
          const w = ok(await read(creator, "/wallets/me"));
          assert.equal(w.availableMinor, 45000);
          assert.equal(
            await M.LedgerTransaction.countDocuments({
              kind: "RELEASE",
              collaborationId,
            }),
            1,
          );
        },
      );
      await t.test(
        "concurrent withdrawal cannot overdraw and rejection restores one reservation",
        async () => {
          const b = {
            amountMinor: 30000,
            destination: { type: "UPI", upiId: "creator@testbank" },
          };
          const results = await Promise.all([
            post(creator, "/me/withdrawals", b, null, "withdraw-a"),
            post(creator, "/me/withdrawals", b, null, "withdraw-b"),
          ]);
          assert.equal(results.filter((r) => r.status === 200).length, 1);
          assert.equal(results.filter((r) => r.status === 409).length, 1);
          const d = results.find((r) => r.status === 200).body.data;
          ok(
            await post(
              owner,
              "/owner/withdrawals/" + d.id + "/reject",
              {
                expectedVersion: d.version,
                reason: "Creator requested a corrected destination.",
              },
              null,
              "reject-once",
            ),
          );
          ok(
            await post(
              owner,
              "/owner/withdrawals/" + d.id + "/reject",
              {
                expectedVersion: d.version,
                reason: "Creator requested a corrected destination.",
              },
              null,
              "reject-once",
            ),
          );
          assert.equal(
            ok(await read(creator, "/wallets/me")).availableMinor,
            45000,
          );
        },
      );
      await t.test(
        "settled mutual reviews refresh real creator statistics",
        async () => {
          ok(
            await post(
              brand,
              "/collaborations/" + collaborationId + "/reviews",
              {
                stars: 5,
                text: "Thoughtful delivery and clear communication.",
              },
              brandId,
            ),
          );
          ok(
            await post(
              creator,
              "/collaborations/" + collaborationId + "/reviews",
              { stars: 4, text: "A clear brief and timely feedback." },
            ),
          );
          const p = ok(await read(brand, "/creators/" + creatorId, brandId));
          assert.equal(p.completedCount, 1);
          assert.equal(p.ratingCount, 1);
          assert.equal(p.ratingAverage, 5);
          const repeat = await post(
            brand,
            "/collaborations/" + collaborationId + "/reviews",
            { stars: 3, text: "Duplicate." },
            brandId,
          );
          assert.equal(repeat.status, 409);
        },
      );
      await t.test(
        "barter without products is rejected at the real API",
        async () => {
          const r = await post(
            brand,
            "/offers",
            {
              brandOrganizationId: brandId,
              creatorProfileId: creatorId,
              ...terms,
              formatId: String(barter._id),
              amountMinor: 0,
              products: [],
            },
            brandId,
          );
          assert.equal(r.status, 422);
          assert.equal(r.body.error.code, "PRODUCTS_REQUIRED");
        },
      );
      await t.test(
        "agency approval is independent, exact-version bound and API-enforced",
        async () => {
          const rel = ok(
            await post(
              agency,
              "/agencies/" + agencyId + "/clients",
              {
                name: "Managed client",
                budgetMinor: 200000,
                retainerChargeMinor: 0,
                contactUserIds: [],
              },
              agencyId,
            ),
          );
          const client = rel.brandOrganizationId;
          const i = ok(
            await post(
              agency,
              "/organizations/" + agencyId + "/invitations",
              {
                email: "reviewer@test.example",
                role: "CLIENT_REVIEWER",
                clientScopes: [
                  {
                    clientBrandId: client,
                    allCampaigns: true,
                    campaignIds: [],
                    directCollaborationIds: [],
                  },
                ],
              },
              agencyId,
            ),
          );
          const raw = i.url.split("/").at(-1);
          ok(await post(reviewer, "/invitations/" + raw + "/accept"));
          let c = ok(
            await post(
              agency,
              "/campaigns",
              { brandOrganizationId: client, ...brief },
              agencyId,
            ),
            201,
          );
          const bypass = await post(
            agency,
            "/campaigns/" + c.id + "/submit",
            { expectedVersion: c.version },
            agencyId,
          );
          assert.equal(bypass.status, 409);
          assert.equal(bypass.body.error.code, "CLIENT_APPROVAL_REQUIRED");
          const self = await post(
            agency,
            "/client-approvals",
            {
              targetType: "CAMPAIGN_REVISION",
              targetId: c.id,
              reviewerUserIds: [String(ag.user._id)],
              policy: "ANY_ASSIGNED",
            },
            agencyId,
          );
          assert.equal(self.status, 422);
          const a = ok(
            await post(
              agency,
              "/client-approvals",
              {
                targetType: "CAMPAIGN_REVISION",
                targetId: c.id,
                reviewerUserIds: [reviewerId],
                policy: "ANY_ASSIGNED",
              },
              agencyId,
            ),
          ).approval;
          const forged = await post(
            agency,
            "/client-approvals/" + a.id + "/decisions",
            {
              expectedVersion: a.version,
              decision: "APPROVED",
              note: "Self approval",
            },
            agencyId,
          );
          assert.equal(forged.status, 403);
          ok(
            await post(
              reviewer,
              "/client-approvals/" + a.id + "/decisions",
              {
                expectedVersion: a.version,
                decision: "APPROVED",
                note: "Client approves this exact brief.",
              },
              agencyId,
            ),
          );
          c = ok(await read(agency, "/campaigns/" + c.id, agencyId));
          ok(
            await post(
              agency,
              "/campaigns/" + c.id + "/submit",
              { expectedVersion: c.version },
              agencyId,
            ),
          );
        },
      );
      await t.test(
        "private model persistence is independent of browser state and journal balances",
        async () => {
          assert(
            await M.Collaboration.exists({
              _id: collaborationId,
              workState: "COMPLETED",
            }),
          );
          const journal = await M.LedgerTransaction.find({});
          for (const j of journal)
            assert.equal(
              j.entries.reduce((n, e) => n + e.debitMinor, 0),
              j.entries.reduce((n, e) => n + e.creditMinor, 0),
            );
          assert.equal(await M.Agreement.countDocuments(), 1);
        },
      );
    } finally {
      assert(mongoose.connection.name.startsWith("insight_test_"));
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  },
);
