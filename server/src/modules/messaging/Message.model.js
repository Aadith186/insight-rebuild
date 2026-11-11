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
export const Message = define(
  "Message",
  {
    conversationId: ref("Conversation", true),
    senderUserId: ref("User", true),
    senderName: String,
    text: str(),
    attachmentAssetIds: [ref("MediaAsset")],
    clientMessageId: String,
  },
  [
    [
      { conversationId: 1, senderUserId: 1, clientMessageId: 1 },
      { unique: true },
    ],
    [{ conversationId: 1, createdAt: -1 }, {}],
  ],
);
