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
export const SavedCampaign = define(
  "SavedCampaign",
  {
    creatorProfileId: ref("CreatorProfile", true),
    campaignId: ref("Campaign", true),
    savedAt: Date,
  },
  [[{ creatorProfileId: 1, campaignId: 1 }, { unique: true }]],
);
