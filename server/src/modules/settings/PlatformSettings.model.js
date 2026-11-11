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
export const PlatformSettings = define(
  "PlatformSettings",
  {
    version: int(1),
    commissionBps: int(0, 10000),
    fundingInstructions: sub({
      bankName: String,
      accountName: String,
      accountNumber: String,
      ifsc: String,
      upiId: String,
      note: String,
    }),
    supportContact: sub({ email: String, phone: String }),
    changedByUserId: ref("User"),
    effectiveAt: Date,
  },
  [[{ version: 1 }, { unique: true }]],
);
