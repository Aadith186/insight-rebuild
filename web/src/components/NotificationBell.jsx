import React, { useState, useEffect, useRef } from "react";
import {
  Bell,
  CheckCheck,
  ArrowUpRight,
  MessageSquare,
  ShieldCheck,
  Megaphone,
  RotateCw,
  Handshake,
} from "lucide-react";
import { useRealtime } from "../app/realtime";
import { useApp, useQuery } from "../app/context";
import { api, uid, go } from "../api/http";
import { chatTime } from "./listing";
export function UnreadBadge({ value }) {
  return value > 0 ? (
    <span className="nav-unread" aria-label={value + " unread"}>
      {value > 99 ? "99+" : value}
    </span>
  ) : null;
}
export function NotificationBell() {
  const [open, setOpen] = useState(false),
    ref = useRef(),
    button = useRef(),
    { summary, refreshUnread } = useRealtime(),
    { run } = useApp(),
    q = useQuery(open ? "/notifications?limit=6" : null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    const key = (e) => {
      if (e.key === "Escape" && !e.defaultPrevented) { setOpen(false); button.current?.focus(); }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  return (
    <div className="notification-bell" ref={ref}>
      <button
        ref={button}
        className="icon-button notification-trigger"
        aria-label={
          "Notifications" +
          (summary?.notifications
            ? ", " + summary.notifications + " unread"
            : "")
        }
        aria-expanded={open}
        aria-controls={open ? "insight-recent-notifications" : undefined}
        onClick={() => setOpen(!open)}
      >
        <Bell size={20} />
        <UnreadBadge value={summary?.notifications} />
      </button>
      {open && (
        <section
          id="insight-recent-notifications"
          className="notification-popover"
          aria-label="Recent notifications"
        >
          <header>
            <div>
              <h3>Notifications</h3>
              <p>{summary?.notifications || 0} unread updates</p>
            </div>
            <button
              className="icon-button"
              aria-label="Mark all notifications read"
              disabled={!summary?.notifications}
              onClick={() =>
                run(() =>
                  api("/notifications/read-all", { method: "POST", body: {} }),
                )
                  .then(() => {
                    q.reload();
                    refreshUnread?.();
                  })
                  .catch(() => {})
              }
            >
              <CheckCheck size={18} />
            </button>
          </header>
          <div className="notification-preview-list">
            {q.loading ? (
              <p className="muted">Loading updates…</p>
            ) : q.error ? (
              <div className="notification-empty" role="alert">
                <p>{q.error.message}</p><button onClick={q.reload}><RotateCw size={15}/> Try again</button>
              </div>
            ) : q.data?.length ? (
              q.data.map((n) => {
                const Icon = { conversations: MessageSquare, approvals: ShieldCheck, campaigns: Megaphone }[n.link?.screen] || Handshake;
                return <button
                  className={
                    "notification-preview " + (!n.readAt ? "unread" : "")
                  }
                  key={uid(n)}
                  onClick={() =>
                    run(() =>
                      api("/notifications/" + uid(n) + "/read", {
                        method: "POST",
                      }),
                    )
                      .then(() => {
                        setOpen(false);
                        refreshUnread?.();
                        go(
                          n.link?.screen
                            ? "/" +
                                n.link.screen +
                                (n.link.resourceId
                                  ? "/" + n.link.resourceId
                                  : "")
                            : "/notifications",
                        );
                      })
                      .catch(() => {})
                  }
                >
                  <span className="notice-icon">
                    <Icon size={18} aria-hidden="true"/>
                  </span>
                  <span>
                    <strong>{n.title}</strong>
                    <span>{n.body}</span>
                    <time>{chatTime(n.createdAt)}</time>
                  </span>
                  {!n.readAt && <i />}
                </button>;
              })
            ) : (
              <div className="notification-empty">
                <Bell size={28} />
                <h4>You’re up to date</h4>
                <p>New activity will appear here.</p>
              </div>
            )}
          </div>
          <a href="#/notifications" onClick={() => setOpen(false)}>
            View all activity <ArrowUpRight size={15} />
          </a>
        </section>
      )}
    </div>
  );
}
