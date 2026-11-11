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
export const PortfolioItem = define(
  "PortfolioItem",
  {
    creatorProfileId: ref("CreatorProfile", true),
    title: str(200),
    description: str(),
    assetId: ref("MediaAsset"),
    externalVideoUrl: String,
    brandOrganizationId: ref("Organization"),
    brandName: str(200),
    evidenceUrl: String,
    displayOrder: int(),
    publishedAt: Date,
  },
  [[{ creatorProfileId: 1, displayOrder: 1 }, {}]],
);
