import * as M from "../../models.js";
import {
  get,
  create,
  save,
  expected,
  list,
  assert,
  escape,
} from "../../core/db.js";
import { owner } from "../../core/policy.js";
import { event } from "../../core/events.js";
import { approved, revisionHash } from "../campaigns/campaigns.service.js";
export async function revenue(c, q) {
  owner(c);
  const f = {};
  if (q.from || q.to)
    f.createdAt = {
      ...(q.from ? { $gte: new Date(q.from) } : {}),
      ...(q.to ? { $lte: new Date(q.to) } : {}),
    };
  const accounts = await M.LedgerTransaction.aggregate([
      { $match: f },
      { $unwind: "$entries" },
      {
        $group: {
          _id: "$entries.accountCode",
          debitMinor: { $sum: "$entries.debitMinor" },
          creditMinor: { $sum: "$entries.creditMinor" },
        },
      },
    ]).session(c.session),
    v = (code) =>
      accounts.find((a) => a._id === code) || { debitMinor: 0, creditMinor: 0 };
  return {
    accounts,
    platformRevenueMinor:
      v("PLATFORM_REVENUE").creditMinor - v("PLATFORM_REVENUE").debitMinor,
    heldMinor: v("CLIENT_HELD").creditMinor - v("CLIENT_HELD").debitMinor,
    refundObligationsMinor:
      v("REFUND_PAYABLE").creditMinor - v("REFUND_PAYABLE").debitMinor,
    payoutMinor: v("BANK").creditMinor,
  };
}
export async function dashboard(c) {
  owner(c);
  const [
    users,
    creators,
    brands,
    agencies,
    activeCampaigns,
    pendingCampaigns,
    pendingFunding,
    pendingWithdrawals,
    openDisputes,
    pendingRefunds,
    pendingVerification,
  ] = await Promise.all([
    M.User.countDocuments(),
    M.CreatorProfile.countDocuments(),
    M.Organization.countDocuments({ type: "BRAND" }),
    M.Organization.countDocuments({ type: "AGENCY" }),
    M.Campaign.countDocuments({ state: "PUBLISHED" }),
    M.Campaign.countDocuments({ state: "PLATFORM_REVIEW" }),
    M.Funding.countDocuments({ state: "SUBMITTED" }),
    M.Withdrawal.countDocuments({
      state: { $in: ["REQUESTED", "PROCESSING"] },
    }),
    M.Dispute.countDocuments({ state: "OPEN" }),
    M.Refund.countDocuments({ state: { $ne: "PAID" } }),
    Promise.all([
      M.Organization.countDocuments({ verificationStatus: "PENDING" }),
      M.CreatorProfile.countDocuments({ verificationStatus: "PENDING" }),
    ]).then((v) => v[0] + v[1]),
  ]);
  const oldest = (Model, filter) => Model.findOne(filter).sort({ createdAt: 1 }).select("createdAt").lean();
  const keys = ["pendingVerification", "pendingCampaigns", "pendingFunding", "pendingWithdrawals", "openDisputes", "pendingRefunds"];
  const firstItems = await Promise.all([
    Promise.all([
      oldest(M.Organization, { verificationStatus: "PENDING" }),
      oldest(M.CreatorProfile, { verificationStatus: "PENDING" }),
    ]).then(rows => rows.filter(Boolean).sort((a, b) => a.createdAt - b.createdAt)[0]),
    oldest(M.Campaign, { state: "PLATFORM_REVIEW" }),
    oldest(M.Funding, { state: "SUBMITTED" }),
    oldest(M.Withdrawal, { state: { $in: ["REQUESTED", "PROCESSING"] } }),
    oldest(M.Dispute, { state: "OPEN" }),
    oldest(M.Refund, { state: { $ne: "PAID" } }),
  ]);
  return {
    users,
    creators,
    brands,
    agencies,
    activeCampaigns,
    queues: {
      pendingVerification,
      pendingCampaigns,
      pendingFunding,
      pendingWithdrawals,
      openDisputes,
      pendingRefunds,
    },
    oldestQueueItems: Object.fromEntries(keys.map((key, index) => [key, firstItems[index]?.createdAt || null])),
    finance: await revenue(c, {}),
  };
}
export async function members(c, q) {
  owner(c);
  const Model =
      q.type === "USER"
        ? M.User
        : q.type === "CREATOR"
          ? M.CreatorProfile
          : M.Organization,
    f = {};
  if (["BRAND", "AGENCY"].includes(q.type)) f.type = q.type;
  if (q.status)
    f[Model === M.User ? "status" : "verificationStatus"] = q.status;
  if (q.search) {
    const pattern = { $regex: escape(q.search), $options: "i" };
    if (Model === M.CreatorProfile) {
      const userIds = await M.User.find({
        $or: [{ name: pattern }, { email: pattern }],
      })
        .distinct("_id")
        .session(c.session);
      f.$or = [{ city: pattern }, { userId: { $in: userIds } }];
    } else
      f.$or = [
        { name: pattern },
        { [Model === M.User ? "email" : "contactEmail"]: pattern },
      ];
  }
  const result = await list(Model, f, c, q);
  if (Model === M.CreatorProfile) {
    const people = await M.User.find({ _id: { $in: result.data.map(p => p.userId) } }).select("name status").session(c.session);
    const byId = new Map(people.map(u => [String(u._id), u]));
    result.data = result.data.map(p => {
      const user = byId.get(String(p.userId));
      return { ...p.toJSON(), name: user?.name, accountStatus: user?.status };
    });
  }
  return result;
}
export async function member(c, id, type) {
  owner(c);
  return get(
    type === "USER"
      ? M.User
      : type === "CREATOR"
        ? M.CreatorProfile
        : M.Organization,
    id,
    c,
  );
}
export async function memberDetails(c, id, type) {
  const record = await member(c, id, type);
  const data = record.toJSON();
  if (type === "USER") return data;
  if (type === "CREATOR") {
    const user = await get(M.User, record.userId, c);
    const [socialAccounts, portfolioCount] = await Promise.all([
      M.SocialAccount.find({ creatorProfileId: id }).sort({ followers: -1 }).session(c.session),
      M.PortfolioItem.countDocuments({ creatorProfileId: id }).session(c.session),
    ]);
    return { ...data, name: user.name, email: user.email, emailVerifiedAt: user.emailVerifiedAt, accountStatus: user.status, socialAccounts, portfolioCount };
  }
  const [teamCount, campaignCount, completedCount] = await Promise.all([
    M.Membership.countDocuments({ organizationId: id, status: "ACTIVE" }).session(c.session),
    M.Campaign.countDocuments({ [record.type === "AGENCY" ? "agencyOrganizationId" : "brandOrganizationId"]: id }).session(c.session),
    M.Collaboration.countDocuments({ [record.type === "AGENCY" ? "agencyOrganizationId" : "brandOrganizationId"]: id, workState: "COMPLETED" }).session(c.session),
  ]);
  return { ...data, teamCount, campaignCount, completedCount };
}
export async function memberDecision(c, b, p, action) {
  const d = await member(c, p.memberId, b.memberType);
  if (b.expectedVersion !== undefined) expected(d, b);
  if (action === "verification") {
    assert(
      b.memberType !== "USER",
      422,
      "VERIFY_PROFILE",
      "Verify a creator or organization.",
    );
    d.verificationStatus = b.status;
  } else if (b.memberType === "USER") {
    assert(
      d.platformRole !== "OWNER",
      403,
      "OWNER_ACCOUNT",
      "Owner accounts cannot be suspended here.",
    );
    d.status = action === "suspension" ? "SUSPENDED" : "ACTIVE";
    if (action === "suspension")
      await M.Session.updateMany(
        { userId: d._id },
        { $set: { revokedAt: new Date() } },
        { session: c.session },
      );
  } else if (b.memberType === "CREATOR") {
    const u = await get(M.User, d.userId, c);
    assert(u.platformRole !== "OWNER", 403, "OWNER_ACCOUNT", "Owner accounts cannot be suspended here.");
    u.status = action === "suspension" ? "SUSPENDED" : "ACTIVE";
    d.increment();
    await save(u, c);
    if (action === "suspension") await M.Session.updateMany({ userId: u._id, revokedAt: null }, { $set: { revokedAt: new Date() } }, { session: c.session });
  } else d.suspendedAt = action === "suspension" ? new Date() : undefined;
  await save(d, c);
  await event(
    c,
    "ACCOUNT_" + action.toUpperCase(),
    d,
    [],
    [{ field: "reason", afterText: b.reason }],
  );
  return d;
}
export async function moderate(c, b, p) {
  owner(c);
  const r = await get(M.CampaignRevision, p.revisionId, c),
    d = await get(M.Campaign, r.campaignId, c);
  expected(d, b);
  assert(
    d.state === "PLATFORM_REVIEW" &&
      String(d.reviewRevisionId) === String(r._id),
    409,
    "MODERATION_STATE",
    "Not the current submitted revision.",
  );
  if (d.agencyOrganizationId)
    await approved(
      c,
      "CAMPAIGN_REVISION",
      r._id,
      r.revisionNumber,
      revisionHash(r),
    );
  if (b.decision === "APPROVE") {
    if (r.coverAssetId)
      await M.MediaAsset.updateOne(
        { _id: r.coverAssetId },
        { $set: { visibility: "PUBLIC" } },
        { session: c.session },
      );
    d.state = "PUBLISHED";
    d.publishedRevisionId = r._id;
    d.niche = r.niche;
    d.formatId = r.formatId;
    d.titleNormalized = r.title.toLowerCase();
    d.publicBudgetPerCreatorMinor = r.budgetPerCreatorMinor;
    d.spots = r.spots;
    d.applicationDeadline = r.applicationDeadline;
  } else d.state = "CHANGES_REQUESTED";
  await save(d, c);
  await event(
    c,
    b.decision === "APPROVE"
      ? "CAMPAIGN_PUBLISHED"
      : "CAMPAIGN_CHANGES_REQUESTED",
    d,
    [d.createdByUserId],
    [
      { field: "moderationDecision", afterText: b.decision },
      { field: "reason", afterText: b.reason },
    ],
  );
  return d;
}
export async function settings(c) {
  owner(c);
  return M.PlatformSettings.findOne().sort({ version: -1 }).session(c.session);
}
export async function updateSettings(c, b) {
  const old = await settings(c);
  assert(
    old && b.expectedVersion === old.version,
    409,
    "SETTINGS_CHANGED",
    "Settings changed. Refresh.",
  );
  const current = old.toObject();
  const { expectedVersion, ...v } = b,
    s = await create(
      M.PlatformSettings,
      {
        commissionBps: old.commissionBps,
        fundingInstructions: current.fundingInstructions,
        supportContact: current.supportContact,
        ...v,
        version: old.version + 1,
        changedByUserId: c.user._id,
        effectiveAt: new Date(),
      },
      c,
    );
  await event(c, "SETTINGS_CHANGED", s);
  return s;
}
export async function format(c, b, p, action) {
  owner(c);
  if (action === "create") {
    const d = await create(M.CollaborationFormat, b, c);
    await event(c, "FORMAT_CREATED", d);
    return d;
  }
  const d = await get(M.CollaborationFormat, p.formatId, c);
  expected(d, b);
  if (action === "deactivate") d.active = false;
  else {
    const { expectedVersion, ...v } = b;
    Object.assign(d, v);
    d.version++;
  }
  await save(d, c);
  await event(c, "FORMAT_CHANGED", d);
  return d;
}
