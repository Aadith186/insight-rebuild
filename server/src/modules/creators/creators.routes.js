import { route } from "../../core/http.js";
import {
  z,
  str,
  id,
  money,
  url,
  audience,
  version,
} from "../../core/validation.js";
import { list, expected, save } from "../../core/db.js";
import { creator } from "../../core/policy.js";
import * as M from "../../models.js";
import * as S from "./creators.service.js";
const social = z
  .object({
    platform: z.enum(["INSTAGRAM", "YOUTUBE", "OTHER"]),
    handle: str.max(200),
    profileUrl: url,
    followers: z.number().int().nonnegative(),
    engagementBps: z.number().int().min(0).max(10000).optional(),
    engagementSample: z.object({
      posts: z.number().int().min(1).max(200),
      likes: z.number().int().nonnegative().max(1e12),
      comments: z.number().int().nonnegative().max(1e12),
    }).strict().optional(),
    audience: audience.optional(),
  })
  .strict()
  .refine(b => b.engagementSample ? b.followers > 0 : b.engagementBps !== undefined,
    "Enter an engagement rate or a post sample with a positive follower count.");
const portfolio = z
  .object({
    title: str.max(200),
    description: str.optional(),
    assetId: id.optional(),
    externalVideoUrl: url.optional(),
    brandOrganizationId: id.optional(),
    brandName: str.optional(),
    evidenceUrl: url.optional(),
    displayOrder: z.number().int().nonnegative().default(0),
  })
  .strict()
  .refine(
    (b) => !!b.assetId !== !!b.externalVideoUrl,
    "Choose one upload or external video.",
  );
export function routes(r) {
  route(r, "get", "/me", null, (c) => ({
    user: c.user,
    creator: c.creator,
    memberships: c.memberships,
    organizations: c.organizations,
  }));
  route(
    r,
    "patch",
    "/me",
    z
      .object({
        ...version,
        name: str.max(200).optional(),
        preferences: z
          .object({
            theme: z.enum(["LIGHT", "DARK", "SYSTEM"]).optional(),
            introSeen: z.boolean().optional(),
            chatNotifications: z.boolean().optional(),
            reviewNotifications: z.boolean().optional(),
          })
          .strict()
          .optional(),
      })
      .strict(),
    async (c, b) => {
      expected(c.user, b);
      const { expectedVersion, ...v } = b;
      const { preferences, ...account } = v;
      Object.assign(c.user, account);
      if (preferences) c.user.set("preferences", { ...c.user.toObject().preferences, ...preferences });
      return save(c.user, c);
    },
  );
  route(r, "get", "/me/creator-profile", null, (c) => creator(c));
  route(
    r,
    "patch",
    "/me/creator-profile",
    z
      .object({
        ...version,
        bio: str.optional(),
        city: str.max(100).optional(),
        niches: z.array(str).max(20).optional(),
        languages: z.array(str).max(20).optional(),
        audience: audience.optional(),
        startingRateMinor: money.optional(),
        avatarAssetId: id.optional(),
      })
      .strict(),
    S.profile,
  );
  route(r, "get", "/creators", null, (c, b, p, q) => S.search(c, q));
  route(r, "get", "/creators/:creatorId", null, (c, b, p) =>
    S.publicProfile(c, p.creatorId),
  );
  route(r, "get", "/creators/:creatorId/projects", null, (c, b, p, q) =>
    S.projects(c, p.creatorId, "CREATOR", q),
  );
  route(r, "get", "/creators/:creatorId/reviews", null, (c, b, p, q) =>
    list(M.Review, { targetType: "CREATOR", targetId: p.creatorId }, c, q),
  );
  route(r, "post", "/me/social-accounts", social, S.social);
  route(r, "patch", "/me/social-accounts/:socialAccountId", social, S.social);
  route(r, "delete", "/me/social-accounts/:socialAccountId", null, (c, b, p) =>
    S.social(c, b, p, true),
  );
  route(
    r,
    "get",
    "/creators/:creatorId/portfolio",
    null,
    async (c, b, p, q) => {
      await S.publicProfile(c, p.creatorId);
      return list(M.PortfolioItem, { creatorProfileId: p.creatorId }, c, q);
    },
  );
  route(r, "post", "/me/portfolio", portfolio, S.portfolio);
  route(r, "patch", "/me/portfolio/:portfolioItemId", portfolio, S.portfolio);
  route(r, "delete", "/me/portfolio/:portfolioItemId", null, (c, b, p) =>
    S.portfolio(c, b, p, true),
  );
}
