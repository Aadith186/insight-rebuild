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
export const Shipment = define(
  "Shipment",
  {
    productPackageId: ref("ProductPackage", true),
    collaborationId: ref("Collaboration", true),
    productIssueId: ref("ProductIssue"),
    replacementForShipmentId: ref("Shipment"),
    courier: String,
    trackingNumber: String,
    trackingUrl: String,
    expectedDeliveryAt: Date,
    state: en("DISPATCHED|RECEIVED|ISSUE"),
    events: [
      sub({ kind: String, note: String, actorUserId: ref("User"), at: Date }),
    ],
    receivedByUserId: ref("User"),
    receivedAt: Date,
  },
  [[{ collaborationId: 1, createdAt: -1 }, {}]],
);
