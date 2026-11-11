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
export const ProductIssue = define(
  "ProductIssue",
  {
    collaborationId: ref("Collaboration", true),
    shipmentId: ref("Shipment", true),
    type: en("DAMAGED|WRONG|MISSING|DELAYED"),
    description: str(),
    evidenceAssetIds: [ref("MediaAsset")],
    reportedByUserId: ref("User"),
    state: en("OPEN|REPLACEMENT_SENT|RESOLVED"),
    resolutionNote: str(),
  },
  [[{ collaborationId: 1, state: 1 }, {}]],
);
