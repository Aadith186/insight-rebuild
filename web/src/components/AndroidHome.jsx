import { workAction } from "./listing";
import React from "react";
import {
  ArrowUpRight, BriefcaseBusiness, CalendarDays, ChevronRight, ClipboardCheck,
  Compass, Handshake, MessageCircle, Megaphone, Plus, Users, Wallet,
} from "lucide-react";
import { date, label, money, uid } from "../api/http";
import { editorialImage } from "../app/platform";
import { Badge, State } from "./ui";
import { CampaignTile, CreatorTile } from "./CatalogCards";
import { ReviewOpportunities } from "../features/Reviews";

function Shortcut({ to, icon: Icon, title }) {
  return <a className="android-shortcut" href={"#" + to}>
    <span><Icon size={20}/></span><strong>{title}</strong><ChevronRight size={15}/>
  </a>;
}

export function AndroidHome({ query, featured, role, name }) {
  const creator = role === "creator";
  const reviewer = role === "reviewer";
  const landing = reviewer ? "/approvals" : creator ? "/campaigns" : "/creators";
  const heroTitle = reviewer ? "Review client work" : creator ? "Find your next brief" : "Find the right creator";

  return <div className="android-home">
    <header className="android-home-heading">
      <span>{new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}</span>
      <h1>{creator ? "Hi, " + name.split(" ")[0] : name}</h1>
    </header>
    <State query={query}>{data => reviewer ? (
      <section className="panel android-action-panel">
        <div className="section-heading"><h2>Awaiting your decision</h2><span className="count-pill">{data.pendingApprovals.length}</span></div>
        {data.pendingApprovals.length ? data.pendingApprovals.map(approval => (
          <a className="android-action-row" key={uid(approval)} href={"#/approvals/" + uid(approval)}>
            <span className="android-row-icon"><ClipboardCheck size={18}/></span>
            <div><strong>{approval.campaignTitle || approval.brandName || label(approval.targetType)}</strong><small>{label(approval.targetType)} · Version {approval.targetVersion}</small></div>
            <ChevronRight size={16}/>
          </a>
        )) : <p className="muted">No approvals are waiting.</p>}
      </section>
    ) : (
      <>
        <section className="panel android-action-panel">
          <div className="section-heading"><h2>Needs attention</h2><a href="#/collaborations">View work <ChevronRight size={14}/></a></div>
          {data.actions?.length ? data.actions.slice(0, 5).map(work => (
            <a className="android-action-row" key={uid(work)} href={"#/collaborations/" + uid(work)}>
              <span className="android-row-icon"><CalendarDays size={18}/></span>
              <div><strong>{work.campaignTitle || work.brandName || "Collaboration"}</strong><small>{[work.brandName, workAction(work.workState), work.dueAt && "Due " + date(work.dueAt)].filter(Boolean).join(" · ")}</small></div>
              <ChevronRight size={16}/>
            </a>
          )) : <p className="muted">No actions are waiting.</p>}
        </section>
        {data.deadlines?.length > 0 && <section className="panel android-action-panel">
          <div className="section-heading"><h2>Upcoming deadlines</h2></div>
          {data.deadlines.slice(0, 4).map(work => (
            <a className="android-action-row" key={uid(work)} href={"#/collaborations/" + uid(work)}>
              <span className="android-row-icon"><CalendarDays size={18}/></span>
              <div><strong>{date(work.dueAt)}</strong><small>{work.campaignTitle || work.brandName || "Collaboration"}</small></div>
              <Badge>{work.workState}</Badge>
            </a>
          ))}
        </section>}
        <div className="android-summary">
          <a href="#/collaborations"><BriefcaseBusiness size={17}/><strong>{data.activeCount ?? 0}</strong><span>Active collaborations</span></a>
          <a href="#/finance"><Wallet size={17}/><strong>{money(data.totals?.heldMinor)}</strong><span>Funds held</span></a>
        </div>
        <ReviewOpportunities compact/>
      </>
    )}</State>
    {!reviewer && <a className="android-home-banner" href={"#" + landing}>
      <img src={editorialImage(creator ? "wide" : "studio")} alt=""/>
      <div>
        <span><Compass size={17}/></span>
        <h2>{heroTitle}</h2>
        <p>{reviewer ? "Briefs, offers and content approvals" : creator ? "Browse campaigns and apply" : "Explore portfolios and audience insights"}</p>
      </div>
      <ArrowUpRight size={21}/>
    </a>}
    <div className="android-shortcuts" aria-label="Quick actions">
      {reviewer ? <>
        <Shortcut to="/approvals" icon={ClipboardCheck} title="Approvals"/>
        <Shortcut to="/conversations" icon={MessageCircle} title="Messages"/>
      </> : <>
        <Shortcut to={creator ? "/applications" : "/campaigns/new"} icon={creator ? Megaphone : Plus} title={creator ? "My pitches" : "New campaign"}/>
        <Shortcut to="/offers" icon={Handshake} title="Offers"/>
        <Shortcut to={role === "agency" ? "/clients" : "/collaborations"} icon={role === "agency" ? Users : BriefcaseBusiness} title={role === "agency" ? "Clients" : "My work"}/>
        <Shortcut to="/finance" icon={Wallet} title={creator ? "Earnings" : "Payments"}/>
      </>}
    </div>
    {!reviewer && <section className="android-featured">
      <div className="section-heading"><h2>{creator ? "Open campaigns" : "Discover creators"}</h2><a href={"#" + landing}>See all <ChevronRight size={14}/></a></div>
      <State query={featured} empty={creator ? "No open campaigns" : "No creators to show"}>{rows => (
        <div className="android-card-rail">{rows.map(record => creator
          ? <CampaignTile campaign={record} key={uid(record)}/>
          : <CreatorTile creator={record} key={uid(record)}/>)}</div>
      )}</State>
    </section>}
  </div>;
}
