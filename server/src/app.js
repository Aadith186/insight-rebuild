import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import fs from "node:fs";
import path from "node:path";
import * as M from "./models.js";
import { identity } from "./core/policy.js";
import { hash } from "./core/crypto.js";
import { assert, errors } from "./core/db.js";
import { requestId } from "./core/http.js";
import { routes as identityRoutes } from "./modules/identity/identity.routes.js";
import { routes as creatorsRoutes } from "./modules/creators/creators.routes.js";
import { routes as organizationsRoutes } from "./modules/organizations/organizations.routes.js";
import { routes as accessRoutes } from "./modules/access/access.routes.js";
import { routes as campaignsRoutes } from "./modules/campaigns/campaigns.routes.js";
import { routes as applicationsRoutes } from "./modules/applications/applications.routes.js";
import { routes as discoveryRoutes } from "./modules/discovery/discovery.routes.js";
import { routes as offersRoutes } from "./modules/offers/offers.routes.js";
import { routes as approvalsRoutes } from "./modules/approvals/approvals.routes.js";
import { routes as collaborationsRoutes } from "./modules/collaborations/collaborations.routes.js";
import { routes as productsRoutes } from "./modules/products/products.routes.js";
import { routes as mediaRoutes } from "./modules/media/media.routes.js";
import { routes as contentRoutes } from "./modules/content/content.routes.js";
import { routes as completionRoutes } from "./modules/completion/completion.routes.js";
import { routes as messagingRoutes } from "./modules/messaging/messaging.routes.js";
import { routes as financeRoutes } from "./modules/finance/finance.routes.js";
import { routes as disputesRoutes } from "./modules/disputes/disputes.routes.js";
import { routes as activityRoutes } from "./modules/activity/activity.routes.js";
import { routes as ownerRoutes } from "./modules/owner/owner.routes.js";

import { routes as analyticsRoutes } from "./modules/analytics/analytics.routes.js";
export function createApp() {
  const app = express();
  app.set("trust proxy", Number(process.env.TRUST_PROXY || 0));
  app.use(
    requestId,
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "blob:"],
          mediaSrc: ["'self'", "https:", "blob:"],
          frameSrc: ["https://www.youtube.com", "https://player.vimeo.com"],
          connectSrc: ["'self'"],
        },
      },
    }),
    cors({
      origin: process.env.APP_ORIGIN || "http://localhost:5173",
      credentials: true,
    }),
    cookieParser(),
    express.json({ limit: "1mb" }),
  );
  app.use("/api", rateLimit({ windowMs: 60000, limit: 300 }));
  app.use("/api/v1/auth", rateLimit({ windowMs: 900000, limit: 60 }));
  app.use("/api/v1", async (req, res, next) => {
    try {
      if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
        const origin = req.get("origin");
        assert(
          !origin ||
            origin === (process.env.APP_ORIGIN || "http://localhost:5173"),
          403,
          "ORIGIN_DENIED",
          "Origin denied.",
        );
        assert(
          origin || req.get("Sec-Fetch-Site") !== "cross-site",
          403,
          "ORIGIN_DENIED",
          "Cross-site request denied.",
        );
      }
      // A stale cookie must not turn process liveness into a database check.
      if (req.path.startsWith("/health/")) return next();
      const raw = req.cookies.insight_session;
      if (raw) {
        const s = await M.Session.findOne({
          refreshTokenHash: hash(raw),
          revokedAt: null,
          expiresAt: { $gt: new Date() },
        });
        if (s) {
          const u = await M.User.findById(s.userId);
          if (u?.status === "ACTIVE") {
            req.identity = await identity(u);
            req.sessionId = s._id;
          }
        }
      }
      assert(
        req.get("X-Insight-Client") !== "android" ||
          req.identity?.user.platformRole !== "OWNER" ||
          req.path === "/auth/logout",
        403,
        "ANDROID_ROLE_UNAVAILABLE",
        "Use Insight on the web for platform administration.",
      );
      next();
    } catch (e) {
      next(e);
    }
  });
  const r = express.Router();
  for (const register of [
    identityRoutes,
    creatorsRoutes,
    organizationsRoutes,
    accessRoutes,
    campaignsRoutes,
    applicationsRoutes,
    discoveryRoutes,
    offersRoutes,
    approvalsRoutes,
    collaborationsRoutes,
    productsRoutes,
    mediaRoutes,
    contentRoutes,
    completionRoutes,
    messagingRoutes,
    financeRoutes,
    disputesRoutes,
    activityRoutes,
    ownerRoutes,
    analyticsRoutes,
  ])
    register(r);
  app.use("/api/v1", r);
  app.use("/api", (_req, res) =>
    res.status(404).json({
      error: { code: "NOT_FOUND", message: "API endpoint not found." },
    }),
  );
  const dist = path.resolve("dist");
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get("/{*path}", (_req, res) =>
      res.sendFile(path.join(dist, "index.html")),
    );
  }
  app.use(errors);
  return app;
}
