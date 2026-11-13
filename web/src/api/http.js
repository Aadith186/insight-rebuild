import { ANDROID_APP } from "../app/platform";

/**
 * Prefer same-origin `/api` (Vercel rewrites proxy to Render) so session cookies
 * stay first-party — required for Safari/mobile. Optional VITE_API_ORIGIN is only
 * for direct cross-origin setups.
 */
export const API_ORIGIN = String(import.meta.env.VITE_API_ORIGIN || "").replace(
  /\/$/,
  "",
);
export const apiPath = (path) =>
  (API_ORIGIN ? API_ORIGIN : "") + "/api/v1" + path;

let context = {};
export const setContext = (c) => (context = c);
export const getContext = () => ({ ...context });
// Native image/video requests cannot carry the workspace headers used by fetch.
// This selection never grants access: the server still checks current membership.
export function mediaURL(id) {
  if (!id) return null;
  const query = new URLSearchParams(
    Object.entries(context).filter(([, v]) => v),
  );
  return (
    apiPath("/media/assets/" + id + "/content") +
    (query.size ? "?" + query : "")
  );
}
export async function api(
  path,
  { method = "GET", body, key, signal, timeoutMs = 25000 } = {},
) {
  const multipart = body instanceof FormData;
  let res;
  const timeout =
    typeof AbortSignal !== "undefined" && AbortSignal.timeout
      ? AbortSignal.timeout(timeoutMs)
      : null;
  const combined =
    signal && timeout
      ? AbortSignal.any
        ? AbortSignal.any([signal, timeout])
        : signal
      : signal || timeout;
  try {
    res = await fetch(apiPath(path), {
      method,
      credentials: "include",
      signal: combined,
      headers: {
        ...(ANDROID_APP ? { "X-Insight-Client": "android" } : {}),
        ...(!multipart && body ? { "Content-Type": "application/json" } : {}),
        ...(context.organizationId
          ? { "X-Organization-Id": context.organizationId }
          : {}),
        ...(context.clientId ? { "X-Client-Id": context.clientId } : {}),
        ...(method !== "GET"
          ? { "Idempotency-Key": key || crypto.randomUUID() }
          : {}),
      },
      body: body ? (multipart ? body : JSON.stringify(body)) : undefined,
    });
  } catch (e) {
    if (e.name === "AbortError" || e.name === "TimeoutError") {
      if (signal?.aborted) throw e;
      const err = new Error(
        "Insight is waking up. Wait a few seconds and sign in again.",
      );
      err.status = 504;
      throw err;
    }
    throw new Error(
      "Cannot reach Insight. Check that the API server is running.",
    );
  }
  if (res.status === 204) return { data: null };
  if (!(res.headers.get("Content-Type") || "").includes("application/json")) {
    if (!res.ok) {
      const err = new Error(
        res.status === 502 || res.status === 503 || res.status === 504
          ? "Insight is waking up. Wait a few seconds and sign in again."
          : "Insight could not complete that request.",
      );
      err.status = res.status;
      throw err;
    }
    return { data: await res.blob() };
  }
  const r = await res.json();
  if (!res.ok) {
    const e = new Error(r.error?.message || "Request failed.");
    Object.assign(e, {
      status: res.status,
      code: r.error?.code,
      fields: r.error?.fieldErrors,
    });
    throw e;
  }
  return r;
}
export function uploadMedia(body, { signal, onProgress }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", apiPath("/media/assets"));
    xhr.withCredentials = true;
    xhr.responseType = "json";
    xhr.setRequestHeader("Idempotency-Key", crypto.randomUUID());
    if (ANDROID_APP) xhr.setRequestHeader("X-Insight-Client", "android");
    if (context.organizationId) xhr.setRequestHeader("X-Organization-Id", context.organizationId);
    if (context.clientId) xhr.setRequestHeader("X-Client-Id", context.clientId);
    const abort = () => xhr.abort();
    if (signal.aborted) { reject(new DOMException("Upload cancelled", "AbortError")); return; }
    signal.addEventListener("abort", abort, { once: true });
    xhr.upload.onprogress = event => {
      if (event.lengthComputable) onProgress(Math.round(event.loaded * 100 / event.total));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300 && xhr.response?.data) resolve(xhr.response.data);
      else reject(new Error(xhr.response?.error?.message || "Upload failed. Try again."));
    };
    xhr.onerror = () => reject(new Error("Connection lost. Select the file and try again."));
    xhr.onabort = () => reject(new DOMException("Upload cancelled", "AbortError"));
    xhr.onloadend = () => signal.removeEventListener("abort", abort);
    xhr.send(body);
  });
}
export const uid = (o) => String(o?.id || o?._id || "");
export const money = (n) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format((n || 0) / 100);
export const label = (s) =>
  String(s || "")
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
export const date = (s) =>
  s
    ? new Date(s).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";
export const go = (p) => (location.hash = "#" + p);
export async function download(path, name) {
  if (ANDROID_APP) {
    location.href = "insight-app://download?" + new URLSearchParams({
      path: apiPath(path),
      name,
      ...Object.fromEntries(Object.entries(context).filter(([, value]) => value)),
    });
    return;
  }
  const { data } = await api(path),
    u = URL.createObjectURL(data),
    a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  URL.revokeObjectURL(u);
}
