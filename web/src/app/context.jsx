import { ANDROID_APP } from "./platform";
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { api, setContext } from "../api/http";
const C = createContext();
export const AppContext = C;
export const useApp = () => useContext(C);
export function Provider({ children }) {
  const [auth, setAuth] = useState(null),
    [loading, setLoading] = useState(true),
    [workspace, setWorkspace] = useState(""),
    [clientId, setClientId] = useState(""),
    [epoch, setEpoch] = useState(0),
    [notice, setNotice] = useState(""),
    [theme, setTheme] = useState(
      localStorage.getItem("insight-theme") || "light",
    );
  const refresh = useCallback(async () => {
    try {
      const r = await api("/auth/me");
      if (ANDROID_APP && r.data?.user.platformRole === "OWNER") {
        await api("/auth/logout", { method: "POST" });
        setAuth(null);
        setNotice("Use Insight on the web for platform administration.");
        return;
      }
      setAuth(r.data);
    } catch (e) {
      if (ANDROID_APP && e.code === "ANDROID_ROLE_UNAVAILABLE") {
        await api("/auth/logout", { method: "POST" }).catch(() => {});
      }
      setAuth(null);
      if (e.status !== 401) setNotice(e.message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    refresh();
  }, []);
  useEffect(() => {
    if (auth && !workspace)
      setWorkspace(
        auth.creator
          ? "creator"
          : auth.user.platformRole === "OWNER"
            ? "owner"
            : String(
                auth.organizations[0]?.id || auth.organizations[0]?._id || "",
              ),
      );
  }, [auth, workspace]);
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
    location.hash = "#/dashboard";
  }
  return (
    <C.Provider
      value={{
        auth,
        setAuth,
        refresh,
        loading,
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
