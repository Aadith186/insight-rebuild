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
export const Invitation = define(
  "Invitation",
  {
    organizationId: ref("Organization", true),
    emailNormalized: str(320),
    role: en("ORG_ADMIN|CAMPAIGN_MANAGER|CLIENT_REVIEWER"),
    clientScopes: [scope],
    tokenHash: { type: String, select: false },
    expiresAt: Date,
    invitedByUserId: ref("User"),
    acceptedByUserId: ref("User"),
    status: en("PENDING|ACCEPTED|DECLINED|REVOKED|EXPIRED"),
  },
  [[{ tokenHash: 1 }, { unique: true }]],
);
