import { describeCampaignReferences } from "../../core/list-presentation.js";
import { route } from "../../core/http.js";
import { z, str, money, command, version } from "../../core/validation.js";
import { list } from "../../core/db.js";
import { creator, campaign } from "../../core/policy.js";
import * as M from "../../models.js";
import * as S from "./applications.service.js";
export function routes(r) {
  route(
    r,
    "post",
    "/campaigns/:campaignId/applications",
    z.object({ pitch: str, proposedRateMinor: money }).strict(),
    S.add,
  );
  route(r, "get", "/me/applications", null, async (c, b, p, q) =>
    describeCampaignReferences(await list(
      M.Application,
      { creatorProfileId: creator(c)._id, ...(q.state ? { state: q.state } : {}) },
      c,
      q,
    ), c, { pitches: true }),
  );
  route(
    r,
    "get",
    "/campaigns/:campaignId/applications",
    null,
    async (c, b, p, q) => {
      await campaign(c, p.campaignId, c.user.platformRole !== "OWNER");
      const result = await list(
        M.Application,
        { campaignId: p.campaignId, ...(q.state ? { state: q.state } : {}) },
        c,
        q,
      );
      result.data = await Promise.all(
        result.data.map(async (a) => ({
          ...a.toJSON(),
          creator: await M.CreatorProfile.findById(a.creatorProfileId)
            .populate("userId", "name")
            .session(c.session),
        })),
      );
      return result;
    },
  );
  route(r, "get", "/applications/:applicationId", null, (c, b, p) =>
    S.detail(c, p.applicationId),
  );
  route(
    r,
    "post",
    "/applications/:applicationId/withdraw",
    z.object(version).strict(),
    (c, b, p) => S.decide(c, b, p, true),
  );
  route(r, "post", "/applications/:applicationId/decline", command, S.decide);
}
