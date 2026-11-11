import * as M from "../../models.js";
import { get, create, save, expected, same, assert } from "../../core/db.js";
import * as P from "../../core/policy.js";
import { event } from "../../core/events.js";
import { freeze, revisionHash } from "../campaigns/campaigns.service.js";
import { offerHash } from "../offers/offers.service.js";
import { hash } from "../../core/crypto.js";
export const contentHash = (v) =>
  hash({
    id: String(v._id),
    sequence: v.sequence,
    assetId: String(v.assetId || ""),
    externalUrl: v.externalUrl,
    title: v.title,
    note: v.note,
  });
export async function target(c, type, id, prepare = false) {
  if (type === "CAMPAIGN_REVISION") {
    let d = await M.Campaign.findById(id).session(c.session),
      v;
    if (d) {
      await P.commission(c, d);
      v = await freeze(c, d);
    } else {
      v = await get(M.CampaignRevision, id, c);
      d = await get(M.Campaign, v.campaignId, c);
      if (prepare) await P.commission(c, d);
    }
    assert(
      same(d.reviewRevisionId, v._id),
      409,
      "STALE_REVISION",
      "Brief revision changed.",
    );
    return {
      r: d,
      snapshot: v,
      id: v._id,
      version: v.revisionNumber,
      hash: revisionHash(v),
    };
  }
  if (type === "OFFER_REVISION") {
    const d = await get(M.Offer, id, c);
    if (prepare) await P.commission(c, d);
    assert(
      ["DRAFT", "CLIENT_REVIEW"].includes(d.state),
      409,
      "OFFER_STATE",
      "Only unsent offers can be reviewed.",
    );
    return {
      r: d,
      snapshot: d.revisions.at(-1),
      id: d._id,
      version: d.revisionNumber,
      hash: offerHash(d),
    };
  }
  const v = await get(M.ContentVersion, id, c),
    d = await get(M.Collaboration, v.collaborationId, c);
  if (prepare) await P.commission(c, d);
  assert(
    same(d.latestContentVersionId, v._id) && v.state === "SUBMITTED",
    409,
    "STALE_VERSION",
    "Only current submitted content can be reviewed.",
  );
  return {
    r: d,
    snapshot: v,
    id: v._id,
    version: v.sequence,
    hash: contentHash(v),
  };
}
async function reviewer(c, userId, r) {
  const u = await get(M.User, userId, c);
  assert(
    u.status === "ACTIVE",
    422,
    "REVIEWER_INACTIVE",
    "Reviewer is suspended.",
  );
  const ms = await M.Membership.find({
    userId,
    status: "ACTIVE",
    $or: [
      { organizationId: r.brandOrganizationId, role: "ORG_ADMIN" },
      { organizationId: r.agencyOrganizationId, role: "CLIENT_REVIEWER" },
    ],
  }).session(c.session);
  assert(
    ms.some(
      (m) =>
        same(m.organizationId, r.brandOrganizationId) ||
        P.hasScope(
          m,
          r.brandOrganizationId,
          P.campaignId(r),
          P.collaborationId(r),
        ),
    ),
    403,
    "REVIEWER_SCOPE",
    "Reviewer needs active access to this client and campaign.",
  );
}
export async function request(c, b) {
  const t = await target(c, b.targetType, b.targetId, true),
    d = t.r;
  assert(
    d.agencyOrganizationId,
    422,
    "AGENCY_REQUIRED",
    "Client sharing applies to agency work.",
  );
  if (b.targetVersion)
    assert(
      b.targetVersion === t.version,
      409,
      "STALE_VERSION",
      "Target changed.",
    );
  for (const id of b.reviewerUserIds) {
    assert(
      !same(id, c.user._id) &&
        !same(id, d.preparedByUserId || d.createdByUserId),
      422,
      "SELF_APPROVAL",
      "Assign an independent client representative.",
    );
    await reviewer(c, id, d);
  }
  await M.ClientApproval.updateMany(
    {
      targetType: b.targetType,
      targetId: t.id,
      state: { $in: ["PENDING", "APPROVED"] },
    },
    { $set: { state: "SUPERSEDED" } },
    { session: c.session },
  );
  const a = await create(
    M.ClientApproval,
    {
      targetType: b.targetType,
      targetId: t.id,
      targetVersion: t.version,
      targetHash: t.hash,
      brandOrganizationId: d.brandOrganizationId,
      agencyOrganizationId: d.agencyOrganizationId,
      campaignId: P.campaignId(d),
      collaborationId: P.collaborationId(d),
      requestedByUserId: c.user._id,
      reviewerUserIds: [...new Set(b.reviewerUserIds)],
      policy: b.policy,
      requestedAt: new Date(),
    },
    c,
  );
  if (["CAMPAIGN_REVISION", "OFFER_REVISION"].includes(b.targetType)) {
    d.state = "CLIENT_REVIEW";
    await save(d, c);
  }
  await event(c, "CLIENT_APPROVAL_REQUESTED", a, b.reviewerUserIds);
  return { approval: a, url: `${process.env.APP_ORIGIN}/#/approvals/${a._id}` };
}
export async function access(c, id) {
  const a = await get(M.ClientApproval, id, c);
  if (c.user.platformRole === "OWNER" || P.operator(c, a)) return a;
  assert(
    a.reviewerUserIds.some((id) => same(id, c.user._id)),
    404,
    "NOT_FOUND",
    "Review unavailable.",
  );
  await reviewer(c, c.user._id, a);
  return a;
}
export async function detail(c, id) {
  const a = await access(c, id);
  let snapshot;
  if (a.targetType === "CAMPAIGN_REVISION")
    snapshot = await get(M.CampaignRevision, a.targetId, c);
  else if (a.targetType === "CONTENT_VERSION")
    snapshot = await get(M.ContentVersion, a.targetId, c);
  else
    snapshot = (await get(M.Offer, a.targetId, c)).revisions.find(
      (r) => r.revisionNumber === a.targetVersion,
    );
  return {
    ...a.toJSON(),
    snapshot,
    decisions: await M.ApprovalDecision.find({ clientApprovalId: a._id })
      .populate("reviewerUserId", "name")
      .session(c.session),
  };
}
export async function decide(c, b, p) {
  const a = await access(c, p.approvalId);
  expected(a, b);
  assert(
    a.state === "PENDING",
    409,
    "APPROVAL_CLOSED",
    "Review request is closed.",
  );
  assert(
    a.reviewerUserIds.some((id) => same(id, c.user._id)) &&
      !same(a.requestedByUserId, c.user._id),
    403,
    "INDEPENDENT_REVIEWER",
    "Only an assigned independent reviewer can decide.",
  );
  const t = await target(c, a.targetType, a.targetId);
  assert(
    t.version === a.targetVersion &&
      t.hash === a.targetHash &&
      !same(t.r.preparedByUserId || t.r.createdByUserId, c.user._id),
    409,
    "STALE_OR_SELF_APPROVAL",
    "Target changed or reviewer prepared this work.",
  );
  await create(
    M.ApprovalDecision,
    {
      clientApprovalId: a._id,
      reviewerUserId: c.user._id,
      decision: b.decision,
      note: b.note,
      decidedAt: new Date(),
      targetVersion: a.targetVersion,
      targetHash: a.targetHash,
    },
    c,
  );
  const count = await M.ApprovalDecision.countDocuments({
    clientApprovalId: a._id,
    decision: "APPROVED",
  }).session(c.session);
  if (b.decision === "CHANGES_REQUESTED") a.state = "CHANGES_REQUESTED";
  else if (a.policy === "ANY_ASSIGNED" || count === a.reviewerUserIds.length)
    a.state = "APPROVED";
  await save(a, c);
  if (a.state === "CHANGES_REQUESTED" && a.targetType === "CAMPAIGN_REVISION") {
    t.r.state = "CHANGES_REQUESTED";
    await save(t.r, c);
  }
  await event(c, "CLIENT_DECISION_RECORDED", a, [a.requestedByUserId]);
  return a;
}
