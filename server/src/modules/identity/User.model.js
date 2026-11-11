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
export const User = define(
  "User",
  {
    email: str(320),
    emailNormalized: { ...str(320), required: true },
    passwordHash: { type: String, required: true, select: false },
    name: str(200),
    status: en("ACTIVE|SUSPENDED"),
    platformRole: en("USER|OWNER"),
    emailVerifiedAt: Date,
    preferences: sub({ theme: en("LIGHT|DARK|SYSTEM"), introSeen: Boolean, chatNotifications: Boolean, reviewNotifications: Boolean }),
  },
  [[{ emailNormalized: 1 }, { unique: true }]],
);
