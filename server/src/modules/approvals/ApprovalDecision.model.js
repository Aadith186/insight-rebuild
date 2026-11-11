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
export const ApprovalDecision = define(
  "ApprovalDecision",
  {
    clientApprovalId: ref("ClientApproval", true),
    reviewerUserId: ref("User", true),
    decision: en("APPROVED|CHANGES_REQUESTED"),
    note: str(),
    decidedAt: Date,
    targetVersion: int(1),
    targetHash: String,
  },
  [[{ clientApprovalId: 1, reviewerUserId: 1 }, { unique: true }]],
);
