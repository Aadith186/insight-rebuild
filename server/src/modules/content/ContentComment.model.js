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
export const ContentComment = define(
  "ContentComment",
  {
    collaborationId: ref("Collaboration", true),
    contentVersionId: ref("ContentVersion", true),
    authorUserId: ref("User"),
    authorName: String,
    timestampMs: int(),
    text: str(),
    parentCommentId: ref("ContentComment"),
  },
  [[{ contentVersionId: 1, createdAt: 1 }, {}]],
);
