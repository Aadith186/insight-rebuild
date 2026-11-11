import { RecordCard } from "../components/RecordCard";
import { CampaignImage } from "../components/Media";
import { SelectMenu } from "../components/SelectMenu";
import React, { useState } from "react";
import { Bell, MessageSquare, CheckCheck, ArrowUpRight, CalendarDays, Bookmark, FileText, Wallet, UserRound, Plus } from "lucide-react";
import { useRealtime } from "../app/realtime";
import { api, uid, money, date, go } from "../api/http";
import { useApp, useQuery } from "../app/context";
import {
  Page,
  State,
  Stats,
  Collection,
  Badge,
  Tabs,
  useCommand,
  area,
} from "../components/ui";
export function Dashboard() {
  const { role, auth, clientId } = useApp(),
    q = useQuery(
      "/dashboards/" + (role === "reviewer" ? "client-review" : role),
    );
  return (
    <State query={q}>
      {(d) => (
        <Page
          title={"Hello, " + auth.user.name.split(" ")[0] + "."}
          description={
            role === "agency" && !clientId
              ? "A view of all authorized client work."
              : "Here’s what needs your attention today."
          }
          actions={
            ["brand", "agency"].includes(role) ? (
              <button className="primary" onClick={() => go("/campaigns/new")}>
                Create campaign
              </button>
            ) : role === "creator" ? (
              <button className="primary" onClick={() => go("/campaigns")}>
                Explore campaigns
              </button>
            ) : null
          }
        >
          {role === "reviewer" ? (
            <section className="panel">
              <h2>Waiting for your decision</h2>
              {d.pendingApprovals.length ? (
                d.pendingApprovals.map((a) => (
                  <button
                    className="list-row"
                    key={uid(a)}
                    onClick={() => go("/approvals/" + uid(a))}
                  >
                    <span>{a.targetType.replaceAll("_", " ")}</span>
                    <Badge>{a.state}</Badge>
                  </button>
                ))
              ) : (
                <p>No reviews waiting.</p>
              )}
            </section>
          ) : (
            <>
              <Stats
                items={[
                  ["Active work", d.activeCount],
                  ["Completed", d.totals.completed],
                  ["Held funds", money(d.totals.heldMinor)],
                  ["Pending approvals", d.pendingApprovals],
                ]}
              />
              <div className="dashboard-grid">
                <section className="panel">
                  <div className="section-heading">
                    <h2>Needs your attention</h2>
                    <a href="#/collaborations">View all ↗</a>
                  </div>
                  {d.actions.length ? (
                    d.actions.map((w) => (
                      <button
                        className="list-row"
                        key={uid(w)}
                        onClick={() => go("/collaborations/" + uid(w))}
                      >
                        <div>
                          <h3>Collaboration #{uid(w).slice(-6)}</h3>
                          <p>Due {date(w.dueAt)}</p>
                        </div>
                        <Badge>{w.workState}</Badge>
                      </button>
                    ))
                  ) : (
                    <div className="state">
                      <h3>You’re up to date</h3>
                      <p>Actions for your role will appear here.</p>
                    </div>
                  )}
                </section>
                <section className="panel">
                  <h2>Upcoming deadlines</h2>
                  {d.deadlines.length ? (
                    d.deadlines.map((w) => (
                      <a
                        className="list-row"
                        key={uid(w)}
                        href={"#/collaborations/" + uid(w)}
                      >
                        <span>Work #{uid(w).slice(-6)}</span>
                        <strong>{date(w.dueAt)}</strong>
                      </a>
                    ))
                  ) : (
                    <p className="muted">No active delivery dates yet.</p>
                  )}
                </section>
              </div>
              <section className="welcome-banner">
                <div>
                  <p className="eyebrow">
                    From the first idea to final delivery
                  </p>
                  <h2>Make room for great work.</h2>
                  <p>
                    Clear briefs. Connected conversations. Every version in one
                    place.
                  </p>
                </div>
                <a className="button" href="#/guide">
                  Explore the workflow ↗
                </a>
              </section>
            </>
          )}
        </Page>
      )}
    </State>
  );
}
export function Notifications() {
  const { run } = useApp(),
    { summary, refreshUnread } = useRealtime(),
    [unreadOnly, setUnreadOnly] = useState(false),
    [notificationRevision, setNotificationRevision] = useState(0);
  return (
    <Page
      title="Activity & notifications"
      description="Your messages, pitches, approvals and collaboration updates."
      actions={
        <button
          onClick={() =>
            run(() =>
              api("/notifications/read-all", { method: "POST", body: {} }),
            ).then(() => { setNotificationRevision(previous => previous + 1); refreshUnread?.(); }).catch(() => {})
          }
        >
          <CheckCheck size={16}/> Mark all read
        </button>
      }
    >
      <div className="activity-intro">
        <span className="activity-intro-icon">
          <Bell size={25} />
        </span>
        <div>
          <h2>{summary?.notifications || 0} unread updates</h2>
          <p>
            Keep track of decisions, messages and work that needs your
            attention.
          </p>
        </div>
        <div className="directory-tabs">
          <button
            className={!unreadOnly ? "active" : ""}
            onClick={() => setUnreadOnly(false)}
          >
            All activity
          </button>
          <button
            className={unreadOnly ? "active" : ""}
            onClick={() => setUnreadOnly(true)}
          >
            Unread
          </button>
        </div>
      </div>
      <Collection
        path={"/notifications" + (unreadOnly ? "?unread=true" : "")}
        refreshKey={notificationRevision}
        empty={unreadOnly ? "You’re all caught up" : "No notifications yet"}
        render={(rows) =>
          rows.map((n) => (
            <button
              className={"notification list-row " + (!n.readAt ? "unread" : "")}
              key={uid(n)}
              onClick={() =>
                run(
                  () =>
                    api("/notifications/" + uid(n) + "/read", {
                      method: "POST",
                    }),
                  "Notification read",
                )
                  .then(() => {
                    refreshUnread?.();
                    if (n.link?.screen) go("/" + n.link.screen + (n.link.resourceId ? "/" + n.link.resourceId : ""));
                    else setNotificationRevision(previous => previous + 1);
                  })
                  .catch(() => {})
              }
            >
              <span className="notice-icon">
                <MessageSquare size={19} />
              </span>
              <div className="activity-copy">
                <h3>{n.title}</h3>
                <p>{n.body}</p>
                <small>{date(n.createdAt)}</small>
              </div>
              {!n.readAt && <span className="dot" />}
            </button>
          ))
        }
      />
    </Page>
  );
}
export function Saved() {
  const { role } = useApp();
  const cmd = useCommand();
  const creator = role === "creator";
  const browse = creator ? "#/campaigns" : "#/creators";
  const browseLabel = creator ? "Explore campaigns" : "Browse creators";
  return <Page title={creator ? "Saved campaigns" : "Your shortlist"}
    actions={<a className="button" href={browse}><Plus size={16}/> {browseLabel}</a>}>
    <Collection path={creator ? "/me/saved-campaigns" : "/shortlist-entries"}
      title={creator ? "Bookmarks" : "Shortlisted creators"} tools filterStatus={false}
      empty={creator ? "No saved campaigns" : "No shortlisted creators"}
      hint={creator ? "Save a campaign to revisit its brief later." : "Save creators while browsing to compare them here."}
      emptyAction={<a className="button" href={browse}>{browseLabel}</a>}
      card={(row, reload) => {
        const campaign = row.campaign;
        const person = row.creator;
        const available = campaign?.canOpen ?? campaign?.state === "PUBLISHED";
        const title = creator ? campaign?.title || campaign?.titleNormalized || "Campaign unavailable"
          : person?.userId?.name || "Saved creator";
        return <RecordCard title={title}
          subtitle={creator ? [campaign?.brandName, campaign?.niche].filter(Boolean).join(" · ") : person?.niches?.join(" · ")}
          status={creator ? campaign?.state : person?.verificationStatus} icon={creator ? Bookmark : UserRound}
          assetId={creator ? undefined : person?.avatarAssetId}
          cover={creator && available && <CampaignImage assetId={campaign.coverAssetId} niche={campaign.niche} title={title}/>}
          href={creator ? (available ? "#/campaigns/" + row.campaignId : undefined) : "#/creators/" + row.creatorProfileId}
          action={creator ? "View campaign" : "View creator"}
          facts={creator ? [
            { icon: CalendarDays, label: "Apply by", value: date(campaign?.applicationDeadline) },
            { icon: Wallet, label: "Per creator", value: campaign?.publicBudgetPerCreatorMinor == null ? "—" : money(campaign.publicBudgetPerCreatorMinor) },
          ] : [
            { icon: Wallet, label: "Starting rate", value: person?.startingRateMinor == null ? "—" : money(person.startingRateMinor) },
            { icon: UserRound, label: "Location", value: person?.city || "—" },
          ]}
          secondary={<button className="subtle" onClick={() => cmd.open(creator ? "Remove saved campaign" : "Remove from shortlist",
            creator ? "/me/saved-campaigns/" + row.campaignId : "/shortlist-entries/" + uid(row),
            { method: "DELETE", after: reload })}>Remove</button>}/>;
      }}/>
    {cmd.modal}
  </Page>;
}
export function Applications() {
  const cmd = useCommand();
  const [state, setState] = useState("");
  const options = [["", "All pitches"], ["PENDING", "Awaiting response"], ["OFFERED", "Offer received"],
    ["ACCEPTED", "Accepted"], ["DECLINED", "Declined"], ["WITHDRAWN", "Withdrawn"]];
  return <Page title="Your pitches" actions={<a className="button" href="#/campaigns"><Plus size={16}/> Explore campaigns</a>}>
    <Collection path={"/me/applications?state=" + state} title="Pitch tracker" tools filterStatus={false}
      filter={<SelectMenu label="Pitch status" value={state} onChange={setState}
        options={options.map(([value, label]) => ({ value, label }))}/>}
      empty={state ? "No pitches at this stage" : "No pitches yet"}
      hint={state ? "Choose All pitches to see other stages." : "Send a pitch from a campaign brief to track it here."}
      card={(pitch, reload) => {
        const campaign = pitch.campaign;
        const canView = pitch.campaignId && (campaign?.canOpen ?? (!campaign || ["PUBLISHED", "CLOSED"].includes(campaign.state)));
        return <RecordCard title={campaign?.title || campaign?.titleNormalized || "Campaign pitch"}
          subtitle={campaign?.brandName} icon={FileText} status={pitch.state}
          href={canView ? "#/campaigns/" + pitch.campaignId : undefined} action="View campaign"
          facts={[
            { icon: Wallet, label: "Proposed rate", value: pitch.proposedRateMinor == null ? "—" : money(pitch.proposedRateMinor) },
            { icon: CalendarDays, label: "Submitted", value: date(pitch.createdAt) },
          ]}
          secondary={pitch.state === "PENDING" ? <button className="subtle" onClick={() => cmd.open("Withdraw pitch",
            "/applications/" + uid(pitch) + "/withdraw", { extra: { expectedVersion: pitch.version }, after: reload })}>Withdraw</button>
            : ["OFFERED", "ACCEPTED"].includes(pitch.state) ? <a className="button" href="#/offers">View offers</a> : null}>
          <p className="pitch-text">{pitch.pitch}</p>
          {pitch.decisionReason && <div className="pitch-response"><strong>Response</strong><p>{pitch.decisionReason}</p></div>}
        </RecordCard>;
      }}/>
    {cmd.modal}
  </Page>;
}
export function Guide() {
  return (
    <Page
      title="Good collaborations, step by step"
      description="A shared workflow for creators, brands and agencies."
    >
      <div className="guide-grid">
        {[
          [
            "01",
            "Find your match",
            "Build a profile, discover creators or browse published campaign briefs.",
          ],
          [
            "02",
            "Agree the work",
            "Record deliverables, rights, products, fees and revisions. Agency proposals need independent client approval.",
          ],
          [
            "03",
            "Prepare together",
            "Verify paid funding, share the delivery address, ship and confirm product receipt.",
          ],
          [
            "04",
            "Review every cut",
            "Submit a video, discuss timestamped feedback and agree additional rounds before work starts.",
          ],
          [
            "05",
            "Deliver and settle",
            "Publish or hand over the approved content. Verify completion, release payment and leave a review.",
          ],
          [
            "06",
            "Keep the context",
            "Messages, decisions, product issues and disputes stay attached to the relevant work.",
          ],
        ].map(([n, t, b]) => (
          <section className="panel" key={n}>
            <span className="step">{n}</span>
            <h2>{t}</h2>
            <p>{b}</p>
          </section>
        ))}
      </div>
    </Page>
  );
}
