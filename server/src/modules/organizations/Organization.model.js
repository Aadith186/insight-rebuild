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
export const Organization = define(
  "Organization",
  {
    type: en("BRAND|AGENCY"),
    name: str(200),
    nameNormalized: str(200),
    description: str(),
    city: str(100),
    contactPhone: str(40),
    contactEmail: str(320),
    website: str(1500),
    logoAssetId: ref("MediaAsset"),
    verificationStatus: en("PENDING|VERIFIED|REJECTED"),
    suspendedAt: Date,
  },
  [
    [{ type: 1, verificationStatus: 1 }, {}],
    [{ nameNormalized: 1, city: 1 }, {}],
  ],
);
