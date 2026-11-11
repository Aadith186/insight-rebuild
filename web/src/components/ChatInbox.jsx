import React from "react";
import { Check } from "lucide-react";
import { Avatar } from "./Media";
import { uid } from "../api/http";
import { chatTime } from "./listing";
export function InboxFilters({ value, onChange, unread = 0 }) {
  return (
    <div
      className="chat-filters"
      role="group"
      aria-label="Conversation filters"
    >
      {[
        ["all", "All"],
        ["unread", "Unread"],
        ["campaigns", "Campaigns"],
        ["work", "Work"],
      ].map(([mode, title]) => (
        <button
          key={mode}
          aria-pressed={value === mode}
          className={value === mode ? "active" : ""}
          onClick={() => onChange(mode)}
        >
          {title}
          {mode === "unread" && unread > 0 && <span>{unread}</span>}
        </button>
      ))}
    </div>
  );
}
export function InboxThread({ thread: t, active = false, userId, onOpen }) {
  return (
    <button
      className={
        "chat-contact " +
        (active ? "active " : "") +
        (t.unreadCount > 0 ? "has-unread" : "")
      }
      onClick={onOpen}
    >
      <Avatar assetId={t.avatarAssetId} name={t.title} size={47} />
      <div className="contact-copy">
        <div>
          <strong>{t.title || "Collaboration conversation"}</strong>
          <time>{chatTime(t.lastMessageAt)}</time>
        </div>
        <p>
          {t.lastMessage?.senderUserId === userId && <Check size={14} />}
          <span>
            {t.lastMessage?.senderUserId === userId ? "You: " : ""}
            {t.lastMessage?.text ||
              (t.lastMessage ? "Attachment" : "Start a conversation")}
          </span>
        </p>
        <small>
          {t.campaignTitle ||
            t.contextLabel ||
            t.contextType.replaceAll("_", " ")}
        </small>
      </div>
      {t.unreadCount > 0 && (
        <span
          className="unread-count"
          aria-label={t.unreadCount + " unread messages"}
        >
          {t.unreadCount > 99 ? "99+" : t.unreadCount}
        </span>
      )}
    </button>
  );
}
