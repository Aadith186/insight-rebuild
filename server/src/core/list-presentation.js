import * as M from "../models.js";
// Public display fields only, after the caller's normal list scope has been applied.
export async function describeWorkPage(result, c, { agreements = false } = {}) {
  const rows = result.data;
  const ids = (key) => [
    ...new Set(
      rows
        .map((r) => r[key])
        .filter(Boolean)
        .map(String),
    ),
  ];
  const profiles = await M.CreatorProfile.find({
    _id: { $in: ids("creatorProfileId") },
  })
    .select("userId avatarAssetId")
    .lean()
    .session(c.session);
  const [users, brands, campaigns, terms] = await Promise.all([
    M.User.find({ _id: { $in: profiles.map((p) => p.userId) } })
      .select("name")
      .lean()
      .session(c.session),
    M.Organization.find({ _id: { $in: ids("brandOrganizationId") } })
      .select("name logoAssetId")
      .lean()
      .session(c.session),
    M.Campaign.find({ _id: { $in: ids("campaignId") } })
      .select("titleNormalized draft.title")
      .lean()
      .session(c.session),
    agreements
      ? M.Agreement.find({ _id: { $in: ids("agreementId") } })
          .select("amountMinor formatSnapshot.label")
          .lean()
          .session(c.session)
      : [],
  ]);
  const map = (arr) => new Map(arr.map((x) => [String(x._id), x]));
  const pm = map(profiles),
    um = map(users),
    bm = map(brands),
    cm = map(campaigns),
    tm = map(terms);
  return {
    ...result,
    data: rows.map((d) => {
      const p = pm.get(String(d.creatorProfileId)),
        b = bm.get(String(d.brandOrganizationId)),
        cam = cm.get(String(d.campaignId)),
        a = tm.get(String(d.agreementId));
      return {
        ...d.toJSON(),
        creatorName: um.get(String(p?.userId))?.name,
        creatorAvatarAssetId: p?.avatarAssetId,
        brandName: b?.name,
        brandLogoAssetId: b?.logoAssetId,
        campaignTitle: cam?.draft?.title || cam?.titleNormalized,
        ...(a
          ? { amountMinor: a.amountMinor, formatLabel: a.formatSnapshot?.label }
          : {}),
      };
    }),
  };
}

// Read the revision tied to the viewer's pitch or the campaign's published brief.
export async function describeCampaignReferences(result, c, { pitches = false } = {}) {
  if (!result.data.length) return result;
  const campaignIds = result.data.map(row => row.campaignId);
  const campaigns = await M.Campaign.find({ _id: { $in: campaignIds } })
    .select("state titleNormalized publishedRevisionId brandOrganizationId applicationDeadline publicBudgetPerCreatorMinor")
    .lean().session(c.session);
  const campaignById = new Map(campaigns.map(campaign => [String(campaign._id), campaign]));
  const revisionIds = pitches
    ? result.data.map(row => row.campaignRevisionId)
    : campaigns.filter(campaign => campaign.state === "PUBLISHED").map(campaign => campaign.publishedRevisionId);
  const closedIds = campaigns.filter(campaign => campaign.state === "CLOSED").map(campaign => campaign._id);
  const [revisions, brands, closedApplications] = await Promise.all([
    M.CampaignRevision.find({ _id: { $in: revisionIds.filter(Boolean) } })
      .select("campaignId title niche coverAssetId").lean().session(c.session),
    M.Organization.find({ _id: { $in: campaigns.map(campaign => campaign.brandOrganizationId) } })
      .select("name").lean().session(c.session),
    !pitches && closedIds.length
      ? M.Application.find({ campaignId: { $in: closedIds }, creatorProfileId: c.creator?._id })
          .distinct("campaignId").session(c.session)
      : [],
  ]);
  const appliedToClosed = new Set(closedApplications.map(String));
  const revisionById = new Map(revisions.map(revision => [String(revision._id), revision]));
  const brandById = new Map(brands.map(brand => [String(brand._id), brand.name]));
  return {
    ...result,
    data: result.data.map(row => {
      const campaign = campaignById.get(String(row.campaignId));
      const revision = revisionById.get(String(pitches ? row.campaignRevisionId : campaign?.publishedRevisionId));
      return {
        ...row.toJSON(),
        campaign: campaign ? {
          state: campaign.state,
          canOpen: campaign.state === "PUBLISHED" || (campaign.state === "CLOSED" && (pitches || appliedToClosed.has(String(campaign._id)))),
          titleNormalized: campaign.titleNormalized,
          title: String(revision?.campaignId) === String(campaign._id) ? revision.title : undefined,
          niche: revision?.niche,
          coverAssetId: campaign.state === "PUBLISHED" ? revision?.coverAssetId : undefined,
          brandName: brandById.get(String(campaign.brandOrganizationId)),
          applicationDeadline: campaign.applicationDeadline,
          publicBudgetPerCreatorMinor: campaign.publicBudgetPerCreatorMinor,
        } : null,
      };
    }),
  };
}
