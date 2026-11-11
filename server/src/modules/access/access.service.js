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
import { admin, validateScopes } from "../../core/policy.js";
import { hash, token } from "../../core/crypto.js";
import { event } from "../../core/events.js";
async function lastAdmin(c, m, role, status) {
  if (m.role === "ORG_ADMIN" && (role !== "ORG_ADMIN" || status !== "ACTIVE")) {
    const count = await M.Membership.countDocuments({
      organizationId: m.organizationId,
      role: "ORG_ADMIN",
      status: "ACTIVE",
    }).session(c.session);
    assert(
      count > 1,
      409,
      "LAST_ADMIN",
      "Keep at least one active administrator.",
    );
    const org = await get(M.Organization, m.organizationId, c);
    org.updatedAt = new Date();
    org.markModified("updatedAt");
    await save(org, c);
  }
}
export async function update(c, b, p) {
  const m = await get(M.Membership, p.membershipId, c);
  admin(c, m.organizationId);
  expected(m, b);
  await validateScopes(c, m.organizationId, b.clientScopes);
  await lastAdmin(c, m, b.role, m.status);
  m.role = b.role;
  m.clientScopes = b.clientScopes;
  await save(m, c);
  await event(c, "MEMBERSHIP_UPDATED", m);
  return m;
}
export async function revoke(c, b, p) {
  const m = await get(M.Membership, p.membershipId, c);
  admin(c, m.organizationId);
  await lastAdmin(c, m, m.role, "REVOKED");
  m.status = "REVOKED";
  await save(m, c);
  await event(c, "MEMBERSHIP_REVOKED", m);
  return m;
}
export async function invite(c, b, p) {
  admin(c, p.organizationId);
  await validateScopes(c, p.organizationId, b.clientScopes);
  const raw = token(),
    i = await create(
      M.Invitation,
      {
        organizationId: p.organizationId,
        emailNormalized: b.email.toLowerCase(),
        role: b.role,
        clientScopes: b.clientScopes,
        tokenHash: hash(raw),
        expiresAt: new Date(Date.now() + 604800000),
        invitedByUserId: c.user._id,
      },
      c,
    );
  await event(c, "INVITATION_CREATED", i);
  return {
    invitation: i,
    url: `${process.env.APP_ORIGIN}/#/invitation/${raw}`,
  };
}
export async function lookup(c, raw) {
  const i = await M.Invitation.findOne({
    tokenHash: hash(raw),
    status: "PENDING",
    expiresAt: { $gt: new Date() },
  }).session(c.session);
  assert(i, 404, "NOT_FOUND", "Invitation is invalid or expired.");
  return i;
}
export async function accept(c, b, p, decline = false) {
  const i = await lookup(c, p.token);
  assert(
    c.user.emailNormalized === i.emailNormalized,
    403,
    "EMAIL_MISMATCH",
    "Sign in with the invited email.",
  );
  assert(
    c.user.emailVerifiedAt,
    403,
    "VERIFY_EMAIL",
    "Verify your email before accepting an invitation.",
  );
  if (!decline) {
    await validateScopes(c, i.organizationId, i.clientScopes);
    let m = await M.Membership.findOne({
      userId: c.user._id,
      organizationId: i.organizationId,
    }).session(c.session);
    if (m) {
      assert(
        m.status !== "ACTIVE",
        409,
        "ALREADY_MEMBER",
        "You already have an active membership.",
      );
      Object.assign(m, {
        role: i.role,
        status: "ACTIVE",
        clientScopes: i.clientScopes,
      });
      await save(m, c);
    } else
      await create(
        M.Membership,
        {
          userId: c.user._id,
          organizationId: i.organizationId,
          role: i.role,
          clientScopes: i.clientScopes,
        },
        c,
      );
  }
  i.status = decline ? "DECLINED" : "ACCEPTED";
  i.acceptedByUserId = c.user._id;
  await save(i, c);
  await event(c, "INVITATION_" + i.status, i);
  return i;
}
