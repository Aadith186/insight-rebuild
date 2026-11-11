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
export const ShortlistEntry = define(
  "ShortlistEntry",
  {
    ownerOrganizationId: ref("Organization", true),
    clientBrandOrganizationId: ref("Organization", true),
    creatorProfileId: ref("CreatorProfile", true),
    addedByUserId: ref("User"),
  },
  [
    [
      {
        ownerOrganizationId: 1,
        clientBrandOrganizationId: 1,
        creatorProfileId: 1,
      },
      { unique: true },
    ],
  ],
);
