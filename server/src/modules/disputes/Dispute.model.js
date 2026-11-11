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
export const Dispute = define(
  "Dispute",
  {
    collaborationId: ref("Collaboration", true),
    openedByUserId: ref("User"),
    reason: String,
    description: str(),
    evidence: [evidence],
    state: en("OPEN|RESOLVED_RELEASE|RESOLVED_REFUND"),
    resolvedByUserId: ref("User"),
    decisionReason: str(),
    resolvedAt: Date,
  },
  [
    [
      { collaborationId: 1 },
      { unique: true, partialFilterExpression: { state: "OPEN" } },
    ],
  ],
);
