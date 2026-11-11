import "dotenv/config";
import mongoose from "mongoose";
import * as M from "./models.js";
import { drain } from "./core/events.js";
import { decrypt } from "./core/crypto.js";
await mongoose.connect(process.env.MONGODB_URI);
async function email() {
  if (!process.env.EMAIL_WEBHOOK_URL || !process.env.EMAIL_WEBHOOK_SECRET)
    return;
  const rows = await M.OutboxEvent.find({
    "delivery.channel": "EMAIL",
    status: { $in: ["PENDING", "FAILED"] },
    nextAttemptAt: { $lte: new Date() },
    attempts: { $lt: 10 },
  })
    .select("+delivery.encryptedOneTimePayload")
    .limit(20);
  for (const e of rows) {
    try {
      const data = decrypt(e.delivery.encryptedOneTimePayload),
        route =
          e.delivery.templateKey === "VERIFY_EMAIL"
            ? "verify-email"
            : "reset-password";
      const r = await fetch(process.env.EMAIL_WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.EMAIL_WEBHOOK_SECRET}`,
          "Idempotency-Key": e.eventId,
        },
        body: JSON.stringify({
          to: e.delivery.recipientEmail,
          template: e.delivery.templateKey,
          url: `${process.env.APP_ORIGIN}/#/${route}?token=${encodeURIComponent(data.token)}`,
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!r.ok) throw new Error("Delivery rejected");
      await M.OutboxEvent.updateOne(
        { _id: e._id },
        {
          $set: { status: "DONE" },
          $unset: { "delivery.encryptedOneTimePayload": 1 },
          $inc: { attempts: 1 },
        },
      );
    } catch {
      await M.OutboxEvent.updateOne(
        { _id: e._id },
        {
          $set: {
            status: "FAILED",
            nextAttemptAt: new Date(Date.now() + 60000),
          },
          $inc: { attempts: 1 },
        },
      );
    }
  }
}
let busy = false;
setInterval(async () => {
  if (busy) return;
  busy = true;
  try {
    await drain();
    await email();
  } catch (e) {
    console.error("Worker retry required", e.name);
  } finally {
    busy = false;
  }
}, 3000);
