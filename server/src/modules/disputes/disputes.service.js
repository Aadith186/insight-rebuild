import * as M from "../../models.js";
import { get, create, save, expected, same, assert } from "../../core/db.js";
import { collab, party, owner } from "../../core/policy.js";
import { event } from "../../core/events.js";
import {
  release,
  refundObligation,
  stats,
} from "../finance/finance.service.js";
export async function checkEvidence(c, refs, d) {
  for (const r of refs) {
    if (r.type === "MESSAGE") {
      const m = await get(M.Message, r.resourceId, c),
        conv = await get(M.Conversation, m.conversationId, c);
      assert(
        same(conv.collaborationId, d._id) &&
          conv.contextType !== "CLIENT_REVIEW",
        422,
        "EVIDENCE_SCOPE",
        "Message must be in the shared collaboration.",
      );
    } else {
      const Model =
          r.type === "ASSET"
            ? M.MediaAsset
            : r.type === "VERSION"
              ? M.ContentVersion
              : M.Shipment,
        a = await get(Model, r.resourceId, c);
      assert(
        same(a.collaborationId, d._id),
        422,
        "EVIDENCE_SCOPE",
        "Evidence belongs to another collaboration.",
      );
      if (r.type === "ASSET") {
        assert(
          a.state === "READY",
          422,
          "ASSET_INVALID",
          "Evidence is unavailable.",
        );
        a.referenceCount++;
        await save(a, c);
      }
    }
  }
}
export async function open(c, b, p) {
  const d = await collab(c, p.collaborationId, {
    write: true,
    reviewer: false,
  });
  assert(
    !["COMPLETED", "REFUNDED", "REFUND_PENDING"].includes(d.workState),
    409,
    "DISPUTE_INELIGIBLE",
    "Work is not eligible for a dispute.",
  );
  await checkEvidence(c, b.evidenceRefs, d);
  const dispute = await create(
    M.Dispute,
    {
      collaborationId: d._id,
      openedByUserId: c.user._id,
      reason: b.reason,
      description: b.description,
      evidence: b.evidenceRefs,
    },
    c,
  );
  d.openDisputeId = dispute._id;
  await save(d, c);
  await event(
    c,
    "DISPUTE_OPENED",
    d,
    (await M.User.find({ platformRole: "OWNER" }).session(c.session)).map(
      (u) => u._id,
    ),
  );
  return dispute;
}
export async function detail(c, id) {
  const d = await get(M.Dispute, id, c);
  await collab(c, d.collaborationId);
  return d;
}
export async function append(c, b, p) {
  const d = await detail(c, p.disputeId),
    work = await collab(c, d.collaborationId, { reviewer: false });
  await party(c, work, { write: true, reviewer: false });
  assert(d.state === "OPEN", 409, "DISPUTE_CLOSED", "Case closed.");
  await checkEvidence(c, b.evidenceRefs, work);
  d.evidence.push(...b.evidenceRefs);
  await save(d, c);
  await event(c, "DISPUTE_EVIDENCE_ADDED", work);
  return d;
}
export async function resolve(c, b, p) {
  owner(c);
  const d = await get(M.Dispute, p.disputeId, c);
  expected(d, b);
  assert(d.state === "OPEN", 409, "DISPUTE_CLOSED", "Case already decided.");
  const work = await get(M.Collaboration, d.collaborationId, c);
  assert(
    same(work.openDisputeId, d._id),
    409,
    "DISPUTE_STATE",
    "Case is not current.",
  );
  if (b.decision === "RELEASE") await release(c, work, true);
  else await refundObligation(c, work, d);
  d.state = b.decision === "RELEASE" ? "RESOLVED_RELEASE" : "RESOLVED_REFUND";
  d.resolvedByUserId = c.user._id;
  d.decisionReason = b.reason;
  d.resolvedAt = new Date();
  await save(d, c);
  await event(c, "DISPUTE_RESOLVED", work);
  return d;
}
export async function review(c, b, p) {
  const d = await collab(c, p.collaborationId, {
    write: true,
    reviewer: false,
  });
  assert(
    d.workState === "COMPLETED",
    409,
    "SETTLEMENT_REQUIRED",
    "Reviews are available after settlement.",
  );
  const side = await party(c, d, { write: true, reviewer: false });
  if (b.campaignStars !== undefined || b.campaignFeedback)
    assert(
      side === "CREATOR" && d.campaignId,
      422,
      "CAMPAIGN_REVIEW",
      "Only a creator completing this campaign can rate its experience.",
    );
  const r = await create(
    M.Review,
    {
      collaborationId: d._id,
      campaignId: d.campaignId,
      campaignStars: b.campaignStars,
      campaignFeedback: b.campaignFeedback,
      reviewerName: c.user.name,
      reviewerUserId: c.user._id,
      reviewingParty: side === "CREATOR" ? "CREATOR" : "COMMISSIONER",
      targetType: side === "CREATOR" ? "BRAND" : "CREATOR",
      targetId: side === "CREATOR" ? d.brandOrganizationId : d.creatorProfileId,
      stars: b.stars,
      text: b.text,
    },
    c,
  );
  if (side !== "CREATOR") await stats(c, d.creatorProfileId);
  await event(c, "REVIEW_RECEIVED", d);
  return r;
}
