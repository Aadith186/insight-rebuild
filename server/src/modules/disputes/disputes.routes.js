import { route } from "../../core/http.js";
import { z, str, evidence } from "../../core/validation.js";
import { list } from "../../core/db.js";
import { collab, filter } from "../../core/policy.js";
import * as M from "../../models.js";
import * as S from "./disputes.service.js";
import * as Reviews from "./reviews.service.js";
export function routes(r) {
  route(r, "get", "/me/review-opportunities", null, (c, b, p, q) =>
    Reviews.opportunities(c, q),
  );
  route(r, "get", "/campaigns/:campaignId/reviews", null, (c, b, p, q) =>
    Reviews.campaignReviews(c, p.campaignId, q),
  );
  route(r, "get", "/review-summaries/:targetId", null, (c, b, p, q) =>
    Reviews.summary(c, q.type || "CREATOR", p.targetId),
  );
  route(r, "get", "/disputes", null, async (c, b, p, q) =>
    list(
      M.Dispute,
      {
        collaborationId: {
          $in: await M.Collaboration.find(filter(c))
            .distinct("_id")
            .session(c.session),
        },
        ...(q.state ? { state: q.state } : {}),
      },
      c,
      q,
    ),
  );
  route(
    r,
    "post",
    "/collaborations/:collaborationId/disputes",
    z
      .object({
        reason: str,
        description: str,
        evidenceRefs: evidence.default([]),
      })
      .strict(),
    S.open,
  );
  route(r, "get", "/disputes/:disputeId", null, (c, b, p) =>
    S.detail(c, p.disputeId),
  );
  route(
    r,
    "post",
    "/disputes/:disputeId/evidence",
    z.object({ evidenceRefs: evidence, note: str.optional() }).strict(),
    S.append,
  );
  route(
    r,
    "get",
    "/collaborations/:collaborationId/reviews",
    null,
    async (c, b, p, q) => {
      await collab(c, p.collaborationId);
      return list(M.Review, { collaborationId: p.collaborationId }, c, q);
    },
  );
  route(
    r,
    "post",
    "/collaborations/:collaborationId/reviews",
    z
      .object({
        stars: z.number().int().min(1).max(5),
        text: str,
        campaignStars: z.number().int().min(1).max(5).optional(),
        campaignFeedback: str.optional(),
      })
      .strict(),
    S.review,
  );
}
