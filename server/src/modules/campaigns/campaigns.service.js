import * as M from "../../models.js";
import {
  get,
  create,
  save,
  expected,
  list,
  same,
  plain,
  assert,
  escape,
} from "../../core/db.js";
import * as P from "../../core/policy.js";
import { event } from "../../core/events.js";
import { hash } from "../../core/crypto.js";
import { ownAsset } from "../creators/creators.service.js";
export async function formatSnapshot(c, id) {
  const f = await get(M.CollaborationFormat, id, c);
  assert(f.active, 422, "FORMAT_INACTIVE", "Select an active format.");
  return {
    key: f.key,
    label: f.label,
    compensationPolicy: f.compensationPolicy,
    productPolicy: f.productPolicy,
    completionMode: f.completionMode,
    version: f.version,
  };
}
export const revisionHash = (r) =>
  hash({
    id: String(r._id),
    revision: r.revisionNumber,
    coverAssetId: r.coverAssetId,
    title: r.title,
    brief: r.brief,
    deliverables: r.deliverables,
    rights: r.usageRights,
    budget: r.budgetPerCreatorMinor,
    format: r.formatSnapshot,
    deadline: r.deadline,
    spots: r.spots,
  });
export async function approved(c, type, id, version, value) {
  assert(
    await M.ClientApproval.exists({
      targetType: type,
      targetId: id,
      targetVersion: version,
      targetHash: value,
      state: "APPROVED",
    }).session(c.session),
    409,
    "CLIENT_APPROVAL_REQUIRED",
    "This exact version needs independent client approval.",
  );
}
export async function freeze(c, d) {
  if (d.reviewRevisionId) {
    const r = await get(M.CampaignRevision, d.reviewRevisionId, c);
    if (r.revisionNumber === d.currentRevisionNumber) return r;
  }
  d.currentRevisionNumber++;
  const r = await create(
    M.CampaignRevision,
    {
      ...plain(d.draft),
      campaignId: d._id,
      revisionNumber: d.currentRevisionNumber,
      formatSnapshot: await formatSnapshot(c, d.draft.formatId),
      preparedByUserId: c.user._id,
      frozenAt: new Date(),
    },
    c,
  );
  d.reviewRevisionId = r._id;
  await save(d, c);
  return r;
}
export async function search(c, q) {
  let f = P.filter(c, { campaign: true });
  if (c.creator && !c.organizationId) {
    const activeBrands = await M.Organization.find({
      type: "BRAND",
      suspendedAt: null,
    })
      .select("_id")
      .session(c.session);
    f = {
      $and: [
        f,
        { brandOrganizationId: { $in: activeBrands.map((b) => b._id) } },
      ],
    };
  }
  for (const [key, value] of Object.entries({
    state: q.status,
    niche: q.niche,
    brandOrganizationId: q.brandId,
  }))
    if (value) f = { $and: [f, { [key]: value }] };
  if (c.creator && !c.organizationId) {
    const filters = {};
    if (q.minPay) {
      const pay = Number(q.minPay);
      assert(Number.isSafeInteger(pay) && pay >= 0, 422, "INVALID_PAY", "Enter a valid minimum rate.");
      filters.publicBudgetPerCreatorMinor = { $gte: pay };
    }
    if (q.applyBy) {
      const deadline = new Date(q.applyBy + "T23:59:59.999+05:30");
      assert(/^\d{4}-\d{2}-\d{2}$/.test(q.applyBy) && !Number.isNaN(+deadline), 422, "INVALID_DATE", "Enter a valid application date.");
      filters.applicationDeadline = { $lte: deadline };
    }
    if (q.formatId) {
      assert(/^[a-f0-9]{24}$/i.test(q.formatId), 422, "INVALID_FORMAT", "Choose a collaboration format.");
      filters.formatId = q.formatId;
    }
    f = { $and: [f, filters] };
  }
  if (q.search) {
    const brands = await M.Organization.find({
      type: "BRAND",
      nameNormalized: { $regex: escape(q.search), $options: "i" },
    })
      .select("_id")
      .session(c.session);
    f = {
      $and: [
        f,
        {
          $or: [
            { titleNormalized: { $regex: escape(q.search), $options: "i" } },
            { niche: { $regex: escape(q.search), $options: "i" } },
            ...(!(c.creator && !c.organizationId) ? [{ "draft.niche": { $regex: escape(q.search), $options: "i" } }] : []),
            { brandOrganizationId: { $in: brands.map((b) => b._id) } },
          ],
        },
      ],
    };
  }
  const result = await list(M.Campaign, f, c, q);
  const campaigns = result.data;
  const managed = campaigns.filter(d => c.user.platformRole === "OWNER" || P.operator(c, d));
  const managedIds = managed.map(d => d._id);
  const [brands, pitches, work, revisions] = await Promise.all([
    M.Organization.find({ _id: { $in: campaigns.map(d => d.brandOrganizationId) } }).select("name logoAssetId").session(c.session),
    M.Application.aggregate([
      { $match: { campaignId: { $in: managedIds }, state: { $ne: "WITHDRAWN" } } },
      { $group: { _id: "$campaignId", count: { $sum: 1 } } },
    ]).session(c.session),
    M.Collaboration.aggregate([
      { $match: { campaignId: { $in: managedIds } } },
      { $group: { _id: "$campaignId", count: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ["$workState", "COMPLETED"] }, 1, 0] } } } },
    ]).session(c.session),
    c.creator && !c.organizationId
      ? M.CampaignRevision.find({ _id: { $in: campaigns.map(campaign => campaign.publishedRevisionId).filter(Boolean) } })
        .select("coverAssetId deliverables.kind deliverables.quantity usageRights").session(c.session).lean()
      : [],
  ]);
  const byId = records => new Map(records.map(record => [String(record._id), record]));
  const brandById = byId(brands);
  const pitchById = byId(pitches);
  const workById = byId(work);
  const managedKeys = new Set(managedIds.map(String));
  const published = byId(revisions);
  result.data = campaigns.map(d => {
    const id = String(d._id);
    const brand = brandById.get(String(d.brandOrganizationId));
    const availableSpots = Math.max(0, d.spots - d.reservedSpots);
    const presentation = { brandName: brand?.name, brandLogoAssetId: brand?.logoAssetId, availableSpots };
    if (c.creator && !c.organizationId && !managedKeys.has(id)) {
      const revision = published.get(String(d.publishedRevisionId));
      return {
        ...presentation,
        id,
        version: d.__v,
        coverAssetId: revision?.coverAssetId,
        brandOrganizationId: d.brandOrganizationId,
        state: d.state,
        title: d.titleNormalized,
        niche: d.niche,
        budgetPerCreatorMinor: d.publicBudgetPerCreatorMinor,
        applicationDeadline: d.applicationDeadline,
        deliverables: revision?.deliverables,
        usageRights: revision?.usageRights,
      };
    }
    return {
      ...d.toJSON(),
      ...presentation,
      ...(managedKeys.has(id) && {
        pitchCount: pitchById.get(id)?.count ?? 0,
        collaborationCount: workById.get(id)?.count ?? 0,
        completedCount: workById.get(id)?.completed ?? 0,
      }),
    };
  });
  return result;
}
export async function detail(c, id) {
  const d = await P.campaign(c, id);
  const brand = await M.Organization.findById(d.brandOrganizationId).select("name").session(c.session).lean();
  if (c.creator && !c.organizationId && !P.operator(c, d)) {
    return {
      id: String(d._id),
      version: d.__v,
      state: d.state,
      brandOrganizationId: d.brandOrganizationId,
      brandName: brand?.name,
      revision: await get(M.CampaignRevision, d.publishedRevisionId, c),
      availableSpots: Math.max(0, d.spots - d.reservedSpots),
    };
  }
  return {
    ...d.toJSON(),
    brandName: brand?.name,
    eligibleReviewers: await P.eligibleReviewers(c, d),
    revision: d.reviewRevisionId
      ? await get(M.CampaignRevision, d.reviewRevisionId, c)
      : null,
    availableSpots: Math.max(0, d.spots - d.reservedSpots),
  };
}
export async function add(c, b) {
  const scope = await P.clientContext(c, b.brandOrganizationId, true),
    {
      brandOrganizationId,
      agencyClientId,
      compensationBudgetMinor,
      serviceChargeMinor,
      ...draft
    } = b;
  await formatSnapshot(c, draft.formatId);
  assert(
    new Date(draft.applicationDeadline) < new Date(draft.deadline),
    422,
    "DEADLINE",
    "Applications must close before delivery.",
  );
  const d = await create(
    M.Campaign,
    {
      ...scope,
      createdByUserId: c.user._id,
      draft,
      compensationBudgetMinor,
      serviceChargeMinor,
      spots: draft.spots,
      applicationDeadline: draft.applicationDeadline,
      titleNormalized: draft.title.toLowerCase(),
    },
    c,
  );
  await bindCover(c, d.draft.coverAssetId, d);
  await event(c, "CAMPAIGN_CREATED", d);
  return d;
}
export async function update(c, b, p) {
  const d = await P.campaign(c, p.campaignId, true);
  expected(d, b);
  assert(
    ["DRAFT", "CLIENT_REVIEW", "CHANGES_REQUESTED"].includes(d.state),
    409,
    "CAMPAIGN_LOCKED",
    "This campaign cannot be edited now.",
  );
  const {
    expectedVersion,
    compensationBudgetMinor,
    serviceChargeMinor,
    ...draft
  } = b;
  if (draft.coverAssetId) await bindCover(c, draft.coverAssetId, d);
  Object.assign(d.draft, draft);
  if (compensationBudgetMinor !== undefined) {
    assert(
      compensationBudgetMinor >= d.committedMinor,
      409,
      "BUDGET",
      "Budget is below commitments.",
    );
    d.compensationBudgetMinor = compensationBudgetMinor;
  }
  if (serviceChargeMinor !== undefined)
    d.serviceChargeMinor = serviceChargeMinor;
  if (d.reviewRevisionId)
    await M.ClientApproval.updateMany(
      { targetId: d.reviewRevisionId, state: { $in: ["PENDING", "APPROVED"] } },
      { $set: { state: "SUPERSEDED" } },
      { session: c.session },
    );
  d.reviewRevisionId = undefined;
  d.state = "DRAFT";
  await save(d, c);
  await event(c, "CAMPAIGN_EDITED", d);
  return d;
}
export async function submit(c, b, p) {
  const d = await P.campaign(c, p.campaignId, true);
  expected(d, b);
  assert(
    ["DRAFT", "CLIENT_REVIEW", "CHANGES_REQUESTED"].includes(d.state),
    409,
    "CAMPAIGN_STATE",
    "Campaign is not ready for submission.",
  );
  const r = await freeze(c, d);
  assert(
    r.applicationDeadline > new Date(),
    422,
    "DEADLINE_PASSED",
    "Application deadline has passed.",
  );
  if (d.agencyOrganizationId)
    await approved(
      c,
      "CAMPAIGN_REVISION",
      r._id,
      r.revisionNumber,
      revisionHash(r),
    );
  d.state = "PLATFORM_REVIEW";
  await save(d, c);
  await event(
    c,
    "CAMPAIGN_SUBMITTED",
    d,
    (await M.User.find({ platformRole: "OWNER" }).session(c.session)).map(
      (u) => u._id,
    ),
  );
  return d;
}
export async function close(c, b, p) {
  const d = await P.campaign(c, p.campaignId, true);
  expected(d, b);
  assert(d.state !== "CLOSED", 409, "CLOSED", "Already closed.");
  d.state = "CLOSED";
  await save(d, c);
  if (d.reviewRevisionId)
    await M.ClientApproval.updateMany(
      {
        targetType: "CAMPAIGN_REVISION",
        targetId: d.reviewRevisionId,
        state: "PENDING",
      },
      { $set: { state: "SUPERSEDED" } },
      { session: c.session },
    );
  const apps = await M.Application.find({
    campaignId: d._id,
    state: "PENDING",
  }).session(c.session);
  for (const a of apps) {
    a.state = "DECLINED";
    a.decisionReason = b.reason || "Campaign closed";
    a.decidedByUserId = c.user._id;
    await save(a, c);
    await event(c, "PITCH_DECLINED", {
      ...a.toObject(),
      resourceType: "Application",
      brandOrganizationId: d.brandOrganizationId,
      agencyOrganizationId: d.agencyOrganizationId,
    });
  }
  await event(c, "CAMPAIGN_CLOSED", d);
  return d;
}
export async function assign(c, b, p, remove = false) {
  const Model = p.campaignId ? M.Campaign : M.Collaboration,
    d = await get(Model, p.campaignId || p.collaborationId, c);
  assert(
    d.agencyOrganizationId,
    422,
    "AGENCY_REQUIRED",
    "Team responsibility requires an agency.",
  );
  P.admin(c, d.agencyOrganizationId);
  if (remove) d.assignedMembershipId = undefined;
  else {
    expected(d, b);
    const m = await get(M.Membership, b.membershipId, c, {
      organizationId: d.agencyOrganizationId,
      status: "ACTIVE",
    });
    assert(
      m.role !== "CLIENT_REVIEWER",
      422,
      "ASSIGNMENT_ROLE",
      "Assign an agency operator.",
    );
    let s = m.clientScopes.find((s) =>
      same(s.clientBrandId, d.brandOrganizationId),
    );
    if (!s) {
      m.clientScopes.push({
        clientBrandId: d.brandOrganizationId,
        allCampaigns: false,
        campaignIds: [],
        directCollaborationIds: [],
      });
      s = m.clientScopes.at(-1);
    }
    const key = Model === M.Campaign ? "campaignIds" : "directCollaborationIds";
    if (!s[key].some((id) => same(id, d._id))) s[key].push(d._id);
    await save(m, c);
    d.assignedMembershipId = m._id;
  }
  await save(d, c);
  await event(
    c,
    remove ? "RESPONSIBILITY_REMOVED" : "RESPONSIBILITY_ASSIGNED",
    d,
  );
  return d;
}

export async function bindCover(c, assetId, d) {
  if (!assetId) return;
  const existing = await get(M.MediaAsset, assetId, c);
  const a = same(existing.campaignId, d._id)
    ? existing
    : await ownAsset(c, assetId, "CAMPAIGN_COVER");
  assert(
    a.state === "READY" && a.purpose === "CAMPAIGN_COVER",
    422,
    "COVER_IMAGE",
    "Choose a ready campaign image.",
  );
  assert(a.mime.startsWith("image/"), 422, "COVER_IMAGE", "Choose an image.");
  assert(
    !a.campaignId || same(a.campaignId, d._id),
    422,
    "COVER_SCOPE",
    "This image belongs to another campaign.",
  );
  a.campaignId = d._id;
  await save(a, c);
}
