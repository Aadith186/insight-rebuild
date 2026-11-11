import mongoose from "mongoose";
import {
  define,
  ref,
  str,
  int,
  en,
  sub,
  product,
  deliverable,
  rights,
  audience,
  scope,
  format,
  brief,
  terms,
  evidence,
} from "../../core/schema.js";
export const Collaboration = define(
  "Collaboration",
  {
    agreementId: ref("Agreement", true),
    campaignId: ref("Campaign"),
    brandOrganizationId: ref("Organization", true),
    agencyOrganizationId: ref("Organization"),
    creatorProfileId: ref("CreatorProfile", true),
    assignedMembershipId: ref("Membership"),
    dueAt: Date,
    workState: en(
      "PREPARATION|IN_REVIEW|REVISION_REQUESTED|APPROVED|COMPLETION_REVIEW|VERIFIED|COMPLETED|REFUND_PENDING|REFUNDED",
    ),
    fundingState: en(
      "NOT_REQUIRED|AWAITING|HELD|RELEASED|REFUND_PENDING|REFUNDED",
    ),
    productState: en(
      "NOT_REQUIRED|ADDRESS_REQUIRED|AWAITING_SHIPMENT|SHIPPED|ISSUE|RECEIVED",
    ),
    openDisputeId: ref("Dispute"),
    latestContentVersionId: ref("ContentVersion"),
    approvedContentVersionId: ref("ContentVersion"),
    completionId: ref("CompletionSubmission"),
    contentSequence: int(),
    completionSequence: int(),
    revisionCount: int(),
  },
  [
    [{ agreementId: 1 }, { unique: true }],
    [{ creatorProfileId: 1, workState: 1, dueAt: 1 }, {}],
    [{ agencyOrganizationId: 1, workState: 1, dueAt: 1 }, {}],
    [{ brandOrganizationId: 1, workState: 1, dueAt: 1 }, {}],
  ],
);
