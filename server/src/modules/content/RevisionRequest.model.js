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
export const RevisionRequest = define(
  "RevisionRequest",
  {
    collaborationId: ref("Collaboration", true),
    contentVersionId: ref("ContentVersion", true),
    requestedByUserId: ref("User"),
    roundNumber: int(1),
    kind: en("INCLUDED|ADDITIONAL"),
    feedback: str(),
    state: en("PROPOSED|ACCEPTED|DECLINED|REQUESTED|DELIVERED"),
    creatorDecisionAt: Date,
    decisionByUserId: ref("User"),
  },
  [[{ collaborationId: 1, roundNumber: 1 }, {}]],
);
