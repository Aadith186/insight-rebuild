import * as M from "../../models.js";
import { get, create, save, expected, same, assert } from "../../core/db.js";
import { creator, campaign } from "../../core/policy.js";
import { event } from "../../core/events.js";
export async function add(c, b, p) {
  const cp = creator(c),
    d = await campaign(c, p.campaignId);
  assert(
    d.state === "PUBLISHED" &&
      d.applicationDeadline > new Date() &&
      d.reservedSpots < d.spots,
    409,
    "APPLICATIONS_CLOSED",
    "Campaign is not accepting pitches.",
  );
  const a = await create(
    M.Application,
    {
      ...b,
      campaignId: d._id,
      campaignRevisionId: d.publishedRevisionId,
      creatorProfileId: cp._id,
    },
    c,
  );
  await event(c, "PITCH_RECEIVED", {
    ...a.toObject(),
    resourceType: "Application",
    brandOrganizationId: d.brandOrganizationId,
    agencyOrganizationId: d.agencyOrganizationId,
  });
  return a;
}
export async function detail(c, id) {
  const a = await get(M.Application, id, c);
  if (
    c.user.platformRole === "OWNER" ||
    same(c.creator?._id, a.creatorProfileId)
  )
    return a;
  await campaign(c, a.campaignId, true);
  return a;
}
export async function decide(c, b, p, withdraw = false) {
  const a = await detail(c, p.applicationId);
  expected(a, b);
  if (withdraw)
    assert(
      same(c.creator?._id, a.creatorProfileId),
      403,
      "CREATOR_ONLY",
      "Only the creator may withdraw.",
    );
  else await campaign(c, a.campaignId, true);
  assert(
    a.state === "PENDING",
    409,
    "APPLICATION_STATE",
    "Only pending applications can change.",
  );
  a.state = withdraw ? "WITHDRAWN" : "DECLINED";
  a.decisionReason = b.reason;
  a.decidedByUserId = c.user._id;
  await save(a, c);
  const d = await get(M.Campaign, a.campaignId, c);
  await event(c, "PITCH_" + a.state, {
    ...a.toObject(),
    resourceType: "Application",
    brandOrganizationId: d.brandOrganizationId,
    agencyOrganizationId: d.agencyOrganizationId,
  });
  return a;
}
