import { describeCampaignReferences } from "../../core/list-presentation.js";
import { route } from "../../core/http.js";
import { z, id } from "../../core/validation.js";
import { get, list, same, assert } from "../../core/db.js";
import * as P from "../../core/policy.js";
import * as M from "../../models.js";
async function context(c, brand) {
  const { org } = P.chosen(c),
    scope = await P.clientContext(c, brand || c.clientId || org._id);
  return {
    ownerOrganizationId: org._id,
    clientBrandOrganizationId: scope.brandOrganizationId,
  };
}
export function routes(r) {
  route(r, "get", "/shortlist-entries", null, async (c, b, p, q) => {
    const result = await list(
      M.ShortlistEntry,
      await context(c, q.clientBrandId),
      c,
      q,
    );
    result.data = await Promise.all(
      result.data.map(async (d) => ({
        ...d.toJSON(),
        creator: await M.CreatorProfile.findById(d.creatorProfileId)
          .populate("userId", "name")
          .session(c.session),
      })),
    );
    return result;
  });
  route(
    r,
    "post",
    "/shortlist-entries",
    z.object({ creatorProfileId: id, clientBrandId: id.optional() }).strict(),
    async (c, b) => {
      await get(M.CreatorProfile, b.creatorProfileId, c);
      return M.ShortlistEntry.findOneAndUpdate(
        {
          ...(await context(c, b.clientBrandId)),
          creatorProfileId: b.creatorProfileId,
        },
        { $setOnInsert: { addedByUserId: c.user._id } },
        { upsert: true, new: true, session: c.session },
      );
    },
  );
  route(r, "delete", "/shortlist-entries/:entryId", null, async (c, b, p) => {
    const d = await get(M.ShortlistEntry, p.entryId, c),
      scope = await context(c, d.clientBrandOrganizationId);
    assert(
      same(scope.ownerOrganizationId, d.ownerOrganizationId),
      404,
      "NOT_FOUND",
      "Entry unavailable.",
    );
    await d.deleteOne({ session: c.session });
  });
  route(r, "get", "/me/saved-campaigns", null, async (c, b, p, q) => {
    const result = await list(
      M.SavedCampaign,
      { creatorProfileId: P.creator(c)._id },
      c,
      q,
    );
    return describeCampaignReferences(result, c);
  });
  route(
    r,
    "post",
    "/me/saved-campaigns",
    z.object({ campaignId: id }).strict(),
    async (c, b) => {
      await P.campaign(c, b.campaignId);
      return M.SavedCampaign.findOneAndUpdate(
        { creatorProfileId: P.creator(c)._id, campaignId: b.campaignId },
        { $setOnInsert: { savedAt: new Date() } },
        { upsert: true, new: true, session: c.session },
      );
    },
  );
  route(
    r,
    "delete",
    "/me/saved-campaigns/:campaignId",
    null,
    async (c, b, p) => {
      await M.SavedCampaign.deleteOne(
        { creatorProfileId: P.creator(c)._id, campaignId: p.campaignId },
        { session: c.session },
      );
    },
  );
}
