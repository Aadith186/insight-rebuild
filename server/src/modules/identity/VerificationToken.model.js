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
export const VerificationToken = define(
  "VerificationToken",
  {
    userId: ref("User", true),
    purpose: en("VERIFY_EMAIL|RESET_PASSWORD"),
    tokenHash: { type: String, select: false },
    expiresAt: Date,
    consumedAt: Date,
  },
  [
    [{ tokenHash: 1 }, { unique: true }],
    [{ expiresAt: 1 }, { expireAfterSeconds: 0 }],
  ],
);
