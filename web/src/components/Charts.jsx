import React, { useId, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  ArrowUpRight,
  Wallet,
  TrendingUp,
  Layers,
  CheckCircle,
  Clock,
  ArrowDownLeft,
  CalendarDays,
} from "lucide-react";
import { money, label } from "../api/http";
import { useQuery } from "../app/context";
import { State, Dialog, Form, field } from "./ui";
const colors = [
  "#003b59",
  "#ffb118",
  "#20a698",
  "#7e8cf0",
  "#e88370",
  "#90b7c7",
  "#c9d5dc",
];
export function KpiCards({ items }) {
  const icons = [Wallet, TrendingUp, Layers, CheckCircle, Clock, ArrowDownLeft];
  return (
    <div className="kpi-grid">
      {items.map((item, i) => {
        const Icon = item.icon || icons[i % icons.length];
        return (
          <article
            className={
              "kpi-card tone-" +
              (item.tone || i % 6) +
              (String(item.value).length > 10 ? " long-value" : "")
            }
            key={item.label}
          >
            <div className="kpi-icon" aria-hidden="true">
              <Icon size={19} strokeWidth={2} />
            </div>
            <div className="kpi-content">
              <p>{item.label}</p>
              <strong>{item.value}</strong>
              <small>{item.note || "From your workspace records"}</small>
            </div>
            {item.href && (
              <a
                aria-label={"View " + item.label}
                href={item.href}
                className="kpi-link"
              >
                <ArrowUpRight size={17} />
              </a>
            )}
          </article>
        );
      })}
    </div>
  );
}
const short = (n) =>
  Math.abs(n) >= 10000000
    ? "₹" + (n / 10000000).toFixed(1) + "L"
    : Math.abs(n) >= 100000
      ? "₹" + (n / 100000).toFixed(0) + "k"
      : "₹" + (n / 100).toFixed(0);
const tip = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  fontSize: 12,
  color: "var(--text)",
};
export function MoneyChart({
  data,
  keys = [
    ["earnedMinor", "Creator net", "#003b59"],
    ["feeMinor", "Platform fee", "#ffb118"],
  ],
  kind = "area",
  height = 290,
}) {
  const id = useId().replaceAll(":", ""),
    empty = !data?.some((r) => keys.some(([key]) => r[key] > 0));
  return (
    <div className="chart-wrap">
      {empty && (
        <p className="chart-empty-note">
          No posted transactions in this period.
        </p>
      )}
      <div
        style={{ height, minWidth: 0, width: "100%" }}
        role="img"
        aria-label={keys.map((k) => k[1]).join(" compared with ") + " by month"}
      >
        <ResponsiveContainer width="100%" height="100%">
          {kind === "bar" ? (
            <BarChart
              data={data}
              margin={{ top: 20, right: 10, left: 0, bottom: 5 }}
              accessibilityLayer
            >
              <CartesianGrid
                stroke="var(--border)"
                vertical={false}
                strokeDasharray="3 5"
              />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: "var(--muted)" }}
              />
              <YAxis
                tickFormatter={short}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: "var(--muted)" }}
                width={55}
              />
              <Tooltip
                contentStyle={tip}
                formatter={(v, n) => [money(v), n]}
                cursor={{ fill: "var(--soft)" }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {keys.map(([key, name, color]) => (
                <Bar
                  key={key}
                  dataKey={key}
                  name={name}
                  fill={color}
                  radius={[5, 5, 0, 0]}
                  maxBarSize={24}
                />
              ))}
            </BarChart>
          ) : (
            <AreaChart
              data={data}
              margin={{ top: 20, right: 10, left: 0, bottom: 5 }}
              accessibilityLayer
            >
              <defs>
                {keys.map(([key, , color]) => (
                  <linearGradient
                    key={key}
                    id={id + key}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor={color} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={color} stopOpacity={0.01} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid
                stroke="var(--border)"
                vertical={false}
                strokeDasharray="3 5"
              />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: "var(--muted)" }}
              />
              <YAxis
                tickFormatter={short}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: "var(--muted)" }}
                width={55}
              />
              <Tooltip contentStyle={tip} formatter={(v, n) => [money(v), n]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {keys.map(([key, name, color]) => (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  name={name}
                  stroke={color}
                  strokeWidth={3}
                  fill={"url(#" + id + key + ")"}
                  dot={false}
                  activeDot={{ r: 5 }}
                />
              ))}
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
export function Distribution({ data, title = "Work status", center }) {
  const nonzero = data?.filter((d) => d.value > 0) || [],
    total = nonzero.reduce((n, d) => n + d.value, 0);
  return (
    <div className="donut-layout">
      <div
        className="donut-chart"
        role="img"
        aria-label={
          title +
          ": " +
          nonzero.map((d) => label(d.name) + " " + d.value).join(", ")
        }
      >
        <ResponsiveContainer width="100%" height={230}>
          <PieChart>
            <Pie
              data={
                nonzero.length ? nonzero : [{ name: "No work yet", value: 1 }]
              }
              dataKey="value"
              nameKey="name"
              innerRadius={70}
              outerRadius={91}
              paddingAngle={nonzero.length > 1 ? 4 : 0}
              stroke="none"
            >
              {(nonzero.length ? nonzero : [{}]).map((d, i) => (
                <Cell
                  key={d.name || i}
                  fill={
                    nonzero.length ? colors[i % colors.length] : "var(--border)"
                  }
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={tip}
              formatter={(v, n) => [nonzero.length ? v : 0, label(n)]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="donut-center">
          <strong>{center ?? total}</strong>
          <span>collaborations</span>
        </div>
      </div>
      <div className="chart-legend">
        {nonzero.length ? (
          nonzero.map((d, i) => (
            <div key={d.name}>
              <i style={{ background: colors[i % colors.length] }} />
              <span>{label(d.name)}</span>
              <strong>{d.value}</strong>
            </div>
          ))
        ) : (
          <p className="muted">Your work breakdown will appear here.</p>
        )}
      </div>
    </div>
  );
}
export function BudgetChart({ data }) {
  return (
    <div
      style={{ height: 280, width: "100%", minWidth: 0 }}
      role="img"
      aria-label="Campaign budget compared with committed creator compensation"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ left: 10, right: 15, top: 15, bottom: 5 }}
          accessibilityLayer
        >
          <CartesianGrid
            stroke="var(--border)"
            horizontal={false}
            strokeDasharray="3 5"
          />
          <XAxis
            type="number"
            tickFormatter={short}
            tick={{ fontSize: 10, fill: "var(--muted)" }}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={110}
            tick={{ fontSize: 10, fill: "var(--muted)" }}
            tickFormatter={(s) => (s.length > 19 ? s.slice(0, 18) + "…" : s)}
          />
          <Tooltip contentStyle={tip} formatter={(v, n) => [money(v), n]} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar
            name="Compensation budget"
            dataKey="budgetMinor"
            fill="#d9e6ed"
            radius={[0, 4, 4, 0]}
          />
          <Bar
            name="Committed"
            dataKey="committedMinor"
            fill="#003b59"
            radius={[0, 4, 4, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
export function PeriodControl({ value, onChange }) {
  const [custom, setCustom] = useState(false);
  return (
    <div className="period-control">
      <div className="segmented">
        {[3, 6, 12].map((n) => (
          <button
            key={n}
            className={value.months === n ? "selected" : ""}
            onClick={() => onChange({ months: n })}
          >
            {n}M
          </button>
        ))}
      </div>
      <button className="period-custom" onClick={() => setCustom(true)}>
        <CalendarDays size={15} />
        Custom dates
      </button>
      {custom && (
        <Dialog title="Reporting period" onClose={() => setCustom(false)}>
          <Form
            fields={[field("from", "From", "date"), field("to", "To", "date")]}
            initial={value}
            onSubmit={(b) => {
              if (new Date(b.from) > new Date(b.to))
                throw new Error("Choose a start date before the end date.");
              onChange(b);
              setCustom(false);
            }}
          />
        </Dialog>
      )}
    </div>
  );
}
export function rangeQuery(range) {
  if (range.from) return "from=" + range.from + "&to=" + range.to;
  const now = new Date(),
    d = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth() - (range.months || 6) + 1,
        1,
      ),
    );
  return "from=" + d.toISOString().slice(0, 10);
}
export function AnalyticsPanels({
  scope = "overview",
  earnings = false,
  initialMonths = 6,
}) {
  const [range, setRange] = useState({ months: initialMonths }),
    q = useQuery("/analytics/overview?" + rangeQuery(range));
  return (
    <section className="analytics-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">The bigger picture</p>
          <h2>
            {earnings ? "Earnings & payout insights" : "Performance overview"}
          </h2>
          <p className="muted">
            Based on your recorded work and posted ledger entries.
          </p>
        </div>
        <PeriodControl value={range} onChange={setRange} />
      </div>
      <State query={q}>
        {(d) => (
          <>
            {d.financialAccess && (
              <KpiCards
                items={[
                  {
                    label: earnings
                      ? "Net earned in period"
                      : "Creator net released",
                    value: money(d.totals.earnedMinor),
                    note: "Settled releases in selected period",
                    tone: 0,
                  },
                  {
                    label: "Platform fees",
                    value: money(d.totals.feeMinor),
                    note: "Included in agreement gross",
                    tone: 1,
                  },
                  {
                    label: earnings ? "Available now" : "Current held funds",
                    value: money(
                      earnings ? d.totals.availableMinor : d.totals.heldMinor,
                    ),
                    note: "Current balance · independent of period",
                    tone: 2,
                  },
                  {
                    label: earnings
                      ? "Withdrawn in period"
                      : "Refunds transferred",
                    value: money(
                      earnings
                        ? d.totals.withdrawnMinor
                        : d.totals.refundedMinor,
                    ),
                    note: "Posted external transfer records",
                    tone: 3,
                  },
                ]}
              />
            )}
            <div className="analytics-grid">
              {d.financialAccess && (
                <article className="panel chart-panel">
                  <div className="section-heading">
                    <div>
                      <h3>
                        {earnings
                          ? "Net earnings vs withdrawals"
                          : "Funding & releases"}
                      </h3>
                      <p className="muted">{d.range.timezone} · monthly</p>
                    </div>
                    <span className="chart-tag">INR</span>
                  </div>
                  <MoneyChart
                    data={d.series}
                    kind={earnings ? "area" : "bar"}
                    keys={
                      earnings
                        ? [
                            ["earnedMinor", "Net earned", "#003b59"],
                            ["withdrawnMinor", "Withdrawn", "#ffb118"],
                          ]
                        : [
                            ["fundedMinor", "Funding verified", "#003b59"],
                            ["earnedMinor", "Creator net released", "#ffb118"],
                          ]
                    }
                  />
                </article>
              )}
              <article className="panel chart-panel">
                <h3>Collaboration outcomes</h3>
                <p className="muted">All authorized work · current status</p>
                <Distribution data={d.states} />
                <div className="chart-foot">
                  <span>Completion rate</span>
                  <strong>{d.work.completionRate}%</strong>
                  <div className="progress-track">
                    <i style={{ width: d.work.completionRate + "%" }} />
                  </div>
                </div>
              </article>
            </div>
            <div className="analytics-grid">
              {d.financialAccess && (
                <article className="panel chart-panel">
                  <h3>
                    {earnings
                      ? "Earnings and platform fees"
                      : "Cash releases & refunds"}
                  </h3>
                  <p className="muted">
                    Actual journal activity, separate from commitments
                  </p>
                  <MoneyChart
                    data={d.series}
                    kind="bar"
                    keys={
                      earnings
                        ? [
                            ["earnedMinor", "Creator net", "#003b59"],
                            ["feeMinor", "Platform fee", "#ffb118"],
                          ]
                        : [
                            ["earnedMinor", "Creator releases", "#003b59"],
                            ["refundedMinor", "Refunds paid", "#df8272"],
                          ]
                    }
                  />
                </article>
              )}
              <article className="panel chart-panel">
                <h3>Collaboration mix</h3>
                <p className="muted">Formats in your accepted agreements</p>
                <Distribution data={d.formats} />
              </article>
            </div>
            {d.campaigns?.length > 0 && (
              <article className="panel chart-panel">
                <h3>Campaign budgets & commitments</h3>
                <p className="muted">
                  Creator compensation only; agency charges remain separate.
                </p>
                <BudgetChart data={d.campaigns} />
              </article>
            )}
          </>
        )}
      </State>
    </section>
  );
}
