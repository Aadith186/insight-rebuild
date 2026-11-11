import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { AdminOverview } from "../../web/src/components/AdminOverview";
import { Table, Badge } from "../../web/src/components/ui";
import { Avatar } from "../../web/src/components/Media";
import { InboxThread, InboxFilters } from "../../web/src/components/ChatInbox";
import { filterInbox, presentRows } from "../../web/src/components/listing";
import {
  LayoutDashboard,
  Users,
  Megaphone,
  MessageSquare,
  Bell,
  Search,
  Menu,
} from "lucide-react";
import "../../web/src/styles.css";
const admin = {
  users: 1824,
  creators: 1248,
  brands: 126,
  agencies: 38,
  activeCampaigns: 42,
  finance: { platformRevenueMinor: 128450000 },
  queues: {
    pendingVerification: 12,
    pendingCampaigns: 8,
    pendingFunding: 5,
    pendingWithdrawals: 4,
    openDisputes: 2,
    pendingRefunds: 1,
  },
};
const people = [
  {
    id: "1",
    name: "Auréa Skin",
    email: "hello@aurea.example",
    state: "VERIFIED",
    createdAt: "2026-11-01",
  },
  {
    id: "2",
    name: "Studio Collective",
    email: "team@studio.example",
    state: "PENDING",
    createdAt: "2026-11-02",
  },
  {
    id: "3",
    name: "Coast & Co.",
    email: "hello@coast.example",
    state: "VERIFIED",
    createdAt: "2026-11-03",
  },
  {
    id: "4",
    name: "The Morning Ritual",
    email: "hello@morning.example",
    state: "PENDING",
    createdAt: "2026-11-04",
  },
];
const chats = [
  {
    id: "1",
    title: "Riya Kapoor",
    unreadCount: 3,
    contextType: "COLLABORATION",
    campaignTitle: "The morning glow edit",
    lastMessageAt: new Date(),
    lastMessage: {
      senderUserId: "riya",
      text: "The revised cut is ready to review ✨",
    },
  },
  {
    id: "2",
    title: "Arjun Menon",
    unreadCount: 1,
    contextType: "CAMPAIGN",
    contextLabel: "Campaign question",
    lastMessageAt: new Date(),
    lastMessage: {
      senderUserId: "arjun",
      text: "Hi! Can I film the outdoor sequence tomorrow?",
    },
  },
  {
    id: "3",
    title: "Meera Nair",
    unreadCount: 0,
    contextType: "COLLABORATION",
    campaignTitle: "A little weekend story",
    lastMessageAt: new Date(Date.now() - 86400000),
    lastMessage: {
      senderUserId: "me",
      text: "Perfect, looking forward to it!",
    },
  },
  {
    id: "4",
    title: "Auréa Skin · Client review",
    unreadCount: 0,
    contextType: "CLIENT_REVIEW",
    contextLabel: "Private client review",
    lastMessageAt: "2026-11-01",
    lastMessage: {
      senderUserId: "brand",
      text: "The campaign brief looks good.",
    },
  },
];
function Fixture() {
  const [view, setView] = useState("overview"),
    [mode, setMode] = useState("all"),
    [search, setSearch] = useState(""),
    [opened, setOpened] = useState(null),
    [mobileNav, setMobileNav] = useState(false);
  const rows = filterInbox(chats, mode, search);
  return (
    <>
      <div className="visual-fixture-label">
        Visual QA fixture · sample records · no connected account
      </div>
      <div className="app-shell">
        <aside className={"sidebar " + (mobileNav ? "open" : "")}>
          <div className="sidebar-head">
            <a className="brand">
              Insight<span>●</span>
            </a>
          </div>
          <p className="nav-label">PLATFORM WORKSPACE</p>
          <nav>
            {[
              [LayoutDashboard, "Overview", "overview"],
              [Users, "Member directory", "members"],
              [MessageSquare, "Messages", "chat"],
            ].map(([Icon, label, key]) => (
              <a
                key={key}
                href={"#" + key}
                className={view === key ? "active" : ""}
                onClick={() => {
                  setView(key);
                  setSearch("");
                  setMobileNav(false);
                }}
              >
                <Icon size={18} />
                {label}
                {key === "chat" && <span className="nav-unread">2</span>}
              </a>
            ))}
          </nav>
        </aside>
        <div className="main-shell">
          <header className="topbar">
            <button
              className="icon-button mobile-only"
              aria-label="Open navigation"
              onClick={() => setMobileNav(!mobileNav)}
            >
              <Menu />
            </button>
            <span className="muted">Your platform, thoughtfully managed.</span>
            <div className="actions">
              <span className="notification-trigger">
                <Bell size={20} />
                <span className="nav-unread">4</span>
              </span>
              <Avatar name="Admin" size={34} />
            </div>
          </header>
          <main
            className="main-content"
            data-page={view === "chat" ? "conversations" : view}
          >
            {view === "overview" ? (
              <>
                <div className="page-heading">
                  <div>
                    <p className="eyebrow">INSIGHT OPERATIONS</p>
                    <h1>Platform overview</h1>
                    <p className="muted">
                      People, campaigns and the decisions that move them
                      forward.
                    </p>
                  </div>
                </div>
                <AdminOverview data={admin} />
              </>
            ) : view === "members" ? (
              <>
                <div className="page-heading">
                  <div>
                    <p className="eyebrow">PEOPLE & WORKSPACES</p>
                    <h1>Member directory</h1>
                    <p className="muted">
                      Review accounts and keep your marketplace trusted.
                    </p>
                  </div>
                </div>
                <div className="directory-header">
                  <div className="directory-tabs">
                    <button className="active">Brands</button>
                    <button>Creators</button>
                    <button>Agencies</button>
                    <button>All users</button>
                  </div>
                  <label className="listing-search directory-search">
                    <Search size={17} />
                    <input
                      aria-label="Search member directory"
                      placeholder="Search all accounts…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </label>
                </div>
                <section className="panel collection-panel">
                  <div className="collection-heading">
                    <div>
                      <p className="eyebrow">WORKSPACE RECORDS</p>
                      <h2>
                        Member accounts{" "}
                        <span className="count-pill">
                          {presentRows(people, { search }).length}
                        </span>
                      </h2>
                    </div>
                  </div>
                  <Table
                    rows={presentRows(people, { search })}
                    columns={[
                      {
                        key: "name",
                        label: "Member account",
                        render: (r) => (
                          <div className="table-identity">
                            <Avatar name={r.name} size={44} />
                            <div>
                              <strong>{r.name}</strong>
                              <small>{r.email}</small>
                            </div>
                          </div>
                        ),
                      },
                      {
                        key: "state",
                        label: "Verification",
                        render: (r) => <Badge>{r.state}</Badge>,
                      },
                      {
                        key: "createdAt",
                        label: "Joined",
                        render: (r) =>
                          new Date(r.createdAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          }),
                      },
                    ]}
                    onOpen={() => {}}
                  />
                </section>
              </>
            ) : (
              <div className={"messenger " + (opened ? "thread-open" : "")}>
                <aside className="chat-inbox">
                  <header>
                    <div>
                      <p className="eyebrow">Stay connected</p>
                      <h1>
                        Chats<span className="chat-total">2 unread</span>
                      </h1>
                    </div>
                    <MessageSquare size={20} />
                  </header>
                  <div className="chat-search">
                    <Search size={17} />
                    <input
                      aria-label="Search conversations"
                      placeholder="Search conversations"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <InboxFilters value={mode} onChange={setMode} unread={2} />
                  <div className="inbox-section-label">
                    <span>RECENT CONVERSATIONS</span>
                    <small>Latest activity first</small>
                  </div>
                  <div className="inbox-threads">
                    {rows.map((t) => (
                      <InboxThread
                        key={t.id}
                        thread={t}
                        userId="me"
                        active={opened === t.id}
                        onOpen={() => setOpened(t.id)}
                      />
                    ))}
                  </div>
                  <div className="chat-connection live">
                    <i />
                    Visual layout fixture
                  </div>
                </aside>
                <section className="chat-thread">
                  <div className="chat-welcome">
                    <div className="chat-welcome-art">
                      <MessageSquare size={65} />
                    </div>
                    <h2>
                      {opened
                        ? chats.find((t) => t.id === opened).title
                        : "Good work starts with a conversation."}
                    </h2>
                    <p>
                      Campaign questions, collaboration feedback and client
                      discussions in one place.
                    </p>
                    <small>
                      Unread badges and message previews come from stored
                      conversation history.
                    </small>
                    {opened && (
                      <button onClick={() => setOpened(null)}>
                        Back to inbox
                      </button>
                    )}
                  </div>
                </section>
              </div>
            )}
          </main>
        </div>
      </div>
    </>
  );
}
createRoot(document.getElementById("root")).render(<Fixture />);
