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
export const Membership = define(
  "Membership",
  {
    userId: ref("User", true),
    organizationId: ref("Organization", true),
    role: en("ORG_ADMIN|CAMPAIGN_MANAGER|CLIENT_REVIEWER"),
    status: en("ACTIVE|REVOKED"),
    clientScopes: [scope],
  },
  [
    [{ userId: 1, organizationId: 1 }, { unique: true }],
    [{ organizationId: 1, status: 1 }, {}],
  ],
);
