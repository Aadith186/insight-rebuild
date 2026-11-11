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
export const Withdrawal = define(
  "Withdrawal",
  {
    creatorProfileId: ref("CreatorProfile", true),
    walletId: ref("Wallet", true),
    amountMinor: int(1),
    destinationEncrypted: { type: String, select: false },
    destinationMasked: String,
    state: en("REQUESTED|PROCESSING|PAID|REJECTED"),
    transferReference: String,
    processedByUserId: ref("User"),
    rejectionReason: String,
    requestedAt: Date,
    paidAt: Date,
  },
  [
    [{ transferReference: 1 }, { unique: true, sparse: true }],
    [{ state: 1, requestedAt: 1 }, {}],
  ],
);
