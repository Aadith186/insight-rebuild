import { route } from "../../core/http.js";
import { z, str, id, money, version } from "../../core/validation.js";
import { list, save } from "../../core/db.js";
import { admin } from "../../core/policy.js";
import * as M from "../../models.js";
import * as S from "./organizations.service.js";
import { projects } from "../creators/creators.service.js";
export const fields = {
  name: str.max(200),
  description: str.optional(),
  city: str.max(100).optional(),
  contactPhone: str.max(40).optional(),
  contactEmail: z.string().email().optional(),
  website: z.string().url().optional(),
  logoAssetId: id.optional(),
};
const optional = Object.fromEntries(
  Object.entries(fields).map(([k, v]) => [k, v.optional()]),
);
export function routes(r) {
  route(r, "get", "/organizations/:organizationId", null, (c, b, p) =>
    S.profile(c, p.organizationId),
  );
  route(
    r,
    "patch",
    "/organizations/:organizationId",
    z.object({ ...version, ...optional }).strict(),
    S.update,
  );
  route(
    r,
    "get",
    "/organizations/:organizationId/projects",
    null,
    (c, b, p, q) => projects(c, p.organizationId, "BRAND", q),
  );
  route(
    r,
    "get",
    "/organizations/:organizationId/reviews",
    null,
    (c, b, p, q) =>
      list(M.Review, { targetType: "BRAND", targetId: p.organizationId }, c, q),
  );
  route(r, "get", "/agencies/:agencyId/clients", null, (c, b, p, q) =>
    S.clients(c, p, q),
  );
  route(
    r,
    "post",
    "/agencies/:agencyId/clients",
    z
      .object({
        ...fields,
        brandOrganizationId: id.optional(),
        budgetMinor: money,
        retainerChargeMinor: money,
        contactUserIds: z.array(id).default([]),
      })
      .strict(),
    S.add,
  );
  route(
    r,
    "get",
    "/agencies/:agencyId/clients/:clientId",
    null,
    async (c, b, p) => {
      const d = await S.client(c, p);
      return {
        ...d.toJSON(),
        brand: await S.profile(c, d.brandOrganizationId),
      };
    },
  );
  route(
    r,
    "patch",
    "/agencies/:agencyId/clients/:clientId",
    z
      .object({
        ...version,
        ...optional,
        budgetMinor: money.optional(),
        retainerChargeMinor: money.optional(),
        contactUserIds: z.array(id).optional(),
      })
      .strict(),
    S.edit,
  );
  route(
    r,
    "post",
    "/agencies/:agencyId/clients/:clientId/archive",
    z.object({ reason: str }).strict(),
    async (c, b, p) => {
      admin(c, p.agencyId);
      const d = await S.client(c, p);
      d.status = "ARCHIVED";
      await save(d, c);
      await import("../../core/events.js").then((m) =>
        m.event(c, "CLIENT_ARCHIVED", d),
      );
      return d;
    },
  );
}
