import { route } from "../../core/http.js";
import { z, str, version, scopes } from "../../core/validation.js";
import { get, list, save } from "../../core/db.js";
import { admin } from "../../core/policy.js";
import * as M from "../../models.js";
import * as S from "./access.service.js";
const grants = {
  role: z.enum(["ORG_ADMIN", "CAMPAIGN_MANAGER", "CLIENT_REVIEWER"]),
  clientScopes: scopes,
};
export function routes(r) {
  route(
    r,
    "get",
    "/organizations/:organizationId/members",
    null,
    async (c, b, p, q) => {
      admin(c, p.organizationId);
      const result = await list(
        M.Membership,
        { organizationId: p.organizationId },
        c,
        q,
      );
      await M.Membership.populate(result.data, {
        path: "userId",
        select: "name email",
      });
      return result;
    },
  );
  route(
    r,
    "patch",
    "/memberships/:membershipId",
    z.object({ ...version, ...grants }).strict(),
    S.update,
  );
  route(
    r,
    "post",
    "/memberships/:membershipId/revoke",
    z.object({ reason: str }).strict(),
    S.revoke,
  );
  route(
    r,
    "get",
    "/organizations/:organizationId/invitations",
    null,
    (c, b, p, q) => {
      admin(c, p.organizationId);
      return list(M.Invitation, { organizationId: p.organizationId }, c, q);
    },
  );
  route(
    r,
    "post",
    "/organizations/:organizationId/invitations",
    z.object({ ...grants, email: z.string().email() }).strict(),
    S.invite,
  );
  route(
    r,
    "get",
    "/invitations/:token",
    null,
    async (c, b, p) => {
      const i = await S.lookup(c, p.token),
        o = await get(M.Organization, i.organizationId, c);
      return {
        organizationName: o.name,
        email: i.emailNormalized,
        role: i.role,
        expiresAt: i.expiresAt,
      };
    },
    { public: true },
  );
  route(r, "post", "/invitations/:token/accept", null, S.accept);
  route(r, "post", "/invitations/:token/decline", null, (c, b, p) =>
    S.accept(c, b, p, true),
  );
  route(
    r,
    "post",
    "/invitations/:invitationId/revoke",
    z.object({ reason: str }).strict(),
    async (c, b, p) => {
      const i = await get(M.Invitation, p.invitationId, c);
      admin(c, i.organizationId);
      i.status = "REVOKED";
      return save(i, c);
    },
  );
}
