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
export const CollaborationFormat = define(
  "CollaborationFormat",
  {
    key: String,
    label: String,
    compensationPolicy: en("REQUIRED|ZERO|OPTIONAL"),
    productPolicy: en("REQUIRED|OPTIONAL|NONE"),
    completionMode: en("PUBLISH|HANDOVER|EITHER"),
    active: { type: Boolean, default: true },
    version: int(1),
  },
  [[{ key: 1 }, { unique: true }]],
);
