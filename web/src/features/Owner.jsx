import { RecordCard } from "../components/RecordCard";
import { Campaigns } from "./Campaigns";
import { MemberRecord } from "./MemberReview";
import { PlatformSettings } from "./Settings";
import { AdminOverview } from "../components/AdminOverview";
import { Avatar, CampaignImage } from "../components/Media";
import {
  Search,
  CalendarDays,
  Settings2,
  FileText,
  ArrowUpRight,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import { mediaURL } from "../api/http";
import React, { useState, useDeferredValue } from "react";
import { api, uid, money, date, go, label } from "../api/http";
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
  field,
  select,
} from "../components/ui";
import { AnalyticsPanels } from "../components/Charts";
const formatFields = [
  text("key", "Stable format key"),
  text("label", "Display name"),
  select("compensationPolicy", "Compensation rule", [
    "REQUIRED",
    "ZERO",
    "OPTIONAL",
  ]),
  select("productPolicy", "Product rule", ["REQUIRED", "OPTIONAL", "NONE"]),
  select("completionMode", "Completion method", [
    "PUBLISH",
    "HANDOVER",
    "EITHER",
  ]),
];
export function Owner({ section = "dashboard" }) {
  const cmd = useCommand(),
    [type, setType] = useState("BRAND"),
    [memberSearch, setMemberSearch] = useState(""),
    deferredSearch = useDeferredValue(memberSearch),
    q = useQuery(
      section === "dashboard" ? "/owner/dashboard" : null,
    );
  if (section === "dashboard")
    return (
      <State query={q}>
        {(d) => (
          <Page
            title="Platform overview"
            description="Marketplace activity, review queues and financial oversight."
          >
            <AdminOverview data={d} />
            <AnalyticsPanels />
          </Page>
        )}
      </State>
    );
  if (section === "settings") return <PlatformSettings />;
  if (section === "members")
    return (
      <Page
        title="Member directory"
        description="Find people and workspaces, then inspect their accounts."
        actions={<a className="button" href="#/owner/member-reviews">Verification queue <ArrowUpRight size={16}/></a>}
      >
        <div className="directory-header">
          <div className="directory-tabs" role="group" aria-label="Member type">
            {["BRAND", "CREATOR", "AGENCY", "USER"].map((t) => (
              <button
                key={t}
                aria-pressed={type === t}
                className={type === t ? "active" : ""}
                onClick={() => setType(t)}
              >
                {t === "USER"
                  ? "All users"
                  : t === "AGENCY"
                    ? "Agencies"
                    : t === "BRAND"
                      ? "Brands"
                      : "Creators"}
              </button>
            ))}
          </div>
          <label className="listing-search directory-search">
            <Search size={17} />
            <input
              aria-label="Search member directory"
              placeholder="Search all accounts…"
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
            />
          </label>
        </div>
        <Collection
          title="Member accounts"
          path={
            "/owner/members?type=" +
            type +
            "&search=" +
            encodeURIComponent(deferredSearch)
          }
          render={(rows) =>
            rows.map((m) => (
              <article className="list-row member-record" key={uid(m)}>
                <Avatar
                  assetId={m.avatarAssetId || m.logoAssetId}
                  name={m.name}
                  size={48}
                />
                <div className="member-record-info">
                  <h3>{m.name || m.city || "Creator profile"}</h3>
                  <p>
                    {m.email ||
                      m.contactEmail ||
                      m.city ||
                      "Contact details not added"}
                  </p>
                  <small>
                    Joined {date(m.createdAt)} · #{uid(m).slice(-6)}
                  </small>
                </div>
                <div className="member-status">
                  <Badge>
                    {m.suspendedAt
                      ? "SUSPENDED"
                      : m.status || m.verificationStatus}
                  </Badge>
                  <small>
                    {type === "CREATOR"
                      ? "Creator profile"
                      : type === "USER"
                        ? "User account"
                        : type === "AGENCY"
                          ? "Agency workspace"
                          : "Brand workspace"}
                  </small>
                </div>
                <div className="actions">
                  <button
                    onClick={() =>
                      go(
                        "/owner/members/" +
                          uid(m) +
                          "?memberType=" +
                          (type === "USER"
                            ? "USER"
                            : type === "CREATOR"
                              ? "CREATOR"
                              : "ORGANIZATION"),
                      )
                    }
                  >
                    Inspect account
                  </button>

                </div>
              </article>
            ))
          }
        />
        {cmd.modal}
      </Page>
    );
  if (section === "campaign-reviews") return <Campaigns moderation/>;
  if (section === "collaboration-formats")
    return (
      <Page
        title="Collaboration formats"
        description="Rules are snapshotted into each agreement."
        actions={
          <button
            className="primary"
            onClick={() =>
              cmd.open("Create format", "/owner/collaboration-formats", {
                fields: formatFields,
              })
            }
          >
            Add format
          </button>
        }
      >
        <Collection
          title="Collaboration formats"
          tools
          path="/owner/collaboration-formats"
          filterStatus={false}
          empty="No collaboration formats yet"
          card={(f, reload) => <RecordCard title={f.label} icon={Settings2} status={f.active ? "ACTIVE" : "INACTIVE"}
            facts={[
              { icon: Wallet, label: "Compensation", value: label(f.compensationPolicy) },
              { icon: FileText, label: "Products", value: label(f.productPolicy) },
            ]}
            secondary={<div className="actions">
                  <button
                    onClick={() =>
                      cmd.open(
                        "Edit format",
                        "/owner/collaboration-formats/" + uid(f),
                        {
                          method: "PATCH",
                          fields: formatFields.filter((v) => v.name !== "key"),
                          initial: f,
                          extra: { expectedVersion: f.recordVersion }, after: reload,
                        },
                      )
                    }
                  >
                    Edit
                  </button>
                  {f.active && (
                    <button
                      onClick={() =>
                        cmd.open(
                          "Deactivate format",
                          "/owner/collaboration-formats/" +
                            uid(f) +
                            "/deactivate",
                          {
                            fields: [area("reason", "Reason")],
                            extra: { expectedVersion: f.recordVersion }, after: reload,
                          },
                        )
                      }
                    >
                      Deactivate
                    </button>
                  )}
            </div>}>
            <p className="muted">Completion · {label(f.completionMode)}</p>
          </RecordCard>}
        />
        {cmd.modal}
      </Page>
    );
  if (section === "audit-logs")
    return (
      <Page title="Activity history">
        <Collection
          title="Audit trail"
          path="/owner/audit-logs"
          columns={[
            { key: "action", label: "Action", render: row => label(row.action) },
            { key: "actorName", label: "Person" },
            { key: "resourceType", label: "Record", render: row => label(row.resourceType) },
            {
              key: "createdAt",
              label: "When",
              render: (r) => date(r.createdAt),
            },
          ]}
        />
      </Page>
    );
  if (section === "disputes") return <Disputes />;
  const payout = section === "withdrawals",
    refund = section === "refunds";
  return (
    <Page
      title={
        payout
          ? "Withdrawal processing"
          : refund
            ? "Refund transfers"
            : "Funding reconciliation"
      }
      description="Check the real external transfer before recording completion."
    >
      <Collection
        tools
        title={
          payout
            ? "Payout requests"
            : refund
              ? "Refund transfers"
              : "Funding records"
        }
        path={"/owner/" + section}
        empty={payout ? "No withdrawal requests" : refund ? "No refund transfers" : "No funding records"}
        card={(d, reload) => <RecordCard title={money(d.amountMinor)} icon={Wallet} status={d.state}
          subtitle={d.externalReference || d.destinationMasked || d.transferReference}
          href={payout ? "#/withdrawals/" + uid(d) : d.collaborationId ? "#/collaborations/" + d.collaborationId : undefined}
          action={payout ? "View payout destination" : "Open collaboration"}
          facts={[{ icon: CalendarDays, label: "Created", value: date(d.createdAt) },
            { icon: FileText, label: "Record", value: payout ? "Withdrawal" : refund ? "Refund" : "Funding" }]}
          secondary={<div className="actions">
                {!payout && !refund && d.state === "SUBMITTED" ? (
                  <>
                    <button
                      onClick={() =>
                        cmd.open(
                          "Verify actual incoming funds",
                          "/owner/fundings/" + uid(d) + "/verify",
                          {
                            fields: [
                              text(
                                "verificationReference",
                                "Reconciliation reference",
                              ),
                              area("note", "Verification note", false),
                            ],
                            extra: { expectedVersion: d.version }, after: reload,
                          },
                        )
                      }
                    >
                      Verify funding
                    </button>
                    <button
                      onClick={() =>
                        cmd.open(
                          "Reject reference",
                          "/owner/fundings/" + uid(d) + "/reject",
                          {
                            fields: [area("reason", "Reason")],
                            extra: { expectedVersion: d.version }, after: reload,
                          },
                        )
                      }
                    >
                      Return for correction
                    </button>
                  </>
                ) : (
                  <>
                    {["REQUESTED", "PENDING"].includes(d.state) && (
                      <button
                        onClick={() =>
                          cmd.open(
                            "Start transfer processing",
                            "/owner/" + section + "/" + uid(d) + "/process",
                            { extra: { expectedVersion: d.version }, after: reload },
                          )
                        }
                      >
                        Start processing
                      </button>
                    )}
                    {d.state === "PROCESSING" && (
                      <button
                        className="primary"
                        onClick={() =>
                          cmd.open(
                            "Record actual transfer",
                            "/owner/" + section + "/" + uid(d) + "/complete",
                            {
                              fields: [
                                text(
                                  "actualTransferReference",
                                  "Actual bank / UPI reference",
                                ),
                                field("paidAt", "Transferred at", "datetime"),
                              ],
                              extra: { expectedVersion: d.version }, after: reload,
                            },
                          )
                        }
                      >
                        Record transfer
                      </button>
                    )}
                    {payout &&
                      ["REQUESTED", "PROCESSING"].includes(d.state) && (
                        <button
                          onClick={() =>
                            cmd.open(
                              "Reject withdrawal",
                              "/owner/withdrawals/" + uid(d) + "/reject",
                              {
                                fields: [area("reason", "Reason")],
                                extra: { expectedVersion: d.version }, after: reload,
                              },
                            )
                          }
                        >
                          Reject withdrawal
                        </button>
                      )}
                  </>
                )}
          </div>}>
          {d.proofAssetId && <a className="record-evidence" href={mediaURL(d.proofAssetId)} target="_blank" rel="noreferrer">
            <FileText size={15}/> View funding proof <ArrowUpRight size={14}/>
          </a>}
        </RecordCard>}
      />
      {cmd.modal}
    </Page>
  );
}
export function WithdrawalDetail({ id }) {
  const q = useQuery("/withdrawals/" + id);
  return (
    <State query={q}>
      {(d) => (
        <Page title="Payout destination">
          <section className="agreement-panel payout-details">
            <header className="agreement-heading"><span className="agreement-icon"><Wallet size={19}/></span>
              <div><h2>{money(d.amountMinor)}</h2><p>Requested {date(d.createdAt)}</p></div><Badge>{d.state}</Badge>
            </header>
            <dl className="member-facts">
              {Object.entries(d.destination || {}).map(([key, value]) => <div key={key}>
                <dt>{({ upiId: "UPI ID", ifsc: "IFSC", accountHolder: "Account holder" })[key] || label(key.replace(/([A-Z])/g, " $1"))}</dt>
                <dd>{key === "type" && value === "BANK" ? "Bank account" : value}</dd>
              </div>)}
              {d.transferReference && <div><dt>Transfer reference</dt><dd>{d.transferReference}</dd></div>}
            </dl>
          </section>
        </Page>
      )}
    </State>
  );
}
export function Disputes({ id }) {
  const q = useQuery(id ? "/disputes/" + id : null),
    { role } = useApp(),
    cmd = useCommand(q.reload);
  if (!id)
    return (
      <Page
        title="Disputes"
        description="Agreement, delivery history and evidence stay together."
      >
        <Collection
          title="Resolution centre"
          path="/disputes"
          empty="No disputes in this workspace"
          card={row => <RecordCard title={row.reason || "Dispute"} icon={ShieldCheck} status={row.state}
            href={"#/disputes/" + uid(row)} action="View case" facts={[
              { icon: CalendarDays, label: "Opened", value: date(row.createdAt) },
              { icon: FileText, label: "Supporting items", value: row.evidence?.length ?? "—" },
            ]}/>}
          columns={[
            { key: "reason", label: "Reported problem" },
            {
              key: "state",
              label: "Status",
              render: (r) => <Badge>{r.state}</Badge>,
            },
            {
              key: "createdAt",
              label: "Opened",
              render: (r) => date(r.createdAt),
            },
          ]}
          onOpen={(r) => go("/disputes/" + uid(r))}
        />
      </Page>
    );
  return (
    <State query={q}>
      {(d) => (
        <Page
          title={d.reason}
          actions={
            <>
              <Badge>{d.state}</Badge>
              <button
                onClick={() => go("/collaborations/" + d.collaborationId)}
              >
                Inspect collaboration
              </button>
              {role === "owner" && d.state === "OPEN" && (
                <button
                  className="primary"
                  onClick={() =>
                    cmd.open(
                      "Resolve case",
                      "/owner/disputes/" + id + "/resolve",
                      {
                        fields: [
                          select("decision", "Decision", ["RELEASE", "REFUND"]),
                          area("reason", "Decision and supporting reasons"),
                        ],
                        extra: { expectedVersion: d.version },
                      },
                    )
                  }
                >
                  Resolve dispute
                </button>
              )}
            </>
          }
        >
          <section className="panel">
            <p>{d.description}</p>
            <h3>Evidence</h3>
            {d.evidence.map((e, i) => (
              <p key={i}>
                {e.type === "ASSET" ? (
                  <a
                    href={mediaURL(e.resourceId)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View attached evidence ↗
                  </a>
                ) : e.type === "VERSION" ? (
                  <a href={"#/review/" + e.resourceId}>
                    Open content evidence ↗
                  </a>
                ) : (
                  <span>
                    {e.type} · {e.resourceId}
                  </span>
                )}{" "}
                {e.note}
              </p>
            ))}
            {d.state === "OPEN" && role !== "owner" && (
              <button
                onClick={() =>
                  cmd.open("Add evidence", "/disputes/" + id + "/evidence", {
                    fields: [
                      {
                        name: "evidenceRefs",
                        label: "Evidence references",
                        type: "array",
                        fields: [
                          select("type", "Evidence type", [
                            "ASSET",
                            "MESSAGE",
                            "VERSION",
                            "SHIPMENT",
                          ]),
                          text("resourceId", "Record ID"),
                          area("note", "Note", false),
                        ],
                      },
                    ],
                  })
                }
              >
                Add evidence
              </button>
            )}
            <p>{d.decisionReason}</p>
          </section>
          {cmd.modal}
        </Page>
      )}
    </State>
  );
}

export function OwnerMember({ id, type }) {
  return <MemberRecord id={id} type={type}/>;
}
