import { ANDROID_APP } from "./platform";
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { api, setContext, uid } from "../api/http";
const C = createContext();
export const AppContext = C;
export const useApp = () => useContext(C);
const SIGNED_IN_KEY = "insight-signed-in";
const workspaceKey = (userId) => "insight-workspace:" + userId;
const clientKey = (userId) => "insight-client:" + userId;
function defaultWorkspace(auth) {
  if (!auth) return "";
  if (auth.creator) return "creator";
  if (auth.user.platformRole === "OWNER") return "owner";
  return String(auth.organizations[0]?.id || auth.organizations[0]?._id || "");
}
function restoreWorkspace(auth) {
  const saved = localStorage.getItem(workspaceKey(uid(auth.user)));
  if (saved === "creator" && auth.creator) return saved;
  if (saved === "owner" && auth.user.platformRole === "OWNER") return saved;
  if (
    saved &&
    auth.organizations.some((o) => String(o.id || o._id) === saved)
  )
    return saved;
  return defaultWorkspace(auth);
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
export function Provider({ children }) {
  const [auth, setAuth] = useState(null),
    [loading, setLoading] = useState(true),
    [sessionError, setSessionError] = useState(""),
    [workspace, setWorkspace] = useState(""),
    [clientId, setClientId] = useState(""),
    [epoch, setEpoch] = useState(0),
    [notice, setNotice] = useState(""),
    [theme, setTheme] = useState(
      localStorage.getItem("insight-theme") || "light",
    );
  const applyAuth = useCallback((data) => {
    if (!data?.user) {
      setAuth(null);
      localStorage.removeItem(SIGNED_IN_KEY);
      return null;
    }
    setAuth(data);
    localStorage.setItem(SIGNED_IN_KEY, "1");
    const nextWorkspace = restoreWorkspace(data);
    setWorkspace(nextWorkspace);
    const savedClient = localStorage.getItem(clientKey(uid(data.user))) || "";
    setClientId(savedClient);
    return data;
  }, []);
  const refresh = useCallback(async () => {
    const attempts = localStorage.getItem(SIGNED_IN_KEY) ? 2 : 1;
    let lastError;
    setLoading(true);
    setSessionError("");
    try {
      for (let attempt = 0; attempt < attempts; attempt++) {
        try {
          const r = await api("/auth/me", { timeoutMs: 20000 });
          if (ANDROID_APP && r.data?.user.platformRole === "OWNER") {
            await api("/auth/logout", { method: "POST" });
            applyAuth(null);
            setNotice("Use Insight on the web for platform administration.");
            return null;
          }
          setSessionError("");
          return applyAuth(r.data);
        } catch (e) {
          lastError = e;
          if (ANDROID_APP && e.code === "ANDROID_ROLE_UNAVAILABLE") {
            await api("/auth/logout", { method: "POST" }).catch(() => {});
            applyAuth(null);
            break;
          }
          // Only treat an explicit unauthenticated response as logout. Transient
          // proxy/cold-start failures must not wipe a valid browser session.
          if (e.status === 401) {
            applyAuth(null);
            break;
          }
          if (attempt < attempts - 1) await sleep(800 * (attempt + 1));
        }
      }
      if (lastError && lastError.status !== 401) {
        const message =
          lastError.message ||
          "Could not restore your session. Check your connection and retry.";
        setSessionError(message);
        setNotice(message);
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, [applyAuth]);
  useEffect(() => {
    refresh();
  }, [refresh]);
  useEffect(() => {
    if (!auth || !workspace) return;
    localStorage.setItem(workspaceKey(uid(auth.user)), workspace);
  }, [auth, workspace]);
  useEffect(() => {
    if (!auth) return;
    if (clientId) localStorage.setItem(clientKey(uid(auth.user)), clientId);
    else localStorage.removeItem(clientKey(uid(auth.user)));
  }, [auth, clientId]);
  const savedTheme = auth?.user.preferences?.theme;
  useEffect(() => {
    if (savedTheme === "LIGHT" || savedTheme === "DARK") setTheme(savedTheme.toLowerCase());
  }, [savedTheme, auth?.user.id]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("insight-theme", theme);
  }, [theme]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(t);
  }, [notice]);
  const org = auth?.organizations.find(
      (o) => String(o.id || o._id) === workspace,
    ),
    member = auth?.memberships.find(
      (m) => String(m.organizationId) === workspace,
    ),
    role =
      workspace === "owner"
        ? "owner"
        : workspace === "creator"
          ? "creator"
          : member?.role === "CLIENT_REVIEWER"
            ? "reviewer"
            : org?.type.toLowerCase();
  setContext({
    organizationId: org ? workspace : undefined,
    clientId: clientId || undefined,
  });
  async function run(fn, msg = "Saved") {
    try {
      const r = await fn();
      setEpoch((n) => n + 1);
      setNotice(msg);
      return r;
    } catch (e) {
      setNotice(e.message);
      throw e;
    }
  }
  function changeWorkspace(id) {
    setWorkspace(id);
    setClientId("");
    if (auth?.user) localStorage.removeItem(clientKey(uid(auth.user)));
    location.hash = "#/dashboard";
  }
  return (
    <C.Provider
      value={{
        auth,
        setAuth,
        adopt: applyAuth,
        refresh,
        loading,
        sessionError,
        workspace,
        changeWorkspace,
        org,
        member,
        role,
        clientId,
        setClientId,
        epoch,
        notice,
        notify: setNotice,
        run,
        theme,
        setTheme,
      }}
    >
      {children}
      {notice && (
        <div className="toast" role="status" onClick={() => setNotice("")}>
          {notice}
        </div>
      )}
    </C.Provider>
  );
}
export function useQuery(path, deps = []) {
  const { workspace, clientId, epoch } = useApp(),
    [rev, setRev] = useState(0),
    [s, setS] = useState({
      data: null,
      loading: true,
      error: null,
      page: null,
    });
  useEffect(() => {
    if (!path) {
      setS({ data: null, loading: false, error: null });
      return;
    }
    const ac = new AbortController();
    setS((s) => ({ ...s, loading: true, error: null }));
    api(path, { signal: ac.signal })
      .then((r) =>
        setS({ data: r.data, page: r.page, loading: false, error: null }),
      )
      .catch((e) => {
        if (e.name !== "AbortError")
          setS({ data: null, loading: false, error: e });
      });
    return () => ac.abort();
  }, [path, rev, workspace, clientId, epoch, ...deps]);
  return { ...s, reload: () => setRev((n) => n + 1) };
}
export function useRoute() {
  const [p, setP] = useState(location.hash.slice(1) || "/dashboard");
  useEffect(() => {
    const f = () => setP(location.hash.slice(1) || "/dashboard");
    addEventListener("hashchange", f);
    return () => removeEventListener("hashchange", f);
  }, []);
  return p;
}
