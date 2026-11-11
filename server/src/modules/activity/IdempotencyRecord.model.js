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
export const IdempotencyRecord = define(
  "IdempotencyRecord",
  {
    actorUserId: ref("User", true),
    scope: String,
    key: String,
    requestHash: String,
    state: en("IN_PROGRESS|COMPLETE"),
    responseBodyJson: String,
    expiresAt: Date,
  },
  [
    [{ actorUserId: 1, scope: 1, key: 1 }, { unique: true }],
    [{ expiresAt: 1 }, { expireAfterSeconds: 0 }],
  ],
);
