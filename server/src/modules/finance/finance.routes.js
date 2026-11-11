import { route } from "../../core/http.js";
import { z, id, str, money, date, version } from "../../core/validation.js";
import { get, list } from "../../core/db.js";
import * as P from "../../core/policy.js";
import { sendCSV } from "../../core/csv.js";
import * as M from "../../models.js";
import * as S from "./finance.service.js";
export const reason = z.object({ ...version, reason: str }).strict(),
  transfer = z
    .object({ ...version, actualTransferReference: str.max(200), paidAt: date })
    .strict();
export function routes(r) {
  route(r, "get", "/wallets/me", null, S.summary);
  route(r, "get", "/ledger", null, (c, b, p, q) =>
    S.scoped(c, M.LedgerTransaction, q),
  );
  route(r, "get", "/ledger/export", null, async (c, b, p, q) => {
    const rows = [];
    let cursor;
    do {
      const page = await S.scoped(c, M.LedgerTransaction, {
        ...q,
        limit: 100,
        cursor,
      });
      rows.push(
        ...page.data.map((d) => ({
          id: String(d._id),
          kind: d.kind,
          collaborationId: d.collaborationId,
          entries: d.entries,
          createdAt: d.createdAt,
        })),
      );
      cursor = page.page.nextCursor;
    } while (cursor);
    sendCSV(c, "insight-ledger.csv", rows);
  });
  route(
    r,
    "get",
    "/collaborations/:collaborationId/fundings",
    null,
    async (c, b, p, q) => {
      await P.collab(c, p.collaborationId, { reviewer: false });
      return list(M.Funding, { collaborationId: p.collaborationId }, c, q);
    },
  );
  route(
    r,
    "post",
    "/collaborations/:collaborationId/fundings",
    z
      .object({
        amountMinor: money.refine((n) => n > 0),
        rail: z.enum(["BANK", "UPI"]),
        externalReference: str.max(200),
        proofAssetId: id.optional(),
      })
      .strict(),
    S.funding,
    { idempotent: true },
  );
  route(r, "get", "/me/withdrawals", null, (c, b, p, q) =>
    list(M.Withdrawal, { creatorProfileId: P.creator(c)._id }, c, q),
  );
  route(
    r,
    "post",
    "/me/withdrawals",
    z
      .object({
        amountMinor: money.refine((n) => n > 0),
        destination: z.discriminatedUnion("type", [
          z
            .object({
              type: z.literal("UPI"),
              upiId: z.string().regex(/^[\w.\-]+@[\w]+$/),
            })
            .strict(),
          z
            .object({
              type: z.literal("BANK"),
              accountName: str,
              accountNumber: z.string().regex(/^\d{6,30}$/),
              ifsc: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/),
            })
            .strict(),
        ]),
      })
      .strict(),
    S.withdrawal,
    { idempotent: true },
  );
  route(r, "get", "/withdrawals/:withdrawalId", null, (c, b, p) =>
    S.withdrawalDetail(c, p.withdrawalId),
  );
  route(r, "get", "/refunds", null, (c, b, p, q) => S.scoped(c, M.Refund, q));
  route(r, "get", "/refunds/:refundId", null, async (c, b, p) => {
    const d = await get(M.Refund, p.refundId, c);
    await P.collab(c, d.collaborationId);
    return d;
  });
  route(r, "get", "/agency-charges", null, (c, b, p, q) =>
    list(M.AgencyCharge, P.filter(c, { creator: false }), c, q),
  );
  route(
    r,
    "post",
    "/agency-charges",
    z
      .object({
        clientId: id,
        campaignId: id.optional(),
        collaborationId: id.optional(),
        kind: z.enum(["RETAINER", "CAMPAIGN", "DEAL"]),
        amountMinor: money,
        description: str,
      })
      .strict(),
    S.charge,
  );
  route(
    r,
    "post",
    "/agency-charges/:chargeId/settle",
    z.object({ ...version, externalReference: str, settledAt: date }).strict(),
    S.chargeDecision,
  );
  route(r, "post", "/agency-charges/:chargeId/waive", reason, (c, b, p) =>
    S.chargeDecision(c, b, p, true),
  );
}
