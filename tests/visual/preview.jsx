// This separate test entry is not imported by the production application or build.
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import {
  LayoutDashboard,
  Compass,
  Handshake,
  MessageSquare,
  Wallet,
  Star,
  Menu,
  Bell,
  Settings,
  ArrowUpRight,
  Clock,
  CalendarDays,
  Send,
  Paperclip,
  CheckCheck,
  ChevronLeft,
} from "lucide-react";
import { AppContext } from "../../web/src/app/context";
import {
  KpiCards,
  MoneyChart,
  Distribution,
  BudgetChart,
  PeriodControl,
} from "../../web/src/components/Charts";
import { WorkspacePicker } from "../../web/src/components/WorkspacePicker";
import {
  CampaignTile,
  CreatorTile,
} from "../../web/src/components/CatalogCards";
import { Avatar } from "../../web/src/components/Media";
import { Dialog, Form, area } from "../../web/src/components/ui";
import "../../web/src/styles.css";
const creator = {
  id: "111111111111111111111111",
  name: "Riya Kapoor",
  city: "Mumbai",
  bio: "Everyday stories with a little warmth.",
  niches: ["Beauty & skincare"],
  startingRateMinor: 1500000,
  completedCount: 28,
  ratingAverage: 4.9,
  ratingCount: 16,
  avatarAssetId: null,
  socialAccounts: [{ followers: 32400, engagementBps: 580 }],
};
const months = ["Jun", "Jul", "Aug", "Sep", "Oct", "Nov"].map((label, i) => ({
  label,
  earnedMinor: [2200000, 3400000, 2800000, 5100000, 4300000, 6700000][i],
  feeMinor: [220000, 340000, 280000, 510000, 430000, 670000][i],
  withdrawnMinor: [1900000, 2800000, 2200000, 4300000, 3800000, 5000000][i],
  fundedMinor: [3000000, 4200000, 3900000, 6200000, 5000000, 8100000][i],
}));
function Preview() {
  const [view, setView] = useState("dashboard"),
    [workspace, setWorkspace] = useState("brand"),
    [clientId, setClientId] = useState(""),
    [theme, setTheme] = useState("light"),
    [modal, setModal] = useState(false),
    [nav, setNav] = useState(false);
  const org = {
      id: "222222222222222222222222",
      name: "Auréa Skin",
      type: "BRAND",
    },
    auth = {
      user: { name: "Ananya Nair", platformRole: "USER" },
      creator: { id: "333333333333333333333333" },
      organizations: [
        org,
        {
          id: "444444444444444444444444",
          name: "Studio Collective",
          type: "AGENCY",
        },
      ],
    };
  const context = {
    auth,
    org,
    role: "brand",
    workspace,
    clientId,
    setClientId,
    changeWorkspace: setWorkspace,
    run: async () => {
      throw new Error("Visual fixture only. No server records are changed.");
    },
    notify: () => {},
  };
  document.documentElement.dataset.theme = theme;
  const navs = [
    [LayoutDashboard, "Overview", "dashboard"],
    [Compass, "Discover creators", "creators"],
    [Handshake, "Campaigns", "campaigns"],
    [MessageSquare, "Messages", "chat"],
    [Wallet, "Payments", "earnings"],
    [Star, "Reviews", "reviews"],
  ];
  const campaigns = [
    {
      id: "555555555555555555555555",
      state: "PUBLISHED",
      availableSpots: 4,
      draft: {
        title: "The morning glow edit",
        niche: "Beauty & skincare",
        brief:
          "Skin-first stories. Show your real morning routine in warm, natural light.",
        budgetPerCreatorMinor: 1500000,
        spots: 4,
        applicationDeadline: "2026-12-20",
      },
    },
    {
      id: "666666666666666666666666",
      state: "PUBLISHED",
      availableSpots: 3,
      draft: {
        title: "A little weekend story",
        niche: "Fashion",
        brief: "Thoughtful style for the everyday. Let your personality lead.",
        budgetPerCreatorMinor: 2200000,
        spots: 3,
        applicationDeadline: "2026-12-25",
      },
    },
    {
      id: "777777777777777777777777",
      state: "PUBLISHED",
      availableSpots: 6,
      draft: {
        title: "For the love of slow mornings",
        niche: "Food & lifestyle",
        brief:
          "A coffee ritual worth sharing. Make something beautiful out of the everyday.",
        budgetPerCreatorMinor: 800000,
        spots: 6,
        applicationDeadline: "2026-12-28",
      },
    },
  ];
  return (
    <AppContext.Provider value={context}>
      <div className="visual-fixture-label">
        Visual QA fixture · sample records · no connected account
      </div>
      <div className="app-shell">
        <aside className={"sidebar " + (nav ? "open" : "")}>
          <div className="sidebar-head">
            <a className="brand">
              Insight<span>●</span>
            </a>
          </div>
          <WorkspacePicker />
          <p className="nav-label">WORKSPACE</p>
          <nav>
            {navs.map(([Icon, name, key]) => (
              <a
                className={view === key ? "active" : ""}
                key={key}
                href={"#" + key}
                onClick={() => {
                  setView(key);
                  setNav(false);
                }}
              >
                <Icon size={18} />
                {name}
              </a>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <a>
              <Settings size={17} />
              Your profile
            </a>
          </div>
        </aside>
        <div className="main-shell">
          <header className="topbar">
            <button
              className="mobile-only icon-button"
              onClick={() => setNav(!nav)}
            >
              <Menu />
            </button>
            <span className="muted">
              Your space for meaningful collaborations
            </span>
            <div className="actions">
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                Theme
              </button>
              <Bell size={19} />
              <Avatar name="Ananya" size={34} />
            </div>
          </header>
          <main
            className="main-content"
            data-page={view === "chat" ? "conversations" : view}
          >
            {view === "chat" ? (
              <ChatFixture />
            ) : (
              <>
                <header className="page-heading">
                  <div>
                    <p className="eyebrow">Your collaboration hub</p>
                    <h1>
                      {view === "creators"
                        ? "Find your creative match"
                        : view === "campaigns"
                          ? "A brief. A spark. A great story."
                          : view === "earnings"
                            ? "Your earnings, in focus"
                            : view === "reviews"
                              ? "Reviews & reputation"
                              : "Good to see you, Ananya."}
                    </h1>
                    <p className="muted">
                      {view === "creators"
                        ? "Discover people whose audience and ideas fit your brand."
                        : "Your next great collaboration starts here."}
                    </p>
                  </div>
                  <button className="primary" onClick={() => setModal(true)}>
                    + Create campaign
                  </button>
                </header>
                {view === "dashboard" && (
                  <section className="editorial-hero">
                    <div>
                      <p className="eyebrow">
                        Great stories. The right people.
                      </p>
                      <h2>
                        A little spark.
                        <br />A bigger <em>impact.</em>
                      </h2>
                      <p>
                        Bring your next campaign to life with creators who
                        understand your brand.
                      </p>
                      <button
                        className="sun-button"
                        onClick={() => setView("creators")}
                      >
                        Discover your creative match <ArrowUpRight size={17} />
                      </button>
                      <div className="hero-profile">
                        <Avatar name="Ananya" size={30} />
                        <span>A shared workspace from brief to delivery.</span>
                      </div>
                    </div>
                    <div className="hero-photo">
                      <img
                        alt="Creative workspace"
                        src="/editorial/studio.jpg"
                      />
                      <div className="hero-photo-note">
                        <span>THE CREATIVE CONNECTION</span>
                        <p>
                          Good work
                          <br />
                          happens together.
                        </p>
                      </div>
                    </div>
                  </section>
                )}
                {["dashboard", "earnings"].includes(view) && (
                  <>
                    <KpiCards
                      items={[
                        {
                          label: "Active collaborations",
                          value: 12,
                          note: "Work currently in motion",
                        },
                        {
                          label: "Completed work",
                          value: 38,
                          note: "Settled collaborations",
                        },
                        {
                          label: "Funds awaiting closeout",
                          value: "₹1,24,000",
                          note: "Current held funds",
                        },
                        {
                          label: "Client approvals",
                          value: 4,
                          note: "Waiting for a decision",
                        },
                      ]}
                    />
                    <div className="section-heading catalog-heading">
                      <div>
                        <p className="eyebrow">Find your niche</p>
                        <h2>A world of creative possibilities</h2>
                      </div>
                      <a>Explore all ↗</a>
                    </div>
                    <div className="category-strip">
                      {[
                        ["Beauty", "serum"],
                        ["Fashion", "stones"],
                        ["Travel", "wide"],
                        ["Food & lifestyle", "studio"],
                      ].map(([name, img]) => (
                        <a key={name}>
                          <img src={"/editorial/" + img + ".jpg"} alt="" />
                          <span>{name}</span>
                          <ArrowUpRight size={13} />
                        </a>
                      ))}
                    </div>
                    <div className="section-heading catalog-heading">
                      <div>
                        <p className="eyebrow">The bigger picture</p>
                        <h2>Performance overview</h2>
                      </div>
                      <PeriodControl
                        value={{ months: 6 }}
                        onChange={() => {}}
                      />
                    </div>
                    <div className="analytics-grid">
                      <article className="panel chart-panel">
                        <h3>
                          {view === "earnings"
                            ? "Net earnings vs withdrawals"
                            : "Funding & releases"}
                        </h3>
                        <p className="muted">Monthly · Asia/Kolkata</p>
                        <MoneyChart
                          data={months}
                          kind={view === "earnings" ? "area" : "bar"}
                          keys={
                            view === "earnings"
                              ? [
                                  ["earnedMinor", "Net earned", "#003b59"],
                                  ["withdrawnMinor", "Withdrawn", "#ffb118"],
                                ]
                              : [
                                  [
                                    "fundedMinor",
                                    "Funding verified",
                                    "#003b59",
                                  ],
                                  [
                                    "earnedMinor",
                                    "Creator net released",
                                    "#ffb118",
                                  ],
                                ]
                          }
                        />
                      </article>
                      <article className="panel chart-panel">
                        <h3>Collaboration outcomes</h3>
                        <p className="muted">
                          All authorized work · current status
                        </p>
                        <Distribution
                          data={[
                            { name: "COMPLETED", value: 38 },
                            { name: "IN_REVIEW", value: 8 },
                            { name: "PREPARATION", value: 4 },
                            { name: "REVISION_REQUESTED", value: 2 },
                          ]}
                        />
                        <div className="chart-foot">
                          <span>Completion rate</span>
                          <strong>73%</strong>
                          <div className="progress-track">
                            <i style={{ width: "73%" }} />
                          </div>
                        </div>
                      </article>
                    </div>
                    <div className="dashboard-work-grid">
                      <section className="panel">
                        <div className="section-heading">
                          <h2>Your move</h2>
                          <span className="count-pill">3 to review</span>
                        </div>
                        {[
                          "Review the morning glow edit",
                          "Confirm product shipment",
                          "Check the final handover",
                        ].map((t) => (
                          <a className="action-card" key={t}>
                            <span className="action-icon">
                              <Clock size={18} />
                            </span>
                            <div>
                              <strong>{t}</strong>
                              <p>Creator collaboration · due 20 Nov</p>
                            </div>
                            <ArrowUpRight size={17} />
                          </a>
                        ))}
                      </section>
                      <section className="panel">
                        <h2>Coming up next</h2>
                        {["Riya Kapoor", "Arjun Menon", "Meera Nair"].map(
                          (n, i) => (
                            <a className="deadline-row" key={n}>
                              <div className="date-block">
                                <strong>{20 + i}</strong>
                                <span>Nov</span>
                              </div>
                              <div>
                                <strong>{n}</strong>
                                <p>Content delivery</p>
                              </div>
                              <ArrowUpRight size={15} />
                            </a>
                          ),
                        )}
                      </section>
                    </div>
                  </>
                )}
                {view === "reviews" ? (
                  <section className="panel">
                    <div className="section-heading">
                      <h2>Share your experience</h2>
                      <span className="count-pill">2 to review</span>
                    </div>
                    {["Riya Kapoor", "Arjun Menon"].map((n) => (
                      <article className="review-opportunity" key={n}>
                        <Avatar name={n} />
                        <div>
                          <h3>{n}</h3>
                          <p>Completed creator collaboration · 8 Nov</p>
                        </div>
                        <button
                          className="primary"
                          onClick={() => setModal(true)}
                        >
                          <Star size={14} />
                          Write review
                        </button>
                      </article>
                    ))}
                  </section>
                ) : (
                  <>
                    <div className="section-heading catalog-heading">
                      <div>
                        <p className="eyebrow">
                          {view === "creators"
                            ? "People with a point of view"
                            : "The next creative connection"}
                        </p>
                        <h2>
                          {view === "creators"
                            ? "Creators with a story to tell"
                            : "Featured campaigns"}
                        </h2>
                      </div>
                      <a>View all ↗</a>
                    </div>
                    <div
                      className={
                        view === "creators" ? "creator-grid" : "card-grid"
                      }
                    >
                      {view === "creators"
                        ? ["Riya Kapoor", "Arjun Menon", "Meera Nair"].map(
                            (name, i) => (
                              <div key={name}>
                                <div
                                  className="fixture-portrait"
                                  style={{
                                    backgroundImage:
                                      "url(/editorial/" +
                                      ["riya", "arjun", "meera"][i] +
                                      ".jpg)",
                                  }}
                                />
                                <CreatorTile
                                  creator={{ ...creator, id: String(i), name }}
                                />
                              </div>
                            ),
                          )
                        : campaigns.map((c) => (
                            <CampaignTile campaign={c} key={c.id} />
                          ))}
                    </div>
                  </>
                )}
              </>
            )}
          </main>
          <nav className="mobile-bottom-nav">
            {[
              [LayoutDashboard, "Home", "dashboard"],
              [Compass, "Discover", "creators"],
              [Handshake, "Work", "campaigns"],
              [MessageSquare, "Chat", "chat"],
              [Menu, "More", "reviews"],
            ].map(([Icon, n, key]) => (
              <button
                key={n}
                className={view === key ? "active" : ""}
                onClick={() => setView(key)}
              >
                <Icon size={21} />
                <span>{n}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>
      {modal && (
        <Dialog title="Visual form fixture" onClose={() => setModal(false)}>
          <Form
            fields={[
              {
                name: "stars",
                label: "Your experience",
                type: "stars",
                required: true,
              },
              area("text", "Share your experience"),
            ]}
            onSubmit={() => setModal(false)}
            submit="Close fixture"
          />
        </Dialog>
      )}
    </AppContext.Provider>
  );
}
function ChatFixture() {
  return (
    <div className="messenger thread-open">
      <aside className="chat-inbox">
        <header>
          <div>
            <p className="eyebrow">Stay connected</p>
            <h1>
              Messages<span>3</span>
            </h1>
          </div>
        </header>
        <div className="chat-search">
          <Compass size={16} />
          <input placeholder="Search conversations" />
        </div>
        <div className="chat-filters">
          <span className="active">All conversations</span>
          <span>Campaigns & deals</span>
        </div>
        <div className="inbox-threads">
          {["Riya Kapoor", "Arjun Menon", "Meera Nair"].map((name, i) => (
            <button
              className={"chat-contact " + (!i ? "active" : "")}
              key={name}
            >
              <Avatar name={name} size={47} />
              <div className="contact-copy">
                <div>
                  <strong>{name}</strong>
                  <time>11:42 AM</time>
                </div>
                <p>
                  {i
                    ? "Thanks, I’ll share an update soon."
                    : "The revised cut is ready to review ✨"}
                </p>
                <small>Collaboration discussion</small>
              </div>
              {!i && <span className="unread-count">2</span>}
            </button>
          ))}
        </div>
        <div className="chat-connection live">
          <i />
          Live-chat visual fixture
        </div>
      </aside>
      <section className="chat-thread" style={{ display: "flex" }}>
        <header className="chat-thread-header">
          <button className="icon-button chat-back">
            <ChevronLeft />
          </button>
          <Avatar name="Riya Kapoor" size={43} />
          <div>
            <h2>Riya Kapoor</h2>
            <span>Live conversation fixture</span>
          </div>
          <div className="thread-actions">
            <button>View collaboration ↗</button>
          </div>
        </header>
        <div className="chat-context">
          <span>Collaboration discussion</span>
          <strong>The morning glow edit</strong>
        </div>
        <div className="chat-scroll">
          <div className="chat-date">Today</div>
          <article className="bubble incoming">
            <strong className="bubble-author">Riya Kapoor</strong>
            <p>
              Hi Ananya! I’ve shared the first cut. I kept the opening warm and
              natural, as we discussed.
            </p>
            <footer>
              <time>10:32 AM</time>
            </footer>
          </article>
          <article className="bubble outgoing">
            <strong className="bubble-author">Ananya Nair</strong>
            <p>
              Love the texture shots! Could we give the product close-up a
              little more breathing room at 0:12?
            </p>
            <footer>
              <time>10:36 AM</time>
              <CheckCheck size={16} className="read" />
            </footer>
          </article>
          <article className="bubble incoming">
            <strong className="bubble-author">Riya Kapoor</strong>
            <p>
              Absolutely. I’ll hold that shot a little longer and send a revised
              cut this afternoon ✨
            </p>
            <footer>
              <time>10:38 AM</time>
            </footer>
          </article>
          <article className="bubble outgoing">
            <p>
              Perfect, thank you! The rest feels really aligned with the brief.
            </p>
            <footer>
              <time>10:40 AM</time>
              <CheckCheck size={16} className="read" />
            </footer>
          </article>
          <article className="bubble incoming">
            <strong className="bubble-author">Riya Kapoor</strong>
            <p>
              The revised cut is ready to review. Let me know what you think!
            </p>
            <footer>
              <time>11:42 AM</time>
            </footer>
          </article>
        </div>
        <form className="chat-composer" onSubmit={(e) => e.preventDefault()}>
          <Paperclip size={20} />
          <textarea placeholder="Type a message…" />
          <button className="send-button">
            <Send size={20} />
          </button>
        </form>
      </section>
    </div>
  );
}
createRoot(document.getElementById("root")).render(<Preview />);
