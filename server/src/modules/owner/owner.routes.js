import { search as searchCampaigns } from "../campaigns/campaigns.service.js";
import { route } from "../../core/http.js";
import { z, str, version } from "../../core/validation.js";
import { list } from "../../core/db.js";
import { owner } from "../../core/policy.js";
import * as M from "../../models.js";
import * as S from "./owner.service.js";
import * as F from "../finance/finance.service.js";
import { reason, transfer } from "../finance/finance.routes.js";
import * as D from "../disputes/disputes.service.js";
import { audits } from "../activity/activity.service.js";
const format = z
  .object({
    key: z.string().regex(/^[A-Z_]{2,80}$/),
    label: str.max(200),
    compensationPolicy: z.enum(["REQUIRED", "ZERO", "OPTIONAL"]),
    productPolicy: z.enum(["REQUIRED", "OPTIONAL", "NONE"]),
    completionMode: z.enum(["PUBLISH", "HANDOVER", "EITHER"]),
  })
  .strict();
export function routes(r) {
  route(r, "get", "/owner/dashboard", null, S.dashboard);
  route(r, "get", "/owner/members", null, (c, b, p, q) => S.members(c, q));
  route(r, "get", "/owner/members/:memberId", null, (c, b, p, q) =>
    S.memberDetails(c, p.memberId, q.memberType),
  );
  route(
    r,
    "post",
    "/owner/members/:memberId/verification",
    z
      .object({
        memberType: z.enum(["CREATOR", "ORGANIZATION"]),
        status: z.enum(["PENDING", "VERIFIED", "REJECTED"]),
        expectedVersion: version.expectedVersion.optional(),
        reason: str,
      })
      .strict(),
    (c, b, p) => S.memberDecision(c, b, p, "verification"),
  );
  for (const a of ["suspension", "restoration"])
    route(
      r,
      "post",
      `/owner/members/:memberId/${a}`,
      z
        .object({
          memberType: z.enum(["USER", "CREATOR", "ORGANIZATION"]),
          expectedVersion: version.expectedVersion.optional(),
          reason: str,
        })
        .strict(),
      (c, b, p) => S.memberDecision(c, b, p, a),
    );
  route(r, "get", "/owner/campaign-reviews", null, (c, b, p, q) => {
    owner(c);
    return searchCampaigns(c, { ...q, status: q.state || "PLATFORM_REVIEW" });
  });
  route(
    r,
    "post",
    "/owner/campaign-reviews/:revisionId/decisions",
    z
      .object({
        ...version,
        decision: z.enum(["APPROVE", "REJECT", "REQUEST_CHANGES"]),
        reason: str,
      })
      .strict(),
    S.moderate,
  );
  route(r, "get", "/owner/fundings", null, (c, b, p, q) => {
    owner(c);
    return list(M.Funding, q.state ? { state: q.state } : {}, c, q);
  });
  route(
    r,
    "post",
    "/owner/fundings/:fundingId/verify",
    z
      .object({ ...version, verificationReference: str, note: str.optional() })
      .strict(),
    F.verifyFunding,
    { idempotent: true },
  );
  route(r, "post", "/owner/fundings/:fundingId/reject", reason, (c, b, p) =>
    F.verifyFunding(c, b, p, true),
  );
  route(r, "get", "/owner/withdrawals", null, (c, b, p, q) => {
    owner(c);
    return list(M.Withdrawal, q.state ? { state: q.state } : {}, c, q);
  });
  route(
    r,
    "post",
    "/owner/withdrawals/:withdrawalId/process",
    z.object(version).strict(),
    (c, b, p) => F.payout(c, b, p, "process"),
  );
  route(
    r,
    "post",
    "/owner/withdrawals/:withdrawalId/complete",
    transfer,
    (c, b, p) => F.payout(c, b, p, "complete"),
    { idempotent: true },
  );
  route(
    r,
    "post",
    "/owner/withdrawals/:withdrawalId/reject",
    reason,
    (c, b, p) => F.payout(c, b, p, "reject"),
    { idempotent: true },
  );
  route(r, "get", "/owner/refunds", null, (c, b, p, q) => {
    owner(c);
    return list(M.Refund, q.state ? { state: q.state } : {}, c, q);
  });
  route(
    r,
    "post",
    "/owner/refunds/:refundId/process",
    z.object(version).strict(),
    (c, b, p) => F.refundTransfer(c, b, p, "process"),
  );
  route(
    r,
    "post",
    "/owner/refunds/:refundId/complete",
    transfer,
    (c, b, p) => F.refundTransfer(c, b, p, "complete"),
    { idempotent: true },
  );
  route(
    r,
    "post",
    "/owner/disputes/:disputeId/resolve",
    z
      .object({
        ...version,
        decision: z.enum(["RELEASE", "REFUND"]),
        reason: str,
      })
      .strict(),
    D.resolve,
    { idempotent: true },
  );
  route(r, "get", "/owner/revenue", null, (c, b, p, q) => S.revenue(c, q));
  route(r, "get", "/owner/settings", null, S.settings);
  route(
    r,
    "put",
    "/owner/settings",
    z
      .object({
        ...version,
        commissionBps: z.number().int().min(0).max(10000).optional(),
        fundingInstructions: z
          .object({
            bankName: z.string().optional(),
            accountName: z.string().optional(),
            accountNumber: z.string().optional(),
            ifsc: z.string().optional(),
            upiId: z.string().optional(),
            note: z.string().optional(),
          })
          .strict().optional(),
        supportContact: z
          .object({
            email: z.string().email().optional(),
            phone: z.string().optional(),
          })
          .strict().optional(),
      })
      .strict().refine(b => b.commissionBps !== undefined || b.fundingInstructions || b.supportContact, "Choose settings to update."),
    S.updateSettings,
  );
  route(r, "get", "/owner/collaboration-formats", null, (c, b, p, q) => {
    owner(c);
    return list(M.CollaborationFormat, {}, c, q);
  });
  route(r, "post", "/owner/collaboration-formats", format, (c, b, p) =>
    S.format(c, b, p, "create"),
  );
  route(
    r,
    "patch",
    "/owner/collaboration-formats/:formatId",
    format.omit({ key: true }).partial().extend(version),
    (c, b, p) => S.format(c, b, p, "update"),
  );
  route(
    r,
    "post",
    "/owner/collaboration-formats/:formatId/deactivate",
    reason,
    (c, b, p) => S.format(c, b, p, "deactivate"),
  );
  route(r, "get", "/owner/audit-logs", null, (c, b, p, q) => {
    owner(c);
    return audits(c, q);
  });
}
