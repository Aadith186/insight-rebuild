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
export const AgencyCharge = define(
  "AgencyCharge",
  {
    agencyOrganizationId: ref("Organization", true),
    brandOrganizationId: ref("Organization", true),
    campaignId: ref("Campaign"),
    collaborationId: ref("Collaboration"),
    kind: en("RETAINER|CAMPAIGN|DEAL"),
    agreedAmountMinor: int(),
    description: str(),
    state: en("AGREED|WAIVED|SETTLED"),
    externalReference: String,
    settledAt: Date,
  },
  [[{ agencyOrganizationId: 1, brandOrganizationId: 1, state: 1 }, {}]],
);
