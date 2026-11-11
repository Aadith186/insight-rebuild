import React, { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";
import { useApp, useQuery } from "./context";
import { uid, getContext, API_ORIGIN } from "../api/http";
const C = createContext({ socket: null, status: "disconnected", summary: {} });
export const useRealtime = () => useContext(C);
export function RealtimeProvider({ children }) {
  const { auth, workspace, clientId } = useApp(),
    unread = useQuery(auth ? "/inbox/summary" : null),
    [socket, setSocket] = useState(null),
    [status, setStatus] = useState("disconnected");
  useEffect(() => {
    if (!auth) return;
    const s = io(API_ORIGIN || undefined, {
      withCredentials: true,
      // Prefer polling first so same-origin Vercel rewrites can carry the session
      // cookie; websocket upgrade is unreliable through Vercel proxies.
      transports: ["polling", "websocket"],
      reconnection: true,
      reconnectionDelay: 700,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });
    setSocket(s);
    setStatus("connecting");
    s.on("connect", () => {
      setStatus("connected");
      emitAck(s, "inbox:watch", {}).catch(() => {});
      unread.reload();
    });
    s.on("inbox:changed", () => unread.reload());
    s.on("disconnect", () => setStatus("disconnected"));
    s.on("connect_error", () => setStatus("unavailable"));
    return () => {
      s.disconnect();
      setSocket(null);
    };
  }, [uid(auth?.user), workspace, clientId]);
  useEffect(() => {
    if (!auth) return;
    const timer = setInterval(unread.reload, 30000);
    const f = () => {
      if (!document.hidden) unread.reload();
    };
    document.addEventListener("visibilitychange", f);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", f);
    };
  }, [uid(auth?.user), workspace, clientId]);
  return (
    <C.Provider
      value={{
        socket,
        status,
        summary: unread.data || {},
        refreshUnread: unread.reload,
      }}
    >
      {children}
    </C.Provider>
  );
}
export function emitAck(socket, name, body) {
  return new Promise((resolve, reject) => {
    if (!socket?.connected)
      return reject(
        new Error(
          "Chat is offline. Reconnect and retry; your message has not been sent.",
        ),
      );
    socket.timeout(12000).emit(name, { ...getContext(), ...body }, (err, r) => {
      if (err)
        return reject(
          new Error(
            "Delivery not confirmed. Retry this message with the same ID.",
          ),
        );
      if (!r?.ok)
        return reject(new Error(r?.error?.message || "Chat request failed."));
      resolve(r.data);
    });
  });
}
