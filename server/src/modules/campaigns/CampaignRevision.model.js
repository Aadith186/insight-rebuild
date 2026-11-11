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
export const CampaignRevision = define(
  "CampaignRevision",
  {
    campaignId: ref("Campaign", true),
    revisionNumber: int(1),
    ...brief,
    formatSnapshot: format,
    preparedByUserId: ref("User"),
    frozenAt: Date,
  },
  [[{ campaignId: 1, revisionNumber: 1 }, { unique: true }]],
);
