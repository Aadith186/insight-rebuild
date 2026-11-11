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
export const AgencyClient = define(
  "AgencyClient",
  {
    agencyOrganizationId: ref("Organization", true),
    brandOrganizationId: ref("Organization", true),
    contactUserIds: [ref("User")],
    budgetMinor: int(),
    committedMinor: int(),
    retainerChargeMinor: int(),
    status: en("ACTIVE|ARCHIVED"),
  },
  [[{ agencyOrganizationId: 1, brandOrganizationId: 1 }, { unique: true }]],
);
