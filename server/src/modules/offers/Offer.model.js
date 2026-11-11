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
export const Offer = define(
  "Offer",
  {
    campaignId: ref("Campaign"),
    applicationId: ref("Application"),
    brandOrganizationId: ref("Organization", true),
    agencyOrganizationId: ref("Organization"),
    creatorProfileId: ref("CreatorProfile", true),
    preparedByUserId: ref("User"),
    state: en("DRAFT|CLIENT_REVIEW|SENT|WITHDRAWN|DECLINED|ACCEPTED"),
    revisionNumber: int(1),
    revisions: [sub({ revisionNumber: int(1), ...terms })],
    sentRevisionNumber: Number,
    sentAt: Date,
    decisionAt: Date,
  },
  [
    [{ creatorProfileId: 1, state: 1, sentAt: -1 }, {}],
    [{ brandOrganizationId: 1, state: 1 }, {}],
  ],
);
