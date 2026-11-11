import React from "react";
import { ArrowUpRight, BarChart3, Instagram, Youtube } from "lucide-react";
import { date } from "../api/http";

export function primaryChannel(accounts = []) {
  return accounts.reduce((largest, account) => !largest || account.followers > largest.followers ? account : largest, null);
}

export function SocialMetric({ account, children }) {
  const Icon = { INSTAGRAM: Instagram, YOUTUBE: Youtube }[account.platform] || BarChart3;
  const sample = account.engagementSample;
  return <article className="panel social-metric">
    <div className="social-metric-heading">
      <span className="record-symbol"><Icon size={21}/></span>
      <div><strong>{account.platform === "OTHER" ? "Social channel" : account.platform === "YOUTUBE" ? "YouTube" : "Instagram"}</strong><p>{account.handle}</p></div>
      {account.profileUrl && <a href={account.profileUrl} target="_blank" rel="noreferrer" aria-label={"Open " + account.handle}><ArrowUpRight size={18}/></a>}
    </div>
    <dl className="social-numbers">
      <div><dt>{account.platform === "YOUTUBE" ? "Subscribers" : "Followers"}</dt><dd>{Number(account.followers ?? 0).toLocaleString("en-IN")}</dd></div>
      <div><dt>Engagement rate</dt><dd>{account.engagementBps == null ? "—" : (account.engagementBps / 100).toFixed(2) + "%"}</dd></div>
    </dl>
    {sample && <p className="social-sample">{sample.posts} posts · {sample.likes.toLocaleString("en-IN")} likes · {sample.comments.toLocaleString("en-IN")} comments</p>}
    <small>{sample ? "Calculated from self-reported post totals" : account.source === "CONNECTED" ? "Connected source" : "Self-reported rate"}{account.measuredAt && " · Updated " + date(account.measuredAt)}</small>
    {children && <div className="actions">{children}</div>}
  </article>;
}

export function AudienceBreakdown({ audience }) {
  const groups = [["Top countries", audience?.countries], ["Age groups", audience?.ageGroups]].filter(([, rows]) => rows?.length);
  if (!groups.length) return null;
  return <section className="panel settings-panel">
    <h2>Audience breakdown</h2>
    <p className="muted">Self-reported demographics</p>
    <div className="audience-breakdown">{groups.map(([title, rows]) => <div key={title}>
      <h3>{title}</h3>
      {rows.map((row, index) => <div className="audience-row" key={index}><span>{row.label}</span><strong>{row.percentage}%</strong><progress value={row.percentage} max={100}/></div>)}
    </div>)}</div>
  </section>;
}
