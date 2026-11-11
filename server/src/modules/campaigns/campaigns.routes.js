import { route } from "../../core/http.js";
import {
  z,
  id,
  money,
  brief,
  version,
  command,
} from "../../core/validation.js";
import { get, list, same, assert } from "../../core/db.js";
import { campaign, operator } from "../../core/policy.js";
import * as M from "../../models.js";
import * as S from "./campaigns.service.js";
export const assignment = z.object({ ...version, membershipId: id }).strict();
export function routes(r) {
  route(r, "get", "/campaigns", null, (c, b, p, q) => S.search(c, q));
  route(
    r,
    "post",
    "/campaigns",
    z
      .object({
        brandOrganizationId: id,
        agencyClientId: id.optional(),
        ...brief,
        compensationBudgetMinor: money,
        serviceChargeMinor: money.default(0),
      })
      .strict(),
    S.add,
  );
  route(r, "get", "/campaigns/:campaignId", null, (c, b, p) =>
    S.detail(c, p.campaignId),
  );
  route(
    r,
    "patch",
    "/campaigns/:campaignId",
    z
      .object({
        ...version,
        ...Object.fromEntries(
          Object.entries(brief).map(([k, v]) => [k, v.optional()]),
        ),
        compensationBudgetMinor: money.optional(),
        serviceChargeMinor: money.optional(),
      })
      .strict(),
    S.update,
  );
  route(
    r,
    "get",
    "/campaigns/:campaignId/revisions",
    null,
    async (c, b, p, q) => {
      const d = await campaign(c, p.campaignId);
      return list(
        M.CampaignRevision,
        {
          campaignId: d._id,
          ...(c.creator && !c.organizationId && !operator(c, d)
            ? { _id: d.publishedRevisionId }
            : {}),
        },
        c,
        q,
      );
    },
  );
  route(
    r,
    "get",
    "/campaigns/:campaignId/revisions/:revisionId",
    null,
    async (c, b, p) => {
      const d = await campaign(c, p.campaignId);
      if (c.creator && !c.organizationId && !operator(c, d))
        assert(
          same(d.publishedRevisionId, p.revisionId),
          404,
          "NOT_FOUND",
          "Revision unavailable.",
        );
      return get(M.CampaignRevision, p.revisionId, c, { campaignId: d._id });
    },
  );
  route(r, "post", "/campaigns/:campaignId/submit", command, S.submit);
  route(r, "post", "/campaigns/:campaignId/close", command, S.close);
  route(r, "put", "/campaigns/:campaignId/assignment", assignment, S.assign);
  route(r, "delete", "/campaigns/:campaignId/assignment", null, (c, b, p) =>
    S.assign(c, b, p, true),
  );
}
