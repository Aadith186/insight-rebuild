import { route } from "../../core/http.js";
import { z, id, str, url, date, version } from "../../core/validation.js";
import { list } from "../../core/db.js";
import { collab } from "../../core/policy.js";
import * as M from "../../models.js";
import * as S from "./products.service.js";
export const shipment = z
  .object({
    courier: str.max(200),
    trackingNumber: str.max(200),
    trackingUrl: url.optional(),
    expectedDeliveryAt: date,
    replacementForShipmentId: id.optional(),
    productIssueId: id.optional(),
  })
  .strict();
export function routes(r) {
  route(
    r,
    "get",
    "/collaborations/:collaborationId/product-package",
    null,
    async (c, b, p) => {
      const d = await collab(c, p.collaborationId);
      const pkg = await M.ProductPackage.findOne({
        collaborationId: p.collaborationId,
      }).session(c.session);
      if (pkg && (await import("../../core/policy.js")).party) {
        const role = await (await import("../../core/policy.js")).party(c, d);
        if (role === "REVIEWER") {
          const out = pkg.toJSON();
          delete out.deliveryAddress;
          delete out.addressSubmittedByUserId;
          return out;
        }
      }
      return pkg;
    },
  );
  route(
    r,
    "put",
    "/collaborations/:collaborationId/delivery-address",
    z
      .object({
        recipient: str,
        phone: str.max(40),
        line1: str,
        line2: z.string().optional(),
        city: str,
        state: str,
        postalCode: str.max(30),
        country: str.default("India"),
      })
      .strict(),
    S.address,
  );
  route(
    r,
    "get",
    "/collaborations/:collaborationId/shipments",
    null,
    async (c, b, p, q) => {
      await collab(c, p.collaborationId);
      return list(M.Shipment, { collaborationId: p.collaborationId }, c, q);
    },
  );
  route(
    r,
    "post",
    "/collaborations/:collaborationId/shipments",
    shipment,
    S.ship,
  );
  route(
    r,
    "patch",
    "/shipments/:shipmentId",
    shipment
      .omit({ replacementForShipmentId: true, productIssueId: true })
      .partial()
      .extend(version),
    S.tracking,
  );
  route(
    r,
    "post",
    "/shipments/:shipmentId/receipt",
    z.object({ confirmation: z.literal(true), note: str.optional() }).strict(),
    S.receipt,
  );
  route(
    r,
    "post",
    "/shipments/:shipmentId/issues",
    z
      .object({
        type: z.enum(["DAMAGED", "WRONG", "MISSING", "DELAYED"]),
        description: str,
        evidenceAssetIds: z.array(id).default([]),
      })
      .strict(),
    S.issue,
  );
  route(
    r,
    "get",
    "/collaborations/:collaborationId/product-issues",
    null,
    async (c, b, p, q) => {
      await collab(c, p.collaborationId);
      return list(M.ProductIssue, { collaborationId: p.collaborationId }, c, q);
    },
  );
  route(
    r,
    "post",
    "/product-issues/:issueId/resolve",
    z.object({ resolutionNote: str, receivedShipmentId: id }).strict(),
    S.resolve,
  );
  route(
    r,
    "get",
    "/collaborations/:collaborationId/product-questions",
    null,
    async (c, b, p, q) => {
      await collab(c, p.collaborationId);
      return list(
        M.ProductQuestion,
        { collaborationId: p.collaborationId },
        c,
        q,
      );
    },
  );
  route(
    r,
    "post",
    "/collaborations/:collaborationId/product-questions",
    z.object({ category: str, question: str }).strict(),
    S.ask,
  );
  route(
    r,
    "post",
    "/product-questions/:questionId/answers",
    z.object({ text: str }).strict(),
    S.answer,
  );
}
