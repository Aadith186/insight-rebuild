import { InboxFilters, InboxThread } from "../components/ChatInbox";
import { chatTime } from "../components/listing";
import React, { useEffect, useRef, useState, useDeferredValue } from "react";
import {
  Search,
  ArrowDown,
  RotateCw,
  Send,
  Paperclip,
  ChevronLeft,
  MessageCircle,
  Check,
  CheckCheck,
  WifiOff,
  X,
  Image as ImageIcon,
  File,
  MoreVertical,
} from "lucide-react";
import { api, uid, date, go } from "../api/http";
import { useApp, useQuery } from "../app/context";
import { useRealtime, emitAck } from "../app/realtime";
import { Avatar, assetURL } from "../components/Media";
import { Badge, Upload } from "../components/ui";
function mergeMessages(old, more) {
  const map = new Map(old.map((m) => [uid(m), m]));
  for (const m of more) map.set(uid(m), m);
  return [...map.values()].sort(
    (a, b) =>
      new Date(a.createdAt) - new Date(b.createdAt) ||
      uid(a).localeCompare(uid(b)),
  );
}
export function Messaging({ id }) {
  const { auth, role, workspace, clientId: selectedClient } = useApp(),
    { socket, status, summary } = useRealtime(),
    [inboxMode, setInboxMode] = useState("all"),
    [inboxCursor, setInboxCursor] = useState(""),
    [threads, setThreads] = useState([]),
    [search, setSearch] = useState(""),
    deferredSearch = useDeferredValue(search),
    inbox = useQuery(
      "/conversations?limit=30&search=" +
        encodeURIComponent(deferredSearch) +
        (inboxMode === "unread"
          ? "&unread=true"
          : inboxMode === "campaigns"
            ? "&contextType=CAMPAIGN"
            : inboxMode === "work"
              ? "&contextType=COLLABORATION"
              : "") +
        "&cursor=" +
        inboxCursor,
    ),
    conversation = useQuery(id ? "/conversations/" + id : null),
    [messages, setMessages] = useState([]),
    [cursor, setCursor] = useState(null),
    [hasMore, setHasMore] = useState(false),
    [drafts, setDrafts] = useState({}),
    [attachmentsOpen, setAttachmentsOpen] = useState(false),
    [sending, setSending] = useState(false),
    [error, setError] = useState(""),
    [joinedView, setJoinedView] = useState(""),
    [typing, setTyping] = useState(""),
    [readCursors, setReadCursors] = useState([]),
    [loading, setLoading] = useState(false),
    [away, setAway] = useState(false);
  const clientIds = useRef(new Map()),
    olderCursor = useRef(null),
    typingTimer = useRef(),
    lastTyped = useRef(0),
    visible = useRef(true),
    activeConversation = useRef(""),
    scroll = useRef(),
    scrollAnchor = useRef(null),
    followLatest = useRef(true);
  const viewKey = [id, workspace, selectedClient].join(":");
  activeConversation.current = viewKey;
  const joined = joinedView === viewKey;
  const draft = drafts[viewKey]?.text || "";
  const attachmentIds = drafts[viewKey]?.attachments || [];
  function setDraft(text) {
    setDrafts(previous => ({ ...previous, [viewKey]: { ...previous[viewKey], text } }));
  }
  function setAttachmentIds(update) {
    setDrafts(previous => ({
      ...previous,
      [viewKey]: { ...previous[viewKey], attachments: typeof update === "function" ? update(previous[viewKey]?.attachments || []) : update },
    }));
  }
  function refreshInbox() {
    setInboxCursor("");
    inbox.reload();
  }
  useEffect(() => {
    setInboxCursor("");
    setThreads([]);
  }, [inboxMode, deferredSearch, workspace, selectedClient]);
  useEffect(() => {
    if (!inbox.data) return;
    setThreads((old) => {
      const map = new Map((inboxCursor ? old : []).map((r) => [uid(r), r]));
      for (const r of inbox.data) map.set(uid(r), r);
      return [...map.values()].sort(
        (a, b) =>
          new Date(b.lastMessageAt) - new Date(a.lastMessageAt) ||
          uid(b).localeCompare(uid(a)),
      );
    });
  }, [inbox.data]);
  useEffect(() => {
    const f = () => {
      visible.current = !document.hidden;
      if (visible.current) {
        refreshInbox();
        if (id) load();
      }
    };
    document.addEventListener("visibilitychange", f);
    return () => document.removeEventListener("visibilitychange", f);
  }, [id]);
  async function load(older = false) {
    if (!id) return;
    const requestedView = viewKey;
    setLoading(true);
    try {
      const r = await api(
        "/conversations/" +
          id +
          "/messages" +
          (older && cursor ? "?cursor=" + cursor : ""),
      );
      if (activeConversation.current !== requestedView) return;
      if (older && scroll.current) {
        scrollAnchor.current = { height: scroll.current.scrollHeight, top: scroll.current.scrollTop };
      }
      setMessages((old) => mergeMessages(old, r.data));
      if (older || !olderCursor.current) {
        olderCursor.current = r.page?.nextCursor || null;
        setCursor(r.page?.nextCursor);
        setHasMore(r.page?.hasMore);
      }
      setError("");
    } catch (e) {
      if (activeConversation.current === requestedView) setError(e.message);
    } finally {
      if (activeConversation.current === requestedView) setLoading(false);
    }
  }
  React.useLayoutEffect(() => {
    setMessages([]);
    setAttachmentsOpen(false);
    setError("");
    setSending(false);
    olderCursor.current = null;
    setCursor(null);
    setHasMore(false);
    setTyping("");
    setReadCursors([]);
    scrollAnchor.current = null;
    followLatest.current = true;
    setAway(false);
    setJoinedView("");
    if (id) load();
    return () => clearTimeout(typingTimer.current);
  }, [id, workspace, selectedClient]);
  useEffect(() => {
    if (!socket || status !== "connected") return;
    let alive = true;
    const rooms = new Set(id ? [id] : []);
    for (const conversationId of rooms)
      emitAck(socket, "conversation:join", { conversationId })
        .then((d) => {
          if (alive && conversationId === id) {
            setJoinedView(viewKey);
            setReadCursors(d.readCursors || []);
            load();
          }
        })
        .catch((e) => {
          if (alive && conversationId === id) {
            setJoinedView("");
            setError(e.message);
          }
        });
    const onMessage = (e) => {
      refreshInbox();
      if (e.conversationId === id) {
        setMessages((old) => mergeMessages(old, [e.message]));
        if (
          visible.current &&
          e.message.senderUserId !== uid(auth.user) &&
          role !== "owner"
        )
          emitAck(socket, "conversation:read", {
            conversationId: id,
            lastMessageId: uid(e.message),
          }).catch(() => {});
      }
    };
    const onRead = (e) => {
      if (e.conversationId === id) setReadCursors(e.readCursors || []);
    };
    const onTyping = (e) => {
      if (e.conversationId === id && e.userId !== uid(auth.user)) {
        setTyping(e.typing ? e.name + " is typing…" : "");
        clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setTyping(""), 3000);
      }
    };
    const onRevoked = (e) => {
      if (e.conversationId === id) {
        setJoinedView("");
        setMessages([]);
        setThreads((old) => old.filter((t) => uid(t) !== e.conversationId));
        setError("Access to this conversation has changed.");
      }
    };
    socket.on("inbox:changed", refreshInbox);
    socket.on("message:new", onMessage);
    socket.on("conversation:read", onRead);
    socket.on("conversation:typing", onTyping);
    socket.on("conversation:revoked", onRevoked);
    return () => {
      alive = false;
      for (const conversationId of rooms)
        socket.emit("conversation:leave", { conversationId });
      socket.off("inbox:changed", refreshInbox);
      socket.off("message:new", onMessage);
      socket.off("conversation:read", onRead);
      socket.off("conversation:typing", onTyping);
      socket.off("conversation:revoked", onRevoked);
    };
  }, [socket, status, viewKey]);
  useEffect(() => {
    if (!id || !joined || !messages.length || role === "owner") return;
    const latest = messages.at(-1);
    emitAck(socket, "conversation:read", {
      conversationId: id,
      lastMessageId: uid(latest),
    }).catch(() => {});
  }, [joined, id, uid(messages.at(-1))]);
  React.useLayoutEffect(() => {
    const pane = scroll.current;
    if (!pane) return;
    if (scrollAnchor.current) {
      const { height, top } = scrollAnchor.current;
      pane.scrollTop = top + pane.scrollHeight - height;
      scrollAnchor.current = null;
    } else if (followLatest.current) {
      pane.scrollTop = pane.scrollHeight;
    }
  }, [messages, id]);
  async function send(e) {
    e.preventDefault();
    if (!joined || status !== "connected" || sending || (!draft.trim() && !attachmentIds.length)) return;
    setSending(true);
    setError("");
    try {
      if (!clientIds.current.has(viewKey)) clientIds.current.set(viewKey, crypto.randomUUID());
      const m = await emitAck(socket, "message:send", {
        conversationId: id,
        text: draft.trim() || undefined,
        attachmentAssetIds: attachmentIds,
        clientMessageId: clientIds.current.get(viewKey),
      });
      clientIds.current.delete(viewKey);
      setDrafts(previous => {
        const saved = previous[viewKey];
        if (saved?.text !== undefined && saved.text !== draft) return previous;
        if ((saved?.attachments || []).join() !== attachmentIds.join()) return previous;
        const next = { ...previous };
        delete next[viewKey];
        return next;
      });
      if (activeConversation.current === viewKey) {
        followLatest.current = true;
        setAway(false);
        setMessages((old) => mergeMessages(old, [m]));
        refreshInbox();
      }
    } catch (e) {
      if (activeConversation.current === viewKey) setError(e.message);
    } finally {
      if (activeConversation.current === viewKey) setSending(false);
    }
  }
  const c = conversation.loading ? null : conversation.data,
    rows = threads;
  return (
    <div className={"messenger " + (id ? "thread-open" : "")}>
      <aside className="chat-inbox">
        <header>
          <div>
            <h1>
              Chats
              {Boolean(summary?.conversations) && <span className="chat-total">
                {summary.conversations} unread
              </span>}
            </h1>
          </div>
          <button
            className="icon-button"
            aria-label="Refresh inbox"
            onClick={refreshInbox}
          >
            <RotateCw size={18} />
          </button>
        </header>
        <div className="chat-search">
          <Search size={17} />
          <input
            aria-label="Search conversations"
            placeholder="Search conversations"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && <button type="button" className="icon-button" aria-label="Clear conversation search" onClick={() => setSearch("")}><X size={16}/></button>}
        </div>
        <InboxFilters
          value={inboxMode}
          onChange={setInboxMode}
          unread={summary?.conversations || 0}
        />
        <div className="inbox-threads">
          {inbox.loading && !inbox.data ? (
            <p className="muted">Loading conversations…</p>
          ) : inbox.error ? (
            <p role="alert">{inbox.error.message}</p>
          ) : rows.length ? (
            rows.map((t) => (
              <InboxThread
                key={uid(t)}
                thread={t}
                active={uid(t) === id}
                userId={uid(auth.user)}
                onOpen={() => go("/conversations/" + uid(t))}
              />
            ))
          ) : (
            <div className="chat-zero">
              <MessageCircle size={30} />
              <h3>
                {inboxMode === "unread"
                  ? "You’re all caught up"
                  : search
                    ? "No matching conversations"
                    : "No conversations yet"}
              </h3>
              <p>
                {inboxMode === "unread"
                  ? "New unread messages will appear here."
                  : search
                    ? "Try a name, campaign or message snippet."
                    : "Open a campaign or creator profile to start one."}
              </p>
            </div>
          )}
        </div>
        {inbox.page?.hasMore && (
          <button
            className="inbox-load-more"
            disabled={inbox.loading}
            onClick={() => setInboxCursor(inbox.page.nextCursor)}
          >
            {inbox.loading ? "Loading…" : "Load more conversations"}
          </button>
        )}
        <div
          className={
            "chat-connection " + (status === "connected" ? "live" : "")
          }
        >
          <i />
          {status === "connected"
            ? "Connected to live chat"
            : status === "connecting"
              ? "Connecting to live chat…"
              : "Chat offline · messages stay stored"}
        </div>
      </aside>
      <section className="chat-thread">
        {!id ? (
          <div className="chat-welcome">
            <div className="chat-welcome-art">
              <MessageCircle size={65} />
            </div>
            <h2>Select a conversation</h2>
            <p>Choose a chat to read messages or reply.</p>
          </div>
        ) : conversation.error ? (
          <div className="chat-welcome" role="alert">
            <h2>Conversation unavailable</h2><p>{conversation.error.message}</p>
            <div className="actions"><button onClick={() => go("/conversations")}>Back to chats</button>
              <button onClick={conversation.reload}><RotateCw size={15}/> Try again</button></div>
          </div>
        ) : (
          <>
            <header className="chat-thread-header">
              <button
                className="icon-button chat-back"
                aria-label="Back to inbox"
                onClick={() => go("/conversations")}
              >
                <ChevronLeft />
              </button>
              <Avatar assetId={c?.avatarAssetId} name={c?.title} size={43} />
              <div>
                <h2>{c?.title || "Loading conversation…"}</h2>
                <span>
                  {typing ||
                    (status === "connected" && joined
                      ? "Live conversation"
                      : "Reconnecting…")}
                </span>
              </div>
              <div className="thread-actions">
                {c?.collaborationId ? (
                  <button
                    onClick={() => go("/collaborations/" + c.collaborationId)}
                  >
                    View collaboration ↗
                  </button>
                ) : c?.campaignId ? (
                  <button onClick={() => go("/campaigns/" + c.campaignId)}>
                    View campaign ↗
                  </button>
                ) : null}
              </div>
            </header>
            {c && (
              <div className="chat-context">
                <span>{c.contextLabel || labelContext(c.contextType)}</span>
                {c.campaignTitle && <strong>{c.campaignTitle}</strong>}
                {c.contextType === "CLIENT_REVIEW" && (
                  <small>Private client review · creator excluded</small>
                )}
              </div>
            )}
            <div className="chat-scroll" ref={scroll} onScroll={event => {
              const pane = event.currentTarget;
              followLatest.current = pane.scrollHeight - pane.clientHeight - pane.scrollTop < 96;
              setAway(!followLatest.current);
            }}>
              {hasMore && (
                <button
                  className="older-messages"
                  onClick={() => load(true)}
                  disabled={loading}
                >
                  Load older messages
                </button>
              )}
              {loading && !messages.length && (
                <p className="chat-date">Loading message history…</p>
              )}
              {messages.map((m, index) => {
                const mine = m.senderUserId === uid(auth.user),
                  day = new Date(m.createdAt).toDateString(),
                  previous = messages[index - 1],
                  prev = previous ? new Date(previous.createdAt).toDateString() : null,
                  grouped = day === prev && previous?.senderUserId === m.senderUserId &&
                    new Date(m.createdAt) - new Date(previous.createdAt) < 300000,
                  read = readCursors.some(
                    (r) =>
                      r.userId !== uid(auth.user) &&
                      r.lastReadMessageId &&
                      r.lastReadMessageId >= uid(m),
                  );
                return (
                  <React.Fragment key={uid(m)}>
                    {day !== prev && (
                      <div className="chat-date">{date(m.createdAt)}</div>
                    )}
                    <article
                      className={"bubble " + (mine ? "outgoing" : "incoming") + (grouped ? " grouped" : "")}
                    >
                      {!mine && !grouped && m.senderName && <strong className="bubble-author">{m.senderName}</strong>}
                      {m.text && <p>{m.text}</p>}
                      {(m.attachmentAssetIds || []).map((a) => (
                        <a
                          className="bubble-attachment"
                          key={a}
                          href={assetURL(a)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <File size={20} />
                          View attached file ↗
                        </a>
                      ))}
                      <footer>
                        <time dateTime={m.createdAt}>
                          {new Date(m.createdAt).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </time>
                        {mine &&
                          (read ? (
                            <CheckCheck
                              size={16}
                              className="read"
                              aria-label="Read by a participant"
                            />
                          ) : (
                            <Check size={15} aria-label="Stored" />
                          ))}
                      </footer>
                    </article>
                  </React.Fragment>
                );
              })}
              {!loading && !messages.length && !error && (
                <div className="chat-date">
                  Say hello to start the conversation.
                </div>
              )}
              {typing && (
                <div className="typing-bubble">
                  <i />
                  <i />
                  <i />
                  <small>{typing}</small>
                </div>
              )}
              <div />
            </div>
            {away && <button className="chat-jump" onClick={() => {
              if (!scroll.current) return;
              followLatest.current = true;
              scroll.current.scrollTop = scroll.current.scrollHeight;
              setAway(false);
            }}><ArrowDown size={15}/> Latest messages</button>}
            {error && (
              <div role="alert" className="chat-error">
                <WifiOff size={15} />
                {error}
                <button
                  onClick={() => {
                    socket?.connect();
                    load();
                  }}
                >
                  Retry connection
                </button>
              </div>
            )}
            {role !== "owner" && c && (
              <>
                <div className="chat-attachments">
                  {attachmentsOpen && c?.collaborationId && (
                    <Upload
                      purpose="EVIDENCE"
                      collaborationId={c.collaborationId}
                      onUploaded={(a) => {
                        setAttachmentIds((old) => [...old, uid(a)]);
                        setAttachmentsOpen(false);
                      }}
                    />
                  )}
                  {attachmentIds.map((a) => (
                    <span key={a}>
                      <Paperclip size={14} />
                      File attached
                      <button
                        aria-label="Remove attachment"
                        onClick={() =>
                          setAttachmentIds((old) => old.filter((x) => x !== a))
                        }
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
                <form className="chat-composer" onSubmit={send}>
                  <button
                    type="button"
                    className="icon-button"
                    disabled={!c?.collaborationId}
                    title={
                      c?.collaborationId
                        ? "Attach file"
                        : "File attachments are available within collaborations"
                    }
                    aria-label="Attach file"
                    onClick={() => setAttachmentsOpen((v) => !v)}
                  >
                    <Paperclip size={21} />
                  </button>
                  <textarea
                    aria-label="Message"
                    rows={1}
                    placeholder="Type a message…"
                    value={draft}
                    onChange={(e) => {
                      setDraft(e.target.value);
                      if (Date.now() - lastTyped.current > 1000 && joined) {
                        lastTyped.current = Date.now();
                        emitAck(socket, "conversation:typing", {
                          conversationId: id,
                          typing: true,
                        }).catch(() => {});
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing &&
                        !window.matchMedia("(pointer: coarse)").matches) {
                        e.preventDefault();
                        send(e);
                      }
                    }}
                  />
                  <button
                    className="send-button"
                    disabled={
                      !joined ||
                      status !== "connected" ||
                      sending ||
                      (!draft.trim() && !attachmentIds.length)
                    }
                    aria-label="Send message"
                  >
                    <Send size={20} />
                  </button>
                </form>
              </>
            )}
          </>
        )}
      </section>
    </div>
  );
}
const labelContext = (s) => s.replaceAll("_", " ").toLowerCase();
