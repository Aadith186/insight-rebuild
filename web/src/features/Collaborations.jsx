import { RecordCard } from "../components/RecordCard";
import { SelectMenu } from "../components/SelectMenu";
import { Avatar } from "../components/Media";
import { mediaURL } from "../api/http";
import React, { useState, useRef } from "react";
import { api, uid, money, date, go, label } from "../api/http";
import { useApp, useQuery } from "../app/context";
import {
  Page,
  Collection,
  State,
  Tabs,
  Badge,
  Terms,
  useCommand,
  text,
  area,
  field,
  select,
  Upload,
  Form,
} from "../components/ui";
import { address, shipment, approvalFields } from "./forms";
import { ReviewOpportunities, ReviewCards } from "./Reviews";
import { ArrowLeft, CalendarDays, CheckCircle, Handshake, MessageSquare, Package, RotateCcw, Wallet } from "lucide-react";
export function Collaborations() {
  const [state, setState] = useState(""),
    { role } = useApp();
  return (
    <Page
      title="Collaborations"
      description="Track deliverables, deadlines and funding."
    >
      <Collection
        title="Work queue"
        filterStatus={false}
        path={"/collaborations?state=" + state}
        empty={state ? "No collaborations in this stage" : "No collaborations yet"}
        hint={state ? "Choose All work to see other stages." : "Accepted offers will appear here."}
        filter={<SelectMenu label="Collaboration progress" value={state} onChange={setState} options={[
          ["", "All work"], ["PREPARATION", "Preparing"], ["IN_REVIEW", "In review"],
          ["REVISION_REQUESTED", "Changes requested"], ["APPROVED", "Approved"],
          ["COMPLETION_REVIEW", "Completion review"], ["VERIFIED", "Verified"],
          ["COMPLETED", "Completed"], ["REFUNDED", "Refunded"],
        ].map(([value, label]) => ({ value, label }))}/>}
        card={r => <RecordCard
          title={r.campaignTitle || "Direct collaboration"}
          subtitle={role === "creator" ? r.brandName : r.creatorName}
          assetId={role === "creator" ? r.brandLogoAssetId : r.creatorAvatarAssetId}
          icon={Handshake} status={r.workState} href={"#/collaborations/" + uid(r)} action="Open collaboration"
          facts={[
            { icon: Wallet, label: "Compensation", value: r.amountMinor == null ? "—" : money(r.amountMinor) },
            { icon: CalendarDays, label: "Due date", value: date(r.dueAt) },
          ]}>
          <div className="record-card-detail"><span>{r.formatLabel || "Collaboration terms"}</span>{r.fundingState && <Badge>{r.fundingState}</Badge>}</div>
        </RecordCard>}
        columns={[
          {
            key: "id",
            label: "Collaboration",
            render: (r) => (
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
                  <small>
                    {r.campaignTitle || "Direct collaboration"} · #
                    {uid(r).slice(-6)}
                  </small>
                </div>
              </div>
            ),
          },
          {
            key: "workState",
            label: "Progress",
            render: (r) => <Badge>{r.workState}</Badge>,
          },
          {
            key: "fundingState",
            label: "Funding",
            render: (r) => <Badge>{r.fundingState}</Badge>,
          },
          {
            key: "amountMinor",
            label: "Agreed compensation",
            render: (r) => (
              <div className="table-money">
                <strong>{money(r.amountMinor)}</strong>
                <small>{r.formatLabel || "Accepted terms"}</small>
              </div>
            ),
          },
          { key: "dueAt", label: "Due", render: (r) => date(r.dueAt) },
        ]}
        onOpen={(r) => go("/collaborations/" + uid(r))}
      />
    </Page>
  );
}
export function Collaboration({ id }) {
  const q = useQuery("/collaborations/" + id),
    [tab, setTab] = useState("overview"),
    { role, member, org, run } = useApp(),
    team = useQuery(
      member?.role === "ORG_ADMIN" && org
        ? "/organizations/" + uid(org) + "/members?limit=100"
        : null,
    ),
    cmd = useCommand(q.reload);
  return (
    <State query={q}>
      {(d) => {
        const commissioner = d.party === "COMMISSIONER",
          creator = d.party === "CREATOR",
          closed = ["COMPLETED", "REFUNDED", "REFUND_PENDING"].includes(
            d.workState,
          ),
          active = !closed && !d.openDisputeId;
        return (
          <>
          <a href="#/collaborations" className="campaign-back"><ArrowLeft size={16}/> All collaborations</a>
          <Page
            title={d.campaignTitle || "Direct collaboration"}
            description={[role === "creator" ? d.brandName : d.creatorName, d.dueAt && "Content due " + date(d.dueAt)].filter(Boolean).join(" · ")}
            actions={
              <>
                <Badge>{d.workState}</Badge>
                <button
                  onClick={() =>
                    run(async () => {
                      if (role === "owner") {
                        const r = await api(
                          "/conversations?collaborationId=" + id,
                        );
                        if (!r.data.length)
                          throw new Error(
                            "There is no shared conversation for this work yet.",
                          );
                        return { data: r.data[0] };
                      }
                      return api("/conversations", {
                        method: "POST",
                        body: { contextType: "COLLABORATION", contextId: id },
                      });
                    }, "Conversation opened")
                      .then((r) => go("/conversations/" + uid(r.data)))
                      .catch(() => {})
                  }
                >
                  <MessageSquare size={16}/> Open conversation
                </button>
                {active && role !== "owner" && role !== "reviewer" && (
                  <button
                    onClick={() =>
                      cmd.open(
                        "Report a dispute",
                        "/collaborations/" + id + "/disputes",
                        {
                          fields: [
                            text("reason", "Reason"),
                            area("description", "Describe the problem"),
                            {
                              name: "evidenceRefs",
                              label: "Supporting files",
                              type: "evidence",
                              collaborationId: id,
                            },
                          ],
                        },
                      )
                    }
                  >
                    Report problem
                  </button>
                )}
              </>
            }
          >
            {d.openDisputeId && (
              <div className="banner warning">
                This work is frozen while the dispute is reviewed.{" "}
                <a href={"#/disputes/" + d.openDisputeId}>View case</a>
              </div>
            )}
            <Tabs
              items={[
                "overview",
                "products",
                "content",
                "completion",
                "payments",
                "reviews",
                "activity",
              ]}
              value={tab}
              onChange={setTab}
            />
            {tab === "overview" ? (
              <>
                <section className="work-state-panel" aria-label="Collaboration progress">
                  <div><span className="agreement-icon"><Wallet size={17}/></span><div><small>Funding</small><Badge>{d.fundingState}</Badge></div></div>
                  <div><span className="agreement-icon"><Package size={17}/></span><div><small>Products</small><Badge>{d.productState}</Badge></div></div>
                  <div><span className="agreement-icon"><RotateCcw size={17}/></span><div><small>Revisions used</small><strong>{d.revisionCount ?? 0} / {d.agreement?.includedRevisions ?? 0}</strong></div></div>
                </section>
                <Terms value={d.agreement}/>
                {member?.role === "ORG_ADMIN" && d.agencyOrganizationId && (
                  <section className="panel">
                    <button
                      onClick={() =>
                        cmd.open(
                          "Assign responsibility",
                          "/collaborations/" + id + "/assignment",
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
                            extra: { expectedVersion: d.version },
                          },
                        )
                      }
                    >
                      Assign teammate
                    </button>
                    {d.assignedMembershipId && (
                      <button
                        onClick={() =>
                          cmd.open(
                            "Remove responsibility",
                            "/collaborations/" + id + "/assignment",
                            { method: "DELETE" },
                          )
                        }
                      >
                        Remove assignment
                      </button>
                    )}
                  </section>
                )}
              </>
            ) : tab === "products" ? (
              <Products d={d} reload={q.reload} />
            ) : tab === "content" ? (
              <>
                <section className="panel">
                  <h2>Content versions</h2>
                  {active &&
                    creator &&
                    ["PREPARATION", "REVISION_REQUESTED"].includes(
                      d.workState,
                    ) && <Submission d={d} reload={q.reload} />}
                  <Collection
                    path={"/collaborations/" + id + "/content-versions"}
                    refreshKey={d.version}
                    columns={[
                      { key: "sequence", label: "Version" },
                      { key: "title", label: "Title" },
                      {
                        key: "state",
                        label: "Review",
                        render: (r) => <Badge>{r.state}</Badge>,
                      },
                      {
                        key: "submittedAt",
                        label: "Submitted",
                        render: (r) => date(r.submittedAt),
                      },
                    ]}
                    onOpen={(r) => go("/review/" + uid(r))}
                  />
                </section>
              </>
            ) : tab === "completion" ? (
              <section className="panel">
                <h2>Publishing and handover</h2>
                {active && creator && d.workState === "APPROVED" && (
                  <button
                    className="primary"
                    onClick={() =>
                      cmd.open(
                        "Submit completion",
                        "/collaborations/" + id + "/completion-submissions",
                        {
                          fields: [
                            select(
                              "mode",
                              "Completion method",
                              d.agreement.formatSnapshot.completionMode ===
                                "HANDOVER"
                                ? ["HANDOVER"]
                                : d.agreement.formatSnapshot.completionMode ===
                                    "PUBLISH"
                                  ? ["PUBLISHED"]
                                  : ["PUBLISHED", "HANDOVER"],
                            ),
                            text("platform", "Publishing platform", false),
                            field("url", "Live post / handover URL", "url"),
                            field("completedAt", "Completed at", "datetime"),
                          ],
                          extra: {
                            approvedContentVersionId:
                              d.approvedContentVersionId,
                          },
                        },
                      )
                    }
                  >
                    Submit publishing / handover
                  </button>
                )}
                <Collection
                  path={"/collaborations/" + id + "/completion-submissions"}
                  refreshKey={d.version}
                  render={(rows) =>
                    rows.map((c) => (
                      <article className="list-row" key={uid(c)}>
                        <div>
                          <Badge>{c.state}</Badge>
                          <p>
                            Attempt {c.attemptNumber} · {c.mode}
                          </p>
                          <a href={c.url} target="_blank" rel="noreferrer">
                            Check delivery ↗
                          </a>
                          <p>{c.reviewNote}</p>
                        </div>
                        {commissioner && active && c.state === "PENDING" && (
                          <div className="actions">
                            <button
                              onClick={() =>
                                cmd.open(
                                  "Request correction",
                                  "/completion-submissions/" +
                                    uid(c) +
                                    "/request-correction",
                                  {
                                    fields: [
                                      area("reason", "What needs correction?"),
                                    ],
                                    extra: { expectedVersion: c.version },
                                  },
                                )
                              }
                            >
                              Request correction
                            </button>
                            <button
                              className="primary"
                              onClick={() =>
                                cmd.open(
                                  "Verify completion",
                                  "/completion-submissions/" +
                                    uid(c) +
                                    "/verify",
                                  {
                                    fields: [
                                      area(
                                        "confirmationNote",
                                        "Completion check",
                                      ),
                                    ],
                                    extra: { expectedVersion: c.version },
                                  },
                                )
                              }
                            >
                              Verify completion
                            </button>
                          </div>
                        )}
                      </article>
                    ))
                  }
                />
                {commissioner && active && d.workState === "VERIFIED" && (
                  <button
                    className="primary"
                    onClick={() =>
                      cmd.open(
                        "Settle collaboration",
                        "/collaborations/" + id + "/settlements",
                        { extra: { expectedVersion: d.version } },
                      )
                    }
                  >
                    {d.agreement.amountMinor
                      ? "Release agreed payment"
                      : "Complete product exchange"}
                  </button>
                )}
              </section>
            ) : tab === "payments" ? (
              <section className="panel">
                <Terms value={d.agreement} />
                <Badge>{d.fundingState}</Badge>
                <p className="muted">
                  Bank and UPI transfers are reconciled by the platform
                  operator.
                </p>
                {active && commissioner && d.fundingState === "AWAITING" && (
                  <button
                    className="primary"
                    onClick={() =>
                      cmd.open(
                        "Record funding reference",
                        "/collaborations/" + id + "/fundings",
                        {
                          fields: [
                            select("rail", "Transfer method", ["BANK", "UPI"]),
                            text(
                              "externalReference",
                              "Actual transfer reference",
                            ),
                            {
                              name: "proofAssetId",
                              label: "Payment proof (optional)",
                              type: "asset",
                              collaborationId: id,
                            },
                          ],
                          extra: { amountMinor: d.agreement.amountMinor },
                        },
                      )
                    }
                  >
                    Submit funding reference
                  </button>
                )}
                <Collection
                  path={"/collaborations/" + id + "/fundings"}
                  refreshKey={d.version}
                  columns={[
                    { key: "externalReference", label: "Reference" },
                    {
                      key: "amountMinor",
                      label: "Amount",
                      render: (r) => money(r.amountMinor),
                    },
                    {
                      key: "state",
                      label: "Status",
                      render: (r) => <Badge>{r.state}</Badge>,
                    },
                    { key: "reviewNote", label: "Operator note" },
                  ]}
                />
              </section>
            ) : tab === "reviews" ? (
              <section className="panel">
                <h2>Collaboration reviews</h2>
                <ReviewOpportunities workId={id} />
                <Collection
                  path={"/collaborations/" + id + "/reviews"}
                  refreshKey={d.version}
                  render={(rows) =>
                    rows.map((r) => (
                      <blockquote key={uid(r)}>
                        ★ {r.stars}/5<p>{r.text}</p>
                        <small>{label(r.reviewingParty)}</small>
                      </blockquote>
                    ))
                  }
                />
              </section>
            ) : (
              <Collection
                path={"/collaborations/" + id + "/activity"}
                columns={[
                  {
                    key: "action",
                    label: "Action",
                    render: (r) => label(r.action),
                  },
                  { key: "actorName", label: "By" },
                  {
                    key: "createdAt",
                    label: "When",
                    render: (r) => date(r.createdAt),
                  },
                ]}
              />
            )}{" "}
            {cmd.modal}
          </Page>
          </>
        );
      }}
    </State>
  );
}
function Submission({ d, reload }) {
  const [asset, setAsset] = useState(null),
    [mode, setMode] = useState("upload"),
    { run } = useApp();
  return (
    <div className="submission">
      <h3>
        {d.contentSequence ? "Submit a revised cut" : "Share your first cut"}
      </h3>
      <Tabs items={["upload", "video link"]} value={mode} onChange={setMode} />
      {mode === "upload" && (
        <Upload
          purpose="CONTENT"
          collaborationId={uid(d)}
          onUploaded={setAsset}
        />
      )}{" "}
      {asset && mode === "upload" && <p>Ready: {asset.originalName}</p>}
      <Form
        fields={[
          text("title", "Version title"),
          area("note", "Note for the reviewer", false),
          ...(mode === "video link"
            ? [
                field(
                  "externalUrl",
                  "YouTube, Vimeo or direct video URL",
                  "url",
                ),
              ]
            : []),
        ]}
        onSubmit={async (b) => {
          if (mode === "upload" && !asset)
            throw new Error("Upload a video first.");
          await run(() =>
            api("/collaborations/" + uid(d) + "/content-versions", {
              method: "POST",
              body: {
                ...b,
                expectedVersion: d.version,
                ...(mode === "upload" ? { assetId: uid(asset) } : {}),
              },
            }),
          );
          reload();
        }}
        submit="Submit for review"
      />
    </div>
  );
}
function Products({ d, reload }) {
  const id = uid(d),
    q = useQuery("/collaborations/" + id + "/product-package", [d.version]),
    cmd = useCommand(reload),
    commissioner = d.party === "COMMISSIONER",
    creator = d.party === "CREATOR",
    active =
      !d.openDisputeId &&
      !["COMPLETED", "REFUNDED", "REFUND_PENDING"].includes(d.workState);
  return (
    <>
      <State query={q} empty="No products in this agreement">
        {(pkg) => (
          <section className="panel">
            <h2>Product exchange</h2>
            {pkg.agreedItems.map((p, i) => (
              <p key={i}>
                {p.quantity} × {p.name} {p.variant} ·{" "}
                {money(p.retailValueMinor)} each
              </p>
            ))}
            <Badge>{d.productState}</Badge>
            {pkg.deliveryAddress && (
              <address>{Object.values(pkg.deliveryAddress).join(", ")}</address>
            )}
            {active &&
              creator &&
              ["ADDRESS_REQUIRED", "AWAITING_SHIPMENT"].includes(
                d.productState,
              ) && (
                <button
                  onClick={() =>
                    cmd.open(
                      "Delivery address",
                      "/collaborations/" + id + "/delivery-address",
                      {
                        method: "PUT",
                        fields: address,
                        initial: pkg.deliveryAddress || { country: "India" },
                      },
                    )
                  }
                >
                  Add / edit address
                </button>
              )}
            {active &&
              commissioner &&
              d.productState === "AWAITING_SHIPMENT" && (
                <button
                  className="primary"
                  onClick={() =>
                    cmd.open(
                      "Dispatch products",
                      "/collaborations/" + id + "/shipments",
                      { fields: shipment },
                    )
                  }
                >
                  Record shipment
                </button>
              )}
            <Collection
              path={"/collaborations/" + id + "/shipments"}
              refreshKey={d.version}
              render={(rows) =>
                rows.map((s) => (
                  <article className="list-row" key={uid(s)}>
                    <div>
                      <h3>
                        {s.courier} · {s.trackingNumber}
                      </h3>
                      <Badge>{s.state}</Badge>
                      <p>
                        Expected {date(s.expectedDeliveryAt)}
                        {s.replacementForShipmentId
                          ? " · Replacement shipment"
                          : ""}
                      </p>
                      {s.trackingUrl && (
                        <a
                          href={s.trackingUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Track parcel ↗
                        </a>
                      )}
                      {s.events.map((e, i) => (
                        <small className="block" key={i}>
                          {label(e.kind)} · {date(e.at)} {e.note}
                        </small>
                      ))}
                    </div>
                    <div className="actions">
                      {active && creator && (
                        <>
                          {!s.receivedAt && (
                            <button
                              onClick={() =>
                                cmd.open(
                                  "Confirm valid receipt",
                                  "/shipments/" + uid(s) + "/receipt",
                                  {
                                    fields: [
                                      area("note", "Receipt note", false),
                                    ],
                                    extra: { confirmation: true },
                                  },
                                )
                              }
                            >
                              Confirm receipt
                            </button>
                          )}
                          <button
                            onClick={() =>
                              cmd.open(
                                "Report product issue",
                                "/shipments/" + uid(s) + "/issues",
                                {
                                  fields: [
                                    select("type", "Issue", [
                                      "DAMAGED",
                                      "WRONG",
                                      "MISSING",
                                      "DELAYED",
                                    ]),
                                    area("description", "Details"),
                                    {
                                      name: "evidenceAssetIds",
                                      label: "Supporting files",
                                      type: "assets",
                                      collaborationId: id,
                                    },
                                  ],
                                },
                              )
                            }
                          >
                            Report issue
                          </button>
                        </>
                      )}
                      {active && commissioner && s.state !== "RECEIVED" && (
                        <button
                          onClick={() =>
                            cmd.open(
                              "Update tracking",
                              "/shipments/" + uid(s),
                              {
                                method: "PATCH",
                                fields: shipment,
                                initial: s,
                                extra: { expectedVersion: s.version },
                              },
                            )
                          }
                        >
                          Update tracking
                        </button>
                      )}
                    </div>
                  </article>
                ))
              }
            />
            <h3>Issue history</h3>
            <Collection
              path={"/collaborations/" + id + "/product-issues"}
              refreshKey={d.version}
              render={(rows) =>
                rows.map((i) => (
                  <article className="list-row" key={uid(i)}>
                    <div>
                      <h4>{label(i.type)}</h4>
                      <p>{i.description}</p>
                      <Badge>{i.state}</Badge>
                      <p>{i.resolutionNote}</p>
                    </div>
                    {active && commissioner && i.state !== "RESOLVED" && (
                      <div className="actions">
                        {i.state === "OPEN" && (
                          <button
                            onClick={() =>
                              cmd.open(
                                "Send replacement",
                                "/collaborations/" + id + "/shipments",
                                {
                                  fields: shipment,
                                  extra: {
                                    replacementForShipmentId: i.shipmentId,
                                    productIssueId: uid(i),
                                  },
                                },
                              )
                            }
                          >
                            Send replacement
                          </button>
                        )}
                        <button
                          onClick={() =>
                            cmd.open(
                              "Resolve after receipt",
                              "/product-issues/" + uid(i) + "/resolve",
                              {
                                fields: [
                                  text(
                                    "receivedShipmentId",
                                    "Received shipment ID",
                                  ),
                                  area("resolutionNote", "Resolution note"),
                                ],
                              },
                            )
                          }
                        >
                          Resolve issue
                        </button>
                      </div>
                    )}
                  </article>
                ))
              }
            />
          </section>
        )}
      </State>
      <section className="panel">
        <h2>Product questions</h2>
        {active && (creator || commissioner) && (
          <button
            onClick={() =>
              cmd.open(
                "Ask a product question",
                "/collaborations/" + id + "/product-questions",
                {
                  fields: [
                    select("category", "Category", [
                      "PRODUCT",
                      "DELIVERY",
                      "USAGE",
                      "OTHER",
                    ]),
                    area("question", "Question"),
                  ],
                },
              )
            }
          >
            Ask a question
          </button>
        )}
        <Collection
          path={"/collaborations/" + id + "/product-questions"}
          refreshKey={d.version}
          render={(rows) =>
            rows.map((q) => (
              <article className="question" key={uid(q)}>
                <h3>{q.question}</h3>
                {q.answers.map((a, i) => (
                  <p key={i}>
                    {a.text} <small>{date(a.at)}</small>
                  </p>
                ))}
                {commissioner && active && (
                  <button
                    onClick={() =>
                      cmd.open(
                        "Answer question",
                        "/product-questions/" + uid(q) + "/answers",
                        { fields: [area("text", "Answer")] },
                      )
                    }
                  >
                    Answer
                  </button>
                )}
              </article>
            ))
          }
        />
      </section>
      {cmd.modal}
    </>
  );
}
export function ReviewRoom({ id }) {
  const q = useQuery("/content-versions/" + id),
    c = useQuery(q.data ? "/collaborations/" + q.data.collaborationId : null),
    versions = useQuery(
      q.data
        ? "/collaborations/" + q.data.collaborationId + "/content-versions"
        : null,
    ),
    { role, run } = useApp(),
    cmd = useCommand(() => {
      q.reload();
      c.reload();
    }),
    [timestamp, setTimestamp] = useState(0),
    [compareId, setCompareId] = useState(""),
    prior = useQuery(compareId ? "/content-versions/" + compareId : null),
    video = useRef();
  return (
    <State query={q}>
      {(v) => (
        <Page
          eyebrow="Content review room"
          title={v.title}
          description={"Version " + v.sequence}
          actions={
            <>
              <SelectMenu label="Content version" value={id} onChange={value => go("/review/" + value)}
                options={(versions.data || []).map(cut => ({ value: uid(cut), label: "Version " + cut.sequence + " · " + cut.title }))}/>
              <Badge>{v.state}</Badge>
              <button
                onClick={() => go("/collaborations/" + v.collaborationId)}
              >
                Back to collaboration
              </button>
            </>
          }
        >
          <div className="review-journey">
            {[
              "Submit cut",
              "Feedback & revisions",
              ...(c.data?.agencyOrganizationId ? ["Client sign-off"] : []),
              "Final approval",
              "Publish or hand over",
            ].map((step, i) => (
              <span
                className={
                  (
                    v.state === "APPROVED"
                      ? step === "Publish or hand over"
                      : v.state === "CHANGES_REQUESTED"
                        ? step === "Submit cut"
                        : v.state === "SUPERSEDED"
                          ? false
                          : c.data?.agencyOrganizationId
                            ? step === (v.clientSignoff === "APPROVED" ? "Final approval" : "Client sign-off")
                            : step === "Feedback & revisions"
                  )
                    ? "active"
                    : ""
                }
                key={step}
              >
                <b>{i + 1}</b>
                {step}
              </span>
            ))}
          </div>
          <div className="review-status-banner">
            <RotateCcw size={23} />
            <div>
              <strong>
                {v.state === "CHANGES_REQUESTED"
                  ? "Changes requested — the next cut is yours"
                  : v.state === "APPROVED"
                    ? "Final cut approved — ready for completion"
                    : v.state === "SUPERSEDED" ? "An updated cut is available"
                      : v.clientSignoff === "PENDING" ? "Waiting for client sign-off"
                        : v.clientSignoff === "APPROVED" ? "Client signed off · ready for final approval"
                          : "Review this cut together"}
              </strong>
              <p>
                {c.data?.revisionCount || 0} of{" "}
                {c.data?.agreement?.includedRevisions || 0} included rounds
                used. Additional rounds need creator agreement.
                {c.data?.agencyOrganizationId
                  ? " Agency approval requires this exact cut’s client sign-off."
                  : ""}
              </p>
            </div>
          </div>
          <div className="review-grid">
            <section className="panel">
              {versions.data?.some(cut => uid(cut) !== id) && <div className="cut-comparison-picker">
                <span>Compare with another cut</span>
                <SelectMenu label="Compare with another cut" value={compareId} onChange={setCompareId}
                  options={[{ value: "", label: "Single video" }, ...versions.data.filter(cut => uid(cut) !== id)
                    .map(cut => ({ value: uid(cut), label: "Version " + cut.sequence + " · " + cut.title }))]}/>
              </div>}
              <div className={"cut-players" + (compareId ? " compare-cuts" : "")}>
                <div>
                  <h3>Version {v.sequence}</h3>
                  <Playback v={v} videoRef={video} onTimeUpdate={() => setTimestamp(Math.round((video.current?.currentTime || 0) * 1000))}/>
                </div>
                {compareId && <State query={prior}>{cut => <div>
                  <h3>Version {cut.sequence}</h3><Playback v={cut}/>
                </div>}</State>}
              </div>
              <p>{v.note}</p>
              {c.data?.party === "COMMISSIONER" &&
                !c.data.openDisputeId &&
                v.state === "SUBMITTED" && (
                  <div className="actions">
                    {c.data.agencyOrganizationId && !["PENDING", "APPROVED"].includes(v.clientSignoff) && (
                      <button
                        onClick={() =>
                          cmd.open(
                            "Share cut with client",
                            "/client-approvals",
                            {
                              fields: approvalFields(c.data.eligibleReviewers),
                              initial: { policy: "ANY_ASSIGNED" },
                              extra: {
                                targetType: "CONTENT_VERSION",
                                targetId: id,
                                targetVersion: v.sequence,
                              },
                            },
                          )
                        }
                      >
                        Request client review
                      </button>
                    )}
                    <button
                      onClick={() =>
                        cmd.open(
                          "Request changes to this cut",
                          "/content-versions/" + id + "/revision-requests",
                          {
                            fields: [
                              select("kind", "Revision round", [
                                "INCLUDED",
                                "ADDITIONAL",
                              ]),
                              { ...area("feedback", "Requested changes"), hint: "Enter one change per line. Add the timestamp when it applies." },
                            ],
                            extra: { expectedVersion: v.version },
                            after: (r) => {
                              if (r.kind === "INCLUDED")
                                run(
                                  () =>
                                    api(
                                      "/revision-requests/" +
                                        uid(r) +
                                        "/request-work",
                                      {
                                        method: "POST",
                                        body: { expectedVersion: r.version },
                                      },
                                    ),
                                  "Changes requested",
                                )
                                  .then(() => {
                                    q.reload();
                                    c.reload();
                                  })
                                  .catch(() => {});
                            },
                          },
                        )
                      }
                    >
                      Request changes
                    </button>
                    <button
                      className="primary"
                      disabled={Boolean(c.data.agencyOrganizationId && v.clientSignoff !== "APPROVED")}
                      onClick={() =>
                        cmd.open(
                          "Approve final cut",
                          "/content-versions/" + id + "/approve",
                          { extra: { expectedVersion: v.version } },
                        )
                      }
                    >
                      Approve final
                    </button>
                  </div>
                )}
              <h3>Revision history</h3>
              {v.revisionRequests.map((r) => (
                <article className="question" key={uid(r)}>
                  <Badge>{r.state}</Badge>
                  <p>
                    Round {r.roundNumber} · {r.kind}
                  </p>
                  <ul className="revision-items">{(r.feedback || "").split(/\r?\n/).filter(line => line.trim()).map((line, index) =>
                    <li key={index}>{line}</li>
                  )}</ul>
                  {c.data?.party === "CREATOR" && r.state === "PROPOSED" && (
                    <div className="actions">
                      {[true, false].map((a) => (
                        <button
                          key={String(a)}
                          onClick={() =>
                            cmd.open(
                              a
                                ? "Accept extra revision"
                                : "Decline extra revision",
                              "/revision-requests/" + uid(r) + "/decision",
                              {
                                fields: [area("note", "Note", false)],
                                extra: { accept: a },
                              },
                            )
                          }
                        >
                          {a ? "Accept" : "Decline"}
                        </button>
                      ))}
                    </div>
                  )}
                  {c.data?.party === "COMMISSIONER" &&
                    r.state === "ACCEPTED" && (
                      <button
                        onClick={() =>
                          cmd.open(
                            "Activate revision round",
                            "/revision-requests/" + uid(r) + "/request-work",
                            { extra: { expectedVersion: r.version } },
                          )
                        }
                      >
                        Request this round
                      </button>
                    )}
                </article>
              ))}
            </section>
            <section className="panel">
              <h2>Feedback</h2>
              {role !== "owner" && (
                <button
                  onClick={() =>
                    cmd.open(
                      "Add timestamped feedback",
                      "/content-versions/" + id + "/comments",
                      {
                        fields: [
                          area("text", "Comment"),
                          field(
                            "timestampMs",
                            "Video timestamp (seconds)",
                            "seconds",
                            false,
                          ),
                        ],
                        initial: { timestampMs: timestamp },
                      },
                    )
                  }
                >
                  Comment at {(timestamp / 1000).toFixed(1)}s
                </button>
              )}
              <Collection
                path={"/content-versions/" + id + "/comments"}
                refreshKey={q.data.version + q.data.revisionRequests.length}
                render={(rows) =>
                  rows.map((r) => (
                    <article className="comment" key={uid(r)}>
                      <strong>{r.authorName || "Collaborator"}</strong>
                      <button
                        className="text-button"
                        onClick={() => {
                          if (video.current)
                            video.current.currentTime =
                              (r.timestampMs || 0) / 1000;
                        }}
                      >
                        {((r.timestampMs || 0) / 1000).toFixed(1)}s
                      </button>
                      <p>{r.text}</p>
                      <small>{date(r.createdAt)}</small>
                    </article>
                  ))
                }
              />
            </section>
          </div>
          {cmd.modal}
        </Page>
      )}
    </State>
  );
}
export function Playback({ v, videoRef, onTimeUpdate }) {
  if (v.assetId)
    return (
      <video
        ref={videoRef}
        controls
        onTimeUpdate={onTimeUpdate}
        src={mediaURL(v.assetId)}
      />
    );
  const u = new URL(v.externalUrl);
  let embed;
  if (u.hostname.includes("youtu")) {
    const video =
      u.hostname === "youtu.be" ? u.pathname.slice(1) : u.searchParams.get("v");
    if (video && /^[\w-]{6,20}$/.test(video))
      embed = "https://www.youtube.com/embed/" + video;
  }
  if (u.hostname.includes("vimeo")) {
    const video = u.pathname.split("/").filter(Boolean).at(-1);
    if (/^\d+$/.test(video)) embed = "https://player.vimeo.com/video/" + video;
  }
  return embed ? (
    <iframe
      title="Submitted video"
      className="video-embed"
      src={embed}
      allowFullScreen
    />
  ) : /\.(mp4|webm)$/i.test(u.pathname) ? (
    <video
      ref={videoRef}
      controls
      onTimeUpdate={onTimeUpdate}
      src={v.externalUrl}
    />
  ) : (
    <a href={v.externalUrl} target="_blank" rel="noreferrer">
      Watch submitted video ↗
    </a>
  );
}
