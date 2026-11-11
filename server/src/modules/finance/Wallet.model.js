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
export const Wallet = define(
  "Wallet",
  {
    ownerType: en("CREATOR|BRAND|PLATFORM"),
    ownerId: { type: mongoose.Schema.Types.ObjectId, required: true },
    currency: en("INR"),
    availableMinor: int(),
    reservedMinor: int(),
    heldMinor: int(),
  },
  [[{ ownerType: 1, ownerId: 1, currency: 1 }, { unique: true }]],
);
