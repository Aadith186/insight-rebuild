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
export const Agreement = define(
  "Agreement",
  {
    offerId: ref("Offer", true),
    campaignId: ref("Campaign"),
    acceptedOfferRevision: int(1),
    brandOrganizationId: ref("Organization", true),
    agencyOrganizationId: ref("Organization"),
    creatorProfileId: ref("CreatorProfile", true),
    ...terms,
    acceptedByUserId: ref("User"),
    acceptedAt: Date,
  },
  [[{ offerId: 1 }, { unique: true }]],
);
