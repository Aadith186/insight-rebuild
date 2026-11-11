import fs from "node:fs";
import { randomBytes } from "node:crypto";
if (fs.existsSync(".env")) {
  console.log(".env already exists; no secrets or settings were changed.");
  process.exit(0);
}
const encryption = randomBytes(32).toString("hex"),
  password = randomBytes(24).toString("base64url");
let text = fs
  .readFileSync(".env.example", "utf8")
  .replace("replace-with-64-hex-characters", encryption)
  .replace("replace-with-a-strong-password", password);
fs.writeFileSync(".env", text, { mode: 0o600 });
console.log("Created a local development .env.");
console.log("Development owner: owner@insight.local");
console.log("Development owner password:", password);
console.log("Keep .env private. Existing accounts are never reset by seeding.");
