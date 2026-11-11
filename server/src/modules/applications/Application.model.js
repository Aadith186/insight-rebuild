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
export const Application = define(
  "Application",
  {
    campaignId: ref("Campaign", true),
    campaignRevisionId: ref("CampaignRevision", true),
    creatorProfileId: ref("CreatorProfile", true),
    pitch: str(),
    proposedRateMinor: int(),
    state: en("PENDING|OFFERED|ACCEPTED|DECLINED|WITHDRAWN"),
    decidedByUserId: ref("User"),
    decisionReason: str(),
  },
  [
    [
      { campaignId: 1, creatorProfileId: 1 },
      {
        unique: true,
        partialFilterExpression: {
          state: { $in: ["PENDING", "OFFERED", "ACCEPTED"] },
        },
      },
    ],
  ],
);
