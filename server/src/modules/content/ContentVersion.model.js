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
export const ContentVersion = define(
  "ContentVersion",
  {
    collaborationId: ref("Collaboration", true),
    sequence: int(1),
    assetId: ref("MediaAsset"),
    externalUrl: String,
    title: String,
    note: str(),
    submittedByUserId: ref("User"),
    submittedAt: Date,
    state: en("SUBMITTED|CHANGES_REQUESTED|APPROVED|SUPERSEDED"),
  },
  [[{ collaborationId: 1, sequence: 1 }, { unique: true }]],
);
