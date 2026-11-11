import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import * as M from "./models.js";
await mongoose.connect(process.env.MONGODB_URI);
for (const Model of Object.values(M)) await Model.init();
for (const [key, label, compensationPolicy, productPolicy, completionMode] of [
  ["PAID_VIDEO", "Paid video", "REQUIRED", "OPTIONAL", "PUBLISH"],
  ["BARTER", "Product exchange", "ZERO", "REQUIRED", "PUBLISH"],
  [
    "AFFILIATE_PRODUCT",
    "Affiliate + product",
    "OPTIONAL",
    "REQUIRED",
    "PUBLISH",
  ],
  ["UGC_PACKAGE", "UGC package", "REQUIRED", "OPTIONAL", "HANDOVER"],
])
  await M.CollaborationFormat.updateOne(
    { key },
    {
      $setOnInsert: {
        key,
        label,
        compensationPolicy,
        productPolicy,
        completionMode,
        active: true,
        version: 1,
      },
    },
    { upsert: true },
  );
if (!(await M.PlatformSettings.exists({})))
  await M.PlatformSettings.create({
    version: 1,
    commissionBps: 1000,
    fundingInstructions: {
      note: "Contact the platform operator for verified payment instructions.",
    },
    supportContact: {},
    effectiveAt: new Date(),
  });
const email = process.env.BOOTSTRAP_OWNER_EMAIL,
  password = process.env.BOOTSTRAP_OWNER_PASSWORD;
if (email && password) {
  if (password.length < 12)
    throw new Error("Owner password must contain at least 12 characters.");
  if (!(await M.User.exists({ emailNormalized: email.toLowerCase() })))
    await M.User.create({
      email,
      emailNormalized: email.toLowerCase(),
      passwordHash: await bcrypt.hash(password, 12),
      name: "Insight administrator",
      platformRole: "OWNER",
      emailVerifiedAt: new Date(),
    });
  console.log("Owner bootstrap checked. Existing password was not reset.");
}
if (process.env.SEED_DEMO === "true") {
  if (process.env.NODE_ENV === "production")
    throw new Error("Development seeding is disabled in production.");
  const { seedDemoData } = await import("./seed-demo-data.js");
  const summary = await seedDemoData();
  if (!summary.skipped) {
    console.log("Investor demo dataset loaded:", summary.counts);
    for (const a of summary.accounts)
      console.log("Demo login:", a.role, a.email, a.password);
  }
}
console.log("Insight initialization complete.");
await mongoose.disconnect();
