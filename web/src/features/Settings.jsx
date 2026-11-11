import { Avatar } from "../components/Media";
import React, { useState } from "react";
import { Bell, ArrowUpRight, ChevronRight, Smartphone, CircleHelp, CreditCard, LockKeyhole, Monitor, Settings2, UserRound } from "lucide-react";
import { api, date, uid } from "../api/http";
import { useApp, useQuery } from "../app/context";
import { Badge, Collection, Form, Page, State, area, field, select, text, useCommand } from "../components/ui";

function deviceName(agent = "") {
  const system = /Android/.test(agent) ? "Android" : /iPhone|iPad/.test(agent) ? "iOS"
    : /Windows/.test(agent) ? "Windows" : /Macintosh/.test(agent) ? "macOS" : /Linux/.test(agent) ? "Linux" : null;
  const browser = /; wv[);]/.test(agent) ? "Insight app" : /Edg\//.test(agent) ? "Edge" : /Firefox\//.test(agent) ? "Firefox"
    : /Chrome\//.test(agent) ? "Chrome" : /Safari\//.test(agent) ? "Safari" : null;
  return [browser, system].filter(Boolean).join(" · ") || "Unrecognized device";
}

function SettingsLayout({ items, current, onChange, children }) {
  return <div className="settings-layout">
    <nav className="panel settings-nav" aria-label="Settings sections">
      {items.map(([key, title, Icon]) => <button key={key} aria-pressed={current === key} onClick={() => onChange(key)}>
        <Icon size={18}/><span>{title}</span><ChevronRight size={15} className="settings-nav-chevron"/>
      </button>)}
    </nav>
    <div className="settings-content">{children}</div>
  </div>;
}

export function AccountSettings() {
  const { auth, run, refresh, theme, setTheme } = useApp();
  const [section, setSection] = useState("account");
  const account = auth.user;
  const command = useCommand();
  async function update(body) {
    await run(() => api("/me", { method: "PATCH", body: { ...body, expectedVersion: account.version } }));
    await refresh();
  }

  return <Page title="Account settings">
    <SettingsLayout items={[["account", "Personal details", UserRound], ["security", "Security & sessions", LockKeyhole], ["notifications", "Notifications", Bell], ["appearance", "Appearance", Monitor]]} current={section} onChange={setSection}>
      {section === "account" && <section className="panel settings-panel">
        <h2>Personal details</h2>
        <div className="settings-account-card">
          <Avatar name={account.name} assetId={auth.creator?.avatarAssetId} size={46}/>
          <div><strong>{account.name}</strong><p>{account.email}</p></div>
          <Badge>{account.emailVerifiedAt ? "EMAIL_VERIFIED" : "EMAIL_UNVERIFIED"}</Badge>
        </div>
        {!account.emailVerifiedAt && <button onClick={() => run(() => api("/auth/email-verifications", { method: "POST", body: { email: account.email } }), "Verification email requested").catch(() => {})}>Send verification email</button>}
        <Form key={account.version} fields={[text("name", "Display name")]} initial={account} submit="Save personal details" onSubmit={update} />
      </section>}
      {section === "appearance" && <section className="panel settings-panel">
        <h2>Colour theme</h2>
        <div className="theme-choices">
          {["light", "dark"].map(mode => <button key={mode} className={"theme-choice " + mode} aria-pressed={theme === mode} onClick={() =>
            run(async () => { await update({ preferences: { theme: mode.toUpperCase() } }); setTheme(mode); }).catch(() => {})
          }><span className="theme-preview" aria-hidden="true"/>{mode === "light" ? "Light" : "Dark"}</button>)}
        </div>
      </section>}
      {section === "notifications" && <section className="panel settings-panel">
        <h2>In-app notifications</h2>
        <p className="muted">Choose what appears in your notification bell. Unread chats and pending approvals still appear in their own sections.</p>
        <Form key={account.version} fields={[
          { ...field("chatNotifications", "New messages", "switch", false), default: true, hint: "New messages from people in your workspace." },
          { ...field("reviewNotifications", "Client approval requests", "switch", false), default: true, hint: "Briefs, offers or videos waiting for a client decision." },
        ]} initial={account.preferences} submit="Save notification preferences" onSubmit={preferences => update({ preferences })}/>
      </section>}
      {section === "security" && <>
        <section className="panel settings-panel">
          <h2>Change password</h2>
          <Form fields={[field("currentPassword", "Current password", "password"), field("newPassword", "New password (12+ characters)", "password")]} submit="Update password" onSubmit={async body => {
            await run(() => api("/auth/password", { method: "PUT", body }), "Password updated");
            await refresh();
          }} />
        </section>
        <section className="panel settings-panel">
          <h2>Signed-in devices</h2>
          <Collection path="/auth/sessions" empty="No active sessions found" render={(rows, reload) => rows.map(session => <div className="list-row settings-device" key={uid(session)}>
            <span className="state-icon"><Smartphone size={18}/></span>
            <div><strong>{deviceName(session.userAgent)}</strong><p>Signed in {date(session.createdAt)}</p></div>
            <button onClick={() => command.open("Sign out this device", "/auth/sessions/" + uid(session), {
              method: "DELETE", after: () => { reload(); refresh(); },
            })}>Sign out device</button>
          </div>)} />
          <button className="danger" onClick={() => command.open("Sign out everywhere", "/auth/logout-all", { after: refresh, submit: "Sign out all devices" })}>Sign out everywhere</button>
        </section>
      </>}
    </SettingsLayout>
    {command.modal}
  </Page>;
}

const fundingFields = [
  text("bankName", "Bank name", false),
  text("accountName", "Account holder", false),
  text("accountNumber", "Account number", false),
  text("ifsc", "IFSC", false),
  text("upiId", "UPI ID", false),
  area("note", "Funding instructions", false),
];

export function PlatformSettings() {
  const [section, setSection] = useState("fees");
  const q = useQuery("/owner/settings");
  const { run } = useApp();
  return <Page title="Platform settings" actions={<a className="button" href="#/settings">Personal settings <ArrowUpRight size={15}/></a>}>
    <SettingsLayout items={[["fees", "Platform fees", Settings2], ["funding", "Funding instructions", CreditCard], ["support", "Support contacts", CircleHelp]]} current={section} onChange={setSection}>
      <State query={q}>{settings => {
        const save = async body => {
          await run(() => api("/owner/settings", { method: "PUT", body: { ...body, expectedVersion: settings.version } }));
          q.reload();
        };
        return <section className="panel settings-panel" key={section + settings.version}>
          <p className="settings-version">Version {settings.version} · Effective {date(settings.effectiveAt)}</p>
          {section === "fees" && <>
            <h2>Platform fees</h2>
            <p className="muted">Commission changes apply to future sent offers. Existing agreements retain their recorded terms.</p>
            <Form fields={[field("commissionBps", "Commission (%)", "percent")]} initial={settings} submit="Save commission" onSubmit={save} />
          </>}
          {section === "funding" && <>
            <h2>Funding instructions</h2>
            <p className="muted">Members see these details when submitting funding for a collaboration.</p>
            <Form fields={fundingFields} initial={settings.fundingInstructions} submit="Save funding details" onSubmit={fundingInstructions => save({ fundingInstructions })} />
          </>}
          {section === "support" && <>
            <h2>Support contacts</h2>
            <Form fields={[field("email", "Support email", "email", false), text("phone", "Support phone", false)]} initial={settings.supportContact} submit="Save support contacts" onSubmit={supportContact => save({ supportContact })} />
          </>}
        </section>;
      }}</State>
    </SettingsLayout>
  </Page>;
}
