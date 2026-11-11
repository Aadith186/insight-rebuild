import * as M from "../../models.js";
import {
  get,
  create,
  save,
  expected,
  same,
  plain,
  assert,
} from "../../core/db.js";
import * as P from "../../core/policy.js";
import { event } from "../../core/events.js";
import { formatSnapshot, approved } from "../campaigns/campaigns.service.js";
import { hash } from "../../core/crypto.js";
export const offerHash = (o) =>
  hash({
    id: String(o._id),
    revision: o.revisionNumber,
    terms: plain(
      o.revisions.find((r) => r.revisionNumber === o.revisionNumber),
    ),
  });
export async function validateTerms(c, b) {
  const f = await formatSnapshot(c, b.formatId);
  assert(
    new Date(b.dueAt) > new Date(),
    422,
    "DUE_DATE",
    "Delivery must be in the future.",
  );
  assert(
    f.compensationPolicy !== "REQUIRED" || b.amountMinor > 0,
    422,
    "COMPENSATION_REQUIRED",
    "This format requires monetary compensation.",
  );
  assert(
    f.compensationPolicy !== "ZERO" || b.amountMinor === 0,
    422,
    "ZERO_COMPENSATION",
    "Barter has zero monetary compensation.",
  );
  assert(
    f.productPolicy !== "REQUIRED" || b.products.length > 0,
    422,
    "PRODUCTS_REQUIRED",
    "List the supplied products.",
  );
  assert(
    f.productPolicy !== "NONE" || !b.products.length,
    422,
    "PRODUCTS_NOT_ALLOWED",
    "This format does not include products.",
  );
  if (f.key === "AFFILIATE_PRODUCT")
    assert(
      b.affiliateTerms?.description,
      422,
      "AFFILIATE_TERMS",
      "Record affiliate compensation terms.",
    );
  const s = await M.PlatformSettings.findOne()
      .sort({ version: -1 })
      .session(c.session),
    commissionBps = b.amountMinor === 0 ? 0 : s?.commissionBps || 0,
    feeMinor = Number((BigInt(b.amountMinor) * BigInt(commissionBps)) / 10000n);
  return {
    ...b,
    formatSnapshot: f,
    commissionBps,
    feeMinor,
    creatorNetMinor: b.amountMinor - feeMinor,
  };
}
export async function detail(c, id, write = false) {
  const o = await get(M.Offer, id, c);
  if (same(c.creator?._id, o.creatorProfileId) && !c.organizationId) {
    assert(
      !["DRAFT", "CLIENT_REVIEW"].includes(o.state),
      404,
      "NOT_FOUND",
      "Offer unavailable.",
    );
    if (write)
      assert(
        false,
        403,
        "COMMISSIONER_REQUIRED",
        "Only the commissioner may edit.",
      );
    return o;
  }
  await P.party(c, o, { write, commissioner: write });
  return o;
}
export async function add(c, b) {
  let scope;
  if (b.campaignId) {
    const d = await P.campaign(c, b.campaignId, true);
    assert(
      d.state === "PUBLISHED" &&
        same(d.brandOrganizationId, b.brandOrganizationId),
      409,
      "CAMPAIGN_STATE",
      "Choose a published campaign for this client.",
    );
    scope = {
      brandOrganizationId: d.brandOrganizationId,
      agencyOrganizationId: d.agencyOrganizationId,
    };
  } else scope = await P.clientContext(c, b.brandOrganizationId, true);
  const cp = await get(M.CreatorProfile, b.creatorProfileId, c),
    u = await get(M.User, cp.userId, c);
  assert(
    u.status === "ACTIVE" && !same(u._id, c.user._id),
    422,
    "CREATOR_INVALID",
    "Choose an active independent creator.",
  );
  if (b.applicationId) {
    const a = await get(M.Application, b.applicationId, c);
    assert(
      same(a.campaignId, b.campaignId) &&
        same(a.creatorProfileId, b.creatorProfileId) &&
        a.state === "PENDING",
      422,
      "APPLICATION_MISMATCH",
      "Choose the matching pending application.",
    );
  }
  const {
    brandOrganizationId,
    creatorProfileId,
    campaignId,
    applicationId,
    ...input
  } = b;
  const o = await create(
    M.Offer,
    {
      ...scope,
      creatorProfileId,
      campaignId,
      applicationId,
      preparedByUserId: c.user._id,
      revisionNumber: 1,
      revisions: [{ revisionNumber: 1, ...(await validateTerms(c, input)) }],
    },
    c,
  );
  await event(c, "OFFER_DRAFTED", o);
  return o;
}
export async function update(c, b, p) {
  const o = await detail(c, p.offerId, true);
  expected(o, b);
  assert(
    ["DRAFT", "CLIENT_REVIEW"].includes(o.state),
    409,
    "OFFER_LOCKED",
    "Only unsent offers can change.",
  );
  const { expectedVersion, ...input } = b;
  o.revisionNumber++;
  o.revisions.push({
    revisionNumber: o.revisionNumber,
    ...(await validateTerms(c, input)),
  });
  o.state = "DRAFT";
  await M.ClientApproval.updateMany(
    {
      targetType: "OFFER_REVISION",
      targetId: o._id,
      state: { $in: ["PENDING", "APPROVED"] },
    },
    { $set: { state: "SUPERSEDED" } },
    { session: c.session },
  );
  await save(o, c);
  await event(c, "OFFER_EDITED", o);
  return o;
}
export async function reserve(c, o, amount, spots) {
  if (o.campaignId) {
    const d = await get(M.Campaign, o.campaignId, c);
    if (spots > 0)
      assert(
        d.state === "PUBLISHED" && d.reservedSpots < d.spots,
        409,
        "CAPACITY",
        "No campaign spot remains.",
      );
    assert(
      d.committedMinor + amount >= 0 &&
        d.committedMinor + amount <= d.compensationBudgetMinor,
      409,
      "BUDGET_EXCEEDED",
      "Offer exceeds campaign budget.",
    );
    d.committedMinor += amount;
    d.reservedSpots += spots;
    await save(d, c);
  }
  if (o.agencyOrganizationId) {
    const rel = await M.AgencyClient.findOne({
      agencyOrganizationId: o.agencyOrganizationId,
      brandOrganizationId: o.brandOrganizationId,
    }).session(c.session);
    assert(
      rel && (!(spots > 0) || rel.status === "ACTIVE"),
      409,
      "CLIENT_ARCHIVED",
      "Client cannot receive new work.",
    );
    assert(
      !rel.budgetMinor || rel.committedMinor + amount <= rel.budgetMinor,
      409,
      "CLIENT_BUDGET_EXCEEDED",
      "Offer exceeds client budget.",
    );
    rel.committedMinor += amount;
    await save(rel, c);
  }
}
export async function send(c, b, p) {
  const o = await detail(c, p.offerId, true);
  expected(o, b);
  assert(
    ["DRAFT", "CLIENT_REVIEW"].includes(o.state),
    409,
    "OFFER_STATE",
    "Offer was already sent.",
  );
  const t = o.revisions.at(-1),
    s = await M.PlatformSettings.findOne()
      .sort({ version: -1 })
      .session(c.session);
  assert(
    t.commissionBps === (t.amountMinor ? s?.commissionBps || 0 : 0),
    409,
    "FEE_CHANGED",
    "Fee changed. Save a new offer revision.",
  );
  if (o.agencyOrganizationId)
    await approved(c, "OFFER_REVISION", o._id, o.revisionNumber, offerHash(o));
  await reserve(c, o, t.amountMinor, 1);
  o.state = "SENT";
  o.sentRevisionNumber = o.revisionNumber;
  o.sentAt = new Date();
  await save(o, c);
  if (o.applicationId) {
    const a = await get(M.Application, o.applicationId, c);
    assert(
      a.state === "PENDING",
      409,
      "APPLICATION_STATE",
      "Application no longer pending.",
    );
    a.state = "OFFERED";
    await save(a, c);
  }
  await event(c, "OFFER_RECEIVED", o);
  return o;
}
export async function decide(c, b, p, action) {
  const o = await detail(c, p.offerId, action === "withdraw");
  expected(o, b);
  assert(
    o.state === "SENT",
    409,
    "OFFER_STATE",
    "This offer is no longer awaiting a decision.",
  );
  if (action !== "withdraw")
    assert(
      same(P.creator(c)._id, o.creatorProfileId),
      403,
      "CREATOR_ONLY",
      "Only this creator may decide.",
    );
  const snapshot = plain(
      o.revisions.find((t) => t.revisionNumber === o.sentRevisionNumber),
    ),
    { revisionNumber, ...t } = snapshot;
  if (action === "accept") {
    for (const organizationId of [
      o.brandOrganizationId,
      o.agencyOrganizationId,
    ].filter(Boolean)) {
      const organization = await get(M.Organization, organizationId, c);
      assert(
        !organization.suspendedAt,
        409,
        "PARTICIPANT_SUSPENDED",
        "A commissioning account is suspended.",
      );
    }
    if (o.campaignId) {
      const cam = await get(M.Campaign, o.campaignId, c);
      assert(
        cam.reservedSpots <= cam.spots,
        409,
        "CAPACITY",
        "No campaign spot remains.",
      );
      cam.updatedAt = new Date();
      cam.markModified("updatedAt");
      await save(cam, c);
    }
    const a = await create(
      M.Agreement,
      {
        ...t,
        offerId: o._id,
        campaignId: o.campaignId,
        acceptedOfferRevision: o.sentRevisionNumber,
        brandOrganizationId: o.brandOrganizationId,
        agencyOrganizationId: o.agencyOrganizationId,
        creatorProfileId: o.creatorProfileId,
        acceptedByUserId: c.user._id,
        acceptedAt: new Date(),
      },
      c,
    );
    const d = await create(
      M.Collaboration,
      {
        agreementId: a._id,
        campaignId: o.campaignId,
        brandOrganizationId: o.brandOrganizationId,
        agencyOrganizationId: o.agencyOrganizationId,
        creatorProfileId: o.creatorProfileId,
        dueAt: t.dueAt,
        fundingState: t.amountMinor ? "AWAITING" : "NOT_REQUIRED",
        productState: t.products.length ? "ADDRESS_REQUIRED" : "NOT_REQUIRED",
      },
      c,
    );
    if (t.products.length)
      await create(
        M.ProductPackage,
        {
          collaborationId: d._id,
          agreedItems: t.products,
          retailValueMinor: t.products.reduce(
            (n, p) => n + p.quantity * p.retailValueMinor,
            0,
          ),
        },
        c,
      );
    o.state = "ACCEPTED";
    o.decisionAt = new Date();
    await save(o, c);
    if (o.applicationId) {
      const app = await get(M.Application, o.applicationId, c);
      app.state = "ACCEPTED";
      await save(app, c);
    }
    await event(c, "OFFER_ACCEPTED", d);
    return { agreement: a, collaboration: d };
  }
  await reserve(c, o, -t.amountMinor, -1);
  o.state = action === "withdraw" ? "WITHDRAWN" : "DECLINED";
  o.decisionAt = new Date();
  await save(o, c);
  if (o.applicationId) {
    const a = await get(M.Application, o.applicationId, c);
    a.state = "DECLINED";
    a.decisionReason = b.reason || o.state;
    await save(a, c);
  }
  await event(c, "OFFER_" + o.state, o);
  return o;
}
