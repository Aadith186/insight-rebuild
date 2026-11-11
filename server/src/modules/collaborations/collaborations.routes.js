import { describeWorkPage } from "../../core/list-presentation.js";
import { route } from "../../core/http.js";
import { get, list } from "../../core/db.js";
import * as P from "../../core/policy.js";
import * as M from "../../models.js";
import { assignment } from "../campaigns/campaigns.routes.js";
import { assign } from "../campaigns/campaigns.service.js";
export function routes(r) {
  route(r, "get", "/collaborations", null, async (c, b, p, q) => {
    let f = P.filter(c);
    for (const key of ["campaignId", "workState"])
      if (q[key === "workState" ? "state" : key])
        f = { $and: [f, { [key]: q[key === "workState" ? "state" : key] }] };
    if (q.dueFrom || q.dueTo)
      f = {
        $and: [
          f,
          {
            dueAt: {
              ...(q.dueFrom ? { $gte: new Date(q.dueFrom) } : {}),
              ...(q.dueTo ? { $lte: new Date(q.dueTo) } : {}),
            },
          },
        ],
      };
    return describeWorkPage(await list(M.Collaboration, f, c, q), c, {
      agreements: true,
    });
  });
  route(r, "get", "/collaborations/:collaborationId", null, async (c, b, p) => {
    const d = await P.collab(c, p.collaborationId);
    const { data: [work] } = await describeWorkPage({ data: [d] }, c);
    return {
      ...work,
      agreement: await get(M.Agreement, d.agreementId, c),
      party: await P.party(c, d),
      eligibleReviewers: await P.eligibleReviewers(c, d),
    };
  });
  route(
    r,
    "get",
    "/collaborations/:collaborationId/activity",
    null,
    async (c, b, p, q) => {
      await P.collab(c, p.collaborationId);
      return list(M.AuditLog, { collaborationId: p.collaborationId }, c, q);
    },
  );
  route(
    r,
    "put",
    "/collaborations/:collaborationId/assignment",
    assignment,
    assign,
  );
  route(
    r,
    "delete",
    "/collaborations/:collaborationId/assignment",
    null,
    (c, b, p) => assign(c, b, p, true),
  );
  route(
    r,
    "get",
    "/collaborations/:collaborationId/agreement",
    null,
    async (c, b, p) => {
      const d = await P.collab(c, p.collaborationId);
      return get(M.Agreement, d.agreementId, c);
    },
  );
}
