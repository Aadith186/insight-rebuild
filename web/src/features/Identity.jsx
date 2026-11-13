import { ANDROID_APP, editorialImage } from "../app/platform";
import { ArrowUpRight, Link2, Server } from "lucide-react";
import React, { useEffect, useState } from "react";
import { api, go } from "../api/http";
import { useApp, useRoute } from "../app/context";
import { Form, text, field, select } from "../components/ui";
export default function Identity() {
  const { adopt, notify } = useApp(),
    route = useRoute(),
    [mode, setMode] = useState(
      route.startsWith("/register") ? "register" : "login",
    ),
    params = new URLSearchParams(route.split("?")[1]),
    verify = route.startsWith("/verify-email"),
    reset = route.startsWith("/reset-password");
  useEffect(() => {
    // Free hosting sleeps. Ping it as soon as the sign-in screen is open.
    api("/health/live", { timeoutMs: 45000 }).catch(() => {});
  }, []);
  const fields = verify
    ? []
    : reset
      ? [field("newPassword", "New password (12+ characters)", "password")]
      : mode === "forgot"
        ? [field("email", "Email address", "email")]
        : [
            ...(mode === "register"
              ? [text("name", "Your name / organization name")]
              : []),
            field("email", "Email address", "email"),
            { ...field("password", mode === "register" ? "Password (12+ characters)" : "Password", "password"),
              autoComplete: mode === "register" ? "new-password" : "current-password" },
            ...(mode === "register"
              ? [
                  select("accountType", "Join as", [
                    "CREATOR",
                    "BRAND",
                    "AGENCY",
                  ]),
                ]
              : []),
          ];
  return (
    <main className="auth-layout">
      {ANDROID_APP ? <section className="android-auth-cover">
        <img src={editorialImage("studio")} alt="" />
        <div><span className="android-mark">i<span>●</span></span><strong>Insight</strong></div>
      </section> : <section className="auth-story">
        <a href="#/" className="brand">
          Insight<span>●</span>
        </a>
        <div>
          <p className="eyebrow">Creators. Brands. Possibilities.</p>
          <h1>
            Ideas meet
            <br />
            <em>influence.</em>
          </h1>
          <p>
            A shared space for people who create and brands with something to
            say.
          </p>
          <div className="story-points">
            <p>01 &nbsp; Find the right creative connection</p>
            <p>02 &nbsp; Build a clear agreement</p>
            <p>03 &nbsp; Bring your best work to life</p>
          </div>
        </div>
        <small>Insight · Create with purpose.</small>
      </section>}
      <section className="auth-form">
        <div className="auth-card">
          {!ANDROID_APP && <p className="eyebrow">Welcome to Insight</p>}
          <h2>
            {verify
              ? "Verify your email"
              : reset
                ? "Choose a new password"
                : mode === "register"
                  ? ANDROID_APP ? "Create your account" : "Make your next connection"
                  : mode === "forgot"
                    ? "Reset your password"
                    : ANDROID_APP ? "Sign in" : "Your next collaboration awaits"}
          </h2>
          <p className="muted">
            {verify
              ? "Confirm the link sent to your email."
              : mode === "register"
                ? "Create your account and start collaborating."
                : "Sign in to continue your work."}
          </p>
          <Form
            key={mode + route}
            fields={fields}
            submit={
              verify
                ? "Confirm email"
                : reset
                  ? "Reset password"
                  : mode === "forgot"
                    ? "Send reset email"
                    : mode === "register"
                      ? "Create account"
                      : "Sign in"
            }
            onSubmit={async (b) => {
              const path = verify
                ? "/auth/email-verifications/confirm"
                : reset
                  ? "/auth/password-resets/confirm"
                  : mode === "forgot"
                    ? "/auth/password-resets"
                    : mode === "register"
                      ? "/auth/register"
                      : "/auth/login";
              const send = () =>
                api(path, {
                  method: "POST",
                  timeoutMs: 45000,
                  body: verify
                    ? { token: params.get("token") }
                    : reset
                      ? { token: params.get("token"), ...b }
                      : b,
                });
              let r;
              try {
                r = await send();
              } catch (e) {
                if (![502, 503, 504].includes(e.status)) throw e;
                await new Promise((resolve) => setTimeout(resolve, 2500));
                r = await send();
              }
              if (verify || reset || mode === "forgot") notify(r.data.message);
              else {
                if (!r.data?.user) throw new Error("Sign-in did not start a session.");
                adopt(r.data);
                if (!route.startsWith("/invitation")) go("/dashboard");
              }
            }}
          />
          {!verify && !reset && (
            <>
              <button
                className="text-button"
                onClick={() =>
                  setMode(mode === "register" ? "login" : "register")
                }
              >
                {mode === "register"
                  ? "Already have an account? Sign in"
                  : "New here? Create an account →"}
              </button>
              <button
                className="text-button muted"
                onClick={() => setMode("forgot")}
              >
                Forgot password?
              </button>
            </>
          )}
          {ANDROID_APP && <div className="android-auth-links">
            <a href="insight-app://open-link"><Link2 size={15}/> Open invitation or account link</a>
            <a href="insight-app://connection"><Server size={15}/> Server connection <ArrowUpRight size={13}/></a>
          </div>}
        </div>
      </section>
    </main>
  );
}
