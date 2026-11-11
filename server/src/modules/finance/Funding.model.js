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
export const Funding = define(
  "Funding",
  {
    collaborationId: ref("Collaboration", true),
    brandOrganizationId: ref("Organization", true),
    submittedByUserId: ref("User"),
    amountMinor: int(1),
    currency: en("INR"),
    rail: en("BANK|UPI"),
    externalReference: String,
    externalReferenceNormalized: String,
    proofAssetId: ref("MediaAsset"),
    state: en("SUBMITTED|VERIFIED|REJECTED"),
    reviewedByUserId: ref("User"),
    reviewNote: String,
    verificationReference: String,
    verifiedAt: Date,
  },
  [
    [
      { rail: 1, externalReferenceNormalized: 1 },
      { unique: true, partialFilterExpression: { state: "VERIFIED" } },
    ],
  ],
);
