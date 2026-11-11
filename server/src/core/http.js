import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import * as M from "../models.js";
import { assert } from "./db.js";
import { hash } from "./crypto.js";
import { identity } from "./policy.js";
import { committedEvent } from "./realtime-bus.js";
export const registered = [];
export function route(
  router,
  method,
  path,
  schema,
  handler,
  { public: pub = false, idempotent = false, upload } = {},
) {
  registered.push({
    method: method.toUpperCase(),
    path,
    schema,
    public: pub,
    idempotent,
  });
  router[method](path, ...(upload ? [upload] : []), async (req, res, next) => {
    try {
      for (const [k, v] of Object.entries(req.params))
        if (k !== "token")
          assert(
            mongoose.isValidObjectId(v),
            422,
            "INVALID_ID",
            "Invalid resource ID.",
          );
      for (const [k, v] of Object.entries(req.query)) {
        assert(
          typeof v === "string" && v.length <= 2000,
          422,
          "QUERY_INVALID",
          "Invalid query filter.",
        );
        if (/Id$/.test(k) && v)
          assert(
            mongoose.isValidObjectId(v),
            422,
            "INVALID_ID",
            "Invalid query resource ID.",
          );
        if (["from", "to", "dueFrom", "dueTo"].includes(k) && v)
          assert(
            !Number.isNaN(Date.parse(v)),
            422,
            "INVALID_DATE",
            "Invalid date filter.",
          );
      }
      const b = schema ? schema.parse(req.body) : {};
      let c = {
        ...req.identity,
        requestId: req.requestId,
        organizationId:
          req.get("X-Organization-Id") ||
          (method === "get" && path === "/media/assets/:assetId/content"
            ? req.query.organizationId
            : undefined),
        clientId:
          req.get("X-Client-Id") ||
          (method === "get" && path === "/media/assets/:assetId/content"
            ? req.query.clientId
            : undefined),
        req,
        res,
      };
      for (const v of [c.organizationId, c.clientId])
        if (v)
          assert(
            mongoose.isValidObjectId(v),
            422,
            "INVALID_CONTEXT",
            "Invalid workspace ID.",
          );
      if (!pub) assert(c.user, 401, "AUTH_REQUIRED", "Please sign in.");
      const execute = async (session) => {
        c = { ...c, session };
        if (c.user) {
          const u = await M.User.findById(c.user._id).session(session);
          assert(
            u?.status === "ACTIVE",
            401,
            "AUTH_REQUIRED",
            "Please sign in.",
          );
          c = { ...c, ...(await identity(u, session)) };
        }
        let record;
        if (idempotent) {
          const key = req.get("Idempotency-Key"),
            scope = method + ":" + req.path,
            requestHash = hash(b);
          assert(
            key && key.length <= 150,
            422,
            "IDEMPOTENCY_REQUIRED",
            "Supply an Idempotency-Key.",
          );
          record = await M.IdempotencyRecord.findOne({
            actorUserId: c.user._id,
            scope,
            key,
          }).session(session);
          if (record) {
            assert(
              record.requestHash === requestHash && record.state === "COMPLETE",
              409,
              "IDEMPOTENCY_CONFLICT",
              "This key was used for a different request or is processing.",
            );
            return JSON.parse(record.responseBodyJson);
          }
          record = (
            await M.IdempotencyRecord.create(
              [
                {
                  actorUserId: c.user._id,
                  scope,
                  key,
                  requestHash,
                  state: "IN_PROGRESS",
                  expiresAt: new Date(Date.now() + 86400000),
                },
              ],
              { session },
            )
          )[0];
        }
        const result = await handler(c, b, req.params, req.query);
        if (record) {
          record.state = "COMPLETE";
          record.responseBodyJson = JSON.stringify(result ?? null);
          await record.save({ session });
        }
        return result;
      };
      const result =
        !["get", "head"].includes(method) && !upload
          ? await mongoose.connection.transaction(execute)
          : await execute(null);
      if (result) committedEvent(req.path, method, result);
      if (res.headersSent || res.writableEnded) return;
      if (result === undefined) return res.status(204).end();
      const status =
        method === "post" &&
        ["/campaigns", "/offers", "/auth/register", "/media/assets"].includes(
          path,
        )
          ? 201
          : 200;
      res
        .status(status)
        .json(
          result?.page
            ? { ...result, meta: { requestId: req.requestId } }
            : { data: result, meta: { requestId: req.requestId } },
        );
    } catch (e) {
      next(e);
    }
  });
}
export function requestId(req, res, next) {
  req.requestId = randomUUID();
  res.set("X-Request-Id", req.requestId);
  next();
}
