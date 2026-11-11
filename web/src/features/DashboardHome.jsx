import { workAction } from "../components/listing";
import { ANDROID_APP, editorialImage } from "../app/platform";
import { AndroidHome } from "../components/AndroidHome";
import React from "react";
import {
  ArrowUpRight,
  Plus,
  CalendarDays,
  Clock,
  ChevronRight,
  CheckCircle,
  Compass,
} from "lucide-react";
import { uid, money, date, go, label } from "../api/http";
import { useApp, useQuery } from "../app/context";
import { Page, State, Badge } from "../components/ui";
import { KpiCards, AnalyticsPanels } from "../components/Charts";
import { CampaignTile, CreatorTile } from "../components/CatalogCards";
import { ReviewOpportunities } from "./Reviews";
export function DashboardHome() {
  const { role, auth, org, clientId } = useApp(),
    reviewer = role === "reviewer",
    creator = role === "creator",
    q = useQuery("/dashboards/" + (reviewer ? "client-review" : role)),
    featured = useQuery(
      reviewer ? null : creator ? "/campaigns?limit=3" : "/creators?limit=4",
    );
  const name = creator ? auth.user.name : org?.name || auth.user.name;
  if (ANDROID_APP) {
    return <AndroidHome query={q} featured={featured} role={role} name={name}/>;
  }
  return (
    <Page
      eyebrow={creator ? "Your creator studio" : "Your collaboration hub"}
      title={reviewer ? "Client review" : creator ? name.split(" ")[0] + "’s studio" : name}
      description={
        role === "agency" && !clientId
          ? "One clear view across all your authorized clients."
          : undefined
      }
      actions={
        !reviewer && (
          <>
            <a className="quiet-link" href="#/guide">
              How Insight works <ArrowUpRight size={14} />
            </a>
            <button
              className="primary"
              onClick={() => go(creator ? "/campaigns" : "/campaigns/new")}
            >
              {creator ? <Compass size={16} /> : <Plus size={16} />}{" "}
              {creator ? "Explore campaigns" : "Create campaign"}
            </button>
          </>
        )
      }
    >
      <State query={q}>
        {(d) =>
          reviewer ? (
            <>
              <section className="panel">
                <div className="section-heading">
                  <h2>Waiting for your decision</h2>
                  <span className="count-pill">
                    {d.pendingApprovals.length}
                  </span>
                </div>
                {d.pendingApprovals.length ? (
                  d.pendingApprovals.map((a) => (
                    <button
                      className="list-row"
                      key={uid(a)}
                      onClick={() => go("/approvals/" + uid(a))}
                    >
                      <div>
                        <strong>{a.campaignTitle || a.brandName || label(a.targetType)}</strong>
                        <p>{[a.brandName, label(a.targetType), "Version " + a.targetVersion].filter(Boolean).join(" · ")}</p>
                      </div>
                      <Badge>{a.state}</Badge>
                      <ChevronRight size={18} />
                    </button>
                  ))
                ) : (
                  <div className="review-empty">
                    <CheckCircle />
                    <p>All client reviews are up to date.</p>
                  </div>
                )}
              </section>
            </>
          ) : (
            <>
              <div className="dashboard-work-grid">
                <section className="panel action-panel">
                  <div className="section-heading">
                    <div>
                      <h2>Needs attention</h2>
                    </div>
                    <span className="count-pill">{d.actions.length}</span>
                  </div>
                  {d.actions.length ? (
                    d.actions.map((w) => (
                      <a
                        className="action-card"
                        key={uid(w)}
                        href={"#/collaborations/" + uid(w)}
                      >
                        <span className="action-icon">
                          <Clock size={18} />
                        </span>
                        <div>
                          <strong>{w.campaignTitle || w.brandName || "Collaboration"}</strong>
                          <p>{[w.brandName, workAction(w.workState), w.dueAt && "Due " + date(w.dueAt)].filter(Boolean).join(" · ")}</p>
                        </div>
                        <ArrowUpRight size={17} />
                      </a>
                    ))
                  ) : (
                    <div className="review-empty">
                      <CheckCircle />
                      <div>
                        <h3>Nothing waiting on you</h3>
                        <p>You’re up to date with your current work.</p>
                      </div>
                    </div>
                  )}
                </section>
                <section className="panel deadline-panel">
                  <div className="section-heading">
                    <h2>Coming up next</h2>
                    <CalendarDays size={19} />
                  </div>
                  {d.deadlines.length ? (
                    d.deadlines.slice(0, 5).map((w) => (
                      <a
                        href={"#/collaborations/" + uid(w)}
                        className="deadline-row"
                        key={uid(w)}
                      >
                        <div className="date-block">
                          <strong>{new Date(w.dueAt).getDate()}</strong>
                          <span>
                            {new Date(w.dueAt).toLocaleDateString("en-IN", {
                              month: "short",
                            })}
                          </span>
                        </div>
                        <div>
                          <strong>{w.campaignTitle || w.brandName || "Collaboration"}</strong>
                          <p>{label(w.workState)}</p>
                        </div>
                        <ChevronRight size={16} />
                      </a>
                    ))
                  ) : (
                    <p className="muted">
                      Your upcoming delivery dates will appear here.
                    </p>
                  )}
                </section>
              </div>
              <ReviewOpportunities compact />
              <KpiCards
                items={[
                  {
                    label: "Active collaborations",
                    value: d.activeCount,
                    note: "Work currently in motion",
                    href: "#/collaborations",
                    tone: 0,
                  },
                  {
                    label: "Completed work",
                    value: d.totals.completed,
                    note: "Settled collaborations",
                    href: "#/collaborations?state=COMPLETED",
                    tone: 1,
                  },
                  {
                    label: "Funds awaiting closeout",
                    value: money(d.totals.heldMinor),
                    note: "Current held and refund-pending funds",
                    href: "#/finance",
                    tone: 2,
                  },
                  {
                    label: "Client approvals",
                    value: d.pendingApprovals,
                    note: "Authorized requests awaiting decision",
                    href: "#/approvals",
                    tone: 3,
                  },
                ]}
              />
              <div className="section-heading catalog-heading">
                <div>
                  <p className="eyebrow">Find your niche</p>
                  <h2>A world of creative possibilities</h2>
                </div>
                <a href={creator ? "#/campaigns" : "#/creators"}>
                  Explore all <ArrowUpRight size={15} />
                </a>
              </div>
              <div className="category-strip">
                {[
                  ["Beauty", "serum", "Beauty"],
                  ["Fashion", "stones", "Fashion"],
                  ["Travel", "wide", "Travel"],
                  ["Food & lifestyle", "studio", "Food"],
                ].map(([title, image, filter]) => (
                  <a
                    key={title}
                    href={
                      creator
                        ? "#/campaigns?search=" + encodeURIComponent(filter)
                        : "#/creators?niche=" + encodeURIComponent(filter)
                    }
                  >
                    <img src={editorialImage(image)} alt="" />
                    <span>{title}</span>
                    <ChevronRight size={15} />
                  </a>
                ))}
              </div>
              <AnalyticsPanels earnings={creator} />

              <div className="section-heading catalog-heading">
                <div>
                  <p className="eyebrow">
                    {creator
                      ? "Your next opportunity"
                      : "People with a point of view"}
                  </p>
                  <h2>
                    {creator
                      ? "Discover open campaigns"
                      : "Meet your next creative partner"}
                  </h2>
                </div>
                <a href={creator ? "#/campaigns" : "#/creators"}>
                  View all <ArrowUpRight size={15} />
                </a>
              </div>
              <State
                query={featured}
                empty={
                  creator
                    ? "New campaigns will appear here"
                    : "New creators will appear here"
                }
                hint={
                  creator
                    ? "Published briefs from active brands are shown here."
                    : "Invite creators or return as the community grows."
                }
              >
                {(rows) => (
                  <div className={creator ? "card-grid" : "creator-grid"}>
                    {rows.map((r) =>
                      creator ? (
                        <CampaignTile campaign={r} key={uid(r)} />
                      ) : (
                        <CreatorTile creator={r} key={uid(r)} />
                      ),
                    )}
                  </div>
                )}
              </State>
            </>
          )
        }
      </State>
    </Page>
  );
}
