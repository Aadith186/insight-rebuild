import { ANDROID_APP } from "./platform";
import { ChevronDown, Link2, Server } from "lucide-react";
import { useRealtime } from "./realtime";
import { NotificationBell, UnreadBadge } from "../components/NotificationBell";
import React, { useState, useEffect, useRef, lazy, Suspense } from "react";
import {
  LayoutDashboard,
  Compass,
  Megaphone,
  Handshake,
  MessageSquare,
  Wallet,
  Users,
  Building2,
  Bell,
  Settings,
  Bookmark,
  Menu,
  X,
  Sun,
  Moon,
  LogOut,
  HelpCircle,
  UserCircle,
  ShieldCheck,
  FileText,
  Star,
} from "lucide-react";
import { api, uid, go, label } from "../api/http";
import { useApp, useQuery, useRoute } from "./context";
import { Page, State } from "../components/ui";
const DashboardHome = lazy(() =>
  import("../features/DashboardHome").then((m) => ({
    default: m.DashboardHome,
  })),
);
import Identity from "../features/Identity";
const Reviews = lazy(() =>
  import("../features/Reviews").then((m) => ({ default: m.Reviews })),
);
import { WorkspacePicker } from "../components/WorkspacePicker";
import { Avatar } from "../components/Media";
const Dashboard = lazy(() =>
  import("../features/Dashboard").then((m) => ({ default: m.Dashboard })),
);
const Notifications = lazy(() =>
  import("../features/Dashboard").then((m) => ({ default: m.Notifications })),
);
const Saved = lazy(() =>
  import("../features/Dashboard").then((m) => ({ default: m.Saved })),
);
const Applications = lazy(() =>
  import("../features/Dashboard").then((m) => ({ default: m.Applications })),
);
const Guide = lazy(() =>
  import("../features/Dashboard").then((m) => ({ default: m.Guide })),
);
const Campaigns = lazy(() =>
  import("../features/Campaigns").then((m) => ({ default: m.Campaigns })),
);
const CampaignEditor = lazy(() =>
  import("../features/Campaigns").then((m) => ({ default: m.CampaignEditor })),
);
const CampaignDetail = lazy(() =>
  import("../features/Campaigns").then((m) => ({ default: m.CampaignDetail })),
);
const Report = lazy(() =>
  import("../features/Campaigns").then((m) => ({ default: m.Report })),
);
const Offers = lazy(() =>
  import("../features/Offers").then((m) => ({ default: m.Offers })),
);
const OfferEditor = lazy(() =>
  import("../features/Offers").then((m) => ({ default: m.OfferEditor })),
);
const OfferDetail = lazy(() =>
  import("../features/Offers").then((m) => ({ default: m.OfferDetail })),
);
const Approvals = lazy(() =>
  import("../features/Offers").then((m) => ({ default: m.Approvals })),
);
const Collaborations = lazy(() =>
  import("../features/Collaborations").then((m) => ({
    default: m.Collaborations,
  })),
);
const Collaboration = lazy(() =>
  import("../features/Collaborations").then((m) => ({
    default: m.Collaboration,
  })),
);
const ReviewRoom = lazy(() =>
  import("../features/Collaborations").then((m) => ({ default: m.ReviewRoom })),
);
const Creators = lazy(() =>
  import("../features/Profiles").then((m) => ({ default: m.Creators })),
);
const PublicProfile = lazy(() =>
  import("../features/Profiles").then((m) => ({ default: m.PublicProfile })),
);
const Profile = lazy(() =>
  import("../features/Profiles").then((m) => ({ default: m.Profile })),
);
const Clients = lazy(() =>
  import("../features/Agency").then((m) => ({ default: m.Clients })),
);
const Team = lazy(() =>
  import("../features/Agency").then((m) => ({ default: m.Team })),
);
const Invitation = lazy(() =>
  import("../features/Agency").then((m) => ({ default: m.Invitation })),
);
const Messaging = lazy(() =>
  import("../features/Messaging").then((m) => ({ default: m.Messaging })),
);
const Finance = lazy(() =>
  import("../features/Finance").then((m) => ({ default: m.Finance })),
);
const Owner = lazy(() =>
  import("../features/Owner").then((m) => ({ default: m.Owner })),
);
const Disputes = lazy(() =>
  import("../features/Owner").then((m) => ({ default: m.Disputes })),
);
const WithdrawalDetail = lazy(() =>
  import("../features/Owner").then((m) => ({ default: m.WithdrawalDetail })),
);
const OwnerMember = lazy(() =>
  import("../features/Owner").then((m) => ({ default: m.OwnerMember })),
);
const AccountSettings = lazy(() => import("../features/Settings").then(m => ({ default: m.AccountSettings })));
const MemberReviewQueue = lazy(() => import("../features/MemberReview").then(m => ({ default: m.MemberReviewQueue })));
const MemberRecord = lazy(() => import("../features/MemberReview").then(m => ({ default: m.MemberRecord })));
export default function App() {
  const a = useApp(),
    { summary } = useRealtime(),
    route = useRoute(),
    [mobile, setMobile] = useState(false),
    [picker, setPicker] = useState(null),
    drawer = useRef(null),
    path = route.split("?")[0],
    parts = path.split("/").filter(Boolean),
    params = new URLSearchParams(route.split("?")[1]);
  const clients = useQuery(
    a.org?.type === "AGENCY"
      ? "/agencies/" + uid(a.org) + "/clients?limit=100"
      : null,
  );
  useEffect(() => {
    setMobile(false);
    window.scrollTo(0, 0);
  }, [path, a.workspace]);
  useEffect(() => {
    if (!mobile) return;
    const previous = document.activeElement;
    drawer.current?.querySelector('[aria-label="Close navigation"]')?.focus();
    const desktop = matchMedia("(min-width: 761px)");
    const onResize = () => { if (desktop.matches && !ANDROID_APP) setMobile(false); };
    desktop.addEventListener("change", onResize);
    return () => {
      desktop.removeEventListener("change", onResize);
      if (previous?.isConnected) previous.focus();
    };
  }, [mobile]);
  if (a.loading)
    return (
      <div className="state full-height">
        {localStorage.getItem("insight-signed-in")
          ? "Restoring your session…"
          : "Loading Insight…"}
      </div>
    );
  if (
    !a.auth &&
    localStorage.getItem("insight-signed-in") &&
    a.sessionError &&
    !path.startsWith("/verify-email") &&
    !path.startsWith("/reset-password")
  )
    return (
      <div className="state full-height">
        <h2>Still connecting</h2>
        <p className="muted">{a.sessionError}</p>
        <button className="primary" onClick={() => a.refresh()}>
          Retry
        </button>
        <button
          className="subtle"
          onClick={() => {
            localStorage.removeItem("insight-signed-in");
            a.setAuth(null);
          }}
        >
          Sign in again
        </button>
      </div>
    );
  if (
    !a.auth ||
    path.startsWith("/verify-email") ||
    path.startsWith("/reset-password")
  )
    return <Identity />;
  const role = a.role,
    reviewer = role === "reviewer",
    owner = role === "owner",
    nav = owner
      ? [
          [LayoutDashboard, "Overview", "/dashboard"],
          [Users, "Member directory", "/owner/members"],
          [ShieldCheck, "Member verification", "/owner/member-reviews"],
          [Megaphone, "Campaign review", "/owner/campaign-reviews"],
          [Handshake, "Collaborations", "/collaborations"],
          [ShieldCheck, "Disputes", "/owner/disputes"],
          [Wallet, "Funding", "/owner/fundings"],
          [Wallet, "Withdrawals", "/owner/withdrawals"],
          [Wallet, "Refund transfers", "/owner/refunds"],
          [FileText, "Revenue", "/finance"],
          [Settings, "Platform settings", "/owner/settings"],
          [Compass, "Formats", "/owner/collaboration-formats"],
          [FileText, "Audit history", "/owner/audit-logs"],
        ]
      : reviewer
        ? [
            [LayoutDashboard, "Overview", "/dashboard"],
            [ShieldCheck, "Client approvals", "/approvals"],
            [MessageSquare, "Messages", "/conversations"],
          ]
        : [
            [LayoutDashboard, "Overview", "/dashboard"],
            [
              role === "creator" ? Megaphone : Compass,
              role === "creator" ? "Explore campaigns" : "Discover creators",
              role === "creator" ? "/campaigns" : "/creators",
            ],
            ...(["brand", "agency"].includes(role)
              ? [[Megaphone, "Campaigns", "/campaigns"]]
              : [[FileText, "Your pitches", "/applications"]]),
            [
              Bookmark,
              role === "creator" ? "Saved campaigns" : "Shortlist",
              "/saved",
            ],
            [Handshake, "Offers", "/offers"],
            [Handshake, "Collaborations", "/collaborations"],
            ...(role === "agency"
              ? [
                  [Building2, "Clients", "/clients"],
                  [ShieldCheck, "Client approvals", "/approvals"],
                ]
              : []),
            [MessageSquare, "Messages", "/conversations"],
            [Star, "Reviews", "/reviews"],
            [Wallet, role === "creator" ? "Earnings" : "Payments", "/finance"],
            [ShieldCheck, "Disputes", "/disputes"],
            ...(a.member?.role === "ORG_ADMIN"
              ? [
                  [Users, "Team and access", "/team"],
                  [FileText, "Activity history", "/audit"],
                ]
              : []),
          ];
  let content;
  if (parts[0] === "invitation") content = <Invitation token={parts[1]} />;
  else if (!a.workspace)
    content = (
      <Page
        title="Choose a workspace"
        description="Accept an invitation or complete your account setup."
      />
    );
  else if (parts[0] === "dashboard")
    content = owner ? <Owner /> : <DashboardHome />;
  else if (parts[0] === "campaigns")
    content =
      parts[1] === "new" ? (
        <CampaignEditor />
      ) : parts[2] === "edit" ? (
        <CampaignEditor id={parts[1]} />
      ) : parts[1] ? (
        <CampaignDetail id={parts[1]} />
      ) : (
        <Campaigns />
      );
  else if (parts[0] === "creators")
    content = parts[1] ? <PublicProfile id={parts[1]} /> : <Creators />;
  else if (parts[0] === "organizations")
    content = <PublicProfile id={parts[1]} type="organization" />;
  else if (parts[0] === "offers")
    content =
      parts[1] === "new" ? (
        <OfferEditor params={params} />
      ) : parts[2] === "edit" ? (
        <OfferEditor id={parts[1]} />
      ) : parts[1] ? (
        <OfferDetail id={parts[1]} />
      ) : (
        <Offers />
      );
  else if (parts[0] === "collaborations")
    content = parts[1] ? <Collaboration id={parts[1]} /> : <Collaborations />;
  else if (parts[0] === "review") content = <ReviewRoom id={parts[1]} />;
  else if (parts[0] === "approvals") content = <Approvals id={parts[1]} />;
  else if (parts[0] === "conversations") content = <Messaging id={parts[1]} />;
  else if (parts[0] === "clients") content = <Clients id={parts[1]} />;
  else if (parts[0] === "team") content = <Team />;
  else if (parts[0] === "finance") content = <Finance />;
  else if (parts[0] === "reviews") content = <Reviews />;
  else if (ANDROID_APP && parts[0] === "owner") content = <Page title="Platform administration" description="Open Insight on the web to administer the platform." />;
  else if (parts[0] === "owner" && parts[1] === "member-reviews")
    content = parts[2] ? <MemberRecord id={parts[2]} type={params.get("memberType") || "ORGANIZATION"} review/> : <MemberReviewQueue/>;
  else if (parts[0] === "owner")
    content =
      parts[1] === "members" && parts[2] ? (
        <OwnerMember
          id={parts[2]}
          type={params.get("memberType") || "ORGANIZATION"}
        />
      ) : (
        <Owner section={parts[1]} />
      );
  else if (parts[0] === "withdrawals")
    content = <WithdrawalDetail id={parts[1]} />;
  else if (parts[0] === "disputes") content = <Disputes id={parts[1]} />;
  else if (parts[0] === "notifications") content = <Notifications />;
  else if (parts[0] === "saved") content = <Saved />;
  else if (parts[0] === "applications") content = <Applications />;
  else if (parts[0] === "profile") content = <Profile />;
  else if (parts[0] === "settings") content = <AccountSettings />;
  else if (parts[0] === "guide") content = <Guide />;
  else if (parts[0] === "audit") content = <Audit />;
  else
    content = (
      <Page
        title="Page not found"
        actions={
          <button onClick={() => go("/dashboard")}>Back to overview</button>
        }
      />
    );
  const current = (url) => path === url || path.startsWith(url + "/") ||
    (url === "/collaborations" && parts[0] === "review");
  const navSections = owner
    ? { "/dashboard": "Platform", "/owner/member-reviews": "Review", "/owner/fundings": "Finance", "/owner/settings": "Configuration" }
    : { "/dashboard": "Workspace", "/offers": "Work", "/reviews": "Account activity", "/team": "Administration" };
  const workspaceName = a.org?.name || (owner ? "Platform administration" : reviewer ? "Client review" : "Creator studio");
  const activeClient = clients.data?.find(client => client.brandOrganizationId === a.clientId);
  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link" onClick={(event) => {
        event.preventDefault();
        document.getElementById("main-content")?.focus();
      }}>
        Skip to content
      </a>
      <aside id="insight-navigation" ref={drawer} className={mobile ? "sidebar open" : "sidebar"}
        role={mobile ? "dialog" : undefined} aria-modal={mobile || undefined} aria-label="Workspace navigation"
        onKeyDown={event => {
          if (!mobile || event.defaultPrevented || !drawer.current.contains(event.target)) return;
          if (event.key === "Escape") { event.preventDefault(); setMobile(false); }
          if (event.key !== "Tab") return;
          const controls = [...drawer.current.querySelectorAll("button, a[href]")]
            .filter(element => !element.disabled && element.getClientRects().length);
          const first = controls[0], last = controls.at(-1);
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }}>
        <div className="sidebar-head">
          <a href="#/dashboard" className="brand">
            Insight<span>●</span>
          </a>
          <button
            className="icon-button mobile-only"
            aria-label="Close navigation"
            onClick={() => setMobile(false)}
          >
            <X />
          </button>
        </div>
        <WorkspacePicker clients={clients.data} />
        <nav aria-label="Workspace navigation">
          {nav.map(([Icon, title, url]) => (
            <React.Fragment key={url}>
            {navSections[url] && <p className="nav-label">{navSections[url]}</p>}
            <a
              key={url}
              className={current(url) ? "active" : ""}
              aria-current={current(url) ? "page" : undefined}
              href={"#" + url}
              onClick={() => setMobile(false)}
            >
              <Icon size={18} />
              {title}
              {url === "/conversations" && (
                <UnreadBadge value={summary?.conversations} />
              )}
            </a>
            </React.Fragment>
          ))}
        </nav>
        <div className="sidebar-bottom">
          {ANDROID_APP && <>
            <a href="insight-app://open-link"><Link2 size={17}/> Open invitation or account link</a>
            <a href="insight-app://connection"><Server size={17}/> Server connection</a>
          </>}
          <a href="#/guide" onClick={() => setMobile(false)}>
            <HelpCircle size={17} />
            How Insight works
          </a>
          <a href="#/settings" onClick={() => setMobile(false)}><Settings size={17}/> Account settings</a>
          <a href="#/profile" onClick={() => setMobile(false)}>
            <UserCircle size={17} />
            Your profile
          </a>
          <button
            onClick={() =>
              api("/auth/logout", { method: "POST" })
                .then(() => {
                  localStorage.removeItem("insight-signed-in");
                  a.setAuth(null);
                  a.changeWorkspace("");
                  a.refresh();
                })
                .catch((e) => a.notify(e.message))
            }
          >
            <LogOut size={17} />
            Sign out
          </button>
        </div>
      </aside>
      {mobile && <div className="nav-scrim" aria-hidden="true" onClick={() => setMobile(false)} />}
      <div className="main-shell" inert={mobile || undefined}>
        <header className="topbar">
          {ANDROID_APP ? <div className="android-context">
            <button className="android-workspace-trigger" onClick={() => setPicker("workspace")} aria-label="Switch workspace" aria-haspopup="dialog">
              <span className="android-mark">i<span>●</span></span>
              <span><strong>{a.org?.name || (reviewer ? "Client review" : "Creator studio")}</strong></span>
              <ChevronDown size={14}/>
            </button>
            {a.org?.type === "AGENCY" && <button className="android-client-trigger" onClick={() => setPicker("client")} aria-haspopup="dialog">
              {activeClient?.brand?.name || (a.clientId ? "Selected client" : "All authorized clients")} <ChevronDown size={13}/>
            </button>}
            {picker && <WorkspacePicker clients={clients.data} mode={picker} onClose={() => setPicker(null)} />}
          </div> : <button
            className="icon-button mobile-only"
            onClick={() => setMobile(true)}
            aria-label="Open navigation"
            aria-controls="insight-navigation" aria-expanded={mobile}
          >
            <Menu />
          </button>}
          {!ANDROID_APP && <div className="topbar-context">
            <span>{workspaceName}</span>
            {activeClient?.brand?.name && <strong>{activeClient.brand.name}</strong>}
          </div>}
          <div className="actions">
            {!ANDROID_APP && <button
              className="icon-button"
              aria-label="Toggle colour theme"
              onClick={() => a.setTheme(a.theme === "dark" ? "light" : "dark")}
            >
              {a.theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
            </button>}
            <NotificationBell />
            <button
              className="user-avatar"
              onClick={() => go("/profile")}
              aria-label="Your profile"
            >
              <Avatar
                assetId={a.auth.creator?.avatarAssetId}
                name={a.auth.user.name}
                size={33}
              />
            </button>
          </div>
        </header>
        <main
          id="main-content"
          key={a.workspace + ":" + (parts[0] === "conversations" ? "/conversations" : path)}
          tabIndex={-1}
          className="main-content"
        >
          <Suspense
            fallback={<div className="state">Loading your workspace…</div>}
          >
            {content}
          </Suspense>
        </main>
        <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
          {(owner
            ? [
                [LayoutDashboard, "Home", "/dashboard"],
                [Users, "Members", "/owner/members"],
                [ShieldCheck, "Review", "/owner/campaign-reviews"],
                [Wallet, "Finance", "/finance"],
                [Menu, "More", null],
              ]
            : reviewer
              ? [
                  [LayoutDashboard, "Home", "/dashboard"],
                  [ShieldCheck, "Approvals", "/approvals"],
                  [MessageSquare, "Chat", "/conversations"],
                  [Menu, "More", null],
                ]
              : [
                  [LayoutDashboard, "Home", "/dashboard"],
                  [
                    Compass,
                    role === "creator" ? "Discover" : "Creators",
                    role === "creator" ? "/campaigns" : "/creators",
                  ],
                  [Handshake, "Work", "/collaborations"],
                  [MessageSquare, "Chat", "/conversations"],
                  [Menu, "More", null],
                ]
          ).map(([Icon, name, url]) => (
            <button
              key={name}
              className={url && current(url) ? "active" : ""}
              aria-current={url && current(url) ? "page" : undefined}
              aria-controls={url ? undefined : "insight-navigation"}
              aria-expanded={url ? undefined : mobile}
              onClick={() => (url ? go(url) : setMobile(true))}
            >
              <Icon size={21} />
              <span>{name}</span>
              {url === "/conversations" && (
                <UnreadBadge value={summary?.conversations} />
              )}
            </button>
          ))}
        </nav>
        {!ANDROID_APP && <footer className="app-footer">Insight · Create with purpose.</footer>}
      </div>
    </div>
  );
}
function Audit() {
  return (
    <Page title="Team activity">
      <CollectionAudit />
    </Page>
  );
}
import { Collection } from "../components/ui";
function CollectionAudit() {
  return (
    <Collection
      path="/audit-logs"
      columns={[
        { key: "action", label: "Action", render: row => label(row.action) },
        { key: "actorName", label: "Person" },
        { key: "resourceType", label: "Record", render: row => label(row.resourceType) },
        { key: "createdAt", label: "When" },
      ]}
    />
  );
}
