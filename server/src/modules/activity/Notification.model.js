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
export const Notification = define(
  "Notification",
  {
    recipientUserId: ref("User", true),
    organizationContextId: ref("Organization"),
    clientBrandOrganizationId: ref("Organization"),
    campaignId: ref("Campaign"),
    collaborationId: ref("Collaboration"),
    eventId: String,
    type: String,
    title: String,
    body: String,
    link: sub({ screen: String, resourceId: String }),
    readAt: Date,
  },
  [
    [{ recipientUserId: 1, eventId: 1 }, { unique: true }],
    [{ recipientUserId: 1, readAt: 1, createdAt: -1 }, {}],
  ],
);
