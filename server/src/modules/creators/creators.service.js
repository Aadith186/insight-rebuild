import * as M from "../../models.js";
import {
  get,
  create,
  save,
  expected,
  same,
  list,
  assert,
  escape,
} from "../../core/db.js";
import { creator } from "../../core/policy.js";
import { event } from "../../core/events.js";
export async function ownAsset(c, id, purpose) {
  const a = await get(M.MediaAsset, id, c);
  assert(
    same(a.uploaderUserId, c.user._id) &&
      a.state === "READY" &&
      (!purpose || a.purpose === purpose),
    422,
    "ASSET_INVALID",
    "Select your ready upload.",
  );
  // Claim the asset in the caller's transaction so retirement cannot race binding.
  a.referenceCount++;
  await save(a, c);
  return a;
}
export async function publicProfile(c, id) {
  const p = await get(M.CreatorProfile, id, c),
    u = await get(M.User, p.userId, c);
  assert(
    u.status === "ACTIVE" ||
      same(c.user._id, u._id) ||
      c.user.platformRole === "OWNER",
    404,
    "NOT_FOUND",
    "Creator unavailable.",
  );
  return {
    ...p.toJSON(),
    name: u.name,
    socialAccounts: await M.SocialAccount.find({
      creatorProfileId: p._id,
    }).session(c.session),
  };
}
export async function search(c, q) {
  assert(
    c.user.platformRole === "OWNER" ||
      c.memberships.some((m) => m.role !== "CLIENT_REVIEWER"),
    403,
    "DISCOVERY_ACCESS",
    "A brand or agency workspace is required.",
  );
  const f = {},
    u = { status: "ACTIVE" };
  if (q.search) u.name = { $regex: escape(q.search), $options: "i" };
  f.userId = {
    $in: (await M.User.find(u).select("_id").session(c.session)).map(
      (u) => u._id,
    ),
  };
  if (q.niche) f.niches = { $regex: escape(q.niche), $options: "i" };
  if (q.city) f.cityNormalized = q.city.toLowerCase();
  if (q.rateMin || q.rateMax)
    f.startingRateMinor = {
      ...(q.rateMin ? { $gte: Number(q.rateMin) } : {}),
      ...(q.rateMax ? { $lte: Number(q.rateMax) } : {}),
    };
  if (q.platform || q.engagementMin) {
    const minimum = Number(q.engagementMin || 0);
    assert(Number.isFinite(minimum) && minimum >= 0 && minimum <= 100, 422, "ENGAGEMENT_RANGE", "Choose a rate from 0 to 100%.");
    f._id = { $in: await M.SocialAccount.find({
      ...(q.platform ? { platform: q.platform } : {}),
      engagementBps: { $gte: Math.round(minimum * 100) },
    }).distinct("creatorProfileId").session(c.session) };
  }
  const result = await list(M.CreatorProfile, f, c, q);
  result.data = await Promise.all(
    result.data.map((p) => publicProfile(c, p._id)),
  );
  return result;
}
export async function profile(c, b) {
  const p = creator(c);
  expected(p, b);
  const { expectedVersion, ...data } = b;
  if (data.avatarAssetId) {
    const a = await ownAsset(c, data.avatarAssetId, "AVATAR");
    a.visibility = "PUBLIC";
    await save(a, c);
  }
  Object.assign(p, data);
  if (data.city) p.cityNormalized = data.city.toLowerCase();
  await save(p, c);
  await event(c, "PROFILE_UPDATED", p);
  return p;
}
export function sampleEngagementBps(sample, followers) {
  const rate = (sample.likes + sample.comments) / sample.posts / followers;
  assert(rate <= 1, 422, "ENGAGEMENT_RANGE", "The sample exceeds 100% engagement. Check the totals and follower count.");
  return Math.round(rate * 10000);
}
export async function social(c, b, p, remove = false) {
  const cp = creator(c);
  const d = p.socialAccountId
    ? await get(M.SocialAccount, p.socialAccountId, c, {
        creatorProfileId: cp._id,
      })
    : null;
  if (remove) {
    await d.deleteOne({ session: c.session });
    return;
  }
  const metrics = {
    ...b,
    engagementSample: b.engagementSample,
    engagementBps: b.engagementSample ? sampleEngagementBps(b.engagementSample, b.followers) : b.engagementBps,
    source: "SELF_REPORTED",
    measuredAt: new Date(),
  };
  if (d) {
    Object.assign(d, metrics);
    return save(d, c);
  }
  return create(
    M.SocialAccount,
    {
      ...metrics,
      creatorProfileId: cp._id,
    },
    c,
  );
}
export async function portfolio(c, b, p, remove = false) {
  const cp = creator(c);
  const d = p.portfolioItemId
    ? await get(M.PortfolioItem, p.portfolioItemId, c, {
        creatorProfileId: cp._id,
      })
    : null;
  if (remove) {
    await d.deleteOne({ session: c.session });
    return;
  }
  if (b.assetId) {
    const a = await ownAsset(c, b.assetId, "PORTFOLIO");
    a.visibility = "PUBLIC";
    await save(a, c);
  }
  if (d) {
    Object.assign(d, b);
    return save(d, c);
  }
  return create(
    M.PortfolioItem,
    { ...b, creatorProfileId: cp._id, publishedAt: new Date() },
    c,
  );
}
export async function projects(c, id, type, q) {
  const result = await list(
    M.Collaboration,
    {
      [type === "CREATOR" ? "creatorProfileId" : "brandOrganizationId"]: id,
      workState: "COMPLETED",
    },
    c,
    q,
    "creatorProfileId brandOrganizationId completionId",
  );
  result.data = await Promise.all(
    result.data.map(async (d) => ({
      ...d.toJSON(),
      completion: await M.CompletionSubmission.findById(d.completionId)
        .select("url mode platform completedAt")
        .session(c.session),
    })),
  );
  return result;
}
