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
export const Session = define(
  "Session",
  {
    userId: ref("User", true),
    refreshTokenHash: { type: String, select: false },
    expiresAt: Date,
    revokedAt: Date,
    userAgent: str(400),
  },
  [
    [{ expiresAt: 1 }, { expireAfterSeconds: 0 }],
    [{ userId: 1, revokedAt: 1 }, {}],
  ],
);
