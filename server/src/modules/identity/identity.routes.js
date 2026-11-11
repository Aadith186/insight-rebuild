import mongoose from "mongoose";
import { route } from "../../core/http.js";
import { z, str } from "../../core/validation.js";
import { list, assert } from "../../core/db.js";
import * as M from "../../models.js";
import * as S from "./identity.service.js";
const email = z.object({ email: z.string().email().max(320) }).strict(),
  password = z.string().min(12).max(128);
export function routes(r) {
  route(
    r,
    "post",
    "/auth/register",
    email.extend({
      password,
      name: str.max(200),
      accountType: z.enum(["CREATOR", "BRAND", "AGENCY"]),
    }),
    S.register,
    { public: true },
  );
  route(
    r,
    "post",
    "/auth/login",
    email.extend({ password: z.string().max(128) }),
    S.login,
    { public: true },
  );
  route(r, "post", "/auth/refresh", null, S.refresh);
  route(
    r,
    "post",
    "/auth/email-verifications",
    email,
    (c, b) => S.email(c, b, "VERIFY_EMAIL"),
    { public: true },
  );
  route(
    r,
    "post",
    "/auth/email-verifications/confirm",
    z.object({ token: str }).strict(),
    (c, b) => S.confirm(c, b, false),
    { public: true },
  );
  route(
    r,
    "post",
    "/auth/password-resets",
    email,
    (c, b) => S.email(c, b, "RESET_PASSWORD"),
    { public: true },
  );
  route(
    r,
    "post",
    "/auth/password-resets/confirm",
    z.object({ token: str, newPassword: password }).strict(),
    (c, b) => S.confirm(c, b, true),
    { public: true },
  );
  route(
    r,
    "put",
    "/auth/password",
    z.object({ currentPassword: str, newPassword: password }).strict(),
    S.password,
  );
  route(r, "post", "/auth/logout", null, (c) => S.logout(c, false));
  route(r, "post", "/auth/logout-all", null, (c) => S.logout(c, true));
  route(r, "get", "/auth/me", null, (c) => ({
    user: c.user,
    creator: c.creator,
    memberships: c.memberships,
    organizations: c.organizations,
  }));
  route(r, "get", "/auth/sessions", null, (c, b, p, q) =>
    list(M.Session, { userId: c.user._id, revokedAt: null }, c, q),
  );
  route(r, "delete", "/auth/sessions/:sessionId", null, async (c, b, p) => {
    await M.Session.updateOne(
      { _id: p.sessionId, userId: c.user._id },
      { $set: { revokedAt: new Date() } },
      { session: c.session },
    );
  });
  route(
    r,
    "get",
    "/config",
    null,
    async () => ({
      name: "Insight",
      colors: { primary: "#003b59", secondary: "#ffb118" },
      formats: await M.CollaborationFormat.find({ active: true }),
      capabilities: {
        demo: false,
        email: !!process.env.EMAIL_WEBHOOK_URL,
        payments: "MANUAL_RECONCILIATION",
      },
    }),
    { public: true },
  );
  route(r, "get", "/health/live", null, async () => ({ status: "ok" }), {
    public: true,
  });
  route(
    r,
    "get",
    "/health/ready",
    null,
    async () => {
      assert(
        mongoose.connection.readyState === 1,
        503,
        "DATABASE_UNAVAILABLE",
        "Database unavailable.",
      );
      try {
        await mongoose.connection.db.admin().command({ ping: 1 });
      } catch {
        assert(false, 503, "DATABASE_UNAVAILABLE", "Database unavailable.");
      }
      return { database: "connected", media: "configured", outbox: "enabled" };
    },
    { public: true },
  );
}
