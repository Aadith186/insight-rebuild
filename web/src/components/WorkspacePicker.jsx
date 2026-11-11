import React, { useState } from "react";
import {
  Building2,
  ChevronDown,
  Check,
  Search,
  LayoutGrid,
  UserCircle,
  ShieldCheck,
} from "lucide-react";
import { useApp } from "../app/context";
import { uid, go, money } from "../api/http";
import { ANDROID_APP } from "../app/platform";
import { Dialog } from "./ui";
import { Avatar } from "./Media";
export function WorkspacePicker({ clients, mode: externalMode, onClose }) {
  const a = useApp(),
    [localMode, setMode] = useState(null),
    [search, setSearch] = useState("");
  const mode = externalMode || localMode;
  const activeClient = clients?.find(
      (c) => c.brandOrganizationId === a.clientId,
    ),
    name =
      a.org?.name ||
      (a.role === "owner" ? "Platform administration" : "Creator studio");
  const choices = [
    ...(a.auth.creator
      ? [
          {
            id: "creator",
            name: "Creator studio",
            description: "Your profile, campaigns & earnings",
            icon: UserCircle,
            assetId: a.auth.creator.avatarAssetId,
          },
        ]
      : []),
    ...(!ANDROID_APP && a.auth.user.platformRole === "OWNER"
      ? [
          {
            id: "owner",
            name: "Platform administration",
            description: "Marketplace oversight",
            icon: ShieldCheck,
          },
        ]
      : []),
    ...a.auth.organizations.map((o) => ({
      id: uid(o),
      name: o.name,
      description: o.type === "AGENCY" ? "Agency workspace" : "Brand workspace",
      assetId: o.logoAssetId,
      icon: Building2,
    })),
  ];
  const matchingChoices = choices.filter(choice => choice.name.toLowerCase().includes(search.trim().toLowerCase()));
  function close() {
    onClose?.();
    setMode(null);
    setSearch("");
  }
  return (
    <div className="custom-workspace">
      {!externalMode && <button
        className="workspace-trigger"
        onClick={() => setMode("workspace")}
        aria-haspopup="dialog"
      >
        <Avatar
          assetId={a.org?.logoAssetId || a.auth.creator?.avatarAssetId}
          name={name}
          size={35}
        />
        <span>
          <small>YOUR WORKSPACE</small>
          <strong>{name}</strong>
        </span>
        <ChevronDown size={15} />
      </button>}
      {!externalMode && a.org?.type === "AGENCY" && (
        <button
          className="client-context-trigger"
          onClick={() => setMode("client")}
          aria-haspopup="dialog"
        >
          <LayoutGrid size={15} />
          <span>{activeClient?.brand?.name || "All authorized clients"}</span>
          <ChevronDown size={13} />
        </button>
      )}
      {mode && (
        <Dialog
          title={
            mode === "workspace"
              ? "Choose your workspace"
              : "Choose a client workspace"
          }
          onClose={close}
        >
          <p className="muted">
            {mode === "workspace"
              ? "Only accounts and organizations you belong to appear here."
              : "Keep briefs, conversations and payments in the right client context."}
          </p>
          <div className="picker-search">
            <Search size={17} />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                mode === "workspace" ? "Find a workspace" : "Find a client"
              }
              aria-label={mode === "workspace" ? "Search workspaces" : "Search clients"}
            />
          </div>
          <div className="workspace-cards">
            {mode === "workspace" ? (
              matchingChoices.length ? matchingChoices.map((w) => (
                  <button
                    className={
                      "workspace-choice " +
                      (a.workspace === w.id ? "selected" : "")
                    }
                    key={w.id}
                    onClick={() => {
                      a.changeWorkspace(w.id);
                      close();
                    }}
                  >
                    <Avatar assetId={w.assetId} name={w.name} size={45} />
                    <span>
                      <strong>{w.name}</strong>
                      <small>{w.description}</small>
                    </span>
                    {a.workspace === w.id ? (
                      <Check size={19} />
                    ) : (
                      <w.icon size={20} />
                    )}
                  </button>
                )) : <p className="muted">No workspaces match your search.</p>
            ) : (
              <>
                <button
                  className={
                    "workspace-choice " + (!a.clientId ? "selected" : "")
                  }
                  onClick={() => {
                    a.setClientId("");
                    go("/dashboard");
                    close();
                  }}
                >
                  <span className="all-clients-icon">
                    <LayoutGrid />
                  </span>
                  <span>
                    <strong>All authorized clients</strong>
                    <small>Combined work, approvals and finances</small>
                  </span>
                  {!a.clientId && <Check size={19} />}
                </button>
                {(clients || [])
                  .filter((c) =>
                    c.brand?.name.toLowerCase().includes(search.toLowerCase()),
                  )
                  .map((c) => (
                    <button
                      className={
                        "workspace-choice " +
                        (a.clientId === c.brandOrganizationId ? "selected" : "")
                      }
                      key={uid(c)}
                      onClick={() => {
                        a.setClientId(c.brandOrganizationId);
                        go("/dashboard");
                        close();
                      }}
                    >
                      <Avatar
                        assetId={c.brand?.logoAssetId}
                        name={c.brand?.name}
                        size={45}
                      />
                      <span>
                        <strong>{c.brand?.name}</strong>
                        <small>
                          {c.status === "ARCHIVED"
                            ? "Archived · historical work"
                            : c.budgetMinor
                              ? "Compensation budget " + money(c.budgetMinor)
                              : "Client workspace"}
                        </small>
                      </span>
                      {a.clientId === c.brandOrganizationId && (
                        <Check size={19} />
                      )}
                    </button>
                  ))}
              </>
            )}
          </div>
        </Dialog>
      )}
    </div>
  );
}
