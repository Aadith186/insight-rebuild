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
export const LedgerTransaction = define(
  "LedgerTransaction",
  {
    kind: en(
      "FUNDING|RELEASE|WITHDRAWAL_RESERVATION|PAYOUT|RESERVATION_REVERSAL|REFUND_OBLIGATION|REFUND_TRANSFER",
    ),
    sourceId: { type: mongoose.Schema.Types.ObjectId, required: true },
    collaborationId: ref("Collaboration"),
    currency: en("INR"),
    entries: [
      sub({
        accountCode: String,
        ownerId: { type: mongoose.Schema.Types.ObjectId },
        debitMinor: int(),
        creditMinor: int(),
      }),
    ],
  },
  [[{ kind: 1, sourceId: 1 }, { unique: true }]],
);
