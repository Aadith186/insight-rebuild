import * as M from "../../models.js";
import { list, get, assert, same } from "../../core/db.js";
import { filter, party, campaign } from "../../core/policy.js";
export async function opportunities(c, q) {
  assert(
    c.user.platformRole !== "OWNER",
    403,
    "PARTICIPANT_ONLY",
    "Reviews belong to collaboration participants.",
  );
  const completed = await M.Collaboration.find({
    $and: [filter(c, { reviewers: false }), { workState: "COMPLETED" }],
  })
    .select("_id")
    .session(c.session);
  const reviewed = await M.Review.find({
    collaborationId: { $in: completed.map((x) => x._id) },
    reviewingParty: c.creator && !c.organizationId ? "CREATOR" : "COMMISSIONER",
  })
    .distinct("collaborationId")
    .session(c.session);
  const result = await list(
    M.Collaboration,
    {
      $and: [
        filter(c, { reviewers: false }),
        { workState: "COMPLETED", _id: { $nin: reviewed } },
      ],
    },
    c,
    q,
  );
  result.data = await Promise.all(
    result.data.map(async (d) => {
      const p = await get(M.CreatorProfile, d.creatorProfileId, c),
        u = await get(M.User, p.userId, c),
        b = await get(M.Organization, d.brandOrganizationId, c),
        a = await get(M.Agreement, d.agreementId, c);
      const cam = d.campaignId ? await get(M.Campaign, d.campaignId, c) : null;
      return {
        id: String(d._id),
        campaignId: d.campaignId,
        title:
          cam?.draft?.title || cam?.titleNormalized || "Direct collaboration",
        creatorName: u.name,
        creatorAvatarAssetId: p.avatarAssetId,
        creatorProfileId: d.creatorProfileId,
        brandName: b.name,
        brandOrganizationId: b._id,
        brandLogoAssetId: b.logoAssetId,
        amountMinor: a.amountMinor,
        completedAt: d.updatedAt,
        reviewingParty: await party(c, d, { write: true, reviewer: false }),
      };
    }),
  );
  return result;
}
export async function campaignReviews(c, id, q) {
  await campaign(c, id);
  const work = await M.Collaboration.find({
    campaignId: id,
    workState: "COMPLETED",
  })
    .distinct("_id")
    .session(c.session);
  const result = await list(
    M.Review,
    {
      collaborationId: { $in: work },
      reviewingParty: "CREATOR",
      campaignStars: { $exists: true },
    },
    c,
    q,
  );
  await M.Review.populate(result.data, {
    path: "reviewerUserId",
    select: "name",
  });
  return result;
}
export async function summary(c, type, id) {
  assert(
    ["CREATOR", "BRAND", "CAMPAIGN"].includes(type),
    422,
    "REVIEW_TARGET",
    "Choose a creator, brand or campaign.",
  );
  if (type === "CAMPAIGN") await campaign(c, id);
  else await get(type === "CREATOR" ? M.CreatorProfile : M.Organization, id, c);
  let match =
    type === "CAMPAIGN"
      ? {
          campaignId: id,
          reviewingParty: "CREATOR",
          campaignStars: { $exists: true },
        }
      : { targetType: type, targetId: id };
  const rows = await M.Review.find(match)
    .select("stars campaignStars")
    .session(c.session);
  const counts = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: rows.filter(
      (r) => (type === "CAMPAIGN" ? r.campaignStars : r.stars) === stars,
    ).length,
  }));
  return {
    count: rows.length,
    average: rows.length
      ? rows.reduce(
          (n, r) => n + (type === "CAMPAIGN" ? r.campaignStars : r.stars),
          0,
        ) / rows.length
      : 0,
    distribution: counts,
  };
}
