import { SelectMenu } from "../components/SelectMenu";
import { ArrowUpRight, CalendarDays, CheckCircle2, Columns2, Play, Settings2, X } from "lucide-react";
import { AudienceBreakdown, SocialMetric, primaryChannel } from "../components/SocialMetrics";
import { mediaURL } from "../api/http";
import React, { useDeferredValue, useState } from "react";
import { api, uid, money, date, go, label } from "../api/http";
import { useApp, useQuery } from "../app/context";
import {
  Page,
  State,
  Form,
  Collection,
  Stats,
  Badge,
  useCommand,
  text,
  area,
  amount,
  field,
  select,
  Upload,
  Dialog,
} from "../components/ui";
import { CreatorTile } from "../components/CatalogCards";
import { Avatar, CampaignImage, Rating } from "../components/Media";
import { ReviewOpportunities, ReviewSummary, ReviewCards } from "./Reviews";
import { organization } from "./forms";
const socialFields = [
  select("platform", "Platform", ["INSTAGRAM", "YOUTUBE", "OTHER"]),
  text("handle", "Handle"),
  field("profileUrl", "Profile URL", "url"),
  field("followers", "Followers", "number"),
  { ...field("engagementBps", "Engagement rate (%)", "percent", false), hint: "Enter a rate or fill all three post sample fields below." },
  { name: "engagementSample", label: "Recent post sample (optional)", type: "group", required: false, fields: [
    { ...field("posts", "Posts in sample", "number", false), hint: "Use 1–200 recent posts." },
    field("likes", "Total likes", "number", false),
    { ...field("comments", "Total comments", "number", false), hint: "Rate = average likes and comments per post ÷ followers × 100." },
  ] },
];
const portfolioFields = [
  text("title", "Title"),
  area("description", "Description", false),
  field("externalVideoUrl", "Video URL", "url"),
  text("brandName", "Brand credit (self-reported)", false),
  field("evidenceUrl", "Work link", "url", false),
  { ...field("displayOrder", "Display order", "number"), default: 0 },
];
export function Profile() {
  const { auth, org, role, member, run, refresh } = useApp(),
    [tab, setTab] = useState("profile"),
    path =
      role === "creator"
        ? "/me/creator-profile"
        : org
          ? "/organizations/" + uid(org)
          : "/me",
    q = useQuery(path),
    social = useQuery(
      role === "creator" ? "/creators/" + uid(auth.creator) : null,
    ),
    cmd = useCommand(() => {
      q.reload();
      social.reload();
    });
  return (
    <Page
      title={org ? "Workspace profile" : role === "creator" ? "Creator profile" : "Your profile"}
      description={org ? "Manage the information collaborators see about your workspace." : "Manage your bio, audience and portfolio."}
      actions={
        (role === "creator" || org) && (
          <button
            onClick={() =>
              go(
                role === "creator"
                  ? "/creators/" + uid(auth.creator)
                  : "/organizations/" + uid(org),
              )
            }
          >
            Preview public profile
          </button>
        )
      }
    >
      <section className="panel profile-editor-header">
        <Avatar name={org?.name || auth.user.name} assetId={q.data?.avatarAssetId || q.data?.logoAssetId || org?.logoAssetId} size={72}/>
        <div><h2>{org?.name || auth.user.name}</h2><p>{org ? org.type === "AGENCY" ? "Agency workspace" : "Brand workspace" : role === "creator" ? "Creator workspace" : "Personal account"}{q.data?.city && " · " + q.data.city}</p>
          {q.data?.verificationStatus && <Badge>{q.data.verificationStatus}</Badge>}
        </div>
        <a href="#/settings" className="button"><Settings2 size={16}/> Account settings</a>
      </section>
      {role === "creator" && <div className="status-strip" role="group" aria-label="Profile sections">
        {[["profile", "Profile details"], ["social accounts", "Social reach"], ["portfolio", "Portfolio"]].map(([value, title]) =>
          <button key={value} aria-pressed={tab === value} className={tab === value ? "active" : ""} onClick={() => setTab(value)}>{title}</button>)}
      </div>}
      {org && member?.role !== "ORG_ADMIN" ? <section className="panel settings-panel">
        <h2>Workspace information</h2><p>Workspace administrators manage this profile.</p>
        <a className="button" href={"#/organizations/" + uid(org)}>View workspace profile <ArrowUpRight size={16}/></a>
      </section> :
      tab === "social accounts" ? (
        <>
          <div className="section-heading profile-section-heading"><div><h2>Social channels</h2><p className="muted">Share audience size and engagement for each channel.</p></div><button
            className="primary"
            onClick={() =>
              cmd.open("Add social account", "/me/social-accounts", {
                fields: socialFields,
              })
            }
          >
            Add social account
          </button></div>
          <State query={social}>
            {(p) => (
              <div className="social-grid">
                {!p.socialAccounts?.length && <div className="panel settings-panel"><h2>No social accounts</h2><p>Add a channel to share followers and engagement.</p></div>}
                {p.socialAccounts?.map((s) => (
                  <SocialMetric account={s} key={uid(s)}>

                      <button
                        onClick={() =>
                          cmd.open(
                            "Edit social account",
                            "/me/social-accounts/" + uid(s),
                            {
                              method: "PATCH",
                              fields: socialFields,
                              initial: s,
                            },
                          )
                        }
                      >
                        Edit
                      </button>
                      <button
                        onClick={() =>
                          cmd.open(
                            "Remove social account",
                            "/me/social-accounts/" + uid(s),
                            { method: "DELETE" },
                          )
                        }
                      >
                        Remove
                      </button>
                  </SocialMetric>
                ))}
              </div>
            )}
          </State>
        </>
      ) : tab === "portfolio" ? (
        <>
          <div className="section-heading profile-section-heading"><div><h2>Portfolio</h2><p className="muted">Show collaborators examples of your work.</p></div><button
            className="primary"
            onClick={() =>
              cmd.open("Add portfolio video", "/me/portfolio", {
                fields: portfolioFields,
              })
            }
          >
            Add video link
          </button></div>
          <section className="panel">
            <h3>Or upload a portfolio video</h3>
            <Upload
              purpose="PORTFOLIO"
              onUploaded={(a) =>
                cmd.open("Describe portfolio video", "/me/portfolio", {
                  fields: portfolioFields.filter(
                    (f) => f.name !== "externalVideoUrl",
                  ),
                  extra: { assetId: uid(a) },
                })
              }
            />
          </section>
          <Collection
            path={"/creators/" + uid(auth.creator) + "/portfolio"}
            render={(rows) =>
              rows.map((p) => (
                <div className="list-row" key={uid(p)}>
                  <div>
                    <h3>{p.title}</h3>
                    <p>{p.brandName} · Self-reported credit</p>
                  </div>
                  <div className="actions">
                    <button
                      onClick={() =>
                        cmd.open(
                          "Edit portfolio item",
                          "/me/portfolio/" + uid(p),
                          {
                            method: "PATCH",
                            fields: p.assetId
                              ? portfolioFields.filter(
                                  (f) => f.name !== "externalVideoUrl",
                                )
                              : portfolioFields,
                            initial: p,
                            extra: p.assetId ? { assetId: p.assetId } : {},
                          },
                        )
                      }
                    >
                      Edit
                    </button>
                    <button
                      onClick={() =>
                        cmd.open(
                          "Remove portfolio item",
                          "/me/portfolio/" + uid(p),
                          { method: "DELETE" },
                        )
                      }
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            }
          />
        </>
      ) : (
        <State query={q}>
          {(p) => (
            <section className="panel settings-panel">
              <h2>{role === "creator" ? "Profile information" : org ? "Workspace information" : "Public name"}</h2>
              {(role === "creator" || org) && (
                <div className="profile-photo-editor">
                  <Avatar
                    assetId={p.avatarAssetId || p.logoAssetId}
                    name={p.name || auth.user.name}
                    size={94}
                  />
                  <div><h3>{org ? "Workspace logo" : "Profile photo"}</h3><Upload
                    purpose="AVATAR"
                    onUploaded={(a) =>
                      run(
                        () =>
                          api(path, {
                            method: "PATCH",
                            body: {
                              [role === "creator"
                                ? "avatarAssetId"
                                : "logoAssetId"]: uid(a),
                              expectedVersion: p.version,
                            },
                          }),
                        "Profile image updated",
                      )
                        .then(q.reload)
                        .catch(() => {})
                    }
                  /></div>
                </div>
              )}
              <Form
                key={p.version ?? p.user?.version}
                fields={
                  role === "creator"
                    ? [
                        area("bio", "About", false),
                        text("city", "City", false),
                        field(
                          "niches",
                          "Niches (comma separated)",
                          "multi",
                          false,
                        ),
                        field(
                          "languages",
                          "Languages (comma separated)",
                          "multi",
                          false,
                        ),
                        amount("startingRateMinor", "Starting rate (₹)", false),
                        {
                          name: "audience",
                          label: "Audience demographics",
                          type: "group",
                          fields: [
                            {
                              name: "countries",
                              label: "Countries",
                              type: "array",
                              fields: [
                                text("label", "Country"),
                                field("percentage", "Percentage", "number"),
                              ],
                            },
                            {
                              name: "ageGroups",
                              label: "Age groups",
                              type: "array",
                              fields: [
                                text("label", "Age range"),
                                field("percentage", "Percentage", "number"),
                              ],
                            },
                          ],
                        },
                      ]
                    : org
                      ? organization
                      : [text("name", "Name")]
                }
                initial={p.user || p}
                onSubmit={async (b) => {
                  await run(() =>
                    api(path, {
                      method: "PATCH",
                      body: { ...b, expectedVersion: p.version ?? p.user?.version },
                    }),
                  );
                  q.reload();
                  await refresh();
                }}
              />
            </section>
          )}
        </State>
      )}
      {cmd.modal}
    </Page>
  );
}
export function Creators() {
  const [search, setSearch] = useState(""),
    [niche, setNiche] = useState(
      new URLSearchParams(location.hash.split("?")[1]).get("niche") || "",
    ),
    [city, setCity] = useState(""),
    [platform, setPlatform] = useState(""),
    [minimum, setMinimum] = useState(""),
    filters = useDeferredValue(new URLSearchParams({ search, niche, city, platform, engagementMin: minimum }).toString()),
    [compare, setCompare] = useState([]),
    [comparisonOpen, setComparisonOpen] = useState(false);
  return (
    <Page
      title="Find your creative match"
      description="Discover creators whose audience and ideas fit your brand."
    >
      <div className="filter-bar">
        <input
          aria-label="Search creators"
          placeholder="Search creators"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <input
          aria-label="Niche"
          placeholder="Niche"
          value={niche}
          onChange={(e) => setNiche(e.target.value)}
        />
        <input
          aria-label="City"
          placeholder="City"
          value={city}
          onChange={(e) => setCity(e.target.value)}
        />
        <SelectMenu label="Social platform" value={platform} onChange={setPlatform} options={[
          {value: "", label: "All platforms"}, {value: "INSTAGRAM", label: "Instagram"},
          {value: "YOUTUBE", label: "YouTube"}, {value: "OTHER", label: "Other"},
        ]}/>
        <input aria-label="Minimum engagement percentage" placeholder="Min. engagement %" type="number" min="0" max="100" step="0.1" value={minimum} onChange={e => setMinimum(e.target.value)} />
      </div>
      <Collection
        path={"/creators?" + filters}
        render={(rows) => (
          <div className="creator-grid">
            {rows.map((p) => (
              <CreatorTile
                key={uid(p)}
                creator={p}
                metricChannel={primaryChannel((p.socialAccounts || []).filter(account => (!platform || account.platform === platform) && account.engagementBps >= Number(minimum || 0) * 100))}
                selected={compare.some((v) => uid(v) === uid(p))}
                compareFull={compare.length === 3}
                onCompare={(p) =>
                  setCompare((a) =>
                    a.some((v) => uid(v) === uid(p))
                      ? a.filter((v) => uid(v) !== uid(p))
                      : a.length < 3
                        ? [...a, p]
                        : a,
                  )
                }
              />
            ))}
          </div>
        )}
      />
      {compare.length > 0 && <div className="creator-compare-tray" aria-label="Creator selection">
        <span aria-live="polite">{compare.length} of 3 selected</span>
        <button type="button" onClick={() => setCompare([])}>Clear</button>
        <button type="button" className="primary" disabled={compare.length < 2} onClick={() => setComparisonOpen(true)}>
          <Columns2 size={16}/> {compare.length < 2 ? "Select one more" : "Compare creators"}
        </button>
      </div>}
      {comparisonOpen && compare.length >= 2 && <CreatorComparison
        creators={compare} onClose={() => setComparisonOpen(false)}
        onRemove={creator => {
          if (compare.length === 2) setComparisonOpen(false);
          setCompare(compare.filter(item => uid(item) !== uid(creator)));
        }}
      />}
    </Page>
  );
}
const comparisonNumber = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });
const comparisonPlatforms = [["INSTAGRAM", "Instagram", "Followers"], ["YOUTUBE", "YouTube", "Subscribers"], ["OTHER", "Other social channels", "Followers"]];
const comparisonRows = [
  { label: "Starting rate", get: p => p.startingRateMinor, format: money },
  { label: "Completed projects", get: p => p.completedCount },
  { label: "Rating", get: p => p.ratingCount ? p.ratingAverage : null, format: n => n.toFixed(1) + " / 5", deltaFormat: n => n.toFixed(1) + " pts" },
  { label: "Reviews", get: p => p.ratingCount },
];

function CreatorComparison({ creators, onClose, onRemove }) {
  const groups = comparisonPlatforms.map(([platform, title, reach]) => ({
    platform, title, reach,
    accounts: creators.map(p => primaryChannel((p.socialAccounts || []).filter(a => a.platform === platform))),
  })).filter(group => group.accounts.some(Boolean));

  function metricRow({ label, values, format = n => comparisonNumber.format(n), deltaFormat = format, comparable = true }) {
    return <tr key={label}>
      <th scope="row">{label}</th>
      {values.map((value, index) => {
        const difference = comparable && index > 0 && Number.isFinite(value) && Number.isFinite(values[0])
          ? Number((value - values[0]).toFixed(2)) : null;
        return <td key={uid(creators[index])}>
          {Number.isFinite(value) ? <strong>{format(value)}</strong> : <span className="muted">—</span>}
          {difference !== null && <small className="comparison-delta">
            {difference === 0 ? "Same" : (difference < 0 ? "−" : "+") + deltaFormat(Math.abs(difference))}
          </small>}
        </td>;
      })}
    </tr>;
  }

  return <Dialog title="Compare creators" className="creator-comparison-dialog" onClose={onClose}>
    <p className="comparison-intro">Differences are shown against <strong>{creators[0].name}</strong>.</p>
    <div className="comparison-scroll" role="region" aria-label="Side-by-side creator metrics" tabIndex={0}>
      <table className="creator-comparison-table">
        <thead><tr>
          <th scope="col">Metric</th>
          {creators.map(creator => <th scope="col" key={uid(creator)}>
            <div className="comparison-creator">
              <Avatar assetId={creator.avatarAssetId} name={creator.name} size={34}/>
              <a href={"#/creators/" + uid(creator)}>{creator.name}</a>
              <button type="button" className="icon-button" aria-label={"Remove " + creator.name + " from comparison"} onClick={() => onRemove(creator)}><X size={15}/></button>
            </div>
          </th>)}
        </tr></thead>
        <tbody>
          {comparisonRows.map(row => metricRow({ ...row, values: creators.map(row.get) }))}
          <tr><th scope="row">Location</th>{creators.map(p => <td key={uid(p)}>{p.city || "—"}</td>)}</tr>
          <tr><th scope="row">Top countries</th>{creators.map(p => <td key={uid(p)}>
            {p.audience?.countries?.length
              ? p.audience.countries.map(a => a.label + " " + a.percentage + "%").join(", ")
              : "—"}
          </td>)}</tr>
        </tbody>
        {groups.map(({ platform, title, reach, accounts }) => <tbody key={platform}>
          <tr className="comparison-group">
            <th scope="rowgroup">{title}</th>
            {accounts.map((account, i) => <td key={uid(creators[i])}>{account?.handle || "—"}</td>)}
          </tr>
          {metricRow({ label: reach, values: accounts.map(a => a?.followers), comparable: platform !== "OTHER" })}
          {metricRow({
            label: "Engagement",
            values: accounts.map(a => a?.engagementBps),
            format: n => (n / 100).toFixed(2) + "%",
            deltaFormat: n => comparisonNumber.format(n / 100) + " pp",
            comparable: platform !== "OTHER",
          })}
        </tbody>)}
      </table>
    </div>
    {groups.length > 0 && <p className="comparison-note">Figures use the largest account per platform. Engagement differences are in percentage points.</p>}
  </Dialog>;
}
export function PublicProfile({ id, type = "creator" }) {
  const creator = type === "creator",
    path = (creator ? "/creators/" : "/organizations/") + id,
    q = useQuery(path),
    { org, clientId, run, role } = useApp();
  return (
    <State query={q}>
      {(p) => (
        <Page
          title={creator ? "Creator profile" : "Brand profile"}
          actions={
            creator &&
            ["brand", "agency"].includes(role) && (
              <>
                <button onClick={() => go("/offers/new?creatorId=" + id)}>
                  Prepare offer
                </button>
                <button
                  className="primary"
                  onClick={() =>
                    run(
                      () =>
                        api("/conversations", {
                          method: "POST",
                          body: {
                            contextType: "DIRECT",
                            creatorProfileId: id,
                            brandOrganizationId: clientId || uid(org),
                          },
                        }),
                      "Conversation opened",
                    )
                      .then((r) => go("/conversations/" + uid(r.data)))
                      .catch(() => {})
                  }
                >
                  Start conversation
                </button>
              </>
            )
          }
        >
          <section className="public-profile-hero">
            <div className="profile-cover-art" />
            <div className="profile-identity">
              <Avatar
                assetId={p.avatarAssetId || p.logoAssetId}
                name={p.name}
                size={126}
              />
              <div>
                <h2>{p.name}</h2>
                <p>
                  {p.city}{" "}
                  {p.languages?.length ? "· " + p.languages.join(", ") : ""}
                </p>
                <Rating average={p.ratingAverage} count={p.ratingCount} />
              </div>
            </div>
          </section>
          <Stats
            items={[
              ...(creator ? [["Starting rate", p.startingRateMinor == null ? "—" : money(p.startingRateMinor)]] : []),
              ["Completed projects", p.completedCount ?? "—"],
            ]}
          />
          {(p.bio || p.description) && <section className="profile-section">
            <h2>About {p.name}</h2>
            <p>{p.bio || p.description}</p>
          </section>}
          {creator && (
            <>
              <section className="profile-section">
                <h2>Social reach & engagement</h2>
                <div className="social-grid">{p.socialAccounts?.map(s => <SocialMetric key={uid(s)} account={s}/>)}</div>
                {!p.socialAccounts?.length && <p className="muted">No social accounts added.</p>}
              </section>
              <AudienceBreakdown audience={p.audience}/>
              <section className="profile-section">
              <h2>Portfolio</h2>
              <Collection
                path={path + "/portfolio"} empty="No portfolio items yet"
                render={(rows) => (
                  <div className="card-grid">
                    {rows.map((v) => (
                      <article className="portfolio-card" key={uid(v)}>
                        {v.assetId ? (
                          <video controls src={mediaURL(v.assetId)} />
                        ) : (
                          v.externalVideoUrl && <a className="portfolio-video" href={v.externalVideoUrl} target="_blank" rel="noreferrer">
                            <Play size={22}/> Watch video <ArrowUpRight size={15}/>
                          </a>
                        )}
                        <div className="portfolio-copy"><h3>{v.title}</h3>
                          {v.description && <p>{v.description}</p>}
                          {v.brandName && <small>{v.brandName} · Self-reported credit</small>}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              />
              </section>
            </>
          )}
          <section className="profile-section">
            <h2>Verified completed work</h2>
            <Collection path={path + "/projects"} empty="No verified projects yet" render={rows => rows.map(project =>
              <article className="list-row public-project" key={uid(project)}>
                <span className="agreement-icon"><CheckCircle2 size={18}/></span>
                <div><h3>{project.completion?.platform ? label(project.completion.platform) + " delivery" : "Completed collaboration"}</h3>
                  {project.completion?.completedAt && <p><CalendarDays size={14}/> {date(project.completion.completedAt)}</p>}</div>
                {project.completion?.url && <a className="button" href={project.completion.url} target="_blank" rel="noreferrer">View delivery <ArrowUpRight size={15}/></a>}
              </article>)}/>
          </section>
          <ReviewOpportunities targetId={id} />
          <section className="panel">
            <h2>Reviews & reputation</h2>
            <ReviewSummary targetId={id} type={creator ? "CREATOR" : "BRAND"} />
          </section>
          <ReviewCards path={path + "/reviews"}/>
        </Page>
      )}
    </State>
  );
}
