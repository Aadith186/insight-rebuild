import * as M from "../../models.js";
import { get, create, save, expected, same, assert } from "../../core/db.js";
import { collab, party } from "../../core/policy.js";
import { event } from "../../core/events.js";
import { ownAsset } from "../creators/creators.service.js";
import { approved } from "../campaigns/campaigns.service.js";
import { contentHash } from "../approvals/approvals.service.js";
export function videoURL(s) {
  const u = new URL(s);
  return (
    u.protocol === "https:" &&
    ([
      "youtube.com",
      "www.youtube.com",
      "youtu.be",
      "vimeo.com",
      "www.vimeo.com",
      "player.vimeo.com",
    ].includes(u.hostname) ||
      /\.(mp4|webm)$/i.test(u.pathname))
  );
}
export async function version(c, id, opts = {}) {
  const v = await get(M.ContentVersion, id, c),
    d = await collab(c, v.collaborationId, opts);
  return { v, d };
}
export async function submit(c, b, p) {
  const d = await collab(c, p.collaborationId, {
    write: true,
    creatorOnly: true,
  });
  expected(d, b);
  assert(
    ["PREPARATION", "REVISION_REQUESTED"].includes(d.workState),
    409,
    "CONTENT_STATE",
    "Submit the first cut or a requested revision.",
  );
  assert(
    ["HELD", "NOT_REQUIRED"].includes(d.fundingState),
    409,
    "FUNDING_REQUIRED",
    "Wait for verified funding.",
  );
  assert(
    ["RECEIVED", "NOT_REQUIRED"].includes(d.productState),
    409,
    "PRODUCT_RECEIPT",
    "Confirm valid product receipt.",
  );
  if (b.assetId) {
    const a = await ownAsset(c, b.assetId, "CONTENT");
    assert(
      same(a.collaborationId, d._id) && a.mime.startsWith("video/"),
      422,
      "VIDEO_SCOPE",
      "Choose a video for this collaboration.",
    );
  } else
    assert(
      videoURL(b.externalUrl),
      422,
      "VIDEO_URL",
      "Use YouTube, Vimeo, or a direct HTTPS MP4/WebM link.",
    );
  d.contentSequence++;
  const v = await create(
    M.ContentVersion,
    {
      collaborationId: d._id,
      sequence: d.contentSequence,
      assetId: b.assetId,
      externalUrl: b.externalUrl,
      title: b.title,
      note: b.note,
      submittedByUserId: c.user._id,
      submittedAt: new Date(),
    },
    c,
  );
  if (d.latestContentVersionId) {
    await M.ContentVersion.updateOne(
      { _id: d.latestContentVersionId },
      { $set: { state: "SUPERSEDED" } },
      { session: c.session },
    );
    await M.ClientApproval.updateMany(
      {
        targetType: "CONTENT_VERSION",
        targetId: d.latestContentVersionId,
        state: { $in: ["PENDING", "APPROVED"] },
      },
      { $set: { state: "SUPERSEDED" } },
      { session: c.session },
    );
  }
  await M.RevisionRequest.updateMany(
    { collaborationId: d._id, state: "REQUESTED" },
    { $set: { state: "DELIVERED" } },
    { session: c.session },
  );
  d.latestContentVersionId = v._id;
  d.approvedContentVersionId = undefined;
  d.workState = "IN_REVIEW";
  await save(d, c);
  await event(c, "CONTENT_SUBMITTED", d);
  return v;
}
export async function comment(c, b, p) {
  const { v, d } = await version(c, p.contentVersionId);
  assert(
    c.user.platformRole !== "OWNER",
    403,
    "OWNER_OVERSIGHT",
    "Owners inspect rather than creatively approve work.",
  );
  await party(c, d);
  if (b.timestampMs !== undefined && v.assetId) {
    const a = await get(M.MediaAsset, v.assetId, c);
    assert(
      b.timestampMs <= a.durationMs,
      422,
      "TIMESTAMP",
      "Timestamp exceeds video duration.",
    );
  }
  if (b.parentCommentId)
    await get(M.ContentComment, b.parentCommentId, c, {
      contentVersionId: v._id,
    });
  const result = await create(
    M.ContentComment,
    {
      ...b,
      collaborationId: d._id,
      contentVersionId: v._id,
      authorUserId: c.user._id,
      authorName: c.user.name,
    },
    c,
  );
  await event(c, "CONTENT_COMMENT", d);
  return result;
}
export async function revision(c, b, p) {
  const { v, d } = await version(c, p.contentVersionId, {
    write: true,
    commissioner: true,
  });
  expected(v, b);
  assert(
    same(d.latestContentVersionId, v._id) && v.state === "SUBMITTED",
    409,
    "LATEST_VERSION",
    "Request revisions on the current submitted cut.",
  );
  assert(
    !(await M.RevisionRequest.exists({
      collaborationId: d._id,
      state: { $in: ["PROPOSED", "ACCEPTED", "REQUESTED"] },
    }).session(c.session)),
    409,
    "REVISION_PENDING",
    "Finish the pending round first.",
  );
  const a = await get(M.Agreement, d.agreementId, c);
  if (b.kind === "INCLUDED")
    assert(
      d.revisionCount < a.includedRevisions,
      409,
      "REVISION_LIMIT",
      "Included rounds exhausted. Propose an additional round.",
    );
  const count = await M.RevisionRequest.countDocuments({
      collaborationId: d._id,
    }).session(c.session),
    r = await create(
      M.RevisionRequest,
      {
        collaborationId: d._id,
        contentVersionId: v._id,
        requestedByUserId: c.user._id,
        roundNumber: count + 1,
        kind: b.kind,
        feedback: b.feedback,
        state: b.kind === "INCLUDED" ? "ACCEPTED" : "PROPOSED",
      },
      c,
    );
  d.updatedAt = new Date();
  d.markModified("updatedAt");
  await save(d, c);
  await event(c, "REVISION_PROPOSED", d);
  return r;
}
export async function consent(c, b, p) {
  const r = await get(M.RevisionRequest, p.revisionRequestId, c),
    d = await collab(c, r.collaborationId, { write: true, creatorOnly: true });
  assert(
    r.kind === "ADDITIONAL" && r.state === "PROPOSED",
    409,
    "REVISION_STATE",
    "This round is not awaiting consent.",
  );
  r.state = b.accept ? "ACCEPTED" : "DECLINED";
  r.creatorDecisionAt = new Date();
  r.decisionByUserId = c.user._id;
  await save(r, c);
  await event(c, "REVISION_CONSENT", d);
  return r;
}
export async function requestWork(c, b, p) {
  const r = await get(M.RevisionRequest, p.revisionRequestId, c),
    d = await collab(c, r.collaborationId, { write: true, commissioner: true });
  expected(r, b);
  assert(
    r.state === "ACCEPTED" &&
      same(d.latestContentVersionId, r.contentVersionId),
    409,
    "CONSENT_REQUIRED",
    "This current round needs acceptance.",
  );
  const a = await get(M.Agreement, d.agreementId, c);
  if (r.kind === "INCLUDED") {
    assert(
      d.revisionCount < a.includedRevisions,
      409,
      "REVISION_LIMIT",
      "Allowance exhausted.",
    );
    d.revisionCount++;
  }
  r.state = "REQUESTED";
  d.workState = "REVISION_REQUESTED";
  await save(r, c);
  await save(d, c);
  await M.ContentVersion.updateOne(
    { _id: r.contentVersionId },
    { $set: { state: "CHANGES_REQUESTED" } },
    { session: c.session },
  );
  await event(c, "REVISION_REQUESTED", d);
  return r;
}
export async function approve(c, b, p) {
  const { v, d } = await version(c, p.contentVersionId, {
    write: true,
    commissioner: true,
  });
  expected(v, b);
  assert(
    same(d.latestContentVersionId, v._id) && v.state === "SUBMITTED",
    409,
    "CURRENT_CONTENT",
    "Approve the current submitted cut.",
  );
  assert(
    !(await M.RevisionRequest.exists({
      collaborationId: d._id,
      state: { $in: ["PROPOSED", "ACCEPTED", "REQUESTED"] },
    }).session(c.session)),
    409,
    "REVISION_PENDING",
    "Resolve pending revision rounds.",
  );
  if (d.agencyOrganizationId)
    await approved(c, "CONTENT_VERSION", v._id, v.sequence, contentHash(v));
  v.state = "APPROVED";
  await save(v, c);
  d.approvedContentVersionId = v._id;
  d.workState = "APPROVED";
  await save(d, c);
  await event(c, "CONTENT_APPROVED", d);
  return v;
}
