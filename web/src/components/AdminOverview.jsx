import React from "react";
import {
  Users,
  ShieldCheck,
  Megaphone,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  AlertCircle,
  Building2,
} from "lucide-react";
import { KpiCards } from "./Charts";
import { date, money } from "../api/http";
const queues = [
  [
    "pendingVerification",
    "Account verification",
    "Review identity and business details",
    "member-reviews",
    ShieldCheck,
  ],
  [
    "pendingCampaigns",
    "Campaign approvals",
    "Check briefs ready for publication",
    "campaign-reviews",
    Megaphone,
  ],
  [
    "pendingFunding",
    "Funding checks",
    "Reconcile incoming transfers",
    "fundings",
    Wallet,
  ],
  [
    "pendingWithdrawals",
    "Creator withdrawals",
    "Verify payout requests",
    "withdrawals",
    ArrowUpRight,
  ],
  [
    "openDisputes",
    "Open disputes",
    "Resolve work that needs attention",
    "disputes",
    AlertCircle,
  ],
  [
    "pendingRefunds",
    "Refund transfers",
    "Close verified refund obligations",
    "refunds",
    ArrowDownLeft,
  ],
];
export function AdminOverview({ data: d }) {
  const pending = Object.values(d.queues).reduce((a, b) => a + b, 0);
  return (
    <>
      <section className="panel operations-queue">
        <div className="section-heading">
          <div><h2>Review queues</h2><p className="muted">{pending} items awaiting action</p></div>
          <a href="#/owner/audit-logs">Activity history <ArrowUpRight size={15}/></a>
        </div>
        {[...queues].sort(([a], [b]) => {
          const first = d.oldestQueueItems?.[a], second = d.oldestQueueItems?.[b];
          return (first ? +new Date(first) : Infinity) - (second ? +new Date(second) : Infinity) || d.queues[b] - d.queues[a];
        }).map(([key, title, note, path, Icon]) => {
          const since = d.oldestQueueItems?.[key];
          const age = since ? Math.max(0, Math.floor((Date.now() - new Date(since)) / 86400000)) : null;
          return <a className="operations-queue-row" key={key} href={"#/owner/" + path}>
            <span className="queue-icon"><Icon size={19}/></span>
            <span><strong>{title}</strong><small>{note}</small></span>
            <span className="queue-age">{since ? "Oldest " + date(since) + " · " + (age ? age + "d waiting" : "Today") : d.queues[key] ? "Awaiting review" : "All clear"}</span>
            <strong className="count-pill">{d.queues[key]}</strong><ArrowUpRight size={16}/>
          </a>;
        })}
      </section>
      <KpiCards
        items={[
          {
            label: "Registered members",
            value: d.users,
            note: d.creators + " creator profiles",
            icon: Users,
          },
          {
            label: "Brand workspaces",
            value: d.brands,
            note: d.agencies + " agency workspaces",
            icon: Building2,
          },
          {
            label: "Published campaigns",
            value: d.activeCampaigns,
            note: "Open across the marketplace",
            icon: Megaphone,
          },
          {
            label: "Platform revenue",
            value: money(d.finance.platformRevenueMinor),
            note: "Posted revenue ledger balance",
            icon: Wallet,
          },
        ]}
      />

    </>
  );
}
