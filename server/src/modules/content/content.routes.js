import { route } from "../../core/http.js";
import { z, id, str, url, version } from "../../core/validation.js";
import { list } from "../../core/db.js";
import { collab } from "../../core/policy.js";
import * as M from "../../models.js";
import * as S from "./content.service.js";
export function routes(r) {
  route(
    r,
    "get",
    "/collaborations/:collaborationId/content-versions",
    null,
    async (c, b, p, q) => {
      await collab(c, p.collaborationId);
      return list(
        M.ContentVersion,
        { collaborationId: p.collaborationId },
        c,
        q,
      );
    },
  );
  route(
    r,
    "post",
    "/collaborations/:collaborationId/content-versions",
    z
      .object({
        ...version,
        assetId: id.optional(),
        externalUrl: url.optional(),
        title: str.max(200),
        note: str.optional(),
      })
      .strict()
      .refine(
        (b) => !!b.assetId !== !!b.externalUrl,
        "Choose an upload or external URL.",
      ),
    S.submit,
  );
  route(
    r,
    "get",
    "/content-versions/:contentVersionId",
    null,
    async (c, b, p) => {
      const { v, d } = await S.version(c, p.contentVersionId);
      const [revisionRequests, clientSignoff] = await Promise.all([
        M.RevisionRequest.find({ contentVersionId: v._id }).session(c.session),
        d.agencyOrganizationId
          ? M.ClientApproval.findOne({ targetType: "CONTENT_VERSION", targetId: v._id, targetVersion: v.sequence })
            .sort({ createdAt: -1 }).select("state").session(c.session).lean()
          : null,
      ]);
      return { ...v.toJSON(), revisionRequests, clientSignoff: clientSignoff?.state || null };
    },
  );
  route(
    r,
    "get",
    "/content-versions/:contentVersionId/comments",
    null,
    async (c, b, p, q) => {
      await S.version(c, p.contentVersionId);
      return list(
        M.ContentComment,
        { contentVersionId: p.contentVersionId },
        c,
        q,
      );
    },
  );
  route(
    r,
    "post",
    "/content-versions/:contentVersionId/comments",
    z
      .object({
        text: str.max(5000),
        timestampMs: z.number().int().min(0).max(86400000).optional(),
        parentCommentId: id.optional(),
      })
      .strict(),
    S.comment,
  );
  route(
    r,
    "post",
    "/content-versions/:contentVersionId/revision-requests",
    z
      .object({
        ...version,
        feedback: str,
        kind: z.enum(["INCLUDED", "ADDITIONAL"]),
      })
      .strict(),
    S.revision,
  );
  route(
    r,
    "post",
    "/revision-requests/:revisionRequestId/decision",
    z.object({ accept: z.boolean(), note: str.optional() }).strict(),
    S.consent,
  );
  route(
    r,
    "post",
    "/revision-requests/:revisionRequestId/request-work",
    z.object(version).strict(),
    S.requestWork,
  );
  route(
    r,
    "post",
    "/content-versions/:contentVersionId/approve",
    z.object(version).strict(),
    S.approve,
  );
}
