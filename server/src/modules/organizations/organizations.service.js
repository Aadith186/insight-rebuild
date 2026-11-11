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
import { admin, member } from "../../core/policy.js";
import { event } from "../../core/events.js";
import { ownAsset } from "../creators/creators.service.js";
export async function profile(c, id) {
  const o = await get(M.Organization, id, c),
    authorized =
      c.user.platformRole === "OWNER" ||
      c.memberships.some((m) => same(m.organizationId, id));
  const visible = authorized
    ? o.toJSON()
    : {
        id: String(o._id),
        name: o.name,
        type: o.type,
        description: o.description,
        city: o.city,
        website: o.website,
        logoAssetId: o.logoAssetId,
        verificationStatus: o.verificationStatus,
      };
  const [reviews, completedCount] = await Promise.all([
    M.Review.find({ targetType: "BRAND", targetId: id })
      .select("stars")
      .session(c.session),
    M.Collaboration.countDocuments({
      brandOrganizationId: id,
      workState: "COMPLETED",
    }).session(c.session),
  ]);
  return {
    ...visible,
    completedCount,
    ratingCount: reviews.length,
    ratingAverage: reviews.length
      ? reviews.reduce((n, r) => n + r.stars, 0) / reviews.length
      : 0,
  };
}
export async function update(c, b, p) {
  admin(c, p.organizationId);
  const o = await get(M.Organization, p.organizationId, c);
  expected(o, b);
  const { expectedVersion, ...data } = b;
  if (data.logoAssetId) {
    const a = await ownAsset(c, data.logoAssetId, "AVATAR");
    a.visibility = "PUBLIC";
    await save(a, c);
  }
  Object.assign(o, data);
  if (data.name) o.nameNormalized = data.name.toLowerCase();
  await save(o, c);
  await event(c, "ORGANIZATION_UPDATED", o);
  return o;
}
export async function clients(c, p, q) {
  const m = member(c, p.agencyId),
    f = { agencyOrganizationId: p.agencyId };
  if (m.role !== "ORG_ADMIN")
    f.brandOrganizationId = { $in: m.clientScopes.map((s) => s.clientBrandId) };
  if (q.status) f.status = q.status;
  const result = await list(M.AgencyClient, f, c, q);
  result.data = await Promise.all(
    result.data.map(async (r) => ({
      ...r.toJSON(),
      brand: await profile(c, r.brandOrganizationId),
    })),
  );
  return result;
}
export async function client(c, p) {
  const m = member(c, p.agencyId),
    d = await get(M.AgencyClient, p.clientId, c, {
      agencyOrganizationId: p.agencyId,
    });
  assert(
    m.role === "ORG_ADMIN" ||
      m.clientScopes.some((s) => same(s.clientBrandId, d.brandOrganizationId)),
    404,
    "NOT_FOUND",
    "Client unavailable.",
  );
  return d;
}
export async function add(c, b, p) {
  admin(c, p.agencyId);
  const org = await get(M.Organization, p.agencyId, c);
  assert(org.type === "AGENCY", 422, "AGENCY_REQUIRED", "Choose an agency.");
  let brand;
  if (b.brandOrganizationId) {
    admin(c, b.brandOrganizationId);
    brand = await get(M.Organization, b.brandOrganizationId, c);
    assert(brand.type === "BRAND", 422, "BRAND_REQUIRED", "Choose a brand.");
  } else
    brand = await create(
      M.Organization,
      {
        type: "BRAND",
        name: b.name,
        nameNormalized: b.name.toLowerCase(),
        description: b.description,
        city: b.city,
        contactEmail: b.contactEmail,
        contactPhone: b.contactPhone,
        website: b.website,
      },
      c,
    );
  for (const id of b.contactUserIds) await get(M.User, id, c);
  const d = await create(
    M.AgencyClient,
    {
      agencyOrganizationId: org._id,
      brandOrganizationId: brand._id,
      budgetMinor: b.budgetMinor,
      retainerChargeMinor: b.retainerChargeMinor,
      contactUserIds: b.contactUserIds,
    },
    c,
  );
  await event(c, "CLIENT_CREATED", d);
  return { ...d.toJSON(), brand };
}
export async function edit(c, b, p) {
  admin(c, p.agencyId);
  const d = await client(c, p);
  expected(d, b);
  const {
    expectedVersion,
    budgetMinor,
    retainerChargeMinor,
    contactUserIds,
    ...data
  } = b;
  if (budgetMinor !== undefined) {
    assert(
      !budgetMinor || budgetMinor >= d.committedMinor,
      409,
      "BUDGET",
      "Budget is below current commitments.",
    );
    d.budgetMinor = budgetMinor;
  }
  if (retainerChargeMinor !== undefined)
    d.retainerChargeMinor = retainerChargeMinor;
  if (contactUserIds) {
    for (const id of contactUserIds) await get(M.User, id, c);
    d.contactUserIds = contactUserIds;
  }
  const brand = await get(M.Organization, d.brandOrganizationId, c);
  if (data.logoAssetId) {
    const a = await ownAsset(c, data.logoAssetId, "AVATAR");
    a.visibility = "PUBLIC";
    await save(a, c);
  }
  Object.assign(brand, data);
  if (data.name) brand.nameNormalized = data.name.toLowerCase();
  await save(brand, c);
  await save(d, c);
  await event(c, "CLIENT_UPDATED", d);
  return d;
}
