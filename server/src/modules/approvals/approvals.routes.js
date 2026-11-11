import { route } from "../../core/http.js";
import { z, id, str, version } from "../../core/validation.js";
import { list, save } from "../../core/db.js";
import { filter, commission } from "../../core/policy.js";
import * as M from "../../models.js";
import * as S from "./approvals.service.js";
export function routes(r) {
  route(r, "get", "/client-approvals", null, (c, b, p, q) =>
    list(
      M.ClientApproval,
      {
        $and: [
          {
            $or: [
              { reviewerUserIds: c.user._id },
              filter(c, { creator: false }),
            ],
          },
          ...(q.state ? [{ state: q.state }] : []),
        ],
      },
      c,
      q,
    ),
  );
  route(
    r,
    "post",
    "/client-approvals",
    z
      .object({
        targetType: z.enum([
          "CAMPAIGN_REVISION",
          "OFFER_REVISION",
          "CONTENT_VERSION",
        ]),
        targetId: id,
        targetVersion: z.number().int().positive().optional(),
        reviewerUserIds: z.array(id).min(1).max(20),
        policy: z
          .enum(["ANY_ASSIGNED", "ALL_ASSIGNED"])
          .default("ANY_ASSIGNED"),
      })
      .strict(),
    S.request,
  );
  route(r, "get", "/client-approvals/:approvalId", null, (c, b, p) =>
    S.detail(c, p.approvalId),
  );
  route(
    r,
    "post",
    "/client-approvals/:approvalId/decisions",
    z
      .object({
        ...version,
        decision: z.enum(["APPROVED", "CHANGES_REQUESTED"]),
        note: str,
      })
      .strict(),
    S.decide,
  );
  route(
    r,
    "post",
    "/client-approvals/:approvalId/cancel",
    z.object({ reason: str }).strict(),
    async (c, b, p) => {
      const d = await S.access(c, p.approvalId);
      await commission(c, d);
      d.state = "SUPERSEDED";
      return save(d, c);
    },
  );
}
