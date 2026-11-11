import "dotenv/config";
import { createServer } from "node:http";
import { attachChat } from "./modules/messaging/messaging.socket.js";
import mongoose from "mongoose";
import { createApp } from "./app.js";
import * as M from "./models.js";
import { drain } from "./core/events.js";
if (!process.env.MONGODB_URI)
  throw new Error("Set MONGODB_URI to a MongoDB replica-set database.");
await mongoose.connect(process.env.MONGODB_URI);
const hello = await mongoose.connection.db.admin().command({ hello: 1 });
if (!hello.setName && hello.msg !== "isdbgrid")
  throw new Error(
    "Insight requires a MongoDB replica set for transactional workflows.",
  );
for (const Model of Object.values(M)) await Model.init();
const server = createServer(createApp());
const chat = attachChat(server);
server.listen(process.env.PORT || 4000, () =>
  console.log("Insight listening on", process.env.PORT || 4000),
);
let busy = false;
const timer = setInterval(async () => {
  if (busy) return;
  busy = true;
  try {
    await drain();
  } catch (e) {
    console.error("Outbox retry required", e.name);
  } finally {
    busy = false;
  }
}, 3000);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    clearInterval(timer);
    chat.disposeInsight();
    chat.disconnectSockets(true);
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
  });
