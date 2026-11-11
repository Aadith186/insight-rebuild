import mongoose from "mongoose";
import * as M from "../../models.js";
import {
  get,
  create,
  save,
  expected,
  list,
  same,
  assert,
} from "../../core/db.js";
import * as P from "../../core/policy.js";
import { event } from "../../core/events.js";
import { encrypt, decrypt } from "../../core/crypto.js";
import { ownAsset } from "../creators/creators.service.js";
export const PLATFORM = new mongoose.Types.ObjectId("000000000000000000000001");
export async function wallet(c, type, id) {
  return M.Wallet.findOneAndUpdate(
    { ownerType: type, ownerId: id, currency: "INR" },
    { $setOnInsert: { availableMinor: 0, reservedMinor: 0, heldMinor: 0 } },
    { upsert: true, new: true, session: c.session },
  );
}
export async function journal(c, kind, id, deal, entries) {
  const debit = entries.reduce((n, e) => n + (e.debitMinor || 0), 0),
    credit = entries.reduce((n, e) => n + (e.creditMinor || 0), 0);
  assert(
    debit === credit &&
      debit > 0 &&
      Number.isSafeInteger(debit) &&
      entries.every(
        (e) => (e.debitMinor || 0) >= 0 && (e.creditMinor || 0) >= 0,
      ),
    500,
    "LEDGER_UNBALANCED",
    "Ledger entries must balance.",
  );
  return create(
    M.LedgerTransaction,
    { kind, sourceId: id, collaborationId: deal, currency: "INR", entries },
    c,
  );
}
const e = (accountCode, ownerId, debitMinor = 0, creditMinor = 0) => ({
  accountCode,
  ownerId,
  debitMinor,
  creditMinor,
});
export async function funding(c, b, p) {
  const d = await P.collab(c, p.collaborationId, {
      write: true,
      commissioner: true,
    }),
    a = await get(M.Agreement, d.agreementId, c);
  assert(
    d.fundingState === "AWAITING" && b.amountMinor === a.amountMinor,
    409,
    "FUNDING_AMOUNT",
    "Submit the exact outstanding gross amount.",
  );
  assert(
    !(await M.Funding.exists({
      collaborationId: d._id,
      state: "SUBMITTED",
    }).session(c.session)),
    409,
    "FUNDING_PENDING",
    "A reference is already awaiting review.",
  );
  if (b.proofAssetId) {
    const asset = await ownAsset(c, b.proofAssetId, "EVIDENCE");
    assert(
      same(asset.collaborationId, d._id),
      422,
      "EVIDENCE_SCOPE",
      "Proof belongs to another collaboration.",
    );
  }
  const f = await create(
    M.Funding,
    {
      ...b,
      collaborationId: d._id,
      brandOrganizationId: d.brandOrganizationId,
      submittedByUserId: c.user._id,
      externalReferenceNormalized: b.externalReference
        .replace(/\s/g, "")
        .toUpperCase(),
    },
    c,
  );
  d.updatedAt = new Date();
  d.markModified("updatedAt");
  await save(d, c);
  await event(
    c,
    "FUNDING_SUBMITTED",
    d,
    (await M.User.find({ platformRole: "OWNER" }).session(c.session)).map(
      (u) => u._id,
    ),
  );
  return f;
}
export async function verifyFunding(c, b, p, reject = false) {
  P.owner(c);
  const f = await get(M.Funding, p.fundingId, c);
  expected(f, b);
  assert(
    f.state === "SUBMITTED",
    409,
    "FUNDING_STATE",
    "Funding was already reviewed.",
  );
  const d = await get(M.Collaboration, f.collaborationId, c);
  assert(!d.openDisputeId, 409, "DISPUTED", "Resolve the dispute first.");
  if (reject) {
    f.state = "REJECTED";
    f.reviewNote = b.reason;
  } else {
    const a = await get(M.Agreement, d.agreementId, c);
    assert(
      d.fundingState === "AWAITING" && a.amountMinor === f.amountMinor,
      409,
      "ALREADY_FUNDED",
      "Agreement is already funded or amount changed.",
    );
    f.state = "VERIFIED";
    f.reviewNote = b.note;
    f.verificationReference = b.verificationReference;
    f.verifiedAt = new Date();
    d.fundingState = "HELD";
    await save(d, c);
    const w = await wallet(c, "BRAND", d.brandOrganizationId);
    w.heldMinor += f.amountMinor;
    await save(w, c);
    await journal(c, "FUNDING", f._id, d._id, [
      e("BANK", PLATFORM, f.amountMinor),
      e("CLIENT_HELD", d.brandOrganizationId, 0, f.amountMinor),
    ]);
  }
  f.reviewedByUserId = c.user._id;
  await save(f, c);
  await event(c, reject ? "FUNDING_REJECTED" : "FUNDING_VERIFIED", d);
  return f;
}
export async function stats(c, id) {
  const p = await get(M.CreatorProfile, id, c);
  const rows = await M.Review.aggregate([
    { $match: { targetType: "CREATOR", targetId: p._id } },
    { $group: { _id: null, average: { $avg: "$stars" }, count: { $sum: 1 } } },
  ]).session(c.session);
  p.completedCount = await M.Collaboration.countDocuments({
    creatorProfileId: p._id,
    workState: "COMPLETED",
  }).session(c.session);
  p.ratingAverage = rows[0]?.average || 0;
  p.ratingCount = rows[0]?.count || 0;
  return save(p, c);
}
export async function release(c, d, dispute = false) {
  assert(
    !["COMPLETED", "REFUND_PENDING", "REFUNDED"].includes(d.workState),
    409,
    "ALREADY_SETTLED",
    "Already settled.",
  );
  if (!dispute)
    assert(
      d.workState === "VERIFIED" &&
        !d.openDisputeId &&
        ["NOT_REQUIRED", "RECEIVED"].includes(d.productState),
      409,
      "COMPLETION_REQUIRED",
      "Verified completion and valid product receipt are required.",
    );
  const a = await get(M.Agreement, d.agreementId, c);
  if (a.amountMinor) {
    assert(
      d.fundingState === "HELD",
      409,
      "FUNDING_REQUIRED",
      "Verified funding required.",
    );
    const brand = await wallet(c, "BRAND", d.brandOrganizationId),
      creator = await wallet(c, "CREATOR", d.creatorProfileId),
      platform = await wallet(c, "PLATFORM", PLATFORM);
    assert(
      brand.heldMinor >= a.amountMinor,
      409,
      "BALANCE",
      "Insufficient held balance.",
    );
    brand.heldMinor -= a.amountMinor;
    creator.availableMinor += a.creatorNetMinor;
    platform.availableMinor += a.feeMinor;
    await save(brand, c);
    await save(creator, c);
    await save(platform, c);
    await journal(c, "RELEASE", d._id, d._id, [
      e("CLIENT_HELD", d.brandOrganizationId, a.amountMinor),
      e("CREATOR_AVAILABLE", d.creatorProfileId, 0, a.creatorNetMinor),
      e("PLATFORM_REVENUE", PLATFORM, 0, a.feeMinor),
    ]);
    d.fundingState = "RELEASED";
  }
  d.workState = "COMPLETED";
  d.openDisputeId = undefined;
  await save(d, c);
  await stats(c, d.creatorProfileId);
  await event(c, "COLLABORATION_SETTLED", d);
  return d;
}
export async function withdrawal(c, b) {
  const cp = P.creator(c),
    w = await wallet(c, "CREATOR", cp._id);
  assert(
    w.availableMinor >= b.amountMinor,
    409,
    "INSUFFICIENT_BALANCE",
    "Insufficient available balance.",
  );
  w.availableMinor -= b.amountMinor;
  w.reservedMinor += b.amountMinor;
  await save(w, c);
  const raw = b.destination,
    d = await create(
      M.Withdrawal,
      {
        creatorProfileId: cp._id,
        walletId: w._id,
        amountMinor: b.amountMinor,
        destinationEncrypted: encrypt(raw),
        destinationMasked:
          "••••" +
          (raw.type === "UPI"
            ? raw.upiId.slice(-5)
            : raw.accountNumber.slice(-4)),
        requestedAt: new Date(),
      },
      c,
    );
  await journal(c, "WITHDRAWAL_RESERVATION", d._id, null, [
    e("CREATOR_AVAILABLE", cp._id, b.amountMinor),
    e("CREATOR_RESERVED", cp._id, 0, b.amountMinor),
  ]);
  await event(
    c,
    "WITHDRAWAL_REQUESTED",
    d,
    (await M.User.find({ platformRole: "OWNER" }).session(c.session)).map(
      (u) => u._id,
    ),
  );
  return d;
}
export async function withdrawalDetail(c, id) {
  const d = await M.Withdrawal.findById(id)
    .select("+destinationEncrypted")
    .session(c.session);
  assert(
    d &&
      (c.user.platformRole === "OWNER" ||
        same(c.creator?._id, d.creatorProfileId)),
    404,
    "NOT_FOUND",
    "Withdrawal unavailable.",
  );
  return { ...d.toJSON(), destination: decrypt(d.destinationEncrypted) };
}
export async function payout(c, b, p, action) {
  P.owner(c);
  if (action === "complete")
    assert(
      new Date(b.paidAt) <= new Date(),
      422,
      "TRANSFER_DATE",
      "Actual transfer date cannot be in the future.",
    );
  const d = await get(M.Withdrawal, p.withdrawalId, c);
  expected(d, b);
  assert(
    ["REQUESTED", "PROCESSING"].includes(d.state),
    409,
    "PAYOUT_CLOSED",
    "Payout already closed.",
  );
  const w = await get(M.Wallet, d.walletId, c);
  assert(
    w.reservedMinor >= d.amountMinor,
    409,
    "RESERVATION_MISSING",
    "Reserved funds are missing.",
  );
  if (action === "process") {
    assert(
      d.state === "REQUESTED",
      409,
      "ALREADY_PROCESSING",
      "Already processing.",
    );
    d.state = "PROCESSING";
  } else if (action === "complete") {
    assert(
      d.state === "PROCESSING",
      409,
      "PROCESS_FIRST",
      "Start processing before recording a transfer.",
    );
    d.state = "PAID";
    d.transferReference = b.actualTransferReference.trim().toUpperCase();
    d.paidAt = b.paidAt;
    w.reservedMinor -= d.amountMinor;
    await save(w, c);
    await journal(c, "PAYOUT", d._id, null, [
      e("CREATOR_RESERVED", d.creatorProfileId, d.amountMinor),
      e("BANK", PLATFORM, 0, d.amountMinor),
    ]);
  } else {
    d.state = "REJECTED";
    d.rejectionReason = b.reason;
    w.reservedMinor -= d.amountMinor;
    w.availableMinor += d.amountMinor;
    await save(w, c);
    await journal(c, "RESERVATION_REVERSAL", d._id, null, [
      e("CREATOR_RESERVED", d.creatorProfileId, d.amountMinor),
      e("CREATOR_AVAILABLE", d.creatorProfileId, 0, d.amountMinor),
    ]);
  }
  d.processedByUserId = c.user._id;
  await save(d, c);
  await event(c, "WITHDRAWAL_" + d.state, d, [
    (await get(M.CreatorProfile, d.creatorProfileId, c)).userId,
  ]);
  return d;
}
export async function refundObligation(c, d, dispute) {
  const a = await get(M.Agreement, d.agreementId, c);
  assert(
    a.amountMinor > 0 && d.fundingState === "HELD",
    409,
    "NO_REFUNDABLE_FUNDS",
    "No verified held funds are available for refund.",
  );
  const r = await create(
    M.Refund,
    {
      collaborationId: d._id,
      disputeId: dispute._id,
      brandOrganizationId: d.brandOrganizationId,
      amountMinor: a.amountMinor,
    },
    c,
  );
  await journal(c, "REFUND_OBLIGATION", r._id, d._id, [
    e("CLIENT_HELD", d.brandOrganizationId, a.amountMinor),
    e("REFUND_PAYABLE", d.brandOrganizationId, 0, a.amountMinor),
  ]);
  d.workState = "REFUND_PENDING";
  d.fundingState = "REFUND_PENDING";
  d.openDisputeId = undefined;
  await save(d, c);
  return r;
}
export async function refundTransfer(c, b, p, action) {
  P.owner(c);
  if (action === "complete")
    assert(
      new Date(b.paidAt) <= new Date(),
      422,
      "TRANSFER_DATE",
      "Actual transfer date cannot be in the future.",
    );
  const r = await get(M.Refund, p.refundId, c);
  expected(r, b);
  if (action === "process") {
    assert(r.state === "PENDING", 409, "REFUND_STATE", "Already processing.");
    r.state = "PROCESSING";
  } else {
    assert(
      r.state === "PROCESSING",
      409,
      "REFUND_STATE",
      "Start processing first.",
    );
    const d = await get(M.Collaboration, r.collaborationId, c),
      w = await wallet(c, "BRAND", d.brandOrganizationId);
    assert(
      w.heldMinor >= r.amountMinor,
      409,
      "BALANCE",
      "Insufficient held balance.",
    );
    w.heldMinor -= r.amountMinor;
    await save(w, c);
    r.state = "PAID";
    r.transferReference = b.actualTransferReference.trim().toUpperCase();
    r.processedAt = b.paidAt;
    d.workState = "REFUNDED";
    d.fundingState = "REFUNDED";
    await save(d, c);
    if (d.agencyOrganizationId) {
      const rel = await M.AgencyClient.findOne({
        agencyOrganizationId: d.agencyOrganizationId,
        brandOrganizationId: d.brandOrganizationId,
      }).session(c.session);
      rel.committedMinor -= r.amountMinor;
      await save(rel, c);
    }
    if (d.campaignId) {
      const cam = await get(M.Campaign, d.campaignId, c);
      cam.committedMinor -= r.amountMinor;
      cam.reservedSpots--;
      await save(cam, c);
    }
    await journal(c, "REFUND_TRANSFER", r._id, d._id, [
      e("REFUND_PAYABLE", d.brandOrganizationId, r.amountMinor),
      e("BANK", PLATFORM, 0, r.amountMinor),
    ]);
  }
  r.processedByUserId = c.user._id;
  await save(r, c);
  await event(c, "REFUND_UPDATED", r);
  return r;
}
export async function scoped(c, Model, q) {
  let f = {};
  if (c.user.platformRole !== "OWNER") {
    const ids = await M.Collaboration.find(P.filter(c))
      .distinct("_id")
      .session(c.session);
    f = { collaborationId: { $in: ids } };
    if (Model === M.LedgerTransaction && c.creator && !c.organizationId) {
      const withdrawals = await M.Withdrawal.find({
        creatorProfileId: c.creator._id,
      })
        .distinct("_id")
        .session(c.session);
      f = { $or: [f, { sourceId: { $in: withdrawals } }] };
    }
  }
  if (q.clientId || q.campaignId) {
    const workFilter = {
      $and: [
        P.filter(c),
        ...(q.clientId ? [{ brandOrganizationId: q.clientId }] : []),
        ...(q.campaignId ? [{ campaignId: q.campaignId }] : []),
      ],
    };
    const workIds = await M.Collaboration.find(workFilter)
      .distinct("_id")
      .session(c.session);
    f = { $and: [f, { collaborationId: { $in: workIds } }] };
  }
  for (const key of ["collaborationId", "state", "kind"])
    if (q[key]) f = { $and: [f, { [key]: q[key] }] };
  if (q.from || q.to)
    f = {
      $and: [
        f,
        {
          createdAt: {
            ...(q.from ? { $gte: new Date(q.from) } : {}),
            ...(q.to ? { $lte: new Date(q.to) } : {}),
          },
        },
      ],
    };
  const result = await list(Model, f, c, q);
  if (Model === M.LedgerTransaction) {
    result.data = await Promise.all(
      result.data.map(async (row) => {
        const work = row.collaborationId
          ? await M.Collaboration.findById(row.collaborationId)
              .populate("agreementId")
              .session(c.session)
          : null;
        return {
          ...row.toJSON(),
          grossMinor: work?.agreementId?.amountMinor,
          feeMinor: work?.agreementId?.feeMinor,
          creatorNetMinor: work?.agreementId?.creatorNetMinor,
          fundingState: work?.fundingState,
        };
      }),
    );
  }
  return result;
}
export async function charge(c, b) {
  const { org } = P.chosen(c);
  P.admin(c, org._id);
  assert(org.type === "AGENCY", 403, "AGENCY_REQUIRED", "Choose an agency.");
  await P.clientContext(c, b.clientId);
  if (b.campaignId) {
    const d = await P.campaign(c, b.campaignId, true);
    assert(
      same(d.brandOrganizationId, b.clientId),
      422,
      "CLIENT_MISMATCH",
      "Wrong client.",
    );
  }
  if (b.collaborationId) {
    const d = await P.collab(c, b.collaborationId, { commissioner: true });
    assert(
      same(d.brandOrganizationId, b.clientId),
      422,
      "CLIENT_MISMATCH",
      "Wrong client.",
    );
  }
  const d = await create(
    M.AgencyCharge,
    {
      agencyOrganizationId: org._id,
      brandOrganizationId: b.clientId,
      campaignId: b.campaignId,
      collaborationId: b.collaborationId,
      kind: b.kind,
      agreedAmountMinor: b.amountMinor,
      description: b.description,
    },
    c,
  );
  await event(c, "AGENCY_CHARGE_AGREED", d);
  return d;
}
export async function chargeDecision(c, b, p, waive = false) {
  const d = await get(M.AgencyCharge, p.chargeId, c);
  P.admin(c, d.agencyOrganizationId);
  expected(d, b);
  assert(d.state === "AGREED", 409, "CHARGE_CLOSED", "Charge already closed.");
  d.state = waive ? "WAIVED" : "SETTLED";
  if (!waive) {
    assert(
      new Date(b.settledAt) <= new Date(),
      422,
      "TRANSFER_DATE",
      "Actual payment date cannot be in the future.",
    );
    d.externalReference = b.externalReference;
    d.settledAt = b.settledAt;
  }
  await save(d, c);
  await event(c, "AGENCY_CHARGE_" + d.state, d);
  return d;
}
export async function summary(c) {
  if (c.creator && !c.organizationId) {
    const w = await wallet(c, "CREATOR", c.creator._id),
      deals = await M.Collaboration.find({ creatorProfileId: c.creator._id })
        .populate("agreementId")
        .session(c.session),
      paid = await M.Withdrawal.find({
        creatorProfileId: c.creator._id,
        state: "PAID",
      }).session(c.session);
    return {
      ...w.toJSON(),
      earnedMinor: deals
        .filter((d) => d.workState === "COMPLETED")
        .reduce((n, d) => n + d.agreementId.creatorNetMinor, 0),
      pendingMinor: deals
        .filter((d) => d.fundingState === "HELD")
        .reduce((n, d) => n + d.agreementId.creatorNetMinor, 0),
      withdrawnMinor: paid.reduce((n, d) => n + d.amountMinor, 0),
    };
  }
  const { org } = P.chosen(c);
  if (org.type === "BRAND") {
    const w = await wallet(c, "BRAND", org._id),
      settings = await M.PlatformSettings.findOne()
        .sort({ version: -1 })
        .session(c.session);
    return {
      ...w.toJSON(),
      fundingInstructions: settings?.fundingInstructions,
    };
  }
  const deals = await M.Collaboration.find(P.filter(c))
    .populate("agreementId")
    .session(c.session);
  return {
    heldMinor: deals
      .filter((d) => ["HELD", "REFUND_PENDING"].includes(d.fundingState))
      .reduce((n, d) => n + d.agreementId.amountMinor, 0),
  };
}
