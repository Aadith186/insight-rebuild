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
export const SocialAccount = define(
  "SocialAccount",
  {
    creatorProfileId: ref("CreatorProfile", true),
    platform: en("INSTAGRAM|YOUTUBE|OTHER"),
    handle: str(200),
    profileUrl: str(1500),
    followers: int(),
    engagementBps: int(0, 10000),
    engagementSample: sub({
      posts: int(1, 200),
      likes: int(),
      comments: int(),
    }),
    audience,
    source: en("SELF_REPORTED|CONNECTED"),
    measuredAt: Date,
  },
  [[{ creatorProfileId: 1, platform: 1, handle: 1 }, { unique: true }]],
);
