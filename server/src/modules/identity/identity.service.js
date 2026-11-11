import bcrypt from "bcryptjs";
import * as M from "../../models.js";
import { create, get, save, assert } from "../../core/db.js";
import { identity } from "../../core/policy.js";
import { hash, token, encrypt } from "../../core/crypto.js";
export const cookie = () => {
  const sameSite = (process.env.COOKIE_SAMESITE || "lax").toLowerCase();
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" || sameSite === "none",
    sameSite: ["lax", "strict", "none"].includes(sameSite) ? sameSite : "lax",
    path: "/",
    maxAge: 2592000000,
  };
};
export async function session(c, u) {
  assert(
    c.req.get("X-Insight-Client") !== "android" || u.platformRole !== "OWNER",
    403,
    "ANDROID_ROLE_UNAVAILABLE",
    "Use Insight on the web for platform administration.",
  );
  const raw = token();
  await create(
    M.Session,
    {
      userId: u._id,
      refreshTokenHash: hash(raw),
      expiresAt: new Date(Date.now() + 2592000000),
      userAgent: c.req.get("User-Agent")?.slice(0, 400),
    },
    c,
  );
  c.res.cookie("insight_session", raw, cookie());
  return identity(u, c.session);
}
export async function register(c, b) {
  const u = await create(
    M.User,
    {
      email: b.email,
      emailNormalized: b.email.toLowerCase(),
      name: b.name,
      passwordHash: await bcrypt.hash(b.password, 12),
    },
    c,
  );
  if (b.accountType === "CREATOR")
    await create(M.CreatorProfile, { userId: u._id }, c);
  else {
    const o = await create(
      M.Organization,
      {
        name: b.name,
        nameNormalized: b.name.toLowerCase(),
        type: b.accountType,
        contactEmail: b.email,
      },
      c,
    );
    await create(
      M.Membership,
      { userId: u._id, organizationId: o._id, role: "ORG_ADMIN" },
      c,
    );
  }
  return session(c, u);
}
export async function login(c, b) {
  const u = await M.User.findOne({ emailNormalized: b.email.toLowerCase() })
    .select("+passwordHash")
    .session(c.session);
  assert(
    u?.status === "ACTIVE" &&
      (await bcrypt.compare(b.password, u.passwordHash)),
    401,
    "INVALID_CREDENTIALS",
    "Invalid email or password.",
  );
  return session(c, u);
}
export async function refresh(c) {
  const s = await get(M.Session, c.req.sessionId, c);
  assert(
    !s.revokedAt && s.expiresAt > new Date(),
    401,
    "SESSION_EXPIRED",
    "Please sign in.",
  );
  s.revokedAt = new Date();
  await save(s, c);
  return session(c, c.user);
}
export async function logout(c, all) {
  await M.Session.updateMany(
    all ? { userId: c.user._id } : { _id: c.req.sessionId },
    { $set: { revokedAt: new Date() } },
    { session: c.session },
  );
  c.res.clearCookie("insight_session", cookie());
}
export async function email(c, b, purpose) {
  assert(
    process.env.EMAIL_WEBHOOK_URL && process.env.EMAIL_WEBHOOK_SECRET,
    503,
    "EMAIL_UNAVAILABLE",
    "Configure real email delivery.",
  );
  const u = await M.User.findOne({
    emailNormalized: b.email.toLowerCase(),
  }).session(c.session);
  if (u) {
    const raw = token(),
      t = await create(
        M.VerificationToken,
        {
          userId: u._id,
          purpose,
          tokenHash: hash(raw),
          expiresAt: new Date(Date.now() + 3600000),
        },
        c,
      );
    await create(
      M.OutboxEvent,
      {
        eventId: token(),
        kind: "SEND_EMAIL",
        resourceType: "VerificationToken",
        resourceId: t._id,
        status: "PENDING",
        nextAttemptAt: new Date(),
        occurredAt: new Date(),
        delivery: {
          channel: "EMAIL",
          templateKey: purpose,
          recipientEmail: u.email,
          encryptedOneTimePayload: encrypt({ token: raw }),
        },
      },
      c,
    );
  }
  return { message: "If the account exists, an email will be sent." };
}
export async function confirm(c, b, reset) {
  const t = await M.VerificationToken.findOne({
    tokenHash: hash(b.token),
    purpose: reset ? "RESET_PASSWORD" : "VERIFY_EMAIL",
    consumedAt: null,
    expiresAt: { $gt: new Date() },
  }).session(c.session);
  assert(t, 422, "TOKEN_EXPIRED", "This link is invalid or expired.");
  const u = await get(M.User, t.userId, c);
  if (reset) {
    u.passwordHash = await bcrypt.hash(b.newPassword, 12);
    await M.Session.updateMany(
      { userId: u._id },
      { $set: { revokedAt: new Date() } },
      { session: c.session },
    );
  } else u.emailVerifiedAt = new Date();
  t.consumedAt = new Date();
  await save(t, c);
  await save(u, c);
  return {
    message: reset ? "Password reset. Sign in again." : "Email verified.",
  };
}
export async function password(c, b) {
  const u = await M.User.findById(c.user._id)
    .select("+passwordHash")
    .session(c.session);
  assert(
    await bcrypt.compare(b.currentPassword, u.passwordHash),
    422,
    "INVALID_PASSWORD",
    "Current password is incorrect.",
  );
  u.passwordHash = await bcrypt.hash(b.newPassword, 12);
  await save(u, c);
  await M.Session.updateMany(
    { userId: u._id, _id: { $ne: c.req.sessionId } },
    { $set: { revokedAt: new Date() } },
    { session: c.session },
  );
  return { message: "Password changed." };
}
