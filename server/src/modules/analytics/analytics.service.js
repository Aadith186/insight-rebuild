import * as M from "../../models.js";
import { filter, chosen } from "../../core/policy.js";
import { assert, same } from "../../core/db.js";
export function monthKey(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date(date));
  return (
    parts.find((p) => p.type === "year").value +
    "-" +
    parts.find((p) => p.type === "month").value
  );
}
export function makeMonths(from, to) {
  const start = new Date(from),
    end = new Date(to),
    rows = [];
  const [sy, sm] = monthKey(start).split("-").map(Number),
    [ey, em] = monthKey(end).split("-").map(Number);
  let year = sy,
    month = sm - 1;
  while (year < ey || (year === ey && month <= em - 1)) {
    rows.push({
      key: `${year}-${String(month + 1).padStart(2, "0")}`,
      label: new Date(Date.UTC(year, month, 15)).toLocaleDateString("en-IN", {
        month: "short",
        year: "2-digit",
        timeZone: "UTC",
      }),
      fundedMinor: 0,
      earnedMinor: 0,
      feeMinor: 0,
      withdrawnMinor: 0,
      refundedMinor: 0,
      completed: 0,
    });
    month++;
    if (month === 12) {
      month = 0;
      year++;
    }
    assert(
      rows.length <= 25,
      422,
      "DATE_RANGE",
      "Choose a period up to 24 months.",
    );
  }
  return rows;
}
export function sumAccount(j, code, side, ownerId) {
  return j.entries
    .filter(
      (e) => e.accountCode === code && (!ownerId || same(e.ownerId, ownerId)),
    )
    .reduce((n, e) => n + (e[side] || 0), 0);
}
export async function overview(c, q) {
  const now = new Date(),
    to = q.to
      ? new Date(
          /^\d{4}-\d{2}-\d{2}$/.test(q.to)
            ? q.to + "T23:59:59.999+05:30"
            : q.to,
        )
      : now,
    from = q.from
      ? new Date(
          /^\d{4}-\d{2}-\d{2}$/.test(q.from)
            ? q.from + "T00:00:00+05:30"
            : q.from,
        )
      : new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1) -
            330 * 60000,
        );
  assert(from <= to, 422, "DATE_RANGE", "Start date must precede end date.");
  assert(
    to - from <= 732 * 86400000,
    422,
    "DATE_RANGE",
    "Choose a period up to 24 months.",
  );
  const series = makeMonths(from, to),
    byKey = new Map(series.map((r) => [r.key, r])),
    scope = filter(c),
    owner = c.user.platformRole === "OWNER" && !c.organizationId,
    creator = !!c.creator && !c.organizationId;
  const member = c.organizationId ? chosen(c).m : null,
    financialAccess = member?.role !== "CLIENT_REVIEWER";
  const works = await M.Collaboration.find(scope)
    .populate("agreementId")
    .select(
      "agreementId campaignId brandOrganizationId creatorProfileId workState fundingState dueAt createdAt updatedAt",
    )
    .lean()
    .session(c.session);
  const workIds = works.map((w) => w._id),
    states = new Map(),
    formats = new Map();
  let agreedMinor = 0,
    heldMinor = 0,
    completed = 0,
    active = 0;
  for (const w of works) {
    states.set(w.workState, (states.get(w.workState) || 0) + 1);
    const name = w.agreementId?.formatSnapshot?.label || "Other";
    formats.set(name, (formats.get(name) || 0) + 1);
    agreedMinor += w.agreementId?.amountMinor || 0;
    if (["HELD", "REFUND_PENDING"].includes(w.fundingState))
      heldMinor += w.agreementId?.amountMinor || 0;
    if (w.workState === "COMPLETED") completed++;
    if (!["COMPLETED", "REFUNDED", "REFUND_PENDING"].includes(w.workState))
      active++;
  }
  let ledgerScope = owner ? {} : { collaborationId: { $in: workIds } };
  if (creator)
    ledgerScope = { $or: [ledgerScope, { "entries.ownerId": c.creator._id }] };
  if (financialAccess) {
    const cursor = M.LedgerTransaction.find({
      $and: [ledgerScope, { createdAt: { $gte: from, $lte: to } }],
    })
      .select("kind entries createdAt collaborationId sourceId")
      .session(c.session)
      .cursor();
    for await (const j of cursor) {
      const b = byKey.get(monthKey(j.createdAt));
      if (!b) continue;
      if (j.kind === "FUNDING")
        b.fundedMinor += sumAccount(j, "CLIENT_HELD", "creditMinor");
      if (j.kind === "RELEASE") {
        b.earnedMinor += sumAccount(
          j,
          "CREATOR_AVAILABLE",
          "creditMinor",
          creator ? c.creator._id : null,
        );
        b.feeMinor += sumAccount(j, "PLATFORM_REVENUE", "creditMinor");
        b.completed++;
      }
      if (j.kind === "PAYOUT" && (creator || owner))
        b.withdrawnMinor += sumAccount(
          j,
          "CREATOR_RESERVED",
          "debitMinor",
          creator ? c.creator._id : null,
        );
      if (j.kind === "REFUND_TRANSFER")
        b.refundedMinor += sumAccount(j, "REFUND_PAYABLE", "debitMinor");
    }
  }
  const totals = series.reduce(
    (t, r) => Object.fromEntries(Object.keys(t).map((k) => [k, t[k] + r[k]])),
    {
      fundedMinor: 0,
      earnedMinor: 0,
      feeMinor: 0,
      withdrawnMinor: 0,
      refundedMinor: 0,
    },
  );
  const wallet = creator
    ? await M.Wallet.findOne({
        ownerType: "CREATOR",
        ownerId: c.creator._id,
        currency: "INR",
      })
        .select("availableMinor reservedMinor")
        .lean()
        .session(c.session)
    : null;
  const campaigns = await M.Campaign.find(filter(c, { campaign: true }))
    .select(
      "draft.title titleNormalized compensationBudgetMinor committedMinor state",
    )
    .lean()
    .session(c.session);
  const reportCampaigns = creator
    ? []
    : campaigns
        .slice(0, 12)
        .map((x) => ({
          id: String(x._id),
          label: x.draft?.title || x.titleNormalized,
          budgetMinor: x.compensationBudgetMinor,
          committedMinor: x.committedMinor,
          state: x.state,
        }));
  return {
    range: {
      from: from.toISOString(),
      to: to.toISOString(),
      timezone: "Asia/Kolkata",
    },
    financialAccess,
    series: financialAccess
      ? series
      : series.map((r) => ({
          key: r.key,
          label: r.label,
          completed: r.completed,
        })),
    totals: financialAccess
      ? {
          ...totals,
          agreedMinor,
          heldMinor,
          availableMinor: wallet?.availableMinor || 0,
          reservedMinor: wallet?.reservedMinor || 0,
        }
      : null,
    work: {
      total: works.length,
      completed,
      active,
      completionRate: works.length
        ? Math.round((completed / works.length) * 100)
        : 0,
    },
    states: [...states].map(([name, value]) => ({ name, value })),
    formats: [...formats].map(([name, value]) => ({ name, value })),
    campaigns: financialAccess ? reportCampaigns : [],
    definitions: {
      earnedMinor: "Net creator credits from settled releases in this period.",
      feeMinor: "Platform fees from settled releases in this period.",
      heldMinor:
        "Current gross funds awaiting release/refund, independent of the period.",
      withdrawnMinor:
        "Recorded payout journal entries in this period; not transfers initiated by this software.",
      agreedMinor:
        "Current accepted agreement gross values, not realized revenue.",
    },
  };
}
