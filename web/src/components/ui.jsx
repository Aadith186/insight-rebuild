import { createPortal } from "react-dom";
import { SelectMenu } from "./SelectMenu";
import { presentRows } from "./listing";
import { mediaURL } from "../api/http";
import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import {
  X,
  AlertCircle,
  Clapperboard,
  ShieldCheck,
  Wallet,
  Package,
  CalendarDays,
  Eye,
  EyeOff,
  Inbox,
  Loader2,
  ArrowUpRight,
  Plus,
  Search,
  SlidersHorizontal,
  RotateCw,
  List,
  LayoutGrid,
  ArrowUpDown,
} from "lucide-react";
import { api, uploadMedia, uid, label, money, date, go } from "../api/http";
import { useQuery, useApp } from "../app/context";
export const field = (
  name,
  title,
  type = "text",
  required = true,
  options,
) => ({ name, label: title, type, required, options });
export const text = (n, l, r = true) => field(n, l, "text", r),
  area = (n, l, r = true) => field(n, l, "textarea", r),
  amount = (n, l, r = true) => field(n, l, "money", r),
  select = (n, l, o, r = true) => field(n, l, "select", r, o);
export const Badge = ({ children }) => (
  <span className={"badge " + String(children || "").toLowerCase()}>
    {label(children)}
  </span>
);
export function Page({
  title,
  description,
  actions,
  children,
  eyebrow,
}) {
  return (
    <>
      <header className="page-heading">
        <div>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h1>{title}</h1>
          {description && <p className="muted">{description}</p>}
        </div>
        <div className="actions">{actions}</div>
      </header>
      {children}
    </>
  );
}
export function State({ query, children, empty = "Nothing here yet", hint, emptyAction }) {
  if (query.loading) return (
    <div className="state insight-state" role="status">
      <span className="state-icon"><Loader2 className="spin" aria-hidden="true"/></span>
      <p>Loading…</p>
    </div>
  );
  if (query.error) return (
    <div className="state insight-state error" role="alert">
      <span className="state-icon"><AlertCircle aria-hidden="true"/></span>
      <h3>{query.error.status === 404 ? "Record unavailable" : "Could not load this view"}</h3>
      <p>{query.error.message}</p>
      {query.reload && <button onClick={query.reload}><RotateCw size={15}/> Try again</button>}
    </div>
  );
  if (query.data === null || (Array.isArray(query.data) && !query.data.length)) return (
    <div className="state insight-state">
      <span className="state-icon"><Inbox aria-hidden="true"/></span>
      <h3>{empty}</h3>
      {hint && <p>{hint}</p>}
      {emptyAction}
    </div>
  );
  return typeof children === "function" ? children(query.data) : children;
}
export function Stats({ items }) {
  return <dl className="record-facts">
    {items.map(([title, value, hint]) => <div key={title}>
      <dt>{title}</dt><dd>{value ?? "—"}</dd>
      {hint && <small>{hint}</small>}
    </div>)}
  </dl>;
}
export function Tabs({ items, value, onChange, name = "View" }) {
  return (
    <div className="tabs" role="tablist" aria-label={name} onKeyDown={event => {
      const index = items.indexOf(value);
      const keys = { ArrowLeft: (index + items.length - 1) % items.length,
        ArrowRight: (index + 1) % items.length, Home: 0, End: items.length - 1 };
      if (!(event.key in keys) || !items.length) return;
      event.preventDefault();
      const next = keys[event.key];
      event.currentTarget.children[next]?.focus();
      onChange(items[next]);
    }}>
      {items.map(item => <button key={item} role="tab" type="button"
        tabIndex={item === value ? 0 : -1} aria-selected={item === value}
        className={item === value ? "active" : ""}
        onClick={event => { onChange(item); event.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest" }); }}>
        {label(item)}
      </button>)}
    </div>
  );
}
export function Table({ rows, columns, onOpen }) {
  return (
    <div className="table-wrap insight-records">
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th scope="col" key={c.key}>{c.label}</th>
            ))}
            {onOpen && <th scope="col"><span className="sr-only">Actions</span></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={uid(r)}>
              {columns.map((c) => (
                <td key={c.key} data-label={c.label}>
                  {c.render ? c.render(r) : String(r[c.key] ?? "—")}
                </td>
              ))}
              {onOpen && (
                <td data-label="Details">
                  <button
                    aria-label={"Open " + (r.campaignTitle || r.title || r.name || r.brandName || "record details")}
                    className="record-open"
                    onClick={() => onOpen(r)}
                  >
                    <span>Open</span><ArrowUpRight size={15} />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function Collection({
  path,
  columns,
  onOpen,
  render,
  refreshKey = 0,
  empty,
  title = "Records",
  tools = !!columns,
  filterStatus = true,
  hint,
  emptyAction,
  card,
  filter,
}) {
  const [search, setSearch] = useState(""),
    [state, setState] = useState(""),
    [sort, setSort] = useState("recent"),
    [compact, setCompact] = useState(false);
  const [cursor, setCursor] = useState(""),
    [history, setHistory] = useState([]),
    [resultPage, setResultPage] = useState(0),
    [scan, setScan] = useState(null);
  const [view, setView] = useState(card ? "cards" : "table");
  const { workspace, clientId } = useApp();
  const scoped = Boolean(tools && (search.trim() || state || sort !== "recent"));
  const pageURL = (value) => path + (path.includes("?") ? "&" : "?") + "cursor=" + encodeURIComponent(value);
  const q = useQuery(pageURL(scoped ? "" : cursor), [refreshKey]);
  useEffect(() => {
    setCursor("");
    setHistory([]);
    setState("");
  }, [path, workspace, clientId]);
  useEffect(() => setResultPage(0), [search, state, sort, path, workspace, clientId]);
  useEffect(() => {
    if (!scoped || !q.data || q.loading || q.error) return;
    const controller = new AbortController();
    const source = q.data;
    setScan(null);
    async function loadRemaining() {
      try {
        const rows = [...source];
        let next = q.page?.nextCursor;
        const visited = new Set();
        while (next) {
          if (visited.has(next)) throw new Error("The listing returned a repeated page.");
          visited.add(next);
          const separator = path.includes("?") ? "&" : "?";
          const url = pageURL(next) + (/([?&])limit=/.test(path) ? "" : separator + "limit=100");
          const page = await api(url, { signal: controller.signal });
          rows.push(...page.data);
          next = page.page?.nextCursor;
        }
        if (!controller.signal.aborted) setScan({ source, rows });
      } catch (error) {
        if (!controller.signal.aborted) setScan({ source, error });
      }
    }
    loadRemaining();
    return () => controller.abort();
  }, [scoped, path, workspace, clientId, q.data, q.loading, q.error]);
  const matching = scoped && scan?.source === q.data && scan?.rows
    ? presentRows(scan.rows, { search, state, sort })
    : null;
  const pageSize = q.data?.length || 20;
  const statusOptions = [...new Set((scan?.source === q.data ? scan?.rows || q.data : q.data || [])
    ?.map((row) => row.workState || row.state || row.status || row.verificationStatus).filter(Boolean))];
  return (
    <section
      className={"panel collection-panel " + (compact ? "density-compact" : "")}
    >
      {tools && (
        <>
          <div className="collection-heading">
            <div>
              <h2>
                {title}
              </h2>
            </div>
            <div className="actions">
              <button
                className="icon-button"
                aria-label="Refresh records"
                onClick={q.reload}
              >
                <RotateCw size={16} />
              </button>
              {card && columns ? <div className="record-view-toggle" role="group" aria-label="Listing layout">
                <button type="button" aria-pressed={view === "cards"} onClick={() => setView("cards")}><LayoutGrid size={16}/> Cards</button>
                <button type="button" aria-pressed={view === "table"} onClick={() => setView("table")}><List size={16}/> Table</button>
              </div> : !card && <button className="icon-button" aria-label={compact ? "Use comfortable rows" : "Use compact rows"}
                aria-pressed={compact} onClick={() => setCompact(!compact)}><List size={17}/></button>}
            </div>
          </div>
          <div className="listing-tools">
            <label className="listing-search">
              <Search size={17} />
              <input
                aria-label="Search records"
                placeholder="Search records…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  className="icon-button"
                  aria-label="Clear list search"
                  onClick={() => setSearch("")}
                >
                  <X size={14} />
                </button>
              )}
            </label>
            {filter}
            {filterStatus && <SelectMenu label="Filter by status" icon={SlidersHorizontal} value={state}
              onChange={setState} options={[{ value: "", label: "All statuses" }, ...statusOptions.map(value => ({ value, label: label(value) }))]}/>}
            <SelectMenu label="Sort records" icon={ArrowUpDown} value={sort} onChange={setSort}
              options={[
                { value: "recent", label: "Newest first" }, { value: "oldest", label: "Oldest first" },
                { value: "name", label: "Name A–Z" }, { value: "amount", label: "Highest amount" },
              ]}/>
          </div>
        </>
      )}
      <State query={q} empty={empty} hint={hint} emptyAction={emptyAction}>
        {(rows) => {
          if (scoped && !matching) {
            if (scan?.source === q.data && scan?.error) return <div className="state" role="alert">{scan.error.message} <button onClick={q.reload}>Retry</button></div>;
            return <div className="state" role="status">Searching all records…</div>;
          }
          const shown = matching ? matching.slice(resultPage * pageSize, (resultPage + 1) * pageSize) : rows;
          return shown.length ? (
            card && view === "cards" ? (
              <div className="record-card-grid">{shown.map(row => <React.Fragment key={uid(row)}>{card(row, q.reload)}</React.Fragment>)}</div>
            ) : render ? (
              render(shown, q.reload)
            ) : (
              <Table rows={shown} columns={columns} onOpen={onOpen} />
            )
          ) : (
            <div className="list-no-match">
              <Search size={24} />
              <h3>No matching records</h3>
              <p>Try a different search or clear the filters.</p>
              <button
                onClick={() => {
                  setSearch("");
                  setState("");
                  setSort("recent");
                }}
              >
                Clear filters
              </button>
            </div>
          );
        }}
      </State>
      {matching && <p className="collection-foot">{matching.length} matching records</p>}
      {matching && matching.length > pageSize && <div className="pagination">
        <button disabled={!resultPage} onClick={() => setResultPage(resultPage - 1)}>Previous</button>
        <span>Page {resultPage + 1} of {Math.ceil(matching.length / pageSize)}</span>
        <button disabled={(resultPage + 1) * pageSize >= matching.length} onClick={() => setResultPage(resultPage + 1)}>Next</button>
      </div>}
      {!scoped && (cursor || q.page?.hasMore) && (
        <div className="pagination">
          <button
            disabled={!cursor}
            onClick={() => {
              setCursor(history.at(-1) || "");
              setHistory((h) => h.slice(0, -1));
            }}
          >
            Previous
          </button>
          <button
            disabled={!q.page?.hasMore}
            onClick={() => {
              setHistory((h) => [...h, cursor]);
              setCursor(q.page.nextCursor);
            }}
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
}
const DialogDismiss = createContext(null);

export function Dialog({ title, onClose, children, className = "" }) {
  const ref = useRef(null);
  const keepEditing = useRef(null);
  const discardFocus = useRef(null);
  const [discard, setDiscard] = useState(false);
  function resume() {
    setDiscard(false);
    requestAnimationFrame(() => discardFocus.current?.focus());
  }
  function dismiss() {
    if (discard) { resume(); return; }
    if (ref.current?.querySelector('form[aria-busy="true"]')) return;
    if (ref.current?.querySelector('form[data-dirty="true"]')) {
      discardFocus.current = document.activeElement;
      setDiscard(true);
      return;
    }
    onClose();
  }
  useEffect(() => {
    const previous = document.activeElement;
    ref.current?.focus();
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = old;
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  useEffect(() => { if (discard) keepEditing.current?.focus(); }, [discard]);

  return createPortal(
    <div className="overlay" onMouseDown={event => { if (event.target === event.currentTarget) dismiss(); }}>
      <section ref={ref} className={`dialog ${className}`} tabIndex={-1} role="dialog" aria-modal="true"
        aria-label={discard ? "Discard changes?" : title}
        onKeyDown={event => {
          if (event.key === "Escape" && !event.defaultPrevented) {
            event.preventDefault();
            event.stopPropagation();
            dismiss();
          }
          if (event.key !== "Tab" || event.defaultPrevented) return;
          const controls = [...ref.current.querySelectorAll("button, input, textarea, a[href], [tabindex]")]
            .filter(element => !element.disabled && element.tabIndex >= 0 && element.getClientRects().length);
          const first = controls[0], last = controls.at(-1);
          if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}>
        <div hidden={discard} className="dialog-body">
          <header className="dialog-heading">
            <h2>{title}</h2>
            <button type="button" className="icon-button" aria-label="Close" onClick={dismiss}><X size={20}/></button>
          </header>
          <DialogDismiss.Provider value={dismiss}>{children}</DialogDismiss.Provider>
        </div>
        {discard && <div className="dialog-discard">
          <span className="state-icon"><AlertCircle size={23}/></span>
          <h2>Discard changes?</h2>
          <p>Your unsaved changes will be lost.</p>
          <div className="actions">
            <button ref={keepEditing} type="button" onClick={resume}>Keep editing</button>
            <button type="button" className="danger" onClick={onClose}>Discard changes</button>
          </div>
        </div>}
      </section>
    </div>,
    document.body,
  );
}
function PasswordInput({ value, onChange, ...props }) {
  const [visible, setVisible] = useState(false);
  return <div className="password-input">
    <input {...props} type={visible ? "text" : "password"} value={value} onChange={onChange}/>
    <button type="button" className="icon-button" aria-label={visible ? "Hide password" : "Show password"}
      aria-pressed={visible} onClick={() => setVisible(!visible)}>
      {visible ? <EyeOff size={18}/> : <Eye size={18}/>}
    </button>
  </div>;
}
function initial(fs, d = {}) {
  return Object.fromEntries(
    fs.map((f) => {
      let v = d?.[f.name] ?? f.default;
      if (f.type === "array") v = (v || []).map((x) => initial(f.fields, x));
      else if (f.type === "group") v = initial(f.fields, v || {});
      return [
        f.name,
        v ??
          (["checkbox", "switch"].includes(f.type)
            ? false
            : ["multi", "multiselect", "assets", "evidence"].includes(f.type)
              ? []
              : ""),
      ];
    }),
  );
}
function clean(fs, d) {
  const o = {};
  for (const f of fs) {
    let v = d[f.name];
    if (f.type === "array") v = v.map((x) => clean(f.fields, x));
    else if (f.type === "group") v = clean(f.fields, v);
    else if (f.type === "evidence")
      v = (v || []).map((resourceId) => ({ type: "ASSET", resourceId }));
    else if (f.type === "datetime" && v) v = new Date(v).toISOString();
    else if (f.type === "multi")
      v = Array.isArray(v)
        ? v
        : String(v)
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean);
    if (f.type === "group" && f.required === false && !Object.keys(v).length) continue;
    if (v !== "" && v !== null && v !== undefined) o[f.name] = v;
  }
  return o;
}
export function Fields({ fields, value, onChange, prefix = "" }) {
  return (
    <>
      {fields.map((f) => {
        const id = prefix + f.name,
          v = value[f.name],
          set = (x) => onChange({ ...value, [f.name]: x });
        if (f.type === "stars")
          return (
            <fieldset key={id} className="star-field">
              <legend>{f.label}</legend>
              <div
                className="star-input"
                role="radiogroup"
                aria-label={f.label}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <label key={n} title={n + " star" + (n === 1 ? "" : "s")}>
                    <input
                      type="radio"
                      name={id}
                      value={n}
                      checked={v === n}
                      required={f.required}
                      onChange={() => set(n)}
                    />
                    <span className={v >= n ? "filled" : ""}>★</span>
                    <span className="sr-only">{n} stars</span>
                  </label>
                ))}
              </div>
              {v && (
                <small>
                  {
                    [
                      "",
                      "Needs improvement",
                      "Could be better",
                      "Good",
                      "Great",
                      "Excellent",
                    ][v]
                  }
                </small>
              )}
            </fieldset>
          );
        if (["asset", "assets", "evidence"].includes(f.type))
          return (
            <fieldset key={id}>
              <legend>{f.label}</legend>
              <Upload
                purpose={f.purpose || "EVIDENCE"}
                collaborationId={f.collaborationId}
                onUploaded={(a) =>
                  set(f.type === "asset" ? uid(a) : [...(v || []), uid(a)])
                }
              />
              {(f.type === "asset" ? (v ? [v] : []) : v || []).map((a) => (
                <div className="actions" key={a}>
                  <a href={mediaURL(a)} target="_blank" rel="noreferrer">
                    View attached file ↗
                  </a>
                  <button
                    type="button"
                    onClick={() =>
                      set(f.type === "asset" ? "" : v.filter((x) => x !== a))
                    }
                  >
                    Remove attachment
                  </button>
                </div>
              ))}
            </fieldset>
          );
        if (f.type === "multiselect")
          return (
            <fieldset key={id}>
              <legend>{f.label}</legend>
              {(typeof f.options === "function"
                ? f.options(value)
                : f.options || []
              ).map((o) => (
                <label className="check-option" key={o.value}>
                  <input
                    type="checkbox"
                    checked={(v || []).includes(String(o.value))}
                    onChange={(e) =>
                      set(
                        e.target.checked
                          ? [...(v || []), String(o.value)]
                          : (v || []).filter((x) => x !== String(o.value)),
                      )
                    }
                  />
                  <span>{o.label}</span>
                </label>
              ))}
            </fieldset>
          );
        if (f.type === "array")
          return (
            <fieldset key={id}>
              <legend>{f.label}</legend>
              {(v || []).map((row, i) => (
                <div className="repeat-row" key={i}>
                  <Fields
                    fields={f.fields}
                    value={row}
                    prefix={id + i}
                    onChange={(r) =>
                      set(v.map((old, j) => (i === j ? r : old)))
                    }
                  />
                  <button
                    type="button"
                    className="subtle danger"
                    onClick={() => set(v.filter((_, j) => j !== i))}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="subtle"
                onClick={() => set([...(v || []), initial(f.fields)])}
              >
                <Plus size={14} />
                Add item
              </button>
            </fieldset>
          );
        if (f.type === "group")
          return (
            <fieldset key={id}>
              <legend>{f.label}</legend>
              <Fields fields={f.fields} value={v} onChange={set} prefix={id} />
            </fieldset>
          );
        if (f.type === "select") return (
          <div key={id} className="field">
            <label htmlFor={id}>{f.label}{f.required ? " *" : ""}</label>
            <SelectMenu id={id} label={f.label} value={v} required={f.required} placeholder={f.placeholder}
              onChange={value => set(f.numeric && value !== "" ? Number(value) : value)}
              options={[
                ...(!f.required ? [{ value: "", label: "No selection" }] : []),
                ...(f.options || []).map(option => ({ value: option.value ?? option, label: option.label ?? label(option) })),
              ]}/>
            {f.hint && <small>{f.hint}</small>}
          </div>
        );
        if (f.type === "switch") return (
          <label key={id} className="form-switch">
            <span><strong>{f.label}</strong>{f.hint && <small>{f.hint}</small>}</span>
            <input type="checkbox" role="switch" checked={Boolean(v)} onChange={event => set(event.target.checked)}/>
          </label>
        );
        const props = { id, required: f.required, placeholder: f.placeholder };
        return (
          <label
            key={id}
            className={"field " + (f.type === "textarea" ? "full" : "")}
          >
            <span>
              {f.label}
              {f.required ? " *" : ""}
            </span>
            {f.type === "textarea" ? (
              <textarea
                {...props}
                rows={4}
                value={v}
                onChange={(e) => set(e.target.value)}
              />
            ) : f.type === "password" ? (
              <PasswordInput {...props} value={v} onChange={event => set(event.target.value)}
                autoComplete={f.autoComplete || (f.name === "password" || f.name === "currentPassword" ? "current-password" : "new-password")}/>
            ) : f.type === "checkbox" ? (
              <input
                id={id}
                type="checkbox"
                checked={v}
                onChange={(e) => set(e.target.checked)}
              />
            ) : (
              <input
                {...props}
                type={
                  ["money", "seconds", "percent"].includes(f.type)
                    ? "number"
                    : f.type === "datetime"
                      ? "datetime-local"
                      : f.type === "multi"
                        ? "text"
                        : f.type || "text"
                }
                min={
                  ["money", "number", "seconds", "percent"].includes(f.type)
                    ? 0
                    : undefined
                }
                max={f.type === "percent" ? 100 : undefined}
                step={
                  ["money", "percent"].includes(f.type)
                    ? "0.01"
                    : f.type === "seconds"
                      ? "0.1"
                      : undefined
                }
                value={
                  ["money", "seconds", "percent"].includes(f.type)
                    ? v === ""
                      ? ""
                      : v / (f.type === "seconds" ? 1000 : 100)
                    : f.type === "datetime" && v
                      ? new Date(
                          new Date(v).getTime() -
                            new Date(v).getTimezoneOffset() * 60000,
                        )
                          .toISOString()
                          .slice(0, 16)
                      : f.type === "multi" && Array.isArray(v)
                        ? v.join(", ")
                        : v
                }
                onChange={(e) =>
                  set(
                    ["money", "number", "seconds", "percent"].includes(f.type)
                      ? e.target.value === ""
                        ? ""
                        : Math.round(
                            Number(e.target.value) *
                              (["money", "percent"].includes(f.type)
                                ? 100
                                : f.type === "seconds"
                                  ? 1000
                                  : 1),
                          )
                      : e.target.value,
                  )
                }
              />
            )}{" "}
            {f.hint && <small>{f.hint}</small>}
          </label>
        );
      })}
    </>
  );
}
export function Form({
  fields,
  initial: values = {},
  onSubmit,
  submit = "Save",
  onCancel,
  sections = {},
}) {
  const [v, setV] = useState(() => initial(fields, values)),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [fieldErrors, setFieldErrors] = useState({});
  const dismissDialog = useContext(DialogDismiss);
  const baseline = useRef(JSON.stringify(v));
  const dirty = JSON.stringify(v) !== baseline.current;
  useEffect(() => {
    if (!dirty) return;
    const warn = (event) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  return (
    <form
      data-dirty={dirty}
      aria-busy={busy}
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        setError("");
        setFieldErrors({});
        try {
          const check = (descriptors, record, path = []) => descriptors.flatMap(f => {
            const value = record?.[f.name];
            const next = [...path, f.name];
            if (f.type === "select" && f.required && (value === "" || value == null))
              return [{ path: next, message: "Choose " + f.label.toLowerCase() + "." }];
            if (f.type === "group") return check(f.fields, value, next);
            if (f.type === "array") return (value || []).flatMap((row, index) => check(f.fields, row, [...next, index]));
            return [];
          });
          const missing = check(fields, v);
          if (missing.length) {
            setFieldErrors(Object.fromEntries(missing.map(issue => [issue.path[0], issue.message])));
            setError("Choose the required options and try again.");
            return;
          }
          await onSubmit(clean(fields, v));
          baseline.current = JSON.stringify(v);
        } catch (e) {
          const next = Object.fromEntries((e.fields || []).filter(issue => issue.path?.length).map(issue => [issue.path[0], issue.message]));
          setFieldErrors(next);
          setError(Object.keys(next).length ? "Check the highlighted fields and try again." : e.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="form-grid">
        {fields.map(field => <React.Fragment key={field.name}>
          {sections[field.name] && <h3 className="form-section-heading">{sections[field.name]}</h3>}
          <Fields fields={[field]} value={v} onChange={next => {
            setV(next);
            setFieldErrors(previous => ({ ...previous, [field.name]: undefined }));
          }}/>
          {fieldErrors[field.name] && <small className="field-error" role="alert">{field.label}: {fieldErrors[field.name]}</small>}
        </React.Fragment>)}
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <footer className="form-footer">
        {onCancel && (
          <button type="button" className="subtle" disabled={busy} onClick={dismissDialog || onCancel}>
            Cancel
          </button>
        )}
        <button className="primary" disabled={busy}>
          {busy ? "Saving…" : submit}
        </button>
      </footer>
    </form>
  );
}
export function useCommand(reload) {
  const [d, setD] = useState(null),
    { run } = useApp();
  const open = (
    title,
    path,
    {
      method = "POST",
      fields = [],
      initial = {},
      extra = {},
      after,
      onPayload,
      submit = title,
    } = {},
  ) =>
    setD({
      title,
      path,
      method,
      fields,
      initial,
      extra,
      after,
      onPayload,
      submit,
      key: crypto.randomUUID(),
    });
  const modal = d && (
    <Dialog title={d.title} onClose={() => setD(null)}>
      <Form
        fields={d.fields}
        initial={d.initial}
        submit={d.submit}
        onCancel={() => setD(null)}
        onSubmit={async (b) => {
          const r = await run(() =>
            api(d.path, {
              method: d.method,
              key: d.key,
              body: d.onPayload ? d.onPayload({ ...d.extra, ...b }) : { ...d.extra, ...b },
            }),
          );
          setD(null);
          reload?.();
          d.after?.(r.data);
        }}
      />
    </Dialog>
  );
  return { open, modal };
}
export function Upload({ purpose, collaborationId, onUploaded }) {
  const [progress, setProgress] = useState(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const controller = useRef(null);
  const imageOnly = ["AVATAR", "CAMPAIGN_COVER"].includes(purpose);
  const videoOnly = purpose === "CONTENT";
  const allowed = [
    ...(!videoOnly ? ["image/jpeg", "image/png"] : []),
    ...(!imageOnly ? ["video/mp4", "video/webm"] : []),
  ];
  const limit = imageOnly ? 10 : 150;
  useEffect(() => () => controller.current?.abort(), []);
  return <div className="upload">
    <label>
      <strong>{videoOnly ? "Choose a video" : imageOnly ? "Choose an image" : "Choose a file"}</strong>
      <small>{videoOnly ? "MP4 or WebM" : imageOnly ? "JPG or PNG" : "JPG, PNG, MP4 or WebM"} · Up to {limit} MB</small>
      <input type="file" disabled={progress !== null} accept={allowed.join(",")} onChange={async event => {
        const file = event.target.files[0];
        event.target.value = "";
        if (!file) return;
        setError("");
        setFileName("");
        if (!allowed.includes(file.type) || file.size > limit * 1024 * 1024) {
          setError("Choose a supported file within the size limit above.");
          return;
        }
        const current = new AbortController();
        controller.current = current;
        setProgress(0);
        try {
          const body = new FormData();
          body.set("file", file);
          body.set("purpose", purpose);
          if (collaborationId) body.set("collaborationId", collaborationId);
          const asset = await uploadMedia(body, { signal: current.signal, onProgress: setProgress });
          onUploaded(asset);
          setFileName(file.name);
        } catch (error) {
          if (error.name !== "AbortError") setError(error.message);
        } finally {
          if (!current.signal.aborted) setProgress(null);
        }
      }}/>
    </label>
    {progress !== null && <div className="upload-progress">
      <progress value={progress} max="100" aria-label="Upload progress"/>
      <small role="status">{progress === 100 ? "Validating file…" : progress + "% uploaded"}</small>
      <button type="button" onClick={() => { controller.current?.abort(); setProgress(null); }}>Cancel upload</button>
    </div>}
    {fileName && <small role="status">Uploaded {fileName}</small>}
    {error && <small className="field-error" role="alert">{error}</small>}
  </div>;
}
export function Terms({ value: terms, payment = true }) {
  if (!terms) return <div className="state insight-state">No agreement terms are available.</div>;
  const revisionCount = terms.includedRevisions;
  const rights = terms.usageRights;
  const amount = value => value == null ? "—" : money(value);
  return <div className={"agreement-layout" + (payment ? "" : " agreement-scope-only")}>
    <div className="agreement-main">
      <section className="agreement-panel">
        <header className="agreement-heading">
          <span className="agreement-icon"><Clapperboard size={20}/></span>
          <div><h2>Deliverables</h2>
            <p>{[terms.formatSnapshot?.label, revisionCount != null && revisionCount + " included " + (revisionCount === 1 ? "revision" : "revisions")].filter(Boolean).join(" · ")}</p>
          </div>
        </header>
        {terms.deliverables?.length ? <ul className="campaign-deliverables">
          {terms.deliverables.map((item, index) => <li key={index}>
            <span className="brief-icon"><Clapperboard size={17}/></span>
            <div><strong>{label(item.kind)}</strong>{item.description && <p>{item.description}</p>}</div>
            <span className="deliverable-quantity">×{item.quantity}</span>
          </li>)}
        </ul> : <p className="muted">No deliverables specified.</p>}
      </section>
      {rights && <section className="agreement-panel">
        <header className="agreement-heading"><span className="agreement-icon"><ShieldCheck size={20}/></span><h2>Usage rights</h2></header>
        <ul className="brief-rights">{rights.channels?.map(channel => <li key={channel}>{label(channel)}</li>)}</ul>
        <dl className="brief-facts">
          {rights.durationDays != null && <div><dt>Usage period</dt><dd>{rights.durationDays} days</dd></div>}
          {rights.paidAdvertisingAllowed != null && <div><dt>Paid advertising</dt><dd>{rights.paidAdvertisingAllowed ? "Allowed" : "Not allowed"}</dd></div>}
        </dl>
      </section>}
      {terms.products?.length > 0 && <section className="agreement-panel">
        <header className="agreement-heading"><span className="agreement-icon"><Package size={20}/></span><h2>Products supplied</h2></header>
        <ul className="agreement-products">{terms.products.map((product, index) => <li key={index}>
          <strong>{product.quantity} × {product.name} {product.variant}</strong><span>{amount(product.retailValueMinor)} each</span>
        </li>)}</ul>
      </section>}
      {terms.affiliateTerms && <section className="agreement-panel">
        <h2>Affiliate terms</h2><p>{terms.affiliateTerms.description}</p>
        {terms.affiliateTerms.commissionBps != null && <strong>{(terms.affiliateTerms.commissionBps / 100).toFixed(2)}% commission</strong>}
      </section>}
    </div>
    {payment && <aside className="agreement-panel agreement-money">
      <header className="agreement-heading"><span className="agreement-icon"><Wallet size={20}/></span><h2>Payment breakdown</h2></header>
      <dl>
        <div><dt>Agreement gross</dt><dd>{amount(terms.amountMinor)}</dd></div>
        <div><dt>Platform fee</dt><dd>{amount(terms.feeMinor)}</dd></div>
        <div className="agreement-net"><dt>Creator net</dt><dd>{amount(terms.creatorNetMinor)}</dd></div>
      </dl>
      {terms.dueAt && <div className="agreement-deadline"><CalendarDays size={18}/><span>Delivery due</span><strong>{date(terms.dueAt)}</strong></div>}
    </aside>}
  </div>;
}
