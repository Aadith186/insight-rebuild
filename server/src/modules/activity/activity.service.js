import * as M from "../../models.js";
import { get, list, save, same, assert } from "../../core/db.js";
import * as P from "../../core/policy.js";
export async function allowed(c, n) {
  if (!same(n.recipientUserId, c.user._id)) return false;
  try {
    if (n.collaborationId) await P.collab(c, n.collaborationId);
    else if (n.campaignId) await P.campaign(c, n.campaignId);
    else if (n.organizationContextId) P.member(c, n.organizationContextId);
    return true;
  } catch {
    return false;
  }
}
export async function notifications(c, q) {
  const rows = await list(
      M.Notification,
      {
        recipientUserId: c.user._id,
        ...(q.unread === "true" ? { readAt: null } : {}),
      },
      c,
      q,
    ),
    data = [];
  for (const n of rows.data) if (await allowed(c, n)) data.push(n);
  return { ...rows, data };
}
export async function read(c, b, p) {
  const n = await get(M.Notification, p.notificationId, c);
  assert(await allowed(c, n), 404, "NOT_FOUND", "Notification unavailable.");
  n.readAt = new Date();
  return save(n, c);
}
export async function readAll(c, b) {
  let cursor,
    count = 0;
  do {
    const page = await notifications(c, { unread: "true", limit: 100, cursor });
    for (const n of page.data)
      if (!b.before || n.createdAt <= new Date(b.before)) {
        n.readAt = new Date();
        await save(n, c);
        count++;
      }
    cursor = page.page.nextCursor;
  } while (cursor);
  return { count };
}
async function dashboardContext(records, c) {
  const ids = key => records.map(record => record[key]).filter(Boolean);
  const [campaigns, brands] = await Promise.all([
    M.Campaign.find({ _id: { $in: ids("campaignId") } }).select("titleNormalized").session(c.session).lean(),
    M.Organization.find({ _id: { $in: ids("brandOrganizationId") } }).select("name").session(c.session).lean(),
  ]);
  const titles = new Map(campaigns.map(row => [String(row._id), row.titleNormalized]));
  const names = new Map(brands.map(row => [String(row._id), row.name]));
  return records.map(record => ({
    ...record.toJSON(),
    campaignTitle: titles.get(String(record.campaignId)),
    brandName: names.get(String(record.brandOrganizationId)),
  }));
}
export async function dashboard(c, kind) {
  if (kind === "creator") P.creator(c);
  if (["brand", "agency"].includes(kind)) {
    const { org } = P.chosen(c);
    assert(
      org.type === kind.toUpperCase(),
      403,
      "WORKSPACE",
      "Choose the matching workspace.",
    );
  }
  if (kind === "client-review") {
    assert(
      c.memberships.some((m) => m.role === "CLIENT_REVIEWER"),
      403,
      "REVIEWER_ONLY",
      "Client reviewer access required.",
    );
    const decided = await M.ApprovalDecision.distinct("clientApprovalId", { reviewerUserId: c.user._id }).session(c.session);
    const pending = await M.ClientApproval.find({
      $and: [
        P.filter(c, { creator: false }),
        { reviewerUserIds: c.user._id, state: "PENDING", _id: { $nin: decided } },
      ],
    }).sort({ createdAt: 1 }).limit(50).session(c.session);
    return { pendingApprovals: await dashboardContext(pending, c) };
  }
  const f = P.filter(c),
    rows = await M.Collaboration.aggregate([
      { $match: f },
      {
        $lookup: {
          from: M.Agreement.collection.name,
          localField: "agreementId",
          foreignField: "_id",
          as: "a",
        },
      },
      { $unwind: "$a" },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ["$workState", "COMPLETED"] }, 1, 0] },
          },
          grossMinor: { $sum: "$a.amountMinor" },
          feeMinor: { $sum: "$a.feeMinor" },
          netMinor: { $sum: "$a.creatorNetMinor" },
          heldMinor: {
            $sum: {
              $cond: [
                { $in: ["$fundingState", ["HELD", "REFUND_PENDING"]] },
                "$a.amountMinor",
                0,
              ],
            },
          },
          releasedMinor: {
            $sum: {
              $cond: [
                { $eq: ["$fundingState", "RELEASED"] },
                "$a.creatorNetMinor",
                0,
              ],
            },
          },
          refundPendingMinor: {
            $sum: {
              $cond: [
                { $eq: ["$fundingState", "REFUND_PENDING"] },
                "$a.amountMinor",
                0,
              ],
            },
          },
        },
      },
    ]).session(c.session),
    deadlines = await M.Collaboration.find({
      $and: [f, { workState: { $nin: ["COMPLETED", "REFUNDED"] } }],
    })
      .sort({ dueAt: 1 })
      .limit(12)
      .session(c.session);
  const actionStates = kind === "creator"
    ? ["PREPARATION", "REVISION_REQUESTED", "APPROVED"]
    : ["IN_REVIEW", "COMPLETION_REVIEW", "VERIFIED"];
  const actions = await M.Collaboration.find({ $and: [f, { workState: { $in: actionStates } }] })
    .sort({ dueAt: 1 }).limit(12).session(c.session);
  const [deadlineDetails, actionDetails] = await Promise.all([dashboardContext(deadlines, c), dashboardContext(actions, c)]);
  return {
    totals: rows[0] || {
      total: 0,
      completed: 0,
      grossMinor: 0,
      heldMinor: 0,
      releasedMinor: 0,
      feeMinor: 0,
      netMinor: 0,
      refundPendingMinor: 0,
    },
    activeCount: await M.Collaboration.countDocuments({
      $and: [
        f,
        { workState: { $nin: ["COMPLETED", "REFUNDED", "REFUND_PENDING"] } },
      ],
    }).session(c.session),
    campaignCount: await M.Campaign.countDocuments(
      P.filter(c, { campaign: true }),
    ).session(c.session),
    pendingApprovals: await M.ClientApproval.countDocuments({
      $and: [P.filter(c, { creator: false }), { state: "PENDING" }],
    }).session(c.session),
    deadlines: deadlineDetails,
    actions: actionDetails,
  };
}
export async function report(c, p, q) {
  let f = P.filter(c, { creator: false });
  if (p.campaignId) {
    await P.campaign(c, p.campaignId);
    assert(
      c.user.platformRole === "OWNER" || c.memberships.length,
      403,
      "REPORT_ACCESS",
      "Report access required.",
    );
    f = { $and: [f, { campaignId: p.campaignId }] };
  } else {
    const { org, m } = P.chosen(c);
    assert(
      org.type === "AGENCY" &&
        (m.role === "ORG_ADMIN" ||
          m.clientScopes.some((s) => same(s.clientBrandId, p.clientId))),
      403,
      "REPORT_SCOPE",
      "Client report unavailable.",
    );
    assert(
      await M.AgencyClient.exists({
        agencyOrganizationId: org._id,
        brandOrganizationId: p.clientId,
      }).session(c.session),
      404,
      "NOT_FOUND",
      "Client unavailable.",
    );
    f = { $and: [f, { brandOrganizationId: p.clientId }] };
  }
  if (q.from || q.to)
    f = {
      $and: [
        f,
        {
          createdAt: {
            ...(q.from ? { $gte: new Date(q.from) } : {}),
            ...(q.to ? { $lte: new Date(q.to) } : {}),
          },
        },
      ],
    };
  const deals = await M.Collaboration.find(f)
      .populate("agreementId")
      .session(c.session),
    rows = deals.map((d) => ({
      collaborationId: String(d._id),
      campaignId: String(d.campaignId || ""),
      brandOrganizationId: String(d.brandOrganizationId),
      creatorProfileId: String(d.creatorProfileId),
      dueAt: d.dueAt,
      state: d.workState,
      fundingState: d.fundingState,
      productState: d.productState,
      grossMinor: d.agreementId.amountMinor,
      feeMinor: d.agreementId.feeMinor,
      creatorNetMinor: d.agreementId.creatorNetMinor,
    })),
    charges = await M.AgencyCharge.find({
      $and: [
        P.filter(c, { creator: false }),
        p.campaignId
          ? { campaignId: p.campaignId }
          : { brandOrganizationId: p.clientId },
      ],
    }).session(c.session),
    totals = rows.reduce(
      (t, r) => ({
        grossMinor: t.grossMinor + r.grossMinor,
        feeMinor: t.feeMinor + r.feeMinor,
        creatorNetMinor: t.creatorNetMinor + r.creatorNetMinor,
        completed: t.completed + (r.state === "COMPLETED" ? 1 : 0),
      }),
      { grossMinor: 0, feeMinor: 0, creatorNetMinor: 0, completed: 0 },
    );
  return {
    totals: {
      ...totals,
      agencyChargesMinor: charges
        .filter((d) => d.state !== "WAIVED")
        .reduce((n, d) => n + d.agreedAmountMinor, 0),
    },
    rows,
    agencyCharges: charges,
  };
}
export async function audits(c, q) {
  let f = {};
  if (c.user.platformRole !== "OWNER") {
    const { org } = P.chosen(c);
    P.admin(c, org._id);
    f.organizationId = org._id;
  }
  for (const key of ["resourceId", "resourceType", "action", "actorUserId"])
    if (q[key]) f[key] = q[key];
  return list(M.AuditLog, f, c, q);
}
