import { randomUUID } from "node:crypto";
import * as M from "../models.js";
import { create, same } from "./db.js";
import { hasScope, campaignId, collaborationId } from "./policy.js";
export async function event(c, action, r, extra = [], changes = []) {
  const name = r.constructor?.modelName || r.resourceType || "Record",
    cam = campaignId(r),
    deal = collaborationId(r),
    org = r.agencyOrganizationId || r.brandOrganizationId;
  await create(
    M.AuditLog,
    {
      actorUserId: c.user?._id,
      actorName: c.user?.name,
      organizationId: org,
      clientBrandOrganizationId: r.brandOrganizationId,
      campaignId: cam,
      collaborationId: deal,
      action,
      resourceType: name,
      resourceId: r._id,
      changes,
      requestId: c.requestId,
    },
    c,
  );
  const recipients = [...extra];
  if (
    r.creatorProfileId &&
    !["OFFER_DRAFTED", "OFFER_EDITED"].includes(action)
  ) {
    const p = await M.CreatorProfile.findById(r.creatorProfileId).session(
      c.session,
    );
    if (p) recipients.push(p.userId);
  }
  if (org) {
    const ms = await M.Membership.find({
      organizationId: org,
      status: "ACTIVE",
    }).session(c.session);
    for (const m of ms)
      if (hasScope(m, r.brandOrganizationId, cam, deal))
        recipients.push(m.userId);
  }
  const ids = [
    ...new Set(
      recipients.filter((id) => id && !same(id, c.user?._id)).map(String),
    ),
  ];
  const screen =
    name === "Conversation"
      ? "conversations"
      : name === "ClientApproval"
        ? "approvals"
        : deal
          ? "collaborations"
          : cam
            ? "campaigns"
            : "notifications";
  await create(
    M.OutboxEvent,
    {
      eventId: randomUUID(),
      kind: action,
      resourceType: name,
      resourceId: r._id,
      recipientUserIds: ids,
      title: action.toLowerCase().replaceAll("_", " "),
      screen,
      organizationId: org,
      brandOrganizationId: r.brandOrganizationId,
      campaignId: cam,
      collaborationId: deal,
      status: "PENDING",
      nextAttemptAt: new Date(),
      occurredAt: new Date(),
      delivery: { channel: "IN_APP" },
    },
    c,
  );
}
export async function drain() {
  const events = await M.OutboxEvent.find({
    status: { $in: ["PENDING", "FAILED"] },
    nextAttemptAt: { $lte: new Date() },
    attempts: { $lt: 10 },
    "delivery.channel": "IN_APP",
  }).limit(50);
  for (const e of events) {
    try {
      const preference = e.kind === "MESSAGE_RECEIVED" ? "chatNotifications"
        : e.kind === "CLIENT_APPROVAL_REQUESTED" ? "reviewNotifications" : null;
      const muted = preference ? await M.User.distinct("_id", {
        _id: { $in: e.recipientUserIds },
        ["preferences." + preference]: false,
      }) : [];
      const mutedIds = new Set(muted.map(String));
      for (const id of e.recipientUserIds) {
        if (mutedIds.has(String(id))) continue;
        await M.Notification.updateOne(
          { recipientUserId: id, eventId: e.eventId },
          {
            $setOnInsert: {
              type: e.kind,
              title: e.title,
              organizationContextId: e.organizationId,
              clientBrandOrganizationId: e.brandOrganizationId,
              campaignId: e.campaignId,
              collaborationId: e.collaborationId,
              link: {
                screen: e.screen,
                resourceId: String(
                  ["conversations", "approvals"].includes(e.screen)
                    ? e.resourceId
                    : e.collaborationId || e.campaignId || e.resourceId,
                ),
              },
            },
          },
          { upsert: true },
        );
      }
      await M.OutboxEvent.updateOne(
        { _id: e._id },
        { $set: { status: "DONE" }, $inc: { attempts: 1 } },
      );
    } catch {
      await M.OutboxEvent.updateOne(
        { _id: e._id },
        {
          $set: {
            status: "FAILED",
            nextAttemptAt: new Date(Date.now() + 60000),
          },
          $inc: { attempts: 1 },
        },
      );
    }
  }
}
