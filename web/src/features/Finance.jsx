import { ArrowDownToLine, ArrowUpRight, Building2, CreditCard, Wallet } from "lucide-react";
import React, { useRef, useState } from "react";
import { api, uid, money, date, go, download } from "../api/http";
import { useApp, useQuery } from "../app/context";
import {
  Page,
  Collection,
  State,
  Stats,
  Tabs,
  Badge,
  Dialog,
  useCommand,
  amount,
  text,
  area,
  field,
  select,
} from "../components/ui";
import { AnalyticsPanels, KpiCards } from "../components/Charts";
export function Finance() {
  const { role, clientId, org, notify } = useApp(),
    q = useQuery(role === "owner" ? "/owner/revenue" : "/wallets/me"),
    [tab, setTab] = useState("ledger"),
    [chooseMethod, setChooseMethod] = useState(false),
    records = useRef(null),
    cmd = useCommand(q.reload);
  function showRecords(section) {
    setTab(section);
    records.current?.focus();
  }
  function withdraw(type) {
    setChooseMethod(false);
    const bank = type === "BANK";
    cmd.open(bank ? "Withdraw to bank" : "Withdraw to UPI", "/me/withdrawals", {
      fields: [
        { ...amount("amountMinor", "Amount (₹)"), hint: "Available balance " + money(q.data?.availableMinor) },
        {
          name: "destination", label: bank ? "Bank details" : "UPI details", type: "group",
          fields: bank ? [text("accountName", "Account holder"), text("accountNumber", "Account number"), text("ifsc", "IFSC")]
            : [text("upiId", "UPI ID")],
        },
      ],
      submit: "Request withdrawal",
      extra: {},
      onPayload: body => ({ ...body, destination: { ...body.destination, type } }),
    });
  }
  return (
    <Page
      title={role === "creator" ? "Your earnings" : "Financial overview"}
      description="Creator compensation, platform fees and agency charges stay separate."
      actions={role === "creator" && <button className="primary" onClick={() => setChooseMethod(true)}
        disabled={q.loading || !q.data?.availableMinor}><Wallet size={17}/> Withdraw funds</button>}
    >
      {chooseMethod && <Dialog title="Choose a withdrawal method" onClose={() => setChooseMethod(false)}>
        <div className="withdraw-methods">
          <button onClick={() => withdraw("UPI")}><CreditCard size={22}/><span><strong>UPI</strong><small>Enter your UPI ID</small></span><ArrowUpRight size={16}/></button>
          <button onClick={() => withdraw("BANK")}><Building2 size={22}/><span><strong>Bank account</strong><small>Enter account details and IFSC</small></span><ArrowUpRight size={16}/></button>
        </div>
      </Dialog>}
      <State query={q}>
        {(d) => (
          <>
            {role === "creator" ? <>
              <KpiCards items={[
                { label: "Available to withdraw", value: money(d.availableMinor), note: "Cleared earnings ready for payout", tone: 0 },
                { label: "Pending release", value: money(d.pendingMinor), note: "Funds tied to unfinished settlement", tone: 1 },
                { label: "Payouts in progress", value: money(d.reservedMinor), note: "Reserved against withdrawal requests", tone: 2 },
                { label: "Paid out", value: money(d.withdrawnMinor), note: "Completed withdrawals", tone: 3 },
              ]}/>
              <div className="finance-summary-links actions">
                <button onClick={() => showRecords("ledger")}>View earnings transactions</button>
                <button onClick={() => showRecords("withdrawals")}>Track withdrawals</button>
              </div>
            </> : <Stats items={role === "owner" ? [
              ["Platform revenue", money(d.platformRevenueMinor)],
              ["Held for work", money(d.heldMinor)],
              ["Refund obligations", money(d.refundObligationsMinor)],
              ["Transferred", money(d.payoutMinor)],
            ] : [["Held funds", money(d.heldMinor)], ["Available", money(d.availableMinor)]]}/>}
            {d.fundingInstructions && (
              <section className="panel">
                <h3>Verified funding instructions</h3>
                {Object.entries(d.fundingInstructions).map(
                  ([key, value]) =>
                    value && (
                      <p key={key}>
                        <strong>{key.replace(/([A-Z])/g, " $1")}: </strong>
                        {value}
                      </p>
                    ),
                )}
              </section>
            )}
          </>
        )}
      </State>
      <AnalyticsPanels earnings={role === "creator"} />
      <section ref={records} tabIndex={-1} className="finance-record-section" aria-label="Transaction activity">
      <Tabs name="Financial activity"
        items={[
          "ledger",
          ...(role === "creator" ? ["withdrawals"] : ["refunds"]),
          ...(role === "agency" ? ["agency charges"] : []),
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "ledger" ? (
        <>
          <div className="finance-record-actions">
            <button onClick={() => download("/ledger/export", "insight-ledger.csv").catch(error => notify(error.message))}>
              <ArrowDownToLine size={16}/> Export CSV
            </button>
          </div>
          <Collection
            title="Transaction ledger" path="/ledger"
            columns={[
              {
                key: "kind",
                label: "Transaction",
                render: (r) => r.kind.toLowerCase().replaceAll("_", " ").replace(/^./, value => value.toUpperCase()),
              },
              {
                key: "createdAt",
                label: "Date",
                render: (r) => date(r.createdAt),
              },
              {
                key: "total",
                label: "Journal amount",
                render: (r) =>
                  money(r.entries.reduce((n, e) => n + e.debitMinor, 0)),
              },
              {
                key: "feeMinor",
                label: "Agreed platform fee",
                render: (r) => (r.collaborationId ? money(r.feeMinor) : "—"),
              },
              {
                key: "creatorNetMinor",
                label: "Agreed creator net",
                render: (r) =>
                  r.collaborationId ? money(r.creatorNetMinor) : "—",
              },
              {
                key: "collaborationId",
                label: "Collaboration",
                render: (r) =>
                  r.collaborationId ? (
                    <a href={"#/collaborations/" + r.collaborationId}>
                      Open work ↗
                    </a>
                  ) : (
                    "Wallet transaction"
                  ),
              },
            ]}
          />
        </>
      ) : tab === "withdrawals" ? (
        <Collection
          title="Withdrawal history" path="/me/withdrawals"
          columns={[
            {
              key: "amountMinor",
              label: "Amount",
              render: (r) => money(r.amountMinor),
            },
            { key: "destinationMasked", label: "Destination" },
            {
              key: "state",
              label: "Status",
              render: (r) => <Badge>{r.state}</Badge>,
            },
            { key: "transferReference", label: "Transfer reference" },
            { key: "rejectionReason", label: "Operator note" },
          ]}
        />
      ) : tab === "refunds" ? (
        <Collection
          title="Refund tracking" path="/refunds"
          columns={[
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
            { key: "transferReference", label: "Actual refund reference" },
          ]}
          onOpen={(r) => go("/collaborations/" + r.collaborationId)}
        />
      ) : (
        <>
          <button
            className="primary"
            onClick={() =>
              cmd.open("Record separate agency charge", "/agency-charges", {
                fields: [
                  select("kind", "Charge type", [
                    "RETAINER",
                    "CAMPAIGN",
                    "DEAL",
                  ]),
                  amount("amountMinor", "Agreed amount (₹)"),
                  area("description", "Description"),
                  text("campaignId", "Campaign ID (campaign charge)", false),
                  text(
                    "collaborationId",
                    "Collaboration ID (deal charge)",
                    false,
                  ),
                ],
                extra: { clientId },
                after: q.reload,
              })
            }
          >
            Add agency charge
          </button>
          <Collection
            title="Agency service charges" path="/agency-charges"
            render={(rows) =>
              rows.map((c) => (
                <article className="list-row" key={uid(c)}>
                  <div>
                    <h3>{c.description}</h3>
                    <p>
                      {money(c.agreedAmountMinor)} · {c.kind}
                    </p>
                    <Badge>{c.state}</Badge>
                  </div>
                  {c.state === "AGREED" && (
                    <div className="actions">
                      <button
                        onClick={() =>
                          cmd.open(
                            "Record agency charge payment",
                            "/agency-charges/" + uid(c) + "/settle",
                            {
                              fields: [
                                text(
                                  "externalReference",
                                  "Actual payment reference",
                                ),
                                field("settledAt", "Paid at", "datetime"),
                              ],
                              extra: { expectedVersion: c.version },
                            },
                          )
                        }
                      >
                        Mark paid
                      </button>
                      <button
                        onClick={() =>
                          cmd.open(
                            "Waive charge",
                            "/agency-charges/" + uid(c) + "/waive",
                            {
                              fields: [area("reason", "Reason")],
                              extra: { expectedVersion: c.version },
                            },
                          )
                        }
                      >
                        Waive
                      </button>
                    </div>
                  )}
                </article>
              ))
            }
          />
        </>
      )}
      </section>
      {cmd.modal}
    </Page>
  );
}
