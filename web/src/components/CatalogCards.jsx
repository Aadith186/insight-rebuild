import { primaryChannel } from "./SocialMetrics";
import React from "react";
import {
  Bookmark,
  CalendarDays,
  Clapperboard,
  ArrowUpRight,
  MapPin,
  BadgeCheck,
  ChartNoAxesCombined,
  CheckCircle2,
  Columns2,
  Instagram,
  Users,
  Star,
} from "lucide-react";
import { api, uid, money, date, go, label } from "../api/http";
import { useApp } from "../app/context";
import { Avatar, CampaignImage, Rating, assetURL } from "./Media";
import { Badge } from "./ui";
export function CampaignTile({ campaign: c, compact = false }) {
  const { role, run } = useApp();
  const [saved, setSaved] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const brief = c.draft || c.revision || c;
  const title = brief.title || c.title || c.titleNormalized;
  const link = "#/campaigns/" + uid(c);
  const niche = brief.niche || c.niche;
  const rate = brief.budgetPerCreatorMinor ?? c.budgetPerCreatorMinor ?? c.publicBudgetPerCreatorMinor;
  const deadline = brief.applicationDeadline || c.applicationDeadline;
  const spots = c.availableSpots ?? brief.spots ?? c.spots;
  return (
    <article className={"campaign-tile " + (compact ? "compact" : "")}>
      <a href={link} className="campaign-tile-image" aria-label={"View " + title}>
        <CampaignImage assetId={brief.coverAssetId || c.coverAssetId} niche={niche} title={title}/>
      </a>
      {role === "creator" && <button className="tile-save" aria-label={saved ? "Campaign saved" : "Save campaign"} aria-pressed={saved} disabled={saved || saving} onClick={async () => {
        setSaving(true);
        try {
          await run(() => api("/me/saved-campaigns", { method: "POST", body: { campaignId: uid(c) } }), "Campaign saved");
          setSaved(true);
        } catch {
          // The workspace notification shows the error.
        } finally {
          setSaving(false);
        }
      }}><Bookmark size={17} fill={saved ? "currentColor" : "none"}/></button>}
      <div className="campaign-tile-body">
        <div className="campaign-tile-meta">
          <span>{[c.brandName, niche && label(niche)].filter(Boolean).join(" · ")}</span>
          {c.state && c.state !== "PUBLISHED" && <Badge>{c.state}</Badge>}
        </div>
        <h3><a href={link}>{title}</a></h3>
        {brief.deliverables?.length > 0 && <p className="campaign-card-deliverables"><Clapperboard size={15}/>
          <span>{brief.deliverables.map(item => item.quantity + " × " + label(item.kind)).join(" · ")}
            {brief.usageRights?.durationDays > 0 && " · " + brief.usageRights.durationDays + "-day usage"}
            {brief.usageRights?.paidAdvertisingAllowed && " · Paid ads"}</span>
        </p>}
        {brief.brief && <p className="tile-description">{brief.brief}</p>}
        {role !== "creator" && c.pitchCount !== undefined && <p className="campaign-card-activity">{c.pitchCount} pitches · {c.collaborationCount} collaborations · {c.completedCount} completed</p>}
        <div className="campaign-card-dates">
          {deadline && <span><CalendarDays size={15}/> Apply by {date(deadline)}</span>}
          {spots != null && <span><Users size={15}/> {spots} {spots === 1 ? "spot" : "spots"}</span>}
        </div>
        <footer>
          <div>{rate != null && <><small>Per creator</small><strong>{rate ? money(rate) : "₹0"}</strong></>}</div>
          <a href={link} className="campaign-card-link">View brief <ArrowUpRight size={16}/></a>
        </footer>
      </div>
    </article>
  );
}
export function CreatorTile({ creator: p, onCompare, selected, compareFull, metricChannel }) {
  const { org, clientId, run } = useApp();
  const channel = metricChannel || primaryChannel(p.socialAccounts);
  const followers = channel?.followers;
  const engagement = channel?.engagementBps == null ? null : channel.engagementBps / 100;
  const platform = channel?.platform === "YOUTUBE" ? "YouTube" : channel?.platform === "INSTAGRAM" ? "Instagram" : channel?.handle;
  const [saved, setSaved] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  React.useEffect(() => { setSaved(false); }, [clientId, org?.id]);
  return (
    <article className="influencer-tile">
      <a className="influencer-photo" href={"#/creators/" + uid(p)}>
        {p.avatarAssetId ? (
          <img loading="lazy" src={assetURL(p.avatarAssetId)} alt={p.name} />
        ) : (
          <div className="portrait-placeholder">
            <Avatar name={p.name} size={110} />
            <span>Profile photo not added</span>
          </div>
        )}
        {p.verificationStatus === "VERIFIED" && <span className="creator-availability"><BadgeCheck size={14}/> Verified</span>}
        <div className="influencer-overlay">
          <h3>{p.name}</h3>
          <p>
            <MapPin size={12} />
            {p.city || "Location not added"}
          </p>
        </div>
      </a>
      <button className="tile-save" aria-label={(saved ? "Saved " : "Save ") + p.name} aria-pressed={saved}
        disabled={saved || saving} onClick={async () => {
          setSaving(true);
          try {
            await run(() => api("/shortlist-entries", { method: "POST", body: {
              creatorProfileId: uid(p), clientBrandId: clientId || uid(org),
            } }), "Creator saved");
            setSaved(true);
          } catch {
            // The workspace shows the request error.
          } finally {
            setSaving(false);
          }
        }}><Bookmark size={17} fill={saved ? "currentColor" : "none"}/></button>
      <div className="influencer-body">
        <div className="section-heading">
          <div className="creator-niches">{p.niches?.slice(0, 2).map(niche => <span key={niche}>{niche}</span>)}</div>
          <Rating average={p.ratingAverage} count={p.ratingCount} />
        </div>
        <dl className="creator-card-metrics">
          <div><dt><Users size={15}/>{channel?.platform === "YOUTUBE" ? "Subscribers" : "Followers"}</dt>
            <dd>{followers == null ? "—" : Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(followers)}</dd></div>
          <div><dt><ChartNoAxesCombined size={15}/> Engagement</dt><dd>{engagement == null ? "—" : engagement.toFixed(2) + "%"}</dd></div>
          <div><dt><CheckCircle2 size={15}/> Completed</dt><dd>{p.completedCount ?? 0}</dd></div>
        </dl>
        <small className="metrics-source">
          {channel ? [platform, channel.source === "CONNECTED" ? "Connected source" : "Self-reported", channel.engagementSample && channel.engagementSample.posts + " posts"].filter(Boolean).join(" · ") : "No social channels added"}
        </small>
        <footer>
          <div>
            <small>Starting rate</small>
            <strong>{p.startingRateMinor == null ? "—" : money(p.startingRateMinor)}</strong>
          </div>
          <a className="primary button" href={"#/creators/" + uid(p)}>
            View profile <ArrowUpRight size={14} />
          </a>
        </footer>
        {onCompare && (
          <button
            className={"compare-toggle " + (selected ? "selected" : "")}
            aria-pressed={selected} disabled={compareFull && !selected} onClick={() => onCompare(p)}
          >
            <Columns2 size={15}/> {selected ? "Added to comparison" : "Compare creator"}
          </button>
        )}
      </div>
    </article>
  );
}
