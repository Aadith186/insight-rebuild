const creator = new URLSearchParams(location.search).get("role") === "creator";
const user = { id: "demo-user", name: creator ? "Ananya Menon" : "Platform Operator", email: "account@example.test", emailVerifiedAt: "2026-09-21T00:00:00Z", version: 1, platformRole: creator ? "USER" : "OWNER" };
const member = {
  id: "demo-member", name: "Ananya Menon", email: "creator@example.test", city: "Kochi",
  verificationStatus: "PENDING", accountStatus: "ACTIVE", createdAt: "2026-09-21T00:00:00Z",
  bio: "I produce Malayalam and English food, travel and lifestyle videos for audiences in Kerala.",
  niches: ["Food", "Travel"], languages: ["Malayalam", "English"], startingRateMinor: 1250000,
  completedCount: 8, portfolioCount: 5, ratingAverage: 4.8, ratingCount: 6,
  socialAccounts: [{ id: "social", platform: "INSTAGRAM", handle: "@ananya", followers: 28700, engagementBps: 425, source: "SELF_REPORTED", measuredAt: "2026-11-09T00:00:00Z", engagementSample: { posts: 10, likes: 11400, comments: 798 } }],
  audience: { countries: [{ label: "India", percentage: 91 }], ageGroups: [{ label: "18–24", percentage: 34 }, { label: "25–34", percentage: 46 }] },
  version: 2,
};
const campaign = { id: "demo-campaign", brandName: "Sora Foods", state: "PLATFORM_REVIEW", pitchCount: 12, collaborationCount: 4, completedCount: 2,
  draft: { title: "Weekend Kitchen", niche: "Food", applicationDeadline: "2026-11-25T00:00:00Z", budgetPerCreatorMinor: 2000000 } };
const nativeFetch = window.fetch.bind(window);
window.fetch = (input, options) => {
  const url = new URL(typeof input === "string" ? input : input.url, location.origin);
  if (!url.pathname.startsWith("/api/v1")) return nativeFetch(input, options);
  const path = url.pathname.slice(7);
  let data = [];
  if (path === "/auth/me") data = { user, creator: creator ? member : null, memberships: [], organizations: [] };
  else if (path === "/owner/members") data = [member];
  else if (path === "/owner/members/demo-member" || path === "/creators/demo-member" || path === "/me/creator-profile") data = member;
  else if (path === "/owner/campaign-reviews" || path === "/campaigns") data = [campaign];
  else if (path === "/owner/settings") data = { version: 3, commissionBps: 950, effectiveAt: "2026-11-10T00:00:00Z", fundingInstructions: { bankName: "Example Bank" }, supportContact: { email: "support@example.test" } };
  return Promise.resolve(new Response(JSON.stringify({ data }), { headers: { "Content-Type": "application/json" } }));
};
await import("../../web/src/main.jsx");
