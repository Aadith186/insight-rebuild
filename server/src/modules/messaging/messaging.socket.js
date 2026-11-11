import { Server } from "socket.io";
import mongoose from "mongoose";
import { z, id, str } from "../../core/validation.js";
import { assert } from "../../core/db.js";
import { hash } from "../../core/crypto.js";
import { identity } from "../../core/policy.js";
import { realtimeBus } from "../../core/realtime-bus.js";
import * as M from "../../models.js";
import * as S from "./messaging.service.js";
const contextSchema = z
  .object({ organizationId: id.optional(), clientId: id.optional() })
  .strict();
const joinSchema = contextSchema.extend({ conversationId: id }).strict();
const sendSchema = joinSchema
  .extend({
    text: str.optional(),
    attachmentAssetIds: z.array(id).max(10).default([]),
    clientMessageId: str.max(100),
  })
  .strict();
export async function socketIdentity(cookie, selection = {}, session = null) {
  const match = String(cookie || "")
    .split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith("insight_session="));
  assert(match, 401, "AUTH_REQUIRED", "Sign in to chat.");
  let raw;
  try {
    raw = decodeURIComponent(match.slice("insight_session=".length));
  } catch {
    assert(false, 401, "AUTH_REQUIRED", "Sign in to chat.");
  }
  const record = await M.Session.findOne({
    refreshTokenHash: hash(raw),
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  }).session(session);
  assert(record, 401, "AUTH_REQUIRED", "Session expired.");
  const user = await M.User.findById(record.userId).session(session);
  assert(
    user?.status === "ACTIVE",
    401,
    "AUTH_REQUIRED",
    "Session unavailable.",
  );
  return {
    ...(await identity(user, session)),
    ...contextSchema.parse(selection),
    session,
    requestId: "socket:" + record._id,
  };
}
export function attachChat(server) {
  const origin = process.env.APP_ORIGIN || "http://localhost:5173";
  const io = new Server(server, {
    cors: { origin, credentials: true },
    maxHttpBufferSize: 65536,
    allowRequest: (req, done) =>
      done(null, !req.headers.origin || req.headers.origin === origin),
  });
  io.use(async (socket, next) => {
    try {
      await socketIdentity(socket.request.headers.cookie);
      socket.data.subscriptions = new Map();
      socket.data.rates = {};
      next();
    } catch {
      next(new Error("Sign in to use chat."));
    }
  });
  async function deliver(event) {
    const sockets = io.of("/").sockets.values();
    for (const socket of sockets) {
      const selection = socket.data.subscriptions?.get(event.conversationId);
      if (
        socket.data.inboxSelection &&
        ["message:new", "conversation:read"].includes(event.type)
      ) {
        try {
          const ctx = await socketIdentity(
            socket.request.headers.cookie,
            socket.data.inboxSelection,
          );
          await S.access(ctx, event.conversationId);
          socket.emit("inbox:changed", {
            conversationId: event.conversationId,
          });
        } catch {}
      }
      if (!selection) continue;
      try {
        const ctx = await socketIdentity(
          socket.request.headers.cookie,
          selection,
        );
        const conversation = await S.access(ctx, event.conversationId);
        const payload =
          event.type === "conversation:read"
            ? {
                conversationId: event.conversationId,
                readCursors: conversation.readCursors,
              }
            : event.type === "message:new"
              ? { conversationId: event.conversationId, message: event.message }
              : event;
        socket.emit(event.type, payload);
      } catch {
        socket.data.subscriptions.delete(event.conversationId);
        socket.emit("conversation:revoked", {
          conversationId: event.conversationId,
        });
      }
    }
  }
  const listener = (e) => deliver(e).catch(() => {});
  realtimeBus.on("conversation", listener);
  io.on("connection", (socket) => {
    function rate(key, limit = 10, window = 1000) {
      const now = Date.now(),
        r = socket.data.rates[key] || { at: now, count: 0 };
      if (now - r.at >= window) {
        r.at = now;
        r.count = 0;
      }
      r.count++;
      socket.data.rates[key] = r;
      assert(r.count <= limit, 429, "CHAT_RATE", "Please slow down.");
    }
    const handle = (name, fn) =>
      socket.on(name, async (payload, ack = () => {}) => {
        try {
          rate(name);
          const data = await fn(payload);
          if (typeof ack === "function") ack({ ok: true, data });
        } catch (e) {
          if (typeof ack === "function")
            ack({
              ok: false,
              error: {
                code: e.code || "CHAT_ERROR",
                message: e.status
                  ? e.message
                  : "Chat request could not be completed.",
              },
            });
        }
      });
    handle("inbox:watch", async (payload) => {
      const selection = contextSchema.parse(payload);
      await socketIdentity(socket.request.headers.cookie, selection);
      socket.data.inboxSelection = selection;
      return { watching: true };
    });
    handle("conversation:join", async (payload) => {
      const b = joinSchema.parse(payload),
        { conversationId, ...selection } = b,
        ctx = await socketIdentity(socket.request.headers.cookie, selection),
        d = await S.access(ctx, conversationId);
      assert(
        socket.data.subscriptions.size < 20 ||
          socket.data.subscriptions.has(conversationId),
        422,
        "ROOM_LIMIT",
        "Too many open conversations.",
      );
      socket.data.subscriptions.set(conversationId, selection);
      return {
        conversationId,
        readCursors: d.readCursors,
        userId: String(ctx.user._id),
      };
    });
    handle("conversation:leave", async (payload) => {
      const b = z.object({ conversationId: id }).strict().parse(payload);
      socket.data.subscriptions.delete(b.conversationId);
      return { conversationId: b.conversationId };
    });
    handle("message:send", async (payload) => {
      const b = sendSchema.parse(payload),
        { conversationId, organizationId, clientId, ...body } = b;
      let message;
      await mongoose.connection.transaction(async (session) => {
        const ctx = await socketIdentity(
          socket.request.headers.cookie,
          { organizationId, clientId },
          session,
        );
        message = await S.message(ctx, body, { conversationId });
      });
      realtimeBus.emit("conversation", {
        conversationId,
        type: "message:new",
        message: message.toJSON(),
      });
      return message;
    });
    handle("conversation:read", async (payload) => {
      const b = joinSchema
          .extend({ lastMessageId: id })
          .strict()
          .parse(payload),
        { conversationId, lastMessageId, ...selection } = b;
      let d;
      await mongoose.connection.transaction(async (session) => {
        const ctx = await socketIdentity(
          socket.request.headers.cookie,
          selection,
          session,
        );
        d = await S.read(ctx, { lastMessageId }, { conversationId });
      });
      realtimeBus.emit("conversation", {
        conversationId,
        type: "conversation:read",
      });
      return { readCursors: d.readCursors };
    });
    handle("conversation:typing", async (payload) => {
      rate("typing", 1, 800);
      const b = joinSchema
          .extend({ typing: z.boolean() })
          .strict()
          .parse(payload),
        { conversationId, typing, ...selection } = b,
        ctx = await socketIdentity(socket.request.headers.cookie, selection);
      await S.access(ctx, conversationId, true);
      realtimeBus.emit("conversation", {
        conversationId,
        type: "conversation:typing",
        typing,
        userId: String(ctx.user._id),
        name: ctx.user.name,
      });
      return { sent: true };
    });
  });
  let busy = false;
  const timer = setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      for (const socket of io.of("/").sockets.values()) {
        try {
          await socketIdentity(socket.request.headers.cookie);
        } catch {
          socket.disconnect(true);
        }
      }
    } catch {
    } finally {
      busy = false;
    }
  }, 15000);
  timer.unref();
  server.on("close", () => {
    clearInterval(timer);
    realtimeBus.off("conversation", listener);
  });
  // Explicit disposer also removes the bus listener in tests and graceful shutdown.
  io.disposeInsight = () => {
    clearInterval(timer);
    realtimeBus.off("conversation", listener);
  };
  return io;
}
