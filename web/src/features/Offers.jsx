import { ArrowLeft, ArrowUpRight, CalendarDays, FileText, History, Plus, ShieldCheck } from "lucide-react";
import { RecordCard } from "../components/RecordCard";
import { SelectMenu } from "../components/SelectMenu";
import { Avatar } from "../components/Media";
import { mediaURL } from "../api/http";
import React,{useState} from "react";
import { api, uid, money, date, go, label } from "../api/http";
import { useApp, useQuery } from "../app/context";
import {
  Page,
  Collection,
  State,
  Form,
  Terms,
  Badge,
  useCommand,
  text,
  area,
  select,
} from "../components/ui";
import { terms, approvalFields } from "./forms";
export function Offers() {
  const { role } = useApp(),[state,setState]=useState('');
  return (
    <Page
      title={role === "creator" ? "Your offers" : "Proposals and offers"}
      description="Review the scope, fee and delivery date before agreeing."
      actions={
        ["brand", "agency"].includes(role) && (
          <button className="primary" onClick={() => go("/offers/new")}>
            <Plus size={17}/> Prepare offer
          </button>
        )
      }
    >
      <Collection
        title="Offer pipeline"
        path={"/offers?state=" + state}
        filterStatus={false}
        empty={state ? "No offers at this stage" : "No offers yet"}
        hint={state ? "Choose All offers to see other stages." : undefined}
        filter={<SelectMenu label="Offer status" value={state} onChange={setState} options={[
          ["", "All offers"],
          ...(["brand", "agency", "owner"].includes(role) ? [["DRAFT", "Drafts"], ["CLIENT_REVIEW", "Client review"]] : []),
          ["SENT", "Awaiting response"], ["ACCEPTED", "Accepted"], ["DECLINED", "Declined"], ["WITHDRAWN", "Withdrawn"],
        ].map(([value, label]) => ({ value, label }))}/>}
        card={r => {
          const terms = r.revisions?.at(-1);
          const counterpart = role === "creator" ? r.brandName : r.creatorName;
          return <article className="offer-tile">
            <a href={"#/offers/" + uid(r)} className="offer-tile-link">
              <div className="offer-tile-heading">
                <h3>{r.campaignTitle || counterpart || "Direct offer"}</h3>
                <ArrowUpRight size={17} aria-hidden="true"/>
              </div>
              <div className="offer-tile-context">
                <span>{r.campaignTitle ? counterpart : "Direct offer"}</span>
                <Badge>{r.state}</Badge>
              </div>
              <div className="offer-tile-summary">
                <span>{terms?.amountMinor == null ? "Amount pending" : <><strong>{money(terms.amountMinor)}</strong> gross</>}</span>
                {terms?.dueAt && <span>Due {date(terms.dueAt)}</span>}
              </div>
            </a>
          </article>;
        }}
        columns={[
          {
            key: "creatorProfileId",
            label:
              role === "creator" ? "Brand & campaign" : "Creator & campaign",
            render: (r) => (
              <a href={"#/offers/" + uid(r)}>
                <div className="table-identity">
                  <Avatar
                    assetId={
                      role === "creator"
                        ? r.brandLogoAssetId
                        : r.creatorAvatarAssetId
                    }
                    name={role === "creator" ? r.brandName : r.creatorName}
                    size={40}
                  />
                  <div>
                    <strong>
                      {role === "creator"
                        ? r.brandName || "Brand"
                        : r.creatorName || "Creator"}
                    </strong>
                    <small>{r.campaignTitle || "Direct collaboration"}</small>
                  </div>
                </div>
              </a>
            ),
          },
          {
            key: "state",
            label: "Status",
            render: (r) => <Badge>{r.state}</Badge>,
          },
          {
            key: "amount",
            label: "Gross",
            render: (r) => money(r.revisions?.at(-1)?.amountMinor),
          },
          {
            key: "due",
            label: "Due",
            render: (r) => date(r.revisions?.at(-1)?.dueAt),
          },
        ]}
        onOpen={(r) => go("/offers/" + uid(r))}
      />
    </Page>
  );
}
export function OfferEditor({ id, params }) {
  const { org, clientId, run } = useApp(),
    cfg = useQuery("/config"),
    q = useQuery(id ? "/offers/" + id : null),
    [creatorSearch, setCreatorSearch] = useState(""),
    search = React.useDeferredValue(creatorSearch.trim()),
    [selectedCreator, setSelectedCreator] = useState(null),
    linkedCreator = useQuery(!id && params?.get("creatorId") ? "/creators/" + params.get("creatorId") : null),
    creators = useQuery(!id && search ? "/creators?limit=12&search=" + encodeURIComponent(search) : null);
  return (
    <Page
      title={id ? "Edit proposal" : "Prepare an offer"}
      description="Draft privately, collect client approval where required, then send."
    >
      <State query={cfg}>
        {(config) => (
          <section className="panel">
            {!id && <section className="offer-recipient">
              <h2>Choose a creator</h2>
              {selectedCreator || linkedCreator.data ? <div className="actions">
                <strong>{(selectedCreator || linkedCreator.data).name}</strong>
                {selectedCreator && <button onClick={() => setSelectedCreator(null)}>Change creator</button>}
              </div> : <label className="listing-search">
                <input aria-label="Find a creator" placeholder="Search by creator name or niche" value={creatorSearch} onChange={event => setCreatorSearch(event.target.value)}/>
              </label>}
              {search && !selectedCreator && !linkedCreator.data && <State query={creators} empty="No creators match that search">{rows =>
                <div className="recipient-results">{rows.map(creator => <button key={uid(creator)} onClick={() => setSelectedCreator(creator)}>
                  <strong>{creator.name}</strong><small>{[creator.city, creator.niches?.[0]].filter(Boolean).join(" · ")}</small>
                </button>)}</div>
              }</State>}
            </section>}
            <Form
              key={id ? uid(q.data) + q.data?.version : "new"}
              sections={{ formatId: "Compensation and timing", deliverables: "Deliverables and rights", products: "Products and affiliate terms" }}
              submit={id ? "Save offer changes" : "Save offer draft"}
              fields={terms(config.formats)}
              initial={
                id
                  ? q.data?.revisions.at(-1)
                  : { creatorProfileId: params?.get("creatorId") }
              }
              onSubmit={async (b) => {
                if (!id) {
                  const creatorProfileId = uid(selectedCreator || linkedCreator.data);
                  if (!creatorProfileId) throw new Error("Choose a creator before saving the offer.");
                  b.creatorProfileId = creatorProfileId;
                }
                if (!b.affiliateTerms?.description) delete b.affiliateTerms;
                const r = await run(() =>
                  api(id ? "/offers/" + id : "/offers", {
                    method: id ? "PATCH" : "POST",
                    body: {
                      ...b,
                      ...(id
                        ? { expectedVersion: q.data.version }
                        : {
                            brandOrganizationId: clientId || uid(org),
                            ...(params?.get("campaignId")
                              ? { campaignId: params.get("campaignId") }
                              : {}),
                            ...(params?.get("applicationId")
                              ? { applicationId: params.get("applicationId") }
                              : {}),
                          }),
                    },
                  }),
                );
                go("/offers/" + uid(r.data));
              }}
            />
          </section>
        )}
      </State>
    </Page>
  );
}
export function OfferDetail({ id }) {
  const q = useQuery("/offers/" + id),
    { role } = useApp(),
    cmd = useCommand(q.reload);
  return (
    <State query={q}>
      {(o) => (
        <>
        <a href="#/offers" className="campaign-back"><ArrowLeft size={16}/> All offers</a>
        <Page
          title={o.campaignTitle || o.brandName || "Collaboration proposal"}
          description={[o.campaignTitle && o.brandName, role !== "creator" && o.creatorName, "Proposal · Revision " + o.revisionNumber].filter(Boolean).join(" · ")}
          actions={
            <>
              <Badge>{o.state}</Badge>
              {o.collaborationId && <a className="button primary" href={"#/collaborations/" + o.collaborationId}>Open collaboration <ArrowUpRight size={16}/></a>}
              {role === "creator" && o.state === "SENT" ? (
                <>
                  <button
                    onClick={() =>
                      cmd.open("Decline offer", "/offers/" + id + "/decline", {
                        fields: [area("reason", "Note", false)],
                        extra: { expectedVersion: o.version },
                      })
                    }
                  >
                    Decline
                  </button>
                  <button
                    className="primary"
                    onClick={() =>
                      cmd.open(
                        "Accept these terms",
                        "/offers/" + id + "/accept",
                        {
                          extra: { expectedVersion: o.version },
                          after: (d) =>
                            go("/collaborations/" + uid(d.collaboration)),
                        },
                      )
                    }
                  >
                    Accept offer
                  </button>
                </>
              ) : ["brand", "agency"].includes(role) ? (
                <>
                  {["DRAFT", "CLIENT_REVIEW"].includes(o.state) && (
                    <>
                      <button onClick={() => go("/offers/" + id + "/edit")}>
                        Edit proposal
                      </button>
                      {o.agencyOrganizationId && (
                        <button
                          onClick={() =>
                            cmd.open(
                              "Share proposal with client",
                              "/client-approvals",
                              {
                                fields: approvalFields(o.eligibleReviewers),
                                initial: { policy: "ANY_ASSIGNED" },
                                extra: {
                                  targetType: "OFFER_REVISION",
                                  targetId: id,
                                  targetVersion: o.revisionNumber,
                                },
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
                          cmd.open("Send offer", "/offers/" + id + "/send", {
                            extra: { expectedVersion: o.version },
                          })
                        }
                      >
                        Send to creator
                      </button>
                    </>
                  )}
                  {o.state === "SENT" && (
                    <button
                      onClick={() =>
                        cmd.open(
                          "Withdraw offer",
                          "/offers/" + id + "/withdraw",
                          {
                            fields: [area("reason", "Reason")],
                            extra: { expectedVersion: o.version },
                          },
                        )
                      }
                    >
                      Withdraw
                    </button>
                  )}
                </>
              ) : null}
            </>
          }
        >
          <Terms
            value={o.revisions.find(
              (r) =>
                r.revisionNumber === (o.sentRevisionNumber || o.revisionNumber),
            )}
          />
          <section className="agreement-panel proposal-history">
            <header className="agreement-heading"><span className="agreement-icon"><History size={20}/></span><h2>Proposal history</h2></header>
            <ol>{[...o.revisions].reverse().map(r => <li key={r.revisionNumber}>
              <div><strong>Revision {r.revisionNumber}</strong>
                {r.revisionNumber === (o.sentRevisionNumber || o.revisionNumber) && <span>Current terms</span>}
              </div>
              <strong>{money(r.amountMinor)}</strong>
              <span><CalendarDays size={15}/> {date(r.dueAt)}</span>
            </li>)}</ol>
          </section>
          {cmd.modal}
        </Page>
        </>
      )}
    </State>
  );
}
export function Approvals({ id }) {
  const q = useQuery(id ? "/client-approvals/" + id : null),
    { auth, run } = useApp(),
    cmd = useCommand(q.reload);
  if (!id)
    return (
      <Page
        title="Client approvals"
        description="Decisions are attached to the exact version shared for review."
      >
        <Collection
          path="/client-approvals"
          title="Approval queue"
          empty="No client approvals yet"
          card={row => <RecordCard title={label(row.targetType)} icon={ShieldCheck} status={row.state}
            href={"#/approvals/" + uid(row)} action="Review request" facts={[
              { icon: History, label: "Version", value: row.targetVersion ?? "—" },
              { icon: CalendarDays, label: "Requested", value: date(row.requestedAt) },
            ]}/>}
          columns={[
            { key: "targetType", label: "Review type", render: row => label(row.targetType) },
            { key: "targetVersion", label: "Version" },
            {
              key: "state",
              label: "Status",
              render: (r) => <Badge>{r.state}</Badge>,
            },
            {
              key: "requestedAt",
              label: "Requested",
              render: (r) => date(r.requestedAt),
            },
          ]}
          onOpen={(r) => go("/approvals/" + uid(r))}
        />
      </Page>
    );
  return (
    <State query={q}>
      {(a) => (
        <Page
          title="Client review"
          description={
            label(a.targetType) + " · Version " + a.targetVersion
          }
          actions={
            <>
              <Badge>{a.state}</Badge>
              <button
                onClick={() =>
                  run(
                    () =>
                      api("/conversations", {
                        method: "POST",
                        body: { contextType: "CLIENT_REVIEW", contextId: id },
                      }),
                    "Conversation opened",
                  )
                    .then((r) => go("/conversations/" + uid(r.data)))
                    .catch(() => {})
                }
              >
                Client discussion
              </button>
              {a.state === "PENDING" &&
                a.reviewerUserIds.includes(uid(auth.user)) && (
                  <button
                    className="primary"
                    onClick={() =>
                      cmd.open(
                        "Record your decision",
                        "/client-approvals/" + id + "/decisions",
                        {
                          fields: [
                            select("decision", "Decision", [
                              "APPROVED",
                              "CHANGES_REQUESTED",
                            ]),
                            area("note", "Feedback"),
                          ],
                          extra: { expectedVersion: a.version },
                        },
                      )
                    }
                  >
                    Review and decide
                  </button>
                )}
              {a.state === "PENDING" &&
                a.requestedByUserId === uid(auth.user) && (
                  <button
                    onClick={() =>
                      cmd.open(
                        "Cancel review request",
                        "/client-approvals/" + id + "/cancel",
                        { fields: [area("reason", "Reason")] },
                      )
                    }
                  >
                    Cancel request
                  </button>
                )}
            </>
          }
        >
          {a.targetType === "OFFER_REVISION" ? (
            <Terms value={a.snapshot} />
          ) : a.targetType === "CONTENT_VERSION" ? (
            <section className="panel">
              <h2>{a.snapshot.title}</h2>
              {a.snapshot.assetId ? (
                <video controls src={mediaURL(a.snapshot.assetId)} />
              ) : (
                <a
                  href={a.snapshot.externalUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Watch submitted video ↗
                </a>
              )}
              <p>{a.snapshot.note}</p>
              <a href={"#/review/" + uid(a.snapshot)}>Open review room</a>
            </section>
          ) : (
            <>
              <section className="agreement-panel">
                <header className="agreement-heading"><span className="agreement-icon"><FileText size={19}/></span><h2>{a.snapshot.title || "Campaign brief"}</h2></header>
                <p className="preserve">{a.snapshot.brief}</p>
                <div className="record-facts"><div>Per creator <strong>{a.snapshot.budgetPerCreatorMinor == null ? "—" : money(a.snapshot.budgetPerCreatorMinor)}</strong></div>
                  <div>Delivery due <strong>{date(a.snapshot.deadline)}</strong></div></div>
              </section>
              <Terms value={a.snapshot} payment={false}/>
            </>
          )}
          <section className="agreement-panel decision-history">
            <header className="agreement-heading"><span className="agreement-icon"><History size={19}/></span><h2>Decision history</h2></header>
            {a.decisions.length ? (
              a.decisions.map((d) => (
                <blockquote key={uid(d)}>
                  <Badge>{d.decision}</Badge>
                  <p>{d.note}</p>
                  <small>
                    {d.reviewerUserId?.name} · {date(d.decidedAt)}
                  </small>
                </blockquote>
              ))
            ) : (
              <p className="muted">
                Waiting for an independent client decision.
              </p>
            )}
          </section>
          {cmd.modal}
        </Page>
      )}
    </State>
  );
}
