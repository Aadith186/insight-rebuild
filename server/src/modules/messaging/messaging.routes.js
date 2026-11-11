import { route } from "../../core/http.js";
import { z, id, str } from "../../core/validation.js";
import { list } from "../../core/db.js";
import { filter } from "../../core/policy.js";
import * as M from "../../models.js";
import * as S from "./messaging.service.js";
export function routes(r) {
  route(r, "get", "/inbox/summary", null, (c) => S.unreadSummary(c));
  route(r, "get", "/conversations", null, (c, b, p, q) => S.inbox(c, q));
  route(
    r,
    "post",
    "/conversations",
    z
      .object({
        contextType: z.enum([
          "DIRECT",
          "CAMPAIGN",
          "COLLABORATION",
          "CLIENT_REVIEW",
        ]),
        contextId: id.optional(),
        creatorProfileId: id.optional(),
        brandOrganizationId: id.optional(),
      })
      .strict(),
    S.open,
  );
  route(r, "get", "/conversations/:conversationId", null, async (c, b, p) =>
    S.describe(c, await S.access(c, p.conversationId)),
  );
  route(
    r,
    "get",
    "/conversations/:conversationId/messages",
    null,
    async (c, b, p, q) => {
      await S.access(c, p.conversationId);
      return list(M.Message, { conversationId: p.conversationId }, c, {
        ...q,
        cursor: q.before || q.cursor,
      });
    },
  );
  route(
    r,
    "post",
    "/conversations/:conversationId/messages",
    z
      .object({
        text: str.optional(),
        attachmentAssetIds: z.array(id).max(10).default([]),
        clientMessageId: str.max(100),
      })
      .strict(),
    S.message,
  );
  route(
    r,
    "post",
    "/conversations/:conversationId/read",
    z.object({ lastMessageId: id }).strict(),
    S.read,
  );
}
