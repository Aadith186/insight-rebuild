import * as M from "../models.js";
import { get, same, assert } from "./db.js";
export async function identity(user, session) {
  const memberships = await M.Membership.find({
      userId: user._id,
      status: "ACTIVE",
    }).session(session || null),
    orgs = await M.Organization.find({
      _id: { $in: memberships.map((m) => m.organizationId) },
      suspendedAt: null,
    }).session(session || null);
  return {
    user,
    memberships: memberships.filter((m) =>
      orgs.some((o) => same(o._id, m.organizationId)),
    ),
    organizations: orgs,
    creator: await M.CreatorProfile.findOne({ userId: user._id }).session(
      session || null,
    ),
  };
}
export const owner = (c) =>
  assert(
    c.user.platformRole === "OWNER",
    403,
    "OWNER_ONLY",
    "Owner access required.",
  );
export const creator = (c) => {
  assert(c.creator, 403, "CREATOR_ONLY", "Creator access required.");
  return c.creator;
};
export function member(c, org, roles) {
  const m = c.memberships.find(
    (m) =>
      (!c.organizationId || same(c.organizationId, org)) &&
      same(m.organizationId, org) &&
      (!roles || roles.includes(m.role)),
  );
  assert(m, 404, "NOT_FOUND", "Workspace unavailable.");
  return m;
}
export const admin = (c, org) => member(c, org, ["ORG_ADMIN"]);
export function chosen(c) {
  assert(
    c.organizationId,
    422,
    "WORKSPACE_REQUIRED",
    "Choose an organization workspace.",
  );
  const m = member(c, c.organizationId);
  return { m, org: c.organizations.find((o) => same(o._id, c.organizationId)) };
}
export function hasScope(m, brand, campaign, collaboration) {
  return (
    m.role === "ORG_ADMIN" ||
    m.clientScopes.some(
      (s) =>
        same(s.clientBrandId, brand) &&
        (s.allCampaigns ||
          (campaign && s.campaignIds.some((i) => same(i, campaign))) ||
          (collaboration &&
            s.directCollaborationIds.some((i) => same(i, collaboration)))),
    )
  );
}
export const campaignId = (r) =>
  r.campaignId || (r.constructor?.modelName === "Campaign" ? r._id : null);
export const collaborationId = (r) =>
  r.collaborationId ||
  (r.constructor?.modelName === "Collaboration" ? r._id : null);
export function operator(c, r) {
  return c.memberships.find(
    (m) =>
      (!c.organizationId || same(c.organizationId, m.organizationId)) &&
      (!c.clientId || same(c.clientId, r.brandOrganizationId)) &&
      same(m.organizationId, r.agencyOrganizationId || r.brandOrganizationId) &&
      m.role !== "CLIENT_REVIEWER" &&
      hasScope(m, r.brandOrganizationId, campaignId(r), collaborationId(r)),
  );
}
export async function commission(c, r) {
  assert(operator(c, r), 404, "NOT_FOUND", "This work is unavailable.");
  const b = await get(M.Organization, r.brandOrganizationId, c);
  assert(!b.suspendedAt, 403, "SUSPENDED", "Client is suspended.");
  return r;
}
export async function party(
  c,
  r,
  {
    write = false,
    commissioner = false,
    creatorOnly = false,
    reviewer = true,
  } = {},
) {
  if (["Agreement", "Offer"].includes(r.constructor?.modelName)) {
    const linked = await M.Collaboration.findOne(
      r.constructor.modelName === "Agreement"
        ? { agreementId: r._id }
        : {
            agreementId: {
              $in: await M.Agreement.find({ offerId: r._id })
                .distinct("_id")
                .session(c.session || null),
            },
          },
    ).session(c.session || null);
    if (linked)
      return party(c, linked, { write, commissioner, creatorOnly, reviewer });
  }
  if (c.user.platformRole === "OWNER" && !write) return "OWNER";
  if (creatorOnly) {
    assert(
      same(c.creator?._id, r.creatorProfileId),
      404,
      "NOT_FOUND",
      "Work unavailable.",
    );
    return "CREATOR";
  }
  if (commissioner) {
    await commission(c, r);
    return "COMMISSIONER";
  }
  if (same(c.creator?._id, r.creatorProfileId)) return "CREATOR";
  if (operator(c, r)) return "COMMISSIONER";
  if (
    reviewer &&
    !write &&
    c.memberships.some(
      (m) =>
        m.role === "CLIENT_REVIEWER" &&
        same(m.organizationId, r.agencyOrganizationId) &&
        hasScope(m, r.brandOrganizationId, campaignId(r), collaborationId(r)),
    )
  )
    return "REVIEWER";
  assert(false, 404, "NOT_FOUND", "Work unavailable.");
}
export async function campaign(c, id, write = false) {
  const r = await get(M.Campaign, id, c);
  if (write) return commission(c, r);
  if (c.user.platformRole === "OWNER" || operator(c, r)) return r;
  if (
    c.memberships.some(
      (m) =>
        m.role === "CLIENT_REVIEWER" &&
        same(m.organizationId, r.agencyOrganizationId) &&
        hasScope(m, r.brandOrganizationId, r._id),
    )
  )
    return r;
  if (
    c.creator &&
    (r.state === "PUBLISHED" ||
      (r.state === "CLOSED" &&
        (await M.Application.exists({
          campaignId: r._id,
          creatorProfileId: c.creator._id,
        }).session(c.session || null))))
  )
    return r;
  assert(false, 404, "NOT_FOUND", "Campaign unavailable.");
}
export async function collab(c, id, opts = {}) {
  const r = await get(M.Collaboration, id, c);
  await party(c, r, opts);
  if (opts.write)
    assert(
      !r.openDisputeId,
      409,
      "DISPUTED",
      "This work is frozen during the dispute.",
    );
  return r;
}
export function filter(
  c,
  { campaign = false, reviewers = true, creator = true } = {},
) {
  if (c.user.platformRole === "OWNER") return {};
  const clauses = [];
  if (c.creator && creator && !c.organizationId)
    clauses.push(
      campaign ? { state: "PUBLISHED" } : { creatorProfileId: c.creator._id },
    );
  for (const m of c.memberships) {
    if (
      (c.organizationId && !same(c.organizationId, m.organizationId)) ||
      (!reviewers && m.role === "CLIENT_REVIEWER")
    )
      continue;
    const org = c.organizations.find((o) => same(o._id, m.organizationId));
    if (!org) continue;
    const base =
      org.type === "AGENCY"
        ? { agencyOrganizationId: org._id }
        : { brandOrganizationId: org._id, agencyOrganizationId: null };
    if (m.role === "ORG_ADMIN") clauses.push(base);
    else
      for (const s of m.clientScopes) {
        const f = { ...base, brandOrganizationId: s.clientBrandId };
        if (s.allCampaigns) clauses.push(f);
        else {
          if (s.campaignIds.length)
            clauses.push({
              ...f,
              [campaign ? "_id" : "campaignId"]: { $in: s.campaignIds },
            });
          if (!campaign && s.directCollaborationIds.length)
            clauses.push({
              ...f,
              $or: [
                { _id: { $in: s.directCollaborationIds } },
                { collaborationId: { $in: s.directCollaborationIds } },
              ],
            });
        }
      }
  }
  return c.clientId
    ? { $and: [{ $or: clauses }, { brandOrganizationId: c.clientId }] }
    : { $or: clauses };
}
export async function clientContext(c, brand, newWork = false) {
  assert(
    !c.clientId || same(c.clientId, brand),
    403,
    "CLIENT_CONTEXT",
    "Choose the matching client workspace.",
  );
  const { m, org } = chosen(c);
  assert(
    m.role !== "CLIENT_REVIEWER",
    403,
    "REVIEWER_READ_ONLY",
    "Client reviewers cannot commission work.",
  );
  if (org.type === "BRAND") {
    assert(same(brand, org._id), 403, "CLIENT_SCOPE", "Choose your own brand.");
    return { brandOrganizationId: org._id };
  }
  const rel = await M.AgencyClient.findOne({
    agencyOrganizationId: org._id,
    brandOrganizationId: brand,
  }).session(c.session || null);
  assert(rel, 404, "NOT_FOUND", "Client unavailable.");
  const client = await get(M.Organization, rel.brandOrganizationId, c);
  assert(!client.suspendedAt, 403, "SUSPENDED", "Client account is suspended.");
  assert(
    !newWork || rel.status === "ACTIVE",
    409,
    "CLIENT_ARCHIVED",
    "Client is archived.",
  );
  assert(
    m.role === "ORG_ADMIN" ||
      m.clientScopes.some(
        (s) => same(s.clientBrandId, brand) && (!newWork || s.allCampaigns),
      ),
    403,
    "CLIENT_SCOPE",
    "Insufficient client access.",
  );
  return {
    brandOrganizationId: rel.brandOrganizationId,
    agencyOrganizationId: org._id,
  };
}
export async function validateScopes(c, orgId, scopes) {
  const org = await get(M.Organization, orgId, c);
  for (const s of scopes) {
    assert(
      (same(org._id, s.clientBrandId) && org.type === "BRAND") ||
        (await M.AgencyClient.exists({
          agencyOrganizationId: orgId,
          brandOrganizationId: s.clientBrandId,
        }).session(c.session)),
      422,
      "CLIENT_SCOPE",
      "Unknown client.",
    );
    for (const id of s.campaignIds) {
      const d = await get(M.Campaign, id, c);
      assert(
        same(d.brandOrganizationId, s.clientBrandId) &&
          same(d.agencyOrganizationId || d.brandOrganizationId, orgId),
        422,
        "CAMPAIGN_SCOPE",
        "Campaign does not belong to this client.",
      );
    }
    for (const id of s.directCollaborationIds) {
      const d = await get(M.Collaboration, id, c);
      assert(
        same(d.brandOrganizationId, s.clientBrandId) &&
          same(d.agencyOrganizationId || d.brandOrganizationId, orgId),
        422,
        "WORK_SCOPE",
        "Work does not belong to this client.",
      );
    }
  }
}

export async function eligibleReviewers(c, r) {
  if (!r.agencyOrganizationId || !operator(c, r)) return [];
  const ms = await M.Membership.find({
    status: "ACTIVE",
    $or: [
      { organizationId: r.brandOrganizationId, role: "ORG_ADMIN" },
      { organizationId: r.agencyOrganizationId, role: "CLIENT_REVIEWER" },
    ],
  }).session(c.session || null);
  const ids = ms
    .filter(
      (m) =>
        same(m.organizationId, r.brandOrganizationId) ||
        hasScope(m, r.brandOrganizationId, campaignId(r), collaborationId(r)),
    )
    .map((m) => m.userId)
    .filter(
      (id) =>
        !same(id, c.user._id) &&
        !same(id, r.preparedByUserId || r.createdByUserId),
    );
  const users = await M.User.find({ _id: { $in: ids }, status: "ACTIVE" })
    .select("name")
    .session(c.session || null);
  return users.map((u) => ({ value: String(u._id), label: u.name }));
}
