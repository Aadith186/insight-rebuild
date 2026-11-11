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
export const Conversation = define(
  "Conversation",
  {
    contextType: en("DIRECT|CAMPAIGN|COLLABORATION|CLIENT_REVIEW"),
    clientApprovalId: ref("ClientApproval"),
    campaignId: ref("Campaign"),
    collaborationId: ref("Collaboration"),
    brandOrganizationId: ref("Organization", true),
    agencyOrganizationId: ref("Organization"),
    creatorProfileId: ref("CreatorProfile"),
    participantScopeKey: String,
    readCursors: [
      sub({
        userId: ref("User"),
        lastReadMessageId: ref("Message"),
        readAt: Date,
      }),
    ],
    lastMessageAt: Date,
  },
  [
    [{ participantScopeKey: 1 }, { unique: true }],
    [{ brandOrganizationId: 1, lastMessageAt: -1, _id: -1 }, {}],
    [{ creatorProfileId: 1, lastMessageAt: -1, _id: -1 }, {}],
  ],
);
