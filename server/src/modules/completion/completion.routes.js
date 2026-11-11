import { route } from "../../core/http.js";
import { z, id, str, date, url, version } from "../../core/validation.js";
import { list } from "../../core/db.js";
import { collab } from "../../core/policy.js";
import * as M from "../../models.js";
import * as S from "./completion.service.js";
export function routes(r) {
  route(
    r,
    "get",
    "/collaborations/:collaborationId/completion-submissions",
    null,
    async (c, b, p, q) => {
      await collab(c, p.collaborationId);
      return list(
        M.CompletionSubmission,
        { collaborationId: p.collaborationId },
        c,
        q,
      );
    },
  );
  route(
    r,
    "post",
    "/collaborations/:collaborationId/completion-submissions",
    z
      .object({
        mode: z.enum(["PUBLISHED", "HANDOVER"]),
        platform: str.optional(),
        url,
        completedAt: date,
        approvedContentVersionId: id,
      })
      .strict(),
    S.submit,
  );
  route(
    r,
    "post",
    "/completion-submissions/:completionId/verify",
    z.object({ ...version, confirmationNote: str }).strict(),
    S.decide,
  );
  route(
    r,
    "post",
    "/completion-submissions/:completionId/request-correction",
    z.object({ ...version, reason: str }).strict(),
    (c, b, p) => S.decide(c, b, p, true),
  );
  route(
    r,
    "post",
    "/collaborations/:collaborationId/settlements",
    z.object(version).strict(),
    S.settle,
    { idempotent: true },
  );
}
