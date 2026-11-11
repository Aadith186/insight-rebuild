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
export const ProductQuestion = define(
  "ProductQuestion",
  {
    collaborationId: ref("Collaboration", true),
    category: String,
    question: str(),
    askedByUserId: ref("User"),
    answers: [sub({ text: String, authorUserId: ref("User"), at: Date })],
    state: en("OPEN|ANSWERED"),
  },
  [[{ collaborationId: 1, createdAt: -1 }, {}]],
);
