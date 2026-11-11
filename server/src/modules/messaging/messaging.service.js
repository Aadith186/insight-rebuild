import * as M from "../../models.js";
import { get, create, save, same, assert } from "../../core/db.js";
import * as P from "../../core/policy.js";
import { event } from "../../core/events.js";
import { access as approvalAccess } from "../approvals/approvals.service.js";
import { access as mediaAccess } from "../media/media.service.js";
export async function access(c, id, write = false) {
  const d = await get(M.Conversation, id, c);
  if (c.user.platformRole === "OWNER" && !write) return d;
  if (d.contextType === "CLIENT_REVIEW") {
    assert(d.clientApprovalId, 404, "NOT_FOUND", "Conversation unavailable.");
    await approvalAccess(c, d.clientApprovalId);
    if (write)
      assert(
        c.user.platformRole !== "OWNER",
        403,
        "OWNER_OVERSIGHT",
        "Owner has read-only oversight.",
      );
    return d;
  }
  if (d.collaborationId) {
    const work = await P.collab(c, d.collaborationId, { reviewer: false });
    if (write) await P.party(c, work, { write: true, reviewer: false });
    return d;
  }
  if (d.campaignId) {
    await P.campaign(c, d.campaignId);
    if (c.creator && !c.organizationId)
      assert(
        same(d.creatorProfileId, c.creator._id),
        404,
        "NOT_FOUND",
        "Conversation unavailable.",
      );
    else await P.commission(c, d);
    return d;
  }
  await P.party(c, d, { write, reviewer: false });
  return d;
}
export async function open(c, b) {
  assert(
    c.user.platformRole !== "OWNER",
    403,
    "OWNER_OVERSIGHT",
    "Owners can inspect existing conversations but cannot create participant threads.",
  );
  let scope = {},
    cp = b.creatorProfileId;
  if (b.contextType === "COLLABORATION") {
    const d = await P.collab(c, b.contextId);
    await P.party(c, d, { reviewer: false });
    scope = {
      brandOrganizationId: d.brandOrganizationId,
      agencyOrganizationId: d.agencyOrganizationId,
      collaborationId: d._id,
      campaignId: d.campaignId,
    };
    cp = d.creatorProfileId;
  } else if (b.contextType === "CAMPAIGN") {
    const d = await P.campaign(c, b.contextId);
    scope = {
      brandOrganizationId: d.brandOrganizationId,
      agencyOrganizationId: d.agencyOrganizationId,
      campaignId: d._id,
    };
    if (c.creator && !c.organizationId) cp = c.creator._id;
    else await P.commission(c, d);
    assert(cp, 422, "RECIPIENT_REQUIRED", "Choose a creator.");
    await get(M.CreatorProfile, cp, c);
  } else if (b.contextType === "CLIENT_REVIEW") {
    const a = await approvalAccess(c, b.contextId);
    scope = {
      brandOrganizationId: a.brandOrganizationId,
      agencyOrganizationId: a.agencyOrganizationId,
      campaignId: a.campaignId,
      collaborationId: a.collaborationId,
      clientApprovalId: a._id,
    };
    cp = undefined;
  } else {
    assert(
      b.brandOrganizationId && cp,
      422,
      "RECIPIENT_REQUIRED",
      "Choose a brand and creator.",
    );
    if (c.creator && !c.organizationId) {
      assert(
        same(c.creator._id, cp),
        403,
        "CREATOR_SCOPE",
        "Only your own conversation.",
      );
      const o = await get(M.Organization, b.brandOrganizationId, c);
      assert(
        o.type === "BRAND" && !o.suspendedAt,
        404,
        "NOT_FOUND",
        "Brand unavailable.",
      );
      scope = { brandOrganizationId: o._id };
    } else scope = await P.clientContext(c, b.brandOrganizationId, true);
    await get(M.CreatorProfile, cp, c);
  }
  const key = [
    b.contextType,
    scope.brandOrganizationId,
    scope.agencyOrganizationId || "",
    scope.campaignId || "",
    scope.collaborationId || "",
    scope.clientApprovalId || "",
    cp || "",
  ]
    .map(String)
    .join(":");
  const existing = await M.Conversation.findOne({
    participantScopeKey: key,
  }).session(c.session);
  if (existing) return access(c, existing._id);
  const d = await create(
    M.Conversation,
    {
      ...scope,
      contextType: b.contextType,
      creatorProfileId: cp,
      participantScopeKey: key,
      lastMessageAt: new Date(),
    },
    c,
  );
  await event(c, "CONVERSATION_OPENED", d);
  return d;
}
export async function message(c, b, p) {
  const d = await access(c, p.conversationId, true);
  assert(
    b.text?.trim() || b.attachmentAssetIds.length,
    422,
    "EMPTY_MESSAGE",
    "Write a message or attach a file.",
  );
  const old = await M.Message.findOne({
    conversationId: d._id,
    senderUserId: c.user._id,
    clientMessageId: b.clientMessageId,
  }).session(c.session);
  if (old) {
    assert(
      (old.text || "") === (b.text || "") &&
        JSON.stringify(old.attachmentAssetIds.map(String)) ===
          JSON.stringify(b.attachmentAssetIds),
      409,
      "MESSAGE_CONFLICT",
      "This message ID was used for different content.",
    );
    return old;
  }
  for (const id of b.attachmentAssetIds) {
    const a = await mediaAccess(c, id);
    assert(
      same(a.uploaderUserId, c.user._id) &&
        (same(a.collaborationId, d.collaborationId) ||
          a.visibility === "PUBLIC"),
      422,
      "ATTACHMENT_SCOPE",
      "Attachment belongs to another conversation.",
    );
    a.referenceCount++;
    await save(a, c);
  }
  const m = await create(
    M.Message,
    {
      ...b,
      conversationId: d._id,
      senderUserId: c.user._id,
      senderName: c.user.name,
    },
    c,
  );
  d.lastMessageAt = new Date();
  await save(d, c);
  await event(c, "MESSAGE_RECEIVED", d);
  return m;
}
export async function read(c, b, p) {
  const d = await access(c, p.conversationId, true);
  await get(M.Message, b.lastMessageId, c, { conversationId: d._id });
  const cursor = d.readCursors.find((r) => same(r.userId, c.user._id));
  if (
    cursor &&
    String(cursor.lastReadMessageId || "") >= String(b.lastMessageId)
  )
    return d;
  if (cursor) {
    cursor.lastReadMessageId = b.lastMessageId;
    cursor.readAt = new Date();
  } else
    d.readCursors.push({
      userId: c.user._id,
      lastReadMessageId: b.lastMessageId,
      readAt: new Date(),
    });
  await save(d, c);
  return d;
}

export async function describe(c, d) {
  const brand = await get(M.Organization, d.brandOrganizationId, c),
    creator = d.creatorProfileId
      ? await get(M.CreatorProfile, d.creatorProfileId, c)
      : null,
    user = creator ? await get(M.User, creator.userId, c) : null,
    cam = d.campaignId ? await get(M.Campaign, d.campaignId, c) : null;
  const cursor = d.readCursors.find((r) => same(r.userId, c.user._id));
  const [last, count] = await Promise.all([
    M.Message.findOne({ conversationId: d._id })
      .sort({ _id: -1 })
      .select("text senderName senderUserId createdAt")
      .session(c.session),
    M.Message.countDocuments({
      conversationId: d._id,
      senderUserId: { $ne: c.user._id },
      ...(cursor?.lastReadMessageId
        ? { _id: { $gt: cursor.lastReadMessageId } }
        : {}),
    }).session(c.session),
  ]);
  const asCreator =
    same(c.creator?._id, d.creatorProfileId) && !c.organizationId;
  return {
    ...d.toJSON(),
    title:
      d.contextType === "CLIENT_REVIEW"
        ? brand.name + " · Client review"
        : asCreator
          ? brand.name
          : user?.name || brand.name,
    avatarAssetId:
      asCreator || !creator ? brand.logoAssetId : creator.avatarAssetId,
    campaignTitle: cam?.draft?.title || cam?.titleNormalized,
    contextLabel: {
      DIRECT: "Direct conversation",
      CAMPAIGN: "Campaign question",
      COLLABORATION: "Collaboration discussion",
      CLIENT_REVIEW: "Private client review",
    }[d.contextType],
    lastMessage: last,
    unreadCount: count,
  };
}

// Recent activity, rather than creation order, drives inbox pagination.
export function activityWindow(d) {
  return {
    $or: [
      { lastMessageAt: { $lt: d.lastMessageAt } },
      { lastMessageAt: d.lastMessageAt, _id: { $lt: d._id } },
    ],
  };
}
export async function inbox(c, q = {}) {
  let f = P.filter(c);
  if (c.creator && !c.organizationId)
    f = { $and: [f, { contextType: { $ne: "CLIENT_REVIEW" } }] };
  for (const key of ["contextType", "campaignId", "collaborationId"])
    if (q[key]) f = { $and: [f, { [key]: q[key] }] };
  if (q.cursor) {
    const before = await get(M.Conversation, q.cursor, c);
    await access(c, before._id);
    f = { $and: [f, activityWindow(before)] };
  }
  const limit = Math.min(100, Math.max(1, Number(q.limit) || 30));
  const found = M.Conversation.find(f)
      .sort({ lastMessageAt: -1, _id: -1 })
      .session(c.session)
      .cursor(),
    data = [];
  const needle = String(q.search || "")
    .trim()
    .toLowerCase();
  for await (const d of found) {
    try {
      await access(c, d._id);
      const row = await describe(c, d);
      if (q.unread === "true" && !row.unreadCount) continue;
      if (
        needle &&
        ![row.title, row.campaignTitle, row.lastMessage?.text]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(needle)
      )
        continue;
      data.push(row);
      if (data.length > limit) break;
    } catch (e) {if(![403,404].includes(e.status))throw e;}
  }
  const more = data.length > limit;
  return {
    data: data.slice(0, limit),
    page: {
      hasMore: more,
      nextCursor: more
        ? String(data[limit - 1].id || data[limit - 1]._id)
        : null,
    },
  };
}
export async function unreadSummary(c) {
  let messages = 0,
    conversations = 0;
  const cursor = M.Conversation.find(
    c.user.platformRole === "OWNER" ? { _id: { $in: [] } } : P.filter(c),
  )
    .select("_id readCursors")
    .session(c.session)
    .cursor();
  for await (const d of cursor) {
    try {
      await access(c, d._id);
      const read = d.readCursors.find((r) => same(r.userId, c.user._id));
      const count = await M.Message.countDocuments({
        conversationId: d._id,
        senderUserId: { $ne: c.user._id },
        ...(read?.lastReadMessageId
          ? { _id: { $gt: read.lastReadMessageId } }
          : {}),
      }).session(c.session);
      messages += count;
      if (count) conversations++;
    } catch (e) {if(![403,404].includes(e.status))throw e;}
  }
  let notifications = 0;
  const { allowed } = await import("../activity/activity.service.js");
  for await (const n of M.Notification.find({
    recipientUserId: c.user._id,
    readAt: null,
  })
    .session(c.session)
    .cursor())
    if (await allowed(c, n)) notifications++;
  return { messages, conversations, notifications };
}
