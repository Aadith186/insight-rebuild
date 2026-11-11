import { z } from "zod";
export { z };
export const id = z.string().regex(/^[a-f\d]{24}$/i),
  str = z.string().trim().min(1).max(10000),
  money = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  date = z.string().datetime({ offset: true }),
  url = z
    .string()
    .url()
    .max(1500)
    .refine((v) => v.startsWith("https://"), "Use an HTTPS URL.");
export const version = { expectedVersion: z.number().int().nonnegative() };
export const command = z
  .object({ ...version, reason: str.optional(), note: str.optional() })
  .strict();
export const scopes = z
  .array(
    z
      .object({
        clientBrandId: id,
        allCampaigns: z.boolean(),
        campaignIds: z.array(id).default([]),
        directCollaborationIds: z.array(id).default([]),
      })
      .strict(),
  )
  .max(100);
export const products = z
  .array(
    z
      .object({
        name: str.max(200),
        variant: z.string().max(200).optional(),
        quantity: z.number().int().min(1).max(10000),
        retailValueMinor: money.refine((n) => n > 0),
      })
      .strict(),
  )
  .max(100);
export const deliverables = z
  .array(
    z
      .object({
        kind: str.max(100),
        quantity: z.number().int().min(1).max(1000),
        description: str,
      })
      .strict(),
  )
  .min(1)
  .max(100);
export const rights = z
  .object({
    channels: z.array(str),
    durationDays: z.number().int().nonnegative(),
    paidAdvertisingAllowed: z.boolean().optional(),
  })
  .strict();
export const audience = z
  .object({
    countries: z
      .array(
        z.object({ label: str, percentage: z.number().int().min(0).max(100) }),
      )
      .optional(),
    ageGroups: z
      .array(
        z.object({ label: str, percentage: z.number().int().min(0).max(100) }),
      )
      .optional(),
    gender: z
      .object({
        female: z.number().int().min(0).max(100),
        male: z.number().int().min(0).max(100),
        other: z.number().int().min(0).max(100),
      })
      .optional(),
  })
  .strict();
export const brief = {
  coverAssetId: id.optional(),
  title: str.max(200),
  brief: str,
  niche: str.max(100),
  formatId: id,
  budgetPerCreatorMinor: money,
  spots: z.number().int().min(1).max(10000),
  applicationDeadline: date,
  deadline: date,
  deliverables,
  usageRights: rights,
  includedRevisions: z.number().int().min(0).max(20),
};
export const terms = {
  formatId: id,
  amountMinor: money,
  currency: z.literal("INR").default("INR"),
  dueAt: date,
  deliverables,
  usageRights: rights,
  includedRevisions: z.number().int().min(0).max(20),
  products: products.default([]),
  affiliateTerms: z
    .object({
      description: str,
      commissionBps: z.number().int().min(0).max(10000),
      trackingUrl: url.optional(),
    })
    .strict()
    .nullable()
    .optional(),
};
export const evidence = z
  .array(
    z
      .object({
        type: z.enum(["ASSET", "MESSAGE", "VERSION", "SHIPMENT"]),
        resourceId: id,
        note: str.optional(),
      })
      .strict(),
  )
  .max(100);
