import { describeWorkPage } from "../../core/list-presentation.js";
import { route } from "../../core/http.js";
import { z, id, terms, version, command } from "../../core/validation.js";
import { get, list } from "../../core/db.js";
import { filter, party, eligibleReviewers } from "../../core/policy.js";
import * as M from "../../models.js";
import * as S from "./offers.service.js";
export function routes(r) {
  route(r, "get", "/offers", null, async (c, b, p, q) => {
    let f = filter(c);
    if (c.creator && !c.organizationId)
      f = { $and: [f, { state: { $nin: ["DRAFT", "CLIENT_REVIEW"] } }] };
    if (q.state) f = { $and: [f, { state: q.state }] };
    if (q.campaignId) f = { $and: [f, { campaignId: q.campaignId }] };
    return describeWorkPage(await list(M.Offer, f, c, q), c, {
      agreements: false,
    });
  });
  route(
    r,
    "post",
    "/offers",
    z
      .object({
        brandOrganizationId: id,
        creatorProfileId: id,
        campaignId: id.optional(),
        applicationId: id.optional(),
        ...terms,
      })
      .strict(),
    S.add,
  );
  route(r, "get", "/offers/:offerId", null, async (c, b, p) => {
    const d = await S.detail(c, p.offerId);
    const { data: [offer] } = await describeWorkPage({ data: [d] }, c);
    const agreement = d.state === "ACCEPTED" ? await M.Agreement.findOne({ offerId: d._id }).select("_id").session(c.session) : null;
    const collaboration = agreement ? await M.Collaboration.findOne({ agreementId: agreement._id }).select("_id").session(c.session) : null;
    return { ...offer, collaborationId: collaboration?._id, eligibleReviewers: await eligibleReviewers(c, d) };
  });
  route(
    r,
    "patch",
    "/offers/:offerId",
    z.object({ ...version, ...terms }).strict(),
    S.update,
  );
  route(r, "post", "/offers/:offerId/send", command, S.send);
  route(r, "post", "/offers/:offerId/withdraw", command, (c, b, p) =>
    S.decide(c, b, p, "withdraw"),
  );
  route(
    r,
    "post",
    "/offers/:offerId/accept",
    command,
    (c, b, p) => S.decide(c, b, p, "accept"),
    { idempotent: true },
  );
  route(r, "post", "/offers/:offerId/decline", command, (c, b, p) =>
    S.decide(c, b, p, "decline"),
  );
  route(r, "get", "/agreements/:agreementId", null, async (c, b, p) => {
    const d = await get(M.Agreement, p.agreementId, c);
    await party(c, d);
    return d;
  });
}
