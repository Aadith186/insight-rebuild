import {
  createHash,
  randomBytes,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";
import { assert } from "./db.js";
export const token = () => randomBytes(32).toString("base64url");
function canonical(value) {
  if (value && typeof value.toJSON === "function")
    return canonical(value.toJSON());
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  return value;
}
export const hash = (s) =>
  createHash("sha256")
    .update(typeof s === "string" ? s : JSON.stringify(canonical(s)))
    .digest("hex");
function key() {
  const k = process.env.DATA_ENCRYPTION_KEY;
  assert(
    k && /^[a-f0-9]{64}$/i.test(k),
    503,
    "ENCRYPTION_UNAVAILABLE",
    "Configure DATA_ENCRYPTION_KEY.",
  );
  return Buffer.from(k, "hex");
}
export function encrypt(value) {
  const iv = randomBytes(12),
    c = createCipheriv("aes-256-gcm", key(), iv);
  const b = Buffer.concat([c.update(JSON.stringify(value), "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), b]).toString("base64");
}
export function decrypt(s) {
  const b = Buffer.from(s, "base64"),
    c = createDecipheriv("aes-256-gcm", key(), b.subarray(0, 12));
  c.setAuthTag(b.subarray(12, 28));
  return JSON.parse(
    Buffer.concat([c.update(b.subarray(28)), c.final()]).toString("utf8"),
  );
}
