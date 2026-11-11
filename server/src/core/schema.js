import mongoose from "mongoose";
export const ref = (name, required = false) => ({
  type: mongoose.Schema.Types.ObjectId,
  ref: name,
  required,
});
export const str = (max = 10000) => ({
  type: String,
  trim: true,
  maxlength: max,
});
export const int = (min = 0, max = Number.MAX_SAFE_INTEGER) => ({
  type: Number,
  min,
  max,
  default: min,
  validate: Number.isSafeInteger,
});
export const en = (s, def) => ({
  type: String,
  enum: s.split("|"),
  default: def || s.split("|")[0],
});
export const sub = (f) =>
  new mongoose.Schema(f, { _id: false, strict: "throw" });
export const product = sub({
  name: { ...str(200), required: true },
  variant: str(200),
  quantity: int(1, 10000),
  retailValueMinor: int(1),
});
export const deliverable = sub({
  kind: { ...str(100), required: true },
  quantity: int(1, 1000),
  description: str(),
});
export const rights = sub({
  channels: [String],
  durationDays: int(),
  paidAdvertisingAllowed: Boolean,
});
export const audience = sub({
  countries: [sub({ label: String, percentage: int(0, 100) })],
  ageGroups: [sub({ label: String, percentage: int(0, 100) })],
  gender: sub({ female: int(0, 100), male: int(0, 100), other: int(0, 100) }),
});
export const scope = sub({
  clientBrandId: ref("Organization", true),
  allCampaigns: { type: Boolean, default: false },
  campaignIds: [ref("Campaign")],
  directCollaborationIds: [ref("Collaboration")],
});
export const format = sub({
  key: String,
  label: String,
  compensationPolicy: en("REQUIRED|ZERO|OPTIONAL"),
  productPolicy: en("REQUIRED|OPTIONAL|NONE"),
  completionMode: en("PUBLISH|HANDOVER|EITHER"),
  version: int(1),
});
export const brief = {
  coverAssetId: ref("MediaAsset"),
  title: { ...str(200), required: true },
  brief: { ...str(20000), required: true },
  niche: str(100),
  formatId: ref("CollaborationFormat", true),
  budgetPerCreatorMinor: int(),
  spots: int(1, 10000),
  applicationDeadline: Date,
  deadline: Date,
  deliverables: [deliverable],
  usageRights: rights,
  includedRevisions: int(0, 20),
};
export const terms = {
  formatId: ref("CollaborationFormat", true),
  formatSnapshot: format,
  amountMinor: int(),
  currency: en("INR"),
  dueAt: { type: Date, required: true },
  deliverables: [deliverable],
  usageRights: rights,
  includedRevisions: int(0, 20),
  products: [product],
  affiliateTerms: sub({
    description: str(),
    commissionBps: int(0, 10000),
    trackingUrl: String,
  }),
  commissionBps: int(0, 10000),
  feeMinor: int(),
  creatorNetMinor: int(),
};
export const evidence = sub({
  type: en("ASSET|MESSAGE|VERSION|SHIPMENT"),
  resourceId: { type: mongoose.Schema.Types.ObjectId, required: true },
  note: str(),
});
export function define(name, fields, indexes = []) {
  const s = new mongoose.Schema(fields, {
    timestamps: true,
    strict: "throw",
    optimisticConcurrency: true,
    toJSON: {
      transform: (_d, r) => {
        r.id = String(r._id);
        if (Object.hasOwn(fields, "version")) r.recordVersion = r.__v;
        else r.version = r.__v;
        for (const k of [
          "passwordHash",
          "tokenHash",
          "refreshTokenHash",
          "storageKey",
          "destinationEncrypted",
        ])
          delete r[k];
        return r;
      },
    },
  });
  for (const [keys, options] of indexes) s.index(keys, options);
  return mongoose.models[name] || mongoose.model(name, s);
}
