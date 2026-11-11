import * as M from "../../models.js";
import { get, create, save, expected, same, assert } from "../../core/db.js";
import { collab } from "../../core/policy.js";
import { event } from "../../core/events.js";
import { release } from "../finance/finance.service.js";
export async function submit(c, b, p) {
  const d = await collab(c, p.collaborationId, {
    write: true,
    creatorOnly: true,
  });
  assert(
    d.workState === "APPROVED" &&
      same(d.approvedContentVersionId, b.approvedContentVersionId),
    409,
    "APPROVAL_REQUIRED",
    "Complete the exact approved cut.",
  );
  const a = await get(M.Agreement, d.agreementId, c),
    mode = a.formatSnapshot.completionMode;
  assert(
    mode === "EITHER" ||
      (mode === "PUBLISH" && b.mode === "PUBLISHED") ||
      (mode === "HANDOVER" && b.mode === "HANDOVER"),
    422,
    "COMPLETION_MODE",
    "Use the agreed completion method.",
  );
  assert(
    new Date(b.completedAt) <= new Date(),
    422,
    "COMPLETION_DATE",
    "Completion cannot be in the future.",
  );
  d.completionSequence++;
  const v = await create(
    M.CompletionSubmission,
    {
      ...b,
      collaborationId: d._id,
      attemptNumber: d.completionSequence,
      submittedByUserId: c.user._id,
    },
    c,
  );
  d.completionId = v._id;
  d.workState = "COMPLETION_REVIEW";
  await save(d, c);
  await event(c, "COMPLETION_SUBMITTED", d);
  return v;
}
export async function decide(c, b, p, correction = false) {
  const v = await get(M.CompletionSubmission, p.completionId, c),
    d = await collab(c, v.collaborationId, { write: true, commissioner: true });
  expected(v, b);
  assert(
    v.state === "PENDING" &&
      same(d.completionId, v._id) &&
      same(d.approvedContentVersionId, v.approvedContentVersionId),
    409,
    "COMPLETION_STATE",
    "Not the current pending completion.",
  );
  v.state = correction ? "CHANGES_REQUESTED" : "VERIFIED";
  v.reviewNote = b.reason || b.confirmationNote;
  v.checkedByUserId = c.user._id;
  d.workState = correction ? "APPROVED" : "VERIFIED";
  await save(v, c);
  await save(d, c);
  await event(
    c,
    correction ? "COMPLETION_CORRECTION" : "COMPLETION_VERIFIED",
    d,
  );
  return v;
}
export async function settle(c, b, p) {
  const d = await collab(c, p.collaborationId, {
    write: true,
    commissioner: true,
  });
  expected(d, b);
  return release(c, d);
}
