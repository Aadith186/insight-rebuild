import { Avatar } from "../components/Media";
import { Building2, CircleGauge, Mail, Plus, ShieldCheck, UserRound, Wallet } from "lucide-react";
import { RecordCard } from "../components/RecordCard";
import React, { useState } from "react";
import { api, uid, money, date, go, label } from "../api/http";
import { useApp, useQuery } from "../app/context";
import {
  Page,
  Collection,
  State,
  Form,
  Stats,
  Badge,
  useCommand,
  text,
  area,
  amount,
  field,
  select,
  Tabs,
} from "../components/ui";
import { organization, scopeFields } from "./forms";
import { Report } from "./Campaigns";
export function Clients({ id }) {
  const { org, setClientId, clientId, run } = useApp(),
    base = "/agencies/" + uid(org) + "/clients",
    q = useQuery(id ? base + "/" + id : null),
    cmd = useCommand(q.reload);
  if (!id)
    return (
      <Page
        title="Client brands"
        description="Separate workspaces, budgets and approvals for every client."
        actions={
          <button
            className="primary"
            onClick={() =>
              cmd.open("Add client brand", base, {
                fields: [
                  ...organization,
                  amount(
                    "budgetMinor",
                    "Creator compensation budget (₹; 0 = uncapped)",
                  ),
                  {
                    ...amount(
                      "retainerChargeMinor",
                      "Agreed agency retainer (₹)",
                      false,
                    ),
                    default: 0,
                  },
                ],
                extra: { contactUserIds: [] },
                after: (d) => go("/clients/" + uid(d)),
              })
            }
          >
            <Plus size={17}/> Add client
          </button>
        }
      >
        <Collection
          title="Client accounts"
          path={base}
          empty="No client brands yet"
          hint="Add a client to manage their briefs, budgets and approvals."
          card={r => <RecordCard title={r.brand?.name || "Client brand"} subtitle={r.brand?.city} assetId={r.brand?.logoAssetId}
            icon={Building2} status={r.status} href={"#/clients/" + uid(r)} action="Open client"
            facts={[
              { icon: Wallet, label: "Budget", value: r.budgetMinor ? money(r.budgetMinor) : "Uncapped" },
              { icon: CircleGauge, label: "Committed", value: money(r.committedMinor) },
            ]}>
            {r.budgetMinor > 0 && <div className="record-budget-meter">
              <label>Budget committed <strong>{Math.round((r.committedMinor || 0) / r.budgetMinor * 100)}%</strong>
                <progress value={Math.min(r.committedMinor || 0, r.budgetMinor)} max={r.budgetMinor}/>
              </label>
            </div>}
          </RecordCard>}
          columns={[
            { key: "name", label: "Client", render: (r) => r.brand?.name },
            {
              key: "budgetMinor",
              label: "Budget",
              render: (r) =>
                r.budgetMinor ? money(r.budgetMinor) : "Uncapped",
            },
            {
              key: "committedMinor",
              label: "Committed",
              render: (r) => money(r.committedMinor),
            },
            {
              key: "status",
              label: "Status",
              render: (r) => <Badge>{r.status}</Badge>,
            },
          ]}
          onOpen={(r) => go("/clients/" + uid(r))}
        />
        {cmd.modal}
      </Page>
    );
  return (
    <State query={q}>
      {(c) => (
        <Page
          title={c.brand.name}
          description="Client workspace"
          actions={
            <>
              <button
                className="primary"
                onClick={() => {
                  setClientId(c.brandOrganizationId);
                  go("/dashboard");
                }}
              >
                Work with this client
              </button>
              <button
                onClick={() =>
                  cmd.open("Edit client", base + "/" + id, {
                    method: "PATCH",
                    fields: [
                      ...organization,
                      amount("budgetMinor", "Creator compensation budget (₹)"),
                      amount(
                        "retainerChargeMinor",
                        "Agency retainer (₹)",
                        false,
                      ),
                    ],
                    initial: { ...c.brand, ...c },
                    extra: { expectedVersion: c.version },
                  })
                }
              >
                Edit client
              </button>
              {c.status === "ACTIVE" && (
                <button
                  onClick={() =>
                    cmd.open("Archive client", base + "/" + id + "/archive", {
                      fields: [area("reason", "Reason")],
                    })
                  }
                >
                  Archive
                </button>
              )}
            </>
          }
        >
          <div className="agreement-layout">
            <section className="agreement-panel">
              <header className="agreement-heading"><Avatar name={c.brand.name} assetId={c.brand.logoAssetId} size={40}/>
                <div><h2>Client profile</h2><p>{c.brand.city}</p></div><Badge>{c.status}</Badge>
              </header>
              {c.brand.description && <p className="preserve">{c.brand.description}</p>}
              <div className="client-contact">
                {c.brand.contactEmail && <a href={"mailto:" + c.brand.contactEmail}><Mail size={16}/> {c.brand.contactEmail}</a>}
                {c.brand.contactPhone && <a href={"tel:" + c.brand.contactPhone}>{c.brand.contactPhone}</a>}
              </div>
            </section>
            <section className="agreement-panel">
              <header className="agreement-heading"><span className="agreement-icon"><Wallet size={19}/></span><h2>Client budget</h2></header>
              <Stats items={[
                ["Creator budget", c.budgetMinor ? money(c.budgetMinor) : "Uncapped"],
                ["Committed", money(c.committedMinor)],
                ["Agreed retainer", money(c.retainerChargeMinor)],
              ]}/>
            </section>
          </div>
          <Report path={"/reports/clients/" + c.brandOrganizationId} />
          {cmd.modal}
        </Page>
      )}
    </State>
  );
}
export function Team() {
  const { org } = useApp(),
    [tab, setTab] = useState("members"),
    cmd = useCommand(),
    [inviteURL, setInviteURL] = useState(""),
    base = "/organizations/" + uid(org),
    clients = useQuery(
      org?.type === "AGENCY"
        ? "/agencies/" + uid(org) + "/clients?limit=100"
        : null,
    ),
    campaigns = useQuery("/campaigns?limit=100"),
    work = useQuery("/collaborations?limit=100"),
    grantFields = {
      name: "clientScopes",
      label: "Client and campaign access",
      type: "array",
      fields: [
        select(
          "clientBrandId",
          "Client brand",
          org?.type === "AGENCY"
            ? (clients.data || []).map((c) => ({
                value: c.brandOrganizationId,
                label: c.brand?.name,
              }))
            : org
              ? [{ value: uid(org), label: org.name }]
              : [],
        ),
        field(
          "allCampaigns",
          "All campaigns and direct work for this client",
          "checkbox",
          false,
        ),
        {
          name: "campaignIds",
          label: "Selected campaigns",
          type: "multiselect",
          options: (row) =>
            (campaigns.data || [])
              .filter((c) => c.brandOrganizationId === row.clientBrandId)
              .map((c) => ({
                value: uid(c),
                label: c.draft?.title || c.titleNormalized,
              })),
        },
        {
          name: "directCollaborationIds",
          label: "Selected direct collaborations",
          type: "multiselect",
          options: (row) =>
            (work.data || [])
              .filter(
                (c) =>
                  !c.campaignId && c.brandOrganizationId === row.clientBrandId,
              )
              .map((c) => ({
                value: uid(c),
                label: [c.creatorName || "Direct collaboration", c.formatLabel].filter(Boolean).join(" · "),
              })),
        },
      ],
    };
  return (
    <Page
      title="Team and access"
      description="Assign client and campaign grants to each person."
      actions={
        <button
          className="primary"
          onClick={() =>
            cmd.open("Invite a teammate", base + "/invitations", {
              fields: [
                field("email", "Email", "email"),
                select("role", "Role", [
                  "ORG_ADMIN",
                  "CAMPAIGN_MANAGER",
                  "CLIENT_REVIEWER",
                ]),
                grantFields,
              ],
              extra: {},
              after: (d) => setInviteURL(d.url),
            })
          }
        >
          Invite teammate
        </button>
      }
    >
      {inviteURL && (
        <section className="panel">
          <h3>Invitation link</h3>
          <p>
            Share this one-time link with the invited person. It expires after
            seven days.
          </p>
          <input readOnly value={inviteURL} aria-label="Invitation link" />
          <button onClick={() => navigator.clipboard.writeText(inviteURL)}>
            Copy link
          </button>
        </section>
      )}
      <Tabs items={["members", "invitations"]} value={tab} onChange={setTab} />
      <Collection
        path={base + "/" + tab}
        title={tab === "members" ? "Workspace members" : "Invitations"}
        empty={tab === "members" ? "No members to display" : "No invitations yet"}
        card={(m, reload) => <RecordCard
          title={m.userId?.name || m.emailNormalized || "Team member"}
          subtitle={m.userId?.email || (tab === "invitations" ? "Workspace invitation" : undefined)}
          icon={tab === "members" ? UserRound : Mail} status={m.status}
          facts={[{ icon: ShieldCheck, label: "Role", value: label(m.role) },
            { icon: Building2, label: "Client grants", value: m.role === "ORG_ADMIN" ? "Workspace-wide" : m.clientScopes?.length ?? 0 }]}
          secondary={<div className="actions">
                {tab === "members" ? (
                  <>
                    <button
                      onClick={() =>
                        cmd.open("Edit access", "/memberships/" + uid(m), {
                          method: "PATCH",
                          fields: [
                            select("role", "Role", [
                              "ORG_ADMIN",
                              "CAMPAIGN_MANAGER",
                              "CLIENT_REVIEWER",
                            ]),
                            grantFields,
                          ],
                          initial: m,
                          extra: { expectedVersion: m.version }, after: reload,
                        })
                      }
                    >
                      Edit access
                    </button>
                    <button
                      onClick={() =>
                        cmd.open(
                          "Revoke access",
                          "/memberships/" + uid(m) + "/revoke",
                          { fields: [area("reason", "Reason")], after: reload },
                        )
                      }
                    >
                      Revoke
                    </button>
                  </>
                ) : (
                  m.status === "PENDING" && (
                    <button
                      onClick={() =>
                        cmd.open(
                          "Revoke invitation",
                          "/invitations/" + uid(m) + "/revoke",
                          { fields: [area("reason", "Reason")], after: reload },
                        )
                      }
                    >
                      Revoke invitation
                    </button>
                  )
                )}
          </div>}>
          {m.clientScopes?.length > 0 && <ul className="scope-summary">
            {m.clientScopes.map(scope => {
              const client = (clients.data || []).find(row => row.brandOrganizationId === scope.clientBrandId);
              return <li key={scope.clientBrandId}><strong>{client?.brand?.name || "Client workspace"}</strong>
                <span>{scope.allCampaigns ? "All work" : `${scope.campaignIds?.length || 0} campaigns · ${scope.directCollaborationIds?.length || 0} direct collaborations`}</span>
              </li>;
            })}
          </ul>}
        </RecordCard>}
      />
      {cmd.modal}
    </Page>
  );
}
export function Invitation({ token }) {
  const q = useQuery("/invitations/" + token),
    { run, refresh } = useApp();
  return (
    <State query={q}>
      {(i) => (
        <Page
          title="You’re invited"
          description={`Join the ${i.organizationName} workspace.`}
        >
          <section className="panel">
            <Stats items={[["Invited email", i.email], ["Role", label(i.role)], ["Expires", date(i.expiresAt)]]} />
            <p>Sign in with this email and verify it before accepting.</p>
            <div className="actions">
              <button
                className="primary"
                onClick={() =>
                  run(
                    () =>
                      api("/invitations/" + token + "/accept", {
                        method: "POST",
                      }),
                    "Invitation accepted",
                  )
                    .then(refresh)
                    .then(() => go("/dashboard"))
                    .catch(() => {})
                }
              >
                Accept invitation
              </button>
              <button
                onClick={() =>
                  run(
                    () =>
                      api("/invitations/" + token + "/decline", {
                        method: "POST",
                      }),
                    "Invitation declined",
                  )
                    .then(() => go("/dashboard"))
                    .catch(() => {})
                }
              >
                Decline
              </button>
            </div>
          </section>
        </Page>
      )}
    </State>
  );
}
