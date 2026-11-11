import { text, area, amount, select, field } from "../components/ui";
export const organization = [
  text("name", "Organization name"),
  area("description", "About", false),
  text("city", "City", false),
  text("contactPhone", "Contact phone", false),
  field("contactEmail", "Contact email", "email", false),
  field("website", "Website", "url", false),
];
export const deliverables = {
  name: "deliverables",
  label: "Deliverables",
  type: "array",
  fields: [
    select("kind", "Content type", ["REEL", "STORY", "VIDEO", "UGC", "OTHER"]),
    { ...field("quantity", "Quantity", "number"), default: 1 },
    area("description", "Description"),
  ],
};
export const rights = {
  name: "usageRights",
  label: "Usage rights",
  type: "group",
  fields: [
    {
      ...field("channels", "Channels (comma separated)", "multi"),
      default: ["ORGANIC_SOCIAL"],
    },
    { ...field("durationDays", "Duration in days", "number"), default: 90 },
    field(
      "paidAdvertisingAllowed",
      "Paid advertising allowed",
      "checkbox",
      false,
    ),
  ],
};
export const products = {
  name: "products",
  label: "Products",
  type: "array",
  fields: [
    text("name", "Product name"),
    text("variant", "Variant", false),
    { ...field("quantity", "Quantity", "number"), default: 1 },
    amount("retailValueMinor", "Retail value per item (₹)"),
  ],
};
export const brief = (formats) => [
  {
    name: "coverAssetId",
    label: "Campaign cover image",
    type: "asset",
    purpose: "CAMPAIGN_COVER",
    hint: "Landscape images work best. Upload a product or campaign photo.",
  },
  text("title", "Campaign title"),
  area("brief", "Creative brief"),
  text("niche", "Niche"),
  select(
    "formatId",
    "Collaboration format",
    formats.map((f) => ({ value: f.id || f._id, label: f.label })),
  ),
  amount("budgetPerCreatorMinor", "Budget per creator (₹)"),
  { ...field("spots", "Creator spots", "number"), default: 1 },
  field("applicationDeadline", "Applications close", "datetime"),
  field("deadline", "Content delivery date", "datetime"),
  deliverables,
  rights,
  {
    ...field("includedRevisions", "Included revision rounds", "number"),
    default: 2,
  },
];
export const terms = (formats) => [
  select(
    "formatId",
    "Collaboration format",
    formats.map((f) => ({ value: f.id || f._id, label: f.label })),
  ),
  amount("amountMinor", "Agreed gross amount (₹)"),
  field("dueAt", "Content due", "datetime"),
  deliverables,
  rights,
  {
    ...field("includedRevisions", "Included revision rounds", "number"),
    default: 2,
  },
  products,
  {
    name: "affiliateTerms",
    label: "Affiliate compensation (affiliate format only)",
    type: "group",
    fields: [
      area("description", "Terms", false),
      field(
        "commissionBps",
        "Affiliate commission in basis points",
        "number",
        false,
      ),
      field("trackingUrl", "Tracking URL", "url", false),
    ],
  },
];
export const address = [
  "recipient",
  "phone",
  "line1",
  "line2",
  "city",
  "state",
  "postalCode",
  "country",
].map((n) =>
  text(
    n,
    {
      line1: "Street address",
      line2: "Apartment / landmark",
      postalCode: "Postal code",
    }[n] || n.replace(/^./, (c) => c.toUpperCase()),
    n !== "line2",
  ),
);
export const shipment = [
  text("courier", "Courier"),
  text("trackingNumber", "Tracking number"),
  field("trackingUrl", "Tracking URL", "url", false),
  field("expectedDeliveryAt", "Expected delivery", "datetime"),
];
export const approvalFields = (reviewers) => [
  select("policy", "Approval policy", ["ANY_ASSIGNED", "ALL_ASSIGNED"]),
  {
    name: "reviewerUserIds",
    label: "Authorized client reviewers",
    type: "multiselect",
    required: true,
    options: reviewers || [],
    hint: "Invite an independent client representative and grant access to this client/campaign first.",
  },
];
export const scopeFields = {
  name: "clientScopes",
  label: "Client and campaign grants",
  type: "array",
  fields: [
    text("clientBrandId", "Client brand ID"),
    field("allCampaigns", "All work for this client", "checkbox", false),
    field("campaignIds", "Campaign IDs (comma separated)", "multi", false),
    field(
      "directCollaborationIds",
      "Direct collaboration IDs (comma separated)",
      "multi",
      false,
    ),
  ],
};
