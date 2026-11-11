/**
 * Investor / feature-demo dataset.
 * Run via `npm run seed:demo` (requires SEED_DEMO=true) after formats/owner bootstrap.
 * Amounts are integer paise (₹1 = 100 minor).
 */
import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import * as M from "./models.js";
import { PLATFORM } from "./modules/finance/finance.service.js";

const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "InsightDemo2026!";
const COMMISSION_BPS = 1000;

const daysFromNow = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
};
const daysAgo = (n) => daysFromNow(-n);
const inr = (rupees) => Math.round(rupees * 100);
const feeOf = (gross) => Number((BigInt(gross) * BigInt(COMMISSION_BPS)) / 10000n);
const netOf = (gross) => gross - feeOf(gross);
const norm = (s) => String(s).trim().toLowerCase();

const audience = {
  countries: [
    { label: "India", percentage: 82 },
    { label: "UAE", percentage: 10 },
    { label: "Other", percentage: 8 },
  ],
  ageGroups: [
    { label: "18-24", percentage: 34 },
    { label: "25-34", percentage: 41 },
    { label: "35-44", percentage: 18 },
    { label: "45+", percentage: 7 },
  ],
  gender: { female: 58, male: 39, other: 3 },
};

function snap(format) {
  return {
    key: format.key,
    label: format.label,
    compensationPolicy: format.compensationPolicy,
    productPolicy: format.productPolicy,
    completionMode: format.completionMode,
    version: format.version,
  };
}

function rights(channels = ["ORGANIC_SOCIAL"], days = 90) {
  return {
    channels,
    durationDays: days,
    paidAdvertisingAllowed: channels.includes("PAID_ADS"),
  };
}

function deliverables(...items) {
  return items.map(([kind, quantity, description]) => ({
    kind,
    quantity,
    description,
  }));
}

function conversationKey(parts) {
  return parts.map(String).join(":");
}

async function ensureUser({ email, name, password, platformRole = "USER" }) {
  const emailNormalized = norm(email);
  const passwordHash = await bcrypt.hash(password, 12);
  let user = await M.User.findOne({ emailNormalized }).select("+passwordHash");
  if (!user) {
    user = await M.User.create({
      email,
      emailNormalized,
      name,
      passwordHash,
      platformRole,
      emailVerifiedAt: new Date(),
      status: "ACTIVE",
      preferences: { theme: "SYSTEM", introSeen: true, chatNotifications: true, reviewNotifications: true },
    });
  } else {
    user.name = name;
    user.passwordHash = passwordHash;
    user.emailVerifiedAt = user.emailVerifiedAt || new Date();
    user.status = "ACTIVE";
    user.platformRole = platformRole;
    await user.save();
  }
  return user;
}

async function ensureOrg({ type, name, city, contactEmail, description, website }) {
  const nameNormalized = norm(name);
  let org = await M.Organization.findOne({ type, nameNormalized });
  if (!org) {
    org = await M.Organization.create({
      type,
      name,
      nameNormalized,
      city,
      contactEmail,
      description,
      website,
      verificationStatus: "VERIFIED",
    });
  } else {
    org.city = city;
    org.contactEmail = contactEmail;
    org.description = description;
    org.website = website;
    org.verificationStatus = "VERIFIED";
    org.suspendedAt = undefined;
    await org.save();
  }
  return org;
}

async function ensureMembership(userId, organizationId, role = "ORG_ADMIN", clientScopes = []) {
  return M.Membership.findOneAndUpdate(
    { userId, organizationId },
    {
      $set: { role, status: "ACTIVE", clientScopes },
      $setOnInsert: { userId, organizationId },
    },
    { upsert: true, new: true },
  );
}

async function wipeBusinessData(keepUserIds, keepOrgIds) {
  const collections = [
    M.CampaignRevision,
    M.Campaign,
    M.Application,
    M.Offer,
    M.Agreement,
    M.Collaboration,
    M.ClientApproval,
    M.ApprovalDecision,
    M.ProductPackage,
    M.Shipment,
    M.ProductIssue,
    M.ProductQuestion,
    M.ContentVersion,
    M.ContentComment,
    M.RevisionRequest,
    M.CompletionSubmission,
    M.Conversation,
    M.Message,
    M.ShortlistEntry,
    M.SavedCampaign,
    M.Wallet,
    M.LedgerTransaction,
    M.Funding,
    M.Withdrawal,
    M.Refund,
    M.AgencyCharge,
    M.Dispute,
    M.Review,
    M.Notification,
    M.AgencyClient,
    M.SocialAccount,
    M.PortfolioItem,
    M.MediaAsset,
    M.OutboxEvent,
    M.IdempotencyRecord,
    M.AuditLog,
    M.Session,
    M.Membership,
    M.Invitation,
    M.CreatorProfile,
  ];
  for (const Model of collections) await Model.deleteMany({});
  await M.Organization.deleteMany({ _id: { $nin: keepOrgIds } });
  await M.User.deleteMany({ _id: { $nin: keepUserIds } });
}

export async function seedDemoData() {
  if (process.env.SEED_DEMO !== "true") {
    console.log("SEED_DEMO is not true; skipping investor demo dataset.");
    return { skipped: true };
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Investor demo seeding is disabled in production.");
  }

  const formats = Object.fromEntries(
    (await M.CollaborationFormat.find({ active: true })).map((f) => [f.key, f]),
  );
  if (!formats.PAID_VIDEO || !formats.BARTER || !formats.UGC_PACKAGE) {
    throw new Error("Run npm run seed first so collaboration formats exist.");
  }

  const ownerEmail = process.env.BOOTSTRAP_OWNER_EMAIL || "owner@insight.local";
  const ownerPassword = process.env.BOOTSTRAP_OWNER_PASSWORD || DEMO_PASSWORD;
  const owner = await ensureUser({
    email: ownerEmail,
    name: "Insight administrator",
    password: ownerPassword,
    platformRole: "OWNER",
  });

  const brandUser = await ensureUser({
    email: "brand@insight.local",
    name: "Priya Nambiar",
    password: DEMO_PASSWORD,
  });
  const brand2User = await ensureUser({
    email: "brand2@insight.local",
    name: "Arjun Varghese",
    password: DEMO_PASSWORD,
  });
  const agencyUser = await ensureUser({
    email: "agency@insight.local",
    name: "Leah George",
    password: DEMO_PASSWORD,
  });
  const managerUser = await ensureUser({
    email: "manager@insight.local",
    name: "Nikhil Thomas",
    password: DEMO_PASSWORD,
  });
  const reviewerUser = await ensureUser({
    email: "reviewer@insight.local",
    name: "Sana Krishnan",
    password: DEMO_PASSWORD,
  });

  const creatorDefs = [
    {
      email: "creator@insight.local",
      name: "Aarav Menon",
      city: "Kochi",
      bio: "Lifestyle and beauty storyteller focused on honest product rituals.",
      niches: ["Lifestyle", "Beauty"],
      languages: ["English", "Malayalam"],
      rate: inr(18000),
      ig: { handle: "aarav.frames", followers: 186000, engagementBps: 420 },
      yt: { handle: "AaravDaily", followers: 92000, engagementBps: 510 },
    },
    {
      email: "creator2@insight.local",
      name: "Meera Iyer",
      city: "Bengaluru",
      bio: "Food and wellness creator known for warm kitchen storytelling.",
      niches: ["Food", "Wellness"],
      languages: ["English", "Hindi", "Tamil"],
      rate: inr(22000),
      ig: { handle: "meerakitchen", followers: 241000, engagementBps: 380 },
      yt: { handle: "MeeraCooks", followers: 310000, engagementBps: 460 },
    },
    {
      email: "creator3@insight.local",
      name: "Kabir Shah",
      city: "Mumbai",
      bio: "Tech and gadget reviewer with crisp unboxings and comparisons.",
      niches: ["Tech", "Gadgets"],
      languages: ["English", "Hindi"],
      rate: inr(35000),
      ig: { handle: "kabir.tech", followers: 128000, engagementBps: 290 },
      yt: { handle: "KabirLab", followers: 540000, engagementBps: 340 },
    },
    {
      email: "creator4@insight.local",
      name: "Diya Nair",
      city: "Thiruvananthapuram",
      bio: "Travel and culture creator covering South India destinations.",
      niches: ["Travel", "Culture"],
      languages: ["English", "Malayalam"],
      rate: inr(16000),
      ig: { handle: "diyaroads", followers: 98000, engagementBps: 510 },
    },
    {
      email: "creator5@insight.local",
      name: "Rohan Das",
      city: "Kolkata",
      bio: "Fitness and sports content for busy professionals.",
      niches: ["Fitness", "Sports"],
      languages: ["English", "Bengali", "Hindi"],
      rate: inr(14000),
      ig: { handle: "rohanmoves", followers: 152000, engagementBps: 360 },
      yt: { handle: "RohanFit", followers: 87000, engagementBps: 400 },
    },
  ];

  const creatorUsers = [];
  for (const def of creatorDefs) {
    creatorUsers.push(
      await ensureUser({ email: def.email, name: def.name, password: DEMO_PASSWORD }),
    );
  }

  const aurea = await ensureOrg({
    type: "BRAND",
    name: "Aurea Beauty",
    city: "Kochi",
    contactEmail: "brand@insight.local",
    description: "Clean beauty brand focused on everyday skincare rituals.",
    website: "https://aurea.example",
  });
  const nila = await ensureOrg({
    type: "BRAND",
    name: "Nila Foods",
    city: "Thrissur",
    contactEmail: "brand2@insight.local",
    description: "Regional pantry staples and ready-to-cook kits.",
    website: "https://nilafoods.example",
  });
  const studio = await ensureOrg({
    type: "AGENCY",
    name: "Studio Collective",
    city: "Kochi",
    contactEmail: "agency@insight.local",
    description: "Creator partnerships and campaign production for Indian brands.",
    website: "https://studiocollective.example",
  });

  await wipeBusinessData(
    [owner._id, brandUser._id, brand2User._id, agencyUser._id, managerUser._id, reviewerUser._id, ...creatorUsers.map((u) => u._id)],
    [aurea._id, nila._id, studio._id],
  );

  await ensureMembership(brandUser._id, aurea._id, "ORG_ADMIN");
  await ensureMembership(brand2User._id, nila._id, "ORG_ADMIN");
  await ensureMembership(agencyUser._id, studio._id, "ORG_ADMIN");
  await ensureMembership(managerUser._id, studio._id, "CAMPAIGN_MANAGER", [
    {
      clientBrandId: aurea._id,
      allCampaigns: true,
      campaignIds: [],
      directCollaborationIds: [],
    },
  ]);
  await ensureMembership(reviewerUser._id, studio._id, "CLIENT_REVIEWER", [
    {
      clientBrandId: aurea._id,
      allCampaigns: true,
      campaignIds: [],
      directCollaborationIds: [],
    },
  ]);

  await M.AgencyClient.create({
    agencyOrganizationId: studio._id,
    brandOrganizationId: aurea._id,
    contactUserIds: [brandUser._id, reviewerUser._id],
    budgetMinor: inr(1500000),
    committedMinor: inr(420000),
    retainerChargeMinor: inr(75000),
    status: "ACTIVE",
  });

  const creators = [];
  for (let i = 0; i < creatorDefs.length; i++) {
    const def = creatorDefs[i];
    const user = creatorUsers[i];
    const profile = await M.CreatorProfile.create({
      userId: user._id,
      bio: def.bio,
      city: def.city,
      cityNormalized: norm(def.city),
      niches: def.niches,
      languages: def.languages,
      startingRateMinor: def.rate,
      audience,
      verificationStatus: "VERIFIED",
      completedCount: 0,
      ratingAverage: 0,
      ratingCount: 0,
    });
    if (def.ig) {
      await M.SocialAccount.create({
        creatorProfileId: profile._id,
        platform: "INSTAGRAM",
        handle: def.ig.handle,
        profileUrl: `https://instagram.com/${def.ig.handle}`,
        followers: def.ig.followers,
        engagementBps: def.ig.engagementBps,
        engagementSample: { posts: 12, likes: Math.round(def.ig.followers * 0.04), comments: 1800 },
        audience,
        source: "SELF_REPORTED",
        measuredAt: daysAgo(7),
      });
    }
    if (def.yt) {
      await M.SocialAccount.create({
        creatorProfileId: profile._id,
        platform: "YOUTUBE",
        handle: def.yt.handle,
        profileUrl: `https://youtube.com/@${def.yt.handle}`,
        followers: def.yt.followers,
        engagementBps: def.yt.engagementBps,
        engagementSample: { posts: 8, likes: Math.round(def.yt.followers * 0.03), comments: 2400 },
        audience,
        source: "SELF_REPORTED",
        measuredAt: daysAgo(10),
      });
    }
    await M.PortfolioItem.create({
      creatorProfileId: profile._id,
      title: `${def.niches[0]} highlight reel`,
      description: `Selected work for ${def.niches.join(" & ").toLowerCase()} brands.`,
      externalVideoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      brandName: i % 2 ? "Nila Foods" : "Aurea Beauty",
      evidenceUrl: "https://example.com/case-study",
      displayOrder: 1,
      publishedAt: daysAgo(40 + i),
    });
    creators.push({ ...def, user, profile });
  }

  const [aarav, meera, kabir, diya, rohan] = creators;
  const paid = formats.PAID_VIDEO;
  const barter = formats.BARTER;
  const ugc = formats.UGC_PACKAGE;

  const usage = rights(["ORGANIC_SOCIAL", "BRAND_SITE"], 120);
  const paidUsage = rights(["ORGANIC_SOCIAL", "PAID_ADS"], 180);

  async function makeCampaign({
    brand,
    agency,
    creatorUser,
    state,
    title,
    brief,
    niche,
    format,
    budgetPerCreator,
    spots,
    deadlineDays = 21,
    applyDays = 10,
    compensationBudget,
    serviceCharge = 0,
    reservedSpots = 0,
    committedMinor = 0,
  }) {
    const draft = {
      title,
      brief,
      niche,
      formatId: format._id,
      budgetPerCreatorMinor: budgetPerCreator,
      spots,
      applicationDeadline: daysFromNow(applyDays),
      deadline: daysFromNow(deadlineDays),
      deliverables: deliverables(
        ["REEL", 1, "Primary hero reel"],
        ["STORY", 3, "Supporting story frames"],
      ),
      usageRights: usage,
      includedRevisions: 2,
    };
    const campaign = await M.Campaign.create({
      brandOrganizationId: brand._id,
      agencyOrganizationId: agency?._id,
      createdByUserId: creatorUser._id,
      state,
      niche,
      formatId: format._id,
      titleNormalized: norm(title),
      publicBudgetPerCreatorMinor: state === "PUBLISHED" || state === "CLOSED" ? budgetPerCreator : 0,
      draft,
      currentRevisionNumber: 0,
      compensationBudgetMinor: compensationBudget ?? budgetPerCreator * spots,
      serviceChargeMinor: serviceCharge,
      applicationDeadline: draft.applicationDeadline,
      spots,
      reservedSpots,
      committedMinor,
    });

    if (["PLATFORM_REVIEW", "PUBLISHED", "CLOSED", "CHANGES_REQUESTED", "CLIENT_REVIEW"].includes(state)) {
      campaign.currentRevisionNumber = 1;
      const revision = await M.CampaignRevision.create({
        ...draft,
        campaignId: campaign._id,
        revisionNumber: 1,
        formatSnapshot: snap(format),
        preparedByUserId: creatorUser._id,
        frozenAt: daysAgo(3),
      });
      campaign.reviewRevisionId = revision._id;
      if (state === "PUBLISHED" || state === "CLOSED") campaign.publishedRevisionId = revision._id;
      await campaign.save();
      return { campaign, revision };
    }
    return { campaign, revision: null };
  }

  const openBeauty = await makeCampaign({
    brand: aurea,
    creatorUser: brandUser,
    state: "PUBLISHED",
    title: "Glow Ritual Morning Reel",
    brief: "Show a calm morning skincare ritual using Aurea serum and moisturizer. Natural light, honest texture close-ups, soft voiceover.",
    niche: "Beauty",
    format: paid,
    budgetPerCreator: inr(25000),
    spots: 3,
    applyDays: 14,
    deadlineDays: 35,
  });

  const openFood = await makeCampaign({
    brand: nila,
    creatorUser: brand2User,
    state: "PUBLISHED",
    title: "Weeknight Pantry Kit Demo",
    brief: "Cook a 15-minute dinner with Nila ready kits. Emphasize ease for busy families and clear product shots of packaging.",
    niche: "Food",
    format: paid,
    budgetPerCreator: inr(18000),
    spots: 4,
    applyDays: 12,
    deadlineDays: 30,
  });

  const agencyManaged = await makeCampaign({
    brand: aurea,
    agency: studio,
    creatorUser: agencyUser,
    state: "PUBLISHED",
    title: "Festive Gift Set Launch",
    brief: "Agency-led festive campaign for Aurea gift sets. Lifestyle framing around gifting and family gatherings.",
    niche: "Lifestyle",
    format: paid,
    budgetPerCreator: inr(32000),
    spots: 2,
    applyDays: 9,
    deadlineDays: 40,
    serviceCharge: inr(40000),
  });

  const barterTravel = await makeCampaign({
    brand: nila,
    creatorUser: brand2User,
    state: "PUBLISHED",
    title: "Travel Snack Pairing Exchange",
    brief: "Barter collaboration: receive snack kits and create destination-friendly pairing content.",
    niche: "Travel",
    format: barter,
    budgetPerCreator: 0,
    spots: 2,
    applyDays: 18,
    deadlineDays: 45,
    compensationBudget: 0,
  });

  const draftCampaign = await makeCampaign({
    brand: aurea,
    creatorUser: brandUser,
    state: "DRAFT",
    title: "SPF Everyday Habit (Draft)",
    brief: "Draft brief for summer SPF education series.",
    niche: "Beauty",
    format: paid,
    budgetPerCreator: inr(20000),
    spots: 2,
  });

  const reviewCampaign = await makeCampaign({
    brand: aurea,
    agency: studio,
    creatorUser: agencyUser,
    state: "PLATFORM_REVIEW",
    title: "Owner Review: UGC Testimonial Pack",
    brief: "Collect authentic UGC testimonials for landing page use.",
    niche: "Beauty",
    format: ugc,
    budgetPerCreator: inr(12000),
    spots: 5,
  });

  const closedCampaign = await makeCampaign({
    brand: aurea,
    creatorUser: brandUser,
    state: "CLOSED",
    title: "Winter Hydration Wrap-up",
    brief: "Completed winter hydration campaign with published creators.",
    niche: "Beauty",
    format: paid,
    budgetPerCreator: inr(20000),
    spots: 2,
    applyDays: -20,
    deadlineDays: -5,
    reservedSpots: 2,
    committedMinor: inr(40000),
  });

  // Applications on open campaigns
  const apps = [];
  for (const [campaignBundle, creator, pitch, rate, state] of [
    [openBeauty, aarav, "I can film a soft daylight ritual with real texture detail.", inr(24000), "PENDING"],
    [openBeauty, meera, "Happy to connect skincare with wellness breakfast pacing.", inr(26000), "PENDING"],
    [openBeauty, diya, "Travel-friendly packing ritual angle for serum.", inr(22000), "DECLINED"],
    [openFood, meera, "Family weeknight dinner with kids reaction cutaways.", inr(18000), "PENDING"],
    [openFood, rohan, "Post-workout quick meal framing.", inr(17000), "PENDING"],
    [agencyManaged, aarav, "Festive home setup with gift unboxing.", inr(32000), "OFFERED"],
    [agencyManaged, kabir, "Tech-gift parallel for premium packaging.", inr(34000), "PENDING"],
    [barterTravel, diya, "Road-trip snack pairings across Kerala routes.", 0, "PENDING"],
    [closedCampaign, aarav, "Completed winter hydration story.", inr(20000), "ACCEPTED"],
    [closedCampaign, meera, "Kitchen-adjacent hydration tip format.", inr(20000), "ACCEPTED"],
  ]) {
    apps.push(
      await M.Application.create({
        campaignId: campaignBundle.campaign._id,
        campaignRevisionId: campaignBundle.revision._id,
        creatorProfileId: creator.profile._id,
        pitch,
        proposedRateMinor: rate,
        state,
        decidedByUserId: ["DECLINED", "ACCEPTED", "OFFERED"].includes(state) ? brandUser._id : undefined,
        decisionReason: state === "DECLINED" ? "Looking for stronger beauty portfolio fit." : undefined,
      }),
    );
  }

  async function makeDeal({
    campaignBundle,
    brand,
    agency,
    creator,
    application,
    amountMinor,
    format,
    products = [],
    workState,
    fundingState,
    productState,
    offerState = "ACCEPTED",
    dueDays = 14,
    revisionsIncluded = 2,
  }) {
    const formatSnapshot = snap(format);
    const feeMinor = feeOf(amountMinor);
    const creatorNetMinor = netOf(amountMinor);
    const terms = {
      formatId: format._id,
      formatSnapshot,
      amountMinor,
      currency: "INR",
      dueAt: daysFromNow(dueDays),
      deliverables: deliverables(["REEL", 1, "Primary deliverable"], ["STORY", 2, "Story support"]),
      usageRights: amountMinor > 0 ? paidUsage : usage,
      includedRevisions: revisionsIncluded,
      products,
      commissionBps: amountMinor ? COMMISSION_BPS : 0,
      feeMinor,
      creatorNetMinor,
    };
    const offer = await M.Offer.create({
      campaignId: campaignBundle?.campaign?._id,
      applicationId: application?._id,
      brandOrganizationId: brand._id,
      agencyOrganizationId: agency?._id,
      creatorProfileId: creator.profile._id,
      preparedByUserId: agency ? agencyUser._id : brandUser._id,
      state: offerState,
      revisionNumber: 1,
      revisions: [{ revisionNumber: 1, ...terms }],
      sentRevisionNumber: offerState === "DRAFT" ? undefined : 1,
      sentAt: offerState === "DRAFT" ? undefined : daysAgo(8),
      decisionAt: offerState === "ACCEPTED" ? daysAgo(7) : undefined,
    });

    if (offerState !== "ACCEPTED") return { offer, agreement: null, collaboration: null, terms };

    const agreement = await M.Agreement.create({
      offerId: offer._id,
      campaignId: campaignBundle?.campaign?._id,
      acceptedOfferRevision: 1,
      brandOrganizationId: brand._id,
      agencyOrganizationId: agency?._id,
      creatorProfileId: creator.profile._id,
      ...terms,
      acceptedByUserId: creator.user._id,
      acceptedAt: daysAgo(7),
    });

    const collaboration = await M.Collaboration.create({
      agreementId: agreement._id,
      campaignId: campaignBundle?.campaign?._id,
      brandOrganizationId: brand._id,
      agencyOrganizationId: agency?._id,
      creatorProfileId: creator.profile._id,
      dueAt: terms.dueAt,
      workState,
      fundingState,
      productState,
      contentSequence: 0,
      completionSequence: 0,
      revisionCount: 0,
    });

    return { offer, agreement, collaboration, terms };
  }

  // Completed paid deal (Aarav + Aurea closed campaign)
  const completedAarav = await makeDeal({
    campaignBundle: closedCampaign,
    brand: aurea,
    creator: aarav,
    application: apps.find((a) => String(a.creatorProfileId) === String(aarav.profile._id) && String(a.campaignId) === String(closedCampaign.campaign._id)),
    amountMinor: inr(20000),
    format: paid,
    workState: "COMPLETED",
    fundingState: "RELEASED",
    productState: "NOT_REQUIRED",
    dueDays: -3,
  });

  // Completed paid deal (Meera + Aurea)
  const completedMeera = await makeDeal({
    campaignBundle: closedCampaign,
    brand: aurea,
    creator: meera,
    application: apps.find((a) => String(a.creatorProfileId) === String(meera.profile._id) && String(a.campaignId) === String(closedCampaign.campaign._id)),
    amountMinor: inr(20000),
    format: paid,
    workState: "COMPLETED",
    fundingState: "RELEASED",
    productState: "NOT_REQUIRED",
    dueDays: -2,
  });

  // Active agency deal in review with content
  const activeAgency = await makeDeal({
    campaignBundle: agencyManaged,
    brand: aurea,
    agency: studio,
    creator: aarav,
    application: apps.find((a) => String(a.creatorProfileId) === String(aarav.profile._id) && String(a.campaignId) === String(agencyManaged.campaign._id)),
    amountMinor: inr(32000),
    format: paid,
    workState: "IN_REVIEW",
    fundingState: "HELD",
    productState: "NOT_REQUIRED",
    dueDays: 18,
  });

  // Direct brand deal awaiting funding / preparation
  const awaitingFund = await makeDeal({
    campaignBundle: openFood,
    brand: nila,
    creator: meera,
    amountMinor: inr(18000),
    format: paid,
    workState: "PREPARATION",
    fundingState: "AWAITING",
    productState: "NOT_REQUIRED",
    dueDays: 20,
  });

  // Tech deal approved, ready for completion
  const approvedKabir = await makeDeal({
    campaignBundle: null,
    brand: aurea,
    creator: kabir,
    amountMinor: inr(45000),
    format: paid,
    workState: "APPROVED",
    fundingState: "HELD",
    productState: "NOT_REQUIRED",
    dueDays: 10,
  });

  // Barter travel with product received
  const barterDiya = await makeDeal({
    campaignBundle: barterTravel,
    brand: nila,
    creator: diya,
    amountMinor: 0,
    format: barter,
    products: [
      { name: "Nila Trail Mix Kit", variant: "Assorted", quantity: 4, retailValueMinor: inr(2400) },
      { name: "Nila Instant Poha", variant: "Classic", quantity: 6, retailValueMinor: inr(900) },
    ],
    workState: "VERIFIED",
    fundingState: "NOT_REQUIRED",
    productState: "RECEIVED",
    dueDays: 12,
  });

  // Fitness deal with revision requested
  const revisionRohan = await makeDeal({
    campaignBundle: null,
    brand: nila,
    creator: rohan,
    amountMinor: inr(15000),
    format: paid,
    workState: "REVISION_REQUESTED",
    fundingState: "HELD",
    productState: "NOT_REQUIRED",
    dueDays: 8,
  });

  // Draft offer on open beauty for Meera (brand considering)
  await makeDeal({
    campaignBundle: openBeauty,
    brand: aurea,
    creator: meera,
    application: apps.find((a) => String(a.creatorProfileId) === String(meera.profile._id) && String(a.campaignId) === String(openBeauty.campaign._id)),
    amountMinor: inr(25000),
    format: paid,
    workState: "PREPARATION",
    fundingState: "AWAITING",
    productState: "NOT_REQUIRED",
    offerState: "DRAFT",
  });

  // Sent offer pending creator decision
  await makeDeal({
    campaignBundle: openFood,
    brand: nila,
    creator: rohan,
    application: apps.find((a) => String(a.creatorProfileId) === String(rohan.profile._id) && String(a.campaignId) === String(openFood.campaign._id)),
    amountMinor: inr(17000),
    format: paid,
    workState: "PREPARATION",
    fundingState: "AWAITING",
    productState: "NOT_REQUIRED",
    offerState: "SENT",
  });

  // Content versions / comments / completion
  async function addContent(collab, creator, state, sequence, note) {
    const version = await M.ContentVersion.create({
      collaborationId: collab._id,
      sequence,
      externalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      title: `Cut ${sequence}`,
      note,
      submittedByUserId: creator.user._id,
      submittedAt: daysAgo(4 - sequence),
      state,
    });
    collab.latestContentVersionId = version._id;
    collab.contentSequence = sequence;
    if (state === "APPROVED") collab.approvedContentVersionId = version._id;
    await collab.save();
    return version;
  }

  const completedContentA = await addContent(completedAarav.collaboration, aarav, "APPROVED", 1, "Final winter hydration cut.");
  const completedContentM = await addContent(completedMeera.collaboration, meera, "APPROVED", 1, "Kitchen hydration tip final.");
  const agencyContent = await addContent(activeAgency.collaboration, aarav, "SUBMITTED", 1, "Festive gift unboxing v1.");
  await M.ContentComment.create({
    collaborationId: activeAgency.collaboration._id,
    contentVersionId: agencyContent._id,
    authorUserId: agencyUser._id,
    authorName: agencyUser.name,
    timestampMs: 12500,
    text: "Hold on the ribbon detail for one more beat.",
  });
  await M.ContentComment.create({
    collaborationId: activeAgency.collaboration._id,
    contentVersionId: agencyContent._id,
    authorUserId: brandUser._id,
    authorName: brandUser.name,
    timestampMs: 28400,
    text: "Logo on the box should stay readable here.",
  });

  const kabirContent = await addContent(approvedKabir.collaboration, kabir, "APPROVED", 1, "Approved gadget-style unboxing.");
  const diyaContent = await addContent(barterDiya.collaboration, diya, "APPROVED", 1, "Trail snack pairing approved.");
  const rohanV1 = await addContent(revisionRohan.collaboration, rohan, "CHANGES_REQUESTED", 1, "Gym floor cut needing cleaner audio.");
  await M.RevisionRequest.create({
    collaborationId: revisionRohan.collaboration._id,
    contentVersionId: rohanV1._id,
    requestedByUserId: brand2User._id,
    roundNumber: 1,
    kind: "INCLUDED",
    feedback: "Reduce ambient gym noise and tighten the CTA ending.",
    state: "REQUESTED",
  });
  revisionRohan.collaboration.revisionCount = 1;
  await revisionRohan.collaboration.save();

  for (const [deal, content, creatorUser, mode, url] of [
    [completedAarav, completedContentA, aarav.user, "PUBLISHED", "https://instagram.com/p/aurea-winter-aarav"],
    [completedMeera, completedContentM, meera.user, "PUBLISHED", "https://instagram.com/p/aurea-winter-meera"],
    [barterDiya, diyaContent, diya.user, "PUBLISHED", "https://instagram.com/p/nila-travel-diya"],
  ]) {
    const completion = await M.CompletionSubmission.create({
      collaborationId: deal.collaboration._id,
      approvedContentVersionId: content._id,
      attemptNumber: 1,
      mode,
      platform: "INSTAGRAM",
      url,
      completedAt: daysAgo(3),
      submittedByUserId: creatorUser._id,
      state: "VERIFIED",
      reviewNote: "Verified against agreed brief.",
      checkedByUserId: brandUser._id,
    });
    deal.collaboration.completionId = completion._id;
    deal.collaboration.completionSequence = 1;
    await deal.collaboration.save();
  }

  // Product package + shipment for barter
  const pkg = await M.ProductPackage.create({
    collaborationId: barterDiya.collaboration._id,
    agreedItems: barterDiya.terms.products,
    retailValueMinor: barterDiya.terms.products.reduce((n, p) => n + p.retailValueMinor, 0),
    deliveryAddress: {
      recipient: diya.name,
      phone: "+91 98765 43210",
      line1: "14 Palm Grove",
      line2: "Near Museum",
      city: "Thiruvananthapuram",
      state: "Kerala",
      postalCode: "695001",
      country: "IN",
    },
    addressSubmittedByUserId: diya.user._id,
  });
  await M.Shipment.create({
    productPackageId: pkg._id,
    collaborationId: barterDiya.collaboration._id,
    courier: "Delhivery",
    trackingNumber: "NILADEMO88421",
    trackingUrl: "https://www.delhivery.com/track/package/NILADEMO88421",
    expectedDeliveryAt: daysAgo(2),
    state: "RECEIVED",
    events: [
      { kind: "DISPATCHED", note: "Handover to courier", actorUserId: brand2User._id, at: daysAgo(6) },
      { kind: "IN_TRANSIT", note: "Arrived at local hub", actorUserId: brand2User._id, at: daysAgo(4) },
      { kind: "RECEIVED", note: "Creator confirmed intact delivery", actorUserId: diya.user._id, at: daysAgo(2) },
    ],
    receivedByUserId: diya.user._id,
    receivedAt: daysAgo(2),
  });

  // Reviews on completed deals
  await M.Review.create({
    collaborationId: completedAarav.collaboration._id,
    campaignId: closedCampaign.campaign._id,
    campaignStars: 5,
    campaignFeedback: "Clear brief and timely approvals.",
    reviewerName: aarav.name,
    reviewerUserId: aarav.user._id,
    reviewingParty: "CREATOR",
    targetType: "BRAND",
    targetId: aurea._id,
    stars: 5,
    text: "Aurea was organized and respectful of creative direction.",
  });
  await M.Review.create({
    collaborationId: completedAarav.collaboration._id,
    campaignId: closedCampaign.campaign._id,
    campaignStars: 5,
    campaignFeedback: "Strong ritual storytelling and on-brand pacing.",
    reviewerName: brandUser.name,
    reviewerUserId: brandUser._id,
    reviewingParty: "COMMISSIONER",
    targetType: "CREATOR",
    targetId: aarav.profile._id,
    stars: 5,
    text: "Excellent production quality and reliable communication.",
  });
  await M.Review.create({
    collaborationId: completedMeera.collaboration._id,
    campaignId: closedCampaign.campaign._id,
    campaignStars: 4,
    campaignFeedback: "Warm kitchen framing worked well for the product.",
    reviewerName: brandUser.name,
    reviewerUserId: brandUser._id,
    reviewingParty: "COMMISSIONER",
    targetType: "CREATOR",
    targetId: meera.profile._id,
    stars: 4,
    text: "Great presence on camera; minor delay on first draft.",
  });
  await M.Review.create({
    collaborationId: completedMeera.collaboration._id,
    campaignId: closedCampaign.campaign._id,
    reviewerName: meera.name,
    reviewerUserId: meera.user._id,
    reviewingParty: "CREATOR",
    targetType: "BRAND",
    targetId: aurea._id,
    stars: 5,
    text: "Smooth payout and thoughtful feedback.",
  });

  for (const profile of [aarav.profile, meera.profile]) {
    const rows = await M.Review.aggregate([
      { $match: { targetType: "CREATOR", targetId: profile._id } },
      { $group: { _id: null, average: { $avg: "$stars" }, count: { $sum: 1 } } },
    ]);
    profile.completedCount = await M.Collaboration.countDocuments({
      creatorProfileId: profile._id,
      workState: "COMPLETED",
    });
    profile.ratingAverage = rows[0]?.average || 0;
    profile.ratingCount = rows[0]?.count || 0;
    await profile.save();
  }
  diya.profile.completedCount = 0;
  await diya.profile.save();

  // Finance: wallets, funding, ledgers, withdrawals
  const aureaWallet = await M.Wallet.create({
    ownerType: "BRAND",
    ownerId: aurea._id,
    currency: "INR",
    availableMinor: 0,
    reservedMinor: 0,
    heldMinor: inr(32000) + inr(45000), // active agency + kabir deals
  });
  await M.Wallet.create({
    ownerType: "BRAND",
    ownerId: nila._id,
    currency: "INR",
    availableMinor: 0,
    reservedMinor: 0,
    heldMinor: inr(15000), // rohan revision deal
  });
  void aureaWallet;

  const aaravWallet = await M.Wallet.create({
    ownerType: "CREATOR",
    ownerId: aarav.profile._id,
    currency: "INR",
    // net from completed deal, minus paid payout and open reserved withdrawal
    availableMinor: netOf(inr(20000)) - inr(5000) - inr(5000),
    reservedMinor: inr(5000),
    heldMinor: 0,
  });
  const meeraWallet = await M.Wallet.create({
    ownerType: "CREATOR",
    ownerId: meera.profile._id,
    currency: "INR",
    availableMinor: netOf(inr(20000)),
    reservedMinor: 0,
    heldMinor: 0,
  });
  await M.Wallet.create({
    ownerType: "CREATOR",
    ownerId: kabir.profile._id,
    currency: "INR",
    availableMinor: 0,
    reservedMinor: 0,
    heldMinor: 0,
  });
  await M.Wallet.create({
    ownerType: "CREATOR",
    ownerId: diya.profile._id,
    currency: "INR",
    availableMinor: 0,
    reservedMinor: 0,
    heldMinor: 0,
  });
  await M.Wallet.create({
    ownerType: "CREATOR",
    ownerId: rohan.profile._id,
    currency: "INR",
    availableMinor: 0,
    reservedMinor: 0,
    heldMinor: 0,
  });
  await M.Wallet.create({
    ownerType: "PLATFORM",
    ownerId: PLATFORM,
    currency: "INR",
    availableMinor: feeOf(inr(20000)) * 2,
    reservedMinor: 0,
    heldMinor: 0,
  });

  async function fundingRecord(collab, brand, amount, state, ref, submittedBy = brandUser) {
    return M.Funding.create({
      collaborationId: collab._id,
      brandOrganizationId: brand._id,
      submittedByUserId: submittedBy._id,
      amountMinor: amount,
      currency: "INR",
      rail: "UPI",
      externalReference: ref,
      externalReferenceNormalized: ref.replace(/\s/g, "").toUpperCase(),
      state,
      reviewedByUserId: state === "VERIFIED" ? owner._id : undefined,
      reviewNote: state === "VERIFIED" ? "Bank statement matched." : undefined,
      verificationReference: state === "VERIFIED" ? `VR-${ref}` : undefined,
      verifiedAt: state === "VERIFIED" ? daysAgo(6) : undefined,
    });
  }

  const fundCompletedA = await fundingRecord(completedAarav.collaboration, aurea, inr(20000), "VERIFIED", "UPIAUREA20001");
  const fundCompletedM = await fundingRecord(completedMeera.collaboration, aurea, inr(20000), "VERIFIED", "UPIAUREA20002");
  const fundAgency = await fundingRecord(activeAgency.collaboration, aurea, inr(32000), "VERIFIED", "UPIAUREA32001");
  const fundKabir = await fundingRecord(approvedKabir.collaboration, aurea, inr(45000), "VERIFIED", "UPIAUREA45001");
  const fundRohan = await fundingRecord(revisionRohan.collaboration, nila, inr(15000), "VERIFIED", "UPINILA15001", brand2User);
  await fundingRecord(awaitingFund.collaboration, nila, inr(18000), "SUBMITTED", "UPINILA18001", brand2User);

  const ledger = async (kind, sourceId, collaborationId, entries) =>
    M.LedgerTransaction.create({ kind, sourceId, collaborationId, currency: "INR", entries });

  for (const [fund, brandId, amount, collabId] of [
    [fundCompletedA, aurea._id, inr(20000), completedAarav.collaboration._id],
    [fundCompletedM, aurea._id, inr(20000), completedMeera.collaboration._id],
    [fundAgency, aurea._id, inr(32000), activeAgency.collaboration._id],
    [fundKabir, aurea._id, inr(45000), approvedKabir.collaboration._id],
    [fundRohan, nila._id, inr(15000), revisionRohan.collaboration._id],
  ]) {
    await ledger("FUNDING", fund._id, collabId, [
      { accountCode: "BANK", ownerId: PLATFORM, debitMinor: amount, creditMinor: 0 },
      { accountCode: "CLIENT_HELD", ownerId: brandId, debitMinor: 0, creditMinor: amount },
    ]);
  }

  for (const deal of [completedAarav, completedMeera]) {
    const amount = deal.agreement.amountMinor;
    await ledger("RELEASE", deal.collaboration._id, deal.collaboration._id, [
      { accountCode: "CLIENT_HELD", ownerId: aurea._id, debitMinor: amount, creditMinor: 0 },
      { accountCode: "CREATOR_AVAILABLE", ownerId: deal.agreement.creatorProfileId, debitMinor: 0, creditMinor: deal.agreement.creatorNetMinor },
      { accountCode: "PLATFORM_REVENUE", ownerId: PLATFORM, debitMinor: 0, creditMinor: deal.agreement.feeMinor },
    ]);
  }

  const withdrawalPaid = await M.Withdrawal.create({
    creatorProfileId: aarav.profile._id,
    walletId: aaravWallet._id,
    amountMinor: inr(5000),
    destinationEncrypted: "demo-encrypted-upi",
    destinationMasked: "••••rav@upi",
    state: "PAID",
    transferReference: "PAYOUT-DEMO-5000",
    processedByUserId: owner._id,
    requestedAt: daysAgo(5),
    paidAt: daysAgo(4),
  });
  await ledger("WITHDRAWAL_RESERVATION", withdrawalPaid._id, null, [
    { accountCode: "CREATOR_AVAILABLE", ownerId: aarav.profile._id, debitMinor: inr(5000), creditMinor: 0 },
    { accountCode: "CREATOR_RESERVED", ownerId: aarav.profile._id, debitMinor: 0, creditMinor: inr(5000) },
  ]);
  await ledger("PAYOUT", withdrawalPaid._id, null, [
    { accountCode: "CREATOR_RESERVED", ownerId: aarav.profile._id, debitMinor: inr(5000), creditMinor: 0 },
    { accountCode: "BANK", ownerId: PLATFORM, debitMinor: 0, creditMinor: inr(5000) },
  ]);
  // after payout, reserved should be 0 for that amount — adjust wallet already set with reserved 5000 for a NEW request
  aaravWallet.reservedMinor = inr(5000);
  await aaravWallet.save();

  const withdrawalOpen = await M.Withdrawal.create({
    creatorProfileId: aarav.profile._id,
    walletId: aaravWallet._id,
    amountMinor: inr(5000),
    destinationEncrypted: "demo-encrypted-upi-2",
    destinationMasked: "••••rav@upi",
    state: "REQUESTED",
    requestedAt: daysAgo(1),
  });
  await ledger("WITHDRAWAL_RESERVATION", withdrawalOpen._id, null, [
    { accountCode: "CREATOR_AVAILABLE", ownerId: aarav.profile._id, debitMinor: inr(5000), creditMinor: 0 },
    { accountCode: "CREATOR_RESERVED", ownerId: aarav.profile._id, debitMinor: 0, creditMinor: inr(5000) },
  ]);

  await M.AgencyCharge.create({
    agencyOrganizationId: studio._id,
    brandOrganizationId: aurea._id,
    campaignId: agencyManaged.campaign._id,
    collaborationId: activeAgency.collaboration._id,
    kind: "CAMPAIGN",
    agreedAmountMinor: inr(40000),
    description: "Festive campaign management fee",
    state: "AGREED",
  });
  await M.AgencyCharge.create({
    agencyOrganizationId: studio._id,
    brandOrganizationId: aurea._id,
    kind: "RETAINER",
    agreedAmountMinor: inr(75000),
    description: "Monthly retainer — October",
    state: "SETTLED",
    externalReference: "INV-STUDIO-1026",
    settledAt: daysAgo(12),
  });

  // Discovery: shortlists + saved campaigns
  for (const creator of [aarav, meera, kabir, diya]) {
    await M.ShortlistEntry.create({
      ownerOrganizationId: aurea._id,
      clientBrandOrganizationId: aurea._id,
      creatorProfileId: creator.profile._id,
      addedByUserId: brandUser._id,
    });
  }
  await M.ShortlistEntry.create({
    ownerOrganizationId: studio._id,
    clientBrandOrganizationId: aurea._id,
    creatorProfileId: aarav.profile._id,
    addedByUserId: agencyUser._id,
  });
  await M.SavedCampaign.create({
    creatorProfileId: aarav.profile._id,
    campaignId: openBeauty.campaign._id,
    savedAt: daysAgo(2),
  });
  await M.SavedCampaign.create({
    creatorProfileId: meera.profile._id,
    campaignId: openFood.campaign._id,
    savedAt: daysAgo(1),
  });
  await M.SavedCampaign.create({
    creatorProfileId: diya.profile._id,
    campaignId: barterTravel.campaign._id,
    savedAt: daysAgo(1),
  });

  // Messaging
  async function thread({ contextType, brand, agency, campaign, collaboration, creator, messages }) {
    const key = conversationKey([
      contextType,
      brand._id,
      agency?._id || "",
      campaign?._id || "",
      collaboration?._id || "",
      "",
      creator?.profile?._id || "",
    ]);
    const conversation = await M.Conversation.create({
      contextType,
      campaignId: campaign?._id,
      collaborationId: collaboration?._id,
      brandOrganizationId: brand._id,
      agencyOrganizationId: agency?._id,
      creatorProfileId: creator?.profile?._id,
      participantScopeKey: key,
      lastMessageAt: daysAgo(0),
      readCursors: [],
    });
    let last;
    for (let i = 0; i < messages.length; i++) {
      const [sender, text] = messages[i];
      last = await M.Message.create({
        conversationId: conversation._id,
        senderUserId: sender._id,
        senderName: sender.name,
        text,
        attachmentAssetIds: [],
        clientMessageId: `demo-${conversation._id}-${i}`,
        createdAt: daysAgo(messages.length - i),
      });
    }
    conversation.lastMessageAt = last.createdAt;
    conversation.readCursors = [
      { userId: messages[0][0]._id, lastReadMessageId: last._id, readAt: new Date() },
    ];
    await conversation.save();
    return conversation;
  }

  await thread({
    contextType: "CAMPAIGN",
    brand: aurea,
    campaign: openBeauty.campaign,
    creator: aarav,
    messages: [
      [aarav.user, "Hi Priya — I loved the glow ritual brief. Happy to share a shot list."],
      [brandUser, "Perfect. Please keep packaging labels readable in daylight."],
      [aarav.user, "Understood. I can deliver a draft within a week of confirmation."],
    ],
  });

  await thread({
    contextType: "COLLABORATION",
    brand: aurea,
    agency: studio,
    campaign: agencyManaged.campaign,
    collaboration: activeAgency.collaboration,
    creator: aarav,
    messages: [
      [agencyUser, "Festive set has arrived at studio. Can you shoot tomorrow evening?"],
      [aarav.user, "Yes — sending a moodboard in an hour."],
      [brandUser, "Please include the limited gold sleeve in the hero shot."],
      [aarav.user, "Added to the shot list. Draft upload coming soon."],
    ],
  });

  await thread({
    contextType: "COLLABORATION",
    brand: nila,
    collaboration: awaitingFund.collaboration,
    creator: meera,
    messages: [
      [meera.user, "Ready to start once funding is verified."],
      [brand2User, "Transfer submitted — waiting on Insight verification."],
    ],
  });

  await thread({
    contextType: "DIRECT",
    brand: aurea,
    creator: kabir,
    messages: [
      [brandUser, "Would you be open to a premium device + skincare crossover later this quarter?"],
      [kabir.user, "Yes, if the creative stays product-honest. Share a draft brief anytime."],
    ],
  });

  // Notifications
  const notes = [
    [aarav.user, aurea, openBeauty.campaign, null, "APPLICATION_RECEIVED", "Pitch received", "Aurea opened your campaign conversation."],
    [brandUser, aurea, openBeauty.campaign, null, "NEW_APPLICATION", "New creator pitch", "Aarav Menon applied to Glow Ritual Morning Reel."],
    [agencyUser, studio, agencyManaged.campaign, activeAgency.collaboration, "CONTENT_SUBMITTED", "Draft ready for review", "Aarav submitted festive gift cut 1."],
    [owner, null, null, null, "WITHDRAWAL_REQUESTED", "Payout request", "Aarav requested a ₹5,000 withdrawal."],
    [meera.user, nila, openFood.campaign, awaitingFund.collaboration, "OFFER_ACCEPTED", "Collaboration started", "Nila Foods collaboration is awaiting funding."],
    [brand2User, nila, null, revisionRohan.collaboration, "REVISION_REQUESTED", "Changes requested", "Rohan's draft needs audio cleanup."],
    [diya.user, nila, barterTravel.campaign, barterDiya.collaboration, "SHIPMENT_RECEIVED", "Products received", "Trail snack kit marked received."],
    [kabir.user, aurea, null, approvedKabir.collaboration, "CONTENT_APPROVED", "Content approved", "Your gadget unboxing was approved."],
  ];
  for (const [user, org, campaign, collab, type, title, body] of notes) {
    await M.Notification.create({
      recipientUserId: user._id,
      organizationContextId: org?._id,
      clientBrandOrganizationId: org?.type === "BRAND" ? org._id : undefined,
      campaignId: campaign?._id,
      collaborationId: collab?._id,
      eventId: `demo-${type}-${user._id}-${campaign?._id || collab?._id || "x"}`,
      type,
      title,
      body,
      link: {
        screen: collab ? "collaboration" : campaign ? "campaign" : "inbox",
        resourceId: String(collab?._id || campaign?._id || ""),
      },
    });
  }

  await M.PlatformSettings.findOneAndUpdate(
    {},
    {
      $set: {
        fundingInstructions: {
          note: "Demo UPI: insight@okaxis · Account: Insight Demo Escrow · IFSC: HDFC0001234. Use collaboration ID in the transfer note.",
        },
        supportContact: {
          email: "support@insight.local",
          phone: "+91 90000 00000",
        },
        commissionBps: COMMISSION_BPS,
      },
    },
    { sort: { version: -1 } },
  );

  // Touch unused draft refs so linters / tree-shaking don't matter; keep intentional variety.
  void draftCampaign;
  void reviewCampaign;
  void kabirContent;
  void meeraWallet;

  const summary = {
    password: DEMO_PASSWORD,
    accounts: [
      { role: "Owner", email: ownerEmail, password: ownerPassword },
      { role: "Brand (Aurea)", email: "brand@insight.local", password: DEMO_PASSWORD },
      { role: "Brand (Nila)", email: "brand2@insight.local", password: DEMO_PASSWORD },
      { role: "Agency admin", email: "agency@insight.local", password: DEMO_PASSWORD },
      { role: "Agency manager", email: "manager@insight.local", password: DEMO_PASSWORD },
      { role: "Client reviewer", email: "reviewer@insight.local", password: DEMO_PASSWORD },
      { role: "Creator Aarav", email: "creator@insight.local", password: DEMO_PASSWORD },
      { role: "Creator Meera", email: "creator2@insight.local", password: DEMO_PASSWORD },
      { role: "Creator Kabir", email: "creator3@insight.local", password: DEMO_PASSWORD },
      { role: "Creator Diya", email: "creator4@insight.local", password: DEMO_PASSWORD },
      { role: "Creator Rohan", email: "creator5@insight.local", password: DEMO_PASSWORD },
    ],
    counts: {
      creators: await M.CreatorProfile.countDocuments(),
      brands: await M.Organization.countDocuments({ type: "BRAND" }),
      agencies: await M.Organization.countDocuments({ type: "AGENCY" }),
      campaigns: await M.Campaign.countDocuments(),
      applications: await M.Application.countDocuments(),
      offers: await M.Offer.countDocuments(),
      collaborations: await M.Collaboration.countDocuments(),
      reviews: await M.Review.countDocuments(),
      messages: await M.Message.countDocuments(),
      notifications: await M.Notification.countDocuments(),
      fundings: await M.Funding.countDocuments(),
      withdrawals: await M.Withdrawal.countDocuments(),
    },
  };
  return summary;
}

const isMain = process.argv[1] && process.argv[1].endsWith("seed-demo-data.js");
if (isMain) {
  await mongoose.connect(process.env.MONGODB_URI);
  for (const Model of Object.values(M)) await Model.init();
  const summary = await seedDemoData();
  if (!summary.skipped) {
    console.log("Investor demo dataset loaded.");
    console.log(JSON.stringify(summary.counts, null, 2));
    console.log("\nLogin accounts (shared demo password unless noted):");
    for (const a of summary.accounts) console.log(`- ${a.role}: ${a.email} / ${a.password}`);
  }
  await mongoose.disconnect();
}
