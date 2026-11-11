import { RecordCard } from "../components/RecordCard";
import { SelectMenu } from "../components/SelectMenu";
import { ArrowLeft, ArrowUpRight, CalendarDays, Clapperboard, Clock3, LayoutGrid, List, Plus, Search, ShieldCheck, Users, Wallet } from "lucide-react";
import React, { useDeferredValue, useState } from "react";
import { api, uid, money, date, go, label, download } from "../api/http";
import { useApp, useQuery } from "../app/context";
import {
  Page,
  Collection,
  State,
  Form,
  Stats,
  Tabs,
  Badge,
  useCommand,
  text,
  area,
  amount,
  field,
  select,
} from "../components/ui";
import { CampaignTile } from "../components/CatalogCards";
import { CampaignImage } from "../components/Media";
import { ReviewOpportunities, ReviewSummary, ReviewCards } from "./Reviews";
import { MoneyChart, Distribution } from "../components/Charts";
import { brief, approvalFields } from "./forms";
export function Campaigns({ moderation = false }) {
  const { role } = useApp();
  const discovery = role === "creator" && !moderation;
  const [search, setSearch] = useState(new URLSearchParams(location.hash.split("?")[1]).get("search") || "");
  const [state, setState] = useState(moderation ? "PLATFORM_REVIEW" : "");
  const [minPay, setMinPay] = useState("");
  const [applyBy, setApplyBy] = useState("");
  const [formatId, setFormatId] = useState("");
  const config = useQuery(discovery ? "/config" : null);
  const [view, setView] = useState(discovery ? "cards" : "list");
  const query = useDeferredValue(search.trim());
  const statuses = moderation
    ? [["PLATFORM_REVIEW", "Awaiting review"], ["CHANGES_REQUESTED", "Changes requested"], ["PUBLISHED", "Published"]]
    : [["", "All campaigns"], ["DRAFT", "Drafts"], ["CLIENT_REVIEW", "Client review"], ["PLATFORM_REVIEW", "Platform review"], ["CHANGES_REQUESTED", "Changes requested"], ["PUBLISHED", "Published"], ["CLOSED", "Closed"]];
  const params = new URLSearchParams({ search: query, [moderation ? "state" : "status"]: state });
  if (discovery) {
    if (Number(minPay) > 0) params.set("minPay", Math.round(Number(minPay) * 100));
    if (applyBy) params.set("applyBy", applyBy);
    if (formatId) params.set("formatId", formatId);
  }
  const path = (moderation ? "/owner/campaign-reviews" : "/campaigns") + "?" + params;
  return <Page title={moderation ? "Campaign moderation" : discovery ? "Discover campaigns" : "Campaigns"}
    description={moderation ? "Review submitted briefs and track publication decisions." : discovery ? "Explore briefs, rates and application deadlines." : "Track briefs, applications and delivery in one place."}
    actions={!moderation && ["brand", "agency"].includes(role) && <a className="button primary" href="#/campaigns/new"><Plus size={17}/> Create campaign</a>}>
    <div className="panel campaign-browser-toolbar">
      <label className="listing-search"><Search size={18}/><input aria-label="Search campaigns" placeholder="Search campaign, brand or niche" value={search} onChange={e => setSearch(e.target.value)}/></label>
      <div className="campaign-view-toggle" role="group" aria-label="Campaign layout">
        <button aria-pressed={view === "list"} onClick={() => setView("list")}><List size={16}/> List</button>
        <button aria-pressed={view === "cards"} onClick={() => setView("cards")}><LayoutGrid size={16}/> Cards</button>
      </div>
    </div>
    {discovery && <div className="panel discovery-filters">
      <label>Minimum pay (₹)<input type="number" min="0" step="100" value={minPay} onChange={event => setMinPay(event.target.value)}/></label>
      <label>Applications close by<input type="date" value={applyBy} onChange={event => setApplyBy(event.target.value)}/></label>
      <div className="campaign-filter-field"><span>Collaboration type</span>
        <SelectMenu label="Collaboration type" value={formatId} onChange={setFormatId}
          options={[{ value: "", label: "All types" }, ...(config.data?.formats || []).map(format => ({ value: uid(format), label: format.label }))]}/>
      </div>
      {(minPay || applyBy || formatId) && <button onClick={() => { setMinPay(""); setApplyBy(""); setFormatId(""); }}>Clear filters</button>}
    </div>}
    {!discovery && <div className="status-strip" role="group" aria-label="Campaign status">
      {statuses.map(([value, name]) => <button key={value} aria-pressed={state === value} className={state === value ? "active" : ""} onClick={() => setState(value)}>{name}</button>)}
    </div>}
    <Collection path={path} empty={search ? "No matching campaigns" : "No campaigns in this view"} render={rows => view === "cards"
      ? <div className="card-grid campaign-browser-grid">{rows.map(c => <CampaignTile key={uid(c)} campaign={c}/>)}</div>
      : <div className="campaign-work-list">{rows.map(c => {
        const brief = c.draft || c;
        const href = "#/campaigns/" + uid(c);
        return <article key={uid(c)} className="campaign-work-row">
          <a href={href} className="campaign-row-image" aria-label={"Open " + brief.title}><CampaignImage assetId={brief.coverAssetId} niche={brief.niche}/></a>
          <div className="campaign-row-main"><p>{c.brandName || "Campaign"}{brief.niche && " · " + brief.niche}</p><h3><a href={href}>{brief.title || c.titleNormalized}</a></h3><div className="actions"><Badge>{c.state}</Badge><small><CalendarDays size={14}/> Apply by {date(brief.applicationDeadline)}</small></div></div>
          <dl className="campaign-row-metrics">
            {c.pitchCount !== undefined ? <>
              <div><dt>Pitches</dt><dd>{c.pitchCount}</dd></div>
              <div><dt>Collaborations</dt><dd>{c.collaborationCount}</dd></div>
              <div><dt>Completed</dt><dd>{c.completedCount}</dd></div>
            </> : <div><dt>Open slots</dt><dd>{c.availableSpots ?? "—"}</dd></div>}
            <div><dt>Per creator</dt><dd>{money(brief.budgetPerCreatorMinor)}</dd></div>
          </dl>
          <a href={href} className="button campaign-row-open">{moderation ? "Review brief" : discovery ? "View brief" : "Open campaign"} <ArrowUpRight size={15}/></a>
        </article>;
      })}</div>}/>
  </Page>;
}
export function CampaignEditor({ id }) {
  const { org, clientId, run } = useApp(),
    config = useQuery("/config"),
    q = useQuery(id ? "/campaigns/" + id : null);
  const initial = q.data
    ? {
        ...q.data.draft,
        compensationBudgetMinor: q.data.compensationBudgetMinor,
        serviceChargeMinor: q.data.serviceChargeMinor,
      }
    : {};
  return (
    <Page
      title={id ? "Edit campaign" : "Create a campaign"}
      description="Set the brief, deliverables, rights and review allowance."
    >
      <State query={config}>
        {(c) =>
          id && q.loading ? (
            <p>Loading…</p>
          ) : (
            <section className="panel">
              <Form
                key={q.data?.version || "new"}
                fields={[
                  ...brief(c.formats),
                  amount(
                    "compensationBudgetMinor",
                    "Total creator compensation budget (₹)",
                  ),
                  {
                    ...amount(
                      "serviceChargeMinor",
                      "Separate agency service charge (₹)",
                      false,
                    ),
                    default: 0,
                  },
                ]}
                initial={initial}
                sections={{ coverAssetId: "Campaign brief", budgetPerCreatorMinor: "Rate and dates", deliverables: "Deliverables and rights", compensationBudgetMinor: "Campaign budget" }}
                submit={id ? "Save campaign changes" : "Save campaign draft"}
                onSubmit={async (b) => {
                  const r = await run(() =>
                    api(id ? "/campaigns/" + id : "/campaigns", {
                      method: id ? "PATCH" : "POST",
                      body: {
                        ...b,
                        ...(id
                          ? { expectedVersion: q.data.version }
                          : { brandOrganizationId: clientId || uid(org) }),
                      },
                    }),
                  );
                  go("/campaigns/" + uid(r.data));
                }}
              />
            </section>
          )
        }
      </State>
    </Page>
  );
}
export function CampaignDetail({ id }) {
  const q = useQuery("/campaigns/" + id),
    { role, member, org, run } = useApp(),
    [tab, setTab] = useState("brief"),
    cmd = useCommand(q.reload),
    creator = role === "creator",
    owner = role === "owner",
    operator = ["brand", "agency"].includes(role),
    team = useQuery(
      member?.role === "ORG_ADMIN" && org
        ? "/organizations/" + uid(org) + "/members?limit=100"
        : null,
    );
  function conversation() {
    run(
      () =>
        api("/conversations", {
          method: "POST",
          body: { contextType: "CAMPAIGN", contextId: id },
        }),
      "Conversation opened",
    )
      .then((r) => go("/conversations/" + uid(r.data)))
      .catch(() => {});
  }
  return (
    <State query={q}>
      {(c) => {
        const r = c.revision || c.draft;
        const actions = (
              <>
                <Badge>{c.state}</Badge>
                {creator ? (
                  <>
                    <button
                      onClick={() =>
                        run(
                          () =>
                            api("/me/saved-campaigns", {
                              method: "POST",
                              body: { campaignId: id },
                            }),
                          "Campaign saved",
                        ).catch(() => {})
                      }
                    >
                      Save
                    </button>
                    <button onClick={conversation}>Ask a question</button>
                    {c.state === "PUBLISHED" && (
                      <button
                        className="primary"
                        onClick={() =>
                          cmd.open(
                            "Send your pitch",
                            "/campaigns/" + id + "/applications",
                            {
                              fields: [
                                area("pitch", "Your creative idea"),
                                amount(
                                  "proposedRateMinor",
                                  "Proposed rate (₹)",
                                ),
                              ],
                            },
                          )
                        }
                      >
                        Send pitch
                      </button>
                    )}
                  </>
                ) : operator ? (
                  <>
                    {["DRAFT", "CLIENT_REVIEW", "CHANGES_REQUESTED"].includes(
                      c.state,
                    ) && (
                      <>
                        <button
                          onClick={() => go("/campaigns/" + id + "/edit")}
                        >
                          Edit brief
                        </button>
                        {c.agencyOrganizationId && (
                          <button
                            onClick={() =>
                              cmd.open(
                                "Share brief with client",
                                "/client-approvals",
                                {
                                  fields: approvalFields(c.eligibleReviewers),
                                  extra: {
                                    targetType: "CAMPAIGN_REVISION",
                                    targetId: id,
                                  },
                                  initial: { policy: "ANY_ASSIGNED" },
                                },
                              )
                            }
                          >
                            Request client approval
                          </button>
                        )}
                        <button
                          className="primary"
                          onClick={() =>
                            cmd.open(
                              "Submit for platform review",
                              "/campaigns/" + id + "/submit",
                              { extra: { expectedVersion: c.version } },
                            )
                          }
                        >
                          Submit for review
                        </button>
                      </>
                    )}
                    {c.state !== "CLOSED" && (
                      <button
                        onClick={() =>
                          cmd.open(
                            "Close campaign",
                            "/campaigns/" + id + "/close",
                            {
                              fields: [area("reason", "Reason")],
                              extra: { expectedVersion: c.version },
                            },
                          )
                        }
                      >
                        Close campaign
                      </button>
                    )}
                  </>
                ) : owner && c.state === "PLATFORM_REVIEW" ? (
                  <button
                    className="primary"
                    onClick={() =>
                      cmd.open(
                        "Moderate campaign",
                        "/owner/campaign-reviews/" +
                          c.reviewRevisionId +
                          "/decisions",
                        {
                          fields: [
                            select("decision", "Decision", [
                              "APPROVE",
                              "REQUEST_CHANGES",
                              "REJECT",
                            ]),
                            area("reason", "Decision reason"),
                          ],
                          extra: { expectedVersion: c.version },
                        },
                      )
                    }
                  >
                    Review campaign
                  </button>
                ) : null}
              </>
        );
        const timeline = [
          { icon: CalendarDays, label: "Applications close", value: r?.applicationDeadline },
          { icon: Clock3, label: "Content due", value: r?.deadline },
        ];
        return (
          <div className="campaign-detail">
            <a href={owner ? "#/owner/campaign-reviews" : "#/campaigns"} className="campaign-back"><ArrowLeft size={17}/> {owner ? "Campaign review" : "All campaigns"}</a>
            <header className="campaign-masthead">
              <div className="campaign-masthead-copy">
                <div className="campaign-masthead-meta">
                  {c.brandName && <span>{c.brandName}</span>}
                  {r?.niche && <span>{label(r.niche)}</span>}
                </div>
                <h1>{r?.title || c.titleNormalized}</h1>
                <div className="actions">{actions}</div>
              </div>
              <CampaignImage assetId={r?.coverAssetId || c.draft?.coverAssetId} niche={r?.niche} title={r?.title}/>
            </header>
            <Tabs
              items={[
                "brief",
                "reviews",
                ...(!creator ? ["pitches", "revisions", "report"] : []),
              ]}
              value={tab}
              onChange={setTab}
            />
            {tab === "reviews" ? (
              <>
                <section className="panel">
                  <h2>Creator campaign feedback</h2>
                  <ReviewSummary targetId={id} type="CAMPAIGN" />
                </section>
                <ReviewOpportunities campaignId={id} />
                <ReviewCards path={"/campaigns/" + id + "/reviews"} campaign />
              </>
            ) : tab === "brief" ? (
              <div className="campaign-brief-layout">
                <div className="campaign-brief-main">
                  <section className="campaign-brief-panel">
                    <h2>Creative direction</h2>
                    <p className="preserve">{r?.brief || "A creative brief has not been added yet."}</p>
                  </section>
                  <section className="campaign-brief-panel">
                    <h2>Deliverables</h2>
                    {r?.deliverables?.length ? <ul className="campaign-deliverables">
                      {r.deliverables.map((item, index) => <li key={index}>
                        <span className="brief-icon"><Clapperboard size={20}/></span>
                        <div><strong>{label(item.kind)}</strong>{item.description && <p>{item.description}</p>}</div>
                        <span className="deliverable-quantity">×{item.quantity}</span>
                      </li>)}
                    </ul> : <p className="muted">Deliverables haven’t been specified.</p>}
                  </section>
                  <section className="campaign-brief-panel">
                    <h2><ShieldCheck size={20}/> Usage rights</h2>
                    {r?.usageRights ? <>
                      <ul className="brief-rights">
                        {(r.usageRights.channels || []).map(channel => <li key={channel}>{label(channel)}</li>)}
                      </ul>
                      <dl className="brief-facts">
                        {r.usageRights.durationDays != null && <div><dt>Usage period</dt><dd>{r.usageRights.durationDays} days</dd></div>}
                        {r.usageRights.paidAdvertisingAllowed != null && <div><dt>Paid advertising</dt><dd>{r.usageRights.paidAdvertisingAllowed ? "Allowed" : "Not allowed"}</dd></div>}
                      </dl>
                    </> : <p className="muted">Usage rights haven’t been specified.</p>}
                  </section>
                </div>
                <aside className="campaign-brief-panel campaign-summary">
                  <h2>Campaign details</h2>
                  <dl>
                    {r?.budgetPerCreatorMinor != null && <div className="campaign-summary-rate">
                      <span className="brief-icon"><Wallet size={19}/></span>
                      <div><dt>Budget per creator</dt><dd>{money(r.budgetPerCreatorMinor)}</dd></div>
                    </div>}
                    {timeline.filter(item => item.value).map(({ icon: Icon, label, value }) => <div key={label}>
                      <Icon size={18}/><div><dt>{label}</dt><dd>{date(value)}</dd></div>
                    </div>)}
                    {c.availableSpots != null && <div><Users size={18}/><div><dt>Creator spots available</dt><dd>{c.availableSpots}</dd></div></div>}
                    {r?.includedRevisions != null && <div><Clapperboard size={18}/><div><dt>Included revisions</dt><dd>{r.includedRevisions}</dd></div></div>}
                  </dl>
                  {c.brandOrganizationId && <a className="campaign-brand-link" href={"#/organizations/" + c.brandOrganizationId}>View brand profile <ArrowUpRight size={16}/></a>}
                {member?.role === "ORG_ADMIN" && c.agencyOrganizationId && (
                  <div className="actions">
                    <button
                      onClick={() =>
                        cmd.open(
                          "Assign campaign responsibility",
                          "/campaigns/" + id + "/assignment",
                          {
                            method: "PUT",
                            fields: [
                              select(
                                "membershipId",
                                "Responsible teammate",
                                (team.data || [])
                                  .filter(
                                    (m) =>
                                      m.role !== "CLIENT_REVIEWER" &&
                                      m.status === "ACTIVE",
                                  )
                                  .map((m) => ({
                                    value: uid(m),
                                    label: m.userId?.name || "Team member",
                                  })),
                              ),
                            ],
                            extra: { expectedVersion: c.version },
                          },
                        )
                      }
                    >
                      Assign teammate
                    </button>
                    {c.assignedMembershipId && (
                      <button
                        onClick={() =>
                          cmd.open(
                            "Remove responsibility",
                            "/campaigns/" + id + "/assignment",
                            { method: "DELETE" },
                          )
                        }
                      >
                        Remove responsibility
                      </button>
                    )}
                  </div>
                )}
                </aside>
              </div>
            ) : tab === "pitches" ? (
              <Collection
                path={"/campaigns/" + id + "/applications"}
                title="Campaign pitches" tools
                empty="No pitches for this campaign"
                card={(a, reload) => <RecordCard title={a.creator?.userId?.name || "Creator pitch"}
                  assetId={a.creator?.avatarAssetId} icon={Users} status={a.state}
                  href={"#/creators/" + a.creatorProfileId} action="View creator"
                  facts={[
                    { icon: Wallet, label: "Proposed rate", value: a.proposedRateMinor == null ? "—" : money(a.proposedRateMinor) },
                    { icon: CalendarDays, label: "Submitted", value: date(a.createdAt) },
                  ]}
                  secondary={<div className="actions">
                        {operator && a.state === "PENDING" && (
                          <>
                            <button
                              onClick={() =>
                                go(
                                  "/offers/new?creatorId=" +
                                    a.creatorProfileId +
                                    "&campaignId=" +
                                    id +
                                    "&applicationId=" +
                                    uid(a),
                                )
                              }
                            >
                              Prepare offer
                            </button>
                            <button
                              onClick={() =>
                                cmd.open(
                                  "Decline pitch",
                                  "/applications/" + uid(a) + "/decline",
                                  {
                                    fields: [area("reason", "Feedback")],
                                    extra: { expectedVersion: a.version }, after: reload,
                                  },
                                )
                              }
                            >
                              Decline
                            </button>
                          </>
                        )}
                  </div>}>
                  <p className="pitch-text">{a.pitch}</p>
                  {a.decisionReason && <div className="pitch-response"><strong>Response</strong><p>{a.decisionReason}</p></div>}
                </RecordCard>}
              />
            ) : tab === "revisions" ? (
              <Collection
                path={"/campaigns/" + id + "/revisions"}
                columns={[
                  { key: "revisionNumber", label: "Revision" },
                  { key: "title", label: "Title" },
                  {
                    key: "frozenAt",
                    label: "Frozen",
                    render: (r) => date(r.frozenAt),
                  },
                ]}
              />
            ) : (
              <Report path={"/reports/campaigns/" + id} />
            )}{" "}
            {cmd.modal}
          </div>
        );
      }}
    </State>
  );
}
export function Report({ path }) {
  const q = useQuery(path);
  return (
    <State query={q}>
      {(d) => (
        <section className="panel">
          <h2>Campaign delivery and spend</h2>
          <Stats
            items={[
              ["Creator gross", money(d.totals.grossMinor)],
              ["Platform fees", money(d.totals.feeMinor)],
              ["Creator net", money(d.totals.creatorNetMinor)],
              ["Agency charges", money(d.totals.agencyChargesMinor)],
            ]}
          />
          <p className="muted">
            Accepted agreement values across the current report scope. These
            commitments are separate from ledger earnings and transfers.
          </p>
          <div className="analytics-grid">
            <article className="panel chart-panel">
              <h3>Delivery progress</h3>
              <Distribution
                data={Object.entries(
                  d.rows.reduce(
                    (counts, r) => ({
                      ...counts,
                      [r.state]: (counts[r.state] || 0) + 1,
                    }),
                    {},
                  ),
                ).map(([name, value]) => ({ name, value }))}
              />
            </article>
            <article className="panel chart-panel">
              <h3>Agreed compensation by work</h3>
              <MoneyChart
                kind="bar"
                data={d.rows
                  .slice(0, 15)
                  .map((r) => ({ ...r, label: r.collaborationId.slice(-6) }))}
                keys={[
                  ["creatorNetMinor", "Creator net agreed", "#003b59"],
                  ["feeMinor", "Platform fee agreed", "#ffb118"],
                ]}
              />
              <p className="muted">
                First 15 collaborations · all rows included in CSV.
              </p>
            </article>
          </div>
          <button
            onClick={() => download(path + "/export", "insight-report.csv")}
          >
            Export CSV
          </button>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Collaboration</th>
                  <th>Status</th>
                  <th>Gross</th>
                  <th>Due</th>
                </tr>
              </thead>
              <tbody>
                {d.rows.map((r) => (
                  <tr key={r.collaborationId}>
                    <td>
                      <a href={"#/collaborations/" + r.collaborationId}>
                        {r.collaborationId.slice(-8)}
                      </a>
                    </td>
                    <td>
                      <Badge>{r.state}</Badge>
                    </td>
                    <td>{money(r.grossMinor)}</td>
                    <td>{date(r.dueAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </State>
  );
}
