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
export const ProductPackage = define(
  "ProductPackage",
  {
    collaborationId: ref("Collaboration", true),
    agreedItems: [product],
    retailValueMinor: int(),
    deliveryAddress: sub({
      recipient: String,
      phone: String,
      line1: String,
      line2: String,
      city: String,
      state: String,
      postalCode: String,
      country: String,
    }),
    addressSubmittedByUserId: ref("User"),
  },
  [[{ collaborationId: 1 }, { unique: true }]],
);
