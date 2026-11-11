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
export const Refund = define(
  "Refund",
  {
    collaborationId: ref("Collaboration", true),
    disputeId: ref("Dispute", true),
    brandOrganizationId: ref("Organization", true),
    amountMinor: int(1),
    state: en("PENDING|PROCESSING|PAID"),
    transferReference: String,
    processedByUserId: ref("User"),
    processedAt: Date,
  },
  [
    [{ collaborationId: 1, disputeId: 1 }, { unique: true }],
    [{ transferReference: 1 }, { unique: true, sparse: true }],
  ],
);
