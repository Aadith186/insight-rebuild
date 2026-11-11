import React, { useState } from "react";
import { Star, ArrowUpRight, CheckCircle, MessageSquare } from "lucide-react";
import { api, uid, date, go, label } from "../api/http";
import { useApp, useQuery } from "../app/context";
import {
  Page,
  Collection,
  State,
  Form,
  Dialog,
  area,
  field,
} from "../components/ui";
import { Avatar, Rating, CampaignImage } from "../components/Media";
export function ReviewComposer({ work, onClose, onDone }) {
  const { run } = useApp(),
    creator = work.reviewingParty === "CREATOR",
    target = creator ? work.brandName : work.creatorName;
  return (
    <Dialog title={"Review " + target} onClose={onClose}>
      <div className="review-composer-target">
        <Avatar
          assetId={creator ? work.brandLogoAssetId : work.creatorAvatarAssetId}
          name={target}
          size={54}
        />
        <div>
          <h3>{target}</h3>
          <p>{work.title} · completed collaboration</p>
        </div>
        <CheckCircle size={19} />
      </div>
      <Form
        fields={[
          {
            name: "stars",
            label: creator
              ? "How was working with this brand?"
              : "How was working with this creator?",
            type: "stars",
            required: true,
          },
          area("text", "Share your experience"),
          ...(creator && work.campaignId
            ? [
                {
                  name: "campaignStars",
                  label: "Campaign brief & experience (optional)",
                  type: "stars",
                  required: false,
                },
                area("campaignFeedback", "Campaign feedback (optional)", false),
              ]
            : []),
        ]}
        submit="Publish verified review"
        onSubmit={async (b) => {
          await run(
            () =>
              api("/collaborations/" + work.id + "/reviews", {
                method: "POST",
                body: b,
              }),
            "Your review is published",
          );
          onDone?.();
          onClose();
        }}
      />
      <p className="muted">
        Your rating and written review appear on {target}’s public profile.
        {creator && work.campaignId && " If you rate the campaign, that rating and feedback appear on its campaign page."}
        {" Your name and the completed collaboration are shown with the review."}
      </p>
    </Dialog>
  );
}
export function ReviewOpportunities({
  compact = false,
  targetId,
  campaignId,
  workId,
}) {
  const { role } = useApp(),
    q = useQuery(
      ["owner", "reviewer"].includes(role)
        ? null
        : "/me/review-opportunities?limit=100",
    ),
    [selected, setSelected] = useState(null);
  if (["owner", "reviewer"].includes(role)) return null;
  const rows = (q.data || []).filter(
    (w) =>
      (!targetId ||
        w.creatorProfileId === targetId ||
        w.brandOrganizationId === targetId) &&
      (!campaignId || w.campaignId === campaignId) &&
      (!workId || w.id === workId),
  );
  return (
    <section
      className={"panel review-opportunities " + (compact ? "compact" : "")}
    >
      <div className="section-heading">
        <div>
          <h2>{rows.length ? "Reviews to write" : "Your reviews"}</h2>
        </div>
        <span className="count-pill">{rows.length} to review</span>
      </div>
      {q.loading ? (
        <p className="muted">Checking completed work…</p>
      ) : q.error ? (
        <p role="alert">{q.error.message}</p>
      ) : rows.length ? (
        rows.slice(0, compact ? 3 : 100).map((w) => (
          <article className="review-opportunity" key={w.id}>
            <Avatar
              assetId={
                w.reviewingParty === "CREATOR"
                  ? w.brandLogoAssetId
                  : w.creatorAvatarAssetId
              }
              name={
                w.reviewingParty === "CREATOR" ? w.brandName : w.creatorName
              }
            />
            <div>
              <h3>
                {w.reviewingParty === "CREATOR" ? w.brandName : w.creatorName}
              </h3>
              <p>
                {w.title} · {date(w.completedAt)}
              </p>
            </div>
            <button className="primary" onClick={() => setSelected(w)}>
              <Star size={14} />
              Write review
            </button>
          </article>
        ))
      ) : (
        <div className="review-empty">
          <CheckCircle size={24} />
          <div>
            <h3>
              {targetId || campaignId
                ? "Reviews follow completed work"
                : "You’re all caught up"}
            </h3>
            <p>
              {targetId || campaignId
                ? "Once a collaboration is settled, you can review your partner here."
                : "Unreviewed settled collaborations will appear here."}
            </p>
          </div>
        </div>
      )}
      {selected && (
        <ReviewComposer
          work={selected}
          onClose={() => setSelected(null)}
          onDone={q.reload}
        />
      )}
    </section>
  );
}
export function ReviewSummary({ targetId, type = "CREATOR" }) {
  const q = useQuery("/review-summaries/" + targetId + "?type=" + type);
  return (
    <State query={q}>
      {(d) => (
        <div className="review-summary">
          <div className="review-score">
            <strong>{d.count ? d.average.toFixed(1) : "—"}</strong>
            <div className="review-stars">★★★★★</div>
            <span>
              {d.count} verified review{d.count === 1 ? "" : "s"}
            </span>
          </div>
          <div className="rating-distribution">
            {d.distribution.map((r) => (
              <div key={r.stars}>
                <span>
                  {r.stars} <Star size={11} />
                </span>
                <div className="progress-track">
                  <i
                    style={{
                      width: (d.count ? (r.count / d.count) * 100 : 0) + "%",
                    }}
                  />
                </div>
                <small>{r.count}</small>
              </div>
            ))}
          </div>
        </div>
      )}
    </State>
  );
}
export function Reviews() {
  return (
    <Page
      title="Reviews & reputation"
      description="Real feedback from completed collaborations, in both directions."
    >
      <ReviewOpportunities />
      <section className="review-explainer">
        <Star size={24} />
        <div>
          <h3>Your work builds your reputation</h3>
          <p>
            Brands and agencies review creator delivery. Creators review brands
            and can rate their campaign experience. Read received feedback on
            public profiles and campaign pages.
          </p>
          <a href="#/profile">
            View your profile <ArrowUpRight size={15} />
          </a>
        </div>
      </section>
    </Page>
  );
}
export function ReviewCards({ path, campaign = false }) {
  return (
    <Collection
      path={path}
      empty="No verified reviews yet"
      render={(rows) => (
        <div className="review-card-grid">
          {rows.map((r) => (
            <article className="review-card" key={uid(r)}>
              <div className="section-heading">
                <div className="review-author">
                  <Avatar
                    name={
                      r.reviewerName || r.reviewerUserId?.name || "Collaborator"
                    }
                    size={36}
                  />
                  <div>
                    <strong>
                      {r.reviewerName ||
                        r.reviewerUserId?.name ||
                        "Verified collaborator"}
                    </strong>
                    <small>{date(r.createdAt)}</small>
                  </div>
                </div>
                <CheckCircle size={16} />
              </div>
              <div className="review-stars">
                {"★".repeat(campaign ? r.campaignStars : r.stars)}
                <span>
                  {"★".repeat(5 - (campaign ? r.campaignStars : r.stars))}
                </span>
              </div>
              <p>{campaign ? r.campaignFeedback || r.text : r.text}</p>
              <span className="verified-label">
                Verified completed collaboration
              </span>
            </article>
          ))}
        </div>
      )}
    />
  );
}
