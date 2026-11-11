import React, { useDeferredValue, useState } from "react";
import { ArrowLeft, ArrowUpRight, Search, ShieldCheck } from "lucide-react";
import { date, go, label, money, uid } from "../api/http";
import { useQuery } from "../app/context";
import { Avatar } from "../components/Media";
import { AudienceBreakdown, SocialMetric, primaryChannel } from "../components/SocialMetrics";
import { Badge, Collection, Page, State, Stats, area, useCommand } from "../components/ui";

const types = [["CREATOR", "Creators"], ["BRAND", "Brands"], ["AGENCY", "Agencies"]];
const verificationStates = [["PENDING", "Pending"], ["VERIFIED", "Verified"], ["REJECTED", "Rejected"]];

export function MemberReviewQueue() {
  const [type, setType] = useState("CREATOR");
  const [status, setStatus] = useState("PENDING");
  const [search, setSearch] = useState("");
  const searchValue = useDeferredValue(search.trim());
  const memberType = type === "CREATOR" ? type : "ORGANIZATION";
  return <Page title="Member verification" description="Review creator profiles and business accounts before awarding verification." actions={<a className="button" href="#/owner/members">Member directory <ArrowUpRight size={16}/></a>}>
    <div className="review-queue-controls panel">
      <div className="directory-tabs" role="group" aria-label="Account type">
        {types.map(([value, name]) => <button key={value} aria-pressed={type === value} className={type === value ? "active" : ""} onClick={() => setType(value)}>{name}</button>)}
      </div>
      <label className="listing-search"><Search size={17}/><input aria-label="Search verification queue" placeholder="Search members" value={search} onChange={e => setSearch(e.target.value)}/></label>
    </div>
    <div className="status-strip" role="group" aria-label="Verification status">
      {verificationStates.map(([value, name]) => <button key={value} aria-pressed={status === value} className={status === value ? "active" : ""} onClick={() => setStatus(value)}>{name}</button>)}
    </div>
    <Collection path={"/owner/members?" + new URLSearchParams({ type, status, search: searchValue })} empty={"No " + status.toLowerCase() + " accounts match"} render={rows => (
      <div className="member-review-grid">{rows.map(record => <article className="panel verification-card" key={uid(record)}>
        <div className="social-metric-heading"><Avatar name={record.name} assetId={record.avatarAssetId || record.logoAssetId} size={52}/><div><h3>{record.name || "Unnamed member"}</h3><p>{record.city || label(type)}</p></div><Badge>{record.verificationStatus}</Badge></div>
        <p>{record.bio || record.description || record.contactEmail || (record.niches?.join(", ") || "Profile information is available in the review.")}</p>
        <footer><small>Joined {date(record.createdAt)}</small><a className="button" href={"#/owner/member-reviews/" + uid(record) + "?memberType=" + memberType}>Open review <ArrowUpRight size={15}/></a></footer>
      </article>)}</div>
    )}/>
  </Page>;
}

export function MemberRecord({ id, type, review = false }) {
  const q = useQuery("/owner/members/" + id + "?memberType=" + type);
  const command = useCommand(q.reload);
  const creator = type === "CREATOR";
  const user = type === "USER";
  return <State query={q}>{record => {
    const suspended = !!record.suspendedAt || (record.accountStatus || record.status) === "SUSPENDED";
    const route = "/owner/members/" + id;
    const reviewLink = "#/owner/member-reviews/" + id + "?memberType=" + type;
    const channel = primaryChannel(record.socialAccounts);
    const displayName = record.name || (creator ? "Creator account" : "Member");
    const decision = (status, title) => command.open(title, route + "/verification", {
      fields: [area("reason", "Decision reason")],
      extra: { memberType: type, expectedVersion: record.version, status },
      submit: title,
      after: () => { if (status !== "PENDING") go("/owner/member-reviews"); },
    });
    const accessAction = suspended ? "Restore access" : "Suspend access";
    return <Page title={review ? "Review member" : "Member details"} actions={<a className="button" href={review ? "#/owner/member-reviews" : "#/owner/members"}><ArrowLeft size={16}/> {review ? "Verification queue" : "Member directory"}</a>}>
      <section className="panel member-identity-card">
        <Avatar name={displayName} assetId={record.avatarAssetId || record.logoAssetId} size={80}/>
        <div><h2>{displayName}</h2><p>{creator ? "Creator" : user ? "User account" : label(record.type)}{record.city && " · " + record.city}</p><div className="actions">{record.verificationStatus && <Badge>{record.verificationStatus}</Badge>}<Badge>{suspended ? "SUSPENDED" : "ACTIVE"}</Badge></div></div>
        {!user && <a className="button" href={creator ? "#/creators/" + id : "#/organizations/" + id}>View public profile <ArrowUpRight size={15}/></a>}
      </section>
      {!user && <Stats items={creator ? [
        ["Completed projects", record.completedCount ?? 0],
        ["Portfolio items", record.portfolioCount ?? 0],
        ["Rating", record.ratingCount ? record.ratingAverage.toFixed(1) + " / 5" : "No reviews"],
        ["Engagement", channel?.engagementBps == null ? "Not added" : (channel.engagementBps / 100).toFixed(2) + "%", channel?.handle],
      ] : [["Team members", record.teamCount], ["Campaigns", record.campaignCount], ["Completed projects", record.completedCount]]}/>}
      <div className="member-detail-layout">
        <section className="panel settings-panel">
          <h2>{creator ? "Creator details" : "Account details"}</h2>
          <dl className="member-facts">
            <div><dt>Email</dt><dd>{record.email || record.contactEmail || "Not provided"}</dd></div>
            {(creator || user) && <div><dt>Email verification</dt><dd>{record.emailVerifiedAt ? "Verified " + date(record.emailVerifiedAt) : "Pending"}</dd></div>}
            {!creator && !user && <div><dt>Contact phone</dt><dd>{record.contactPhone || "Not provided"}</dd></div>}
            <div><dt>Joined</dt><dd>{date(record.createdAt)}</dd></div>
            {creator && <><div><dt>Starting rate</dt><dd>{record.startingRateMinor == null ? "Not set" : money(record.startingRateMinor)}</dd></div><div><dt>Niches</dt><dd>{record.niches?.join(", ") || "Not added"}</dd></div><div><dt>Languages</dt><dd>{record.languages?.join(", ") || "Not added"}</dd></div></>}
            {record.website && <div><dt>Website</dt><dd><a href={record.website} target="_blank" rel="noreferrer">{record.website}</a></dd></div>}
          </dl>
          {(record.bio || record.description) && <><h3>About</h3><p>{record.bio || record.description}</p></>}
          {creator && <section id="verification-evidence" className="profile-section"><h2>Social reach & engagement</h2><div className="social-grid">{record.socialAccounts?.map(account => <SocialMetric account={account} key={uid(account)}/>)}</div>{!record.socialAccounts?.length && <p className="muted">No social accounts added.</p>}</section>}
        </section>
        <section className="panel settings-panel member-decision">
          <ShieldCheck size={24}/>
          <h2>{review ? "Verification decision" : "Account actions"}</h2>
          {review && !user ? <><ul className="verification-checklist">
            <li>Check the account name and contact details.</li>
            <li>{creator ? "Check the linked profiles and engagement source." : "Check the business identity and website."}</li>
            <li>Review prior decisions before changing verification.</li>
          </ul>
          <p className="muted">The decision reason is recorded in account activity.</p>
            <button className="primary" onClick={() => decision("VERIFIED", "Verify member")}>Verify member</button>
            <button onClick={() => decision("REJECTED", "Reject verification")}>Reject verification</button>
            {record.verificationStatus !== "PENDING" && <button onClick={() => decision("PENDING", "Return to pending")}>Return to pending</button>}
          </> : <>
            {!user && <a className="button primary" href={reviewLink}>Open verification review</a>}
            {record.platformRole !== "OWNER" && <button className={suspended ? "" : "danger"} onClick={() => command.open(accessAction, route + (suspended ? "/restoration" : "/suspension"), {
              fields: [area("reason", "Reason")], extra: { memberType: type, expectedVersion: record.version }, submit: accessAction,
            })}>{accessAction}</button>}
          </>}
        </section>
      </div>

      {creator && <AudienceBreakdown audience={record.audience}/>}
      <section className="profile-section"><h2>Account activity</h2>
        <Collection path={"/owner/audit-logs?resourceId=" + id} empty="No recorded account activity" columns={[
          { key: "action", label: "Action", render: row => label(row.action) },
          { key: "actorName", label: "By" },
          { key: "reason", label: "Reason", render: row => row.changes?.find(change => change.field === "reason")?.afterText || "—" },
          { key: "createdAt", label: "Date", render: row => date(row.createdAt) },
        ]}/>
      </section>
      {command.modal}
    </Page>;
  }}</State>;
}
